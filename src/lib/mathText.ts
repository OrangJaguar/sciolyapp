import katex from 'katex'

/** Explicit math, then the plain Scioly spellings (`10^9`, `M_gas`, `5 x 10^9`). */
const DELIMITED =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g

const PLAIN =
  /(?:\d+(?:\.\d+)?\s*[x×]\s*)?10\^(?:\{[^{}]+\}|-?\d+)|[A-Za-z][A-Za-z0-9]{0,10}(?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^-?\d+)+/g

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function plainTokenToTex(token: string): string {
  return token
    .replace(/\s*[x×]\s*/g, '\\times ')
    .replace(/_([A-Za-z0-9]+)/g, '_{$1}')
    .replace(/\^(-?\d+)/g, '^{$1}')
}

function renderTex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      throwOnError: false,
      displayMode: display,
      output: 'html',
    })
  } catch {
    return escapeHtml(tex)
  }
}

function renderPlain(text: string): string {
  let html = ''
  let last = 0
  for (const match of text.matchAll(PLAIN)) {
    const index = match.index ?? 0
    html += escapeHtml(text.slice(last, index))
    html += renderTex(plainTokenToTex(match[0]), false)
    last = index + match[0].length
  }
  html += escapeHtml(text.slice(last))
  return html
}

export function renderMathHtml(input: string): string {
  if (!input) return ''
  let html = ''
  let last = 0
  for (const match of input.matchAll(DELIMITED)) {
    const index = match.index ?? 0
    html += renderPlain(input.slice(last, index))
    const display = match[1] != null || match[2] != null
    const tex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    html += renderTex(tex, display)
    last = index + match[0].length
  }
  html += renderPlain(input.slice(last))
  return html
}
