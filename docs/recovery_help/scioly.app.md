\# scioly.app Progression & XP Hierarchy — Spec v1

\#\# 1\. Design Goals

\- Mastery over volume: correct answers are the primary XP source.  
\- Lifetime progression: XP, levels, and rank do not reset seasonally.  
\- Early levels are fast; later levels are slower.  
\- Rank titles are rare and meaningful.  
\- Daily cap prevents burnout/grinding.  
\- Small streak multiplier rewards consistency without dominating.  
\- Missions and badges grant finite one-time XP outside daily caps.

\---

\#\# 2\. XP Sources

\#\#\# Base XP Awards

| Activity | Base XP |  
|---|---|  
| Casual — correct answer | \*\*+5\*\* |  
| Casual — incorrect answer | \*\*+1\*\* |  
| Timed — correct answer | \*\*+6\*\* |  
| Timed — incorrect answer | \*\*+1\*\* |  
| Clinic DO completed | \*\*+10\*\* |  
| Flawless session bonus — Casual | \*\*+10\*\* |  
| Flawless session bonus — Timed | \*\*+15\*\* |  
| Mission completed | \*\*+25\*\* |  
| Badge / milestone unlock | \*\*+50 to \+500\*\* (one-time, per badge) |

\#\#\# Flawless Session Bonus

Awarded only if:

\- The session has at least 1 question.  
\- Every question is answered correctly.  
\- There are no incorrect, skipped, or invalidated answers.

The flawless bonus is added after normal answer XP.

\#\#\# Mission XP

\- Mission completion grants a flat \*\*+25 XP\*\*.  
\- Mission XP is \*\*not\*\* multiplied by streak.  
\- Mission XP is \*\*not\*\* subject to the daily practice cap.  
\- Missions are officer-created only. There are no auto-generated personal missions.

\#\#\# Badge / Milestone XP

\- Badge and milestone unlocks grant one-time XP.  
\- Exact XP per badge will be defined in the badge spec.  
\- Range: \*\*+50 to \+500 XP\*\*.  
\- Badge XP is \*\*not\*\* multiplied by streak.  
\- Badge XP is \*\*not\*\* subject to the daily practice cap.

\---

\#\# 3\. Practice Validity & Anti-Grind

\#\#\# Minimum Response Time

| Mode | Minimum response time |  
|---|---|  
| Casual | 3.0 seconds |  
| Timed | 4.0 seconds |

If an answer is submitted faster than the minimum response time, it is \*\*invalidated\*\*:

\- Awards \*\*0 XP\*\*  
\- Does \*\*not\*\* count as correct or incorrect  
\- Does \*\*not\*\* count toward streak  
\- Does \*\*not\*\* count toward flawless bonus  
\- Does \*\*not\*\* count toward daily cap  
\- Is logged for telemetry only

\#\#\# Skipped Answers

\- Skipped answers award \*\*0 XP\*\*.  
\- Skipped answers do \*\*not\*\* count as correct or incorrect.  
\- Skipped answers do \*\*not\*\* count toward streak or flawless bonus.  
\- A session containing only skipped/invalidated answers does not count as a graded activity.

\#\#\# Valid Activity for Streak

A day counts as active for streak if at least one of these occurs:

\- A casual session commit with at least one valid answer  
\- A timed session commit with at least one valid answer  
\- Completion of a Clinic DO drill

\---

\#\# 4\. Daily Practice XP Cap

\- Daily cap applies to \*\*practice XP only\*\*.  
\- Practice XP includes:  
  \- Casual answer XP  
  \- Timed answer XP  
  \- Clinic DO XP  
  \- Flawless session bonus XP  
\- Daily cap: \*\*200 base practice XP per local day\*\*.  
\- Mission XP and badge XP are \*\*not\*\* included in the cap.

\#\#\# Cap Mechanics

\- The cap is applied to \*\*base practice XP before streak multiplier\*\*.  
\- At each XP award, check the user’s cumulative base practice XP for the current local day.  
\- Award only the remaining amount if the user would exceed 200 base XP.  
\- Then apply the current streak multiplier to the awarded base amount.  
\- Maximum possible practice XP per day at 1.5x streak \= \*\*300 XP\*\*.

\---

\#\# 5\. Streak Rules

\- Streak is based on \*\*local calendar days\*\*, not UTC.  
\- The client sends timezone info at commit time.  
\- Streak is display-first but also provides a small XP multiplier.

\#\#\# Streak Update Rules

| Condition | Streak result |  
|---|---|  
| First valid activity ever | Streak \= 1 |  
| Valid activity on same local day as last activity | Streak unchanged |  
| Valid activity on previous local day | Streak \+1 |  
| Last valid activity was more than 1 local day ago | Streak resets to 1 |

\#\#\# Streak Multiplier

| Streak length | Multiplier |  
|---|---|  
| 1–6 days | \*\*1.0x\*\* |  
| 7–29 days | \*\*1.1x\*\* |  
| 30–59 days | \*\*1.2x\*\* |  
| 60–89 days | \*\*1.3x\*\* |  
| 90–119 days | \*\*1.4x\*\* |  
| 120+ days | \*\*1.5x\*\* |

\- Maximum multiplier is \*\*1.5x\*\*.  
\- Streak multiplier applies only to \*\*practice XP\*\*.  
\- Streak multiplier does \*\*not\*\* apply to mission XP or badge XP.  
\- The multiplier is evaluated at the moment of each XP award.  
\- If streak tier changes during a day, later awards use the new multiplier. Earlier awards are not recalculated.

\---

\#\# 6\. Level & Rank Hierarchy

\#\#\# Level XP Costs

| Rank | Level range | XP required per level |  
|---|---|---|  
| Recruit | 1–10 | \*\*100\*\* |  
| Specialist | 11–30 | \*\*150\*\* |  
| Tactician | 31–50 | \*\*200\*\* |  
| Master | 51–74 | \*\*300\*\* |  
| Elite | 75–102 | \*\*350\*\* |  
| National Contender | 103–132 | \*\*500\*\* |  
| National Legend | 133+ | \*\*750\*\* |

\#\#\# Rank Entry Thresholds

| Rank | Entry level | Entry XP |  
|---|---|---|  
| Recruit | 1 | \*\*0\*\* |  
| Specialist | 11 | \*\*1,000\*\* |  
| Tactician | 31 | \*\*4,000\*\* |  
| Master | 51 | \*\*8,000\*\* |  
| Elite | 75 | \*\*15,200\*\* |  
| National Contender | 103 | \*\*25,000\*\* |  
| National Legend | 133 | \*\*40,000\*\* |

\#\#\# Level Formula

For a user at rank entry level \`R\_start\`, rank entry XP \`R\_entry\`, and level XP cost \`C\`:

\`\`\`  
current\_level \= R\_start \+ floor((total\_xp \- R\_entry) / C)  
xp\_to\_next\_level \= C \- ((total\_xp \- R\_entry) % C)  
\`\`\`

\#\#\# Progression Shape

\- Recruit levels are intentionally fast: first level-up usually occurs within the first 2 sessions.  
\- Level-up frequency decreases as rank increases.  
\- National Legend is a multi-season career goal.

\---

\#\# 7\. Display

\#\#\# Top Bar HUD

\- Shows rank title \+ level number:

\`\`\`  
Tactician Lv 14  
\`\`\`

\- Shows compact XP progress bar toward the next level.  
\- Avatar frame is based on current rank.

\#\#\# Profile View

Shows:

\- Rank title  
\- Level  
\- Total XP  
\- XP to next level  
\- Current streak  
\- Badge count  
\- Equipped avatar/badge

\---

\#\# 8\. Implementation Notes

\- XP and rank logic must be enforced server-side via Supabase RPCs.  
\- Frontend constants live in \`progression.ts\`.  
\- Badge definitions live in \`badges.tsx\`.  
\- Server is authoritative for XP awards, cap enforcement, streak updates, and rank derivation.  
\- Rank is derived from XP on read. Do not store rank title as source of truth.  
\- Daily cap and streak reset based on user-local calendar day, not UTC.

\---

\#\# 9\. Explicit Non-Goals

\- No reward shop or cosmetic economy.  
\- No XP from streak itself except the capped practice multiplier.  
\- No auto-generated personal missions or daily quests.  
\- No seasonal XP/rank reset.  
\- No badge XP that scales infinitely.  
