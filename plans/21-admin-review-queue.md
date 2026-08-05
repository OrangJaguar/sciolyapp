# Plan 21 — Admin Review Queue

## Goal
`/admin` for `platform_role=admin`: list draft questions; Edit / Publish / Reject.

## Product notes (locked this session)
- Gate on `profiles.platform_role === 'admin'` (not team coach)
- **Schedule** = **Publish now** → `live` (no `scheduled_at` column yet)
- **Reject** → `archived`
- **Save** keeps `draft`
- No NIM UI (Plan 22). Sample drafts seeded so the queue isn’t empty.
- Harden: users cannot self-UPDATE `platform_role` via client

## Build
- SQL: `is_platform_admin`, UPDATE grant + policy, profile role lock, 3 draft seeds
- `RequireAdmin` route guard
- `src/lib/adminQuestions.ts` + Admin Factory page (list + editor)

## Out of scope
NIM generate, INSERT drafts in-app, real datetime scheduling, diagram/calc editors.

## Acceptance
- [x] Non-admin redirected from `/admin`
- [x] Publish sets `live` (Casual can serve it)
- [x] Reject → `archived`; Edit saves draft fields

## Manual
1. Run `20260804_admin.sql` (`SCIOLY-0804-ADMIN`) — **Role: postgres**
2. Promote yourself once:
   ```sql
   UPDATE public.profiles SET platform_role = 'admin' WHERE handle = 'YOUR_HANDLE';
   ```
3. Open `/admin` → edit a draft → Publish → confirm it leaves the queue

## Status
**code done** — run SQL + set admin role above.

## Follow-on
Plan 21 UI is a **thin stub**. Plan 24 (Review Factory) replaces it with keyboard/bulk tooling. Plans 22–25 are the full Admin Factory.
