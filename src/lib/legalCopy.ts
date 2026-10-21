/** Launch-honest legal copy. Not a lawyer’s draft — edit sections in place. */

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: readonly string[] }

export type LegalSection = {
  id: string
  title: string
  blocks: readonly LegalBlock[]
}

export const LEGAL_UPDATED = 'October 19, 2026'

export const LEGAL_NOTE =
  'This is plain-language product copy for a student-built app. It is not legal advice and not a substitute for a lawyer.'

export const privacySections: readonly LegalSection[] = [
  {
    id: 'who',
    title: 'Who runs this',
    blocks: [
      {
        type: 'p',
        text: 'scioly.app is a Science Olympiad practice and team tool built by Sanskar Gupta, a high school student. It is a personal project, not a company product and not an official Science Olympiad service.',
      },
      {
        type: 'p',
        text: 'Not affiliated with Science Olympiad, Inc. Science Olympiad® is a separate organization.',
      },
    ],
  },
  {
    id: 'collect',
    title: 'What we collect',
    blocks: [
      {
        type: 'p',
        text: 'We collect what the app needs to sign you in, put you on a team, and record practice.',
      },
      {
        type: 'ul',
        items: [
          'Account: email, and a password hash if you use email sign-in. Google sign-in is handled by Google and Supabase Auth — we receive the account identity Google shares for login.',
          'Profile: handle, display name, school name, division, avatar, onboarding status.',
          'Team: which team you joined, your role (member, officer, captain, or coach), join activity, team posts you write, and event coverage you set.',
          'Practice: answers and session results, missions progress, XP, streaks, badges, questions answered, and the timezone used for daily caps.',
          'On your device: theme preference and an in-progress timed exam, stored in the browser (local storage) until you finish or clear it.',
        ],
      },
      {
        type: 'p',
        text: 'We do not ask for a home address, phone number, or payment card. We do not run ads.',
      },
    ],
  },
  {
    id: 'use',
    title: 'How we use it',
    blocks: [
      {
        type: 'ul',
        items: [
          'Run sign-in, teams, missions, practice, and progression.',
          'Show you (and your team leaders, where the product allows) progress that the features are built to show.',
          'Keep the service reliable — for example, auth sessions and server logs from the host.',
        ],
      },
      {
        type: 'p',
        text: 'We do not sell personal information. We do not use your practice answers to train a public model.',
      },
    ],
  },
  {
    id: 'teams',
    title: 'Teams, captains, and coaches',
    blocks: [
      {
        type: 'p',
        text: 'If you join a team, other people on that team can see what the product is designed to share: your handle and display name, role, event coverage, team posts, and mission participation.',
      },
      {
        type: 'p',
        text: 'Captains and coaches can open a member signal view: XP, streak, questions answered, recent activity date, coverage, and mission progress. That is accountability for a squad, not a hidden device tracker. People outside your team do not get that view.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Question generation',
    blocks: [
      {
        type: 'p',
        text: 'Platform admins can generate draft questions. Those jobs run on our servers and send the admin’s prompt plus curriculum context (events, topics, concepts) to a model provider — currently DeepSeek or NVIDIA NIM, depending on configuration.',
      },
      {
        type: 'p',
        text: 'That pipeline is for building the question bank. It is not a chat tutor, and student practice sessions are not streamed to those providers as conversations. Drafts can be wrong until a person reviews them.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Who else handles data',
    blocks: [
      {
        type: 'p',
        text: 'The app is hosted with vendors that process data so the product can run:',
      },
      {
        type: 'ul',
        items: [
          'Supabase — authentication, database, and related backend.',
          'Google — only if you choose “Continue with Google.”',
          'DeepSeek and/or NVIDIA — admin generation prompts, as described above.',
          'The site host that serves the web app.',
        ],
      },
      {
        type: 'p',
        text: 'We share information if the law requires it, or to stop abuse of the service. We do not sell it.',
      },
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    blocks: [
      {
        type: 'p',
        text: 'Account, team, and practice rows stay while your account exists so progression and missions still make sense. Browser storage for a timed exam is cleared when that exam flow finishes or you clear site data.',
      },
      {
        type: 'p',
        text: 'To delete an account or ask what we hold, contact the developer (see the last section). Deletion of a team account can affect shared missions and posts that other members still rely on — we will say so if that comes up.',
      },
    ],
  },
  {
    id: 'schools',
    title: 'Schools and younger students',
    blocks: [
      {
        type: 'p',
        text: 'The audience is Science Olympiad students, mostly high school, plus captains and coaches. If you are under 13, do not create an account. If a parent, guardian, or school expects permission before you use a team tool, get that first.',
      },
      {
        type: 'p',
        text: 'School-issued accounts and devices may have extra rules from your district. Those rules sit on top of this page.',
      },
    ],
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    blocks: [
      {
        type: 'p',
        text: `This page can change as the product changes. The date at the top is the latest revision (${LEGAL_UPDATED}). Continued use after an update means you accept the new text.`,
      },
      {
        type: 'p',
        text: 'Questions or deletion requests: contact Sanskar Gupta, the developer of scioly.app, through the channel you already use to reach him (team, school, or the account email on file). There is no separate support desk.',
      },
    ],
  },
]

export const termsSections: readonly LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    blocks: [
      {
        type: 'p',
        text: 'By creating an account or using scioly.app, you agree to these terms. If you do not agree, do not use the app.',
      },
      {
        type: 'p',
        text: 'You should be in high school or older, or be a coach working with a team. If you are under 13, you may not sign up. If you are under 18, use the app only if a parent, guardian, or school is fine with it.',
      },
    ],
  },
  {
    id: 'service',
    title: 'The service',
    blocks: [
      {
        type: 'p',
        text: 'scioly.app is a practice and team-management tool: drills, timed runs, missions, roster signals, and related progression. It is provided as-is by a student developer. Features can change, break, or pause.',
      },
      {
        type: 'p',
        text: 'Not affiliated with Science Olympiad, Inc. Nothing here is an official test, ranking, or invitation event. Scores in the app are not tournament results.',
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and teams',
    blocks: [
      {
        type: 'ul',
        items: [
          'Keep your login to yourself. You are responsible for activity on your account.',
          'Use a handle and display name that are appropriate for a school team.',
          'Join codes are for your unit. Do not post them publicly or add people who are not part of that team.',
          'Captains, officers, and coaches should use roster and member signals for team coordination, not to harass anyone.',
        ],
      },
    ],
  },
  {
    id: 'use',
    title: 'Acceptable use',
    blocks: [
      {
        type: 'p',
        text: 'Do not:',
      },
      {
        type: 'ul',
        items: [
          'Cheat markets, sell answers, or dump the question bank.',
          'Scrape, overload, or break the service.',
          'Harass teammates, post illegal content, or upload anything you do not have rights to share.',
          'Pretend the app or your team is an official Science Olympiad body.',
          'Use admin or generation tools unless you are actually a platform admin.',
        ],
      },
    ],
  },
  {
    id: 'content',
    title: 'Your content and team data',
    blocks: [
      {
        type: 'p',
        text: 'You keep ownership of posts and other text you write. You give the app permission to store and show that content to the people the product is built to show it to (for example, your team).',
      },
      {
        type: 'p',
        text: 'Practice stats, missions, and coverage exist so the team features work. Leaving a team does not promise that every shared post disappears for everyone else.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Generated questions',
    blocks: [
      {
        type: 'p',
        text: 'Some questions start as model drafts (DeepSeek or NVIDIA NIM) and may be wrong, outdated, or off-scope until a person reviews them. Do not treat an in-app explanation as a guaranteed fact on test day.',
      },
      {
        type: 'p',
        text: 'You may not republish the question bank as your own product.',
      },
    ],
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    blocks: [
      {
        type: 'p',
        text: 'The app’s design, code, and original copy belong to the developer unless a license says otherwise. Science Olympiad® names and event titles belong to their owners; they appear here so teams can study, not to claim endorsement.',
      },
    ],
  },
  {
    id: 'liability',
    title: 'Disclaimers',
    blocks: [
      {
        type: 'p',
        text: 'The app is a study aid. It does not guarantee scores, medals, or a roster spot. To the extent the law allows, the developer is not liable for lost progress, wrong questions, team disputes, or damages from using or being unable to use the service.',
      },
      {
        type: 'p',
        text: 'Some places do not allow certain limits. In those places, the limit applies only as far as the law allows. This is a student project, not a warranty from a company.',
      },
    ],
  },
  {
    id: 'end',
    title: 'Stopping access',
    blocks: [
      {
        type: 'p',
        text: 'You can stop using the app at any time and ask for account deletion. Access can be removed for abuse, a broken join, or to keep the service up — especially if a team’s coaches need a bad actor off the roster.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    blocks: [
      {
        type: 'p',
        text: 'Questions about these terms: Sanskar Gupta, developer of scioly.app. Reach him the same way you already would for the project (school, team, or the email on your account). There is no separate legal department.',
      },
      {
        type: 'p',
        text: 'If a dispute cannot be worked out directly, it will be handled under applicable U.S. law, including the state where the operator lives, unless a school policy controls a school-issued account. These terms can be updated; the date on this page is the current revision.',
      },
    ],
  },
]
