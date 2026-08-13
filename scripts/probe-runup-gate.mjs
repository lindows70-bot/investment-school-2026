// 🔍 이격(runup) 게이트 프로브 — "진입 시점에 20봉 저점 대비 이미 오른 폭"이 클수록 성적이 나쁜가?
//   배경: 2026-08-14 사용자 지적 — 유한양행 등 추천이 저점 +28% 오른 뒤에 나와 되돌림에 약했다.
//   "더 일찍(바닥에서)"은 이미 3회 측정 기각(눌림목 계열 3연속 음수)이므로, 반대쪽 질문을 잰다:
//   확인 신호(트랙 A 회복·트랙 D 급등)를 유지하되 **너무 늦은(많이 오른) 진입만 걸러내면** edge가 나아지는가.
//   ⛔ 룩어헤드 금지 · baseline 대비 절사 edge · 판정 규칙은 swingSetup 과 자구 동일.
import { createRequire } from 'module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const require2 = createRequire(`${ROOT}/package.json`)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const KR = ['005930.KS','000660.KS','005380.KS','051910.KS','006400.KS','035420.KS','035720.KS','068270.KS','105560.KS','055550.KS',
  '012330.KS','028260.KS','066570.KS','003550.KS','015760.KS','017670.KS','034730.KS','032830.KS','018260.KS','010950.KS',
  '009150.KS','011200.KS','086790.KS','316140.KS','024110.KS','030200.KS','000270.KS','086280.KS','010130.KS','004020.KS',
  '096770.KS','267250.KS','042660.KS','010140.KS','272210.KS','064350.KS','241560.KS','003490.KS','047050.KS','000810.KS']

const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

const buckets = { 'A: runup <10%': [], 'A: 10~20%': [], 'A: >20%': [], 'D: runup <15%': [], 'D: 15~30%': [], 'D: >30%': [] }
const base10 = []
const syms = {}; for (const k of Object.keys(buckets)) syms[k] = new Map()

async function run(t) {
  let q
  try {
    const r = await yf.chart(t, { period1: new Date(Date.now() - 5 * 365 * 864e5), interval: '1d' })
    q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0 && typeof x.open === 'number')
  } catch { return }
  if (q.length < 400) return
  const c = q.map(x => x.close), lo = q.map(x => x.low), v = q.map(x => x.volume ?? 0)

  for (let i = 250; i + 10 < c.length; i++) base10.push((c[i + 10] / c[i] - 1) * 100)

  for (let i = 285; i + 10 < c.length; i++) {
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    if (ma50 == null || ma50p == null) continue
    const regime = ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    if (regime !== 'down') continue                        // 두 트랙 모두 KR 하락장 전용

    // 진입 시점의 이격: 최근 20봉 저가 대비 오늘 종가 상승폭
    let min20 = Infinity
    for (let k = i - 19; k <= i; k++) if (lo[k] < min20) min20 = lo[k]
    const runup = (c[i] / min20 - 1) * 100
    const ret10 = (c[i + 10] / c[i] - 1) * 100

    // ── 트랙 A: 역매공파(112/224 역배열 + 이격도≤95 + 112선 당일 회복) — swingSetup 과 동일 규칙 ──
    {
      const ma112 = sma(c, 112, i), ma224 = sma(c, 224, i), ma112p = sma(c, 112, i - 1)
      if (ma112 != null && ma224 != null && ma112p != null && ma224 > ma112 && c[i] > ma112 && c[i - 1] <= ma112p) {
        let dispMin = null
        for (let k = Math.max(0, i - 20); k <= i; k++) { const m = sma(c, 20, k); if (m != null) { const d = (c[k] / m) * 100; if (dispMin == null || d < dispMin) dispMin = d } }
        if (dispMin != null && dispMin <= 95) {
          const b = runup < 10 ? 'A: runup <10%' : runup < 20 ? 'A: 10~20%' : 'A: >20%'
          buckets[b].push(ret10); syms[b].set(t, (syms[b].get(t) ?? 0) + 1)
        }
      }
    }
    // ── 트랙 D: 써티퍼센트(60봉 중 45봉+ 224 아래 + 당일 +5%↑ + 거래량 2배↑) — 동일 규칙 ──
    {
      const ma224p = sma(c, 224, i - 1)
      if (ma224p != null) {
        let below = 0
        for (let k = i - 60; k < i; k++) { const m = sma(c, 224, k); if (m != null && c[k] < m) below++ }
        const chg = (c[i] / c[i - 1] - 1) * 100
        let v20 = 0; for (let k = i - 20; k < i; k++) v20 += v[k]; v20 /= 20
        if (below >= 45 && chg >= 5 && v20 > 0 && v[i] >= v20 * 2) {
          const b = runup < 15 ? 'D: runup <15%' : runup < 30 ? 'D: 15~30%' : 'D: >30%'
          buckets[b].push(ret10); syms[b].set(t, (syms[b].get(t) ?? 0) + 1)
        }
      }
    }
  }
}

for (const t of KR) await run(t)
const bl = avg(trim(base10))
console.log(`baseline 10봉 절사 평균: ${r2(bl)}% (표본 ${base10.length.toLocaleString()})\n`)
for (const [name, a] of Object.entries(buckets)) {
  if (a.length < 5) { console.log(`${name}: n=${a.length} — 표본 부족`); continue }
  const edge = avg(trim(a)) - bl
  const win = a.filter(x => x > 0).length / a.length * 100
  const s = syms[name]
  console.log(`${name}: n=${a.length} · ${s.size}종 · 절사edge ${edge >= 0 ? '+' : ''}${r2(edge)}%p · 승률 ${r2(win)}%`)
}
