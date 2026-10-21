/** Marketing copy — Plan 01 skeleton; refined Plans 02–03. */

export const LANDING_BRAND = 'scioly.app'

export const LANDING_DISCLAIMER =
  'Not affiliated with Science Olympiad, Inc. Science Olympiad® is a separate organization.'

export const landingCopy = {
  hero: {
    brand: LANDING_BRAND,
    headline: 'Stay accountable. Study like it matters.',
    support:
      'Team study and progress tracking shaped for Science Olympiad seasons — built after a loss that needed a better plan.',
    primaryCta: 'Get started',
    secondaryCta: 'Log in',
    scrollCta: 'See how it works',
    scrollTo: '#product',
    primaryTo: '/login?mode=signup',
    secondaryTo: '/login',
  },
  why: {
    id: 'why',
    eyebrow: 'Why it exists',
    title: 'Built after a devastating loss.',
    body: [
      'Sanskar Gupta is a high school Science Olympiad leader. After a season that hurt — and no rigid plan to fall back on — he wanted something that actually kept a squad studying and accountable.',
      'This is that tool: progress you can see, practice shaped for the competition, and a team layer that doesn’t feel like busywork.',
    ],
  },
  product: {
    id: 'product',
    eyebrow: 'What you get',
    title: 'Practice. Team. Progress.',
    lead: 'One place to run drills, keep the unit moving, and see whether the work is sticking.',
    beats: [
      {
        title: 'Practice',
        body: 'Casual drills with real feedback. Timed black-box runs when you need exam pressure.',
      },
      {
        title: 'Team',
        body: 'Join or create a unit, missions with deadlines, roster visibility for captains and coaches.',
      },
      {
        title: 'Progress',
        body: 'XP, ranks, and session summaries so improvement isn’t a vague feeling.',
      },
    ],
  },
  scioly: {
    id: 'scioly',
    eyebrow: 'Built for SciOly',
    title: 'Designed around the competition — not any random quiz.',
    body: [
      'Events, seasons, and how teams actually prepare stay in mind as the product grows. The goal is a place that fits Science Olympiad structure — not a generic question bank with a SciOly sticker on it.',
    ],
    disclaimer: LANDING_DISCLAIMER,
  },
  captains: {
    id: 'captains',
    eyebrow: 'Captains & coaches',
    title: 'Light accountability. Not surveillance.',
    body: [
      'Missions, coverage, and member signals help leaders see who’s moving — without turning the app into a creepy tracker.',
    ],
  },
  close: {
    id: 'start',
    title: 'Ready when your squad is.',
    body: 'Create an account, join a team, and start a practice run.',
    primaryCta: 'Get started',
    secondaryCta: 'Already have an account? Log in',
    primaryTo: '/login?mode=signup',
    secondaryTo: '/login',
  },
  footer: {
    copyright: 'Copyright © 2026 Developed by Sanskar Gupta. All Rights Reserved.',
    privacy: 'Privacy',
    terms: 'Terms',
  },
} as const
