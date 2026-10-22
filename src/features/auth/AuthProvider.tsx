import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

export type ProfileStatus = 'loading' | 'ready' | 'missing'

type AuthContextValue = {
  /** Auth client initialized (session known). Profile may still be loading. */
  ready: boolean
  configured: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  /**
   * When session exists:
   * - loading — fetch in flight
   * - ready — profile row loaded
   * - missing — fetch finished, no row (or error)
   * When no session: ready (N/A).
   */
  profileStatus: ProfileStatus
  refreshProfile: () => Promise<Profile | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('profile fetch', error)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(
    isSupabaseConfigured ? 'loading' : 'ready',
  )
  const profileUidRef = useRef<string | null>(null)

  const applyProfileForUser = useCallback(async (userId: string) => {
    const switched = profileUidRef.current !== userId
    // Only blank the app on a real account change. A refresh of the
    // current profile must not flip the route guard back to "Loading profile…".
    if (switched) {
      setProfile(null)
      setProfileStatus('loading')
      profileUidRef.current = userId
    }
    const next = await fetchProfile(userId)
    // Ignore stale responses if user changed mid-flight
    if (profileUidRef.current !== userId) return null
    setProfile(next)
    setProfileStatus(next ? 'ready' : 'missing')
    return next
  }, [])

  const clearProfile = useCallback(() => {
    profileUidRef.current = null
    setProfile(null)
    setProfileStatus('ready')
  }, [])

  const refreshProfile = useCallback(async () => {
    const uid =
      session?.user?.id ?? (await supabase?.auth.getUser())?.data.user?.id
    if (!uid) {
      clearProfile()
      return null
    }
    return applyProfileForUser(uid)
  }, [session?.user?.id, applyProfileForUser, clearProfile])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      setProfileStatus('ready')
      return
    }

    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session?.user) {
        await applyProfileForUser(data.session.user.id)
      } else {
        clearProfile()
      }
      if (!cancelled) setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) {
        void applyProfileForUser(next.user.id)
      } else {
        clearProfile()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [applyProfileForUser, clearProfile])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    clearProfile()
  }, [clearProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      profile,
      profileStatus: session ? profileStatus : 'ready',
      refreshProfile,
      signOut,
    }),
    [
      ready,
      session,
      profile,
      profileStatus,
      refreshProfile,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
