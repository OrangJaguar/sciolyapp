# scioly.app

Team-internal Science Olympiad ops + practice platform.

## Run locally

```bash
cp .env.example .env.local
# paste VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from Supabase → Project Settings → API

npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Without `.env.local`, the HUD shell still runs (Plan 01 preview). With keys, auth gates the app.

**Setup checklist:** [`docs/BEFORE_PLAN_03.md`](docs/BEFORE_PLAN_03.md)

**SQL:** wipe with `000_wipe_public_schema.sql` if needed → `20260803_initial.sql` → (fresh only) `20260804_addons.sql`. See [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

**Signup URL (after keys):** http://localhost:5173/login?mode=signup

## Stack

React + Vite + TypeScript · Tailwind · React Router · TanStack Query · Zustand · Supabase

## Plans

See [`plans/00-MASTER.md`](plans/00-MASTER.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local HUD |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
