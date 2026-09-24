// 🔍 현물 BTC ETF 순유입 대체 출처 Phase 0 실측 — Farside 가 Cloudflare 로 막힌 뒤(2026-09-24). 키 없이·서버에서 받을 수 있는가만 본다
import https from 'node:https'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const get = (url, headers = {}) => new Promise(resolve => {
  const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html;q=0.9,*/*;q=0.8', ...headers } }, res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, len: d.length, body: d, ct: res.headers['content-type'] }))
  })
  req.on('error', e => resolve({ status: 'ERR', err: e.message, body: '' }))
  req.setTimeout(15000, () => req.destroy(new Error('timeout')))
})
const show = (label, r, extra = '') => console.log(`${label}: ${r.status} ${r.err ?? ''} len=${r.len ?? 0} ct=${(r.ct ?? '').slice(0, 30)} ${extra}`)

// ① CoinMarketCap 프론트 data-api (비공식·무키)
for (const u of [
  'https://api.coinmarketcap.com/data-api/v3/etf/overview?category=spot&type=bitcoin',
  'https://api.coinmarketcap.com/data-api/v3/etf/flow/historical?category=spot&type=bitcoin&range=1m',
  'https://api.coinmarketcap.com/data-api/v3/etf/netflow/historical?type=bitcoin&range=30d',
]) { const r = await get(u, { Origin: 'https://coinmarketcap.com', Referer: 'https://coinmarketcap.com/etf/bitcoin/' }); show('CMC ' + u.split('/v3/')[1].slice(0, 40), r, r.body.slice(0, 200).replace(/\s+/g, ' ')) }

// ② TheBlock 차트 API (무키)
for (const u of [
  'https://www.theblock.co/api/charts/chart/crypto-markets/bitcoin-etf/spot-bitcoin-etf-flows-daily',
  'https://www.theblock.co/api/charts/chart/crypto-markets/bitcoin-etf/net-spot-bitcoin-etf-flows',
]) { const r = await get(u); show('TheBlock', r, r.body.slice(0, 160).replace(/\s+/g, ' ')) }

// ③ CoinGlass 공개 프론트 API (무키)
for (const u of ['https://open-api-v4.coinglass.com/api/etf/bitcoin/flow-history', 'https://capi.coinglass.com/api/etf/bitcoin/flow?type=1']) {
  const r = await get(u); show('CoinGlass', r, r.body.slice(0, 160).replace(/\s+/g, ' '))
}

// ④ Yahoo quoteSummary — 현물 ETF 순자산(totalAssets)·NAV 로 ΔAUM 역산이 가능한가(lib/etfFlow.ts 와 같은 방법). 매일 바뀌는지가 관건
for (const t of ['IBIT', 'FBTC', 'GBTC']) {
  const r = await get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=defaultKeyStatistics,price,summaryDetail`)
  let info = ''
  try { const j = JSON.parse(r.body); const res = j.quoteSummary.result[0]; info = `totalAssets=${res.summaryDetail?.totalAssets?.raw} nav=${res.summaryDetail?.navPrice?.raw} sharesOut=${res.defaultKeyStatistics?.sharesOutstanding?.raw} price=${res.price?.regularMarketPrice?.raw}` } catch { info = r.body.slice(0, 120) }
  show('Yahoo ' + t, r, info)
}

// ⑤ 발행사 원본 — iShares IBIT 일별 순자산·발행주수 CSV(예전 실측: HTML 차단) 재확인
const ish = await get('https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf/1467271812596.ajax?fileType=csv&fileName=IBIT_holdings&dataType=fund')
show('iShares IBIT csv', ish, ish.body.slice(0, 120).replace(/\s+/g, ' '))
