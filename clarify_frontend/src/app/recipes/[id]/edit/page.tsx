"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeForm from "@/components/RecipeForm";
import { useToast } from "@/lib/toast-context";
import { ApiError, recipesApi, type Recipe, type RecipeInput } from "@/lib/api";

/**
 * Fetches the recipe by id (treating a 404 specially) and hands it to
 * `RecipeForm` as `initialRecipe`; on submit calls `recipesApi.update`
 * (`PATCH /recipes/:id`) and redirects back to the detail page.
 */
function EditRecipeContent() {
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

  async function handleSubmit(input: RecipeInput) {
    try {
      await recipesApi.update(id, input);
      showMessage("Recipe updated.", "success");
      router.push(`/recipes/${id}`);
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not update recipe.");
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
      <main className="wrap flex flex-1 items-center justify-center py-24 text-muted">
        That recipe could not be found.
      </main>
    );
  }

  return (
    <main className="wrap flex-1 pb-20 pt-10">
      <div className="flex max-w-[800px] flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="disp text-4xl font-bold leading-[1.1]">Edit recipe</h1>
          <p className="text-[15px] text-muted">
            Changes to ingredients clear any saved nutrition facts, so you can recalculate them.
          </p>
        </div>
        <RecipeForm
          initialRecipe={recipe}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/recipes/${id}`)}
        />
      </div>
    </main>
  );
}

/** Edit recipe page; gated behind `ProtectedRoute`. */
export default function EditRecipePage() {
  return (
    <ProtectedRoute>
      <EditRecipeContent />
    </ProtectedRoute>
  );
}
