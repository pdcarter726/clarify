"use client";

import { useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/api";
import { formatServings } from "@/lib/scale";

interface RecipeSummaryCardProps {
  recipe: Recipe;
}

/** Compact, clickable card for the recipe list: image, title, and time/servings only. */
export default function RecipeSummaryCard({ recipe }: RecipeSummaryCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const metaParts = [
    formatServings(recipe.servings) && {
      label: `🍽️ ${formatServings(recipe.servings)}`,
      color: "amber" as const,
    },
    recipe.prepTime && { label: `⏱️ ${recipe.prepTime}`, color: "teal" as const },
    recipe.cookTime && { label: `🔥 ${recipe.cookTime}`, color: "rose" as const },
  ].filter(Boolean) as { label: string; color: "amber" | "teal" | "rose" }[];

  const pillClasses = {
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300",
  };

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-md shadow-orange-900/5 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-900/10 dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      <div className="h-40 w-full overflow-hidden bg-gradient-to-br from-orange-100 to-rose-100 dark:from-white/10 dark:to-white/5">
        {recipe.imageUrl && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🍽️</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-zinc-900 dark:text-white">{recipe.title}</h3>
        {metaParts.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {metaParts.map((part) => (
              <span
                key={part.label}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${pillClasses[part.color]}`}
              >
                {part.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
