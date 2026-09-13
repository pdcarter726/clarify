"use client";

import { useState } from "react";
import type { ExtractedRecipe, Recipe } from "@/lib/api";
import { formatServings, parseServingsCount, scaleQuantity, sourceHostname } from "@/lib/scale";
import CookModeToggle from "@/components/CookModeToggle";
import NutritionLabel from "@/components/NutritionLabel";

interface RecipeCardProps {
  recipe: Recipe | ExtractedRecipe;
  /**
   * Calculates (or recalculates) nutrition for a saved recipe, resolving
   * `true` on success. Omitted for unsaved previews, which can't be analyzed,
   * and which then show no nutrition section at all.
   */
  onCalculateNutrition?: () => Promise<boolean>;
}

const nutritionLinkClass =
  "text-xs font-medium text-orange-700 hover:text-orange-900 disabled:cursor-wait disabled:opacity-60 dark:text-orange-300 dark:hover:text-orange-200";

/**
 * Full recipe layout: image + ingredients on the left, instructions in the
 * middle, and nutrition facts on the right — hidden by default, and only
 * calculated (via `onCalculateNutrition`) when the user asks for it.
 * Accepts either a saved `Recipe` or an unsaved `ExtractedRecipe` (preview),
 * narrowing via `"id" in recipe`/`"tags" in recipe`/`"calories" in recipe`.
 * Owns a local servings target used to rescale ingredient quantities (via
 * `lib/scale`) and the nutrition label's servings display, independent of
 * the recipe's stored `servings`.
 */
export default function RecipeCard({ recipe, onCalculateNutrition }: RecipeCardProps) {
  const baseServings = parseServingsCount(recipe.servings);
  const [targetServings, setTargetServings] = useState(baseServings ?? 1);
  const [servingsText, setServingsText] = useState(String(baseServings ?? 1));
  const [imageFailed, setImageFailed] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const scale = baseServings ? targetServings / baseServings : 1;

  function updateServings(next: number) {
    const clamped = Math.max(1, next);
    setTargetServings(clamped);
    setServingsText(String(clamped));
  }

  function handleServingsInput(value: string) {
    setServingsText(value);
    const parsed = Number(value);
    if (value.trim() !== "" && !Number.isNaN(parsed) && parsed > 0) {
      setTargetServings(parsed);
    }
  }

  function handleServingsBlur() {
    // Snap the visible text back to the last valid value if left empty/invalid.
    setServingsText(String(targetServings));
  }

  const tags = "tags" in recipe ? recipe.tags : undefined;
  // Per-serving values: dividing the stored (whole-recipe) totals by
  // baseServings rather than by targetServings, since scaling ingredients up
  // or down changes the total but not the amount in a single serving. A
  // recipe with no servings count is labeled as one serving (the whole
  // recipe). `null` (field never calculated, e.g. on a recipe last analyzed
  // before a given nutrient was tracked) is kept as `null`, not coerced to 0.
  const nutritionServings = baseServings ?? 1;
  function perServing(value: number | null | undefined, decimals: number) {
    if (value == null) return null;
    const factor = 10 ** decimals;
    return Math.round((value / nutritionServings) * factor) / factor;
  }

  async function calculateNutrition() {
    if (!onCalculateNutrition) return;
    setCalculating(true);
    try {
      if (await onCalculateNutrition()) setShowNutrition(true);
    } finally {
      setCalculating(false);
    }
  }

  // Showing nutrition that was never calculated (or was cleared by an
  // ingredient edit) is what triggers the calculation.
  function handleToggleNutrition() {
    if (!nutrition) {
      void calculateNutrition();
    } else {
      setShowNutrition((prev) => !prev);
    }
  }

  const nutrition =
    "calories" in recipe && recipe.calories != null
      ? {
          calories: perServing(recipe.calories, 0) ?? 0,
          proteinGrams: perServing(recipe.proteinGrams, 1) ?? 0,
          fatGrams: perServing(recipe.fatGrams, 1) ?? 0,
          saturatedFatGrams: perServing(recipe.saturatedFatGrams, 1),
          transFatGrams: perServing(recipe.transFatGrams, 1),
          cholesterolMg: perServing(recipe.cholesterolMg, 0),
          sodiumMg: perServing(recipe.sodiumMg, 0),
          carbGrams: perServing(recipe.carbGrams, 1) ?? 0,
          fiberGrams: perServing(recipe.fiberGrams, 1),
          sugarGrams: perServing(recipe.sugarGrams, 1),
          vitaminDMcg: perServing(recipe.vitaminDMcg, 1),
          calciumMg: perServing(recipe.calciumMg, 0),
          ironMg: perServing(recipe.ironMg, 1),
          potassiumMg: perServing(recipe.potassiumMg, 0),
        }
      : undefined;

  const metaParts = [
    formatServings(recipe.servings) && {
      label: `🍽️ ${formatServings(recipe.servings)}`,
      color: "amber" as const,
    },
    recipe.prepTime && { label: `⏱️ Prep ${recipe.prepTime}`, color: "teal" as const },
    recipe.cookTime && { label: `🔥 Cook ${recipe.cookTime}`, color: "rose" as const },
  ].filter(Boolean) as { label: string; color: "amber" | "teal" | "rose" }[];

  const pillClasses = {
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-md shadow-orange-900/5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex flex-col gap-4 p-6 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{recipe.title}</h2>
          <CookModeToggle />
        </div>

        {(metaParts.length > 0 || recipe.sourceUrl) && (
          <div className="flex flex-wrap gap-1.5">
            {metaParts.map((part) => (
              <span
                key={part.label}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillClasses[part.color]}`}
              >
                {part.label}
              </span>
            ))}
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 hover:bg-orange-200 dark:bg-orange-400/15 dark:text-orange-300"
              >
                🔗 {sourceHostname(recipe.sourceUrl)}
              </a>
            )}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-400/20 dark:text-teal-300"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 p-6 sm:flex-row">
        {/* Left: image, with ingredients underneath. */}
        <div className="flex flex-col gap-4 sm:w-72 sm:shrink-0">
          {recipe.imageUrl && !imageFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              loading="lazy"
              className="h-48 w-full rounded-xl object-cover"
              onError={() => setImageFailed(true)}
            />
          )}

          {recipe.ingredients.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Ingredients
                </h3>
                {baseServings && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Servings</span>
                    <button
                      type="button"
                      onClick={() => updateServings(targetServings - 1)}
                      disabled={targetServings <= 1}
                      aria-label="Decrease servings"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-orange-300 dark:hover:bg-white/20"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={servingsText}
                      onChange={(e) => handleServingsInput(e.target.value)}
                      onBlur={handleServingsBlur}
                      aria-label="Number of servings"
                      className="w-10 rounded-md border border-orange-200 px-1 py-0.5 text-center text-xs outline-none focus:border-orange-500 dark:border-white/10 dark:bg-white/5"
                    />
                    <button
                      type="button"
                      onClick={() => updateServings(targetServings + 1)}
                      aria-label="Increase servings"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-200 dark:bg-white/10 dark:text-orange-300 dark:hover:bg-white/20"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                {recipe.ingredients.map((ing, index) => (
                  <li key={ing.id ?? index}>
                    {[scaleQuantity(ing.quantity, scale), ing.unit, ing.name]
                      .filter(Boolean)
                      .join(" ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Middle: steps, unchanged. */}
        {recipe.instructions.length > 0 && (
          <div className="flex-1">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Instructions
            </h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
              {recipe.instructions
                .slice()
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step, index) => (
                  <li key={step.id ?? index}>{step.text}</li>
                ))}
            </ol>
          </div>
        )}

        {/* Right: nutrition, hidden until requested. The label's "servings"
            header tracks the live servings stepper (targetServings) so it
            stays in sync with the scaled ingredient list; the per-serving
            nutrient amounts themselves don't change with scaling since
            they're already computed per single serving. */}
        {onCalculateNutrition && (
          <div className="flex flex-col gap-2 sm:max-w-xs sm:shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggleNutrition}
                disabled={calculating}
                aria-expanded={showNutrition && Boolean(nutrition)}
                className={nutritionLinkClass}
              >
                {!nutrition
                  ? calculating
                    ? "Calculating nutrition…"
                    : "Calculate nutrition facts"
                  : showNutrition
                    ? "Hide nutrition facts"
                    : "Show nutrition facts"}
              </button>
              {showNutrition && nutrition && (
                <button
                  type="button"
                  onClick={() => void calculateNutrition()}
                  disabled={calculating}
                  className={nutritionLinkClass}
                >
                  {calculating ? "Recalculating…" : "Recalculate"}
                </button>
              )}
            </div>
            {showNutrition && nutrition && (
              <>
                <p
                  role="note"
                  className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
                >
                  Nutrition information is an estimate from the USDA FoodData
                  Central API and may be incomplete or incorrect.
                </p>
                <NutritionLabel
                  values={nutrition}
                  servings={baseServings ? targetServings : nutritionServings}
                />
              </>
            )}
          </div>
        )}
      </div>

      {!("id" in recipe) && (
        <p className="px-6 pb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Log in or sign up to save this recipe to your collection.
        </p>
      )}
    </article>
  );
}
