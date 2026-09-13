import * as cheerio from 'cheerio';

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram';

export const PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

/** The parts of a social video post that a recipe can be read from. */
export interface VideoPost {
  title?: string;
  description: string;
  imageUrl?: string;
}

// Instagram only serves post metadata (caption, image) to link-preview crawlers
// without a login; a regular browser UA gets an empty app shell.
const LINK_PREVIEW_USER_AGENT =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

/** Identifies which supported video platform (if any) a URL belongs to. */
export function detectVideoPlatform(url: string): VideoPlatform | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  const matches = (domain: string) =>
    host === domain || host.endsWith(`.${domain}`);
  if (matches('youtube.com') || matches('youtu.be')) return 'youtube';
  if (matches('tiktok.com')) return 'tiktok';
  if (matches('instagram.com') || matches('instagr.am')) return 'instagram';
  return undefined;
}

/**
 * Maps a post URL to the form whose HTML carries the post data, e.g.
 * youtu.be/ID and /shorts/ID -> /watch?v=ID. Other URLs are returned as-is.
 */
export function canonicalVideoUrl(
  platform: VideoPlatform,
  url: string,
): string {
  if (platform !== 'youtube') return url;
  const parsed = new URL(url);
  const id =
    parsed.searchParams.get('v') ??
    (parsed.hostname.endsWith('youtu.be')
      ? parsed.pathname.slice(1)
      : /^\/(?:shorts|live|embed)\/([\w-]{11})/.exec(parsed.pathname)?.[1]);
  return id && /^[\w-]{11}$/.test(id)
    ? `https://www.youtube.com/watch?v=${id}`
    : url;
}

/** Request headers that make each platform return post data in its HTML. */
export function platformRequestHeaders(
  platform: VideoPlatform,
): Record<string, string> {
  switch (platform) {
    case 'instagram':
      return { 'User-Agent': LINK_PREVIEW_USER_AGENT };
    case 'youtube':
      // Skips the EU cookie-consent interstitial.
      return { Cookie: 'SOCS=CAI; CONSENT=YES+' };
    default:
      return {};
  }
}

/** Pulls the title/description/thumbnail out of a post page's HTML. */
export function parseVideoPage(
  platform: VideoPlatform,
  html: string,
): VideoPost | undefined {
  switch (platform) {
    case 'youtube':
      return parseYouTube(html);
    case 'tiktok':
      return parseTikTok(html);
    case 'instagram':
      return parseInstagram(html);
  }
}

function parseYouTube(html: string): VideoPost | undefined {
  const player = extractJsonObject(html, /ytInitialPlayerResponse\s*=\s*\{/);
  const description =
    asText(dig(player, 'videoDetails', 'shortDescription')) ??
    asText(
      dig(
        player,
        'microformat',
        'playerMicroformatRenderer',
        'description',
        'simpleText',
      ),
    );
  const $ = cheerio.load(html);
  if (!description) {
    const meta = asText($('meta[name="description"]').attr('content'));
    return meta ? { description: meta, title: ogTitle($) } : undefined;
  }
  const thumbnails = dig(player, 'videoDetails', 'thumbnail', 'thumbnails');
  const lastThumbnail = Array.isArray(thumbnails)
    ? (thumbnails[thumbnails.length - 1] as unknown)
    : undefined;
  return {
    title: asText(dig(player, 'videoDetails', 'title')) ?? ogTitle($),
    description,
    imageUrl: asText(dig(lastThumbnail, 'url')) ?? ogImage($),
  };
}

function parseTikTok(html: string): VideoPost | undefined {
  const $ = cheerio.load(html);
  let item: unknown;
  const rehydration = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').text();
  if (rehydration) {
    item = dig(
      safeJsonParse(rehydration),
      '__DEFAULT_SCOPE__',
      'webapp.video-detail',
      'itemInfo',
      'itemStruct',
    );
  }
  if (!item) {
    // Older page format keyed items by id under SIGI_STATE.ItemModule.
    const modules = dig(
      safeJsonParse($('script#SIGI_STATE').text()),
      'ItemModule',
    );
    if (modules && typeof modules === 'object') {
      item = Object.values(modules)[0];
    }
  }

  const description =
    asText(dig(item, 'desc')) ??
    asText($('meta[property="og:description"]').attr('content'));
  if (!description) return undefined;
  return {
    description,
    imageUrl: asText(dig(item, 'video', 'cover')) ?? ogImage($),
  };
}

function parseInstagram(html: string): VideoPost | undefined {
  const $ = cheerio.load(html);
  const meta =
    asText($('meta[property="og:description"]').attr('content')) ??
    asText($('meta[name="description"]').attr('content'));
  const title = asText($('meta[property="og:title"]').attr('content'));

  // og:description looks like `12 likes, 3 comments - user on June 1, 2024: "caption".`
  const caption =
    (meta &&
      /^[\d.,]+[KkMm]?\s+likes?,\s*[\d.,]+[KkMm]?\s+comments?\s+-\s+.+?\s+on\s+[^:]+:\s*"([\s\S]*)"\.?\s*$/.exec(
        meta,
      )?.[1]) ??
    // og:title looks like `Name on Instagram: "caption"`.
    (title && /^.+? on Instagram:\s*"([\s\S]*)"\s*$/.exec(title)?.[1]) ??
    meta;
  if (!caption?.trim()) return undefined;
  return { description: caption, imageUrl: ogImage($) };
}

function ogTitle($: cheerio.CheerioAPI): string | undefined {
  return asText($('meta[property="og:title"]').attr('content'));
}

function ogImage($: cheerio.CheerioAPI): string | undefined {
  return asText($('meta[property="og:image"]').attr('content'));
}

/**
 * Parses the JSON object literal that starts where `start` matches (the match
 * must end at the opening brace). Brace-matches instead of using a regex so
 * that "};" inside string values doesn't cut the object short.
 */
export function extractJsonObject(source: string, start: RegExp): unknown {
  const match = start.exec(source);
  if (!match) return undefined;
  const begin = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = begin; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return safeJsonParse(source.slice(begin, i + 1));
    }
  }
  return undefined;
}

function safeJsonParse(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function dig(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}
