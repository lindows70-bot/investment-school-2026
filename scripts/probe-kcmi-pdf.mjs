// 🔍 자본시장연구원 연구보고서 24-02 「ETF 시장의 개인투자자」 원문에서
//    화면 인용 수치(+25% / −33%)의 실존 여부를 확인한다 — 출처 없는 숫자는 지운다(⛔가짜 정밀 금지).
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')

const buf = readFileSync(process.env.TEMP + '/kcmi-etf-2402.pdf')
const p = new PDFParse({ data: new Uint8Array(buf) })
const r = await p.getText()
const text = r.text
console.log('PAGES:', r.pages ? r.pages.length : '?', 'CHARS:', text.length)

// ① 25%·33% 가 등장하는 모든 줄과 앞뒤 문맥
const lines = text.split(/\n/).map(l => l.trim())
for (let i = 0; i < lines.length; i++) {
  if (/(25|33)(\.\d)?\s*%/.test(lines[i]) || /[-−]\s*33/.test(lines[i])) {
    console.log(`\n[${i}] ${lines[i - 1] ?? ''}`)
    console.log(`>>> ${lines[i]}`)
    console.log(`    ${lines[i + 1] ?? ''}`)
  }
}

// ② '투자성과'·'수익률' 요약 구절
console.log('\n═══ 투자성과 구절 ═══')
for (let i = 0; i < lines.length; i++) {
  if (/(투자성과|순투자수익|평균.*수익률|수익률.*평균)/.test(lines[i]) && lines[i].length > 15) {
    console.log(`[${i}] ${lines[i]}`)
  }
}
await p.destroy()
