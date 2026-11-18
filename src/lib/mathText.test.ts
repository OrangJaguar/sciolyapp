import assert from 'node:assert/strict'
import { plainTokenToTex, renderMathHtml } from './mathText.ts'

const stem =
  'M31 contains roughly 5 x 10^9 solar masses of cold HI and H2 gas. Using depletion time = M_gas / SFR'

assert.equal(plainTokenToTex('5 x 10^9'), '5\\times 10^{9}')
assert.equal(plainTokenToTex('M_gas'), 'M_{gas}')
assert.equal(plainTokenToTex('H_2'), 'H_{2}')
assert.equal(plainTokenToTex('v^2'), 'v^{2}')

const html = renderMathHtml(stem)
assert.equal((html.match(/class="katex"/g) ?? []).length, 2)
assert.match(html, />9</)
assert.match(html, />g</)
assert.match(html, /HI and H2/)
assert.match(html, /M31 contains/)

const delimited = renderMathHtml('Energy $E=mc^2$ and $$\\frac{a}{b}$$')
assert.match(delimited, /katex/)
assert.match(delimited, /frac/)
assert.match(delimited, /Energy/)

console.log('mathText.test.ts ok')
