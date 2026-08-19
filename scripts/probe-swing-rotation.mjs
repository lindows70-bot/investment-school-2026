// 🧭×🎯 스윙 타점 × 섹터 로테이션 교차 백테스트
//   질문(2026-08-19 사용자): "스윙 추천을 '자금 유입 섹터(주도)' 종목으로만 한정하면 성적이 어떻게 되나?"
//
// 방법:
//  · 스윙 신호 = backtest-swing.mjs 와 동일한 3트랙(A 역매공파 / C 킴스 / D 바닥급등) · KR40+US40 · 5년.
//  · 로테이션 상태 = **프로덕션과 같은 공식**(sector-rotation route): 섹터 ret1M·ret1W 동일가중 평균,
//    rs = 섹터1M − 전섹터 평균1M, mom = 섹터1W − 평균1W, 사분면 = leading/weakening/improving/lagging.
//    멤버십도 프로덕션 SSOT(sectorConfigs.ts 의 GICS 11 구성 종목)를 파싱해 그대로 쓴다.
//  · **시점 재현**: 신호일 D 의 로테이션은 D 까지의 캔들로만 계산(룩어헤드 없음). 오늘의 사분면을
//    과거에 소급하는 게 아니라, 그날 화면에 떴을 값을 그날 데이터로 다시 만든다.
//  · 근사 한계(정직): 프로덕션은 17섹터(GICS11+테마6)지만 신호 종목 매핑이 GICS 11 로만 가능해
//    (SECTOR_TO_ROT) 테마 6 은 제외. 평균의 모수가 17→11 로 줄어 rs·mom 절대값은 약간 다를 수 있다.
import { createRequire } from 'module'
import fs from 'fs'
const require2 = createRequire(import.meta.url)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const HOR = [5, 10, 15]

// ── 신호 유니버스(backtest-swing.mjs 와 동일 80종) ───────────────────────────
const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','NOW','UBER','PANW','SNPS','LRCX','KLAC','AMAT','ADI','MRVL','ANET',
  'XOM','CVX','COP','JPM','BAC','GS','UNH','LLY','ABBV','CAT']

// ── 프로덕션 SSOT 파싱: sectorConfigs GICS 11 멤버 + SECTOR_TO_ROT 매핑 ──────
const GICS = ['energy','materials','industrials','discretionary','staples','healthcare','financials','infotech','communication','utilities','realestate']
const SECTOR_TO_ROT = {   // rotationShared.ts 와 동일(Yahoo GICS → 시계 키)
  'Technology':'infotech','Financial Services':'financials','Healthcare':'healthcare',
  'Consumer Cyclical':'discretionary','Consumer Defensive':'staples','Energy':'energy',
  'Industrials':'industrials','Basic Materials':'materials','Communication Services':'communication',
  'Utilities':'utilities','Real Estate':'realestate',
}
const cfgSrc = fs.readFileSync(`${ROOT}/src/lib/sectorConfigs.ts`, 'utf8')
const members = {}   // rotKey → [{sym}]
{
  // 각 CONFIG 블록에서 key 와 stocks 배열 변수명을 찾고, 그 배열의 {ticker, market} 을 뽑는다
  const blocks = cfgSrc.split(/const \w+_CONFIG: SectorConfig = \{/).slice(1)
  for (const b of blocks) {
    const key = b.match(/key: '([^']+)'/)?.[1]
    if (!key || !GICS.includes(key)) continue
    const stocksVar = b.match(/stocks: (\w+)/)?.[1]
    if (!stocksVar) continue
    const av = cfgSrc.match(new RegExp(`const ${stocksVar}[^=]*= \\[([\\s\\S]*?)\\n\\]`))
    if (!av) continue
    const rows = [...av[1].matchAll(/ticker: '([^']+)'[^}]*market: '(KR|US)'/g)]
    members[key] = rows.map(m => (m[2] === 'KR' ? `${m[1]}.KS` : m[1]))
  }
}
const memberSyms = [...new Set(Object.values(members).flat())]
console.log(`GICS 섹터 ${Object.keys(members).length}개 · 멤버 ${memberSyms.length}종 (${Object.entries(members).map(([k, v]) => `${k}:${v.length}`).join(' ')})`)

// ── 신호 종목 → 로테이션 섹터(프로덕션 경로: Yahoo GICS 섹터) ────────────────
const SEC_CACHE = `${ROOT}/.swing-rot-sectors.json`
let symSector = fs.existsSync(SEC_CACHE) ? JSON.parse(fs.readFileSync(SEC_CACHE, 'utf8')) : {}
{
  const todo = [...KR, ...US].filter(s => !symSector[s])
  const q = [...todo]
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (;;) { const s = q.shift(); if (!s) return
      try { symSector[s] = (await yf.quoteSummary(s, { modules: ['assetProfile'] }))?.assetProfile?.sector ?? '?' }
      catch { symSector[s] = '?' } }
  }))
  if (todo.length) fs.writeFileSync(SEC_CACHE, JSON.stringify(symSector))
}

// ── 캔들 로딩(신호 80 + 섹터 멤버 — 중복 제거) ───────────────────────────────
const allSyms = [...new Set([...KR, ...US, ...memberSyms])]
const candles = {}   // sym → { dates[], c[], o[], h[], l[], v[], idxByDate: Map }
let loaded = 0
{
  const q = [...allSyms]
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const s = q.shift(); if (!s) return
      try {
        const r = await yf.chart(s, { period1: new Date(Date.now() - 5.4 * 365 * 864e5), interval: '1d' })
        const rows = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.open === 'number')
        if (rows.length >= 260) {
          const dates = rows.map(x => (x.date instanceof Date ? x.date : new Date(x.date)).toISOString().slice(0, 10))
          candles[s] = { dates, c: rows.map(x => x.close), o: rows.map(x => x.open), h: rows.map(x => x.high), l: rows.map(x => x.low), v: rows.map(x => x.volume ?? 0) }
        }
      } catch { /* skip */ }
      if (++loaded % 40 === 0) process.stdout.write(`\r  캔들 ${loaded}/${allSyms.length}`)
    }
  }))
}
console.log(`\n캔들 확보 ${Object.keys(candles).length}/${allSyms.length}종\n`)

// 특정 날짜 이하의 마지막 봉 인덱스(이진 탐색) — 시장 간 휴장 어긋남 처리
function idxAt(sym, date) {
  const d = candles[sym]?.dates; if (!d) return -1
  let lo = 0, hi = d.length - 1, ans = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (d[m] <= date) { ans = m; lo = m + 1 } else hi = m - 1 }
  return ans
}

// ── 시점 로테이션: 날짜 D 의 섹터별 rs·mom·사분면 (프로덕션 공식 재현) ─────────
const rotCache = new Map()   // date → Map(rotKey → {rs, mom, quad, score})
function rotationAt(date) {
  if (rotCache.has(date)) return rotCache.get(date)
  const per = {}
  for (const [k, syms] of Object.entries(members)) {
    const r1m = [], r1w = []
    for (const s of syms) {
      const i = idxAt(s, date)
      if (i < 21) continue
      const cc = candles[s].c
      r1m.push((cc[i] / cc[i - 21] - 1) * 100)
      r1w.push((cc[i] / cc[i - 5] - 1) * 100)
    }
    if (r1m.length >= 5) per[k] = { m: r1m.reduce((a, b) => a + b, 0) / r1m.length, w: r1w.reduce((a, b) => a + b, 0) / r1w.length }
  }
  const keys = Object.keys(per)
  const out = new Map()
  if (keys.length >= 6) {
    const mean1m = keys.reduce((s, k) => s + per[k].m, 0) / keys.length
    const mean1w = keys.reduce((s, k) => s + per[k].w, 0) / keys.length
    for (const k of keys) {
      const rs = per[k].m - mean1m, mom = per[k].w - mean1w
      const quad = rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging'
      out.set(k, { rs, mom, quad, score: 0.6 * rs + 0.4 * mom })
    }
  }
  rotCache.set(date, out)
  return out
}

// ── 스윙 3트랙 판정(backtest-swing.mjs 동일 — 순수 수학) ─────────────────────
const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }
const ema = (arr, n) => { const k = 2 / (n + 1); const o = []; let p = null
  for (const v of arr) { p = p == null ? v : v * k + p * (1 - k); o.push(p) } return o }
const trixOf = (close, n = 15) => { const e3 = ema(ema(ema(close, n), n), n)
  return e3.map((v, i) => i === 0 || e3[i - 1] === 0 ? null : ((v - e3[i - 1]) / e3[i - 1]) * 100) }
const spanAOf = (h, l) => { const mid = (n, i) => { if (i + 1 < n) return null
    let hi = -Infinity, lo = Infinity; for (let k = i - n + 1; k <= i; k++) { if (h[k] > hi) hi = h[k]; if (l[k] < lo) lo = l[k] } return (hi + lo) / 2 }
  return h.map((_, i) => { const t = mid(9, i), k = mid(26, i); return t == null || k == null ? null : (t + k) / 2 }) }

const SIGNALS = []
const base = { KR: { 5: [], 10: [], 15: [] }, US: { 5: [], 10: [], 15: [] } }
for (const sym of [...KR, ...US]) {
  const market = sym.endsWith('.KS') ? 'KR' : 'US'
  const D = candles[sym]; if (!D) continue
  const { c, o, h, l, v, dates } = D
  const trix = trixOf(c), spanA = spanAOf(h, l)
  const rotKey = SECTOR_TO_ROT[symSector[sym]] ?? null
  for (const hh of HOR) for (let i = 0; i + hh < c.length; i++) base[market][hh].push((c[i + hh] / c[i] - 1) * 100)
  const maxH = Math.max(...HOR)
  for (let i = 250; i + maxH < c.length; i++) {
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    if (ma50 == null || ma50p == null) continue
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const ret = {}; for (const hh of HOR) ret[hh] = (c[i + hh] / c[i] - 1) * 100
    const push = (track) => SIGNALS.push({ sym, market, track, date: dates[i], ym: dates[i].slice(0, 7), regime, ret, rotKey })

    { // A 역매공파(112/224)
      const mS = sma(c, 112, i), mL = sma(c, 224, i), mSp = sma(c, 112, i - 1)
      if (mS != null && mL != null && mSp != null && mL > mS && c[i] > mS && c[i - 1] <= mSp) {
        let disp = false
        for (let k = Math.max(0, i - 20); k <= i; k++) { const m = sma(c, 20, k); if (m != null && (c[k] / m) * 100 <= 95) { disp = true; break } }
        if (disp) push('A회복')
      }
    }
    { // C 킴스(선행스팬1 상승 + TRIX 영선돌파 + 강도증가 + 11일선 위)
      const ma11 = sma(c, 11, i)
      if (spanA[i] != null && spanA[i - 1] != null && trix[i] != null && trix[i - 1] != null && ma11 != null &&
        spanA[i] > spanA[i - 1] && trix[i] > 0 && trix[i - 1] <= 0 && trix[i] > trix[i - 1] && c[i] > ma11) push('C추세')
    }
    { // D 바닥급등(224 아래 체류 → +5%·거래량 2배·runup≤30%)
      const ma224 = sma(c, 224, i - 1)
      if (ma224 != null && v[i] > 0) {
        let below = 0
        for (let k = i - 60; k < i; k++) { const m = sma(c, 224, k); if (m != null && c[k] < m) below++ }
        const chg = (c[i] / c[i - 1] - 1) * 100
        let v20 = 0; for (let k = i - 20; k < i; k++) v20 += v[k]; v20 /= 20
        let min20 = Infinity
        for (let k = i - 19; k <= i; k++) { const lo2 = l[k] ?? c[k]; if (lo2 < min20) min20 = lo2 }
        if (below >= 45 && chg >= 5 && v20 > 0 && v[i] >= v20 * 2 && (c[i] / min20 - 1) * 100 <= 30) push('D급등')
      }
    }
  }
}
console.log(`신호 수집: ${SIGNALS.length}건 (${['A회복', 'C추세', 'D급등'].map(t => `${t} ${SIGNALS.filter(s => s.track === t).length}`).join(' · ')})`)

// 신호마다 그날의 섹터 국면을 붙인다
for (const s of SIGNALS) {
  const rot = s.rotKey ? rotationAt(s.date).get(s.rotKey) : null
  s.quad = rot?.quad ?? 'unknown'
  s.score = rot?.score ?? null
}
console.log(`섹터 매핑: ${SIGNALS.filter(s => s.quad !== 'unknown').length}/${SIGNALS.length}건 (unknown = 섹터 미매핑·데이터 부족)\n`)

// ── 리포트 ───────────────────────────────────────────────────────────────────
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '  n/a' : (Math.round(n * 100) / 100).toFixed(2)

function row(label, rows, h = 10) {
  if (rows.length < 10) { console.log(`  ${label.padEnd(26)} n=${rows.length} — 10 미만, 통계 아님`); return null }
  // edge = 시장 baseline 대비(원 백테스트와 같은 기준) — KR/US 혼합이면 각자 baseline 차감
  const excess = rows.map(r => r.ret[h] - avg(base[r.market][h]))
  const e = avg(excess), te = avg(trim(excess))
  const w = rows.filter(r => r.ret[h] > 0).length / rows.length * 100
  const tk = {}; rows.forEach(r => (tk[r.sym] = (tk[r.sym] ?? 0) + 1))
  const top = Math.max(...Object.values(tk)) / rows.length * 100
  const yrs = new Set(rows.map(r => r.ym.slice(0, 4))).size
  console.log(`  ${label.padEnd(26)} n=${String(rows.length).padStart(4)} 종목${String(Object.keys(tk).length).padStart(3)} edge ${r2(e).padStart(6)}%p 절사 ${r2(te).padStart(6)} 승률 ${w.toFixed(0)}% 최다 ${top.toFixed(0)}% 연도 ${yrs}`)
  return { e, te, n: rows.length }
}

for (const h of [10, 15]) {
  console.log(`${'═'.repeat(84)}\n전방 ${h}봉 · edge = 각 시장 baseline 대비 %p\n${'═'.repeat(84)}`)
  for (const track of ['A회복', 'C추세', 'D급등']) {
    const g = SIGNALS.filter(s => s.track === track)
    console.log(`\n▎${track} — 전체 ${g.length}건`)
    row('전체(현행 = 필터 없음)', g, h)
    row('🔥 주도(leading)만', g.filter(s => s.quad === 'leading'), h)
    row('🌱 태동(improving)만', g.filter(s => s.quad === 'improving'), h)
    row('⚠️ 과열(weakening)만', g.filter(s => s.quad === 'weakening'), h)
    row('❄️ 이탈(lagging)만', g.filter(s => s.quad === 'lagging'), h)
    row('유입(score>0)만', g.filter(s => s.score != null && s.score > 0), h)
    row('이탈(score<0)만', g.filter(s => s.score != null && s.score < 0), h)
  }
}

// 트랙 합산 — "유입 섹터로 한정" 총평
console.log(`\n${'═'.repeat(84)}\n트랙 합산(10봉) — 필터 있/없 직접 비교\n${'═'.repeat(84)}`)
const known = SIGNALS.filter(s => s.quad !== 'unknown')
row('전체(필터 없음)', known, 10)
row('주도(leading)만', known.filter(s => s.quad === 'leading'), 10)
row('주도+태동(mom>0)', known.filter(s => s.quad === 'leading' || s.quad === 'improving'), 10)
row('유입(score>0)만', known.filter(s => s.score > 0), 10)
row('이탈(score<0)만', known.filter(s => s.score < 0), 10)

fs.writeFileSync(`${ROOT}/.swing-rot-obs.json`, JSON.stringify(SIGNALS))
console.log(`\n원본: .swing-rot-obs.json`)
