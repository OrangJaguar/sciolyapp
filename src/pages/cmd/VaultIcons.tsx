export function KindIcon({ kind }: { kind: string }) {
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-cyan" aria-hidden>
        <path fill="currentColor" d="M4 3.5v9l9-4.5-9-4.5z" />
      </svg>
    )
  }
  if (kind === 'link') {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-muted" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.4"
          d="M6.5 9.5 9.5 6.5M7 11.5l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L3.5 8M9 4.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L12.5 8"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-muted" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.4"
        d="M4 2.5h5.5L13 6v7.5H4v-11z"
      />
      <path stroke="currentColor" strokeWidth="1.4" d="M9.5 2.5V6H13" />
    </svg>
  )
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.4"
        d={
          open
            ? 'M2 5.5h12v7H2v-7zm0 0V4h4l1.5 1.5'
            : 'M2 4.5h4l1.5 1.5H14v7H2v-8.5z'
        }
      />
    </svg>
  )
}
