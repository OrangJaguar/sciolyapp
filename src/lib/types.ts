export type Division = 'B' | 'C'
export type TeamRole = 'coach' | 'captain' | 'officer' | 'member'
export type PlatformRole = 'user' | 'admin'

export type Profile = {
  id: string
  handle: string
  /** Preferred name for roster / HUD (set at onboarding). */
  display_name?: string | null
  /** School from onboarding; defaults team create school. */
  school_name?: string | null
  division: Division
  platform_role: PlatformRole
  avatar_id: string
  team_id: string | null
  xp: number
  /** Legacy cache only — UI derives rank from xp via progression.ts */
  rank_title: string
  current_streak: number
  /**
   * Local calendar date (YYYY-MM-DD) of last graded activity.
   * Server writes via scioly_local_date(timezone); not UTC-guaranteed.
   */
  last_activity_on?: string | null
  /** IANA TZ last seen on practice commit; used for streak/cap display. */
  timezone?: string | null
  /** Local date key for daily practice XP cap. */
  practice_xp_date?: string | null
  /** Base practice XP earned on practice_xp_date (pre-multiplier). */
  practice_xp_base?: number | null
  questions_answered: number
  visibility: 'public' | 'private'
  onboarding_complete: boolean
  created_at: string
}

export type Team = {
  id: string
  name: string
  school_name: string
  division: Division
  join_code_student: string
  join_code_admin: string
  /** Set when a coach verification is approved for this team. */
  verified?: boolean
  created_at: string
}

export type TaxonomyEvent = {
  id: string
  name: string
  division: Division
  domain: string
  test_component: string
  studyable: boolean
  season: number
  active: boolean
  official_scope: string | null
}

export type TaxonomyTopic = {
  id: string
  event_id: string
  name: string
  sort_order: number
}

export type CasualSessionParams = {
  eventId: string
  topicId: string | 'all'
}

export type QuestionOptions = {
  A: string
  B: string
  C: string
  D: string
}

export type Question = {
  id: string
  event_id: string
  topic_id: string | null
  concept_id: string | null
  question_type: 'mcq' | 'diagram' | 'calc'
  status: 'draft' | 'live' | 'archived'
  stem: string
  options: QuestionOptions
  correct_key: 'A' | 'B' | 'C' | 'D'
  explanation: string
}


