import { Outlet } from 'react-router-dom'

export function AdminShell() {
  return (
    <div className="h-full min-h-0 w-full overflow-hidden">
      <Outlet />
    </div>
  )
}

export function AdminComingSoon({
  eyebrow,
  title,
  plan,
  children,
}: {
  eyebrow: string
  title: string
  plan: string
  children: string
}) {
  return (
    <div className="hud-panel flex h-full min-h-0 items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <p className="label-caps text-[9px] text-dim">{eyebrow}</p>
        <h2 className="mt-2 font-display text-xl text-foreground">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{children}</p>
        <p className="mt-4 data-mono text-[10px] text-cyan">{plan}</p>
      </div>
    </div>
  )
}
