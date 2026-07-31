function Stub({ title, plan }: { title: string; plan: string }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div className="hud-panel w-full max-w-xl p-8 text-center">
        <p className="label-caps">{title}</p>
        <p className="mt-4 text-muted">Stub — {plan}</p>
      </div>
    </div>
  )
}

export function ProfilePage() {
  return <Stub title="Profile" plan="Plan 13" />
}

export function AdminPage() {
  return <Stub title="Admin Factory" plan="Plan 14" />
}

export function CasualStubPage() {
  return <Stub title="Casual Mode" plan="Plan 04" />
}

export function TimedStubPage() {
  return <Stub title="Timed Practice" plan="Plan 07" />
}

export function BinderStubPage() {
  return <Stub title="Binder Planner" plan="Plan 15" />
}
