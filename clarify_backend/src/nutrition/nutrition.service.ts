import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NutritionIngredientInput, NutritionTotals } from './nutrition.types';

const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// How long a resolved food lookup stays cached (see `findBestFoodDetail`).
const FOOD_DETAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Standardized USDA nutrient numbers (stable across FDC data types), used to
// pull nutrients out of a food's `foodNutrients` list by number rather than
// by name, since display names vary slightly between data types. Covers the
// sections of a standard US Nutrition Facts label.
//
// Energy is a special case: legacy SR Legacy data reports it under "208",
// but newer Foundation Foods entries omit "208" entirely and report it only
// as "957"/"958" (Atwater General/Specific Factors) — without this fallback,
// a recipe whose ingredients match Foundation entries comes back with 0
// calories despite having real macro data. "957" (General Factors) is the
// closer analog to how "208" was historically calculated.
const NUTRIENT_NUMBERS = {
  calories: ['208', '957', '958'],
  protein: '203',
  fat: '204',
  saturatedFat: '606',
  transFat: '605',
  cholesterol: '601',
  sodium: '307',
  carbs: '205',
  fiber: '291',
  sugar: '269',
  vitaminD: '328',
  calcium: '301',
  iron: '303',
  potassium: '306',
} as const;

const ZERO_TOTALS: NutritionTotals = {
  calories: 0,
  proteinGrams: 0,
  fatGrams: 0,
  saturatedFatGrams: 0,
  transFatGrams: 0,
  cholesterolMg: 0,
  sodiumMg: 0,
  carbGrams: 0,
  fiberGrams: 0,
  sugarGrams: 0,
  vitaminDMcg: 0,
  calciumMg: 0,
  ironMg: 0,
  potassiumMg: 0,
};

// Maps each NutritionTotals field to the USDA nutrient number(s) it's read
// from (checked in order, first match wins), so per-ingredient lookup and
// summing can iterate instead of repeating each field by hand.
const NUTRIENT_FIELD_MAP: [keyof NutritionTotals, readonly string[]][] = [
  ['calories', NUTRIENT_NUMBERS.calories],
  ['proteinGrams', [NUTRIENT_NUMBERS.protein]],
  ['fatGrams', [NUTRIENT_NUMBERS.fat]],
  ['saturatedFatGrams', [NUTRIENT_NUMBERS.saturatedFat]],
  ['transFatGrams', [NUTRIENT_NUMBERS.transFat]],
  ['cholesterolMg', [NUTRIENT_NUMBERS.cholesterol]],
  ['sodiumMg', [NUTRIENT_NUMBERS.sodium]],
  ['carbGrams', [NUTRIENT_NUMBERS.carbs]],
  ['fiberGrams', [NUTRIENT_NUMBERS.fiber]],
  ['sugarGrams', [NUTRIENT_NUMBERS.sugar]],
  ['vitaminDMcg', [NUTRIENT_NUMBERS.vitaminD]],
  ['calciumMg', [NUTRIENT_NUMBERS.calcium]],
  ['ironMg', [NUTRIENT_NUMBERS.iron]],
  ['potassiumMg', [NUTRIENT_NUMBERS.potassium]],
];

// Fixed grams-per-unit for units that are already a mass, so no per-food
// portion lookup is needed.
const MASS_UNITS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

// Grams-per-unit for small spoon/piece units with no meaningful USDA
// "foodPortion" entry, so they'd otherwise fall through to the flat 100g
// guess (a garlic clove is ~3g, not 100g).
const SMALL_UNIT_GRAMS: Record<string, number> = {
  clove: 3,
  cloves: 3,
  pinch: 0.36,
  pinches: 0.36,
  dash: 0.6,
  dashes: 0.6,
  // USDA cheese slices run 16-28g, and often under an "undetermined" unit.
  slice: 21,
  slices: 21,
};

// Typical grams-per-cup for common dry/dense ingredients whose density is far
// from water, matched against the ingredient name (first match wins). Used
// only as a fallback for volume units when the matched USDA food has no
// portion for that unit — the generic water-density fallback below assumes
// 1 mL ~= 1 g, which overestimates a cup of flour or cocoa powder by ~2x and
// powdered sugar by close to 2x, the single biggest source of inflated
// recipe calorie totals seen in practice. Values are USDA/King Arthur Baking
// standard weights; converted proportionally for tbsp/tsp.
const DRY_GOODS_GRAMS_PER_CUP: [RegExp, number][] = [
  [/cocoa|cacao/i, 84],
  [/powdered sugar|confectioners.? sugar|icing sugar/i, 120],
  [/brown sugar/i, 220],
  [/granulated sugar|white sugar|\bsugar\b/i, 200],
  [/cake flour/i, 114],
  [/bread flour/i, 127],
  [/almond flour|almond meal/i, 96],
  [/\bflour\b/i, 125],
  [/rolled oats|old.fashioned oats|quick oats|\boats\b/i, 90],
  [
    /shredded (cheddar|mozzarella|cheese)|grated parmesan|parmesan cheese/i,
    100,
  ],
  [/chopped (walnuts|pecans|almonds|nuts)|\bwalnuts\b|\bpecans\b/i, 120],
  [/chocolate chips|chopped chocolate|\bchocolate\b/i, 170],
  [/\brice\b/i, 185],
  [/bread ?crumbs/i, 108],
  [/cornstarch|corn starch/i, 128],
  [/\bbutter\b/i, 227],
  [/powdered milk|dry milk/i, 68],
  [/desiccated coconut|shredded coconut|coconut flakes/i, 93],
];

// Typical gram weight of one whole/counted unit for common recipe staples,
// matched against the ingredient name. Used both when no unit is given
// (e.g. "3 eggs") and when the unit itself names a whole piece USDA has no
// portion data for (e.g. "1 stick cinnamon", "3 whole clove") — both cases
// would otherwise fall back to a flat 100g guess, wildly overshooting for
// something like a cardamom pod (~0.2g) or a single garlic clove (~3g).
// Garlic/spice "clove" patterns are listed before the bare "clove" pattern
// (whole clove, the spice) since `.find` takes the first match.
const WHOLE_ITEM_GRAMS: [RegExp, number][] = [
  // First, so "potato buns" isn't weighed as whole potatoes.
  [/\bbuns?\b/i, 50],
  [/egg\s*yolk/i, 18],
  [/egg\s*white/i, 33],
  [/\begg\b/i, 50],
  [/garlic clove|clove.*garlic/i, 3],
  [/cardamom pod/i, 0.2],
  [/cinnamon stick|stick.*cinnamon/i, 2.6],
  [/bay leaf|bay leaves/i, 0.1],
  [/\bclove\b/i, 0.1],
  [/\bonion\b/i, 110],
  [/\bshallot\b/i, 25],
  [/\bbanana\b/i, 118],
  [/\blemon\b/i, 58],
  [/\blime\b/i, 67],
  [/\bpotato\b/i, 173],
  [/\bcarrot\b/i, 61],
  [/\btomato\b/i, 123],
  [/\bapple\b/i, 182],
  [/\bavocado\b/i, 150],
  [/bell pepper/i, 119],
];

// Grams for a manufactured package/container, matched against a unit word
// (e.g. "2 cans whole peeled tomatoes") or, when no unit is given, the
// ingredient name itself (e.g. "container whole milk ricotta"). Checked
// before WHOLE_ITEM_GRAMS so "cans of tomatoes" doesn't get priced as a
// single fresh tomato (~123g) instead of a ~400g+ can. Sizes are the most
// common real package size for that container type; genuinely a rough
// estimate, since actual sizes vary — but far closer than a flat 100g.
const CONTAINER_GRAMS: [RegExp, number][] = [
  [/\bcontainers?\b|\btubs?\b/i, 425],
  [/\bcans?\b/i, 411],
  [/\bjars?\b/i, 340],
  [/\btubes?\b/i, 170],
  [/\bpackages?\b|\bpkg\b/i, 340],
  [/\bbags?\b/i, 400],
  [/\bpackets?\b/i, 28],
];

// Standard per-100g reference values for fresh whole/yolk/white egg (USDA
// SR Legacy figures) — see KNOWN_INGREDIENT_OVERRIDES below for why these
// are hardcoded rather than looked up.
const EGG_YOLK_NUTRIENTS = [
  { number: '208', amount: 322 },
  { number: '203', amount: 15.86 },
  { number: '204', amount: 26.54 },
  { number: '606', amount: 9.55 },
  { number: '601', amount: 1085 },
  { number: '307', amount: 48 },
  { number: '205', amount: 3.59 },
  { number: '269', amount: 0.56 },
  { number: '301', amount: 129 },
  { number: '303', amount: 2.73 },
  { number: '306', amount: 109 },
  { number: '328', amount: 5.4 },
];
const EGG_WHITE_NUTRIENTS = [
  { number: '208', amount: 52 },
  { number: '203', amount: 10.9 },
  { number: '204', amount: 0.17 },
  { number: '601', amount: 0 },
  { number: '307', amount: 166 },
  { number: '205', amount: 0.73 },
  { number: '269', amount: 0.71 },
  { number: '301', amount: 7 },
  { number: '303', amount: 0.08 },
  { number: '306', amount: 163 },
];
const EGG_WHOLE_NUTRIENTS = [
  { number: '208', amount: 143 },
  { number: '203', amount: 12.56 },
  { number: '204', amount: 9.51 },
  { number: '606', amount: 3.13 },
  { number: '601', amount: 372 },
  { number: '307', amount: 142 },
  { number: '205', amount: 0.72 },
  { number: '269', amount: 0.37 },
  { number: '301', amount: 56 },
  { number: '303', amount: 1.75 },
  { number: '306', amount: 138 },
  { number: '328', amount: 2.0 },
];

// USDA SR Legacy per-100g values: "Mustard, prepared, yellow" (172234),
// "Rolls, hamburger or hotdog, plain" (172796), "Salad dressing, mayonnaise,
// regular" (171009).
const MUSTARD_NUTRIENTS = [
  { number: '208', amount: 60 },
  { number: '203', amount: 3.74 },
  { number: '204', amount: 3.34 },
  { number: '606', amount: 0.214 },
  { number: '605', amount: 0.009 },
  { number: '601', amount: 0 },
  { number: '307', amount: 1100 },
  { number: '205', amount: 5.83 },
  { number: '291', amount: 4 },
  { number: '269', amount: 0.92 },
  { number: '328', amount: 0 },
  { number: '301', amount: 63 },
  { number: '303', amount: 1.61 },
  { number: '306', amount: 152 },
];
const BUN_NUTRIENTS = [
  { number: '208', amount: 279 },
  { number: '203', amount: 9.77 },
  { number: '204', amount: 3.91 },
  { number: '606', amount: 0.842 },
  { number: '605', amount: 0.027 },
  { number: '601', amount: 0 },
  { number: '307', amount: 494 },
  { number: '205', amount: 50.1 },
  { number: '291', amount: 1.8 },
  { number: '269', amount: 7.28 },
  { number: '328', amount: 0 },
  { number: '301', amount: 144 },
  { number: '303', amount: 3.43 },
  { number: '306', amount: 122 },
];
const MAYONNAISE_NUTRIENTS = [
  { number: '208', amount: 680 },
  { number: '203', amount: 0.96 },
  { number: '204', amount: 74.8 },
  { number: '606', amount: 11.7 },
  { number: '605', amount: 0.187 },
  { number: '601', amount: 42 },
  { number: '307', amount: 635 },
  { number: '205', amount: 0.57 },
  { number: '291', amount: 0 },
  { number: '269', amount: 0.57 },
  { number: '328', amount: 0.2 },
  { number: '301', amount: 8 },
  { number: '303', amount: 0.21 },
  { number: '306', amount: 20 },
];

// A handful of extremely common ingredients where USDA's own data
// consistently fails for this recipe app's purposes, but whose real
// nutrition is simple/well-established enough to hardcode directly,
// skipping the search entirely:
// - Mustard: "mustard"/"Dijon mustard" top-match "Oil, mustard" (884 kcal/100g).
// - Buns: "potato buns" top-matches "Cinnamon buns, frosted".
// - Mayonnaise: search ranks the low-calorie variant above regular.
// - Salt: "kosher salt"/"sea salt" searches rank kosher dill pickles above
//   actual salt. Value is USDA's own "Salt, table" sodium figure.
// - Egg (whole/yolk/white): the specific fdcIds for all three of USDA's own
//   "Eggs, Grade A, Large, ..." entries consistently 404 on the food-detail
//   endpoint even though they still appear in search results, cascading to
//   a dried/powdered egg match instead (~4x the calories of fresh egg).
//   Order matters — yolk/white are checked before the bare "egg" pattern.
const KNOWN_INGREDIENT_OVERRIDES: [
  RegExp,
  { number: string; amount: number }[],
][] = [
  [
    /^(kosher|sea|table|fine|coarse|iodized)?\s*salt$/i,
    [{ number: '307', amount: 38758 }],
  ],
  [/egg\s*yolk/i, EGG_YOLK_NUTRIENTS],
  [/egg\s*white/i, EGG_WHITE_NUTRIENTS],
  [/\begg\b/i, EGG_WHOLE_NUTRIENTS],
  [
    /^(?!.*\b(seeds?|greens?|oil|powder|dry|ground)\b).*\bmustard\b/i,
    MUSTARD_NUTRIENTS,
  ],
  [
    /^(?!.*\b(cinnamon|honey|sticky|cross|bao|steamed)\b).*\bbuns?\b/i,
    BUN_NUTRIENTS,
  ],
  [
    /^(?!.*\b(light|low|reduced|fat.free)\b).*\bmayo(nnaise)?\b/i,
    MAYONNAISE_NUTRIENTS,
  ],
];

// Fallback grams-per-unit for volume units, used only when the matched food
// has no USDA "foodPortion" for that unit and no `DRY_GOODS_GRAMS_PER_CUP`
// match. Approximated at water density (1 mL ~= 1 g) — reasonable for
// liquids (milk, oil, stock), which is most of what falls through to here.
const VOLUME_UNITS_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  cup: 236.588,
  cups: 236.588,
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
};

// The search endpoint's per-food nutrient entries use a different shape
// (flat `nutrientNumber`/`value`) than the detail endpoint's
// (`nutrient.number`/`amount`), but carry essentially the same data —
// `normalizeSearchNutrients` below converts one into the other so both can
// share `nutrientPer100g`/`deriveCaloriesFromMacros`.
interface FdcSearchNutrient {
  nutrientNumber?: string;
  value?: number;
}

interface FdcSearchFood {
  fdcId: number;
  description: string;
  foodNutrients?: FdcSearchNutrient[];
}

interface FdcSearchResponse {
  foods?: FdcSearchFood[];
}

interface FdcPortion {
  gramWeight: number;
  modifier?: string;
  measureUnit?: { name?: string };
}

interface FdcNutrientDetail {
  nutrient?: { number?: string };
  amount?: number;
}

interface FdcFoodDetail {
  foodNutrients?: FdcNutrientDetail[];
  foodPortions?: FdcPortion[];
}

/** Computes aggregate nutrition totals for a recipe's ingredients via the USDA FoodData Central API. */
@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);

  // Keyed by lowercased/trimmed ingredient name. `NutritionService` is a
  // singleton provider (default NestJS scope), so this persists across
  // requests for the life of the process — see `findBestFoodDetail`.
  private readonly foodDetailCache = new Map<
    string,
    { detail: FdcFoodDetail | null; expiresAt: number }
  >();

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private apiKey(): string {
    const key = process.env.USDA_FDC_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        'Nutrition lookup is not configured. Set USDA_FDC_API_KEY (free key from https://fdc.nal.usda.gov/api-key-signup).',
      );
    }
    return key;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new BadRequestException(
        `Failed to reach USDA FoodData Central: ${(error as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new BadRequestException(
        `USDA FoodData Central request failed with status ${response.status}`,
      );
    }
    return (await response.json()) as T;
  }

  /**
   * Strips parenthetical asides (e.g. "(about 1 ½ lbs)", "(, minced)") out of
   * a scraped ingredient name before it's used as a search query. USDA's API
   * gateway rejects any query containing a parenthesis with a bare 400, and
   * prep notes like these aren't useful for food matching anyway. Slashes and
   * asterisks (e.g. "80/20 or 85/15 lean ground beef*") are replaced too —
   * they trip the same gateway 400 most of the time.
   *
   * Also strips "chopped"/"minced"/"shredded": empirically, USDA's search
   * ranks a "[Meat], chopped/minced, canned" or unrelated "..., shredded"
   * entry above the intended food when paired with these words (e.g.
   * "chopped chocolate" top-matches "Ham, chopped, canned", "minced garlic"
   * matches "Ham, minced", "shredded chicken" matches "Cheese, parmesan,
   * shredded") — removing the word and searching on the base ingredient name
   * alone consistently matches correctly instead. Other prep words (diced,
   * sliced, crushed) are left in place since they're often load-bearing
   * (e.g. "diced tomatoes" is a real product distinct from whole tomatoes).
   */
  private sanitizeName(name: string): string {
    // Strip innermost balanced paren groups repeatedly, so nested
    // parentheses (e.g. "(sliced into 1/2 inch (1.25 cm) cubes)") are fully
    // removed instead of leaving a stray ")" that still trips USDA's
    // parenthesis rejection — a single non-recursive pass only strips up to
    // the first ")" it finds, mismatched with the outer "(".
    let withoutParens = name;
    let previous: string;
    do {
      previous = withoutParens;
      withoutParens = withoutParens.replace(/\([^()]*\)/g, ' ');
    } while (withoutParens !== previous);

    const stripped = withoutParens
      .replace(/[()]/g, ' ') // any leftover unbalanced paren
      .replace(/[/*]/g, ' ')
      .replace(/\b(chopped|minced|shredded)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped || name;
  }

  /** Grams for one cup of `name`, if it matches a known dense/dry ingredient; `null` otherwise. */
  private dryGoodsGramsPerCup(name: string): number | null {
    const match = DRY_GOODS_GRAMS_PER_CUP.find(([pattern]) =>
      pattern.test(name),
    );
    return match?.[1] ?? null;
  }

  /** Typical gram weight of one whole unit of `name` (e.g. one egg), if it matches a known staple; `null` otherwise. */
  private wholeItemGrams(name: string): number | null {
    const match = WHOLE_ITEM_GRAMS.find(([pattern]) => pattern.test(name));
    return match?.[1] ?? null;
  }

  /** Typical gram weight of a manufactured package (can, jar, container, ...) matching `text`; `null` otherwise. */
  private containerGrams(text: string): number | null {
    const match = CONTAINER_GRAMS.find(([pattern]) => pattern.test(text));
    return match?.[1] ?? null;
  }

  /**
   * A hardcoded nutrient list for `name`, if it matches a `KNOWN_INGREDIENT_OVERRIDES`
   * entry; `null` otherwise. Bypasses USDA search entirely for ingredients
   * whose real nutrition is simple/universal but whose search results
   * unreliably mismatch.
   */
  private knownIngredientOverride(name: string): FdcFoodDetail | null {
    const match = KNOWN_INGREDIENT_OVERRIDES.find(([pattern]) =>
      pattern.test(name.trim()),
    );
    if (!match) return null;
    const [, nutrients] = match;
    return {
      foodNutrients: nutrients.map(({ number, amount }) => ({
        nutrient: { number },
        amount,
      })),
      foodPortions: [],
    };
  }

  /**
   * Appends a disambiguating word for ingredients where USDA's search
   * reliably mismatches on the bare name: bare "chocolate" ranks
   * "Beverages, chocolate syrup" — a thin drink, not what "chopped
   * chocolate" in a cake recipe means — above any solid chocolate. (Egg has
   * the same class of problem — bare "egg" ranks egg white above whole egg
   * — but is handled by `KNOWN_INGREDIENT_OVERRIDES` instead, which
   * sidesteps search entirely; that check runs first, so this method never
   * actually sees an egg-matching name.)
   */
  private disambiguateQuery(name: string): string {
    if (
      /\bchocolate\b/i.test(name) &&
      !/syrup|drink|beverage|milk|cocoa/i.test(name)
    ) {
      return `${name} baking`;
    }
    return name;
  }

  /**
   * Estimates calories per 100g from protein/fat/carb using standard Atwater
   * general factors (4/4/9 kcal per gram), for a food whose detail record
   * has macros but no direct energy value under any of `NUTRIENT_NUMBERS.calories`.
   */
  private deriveCaloriesFromMacros(detail: FdcFoodDetail): number {
    const protein = this.nutrientPer100g(detail, [NUTRIENT_NUMBERS.protein]);
    const fat = this.nutrientPer100g(detail, [NUTRIENT_NUMBERS.fat]);
    const carbs = this.nutrientPer100g(detail, [NUTRIENT_NUMBERS.carbs]);
    return protein * 4 + carbs * 4 + fat * 9;
  }

  /** Fetches full nutrient values and household-measure ("foodPortions") gram weights for a matched food. */
  private async getFoodDetail(
    fdcId: number,
    apiKey: string,
  ): Promise<FdcFoodDetail> {
    return this.fetchJson<FdcFoodDetail>(
      `${FDC_BASE_URL}/food/${fdcId}?api_key=${apiKey}`,
    );
  }

  /** Converts a search result's flat nutrient list into the detail endpoint's shape, so both can share `nutrientPer100g`/`deriveCaloriesFromMacros`. */
  private normalizeSearchNutrients(food: FdcSearchFood): FdcNutrientDetail[] {
    return (food.foodNutrients ?? []).map((n) => ({
      nutrient: { number: n.nutrientNumber },
      amount: n.value,
    }));
  }

  private hasUsableCalories(detail: FdcFoodDetail): boolean {
    return (
      this.nutrientPer100g(detail, NUTRIENT_NUMBERS.calories) > 0 ||
      this.deriveCaloriesFromMacros(detail) > 0
    );
  }

  /**
   * Finds the best-matching food for a free-text ingredient name, preferring
   * USDA's curated Foundation/SR Legacy reference data over Branded products
   * so results are generic (e.g. "flour", not one specific brand). Cached
   * per ingredient name (see `findBestFoodDetail`) — this is the uncached
   * implementation that actually talks to USDA.
   *
   * Picks among up to 5 ranked candidates using only the search response's
   * own inline nutrient data (no extra requests) — the first with usable
   * calorie data, either a direct energy value or one derivable from its
   * protein/fat/carb via Atwater factors, falling back to the top match if
   * none qualify. Some entries (particularly recent Foundation Foods
   * additions) rank highly but carry only partial lab data (e.g. a
   * fatty-acid breakdown with no energy/protein/carb rollup at all), and
   * blindly using the top match can silently report near-zero nutrition for
   * an otherwise well-known ingredient; deriving calories from macros
   * (rather than treating "no direct energy" as disqualifying) matters too —
   * a candidate can have real fat/protein data but no listed direct energy,
   * and skipping straight past it risks landing on a completely unrelated
   * food that merely happens to have an energy number (e.g. "unsalted
   * butter" cascading past incomplete butter entries to match "Pretzels,
   * soft, unsalted"). Only the winning candidate gets a full detail fetch
   * (for its precise foodPortions and complete nutrient set) — this keeps
   * every ingredient lookup at a constant 2 requests instead of up to 6,
   * regardless of how many candidates would otherwise need to be skipped.
   *
   * The detail fetch is only waited on for `detailTimeoutMs`; past that the
   * search data is used, and the still-running request is handed back as
   * `lateDetail` so the cache can be upgraded when it lands.
   */
  private async lookupFoodDetail(
    name: string,
    apiKey: string,
  ): Promise<{
    detail: FdcFoodDetail | null;
    lateDetail?: Promise<FdcFoodDetail>;
  }> {
    const override = this.knownIngredientOverride(name);
    if (override) return { detail: override };

    const params = new URLSearchParams({
      api_key: apiKey,
      query: this.disambiguateQuery(this.sanitizeName(name)),
      dataType: 'Foundation,SR Legacy',
      pageSize: '5',
    });
    const data = await this.fetchJson<FdcSearchResponse>(
      `${FDC_BASE_URL}/foods/search?${params.toString()}`,
    );
    const candidates = data.foods ?? [];
    if (candidates.length === 0) return { detail: null };

    const winner =
      candidates.find((c) =>
        this.hasUsableCalories({
          foodNutrients: this.normalizeSearchNutrients(c),
        }),
      ) ?? candidates[0];
    const searchData: FdcFoodDetail = {
      foodNutrients: this.normalizeSearchNutrients(winner),
      foodPortions: [],
    };

    const detailRequest = this.getFoodDetail(winner.fdcId, apiKey);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), this.detailTimeoutMs);
    });
    try {
      const result = await Promise.race([detailRequest, timeout]);
      if (result === 'timeout') {
        return { detail: searchData, lateDetail: detailRequest };
      }
      return { detail: result };
    } catch (error) {
      // The detail endpoint can 404 on an fdcId its own search index still
      // returns (seen consistently for a handful of real fdcIds) — fall
      // back to the search response's own data (just without portions)
      // rather than failing the ingredient outright.
      this.logger.warn(
        `USDA food ${winner.fdcId} detail fetch failed for "${name}", using search data instead: ${(error as Error).message}`,
      );
      return { detail: searchData };
    } finally {
      clearTimeout(timer);
    }
  }

  // USDA's detail endpoint builds per-sample lab data for some Foundation
  // Foods and can take 20s+ (e.g. american cheese: 2.3MB), while typical
  // responses finish well under a second.
  private readonly detailTimeoutMs = 1500;

  /**
   * Cached wrapper around `lookupFoodDetail`. The same handful of staples
   * (egg, salt, flour, chicken breast, onion, garlic, ...) recur across
   * nearly every recipe, and USDA's own API latency is the dominant cost of
   * a nutrition calculation (each lookup is 1-2 real network round trips,
   * observed anywhere from ~200ms to several seconds) — caching means only
   * the first time any given ingredient name is looked up pays that cost;
   * every later recipe (or a recalculation of the same one) reuses it
   * in-memory. Reference nutrition data doesn't change minute to minute, so
   * a day-long TTL is just staleness insurance, not a correctness concern.
   */
  private async findBestFoodDetail(
    name: string,
    apiKey: string,
  ): Promise<FdcFoodDetail | null> {
    const cacheKey = name.trim().toLowerCase();
    const cached = this.foodDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.detail;
    }

    const { detail, lateDetail } = await this.lookupFoodDetail(name, apiKey);
    this.foodDetailCache.set(cacheKey, {
      detail,
      expiresAt: Date.now() + FOOD_DETAIL_CACHE_TTL_MS,
    });
    void lateDetail
      ?.then((full) =>
        this.foodDetailCache.set(cacheKey, {
          detail: full,
          expiresAt: Date.now() + FOOD_DETAIL_CACHE_TTL_MS,
        }),
      )
      .catch((error: Error) =>
        this.logger.warn(
          `Late USDA detail fetch failed for "${name}", keeping search data: ${error.message}`,
        ),
      );
    return detail;
  }

  private parseQuantity(quantity: string | null | undefined): number | null {
    if (!quantity) return null;
    const mixed = quantity.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = quantity.match(/^(\d+)\/(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const value = Number(quantity);
    return isFinite(value) ? value : null;
  }

  /**
   * Converts an ingredient's quantity+unit to grams so it can be scaled
   * against a food's per-100g nutrients, in priority order:
   * 1. A matching USDA foodPortion for the specific matched food (most
   *    accurate — reflects that food's actual density).
   * 2. `SMALL_UNIT_GRAMS` for spoon/piece units USDA rarely lists as a
   *    portion (clove, pinch, dash).
   * 3. `DRY_GOODS_GRAMS_PER_CUP` for volume units on a known dense/dry
   *    ingredient (flour, cocoa, sugar, etc) — without this, a cup is
   *    assumed to weigh what a cup of water weighs, which overestimates
   *    flour/cocoa by roughly 2x.
   * 4. Water-density volume conversion (reasonable for actual liquids).
   * 5. `CONTAINER_GRAMS` for a package/container word, either as the unit
   *    ("2 cans tomatoes") or in the name with no unit given ("1 container
   *    ricotta") — a can of tomatoes is a poor fit for a single tomato's
   *    piece weight, so this is checked before `WHOLE_ITEM_GRAMS`.
   * 6. `WHOLE_ITEM_GRAMS` for a no-unit count of a known staple (e.g. "2
   *    eggs" ~= 50g each, not the ~100g flat guess).
   * 7. A flat 100g guess, as a last resort.
   *
   * Special case: an ingredient explicitly marked "to taste"/"if needed"/
   * "optional"/etc (e.g. "kosher salt (to taste)", "sugar (if needed,
   * optional)") has no real quantity by design, not just an unparsed one —
   * treated as a negligible garnish-level addition rather than one full
   * 100g/whole-item serving. Checked against the raw name, since a plain
   * "onion" with no explicit quantity elsewhere still means one real onion.
   */
  private resolveGrams(
    name: string,
    quantity: string | null | undefined,
    unit: string | null | undefined,
    portions: FdcPortion[] | undefined,
  ): number {
    if (
      /to taste|if needed|as needed|\boptional\b|for garnish|for serving/i.test(
        name,
      )
    ) {
      return 2;
    }

    const normalizedUnit = (unit ?? '').trim().toLowerCase();

    // Amount-less toppings ("mustard", "pickle chips", "special sauce") are a
    // spoonful per serving, not a whole 100g.
    if (
      this.parseQuantity(quantity) == null &&
      !normalizedUnit &&
      /\b(mustard|ketchup|catsup|mayo|mayonnaise|sauce|relish|pickles?|salsa|dressing|sriracha|aioli)\b/i.test(
        name,
      )
    ) {
      return 15;
    }

    const amount = this.parseQuantity(quantity) ?? 1;

    if (!normalizedUnit) {
      // Count-based ingredient (e.g. "2 eggs", "1 container ricotta"):
      // prefer a matching "each/large/..." USDA portion, then a named
      // container size (checked before a single-piece weight, since
      // "container ricotta" should price as a tub, not a countable piece),
      // then a known staple's typical piece weight, else assume ~100g.
      const portion = portions?.find((p) =>
        /each|large|medium|small|piece|whole/i.test(
          p.modifier ?? p.measureUnit?.name ?? '',
        ),
      );
      return (
        amount *
        (portion?.gramWeight ??
          this.containerGrams(name) ??
          this.wholeItemGrams(name) ??
          100)
      );
    }

    if (normalizedUnit in MASS_UNITS_TO_GRAMS) {
      return amount * MASS_UNITS_TO_GRAMS[normalizedUnit];
    }

    const portion = portions?.find(
      (p) => (p.measureUnit?.name ?? '').toLowerCase() === normalizedUnit,
    );
    if (portion) return amount * portion.gramWeight;

    if (normalizedUnit in SMALL_UNIT_GRAMS) {
      return amount * SMALL_UNIT_GRAMS[normalizedUnit];
    }

    if (normalizedUnit in VOLUME_UNITS_TO_ML) {
      const dryGramsPerCup = this.dryGoodsGramsPerCup(name);
      if (dryGramsPerCup != null) {
        const cupFraction =
          VOLUME_UNITS_TO_ML[normalizedUnit] / VOLUME_UNITS_TO_ML.cup;
        return amount * cupFraction * dryGramsPerCup;
      }
      return amount * VOLUME_UNITS_TO_ML[normalizedUnit];
    }

    // Unrecognized unit: a container/package word (e.g. "2 cans tomatoes")
    // takes priority over a single-piece weight (a can of tomatoes is not
    // one ~123g tomato); a piece-like unit (e.g. "1 stick cinnamon") uses a
    // known staple's typical weight; otherwise fall back to a flat 100g.
    return (
      amount *
      (this.containerGrams(normalizedUnit) ?? this.wholeItemGrams(name) ?? 100)
    );
  }

  /** Returns the first matching nutrient's per-100g amount, checking `numbers` in order. */
  private nutrientPer100g(
    detail: FdcFoodDetail,
    numbers: readonly string[],
  ): number {
    for (const number of numbers) {
      const match = detail.foodNutrients?.find(
        (n) => n.nutrient?.number === number,
      );
      if (match?.amount != null) return match.amount;
    }
    return 0;
  }

  /**
   * Looks up one ingredient's food match and returns its scaled nutrition
   * contribution. Zeroed if unmatched, or if the lookup itself fails (e.g. a
   * scraped ingredient name USDA's API rejects) — one bad ingredient
   * shouldn't sink nutrition totals for the whole recipe.
   */
  private async calculateForIngredient(
    ingredient: NutritionIngredientInput,
    apiKey: string,
  ): Promise<NutritionTotals> {
    try {
      const detail = await this.findBestFoodDetail(ingredient.name, apiKey);
      if (!detail) return ZERO_TOTALS;

      const factor =
        this.resolveGrams(
          ingredient.name,
          ingredient.quantity,
          ingredient.unit,
          detail.foodPortions,
        ) / 100;

      const totals = { ...ZERO_TOTALS };
      for (const [field, nutrientNumber] of NUTRIENT_FIELD_MAP) {
        totals[field] = this.nutrientPer100g(detail, nutrientNumber) * factor;
      }
      // Some matched foods have real macro data but no direct energy value
      // at all (not even "957"/"958") — estimate it from those macros
      // rather than reporting 0 calories for an otherwise-known ingredient.
      if (totals.calories === 0) {
        totals.calories = this.deriveCaloriesFromMacros(detail) * factor;
      }
      return totals;
    } catch (error) {
      this.logger.warn(
        `Nutrition lookup failed for ingredient "${ingredient.name}": ${(error as Error).message}`,
      );
      return ZERO_TOTALS;
    }
  }

  /**
   * Looks up each ingredient in USDA FoodData Central, converts its quantity
   * to grams, and sums the resulting calories/macros into recipe-level
   * totals (rounded to 1 decimal). An ingredient that has no FDC match, or
   * whose lookup fails outright, contributes zero rather than failing the
   * whole request (a warning is logged for the latter).
   * @throws ServiceUnavailableException if USDA_FDC_API_KEY isn't configured.
   */
  async calculateForIngredients(
    ingredients: NutritionIngredientInput[],
  ): Promise<NutritionTotals> {
    const apiKey = this.apiKey();

    const perIngredient = await Promise.all(
      ingredients.map((ingredient) =>
        this.calculateForIngredient(ingredient, apiKey),
      ),
    );

    const totals = { ...ZERO_TOTALS };
    for (const ingredientTotals of perIngredient) {
      for (const [field] of NUTRIENT_FIELD_MAP) {
        totals[field] += ingredientTotals[field];
      }
    }

    const rounded = { ...ZERO_TOTALS };
    for (const [field] of NUTRIENT_FIELD_MAP) {
      rounded[field] = this.round(totals[field]);
    }
    return rounded;
  }
}
