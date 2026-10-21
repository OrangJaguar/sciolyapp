import {
  parsePracticeCommitResult,
  type PracticeSessionCommitResult,
} from './practiceCommit'
import { supabase } from './supabase'
import { clientTimezone } from './timezone'

export type TimedAnswerPayload = {
  question_id: string
  skipped: boolean
  is_correct: boolean | null
  response_ms: number | null
}

export type SubmitTimedSessionResult = PracticeSessionCommitResult

export async function submitTimedSession(input: {
  sessionToken: string
  eventId: string
  topicId: string | 'all'
  answers: TimedAnswerPayload[]
  elapsedMs: number | null
  timeLimitMs: number | null
  timezone?: string
}): Promise<SubmitTimedSessionResult> {
  if (!supabase) throw new Error('Supabase not configured')

  const payload = input.answers.map((a) => ({
    question_id: a.question_id,
    skipped: a.skipped,
    is_correct: a.skipped ? false : Boolean(a.is_correct),
    response_ms: a.skipped ? null : a.response_ms,
  }))

  const { data, error } = await supabase.rpc('submit_timed_session', {
    p_session_token: input.sessionToken,
    p_event_id: input.eventId,
    p_topic_id: input.topicId,
    p_answers: payload,
    p_timezone: input.timezone ?? clientTimezone(),
    p_elapsed_ms: input.elapsedMs,
    p_time_limit_ms: input.timeLimitMs,
  })

  if (error) throw error
  return parsePracticeCommitResult(data)
}
