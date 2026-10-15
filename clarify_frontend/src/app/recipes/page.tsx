"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecipeSummaryCard, { type RecipeView } from "@/components/RecipeSummaryCard";
import TagFilterBar from "@/components/TagFilterBar";
import Icon, { type IconName } from "@/components/Icon";
import { useToast } from "@/lib/toast-context";
import { ApiError, recipesApi, tagsApi, type Recipe, type Tag } from "@/lib/api";

const VIEW_KEY = "clarify_recipe_view";
const PAGE_SIZE_KEY = "clarify_recipe_page_size";
const PAGE_SIZES = [6, 12, 24, 48];

const VIEWS: { value: RecipeView; label: string; icon: IconName }[] = [
  { value: "large", label: "Large", icon: "gridLarge" },
  { value: "small", label: "Small", icon: "gridSmall" },
  { value: "list", label: "List", icon: "rows" },
];

const GRID_CLASS: Record<RecipeView, string> = {
  large: "grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]",
  small: "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(190px,100%),1fr))]",
  list: "flex flex-col gap-3",
};

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
  const [view, setView] = useState<RecipeView>("large");
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(1);
  const { showMessage } = useToast();

  // Restore the saved layout preferences once on the client (localStorage is unavailable during SSR).
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(VIEW_KEY);
      const savedSize = Number(localStorage.getItem(PAGE_SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedView === "large" || savedView === "small" || savedView === "list") setView(savedView);
      if (PAGE_SIZES.includes(savedSize)) setPageSize(savedSize);
    } catch {
      // Preferences are optional; ignore unavailable storage.
    }
  }, []);

  function chooseView(next: RecipeView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  function choosePageSize(next: number) {
    setPageSize(next);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(next));
    } catch {}
  }

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
    setPage(1);
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

  const totalPages = Math.max(1, Math.ceil(recipes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = recipes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isFiltered = selectedTags.length > 0 || searchQuery.trim().length > 0;
  const countLabel = loading
    ? "Loading…"
    : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;

  return (
    <main className="wrap flex-1 pb-20 pt-10">
      <div className="flex max-w-[1080px] flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="disp text-4xl font-bold leading-[1.1]">Your recipes</h1>
            <p className="text-[15px] text-muted" aria-live="polite">
              {countLabel}
            </p>
          </div>
          <form onSubmit={handleImport} className="flex max-w-[520px] flex-[1_1_380px] gap-2.5">
            <label htmlFor="import" className="sr-only-label">
              Import a recipe from a URL
            </label>
            <input
              id="import"
              className="field flex-1"
              type="url"
              required
              placeholder="Recipe, YouTube, TikTok or Instagram URL"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
            />
            <button type="submit" disabled={importing} className="btn btn-primary">
              {importing ? "Importing…" : "Import"}
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 inline-flex -translate-y-1/2 text-muted">
              <Icon name="search" />
            </span>
            <input
              className="field min-h-[52px] pl-11"
              type="search"
              aria-label="Search recipes"
              placeholder="Search by recipe name or ingredient…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <TagFilterBar
            tags={tags}
            selected={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div role="group" aria-label="Recipe layout" className="flex gap-1 rounded-xl bg-sunk p-1">
            {VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                onClick={() => chooseView(option.value)}
                className={`seg seg-static min-h-9 px-3.5 text-sm ${view === option.value ? "seg-on" : ""}`}
              >
                <Icon name={option.icon} size={18} />
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-muted">
            Per page
            <select
              value={pageSize}
              onChange={(e) => choosePageSize(Number(e.target.value))}
              className="field min-h-10 w-auto px-3 text-sm text-ink"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && recipes.length === 0 ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]" role="status" aria-label="Loading recipes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sk h-[250px] rounded-2xl" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-base text-muted">
            {isFiltered
              ? "No recipes match your search."
              : "No recipes yet. Create one or import from a URL above."}
          </div>
        ) : (
          <>
            <div className={GRID_CLASS[view]}>
              {visible.map((recipe) => (
                <RecipeSummaryCard key={recipe.id} recipe={recipe} view={view} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  className="btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <Icon name="chevronLeft" size={18} />
                  Previous
                </button>
                <span className="num min-w-24 text-center text-[15px] font-semibold" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                  <Icon name="chevronRight" size={18} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
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
