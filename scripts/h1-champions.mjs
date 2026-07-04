// 🏆 2026 상반기 수익률 챔피언십 러너 — 4시장(S&P500·나스닥100·코스피·코스닥) 종목 H1 수익률 스캔 → Supabase 적재.
// H1(1~6월)은 확정된 과거라 1회 스캔이면 충분(주가 불변). 로컬 실행(수천 종목 스캔은 Vercel 타임아웃).
// 실행: node scripts/h1-champions.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) { if (l.includes('=') && !l.startsWith('#')) { const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim() } }
const SUPA = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''), SVC = env.SUPABASE_SERVICE_ROLE_KEY

const P1 = Math.floor(new Date('2025-12-29').getTime() / 1000), P2 = Math.floor(new Date('2026-07-01').getTime() / 1000)
const UA = { 'User-Agent': 'Mozilla/5.0' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null) } })); return out }

// 나스닥100 (정적 참조 — 지수 구성종목은 안정적)
const NASDAQ100 = 'AAPL MSFT NVDA AMZN AVGO META TSLA GOOGL GOOG COST NFLX TMUS CSCO PEP LIN ADBE AMD INTU TXN QCOM AMGN ISRG BKNG HON AMAT CMCSA ADP GILD VRTX ADI MU PANW REGN KLAC SBUX MELI LRCX SNPS CDNS CRWD MRVL MAR CEG CTAS PYPL ORLY ASML NXPI ABNB PCAR ROP MNST WDAY FTNT AEP CPRT KDP PAYX ODP ROST DASH KHC CHTR FAST EA VRSK EXC XEL CTSH DDOG IDXX GEHC TTWO CSGP ANSS ON DXCM BIIB CDW ZS MDB TEAM ARM WBD GFS ILMN MRNA SIRI LULU'.split(' ')

async function usReturn(t) {
  const yt = t.replace('.', '-')
  for (const h of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${h}.finance.yahoo.com/v8/finance/chart/${yt}?period1=${P1}&period2=${P2}&interval=1d`, { headers: UA })
      if (!r.ok) continue
      const res = (await r.json())?.chart?.result?.[0]; if (!res) continue
      const ts = res.timestamp || [], cl = res.indicators.quote[0].close || []
      const rows = ts.map((x, i) => ({ d: new Date(x * 1000).toISOString().slice(0, 10), c: cl[i] })).filter(x => x.c != null)
      if (rows.length < 30) return null
      const name = res.meta?.longName || res.meta?.shortName || t
      return { ticker: t, name, ret: (rows[rows.length - 1].c / rows[0].c - 1) * 100, series: rows }
    } catch { /* next */ }
  }
  return null
}
async function krList(mkt, pages) {
  const out = []
  for (let p = 1; p <= pages; p++) {
    try { const r = await fetch(`https://m.stock.naver.com/api/stocks/marketValue/${mkt}?page=${p}&pageSize=100`, { headers: { ...UA, Referer: 'https://m.stock.naver.com/' } }); const j = await r.json(); for (const s of (j?.stocks || [])) if (/^\d{6}$/.test(s.itemCode)) out.push({ code: s.itemCode, name: s.stockName }) } catch { /* skip */ }
    await sleep(150)
  }
  return out
}
async function krReturn(s) {
  try {
    const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${s.code}&timeframe=day&count=200&requestType=0`, { headers: UA })
    const xml = await r.text()
    const rows = [...xml.matchAll(/data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|(\d+)/g)].map(m => ({ d: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`, c: +m[2] }))
    const h1 = rows.filter(x => x.d >= '2026-01-01' && x.d <= '2026-06-30')
    if (h1.length < 30) return null
    return { ticker: s.code, name: s.name, ret: (h1[h1.length - 1].c / h1[0].c - 1) * 100, series: h1 }
  } catch { return null }
}
async function indexSeries(sym, kr) {
  if (kr) { const s = await krReturn({ code: sym, name: '' }); return s ? s.series.map(x => ({ d: x.d, c: x.c })) : [] }
  const s = await usReturn(sym); return s ? s.series.map(x => ({ d: x.d, c: x.c })) : []
}

async function main() {
  // S&P500 티커(위키)
  const spHtml = await (await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', { headers: UA })).text()
  const sp = [...new Set([...spHtml.matchAll(/nasdaq\.com\/market-activity\/stocks\/([a-z.]+)"|nyse\.com\/quote\/[A-Z]+:([A-Z.]+)"/g)].map(m => (m[1] || m[2]).toUpperCase()))]
  console.log('S&P500', sp.length, '· 나스닥100', NASDAQ100.length)
  const [kospi, kosdaq] = await Promise.all([krList('KOSPI', 3), krList('KOSDAQ', 3)])
  console.log('코스피', kospi.length, '· 코스닥', kosdaq.length)

  const top = async (arr, fn) => { const res = (await pool(arr, 8, fn)).filter(Boolean).filter(x => isFinite(x.ret)); res.sort((a, b) => b.ret - a.ret); return res.slice(0, 10).map(x => ({ ...x, ret: Math.round(x.ret * 10) / 10, series: x.series.filter((_, i) => i % 2 === 0 || i === x.series.length - 1).map(p => ({ d: p.d.slice(5), c: p.c })) })) }
  console.log('스캔 중…(수 분 소요)')
  const sp500 = await top(sp, usReturn); console.log('S&P500 완료 1위', sp500[0]?.ticker, sp500[0]?.ret + '%')
  const nasdaq = await top(NASDAQ100, usReturn); console.log('나스닥 완료 1위', nasdaq[0]?.ticker, nasdaq[0]?.ret + '%')
  const kospiT = await top(kospi, krReturn); console.log('코스피 완료 1위', kospiT[0]?.name, kospiT[0]?.ret + '%')
  const kosdaqT = await top(kosdaq, krReturn); console.log('코스닥 완료 1위', kosdaqT[0]?.name, kosdaqT[0]?.ret + '%')

  // 지수 4종(비교차트용)
  const norm = s => { if (!s.length) return []; const b = s[0].c; return s.filter((_, i) => i % 2 === 0 || i === s.length - 1).map(p => ({ d: p.d.slice(5), v: Math.round(p.c / b * 1000) / 10 })) }
  const [ixSP, ixNQ, ixKS, ixKQ] = await Promise.all([indexSeries('^GSPC'), indexSeries('^IXIC'), indexSeries('KOSPI', true), indexSeries('KOSDAQ', true)])
  const idxRet = s => s.length ? Math.round((s[s.length - 1].v / s[0].v - 1) * 1000) / 10 : null
  const indices = { sp500: norm(ixSP), nasdaq: norm(ixNQ), kospi: norm(ixKS), kosdaq: norm(ixKQ) }
  const indexReturns = { sp500: idxRet(indices.sp500), nasdaq: idxRet(indices.nasdaq), kospi: idxRet(indices.kospi), kosdaq: idxRet(indices.kosdaq) }

  const payload = { period: '2026 상반기 (1월~6월)', markets: { sp500, nasdaq, kospi: kospiT, kosdaq: kosdaqT }, indices, indexReturns, asOf: new Date().toISOString() }
  const res = await fetch(`${SUPA}/rest/v1/app_cache?on_conflict=key`, { method: 'POST', headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'h1-champions-2026', payload, updated_at: new Date().toISOString() }]) })
  console.log(res.ok ? '✅ Supabase 적재 완료' : `적재 실패 ${res.status} ${await res.text()}`)
}
main()
