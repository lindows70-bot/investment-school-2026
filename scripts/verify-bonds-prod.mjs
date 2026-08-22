// ✅ 배포 후 독립 검증 — 화면이 읽는 프로덕션 응답을 FRED 원천에서 다시 계산해 대조한다.
//    캐시된 값을 캐시로 확인하는 건 검증이 아니다.
import { readFileSync } from 'node:fs'
let KEY = process.env.FRED_API_KEY
if (!KEY) { try { KEY = (readFileSync('.env.local', 'utf8').match(/^FRED_API_KEY=(.+)$/m) || [])[1]?.trim() } catch {} }
const P = 'https://investment-school-2026.vercel.app'
const fred = async (id, start) => {
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}`, { signal: AbortSignal.timeout(25000) })
  return r.ok ? ((await r.json()).observations ?? []).map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(x => isFinite(x.v)) : []
}
let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }

// ── ① /api/yield-curve ────────────────────────────────────────────────────────
const yc = await fetch(`${P}/api/yield-curve`, { signal: AbortSignal.timeout(90000) }).then(r => r.ok ? r.json() : null)
if (!yc) { console.error('❌ /api/yield-curve 응답 없음'); process.exit(1) }
console.log(`═══ ① 수익률곡선 (${yc.curveDate}) ═══`)
console.log(`  ${yc.curve.map(c => `${c.label}=${c.v}`).join(' · ')}`)
console.log(`  경보 ${yc.alert} — ${yc.alertHeadline}`)
console.log(`  스프레드: ${yc.spreads.map(s => `${s.label} ${s.value}%p(역전 ${s.invertedDays}일)`).join(' · ')}`)
console.log(`  역전 이력 ${yc.history.length}건 · 리드타임 중앙값 ${yc.leadSummary.medianMonths}개월(표본 ${yc.leadSummary.n})`)

// 원천 재계산 대조
const [d10, d2, d3m, t2, t3] = await Promise.all([
  fred('DGS10', yc.curveDate), fred('DGS2', yc.curveDate), fred('DGS3MO', yc.curveDate),
  fred('T10Y2Y', '2026-08-01'), fred('T10Y3M', '2026-08-01'),
])
const at = (a, d) => a.find(x => x.d === d)?.v
console.log('\n═══ 원천 재계산 대조 ═══')
check(at(d10, yc.curveDate) === yc.curve.find(c => c.years === 10).v, `10년물 화면 ${yc.curve.find(c => c.years === 10).v} = FRED ${at(d10, yc.curveDate)}`)
check(at(d2, yc.curveDate) === yc.curve.find(c => c.years === 2).v, `2년물 화면 ${yc.curve.find(c => c.years === 2).v} = FRED ${at(d2, yc.curveDate)}`)
check(at(d3m, yc.curveDate) === yc.curve.find(c => c.years === 0.25).v, `3개월물 화면 ${yc.curve.find(c => c.years === 0.25).v} = FRED ${at(d3m, yc.curveDate)}`)
const t2last = t2[t2.length - 1], t3last = t3[t3.length - 1]
check(Math.abs(yc.spreads[0].value - t2last.v) < 0.005, `10Y−2Y 화면 ${yc.spreads[0].value} = 공식 T10Y2Y ${t2last.v} (${t2last.d})`)
check(Math.abs(yc.spreads[1].value - t3last.v) < 0.005, `10Y−3M 화면 ${yc.spreads[1].value} = 공식 T10Y3M ${t3last.v} (${t3last.d})`)
// 공식 계열 vs 만기 직접 차감이 일치하는지(제2원칙 — 두 잣대가 어긋나면 화면이 모순된다)
const manual = Math.round((at(d10, yc.curveDate) - at(d2, yc.curveDate)) * 100) / 100
check(Math.abs(manual - yc.spreads[0].value) <= 0.06, `공식 스프레드(${yc.spreads[0].value})와 만기 직접차감(${manual}) 차이 ${Math.abs(manual - yc.spreads[0].value).toFixed(2)}%p — 관측일 차이 범위 내`)
check(yc.alert === 'none' ? yc.spreads.every(s => s.value >= 0.25) : true, `경보 ${yc.alert} 가 스프레드와 정합`)
const e2022 = yc.history.find(h => h.from.startsWith('2022'))
check(!!e2022 && e2022.recessionStart == null, `2022년 역전 ${e2022?.days}일·${e2022?.minPp}%p → 침체 없음으로 기록`)

// ── ② /api/bonds ──────────────────────────────────────────────────────────────
const b = await fetch(`${P}/api/bonds`, { signal: AbortSignal.timeout(120000) }).then(r => r.ok ? r.json() : null)
if (!b) { console.error('❌ /api/bonds 응답 없음'); process.exit(1) }
console.log(`\n═══ ② /api/bonds v5 동승 축 ═══`)
check(!!b.cutCycles, `인하 사이클 ${b.cutCycles?.cycles?.length ?? 0}건`)
check(!!b.correlation, `상관 ${b.correlation?.rows?.length ?? 0}종 · 발작일 ${b.correlation?.stressDays ?? 0}일`)
check(!!b.ycc, `YCC 일본 시계열 ${b.ycc?.jgb?.length ?? 0}개월`)
check(!!b.realYield, '금리 3형제(기존 축) 회귀 없음')
check(b.etfs?.some(e => e.price != null), '채권 ETF 가격(기존 축) 회귀 없음')

if (b.cutCycles) {
  const cur = b.cutCycles.current
  console.log(`  현재 인하 사이클 ${cur?.start?.slice(0, 7)} = ${cur?.kind}`)
  const crisis = b.cutCycles.summary.find(s => s.kind === 'crisis')
  check(crisis?.suppressed != null || crisis?.nWithSpx >= 5, `위기성 인하 주가 표본 ${crisis?.nWithSpx}건 → ${crisis?.suppressed ? '통계 억제됨(선별 편향 방어)' : '표본 충분'}`)
  const ins = b.cutCycles.summary.find(s => s.kind === 'insurance')
  console.log(`  보험성 ${ins?.n}건(주가 ${ins?.nWithSpx}) 중위 ${ins?.medSpx12}% 승률 ${ins?.winRate12}% 침체율 ${ins?.recessionRate}%`)
}
if (b.correlation) {
  const eq = b.correlation.rows.filter(r => r.group === 'equity')
  const a = eq.reduce((s, r) => s + (r.all ?? 0), 0) / eq.length
  const st = eq.reduce((s, r) => s + (r.stress ?? 0), 0) / eq.length
  console.log(`  주식군 평균 상관 평상시 ${a.toFixed(2)} → 발작기 ${st.toFixed(2)}`)
  check(st > a, '발작기 주식 상관이 평상시보다 높다(분산 소멸 메시지의 근거)')
  check(b.correlation.rows.every(r => r.all == null || Math.abs(r.all) <= 1), '상관계수 범위 정상')
}
if (b.ycc) console.log(`  일본 10Y — YCC중 평균 ${b.ycc.duringAvg}% → 종료후 ${b.ycc.afterAvg}% → 현재 ${b.ycc.latest?.v}% (${b.ycc.latest?.date})`)

console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
