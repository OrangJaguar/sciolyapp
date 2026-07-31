const roster = Array.from({ length: 11 }, (_, i) => `Person ${i + 1}`)

const pinned = {
  author: 'COACH 1',
  body: 'PROTOCOL INITIATED. SYSTEM UPLINK ESTABLISHED. ALL OPERATIVES REPORT TO ROOM 120A FOR BRIEFING.',
  ago: '2W AGO',
}

const stream = [
  {
    author: 'COACH 1',
    body: 'DEPLOYING ENCRYPTION KEY FOR ASTRONOMY VAULT RESOURCES. CHECK ACTIVE LOADOUT.',
    ago: '1W AGO',
  },
  {
    author: 'COACH 1',
    body: 'TACTICAL UPDATE: INVITATIONAL IN T-MINUS 1M 28D. MISSION DEADLINES HARDENED.',
    ago: '1W AGO',
  },
]

function PostCard({
  author,
  body,
  ago,
}: {
  author: string
  body: string
  ago: string
}) {
  return (
    <article className="relative rounded-md border border-[var(--ghost-border)] bg-surface-elevated p-3 pr-12">
      <p className="label-caps mb-1.5 text-white">{author}</p>
      <p className="text-sm leading-relaxed tracking-wide text-muted uppercase">
        {body}
      </p>
      <p className="mt-2 text-right data-mono text-[10px] text-dim">{ago}</p>
      <div className="absolute top-1/2 right-0 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-[var(--ghost-border)] bg-surface">
        <span className="h-3 w-3 rounded-full border border-cyan/60" />
      </div>
    </article>
  )
}

export function CommsPage() {
  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[220px_1fr]">
      <aside className="hud-panel flex min-h-0 flex-col p-3">
        <p className="label-caps mb-2 shrink-0">Squad Roster</p>
        <button
          type="button"
          className="hud-pill mb-3 w-fit shrink-0 px-4 py-1.5 text-xs text-white"
        >
          VARSITY ▾
        </button>
        <ul className="min-h-0 space-y-2.5 overflow-y-auto">
          {roster.map((name) => (
            <li key={name} className="flex items-center gap-3">
              <span className="h-7 w-7 shrink-0 rounded-full border border-cyan/40 bg-surface-elevated" />
              <span className="text-sm text-muted">{name}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-h-0 flex-col gap-3">
        <section className="hud-panel shrink-0 space-y-2 p-3">
          <p className="label-caps">Pinned</p>
          <PostCard {...pinned} />
        </section>
        <section className="hud-panel flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto p-3">
          <p className="label-caps shrink-0">Active Stream</p>
          {stream.map((post) => (
            <PostCard key={post.body} {...post} />
          ))}
        </section>
      </div>
    </div>
  )
}
