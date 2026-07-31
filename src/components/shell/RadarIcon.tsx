export function RadarIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
