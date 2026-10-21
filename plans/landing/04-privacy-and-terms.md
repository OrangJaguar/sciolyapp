# Plan 04 — Privacy · Terms · legal chrome

**Track:** `plans/landing`  
**Depends on:** Plan 03 (footer links + stub routes)  
**Touches:** `/privacy`, `/terms`, shared legal layout, structured copy

## Goal

Replace Plan 03 stubs with **Privacy** and **Terms** that are easy to scan — TOC + section cards — and honest about a student-built practice app.

## Amendments (vs Plan 03 stubs)

- Stubs already exist (`LegalStubPage`) and routes are public. Replace them; keep the same URLs.
- `MarketingFooter` + app `SiteFooter` already link Privacy / Terms (Plans 01 + 03). Login uses `SiteFooter`. No extra chrome required.
- Copy is launch-honest product language, **not a lawyer draft**. Banner says so.
- No invented contact email. Contact line points at the developer (Sanskar Gupta) without a fake address.
- Facts to stay accurate:
  - Accounts: email/password or Google via Supabase Auth
  - Profile: handle, display name, school, division, avatar, team, XP/streak/practice stats, timezone
  - Teams: join codes, roles, posts, event coverage, missions
  - Captains/coaches can see member signals (progress, missions, coverage) — not a hidden tracker pitch
  - Admin question generation sends curriculum prompts to model providers (DeepSeek / NVIDIA NIM). This is not a student chat tutor.
  - Browser stores theme + in-progress timed exam locally
  - Not affiliated with Science Olympiad, Inc.

## UX

- Marketing shell (`data-theme="hud"`), outside AppShell
- Top exit: home + log in
- TOC: sticky on desktop, chip row on small screens
- One section = one panel
- Footer still present

## Acceptance

- [x] `/privacy` and `/terms` public, sectioned, not a notepad dump
- [x] TOC jump links work
- [x] Footer links already work from landing, legal pages, and app shell
- [x] Copy matches real behaviors (teams, practice, admin generation, Supabase)
- [x] Non-affiliation is clear
- [x] Easy exit (home / log in / footer)

## After this track

Read both pages once. Swap paragraphs later if an attorney reviews them — layout stays.
