# Plan 02 — Hero + signature beat

**Track:** `plans/landing`  
**Depends on:** Plan 01  
**Touches:** landing page hero, canvas constellation, primary CTAs, marketing layout root

## Goal

Ship the **first viewport** as one composition: brand-forward, emotionally clear, with **one** cool interactive beat that doesn’t feel like a template or a loading tax.

## Amendments (vs Plan 01 shell)

- **Beat tech:** lightweight **2D canvas** constellation — not R3F/Three.js (Chromebook-safe; procedural, zero textures).
- **Hero layout:** constellation is a **full-bleed edge-to-edge plane**; type overlays it. Kill the Plan 01 inset rounded media card.
- **Secondary CTA:** keep Log in; add subtle “See how it works” → scroll to `#product`.
- Landing marketing root forces **HUD dark** (`data-theme="hud"`) so light app theme doesn’t wash the page.

## Hero content

- **Brand:** scioly.app
- **Headline:** Stay accountable. Study like it matters.
- **Support:** one sentence — team study + progress for SciOly seasons
- **CTAs:** Get started → `/login?mode=signup`; Log in → `/login`; See how it works → `#product`
- **Visual:** full-bleed constellation behind type

## Signature beat

**Event constellation** — orbital rings + labeled event nodes; subtle pointer parallax.

Requirements:

- Intentional, slow, premium — not bounce-everywhere
- Pointer response (subtle)
- Pause when offscreen (`IntersectionObserver`)
- Lazy-load the canvas module
- Static SVG fallback for `prefers-reduced-motion`

## Work items

### A. Hero composition
- Full-viewport, one composition, brand-first
- No feature cards / stats / badges in hero

### B. `EventConstellation` + fallback
- Canvas rings/nodes/links; pointer tilt
- Reduced-motion SVG twin

### C. CTA routing
- Signup / login links; scroll anchor for product

### D. Perf
- No multi-MB assets; pause offscreen; code-split canvas

## Acceptance

- [x] First viewport reads as one composition; brand is hero-level
- [x] CTA reaches login / signup
- [x] Signature beat runs on canvas; falls back when reduced-motion
- [x] No feature cards, stats strips, or badges cluttering the hero

## Apply next

`build plan 03` — story · product · polish.
