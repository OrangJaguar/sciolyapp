import { requireSupabase, supabase } from './supabase'

export type CoachVerificationStatus = 'pending' | 'approved' | 'rejected'

export type CoachVerification = {
  id: string
  user_id: string
  team_id: string | null
  school_name: string
  note: string
  status: CoachVerificationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type AdminCoachVerificationRow = {
  id: string
  user_id: string
  handle: string
  display_name: string | null
  team_id: string | null
  team_name: string | null
  school_name: string
  note: string
  status: CoachVerificationStatus
  created_at: string
  reviewed_at: string | null
}

export async function fetchMyCoachVerifications(): Promise<CoachVerification[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('coach_verifications')
    .select(
      'id, user_id, team_id, school_name, note, status, reviewed_by, reviewed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []) as CoachVerification[]
}

export async function requestCoachVerification(input: {
  schoolName: string
  note: string
}): Promise<CoachVerification> {
  const { data, error } = await requireSupabase().rpc(
    'request_coach_verification',
    {
      p_school_name: input.schoolName.trim(),
      p_note: input.note.trim(),
    },
  )
  if (error) throw error
  return data as CoachVerification
}

export async function adminListCoachVerifications(
  status: CoachVerificationStatus | 'all' = 'pending',
): Promise<AdminCoachVerificationRow[]> {
  const { data, error } = await requireSupabase().rpc(
    'admin_list_coach_verifications',
    { p_status: status },
  )
  if (error) throw error
  return (data ?? []) as AdminCoachVerificationRow[]
}

export async function adminReviewCoachVerification(
  id: string,
  status: 'approved' | 'rejected',
): Promise<CoachVerification> {
  const { data, error } = await requireSupabase().rpc(
    'admin_review_coach_verification',
    { p_id: id, p_status: status },
  )
  if (error) throw error
  return data as CoachVerification
}
