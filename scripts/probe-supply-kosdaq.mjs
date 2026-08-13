// 💰 수급 4차: 코스닥 중소형(세력주 모집단) — 대형주 기각 결론이 중소형에도 성립하는지 (2026-08-14 사용자 요청)
//   모집단: 네이버 코스닥 시총 랭킹 51~250위(상위 50 대형 제외 · 우리 유니버스와 겹치면 제외)
//   신호: 1~3차의 핵심 가설 전부(단기 쌍끌이·중장기·꾸준함·단독·조용한 매집·분산+고점권) + 대조군
//   ⚠️ 생존 편향 명시: 오늘의 랭킹은 '살아남은 종목'이다 — 상장폐지된 세력주 참사는 표본에 없다(급락 꼬리가 과소평가됨).
//   ⚠️ '세력'이 외인·기관이 아니라 개인·기타법인으로 잡히는 종목은 이 3주체 데이터로는 안 보인다.
//   캐시 재사용(.bt-supply-cache) — 중단돼도 재실행하면 이어서 된다(멱등).
//   실행: node scripts/probe-supply-kosdaq.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const CACHE = `${ROOT}/.bt-supply-cache`
mkdirSync(CACHE, { recursive: true })

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const num = s => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
const pct = (k, n) => n ? Math.round((k / n) * 100) : 0

// ── 코스닥 시총 랭킹 51~250위 수집(페이지 2~5, 50종/페이지) ──
const uniSrc = readFileSync(`${ROOT}/src/lib/macroPhaseScreener.ts`, 'utf8')
const uniSeg = uniSrc.slice(uniSrc.indexOf('KR_UNIVERSE'), uniSrc.indexOf('KR_UNIVERSE') + 20000)
const inUniverse = new Set([...uniSeg.matchAll(/ticker:'(\d{6})'/g)].map(m => m[1]))
const codes = []
for (let page = 2; page <= 5; page++) {
  const r = await fetch(`https://finance.naver.com/sise/sise_market_sum.naver?sosok=1&page=${page}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
  const html = await r.text()
  for (const m of html.matchAll(/code=(\d{6})/g)) if (!codes.includes(m[1]) && !inUniverse.has(m[1])) codes.push(m[1])
  await new Promise(res => setTimeout(res, 200))
}
console.error(`코스닥 중소형 후보 ${codes.length}종 (유니버스 중복 제외)`)

async function trend(code, pages = 13) {
  const fp = `${CACHE}/${code}.json`
  if (existsSync(fp)) { try { return JSON.parse(readFileSync(fp, 'utf8')) } catch { /* refetch */ } }
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
  const rows = out.filter(x => (seen.has(x.bizdate) ? false : (seen.add(x.bizdate), true))).reverse()
    .map(x => ({ d: x.bizdate, c: num(x.closePrice), f: num(x.foreignerPureBuyQuant), o: num(x.organPureBuyQuant), i: num(x.individualPureBuyQuant) }))
  writeFileSync(fp, JSON.stringify(rows))
  await new Promise(res => setTimeout(res, 100))
  return rows
}

const prefix = a => { const p = [0]; for (let i = 0; i < a.length; i++) p.push(p[i] + a[i]); return p }
const sumN = (p, i, n) => p[i + 1] - p[i + 1 - n]

const SIGS = {
  '단기: 5일 쌍끌이': (S, i) => sumN(S.pf, i, 5) > 0 && sumN(S.po, i, 5) > 0,
  '중장기: 60일 쌍끌이': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) > 0,
  '꾸준함: 60일 중 60%+ 메이저 순매수일': (S, i) => S.mDays60[i] >= 36,
  '외인 단독 매집(60일)': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) <= 0,
  '기관 단독 매집(60일)': (S, i) => sumN(S.po, i, 60) > 0 && sumN(S.pf, i, 60) <= 0,
  '조용한 매집(60일 쌍끌이+가격≤0)': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) > 0 && S.c[i] <= S.c[i - 60],
  '분산+고점권(스마트머니 매도+개미 매수+가격+10%↑)': (S, i) => sumN(S.pf, i, 60) + sumN(S.po, i, 60) < 0 && sumN(S.pi, i, 60) > 0 && S.c[i] > S.c[i - 60] * 1.10,
  '대조군: 60일 쌍매도': (S, i) => sumN(S.pf, i, 60) < 0 && sumN(S.po, i, 60) < 0,
}
const HOR = [10, 20, 60]

const entry = {}; const syms = {}
for (const k of Object.keys(SIGS)) { entry[k] = []; syms[k] = new Map() }
const base = { 10: [], 20: [], 60: [] }
let okStocks = 0

for (const code of codes) {
  const rows = await trend(code)
  if (rows.length < 300) continue
  okStocks++
  const c = rows.map(x => x.c), f = rows.map(x => x.f), o = rows.map(x => x.o), ind = rows.map(x => x.i)
  const S = { c, pf: prefix(f), po: prefix(o), pi: prefix(ind), mDays60: new Array(c.length).fill(0) }
  { let cm = 0
    for (let i = 0; i < c.length; i++) {
      if (f[i] + o[i] > 0) cm++
      if (i >= 60 && f[i - 60] + o[i - 60] > 0) cm--
      S.mDays60[i] = cm
    } }
  const prevOn = {}; for (const k of Object.keys(SIGS)) prevOn[k] = false
  for (let i = 121; i + 60 < c.length; i++) {
    if (!(c[i] > 0) || !(c[i - 60] > 0)) continue
    const rets = {}; for (const h of HOR) rets[h] = (c[i + h] / c[i] - 1) * 100
    for (const h of HOR) base[h].push(rets[h])
    const ym = rows[i].d.slice(0, 6)
    for (const [k, fn] of Object.entries(SIGS)) {
      const on = fn(S, i)
      if (on && !prevOn[k]) { entry[k].push({ rets, ym }); syms[k].set(code, (syms[k].get(code) ?? 0) + 1) }
      prevOn[k] = on
    }
  }
}

const b60 = base[60]
const bTail = { up10: pct(b60.filter(x => x >= 10).length, b60.length), up20: pct(b60.filter(x => x >= 20).length, b60.length), dn10: pct(b60.filter(x => x <= -10).length, b60.length), dn20: pct(b60.filter(x => x <= -20).length, b60.length) }
console.log(`\n수집 ${okStocks}/${codes.length}종(코스닥 중소형·생존 편향 있음) · baseline 절사 10봉 ${r2(avg(trim(base[10])))}% · 20봉 ${r2(avg(trim(base[20])))}% · 60봉 ${r2(avg(trim(b60)))}%`)
console.log(`baseline 60봉 꼬리: +10%↑ ${bTail.up10}% · +20%↑ ${bTail.up20}% · −10%↓ ${bTail.dn10}% · −20%↓ ${bTail.dn20}%\n`)

for (const k of Object.keys(SIGS)) {
  const en = entry[k]
  if (en.length < 30) { console.log(`▸ ${k}: n=${en.length} — 표본 부족`); continue }
  const line = HOR.map(h => {
    const a = en.map(r => r.rets[h])
    const e = avg(trim(a)) - avg(trim(base[h]))
    const w = a.filter(x => x > 0).length / a.length * 100
    return `${h}봉 ${e >= 0 ? '+' : ''}${r2(e)}%p(${Math.round(w)}%)`
  }).join(' · ')
  const a60 = en.map(r => r.rets[60])
  const tail = `+10%↑ ${pct(a60.filter(x => x >= 10).length, a60.length)}%(기준 ${bTail.up10}) · +20%↑ ${pct(a60.filter(x => x >= 20).length, a60.length)}%(${bTail.up20}) · −10%↓ ${pct(a60.filter(x => x <= -10).length, a60.length)}%(${bTail.dn10}) · −20%↓ ${pct(a60.filter(x => x <= -20).length, a60.length)}%(${bTail.dn20})`
  console.log(`▸ ${k} (n=${en.length} · ${syms[k].size}종 · ${new Set(en.map(r => r.ym)).size}개월)`)
  console.log(`   edge: ${line}`)
  console.log(`   60봉 꼬리: ${tail}`)
}
