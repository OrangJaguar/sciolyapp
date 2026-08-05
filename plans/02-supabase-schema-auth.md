# Plan 02 — Supabase Schema + Auth + Setup

## Goal
Connect the Vite shell to Supabase: full core schema + RLS, email/password (+ Google-ready) auth, `/login`, `/setup` wizard, and route guards so unauthenticated users cannot reach CMD/OPS.

## Out of scope
Real missions/vault/comms data wiring (still mock UI), question serving, admin NIM, Vercel deploy, NVIDIA keys.

## You (manual) before/during this plan
1. Supabase project created (East US / Americas).
2. Security: Data API **on**, auto-expose tables **off**, automatic RLS **on**.
3. Copy from **Project Settings → API** into `.env.local`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. In Supabase SQL Editor: paste & run `supabase/migrations/20260731_initial.sql`.
5. Auth → Providers: Email enabled. Google optional (add Client ID/Secret later).
6. Auth → URL config: Site URL `http://localhost:5173`, redirect `http://localhost:5173/**`.

## Acceptance checklist
- [x] `.env.example` documents required vars; `.env.local` gitignored
- [x] Migration SQL creates enums, tables, RLS, profile trigger, join/create team RPCs
- [x] Unauthed visit to `/cmd/*` redirects to `/login` (when env configured)
- [x] Email signup → lands on `/setup` (handle, division, join/freelancer)
- [x] Completing setup sets `onboarding_complete` and routes to `/cmd/missions`
- [x] TopBar Rank/XP reads from `profiles` when logged in
- [x] `npm run build` passes
- [x] App does not crash if env missing (shows config error on login / shell preview)

## Status
**CODE DONE** — you still must: paste SQL in Supabase, add `.env.local`, tune Auth URL settings. Do not start Plan 03 until login → setup → missions works end-to-end.