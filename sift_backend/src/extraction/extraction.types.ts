/** A single ingredient line parsed from a recipe page; `quantity`/`unit` are omitted when parsing couldn't identify them. */
export interface ExtractedIngredient {
  name: string;
  quantity?: string;
  unit?: string;
  position: number;
}

/** A single numbered instruction step parsed from a recipe page. */
export interface ExtractedInstruction {
  stepNumber: number;
  text: string;
}

/** Recipe data normalized from a page's schema.org JSON-LD, ready to prefill a create-recipe form. */
export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  imageUrl?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: ExtractedIngredient[];
  instructions: ExtractedInstruction[];
}
