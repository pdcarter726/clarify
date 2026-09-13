"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeCard from "@/components/RecipeCard";
import { dangerButtonClass, secondaryButtonClass } from "@/components/ui";
import { useToast } from "@/lib/toast-context";
import { ApiError, recipesApi, type Recipe } from "@/lib/api";

/**
 * Single recipe view: fetches the recipe by id (`recipesApi.get`), treating a
 * 404 specially to show a "not found" message rather than a generic error.
 * Nutrition is only calculated on request (`recipesApi.calculateNutrition`,
 * triggered from `RecipeCard`). Also exposes delete (with a native
 * `confirm()` guard).
 */
function RecipeDetailContent() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { showMessage } = useToast();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    recipesApi
      .get(id)
      .then(setRecipe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          showMessage(err instanceof ApiError ? err.message : "Could not load recipe.");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCalculateNutrition() {
    try {
      setRecipe(await recipesApi.calculateNutrition(id));
      return true;
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not calculate nutrition.");
      return false;
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this recipe?")) return;
    try {
      await recipesApi.remove(id);
      showMessage("Recipe deleted.", "success");
      router.push("/recipes");
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not delete recipe.");
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-zinc-400">Loading…</p>;
  }

  if (notFound || !recipe) {
    return (
      <p className="py-12 text-center text-zinc-400">That recipe could not be found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/recipes"
          className="text-sm font-medium text-orange-700 hover:text-orange-900 dark:text-orange-300 dark:hover:text-orange-200"
        >
          ← Back to recipes
        </Link>
        <div className="flex gap-2">
          <Link href={`/recipes/${id}/edit`} className={secondaryButtonClass}>
            Edit
          </Link>
          <button type="button" onClick={handleDelete} className={dangerButtonClass}>
            Delete
          </button>
        </div>
      </div>
      <RecipeCard
        key={recipe.id}
        recipe={recipe}
        onCalculateNutrition={handleCalculateNutrition}
      />
    </div>
  );
}

/** Recipe detail page; gated behind `ProtectedRoute`. */
export default function RecipeDetailPage() {
  return (
    <ProtectedRoute>
      <RecipeDetailContent />
    </ProtectedRoute>
  );
}
