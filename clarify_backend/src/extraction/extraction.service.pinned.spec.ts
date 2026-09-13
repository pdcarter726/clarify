import { ExtractionService } from './extraction.service';
import { PageFetcherService } from './page-fetcher.service';

const WATCH_URL = 'https://www.youtube.com/watch?v=p6OXUYkhonQ';

/** A watch page whose comment section can be loaded with a continuation token. */
function watchPageWithComments(description: string) {
  const player = {
    videoDetails: {
      title: 'Pizza Cups #shorts',
      shortDescription: description,
    },
  };
  const initialData = {
    itemSectionRenderer: {
      sectionIdentifier: 'comment-item-section',
      contents: [{ continuationCommand: { token: 'comments-token' } }],
    },
  };
  return `<script>ytcfg.set({"INNERTUBE_CLIENT_VERSION":"2.20260901.00.00"});</script>
    <script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>
    <script>var ytInitialData = ${JSON.stringify(initialData)};</script>`;
}

function commentsResponse(pinnedText: string) {
  return {
    items: [
      {
        commentViewModel: {
          commentViewModel: {
            commentKey: 'pinned',
            pinnedText: 'Pinned by @chef',
          },
        },
      },
    ],
    mutations: [
      {
        payload: {
          commentEntityPayload: {
            key: 'pinned',
            properties: { content: { content: pinnedText } },
          },
        },
      },
    ],
  };
}

describe('ExtractionService (pinned comments)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function serviceForPage(html: string) {
    return new ExtractionService({
      fetchPage: () => Promise.resolve({ html, finalUrl: WATCH_URL }),
    } as unknown as PageFetcherService);
  }

  it('reads the recipe from the pinned comment when the description has none', async () => {
    const commentsFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          commentsResponse(
            'Ingredients:\n1 can crescent rolls\npizza sauce\n\nInstructions:\nBake at 375° for 12 minutes.',
          ),
        ),
    });
    global.fetch = commentsFetch;

    const recipe = await serviceForPage(
      watchPageWithComments('Pizza cups for game day! Recipe below 👇'),
    ).extractFromUrl(WATCH_URL);

    expect(recipe.title).toBe('Pizza Cups');
    expect(recipe.ingredients.map((i) => i.name)).toEqual([
      'crescent rolls',
      'pizza sauce',
    ]);
    expect(recipe.instructions).toEqual([
      { stepNumber: 1, text: 'Bake at 375° for 12 minutes.' },
    ]);
    const [endpoint, init] = commentsFetch.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(endpoint).toContain('/youtubei/v1/next');
    expect(JSON.parse(init.body)).toMatchObject({
      continuation: 'comments-token',
    });
  });

  it('skips the comments request when the description already has the recipe', async () => {
    const commentsFetch = jest.fn();
    global.fetch = commentsFetch;

    const recipe = await serviceForPage(
      watchPageWithComments('2 cups flour\n1 egg\n1. Mix and bake.'),
    ).extractFromUrl(WATCH_URL);

    expect(recipe.ingredients).toHaveLength(2);
    expect(commentsFetch).not.toHaveBeenCalled();
  });

  it('still fails with NotFound when neither source has a recipe and comments fail to load', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(
      serviceForPage(watchPageWithComments('Just a vlog')).extractFromUrl(
        WATCH_URL,
      ),
    ).rejects.toThrow(
      'No recipe found in the YouTube description or pinned comment',
    );
  });
});
