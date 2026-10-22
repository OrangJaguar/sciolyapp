import type { ReactNode } from 'react'
import { badgeAssetUrl } from './badges'
import { requireSupabase } from './supabase'

/** Keys match /public/avatars/default_{key}.png */
export type AvatarKey =
  | 'atom'
  | 'dna'
  | 'flask'
  | 'microscope'
  | 'brain'
  | 'rocket'

export const DEFAULT_AVATARS: {
  key: AvatarKey
  label: string
  src: string
}[] = [
  { key: 'atom', label: 'Atom', src: '/avatars/default_atom.png' },
  { key: 'dna', label: 'DNA', src: '/avatars/default_dna.png' },
  { key: 'flask', label: 'Flask', src: '/avatars/default_flask.png' },
  {
    key: 'microscope',
    label: 'Microscope',
    src: '/avatars/default_microscope.png',
  },
  { key: 'brain', label: 'Brain', src: '/avatars/default_brain.png' },
  { key: 'rocket', label: 'Rocket', src: '/avatars/default_rocket.png' },
]

const BY_KEY = new Map(DEFAULT_AVATARS.map((a) => [a.key, a]))

/** Normalize profiles.avatar_id → known asset key. */
export function resolveAvatarKey(
  avatarId: string | null | undefined,
): AvatarKey {
  const raw = String(avatarId ?? 'atom').toLowerCase().trim()
  if (raw === 'default' || raw === '') return 'atom'
  const stripped = raw.replace(/^default_/, '') as AvatarKey
  if (BY_KEY.has(stripped)) return stripped
  if (BY_KEY.has(raw as AvatarKey)) return raw as AvatarKey
  return 'atom'
}

export function defaultAvatarId(key: AvatarKey): string {
  return `default_${key}`
}

export function badgeAvatarId(badgeId: string): string {
  return `badge:${badgeId}`
}

export function badgeIdFromAvatar(
  avatarId: string | null | undefined,
): string | null {
  const raw = String(avatarId ?? '').trim()
  if (!raw.startsWith('badge:')) return null
  const id = raw.slice('badge:'.length)
  return id || null
}

export function avatarAssetUrl(avatarId: string | null | undefined): string {
  const badgeId = badgeIdFromAvatar(avatarId)
  if (badgeId) return badgeAssetUrl(badgeId, { earned: true })
  const key = resolveAvatarKey(avatarId)
  return BY_KEY.get(key)!.src
}

/** Persist a standard mark or an earned badge portrait. */
export async function setMyAvatar(avatarId: string): Promise<void> {
  const { data, error } = await requireSupabase().rpc('set_my_avatar', {
    p_avatar_id: avatarId,
  })
  if (error) throw error
  const row = data as { ok?: boolean; error?: string } | null
  if (row && row.ok === false) {
    throw new Error(row.error || 'Could not set profile picture')
  }
}

/** Theme-aware avatar glyph (white PNG → currentColor). */
export function AvatarMark({
  avatarId,
  className = 'h-8 w-8',
}: {
  avatarId?: string | null
  className?: string
}): ReactNode {
  const src = avatarAssetUrl(avatarId)
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
