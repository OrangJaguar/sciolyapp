# Plan 01 — Scaffold Shell

## Goal
Stand up a Vite + React + TypeScript app with Tailwind, design tokens, shared AppShell chrome, and all primary routes rendering **mock-data placeholders** that match the Stitch HUD layout language.

After this plan: open localhost and it should *look* like scioly.app (hollow, clickable, no backend).

## Out of scope
Supabase, auth, real data, question serving, admin NIM, binder logic, pixel-perfect page interiors (those are Plans 03–15). Shell chrome + page frames only.

## UI references
- Shared header + CMD/OPS toggle: all CMD mockups
- Bottom nav: `docs/mockups/missions.png` (and siblings)
- OPS body: `docs/mockups/ops-hub.png` (placeholder cards ok)
- Colors/type: `plans/00-MASTER.md` + `DESIGN.md` (shapes follow mockups)

## Acceptance checklist
- [x] `npm run dev` starts without errors
- [x] Void background `#050505`, cyan `#00f0ff`, Space Grotesk + JetBrains Mono loaded
- [x] Top bar: Rank, striped XP bar, XP value, CMD/OPS toggle, radar icon
- [x] CMD/OPS toggle switches routes (`/cmd/*` ↔ `/ops`)
- [x] CMD bottom nav: MISSIONS / VAULT / COMMS / LEADERBOARD — active state solid cyan
- [x] Each CMD route shows a labeled placeholder layout approximating its mockup structure
- [x] `/ops` shows three tall cards: Binder Planner / Casual Mode / Timed Practice
- [x] No Supabase calls; all numbers from `src/mocks/demoUser.ts`
- [x] README has run instructions

## Status
**DONE** — scaffold executed. Do not start Plan 02 until chrome QA is signed off.

## Implementation

### 1. Scaffold
```bash
npm create vite@latest . -- --template react-ts
# then add: tailwind, react-router-dom, zustand
```
Keep existing `plans/`, `docs/`, `DESIGN.md`, `sciolyappPRD.pdf`, `README.md`.

### 2. Design tokens
- CSS variables in `src/styles/tokens.css`
- Tailwind theme maps to those variables
- Utility classes: `.hud-panel`, `.hud-pill`, `.hud-pill-active`, `.stripe-progress`

### 3. App structure
```
src/
  main.tsx
  App.tsx                    # BrowserRouter + routes
  styles/tokens.css
  styles/index.css
  mocks/demoUser.ts
  store/uiStore.ts           # mode: 'cmd' | 'ops' (optional; URL can be source of truth)
  components/shell/
    AppShell.tsx
    TopBar.tsx
    CmdOpsToggle.tsx
    XpBar.tsx
    BottomNav.tsx
    RadarIcon.tsx
  pages/cmd/
    MissionsPage.tsx
    VaultPage.tsx
    CommsPage.tsx
    LeaderboardPage.tsx
  pages/ops/
    OpsHubPage.tsx
  pages/placeholders/
    ProfilePage.tsx
    AdminPage.tsx
```

### 4. Routes
| Path | Page |
|---|---|
| `/` | redirect → `/cmd/missions` |
| `/cmd/missions` | MissionsPage |
| `/cmd/vault` | VaultPage |
| `/cmd/comms` | CommsPage |
| `/cmd/leaderboard` | LeaderboardPage |
| `/ops` | OpsHubPage |
| `/profile` | stub |
| `/admin` | stub |

### 5. Mock data
```ts
export const demoUser = {
  handle: 'operative_alpha',
  rankTitle: 'SPECIALIST',
  xp: 135_000,
  xpProgress: 0.71, // toward next level
  unit: 'NORTH HIGH',
  squad: 'VARSITY',
}
```

### 6. Page placeholder fidelity (minimum)
- **Missions:** left sidebar (unit/squad + upcoming list) + main area (meeting/comp cards + targeted practice block)
- **Vault:** search + folder list + active loadout column
- **Comms:** squad roster sidebar + pinned + stream
- **Leaderboard:** metric/event/time filters + ranked rows
- **OPS hub:** three equal vertical cards

Use static fake strings. No interactivity beyond navigation and toggle.

## Done when
You can click every bottom-nav item and CMD↔OPS and the chrome never breaks. Then commit and stop — do not start Plan 02.
