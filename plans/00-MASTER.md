# scioly.app — Master Build Index

## Product
Team-internal Science Olympiad ops + practice platform. CMD = team logistics. OPS = personal grind. No landing page. No user-facing AI. NVIDIA NIM is admin-batch only.

## Stack (locked)
| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS v4 + custom HUD primitives |
| Client state | Zustand |
| Server state | TanStack Query v5 |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Hosting | Vercel (static SPA) |
| AI | NVIDIA NIM via Edge Functions (admin only) |

Do **not** introduce Next.js.

## Visual system
**Primary reference = Stitch mockups in `/docs/mockups/`.**  
Secondary = `DESIGN.md` + PRD (`sciolyappPRD.pdf`).

| Token | Value |
|---|---|
| Void bg | `#050505` |
| Surface | `#111111` / `#1a1a1a` |
| Cyan | `#00f0ff` |
| Alert red | `#ff2a2a` |
| Success | `#00ff66` |
| Muted text | `#888888` |
| Display font | Space Grotesk |
| Data font | JetBrains Mono |

**Shape rule:** Follow mockups (pill nav, rounded modules ~12–24px). Screenshots win over DESIGN.md radius notes.

**Shared chrome:** Rank · striped XP · CMD/OPS toggle · radar · CMD bottom nav · copyright footer.

## Route map
```
/login /setup
/cmd/missions /cmd/vault /cmd/comms /cmd/leaderboard
/ops  /ops/casual  /ops/timed  /ops/binder
/profile  /admin/catalog|/generate|/review|/import
```

Roster management is on **Comms** (EDIT modal), not a separate `/cmd/roster` route.

## Product locks (Aug 2026)

### Ranks + XP (lock early — Plan 03)
- Level band = **100 XP** → `level = floor(xp/100)+1`
- Titles (derived, not free-typed long-term):

| Levels | Title |
|---|---|
| 1–5 | Recruit Level {n} |
| 6–10 | Specialist |
| 11–20 | Tactician |
| 21–35 | Master |
| 36+ | National Legend |

- **XP awards (starting numbers — tune later, don’t invent mid-feature):**

| Action | XP |
|---|---|
| Casual correct | +10 |
| Casual incorrect | +2 (attempt credit) |
| Clinic DO completed | +5 |
| Timed correct | +12 |
| Timed incorrect | +2 |
| Mission complete bonus | +50 |

Streak: +1 day if any graded activity that calendar day; break after missed day. Streak does **not** multiply XP in MVP (keeps math honest).

### Badges (lite — Plan 20, not a parallel economy)
- **Yes, keep a thin badge system** — profile + leaderboard flair only.
- **No** badge XP, no badge shop, no 40-badge checklist for MVP.
- Ship ~8 milestones: First Blood (1 correct), Week Streak (7), Event Specialist (50 correct in one event), Clinic Graduate (5 Clinic clears), Timed Survivor (finish a timed set), Mission Runner (3 missions), Team Anchor (join team), Centurion (100 correct total).
- Storage: `user_badges(user_id, badge_id, earned_at)` + static catalog in code.

### Admin Factory (Plans 22–25) — locked IA
Four admin pages under `/admin/*` (platform_role=admin only):

| Tab | Plan | Job |
|---|---|---|
| **Catalog** | 22 | Taxonomy, Clinic guides, **prompt packs in DB**, event media stubs |
| **Generate** | 23 | Job planner + NIM worker (~2s throttle / ~40 RPM), drafts out |
| **Review** | 24 | Keyboard/bulk review cockpit (upgrades Plan 21 stub) |
| **Import** | 25 | Raw test + CSV/JSON → drafts; Storage media library |

**Prompts:** never hardcode in app source for production use. `prompt_packs` in DB = master + per-event (+ optional topic). Edited on **Catalog** (Guides / Prompts / Media subviews) — not a 5th top-level tab.

**NIM key:** only required starting **Plan 23**. Catalog/Review/Import work without it.

### OPS hub UX (Plan 05)
- **Keep the 3-column architecture** (matches Stitch). Don’t invent a new IA.
- Elevate each card: **top ~55%** distinct HUD visual (SVG/atmosphere per mode), **bottom** title + 2–3 one-line bullets + clear enter affordance. Not empty rectangles; not stock photo collage.

### Test questions (Plan 04)
- **Not** 1× every concept (245 is waste for testing).
- Seed **~24 live MCQs**: 2 per topic × 6 topics for **chem_lab only** first (12), plus 6 anatomy + 6 water_quality (1 per topic) = **24**. Enough to exercise lobby → serve → weakness → clinic. Expand via Admin/NIM later.

### NIM models (Plan 23+)
| Job | Model |
|---|---|
| Bulk MCQ / explanations | DeepSeek V4 **Flash** (cheap, volume) |
| Harder items / calc QA pass | DeepSeek V4 **Pro** (quality) |
| Diagram Q stems / Binder Vision Audit | One **vision** NIM model (pick at Plan 27; e.g. a current NVIDIA vision endpoint) |

No user-facing chat model.

---

## Build order — one Cursor session each

**How to run:** open the plan file → `Execute plans/NN-….md against the current repo. Do not start NN+1.` → checklist → commit.

| # | File | Status | What one session produces |
|---|---|---|---|
| 00 | `00-MASTER.md` | living | Locks + this index |
| 01 | `01-scaffold-shell.md` | **done** | Vite shell, HUD chrome, hollow routes |
| 02 | `02-supabase-schema-auth.md` | **code done** | Schema spine, auth, `/setup` |
| 02c | `02c-aug3-migration.md` | **run SQL** | Event→Topic→Concept seed migration |
| 03 | `03-progression-lock.md` | **done** | Codify ranks/XP/streak constants + shared helpers; profile displays derived rank |
| 04 | `04-seed-test-questions.md` | **SQL ready — you run** | SQL seed ~24 `live` MCQs tagged to real concepts |
| 05 | `05-ops-hub.md` | **done** | Elevated 3-card OPS home (visual + bullets) |
| 06 | `06-casual-lobby.md` | **done** | Event/topic lobby; studyable gating; start session |
| 07 | `07-arena-ui.md` | **done** | Arena quiz HUD (layout, keys, progress) on real/fetched Qs |
| 08 | `08-serving-engine.md` | **done** | Next-question picker: weakness + reinjection + coverage |
| 09 | `09-session-commit.md` | **SQL ready — you run** | `submit_casual_session` RPC; history; XP write; weakness update |
| 10 | `10-clinic-interrupt.md` | **done** | 3-wrong interrupt; READ/SEE/DO UI shell |
| 11 | `11-clinic-content.md` | **SQL ready — you run** | Minimal `concept_guides` for seeded concepts + wire Clinic |
| 12 | `12-timed-config.md` | **done** | Timed setup (event, length, constraints) |
| 13 | `13-timed-exam.md` | **done** | Black Box exam + localStorage crash protect |
| 14 | `14-timed-autopsy.md` | **SQL ready — you run** | Post-run autopsy + commit/XP |
| 15 | `15-cmd-missions.md` | **done** | Missions page live vs `team_missions` |
| 16 | `16-cmd-vault.md` | **done** | Vault explorer + Active Loadout (links/meta; no file upload) |
| 17 | `17-cmd-comms.md` | **done** | Roster rail + pinned/stream posts |
| 18 | `18-cmd-leaderboard.md` | **done** | Filters + ranked list from real XP/stats |
| 19 | `19-cmd-roster.md` | **code done — run SQL** | Comms roster admin (no separate Roster page) |
| 20 | `20-profile-badges.md` | **code done — run SQL** | Profile + 8 lite badges (SVG marks; sync RPC) |
| 21 | `21-admin-review-queue.md` | **code done — run SQL** | Thin review stub (superseded UX by Plan 24) |
| 22 | `22-admin-catalog-prompts.md` | **code done — run SQL** | Admin shell + Catalog (guides, prompt packs DB, media stubs) |
| 23 | `23-admin-generate-engine.md` | pending | NIM job planner + throttled worker → drafts |
| 24 | `24-admin-review-factory.md` | pending | Keyboard/bulk Review Factory |
| 25 | `25-admin-import-media.md` | pending | Raw/CSV import + Storage media library |
| 26 | `26-binder-genesis.md` | deferred | Binder planner half |
| 27 | `27-binder-vision.md` | deferred | Vision Audit half (needs vision NIM) |

Admin Factory (22–25) is the hard content track after CMD/OPS. Binder stays deferred.

---

## Manual gates (you do these — not Cursor)

Do **between** plans when listed. Skip until the gate says so.

| After | You do |
|---|---|
| **02 / 02c** | Run wipe if needed → run `20260803_initial.sql` (must show `SCIOLY-0803C-NO-SEMI`) → Auth: Confirm email OFF → Site URL + redirect `localhost:5173` → `.env.local` filled → signup → setup → Missions works |
| **04** (optional) | Spot-check Table Editor: `questions` status=`live`, concept_ids match |
| **09** (first real grind) | Play 1 Casual session end-to-end; confirm XP + weakness rows |
| **14** (OPS complete) | Push GitHub if not already → create **Vercel** project → env `VITE_SUPABASE_*` → deploy preview |
| **19** | Run `20260804_roster.sql` (`SCIOLY-0804-ROSTER`) if not already |
| **20** | Run `20260804_badges.sql` (`SCIOLY-0804-BADGES`) — then open Profile |
| **21** | Run `20260804_admin.sql` (`SCIOLY-0804-ADMIN`) → `UPDATE profiles SET platform_role='admin' WHERE handle='…'` → `/admin` |
| **22** | Run `20260805_admin_catalog.sql` (`SCIOLY-0805-ADMIN-CATALOG`) as postgres → test Catalog |
| **After 22** | In Catalog UI: paste **master** prompt + **event packs** (chem_lab first). No NIM key yet |
| **Before 23** | NVIDIA NIM API key → Edge Function secrets; confirm Flash + Pro model IDs |
| **Before 27** | Vision NIM model ID + secret (binder only) |
| **Google auth** | Anytime after local email works — OAuth client IDs in Supabase |

**NIM key timing:** not needed for Plan 22 (Catalog/prompts), 24 (Review), or 25 (Import parse). **Required only before Plan 23 (Generate).**

---

## Explicitly out of scope (team MVP)
Landing/marketing, public discovery, Vault binary uploads, user-facing AI chat, badge economy / XP multipliers, Division B, full 245×N question bank by hand.

## Process
1. Expand the next plan file fully only when about to build it (stub → full checklist).
2. One plan per Cursor run. Commit after each.
3. Update Status column here when done.
