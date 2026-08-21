// 🧭 섹터 로테이션 시계 전략 시뮬레이션 (2026-08-20 사용자 요청)
//   규칙 B(사용자 원칙): 태동(improving)→주도(leading) 진입 시 그 섹터 매수 · 이탈(lagging) 진입 시 매도
//                        (주도·과열 동안 보유 — 과열은 팔지 않는다)
//   대조 3종: A 상태 규칙(주도∪과열에 있는 동안 보유) · C 17섹터 균등 상시보유(baseline) ·
//             D 반대 대조군(이탈∪태동 보유 — 시계에 정보가 있다면 A·B보다 나빠야 한다)
//
//   재현 충실도: 사분면 공식·멤버십 = 프로덕션 SSOT(sector-rotation route + sectorConfigs 17섹터).
//   시점 재현: 날짜 D 판정은 D까지 캔들만(룩어헤드 없음) · 신호 다음 날부터 보유 반영(당일 종가 진입 낙관 배제).
//   근사(정직): 1M/1W = 자기 봉 기준 21/5봉 · 섹터 수익률 = 구성종목 동일가중(ETF 아님) ·
//               수수료·세금·슬리피지 미반영 · 미보유 구간 현금 이자 0.
import { createRequire } from 'module'
import fs from 'fs'
const require2 = createRequire(import.meta.url)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const CACHE = `${ROOT}/.rot-strategy-candles.json`

// ── 17섹터 멤버십 파싱(sectorConfigs + quantumUniverse) ──────────────────────
function parseMembers() {
  const cfg = fs.readFileSync(`${ROOT}/src/lib/sectorConfigs.ts`, 'utf8')
  const qtm = fs.readFileSync(`${ROOT}/src/lib/quantumUniverse.ts`, 'utf8')
  const members = {}
  const blocks = cfg.split(/const \w+_CONFIG: SectorConfig = \{/).slice(1)
  for (const b of blocks) {
    const key = b.match(/key: '([^']+)'/)?.[1]
    if (!key) continue
    const stocksVar = b.match(/stocks: (\w+)/)?.[1]
    if (!stocksVar) continue
    const src = stocksVar === 'QUANTUM_STOCKS' ? qtm : cfg
    const av = stocksVar === 'QUANTUM_STOCKS'
      ? [null, src]                                    // 양자는 파일 전체에서 긁는다(어댑터 구조)
      : src.match(new RegExp(`const ${stocksVar}[^=]*= \\[([\\s\\S]*?)\\n\\]`))
    if (!av) continue
    const rows = [...av[1].matchAll(/ticker: '([^']+)'[^}]*market: '(KR|US)'/g)]
    const syms = [...new Set(rows.map(m => (m[2] === 'KR' ? `${m[1].replace(/\D/g, '')}.KS` : m[1])))]
    if (syms.length >= 5) members[key] = syms
  }
  return members
}
const MEMBERS = parseMembers()
// 🔬 --gics-only: 테마 6 제외 대조 — 테마 멤버는 '오늘의 승자'로 최근 선별된 것이라 과거로 소급하면
//    생존·선별 편향이 들어간다(SPCX 함정과 같은 모양). GICS 11 은 대형주라 멤버십이 역사적으로 안정.
const GICS11 = ['energy', 'materials', 'industrials', 'discretionary', 'staples', 'healthcare', 'financials', 'infotech', 'communication', 'utilities', 'realestate']
if (process.argv.includes('--gics-only')) for (const k of Object.keys(MEMBERS)) if (!GICS11.includes(k)) delete MEMBERS[k]
const KEYS = Object.keys(MEMBERS)
const KO = { energy:'에너지', materials:'소재', industrials:'산업재', discretionary:'자유소비재', staples:'필수소비재', healthcare:'헬스케어', financials:'금융', infotech:'정보기술', communication:'커뮤니케이션', utilities:'유틸리티', realestate:'부동산', quantum:'양자컴퓨팅', 'ai-semi':'AI반도체', power:'AI전력망', 'phys-ai':'피지컬AI', 'ai-bio':'AI바이오', defense:'우주항공방산' }
console.log(`섹터 ${KEYS.length}개: ${KEYS.map(k => `${KO[k] ?? k}(${MEMBERS[k].length})`).join(' ')}`)

// ── 캔들 로딩(5.3년) ─────────────────────────────────────────────────────────
const allSyms = [...new Set(Object.values(MEMBERS).flat())]
let RAW
if (process.argv.includes('--cache') && fs.existsSync(CACHE)) {
  RAW = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  console.log(`캔들 캐시 사용: ${Object.keys(RAW).length}종`)
} else {
  RAW = {}
  let done = 0
  const q = [...allSyms]
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const s = q.shift(); if (!s) return
      try {
        const r = await yf.chart(s, { period1: new Date(Date.now() - 5.3 * 365 * 864e5), interval: '1d' })
        const rows = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0)
        if (rows.length >= 260) RAW[s] = {
          d: rows.map(x => (x.date instanceof Date ? x.date : new Date(x.date)).toISOString().slice(0, 10)),
          c: rows.map(x => x.close),
        }
      } catch { /* skip */ }
      if (++done % 50 === 0) process.stdout.write(`\r  캔들 ${done}/${allSyms.length}`)
    }
  }))
  fs.writeFileSync(CACHE, JSON.stringify(RAW))
  console.log(`\n캔들 확보 ${Object.keys(RAW).length}/${allSyms.length}종`)
}

// ── 공통 날짜 그리드 + 멤버별 정렬 인덱스 ────────────────────────────────────
const GRID = [...new Set(Object.values(RAW).flatMap(v => v.d))].sort()
const G = GRID.length
console.log(`날짜 그리드 ${G}일 (${GRID[0]} ~ ${GRID[G - 1]})\n`)
// 멤버별: gi → 자기 봉 인덱스(li, 그날 이하 마지막 봉) · 그리드 종가
const MEM = {}
for (const [s, v] of Object.entries(RAW)) {
  const li = new Int32Array(G).fill(-1)
  const cg = new Float64Array(G).fill(NaN)
  let j = -1
  for (let gi = 0; gi < G; gi++) {
    while (j + 1 < v.d.length && v.d[j + 1] <= GRID[gi]) j++
    li[gi] = j
    if (j >= 0) cg[gi] = v.c[j]
  }
  MEM[s] = { li, cg, c: v.c }
}

// ── 섹터별 일일 수익률 + 사분면 시계열 ───────────────────────────────────────
const secRet = {}   // key → Float64Array(G) 일일 수익률(동일가중)
const secQ = {}     // key → Array(G) quadrant | null
for (const k of KEYS) { secRet[k] = new Float64Array(G); secQ[k] = new Array(G).fill(null) }

for (let gi = 1; gi < G; gi++) {
  const day = {}
  for (const k of KEYS) {
    let sr = 0, srn = 0
    const m1 = [], w1 = []
    for (const s of MEMBERS[k]) {
      const m = MEM[s]; if (!m) continue
      const a = m.cg[gi], b = m.cg[gi - 1]
      if (isFinite(a) && isFinite(b) && b > 0) { sr += a / b - 1; srn++ }
      const l = m.li[gi]
      if (l >= 21) { m1.push(m.c[l] / m.c[l - 21] - 1); w1.push(m.c[l] / m.c[l - 5] - 1) }
    }
    if (srn >= 5) secRet[k][gi] = sr / srn
    if (m1.length >= 5) day[k] = { m: m1.reduce((x, y) => x + y, 0) / m1.length * 100, w: w1.reduce((x, y) => x + y, 0) / w1.length * 100 }
  }
  const ks = Object.keys(day)
  if (ks.length < 10) continue
  const mm = ks.reduce((s, k) => s + day[k].m, 0) / ks.length
  const mw = ks.reduce((s, k) => s + day[k].w, 0) / ks.length
  for (const k of ks) {
    const rs = day[k].m - mm, mom = day[k].w - mw
    secQ[k][gi] = rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging'
  }
}

// ── 전략 시뮬레이션 ──────────────────────────────────────────────────────────
const START = 300   // 워밍업(224봉 근사 + 여유)
function simulate(rule) {
  // rule(k, gi, held) → 보유해야 하나(오늘 신호 기준 — 반영은 내일부터)
  const held = new Set()
  const pending = new Map()   // 내일부터 적용할 변경
  const daily = new Float64Array(G)
  const trips = []            // { k, in, out }
  const open = {}
  for (let gi = START; gi < G; gi++) {
    for (const [k, on] of pending) {
      if (on && !held.has(k)) { held.add(k); open[k] = gi }
      if (!on && held.has(k)) { held.delete(k); trips.push({ k, in: open[k], out: gi }); delete open[k] }
    }
    pending.clear()
    if (held.size) {
      let s = 0
      for (const k of held) s += secRet[k][gi]
      daily[gi] = s / held.size
    }
    for (const k of KEYS) {
      const want = rule(k, gi, held.has(k))
      if (want != null && want !== held.has(k)) pending.set(k, want)
    }
  }
  for (const k of held) trips.push({ k, in: open[k], out: G - 1 })
  return { daily, trips }
}

// B 사용자 원칙: 태동→주도 매수 · 이탈 매도(그 외 유지)
const ruleB = (k, gi, isHeld) => {
  const q = secQ[k][gi], p = secQ[k][gi - 1]
  if (!q) return null
  if (!isHeld) return p === 'improving' && q === 'leading' ? true : null
  return q === 'lagging' ? false : null
}
// A 상태 규칙: 주도∪과열이면 보유
const ruleA = (k, gi) => { const q = secQ[k][gi]; return q ? (q === 'leading' || q === 'weakening') : null }
// D 반대 대조군
const ruleD = (k, gi) => { const q = secQ[k][gi]; return q ? (q === 'lagging' || q === 'improving') : null }
// C baseline: 전 섹터 상시
const ruleC = () => true

const R = { B: simulate(ruleB), A: simulate(ruleA), D: simulate(ruleD), C: simulate(ruleC) }

// ── 통계 ────────────────────────────────────────────────────────────────────
function stats(daily) {
  let eq = 1, peak = 1, mdd = 0
  const yearly = {}
  for (let gi = START; gi < G; gi++) {
    eq *= 1 + daily[gi]
    if (eq > peak) peak = eq
    mdd = Math.max(mdd, 1 - eq / peak)
    const y = GRID[gi].slice(0, 4)
    yearly[y] = (yearly[y] ?? 1) * (1 + daily[gi])
  }
  const days = G - START
  const cagr = Math.pow(eq, 252 / days) - 1
  return { total: (eq - 1) * 100, cagr: cagr * 100, mdd: mdd * 100, yearly }
}
function tripStats(trips) {
  if (!trips.length) return { n: 0 }
  const rets = trips.map(t => {
    let r = 1
    for (let gi = t.in; gi <= t.out; gi++) r *= 1 + secRet[t.k][gi]
    return { ...t, ret: (r - 1) * 100, days: t.out - t.in }
  })
  const win = rets.filter(r => r.ret > 0).length
  const avgD = rets.reduce((s, r) => s + r.days, 0) / rets.length
  const bySec = {}
  for (const r of rets) bySec[r.k] = (bySec[r.k] ?? 0) + 1
  const sorted = [...rets].sort((a, b) => a.ret - b.ret)
  const trim = sorted.slice(Math.floor(rets.length * 0.1), rets.length - Math.floor(rets.length * 0.1))
  return {
    n: rets.length, win: win / rets.length * 100, avgDays: avgD,
    avg: rets.reduce((s, r) => s + r.ret, 0) / rets.length,
    med: sorted[Math.floor(sorted.length / 2)].ret,
    trimAvg: trim.reduce((s, r) => s + r.ret, 0) / trim.length,
    best: sorted[sorted.length - 1], worst: sorted[0],
    nSec: Object.keys(bySec).length,
    topShare: Math.max(...Object.values(bySec)) / rets.length * 100,
    rets,
  }
}

const label = { B: 'B 사용자 원칙(태동→주도 매수·이탈 매도)', A: 'A 상태 규칙(주도∪과열 보유)', C: 'C 17섹터 균등 상시보유(기준선)', D: 'D 반대 대조군(이탈∪태동 보유)' }
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d)
console.log(`시뮬레이션 구간: ${GRID[START]} ~ ${GRID[G - 1]} (${G - START}거래일 ≈ ${((G - START) / 252).toFixed(1)}년)\n`)
const years = [...new Set(GRID.slice(START).map(d => d.slice(0, 4)))]
console.log('전략'.padEnd(36) + '총수익률   연복리   최대낙폭  ' + years.map(y => y.padStart(7)).join(''))
for (const key of ['B', 'A', 'C', 'D']) {
  const st = stats(R[key].daily)
  const yr = years.map(y => (st.yearly[y] ? f((st.yearly[y] - 1) * 100, 0).padStart(7) : '      —')).join('')
  console.log(label[key].padEnd(38) + `${f(st.total).padStart(8)}%  ${f(st.cagr).padStart(6)}%  −${st.mdd.toFixed(1).padStart(4)}%  ` + yr)
}

const tb = tripStats(R.B.trips)
console.log(`\n▎B 라운드트립 해부 — ${tb.n}건`)
if (tb.n) {
  console.log(`  승률 ${tb.win.toFixed(0)}% · 평균 ${f(tb.avg)}% · 중위 ${f(tb.med)}% · 절사 ${f(tb.trimAvg)}% · 평균 보유 ${tb.avgDays.toFixed(0)}일`)
  console.log(`  섹터 분산 ${tb.nSec}/${KEYS.length} · 최다 섹터 점유 ${tb.topShare.toFixed(0)}%`)
  console.log(`  최고: ${KO[tb.best.k]} ${f(tb.best.ret)}% (${GRID[tb.best.in]}~${GRID[tb.best.out]})`)
  console.log(`  최악: ${KO[tb.worst.k]} ${f(tb.worst.ret)}% (${GRID[tb.worst.in]}~${GRID[tb.worst.out]})`)
  const yrs = {}
  for (const r of tb.rets) { const y = GRID[r.in].slice(0, 4); yrs[y] = (yrs[y] ?? 0) + 1 }
  console.log(`  진입 연도 분포: ${Object.entries(yrs).map(([y, n]) => `${y}:${n}`).join(' ')}`)
}
const ta = tripStats(R.A.trips)
console.log(`▎A 라운드트립: ${ta.n}건 · 평균 보유 ${ta.n ? ta.avgDays.toFixed(0) : '—'}일 (회전율 비교용)`)

// 보유 섹터 수 분포(B) — "얼마나 자주 비는가"
let empty = 0, cnt = 0
{
  const held = new Set(); const pending = new Map()
  // 재실행 대신 daily==0 근사로: 미보유일 수 세기
  for (let gi = START; gi < G; gi++) { cnt++; if (R.B.daily[gi] === 0) empty++ }
}
console.log(`▎B 미보유(현금) 일수: ${empty}/${cnt}일 (${(empty / cnt * 100).toFixed(0)}%) — 현금 구간 이자 0 가정`)
console.log('\n⚠️ 수수료·세금·슬리피지 미반영 · 섹터 = 구성종목 동일가중(실전은 ETF — 추적 오차 존재) · 신호 다음 날 반영')
