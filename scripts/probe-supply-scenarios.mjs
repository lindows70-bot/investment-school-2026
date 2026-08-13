// 💰 수급 시나리오 3차 — ①단독 매집(외인만/기관만 꾸준히) ②분산(스마트머니 매도+개미 매수 → 지연 하락) (2026-08-14 사용자 가설)
//   "크게 오른다"는 꼬리 주장 → 평균 edge 와 함께 60봉 +10%/+20% 도달률·−10%/−20% 추락률을 baseline 과 대조.
//   "한동안 버티다 급락"은 지연 주장 → 10/20/60봉을 나눠 시간 구조를 본다.
//   KR 182종 × 4년(probe-supply-longterm 과 동일 모집단) · 진입(전환일) 기준 · 디스크 캐시로 재수집 방지.
//   실행: node scripts/probe-supply-scenarios.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const CACHE = `${ROOT}/.bt-supply-cache`
mkdirSync(CACHE, { recursive: true })

const src = readFileSync(`${ROOT}/src/lib/macroPhaseScreener.ts`, 'utf8')
const seg = src.slice(src.indexOf('KR_UNIVERSE'), src.indexOf('KR_UNIVERSE') + 20000)
const KR = [...seg.matchAll(/ticker:'(\d{6})'/g)].map(m => m[1])

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const num = s => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)
const pct = (k, n) => n ? Math.round((k / n) * 100) : 0

async function trend(code, pages = 18) {
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
  await new Promise(r => setTimeout(r, 120))
  return rows
}

const prefix = a => { const p = [0]; for (let i = 0; i < a.length; i++) p.push(p[i] + a[i]); return p }
const sumN = (p, i, n) => p[i + 1] - p[i + 1 - n]

const SIGS = {
  '외인 단독 매집(60일 외인>0·기관≤0)': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) <= 0,
  '기관 단독 매집(60일 기관>0·외인≤0)': (S, i) => sumN(S.po, i, 60) > 0 && sumN(S.pf, i, 60) <= 0,
  '외인 꾸준 매집(60일 중 60%+ 순매수일)': (S, i) => S.fDays60[i] >= 36,
  '기관 꾸준 매집(60일 중 60%+ 순매수일)': (S, i) => S.oDays60[i] >= 36,
  '분산: 스마트머니 60일 매도 + 개인 매수': (S, i) => sumN(S.pf, i, 60) + sumN(S.po, i, 60) < 0 && sumN(S.pi, i, 60) > 0,
  '분산+고점권(위 + 가격 60일 +10%↑)': (S, i) => sumN(S.pf, i, 60) + sumN(S.po, i, 60) < 0 && sumN(S.pi, i, 60) > 0 && S.c[i] > S.c[i - 60] * 1.10,
  '대조: 유입(스마트머니 매수 + 개인 매도)': (S, i) => sumN(S.pf, i, 60) + sumN(S.po, i, 60) > 0 && sumN(S.pi, i, 60) < 0,
}
const HOR = [10, 20, 60]

const entry = {}; const syms = {}
for (const k of Object.keys(SIGS)) { entry[k] = []; syms[k] = new Map() }
const base = { 10: [], 20: [], 60: [] }
let okStocks = 0

for (const code of KR) {
  const rows = await trend(code)
  if (rows.length < 400) continue
  okStocks++
  const c = rows.map(x => x.c), f = rows.map(x => x.f), o = rows.map(x => x.o), ind = rows.map(x => x.i)
  const S = { c, pf: prefix(f), po: prefix(o), pi: prefix(ind), fDays60: new Array(c.length).fill(0), oDays60: new Array(c.length).fill(0) }
  { let cf = 0, co = 0
    for (let i = 0; i < c.length; i++) {
      if (f[i] > 0) cf++; if (o[i] > 0) co++
      if (i >= 60) { if (f[i - 60] > 0) cf--; if (o[i - 60] > 0) co-- }
      S.fDays60[i] = cf; S.oDays60[i] = co
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
console.log(`\n수집 ${okStocks}/${KR.length}종 · baseline 절사 10봉 ${r2(avg(trim(base[10])))}% · 20봉 ${r2(avg(trim(base[20])))}% · 60봉 ${r2(avg(trim(b60)))}%`)
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
