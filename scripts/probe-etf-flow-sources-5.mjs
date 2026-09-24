// 🔍 Phase 0 (5차) — TheBlock 차트 API(슬러그 실측 etfs/bitcoin-etf/...) · simplemining · cryptodataapi · GitHub raw 데이터셋
import https from 'node:https'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const get = (url, headers = {}) => new Promise(resolve => {
  const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html;q=0.9,*/*;q=0.8', ...headers } }, res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, len: d.length, body: d, ct: res.headers['content-type'], loc: res.headers.location }))
  })
  req.on('error', e => resolve({ status: 'ERR', err: e.message, body: '' }))
  req.setTimeout(20000, () => req.destroy(new Error('timeout')))
})
const show = (label, r, extra = '') => console.log(`${label}: ${r.status} ${r.err ?? ''} len=${r.len ?? 0} ct=${(r.ct ?? '').slice(0, 30)} ${r.loc ? 'loc=' + r.loc : ''} ${extra}`)
const peek = (b, n = 220) => b.slice(0, n).replace(/\s+/g, ' ')

for (const slug of ['etfs/bitcoin-etf/spot-bitcoin-etf-flows', 'etfs/bitcoin-etf/spot-bitcoin-etf-total-net-flow']) {
  const r = await get(`https://www.theblock.co/api/charts/chart/${slug}`, { Referer: 'https://www.theblock.co/data/etfs/bitcoin-etf' })
  let extra = peek(r.body)
  try { const j = JSON.parse(r.body); const s = j?.chart?.jsonFile?.Series ?? j?.Series ?? j?.data; extra = 'keys=' + Object.keys(j).join(',') + ' series=' + (s ? JSON.stringify(s).slice(0, 300) : '-') } catch { /* html */ }
  show('TheBlock ' + slug.split('/').pop(), r, extra)
}
const sm = await get('https://www.simplemining.io/bitcoin-etf-flows')
show('simplemining', sm, 'dates=' + ([...sm.body.matchAll(/2026-09-\d\d|Sep \d{1,2}, 2026/g)].slice(0, 5).map(m => m[0]).join('|')) + ' hasJSON=' + /__NEXT_DATA__|__NUXT__/.test(sm.body))
const cd = await get('https://cryptodataapi.com/etf-flows')
show('cryptodataapi', cd, peek(cd.body.replace(/<[^>]+>/g, ' '), 300))
for (const u of [
  'https://raw.githubusercontent.com/kodokzx/btc-etf/main/README.md',
  'https://api.github.com/repos/kodokzx/btc-etf/contents/',
  'https://api.github.com/repos/BuildWithData/BTC-ETF-Tracker/contents/',
  'https://api.github.com/repos/kodokzx/btc-etf/commits?per_page=3',
]) { const r = await get(u, { Accept: 'application/vnd.github+json' }); show('GitHub ' + u.split('/').slice(-2).join('/'), r, peek(r.body, 600)) }
