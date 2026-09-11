# Sift frontend (test harness)

A minimal, dependency-free HTML/CSS/JS page for exercising the `sift_backend` API by hand: signup/login, recipe CRUD, importing a recipe from a URL, and account updates/deletion with the current-password checks.

## Run it

1. Start the backend first (from `sift_backend/`):
   ```
   npm run start:dev
   ```
   It should be listening on `http://localhost:3000`.

2. Serve this folder as static files on a port other than 3000 (the backend is already using that one). Any of these work:
   ```
   npx serve -l 5500 sift_frontend
   # or
   python -m http.server 5500 --directory sift_frontend
   ```
   Then open `http://localhost:5500`.

   Opening `index.html` directly via `file://` also works (the backend has CORS enabled for all origins), but a local static server is more reliable across browsers.

3. If the backend runs on a different host/port, edit `API_BASE` at the top of `app.js`.

## Notes

- The JWT is stored in `localStorage` under `sift_token`. Logging out just clears it.
- Ingredients/instructions are entered as dynamic rows that map directly to the API's `{name, quantity, unit, position}` / `{stepNumber, text}` shapes.
- "Import recipe from a URL" calls `POST /recipes/import`, which scrapes JSON-LD recipe data from the page and saves it directly — it only works on pages that publish `schema.org/Recipe` structured data.
- Updating or deleting your account requires your current password, matching the backend's re-auth checks.
