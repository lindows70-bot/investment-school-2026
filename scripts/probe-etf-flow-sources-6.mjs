// 🔍 Phase 0 (6차) — TheBlock 시리즈 파싱: 발행사 목록·최신 날짜·최근 6일 값을 뉴스 실측치와 대조(09-21 총 $999M · IBIT 381.4/ARKB 289.1/FBTC 238.8 · 09-22 $714.7M)
import https from 'node:https'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const getJson = url => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.theblock.co/data/etfs/bitcoin-etf' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(new Error('non-json ' + res.statusCode + ' ' + d.slice(0, 80))) } }) })
  req.on('error', reject); req.setTimeout(20000, () => req.destroy(new Error('timeout')))
})
const day = ts => new Date(ts * 1000).toISOString().slice(0, 10)
const flows = await getJson('https://www.theblock.co/api/charts/chart/etfs/bitcoin-etf/spot-bitcoin-etf-flows')
const total = await getJson('https://www.theblock.co/api/charts/chart/etfs/bitcoin-etf/spot-bitcoin-etf-total-net-flow')
const S = flows.chart.jsonFile.Series, T = total.chart.jsonFile.Series
console.log('meta:', JSON.stringify(flows.chart.jsonFile?.Meta ?? flows.meta ?? {}).slice(0, 300))
console.log('issuers:', Object.keys(S).join(', '))
console.log('total keys:', Object.keys(T).join(', '))
const byDate = new Map()
for (const [iss, s] of Object.entries(S)) for (const p of s.Data) { const d = day(p.Timestamp); if (!byDate.has(d)) byDate.set(d, {}); byDate.get(d)[iss] = p.Result }
const totalMap = new Map(Object.values(T)[0].Data.map(p => [day(p.Timestamp), p.Result]))
const dates = [...byDate.keys()].sort()
console.log('rows', dates.length, 'first', dates[0], 'last', dates[dates.length - 1], '| total rows', totalMap.size, 'last', [...totalMap.keys()].sort().slice(-1)[0])
for (const d of dates.slice(-6)) {
  const row = byDate.get(d); const sum = Object.values(row).reduce((a, b) => a + b, 0)
  console.log(d, 'sum(issuers)=' + (sum / 1e6).toFixed(1) + 'M', 'total=' + ((totalMap.get(d) ?? NaN) / 1e6).toFixed(1) + 'M', Object.entries(row).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)}`).join(' · '))
}
// 2026-08-21 실측(Farside 원천 +307.5) · 09-04 (Farside +174.6 · IBIT 117.4 FBTC 57.2) 대조
for (const d of ['2026-08-21', '2026-09-03', '2026-09-04']) { const row = byDate.get(d) ?? {}; console.log('대조', d, 'total=' + ((totalMap.get(d) ?? NaN) / 1e6).toFixed(1), Object.entries(row).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)}`).join(' · ')) }
