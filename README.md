# Clarify

A recipe manager: a NestJS + Prisma + PostgreSQL API (`clarify_backend/`) with JWT auth and recipe import from a URL, plus a Next.js frontend to use it (`clarify_frontend/`).

## Prerequisites

- Node.js and npm
- PostgreSQL server running locally

## 1. Start PostgreSQL

Make sure your PostgreSQL server is running. On Windows the installer registers a service named like `postgresql-x64-17`:

```
net start postgresql-x64-17
```

(Or start it however you normally do — Services app, Docker, etc. For example: `docker run -d --name clarify-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17`.)

## 2. Create the database

Connect with `psql` (or pgAdmin) and create an empty database:

```sql
CREATE DATABASE clarify;
```

## 3. Configure the backend

```
cd clarify_backend
```

Copy the example env file and fill in your real values:

```
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — your PostgreSQL connection string, e.g. `postgresql://postgres:yourpassword@localhost:5432/clarify?schema=public` (URL-encode any special characters in the password)
- `JWT_SECRET` — a random secret. Generate one with:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `JWT_EXPIRES_IN` — leave as `1d` unless you want a different token lifetime

## 4. Install dependencies and set up the schema

Still inside `clarify_backend/`:

```
npm install
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` creates all the tables (users, recipes, ingredients, instructions, tags) in the empty database from step 2.

## 5. Run the backend

```
npm run start:dev
```

The API is now listening on `http://localhost:3000`.

(Optional, run any time) verify it's fully wired up:

```
npm test
npm run test:e2e
```

## 6. Run the frontend

In a new terminal, from the project root:

```
cd clarify_frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:3001` (the backend defaults to port 3000). See `clarify_frontend/README.md` for details. A dependency-free static prototype is also kept in `clarify_frontend/legacy-static/` for quick manual testing without Node — see `clarify_frontend/legacy-static/README.md`.

Open `http://localhost:3001` in your browser.

## 7. Use it

Sign up with any email and an 8+ character password, then create, edit, or import recipes from a URL. See `clarify_frontend/README.md` for more detail on what the app does.

## Quick reference

```bash
# one-time setup
cd clarify_backend
cp .env.example .env        # then edit DATABASE_URL / JWT_SECRET
npm install
npx prisma generate
npx prisma migrate deploy

# every time you want to run it
cd clarify_backend && npm run start:dev    # terminal 1
cd clarify_frontend && npm run dev         # terminal 2
```

## More

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for architecture, the data model, environment variables, and common commands for both projects.
