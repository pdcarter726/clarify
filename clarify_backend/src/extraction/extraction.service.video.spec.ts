import { NotFoundException } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { PageFetcherService } from './page-fetcher.service';

function youtubePage(description: string, title = 'Video title') {
  const player = { videoDetails: { title, shortDescription: description } };
  return `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`;
}

const LINKED_RECIPE_HTML = `<script type="application/ld+json">${JSON.stringify(
  {
    '@type': 'Recipe',
    name: 'Blog Brownies',
    recipeIngredient: ['1 cup sugar', '2 eggs'],
    recipeInstructions: ['Bake.'],
  },
)}</script>`;

describe('ExtractionService (video posts)', () => {
  function serviceWithPages(pages: Record<string, string>) {
    const fetchPage = jest.fn((url: string) => {
      const html = pages[url];
      return html === undefined
        ? Promise.reject(new Error(`unexpected fetch ${url}`))
        : Promise.resolve({ html, finalUrl: url });
    });
    const service = new ExtractionService({
      fetchPage,
    } as unknown as PageFetcherService);
    return { service, fetchPage };
  }

  it('builds a recipe from a YouTube description', async () => {
    const { service, fetchPage } = serviceWithPages({
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ': youtubePage(
        'Ingredients:\n2 cups flour\n1 egg\nInstructions:\n1. Mix.\n2. Cook.',
        'FLUFFY PANCAKES🥞 #recipe',
      ),
    });

    const recipe = await service.extractFromUrl('https://youtu.be/z2G6p-CDOeQ');

    expect(recipe).toMatchObject({
      title: 'FLUFFY PANCAKES',
      sourceUrl: 'https://youtu.be/z2G6p-CDOeQ',
    });
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.instructions).toHaveLength(2);
    expect(fetchPage).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ',
      { headers: expect.any(Object) as unknown },
    );
  });

  it('follows a recipe link when the description has no recipe, keeping the video as the source', async () => {
    const { service } = serviceWithPages({
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ': youtubePage(
        'Fudgy brownies!\nMy socials: https://instagram.com/me\nRecipe: https://blog.example.com/recipes/brownies',
      ),
      'https://blog.example.com/recipes/brownies': LINKED_RECIPE_HTML,
    });

    const recipe = await service.extractFromUrl(
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ',
    );

    expect(recipe.title).toBe('Blog Brownies');
    expect(recipe.sourceUrl).toBe(
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ',
    );
    expect(recipe.ingredients).toHaveLength(2);
  });

  it('throws NotFound when there is no recipe and no usable link', async () => {
    const { service } = serviceWithPages({
      'https://www.youtube.com/watch?v=z2G6p-CDOeQ': youtubePage(
        'Just a vlog today. https://blog.example.com/about',
      ),
    });

    await expect(
      service.extractFromUrl('https://www.youtube.com/watch?v=z2G6p-CDOeQ'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFound when the post page has no readable description', async () => {
    const { service } = serviceWithPages({
      'https://www.instagram.com/reel/abc/': '<html></html>',
    });

    await expect(
      service.extractFromUrl('https://www.instagram.com/reel/abc/'),
    ).rejects.toThrow("Couldn't read the description of that Instagram post");
  });
});
