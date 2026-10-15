"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeCard from "@/components/RecipeCard";
import Icon from "@/components/Icon";
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
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted" role="status">
        Loading…
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <main className="wrap flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-muted">That recipe could not be found.</p>
        <Link href="/recipes" className="btn">
          Back to recipes
        </Link>
      </main>
    );
  }

  return (
    <main className="wrap flex-1 pb-20 pt-8">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <Link
          href="/recipes"
          className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-muted hover:text-ink"
        >
          <Icon name="arrowLeft" />
          All recipes
        </Link>
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onCalculateNutrition={handleCalculateNutrition}
          actions={
            <>
              <Link href={`/recipes/${id}/edit`} className="btn">
                <Icon name="edit" />
                Edit
              </Link>
              <button type="button" onClick={handleDelete} className="btn btn-danger">
                <Icon name="trash" />
                Delete
              </button>
            </>
          }
        />
      </div>
    </main>
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
