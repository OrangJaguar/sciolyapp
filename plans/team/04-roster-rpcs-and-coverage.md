# Plan 04 — Roster RPCs + event coverage

**Track:** `plans/team`  
**Depends on:** Plan 03 (team exists to manage)  
**Critical:** Comms roster admin UI is largely **broken** against current `schema.sql`.

## Goal

Captains/coaches can change roles, remove members, and set event coverage including readiness — matching live DB (`set_event_coverage` + new role/remove RPCs).

## Amendments after Plan 03

- Join code labels already say Student / Coach invite — keep them.
- Wire coverage UI to **`set_event_coverage`** statuses: `assigned` → `training` → `ready` → `off` (cycle on chip).
- Enforce max **2 people per event** in SQL inside `set_event_coverage` (UI already gates).
- Roster list shows `display_name` when present (Plan 02).

## Gap today

| UI calls | In live schema |
|---|---|
| `assign_team_event` | **Missing** → `set_event_coverage(..., 'assigned')` |
| `unassign_team_event` | **Missing** → `set_event_coverage(..., 'off')` |
| `set_team_member_role` | **Missing** → add |
| `remove_team_member` | **Missing** → add |

## Work items

### A. Migration SQL

`supabase/migrations/20261015_roster_admin.sql`:

1. **`set_team_member_role(p_user_id, p_role)`** — captain+; only coach can grant coach; protect last coach
2. **`remove_team_member(p_user_id)`** — captain+; not self; clear roster + `profiles.team_id` + coverage
3. Harden **`set_event_coverage`** with max-2 partners per event

### B. `src/lib/comms.ts`

- Coverage fetch includes `status`; set via `set_event_coverage`
- Role/remove call new RPCs
- Drop missing assign/unassign RPCs

### C. Comms roster UI

- Chips cycle Assigned → Training → Ready → Off
- display_name under @handle; clearer role labels
- Surface RPC errors

## Acceptance

- [x] Assign/training/ready/clear works on live DB
- [x] Role change + remove work
- [x] No calls to missing `assign_team_event` / `unassign_team_event`
- [x] Migration present (run in Supabase SQL editor)
- [x] Build passes

## Shipped

- `supabase/migrations/20261015_roster_admin.sql`
- `src/lib/comms.ts` — coverage status + set_event_coverage; role/remove RPCs
- Comms roster: display_name, chip cycle Assigned→Training→Ready→Off

## Out of scope

- Full member analytics drawer (Plan 05)
- Missions redesign

## Apply

Run `supabase/migrations/20261015_roster_admin.sql` in the Supabase SQL editor after this ships.
