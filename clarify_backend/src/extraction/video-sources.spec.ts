import {
  canonicalVideoUrl,
  detectVideoPlatform,
  extractJsonObject,
  parseVideoPage,
} from './video-sources';

describe('detectVideoPlatform', () => {
  it.each([
    ['https://www.youtube.com/watch?v=z2G6p-CDOeQ', 'youtube'],
    ['https://youtu.be/z2G6p-CDOeQ', 'youtube'],
    ['https://m.youtube.com/shorts/z2G6p-CDOeQ', 'youtube'],
    ['https://www.tiktok.com/@chef/video/123', 'tiktok'],
    ['https://vm.tiktok.com/ZMabc/', 'tiktok'],
    ['https://www.instagram.com/reel/C0Q7dQJrZbE/', 'instagram'],
    ['https://www.allrecipes.com/recipe/1/x/', undefined],
    ['https://notyoutube.com/watch', undefined],
    ['not a url', undefined],
  ])('%s -> %s', (url, expected) => {
    expect(detectVideoPlatform(url)).toBe(expected);
  });
});

describe('canonicalVideoUrl', () => {
  it('normalizes YouTube short links and Shorts to watch URLs', () => {
    const watch = 'https://www.youtube.com/watch?v=z2G6p-CDOeQ';
    expect(
      canonicalVideoUrl('youtube', 'https://youtu.be/z2G6p-CDOeQ?t=3'),
    ).toBe(watch);
    expect(
      canonicalVideoUrl('youtube', 'https://youtube.com/shorts/z2G6p-CDOeQ'),
    ).toBe(watch);
    expect(canonicalVideoUrl('youtube', `${watch}&list=abc`)).toBe(watch);
  });

  it('leaves other platforms alone', () => {
    const url = 'https://vm.tiktok.com/ZMabc/';
    expect(canonicalVideoUrl('tiktok', url)).toBe(url);
  });
});

describe('extractJsonObject', () => {
  it('brace-matches past "};" inside strings', () => {
    const html =
      '<script>var ytInitialPlayerResponse = {"a":"x};y","b":{"c":1}};var other = {};</script>';
    expect(extractJsonObject(html, /ytInitialPlayerResponse\s*=\s*\{/)).toEqual(
      {
        a: 'x};y',
        b: { c: 1 },
      },
    );
  });
});

describe('parseVideoPage', () => {
  it('reads a YouTube description, title, and largest thumbnail', () => {
    const player = {
      videoDetails: {
        title: 'Pancakes #food',
        shortDescription: '2 cups flour\n1 egg',
        thumbnail: {
          thumbnails: [
            { url: 'https://i.ytimg.com/s.jpg' },
            { url: 'https://i.ytimg.com/l.jpg' },
          ],
        },
      },
    };
    const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`;
    expect(parseVideoPage('youtube', html)).toEqual({
      title: 'Pancakes #food',
      description: '2 cups flour\n1 egg',
      imageUrl: 'https://i.ytimg.com/l.jpg',
    });
  });

  it('reads a TikTok caption from the rehydration data', () => {
    const data = {
      __DEFAULT_SCOPE__: {
        'webapp.video-detail': {
          itemInfo: {
            itemStruct: {
              desc: 'Easy salsa 🍅',
              video: { cover: 'https://p16.tiktokcdn.com/c.jpg' },
            },
          },
        },
      },
    };
    const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script>`;
    expect(parseVideoPage('tiktok', html)).toEqual({
      description: 'Easy salsa 🍅',
      imageUrl: 'https://p16.tiktokcdn.com/c.jpg',
    });
  });

  it('reads an Instagram caption from og:description, including line breaks', () => {
    const html = `<meta property="og:description" content="1,234 likes, 56 comments - chef on June 1, 2024: &quot;Easy salsa&#10;2 tomatoes&quot;. " />
      <meta property="og:image" content="https://scontent.cdninstagram.com/i.jpg" />`;
    expect(parseVideoPage('instagram', html)).toEqual({
      description: 'Easy salsa\n2 tomatoes',
      imageUrl: 'https://scontent.cdninstagram.com/i.jpg',
    });
  });

  it('returns undefined when a page has no post data (e.g. a login wall)', () => {
    const html = '<html><head><title>Instagram</title></head></html>';
    expect(parseVideoPage('instagram', html)).toBeUndefined();
    expect(parseVideoPage('tiktok', html)).toBeUndefined();
    expect(parseVideoPage('youtube', html)).toBeUndefined();
  });
});
