# Plan 03 — Team join & create

**Track:** `plans/team`  
**Depends on:** Plans 01–02  
**DB:** `create_team`, `join_team_by_code` (exist); onboarding path from Plan 02

## Goal

Students can join with a code; someone starting a squad can create a team in-app and become coach. Practice-solo empty states across CMD share one clear join/create panel.

## Amendments after Plan 02

- Onboarding already has Start a team + Practice solo / Join — keep that path; wire it through `src/lib/teams.ts` and show **invite codes once** after create.
- CMD empty states (Missions / Vault / Comms / Leaderboard) become one `NoTeamPanel` (join **or** create), not four copy-pasted forms.
- Unify join validation to **6** chars; Student vs Coach invite copy everywhere (including Comms roster admin).
- SQL harden create/join so we never silently switch teams.

## Work items

### A. Create team (onboarding + post-onboarding)

- `src/lib/teams.ts`: `createTeam`, `joinTeamByCode`
- Onboarding + CMD: team name + school (default from `profile.school_name`)
- After create: show **student invite** + **coach invite** with copy buttons
- Guard: already on a team → friendly exception

### B. Join team

- Shared `JoinTeamCard` / `NoTeamPanel`
- Copy: student code vs coach invite code
- 6-char validation everywhere

### C. SQL harden (migration)

- `create_team`: if `profiles.team_id` set → raise
- `join_team_by_code`: same team → idempotent; other team → “Leave current team first”

### D. Empty team UX

- Comms roster: labels **Student invite** / **Coach invite** (not “Admin join”)

## Acceptance

- [x] Create team from onboarding + CMD works; codes shown after create
- [x] Join path works; no “freelancer” language
- [x] Shared no-team panel; 6-char validation
- [x] Cannot silently switch teams
- [x] Build passes; migration present

## Shipped

- `supabase/migrations/20261015_team_join_create_guards.sql`
- `src/lib/teams.ts` — create/join helpers
- `src/components/team/*` — JoinTeamCard, CreateTeamCard, NoTeamPanel, TeamInviteCodes
- CMD empty states → NoTeamPanel; Setup create → invite reveal; Comms Student/Coach invite labels

## Out of scope

- Verified-coach badge (Plan 05)
- Event assignment (Plan 04)
- Leaving team UI (unless trivial)
