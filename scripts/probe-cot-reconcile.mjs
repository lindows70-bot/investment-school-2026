// 🔍 대조 검증 — CryptoQuant "CME Futures Net Position by Leveraged Funds (USD)" 차트는
//    2025~2026 구간에 **초록(순롱)** 을 보여준다. 내 CFTC 계산은 순숏(-7,439계약)이었다.
//    둘 중 하나가 틀렸거나, 서로 다른 것을 재고 있다. 전 이력(2019~)을 USD 로 환산해 대조한다.
//    ⛔ "내 값이 맞다"고 단정하지 않는다 — 사용자가 반대 증거를 제시했으면 다시 잰다.

const SOC = 'https://publicreporting.cftc.gov/resource'
const UA = { 'User-Agent': 'Mozilla/5.0' }
const n = (v) => Number(v ?? 0)

// ── BTC 주간 종가(계약수 → USD 환산용) ────────────────────────────────────────
const p2 = Math.floor(Date.now() / 1000), p1 = Math.floor(new Date('2018-06-01').getTime() / 1000)
const cr = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1=${p1}&period2=${p2}&interval=1wk`, { headers: UA, signal: AbortSignal.timeout(30000) })
const cq = (await cr.json())?.chart?.result?.[0]
const px = []
for (let i = 0; i < cq.timestamp.length; i++) {
  const c = cq.indicators?.quote?.[0]?.close?.[i]
  if (typeof c === 'number' && c > 0) px.push({ d: new Date(cq.timestamp[i] * 1000).toISOString().slice(0, 10), c })
}
const priceAt = (d) => { const a = px.filter(x => x.d <= d); return a.length ? a[a.length - 1].c : null }
console.log(`BTC 주봉 ${px.length}개 (${px[0].d} ~ ${px[px.length - 1].d})`)

// ── 전 이력 COT (여러 데이터셋 대조) ──────────────────────────────────────────
const CONTRACT = 'BITCOIN - CHICAGO MERCANTILE EXCHANGE'
const pull = async (ds) => {
  const rows = []
  for (let off = 0; off < 600; off += 500) {
    const u = `${SOC}/${ds}.json?market_and_exchange_names=${encodeURIComponent(CONTRACT)}&$order=report_date_as_yyyy_mm_dd ASC&$limit=500&$offset=${off}`
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) })
    if (!r.ok) break
    const j = await r.json()
    rows.push(...j)
    if (j.length < 500) break
  }
  return rows
}

const tff = await pull('gpe5-46if')     // Traders in Financial Futures — Leveraged Money
console.log(`\nTFF ${tff.length}주 (${tff[0]?.report_date_as_yyyy_mm_dd?.slice(0,10)} ~ ${tff[tff.length-1]?.report_date_as_yyyy_mm_dd?.slice(0,10)})`)

// CME 비트코인 선물 계약 크기 = 5 BTC
const SZ = 5
const series = tff.map(x => {
  const d = String(x.report_date_as_yyyy_mm_dd).slice(0, 10)
  const net = n(x.lev_money_positions_long) - n(x.lev_money_positions_short)
  const p = priceAt(d)
  return { d, net, usd: p ? net * SZ * p : null, price: p, oi: n(x.open_interest_all) }
})

// ── ① 순롱(초록)이었던 주가 실제로 있었나 ────────────────────────────────────
const pos = series.filter(s => s.net > 0)
console.log(`\n═══ ① 레버리지드 펀드가 순롱이었던 주: ${pos.length} / ${series.length}주 ═══`)
if (pos.length) {
  console.log('  최초:', pos[0].d, pos[0].net, '계약')
  console.log('  최근:', pos[pos.length - 1].d, pos[pos.length - 1].net, '계약')
  // 연도별 순롱 주 수
  const byY = {}
  for (const s of pos) { const y = s.d.slice(0, 4); byY[y] = (byY[y] ?? 0) + 1 }
  console.log('  연도별:', Object.entries(byY).map(([y, c]) => `${y}:${c}주`).join(' · '))
} else console.log('  ❌ 전 이력에서 단 한 주도 순롱인 적이 없다')

// ── ② USD 환산 스케일이 차트(-$1B ~ $0)와 맞나 ───────────────────────────────
console.log(`\n═══ ② USD 환산 — 차트 y축은 $0 ~ -$1B ═══`)
const withUsd = series.filter(s => s.usd != null)
const minU = Math.min(...withUsd.map(s => s.usd)), maxU = Math.max(...withUsd.map(s => s.usd))
console.log(`  전 이력 범위: ${(minU/1e9).toFixed(2)}B ~ ${(maxU/1e9).toFixed(2)}B`)
const last = withUsd[withUsd.length - 1]
console.log(`  최신 ${last.d}: ${last.net.toLocaleString()}계약 × 5 BTC × $${Math.round(last.price).toLocaleString()} = ${(last.usd/1e9).toFixed(2)}B`)
console.log(`  → 차트가 -$1B 를 최저로 그린다면, 우리 최신값 ${(last.usd/1e9).toFixed(2)}B 는 축 밖이다. 스케일 불일치 여부 확인 필요`)

// ── ③ 최근 3년 분기별 평균 — 초록 구간 위치 대조 ──────────────────────────────
console.log(`\n═══ ③ 분기별 평균 순포지션(계약 / USD) — 차트의 초록 구간이 어디인지 ═══`)
const q = {}
for (const s of series.filter(x => x.d >= '2024-01-01')) {
  const k = `${s.d.slice(0, 4)}Q${Math.floor(Number(s.d.slice(5, 7)) / 3.01) + 1}`
  ;(q[k] ??= []).push(s)
}
for (const [k, arr] of Object.entries(q)) {
  const avgN = Math.round(arr.reduce((s, x) => s + x.net, 0) / arr.length)
  const avgU = arr.filter(x => x.usd != null).reduce((s, x) => s + x.usd, 0) / arr.length
  const posW = arr.filter(x => x.net > 0).length
  console.log(`  ${k}  평균 ${String(avgN).padStart(8)}계약  ${(avgU/1e9).toFixed(2).padStart(7)}B  · 순롱 주 ${posW}/${arr.length}`)
}

// ── ④ 다른 카테고리도 확인 — CryptoQuant 가 다른 주체를 그렸을 가능성 ─────────
console.log(`\n═══ ④ 최신 주 전체 카테고리(무엇이 초록일 수 있나) ═══`)
const L = tff[tff.length - 1]
const cats = [
  ['레버리지드 펀드', n(L.lev_money_positions_long) - n(L.lev_money_positions_short)],
  ['자산운용사', n(L.asset_mgr_positions_long) - n(L.asset_mgr_positions_short)],
  ['딜러', n(L.dealer_positions_long_all) - n(L.dealer_positions_short_all)],
  ['기타 보고대상', n(L.other_rept_positions_long) - n(L.other_rept_positions_short)],
  ['비보고(소액)', n(L.nonrept_positions_long_all) - n(L.nonrept_positions_short_all)],
]
for (const [k, v] of cats) console.log(`  ${k.padEnd(14)} ${String((v>=0?'+':'')+v).padStart(8)}계약  ${((v*SZ*last.price)/1e9).toFixed(2).padStart(7)}B`)
