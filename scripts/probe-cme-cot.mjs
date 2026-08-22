// 🔍 Phase 0 — 영상 핵심 주장 "CME 기관 포지션이 숏→롱으로 일제히 전환" 을 실데이터로 검증할 수 있나.
//   ⛔ 영상·요약을 믿고 코드부터 짜지 않는다. 계열 존재·필드명·주기·이력을 먼저 확인한다.
//   후보: CFTC 주간 COT(Commitments of Traders) — Socrata 공개 API. 비트코인 선물은 CME 상장.

const SOC = 'https://publicreporting.cftc.gov/resource'
const q = async (ds, params) => {
  const url = `${SOC}/${ds}.json?${params}`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) return { err: `HTTP ${r.status}`, url }
  return { rows: await r.json(), url }
}

// ── ① 비트코인 계약을 어느 데이터셋이 담고 있나 ──────────────────────────────
//   gpe5-46if = Traders in Financial Futures (TFF) · 6dca-aqww = Disaggregated · jun7-fc8e = Legacy
console.log('═══ ① 데이터셋별 비트코인 계약 탐색 ═══')
for (const [ds, label] of [['gpe5-46if', 'TFF(금융선물)'], ['6dca-aqww', 'Disaggregated'], ['jun7-fc8e', 'Legacy']]) {
  const r = await q(ds, `$where=upper(market_and_exchange_names) like '%25BITCOIN%25'&$select=market_and_exchange_names,count(*)&$group=market_and_exchange_names&$limit=20`)
  if (r.err) { console.log(`  ${label.padEnd(16)} ❌ ${r.err}`); continue }
  console.log(`  ${label.padEnd(16)} ${r.rows.length}개 계약`)
  for (const x of r.rows) console.log(`      ${x.market_and_exchange_names} — ${x.count}주`)
}

// ── ② TFF 최신 관측의 필드 전수(필드명을 짐작하지 않는다) ─────────────────────
console.log('\n═══ ② TFF 비트코인 최신행 필드 ═══')
const one = await q('gpe5-46if', `$where=upper(market_and_exchange_names) like '%25BITCOIN%25'&$order=report_date_as_yyyy_mm_dd DESC&$limit=1`)
if (one.err) console.log('  ❌', one.err)
else if (!one.rows.length) console.log('  (행 없음)')
else {
  const r0 = one.rows[0]
  console.log(`  계약: ${r0.market_and_exchange_names} · 기준일 ${r0.report_date_as_yyyy_mm_dd?.slice(0, 10)}`)
  const keys = Object.keys(r0).filter(k => /lev_money|asset_mgr|dealer|open_interest|change/.test(k))
  for (const k of keys) console.log(`    ${k.padEnd(42)} = ${r0[k]}`)
}

// ── ③ 최근 30주 레버리지드 펀드(헤지펀드)·자산운용사 순포지션 추이 ────────────
console.log('\n═══ ③ 최근 30주 순포지션(계약수) — 숏→롱 전환이 실제로 보이나 ═══')
const hist = await q('gpe5-46if', `$where=upper(market_and_exchange_names) like '%25BITCOIN%25'&$order=report_date_as_yyyy_mm_dd DESC&$limit=40`)
if (hist.err) console.log('  ❌', hist.err)
else {
  const rows = hist.rows.filter(r => /CME|CHICAGO MERCANTILE/i.test(r.market_and_exchange_names) && !/MICRO/i.test(r.market_and_exchange_names))
  console.log(`  대상 계약: ${rows[0]?.market_and_exchange_names ?? '없음'} (${rows.length}주)`)
  console.log('  기준일       레버리지드펀드(롱-숏)   자산운용사(롱-숏)     딜러(롱-숏)      총OI')
  const n = (v) => Number(v ?? 0)
  for (const r of rows.slice(0, 30).reverse()) {
    const lev = n(r.lev_money_positions_long) - n(r.lev_money_positions_short)
    const am = n(r.asset_mgr_positions_long) - n(r.asset_mgr_positions_short)
    const dl = n(r.dealer_positions_long_all) - n(r.dealer_positions_short_all)
    const oi = n(r.open_interest_all)
    const bar = (v) => (v >= 0 ? '+' : '') + v.toLocaleString()
    console.log(`  ${r.report_date_as_yyyy_mm_dd?.slice(0, 10)}  ${bar(lev).padStart(14)}  ${bar(am).padStart(16)}  ${bar(dl).padStart(14)}  ${oi.toLocaleString().padStart(9)}`)
  }
}

// ── ④ 채굴자 매도 압력 — 해시레이트로 대리 확인 가능한가 ──────────────────────
console.log('\n═══ ④ 채굴자 지표(blockchain.info) ═══')
for (const [chart, label] of [['hash-rate', '해시레이트'], ['miners-revenue', '채굴자 수익']]) {
  try {
    const r = await fetch(`https://api.blockchain.info/charts/${chart}?timespan=1year&format=json&sampled=true`, { signal: AbortSignal.timeout(25000) })
    if (!r.ok) { console.log(`  ${label} ❌ HTTP ${r.status}`); continue }
    const j = await r.json()
    const v = j.values ?? []
    const last = v[v.length - 1], first = v[0]
    console.log(`  ${label.padEnd(12)} ${v.length}포인트 · ${new Date(first.x * 1000).toISOString().slice(0, 10)} ~ ${new Date(last.x * 1000).toISOString().slice(0, 10)} · 최신 ${last.y.toExponential(3)} (1년 전 대비 ${((last.y / first.y - 1) * 100).toFixed(1)}%)`)
  } catch (e) { console.log(`  ${label} ❌ ${e.message}`) }
}
