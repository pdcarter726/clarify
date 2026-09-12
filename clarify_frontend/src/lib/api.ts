const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "clarify_token";

export interface Tag {
  id: number;
  name: string;
}

/** A recipe ingredient line; `id`/`position` are absent on unsaved (client-built) entries. */
export interface Ingredient {
  id?: number;
  name: string;
  quantity?: string;
  unit?: string;
  position?: number;
}

/** A single numbered recipe step; `id` is absent on unsaved (client-built) entries. */
export interface Instruction {
  id?: number;
  stepNumber: number;
  text: string;
}

/** Full recipe record as returned by the backend, including nested ingredients/instructions/tags. */
export interface Recipe {
  id: number;
  userId: number;
  title: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  servings?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
  saturatedFatGrams?: number | null;
  transFatGrams?: number | null;
  cholesterolMg?: number | null;
  sodiumMg?: number | null;
  carbGrams?: number | null;
  fiberGrams?: number | null;
  sugarGrams?: number | null;
  vitaminDMcg?: number | null;
  calciumMg?: number | null;
  ironMg?: number | null;
  potassiumMg?: number | null;
  createdAt: string;
  updatedAt: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: Tag[];
}

/** Recipe data scraped from an external URL, prior to being saved as a real `Recipe`. */
export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  imageUrl?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
}

/** Payload shape for creating/updating a recipe; `tags` is a list of tag names, not ids. */
export interface RecipeInput {
  title: string;
  sourceUrl?: string;
  imageUrl?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients?: Ingredient[];
  instructions?: Instruction[];
  tags?: string[];
}

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.";

/** Validates a password against `PASSWORD_PATTERN`, returning a user-facing error string or null if valid. */
export function passwordError(password: string): string | null {
  return PASSWORD_PATTERN.test(password) ? null : `Password is too weak. ${PASSWORD_HINT}`;
}

/** Reads the access token from `localStorage`; returns null during SSR (no `window`) or if unset. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Persists the access token to `localStorage` under `clarify_token`. */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Removes the access token from `localStorage` (used on logout / 401). */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Thrown by `request()` for any non-OK response; carries the HTTP status code. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

/**
 * Core fetch wrapper used by every API namespace below: prefixes `path` with
 * `API_BASE`, attaches the bearer token from `localStorage` when `auth` is true,
 * clears the token and throws on a 401, and otherwise throws `ApiError` for
 * any non-OK response (using the backend's `message` field when present).
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.status === 401 && auth) {
    clearToken();
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  if (!res.ok) {
    const message = (data as { message?: string | string[] } | null)?.message;
    const text = Array.isArray(message) ? message.join(", ") : message;
    throw new ApiError(text || `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

/** `POST /auth/signup` and `POST /auth/login` — unauthenticated; both return `{ accessToken }`. */
export const authApi = {
  signup: (email: string, password: string) =>
    request<{ accessToken: string }>("/auth/signup", {
      method: "POST",
      auth: false,
      body: { email, password },
    }),
  login: (email: string, password: string) =>
    request<{ accessToken: string }>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    }),
};

/** Current-user endpoints under `/users/me`; `update`/`remove` require `currentPassword` to confirm the change. */
export const usersApi = {
  me: () => request<User>("/users/me"),
  update: (body: { email?: string; password?: string; currentPassword: string }) =>
    request<User>("/users/me", { method: "PATCH", body }),
  remove: (currentPassword: string) =>
    request<User>("/users/me", { method: "DELETE", body: { currentPassword } }),
};

/** CRUD plus import/nutrition for `/recipes`. All calls require auth (via `request`'s default). */
export const recipesApi = {
  /** `GET /recipes`, optionally filtered by tag names (`tags`) and/or a search string (`q`). */
  list: (tags?: string[], q?: string) => {
    const params = new URLSearchParams();
    if (tags && tags.length) params.set("tags", tags.join(","));
    if (q && q.trim()) params.set("q", q.trim());
    const query = params.toString();
    return request<Recipe[]>(`/recipes${query ? `?${query}` : ""}`);
  },
  get: (id: number) => request<Recipe>(`/recipes/${id}`),
  create: (body: RecipeInput) => request<Recipe>("/recipes", { method: "POST", body }),
  update: (id: number, body: Partial<RecipeInput>) =>
    request<Recipe>(`/recipes/${id}`, { method: "PATCH", body }),
  remove: (id: number) => request<Recipe>(`/recipes/${id}`, { method: "DELETE" }),
  /** `POST /recipes/import` — scrapes and saves a recipe from an external URL in one step. */
  importFromUrl: (url: string) =>
    request<Recipe>("/recipes/import", { method: "POST", body: { url } }),
  /** `POST /recipes/:id/nutrition` — triggers backend nutrition calculation and returns the updated recipe. */
  calculateNutrition: (id: number) =>
    request<Recipe>(`/recipes/${id}/nutrition`, { method: "POST" }),
};

/** CRUD for `/tags`, the user's reusable recipe tags. */
export const tagsApi = {
  list: () => request<Tag[]>("/tags"),
  create: (name: string) => request<Tag>("/tags", { method: "POST", body: { name } }),
  update: (id: number, name: string) =>
    request<Tag>(`/tags/${id}`, { method: "PATCH", body: { name } }),
  remove: (id: number) => request<Tag>(`/tags/${id}`, { method: "DELETE" }),
};

/** `POST /extraction` — unauthenticated dry-run scrape used to preview a recipe before importing/saving it. */
export const extractionApi = {
  preview: (url: string) =>
    request<ExtractedRecipe>("/extraction", { method: "POST", auth: false, body: { url } }),
};
