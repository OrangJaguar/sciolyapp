import { Link } from 'react-router-dom'
import { landingCopy } from '../../lib/landingCopy'

export function MarketingFooter() {
  const { footer } = landingCopy
  return (
    <footer className="border-t border-subtle/80 px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="data-mono text-center text-[10px] tracking-wide text-dim sm:text-left">
          {footer.copyright}
        </p>
        <nav className="flex items-center gap-4 text-[11px]">
          <Link
            to="/privacy"
            className="text-muted transition-colors hover:text-cyan"
          >
            {footer.privacy}
          </Link>
          <Link
            to="/terms"
            className="text-muted transition-colors hover:text-cyan"
          >
            {footer.terms}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
