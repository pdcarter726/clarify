/* eslint-disable @typescript-eslint/require-await -- mock Response#text
   implementations use `async () => value` as a one-line resolved promise. */
import { BadRequestException } from '@nestjs/common';
import { BrowserPageLoader, LoadedPage } from './browser-page-loader';
import {
  PageFetcherService,
  assertPublicHttpUrl,
} from './page-fetcher.service';

const CHALLENGE_HTML =
  '<html><head><title>Just a moment...</title></head><body></body></html>';

function fakeBrowser(result: LoadedPage | Error, enabled = true) {
  const load = jest.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    loader: { enabled, load } as unknown as BrowserPageLoader,
    load,
  };
}

function mockFetch(status: number, html: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    url: 'https://example.com/final',
    text: async () => html,
  });
}

describe('PageFetcherService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns plain HTTP results without launching the browser', async () => {
    mockFetch(200, '<html>ok</html>');
    const { loader, load } = fakeBrowser(new Error('unused'));

    await expect(
      new PageFetcherService(loader).fetchPage('https://example.com'),
    ).resolves.toEqual({
      html: '<html>ok</html>',
      finalUrl: 'https://example.com/final',
    });
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    [403, '<html>denied</html>'],
    [200, CHALLENGE_HTML],
  ])(
    'falls back to the browser on status %i / bot-check pages',
    async (status, html) => {
      mockFetch(status, html);
      const { loader, load } = fakeBrowser({
        html: '<html>real</html>',
        finalUrl: 'https://example.com/real',
        status: 200,
        blocked: false,
      });

      await expect(
        new PageFetcherService(loader).fetchPage('https://example.com'),
      ).resolves.toEqual({
        html: '<html>real</html>',
        finalUrl: 'https://example.com/real',
      });
      expect(load).toHaveBeenCalledWith('https://example.com');
    },
  );

  it('does not use the browser for ordinary errors like 404', async () => {
    mockFetch(404, 'not found');
    const { loader, load } = fakeBrowser(new Error('unused'));

    await expect(
      new PageFetcherService(loader).fetchPage('https://example.com'),
    ).rejects.toThrow('received status 404');
    expect(load).not.toHaveBeenCalled();
  });

  it('reports a block when the browser is also challenged', async () => {
    mockFetch(403, CHALLENGE_HTML);
    const { loader } = fakeBrowser({
      html: CHALLENGE_HTML,
      finalUrl: 'https://example.com',
      status: 403,
      blocked: true,
    });

    await expect(
      new PageFetcherService(loader).fetchPage('https://example.com'),
    ).rejects.toThrow('the site blocked automated access (status 403)');
  });

  it('reports a block when the browser cannot launch', async () => {
    mockFetch(403, 'denied');
    const { loader } = fakeBrowser(new Error('Executable doesn’t exist'));

    await expect(
      new PageFetcherService(loader).fetchPage('https://example.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('skips the browser when it is disabled', async () => {
    mockFetch(403, 'denied');
    const { loader, load } = fakeBrowser(new Error('unused'), false);

    await expect(
      new PageFetcherService(loader).fetchPage('https://example.com'),
    ).rejects.toThrow('received status 403');
    expect(load).not.toHaveBeenCalled();
  });
});

describe('assertPublicHttpUrl', () => {
  it.each(['https://www.allrecipes.com/recipe/1', 'http://93.184.216.34/page'])(
    'allows %s',
    (url) => {
      expect(() => assertPublicHttpUrl(url)).not.toThrow();
    },
  );

  it.each([
    'file:///etc/passwd',
    'http://localhost:3000',
    'http://127.0.0.1/',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1/',
    'http://[::1]/',
    'http://[::ffff:10.0.0.1]/',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(BadRequestException);
  });
});
