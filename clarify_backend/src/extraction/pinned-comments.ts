import { BROWSER_USER_AGENT } from './browser-page-loader';
import { asText, dig, extractJsonObject } from './video-sources';

const YOUTUBE_NEXT_ENDPOINT =
  'https://www.youtube.com/youtubei/v1/next?prettyPrint=false';
const TIKTOK_COMMENTS_ENDPOINT = 'https://www.tiktok.com/api/comment/list/';
const COMMENTS_TIMEOUT_MS = 10_000;

// Pinned-comment lookups are a best-effort extra source: every failure
// resolves to undefined so an import never fails because comments didn't load.

/**
 * Reads the pinned comment of a YouTube video using the same comments request
 * the watch page itself makes, seeded from the already-fetched watch page HTML.
 */
export async function fetchYouTubePinnedComment(
  watchHtml: string,
): Promise<string | undefined> {
  const request = findYouTubeCommentsRequest(watchHtml);
  if (!request) return undefined;
  const response = await fetchJson(YOUTUBE_NEXT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: request.clientVersion,
          hl: 'en',
          gl: 'US',
        },
      },
      continuation: request.token,
    }),
  });
  return findYouTubePinnedCommentText(response);
}

/** Reads the pinned comment of a TikTok post from the first page of its comments. */
export async function fetchTikTokPinnedComment(
  postUrl: string,
): Promise<string | undefined> {
  const postId = tiktokPostId(postUrl);
  if (!postId) return undefined;
  const query = new URLSearchParams({
    aid: '1988',
    aweme_id: postId,
    count: '20',
    cursor: '0',
  });
  const response = await fetchJson(`${TIKTOK_COMMENTS_ENDPOINT}?${query}`, {
    headers: { Referer: postUrl, Accept: 'application/json' },
  });
  return findTikTokPinnedCommentText(response);
}

/** Finds the comment section's continuation token and the web client version in a watch page. */
export function findYouTubeCommentsRequest(
  html: string,
): { token: string; clientVersion: string } | undefined {
  const clientVersion = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1];
  const data = extractJsonObject(html, /var ytInitialData\s*=\s*\{/);
  const section = findFirst(
    data,
    (node) => node.sectionIdentifier === 'comment-item-section',
  );
  const token = asText(
    dig(
      findFirst(section, (node) =>
        Boolean(asText(dig(node, 'continuationCommand', 'token'))),
      ),
      'continuationCommand',
      'token',
    ),
  );
  return token && clientVersion ? { token, clientVersion } : undefined;
}

/** Picks the pinned comment's text out of a comments (youtubei/v1/next) response. */
export function findYouTubePinnedCommentText(
  response: unknown,
): string | undefined {
  // Current layout: the thread's view model carries `pinnedText` and a key
  // into a separate entity payload that holds the comment body.
  const pinnedViewModel = findFirst(
    response,
    (node) =>
      Boolean(asText(node.pinnedText)) && Boolean(asText(node.commentKey)),
  );
  if (pinnedViewModel) {
    const payload = findFirst(
      response,
      (node) =>
        dig(node, 'commentEntityPayload', 'key') === pinnedViewModel.commentKey,
    );
    const text = asText(
      dig(payload, 'commentEntityPayload', 'properties', 'content', 'content'),
    );
    if (text) return text;
  }

  // Older layout: a commentRenderer with a pinned badge and text runs.
  const legacy = findFirst(response, (node) =>
    Boolean(dig(node, 'commentRenderer', 'pinnedCommentBadge')),
  );
  const runs = dig(legacy, 'commentRenderer', 'contentText', 'runs');
  if (Array.isArray(runs)) {
    return asText(runs.map((run) => asText(dig(run, 'text')) ?? '').join(''));
  }
  return undefined;
}

/** Picks the pinned comment's text out of a TikTok comment list response. */
export function findTikTokPinnedCommentText(
  response: unknown,
): string | undefined {
  const comments = dig(response, 'comments');
  if (!Array.isArray(comments)) return undefined;
  const pinned: unknown = comments.find((comment) => {
    const stickPosition = dig(comment, 'stick_position');
    return (
      dig(comment, 'author_pin') === true ||
      (typeof stickPosition === 'number' && stickPosition > 0)
    );
  });
  return asText(dig(pinned, 'text'));
}

/** The numeric post id in a TikTok video/photo URL (short links must be resolved first). */
export function tiktokPostId(url: string): string | undefined {
  return /\/(?:video|photo)\/(\d+)/.exec(url)?.[1];
}

async function fetchJson(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': BROWSER_USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(COMMENTS_TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

/** Depth-first search for the first object node matching `predicate`. */
function findFirst(
  value: unknown,
  predicate: (node: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (!Array.isArray(value)) {
    const node = value as Record<string, unknown>;
    if (predicate(node)) return node;
  }
  for (const child of Object.values(value)) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return undefined;
}
