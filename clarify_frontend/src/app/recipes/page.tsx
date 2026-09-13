"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeSummaryCard from "@/components/RecipeSummaryCard";
import TagFilterBar from "@/components/TagFilterBar";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { useToast } from "@/lib/toast-context";
import { ApiError, recipesApi, tagsApi, type Recipe, type Tag } from "@/lib/api";

/**
 * Recipe list/search/filter page plus a quick "import from URL" form. Search
 * input is debounced 300ms before it drives `recipesApi.list` (`GET /recipes`)
 * alongside the selected tag filters; both filters and search re-fetch
 * together via a single effect keyed on `[selectedTags, searchQuery]`.
 */
function RecipesPageContent() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const { showMessage } = useToast();

  const loadRecipes = useCallback(
    async (tagFilter: string[], q: string) => {
      setLoading(true);
      try {
        const data = await recipesApi.list(tagFilter, q);
        setRecipes(data);
      } catch (err) {
        showMessage(err instanceof ApiError ? err.message : "Could not load recipes.");
      } finally {
        setLoading(false);
      }
    },
    [showMessage],
  );

  useEffect(() => {
    tagsApi
      .list()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Only async work runs synchronously here; setState calls happen after
    // an await, so this isn't the cascading-render pattern the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecipes(selectedTags, searchQuery);
  }, [selectedTags, searchQuery, loadRecipes]);

  function toggleTag(name: string) {
    setSelectedTags((current) =>
      current.includes(name) ? current.filter((t) => t !== name) : [...current, name],
    );
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setImporting(true);
    try {
      await recipesApi.importFromUrl(importUrl);
      setImportUrl("");
      showMessage("Recipe imported.", "success");
      await loadRecipes(selectedTags, searchQuery);
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not import that URL.");
    } finally {
      setImporting(false);
    }
  }

  const isFiltered = selectedTags.length > 0 || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Your recipes</h1>
        <form onSubmit={handleImport} className="flex gap-2">
          <input
            type="url"
            required
            placeholder="Recipe, YouTube, TikTok or Instagram URL"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            className={`${inputClass} w-80`}
          />
          <button type="submit" disabled={importing} className={secondaryButtonClass}>
            {importing ? "Importing…" : "Import"}
          </button>
        </form>
      </div>

      <input
        type="search"
        placeholder="Search by recipe name or ingredient…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className={inputClass}
        aria-label="Search recipes"
      />

      <TagFilterBar
        tags={tags}
        selected={selectedTags}
        onToggle={toggleTag}
        onClear={() => setSelectedTags([])}
      />

      {loading ? (
        <p className="py-12 text-center text-zinc-400">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="py-12 text-center text-zinc-400">
          {isFiltered
            ? "No recipes match your search."
            : "No recipes yet. Create one or import from a URL above."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeSummaryCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Recipe list page; gated behind `ProtectedRoute`. */
export default function RecipesPage() {
  return (
    <ProtectedRoute>
      <RecipesPageContent />
    </ProtectedRoute>
  );
}
