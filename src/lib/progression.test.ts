/**
 * Progression SSOT checks. Run: npm run test:progression
 */
import assert from 'node:assert/strict'
import {
  DAILY_PRACTICE_XP_CAP,
  MIN_RESPONSE_MS,
  XP_AWARDS,
  formatRankHud,
  levelFromXp,
  liveStreak,
  practiceXpBaseToday,
  rankTitleFromXp,
  streakMultiplier,
  xpProgress,
  xpToNextLevel,
} from './progression.ts'
import { addCalendarDays, localDateString } from './timezone.ts'

// Award table matches recovery XP spec + SQL submit wrappers
{
  assert.equal(XP_AWARDS.casualCorrect, 5)
  assert.equal(XP_AWARDS.casualIncorrect, 1)
  assert.equal(XP_AWARDS.timedCorrect, 6)
  assert.equal(XP_AWARDS.timedIncorrect, 1)
  assert.equal(XP_AWARDS.clinicDoCompleted, 10)
  assert.equal(XP_AWARDS.flawlessCasualBonus, 10)
  assert.equal(XP_AWARDS.flawlessTimedBonus, 15)
  assert.equal(XP_AWARDS.missionCompleteBonus, 25)
  assert.equal(MIN_RESPONSE_MS.casual, 3000)
  assert.equal(MIN_RESPONSE_MS.timed, 4000)
  assert.equal(DAILY_PRACTICE_XP_CAP, 200)
}

// Level / rank boundaries (spec §6)
{
  assert.equal(levelFromXp(0), 1)
  assert.equal(rankTitleFromXp(0), 'Recruit')
  assert.equal(formatRankHud(0), 'Recruit [1]')

  assert.equal(levelFromXp(999), 10)
  assert.equal(rankTitleFromXp(999), 'Recruit')
  assert.equal(formatRankHud(999), 'Recruit [10]')

  assert.equal(levelFromXp(1000), 11)
  assert.equal(rankTitleFromXp(1000), 'Specialist')
  assert.equal(formatRankHud(1000), 'Specialist [11]')

  assert.equal(levelFromXp(4000), 31)
  assert.equal(rankTitleFromXp(4000), 'Tactician')
  assert.equal(formatRankHud(4000), 'Tactician [31]')

  assert.equal(levelFromXp(8000), 51)
  assert.equal(rankTitleFromXp(8000), 'Master')

  assert.equal(levelFromXp(15_200), 75)
  assert.equal(rankTitleFromXp(15_200), 'Elite')

  assert.equal(levelFromXp(25_000), 103)
  assert.equal(rankTitleFromXp(25_000), 'National Contender')

  assert.equal(levelFromXp(40_000), 133)
  assert.equal(rankTitleFromXp(40_000), 'National Legend')
  assert.equal(formatRankHud(40_000), 'National Legend [133]')
}

// xpToNextLevel / xpProgress at band boundaries
{
  assert.equal(xpToNextLevel(0), 100)
  assert.equal(xpProgress(0), 0)

  assert.equal(xpToNextLevel(99), 1)
  assert.ok(Math.abs(xpProgress(99) - 0.99) < 1e-9)

  assert.equal(xpToNextLevel(100), 100)
  assert.equal(xpProgress(100), 0)
  assert.equal(levelFromXp(100), 2)

  assert.equal(xpToNextLevel(999), 1)
  assert.equal(xpToNextLevel(1000), 150)
  assert.equal(xpProgress(1000), 0)

  // Last XP before Tactician
  assert.equal(levelFromXp(3999), 30)
  assert.equal(rankTitleFromXp(3999), 'Specialist')
  assert.equal(xpToNextLevel(3999), 1)

  // Mid Specialist: Lv 11 + 1 level + half of 150
  assert.equal(levelFromXp(1000 + 150 + 75), 12)
  assert.ok(Math.abs(xpProgress(1000 + 150 + 75) - 0.5) < 1e-9)
  assert.equal(xpToNextLevel(1000 + 150 + 75), 75)
}

// Streak multiplier mirrors SQL progression_streak_multiplier
{
  assert.equal(streakMultiplier(0), 1.0)
  assert.equal(streakMultiplier(6), 1.0)
  assert.equal(streakMultiplier(7), 1.1)
  assert.equal(streakMultiplier(29), 1.1)
  assert.equal(streakMultiplier(30), 1.2)
  assert.equal(streakMultiplier(59), 1.2)
  assert.equal(streakMultiplier(60), 1.3)
  assert.equal(streakMultiplier(89), 1.3)
  assert.equal(streakMultiplier(90), 1.4)
  assert.equal(streakMultiplier(119), 1.4)
  assert.equal(streakMultiplier(120), 1.5)
  assert.equal(streakMultiplier(999), 1.5)
}

// Local-day streak display
{
  const now = new Date('2026-10-13T18:00:00.000Z')
  const today = localDateString('UTC', now)
  const yesterday = addCalendarDays(today, -1)
  const older = addCalendarDays(today, -2)

  assert.equal(liveStreak(5, today, now, 'UTC'), 5)
  assert.equal(liveStreak(5, yesterday, now, 'UTC'), 5)
  assert.equal(liveStreak(5, older, now, 'UTC'), 0)
  assert.equal(liveStreak(0, today, now, 'UTC'), 0)
  assert.equal(liveStreak(3, null, now, 'UTC'), 0)
}

// Practice cap day key
{
  const now = new Date('2026-10-13T18:00:00.000Z')
  const today = localDateString('UTC', now)
  assert.equal(
    practiceXpBaseToday(
      { practice_xp_base: 40, practice_xp_date: today, timezone: 'UTC' },
      now,
    ),
    40,
  )
  assert.equal(
    practiceXpBaseToday(
      {
        practice_xp_base: 40,
        practice_xp_date: addCalendarDays(today, -1),
        timezone: 'UTC',
      },
      now,
    ),
    0,
  )
}

console.log('progression tests: ok')
