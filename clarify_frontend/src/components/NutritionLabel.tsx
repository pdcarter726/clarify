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
    style: "bold" | "indent" | "plain" = "plain",
  ) => (
    <div className="num flex justify-between gap-3 border-b border-line py-[7px] text-sm">
      <span className={style === "indent" ? "pl-4" : style === "bold" ? "font-semibold" : ""}>
        {label} <span className="font-normal text-muted">{amountLabel(amount, unit)}</span>
      </span>
      {dvKey && <b>{dv(amount, dvKey)}</b>}
    </div>
  );

  return (
    <div className="card flex flex-col px-[22px] py-5">
      <h3 className="disp pb-1.5 text-2xl font-bold leading-[1.1]">Nutrition Facts</h3>
      <p className="num pb-1 text-sm text-muted">{servings} servings per recipe</p>
      <p className="num pb-3 text-sm text-muted">Serving size 1/{servings} of recipe</p>

      <div className="flex items-baseline justify-between border-t-[6px] border-t-ink border-b border-b-line py-3">
        <span className="text-xl font-bold">Calories</span>
        <span className="disp num text-4xl font-bold leading-none">{values.calories}</span>
      </div>

      <p className="border-b border-line py-1.5 text-right text-xs font-bold text-muted">
        % Daily Value*
      </p>

      {row("Total Fat", values.fatGrams, "g", "fatGrams", "bold")}
      {row("Saturated Fat", values.saturatedFatGrams, "g", "saturatedFatGrams", "indent")}
      {row("Trans Fat", values.transFatGrams, "g", undefined, "indent")}
      {row("Cholesterol", values.cholesterolMg, "mg", "cholesterolMg", "bold")}
      {row("Sodium", values.sodiumMg, "mg", "sodiumMg", "bold")}
      {row("Total Carbohydrate", values.carbGrams, "g", "carbGrams", "bold")}
      {row("Dietary Fiber", values.fiberGrams, "g", "fiberGrams", "indent")}
      {row("Total Sugars", values.sugarGrams, "g", undefined, "indent")}
      {row("Protein", values.proteinGrams, "g", undefined, "bold")}
      {row("Vitamin D", values.vitaminDMcg, "mcg", "vitaminDMcg")}
      {row("Calcium", values.calciumMg, "mg", "calciumMg")}
      {row("Iron", values.ironMg, "mg", "ironMg")}
      {row("Potassium", values.potassiumMg, "mg", "potassiumMg")}

      <p className="pt-2.5 text-[11px] leading-normal text-muted">
        *The % Daily Value tells you how much a nutrient in a serving of food contributes to a daily
        diet. 2,000 calories a day is used for general nutrition advice.
      </p>
    </div>
  );
}
