"use client";

import { useState, type ReactNode } from "react";
import type { ExtractedRecipe, Recipe } from "@/lib/api";
import { formatServings, parseServingsCount, scaleQuantity, sourceHostname } from "@/lib/scale";
import CookModeToggle from "@/components/CookModeToggle";
import Icon from "@/components/Icon";
import NutritionLabel from "@/components/NutritionLabel";

interface RecipeCardProps {
  recipe: Recipe | ExtractedRecipe;
  /**
   * Calculates (or recalculates) nutrition for a saved recipe, resolving
   * `true` on success. Omitted for unsaved previews, which can't be analyzed,
   * and which then show no nutrition section at all.
   */
  onCalculateNutrition?: () => Promise<boolean>;
  /** Buttons (edit/delete) shown beside the tags in the header. */
  actions?: ReactNode;
}

/**
 * Full recipe layout: header (title, cook mode, meta chips, tags, actions),
 * then image + ingredients + nutrition on the left and instructions on the
 * right. Nutrition is hidden by default and only calculated (via
 * `onCalculateNutrition`) when the user asks for it.
 * Accepts either a saved `Recipe` or an unsaved `ExtractedRecipe` (preview),
 * narrowing via `"id" in recipe`/`"tags" in recipe`/`"calories" in recipe`.
 * Owns a local servings target used to rescale ingredient quantities (via
 * `lib/scale`) and the nutrition label's servings display, independent of
 * the recipe's stored `servings`.
 */
export default function RecipeCard({ recipe, onCalculateNutrition, actions }: RecipeCardProps) {
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

  const servingsLabel = formatServings(recipe.servings);
  const steps = recipe.instructions.slice().sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <h1 className="disp max-w-[16em] text-[clamp(32px,4.4vw,48px)] font-bold leading-[1.08] [text-wrap:balance]">
            {recipe.title}
          </h1>
          <CookModeToggle />
        </div>

        {(servingsLabel || recipe.prepTime || recipe.cookTime || recipe.sourceUrl) && (
          <div className="flex flex-wrap items-center gap-2">
            {servingsLabel && <span className="chip chip-tint">{servingsLabel}</span>}
            {recipe.prepTime && <span className="chip">Prep {recipe.prepTime}</span>}
            {recipe.cookTime && <span className="chip">Cook {recipe.cookTime}</span>}
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="chip text-accent"
              >
                <Icon name="external" size={14} />
                {sourceHostname(recipe.sourceUrl)}
              </a>
            )}
          </div>
        )}

        {((tags && tags.length > 0) || actions) && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm font-semibold text-accent">
              {tags?.map((tag) => `#${tag.name}`).join("   ")}
            </p>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <aside className="flex min-w-0 max-w-[460px] flex-[1_1_360px] flex-col gap-6">
          {recipe.imageUrl && !imageFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              loading="lazy"
              className="h-[200px] w-full rounded-2xl object-cover"
              onError={() => setImageFailed(true)}
            />
          )}

          {recipe.ingredients.length > 0 && (
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <h2 className="text-[19px] font-bold">Ingredients</h2>
                {baseServings && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-muted">Servings</span>
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => updateServings(targetServings - 1)}
                      disabled={targetServings <= 1}
                      aria-label="Decrease servings"
                    >
                      <Icon name="minus" />
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={servingsText}
                      onChange={(e) => handleServingsInput(e.target.value)}
                      onBlur={handleServingsBlur}
                      aria-label="Number of servings"
                      className="num w-12 border-0 bg-transparent text-center text-[17px] font-bold outline-none focus-visible:rounded-md"
                    />
                    <button
                      type="button"
                      className="step-btn"
                      onClick={() => updateServings(targetServings + 1)}
                      aria-label="Increase servings"
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                )}
              </div>
              <ul className="text-[15px]">
                {recipe.ingredients.map((ing, index) => {
                  const amount = [scaleQuantity(ing.quantity, scale), ing.unit]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li
                      key={ing.id ?? index}
                      className="flex gap-4 border-t border-line py-3 leading-snug"
                    >
                      {amount && <b className="num w-[92px] shrink-0">{amount}</b>}
                      <span className="text-muted">{ing.name}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Nutrition, hidden until requested. The label's "servings" header
              tracks the live servings stepper (targetServings) so it stays in
              sync with the scaled ingredient list; the per-serving nutrient
              amounts themselves don't change with scaling since they're
              already computed per single serving. */}
          {onCalculateNutrition && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-5">
                <button
                  type="button"
                  onClick={handleToggleNutrition}
                  disabled={calculating}
                  aria-expanded={showNutrition && Boolean(nutrition)}
                  className="linkbtn"
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
                    className="linkbtn"
                  >
                    {calculating ? "Recalculating…" : "Recalculate"}
                  </button>
                )}
              </div>
              {showNutrition && nutrition && (
                <>
                  <p
                    role="note"
                    className="rounded-xl bg-hi px-3.5 py-3 text-[13px] leading-normal text-on-hi"
                  >
                    Nutrition information is an estimate from the USDA FoodData Central API and may
                    be incomplete or incorrect.
                  </p>
                  <NutritionLabel
                    values={nutrition}
                    servings={baseServings ? targetServings : nutritionServings}
                  />
                </>
              )}
            </section>
          )}
        </aside>

        {steps.length > 0 && (
          <section className="card min-w-0 flex-[999_1_440px] p-[clamp(24px,3.5vw,36px)]">
            <h2 className="pb-2 text-[19px] font-bold">Instructions</h2>
            <ol>
              {steps.map((step, index) => (
                <li
                  key={step.id ?? index}
                  className="flex items-start gap-[18px] border-t border-line py-5"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hi text-sm font-bold text-on-hi">
                    {index + 1}
                  </span>
                  <p className="max-w-[36em] pt-[3px] text-[17px] leading-[1.65] [text-wrap:pretty]">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {!("id" in recipe) && (
        <p className="text-sm text-muted">
          Log in or sign up to save this recipe to your collection.
        </p>
      )}
    </div>
  );
}
