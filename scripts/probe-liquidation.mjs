// Phase 0 실측: 비트코인 롱/숏 관련 무료 데이터가 실제로 오는가
//   ⚠️ 코인글래스 청산 '이력'은 유료 플랜 영역일 가능성이 높다 — 단정 말고 전수 호출로 확인한다.
//   대체 후보(무료·무인증)까지 함께 재서, 못 구하면 '무엇으로 대체 가능한가'를 같이 판정한다.
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const T = (ms = 9000) => AbortSignal.timeout(ms)

async function probe(label, url, pick) {
  try {
    const r = await fetch(url, { headers: UA, signal: T(), cache: 'no-store' })
    const txt = await r.text()
    let j = null
    try { j = JSON.parse(txt) } catch { /* non-json */ }
    const note = j ? (pick ? pick(j) : JSON.stringify(j).slice(0, 110)) : txt.slice(0, 110).replace(/\s+/g, ' ')
    console.log(`${r.ok ? '✅' : '❌'} ${String(r.status).padEnd(3)} ${label.padEnd(34)} ${note}`)
    return { ok: r.ok, j }
  } catch (e) {
    console.log(`❌ ERR ${label.padEnd(34)} ${String(e).slice(0, 80)}`)
    return { ok: false, j: null }
  }
}

console.log('── ① 청산(liquidation) 이력 — 스크린샷 그 차트 ─────────────────────')
await probe('Coinglass v2 무인증 liquidation', 'https://open-api.coinglass.com/public/v2/liquidation_history?symbol=BTC&time_type=h24')
await probe('Coinglass v4 무인증', 'https://open-api-v4.coinglass.com/api/futures/liquidation/history?exchange=Binance&symbol=BTCUSDT&interval=1d')
await probe('Binance allForceOrders(폐쇄 여부)', 'https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=5')
await probe('Bybit 공개 청산', 'https://api.bybit.com/v5/market/liquidation?category=linear&symbol=BTCUSDT&limit=5')
await probe('OKX 청산 주문', 'https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=BTC-USD&state=filled',
  j => `code=${j.code} msg=${(j.msg ?? '').slice(0, 40)} rows=${j.data?.length ?? 0}`)

console.log('\n── ② 대체 후보: 롱/숏 포지션 균형(무료·무인증) ──────────────────────')
await probe('Binance 롱숏 계정비율(5m~1d)', 'https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=3',
  j => Array.isArray(j) && j[0] ? `n=${j.length} 최신 long=${j[j.length-1].longAccount} short=${j[j.length-1].shortAccount}` : JSON.stringify(j).slice(0,100))
await probe('Binance 상위계정 포지션비율', 'https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=1d&limit=3',
  j => Array.isArray(j) && j[0] ? `n=${j.length} 최신 ratio=${j[j.length-1].longShortRatio}` : JSON.stringify(j).slice(0,100))
await probe('Binance 테이커 매수/매도 비율', 'https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1d&limit=3',
  j => Array.isArray(j) && j[0] ? `n=${j.length} 최신 buySell=${j[j.length-1].buySellRatio}` : JSON.stringify(j).slice(0,100))
await probe('Binance 미결제약정 이력', 'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=3',
  j => Array.isArray(j) && j[0] ? `n=${j.length} 최신 OI=${Number(j[j.length-1].sumOpenInterest).toFixed(0)} BTC` : JSON.stringify(j).slice(0,100))
await probe('Binance 펀딩비 이력', 'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=3',
  j => Array.isArray(j) && j[0] ? `n=${j.length} 최신 funding=${(Number(j[j.length-1].fundingRate)*100).toFixed(4)}%` : JSON.stringify(j).slice(0,100))
await probe('Bybit 롱숏 비율', 'https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=1d&limit=3',
  j => `retCode=${j.retCode} rows=${j.result?.list?.length ?? 0} ${j.result?.list?.[0] ? `long=${j.result.list[0].buyRatio}` : ''}`)
