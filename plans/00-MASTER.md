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

**Shape rule:** Follow mockups (pill nav, rounded modules ~12–24px). Ignore DESIGN.md “0px radius” — screenshots win.

**Shared chrome (every authenticated screen):**
1. Top bar: `Rank: {TITLE}` · striped XP bar · XP total · CMD/OPS toggle · radar icon
2. Bottom nav (CMD only): MISSIONS · VAULT · COMMS · LEADERBOARD
3. Active = solid cyan fill, black text, soft cyan glow

## Route map
```
/setup                          Auth onboarding (Plan 02)
/cmd/missions                   CMD Missions (mockup 1)
/cmd/vault                      CMD Vault (mockup 2)
/cmd/comms                      CMD Comms (mockup 3)
/cmd/leaderboard                CMD Leaderboard (mockup 4)
/cmd/roster                     War Room (Plan 12, no mockup yet)
/ops                            OPS hub 3-card (mockup 5)
/ops/casual                     Lobby → Arena (mockup 6 layout + cyan HUD)
/ops/timed                      Timed config / exam / autopsy
/ops/binder                     Binder (Plan 15, deferred)
/profile                        Profile + XP
/admin                          Admin factory (platform_role=admin)
```

## Mockup → screen
| File | Screen |
|---|---|
| `docs/mockups/missions.png` | `/cmd/missions` |
| `docs/mockups/vault.png` | `/cmd/vault` |
| `docs/mockups/comms.png` | `/cmd/comms` |
| `docs/mockups/leaderboard.png` | `/cmd/leaderboard` |
| `docs/mockups/ops-hub.png` | `/ops` |
| `docs/mockups/quiz-ref.png` | Arena/Timed layout reference (restyle to cyan HUD) |

## Build order (execute one at a time)
| # | Plan file | Status |
|---|---|---|
| 00 | `00-MASTER.md` | living index |
| 01 | `01-scaffold-shell.md` | done |
| 02 | `02-supabase-schema-auth.md` | pending |
| 03 | `03-ops-hub.md` | pending |
| 04 | `04-casual-lobby-arena.md` | pending |
| 05 | `05-serving-session-commit.md` | pending |
| 06 | `06-clinic.md` | pending |
| 07 | `07-timed-practice.md` | pending |
| 08 | `08-cmd-missions.md` | pending |
| 09 | `09-cmd-vault.md` | pending |
| 10 | `10-cmd-comms.md` | pending |
| 11 | `11-cmd-leaderboard.md` | pending |
| 12 | `12-cmd-roster.md` | pending |
| 13 | `13-profile-xp.md` | pending |
| 14 | `14-admin-factory.md` | pending |
| 15 | `15-binder.md` | deferred |

**Process:** Expand each plan fully only when about to build it. Commit after each. Do not rewrite later plans in advance.

## Infra timing
| When | What |
|---|---|
| With 01 | GitHub push (private ok) |
| With 02 | Supabase project + `.env.local` |
| After 02 local auth works | Vercel project + env vars |
| With 14 | NVIDIA NIM API key |

## Explicitly out of scope (team MVP)
Landing/marketing, public discovery, Vault file uploads, Binder Vision Audit until 15, drag-drop roster until 12.

## How to run a plan in Cursor
1. Open the plan file for the next number.
2. Prompt: `Execute plans/0N-….md against the current repo. Do not start 0N+1.`
3. Click through acceptance checklist.
4. Commit. Update this table’s Status column.
