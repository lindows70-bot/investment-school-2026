// 🔍 불일치 원인 가설 검정 — CryptoQuant 차트가 초록(순롱)을 보이는 이유가 무엇인가.
//    ⛔ "내가 맞다"로 끝내지 않는다. 가설을 나열하고 하나씩 데이터로 친다.
//    H1: MICRO 계약을 합산했다        H2: 스프레드 포지션을 롱에 포함했다
//    H3: 다른 주체(자산운용사 등)다   H4: 주간 '변화량'을 그렸다        H5: CBOE 등 타 거래소 합산
const SOC = 'https://publicreporting.cftc.gov/resource/gpe5-46if.json'
const UA = { 'User-Agent': 'Mozilla/5.0' }
const n = (v) => Number(v ?? 0)

const pull = async (contract) => {
  const rows = []
  for (let off = 0; off < 1000; off += 500) {
    const u = `${SOC}?market_and_exchange_names=${encodeURIComponent(contract)}&$order=report_date_as_yyyy_mm_dd ASC&$limit=500&$offset=${off}`
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) })
    if (!r.ok) break
    const j = await r.json(); rows.push(...j); if (j.length < 500) break
  }
  return rows
}
const since = (rows, d) => rows.filter(x => String(x.report_date_as_yyyy_mm_dd) >= d)
const posWeeks = (arr, f) => { const a = arr.map(f); return { pos: a.filter(v => v > 0).length, tot: a.length, last: a[a.length - 1], min: Math.min(...a), max: Math.max(...a) } }

const BIG = 'BITCOIN - CHICAGO MERCANTILE EXCHANGE'
const MICRO = 'MICRO BITCOIN - CHICAGO MERCANTILE EXCHANGE'
const CBOE = 'BITCOIN-USD - CBOE FUTURES EXCHANGE'

const big = await pull(BIG), micro = await pull(MICRO), cboe = await pull(CBOE)
console.log(`계약별 주수 — BIG ${big.length} · MICRO ${micro.length} · CBOE ${cboe.length}\n`)

const lev = (x) => n(x.lev_money_positions_long) - n(x.lev_money_positions_short)
const levSpread = (x) => n(x.lev_money_positions_long) + n(x.lev_money_positions_spread) - n(x.lev_money_positions_short)
const asset = (x) => n(x.asset_mgr_positions_long) - n(x.asset_mgr_positions_short)

const S = '2024-01-01'
console.log('═══ H1: MICRO 계약도 순숏인가 (합산해도 초록이 안 되나) ═══')
for (const [label, rows] of [['BIG(5 BTC)', big], ['MICRO(0.1 BTC)', micro], ['CBOE', cboe]]) {
  const a = since(rows, S)
  if (!a.length) { console.log(`  ${label.padEnd(16)} (2024년 이후 데이터 없음)`); continue }
  const r = posWeeks(a, lev)
  console.log(`  ${label.padEnd(16)} 순롱 ${r.pos}/${r.tot}주 · 최신 ${r.last} · 범위 ${r.min}~${r.max}`)
}
// BTC 환산 합산(계약 크기 반영)
const byDate = {}
for (const x of since(big, S)) byDate[String(x.report_date_as_yyyy_mm_dd).slice(0,10)] = { big: lev(x) * 5 }
for (const x of since(micro, S)) { const d = String(x.report_date_as_yyyy_mm_dd).slice(0,10); if (byDate[d]) byDate[d].micro = lev(x) * 0.1 }
const comb = Object.entries(byDate).map(([d, v]) => ({ d, btc: (v.big ?? 0) + (v.micro ?? 0) }))
const cp = comb.filter(x => x.btc > 0).length
console.log(`  → BIG+MICRO BTC 환산 합산: 순롱 ${cp}/${comb.length}주 · 최신 ${comb[comb.length-1]?.btc.toFixed(0)} BTC`)

console.log('\n═══ H2: 스프레드를 롱에 포함하면 부호가 바뀌나 ═══')
const a2 = since(big, S)
const r2 = posWeeks(a2, levSpread)
console.log(`  롱+스프레드−숏: 순롱 ${r2.pos}/${r2.tot}주 · 최신 ${r2.last} · 범위 ${r2.min}~${r2.max}`)

console.log('\n═══ H3: 다른 주체가 초록인가 ═══')
for (const [label, f] of [['레버리지드 펀드', lev], ['자산운용사', asset],
  ['딜러', x => n(x.dealer_positions_long_all) - n(x.dealer_positions_short_all)],
  ['기타 보고대상', x => n(x.other_rept_positions_long) - n(x.other_rept_positions_short)]]) {
  const r = posWeeks(a2, f)
  console.log(`  ${label.padEnd(14)} 순롱 ${String(r.pos).padStart(3)}/${r.tot}주 · 최신 ${String(r.last).padStart(7)} · 범위 ${String(r.min).padStart(7)}~${String(r.max).padStart(6)}`)
}

console.log('\n═══ H4: 주간 "변화량"을 그렸다면 초록이 자주 나오나 ═══')
const chg = []
for (let i = 1; i < a2.length; i++) chg.push(lev(a2[i]) - lev(a2[i - 1]))
console.log(`  주간 변화량: 양(+) ${chg.filter(v => v > 0).length}/${chg.length}주 · 최신 ${chg[chg.length-1]}`)
console.log(`  → 변화량이라면 절반쯤 초록이 나온다. 차트의 초록이 드문드문이면 이 가설은 약하다`)

console.log('\n═══ 결론 요약 ═══')
console.log(`  2024-01 이후 BIG 계약 레버리지드 펀드가 순롱이었던 주: ${posWeeks(a2, lev).pos}주`)
console.log(`  전 이력에서 마지막 순롱 주: 2019-02-05 (그 이후 7년간 0회)`)
