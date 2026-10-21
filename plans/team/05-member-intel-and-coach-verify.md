# Plan 05 — Member intel drawer + light coach verification

**Track:** `plans/team`  
**Depends on:** Plan 04 (roster reliable)  
**Goal:** Coaches understand members without a click maze; optional coach verification for platform admin — **not** a launch blocker for create-team.

## Amendments after Plan 04

- Freelancer copy already gone — skip polish sweep unless leftovers appear.
- Prefer one RPC `team_member_intel(p_user_id)` (captain+) returning jsonb.
- Coach verify strip on **Profile** (when roster role is coach) + pending queue under `/admin/coaches`.
- Empty/solo roster on Comms: CTA pointing at Student/Coach invite codes (roster admin).

## A. Member intel drawer (Comms)

From roster row (coach/captain): open a **side drawer**.

| Block | Source |
|---|---|
| Identity | handle, display_name, school, role, division |
| Progression | xp → `formatRankHud`, streak, questions_answered |
| Events | coverage + status |
| Missions | active mission progress for user |
| Activity | last_activity_on; badge count |

Drawer actions (reuse Plan 04 RPCs): role, coverage cycle, remove.

## B. Light coach verification

**Not required to create a team.**

- Table `coach_verifications` + optional `teams.verified`
- RPCs: `request_coach_verification`, `admin_list_coach_verifications`, `admin_review_coach_verification`
- UI: Profile request form; Admin **Coaches** tab Approve/Reject

## Acceptance

- [x] Coach/captain can open member intel (XP/streak/events)
- [x] Role/coverage/remove from drawer
- [x] Coach can submit verification; admin can approve/reject
- [x] Unverified coaches not blocked
- [x] Build passes; migration documented

## Shipped

- `supabase/migrations/20261015_member_intel_coach_verify.sql`
- Member intel drawer from Comms roster (captain+)
- Profile coach verification request
- Admin `/admin/coaches` queue

## Apply

Run `supabase/migrations/20261015_member_intel_coach_verify.sql` in Supabase SQL editor.

## Track done when

Plans 01–05 complete for team/roster/onboarding recovery.
