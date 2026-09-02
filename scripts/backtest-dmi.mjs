// 🧭 DMI 매매법 검정 — 영상(머니플로우 「가짜 추세…DMI 지표」 2026-08-29 검토)의 규칙을 그대로 재고 기각/채택을 판정한다
//
//   영상 규칙(원문 07:02~08:45 · 09:15~10:45):
//     진입(매수) = ① ADX 가 기준선 20 을 **상향 돌파** ② +DI 가 **이전 고점을 돌파**
//     진입(매도) = ① ADX 20 상향 돌파 ② −DI 가 이전 고점 돌파
//     손절 = EMA30 라인 · 익절 = **캔들 2개가 EMA30 를 완전히 이탈**
//
//   ⚠️ 영상은 5분봉·1시간봉(단타)이다. 우리 앱은 일봉이다.
//      그래서 **일봉 + 60분봉 둘 다** 잰다. 60분봉은 영상이 직장인에게 권한 프레임이라 공정한 대조다.
//
//   측정 2종:
//     Ⓐ 진입신호의 20봉 절사 edge — 기존 SCREEN_SETUPS 와 **같은 잣대**(비교 가능해야 한다)
//     Ⓑ 규칙 자체의 성적 — 영상의 EMA30 청산까지 태워서 1회 매매 수익·손익비·승률.
//        baseline = **같은 청산규칙을 아무 날 진입에 적용**한 것(진입신호가 없어도 나오는 몫을 뺀다)
//
//   ⛔ 룩어헤드 금지(봉 i 판정은 data[0..i]) · 절사 edge · 자기상관 접기 — 기존 하네스와 동일 규약
//   실행: node scripts/backtest-dmi.mjs
import { createRequire } from 'module'

const require2 = createRequire('C:/Users/lindo/investment-school-portfolio/package.json')
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '207940.KS','051900.KS','090430.KS','097950.KS','271560.KS','033780.KS','000100.KS','128940.KS','005490.KS','009830.KS',
  '011170.KS','139480.KS','161390.KS','012450.KS','047810.KS','034020.KS','009540.KS','000720.KS','006360.KS','028050.KS']
const US = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','AMD','MU','INTC','QCOM','TXN','ORCL','CRM',
  'ADBE','NFLX','CSCO','ACN','IBM','XOM','CVX','JPM','BAC','GS','UNH','LLY','ABBV','CAT','BA',
  'WMT','COST','HD','MCD','NKE','PG','KO','PEP','V','MA','JNJ','PFE','MRK','ABT','TMO',
  'LMT','RTX','GE','HON','DE','UNP','UPS','T','VZ','DIS','DUK','NEE','SLB','LIN','FCX']

const HOR = 20            // Ⓐ 전방 20봉(기존 하네스와 동일)
const ADX_LINE = 20       // 영상 기준선
const DI_HIGH_LOOK = 20   // '이전 고점' = 직전 20봉 DI 최고치
const EMA_LEN = 30        // 영상 30 EMA
const MAX_HOLD = 120      // 청산 규칙이 안 나오는 표본 방어(무한 보유 금지)

/* ── 지표(Wilder) — techSignals.calcADX 와 같은 평활, 단 +DI/−DI 를 함께 내보낸다 ── */
function dmi(h, l, c, period = 14) {
  const N = c.length
  const adx = new Array(N).fill(null), pdi = new Array(N).fill(null), mdi = new Array(N).fill(null)
  if (N < period * 2 + 1) return { adx, pdi, mdi }
  const tr = new Array(N).fill(0), pDM = new Array(N).fill(0), mDM = new Array(N).fill(0)
  for (let i = 1; i < N; i++) {
    tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]
    if (up > dn && up > 0) pDM[i] = up
    if (dn > up && dn > 0) mDM[i] = dn
  }
  let sTR = 0, sP = 0, sM = 0
  for (let i = 1; i <= period; i++) { sTR += tr[i]; sP += pDM[i]; sM += mDM[i] }
  const dx = new Array(N).fill(0)
  const put = i => {
    const p = sTR === 0 ? 0 : 100 * sP / sTR, m = sTR === 0 ? 0 : 100 * sM / sTR
    pdi[i] = p; mdi[i] = m
    const sum = p + m
    dx[i] = sum === 0 ? 0 : 100 * Math.abs(p - m) / sum
  }
  put(period)
  for (let i = period + 1; i < N; i++) {
    sTR = sTR - sTR / period + tr[i]; sP = sP - sP / period + pDM[i]; sM = sM - sM / period + mDM[i]
    put(i)
  }
  let a = 0
  for (let i = period; i < period * 2; i++) a += dx[i]
  a /= period
  adx[period * 2 - 1] = a
  for (let i = period * 2; i < N; i++) { a = (a * (period - 1) + dx[i]) / period; adx[i] = a }
  return { adx, pdi, mdi }
}
const ema = (arr, n) => { const k = 2 / (n + 1); const o = []; let p = null
  for (let i = 0; i < arr.length; i++) { p = p == null ? arr[i] : arr[i] * k + p * (1 - k); o.push(p) } return o }

/* ── 영상 청산: 캔들 2개가 EMA30 를 완전히 이탈하면 그 종가에 청산 ── */
function exitAt(c, e, entry, dir) {
  for (let j = entry + 1; j < c.length && j <= entry + MAX_HOLD; j++) {
    const out1 = dir === 'long' ? c[j - 1] < e[j - 1] : c[j - 1] > e[j - 1]
    const out2 = dir === 'long' ? c[j] < e[j] : c[j] > e[j]
    if (out1 && out2) return j
  }
  return null   // 청산 조건 미발생 — 표본에서 제외(박제 금지)
}

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100

async function collect(tickers, interval, days) {
  const rows = []
  for (const t of tickers) {
    let q
    try {
      const r = await yf.chart(t, { period1: new Date(Date.now() - days * 864e5), interval })
      q = (r?.quotes ?? []).filter(x => [x.close, x.high, x.low].every(v => typeof v === 'number' && v > 0))
    } catch { continue }
    if (q.length < 400) continue
    rows.push({ ticker: t, c: q.map(x => x.close), h: q.map(x => x.high), l: q.map(x => x.low) })
  }
  return rows
}

/* ── 신호 판정 ── */
function signals(series) {
  const { c, h, l } = series
  const { adx, pdi, mdi } = dmi(h, l, c)
  const e = ema(c, EMA_LEN)
  const N = c.length
  const out = { long: [], short: [], adxOnly: [], diOnly: [] }
  for (let i = DI_HIGH_LOOK + 40; i < N; i++) {
    if (adx[i] == null || adx[i - 1] == null) continue
    // ① ADX 20 상향 돌파 — 영상은 '돌파 후' 진입이므로 최근 10봉 내 돌파 + 현재도 20 위
    let crossed = false
    for (let k = 0; k < 10 && i - k > 0; k++) {
      if (adx[i - k - 1] != null && adx[i - k - 1] <= ADX_LINE && adx[i - k] > ADX_LINE) { crossed = true; break }
    }
    const above = adx[i] > ADX_LINE
    // ② DI 가 이전 고점(직전 DI_HIGH_LOOK 봉 최고치) 돌파
    let pHi = -Infinity, mHi = -Infinity
    for (let k = i - DI_HIGH_LOOK; k < i; k++) { if (pdi[k] > pHi) pHi = pdi[k]; if (mdi[k] > mHi) mHi = mdi[k] }
    const pBreak = pdi[i] > pHi, mBreak = mdi[i] > mHi
    if (crossed && above && pBreak && pdi[i] > mdi[i]) out.long.push(i)
    if (crossed && above && mBreak && mdi[i] > pdi[i]) out.short.push(i)
    // 분해 — 어느 조건이 일을 하는가
    if (crossed && above && pdi[i] > mdi[i]) out.adxOnly.push(i)
    if (pBreak && pdi[i] > mdi[i]) out.diOnly.push(i)
  }
  return { idx: out, ema: e }
}

async function runFrame(label, tickers, interval, days) {
  console.log(`\n${'═'.repeat(94)}\n🧭 ${label} — 영상 DMI 규칙 검정\n${'═'.repeat(94)}`)
  const all = await collect(tickers, interval, days)
  if (!all.length) { console.log('  수집 실패 — 이 프레임은 판정 불가'); return }
  const bars = all.reduce((s, x) => s + x.c.length, 0)
  console.log(`수집 ${all.length}종 · ${bars.toLocaleString()}봉`)

  const fwdBase = [], tradeBase = []
  const rec = { long: [], short: [], adxOnly: [], diOnly: [] }
  const trades = { long: [], short: [] }

  for (const s of all) {
    const { idx, ema: e } = signals(s)
    const c = s.c, N = c.length
    // baseline Ⓐ 전 봉 20봉 전방수익 / Ⓑ 아무 날 진입 + 같은 청산규칙
    for (let i = 60; i + HOR < N; i++) fwdBase.push((c[i + HOR] / c[i] - 1) * 100)
    for (let i = 60; i < N - 2; i += 5) {          // 5봉 간격 표본(계산량·자기상관 완화)
      const j = exitAt(c, e, i, 'long')
      if (j != null) tradeBase.push({ ret: (c[j] / c[i] - 1) * 100, bars: j - i })
    }
    for (const key of Object.keys(rec)) {
      for (const i of idx[key]) if (i + HOR < N) rec[key].push({ ticker: s.ticker, idx: i, ret: (c[i + HOR] / c[i] - 1) * 100 })
    }
    for (const dir of ['long', 'short']) {
      for (const i of idx[dir]) {
        const j = exitAt(c, e, i, dir)
        if (j == null) continue
        const raw = (c[j] / c[i] - 1) * 100
        trades[dir].push({ ticker: s.ticker, idx: i, ret: dir === 'long' ? raw : -raw, bars: j - i })
      }
    }
  }

  // ── Ⓐ 진입신호 20봉 절사 edge ──
  const bT = avg(trim(fwdBase))
  console.log(`\nⒶ 진입신호의 20봉 절사 edge (baseline ${r2(bT)}% · n=${fwdBase.length.toLocaleString()}) — SCREEN_SETUPS 와 같은 잣대`)
  const NAME = { long: '영상규칙 매수(ADX돌파+ +DI고점돌파)', short: '영상규칙 매도(ADX돌파+ −DI고점돌파)',
    adxOnly: '  ├ ADX 20 돌파만', diOnly: '  └ +DI 고점돌파만' }
  const fold = rows => {                       // 자기상관 접기 — 같은 종목 HOR 안 중복은 1건
    const by = {}; for (const r of rows) (by[r.ticker] ??= []).push(r)
    const o = []
    for (const k of Object.keys(by)) { let last = -Infinity
      for (const r of by[k].sort((a, b) => a.idx - b.idx)) if (r.idx - last >= HOR) { o.push(r); last = r.idx } }
    return o
  }
  const mu = avg(fwdBase)                       // ⚠️ 루프 밖에서 한 번만 — 안에서 부르면 O(n²) 로 멈춘다
  const SD = Math.sqrt(avg(fwdBase.map(x => (x - mu) ** 2)))
  for (const k of ['long', 'short', 'adxOnly', 'diOnly']) {
    const rows = rec[k]
    if (rows.length < 20) { console.log(`  ${NAME[k].padEnd(34)} n=${rows.length} — 표본 부족(판정 보류)`); continue }
    const edge = avg(trim(rows.map(r => r.ret))) - bT
    const fd = fold(rows)
    const eF = fd.length >= 20 ? avg(trim(fd.map(r => r.ret))) - bT : null
    const se = SD / Math.sqrt(fd.length)
    const tks = new Set(rows.map(r => r.ticker))
    const top = Math.max(...Array.from(tks).map(t => rows.filter(r => r.ticker === t).length)) / rows.length
    console.log(`  ${NAME[k].padEnd(34)} n=${String(rows.length).padStart(5)} edge ${String(r2(edge)).padStart(6)} │ 접은 뒤 n=${String(fd.length).padStart(4)} edge ${String(r2(eF)).padStart(6)} · ${eF != null ? r2(eF / se) : '—'}σ │ 종목 ${tks.size} · 최다점유 ${Math.round(top * 100)}%`)
  }

  // ── Ⓑ 규칙 자체(EMA30 청산까지) ──
  const bRet = tradeBase.map(t => t.ret), bBars = tradeBase.map(t => t.bars)
  console.log(`\nⒷ 영상 규칙 그대로 — EMA30 2봉 이탈 청산까지 태운 1회 매매 성적`)
  console.log(`  baseline(아무 날 진입 + 같은 청산) n=${bRet.length.toLocaleString()} · 평균 ${r2(avg(bRet))}% · 절사 ${r2(avg(trim(bRet)))}% · 승률 ${r2(bRet.filter(x => x > 0).length / bRet.length * 100)}% · 평균보유 ${r2(avg(bBars))}봉`)
  for (const dir of ['long', 'short']) {
    const t = trades[dir]
    if (t.length < 20) { console.log(`  ${dir === 'long' ? '매수' : '매도'} n=${t.length} — 표본 부족`); continue }
    const rr = t.map(x => x.ret)
    const wins = rr.filter(x => x > 0), loss = rr.filter(x => x <= 0)
    const rrRatio = loss.length && wins.length ? avg(wins) / Math.abs(avg(loss)) : null
    const fd = fold(t)
    const se = SD / Math.sqrt(fd.length)
    const edgeT = avg(trim(rr)) - avg(trim(bRet))
    console.log(`  ${(dir === 'long' ? '매수' : '매도').padEnd(4)} n=${String(t.length).padStart(4)} · 평균 ${String(r2(avg(rr))).padStart(6)}% · 절사 ${String(r2(avg(trim(rr)))).padStart(6)}% · 중위 ${String(r2(med(rr))).padStart(6)}% · 승률 ${String(r2(wins.length / rr.length * 100)).padStart(5)}% · 손익비 1:${r2(rrRatio)} · 평균보유 ${r2(avg(t.map(x => x.bars)))}봉`)
    console.log(`       └ baseline 대비 절사초과 ${r2(edgeT)}%p · 접은 뒤 n=${fd.length} · ${r2(edgeT / se)}σ`)
  }
}

await runFrame('일봉 · 5년 · 99종 (우리 앱이 실제로 쓰는 프레임)', [...KR, ...US], '1d', 5 * 365)
await runFrame('60분봉 · 2년 · 미국 59종 (영상이 직장인에게 권한 프레임)', US, '1h', 720)
console.log('\n  ※ σ는 "이 값이 우연일 가능성"의 눈금. 2σ 미만이면 표본 우연과 구분하기 어렵다.')
console.log('  ※ 거래비용·슬리피지 미반영 — 60분봉은 매매 횟수가 많아 실제로는 이보다 나쁘다.')
