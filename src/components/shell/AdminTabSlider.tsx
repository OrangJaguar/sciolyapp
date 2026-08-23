import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

const mainTabs = [
  { to: '/admin/catalog', label: 'CATALOG' },
  { to: '/admin/generate', label: 'GENERATE' },
  { to: '/admin/review', label: 'REVIEW' },
  { to: '/admin/import', label: 'IMPORT' },
] as const

type Secondary = { value: string; label: string }

const secondaryBySection: Record<string, Secondary[]> = {
  catalog: [
    { value: 'curriculum', label: 'Curriculum' },
    { value: 'prompts', label: 'Prompt packs' },
    { value: 'media', label: 'Event media' },
  ],
  generate: [
    { value: 'workbench', label: 'Workbench' },
    { value: 'jobs', label: 'Jobs' },
  ],
  review: [
    { value: 'waiting', label: 'Waiting' },
    { value: 'human', label: 'Needs you' },
    { value: 'audit', label: 'Audit' },
  ],
  import: [
    { value: 'import', label: 'Import' },
    { value: 'batches', label: 'Batches' },
  ],
}

function sectionKey(pathname: string): keyof typeof secondaryBySection {
  if (pathname.startsWith('/admin/generate')) return 'generate'
  if (pathname.startsWith('/admin/review')) return 'review'
  if (pathname.startsWith('/admin/import')) return 'import'
  return 'catalog'
}

function defaultV(section: keyof typeof secondaryBySection): string {
  return secondaryBySection[section][0].value
}

export function AdminTabSlider() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const section = sectionKey(pathname)
  const secondary = secondaryBySection[section]
  const v = params.get('v') ?? defaultV(section)
  const mainIndex = Math.max(
    0,
    mainTabs.findIndex((tab) => pathname.startsWith(tab.to)),
  )

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div
        role="group"
        aria-label="Admin section"
        className="relative flex h-9 w-[min(100%,28rem)] shrink-0 items-center rounded-pill border border-[var(--ghost-border)] bg-surface-elevated p-1"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(25%-2px)] rounded-pill bg-cyan shadow-[0_0_16px_var(--cyan-glow)] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${mainIndex * 100}%)` }}
        />
        {mainTabs.map((tab, tabIndex) => (
          <button
            key={tab.to}
            type="button"
            onClick={() => {
              const key = sectionKey(tab.to)
              navigate(`${tab.to}?v=${defaultV(key)}`)
            }}
            className={`relative z-10 min-w-0 flex-1 cursor-pointer py-1 text-center text-[11px] font-bold tracking-[0.14em] transition-colors duration-300 ${
              tabIndex === mainIndex
                ? 'text-[var(--on-accent)]'
                : 'text-muted hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label="Admin subsection"
        className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1"
      >
        {secondary.map((item) => {
          const active = v === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                navigate(`${mainTabs[mainIndex].to}?v=${item.value}`)
              }
              className={`rounded-pill border px-3 py-2 text-[10px] tracking-[0.06em] transition-colors ${
                active
                  ? 'border-cyan/50 bg-cyan/10 font-semibold text-cyan'
                  : 'border-transparent font-medium text-dim hover:border-white/10 hover:text-muted'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
