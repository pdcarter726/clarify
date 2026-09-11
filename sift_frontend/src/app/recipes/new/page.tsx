"use client";

import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeForm from "@/components/RecipeForm";
import { useToast } from "@/lib/toast-context";
import { ApiError, recipesApi, type RecipeInput } from "@/lib/api";

/** Blank `RecipeForm` that creates a recipe via `recipesApi.create` (`POST /recipes`) and redirects to `/recipes` on success. */
function NewRecipeContent() {
  const router = useRouter();
  const { showMessage } = useToast();

  async function handleSubmit(input: RecipeInput) {
    try {
      await recipesApi.create(input);
      showMessage("Recipe created.", "success");
      router.push("/recipes");
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not create recipe.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-white">New recipe</h1>
      <RecipeForm
        submitLabel="Create recipe"
        onSubmit={handleSubmit}
        onCancel={() => router.push("/recipes")}
      />
    </div>
  );
}

/** New recipe page; gated behind `ProtectedRoute`. */
export default function NewRecipePage() {
  return (
    <ProtectedRoute>
      <NewRecipeContent />
    </ProtectedRoute>
  );
}
