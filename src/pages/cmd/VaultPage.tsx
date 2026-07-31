import { useState } from 'react'
import { FolderIcon, KindIcon } from './VaultIcons'

const folders = [
  {
    name: 'ASTRONOMY',
    items: [
      { title: '2026 Astronomy Rules', kind: 'doc', ago: '2w ago' },
      { title: 'Scioly Astronomy Outline', kind: 'video', ago: '1w ago' },
      { title: 'Quizlet: Vocab', kind: 'link', ago: '1w ago' },
    ],
  },
  { name: 'ANATOMY AND PHYSIOLOGY', items: [] },
  { name: 'DYNAMIC PLANET', items: [] },
  { name: 'FORENSICS', items: [] },
  { name: 'ROCKS AND MINERALS', items: [] },
  { name: 'CHEMISTRY LAB', items: [] },
  { name: 'MACHINES', items: [] },
] as const

export function VaultPage() {
  const [open, setOpen] = useState('ASTRONOMY')
  const active = folders.find((f) => f.name === open)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3 rounded-pill border border-[var(--ghost-border)] bg-surface-elevated px-4 py-2.5">
        <span className="text-muted" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          placeholder="Search..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-dim"
        />
      </div>

      <div className="hud-panel grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1fr_260px]">
        <div className="min-h-0 overflow-y-auto border-b border-[var(--ghost-border)] p-3 lg:border-r lg:border-b-0">
          <ul className="space-y-1">
            {folders.map((folder) => {
              const isOpen = open === folder.name
              return (
                <li key={folder.name}>
                  <button
                    type="button"
                    onClick={() => setOpen(folder.name)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm tracking-wide uppercase transition-colors ${
                      isOpen
                        ? 'bg-surface-high text-cyan'
                        : 'text-white hover:bg-surface-elevated'
                    }`}
                  >
                    <FolderIcon open={isOpen} />
                    <span className="flex-1 font-medium">{folder.name}</span>
                    <span className="text-muted">▾</span>
                  </button>
                  {isOpen && folder.items.length > 0 && (
                    <ul className="ml-8 mt-1 space-y-1 border-l border-[var(--ghost-border)] pl-3">
                      {folder.items.map((item) => (
                        <li
                          key={item.title}
                          className="flex items-center gap-2 py-1.5 text-sm text-muted"
                        >
                          <KindIcon kind={item.kind} />
                          <span className="flex-1 text-white">{item.title}</span>
                          <span className="data-mono text-[10px]">{item.ago}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <aside className="min-h-0 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-caps">Active Loadout</p>
            <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_var(--cyan)]" />
          </div>
          <ul className="space-y-2">
            {(active?.items ?? []).map((item) => (
              <li
                key={item.title}
                className="rounded-md border border-[var(--ghost-border)] bg-surface-elevated p-3"
              >
                <div className="flex items-start gap-2">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wide text-white uppercase">
                      {item.title}
                    </p>
                    <p className="mt-1 data-mono text-[10px] text-muted">
                      {item.ago}
                    </p>
                  </div>
                </div>
              </li>
            ))}
            {(active?.items?.length ?? 0) === 0 && (
              <p className="text-sm text-dim">No resources equipped.</p>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}
