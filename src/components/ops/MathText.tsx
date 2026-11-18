import { useMemo } from 'react'
import 'katex/dist/katex.min.css'
import { renderMathHtml } from '../../lib/mathText'

/** Question copy. Renders `$...$` / `$$...$$` and plain forms like `10^9` and `M_gas`. */
export function MathText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const html = useMemo(() => renderMathHtml(text), [text])
  return (
    <span
      className={`math-prose ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
