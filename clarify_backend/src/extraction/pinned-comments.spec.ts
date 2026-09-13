import {
  findTikTokPinnedCommentText,
  findYouTubeCommentsRequest,
  findYouTubePinnedCommentText,
  tiktokPostId,
} from './pinned-comments';

describe('findTikTokPinnedCommentText', () => {
  it.each([
    [{ author_pin: true, stick_position: 0 }],
    [{ author_pin: false, stick_position: 1 }],
  ])('finds the pinned comment flagged by %j', (flags) => {
    const response = {
      comments: [
        { text: 'first!', author_pin: false, stick_position: 0 },
        { text: 'Ingredients:\n2 eggs', ...flags },
      ],
    };
    expect(findTikTokPinnedCommentText(response)).toBe('Ingredients:\n2 eggs');
  });

  it('returns undefined when nothing is pinned or the response is unexpected', () => {
    expect(
      findTikTokPinnedCommentText({
        comments: [{ text: 'nice', author_pin: false, stick_position: 0 }],
      }),
    ).toBeUndefined();
    expect(findTikTokPinnedCommentText({ status_code: 5 })).toBeUndefined();
  });
});

describe('tiktokPostId', () => {
  it('reads video and photo post ids', () => {
    expect(
      tiktokPostId(
        'https://www.tiktok.com/@chef/video/7212345678901234567?lang=en',
      ),
    ).toBe('7212345678901234567');
    expect(
      tiktokPostId('https://www.tiktok.com/@chef/photo/7212345678901234567'),
    ).toBe('7212345678901234567');
    expect(tiktokPostId('https://vm.tiktok.com/ZMabc/')).toBeUndefined();
  });
});

describe('findYouTubeCommentsRequest', () => {
  it('reads the comment section continuation token and client version', () => {
    const initialData = {
      contents: {
        results: [
          {
            itemSectionRenderer: {
              sectionIdentifier: 'related-items',
              contents: [{ continuationCommand: { token: 'wrong-token' } }],
            },
          },
          {
            itemSectionRenderer: {
              sectionIdentifier: 'comment-item-section',
              contents: [
                {
                  continuationItemRenderer: {
                    continuationEndpoint: {
                      continuationCommand: { token: 'comments-token' },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };
    const html = `<script>ytcfg.set({"INNERTUBE_CLIENT_VERSION":"2.20260901.00.00"});</script>
      <script>var ytInitialData = ${JSON.stringify(initialData)};</script>`;

    expect(findYouTubeCommentsRequest(html)).toEqual({
      token: 'comments-token',
      clientVersion: '2.20260901.00.00',
    });
  });

  it('returns undefined when comments are unavailable', () => {
    const html = `<script>var ytInitialData = {"contents":{}};</script>`;
    expect(findYouTubeCommentsRequest(html)).toBeUndefined();
  });
});

describe('findYouTubePinnedCommentText', () => {
  const thread = (commentKey: string, pinnedText?: string) => ({
    commentThreadRenderer: {
      commentViewModel: { commentViewModel: { commentKey, pinnedText } },
    },
  });
  const payload = (key: string, content: string) => ({
    entityKey: key,
    payload: {
      commentEntityPayload: { key, properties: { content: { content } } },
    },
  });

  it('matches the pinned thread to its comment entity payload', () => {
    const response = {
      onResponseReceivedEndpoints: [
        {
          reloadContinuationItemsCommand: {
            continuationItems: [
              thread('key-pinned', 'Pinned by @chef'),
              thread('key-other'),
            ],
          },
        },
      ],
      frameworkUpdates: {
        entityBatchUpdate: {
          mutations: [
            payload('key-other', 'Looks great!'),
            payload('key-pinned', 'Ingredients:\n1 cup rice'),
          ],
        },
      },
    };

    expect(findYouTubePinnedCommentText(response)).toBe(
      'Ingredients:\n1 cup rice',
    );
  });

  it('supports the older commentRenderer layout', () => {
    const response = {
      items: [
        {
          commentRenderer: {
            pinnedCommentBadge: {},
            contentText: { runs: [{ text: '2 eggs' }, { text: '\nWhisk.' }] },
          },
        },
      ],
    };
    expect(findYouTubePinnedCommentText(response)).toBe('2 eggs\nWhisk.');
  });

  it('returns undefined when nothing is pinned', () => {
    const response = {
      items: [thread('key-a')],
      mutations: [payload('key-a', 'First!')],
    };
    expect(findYouTubePinnedCommentText(response)).toBeUndefined();
  });
});
