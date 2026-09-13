import { normalizeUnit, parseIngredientLine } from './ingredient-parser';

describe('parseIngredientLine', () => {
  it.each([
    // Delish-style abbreviations with trailing periods.
    [
      '4 tbsp. unsalted butter, divided',
      '4',
      'tbsp',
      'unsalted butter, divided',
    ],
    ['1 tbsp. all-purpose flour', '1', 'tbsp', 'all-purpose flour'],
    ['1 c. whole milk', '1', 'cup', 'whole milk'],
    [
      '3 oz. Gruyère, shredded, divided',
      '3',
      'oz',
      'Gruyère, shredded, divided',
    ],
    ['2 tsp. Dijon mustard', '2', 'tsp', 'Dijon mustard'],
    ['1 lb. ground beef', '1', 'lb', 'ground beef'],
    ['8 fl. oz. heavy cream', '8', 'fl oz', 'heavy cream'],
    ['1 pt. strawberries', '1', 'pint', 'strawberries'],
    ['1 pkg. cream cheese', '1', 'package', 'cream cheese'],
    // Case-sensitive single letters.
    ['2 T olive oil', '2', 'tbsp', 'olive oil'],
    ['1 t salt', '1', 'tsp', 'salt'],
    // Full words keep their spelling, as before.
    ['1 1/2 tablespoons sugar', '1 1/2', 'tablespoons', 'sugar'],
    ['2 cups of flour', '2', 'cups', 'flour'],
    ['1 c., packed brown sugar', '1', 'cup', 'packed brown sugar'],
  ])('%s', (line, quantity, unit, name) => {
    expect(parseIngredientLine(line, 0)).toEqual({
      name,
      quantity,
      unit,
      position: 0,
    });
  });

  it('moves a note before the unit to the end of the name', () => {
    expect(parseIngredientLine('4 (1/2”-thick) slices sourdough', 0)).toEqual({
      name: 'sourdough (1/2”-thick)',
      quantity: '4',
      unit: 'slices',
      position: 0,
    });
    expect(parseIngredientLine('1 (14.5-oz.) can diced tomatoes', 2)).toEqual({
      name: 'diced tomatoes (14.5-oz.)',
      quantity: '1',
      unit: 'can',
      position: 2,
    });
  });

  it('leaves words that only look like units in the name', () => {
    expect(parseIngredientLine('2 large eggs', 0)).toEqual({
      name: 'large eggs',
      quantity: '2',
      position: 0,
    });
    expect(parseIngredientLine('3 garlic cloves', 0)).toEqual({
      name: 'garlic cloves',
      quantity: '3',
      position: 0,
    });
    expect(parseIngredientLine('1 (8-inch) pie crust', 0)).toEqual({
      name: '(8-inch) pie crust',
      quantity: '1',
      position: 0,
    });
  });

  it('keeps lines without a quantity whole', () => {
    expect(parseIngredientLine('Freshly ground black pepper', 4)).toEqual({
      name: 'Freshly ground black pepper',
      position: 4,
    });
  });
});

describe('normalizeUnit', () => {
  it.each([
    ['Tbsp.', 'tbsp'],
    ['c.', 'cup'],
    ['OZ.', 'oz'],
    ['fl. oz.', 'fl oz'],
    ['cups', 'cups'],
    ['T', 'tbsp'],
    ['t', 'tsp'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected);
  });

  it('returns undefined for non-units', () => {
    expect(normalizeUnit('large')).toBeUndefined();
    expect(normalizeUnit('')).toBeUndefined();
  });
});
