// 🧪 코스피 지수 × 외국인 수급 — "동행이냐 예측이냐" 최종 판정 (2026-08-14 사용자 최종 질문)
//   사용자 관찰: "외인이 들어오면 지수가 오르고 빠지면 내린다" → 이것이 ①같이 움직이는 것(동행)인지
//   ②미리 알려주는 것(예측)인지를 분리해서 잰다. 신호로 쓸 수 있으려면 ②가 있어야 한다.
//   데이터: 네이버 투자자별 매매동향(코스피 전체·억원·일별) + Yahoo ^KS11 종가 · 약 4년
//   실행: node scripts/probe-index-flow.mjs
import { createRequire } from 'module'
const require2 = createRequire('C:/Users/lindo/investment-school-portfolio/package.json')
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const num = s => parseFloat(String(s ?? '').replace(/[,+\s]/g, '')) || 0
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
function corr(xs, ys) {
  const mx = avg(xs), my = avg(ys)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxy / Math.sqrt(sxx * syy)
}

// ── ① 외인 일별 순매수(코스피 전체·억원) — bizdate 커서로 과거로 ──
const flow = new Map()   // 'YYYY-MM-DD' → 억원
let cursor = new Date()
for (let page = 0; page < 115; page++) {
  const bd = cursor.toISOString().slice(0, 10).replace(/-/g, '')
  try {
    const r = await fetch(`https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=${bd}&sosok=01`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    const t = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
    const rows = [...t.matchAll(/date2">(\d{2}\.\d{2}\.\d{2})<\/td>\s*<td[^>]*>([-\d,]+)<\/td>\s*<td[^>]*>([-\d,]+)<\/td>/g)]
    if (!rows.length) break
    let oldest = null
    for (const m of rows) {
      const iso = `20${m[1].replace(/\./g, '-')}`
      if (!flow.has(iso)) flow.set(iso, num(m[3]))    // m[2]=개인, m[3]=외국인
      oldest = iso
    }
    cursor = new Date(new Date(`${oldest}T00:00:00Z`).getTime() - 86_400_000)
  } catch { break }
  await new Promise(res => setTimeout(res, 100))
}
console.log(`외인 수급 ${flow.size}일 수집 (${[...flow.keys()].sort()[0]} ~ ${[...flow.keys()].sort().at(-1)})`)

// ── ② 코스피 종가(^KS11) ──
const ch = await yf.chart('^KS11', { period1: new Date(Date.now() - 4.6 * 365 * 864e5), interval: '1d' })
const px = (ch?.quotes ?? []).filter(q => typeof q.close === 'number' && q.close > 0)
  .map(q => ({ d: (q.date instanceof Date ? q.date : new Date(q.date)).toISOString().slice(0, 10), c: q.close }))

// 날짜 조인 — 둘 다 있는 날만
const days = px.filter(p => flow.has(p.d)).map(p => ({ d: p.d, c: p.c, f: flow.get(p.d) }))
console.log(`조인 ${days.length}일\n`)
const C = days.map(x => x.c), F = days.map(x => x.f)
const pref = (() => { const p = [0]; for (const v of F) p.push(p[p.length - 1] + v); return p })()
const sumF = (i, n) => pref[i + 1] - pref[i + 1 - n]
const ret = (i, n) => (C[i + n] / C[i] - 1) * 100
const retPast = (i, n) => (C[i] / C[i - n] - 1) * 100

// ── ③ 동행 — 같은 기간의 수급과 수익 ──
{
  const x1 = [], y1 = [], x20 = [], y20 = []
  for (let i = 1; i < days.length; i++) { x1.push(F[i]); y1.push((C[i] / C[i - 1] - 1) * 100) }
  for (let i = 20; i < days.length; i++) { x20.push(sumF(i, 20)); y20.push(retPast(i, 20)) }
  console.log('══ 동행(같은 기간) — 사용자가 본 현상 ══')
  console.log(`  당일 외인 순매수 ↔ 당일 지수 등락: 상관 ${corr(x1, y1).toFixed(3)}`)
  console.log(`  20일 누적 외인 ↔ 같은 20일 지수 수익: 상관 ${corr(x20, y20).toFixed(3)}`)
}

// ── ④ 예측 — 과거 수급 → 미래 수익 ──
console.log('\n══ 예측(과거 수급 → 미래 수익) — 신호로서의 가치 ══')
for (const [lb, fw] of [[5, 5], [20, 20], [20, 60], [60, 60]]) {
  const xs = [], ys = []
  for (let i = lb; i + fw < days.length; i++) { xs.push(sumF(i, lb)); ys.push(ret(i, fw)) }
  console.log(`  과거 ${lb}일 외인 누적 → 미래 ${fw}일 지수 수익: 상관 ${corr(xs, ys).toFixed(3)} (n=${xs.length})`)
}

// ── ⑤ 버킷 — 외인 20일 순매수 상위/하위 25% 이후 성적 ──
{
  const rows = []
  for (let i = 20; i + 20 < days.length; i++) rows.push({ f20: sumF(i, 20), fwd: ret(i, 20) })
  const sorted = [...rows].sort((a, b) => a.f20 - b.f20)
  const q = Math.floor(rows.length / 4)
  const bot = sorted.slice(0, q), top = sorted.slice(-q)
  const all = avg(rows.map(r => r.fwd))
  console.log('\n══ 버킷 — 외인 20일 순매수 상하위 25% 이후 1개월 ══')
  console.log(`  전체 평균 +${r2(all)}% | 외인 대량 매수 후: ${r2(avg(top.map(r => r.fwd)))}% (승률 ${Math.round(top.filter(r => r.fwd > 0).length / top.length * 100)}%) | 대량 매도 후: ${r2(avg(bot.map(r => r.fwd)))}% (승률 ${Math.round(bot.filter(r => r.fwd > 0).length / bot.length * 100)}%)`)
}
