# Product UI — Master index

**Goal:** Make Casual + Timed feel like a place you can sit in for hours — calm, open, keyboard-friendly — without AI-slop chrome. Fix shell/OPS polish and a few real bugs (missions empty state, badge sync noise, duplicate badge icons). Landing page + legal are **out of scope** (separate track later).

**Depends on:** Generate + team tracks (done / deployable). This track is frontend-heavy; SQL only if a bug truly needs it.

---

## Product decisions (locked)

| Topic | Decision |
|---|---|
| **Layout** | Practice surfaces are **open on the theme background** — no harsh full-viewport box/card wrapping the whole exam. Soft chrome only (top bar tools, bottom nav). Inspiration: dark focus UIs; keep **our** theme tokens (`hud` / `sleek` / `paper`). |
| **Shared chrome** | One practice shell component used by Casual + Timed: Q# (left), timer controls (right), Back/Next (bottom), `?` shortcuts (bottom-left). Mode-specific behavior plugs in. |
| **Casual progress** | Session has a known queue (`ARENA_SESSION_CAP`, today 10). Show **`Q n / N`** + bar = **checked answers / N**. Navigator starts at `{1}` and **grows** as they reach new questions; green/red by graded result. |
| **Timed progress** | **`Q n / N`** + bar = **answered (non-blank) / N**. Navigator lists **all** N from the start; click jumps. Unanswered vs answered styling (not green/red — exam isn’t graded until submit). |
| **Casual stopwatch** | **One session timer** — does **not** reset per question. Measures total practice time for the run (matches commit `response_ms` vibe + summary). Hide/show toggle. |
| **Timed timer** | Existing **countdown** to deadline. Hide/show toggle (timer still runs when hidden). |
| **Pause** | Both modes: Pause freezes stopwatch/countdown **and** blurs/hides stem+choices until Unpause. Fair “step away” without peeking. |
| **Casual submit-per-Q** | Select choice = highlight only. Small **Check** on the right of the selected choice is the only grade action. **Next disabled** until checked. **No Skip.** Numbers `1–4` select; **Enter** checks. |
| **Timed submit** | Free Back/Next; no per-question Check. Last question: **Next → Submit** (full exam). Auto-submit on timeout unchanged. |
| **Casual End** | Explicit **End** control (top or bottom cluster) → commit + summary. Ending mid-queue is allowed (attempted Qs only). |
| **Feedback** | Soft green / red **glow** on correct/wrong (theme-aware, not neon neon). Short **correct / incorrect** sounds (muteable later via profile if easy; default on). |
| **Explanations** | After Check in Casual: clear explanation region under choices. Same content available in summary review for Casual + Timed. |
| **Summary** | After commit: navigate to **CMD dashboard** with a **fullscreen summary modal** (X closes → dashboard underneath). Stats top → question scrubber (filter wrong) middle → weak topics / XP / badges bottom. |
| **Rank HUD** | `Rank` label → title on one line, **level in a small box** (e.g. `RECRUIT` + `[2]`). Drop literal `Lv`. |
| **XP bar** | Keep bar; prefer **`{xpIntoLevel} / {xpSpan}`** or progress-only on small screens — “65 to next” secondary or tooltip so it doesn’t float awkwardly. |
| **OPS Casual visual** | Redo icon + hover so the “dot” doesn’t fly off; match quality of Timed/Binder cards. |
| **Missions empty** | Empty team missions = empty UI, **not** “Failed to load”. Reserve error for real failures. |
| **Badge sync** | Don’t flash “unavailable” when sync fails softly or badges already loaded; only warn on hard failure. |
| **Badge icons** | Every catalog badge gets a **distinct** `BadgeMark` that matches its meaning. |

---

## Build order

| Plan | Name | Outcome |
|---|---|---|
| **01** | Shared practice chrome | Open layout shell, Q#/progress, navigator modal skeleton, timer UI + pause blur, Back/Next, shortcuts `?`, theme glow tokens |
| **02** | Casual check + session | Select→Check, no skip, growing navigator green/red, session stopwatch, End, glow+sound, inline explanation |
| **03** | Timed free nav | Countdown + hide, full navigator, Submit on last, pause fairness, no per-Q grade |
| **04** | Fullscreen summary | CMD landing + modal: stats, scrubber/filter, weak topics, XP; explanations in review |
| **05** | Shell, OPS, bugs, badges | Rank box, XP copy, Casual OPS art, missions empty fix, badge sync tone, unique icons |

**How to use:** `build plan 01` → you react in the browser (especially visuals) → adjust → continue. You stay in the loop on feel; plans lock behavior.

---

## Out of scope

- Marketing landing / 3D hero / Privacy & Terms → later track
- Raising `ARENA_SESSION_CAP` or bank algorithms (unless a plan needs a tiny hook)
- Redesigning Clinic overlay visually beyond fitting the new chrome (keep functional; light pass only if broken by shell)
- New sound pack beyond two short SFX + respect `prefers-reduced-motion` for glow intensity

---

## Progress

- [x] Plan 01 — Shared practice chrome
- [x] Plan 02 — Casual check + session
- [x] Plan 03 — Timed free nav
- [x] Plan 04 — Fullscreen summary
- [x] Plan 05 — Shell, OPS, bugs, badges

## Verify after track

- [x] Casual: cannot Next until Check; no Skip; navigator grows with green/red; End commits
- [x] Timed: free nav; Submit on last; pause blurs content; hide timer still counts down
- [x] Summary opens fullscreen on CMD after both modes; filter wrong works; X → dashboard
- [ ] Themes (`hud` / `sleek` / `paper`) still look coherent in arena (spot-check)
- [x] Missions with zero rows ≠ error; badge shelf doesn’t false-alarm; icons unique
- [x] Rank shows boxed level; OPS Casual hover doesn’t lose the dot
