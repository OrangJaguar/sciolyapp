/**
 * Guest / marketing mock — values must be coherent with progression.ts.
 * Specialist Lv 20 ≈ 1000 + 9×150 = 2350 XP mid-band.
 */
export const demoUser = {
  handle: 'operative_alpha',
  rankTitle: 'Specialist Lv 20',
  rankName: 'Specialist',
  level: 20,
  xp: 2_425,
  xpProgress: 0.5,
  unit: 'NORTH HIGH',
  squad: 'VARSITY',
} as const

export { formatXp } from '../lib/progression'
