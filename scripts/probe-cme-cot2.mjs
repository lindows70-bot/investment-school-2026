// 🔍 Phase 0-B — CME 비트코인 선물 COT 시계열로 "숏→롱 전환" 주장을 정면 검증한다.
//   ⚠️ 계약명을 정확히 지정해야 한다(MICRO·CBOE·Coinbase 가 섞이면 시계열이 뒤죽박죽 된다).
const SOC = 'https://publicreporting.cftc.gov/resource/gpe5-46if.json'
const CONTRACT = 'BITCOIN - CHICAGO MERCANTILE EXCHANGE'
const r = await fetch(`${SOC}?market_and_exchange_names=${encodeURIComponent(CONTRACT)}&$order=report_date_as_yyyy_mm_dd DESC&$limit=80`,
  { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
if (!r.ok) { console.error('HTTP', r.status); process.exit(1) }
const rows = (await r.json()).sort((a, b) => a.report_date_as_yyyy_mm_dd < b.report_date_as_yyyy_mm_dd ? -1 : 1)
const n = (v) => Number(v ?? 0)
console.log(`${CONTRACT} · ${rows.length}주 (${rows[0].report_date_as_yyyy_mm_dd.slice(0, 10)} ~ ${rows[rows.length - 1].report_date_as_yyyy_mm_dd.slice(0, 10)})\n`)
console.log('기준일        레버리지드펀드      자산운용사       딜러         총OI   레버 숏%')
for (const x of rows.slice(-32)) {
  const lev = n(x.lev_money_positions_long) - n(x.lev_money_positions_short)
  const am = n(x.asset_mgr_positions_long) - n(x.asset_mgr_positions_short)
  const dl = n(x.dealer_positions_long_all) - n(x.dealer_positions_short_all)
  const s = (v) => ((v >= 0 ? '+' : '') + v.toLocaleString()).padStart(9)
  console.log(`${x.report_date_as_yyyy_mm_dd.slice(0, 10)}  ${s(lev)}  ${s(am)}  ${s(dl)}  ${n(x.open_interest_all).toLocaleString().padStart(7)}  ${String(x.pct_of_oi_lev_money_short ?? '—').padStart(5)}%`)
}

// 방향 전환 판정 — 최근 8주 vs 그 이전 8주 평균
const net = (x, p) => n(x[`${p}_long`] ?? x[`${p}_long_all`]) - n(x[`${p}_short`] ?? x[`${p}_short_all`])
const avg = (a, f) => a.length ? Math.round(a.reduce((s, x) => s + f(x), 0) / a.length) : 0
const recent = rows.slice(-8), prior = rows.slice(-16, -8)
console.log('\n═══ 최근 8주 vs 직전 8주 평균 순포지션 ═══')
for (const [label, f] of [
  ['레버리지드 펀드(헤지펀드)', x => n(x.lev_money_positions_long) - n(x.lev_money_positions_short)],
  ['자산운용사(ETF·연기금)', x => n(x.asset_mgr_positions_long) - n(x.asset_mgr_positions_short)],
  ['딜러(중개·마켓메이커)', x => n(x.dealer_positions_long_all) - n(x.dealer_positions_short_all)],
]) {
  const a = avg(prior, f), b = avg(recent, f)
  const dir = b > a ? '▲ 롱 쪽으로' : b < a ? '▼ 숏 쪽으로' : '= 변화 없음'
  const flipped = (a < 0 && b > 0) ? ' ★숏→롱 전환' : (a > 0 && b < 0) ? ' ★롱→숏 전환' : ''
  console.log(`  ${label.padEnd(24)} ${String(a).padStart(8)} → ${String(b).padStart(8)}  ${dir}${flipped}`)
}
console.log(`\n최신(${rows[rows.length - 1].report_date_as_yyyy_mm_dd.slice(0, 10)}) 레버리지드: 롱 ${n(rows[rows.length - 1].lev_money_positions_long).toLocaleString()} / 숏 ${n(rows[rows.length - 1].lev_money_positions_short).toLocaleString()} · 자산운용사: 롱 ${n(rows[rows.length - 1].asset_mgr_positions_long).toLocaleString()} / 숏 ${n(rows[rows.length - 1].asset_mgr_positions_short).toLocaleString()}`)
console.log(`보고 지연: 기준일 ${rows[rows.length - 1].report_date_as_yyyy_mm_dd.slice(0, 10)} (화요일 마감) → 오늘 ${new Date().toISOString().slice(0, 10)} · 실제 공표는 매주 금요일`)
