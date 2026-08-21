// Phase 0: 크립토퀀트 "Spot vs Futures Demand Growth(30일 합)" 재현 가능성 — 핵심은 **OI 장기 이력**
//   그 차트는 1.5년치 시계열이라 '30일 변화'를 매일 그리려면 최소 1.5년+30일치 일별 OI 가 필요하다.
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const g = async (u) => { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(9000), cache: 'no-store' }); return { s: r.status, j: await r.json() } } catch (e) { return { s: 0, err: String(e) } } }
const span = (arr, tf) => { const t = arr.map(tf).filter(Number.isFinite).sort((a,b)=>a-b)
  return t.length ? `${t.length}건 · ${new Date(t[0]).toISOString().slice(0,10)} ~ ${new Date(t[t.length-1]).toISOString().slice(0,10)} = ${((t[t.length-1]-t[0])/864e5).toFixed(0)}일` : '0건' }

console.log('── 선물 미결제약정(OI) 일별 이력 — 며칠까지 주나 ──')
const b = await g('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=500')
console.log(`바이낸스  ${Array.isArray(b.j) ? span(b.j, x => Number(x.timestamp)) : `실패(${b.s})`}`)

const ok = await g('https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1D')
console.log(`OKX rubik ${ok.j?.data?.length ? span(ok.j.data, x => Number(x[0])) : `실패(code=${ok.j?.code} ${ok.j?.msg ?? ''})`}`)

const by = await g('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200')
console.log(`바이비트  ${by.j?.result?.list?.length ? span(by.j.result.list, x => Number(x.timestamp)) : `실패(retCode=${by.j?.retCode})`}`)

const cg = await g('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=400&interval=daily')
console.log(`\n코인게코 현물 시세/거래량 ${cg.j?.prices?.length ? span(cg.j.prices, x => x[0]) : `실패(${cg.s})`}`)
