// 🔍 확인: "싼 고마진"이 12개월에 -8.9%p(3.6σ)로 최악인 이유가 **경기순환주 이익 정점**인가
//  가설: 반도체·에너지·소재는 사이클 꼭대기에서 마진도 높고 PER 도 낮아 보인다(정점 이익).
//        맞다면 그 셀이 순환 섹터에 쏠려 있어야 하고, 방어 섹터만 남기면 열위가 사라져야 한다.
import { createRequire } from 'module'
import fs from 'fs'
const require2 = createRequire(import.meta.url)
const YahooFinance = require2('yahoo-finance2').default
const YF = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

const ALL = JSON.parse(fs.readFileSync('.margin-trend-obs.json', 'utf8'))
const syms = [...new Set(ALL.map((o) => o.sym))]
const SEC_CACHE = '.margin-sector.json'

let SEC = fs.existsSync(SEC_CACHE) ? JSON.parse(fs.readFileSync(SEC_CACHE, 'utf8')) : {}
const todo = syms.filter((s) => !SEC[s])
if (todo.length) {
  const q = [...todo]
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (;;) {
      const s = q.shift(); if (!s) return
      try {
        const r = await YF.quoteSummary(s, { modules: ['assetProfile'] })
        SEC[s] = r?.assetProfile?.sector ?? '?'
      } catch { SEC[s] = '?' }
    }
  }))
  fs.writeFileSync(SEC_CACHE, JSON.stringify(SEC))
}
console.log(`섹터 확보 ${Object.values(SEC).filter((v) => v !== '?').length}/${syms.length}종목\n`)

// 코호트 조정 재계산 (원본 스크립트와 동일 규약)
for (const k of ['r6', 'r12']) {
  const byM = new Map()
  for (const o of ALL) { if (o[k] == null) continue; const m = o.entry.slice(0, 7); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(o[k]) }
  for (const o of ALL) {
    const a = o[k] == null ? null : byM.get(o.entry.slice(0, 7))
    o[`a_${k}`] = !a || a.length < 3 ? null : o[k] - a.reduce((s, v) => s + v, 0) / a.length
  }
  }
for (const o of ALL) o.sector = SEC[o.sym] ?? '?'

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const se = (a) => (a.length < 2 ? null : Math.sqrt(Math.max(0, a.reduce((s, v) => s + v * v, 0) / a.length - mean(a) ** 2)) / Math.sqrt(a.length))
const trim = (a) => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const f = (v, d = 2) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d))

// '싼 고마진' 셀 정의 (원본과 동일)
const lv = ALL.map((o) => o.om).sort((a, b) => a - b)
const M80 = lv[Math.floor(lv.length * 0.8)]
const prof = ALL.filter((o) => o.ey != null && o.ey > 0)
const eyS = prof.map((o) => o.ey).sort((a, b) => a - b)
const E67 = eyS[Math.floor(eyS.length * (2 / 3))]
const cell = ALL.filter((o) => o.om >= M80 && o.ey != null && o.ey >= E67)

console.log(`'싼 고마진' 셀 = 영업이익률 ≥${M80.toFixed(1)}% AND 이익수익률 ≥${E67.toFixed(1)}% → ${cell.length}건\n`)

// ① 이 셀이 어떤 섹터에 쏠려 있나 (전체 표본 대비)
const cnt = (arr) => { const m = {}; arr.forEach((o) => (m[o.sector] = (m[o.sector] ?? 0) + 1)); return m }
const cCell = cnt(cell), cAll = cnt(ALL)
console.log('섹터 구성 — 셀 비중 vs 전체 비중')
Object.entries(cCell).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => {
  console.log(`  ${s.padEnd(24)} ${String(n).padStart(3)}건  셀 ${(n / cell.length * 100).toFixed(1).padStart(5)}%  vs 전체 ${((cAll[s] ?? 0) / ALL.length * 100).toFixed(1).padStart(5)}%`)
})

// ② 순환 섹터를 빼면 열위가 사라지나
const CYC = new Set(['Technology', 'Energy', 'Basic Materials', 'Industrials', 'Consumer Cyclical', 'Real Estate'])
for (const key of ['r6', 'r12']) {
  console.log(`\n전방 ${key === 'r6' ? '6개월' : '12개월'} · '싼 고마진' 셀`)
  for (const [nm, sel] of [['전체', () => true], ['순환 섹터만', (o) => CYC.has(o.sector)], ['비순환(방어)만', (o) => !CYC.has(o.sector) && o.sector !== '?']]) {
    const g = cell.filter((o) => o[`a_${key}`] != null && sel(o))
    if (g.length < 10) { console.log(`  ${nm.padEnd(16)} n=${g.length} — 10 미만, 통계 아님`); continue }
    const a = g.map((o) => o[`a_${key}`])
    const m = {}; g.forEach((o) => (m[o.sym] = (m[o.sym] ?? 0) + 1))
    console.log(`  ${nm.padEnd(16)} n=${String(g.length).padStart(3)} 종목${String(new Set(g.map((o) => o.sym)).size).padStart(3)} 초과${f(mean(a))}±${se(a).toFixed(2)} 절사${f(mean(trim(a)))} 승률${(g.filter((o) => o[`a_${key}`] > 0).length / g.length * 100).toFixed(0)}% 최다${(Math.max(...Object.values(m)) / g.length * 100).toFixed(0)}% 연도${new Set(g.map((o) => o.entry.slice(0, 4))).size}`)
  }
}

// ③ 정점 이익 가설의 직접 증거 — 이 셀의 마진이 '자기 종목 이력 대비' 어디쯤인가
// ⛔ 룩어헤드 차단: 분위는 **그 시점까지 이미 공시된 연도만**으로 계산한다.
//    (처음엔 종목의 전 기간 마진으로 계산했는데, 그러면 2015년 판정에 2020년 마진이 들어간다.)
const byS = new Map()
for (const o of ALL) { if (!byS.has(o.sym)) byS.set(o.sym, []); byS.get(o.sym).push(o) }
for (const [, arr] of byS) arr.sort((a, b) => a.entry.localeCompare(b.entry))
const pct = (o) => {
  const past = byS.get(o.sym).filter((x) => x.entry <= o.entry).map((x) => x.om)
  return past.length < 4 ? null : (past.filter((v) => v <= o.om).length / past.length) * 100
}
const cellP = cell.map(pct).filter((v) => v != null)
const allP = ALL.map(pct).filter((v) => v != null)
console.log(`\n🔍 정점 이익 검사 — 그 해 마진이 '그 종목 자기 이력' 중 몇 분위인가`)
console.log(`   '싼 고마진' 셀 평균 ${mean(cellP).toFixed(1)}분위  ·  전체 평균 ${mean(allP).toFixed(1)}분위`)
console.log(`   셀에서 자기 이력 최고치(=100분위) 비중: ${(cellP.filter((v) => v >= 99).length / cellP.length * 100).toFixed(1)}%  ·  전체 ${(allP.filter((v) => v >= 99).length / allP.length * 100).toFixed(1)}%`)

// ④ ⭐ 가격을 전혀 쓰지 않는 순수 재무 버전 — 이게 실제로 점수에 넣을 수 있는 형태다.
//    이익수익률로 조건을 걸면 가격 파생이라 소급 검증이 오염된다(역인과). '자기 이력 대비 마진 위치'는
//    재무제표만으로 나오므로 소급이 유효하고, 그대로 6축에 넣을 수 있다.
console.log(`\n═══ ⭐ 순수 재무 신호: '자기 이력 대비 마진 위치'(가격 미사용) ═══`)
for (const o of ALL) o.selfPct = pct(o)
function line(label, sel, key) {
  const g = ALL.filter((o) => o[`a_${key}`] != null && o.selfPct != null && sel(o))
  if (g.length < 10) { console.log(`  ${label.padEnd(28)} n=${g.length} — 10 미만`); return null }
  const a = g.map((o) => o[`a_${key}`])
  const m = {}; g.forEach((o) => (m[o.sym] = (m[o.sym] ?? 0) + 1))
  const r = { n: g.length, edge: mean(a), se: se(a), tr: mean(trim(a)) }
  console.log(`  ${label.padEnd(28)} n=${String(r.n).padStart(4)} 종목${String(new Set(g.map((o) => o.sym)).size).padStart(4)} 초과${f(r.edge)}±${r.se.toFixed(2)} 절사${f(r.tr)} 승률${(g.filter((o) => o[`a_${key}`] > 0).length / g.length * 100).toFixed(0)}% 최다${(Math.max(...Object.values(m)) / g.length * 100).toFixed(0)}% 연도${new Set(g.map((o) => o.entry.slice(0, 4))).size}`)
  return r
}
for (const key of ['r6', 'r12']) {
  console.log(`전방 ${key === 'r6' ? '6개월' : '12개월'}`)
  const hi = line('자기 이력 최고 마진(100분위)', (o) => o.selfPct >= 99, key)
  line('상위권(80~99분위)', (o) => o.selfPct >= 80 && o.selfPct < 99, key)
  line('중간(20~80분위)', (o) => o.selfPct >= 20 && o.selfPct < 80, key)
  const lo = line('하위권(<20분위)', (o) => o.selfPct < 20, key)
  if (hi && lo) console.log(`${''.padEnd(30)}→ 최고−하위 ${f(hi.edge - lo.edge)}%p · 절사 ${f(hi.tr - lo.tr)}%p`)
  // 절대 레벨과 겹치는지 — 앱의 marginScore 는 절대 레벨이다
  const M80b = lv[Math.floor(lv.length * 0.8)]
  line('고마진 AND 자기최고', (o) => o.om >= M80b && o.selfPct >= 99, key)
  line('고마진 AND 자기최고 아님', (o) => o.om >= M80b && o.selfPct < 99, key)
}
