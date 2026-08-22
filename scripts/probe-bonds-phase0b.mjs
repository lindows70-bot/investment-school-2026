// 🔍 Phase 0-B — ①"경기 좋을 때 인하"(보험성 vs 위기성) 역사 케이스를 데이터로 가를 수 있나
//                ②채권 발작 시 다른 자산과의 상관관계를 실제로 계산할 수 있나
import { readFileSync } from 'node:fs'
let KEY = process.env.FRED_API_KEY
if (!KEY) { try { KEY = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {} }
const OBS = 'https://api.stlouisfed.org/fred/series/observations'
const obs = async (id, start) => {
  const r = await fetch(`${OBS}?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`, { signal: AbortSignal.timeout(25000) })
  if (!r.ok) { console.log(`  ${id} HTTP ${r.status}`); return [] }
  return ((await r.json()).observations ?? []).map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(x => isFinite(x.v))
}

// ── ① 인하 사이클 분류: 인하 시작 시점의 실업률 추세·침체 여부 ────────────────
console.log('═══ ① 금리 인하 사이클 — "경기 좋을 때 인하"를 데이터로 가를 수 있나 ═══')
const [ff, rec, un, sp] = await Promise.all([
  obs('FEDFUNDS', '1954-07-01'), obs('USREC', '1954-07-01'), obs('UNRATE', '1954-07-01'), obs('SP500', '2016-01-01'),
])
const recAt = (d) => rec.find(r => r.d === d)?.v ?? null
const unAt = (d) => un.find(r => r.d === d)?.v ?? null
// 인하 사이클 시작 = 3개월 누적 −0.5%p 이상 하락이 처음 발생한 달(이전 12개월간 인하 사이클 없음)
const cuts = []
for (let i = 12; i < ff.length; i++) {
  const drop = ff[i].v - ff[i - 3].v
  if (drop > -0.5) continue
  if (cuts.length && (new Date(ff[i].d) - new Date(cuts[cuts.length - 1].d)) / 864e5 < 540) continue
  cuts.push(ff[i])
}
console.log(`인하 사이클 후보 ${cuts.length}건 (3개월 −0.5%p 기준·18개월 내 중복 제거)\n`)
console.log('시작월      정책금리  실업률  12M전실업률  Δ실업률  침체중?  ±12개월내 침체시작  → 유형')
for (const c of cuts) {
  const u0 = unAt(c.d), i12 = un.findIndex(x => x.d === c.d)
  const u12 = i12 >= 12 ? un[i12 - 12].v : null
  const du = u0 != null && u12 != null ? u0 - u12 : null
  const inRec = recAt(c.d)
  // 시작 시점 기준 −6 ~ +12개월 사이에 침체가 시작됐는가
  const t0 = new Date(c.d)
  const near = rec.find((r, k) => k > 0 && r.v === 1 && rec[k - 1].v === 0
    && (new Date(r.d) - t0) / 864e5 >= -190 && (new Date(r.d) - t0) / 864e5 <= 400)
  const kind = near || inRec === 1 ? '🔴 위기성(침체 동반)' : '🟢 보험성(경기 양호)'
  console.log(`${c.d}  ${String(c.v).padEnd(8)} ${String(u0 ?? '—').padEnd(6)} ${String(u12 ?? '—').padEnd(11)} ${du != null ? (du >= 0 ? '+' : '') + du.toFixed(1) : '—'}${''.padEnd(5)} ${inRec === 1 ? 'Y' : 'N'}${''.padEnd(7)} ${near?.d ?? '—'}${''.padEnd(8)} ${kind}`)
}

// ── ② 채권 발작 시 상관관계 — 야후 일봉으로 실제 계산 가능한지 ────────────────
console.log('\n═══ ② 채권 vs 타 자산 상관 — 야후 일봉 확보 가능한가 ═══')
const UA = { 'User-Agent': 'Mozilla/5.0' }
const px = async (sym, range = '3y') => {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (!r.ok) return { sym, err: `HTTP ${r.status}` }
  const q = (await r.json())?.chart?.result?.[0]
  if (!q) return { sym, err: 'no result' }
  const out = []
  for (let i = 0; i < q.timestamp.length; i++) {
    const c = q.indicators.quote[0].close[i]
    if (typeof c === 'number' && c > 0) out.push({ d: new Date(q.timestamp[i] * 1000).toISOString().slice(0, 10), c })
  }
  return { sym, out }
}
const SYMS = ['TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'SPY', 'QQQ', 'GLD', 'BTC-USD', 'DX-Y.NYB', '^MOVE', '^VIX', 'EEM', 'XLU', 'XLF']
const got = {}
for (const s of SYMS) {
  const r = await px(s)
  if (r.err) { console.log(`  ${s.padEnd(10)} ❌ ${r.err}`); continue }
  got[s] = r.out
  console.log(`  ${s.padEnd(10)} ✅ ${r.out.length}일 (${r.out[0].d} ~ ${r.out[r.out.length - 1].d}) 최신 ${r.out[r.out.length - 1].c.toFixed(2)}`)
}

// 일별 수익률 상관(공통 날짜 교집합)
const rets = (a) => { const m = new Map(); for (let i = 1; i < a.length; i++) m.set(a[i].d, a[i].c / a[i - 1].c - 1); return m }
const corr = (A, B) => {
  const ks = [...A.keys()].filter(k => B.has(k))
  if (ks.length < 60) return null
  const x = ks.map(k => A.get(k)), y = ks.map(k => B.get(k))
  const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b }
  return dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null
}
if (got['TLT']) {
  const T = rets(got['TLT'])
  console.log('\n  TLT(미 장기국채) 일별수익률 상관 — 3년')
  for (const s of SYMS.filter(s => s !== 'TLT' && got[s])) console.log(`    TLT ↔ ${s.padEnd(10)} ${corr(T, rets(got[s])) ?? '표본부족'}`)
}
if (got['^MOVE']) {
  const m = got['^MOVE']; const v = m.map(x => x.c)
  console.log(`\n  ^MOVE(채권 변동성) 최신 ${v[v.length - 1]} · 3년 최소 ${Math.min(...v).toFixed(1)} 최대 ${Math.max(...v).toFixed(1)} · 평균 ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`)
}
