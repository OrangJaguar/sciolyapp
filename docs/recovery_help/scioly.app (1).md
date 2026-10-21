\# scioly.app Badge & Milestone Spec — v1

This spec builds on the Progression XP Hierarchy Spec v1. Badges are the milestone layer on top of XP and ranks.

\---

\#\# 1\. Badge Design Rules

\- Every milestone is a badge.  
\- Badges are flat. No bronze/silver/gold tiers.  
\- Badges are cosmetic \+ one-time XP rewards.  
\- Badge XP is not multiplied by streak.  
\- Badge XP is not subject to the daily practice cap.  
\- Badge unlock is idempotent: each user can unlock a badge only once.  
\- Badge unlock state and unlock date are stored server-side.  
\- Hidden badges exist, but their criteria are not shown in the UI.

\---

\#\# 2\. Badge XP Tiers

| Tier | XP | Purpose |  
|---|---|---|  
| Foundational | \+50 | Early wins, easy to reach |  
| Intermediate | \+100 | Real engagement |  
| Advanced | \+250 | Season-level achievement |  
| Pinnacle | \+500 | Multi-season / career milestone |

Total badge XP available:

\- Visible badges: 5,400 XP  
\- Hidden badges: 250 XP  
\- Combined: 5,650 XP

This is intentionally small relative to the 40,000 XP National Legend summit.

\---

\#\# 3\. Badge Categories

| Category | Description |  
|---|---|  
| Accuracy & Mastery | Correct totals, flawless sessions |  
| Streak | Consistency over days |  
| Mode Mastery | Casual, Timed, Clinic behavior |  
| Event Depth & Breadth | Specialization and versatility across events |  
| Team & Missions | Team membership and mission completion |  
| Binder | Binder Planner audits |  
| Classified | Hidden badges |

\---

\#\# 4\. Visible Badge Catalog

\#\#\# Foundational — \+50 XP

| Badge ID | Unlock Criteria | Flavor Copy |  
|---|---|---|  
| \`first\_blood\` | 1 correct answer total | "First correct answer." |  
| \`week\_streak\` | 7-day streak | "Seven-day streak." |  
| \`timed\_survivor\` | Complete 1 timed set | "Finish a Black Box run." |  
| \`team\_anchor\` | Join a team | "Join a unit." |  
| \`mission\_runner\` | Complete 3 missions | "Close three team missions." |  
| \`clinic\_graduate\` | Clear 5 Clinic DO drills | "Clear five Clinic DO drills." |  
| \`event\_specialist\` | 50 correct answers in one event | "Fifty correct in one event." |  
| \`binder\_initiate\` | Complete first binder audit | "Complete your first binder audit." |

\#\#\# Intermediate — \+100 XP

| Badge ID | Unlock Criteria | Flavor Copy |  
|---|---|---|  
| \`centurion\` | 100 correct answers total | "One hundred correct answers." |  
| \`iron\_streak\` | 30-day streak | "Thirty-day streak." |  
| \`flawless\_operator\` | 1 flawless casual session | "Perfect casual session." |  
| \`blackout\` | 1 flawless timed set | "Perfect timed set." |  
| \`black\_box\_veteran\` | Complete 10 timed sets | "Complete ten timed sets." |  
| \`event\_authority\` | 150 correct answers in one event | "One hundred fifty correct in one event." |  
| \`event\_generalist\` | Correct answer in 3 different events | "Correct in three events." |  
| \`clinic\_resident\` | Clear 25 Clinic DO drills | "Clear twenty-five Clinic DO drills." |  
| \`field\_agent\` | Complete 10 missions | "Complete ten missions." |  
| \`binder\_ready\` | Complete binder audits for 3 events | "Complete audits for three events." |

\#\#\# Advanced — \+250 XP

| Badge ID | Unlock Criteria | Flavor Copy |  
|---|---|---|  
| \`praetorian\` | 1,000 correct answers total | "One thousand correct answers." |  
| \`season\_streak\` | 90-day streak | "Ninety-day streak." |  
| \`whiteout\` | 10 flawless timed sets | "Ten flawless timed sets." |  
| \`black\_box\_operator\` | Complete 50 timed sets | "Complete fifty timed sets." |  
| \`event\_dominator\` | 300 correct answers in one event | "Three hundred correct in one event." |  
| \`event\_polymath\` | Correct answer in 7 different events | "Correct in seven events." |  
| \`clinic\_chief\` | Clear 100 Clinic DO drills | "Clear one hundred Clinic DO drills." |  
| \`unit\_operator\` | Complete 30 missions | "Complete thirty missions." |

\#\#\# Pinnacle — \+500 XP

| Badge ID | Unlock Criteria | Flavor Copy |  
|---|---|---|  
| \`national\_vanguard\` | 2,500 correct answers total | "Two thousand five hundred correct answers." |  
| \`unbroken\` | 120-day streak | "One hundred twenty-day streak." |  
| \`event\_omnivore\` | Correct answer in 12 different events | "Correct in twelve events." |  
| \`blackout\_protocol\` | 50 flawless timed sets | "Fifty flawless timed sets." |

\---

\#\# 5\. Hidden Badge Catalog

Hidden badges show as classified silhouettes in the UI. Criteria are not displayed.

| Badge ID | XP | Unlock Criteria | Unlock Category |  
|---|---|---|---|  
| \`sleeper\_cell\` | \+50 | Join a team and complete a mission within 24 local hours of joining | Team & Missions |  
| \`ghost\_in\_the\_machine\` | \+100 | Complete a 10-question timed set with 100% accuracy in under 50% of allotted time | Mode Mastery |  
| \`autodidact\` | \+100 | Clear 5 Clinic DO drills in a single local day | Mode Mastery |

Hidden badges are stored in the same \`user\_badges\` table. Once unlocked, they display normally with name, icon, and unlock date. Before unlock, they appear as:

\`\`\`  
\[ SILHOUETTE \]  
CLASSIFIED  
\`\`\`

\---

\#\# 6\. Badge Chains

Badges are independent, but the following chains create natural long-term goals:

| Chain | Badges |  
|---|---|  
| Correct totals | \`first\_blood\` → \`centurion\` → \`praetorian\` → \`national\_vanguard\` |  
| Streak | \`week\_streak\` → \`iron\_streak\` → \`season\_streak\` → \`unbroken\` |  
| Event depth | \`event\_specialist\` → \`event\_authority\` → \`event\_dominator\` |  
| Event breadth | \`event\_generalist\` → \`event\_polymath\` → \`event\_omnivore\` |  
| Timed completion | \`timed\_survivor\` → \`black\_box\_veteran\` → \`black\_box\_operator\` |  
| Flawless timed | \`blackout\` → \`whiteout\` → \`blackout\_protocol\` |  
| Clinic | \`clinic\_graduate\` → \`clinic\_resident\` → \`clinic\_chief\` |  
| Missions | \`mission\_runner\` → \`field\_agent\` → \`unit\_operator\` |  
| Binder | \`binder\_initiate\` → \`binder\_ready\` |

\---

\#\# 7\. Unlock Logic & Definitions

\#\#\# Correct Answer Totals

\- Counts all valid correct answers across casual and timed modes.  
\- Skipped, invalidated, or flagged answers do not count.  
\- \`first\_blood\`: \`total\_correct \>= 1\`  
\- \`centurion\`: \`total\_correct \>= 100\`  
\- \`praetorian\`: \`total\_correct \>= 1,000\`  
\- \`national\_vanguard\`: \`total\_correct \>= 2,500\`

\#\#\# Streak

\- Uses local calendar day streak logic from the XP Hierarchy Spec.  
\- \`week\_streak\`: \`current\_streak \>= 7\`  
\- \`iron\_streak\`: \`current\_streak \>= 30\`  
\- \`season\_streak\`: \`current\_streak \>= 90\`  
\- \`unbroken\`: \`current\_streak \>= 120\`

\#\#\# Flawless Session

\- A session is flawless if:  
  \- The session has at least 5 valid answered questions.  
  \- All valid answers are correct.  
  \- No invalidated, skipped, or flagged answers.  
\- Casual sessions must include at least 5 valid questions to qualify for flawless status.  
\- Timed sets naturally have 5 or 10 questions, so they always meet this minimum if completed normally.

\#\#\# Timed Sets Completed

\- Counts timed practice sets that are submitted and valid.  
\- Abandoned, empty, or invalid sets do not count.  
\- \`timed\_survivor\`: \`timed\_sets\_completed \>= 1\`  
\- \`black\_box\_veteran\`: \`timed\_sets\_completed \>= 10\`  
\- \`black\_box\_operator\`: \`timed\_sets\_completed \>= 50\`

\#\#\# Flawless Timed Sets

\- Counts timed sets that meet the flawless session definition above.  
\- \`blackout\`: \`flawless\_timed\_sets \>= 1\`  
\- \`whiteout\`: \`flawless\_timed\_sets \>= 10\`  
\- \`blackout\_protocol\`: \`flawless\_timed\_sets \>= 50\`

\#\#\# Clinic DO Clears

\- Counts successful Clinic DO drill completions.  
\- \`clinic\_graduate\`: \`clinic\_clears \>= 5\`  
\- \`clinic\_resident\`: \`clinic\_clears \>= 25\`  
\- \`clinic\_chief\`: \`clinic\_clears \>= 100\`

\#\#\# Event Depth

\- Tracks per-event correct answers: \`max\_correct\_in\_any\_event\`  
\- \`event\_specialist\`: \`max\_correct\_in\_any\_event \>= 50\`  
\- \`event\_authority\`: \`max\_correct\_in\_any\_event \>= 150\`  
\- \`event\_dominator\`: \`max\_correct\_in\_any\_event \>= 300\`

\#\#\# Event Breadth

\- Tracks distinct events where the user has at least 1 valid correct answer.  
\- \`event\_generalist\`: \`distinct\_events\_with\_correct \>= 3\`  
\- \`event\_polymath\`: \`distinct\_events\_with\_correct \>= 7\`  
\- \`event\_omnivore\`: \`distinct\_events\_with\_correct \>= 12\`

\#\#\# Missions Completed

\- Counts missions that transition from incomplete to complete for the user.  
\- Repeat completions of already completed missions do not count.  
\- \`mission\_runner\`: \`missions\_completed \>= 3\`  
\- \`field\_agent\`: \`missions\_completed \>= 10\`  
\- \`unit\_operator\`: \`missions\_completed \>= 30\`

\#\#\# Binder Audits

\- Counts distinct events with at least one completed binder audit.  
\- \`binder\_initiate\`: \`distinct\_binder\_audited\_events \>= 1\`  
\- \`binder\_ready\`: \`distinct\_binder\_audited\_events \>= 3\`

\#\#\# Hidden Badge Triggers

\- \`sleeper\_cell\`: Trigger check after every mission completion. Requires user has a team join timestamp and a mission completion timestamp within 24 local hours of the first team join.  
\- \`ghost\_in\_the\_machine\`: Trigger check after every timed set submission. Requires set length \= 10 questions, 100% valid correct, and elapsed time \< 50% of the time limit.  
\- \`autodidact\`: Trigger check after every Clinic DO clear. Requires 5 or more Clinic clears with the same local calendar day.

\---

\#\# 8\. Progress Display

For numeric badges, locked state shows progress toward threshold:

\`\`\`  
Centurion  
100 correct total  
67 / 100  
\`\`\`

For non-numeric badges, locked state shows only the hint copy.

Hidden badges show no progress and no criteria.

Once unlocked, badge card shows:

\- Badge icon  
\- Badge name  
\- Unlock date  
\- XP awarded  
\- No further progress

\---

\#\# 9\. Server-Side Badge Sync

On every relevant event, the server runs badge checks in a transaction:

1\. User commits a casual session.  
2\. User commits a timed set.  
3\. User clears a Clinic DO drill.  
4\. User completes a mission.  
5\. User completes a binder audit.  
6\. User joins a team.  
7\. User loads profile.

At each check:

\- Read current user stats from \`user\_stats\`.  
\- Evaluate all badge criteria against current stats.  
\- For each newly satisfied badge:  
  \- Insert \`user\_badges\` row with \`unlocked\_at \= now()\`.  
  \- Award badge XP once.  
  \- Return unlock event to client for immediate HUD toast/pulse.  
\- Use a unique constraint on \`(user\_id, badge\_id)\` to prevent duplicate unlocks and duplicate XP.

Recommended functions:

\`\`\`  
check\_accuracy\_badges(user\_id)  
check\_streak\_badges(user\_id)  
check\_timed\_badges(user\_id)  
check\_clinic\_badges(user\_id)  
check\_event\_depth\_badges(user\_id)  
check\_event\_breadth\_badges(user\_id)  
check\_mission\_badges(user\_id)  
check\_binder\_badges(user\_id)  
check\_hidden\_badges(user\_id)  
\`\`\`

\---

\#\# 10\. Badge Icons

Visual style: Brutalist Scholar / tactical HUD.

\- Flat, high-contrast, single-color line icons.  
\- Cyan accent on dark background.  
\- Simple geometric marks, not illustrated mascots.  
\- Hidden badges use a dark silhouette with \`CLASSIFIED\` label.

Each badge should be designed as a small SVG suitable for:

\- Badge shelf card  
\- Avatar profile picture replacement  
\- Profile page badge grid  
\- Locked/unlocked states

\---

\#\# 11\. Explicit Non-Goals

\- No badge tiers.  
\- No badge shop or economy.  
\- No infinite repeatable badge XP.  
\- No per-event badges yet.  
\- No officer/coach-specific badges yet.  
\- No auto-generated personal missions.  
