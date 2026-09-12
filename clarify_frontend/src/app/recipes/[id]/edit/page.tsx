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
    return <p className="py-12 text-center text-zinc-400">Loading…</p>;
  }

  if (notFound || !recipe) {
    return (
      <p className="py-12 text-center text-zinc-400">
        That recipe could not be found.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Editing: {recipe.title}
      </h1>
      <RecipeForm
        initialRecipe={recipe}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/recipes/${id}`)}
      />
    </div>
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
