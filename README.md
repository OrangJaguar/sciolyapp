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

Without `.env.local`, the HUD shell still runs. With keys, auth gates the app.

**Supabase:** [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)

**Signup URL (after keys):** http://localhost:5173/login?mode=signup

## Stack

React + Vite + TypeScript · Tailwind · React Router · TanStack Query · Zustand · Supabase

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local HUD |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
