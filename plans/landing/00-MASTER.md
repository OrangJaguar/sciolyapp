# Landing · Story · Legal — Master index

**Goal:** Ship a **public marketing landing** that feels genuine (Sanskar’s Science Olympiad story), visually memorable without AI-slop, and still **snappy on school Chromebooks** — then ship **Privacy** + **Terms** as readable, sectioned pages with footer links.

**Depends on:** Product UI track (`plans/ui`) — practice/CMD should feel like the same product the landing promises.

---

## Product decisions (locked)

| Topic | Decision |
|---|---|
| **Audience** | Science Olympiad students + coaches/captains who want accountability, structure, and team study — not a generic “AI tutor” pitch. |
| **Story (true)** | Built by **Sanskar Gupta**, high school Science Olympiad leader. After a devastating loss with no rigid plan, he built this so teams can track progress and stay accountable — with management + study surfaces designed around **updated SciOly structure/info**, not a bolted-on quiz app. Public copy says **high schooler**, not age. |
| **Hero beat** | **Event constellation** — slow orbital nodes/rings, pointer-reactive (Plan 02). |
| **Tone** | Honest, sharp, human. No fake enterprise stats, no purple glow SaaS, no “revolutionize learning” copy. |
| **Brand on landing** | Brand / product name is a **hero-level** signal. First viewport = one composition (not a dashboard). |
| **Motion / 3D** | Allowed and encouraged — **one** primary interactive/3D beat + 2–3 intentional scroll/hover motions. Prefer reduced-motion fallbacks. Budget for Chromebook: lazy-load 3D, pause offscreen, no 40MB particle walls. |
| **Auth routing** | Logged-out `/` → landing. Logged-in (onboarded) `/` → app (CMD) as today. Login CTAs from landing. |
| **Legal UX** | Privacy + Terms are **not walls of text** — TOC / jump links, section cards, short paragraphs, easy exit back to landing/app. Accurate to what the app actually does; not fake law-firm theater. Sanskar is a minor building a school tool — copy must stay humble (no overclaiming affiliation with Science Olympiad, Inc., etc.). |
| **Footer** | Site-wide (or at least landing + legal): clickable **Privacy** + **Terms** + existing copyright line. |

---

## Build order (4 plans)

| Plan | Name | Outcome |
|---|---|---|
| **01** | Landing direction lock | Concept, section map, copy skeleton in Sanskar’s voice, motion/3D + perf budget, route shell |
| **02** | Hero + signature beat | Brand-first hero + the one “sick” interactive/3D moment, primary CTAs |
| **03** | Story · product · polish | Remaining sections, scroll choreography, mobile, shared marketing footer |
| **04** | Privacy · Terms · legal chrome | `/privacy`, `/terms` as navigable sectioned pages; footer links everywhere that matters |

**How to use:** `build plan 01` → you react (especially copy + hero feel) → continue.

---

## Out of scope

- Reworking in-app CMD/OPS practice UX (done in `plans/ui`)
- Full cookie consent / GDPR tooling / COPPA lawyer package (keep launch-honest; escalate later if needed)
- App Store / school district procurement packets
- Fixing badge PNG backgrounds (deferred)

---

## Progress

- [x] Plan 01 — Landing direction lock
- [x] Plan 02 — Hero + signature beat
- [x] Plan 03 — Story · product · polish
- [x] Plan 04 — Privacy · Terms · legal chrome

## Verify after track

- [ ] Logged-out user hitting `/` sees landing; logged-in user still reaches CMD
- [ ] First viewport: brand + one headline + one supporting line + CTA group + dominant visual (no card clutter)
- [ ] Signature motion/3D works on desktop; graceful fallback on low-end / `prefers-reduced-motion`
- [ ] Story section reads as Sanskar’s voice (loss → accountability → SciOly-shaped product)
- [ ] Footer Privacy + Terms clickable; pages sectioned, scannable, Esc/back easy
- [ ] No false “official Science Olympiad” affiliation claims
