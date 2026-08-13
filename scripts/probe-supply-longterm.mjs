// 💰 중장기 수급 백테스트 — "1~6개월 꾸준한 외인+기관 수급이 중장기 수익을 예측하나"(2026-08-14 사용자 가설)
//   단기(5~10일) 검증에서 무정보 판정이 났으나 사용자 경험은 '중장기 누적 수급'이었다 — 그 정의로 다시 잰다.
//   설계: KR 유니버스 전체(~94종) × 4년 실수급(네이버 trend) · 신호는 상태(state)와 진입(전환일) 둘 다 채점
//        · 전방 10/20/60봉 · 대조군(쌍매도) 필수 · 모멘텀 교란 분리(조용한 매집 = 수급↑ + 가격↓)
//   ⛔ 룩어헤드 금지 · baseline 대비 절사 edge · autopsy 필드 출력
//   실행: node scripts/probe-supply-longterm.mjs
import { readFileSync } from 'fs'

const src = readFileSync('C:/Users/lindo/investment-school-portfolio/src/lib/macroPhaseScreener.ts', 'utf8')
const seg = src.slice(src.indexOf('KR_UNIVERSE'), src.indexOf('KR_UNIVERSE') + 20000)
const KR = [...seg.matchAll(/ticker:'(\d{6})'/g)].map(m => m[1])
console.error(`KR 유니버스 ${KR.length}종`)

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
const num = s => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const r2 = n => n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2)

async function trend(code, pages = 18) {
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
  return out.filter(x => (seen.has(x.bizdate) ? false : (seen.add(x.bizdate), true))).reverse()
}

// 누적합(프리픽스) — sumN(x, i) = 최근 N일 합(당일 포함)
const prefix = a => { const p = [0]; for (let i = 0; i < a.length; i++) p.push(p[i] + a[i]); return p }
const sumN = (p, i, n) => p[i + 1] - p[i + 1 - n]

const SIGS = {
  '1개월(20일) 누적 쌍끌이': (S, i) => sumN(S.pf, i, 20) > 0 && sumN(S.po, i, 20) > 0,
  '3개월(60일) 누적 쌍끌이': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) > 0,
  '6개월(120일) 누적 쌍끌이': (S, i) => sumN(S.pf, i, 120) > 0 && sumN(S.po, i, 120) > 0,
  '꾸준함: 60일 중 60%+ 메이저 순매수일': (S, i) => S.posDays60[i] >= 36,
  '조용한 매집: 60일 쌍끌이 + 가격 60일 ≤0%': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) > 0 && S.c[i] <= S.c[i - 60],
  '달린 매집: 60일 쌍끌이 + 가격 60일 >+10%': (S, i) => sumN(S.pf, i, 60) > 0 && sumN(S.po, i, 60) > 0 && S.c[i] > S.c[i - 60] * 1.10,
  '대조군: 3개월 쌍매도': (S, i) => sumN(S.pf, i, 60) < 0 && sumN(S.po, i, 60) < 0,
  '대조군: 6개월 쌍매도': (S, i) => sumN(S.pf, i, 120) < 0 && sumN(S.po, i, 120) < 0,
}
const HOR = [10, 20, 60]

const state = {}; const entry = {}; const syms = {}
for (const k of Object.keys(SIGS)) { state[k] = []; entry[k] = []; syms[k] = new Map() }
const base = { 10: [], 20: [], 60: [] }
let okStocks = 0, totalRows = 0

for (const code of KR) {
  const rows = await trend(code)
  if (rows.length < 400) { console.error(`skip ${code}: ${rows.length}행`); continue }
  okStocks++; totalRows += rows.length
  const c = rows.map(r => num(r.closePrice))
  const f = rows.map(r => num(r.foreignerPureBuyQuant))
  const o = rows.map(r => num(r.organPureBuyQuant))
  const pf = prefix(f), po = prefix(o)
  // 꾸준함: 최근 60일 중 (외인+기관 합산 > 0)인 날 수
  const posDays60 = new Array(c.length).fill(0)
  { let cnt = 0
    for (let i = 0; i < c.length; i++) {
      if (f[i] + o[i] > 0) cnt++
      if (i >= 60 && f[i - 60] + o[i - 60] > 0) cnt--
      posDays60[i] = cnt
    } }
  const S = { c, pf, po, posDays60 }

  const prevOn = {}
  for (const k of Object.keys(SIGS)) prevOn[k] = false
  for (let i = 121; i + 60 < c.length; i++) {
    if (!(c[i] > 0) || !(c[i - 60] > 0)) continue
    const rets = {}; for (const h of HOR) rets[h] = (c[i + h] / c[i] - 1) * 100
    for (const h of HOR) base[h].push(rets[h])
    const ym = rows[i].bizdate.slice(0, 6)
    for (const [k, fn] of Object.entries(SIGS)) {
      const on = fn(S, i)
      if (on) {
        state[k].push({ rets, ym })
        if (!prevOn[k]) { entry[k].push({ rets, ym }); syms[k].set(code, (syms[k].get(code) ?? 0) + 1) }
      }
      prevOn[k] = on
    }
  }
  await new Promise(r => setTimeout(r, 120))
}

console.log(`\n수집 성공 ${okStocks}/${KR.length}종 · 총 ${totalRows.toLocaleString()}행`)
console.log(`baseline 절사: 10봉 ${r2(avg(trim(base[10])))}% · 20봉 ${r2(avg(trim(base[20])))}% · 60봉 ${r2(avg(trim(base[60])))}% (표본 ${base[10].length.toLocaleString()})\n`)

for (const k of Object.keys(SIGS)) {
  const st = state[k], en = entry[k]
  if (st.length < 50) { console.log(`▸ ${k}: 상태 n=${st.length} — 표본 부족`); continue }
  const stLine = HOR.map(h => {
    const a = st.map(r => r.rets[h])
    const e = avg(trim(a)) - avg(trim(base[h]))
    return `${h}봉 ${e >= 0 ? '+' : ''}${r2(e)}%p`
  }).join(' · ')
  const enLine = en.length >= 20 ? HOR.map(h => {
    const a = en.map(r => r.rets[h])
    const e = avg(trim(a)) - avg(trim(base[h]))
    const w = a.filter(x => x > 0).length / a.length * 100
    return `${h}봉 ${e >= 0 ? '+' : ''}${r2(e)}%p(승률 ${Math.round(w)}%)`
  }).join(' · ') : `n=${en.length} 표본 부족`
  console.log(`▸ ${k}`)
  console.log(`   상태(전 봉, n=${st.length}): ${stLine}`)
  console.log(`   진입(전환일, n=${en.length} · ${syms[k].size}종 · ${new Set(en.map(r => r.ym)).size}개월): ${enLine}`)
}
