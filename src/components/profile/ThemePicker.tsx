import { THEME_OPTIONS, type ThemePreference } from '../../lib/theme'
import { useTheme } from '../../features/theme/ThemeProvider'

const PREVIEW: Record<ThemePreference, { bg: string; border: string; accent: string }> = {
  hud: { bg: '#050505', border: 'rgba(132,148,149,0.35)', accent: '#00f0ff' },
  sleek: { bg: '#000000', border: 'rgba(255,255,255,0.35)', accent: '#ffffff' },
  paper: { bg: '#ffffff', border: 'rgba(0,0,0,0.35)', accent: '#000000' },
  system: { bg: 'linear-gradient(135deg,#000 50%,#fff 50%)', border: 'rgba(128,128,128,0.5)', accent: '#888888' },
}

export function ThemePicker() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {THEME_OPTIONS.map((opt) => {
        const active = preference === opt.id
        const preview = PREVIEW[opt.id]
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPreference(opt.id)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
              active
                ? 'hud-pill-active border-accent'
                : 'border-subtle bg-surface-elevated hover:border-[var(--border-hover)]'
            }`}
          >
            <span
              className="flex h-8 w-full items-center justify-center rounded-md border"
              style={{
                background: preview.bg,
                borderColor: preview.border,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: preview.accent }}
              />
            </span>
            <span
              className={`font-display text-sm font-semibold tracking-wide ${
                active ? 'text-[var(--on-accent)]' : 'text-foreground'
              }`}
            >
              {opt.label}
            </span>
            {opt.subtitle ? (
              <span
                className={`text-[10px] leading-tight ${
                  active ? 'text-[var(--on-accent)]/70' : 'text-dim'
                }`}
              >
                {opt.subtitle}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
