import { cleanTitle, parseRecipeDescription } from './description-parser';

describe('parseRecipeDescription', () => {
  it('reads a description with no section headers (numbered emoji steps)', () => {
    const parsed = parseRecipeDescription(
      [
        '🥞FLUFFY HOMEMADE PANCAKES🥞',
        '',
        'Difficulty: ✅EASY | 🕕 20 minute total prep + cook time',
        '',
        '2 cups of Flour',
        '1 tsp Salt',
        '2 Eggs',
        'Maple Syrup, for serving',
        '',
        '1️⃣ In a medium bowl, add flour and salt - stir to combine',
        '',
        '2️⃣ In a separate bowl, mix eggs and buttermilk',
        '',
        '#pancakes #breakfast',
      ].join('\n'),
    );

    expect(parsed.title).toBe('FLUFFY HOMEMADE PANCAKES');
    expect(parsed.ingredients).toEqual([
      { name: 'Flour', quantity: '2', unit: 'cups', position: 0 },
      { name: 'Salt', quantity: '1', unit: 'tsp', position: 1 },
      { name: 'Eggs', quantity: '2', position: 2 },
      { name: 'Maple Syrup, for serving', position: 3 },
    ]);
    expect(parsed.instructions).toEqual([
      {
        stepNumber: 1,
        text: 'In a medium bowl, add flour and salt - stir to combine',
      },
      { stepNumber: 2, text: 'In a separate bowl, mix eggs and buttermilk' },
    ]);
  });

  it('reads explicit Ingredients / Instructions sections', () => {
    const parsed = parseRecipeDescription(
      [
        'Garlic butter pasta 🍝 ready in no time!',
        'Serves 4 | Prep: 10 mins | Cook time: 15 minutes',
        'INGREDIENTS:',
        '- 200g spaghetti',
        '• 3 cloves garlic, minced',
        'For the sauce:',
        '- Salt and pepper',
        'Instructions:',
        '1. Boil the pasta.',
        '2) Fry the garlic in butter',
        'until golden.',
        'Notes:',
        'Use salted butter for extra flavor.',
      ].join('\n'),
    );

    expect(parsed.title).toBe('Garlic butter pasta ready in no time!');
    expect(parsed.servings).toBe('4');
    expect(parsed.prepTime).toBe('10 mins');
    expect(parsed.cookTime).toBe('15 minutes');
    expect(parsed.ingredients.map((i) => i.name)).toEqual([
      'spaghetti',
      'garlic, minced',
      'Salt and pepper',
    ]);
    expect(parsed.ingredients[1]).toMatchObject({
      quantity: '3',
      unit: 'cloves',
    });
    expect(parsed.instructions.map((s) => s.text)).toEqual([
      'Boil the pasta.',
      'Fry the garlic in butter until golden.',
    ]);
  });

  it('accepts inline content after a header', () => {
    const parsed = parseRecipeDescription(
      'Ingredients: 1 cup rice\n2 cups water\nMethod: Simmer for 18 minutes.',
    );
    expect(parsed.ingredients.map((i) => i.name)).toEqual(['rice', 'water']);
    expect(parsed.instructions.map((s) => s.text)).toEqual([
      'Simmer for 18 minutes.',
    ]);
  });

  it('collects links and ignores outro lines', () => {
    const parsed = parseRecipeDescription(
      [
        'Best brownies ever',
        'Full recipe on my blog: https://example.com/recipes/brownies.',
        'Follow me for more! https://instagram.com/me',
      ].join('\n'),
    );
    expect(parsed.links).toEqual([
      'https://example.com/recipes/brownies',
      'https://instagram.com/me',
    ]);
    expect(parsed.ingredients).toHaveLength(0);
    expect(parsed.instructions).toHaveLength(0);
  });

  it('does not treat decimal quantities or plain counts as step numbers', () => {
    const parsed = parseRecipeDescription(
      'Ingredients\n1.5 cups milk\n1 egg\nSteps\nWhisk everything together.',
    );
    expect(parsed.ingredients).toEqual([
      { name: 'milk', quantity: '1.5', unit: 'cups', position: 0 },
      { name: 'egg', quantity: '1', position: 1 },
    ]);
    expect(parsed.instructions).toHaveLength(1);
  });
});

describe('cleanTitle', () => {
  it('strips emoji and hashtags from platform titles', () => {
    expect(cleanTitle('FLUFFY PANCAKES🥞#pancake #recipe #food')).toBe(
      'FLUFFY PANCAKES',
    );
    expect(cleanTitle(undefined)).toBeUndefined();
  });
});
