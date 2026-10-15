"use client";

import { useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/api";
import { formatServings } from "@/lib/scale";
import Icon from "./Icon";

export type RecipeView = "large" | "small" | "list";

interface RecipeSummaryCardProps {
  recipe: Recipe;
  /** Layout density: large cards, compact cards, or a one-line-per-recipe list row. */
  view?: RecipeView;
}

/**
 * Clickable recipe tile for the recipe list. `large` shows image, title,
 * time/servings and tags; `small` is a denser card; `list` is a horizontal
 * row with a thumbnail.
 */
export default function RecipeSummaryCard({ recipe, view = "large" }: RecipeSummaryCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const meta = [
    formatServings(recipe.servings),
    recipe.prepTime && `Prep ${recipe.prepTime}`,
    recipe.cookTime && `Cook ${recipe.cookTime}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const tagLine = recipe.tags.map((tag) => `#${tag.name}`).join("  ");

  const image =
    recipe.imageUrl && !imageFailed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={recipe.imageUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setImageFailed(true)}
      />
    ) : (
      <Icon name="utensils" size={view === "large" ? 44 : 28} strokeWidth={1.5} />
    );

  if (view === "list") {
    return (
      <Link
        href={`/recipes/${recipe.id}`}
        className="rcard flex-row items-center gap-4 p-3 pr-5"
      >
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sunk text-edge"
        >
          {image}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-base font-bold">{recipe.title}</h2>
          {meta && <p className="truncate text-sm text-muted">{meta}</p>}
        </div>
        {tagLine && (
          <p className="hidden max-w-[40%] truncate text-[13px] font-semibold text-accent md:block">
            {tagLine}
          </p>
        )}
      </Link>
    );
  }

  const small = view === "small";

  return (
    <Link href={`/recipes/${recipe.id}`} className="rcard">
      <div
        aria-hidden="true"
        className={`flex items-center justify-center overflow-hidden bg-sunk text-edge ${
          small ? "h-[84px]" : "h-[132px]"
        }`}
      >
        {image}
      </div>

      <div
        className={`flex flex-1 flex-col ${small ? "gap-1.5 px-3.5 pb-3.5 pt-3" : "gap-2.5 px-5 pb-5 pt-[18px]"}`}
      >
        <h2 className={`font-bold leading-snug ${small ? "text-[15px]" : "text-lg"}`}>
          {recipe.title}
        </h2>
        {meta && <p className={`text-muted ${small ? "text-[13px]" : "text-sm"}`}>{meta}</p>}
        {!small && tagLine && <p className="mt-auto text-[13px] font-semibold text-accent">{tagLine}</p>}
      </div>
    </Link>
  );
}
