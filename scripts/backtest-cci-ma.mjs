// 📐 CCI×이평선 검정 — ChartZero 「이평선으로 매번 손절이 반복된다면 CCI를 함께 보세요」(2026-08-21) 규칙
//
//   영상 규칙(원문 05:40~10:40):
//     세팅 = SMA(100) + **CCI 길이를 이평선과 동일하게**(→ CCI 영선 = 이평선. 수학적으로 참)
//     매수 = ① CCI 가 +100 상향 돌파 ② 이후 CCI **고점이 만들어짐**(눌림) ③ 그 고점을 재돌파할 때 진입
//     ⛔ 쉬지 않고 쭉 오른 자리는 고점이 안 만들어져 신호가 안 난다 = "힘을 다 쓴 자리" 자동 배제
//     손절·익절 = 종가가 이평선 이탈
//
//   ⚠️ 영상은 15분/30분봉 단타다. 우리 앱은 **일봉 스윙**이라 일봉으로 옮겨 잰다(스케일이 다름을 명시).
//
//   검정 3종:
//     Ⓐ 진입신호 20봉 절사 edge — SCREEN_SETUPS 와 같은 잣대
//     Ⓑ 규칙 그대로(이평선 이탈 청산) · baseline = 아무 날 진입 + 같은 청산
//     Ⓒ **영상의 핵심 주장 검정** — CCI 길이 20(우리 현재값) vs 100(이평선 정합) 비교
//
//   ⛔ 룩어헤드 금지 · 절사 edge · 자기상관 접기 — 기존 하네스 동일 규약
//   실행: node scripts/backtest-cci-ma.mjs
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

const HOR = 20
const MAX_HOLD = 120
const MA_LEN = 100          // 영상: SMA 100
const SETUP_LIFE = 40       // ②→③ 대기 한도(넘으면 셋업 만료 — 무한 대기 금지)

/* ── 지표 ── */
function cciSeries(h, l, c, period) {
  const N = c.length, tp = c.map((_, i) => (h[i] + l[i] + c[i]) / 3)
  const out = new Array(N).fill(null)
  for (let i = period - 1; i < N; i++) {
    let s = 0; for (let j = i - period + 1; j <= i; j++) s += tp[j]
    const m = s / period
    let dev = 0; for (let j = i - period + 1; j <= i; j++) dev += Math.abs(tp[j] - m)
    dev /= period
    out[i] = dev === 0 ? 0 : (tp[i] - m) / (0.015 * dev)
  }
  return out
}
const smaSeries = (a, n) => { const o = new Array(a.length).fill(null); let s = 0
  for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n } return o }

/* ── 영상 규칙 신호 — 봉 i 판정은 [0..i] 만 본다(룩어헤드 없음) ── */
function videoSignals(cci, sma, c) {
  const N = c.length
  const entries = [], simpleCross = []
  let stage = 0            // 0=대기 1=+100 돌파함(고점 대기) 2=고점 확정(재돌파 대기)
  let peak = -Infinity, peakAge = 0
  for (let i = 1; i < N; i++) {
    if (cci[i] == null || cci[i - 1] == null || sma[i] == null) continue
    if (cci[i - 1] <= 100 && cci[i] > 100) simpleCross.push(i)      // 1단(우리 앱 현재값)
    if (c[i] < sma[i]) { stage = 0; peak = -Infinity; continue }    // 이평선 이탈 = 셋업 무효
    if (stage === 0) { if (cci[i - 1] <= 100 && cci[i] > 100) { stage = 1; peak = cci[i]; peakAge = 0 } }
    else if (stage === 1) {
      if (cci[i] > peak) peak = cci[i]                              // 아직 오르는 중 — 고점 미확정
      else if (cci[i] < cci[i - 1]) { stage = 2; peakAge = 0 }      // 눌림 시작 = 고점 확정(선 그어짐)
    } else if (stage === 2) {
      peakAge++
      if (peakAge > SETUP_LIFE) { stage = 0; peak = -Infinity }     // 만료
      else if (cci[i] > peak) { entries.push(i); stage = 0; peak = -Infinity }   // ③ 재돌파 = 진입
    }
  }
  return { entries, simpleCross }
}
function exitAt(c, sma, entry) {
  for (let j = entry + 1; j < c.length && j <= entry + MAX_HOLD; j++) if (sma[j] != null && c[j] < sma[j]) return j
  return null
}

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null }
const r2 = n => n == null ? '—' : Math.round(n * 100) / 100

const series = []
for (const [list, mk] of [[KR, 'KR'], [US, 'US']]) for (const t of list) {
  try {
    const r = await yf.chart(t, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    const q = (r?.quotes ?? []).filter(x => [x.close, x.high, x.low].every(v => typeof v === 'number' && v > 0))
    if (q.length >= 400) series.push({ t, mk, c: q.map(x => x.close), h: q.map(x => x.high), l: q.map(x => x.low) })
  } catch { /* 종목 실패 — 정직 제외 */ }
}
console.log(`수집 ${series.length}종 · ${series.reduce((s, x) => s + x.c.length, 0).toLocaleString()}봉\n`)

const fwdBase = [], tradeBase = []
const REC = { v100: [], v20: [], s100: [], s20: [] }   // v=2단(영상) s=1단(단순돌파) · 숫자=CCI 길이
const TRD = { v100: [], v20: [] }

for (const S of series) {
  const { c, h, l } = S, N = c.length
  const sma = smaSeries(c, MA_LEN)
  for (let i = 120; i + HOR < N; i++) fwdBase.push((c[i + HOR] / c[i] - 1) * 100)
  for (let i = 120; i < N - 2; i += 5) { const j = exitAt(c, sma, i); if (j != null) tradeBase.push((c[j] / c[i] - 1) * 100) }
  for (const [len, kv, ks] of [[100, 'v100', 's100'], [20, 'v20', 's20']]) {
    const cci = cciSeries(h, l, c, len)
    const { entries, simpleCross } = videoSignals(cci, sma, c)
    for (const i of entries) if (i + HOR < N) REC[kv].push({ t: S.t, idx: i, ret: (c[i + HOR] / c[i] - 1) * 100 })
    for (const i of simpleCross) if (i + HOR < N) REC[ks].push({ t: S.t, idx: i, ret: (c[i + HOR] / c[i] - 1) * 100 })
    if (len === 100 || len === 20) for (const i of entries) {
      const j = exitAt(c, sma, i); if (j != null) TRD[kv].push({ t: S.t, idx: i, ret: (c[j] / c[i] - 1) * 100, bars: j - i })
    }
  }
}

const mu = avg(fwdBase)                                        // ⚠️ 루프 밖에서 한 번만(O(n²) 방지)
const SD = Math.sqrt(avg(fwdBase.map(x => (x - mu) ** 2)))
const bT = avg(trim(fwdBase))
const fold = rows => { const by = {}; for (const r of rows) (by[r.t] ??= []).push(r)
  const o = []; for (const k of Object.keys(by)) { let last = -Infinity
    for (const r of by[k].sort((a, b) => a.idx - b.idx)) if (r.idx - last >= HOR) { o.push(r); last = r.idx } } return o }

console.log('═'.repeat(100))
console.log(`Ⓐ 진입신호 20봉 절사 edge (baseline ${r2(bT)}% · n=${fwdBase.length.toLocaleString()}) — SCREEN_SETUPS 와 같은 잣대`)
console.log('═'.repeat(100))
const NAME = { v100: '영상규칙 2단확인 · CCI(100)=MA정합', v20: '영상규칙 2단확인 · CCI(20) 현재값',
  s100: '  └ 단순 +100 돌파 · CCI(100)', s20: '  └ 단순 +100 돌파 · CCI(20) ← 우리 앱이 쓰는 것' }
for (const k of ['v100', 'v20', 's100', 's20']) {
  const rows = REC[k]
  if (rows.length < 20) { console.log(`  ${NAME[k].padEnd(36)} n=${rows.length} — 표본 부족`); continue }
  const fd = fold(rows), eF = avg(trim(fd.map(r => r.ret))) - bT
  const se = SD / Math.sqrt(fd.length)
  const tks = new Set(rows.map(r => r.t))
  const top = Math.max(...Array.from(tks).map(t => rows.filter(r => r.t === t).length)) / rows.length
  console.log(`  ${NAME[k].padEnd(36)} n=${String(rows.length).padStart(5)} → 접은 뒤 ${String(fd.length).padStart(4)} · edge ${String(r2(eF)).padStart(6)} · ${String(r2(eF / se)).padStart(5)}σ · 종목 ${tks.size} · 최다 ${Math.round(top * 100)}%`)
}

console.log(`\n${'═'.repeat(100)}\nⒷ 영상 규칙 그대로 — SMA(${MA_LEN}) 이탈 청산까지 태운 1회 매매\n${'═'.repeat(100)}`)
console.log(`  baseline(아무 날 진입 + 같은 청산) n=${tradeBase.length.toLocaleString()} · 절사 ${r2(avg(trim(tradeBase)))}% · 승률 ${r2(tradeBase.filter(x => x > 0).length / tradeBase.length * 100)}%`)
for (const k of ['v100', 'v20']) {
  const t = TRD[k]
  if (t.length < 20) { console.log(`  ${NAME[k]} n=${t.length} — 표본 부족`); continue }
  const rr = t.map(x => x.ret), w = rr.filter(x => x > 0), lo = rr.filter(x => x <= 0)
  const fd = fold(t), se = SD / Math.sqrt(fd.length)
  const edgeT = avg(trim(rr)) - avg(trim(tradeBase))
  console.log(`  ${NAME[k].padEnd(36)} n=${String(t.length).padStart(4)} · 절사 ${String(r2(avg(trim(rr)))).padStart(6)}% · 중위 ${String(r2(med(rr))).padStart(6)}% · 승률 ${String(r2(w.length / rr.length * 100)).padStart(5)}% · 손익비 1:${r2(w.length && lo.length ? avg(w) / Math.abs(avg(lo)) : null)} · 보유 ${r2(avg(t.map(x => x.bars)))}봉`)
  console.log(`       └ baseline 대비 절사초과 ${r2(edgeT)}%p · 접은 뒤 n=${fd.length} · ${r2(edgeT / se)}σ`)
}
console.log(`\nⒸ 영상 핵심 주장 검정 — "CCI 길이를 이평선과 맞춰라"(100) vs 우리 현재값(20)`)
console.log('   위 두 표의 v100 vs v20 · s100 vs s20 을 직접 대조하라. 길이 정합이 실제 효과가 있는지가 이 줄의 전부다.')
console.log('\n  ※ σ 2 미만이면 표본 우연과 구분하기 어렵다 · 거래비용 미반영 · 영상은 15/30분봉인데 여기선 일봉(스케일 다름)')
