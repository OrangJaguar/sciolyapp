export type ThemePreference = 'hud' | 'sleek' | 'paper' | 'system'
export type ResolvedTheme = 'hud' | 'sleek' | 'paper'

export const THEME_STORAGE_KEY = 'scioly.theme'

export const THEME_OPTIONS: {
  id: ThemePreference
  label: string
  subtitle?: string
}[] = [
  { id: 'hud', label: 'Ops Center' },
  { id: 'sleek', label: 'Sleek Dark' },
  { id: 'paper', label: 'Paper' },
  { id: 'system', label: 'System', subtitle: 'Matches your device' },
]

const VALID: ThemePreference[] = ['hud', 'sleek', 'paper', 'system']

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark = getSystemPrefersDark(),
): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'sleek' : 'paper'
  return preference
}

export function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'hud'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && VALID.includes(raw as ThemePreference)) {
      return raw as ThemePreference
    }
  } catch {
    /* localStorage blocked */
  }
  return 'hud'
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* localStorage blocked */
  }
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved
}

export function bootThemeScript(): string {
  return `(function(){try{var k='${THEME_STORAGE_KEY}';var v=localStorage.getItem(k)||'hud';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=v==='system'?(d?'sleek':'paper'):v;if(['hud','sleek','paper'].indexOf(t)<0)t='hud';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='hud'}})();`
}
