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
      'Practice was scattered. Deadlines lived in chats. Nobody could tell, a week later, who had actually drilled an event. This is the board for that.',
    ],
    arc: [
      { k: '01', title: 'The season', body: 'A loss with nothing rigid to point back to.' },
      { k: '02', title: 'The gap', body: 'Binders, group chats, and a vague sense of “we studied.”' },
      { k: '03', title: 'The build', body: 'Missions, drills, and a rank that moves when the work does.' },
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
        body: 'Casual drills show the answer when you check. Timed runs stay sealed until you end — exam pressure, not a pop quiz.',
      },
      {
        title: 'Team',
        body: 'Join or create a unit. Missions have deadlines. Captains see coverage and who is moving, not a surveillance feed.',
      },
      {
        title: 'Progress',
        body: 'XP, rank, and a session summary land on CMD when you finish. Improvement is a number you can argue with.',
      },
    ],
    run: [
      { k: 'Event', body: 'Pick a studyable event and a topic, or the whole bank.' },
      { k: 'Mode', body: 'Check as you go, or seal a black box with a count and a clock.' },
      { k: 'Close', body: 'End the run. The summary opens on CMD, not in a lost tab.' },
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
    domains: [
      { name: 'Life', note: 'Anatomy, disease, ecology' },
      { name: 'Earth', note: 'Rocks, weather, planets' },
      { name: 'Physical', note: 'Chem, physics, machines' },
      { name: 'Build', note: 'Towers, trajectories, code' },
      { name: 'Inquiry', note: 'Experimental design' },
    ],
  },
  captains: {
    id: 'captains',
    eyebrow: 'Captains & coaches',
    title: 'Light accountability. Not surveillance.',
    body: [
      'Missions, coverage, and member signals help leaders see who’s moving — without turning the app into a creepy tracker.',
    ],
    see: ['Mission progress', 'Event coverage', 'Last practice day'],
    skip: ['Location', 'Keystrokes', 'Anything off the team'],
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
