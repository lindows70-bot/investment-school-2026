// Phase 0: 현물/선물 수요 동시차트(크립토퀀트 스타일) 재현 입력 실측
//  선물 수요 = OI 30일 변화(BTC) · 현물 수요 = ETF 순유입 30일 합(BTC 환산) · 가격 라인
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const g = async (u) => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(12000), cache: 'no-store' }); return r.json() }

console.log('── 바이비트 OI: 단위·필드·깊이 ──')
const by = await g('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200')
const list = by?.result?.list ?? []
console.log(`retCode=${by.retCode} · ${list.length}건 · 필드: ${Object.keys(list[0] ?? {}).join(', ')}`)
console.log(`첫(최신): ${JSON.stringify(list[0])}`)
console.log(`끝(최과거): ${JSON.stringify(list[list.length-1])}`)
const oi0 = Number(list[0]?.openInterest)
console.log(`최신 OI = ${oi0.toLocaleString()} → BTC 단위면 ~${(oi0).toFixed(0)} BTC(약 $${(oi0*75000/1e9).toFixed(1)}B), 계약(USDT)이면 비현실`)

console.log('\n── OKX rubik(대조) ──')
const ok = await g('https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1D')
console.log(`${ok?.data?.length ?? 0}건 · 샘플 [ts, oi, vol] = ${JSON.stringify(ok?.data?.[0])}`)

console.log('\n── BTC 일별 종가(야후, 200일) ──')
const yf = await g('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=1y&interval=1d')
const q = yf?.chart?.result?.[0]
console.log(`${q?.timestamp?.length ?? 0}봉 · 최근 종가 $${q?.indicators?.quote?.[0]?.close?.slice(-1)[0]?.toFixed(0)}`)

console.log('\n── 30일 변화 시계열이 몇 포인트 나오나 ──')
console.log(`  바이비트 OI ${list.length}일 → 30일 변화 ${Math.max(0, list.length - 30)}포인트 (약 ${((list.length-30)/30).toFixed(1)}개월)`)
