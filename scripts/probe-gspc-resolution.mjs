// 🔍 야후 장기 이력 해상도 확인 — range=max 는 조용히 다운샘플된다(코인랩에서 이미 당한 함정).
//   ⚠️ 요청한 간격이 아니라 **반환 개수**로 검증한다.
const UA = { 'User-Agent': 'Mozilla/5.0' }
const now = Math.floor(Date.now() / 1000)
const px = async (s, opt) => {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${s}?${opt}&interval=1mo`
  const q = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) })
  if (!q.ok) return { err: q.status }
  const j = (await q.json())?.chart?.result?.[0]
  const o = []
  for (let k = 0; k < j.timestamp.length; k++) {
    const c = j.indicators.quote[0].close[k]
    if (typeof c === 'number' && c > 0) o.push({ d: new Date(j.timestamp[k] * 1000).toISOString().slice(0, 10), c })
  }
  return { o }
}
const p1 = Math.floor(new Date('1960-01-01').getTime() / 1000)
for (const [label, opt] of [['range=max', 'range=max'], [`period1=1960`, `period1=${p1}&period2=${now}`]]) {
  for (const s of ['^GSPC', '^DJI']) {
    const r = await px(s, opt)
    if (r.err) { console.log(`${label.padEnd(14)} ${s.padEnd(7)} HTTP ${r.err}`); continue }
    const months = (new Date(r.o[r.o.length - 1].d) - new Date(r.o[0].d)) / 864e5 / 30.44
    console.log(`${label.padEnd(14)} ${s.padEnd(7)} ${String(r.o.length).padEnd(5)}건 ${r.o[0].d}~${r.o[r.o.length - 1].d} · 기대 ${Math.round(months)}개월 → ${r.o.length > months * 0.9 ? '✅ 월별 정상' : '❌ 다운샘플'}`)
  }
}
