import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5">
      <p className="data-mono text-center text-[10px] tracking-wide text-dim">
        Copyright © 2026 Developed by Sanskar Gupta. All Rights Reserved.
      </p>
      <nav className="flex items-center gap-3 text-[10px]">
        <Link to="/privacy" className="text-dim transition-colors hover:text-cyan">
          Privacy
        </Link>
        <Link to="/terms" className="text-dim transition-colors hover:text-cyan">
          Terms
        </Link>
      </nav>
    </div>
  )
}
