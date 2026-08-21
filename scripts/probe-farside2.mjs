// Phase 0 재시도: 라우트와 동일한 https.get + 브라우저 헤더로 Farside 발행사별 컬럼 확인
import https from 'https'
const get = (url) => new Promise((res, rej) => {
  https.get(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9',
  } }, r => { if ((r.statusCode ?? 0) >= 400) { r.resume(); return rej(new Error(`HTTP ${r.statusCode}`)) }
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)) }).on('error', rej)
})
const html = await get('https://farside.co.uk/bitcoin-etf-flow-all-data/')
console.log(`HTML ${html.length}자`)

const heads = Array.from(html.matchAll(/<th[^>]*>([\s\S]{0,60}?)<\/th>/g)).map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, '').trim()).filter(Boolean)
console.log(`헤더 ${heads.length}개(앞 20): ${heads.slice(0, 20).join(' | ')}`)

const MON = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
const rows = Array.from(html.matchAll(/(\d{1,2})\s+(\w{3})\s+(\d{4})([\s\S]*?)<\/tr>/g))
const num = s => { const t = s.trim(); if (t === '-' || t === '') return 0
  const neg = /^\(.*\)$/.test(t); const n = parseFloat(t.replace(/[(),]/g, '')); return isFinite(n) ? (neg ? -n : n) : 0 }
const parsed = rows.map(m => {
  const mon = MON[m[2]]; if (!mon) return null
  const cells = Array.from(m[4].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => c[1])
  return { date: `${m[3]}-${mon}-${m[1].padStart(2,'0')}`, cells }
}).filter(Boolean)
console.log(`일별 행 ${parsed.length}개`)
const dist = {}; for (const p of parsed) dist[p.cells.length] = (dist[p.cells.length] ?? 0) + 1
console.log('셀 개수 분포:', JSON.stringify(dist))

for (const p of parsed.slice(-3)) {
  const v = p.cells.map(num)
  const total = v[v.length - 1], sumHead = v.slice(0, -1).reduce((a,b)=>a+b,0)
  console.log(`  ${p.date} 셀${v.length} · Total=${total} · 앞합=${sumHead.toFixed(1)} → ${Math.abs(sumHead-total)<0.6?'✅':'❌'}`)
  console.log(`     ${p.cells.join(' | ')}`)
}
