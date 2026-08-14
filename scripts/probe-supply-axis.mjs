// ⚖️ 6축 수급 축 소급 검증 — 앱의 실제 krSupply 점수 공식을 과거에 적용해 "점수↑ = 수익↑"인지 잰다
//   (2026-08-14 사용자 질문: "수급 축 비중을 조절하거나 빼야 하는 것 아닌가?")
//   ✅ 소급이 유효한 이유: 수급 점수는 가격 파생 성분이 없다(외인/기관/개인 순매수만) — CLAUDE.md 역인과 규칙의 예외.
//   공식(supplyScore.ts krSupply 와 자구 동일): 30 + min(쌍끌이연속×12,36) + 외인5일(±15/−12) + 기관5일(±15/−12) + 개인당일<0(+12)
//   데이터: .bt-supply-cache(대형·중형 182 + 코스닥 중소형 168 = 350종) · 상태 기준(축은 상시 랭킹 입력이므로 상태가 맞는 척도)
//   실행: node scripts/probe-supply-axis.mjs
import { readFileSync, readdirSync } from 'fs'

const CACHE = 'C:/Users/lindo/investment-school-portfolio/.bt-supply-cache'
const files = readdirSync(CACHE).filter(f => f.endsWith('.json'))
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
const clamp = n => Math.max(0, Math.min(100, Math.round(n)))

const HOR = [10, 20, 60]
const BUCKETS = [
  { name: '고수급(점수 ≥ 72)', min: 72, max: 101 },   // 쌍끌이+외인+기관 다 좋은 구간
  { name: '중간(31~71)', min: 31, max: 72 },
  { name: '저수급(≤ 30)', min: -1, max: 31 },          // 외인·기관 동반 매도 구간
]
const stats = {}; const symsB = {}
for (const b of BUCKETS) { stats[b.name] = { 10: [], 20: [], 60: [] }; symsB[b.name] = new Set() }
const base = { 10: [], 20: [], 60: [] }
const corrPairs = []   // [점수, 60봉 수익] 상관용
let okStocks = 0

for (const f of files) {
  let rows
  try { rows = JSON.parse(readFileSync(`${CACHE}/${f}`, 'utf8')) } catch { continue }
  if (!Array.isArray(rows) || rows.length < 200) continue
  okStocks++
  const c = rows.map(x => x.c), fr = rows.map(x => x.f), or_ = rows.map(x => x.o), ind = rows.map(x => x.i)
  for (let i = 60; i + 60 < c.length; i++) {
    if (!(c[i] > 0)) continue
    // krSupply 재현 — 쌍끌이 연속일수(오늘 포함 거꾸로), 5일 합, 개인 당일
    let dual = 0
    for (let k = i; k >= 0 && fr[k] > 0 && or_[k] > 0; k--) dual++
    let f5 = 0, o5 = 0
    for (let k = i - 4; k <= i; k++) { f5 += fr[k]; o5 += or_[k] }
    let s = 30
    s += Math.min(dual * 12, 36)
    s += f5 > 0 ? 15 : f5 < 0 ? -12 : 0
    s += o5 > 0 ? 15 : o5 < 0 ? -12 : 0
    s += ind[i] < 0 ? 12 : 0
    const score = clamp(s)
    const rets = {}; for (const h of HOR) rets[h] = (c[i + h] / c[i] - 1) * 100
    for (const h of HOR) base[h].push(rets[h])
    corrPairs.push([score, rets[60]])
    for (const b of BUCKETS) if (score >= b.min && score < b.max) {
      for (const h of HOR) stats[b.name][h].push(rets[h])
      symsB[b.name].add(f)
    }
  }
}

console.log(`종목 ${okStocks}종 · 관측 ${base[10].length.toLocaleString()}봉`)
console.log(`baseline 절사: 10봉 ${r2(avg(trim(base[10])))}% · 20봉 ${r2(avg(trim(base[20])))}% · 60봉 ${r2(avg(trim(base[60])))}%\n`)
for (const b of BUCKETS) {
  const st = stats[b.name]
  const line = HOR.map(h => {
    const e = avg(trim(st[h])) - avg(trim(base[h]))
    const w = st[h].filter(x => x > 0).length / st[h].length * 100
    return `${h}봉 ${e >= 0 ? '+' : ''}${r2(e)}%p(승률 ${Math.round(w)}%)`
  }).join(' · ')
  console.log(`▸ ${b.name} (n=${st[10].length.toLocaleString()} · ${symsB[b.name].size}종)`)
  console.log(`   ${line}`)
}
// 점수↔60봉 수익 상관계수 — 축이 랭킹 입력으로 의미 있으려면 최소한 양의 상관이 있어야 한다
const xs = corrPairs.map(p => p[0]), ys = corrPairs.map(p => p[1])
const mx = avg(xs), my = avg(ys)
let sxy = 0, sxx = 0, syy = 0
for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
console.log(`\n수급 점수 ↔ 60봉 수익 상관계수: ${(sxy / Math.sqrt(sxx * syy)).toFixed(4)} (n=${corrPairs.length.toLocaleString()})`)
