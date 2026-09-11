// Reference daily values (2,000-calorie diet) used to compute the "% Daily
// Value" column, per the current FDA Nutrition Facts label. Protein has no
// standard %DV on a per-serving label, so it's omitted like on a real label.
const DAILY_VALUES = {
  fatGrams: 78,
  saturatedFatGrams: 20,
  cholesterolMg: 300,
  sodiumMg: 2300,
  carbGrams: 275,
  fiberGrams: 28,
  vitaminDMcg: 20,
  calciumMg: 1300,
  ironMg: 18,
  potassiumMg: 4700,
} as const;

/** A nutrient amount in a serving; `null` means "not calculated" (rendered as "—"), distinct from a real 0. */
export interface NutritionLabelValues {
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  saturatedFatGrams: number | null;
  transFatGrams: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  carbGrams: number;
  fiberGrams: number | null;
  sugarGrams: number | null;
  vitaminDMcg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  potassiumMg: number | null;
}

interface NutritionLabelProps {
  /** Per-serving nutrient amounts; independent of `servings` and doesn't change when it does. */
  values: NutritionLabelValues;
  /**
   * Servings shown on the "servings per recipe"/"serving size" lines. Pass
   * the caller's live (possibly user-adjusted) serving count so this stays
   * in sync with a scaled ingredient list, even though `values` themselves
   * are already per-serving and don't need rescaling.
   */
  servings: number;
}

function dv(amount: number | null, key: keyof typeof DAILY_VALUES): string {
  if (amount == null) return "";
  return `${Math.round((amount / DAILY_VALUES[key]) * 100)}%`;
}

function amountLabel(amount: number | null, unit: string): string {
  return amount == null ? "—" : `${amount}${unit}`;
}

/**
 * FDA-style Nutrition Facts label for one serving. Values of `null` (fields
 * never calculated, e.g. on a recipe last analyzed before this label existed)
 * render as "—" rather than a misleading "0". Nutrients with no meaningful
 * %DV (trans fat, sugar, protein) show only their amount.
 */
export default function NutritionLabel({ values, servings }: NutritionLabelProps) {
  const row = (
    label: string,
    amount: number | null,
    unit: string,
    dvKey?: keyof typeof DAILY_VALUES,
    indent = false,
  ) => (
    <div
      className={`flex items-baseline justify-between border-t border-zinc-300 py-1 text-sm dark:border-white/15 ${
        indent ? "pl-4" : ""
      }`}
    >
      <span className={indent ? "text-zinc-700 dark:text-zinc-300" : "font-semibold text-zinc-900 dark:text-white"}>
        {label} {amountLabel(amount, unit)}
      </span>
      {dvKey && <span className="font-semibold text-zinc-900 dark:text-white">{dv(amount, dvKey)}</span>}
    </div>
  );

  return (
    <div className="w-full max-w-xs border-2 border-zinc-900 bg-white p-3 font-sans text-zinc-900 dark:border-white dark:bg-zinc-950 dark:text-white">
      <h3 className="border-b-8 border-zinc-900 pb-1 text-2xl font-black leading-none dark:border-white">
        Nutrition Facts
      </h3>
      <p className="border-b border-zinc-300 py-1 text-sm dark:border-white/15">
        {servings} servings per recipe
      </p>
      <div className="flex items-end justify-between border-b-4 border-zinc-900 pb-1 dark:border-white">
        <span className="text-base font-bold">Serving size</span>
        <span className="text-base font-bold">1/{servings} of recipe</span>
      </div>

      <div className="flex items-baseline justify-between border-b-4 border-zinc-900 py-1 dark:border-white">
        <span className="text-xl font-black">Calories</span>
        <span className="text-3xl font-black">{values.calories}</span>
      </div>

      <div className="flex justify-end border-b border-zinc-300 py-0.5 text-xs font-semibold dark:border-white/15">
        % Daily Value*
      </div>

      {row("Total Fat", values.fatGrams, "g", "fatGrams")}
      {row("Saturated Fat", values.saturatedFatGrams, "g", "saturatedFatGrams", true)}
      {row("Trans Fat", values.transFatGrams, "g", undefined, true)}
      {row("Cholesterol", values.cholesterolMg, "mg", "cholesterolMg")}
      {row("Sodium", values.sodiumMg, "mg", "sodiumMg")}
      {row("Total Carbohydrate", values.carbGrams, "g", "carbGrams")}
      {row("Dietary Fiber", values.fiberGrams, "g", "fiberGrams", true)}
      {row("Total Sugars", values.sugarGrams, "g", undefined, true)}
      <div className="border-t-4 border-zinc-900 py-1 text-sm font-semibold dark:border-white">
        Protein {amountLabel(values.proteinGrams, "g")}
      </div>

      {row("Vitamin D", values.vitaminDMcg, "mcg", "vitaminDMcg")}
      {row("Calcium", values.calciumMg, "mg", "calciumMg")}
      {row("Iron", values.ironMg, "mg", "ironMg")}
      {row("Potassium", values.potassiumMg, "mg", "potassiumMg")}

      <p className="border-t-4 border-zinc-900 pt-1 text-[11px] leading-tight text-zinc-600 dark:border-white dark:text-zinc-400">
        * The % Daily Value tells you how much a nutrient in a serving of food
        contributes to a daily diet. 2,000 calories a day is used for general
        nutrition advice. Estimated from USDA FoodData Central; actual values
        may vary by brand/preparation.
      </p>
    </div>
  );
}
