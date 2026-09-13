/* eslint-disable @typescript-eslint/require-await -- mock Response#text
   implementations use `async () => value` throughout this file as the
   clearest one-line way to return a resolved promise from a fixture. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { PageFetcherService } from './page-fetcher.service';
import { BrowserPageLoader } from './browser-page-loader';

function htmlWithJsonLd(payload: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(
    payload,
  )}</script></head><body></body></html>`;
}

function mockFetch(
  response: Partial<Response> & { text?: () => Promise<string> },
) {
  global.fetch = jest.fn().mockResolvedValue(response);
}

describe('ExtractionService', () => {
  let service: ExtractionService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new ExtractionService(
      new PageFetcherService(new BrowserPageLoader()),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('fetchHtml', () => {
    it('sends browser-like headers so bot protection does not 403 the request', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () => htmlWithJsonLd({ '@type': 'Recipe', name: 'Soup' }),
      });

      await service.extractFromUrl('https://example.com');

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toBe('https://example.com');
      expect(init.headers['User-Agent']).toContain('Mozilla/5.0');
      expect(init.headers.Accept).toContain('text/html');
    });
  });

  describe('fetchHtml failures', () => {
    it('throws BadRequestException when fetch itself rejects', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the response is not ok', async () => {
      mockFetch({ ok: false, status: 404, text: async () => '' });

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recipe node discovery', () => {
    it('throws NotFoundException when there is no JSON-LD at all', async () => {
      mockFetch({ ok: true, status: 200, text: async () => '<html></html>' });

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when JSON-LD is malformed', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          '<html><head><script type="application/ld+json">{not json</script></head></html>',
      });

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when JSON-LD has no Recipe type', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({ '@type': 'Article', name: 'Not a recipe' }),
      });

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the recipe node has no title', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () => htmlWithJsonLd({ '@type': 'Recipe' }),
      });

      await expect(
        service.extractFromUrl('https://example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('finds a Recipe node inside an @graph array', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@graph': [
              { '@type': 'WebPage', name: 'Home' },
              { '@type': 'Recipe', name: 'Graph Recipe' },
            ],
          }),
      });

      const result = await service.extractFromUrl('https://example.com');
      expect(result.title).toBe('Graph Recipe');
    });

    it('finds a Recipe node when @type is an array of types', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': ['Thing', 'Recipe'],
            name: 'Multi-type Recipe',
          }),
      });

      const result = await service.extractFromUrl('https://example.com');
      expect(result.title).toBe('Multi-type Recipe');
    });

    it('finds a Recipe node inside a top-level array of JSON-LD nodes', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd([
            { '@type': 'WebPage' },
            { '@type': 'Recipe', name: 'Array Recipe' },
          ]),
      });

      const result = await service.extractFromUrl('https://example.com');
      expect(result.title).toBe('Array Recipe');
    });

    it('skips malformed JSON-LD blocks and keeps looking', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          '<html><head>' +
          '<script type="application/ld+json">{broken</script>' +
          `<script type="application/ld+json">${JSON.stringify({
            '@type': 'Recipe',
            name: 'Second Block Recipe',
          })}</script>` +
          '</head></html>',
      });

      const result = await service.extractFromUrl('https://example.com');
      expect(result.title).toBe('Second Block Recipe');
    });
  });

  describe('normalization', () => {
    it('extracts a string image url', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            image: 'https://img/1.jpg',
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.imageUrl).toBe('https://img/1.jpg');
    });

    it('extracts an image url from an ImageObject', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            image: { '@type': 'ImageObject', url: 'https://img/2.jpg' },
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.imageUrl).toBe('https://img/2.jpg');
    });

    it('extracts an image url from an array of images', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            image: ['https://img/3.jpg', 'https://img/4.jpg'],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.imageUrl).toBe('https://img/3.jpg');
    });

    it('leaves imageUrl undefined when image is missing', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () => htmlWithJsonLd({ '@type': 'Recipe', name: 'R' }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.imageUrl).toBeUndefined();
    });

    it('takes the first value of an array recipeYield instead of concatenating', async () => {
      // recipeYield arrays are typically redundant restatements of the same
      // yield (e.g. ["4", "4 servings"]), not distinct values to join.
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeYield: ['4', '4 servings'],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.servings).toBe('4');
    });

    it('skips a blank leading entry in an array recipeYield', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeYield: ['', '6 servings'],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.servings).toBe('6 servings');
    });

    it('stringifies a numeric recipeYield', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({ '@type': 'Recipe', name: 'R', recipeYield: 4 }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.servings).toBe('4');
    });

    it.each([
      ['PT1H30M', '1 hr 30 min'],
      ['PT45M', '45 min'],
      ['PT2H', '2 hr'],
      ['P0DT0H0M', 'P0DT0H0M'],
    ])('converts ISO duration %s to %s', async (iso, expected) => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({ '@type': 'Recipe', name: 'R', prepTime: iso }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.prepTime).toBe(expected);
    });

    it('returns a non-ISO duration string as-is', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            cookTime: '30 minutes',
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.cookTime).toBe('30 minutes');
    });

    it('parses ingredient lines with quantity and unit', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeIngredient: [
              '2 cups flour',
              '1/2 tsp salt',
              '1 1/2 tablespoons sugar',
              '3 eggs',
              'Salt to taste',
            ],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.ingredients).toEqual([
        { name: 'flour', quantity: '2', unit: 'cups', position: 0 },
        { name: 'salt', quantity: '1/2', unit: 'tsp', position: 1 },
        { name: 'sugar', quantity: '1 1/2', unit: 'tablespoons', position: 2 },
        { name: 'eggs', quantity: '3', position: 3 },
        { name: 'Salt to taste', position: 4 },
      ]);
    });

    it('parses unicode vulgar fractions in ingredient quantities', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeIngredient: [
              '½ cup sugar',
              '1½ cups flour',
              '1 ½ tablespoons butter',
              '¼ tsp salt',
            ],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.ingredients).toEqual([
        { name: 'sugar', quantity: '1/2', unit: 'cup', position: 0 },
        { name: 'flour', quantity: '1 1/2', unit: 'cups', position: 1 },
        { name: 'butter', quantity: '1 1/2', unit: 'tablespoons', position: 2 },
        { name: 'salt', quantity: '1/4', unit: 'tsp', position: 3 },
      ]);
    });

    it('filters out blank ingredient lines', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeIngredient: ['1 cup rice', '   ', ''],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.ingredients).toHaveLength(1);
    });

    it('parses plain string instructions', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeInstructions: ['Step one.', 'Step two.'],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.instructions).toEqual([
        { stepNumber: 1, text: 'Step one.' },
        { stepNumber: 2, text: 'Step two.' },
      ]);
    });

    it('parses HowToStep objects with text', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeInstructions: [
              { '@type': 'HowToStep', text: 'Mix.' },
              { '@type': 'HowToStep', text: 'Bake.' },
            ],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.instructions).toEqual([
        { stepNumber: 1, text: 'Mix.' },
        { stepNumber: 2, text: 'Bake.' },
      ]);
    });

    it('flattens HowToSection itemListElement groups', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeInstructions: [
              {
                '@type': 'HowToSection',
                name: 'Prep',
                itemListElement: [
                  { '@type': 'HowToStep', text: 'Chop vegetables.' },
                  { '@type': 'HowToStep', text: 'Preheat oven.' },
                ],
              },
              { '@type': 'HowToStep', text: 'Serve.' },
            ],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.instructions).toEqual([
        { stepNumber: 1, text: 'Chop vegetables.' },
        { stepNumber: 2, text: 'Preheat oven.' },
        { stepNumber: 3, text: 'Serve.' },
      ]);
    });

    it('falls back to name when a step has no text', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeInstructions: [
              { '@type': 'HowToStep', name: 'Rest the dough.' },
            ],
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.instructions).toEqual([
        { stepNumber: 1, text: 'Rest the dough.' },
      ]);
    });

    it('handles a single instruction string (not wrapped in an array)', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({
            '@type': 'Recipe',
            name: 'R',
            recipeInstructions: 'Just do it.',
          }),
      });
      const result = await service.extractFromUrl('https://example.com');
      expect(result.instructions).toEqual([
        { stepNumber: 1, text: 'Just do it.' },
      ]);
    });

    it('sets sourceUrl to the requested url and trims the title', async () => {
      mockFetch({
        ok: true,
        status: 200,
        text: async () =>
          htmlWithJsonLd({ '@type': 'Recipe', name: '  Trimmed Title  ' }),
      });
      const result = await service.extractFromUrl('https://example.com/page');
      expect(result.title).toBe('Trimmed Title');
      expect(result.sourceUrl).toBe('https://example.com/page');
    });
  });
});
