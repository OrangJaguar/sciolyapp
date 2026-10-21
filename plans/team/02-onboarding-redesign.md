# Plan 02 — Onboarding redesign (copy, UI, light fields)

**Track:** `plans/team`  
**Depends on:** Plan 01  
**Specs / refs:** Current `SetupPage.tsx`; extend `complete_onboarding` + `profiles`

## Goal

A calm, clear setup that collects a bit more useful info without feeling like a tax form. Kill confusing “Freelancer” / “Deploy Profile” jargon. Fix awkward button sizing and ambiguous labels.

## Amendments after Plan 01

- Keep Plan 01 profileStatus gates on SetupPage.
- Ship **4 steps**: handle → name+division → school → path (solo / join / **start team**).
- Start team: call existing `create_team` after successful `complete_onboarding` (Plan 03 hardens switch rules + shared join cards).
- Also replace remaining “Freelancer” labels on Profile + CMD empty states with “Practice solo” / “No team yet” (small, same language).

## Fields

| Step | Collect |
|---|---|
| 1 | Handle |
| 2 | Preferred name + Division B/C |
| 3 | School |
| 4 | Practice solo / Join with code / Start a team |

Timezone: `clientTimezone()` on complete (no extra step).

## SQL

- `profiles.display_name`, `profiles.school_name`
- `complete_onboarding` gains `p_display_name`, `p_school_name`, `p_timezone`
- Join code validated **before** `onboarding_complete = true` (transactional)

## Acceptance

- [x] No “Freelancer” in onboarding (or CMD empty labels)
- [x] Preferred name + school persisted
- [x] Failed join code does not mark onboarding complete
- [x] Timezone saved when possible
- [x] Build passes; migration file present

## Shipped

- `supabase/migrations/20261015_onboarding_profile_fields.sql`
- `src/pages/auth/SetupPage.tsx` — 4 steps + Practice solo / Join / Start a team
- `src/lib/types.ts` — `display_name`, `school_name`
- Profile identity edit + CMD “No team yet” / “Practice solo” copy
