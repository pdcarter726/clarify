"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, extractionApi, type ExtractedRecipe } from "@/lib/api";
import { formatServings, parseServingsCount, scaleQuantity, sourceHostname } from "@/lib/scale";
import ButterAnimation from "@/components/ButterAnimation";
import Icon, { type IconName } from "@/components/Icon";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "link",
    title: "Import from any URL",
    body: "Paste a link to a recipe and Clarify pulls out the title, ingredients, and steps automatically.",
  },
  {
    icon: "tag",
    title: "Tag & filter",
    body: "Label recipes (breakfast, weeknight, one pot, whatever fits) and filter your collection by any combination.",
  },
  {
    icon: "scale",
    title: "Scale ingredients",
    body: "Cooking for a crowd? Scale any recipe to 2x, 3x, or a custom amount and quantities recalculate instantly.",
  },
  {
    icon: "heart",
    title: "Nutrition facts",
    body: "Calculate a per-serving nutrition label for any saved recipe, estimated from USDA FoodData Central.",
  },
  {
    icon: "flame",
    title: "Cook mode",
    body: "Keep the screen on while you cook, so the recipe stays readable with flour on your hands.",
  },
];

const BUTTER_STEPS = [
  { cls: "a1", title: "Skim the clutter", body: "Ads, pop-ups, and long preambles rise to the top and come off." },
  { cls: "a2", title: "Strain the noise", body: "Everything that is not the recipe settles out of the way." },
  { cls: "a3", title: "Keep the gold", body: "A clean title, ingredients, and steps. Nothing else." },
];

/** Static recipe shown in the hero card until the visitor imports one of their own. */
const SAMPLE_RECIPE: ExtractedRecipe = {
  title: "Weeknight Chickpea Curry",
  sourceUrl: "https://example.com/chickpea-curry",
  servings: "4",
  prepTime: "10 min",
  cookTime: "25 min",
  ingredients: [
    { name: "olive oil", quantity: "2", unit: "tbsp" },
    { name: "yellow onion, diced", quantity: "1" },
    { name: "garlic, minced", quantity: "3", unit: "cloves" },
    { name: "(15 oz) chickpeas, drained", quantity: "2", unit: "cans" },
  ],
  instructions: [],
};

/** Adds `https://` when the visitor pastes a bare domain, which `<input type=url>` would otherwise reject. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Runs the unauthenticated `POST /extraction` preview and tracks its loading/result state. */
function useRecipePreview() {
  const { showMessage } = useToast();
  const [recipe, setRecipe] = useState<ExtractedRecipe | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(url: string) {
    setLoading(true);
    try {
      setRecipe(await extractionApi.preview(normalizeUrl(url)));
    } catch (err) {
      showMessage(err instanceof ApiError ? err.message : "Could not preview that URL.");
    } finally {
      setLoading(false);
    }
  }

  return { recipe, loading, run };
}

function RecipeChips({ recipe }: { recipe: ExtractedRecipe }) {
  const servings = formatServings(recipe.servings);
  return (
    <div className="flex flex-wrap gap-2">
      {servings && <span className="chip chip-tint">{servings}</span>}
      {recipe.prepTime && <span className="chip">Prep {recipe.prepTime}</span>}
      {recipe.cookTime && <span className="chip">Cook {recipe.cookTime}</span>}
      {recipe.sourceUrl && <span className="chip">{sourceHostname(recipe.sourceUrl)}</span>}
    </div>
  );
}

function PreviewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-5">
      <div className="sk h-[30px] w-[72%]" />
      <div className="flex gap-2">
        <div className="sk h-7 w-[92px] rounded-full" />
        <div className="sk h-7 w-[84px] rounded-full" />
        <div className="sk h-7 w-[84px] rounded-full" />
      </div>
      <div className="sk mt-1 h-5 w-[40%]" />
      <div className="sk h-[18px]" />
      <div className="sk h-[18px]" />
      <div className="sk h-[18px] w-[80%]" />
    </div>
  );
}

/** Hero demo card: paste a link, see the extracted recipe, and try the servings scaler. */
function HeroDemo() {
  const preview = useRecipePreview();
  const [url, setUrl] = useState("");
  const [count, setCount] = useState<number | null>(null);

  const recipe = preview.recipe ?? SAMPLE_RECIPE;
  const base = parseServingsCount(recipe.servings);
  const servings = count ?? base ?? 1;
  const factor = base ? servings / base : 1;
  const ingredients = recipe.ingredients.slice(0, 5);

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || preview.loading) return;
    setCount(null);
    await preview.run(url);
  }

  return (
    <div
      className="rise min-w-0 overflow-hidden rounded-[20px] border border-line bg-surface"
      style={{ animationDelay: ".2s", boxShadow: "var(--shadow)" }}
    >
      <form
        onSubmit={handleImport}
        className="relative flex items-center gap-3 border-b border-line bg-sunk py-2.5 pl-[18px] pr-2.5"
      >
        <span className="inline-flex text-muted">
          <Icon name="link" />
        </span>
        <label htmlFor="hero-url" className="sr-only-label">
          Recipe URL
        </label>
        <input
          id="hero-url"
          className="bare"
          type="text"
          inputMode="url"
          placeholder="Paste a recipe link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={preview.loading}
          className="btn btn-primary min-h-9 px-4 text-sm"
        >
          Import
        </button>
        {preview.loading && <span className="load" aria-hidden="true" />}
      </form>

      <div className="flex min-h-[430px] flex-col gap-5 p-7">
        {preview.loading ? (
          <PreviewSkeleton label="Importing recipe" />
        ) : (
          <>
            <h2 className="disp text-[26px] font-bold leading-[1.15]">{recipe.title}</h2>
            <RecipeChips recipe={recipe} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[15px] font-bold">
                Ingredients
                {base && <span className="font-medium text-muted"> · scaled from {base}</span>}
              </span>
              {base && (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    className="stp"
                    aria-label="Fewer servings"
                    disabled={servings <= 1}
                    onClick={() => setCount(Math.max(1, servings - 1))}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <b className="num min-w-7 text-center" aria-live="polite">
                    {servings}
                  </b>
                  <button
                    type="button"
                    className="stp stp-on"
                    aria-label="More servings"
                    onClick={() => setCount(servings + 1)}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </span>
              )}
            </div>
            <ul className="text-[15px]">
              {ingredients.map((ing, i) => (
                <li
                  key={`${recipe.sourceUrl}-${i}`}
                  className="rin flex gap-4 border-t border-line py-3 leading-snug"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <b className="num w-[84px] shrink-0">
                    {[scaleQuantity(ing.quantity, factor), ing.unit].filter(Boolean).join(" ")}
                  </b>
                  <span className="text-muted">{ing.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** "Try it now" section: previews an extracted recipe's steps with no account required. */
function TrySection() {
  const preview = useRecipePreview();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError(true);
      return;
    }
    setError(false);
    await preview.run(url);
  }

  const recipe = preview.recipe;
  const steps = recipe?.instructions.slice().sort((a, b) => a.stepNumber - b.stepNumber) ?? [];

  return (
    <section id="try" className="wrap scroll-mt-6 pb-24">
      <div className="grid items-center gap-12 rounded-[28px] bg-sunk p-[clamp(24px,5vw,56px)] [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <form onSubmit={handlePreview} className="flex flex-col gap-[18px]">
          <h2 className="disp text-[clamp(30px,3.6vw,40px)] font-bold leading-[1.1]">Try it now</h2>
          <p className="text-[17px] leading-relaxed text-muted">
            Paste a recipe URL to see Clarify in action. No account required.
          </p>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2.5">
              <label htmlFor="try-url" className="sr-only-label">
                Recipe URL
              </label>
              <input
                id="try-url"
                className="field min-h-[52px] min-w-0 flex-[1_1_240px] w-auto"
                type="text"
                inputMode="url"
                placeholder="https://example.com/recipe"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(false);
                }}
              />
              <button
                type="submit"
                disabled={preview.loading}
                className="btn btn-primary min-h-[52px] px-7"
              >
                {preview.loading ? "Reading…" : "Preview"}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                Paste a recipe link first.
              </p>
            )}
          </div>
        </form>

        <article
          className="flex min-h-[420px] min-w-0 flex-col gap-[18px] rounded-[20px] border border-line bg-surface p-7"
          style={{ boxShadow: "var(--shadow)" }}
        >
          {preview.loading ? (
            <PreviewSkeleton label="Reading recipe" />
          ) : recipe ? (
            <>
              <h3 className="disp text-2xl font-bold leading-[1.15]">{recipe.title}</h3>
              <RecipeChips recipe={recipe} />
              <ol className="flex flex-col gap-3.5 text-[15px] leading-relaxed">
                {steps.slice(0, 5).map((step, i) => (
                  <li
                    key={`${recipe.sourceUrl}-${i}`}
                    className="rin flex items-start gap-3"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <b className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-hi text-[13px] text-on-hi">
                      {i + 1}
                    </b>
                    <span className="pt-0.5">{step.text}</span>
                  </li>
                ))}
              </ol>
              <p className="border-t border-line pt-3.5 text-sm text-muted">
                Log in or sign up to save this recipe to your collection.
              </p>
            </>
          ) : (
            <p className="m-auto max-w-[18em] text-center text-[15px] text-muted">
              The recipe, without the clutter, will appear here.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

/**
 * Marketing landing page for signed-out visitors; redirects to `/recipes`
 * once `useAuth` resolves a logged-in user. The hero card and "Try it now"
 * section both call `extractionApi.preview` (`POST /extraction`), which needs
 * no account.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/recipes");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted" role="status">
        Loading…
      </div>
    );
  }

  return (
    <>
      <main>
        <section className="wrap grid items-center gap-16 pb-24 pt-20 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
          <div className="flex flex-col gap-7">
            <span className="chip chip-tint rise self-start">Recipe manager</span>
            <h1
              className="disp rise text-[clamp(42px,5.6vw,72px)] font-bold leading-[1.04] [text-wrap:balance]"
              style={{ animationDelay: ".08s" }}
            >
              Recipes, <span className="clarify text-accent">clarified.</span>
            </h1>
            <p
              className="rise max-w-[28em] text-[19px] leading-relaxed text-muted [text-wrap:pretty]"
              style={{ animationDelay: ".16s" }}
            >
              Paste any link. Get the ingredients and the steps, and nothing else. Tag them, scale
              them, and cook from them.
            </p>
            <div className="rise flex flex-wrap gap-3" style={{ animationDelay: ".24s" }}>
              <Link href="/login?tab=signup" className="btn btn-primary min-h-[52px] px-7 text-base">
                Create free account
              </Link>
              <a href="#try" className="btn min-h-[52px] px-7 text-base">
                Try it first
              </a>
            </div>
            <p className="rise text-sm text-muted" style={{ animationDelay: ".32s" }}>
              Works with recipe sites, YouTube, TikTok and Instagram links.
            </p>
          </div>

          <HeroDemo />
        </section>

        <section className="wrap pb-24">
          <div className="grid items-center gap-12 rounded-[28px] border border-line bg-surface p-[clamp(24px,5vw,56px)] [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
            <div className="flex min-w-0 flex-col gap-5">
              <span className="chip chip-tint self-start">Where the name comes from</span>
              <h2 className="disp text-[clamp(30px,3.6vw,40px)] font-bold leading-[1.1] [text-wrap:balance]">
                Named for clarified butter
              </h2>
              <p className="max-w-[30em] text-[17px] leading-relaxed text-muted">
                To clarify butter, you melt it slowly, skim the foam, and strain out the milk
                solids. What is left is pure, golden, and clear. Clarify does the same to a recipe
                page.
              </p>
              <ol className="-mx-[18px] flex flex-col gap-1">
                {BUTTER_STEPS.map((step, i) => (
                  <li key={step.title} className="st">
                    <span className={`st-bg ${step.cls}`} aria-hidden="true" />
                    <span className="st-badge">
                      <span className={`st-on ${step.cls}`} aria-hidden="true">
                        {i + 1}
                      </span>
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-[17px] font-bold leading-snug">{step.title}</h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-muted">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex justify-center rounded-[20px] bg-sunk p-[clamp(20px,4vw,40px)]">
              <ButterAnimation />
            </div>
          </div>
        </section>

        <section className="wrap flex flex-col gap-10 pb-24">
          <div className="flex max-w-[620px] flex-col gap-3">
            <h2 className="disp text-[clamp(30px,3.6vw,40px)] font-bold leading-[1.1] [text-wrap:balance]">
              Everything between the link and the stove
            </h2>
            <p className="text-[17px] leading-relaxed text-muted">
              Clarify pulls the recipe out of the page, keeps it tidy, and helps while you cook.
            </p>
          </div>
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="tile card flex flex-col gap-3 p-7">
                <span className="ico inline-flex h-11 w-11 items-center justify-center rounded-xl bg-hi text-on-hi">
                  <Icon name={feature.icon} />
                </span>
                <h3 className="mt-1 text-[19px] font-bold">{feature.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
            <a
              href="#try"
              className="tile flex min-h-[180px] flex-col justify-between gap-6 rounded-2xl bg-accent p-7 text-on-accent"
            >
              <h3 className="disp text-2xl font-bold leading-tight [text-wrap:balance]">
                Paste a link and watch it work.
              </h3>
              <span className="inline-flex items-center gap-2 text-[15px] font-bold">
                Try it now
                <span className="arr inline-flex">
                  <Icon name="arrowRight" />
                </span>
              </span>
            </a>
          </div>
        </section>

        <TrySection />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-7">
          <span className="disp text-lg font-bold">Clarify</span>
          <span className="text-sm text-muted">Save, organize, and cook from your favorite recipes.</span>
        </div>
      </footer>
    </>
  );
}
