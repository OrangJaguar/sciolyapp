# Team · Roster · Onboarding — Master index

**Goal:** Fix onboarding (including the “skipped setup / wrong HUD” bug), make joining/creating a team clear, restore roster admin against the live DB, and give coaches a usable member view — without bombarding students with forms.

Progression track is **done** (plans removed). Live checklist kept at `docs/recovery_help/progression_VERIFY.md`.

---

## Product decisions (locked for this track)

| Topic | Decision |
|---|---|
| **Friend bug** | Auth treated `profile === null` as “ok to enter app,” so setup could be skipped and shell HUD looked wrong/stale. Fix: wait for profile; never enter CMD/OPS until onboarding is known complete. |
| **“Freelancer”** | Kill the word. Use **Practice solo** (no team yet). |
| **Join codes** | Student code → member. Coach invite code → coach. Label them clearly in UI. |
| **Create team** | Allowed in-app via existing `create_team` RPC (caller becomes coach). Collect team name + school. Soft anti-abuse later; not KYC-blocked for launch. |
| **Coach verification** | **Light, not blocking.** Optional “Request coach verification” → row for platform admin approve/reject. Creating a team still works without it. Avoids “anyone with a code is forever trusted” without freezing launch. |
| **Member intel** | **Drawer/sheet from Comms roster** (not a separate deep link maze). Coach/captain sees progress, assignments + readiness, light activity. |
| **Event coverage** | Wire UI to `set_event_coverage` with `assigned` / `training` / `ready` (and clear). Stop calling missing `assign_team_event` RPCs. |
| **Onboarding fields** | Handle, division, preferred name, school, path (solo / join / create). Timezone auto. No grade/essay walls. |

---

## Build order

| Plan | Name | Outcome |
|---|---|---|
| **01** | Auth profile gate | Friend bug gone; onboarding cannot be skipped |
| **02** | Onboarding redesign | Clear copy, nicer UI, richer-but-light fields + SQL |
| **03** | Team join & create | Solo / join code / create team end-to-end |
| **04** | Roster RPCs + coverage | Role/remove/coverage work vs live DB; readiness in UI |
| **05** | Member intel + coach verify | Drawer for coaches; light admin verification queue |

**How to use:** `build plan 01` → check-in → adjust next → continue.

---

## Out of scope

- DeepSeek / question factory → **see `plans/generate/`**
- Landing page redesign
- Flashcards
- Full public user profiles / social graph
- Heavy coach identity KYC (IDs, email domain proofs)

---

## Depends on live DB

Team track migrations (apply any not yet run):

- `20261015_onboarding_profile_fields.sql`
- `20261015_team_join_create_guards.sql`
- `20261015_roster_admin.sql`
- `20261015_member_intel_coach_verify.sql`
