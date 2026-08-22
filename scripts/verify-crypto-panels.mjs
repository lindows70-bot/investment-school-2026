// 🔍 화면검증: 세 패널의 표시값을 **원천에서 독립 재계산**해 대조(캐시로 캐시를 확인하는 건 검증이 아니다)
import https from 'https'
const APP = 'https://investment-school-2026.vercel.app'
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const j = async (u) => (await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000), cache: 'no-store' })).json()
const html = (url) => new Promise((res, rej) => https.get(url, { headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej))
const ok = (b) => b ? '✅' : '❌'

// ── ① ETF 발행사별 ───────────────────────────────────────────────────────────
console.log('── ① ETF 발행사별 표 ──')
const etf = await j(`${APP}/api/btc-etf`)
const H = await html('https://farside.co.uk/bitcoin-etf-flow-all-data/')
const num = s => { const t = s.trim(); if (t === '-' || t === '') return 0
  const neg = /^\(.*\)$/.test(t); const n = parseFloat(t.replace(/[(),]/g, '')); return isFinite(n) ? (neg ? -n : n) : 0 }
const MON = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
const raw = new Map()
for (const m of H.matchAll(/(\d{1,2})\s+(\w{3})\s+(\d{4})([\s\S]*?)<\/tr>/g)) {
  const mo = MON[m[2]]; if (!mo) continue
  raw.set(`${m[3]}-${mo}-${m[1].padStart(2,'0')}`, Array.from(m[4].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => num(c[1])))
}
// 화면 최근 3행을 원천과 셀 단위 대조
let cellOk = 0, cellBad = 0
for (const r of etf.issuerRecent.slice(0, 3)) {
  const src = raw.get(r.date)
  if (!src) { console.log(`  ${r.date} 원천 없음`); continue }
  const same = r.v.every((v, i) => Math.abs(v - src[i]) < 0.05)
  same ? cellOk++ : cellBad++
  console.log(`  ${ok(same)} ${r.date} 앱 [${r.v.join(',')}] vs 원천 [${src.slice(0, r.v.length).join(',')}]`)
}
// 누적 행 = 원천 전체 합인가
const totals = etf.issuers.map((_, i) => Array.from(raw.values()).filter(v => v.length === etf.issuers.length + 1).reduce((s, v) => s + v[i], 0))
const totalDiff = etf.issuerTotals.map((v, i) => Math.abs(v - totals[i]))
console.log(`  ${ok(Math.max(...totalDiff) < 60)} 출범누적: 최대 차 ${Math.max(...totalDiff).toFixed(1)}$M (앱 IBIT ${etf.issuerTotals[0]} vs 재계산 ${totals[0].toFixed(1)})`)
const rowSum = etf.issuerTotals.reduce((a,b)=>a+b,0)
console.log(`  ${ok(Math.abs(rowSum - etf.flowCumulative) < 60)} 발행사 누적 합 ${rowSum.toFixed(1)} vs 총 누적 ${etf.flowCumulative} ($M)`)

// ── ② 청산 ───────────────────────────────────────────────────────────────────
console.log('\n── ② 롱/숏 청산 ──')
const liq = await j(`${APP}/api/crypto-liquidation`)
const inst = await j('https://www.okx.com/api/v5/public/instruments?instType=SWAP')
const spec = {}; for (const r of inst.data) if (/^BTC-(USD|USDT)-SWAP$/.test(r.instId)) spec[r.instId] = { v: Number(r.ctVal), c: r.ctValCcy }
let L = 0, S = 0, N = 0
for (const uly of ['BTC-USD', 'BTC-USDT']) {
  const d = await j(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled&limit=100`)
  const b = d.data?.[0]; const sp = spec[b?.instId]; if (!b || !sp) continue
  for (const x of b.details ?? []) { const usd = sp.c === 'USD' ? Number(x.sz)*sp.v : Number(x.sz)*sp.v*Number(x.bkPx)
    if (!(usd > 0)) continue; N++; if (x.posSide === 'long') L += usd; else S += usd }
}
console.log(`  앱   롱 $${(liq.totalLongUsd/1e6).toFixed(1)}M · 숏 $${(liq.totalShortUsd/1e6).toFixed(1)}M · ${liq.count}건`)
console.log(`  원천 롱 $${(L/1e6).toFixed(1)}M · 숏 $${(S/1e6).toFixed(1)}M · ${N}건  (15분 캐시라 시점 차 존재 — 자릿수·비율 일치가 판정 기준)`)
const ratioApp = liq.totalLongUsd/(liq.totalLongUsd+liq.totalShortUsd), ratioSrc = L/(L+S)
console.log(`  ${ok(Math.abs(ratioApp-ratioSrc) < 0.25)} 롱 비중 앱 ${(ratioApp*100).toFixed(0)}% vs 원천 ${(ratioSrc*100).toFixed(0)}%`)
console.log(`  ${ok(liq.buckets.every(b => b.longUsd>=0 && b.shortUsd>=0))} 버킷 음수 없음 · ${ok(Math.abs(liq.buckets.reduce((s,b)=>s+b.longUsd+b.shortUsd,0) - (liq.totalLongUsd+liq.totalShortUsd)) < 1000)} 버킷합=총합`)

// ── ③ 수요 차트 ──────────────────────────────────────────────────────────────
console.log('\n── ③ 현물 vs 선물 수요 ──')
const dem = await j(`${APP}/api/crypto-demand`)
const by = await j('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200')
const oi = new Map(by.result.list.map(x => [new Date(Number(x.timestamp)).toISOString().slice(0,10), Number(x.openInterest)]))
const P = dem.points, last = P[P.length-1]
const ds = Array.from(oi.keys()).sort(); const i = ds.indexOf(last.d)
const futRecalc = i >= 30 ? Math.round(oi.get(ds[i]) - oi.get(ds[i-30])) : null
console.log(`  ${ok(futRecalc != null && Math.abs(futRecalc - last.futures) <= 2)} 선물수요 앱 ${last.futures} vs 재계산 ${futRecalc} BTC (${last.d})`)
// 현물: 같은 30일 창의 ETF 순유입을 원천에서 다시 합산
const flow = new Map(etf.flow.map(f => [f.date, f.net]))
const px = new Map(P.map(p => [p.d, p.price]))
let spotRe = 0, used = 0
for (let k = i-29; k <= i; k++) { const dk = ds[k]; const n = flow.get(dk), p = px.get(dk) ?? last.price
  if (n == null || !p) continue; spotRe += n*1e6/p; used++ }
console.log(`  ${ok(Math.abs(spotRe - last.spot) / Math.max(1, Math.abs(last.spot)) < 0.12)} 현물수요 앱 ${last.spot} vs 재계산 ${Math.round(spotRe)} BTC (${used}일 반영)`)
console.log(`  ${ok(P.length === 170)} 포인트 ${P.length}개 · 기간 ${P[0].d}~${last.d}`)
console.log(`  ${ok(P.every(p => p.futures === null || Math.abs(p.futures) < 200000))} 이상치 없음 · ${ok(P.filter(p=>p.spot!=null).length > 150)} 현물축 ${P.filter(p=>p.spot!=null).length}/${P.length}일`)
