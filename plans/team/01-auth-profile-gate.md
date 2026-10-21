# Plan 01 — Auth profile gate (friend bug)

**Track:** `plans/team`  
**Depends on:** nothing  
**Why first:** If onboarding can be skipped, every later team UI is unreliable.

## Goal

No authenticated user enters CMD/OPS/admin until we have loaded their profile **and** know `onboarding_complete`. Fix the race that let a friend’s session skip setup and show a confusing HUD.

## Root cause (current)

- `RequireOnboarding` / `RedirectIfAuthed` only redirect when `profile && !onboarding_complete`
- If `profile === null` (still loading or fetch failed), guards allow the shell
- `AuthProvider` sets `ready=true` after session, not after profile
- OAuth `redirectTo` lands on `/cmd/missions`, relying on broken gates
- Shell can render `profileToHud(null)` guest-like HUD or stale state

## Work items

### A. `AuthProvider`

- Add `profileLoading: boolean` (or fold into `ready` meaning “session + profile settled”)
- Recommended API:
  - `ready` — auth client initialized
  - `profileStatus: 'loading' | 'ready' | 'missing'`
- On session present: keep `profileStatus === 'loading'` until `fetchProfile` resolves (success or definitive null)
- On `onAuthStateChange`: set loading while refetching profile for new user id
- Never leave `profile` from a **previous** user id when session user changes (clear profile immediately on uid change)

### B. Route guards

- `RequireAuth`: unchanged (session)
- `RequireOnboarding`:
  - If profile still loading → Loading screen
  - If profile missing after load → soft error + retry / sign out (do not open shell)
  - If `!onboarding_complete` → `/setup`
- `RedirectIfAuthed`:
  - Wait for profile when session exists
  - Incomplete → `/setup`
  - Complete → `/cmd/missions`
- `RequireAdmin`: wait for profile before checking `platform_role`

### C. Login / OAuth

- Prefer `redirectTo: ${origin}/setup` (or `/` that re-routes). Setup page already bounces completed users to missions.
- After email/password signup with immediate session, navigate via guards (or explicit `/setup`)

### D. SetupPage

- If profile loading → Loading
- If complete → missions
- If session but profile missing → retry fetch UI

### E. Manual repro checklist

1. New account (or clear onboarding in SQL) → always land on setup, never missions first  
2. Slow network throttle → loading, not missions with wrong XP  
3. Sign out / sign in as different user → HUD matches second user only  

## Acceptance

- [x] Incomplete users cannot open AppShell routes
- [x] Profile load in progress shows Loading, not guest/wrong HUD
- [x] OAuth path cannot skip setup
- [x] Build passes

**Built:** 2026-10-14 — `profileStatus` gate + OAuth → `/setup`. Manual: new account / throttle / switch user.

## Out of scope

- Onboarding field redesign (Plan 02)
- Team create UI (Plan 03)
