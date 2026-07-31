export const demoUser = {
  handle: 'operative_alpha',
  rankTitle: 'SPECIALIST',
  xp: 135_000,
  xpProgress: 0.71,
  unit: 'NORTH HIGH',
  squad: 'VARSITY',
} as const

export function formatXp(xp: number): string {
  if (xp >= 1000) {
    const k = xp / 1000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  }
  return String(xp)
}
