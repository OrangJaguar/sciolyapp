/** Static SVG twin for reduced-motion / canvas unavailable. */

const NODES = [
  { x: 72, y: 38, r: 3.2 },
  { x: 128, y: 48, r: 2.8 },
  { x: 156, y: 100, r: 3.4 },
  { x: 132, y: 152, r: 2.6 },
  { x: 68, y: 148, r: 3 },
  { x: 44, y: 96, r: 2.8 },
  { x: 100, y: 62, r: 2.4 },
  { x: 118, y: 118, r: 2.5 },
] as const

export function EventConstellationFallback() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-full w-full text-cyan"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="constellation-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="rgba(0,240,255,0.18)" />
          <stop offset="70%" stopColor="rgba(0,240,255,0)" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="url(#constellation-glow)" />
      <circle
        cx="100"
        cy="100"
        r="78"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.2"
      />
      <circle
        cx="100"
        cy="100"
        r="54"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.32"
      />
      <circle
        cx="100"
        cy="100"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.45"
      />
      <circle cx="100" cy="100" r="3.5" fill="currentColor" opacity="0.9" />
      {NODES.map((n, i) => (
        <g key={i}>
          <line
            x1="100"
            y1="100"
            x2={n.x}
            y2={n.y}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.22"
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill="currentColor"
            opacity="0.85"
          />
        </g>
      ))}
    </svg>
  )
}
