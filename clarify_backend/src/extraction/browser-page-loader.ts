import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'playwright-core';
import { isBotChallenge } from './bot-challenge';

/** A real desktop Chrome UA; headless Chromium otherwise advertises "HeadlessChrome". */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

const NAVIGATION_TIMEOUT_MS = 30_000;
const CHALLENGE_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_PAGES = 2;

/** HTML rendered by the headless browser; `blocked` means a bot check never cleared. */
export interface LoadedPage {
  html: string;
  finalUrl: string;
  status: number;
  blocked: boolean;
}

/**
 * Loads pages in a shared headless Chromium (via playwright-core) so that
 * sites guarded by JavaScript bot checks (e.g. Cloudflare) can be scraped.
 * The browser is launched lazily on first use and reused across requests;
 * set SCRAPER_BROWSER=off to disable it entirely.
 */
@Injectable()
export class BrowserPageLoader implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPageLoader.name);
  private browserPromise?: Promise<Browser>;
  private activePages = 0;
  private readonly waiting: (() => void)[] = [];

  get enabled(): boolean {
    return process.env.SCRAPER_BROWSER !== 'off';
  }

  async load(url: string): Promise<LoadedPage> {
    await this.acquireSlot();
    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: BROWSER_USER_AGENT,
        locale: 'en-US',
        viewport: { width: 1366, height: 900 },
      });
      try {
        const page = await context.newPage();
        // Only the markup and scripts matter for extraction.
        await page.route('**/*', (route) =>
          ['image', 'media', 'font'].includes(route.request().resourceType())
            ? route.abort()
            : route.continue(),
        );
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT_MS,
        });

        // Bot-check interstitials run their JS and then navigate to the real
        // page, so poll until the challenge markup is gone.
        let html = await readContent(page);
        const deadline = Date.now() + CHALLENGE_TIMEOUT_MS;
        while (isBotChallenge(html) && Date.now() < deadline) {
          await page.waitForTimeout(1000);
          html = await readContent(page);
        }

        return {
          html,
          finalUrl: page.url(),
          status: response?.status() ?? 0,
          blocked: isBotChallenge(html),
        };
      } finally {
        await context.close();
      }
    } finally {
      this.releaseSlot();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise.catch(() => undefined);
    this.browserPromise = undefined;
    await browser?.close();
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = import('playwright-core')
        .then(({ chromium }) =>
          chromium.launch({
            headless: true,
            channel: 'chromium',
            args: [
              '--disable-blink-features=AutomationControlled',
              // Containers usually run as root, where Chromium's sandbox can't start.
              '--no-sandbox',
            ],
          }),
        )
        .then((browser) => {
          browser.on('disconnected', () => {
            this.browserPromise = undefined;
          });
          return browser;
        })
        .catch((error: Error) => {
          this.browserPromise = undefined;
          this.logger.error(`Could not launch Chromium: ${error.message}`);
          throw error;
        });
    }
    return this.browserPromise;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activePages < MAX_CONCURRENT_PAGES) {
      this.activePages++;
      return;
    }
    // The releasing caller hands its slot straight to us.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.activePages--;
  }
}

async function readContent(page: {
  content(): Promise<string>;
}): Promise<string> {
  try {
    return await page.content();
  } catch {
    // The page is mid-navigation (e.g. a challenge redirecting); try again next poll.
    return '';
  }
}
