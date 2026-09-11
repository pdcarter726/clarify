// Unicode vulgar fractions normalized to "n/d" so they can be parsed and scaled.
const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

// Matches, in priority order, a mixed number ("1 1/2"), a bare fraction ("1/2"),
// or a plain (possibly decimal) number — used to find quantity tokens embedded
// in free-text ingredient strings like "2 cups" or "1 1/2 tsp".
const QUANTITY_TOKEN = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/g;

/** Converts a single matched token ("1 1/2", "1/2", or "2.5") to its numeric value. */
function parseQuantityToken(token: string): number {
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(token);
}

/**
 * Formats a scaled numeric quantity back to a display string. If the
 * fractional part is within 0.03 of a "nice" cooking fraction (1/8, 1/4, 1/3,
 * 3/8, 1/2, 5/8, 2/3, 3/4, 7/8) it's snapped to that fraction (e.g. 2.49 -> "2 1/2");
 * otherwise it falls back to a plain number rounded to 2 decimal places.
 */
function formatScaledQuantity(value: number): string {
  if (!isFinite(value)) return "";
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  const nice = NICE_FRACTIONS.find(([f]) => Math.abs(frac - f) < 0.03);
  if (nice) return whole > 0 ? `${whole} ${nice[1]}` : nice[1];
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/**
 * Scales a raw ingredient quantity string (e.g. "1½ cups", "2", "3/4") by
 * `factor` and returns the re-formatted result. Normalizes unicode fraction
 * glyphs to "n/d" first (inserting a space so a glued digit+glyph like "1½"
 * doesn't get parsed as "11/2"), then rewrites every numeric/fraction token
 * found via `QUANTITY_TOKEN` with its scaled value, leaving surrounding text
 * (units, notes) untouched. Returns `raw` unchanged if empty or factor is 1.
 */
export function scaleQuantity(raw: string | undefined, factor: number): string {
  if (!raw || factor === 1) return raw ?? "";
  // Fraction glyphs are often glued to a whole number ("1½"), so a preceding
  // digit needs a space inserted or "1" + "1/2" would merge into "11/2".
  const normalized = raw.replace(
    /(\d)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g,
    (_, digit: string | undefined, ch: string) =>
      digit ? `${digit} ${UNICODE_FRACTIONS[ch]}` : UNICODE_FRACTIONS[ch],
  );
  return normalized.replace(QUANTITY_TOKEN, (token) =>
    formatScaledQuantity(parseQuantityToken(token) * factor),
  );
}

/** Pulls the first number out of a free-text servings field (e.g. "Serves 4-6" -> 4). */
export function parseServingsCount(servings?: string | null): number | null {
  if (!servings) return null;
  const match = servings.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return value > 0 ? value : null;
}

/**
 * Normalizes a free-text servings field to "N servings" for consistent
 * display, since scraped recipes store this in whatever form the source site
 * used (bare "16", "4 servings", "Serves 4", etc). Falls back to the raw
 * text, trimmed, if no number could be parsed out of it.
 */
export function formatServings(servings?: string | null): string | null {
  if (!servings) return null;
  const count = parseServingsCount(servings);
  if (count == null) return servings.trim() || null;
  return `${count} serving${count === 1 ? "" : "s"}`;
}

/** Extracts a display-friendly hostname (no "www.") from a recipe source URL; returns the raw string if it's not a valid URL. */
export function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
