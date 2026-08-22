// 🔍 Phase 0 — 스크린샷 ①공급 분해 ③미국 부채 ④전세계 자산 시총, 각각 무료 소스로 조달 가능한가.
const UA = { 'User-Agent': 'Mozilla/5.0' }
const ok = (s) => `✅ ${s}`, no = (s) => `❌ ${s}`

// ── ③ 미국 정부부채 ──────────────────────────────────────────────────────────
console.log('═══ ③ 미국 정부부채(스크린샷: 39조 2,300억 달러 · 2026-03) ═══')
try {
  const r = await fetch('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=5', { headers: UA, signal: AbortSignal.timeout(25000) })
  if (r.ok) {
    const j = await r.json()
    console.log(ok('재무부 Fiscal Data API (키 불필요·일별)'))
    for (const d of (j.data ?? []).slice(0, 3)) {
      console.log(`     ${d.record_date} · 총부채 $${(Number(d.tot_pub_debt_out_amt) / 1e12).toFixed(2)}조`)
    }
  } else console.log(no(`재무부 API HTTP ${r.status}`))
} catch (e) { console.log(no(`재무부 API ${e.message}`)) }
// FRED 대안
try {
  const { readFileSync } = await import('node:fs')
  let K = process.env.FRED_API_KEY
  if (!K) { try { K = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {} }
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=GFDEBTN&api_key=${K}&file_type=json&observation_start=2024-01-01`, { signal: AbortSignal.timeout(25000) })
  const j = await r.json()
  const o = (j.observations ?? []).filter(x => x.value !== '.')
  const l = o[o.length - 1]
  console.log(ok(`FRED GFDEBTN (분기별) 최신 ${l.date} = $${(Number(l.value) / 1e6).toFixed(2)}조`))
} catch (e) { console.log(no(`FRED ${e.message}`)) }

// ── ④ 전세계 자산 시가총액 ───────────────────────────────────────────────────
console.log('\n═══ ④ 전세계 자산 시총 순위(스크린샷: 금 22.6조 · BTC 2.33조) ═══')
const quote = async (sym) => {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (!r.ok) return null
  const q = (await r.json())?.chart?.result?.[0]
  return q?.meta ?? null
}
console.log('  a) 개별 기업 시총 — Yahoo chart meta 에 marketCap 이 오나?')
for (const s of ['NVDA', 'MSFT', 'AAPL']) {
  const m = await quote(s)
  console.log(`     ${s.padEnd(6)} regularMarketPrice=${m?.regularMarketPrice ?? '—'} · marketCap 필드 ${m && 'marketCap' in m ? '있음' : '❌ 없음(quoteSummary 필요)'}`)
}
console.log('  b) 금·은 가격 — 선물/현물')
for (const [s, label] of [['GC=F', '금 선물'], ['SI=F', '은 선물'], ['XAUUSD=X', '금 현물']]) {
  const m = await quote(s)
  console.log(`     ${label.padEnd(8)} ${s.padEnd(10)} ${m?.regularMarketPrice ?? no('없음')}`)
}
console.log('  c) 비트코인 공급량 — blockchain.info')
try {
  const r = await fetch('https://blockchain.info/q/totalbc', { headers: UA, signal: AbortSignal.timeout(20000) })
  const v = Number(await r.text()) / 1e8
  console.log(`     ${ok(`유통량 ${v.toLocaleString()} BTC`)}`)
} catch (e) { console.log(`     ${no(e.message)}`) }
console.log('  ⚠️ 금 시총 = 가격 × 지상 재고. 재고량은 API 가 아니라 WGC 연차보고 값(정적 참조) 필요')

// ── ① 비트코인 공급 분해 ─────────────────────────────────────────────────────
console.log('\n═══ ① 공급 분해(스크린샷: ETF·재무기업 13.9% · 거래소·수탁 36.1% · 자가보관 45.6% · 분실 7.7%) ═══')
console.log('  a) ETF 보유량 — 우리 앱 btc-etf 누적 순유입으로 대리 가능한가')
try {
  const r = await fetch('https://investment-school-2026.vercel.app/api/btc-etf', { signal: AbortSignal.timeout(60000) })
  const j = r.ok ? await r.json() : null
  if (j?.flowCumulative) {
    const c = j.flowCumulative
    const lastC = Array.isArray(c) ? c[c.length - 1] : null
    console.log(`     ${ok('btc-etf 응답 있음')} · flowCumulative 최신 ${JSON.stringify(lastC).slice(0, 120)}`)
  } else console.log(`     ${no('flowCumulative 없음')} · keys=${j ? Object.keys(j).join(',') : '—'}`)
} catch (e) { console.log(`     ${no(e.message)}`) }
console.log('  b) 기업 재무 보유(Strategy 등) — 공개 API?')
for (const [u, label] of [
  ['https://bitcointreasuries.net/api/v1/entities', 'bitcointreasuries.net'],
  ['https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin', 'CoinGecko 공개기업 보유'],
]) {
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) })
    if (!r.ok) { console.log(`     ${no(`${label} HTTP ${r.status}`)}`); continue }
    const j = await r.json()
    if (label.includes('CoinGecko')) {
      console.log(`     ${ok(`${label} — 총 ${j.total_holdings?.toLocaleString()} BTC (유통량의 ${j.market_cap_dominance}%) · 기업 ${j.companies?.length}곳`)}`)
      for (const c of (j.companies ?? []).slice(0, 3)) console.log(`        ${c.name}: ${c.total_holdings?.toLocaleString()} BTC`)
    } else console.log(`     ${ok(`${label} — ${Array.isArray(j) ? j.length + '개' : typeof j}`)}`)
  } catch (e) { console.log(`     ${no(`${label} ${e.message}`)}`) }
}
console.log('  c) 거래소 잔고·수탁·분실 추정 — 무료 API 존재? (Glassnode·CryptoQuant 는 유료)')
console.log('     → 이 세 항목은 유료 온체인 데이터라 조달 불가 예상. 확인 필요')
