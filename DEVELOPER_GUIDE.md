# Clarify Developer Guide

Clarify is a recipe manager: sign up, save recipes by hand or import them from a URL, tag and filter them, scale ingredient quantities, and (optionally) see calorie/macro estimates.

This guide covers the project layout, how the two halves talk to each other, and the day-to-day commands you'll need. For step-by-step first-time setup, see the root [README.md](README.md).

## Architecture

```
clarify_backend/    NestJS + Prisma + PostgreSQL API (JWT auth, recipe CRUD, URL import, nutrition lookup)
clarify_frontend/   Next.js (App Router) + React + TypeScript + Tailwind client
clarifySetup.sql    Reference DDL for the PostgreSQL schema (Prisma migrations are the source of truth)
```

The backend and frontend are independent npm projects with their own `package.json`, run as separate processes:

- Backend listens on `http://localhost:3000`.
- Frontend dev server listens on `http://localhost:3001` and talks to the backend via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`), configured in `clarify_frontend/src/lib/api.ts`.

A dependency-free static prototype of the frontend (no build step, no npm install) lives in `clarify_frontend/legacy-static/` and is useful for quick manual API testing — see its own README.

## Backend (`clarify_backend/`)

Built with NestJS. Each feature is its own module under `src/`:

| Module | Base route | Responsibility |
|---|---|---|
| `auth` | `/auth` | Signup, login, JWT issuing, `GET /auth/me` |
| `users` | `/users` | `GET/PATCH/DELETE /users/me` (email, password, account deletion) |
| `recipes` | `/recipes` | Recipe CRUD, tag filtering, `POST /recipes/import`, `POST /recipes/:id/nutrition` |
| `tags` | `/tags` | Tag CRUD, attached to recipes via a join table |
| `extraction` | `/extraction` | Scrapes `schema.org/Recipe` JSON-LD from a URL (used by recipe import) |
| `nutrition` | — | Not a controller; called by `recipes` to fetch calorie/macro data from USDA FoodData Central |
| `prisma` | — | Wraps `PrismaClient` as an injectable `PrismaService` |
| `health` | `/healthz` | Unauthenticated uptime check; pings the database, returns 200 or 503 |

Auth is JWT-based (`@nestjs/jwt` + `passport-jwt`); protected routes use a guard that reads the bearer token and attaches the current user.

### Data model

Defined in `prisma/schema.prisma`, migrated with Prisma Migrate:

- `User` → many `Recipe`
- `Recipe` → many `Ingredient`, many `Instruction`, many-to-many `Tag` (via `RecipeTag`), plus optional nutrition fields covering a standard Nutrition Facts label: `calories`, `proteinGrams`, `fatGrams`, `saturatedFatGrams`, `transFatGrams`, `cholesterolMg`, `sodiumMg`, `carbGrams`, `fiberGrams`, `sugarGrams`, `vitaminDMcg`, `calciumMg`, `ironMg`, `potassiumMg` — all `null` until `POST /recipes/:id/nutrition` is called, and always set together as a batch
- Deleting a `User` or `Recipe` cascades to its dependents

`clarifySetup.sql` at the repo root shows the equivalent raw DDL for reference, but always run Prisma migrations rather than that file directly — it can drift from the schema.

### Environment variables (`clarify_backend/.env`, copy from `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:pw@localhost:5432/clarify?schema=public` |
| `JWT_SECRET` | Random secret used to sign auth tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `PORT` | API port (defaults to `3000`) |
| `USDA_FDC_API_KEY` | Optional, free key from [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup); without it `POST /recipes/:id/nutrition` returns 503 |

### Common commands

```bash
cd clarify_backend
npm install
npx prisma generate          # regenerate the Prisma client after a schema change
npx prisma migrate dev       # create + apply a new migration (dev)
npx prisma migrate deploy    # apply existing migrations (fresh environment)
npm run start:dev            # run with hot reload
npm run lint                 # eslint --fix
npm run format                # prettier --write
npm test                     # unit tests (jest)
npm run test:e2e             # end-to-end tests against a real Nest app instance
```

## Frontend (`clarify_frontend/`)

Next.js App Router project. Key files:

- `src/lib/api.ts` — typed fetch client for every backend endpoint; also owns the `clarify_token` localStorage key.
- `src/lib/auth-context.tsx` — React context holding the current user + JWT, consumed by `ProtectedRoute`.
- `src/lib/theme-context.tsx` — light/dark theme, persisted under the `clarify_theme` localStorage key.
- `src/lib/scale.ts` — ingredient quantity scaling (1x/2x/3x/custom), including fraction parsing.
- `src/app/login` — combined login/signup, plus a guest "preview a recipe URL" panel.
- `src/app/recipes` — recipe list with tag filtering and import-from-URL.
- `src/app/recipes/new`, `src/app/recipes/[id]` — create/edit recipe form.
- `src/app/account` — update email/password, delete account.
- `src/components/` — presentational pieces (forms, cards, nav, toasts) kept separate from data-fetching so the UI can be re-skinned without touching `lib/`.

### Common commands

```bash
cd clarify_frontend
npm install
cp .env.local.example .env.local   # optional; only needed if the backend isn't on localhost:3000
npm run dev     # http://localhost:3001
npm run build
npm run lint
```

## Working across both halves

1. Start PostgreSQL, then `clarify_backend` (`npm run start:dev`), then `clarify_frontend` (`npm run dev`).
2. Changes to `prisma/schema.prisma` need a migration (`npx prisma migrate dev`) and a client regen (`npx prisma generate`) before the backend picks them up.
3. New/changed backend routes should be reflected in `clarify_frontend/src/lib/api.ts` — it's the single place the frontend knows about the API shape.
4. The backend has CORS enabled for all origins, so the frontend (or the `legacy-static` prototype) can be served from any port during development.

## Testing

- Backend unit tests: `npm test` (Jest, colocated `*.spec.ts` files per module).
- Backend e2e tests: `npm run test:e2e` (`clarify_backend/test/*.e2e-spec.ts`), spins up a full Nest app via `test/utils/test-app.ts` against a real database — make sure `DATABASE_URL` points somewhere disposable before running these.
- No automated frontend tests currently exist; verify UI changes manually against a running backend.
