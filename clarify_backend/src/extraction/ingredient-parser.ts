import { ExtractedIngredient } from './extraction.types';

const UNITS = [
  'cups',
  'cup',
  'tablespoons',
  'tablespoon',
  'tbsp',
  'teaspoons',
  'teaspoon',
  'tsp',
  'ounces',
  'ounce',
  'oz',
  'pounds',
  'pound',
  'lbs',
  'lb',
  'grams',
  'gram',
  'g',
  'kilograms',
  'kilogram',
  'kg',
  'milliliters',
  'milliliter',
  'ml',
  'liters',
  'liter',
  'l',
  'pinches',
  'pinch',
  'dashes',
  'dash',
  'cloves',
  'clove',
  'cans',
  'can',
  'packages',
  'package',
  'slices',
  'slice',
  'sticks',
  'stick',
];

const QUANTITY_RE =
  /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*/;

// Unicode vulgar fractions (as commonly used on recipe sites, e.g. "1½ cups")
// aren't digits, so QUANTITY_RE can't see them. Normalize to ASCII "n/d" first.
const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

function normalizeUnicodeFractions(text: string): string {
  // A fraction glyph is often glued to a whole number ("1½"), so a preceding
  // digit needs a space inserted or "1" + "1/2" would merge into "11/2".
  return text.replace(
    /(\d)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g,
    (_, digit: string | undefined, ch: string) =>
      digit ? `${digit} ${UNICODE_FRACTIONS[ch]}` : UNICODE_FRACTIONS[ch],
  );
}

/** True when the line opens with a numeric quantity, e.g. "2 cups flour" or "½ tsp salt". */
export function startsWithQuantity(line: string): boolean {
  return QUANTITY_RE.test(normalizeUnicodeFractions(line));
}

/** Best-effort split of a free-text ingredient line into quantity, unit, and name. */
export function parseIngredientLine(
  line: string,
  position: number,
): ExtractedIngredient {
  const normalizedLine = normalizeUnicodeFractions(line);
  const quantityMatch = QUANTITY_RE.exec(normalizedLine);
  if (!quantityMatch) {
    return { name: line, position };
  }

  const quantity = quantityMatch[1];
  const remainder = normalizedLine.slice(quantityMatch[0].length).trim();
  const unitMatch = UNITS.find(
    (unit) =>
      remainder.toLowerCase() === unit ||
      remainder.toLowerCase().startsWith(`${unit} `),
  );

  if (!unitMatch) {
    return { name: remainder || line, quantity, position };
  }

  // "2 cups of flour" -> name "flour", not "of flour".
  const name = remainder
    .slice(unitMatch.length)
    .trim()
    .replace(/^of\s+/i, '');
  return { name: name || remainder, quantity, unit: unitMatch, position };
}
