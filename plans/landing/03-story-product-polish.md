# Plan 03 — Story · product · polish

**Track:** `plans/landing`  
**Depends on:** Plan 02  
**Touches:** remaining landing sections, scroll motion, mobile layout, marketing footer, thin legal stubs

## Goal

Finish the landing below the fold: **Sanskar’s story**, what the product is, why it’s SciOly-shaped, a calm close — with motion that adds presence, not noise.

## Amendments (vs Plan 01 stubs + Plan 02 hero)

- Age framing stays **high schooler** (locked Plan 01).
- Product visual = **stylized HUD recreation** (missions / practice chrome), not a stock photo and not a screenshot file.
- Kill the three equal **feature cards** — one product composition + ≤3 text beats (hairline list), so mobile isn’t a card stack salad.
- Thin public `/privacy` + `/terms` stubs so footer links don’t bounce to login; Plan 04 replaces stubs with real sectioned legal pages.
- `SiteFooter` already has Privacy/Terms (Plan 01) — keep.

## Sections

### 1. Why it exists
- Loss → no rigid plan → accountability tool
- Name: Sanskar Gupta · high school Science Olympiad leader
- Type-led; no stock beaker photos

### 2. What you get
- One product frame + Practice · Team · Progress
- Copy: track progress, keep the squad studying, manage the team

### 3. Built for SciOly
- Events / seasons / structure
- Non-affiliation one-liner

### 4. Captains & coaches
- Light accountability, not surveillance
- Short copy + one visual cue (mission/roster signal)

### 5. Closing CTA
- Get started + soft Log in

### Footer
- Copyright + Privacy + Terms (stubs until Plan 04)

## Motion (3)

1. Section enter: fade/slide once (`IntersectionObserver`)
2. Product frame: soft border glow on enter
3. Closing CTA: gentle emphasis on enter

Respect `prefers-reduced-motion`.

## Acceptance

- [x] Story section personal/specific (high schooler, named)
- [x] Product ≤3 beats + one composition (no card grid salad)
- [x] SciOly non-affiliation present
- [x] Footer Privacy + Terms clickable (stub pages)
- [x] Mobile stacks cleanly; reveal motion respects reduced-motion

## Apply next

`build plan 04` — Privacy · Terms · legal chrome.
