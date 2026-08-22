// 🔍 Phase 0-C — ①채굴자 매도 압력 대리지표 확보 가능성 ②최근 상승폭 실측(영상의 "급등"이 실제 얼마인가)
const UA = { 'User-Agent': 'Mozilla/5.0' }

console.log('═══ ① 채굴자 지표(blockchain.info) ═══')
for (const [chart, label] of [['hash-rate', '해시레이트'], ['miners-revenue', '채굴자 수익(USD)'], ['difficulty', '난이도']]) {
  try {
    const r = await fetch(`https://api.blockchain.info/charts/${chart}?timespan=1year&format=json&sampled=true`, { headers: UA, signal: AbortSignal.timeout(25000) })
    if (!r.ok) { console.log(`  ${label.padEnd(16)} ❌ HTTP ${r.status}`); continue }
    const v = (await r.json()).values ?? []
    if (!v.length) { console.log(`  ${label.padEnd(16)} ❌ 값 없음`); continue }
    const last = v[v.length - 1], first = v[0]
    const m3 = v[Math.max(0, v.length - Math.round(v.length / 4))]
    console.log(`  ${label.padEnd(16)} ${String(v.length).padStart(4)}p · ${new Date(first.x * 1000).toISOString().slice(0, 10)}~${new Date(last.x * 1000).toISOString().slice(0, 10)} · 1년 ${((last.y / first.y - 1) * 100).toFixed(1)}% · 3개월 ${((last.y / m3.y - 1) * 100).toFixed(1)}%`)
  } catch (e) { console.log(`  ${label.padEnd(16)} ❌ ${e.message}`) }
}

console.log('\n═══ ② 최근 상승폭 실측 — 영상이 말한 "급등"의 크기 ═══')
const px = async (sym, days = 120) => {
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - days * 86400
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${p1}&period2=${p2}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(25000) })
  if (!r.ok) return null
  const q = (await r.json())?.chart?.result?.[0]
  if (!q?.timestamp) return null
  const out = []
  for (let i = 0; i < q.timestamp.length; i++) {
    const c = q.indicators?.quote?.[0]?.close?.[i]
    if (typeof c === 'number' && c > 0) out.push({ d: new Date(q.timestamp[i] * 1000).toISOString().slice(0, 10), c })
  }
  return out
}
for (const [sym, label] of [['BTC-USD', '비트코인'], ['ETH-USD', '이더리움'], ['SOL-USD', '솔라나'], ['COIN', '코인베이스'], ['HOOD', '로빈후드'], ['MSTR', 'Strategy'], ['IBIT', '블랙록 ETF']]) {
  const a = await px(sym)
  if (!a || a.length < 40) { console.log(`  ${label.padEnd(10)} ❌`); continue }
  const last = a[a.length - 1].c
  const back = (n) => a.length > n ? ((last / a[a.length - 1 - n].c - 1) * 100).toFixed(1) : '—'
  const lo90 = Math.min(...a.slice(-90).map(x => x.c)), hi90 = Math.max(...a.slice(-90).map(x => x.c))
  console.log(`  ${label.padEnd(10)} ${last.toFixed(2).padStart(10)} · 3일 ${back(3).padStart(6)}% · 7일 ${back(7).padStart(6)}% · 30일 ${back(30).padStart(6)}% · 90일 ${back(90).padStart(6)}% · 90일 저점 대비 ${((last / lo90 - 1) * 100).toFixed(1)}% · 고점 대비 ${((last / hi90 - 1) * 100).toFixed(1)}%`)
}

console.log('\n═══ ③ 우리 앱이 이미 보는 것 vs 영상이 말한 것 ═══')
for (const [ep, label] of [['crypto-funding', '펀딩비·OI(글로벌 무기한)'], ['crypto-demand', '현물 vs 선물 수요'], ['btc-etf', 'ETF 순유입']]) {
  try {
    const r = await fetch(`https://investment-school-2026.vercel.app/api/${ep}`, { signal: AbortSignal.timeout(60000) })
    const j = r.ok ? await r.json() : null
    console.log(`  ${label.padEnd(24)} ${r.status} · ${j ? Object.keys(j).slice(0, 8).join(',') : '—'}`)
  } catch (e) { console.log(`  ${label.padEnd(24)} ❌ ${e.message}`) }
}
