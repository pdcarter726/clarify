"use client";

import { useState, type FormEvent } from "react";
import type { Recipe, RecipeInput } from "@/lib/api";
import IngredientsEditor, { type IngredientDraft } from "./IngredientsEditor";
import InstructionsEditor, { type InstructionDraft } from "./InstructionsEditor";
import TagPicker from "./TagPicker";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass } from "./ui";

interface RecipeFormProps {
  initialRecipe?: Recipe;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}

/** Maps a saved `Recipe`'s ingredients to the editor's draft shape (or `[]` if creating new). */
function toIngredientDrafts(recipe?: Recipe): IngredientDraft[] {
  if (!recipe) return [];
  return recipe.ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity ?? "",
    unit: ing.unit ?? "",
  }));
}

/** Maps a saved `Recipe`'s instructions to the editor's draft shape, sorted by step number (or `[]` if creating new). */
function toInstructionDrafts(recipe?: Recipe): InstructionDraft[] {
  if (!recipe) return [];
  return recipe.instructions
    .slice()
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((step) => ({ text: step.text }));
}

/**
 * Shared create/edit form for a recipe. Seeds all fields from `initialRecipe`
 * when editing; on submit, drops blank ingredient/instruction rows, assigns
 * `position`/`stepNumber` from array order, and hands the assembled
 * `RecipeInput` to the caller's `onSubmit` (which performs the actual
 * create/update API call).
 */
export default function RecipeForm({ initialRecipe, onSubmit, onCancel, submitLabel }: RecipeFormProps) {
  const [title, setTitle] = useState(initialRecipe?.title ?? "");
  const [servings, setServings] = useState(initialRecipe?.servings ?? "");
  const [prepTime, setPrepTime] = useState(initialRecipe?.prepTime ?? "");
  const [cookTime, setCookTime] = useState(initialRecipe?.cookTime ?? "");
  const [imageUrl, setImageUrl] = useState(initialRecipe?.imageUrl ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialRecipe?.sourceUrl ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(toIngredientDrafts(initialRecipe));
  const [instructions, setInstructions] = useState<InstructionDraft[]>(
    toInstructionDrafts(initialRecipe),
  );
  const [tags, setTags] = useState<string[]>(initialRecipe?.tags.map((t) => t.name) ?? []);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const input: RecipeInput = {
      title,
      servings: servings || undefined,
      prepTime: prepTime || undefined,
      cookTime: cookTime || undefined,
      imageUrl: imageUrl || undefined,
      sourceUrl: sourceUrl || undefined,
      ingredients: ingredients
        .filter((row) => row.name.trim())
        .map((row, index) => ({
          name: row.name,
          quantity: row.quantity || undefined,
          unit: row.unit || undefined,
          position: index,
        })),
      instructions: instructions
        .filter((row) => row.text.trim())
        .map((row, index) => ({ stepNumber: index + 1, text: row.text })),
      tags,
    };

    setSubmitting(true);
    try {
      await onSubmit(input);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-5`}>
      <div>
        <label className={labelClass} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="servings">
            Servings
          </label>
          <input
            id="servings"
            type="text"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="prepTime">
            Prep time
          </label>
          <input
            id="prepTime"
            type="text"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cookTime">
            Cook time
          </label>
          <input
            id="cookTime"
            type="text"
            value={cookTime}
            onChange={(e) => setCookTime(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="imageUrl">
          Image URL
        </label>
        <input
          id="imageUrl"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="sourceUrl">
          Source URL
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className={`${inputClass} mt-1`}
        />
      </div>

      <TagPicker value={tags} onChange={setTags} />

      <IngredientsEditor ingredients={ingredients} onChange={setIngredients} />

      <InstructionsEditor instructions={instructions} onChange={setInstructions} />

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
