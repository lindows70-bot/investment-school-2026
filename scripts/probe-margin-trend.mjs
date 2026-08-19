// 📈 마진 '개선 추세'가 6축 점수에 값하는가 — 앱 US 유니버스 전수 소급 측정
//
// 왜 소급이 유효한가: 마진 추세는 **가격 비의존**이라 역인과 오염이 없다(PSR·일목균형표를 죽인 그 문제).
//
// 데이터: 재무는 **SEC XBRL companyfacts**(무료·전체 이력 19개년). Yahoo fundamentalsTimeSeries 는
//   period1 과 무관하게 **연간 4~5개가 상한**이라 진입 시점이 3년에 몰려 해부 3단계(시점 분산)에서 죽는다.
//   주가는 Yahoo 일봉.
//
// ⛔ 룩어헤드 차단: 회계연도 종료일 D 의 재무는 그날 공개되지 않는다 → 진입일 = **10-K 실제 제출일(filed)**.
//    SEC 가 제출일을 주므로 추정 지연을 쓸 필요가 없다(이게 XBRL 을 쓰는 두 번째 이유).
// ⛔ baseline: ① 전체 평균 ② **같은 달 진입 코호트 평균**(시장 국면을 통째로 제거 — 이쪽이 진짜 엣지)
// ⛔ 핵심 질문은 "마진이 높으면 좋은가"가 아니라 **"레벨을 이미 보는데 추세가 뭘 더 주는가"** 다.
//    → 레벨 5분위 안에서 개선 vs 악화를 가른다.
import { createRequire } from 'module'
import fs from 'fs'
const require2 = createRequire(import.meta.url)
const YahooFinance = require2('yahoo-finance2').default
const YF = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

const UA = { 'User-Agent': 'investment-school-2026 lindows70@gmail.com' }
const HOLD = [126, 252]
const CACHE = '.margin-trend-obs.json'

const REV_TAGS = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax']
const OI_TAGS = ['OperatingIncomeLoss']

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
const ymd = (d) => new Date(d).toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 유니버스 (US 만 — SEC 커버리지) ─────────────────────────────────────────
function block(text, startRe) {
  const i = text.search(startRe); if (i < 0) return ''
  const j = text.indexOf('\n]', i); return j < 0 ? '' : text.slice(i, j)
}
const src = fs.readFileSync('src/lib/macroPhaseScreener.ts', 'utf8')
const US = [...new Set([...block(src, /const US_UNIVERSE/).matchAll(/ticker\s*:\s*'([^']+)'/g)].map((m) => m[1]))]
  .filter((t) => /^[A-Z.]{1,5}$/.test(t))

// ── SEC: 티커 → CIK ─────────────────────────────────────────────────────────
const tmap = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: UA }).then((r) => r.json())
const CIK = new Map(Object.values(tmap).map((v) => [v.ticker, String(v.cik_str).padStart(10, '0')]))
console.log(`US 유니버스 ${US.length}종 · CIK 매칭 ${US.filter((t) => CIK.has(t)).length}종\n`)

/** 한 태그의 연간(10-K·FY·~365일) 시계열 → Map(fyEnd → {v, filed}) — 같은 기간 중복은 **최초 제출**을 쓴다(정정 반영 금지=룩어헤드) */
async function concept(cik, tag) {
  const r = await fetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`, { headers: UA })
    .then((x) => (x.ok ? x.json() : null)).catch(() => null)
  if (!r) return null
  const out = new Map()
  // 단위 키는 USD 만이 아니다(외국 발행인은 EUR/GBP 등) — 배열인 통화 키를 모두 훑는다.
  // ⚠️ 매출·영업이익이 같은 통화여야 비율이 성립하므로 통화별로 나누지 않고 '가장 행이 많은' 통화 하나만 쓴다.
  const units = r.units && typeof r.units === 'object' ? r.units : {}
  const best = Object.values(units).filter(Array.isArray).sort((a, b) => b.length - a.length)[0]
  for (const u of best ?? []) {
    if (u.fp !== 'FY' || !u.start || !u.end || !u.filed) continue
    if ((new Date(u.end) - new Date(u.start)) / 86400_000 < 300) continue
    const prev = out.get(u.end)
    if (!prev || u.filed < prev.filed) out.set(u.end, { v: u.val, filed: u.filed })
  }
  return out.size ? out : null
}
async function firstOf(cik, tags) {
  for (const t of tags) { const m = await concept(cik, t); if (m) return m; await sleep(60) }
  return null
}

// ── 종목 1개 → 관측치 ───────────────────────────────────────────────────────
async function one(ticker) {
  const cik = CIK.get(ticker); if (!cik) return { obs: [], fail: 'cik' }
  const rev = await firstOf(cik, REV_TAGS); if (!rev) return { obs: [], fail: 'rev' }
  const oi = await firstOf(cik, OI_TAGS); if (!oi) return { obs: [], fail: 'oi' }

  const rows = [...rev.keys()].filter((k) => oi.has(k)).sort()
    .map((k) => ({ fy: k, filed: rev.get(k).filed > oi.get(k).filed ? rev.get(k).filed : oi.get(k).filed, om: rev.get(k).v > 0 ? (oi.get(k).v / rev.get(k).v) * 100 : null }))
    .filter((r) => r.om != null)
  if (rows.length < 3) return { obs: [], fail: 'rows' }

  let bars
  try {
    const c = await YF.chart(ticker, { period1: '2006-01-01', interval: '1d' })
    bars = (c?.quotes ?? []).filter((q) => num(q.close) > 0).map((q) => ({ d: ymd(q.date), c: q.close }))
  } catch { return { obs: [], fail: 'chart' } }
  if (bars.length < 500) return { obs: [], fail: 'bars' }
  const at = (dstr) => { let lo = 0, hi = bars.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].d >= dstr) { a = m; hi = m - 1 } else lo = m + 1 } return a }

  const obs = []
  for (let i = 2; i < rows.length; i++) {
    const c0 = rows[i], p1 = rows[i - 1], p2 = rows[i - 2]
    const ei = at(c0.filed); if (ei < 0) continue          // 진입 = 10-K 제출일 종가
    const e = bars[ei].c
    const r6 = ei + HOLD[0] < bars.length ? (bars[ei + HOLD[0]].c / e - 1) * 100 : null
    const r12 = ei + HOLD[1] < bars.length ? (bars[ei + HOLD[1]].c / e - 1) * 100 : null
    if (r6 == null && r12 == null) continue
    obs.push({ sym: ticker, entry: bars[ei].d, fy: c0.fy, om: c0.om, dOm: c0.om - p1.om, dOmPrev: p1.om - p2.om, r6, r12 })
  }
  return { obs, fail: null }
}

// ── 수집 ────────────────────────────────────────────────────────────────────
let ALL
if (process.argv.includes('--cache') && fs.existsSync(CACHE)) {
  ALL = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  console.log(`캐시 사용: 관측 ${ALL.length}건\n`)
} else {
  ALL = []
  const fails = {}
  let done = 0
  const q = [...US]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const t = q.shift(); if (!t) return
      const { obs, fail } = await one(t)
      if (fail) fails[fail] = (fails[fail] ?? 0) + 1
      ALL.push(...obs)
      if (++done % 40 === 0) console.log(`  …${done}/${US.length}종, 관측 ${ALL.length}건`)
      await sleep(80)
    }
  }))
  console.log(`\n수집 완료: 관측 ${ALL.length}건 / ${new Set(ALL.map((o) => o.sym)).size}종목 · 실패 ${JSON.stringify(fails)}`)
  fs.writeFileSync(CACHE, JSON.stringify(ALL))
}
const yrs0 = [...new Set(ALL.map((o) => o.entry.slice(0, 4)))].sort()
console.log(`진입 연도 ${yrs0.length}개: ${yrs0[0]}~${yrs0[yrs0.length - 1]}\n`)

// ── 코호트(같은 진입 연월) 평균으로 시장 국면 제거 ───────────────────────────
for (const k of ['r6', 'r12']) {
  const byM = new Map()
  for (const o of ALL) { if (o[k] == null) continue; const m = o.entry.slice(0, 7); (byM.get(m) ?? byM.set(m, []).get(m)).push(o[k]) }
  for (const o of ALL) {
    if (o[k] == null) { o[`a_${k}`] = null; continue }
    const a = byM.get(o.entry.slice(0, 7))
    o[`a_${k}`] = a.length < 3 ? null : o[k] - a.reduce((s, v) => s + v, 0) / a.length   // 동시 진입 3건 미만이면 코호트 무의미
  }
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const se = (a) => (a.length < 2 ? null : Math.sqrt(Math.max(0, a.reduce((s, v) => s + v * v, 0) / a.length - mean(a) ** 2)) / Math.sqrt(a.length))
const trim = (a) => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const f = (v, d = 2) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d))

function row(label, sel, key) {
  const g = ALL.filter((o) => o[`a_${key}`] != null && sel(o))
  if (g.length < 10) { console.log(`${label.padEnd(30)} n=${g.length} — 10 미만, 통계 아님`); return null }
  const a = g.map((o) => o[`a_${key}`])
  const cnt = {}; g.forEach((o) => (cnt[o.sym] = (cnt[o.sym] ?? 0) + 1))
  const top = (Math.max(...Object.values(cnt)) / g.length) * 100
  const out = { n: g.length, nSym: new Set(g.map((o) => o.sym)).size, top, yrs: new Set(g.map((o) => o.entry.slice(0, 4))).size, edge: mean(a), se: se(a), med: med(a), tr: mean(trim(a)), win: (g.filter((o) => o[`a_${key}`] > 0).length / g.length) * 100 }
  console.log(`${label.padEnd(30)} n=${String(out.n).padStart(4)} 종목${String(out.nSym).padStart(4)} 초과${f(out.edge)}±${out.se.toFixed(2)} 중위${f(out.med)} 절사${f(out.tr)} 승률${out.win.toFixed(0)}% 최다${out.top.toFixed(0)}% 연도${out.yrs}`)
  return out
}

for (const key of ['r6', 'r12']) {
  console.log(`\n═══ 전방 ${key === 'r6' ? '6개월' : '12개월'} · 같은 달 진입 코호트 대비 초과수익 %p ═══`)
  console.log('— 추세 단독 —')
  row('마진 개선(ΔOM>0)', (o) => o.dOm > 0, key)
  row('마진 악화(ΔOM<0)', (o) => o.dOm < 0, key)
  row('2년 연속 개선', (o) => o.dOm > 0 && o.dOmPrev > 0, key)
  row('2년 연속 악화', (o) => o.dOm < 0 && o.dOmPrev < 0, key)
  row('개선 ≥3%p', (o) => o.dOm >= 3, key)
  row('악화 ≤-3%p', (o) => o.dOm <= -3, key)

  const lv = ALL.filter((o) => o[`a_${key}`] != null).map((o) => o.om).sort((x, y) => x - y)
  const Q = (p) => lv[Math.floor(lv.length * p)]
  const [q20, q40, q60, q80] = [Q(0.2), Q(0.4), Q(0.6), Q(0.8)]
  console.log(`— 레벨 단독(앱이 이미 쓰는 것) · 5분위 경계 ${q20.toFixed(1)}/${q40.toFixed(1)}/${q60.toFixed(1)}/${q80.toFixed(1)}% —`)
  row('마진 상위20%', (o) => o.om >= q80, key)
  row('마진 하위20%', (o) => o.om < q20, key)

  console.log('— ⭐ 레벨 통제 후 추세 (핵심 질문) —')
  for (const [nm, band] of [['하위20%', (o) => o.om < q20], ['20~40%', (o) => o.om >= q20 && o.om < q40], ['40~60%', (o) => o.om >= q40 && o.om < q60], ['60~80%', (o) => o.om >= q60 && o.om < q80], ['상위20%', (o) => o.om >= q80]]) {
    const u = row(`  ${nm} × 개선`, (o) => band(o) && o.dOm > 0, key)
    const d = row(`  ${nm} × 악화`, (o) => band(o) && o.dOm < 0, key)
    if (u && d) console.log(`${''.padEnd(30)}   → 격차 ${f(u.edge - d.edge)}%p (합산 표준오차 ±${Math.sqrt(u.se ** 2 + d.se ** 2).toFixed(2)})`)
  }
}
// ── 🔬 확인 테스트: 효과가 '20~40% 밴드'에만 뜬 게 우연인가 메커니즘인가 ──────────
//  가설: 같은 1%p 라도 마진 8% 기업엔 영업이익 +12%, 30% 기업엔 +3% 다. 즉 의미 있는 건 %p 가 아니라
//        **상대 변화율(ΔOM / 직전 OM)** 이다. 가설이 맞으면 상대 변화율로 재면 전 밴드에서 나와야 한다.
//        특정 밴드에서만 계속 나온다면 그건 메커니즘이 아니라 그 셀을 주운 것이다.
for (const o of ALL) {
  const prev = o.om - o.dOm
  o.rel = Math.abs(prev) >= 2 ? (o.dOm / Math.abs(prev)) * 100 : null   // 직전 마진 2% 미만은 분모가 불안정
}
for (const key of ['r6', 'r12']) {
  console.log(`\n═══ 🔬 확인 테스트 · 상대 변화율 기준 · 전방 ${key === 'r6' ? '6개월' : '12개월'} ═══`)
  row('상대 개선 ≥20%', (o) => o.rel != null && o.rel >= 20, key)
  row('상대 악화 ≤-20%', (o) => o.rel != null && o.rel <= -20, key)
  const lv = ALL.filter((o) => o[`a_${key}`] != null).map((o) => o.om).sort((x, y) => x - y)
  const Q = (p) => lv[Math.floor(lv.length * p)]
  const [q20, q40, q60, q80] = [Q(0.2), Q(0.4), Q(0.6), Q(0.8)]
  for (const [nm, band] of [['하위20%', (o) => o.om < q20], ['20~40%', (o) => o.om >= q20 && o.om < q40], ['40~60%', (o) => o.om >= q40 && o.om < q60], ['60~80%', (o) => o.om >= q60 && o.om < q80], ['상위20%', (o) => o.om >= q80]]) {
    const u = row(`  ${nm} × 상대개선≥20%`, (o) => band(o) && o.rel != null && o.rel >= 20, key)
    const d = row(`  ${nm} × 상대악화≤-20%`, (o) => band(o) && o.rel != null && o.rel <= -20, key)
    if (u && d) console.log(`${''.padEnd(30)}   → 격차 ${f(u.edge - d.edge)}%p (±${Math.sqrt(u.se ** 2 + d.se ** 2).toFixed(2)}) · 절사격차 ${f(u.tr - d.tr)}%p`)
  }
}
console.log(`\n원본: ${CACHE} · 재분석은 --cache`)
