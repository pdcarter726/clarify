"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, extractionApi, type ExtractedRecipe } from "@/lib/api";
import RecipeCard from "@/components/RecipeCard";
import { cardClass, inputClass, primaryButtonClass } from "@/components/ui";

const FEATURES = [
  {
    emoji: "🔗",
    title: "Import from any URL",
    body: "Paste a link to a recipe and Sift pulls out the title, ingredients, and steps automatically.",
  },
  {
    emoji: "🏷️",
    title: "Tag & filter",
    body: "Label recipes — breakfast, weeknight, one pot, whatever fits — and filter your collection by any combination.",
  },
  {
    emoji: "⚖️",
    title: "Scale ingredients",
    body: "Cooking for a crowd? Scale any recipe to 2x, 3x, or a custom amount and quantities recalculate instantly.",
  },
];

/**
 * Marketing landing page for signed-out visitors; redirects to `/recipes`
 * once `useAuth` resolves a logged-in user. Includes a no-login-required
 * recipe URL preview that calls `extractionApi.preview` (`POST /extraction`)
 * and renders the result with `RecipeCard`.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showMessage } = useToast();

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewRecipe, setPreviewRecipe] = useState<ExtractedRecipe | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/recipes");
    }
  }, [loading, user, router]);

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    setPreviewRecipe(null);
    setPreviewLoading(true);
    try {
      const recipe = await extractionApi.preview(previewUrl);
      setPreviewRecipe(recipe);
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not preview that URL.");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading || user) {
    return <div className="flex flex-1 items-center justify-center text-zinc-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-16 py-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 px-6 py-16 text-center shadow-lg shadow-orange-900/20 sm:px-12">
        <p className="text-5xl">🥄</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Your recipes, organized.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-orange-50">
          Save recipes from anywhere on the web, tag them your way, and scale ingredients on the
          fly — all in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login?tab=signup"
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-orange-700 shadow-sm transition-transform hover:scale-105"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/40 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className={cardClass}>
            <p className="text-3xl">{feature.emoji}</p>
            <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-white">
              {feature.title}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto w-full max-w-2xl">
        <div className={cardClass}>
          <h2 className="mb-1 text-lg font-bold text-zinc-900 dark:text-white">Try it now</h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Paste a recipe URL to see Sift in action — no account required.
          </p>
          <form onSubmit={handlePreview} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              required
              placeholder="https://example.com/recipe"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={previewLoading} className={primaryButtonClass}>
              {previewLoading ? "Loading…" : "Preview"}
            </button>
          </form>
        </div>

        {previewRecipe && (
          <div className="mt-4">
            <RecipeCard key={previewRecipe.sourceUrl} recipe={previewRecipe} />
          </div>
        )}
      </section>
    </div>
  );
}
