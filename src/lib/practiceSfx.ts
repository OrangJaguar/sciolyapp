/** Soft UI beeps for Casual Check — Web Audio, fail quietly if blocked. */

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    sharedCtx ??= new AC()
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume().catch(() => {})
    }
    return sharedCtx
  } catch {
    return null
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gainPeak: number,
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

export function playPracticeSfx(kind: 'correct' | 'wrong'): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  try {
    if (kind === 'correct') {
      tone(ctx, 523.25, t, 0.09, 'sine', 0.045)
      tone(ctx, 659.25, t + 0.07, 0.11, 'sine', 0.04)
      tone(ctx, 783.99, t + 0.14, 0.16, 'triangle', 0.035)
    } else {
      tone(ctx, 196, t, 0.14, 'triangle', 0.04)
      tone(ctx, 155.56, t + 0.08, 0.18, 'sine', 0.035)
    }
  } catch {
    // ignore — autoplay / closed context
  }
}
