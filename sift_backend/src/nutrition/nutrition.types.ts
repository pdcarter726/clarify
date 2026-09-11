/**
 * Aggregate nutrition values for a recipe (or set of ingredients), mirroring
 * the sections of a standard US Nutrition Facts label. Fields USDA's
 * Foundation/SR Legacy data doesn't report for a given food (e.g. trans fat
 * on a plain vegetable) come back as zero, same as an unmatched ingredient.
 */
export interface NutritionTotals {
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  saturatedFatGrams: number;
  transFatGrams: number;
  cholesterolMg: number;
  sodiumMg: number;
  carbGrams: number;
  fiberGrams: number;
  sugarGrams: number;
  vitaminDMcg: number;
  calciumMg: number;
  ironMg: number;
  potassiumMg: number;
}

/** Ingredient fields used to look up a matching food and scale its nutrients. */
export interface NutritionIngredientInput {
  name: string;
  quantity?: string | null;
  unit?: string | null;
}
