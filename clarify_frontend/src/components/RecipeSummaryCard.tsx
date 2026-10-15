"use client";

import { useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/api";
import { formatServings } from "@/lib/scale";
import Icon from "./Icon";

interface RecipeSummaryCardProps {
  recipe: Recipe;
}

/** Compact, clickable card for the recipe list: image, title, time/servings, and tags. */
export default function RecipeSummaryCard({ recipe }: RecipeSummaryCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const meta = [
    formatServings(recipe.servings),
    recipe.prepTime && `Prep ${recipe.prepTime}`,
    recipe.cookTime && `Cook ${recipe.cookTime}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/recipes/${recipe.id}`} className="rcard">
      <div
        aria-hidden="true"
        className="flex h-[132px] items-center justify-center overflow-hidden bg-sunk text-edge"
      >
        {recipe.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name="utensils" size={44} strokeWidth={1.5} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-5 pt-[18px]">
        <h2 className="text-lg font-bold leading-snug">{recipe.title}</h2>
        {meta && <p className="text-sm text-muted">{meta}</p>}
        {recipe.tags.length > 0 && (
          <p className="mt-auto text-[13px] font-semibold text-accent">
            {recipe.tags.map((tag) => `#${tag.name}`).join("  ")}
          </p>
        )}
      </div>
    </Link>
  );
}
