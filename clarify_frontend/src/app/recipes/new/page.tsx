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
    <main className="wrap flex-1 pb-20 pt-10">
      <div className="flex max-w-[800px] flex-col gap-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="disp text-4xl font-bold leading-[1.1]">New recipe</h1>
          <p className="text-[15px] text-muted">Add a recipe by hand, or import one from a URL on the recipes page.</p>
        </div>
        <RecipeForm
          submitLabel="Create recipe"
          onSubmit={handleSubmit}
          onCancel={() => router.push("/recipes")}
        />
      </div>
    </main>
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
