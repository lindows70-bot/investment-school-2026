// 🔍 "지금이 침체기(Bear)가 맞나" 검증 — 라벨(달력 각본)이 아니라 **실제 가격**으로 판정한다.
//   과거 침체기의 정의적 특징(고점 대비 −70%대 드로다운·200주선 아래)이 지금도 성립하는지 대조.
const UA = { 'User-Agent': 'Mozilla/5.0' }
const chart = async (range, interval) => {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=${range}&interval=${interval}`, { headers: UA, signal: AbortSignal.timeout(20000) })
  const j = await r.json(); const q = j.chart.result[0]
  const out = []
  for (let i = 0; i < q.timestamp.length; i++) {
    const c = q.indicators.quote[0].close[i]
    if (typeof c === 'number' && c > 0) out.push({ d: new Date(q.timestamp[i] * 1000).toISOString().slice(0, 10), c })
  }
  return out
}
const D = await chart('10y', '1d')
const last = D[D.length - 1]
console.log(`현재 ${last.d} $${Math.round(last.c).toLocaleString()}  (일봉 ${D.length}개, ${D[0].d}~)`)

// ── ① 사상 최고가 대비 드로다운 ─────────────────────────────────────────────
let ath = 0, athD = ''
for (const x of D) if (x.c > ath) { ath = x.c; athD = x.d }
const dd = (1 - last.c / ath) * 100
console.log(`\n① 사상 최고가 $${Math.round(ath).toLocaleString()} (${athD}) → 현재 낙폭 **−${dd.toFixed(1)}%**`)

// ── ② 과거 사이클의 '침체 연도 7.5개월차'엔 낙폭이 얼마였나 ─────────────────
// 앱 각본: 침체 연도 = 2014·2018·2022·2026. 각 연도 1/1 + 7.5개월 = 약 8/16 시점을 본다.
console.log(`\n② 과거 침체기 같은 시점(연초+7.5개월 ≈ 8/16)의 고점 대비 낙폭`)
for (const y of [2014, 2018, 2022, 2026]) {
  const target = `${y}-08-16`
  const upTo = D.filter(x => x.d <= target)
  if (upTo.length < 30) { console.log(`   ${y}: 데이터 부족(야후 10년 한계)`); continue }
  let peak = 0; for (const x of upTo) if (x.c > peak) peak = x.c
  const px = upTo[upTo.length - 1]
  console.log(`   ${y}-08 → $${Math.round(px.c).toLocaleString()} · 그때까지 고점 $${Math.round(peak).toLocaleString()} · 낙폭 −${((1 - px.c / peak) * 100).toFixed(1)}%`)
}

// ── ③ 200주 이동평균(침체기의 고전적 기준선) 대비 ───────────────────────────
const W = await chart('10y', '1wk')
const ma200w = W.length >= 200 ? W.slice(-200).reduce((s, x) => s + x.c, 0) / 200 : null
console.log(`\n③ 200주 이동평균 $${ma200w ? Math.round(ma200w).toLocaleString() : '—'} → 현재가는 그 **${ma200w ? (last.c / ma200w).toFixed(2) : '—'}배**`)
console.log(`   (과거 진짜 침체기 바닥은 200주선 **아래**에서 형성됐다 — 0.6~0.8배 구간)`)
// 200주선 아래였던 날이 최근 2년에 며칠?
const below = W.slice(-104).filter((x, i, arr) => { const idx = W.length - 104 + i; if (idx < 200) return false
  const m = W.slice(idx - 199, idx + 1).reduce((s, y) => s + y.c, 0) / 200; return x.c < m }).length
console.log(`   최근 2년(104주) 중 200주선 아래였던 주: ${below}주`)

// ── ④ 최근 3일 상승폭 + 30일 흐름 ───────────────────────────────────────────
const r = (n) => ((last.c / D[D.length - 1 - n].c - 1) * 100)
console.log(`\n④ 최근 상승: 3일 ${r(3) >= 0 ? '+' : ''}${r(3).toFixed(1)}% · 7일 ${r(7) >= 0 ? '+' : ''}${r(7).toFixed(1)}% · 30일 ${r(30) >= 0 ? '+' : ''}${r(30).toFixed(1)}% · 90일 ${r(90) >= 0 ? '+' : ''}${r(90).toFixed(1)}%`)

// ── ⑤ 앱 화면값 교차 ────────────────────────────────────────────────────────
const app = await fetch('https://investment-school-2026.vercel.app/api/coin-lab', { signal: AbortSignal.timeout(60000) }).then(x => x.ok ? x.json() : null).catch(() => null)
if (app) {
  console.log(`\n⑤ 앱 값 — 메이어 ${app.mayer?.multiple ?? '?'} · 공포탐욕 ${app.fearGreed?.value ?? '?'} · 레인보우 ${app.rainbow?.bandLabel ?? app.rainbow?.band ?? '?'} · 사이클 단계 ${app.cycle?.phase ?? app.halving?.phase ?? '?'}`)
} else console.log('\n⑤ 앱 coin-lab 응답 없음(엔드포인트명 상이 가능)')
