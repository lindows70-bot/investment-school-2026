// 💰 수급 백테스트 — "외인+기관이 몰리면 단기(5~10일)에 오르는가"를 KR 실수급 이력으로 실측
//   데이터: 네이버 m.stock trend API(fetchKrTrend와 동일 엔드포인트) — 일별 외인/기관/개인 순매수 수량 + 종가
//   ⛔ 룩어헤드 금지(신호일까지의 데이터만) · baseline 대비 절사 edge · 레짐 분리 · autopsy 필드 출력
//   실행: node scripts/probe-supply-flow.mjs
const KR = ['005930','000660','005380','051910','006400','035420','035720','068270','105560','055550',
  '012330','028260','066570','003550','015760','017670','034730','032830','018260','010950',
  '009150','011200','086790','316140','024110','030200','000270','086280','010130','004020',
  '096770','267250','042660','010140','272210','064350','241560','003490','047050','000810']

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const num = s => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
const sma = (a, n, i) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n }

async function trend(code, pages = 9) {
  const out = []
  let cursor = ''
  for (let p = 0; p < pages; p++) {
    try {
      const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/trend?pageSize=60${cursor ? `&bizdate=${cursor}` : ''}`,
        { headers: { 'User-Agent': UA, Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(12_000) })
      if (!r.ok) break
      const j = await r.json()
      if (!Array.isArray(j) || !j.length) break
      out.push(...j)
      if (j.length < 60) break
      cursor = j[j.length - 1].bizdate
    } catch { break }
  }
  const seen = new Set()
  return out.filter(x => (seen.has(x.bizdate) ? false : (seen.add(x.bizdate), true)))
    .reverse()   // 과거→현재 순으로
}

const SIGS = {
  '당일 쌍끌이(외인+기관 동반 순매수)': (f, o, i) => f[i] > 0 && o[i] > 0,
  '5일 누적 쌍끌이(둘 다 5일 합 > 0)': (f, o, i) => {
    let fs = 0, os = 0; for (let k = i - 4; k <= i; k++) { fs += f[k]; os += o[k] }
    return fs > 0 && os > 0
  },
  '쌍끌이 3일 연속': (f, o, i) => [0, 1, 2].every(d => f[i - d] > 0 && o[i - d] > 0),
  '외인 단독 5일 순매수(기관 무관)': (f, o, i) => { let s = 0; for (let k = i - 4; k <= i; k++) s += f[k]; return s > 0 },
  '반대: 쌍매도(둘 다 5일 합 < 0)': (f, o, i) => {
    let fs = 0, os = 0; for (let k = i - 4; k <= i; k++) { fs += f[k]; os += o[k] }
    return fs < 0 && os < 0
  },
}

const HOR = [5, 10]
const hits = {}; const syms = {}
for (const k of Object.keys(SIGS)) { hits[k] = { all: [], down: [], up: [] }; syms[k] = new Map() }
const base = { all: { 5: [], 10: [] }, down: { 5: [], 10: [] }, up: { 5: [], 10: [] } }
let okStocks = 0

for (const code of KR) {
  const rows = await trend(code)
  if (rows.length < 200) { console.error(`skip ${code}: ${rows.length}행`); continue }
  okStocks++
  const c = rows.map(r => num(r.closePrice))
  const f = rows.map(r => num(r.foreignerPureBuyQuant))
  const o = rows.map(r => num(r.organPureBuyQuant))
  for (let i = 55; i + 10 < c.length; i++) {
    if (!(c[i] > 0)) continue
    const ma50 = sma(c, 50, i), ma50p = sma(c, 50, i - 20)
    const regime = ma50 == null || ma50p == null ? 'flat' : ma50 > ma50p * 1.01 ? 'up' : ma50 < ma50p * 0.99 ? 'down' : 'flat'
    const rets = {}; for (const h of HOR) rets[h] = (c[i + h] / c[i] - 1) * 100
    for (const h of HOR) { base.all[h].push(rets[h]); if (regime === 'down') base.down[h].push(rets[h]); if (regime === 'up') base.up[h].push(rets[h]) }
    for (const [name, fn] of Object.entries(SIGS)) {
      if (!fn(f, o, i)) continue
      hits[name].all.push({ rets, ym: rows[i].bizdate.slice(0, 6) })
      if (regime === 'down') hits[name].down.push({ rets })
      if (regime === 'up') hits[name].up.push({ rets })
      syms[name].set(code, (syms[name].get(code) ?? 0) + 1)
    }
  }
  await new Promise(r => setTimeout(r, 150))
}

console.log(`\n수집 성공 ${okStocks}/40종`)
for (const scope of ['all', 'down', 'up']) {
  console.log(`\n══ ${scope === 'all' ? '전체' : scope === 'down' ? '하락장' : '상승장'} — baseline 10봉 절사 ${r2(avg(trim(base[scope][10])))}% (표본 ${base[scope][10].length.toLocaleString()}) ══`)
  for (const name of Object.keys(SIGS)) {
    const rows = hits[name][scope]
    if (rows.length < 30) { console.log(`  ${name}: n=${rows.length} — 표본 부족`); continue }
    const line = HOR.map(h => {
      const a = rows.map(r => r.rets[h])
      const e = avg(trim(a)) - avg(trim(base[scope][h]))
      const w = a.filter(x => x > 0).length / a.length * 100
      return `${h}봉 절사edge ${e >= 0 ? '+' : ''}${r2(e)}%p·승률 ${r2(w)}%`
    }).join(' | ')
    const extra = scope === 'all' ? ` · ${syms[name].size}종·최다 ${Math.round(Math.max(0, ...syms[name].values()) / rows.length * 100)}%·${new Set(hits[name].all.map(r => r.ym)).size}개월` : ''
    console.log(`  ${name}: n=${rows.length}${extra}`)
    console.log(`      ${line}`)
  }
}
