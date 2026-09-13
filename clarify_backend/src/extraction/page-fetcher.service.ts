import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { isIP } from 'net';
import { BrowserPageLoader, BROWSER_USER_AGENT } from './browser-page-loader';
import { isBotChallenge } from './bot-challenge';

const HTTP_TIMEOUT_MS = 15_000;

// Statuses that bot protection typically answers with; worth retrying in a real browser.
const BLOCKED_STATUSES = new Set([403, 429, 503]);

const DEFAULT_HEADERS = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface FetchedPage {
  html: string;
  finalUrl: string;
}

export interface FetchPageOptions {
  /** Extra/overriding request headers for the plain HTTP attempt. */
  headers?: Record<string, string>;
  /** Whether a blocked request may be retried in headless Chromium (default true). */
  allowBrowser?: boolean;
}

/**
 * Fetches page HTML in tiers: a plain HTTP request first (fast and cheap),
 * then headless Chromium when the site blocks it or serves a bot check.
 */
@Injectable()
export class PageFetcherService {
  private readonly logger = new Logger(PageFetcherService.name);

  constructor(private readonly browser: BrowserPageLoader) {}

  /**
   * @throws BadRequestException if the URL isn't a public http(s) URL, or the
   * page can't be fetched by either tier.
   */
  async fetchPage(
    url: string,
    options: FetchPageOptions = {},
  ): Promise<FetchedPage> {
    assertPublicHttpUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...options.headers },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch URL: ${(error as Error).message}`,
      );
    }

    const html = await response.text();
    const challenged = isBotChallenge(html);
    if (response.ok && !challenged) {
      return { html, finalUrl: response.url || url };
    }
    if (!challenged && !BLOCKED_STATUSES.has(response.status)) {
      throw new BadRequestException(
        `Failed to fetch URL: received status ${response.status}`,
      );
    }

    if (options.allowBrowser === false || !this.browser.enabled) {
      throw new BadRequestException(
        `Failed to fetch URL: received status ${response.status}`,
      );
    }
    return this.fetchWithBrowser(url, response.status);
  }

  private async fetchWithBrowser(
    url: string,
    httpStatus: number,
  ): Promise<FetchedPage> {
    this.logger.log(
      `HTTP fetch of ${url} was blocked (${httpStatus}); retrying in headless Chromium`,
    );
    try {
      const page = await this.browser.load(url);
      if (!page.blocked) {
        return { html: page.html, finalUrl: page.finalUrl };
      }
    } catch (error) {
      this.logger.warn(
        `Headless Chromium failed for ${url}: ${(error as Error).message}`,
      );
    }
    throw new BadRequestException(
      `Failed to fetch URL: the site blocked automated access (status ${httpStatus})`,
    );
  }
}

/**
 * Rejects non-http(s) URLs and hosts that are obviously on a private network,
 * so imports can't be used to probe the server's own infrastructure.
 */
export function assertPublicHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Only http and https URLs can be imported');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    isPrivateIp(host)
  ) {
    throw new BadRequestException('URL points to a private network address');
  }
}

function isPrivateIp(host: string): boolean {
  const version = isIP(host);
  if (version === 4) {
    const [a, b] = host.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (version === 6) {
    // IPv4-mapped addresses; the URL parser rewrites ::ffff:10.0.0.1 as ::ffff:a00:1.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(host);
    if (mapped) return isPrivateIp(mapped[1]);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
    if (mappedHex) {
      const high = parseInt(mappedHex[1], 16);
      const low = parseInt(mappedHex[2], 16);
      return isPrivateIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return (
      host === '::' ||
      host === '::1' ||
      /^f[cd]/.test(host) ||
      /^fe[89ab]/.test(host)
    );
  }
  return false;
}
