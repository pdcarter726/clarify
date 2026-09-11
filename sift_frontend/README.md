# Sift frontend

A Next.js (App Router) + React + TypeScript + Tailwind CSS client for the Sift API in `../sift_backend`.

## Setup

```bash
npm install
cp .env.local.example .env.local   # optional; defaults to http://localhost:3000
npm run dev
```

The dev server runs on **http://localhost:3001** (the backend defaults to port 3000, so this avoids a clash).

Start the backend first (`../sift_backend`, `npm run start:dev`) so auth and recipe requests succeed.

## Structure

- `src/lib/api.ts` — typed fetch client for every backend endpoint (auth, users, recipes, tags, extraction).
- `src/lib/auth-context.tsx` — React context holding the current user and JWT (stored in `localStorage`), used by `ProtectedRoute`.
- `src/lib/scale.ts` — ingredient quantity scaling (1x/2x/3x/custom), including fraction parsing.
- `src/app/login` — combined login/signup + a guest "preview a recipe URL" panel (no account required).
- `src/app/recipes` — recipe list with tag filtering (AND across selected tags) and import-from-URL.
- `src/app/recipes/new`, `src/app/recipes/[id]` — create/edit recipe form (ingredients, instructions, tags).
- `src/app/account` — update email/password, delete account.

The previous static HTML/JS prototype is kept for reference in `legacy-static/`.

## Design

This is a functional baseline meant to be re-skinned from a Figma design — components are split so styling can be swapped without touching data-fetching logic.
