import { ExtractedIngredient } from './extraction.types';

const UNITS = new Set([
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
  'fl oz',
  'fluid ounces',
  'fluid ounce',
  'pints',
  'pint',
  'quarts',
  'quart',
  'pounds',
  'pound',
  'lbs',
  'lb',
  'grams',
  'gram',
  'g',
  'milligrams',
  'milligram',
  'mg',
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
]);

// Abbreviations recipe sites use (usually with a trailing period, e.g.
// Delish's "4 tbsp. butter" or "1 c. milk"), mapped to unit names the
// nutrition calculator understands.
const UNIT_ALIASES: Record<string, string> = {
  c: 'cup',
  tbs: 'tbsp',
  tbl: 'tbsp',
  tbsps: 'tbsp',
  tsps: 'tsp',
  floz: 'fl oz',
  pt: 'pint',
  pts: 'pints',
  qt: 'quart',
  qts: 'quarts',
  pkg: 'package',
  pkgs: 'packages',
  gr: 'g',
  gms: 'g',
  kgs: 'kg',
  mls: 'ml',
};

// A unit word at the start of the text, optionally with a trailing period,
// ending at whitespace, a comma, or the end: "tbsp. butter", "fl. oz. milk".
const UNIT_TOKEN_RE = /^(fl\.?\s*oz|fluid\s+ounces?|[a-z]+)\.?(?=[\s,]|$)/i;

// A note between the quantity and the unit: "4 (1/2”-thick) slices bread".
const LEADING_NOTE_RE = /^\(([^)]*)\)\s*/;

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

/**
 * Maps a unit as written ("Tbsp.", "c.", "fl. oz.") to its canonical name
 * ("tbsp", "cup", "fl oz"), or undefined if it isn't a recognized unit.
 * Single-letter "T"/"t" are case-sensitive (tablespoon vs teaspoon).
 */
export function normalizeUnit(raw: string): string | undefined {
  const trimmed = raw.trim().replace(/\.$/, '');
  if (trimmed === 'T') return 'tbsp';
  if (trimmed === 't') return 'tsp';
  const key = trimmed.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  if (UNITS.has(key)) return key;
  return UNIT_ALIASES[key.replace(/\s/g, '')];
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
  const note = LEADING_NOTE_RE.exec(remainder);
  const afterNote = note ? remainder.slice(note[0].length) : remainder;

  const unitToken = UNIT_TOKEN_RE.exec(afterNote);
  const unit = unitToken ? normalizeUnit(unitToken[1]) : undefined;
  if (!unitToken || !unit) {
    return { name: remainder || line, quantity, position };
  }

  // "2 cups of flour" -> "flour"; "1 c., packed brown sugar" -> "packed brown sugar".
  let name = afterNote
    .slice(unitToken[0].length)
    .replace(/^[\s,]+/, '')
    .replace(/^of\s+/i, '')
    .trim();
  if (note && name) name = `${name} (${note[1]})`;
  return { name: name || remainder, quantity, unit, position };
}
