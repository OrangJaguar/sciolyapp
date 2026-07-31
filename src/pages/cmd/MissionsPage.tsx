import { demoUser } from '../../mocks/demoUser'

const upcoming = [
  { title: '50 casual problems', event: 'Astronomy', progress: 28, done: false },
  { title: '15 timed practice', event: 'Forensics', progress: null, done: true },
  { title: 'Read rules PDF', event: 'Dynamic Planet', progress: null, done: false },
]

const old = [
  { title: '25 casual problems', event: 'Anatomy' },
  { title: 'Quizlet vocab set', event: 'Astronomy' },
]

export function MissionsPage() {
  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[340px_1fr]">
      <aside className="hud-panel flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="hud-pill w-full justify-start px-4 py-2 text-xs text-muted">
            UNIT: {demoUser.unit}
          </div>
          <div className="hud-pill hud-pill-active w-full justify-start px-4 py-2 text-xs">
            SQUAD: {demoUser.squad}
          </div>
        </div>

        <section className="min-h-0">
          <p className="label-caps mb-2">Upcoming:</p>
          <p className="mb-3 data-mono text-[11px] text-muted">
            Due Friday, Nov 27th 23:59 (23h 46m)
          </p>
          <ul className="space-y-3">
            {upcoming.map((item) => (
              <li
                key={item.title + item.event}
                className={`flex items-center gap-2 text-sm ${
                  item.done ? 'text-dim line-through' : 'text-white'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.title}</div>
                  <div className="text-xs text-muted">/ {item.event}</div>
                </div>
                {item.progress != null && (
                  <div className="flex w-16 items-center gap-1">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-pill border border-cyan/30">
                      <div
                        className="stripe-progress h-full"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="data-mono text-[10px] text-cyan">
                      {item.progress}
                    </span>
                  </div>
                )}
                {!item.done && (
                  <span className="text-cyan" aria-hidden>
                    →
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-auto shrink-0 pt-2">
          <p className="label-caps mb-2" style={{ color: 'var(--text-dim)' }}>
            Old:
          </p>
          <ul className="space-y-2">
            {old.map((item) => (
              <li key={item.title} className="text-sm text-dim line-through">
                {item.title} / {item.event}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="grid shrink-0 gap-3 sm:grid-cols-2">
          <div className="hud-panel p-4">
            <p className="label-caps mb-2">Next Meeting</p>
            <p className="data-mono text-xl font-semibold">2024.12.11</p>
            <p className="mt-1 data-mono text-sm text-cyan">T-MINUS 1d 8h</p>
            <p className="mt-3 text-sm tracking-wide text-muted">ROOM 120A</p>
          </div>
          <div className="hud-panel p-4">
            <p className="label-caps mb-2">Next Comp</p>
            <p className="data-mono text-xl font-semibold">2025.01.24</p>
            <p className="mt-1 data-mono text-sm text-cyan">T-MINUS 1m 28d</p>
            <button
              type="button"
              className="mt-3 text-sm tracking-wide text-cyan underline underline-offset-4"
            >
              SYSTEM_INFO
            </button>
          </div>
        </div>

        <div className="hud-panel relative flex min-h-0 flex-1 flex-col p-5">
          <p className="label-caps">Targeted Practice</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-white md:text-4xl lg:text-5xl">
            Anatomy &amp; Physiology
          </h2>
          <p className="mt-2 flex items-center gap-2 text-base text-muted md:text-lg">
            <span className="text-cyan" aria-hidden>
              └
            </span>
            Endocrine
          </p>
          <div className="mt-auto flex items-end justify-between gap-4 pt-4">
            <div>
              <p className="label-caps" style={{ color: 'var(--text-muted)' }}>
                Current Accuracy
              </p>
              <p className="mt-1 data-mono text-3xl font-semibold text-cyan md:text-4xl">
                44%
              </p>
            </div>
            <button
              type="button"
              className="hud-pill px-8 py-3 text-sm text-cyan shadow-[0_0_20px_var(--cyan-dim)]"
              style={{ borderColor: 'var(--cyan)' }}
            >
              CASUAL →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
