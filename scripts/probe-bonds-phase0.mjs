// 🔍 Phase 0 — 채권편 보강에 필요한 FRED 계열이 실제로 존재하고 쓸 만한지 실측.
//   ⛔ 코드 짜기 전에 확인: 계열 존재 · 시작일 · 주기(일/월) · 최신일 · 스케일 · 결측 패턴
//   확인 대상: ①만기 곡선 전 구간 ②공식 스프레드(10Y-2Y·10Y-3M) ③침체 판정(NBER) ④정책금리 ⑤일본(YCC) ⑥채권 변동성
import { readFileSync } from 'node:fs'

// .env.local 에서 키만 읽는다(값은 절대 출력하지 않는다)
let KEY = process.env.FRED_API_KEY
if (!KEY) {
  try {
    const env = readFileSync('.env.local', 'utf8')
    KEY = (env.match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim()
  } catch { /* noop */ }
}
if (!KEY) { console.error('❌ FRED_API_KEY 없음 — .env.local 확인'); process.exit(1) }
console.log(`FRED 키 로드됨(길이 ${KEY.length})\n`)

const OBS = 'https://api.stlouisfed.org/fred/series/observations'
const META = 'https://api.stlouisfed.org/fred/series'

const SERIES = {
  '① 만기 곡선(term structure)': ['DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30'],
  '② 공식 스프레드': ['T10Y2Y', 'T10Y3M', 'T5YIFR'],
  '③ 침체·경기': ['USREC', 'UNRATE', 'GDPC1', 'INDPRO', 'SAHMREALTIME'],
  '④ 정책금리': ['FEDFUNDS', 'DFF'],
  '⑤ 일본(YCC 사례)': ['IRLTLT01JPM156N', 'INTDSRJPM193N'],
  '⑥ 크레딧·기타': ['BAMLH0A0HYM2', 'BAMLC0A0CM', 'VIXCLS'],
}

const meta = async (id) => {
  const r = await fetch(`${META}?series_id=${id}&api_key=${KEY}&file_type=json`, { signal: AbortSignal.timeout(15000) })
  if (!r.ok) return { err: `HTTP ${r.status}` }
  const s = (await r.json()).seriess?.[0]
  return s ? { title: s.title, freq: s.frequency_short, units: s.units_short, start: s.observation_start, end: s.observation_end, updated: s.last_updated?.slice(0, 10) } : { err: 'no series' }
}
const obs = async (id, start) => {
  const r = await fetch(`${OBS}?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) return []
  return ((await r.json()).observations ?? []).map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(x => isFinite(x.v))
}

for (const [group, ids] of Object.entries(SERIES)) {
  console.log(`═══ ${group} ═══`)
  for (const id of ids) {
    const m = await meta(id)
    if (m.err) { console.log(`  ${id.padEnd(16)} ❌ ${m.err}`); continue }
    const recent = await obs(id, '2026-06-01')
    const last = recent[recent.length - 1]
    console.log(`  ${id.padEnd(16)} ${String(m.freq).padEnd(3)} ${String(m.units).padEnd(9)} ${m.start}~${m.end} · 최신 ${last ? `${last.d} = ${last.v}` : '(최근 관측 없음)'} · ${m.title.slice(0, 52)}`)
  }
  console.log()
}

// ── 실측 ①: 오늘의 만기 곡선을 실제로 만들어본다(결측 패턴 확인) ──────────────
console.log('═══ 실측 A — 오늘 기준 만기 곡선이 한 날짜에 다 모이는가 ═══')
const TENORS = [['DGS1MO', 1 / 12], ['DGS3MO', 0.25], ['DGS6MO', 0.5], ['DGS1', 1], ['DGS2', 2], ['DGS3', 3], ['DGS5', 5], ['DGS7', 7], ['DGS10', 10], ['DGS20', 20], ['DGS30', 30]]
const byT = {}
for (const [id] of TENORS) byT[id] = await obs(id, '2026-07-01')
const dates = {}
for (const [id] of TENORS) for (const o of byT[id]) (dates[o.d] ??= []).push(id)
const full = Object.entries(dates).filter(([, v]) => v.length === TENORS.length).map(([d]) => d).sort()
console.log(`  11개 만기가 모두 있는 날: ${full.length}일 · 최신 ${full[full.length - 1] ?? '없음'}`)
const latest = full[full.length - 1]
if (latest) {
  const curve = TENORS.map(([id, y]) => ({ y, v: byT[id].find(o => o.d === latest)?.v }))
  console.log(`  ${latest} 곡선: ${curve.map(c => `${c.y < 1 ? c.y * 12 + 'M' : c.y + 'Y'}=${c.v}`).join(' ')}`)
  const g = (a, b) => (curve.find(c => c.y === a).v - curve.find(c => c.y === b).v).toFixed(2)
  console.log(`  10Y−2Y = ${g(10, 2)}%p · 10Y−3M = ${g(10, 0.25)}%p · 30Y−5Y = ${g(30, 5)}%p`)
}

// ── 실측 ②: 역전 → 침체 리드타임을 공식 계열로 직접 계산 ─────────────────────
console.log('\n═══ 실측 B — 역전이 침체를 몇 달 앞섰나(T10Y2Y·T10Y3M vs USREC) ═══')
const [c2, c3m, rec] = await Promise.all([obs('T10Y2Y', '1976-01-01'), obs('T10Y3M', '1982-01-01'), obs('USREC', '1976-01-01')])
console.log(`  T10Y2Y ${c2.length}건(${c2[0]?.d}~) · T10Y3M ${c3m.length}건(${c3m[0]?.d}~) · USREC ${rec.length}건(월별)`)
const recStarts = []
for (let i = 1; i < rec.length; i++) if (rec[i].v === 1 && rec[i - 1].v === 0) recStarts.push(rec[i].d)
console.log(`  NBER 침체 시작: ${recStarts.join(', ')}`)

const episodes = (series, label) => {
  // 연속 역전 구간을 묶는다(단일 일자 노이즈 방지: 5거래일 이상 음수만 인정)
  const out = []; let run = []
  for (const o of series) {
    if (o.v < 0) run.push(o)
    else { if (run.length >= 5) out.push({ from: run[0].d, to: run[run.length - 1].d, min: Math.min(...run.map(x => x.v)), days: run.length }); run = [] }
  }
  if (run.length >= 5) out.push({ from: run[0].d, to: run[run.length - 1].d, min: Math.min(...run.map(x => x.v)), days: run.length, ongoing: true })
  console.log(`\n  ${label} 역전 에피소드 ${out.length}건`)
  for (const e of out) {
    const next = recStarts.find(r => r > e.from)
    const lead = next ? Math.round((new Date(next) - new Date(e.from)) / 864e5 / 30.44) : null
    console.log(`    ${e.from} ~ ${e.to} (${e.days}일, 최심 ${e.min.toFixed(2)}%p)${e.ongoing ? ' [진행중]' : ''} → 다음 침체 ${next ?? '—'}${lead != null ? ` (${lead}개월 후)` : ''}`)
  }
  return out
}
episodes(c2, 'T10Y2Y(10Y−2Y)')
episodes(c3m, 'T10Y3M(10Y−3M)')
