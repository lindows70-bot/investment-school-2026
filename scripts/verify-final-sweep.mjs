// ✅ 최종 전수 검증 — 오늘 손댄 화면 전부를 프로덕션에서 원천 대조한다.
//    ⚠️ 아람코 통화 버그가 "화면을 봐야 잡히는" 유형이었다. 같은 유형(단위·통화·잣대)을 전 축에서 훑는다.
const P = 'https://investment-school-2026.vercel.app/api/'
let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }
const get = (ep, ms = 120000) => fetch(P + ep, { signal: AbortSignal.timeout(ms) }).then(r => r.ok ? r.json() : null).catch(() => null)

// ── ① 자산 순위 ──────────────────────────────────────────────────────────────
console.log('═══ ① 자산 시총 순위 ═══')
const ar = await get('asset-ranking')
if (ar) {
  ar.assets.forEach((a, i) => console.log(`  ${String(i + 1).padStart(2)}. ${a.name.padEnd(14)} $${(a.cap / 1e12).toFixed(2).padStart(6)}조  ${String(a.vsBtc).padStart(6)}배`))
  const g = ar.assets.find(a => a.key === 'gold'), b = ar.assets.find(a => a.key === 'btc')
  const am = ar.assets.find(a => a.key === '2222.SR'), nv = ar.assets.find(a => a.key === 'NVDA')
  check(am == null || (am.cap / 1e12 < 3), `아람코 $${am ? (am.cap / 1e12).toFixed(2) : '—'}조 — 통화 환산 반영됨`)
  check(nv == null || am == null || nv.cap > am.cap, '엔비디아 > 아람코')
  // vsBtc 항등식 — 표의 배수가 실제 시총비와 맞나
  const bad = ar.assets.filter(a => a.vsBtc != null && Math.abs(a.vsBtc - a.cap / b.cap) > 0.02)
  check(bad.length === 0, `배수 항등식(시총 ÷ BTC 시총) — 어긋난 행 ${bad.length}개`)
  check(Math.abs(ar.btcVsGoldPct - (b.cap / g.cap) * 100) < 0.15, `"금의 ${ar.btcVsGoldPct}%" 가 실제 비율과 일치`)
  check(ar.btcRank === ar.assets.findIndex(a => a.key === 'btc') + 1, `비트코인 순위 표기(${ar.btcRank}위)가 정렬과 일치`)
  check(ar.notes.some(n => n.includes('환율')), '환율 캐비엇 포함')
} else { console.log('  ❌ 응답 없음'); fail++ }

// ── ② 수익률곡선 ────────────────────────────────────────────────────────────
console.log('\n═══ ② 수익률곡선 ═══')
const yc = await get('yield-curve')
if (yc) {
  const y = (t) => yc.curve.find(c => c.years === t)?.v
  console.log(`  ${yc.curveDate} · ${yc.curve.map(c => `${c.label} ${c.v}`).join(' · ')}`)
  console.log(`  경보 ${yc.alert} · 10Y−2Y ${yc.spreads[0].value} · 10Y−3M ${yc.spreads[1].value}`)
  // 스프레드 항등식 — 공식 계열과 만기 차감이 같은 잣대인가(관측일 차이만큼만 허용)
  check(Math.abs((y(10) - y(2)) - yc.spreads[0].value) <= 0.06, `10Y−2Y: 만기차감 ${(y(10) - y(2)).toFixed(2)} vs 공식 ${yc.spreads[0].value}`)
  check(Math.abs((y(10) - y(0.25)) - yc.spreads[1].value) <= 0.06, `10Y−3M: 만기차감 ${(y(10) - y(0.25)).toFixed(2)} vs 공식 ${yc.spreads[1].value}`)
  // 곡선 단조성(정상 곡선이면 대체로 우상향 — 역전 구간이 없다면)
  const inv = yc.curve.slice(1).filter((c, i) => c.v < yc.curve[i].v)
  check(yc.alert !== 'none' || inv.length <= 1, `정상 판정인데 하락 구간 ${inv.length}개(0~1이면 정상 노이즈)`)
  // 결말 4분류 합계
  const o = {}; for (const h of yc.history) o[h.outcome] = (o[h.outcome] ?? 0) + 1
  console.log(`  역전 이력 ${yc.history.length}건 — ${Object.entries(o).map(([k, v]) => `${k}:${v}`).join(' · ')}`)
  check(Object.values(o).reduce((a, b) => a + b, 0) === yc.history.length, '결말 분류 합계 = 전체 건수')
  check(yc.leadSummary.noRecession === (o.false_alarm ?? 0), `오경보 집계(${yc.leadSummary.noRecession}) = false_alarm(${o.false_alarm ?? 0})`)
  const leads = yc.history.filter(h => h.leadMonths != null).map(h => h.leadMonths)
  check(leads.length === (o.recession ?? 0), `리드타임 있는 건수(${leads.length}) = recession 분류(${o.recession ?? 0})`)
  check(Math.min(...leads) === yc.leadSummary.minMonths && Math.max(...leads) === yc.leadSummary.maxMonths,
    `리드타임 범위 ${yc.leadSummary.minMonths}~${yc.leadSummary.maxMonths}개월이 실제 최소·최대와 일치`)
} else { console.log('  ❌ 응답 없음'); fail++ }

// ── ③ CME COT ───────────────────────────────────────────────────────────────
console.log('\n═══ ③ CME 기관 포지셔닝 ═══')
const cot = await get('crypto-cot')
if (cot) {
  console.log(`  ${cot.reportDate}(${cot.staleDays}일 전) · ${cot.groups.map(g => `${g.label} ${g.net > 0 ? '+' : ''}${g.net}`).join(' · ')}`)
  check(cot.groups.every(g => g.net === g.long - g.short), '순포지션 항등식')
  check(cot.longRecord?.levLongWeeks === 20 && cot.longRecord?.levLastLongDate === '2019-02-05', '전 이력 기록이 로컬 실측과 일치')
  check(cot.groups.every(g => !g.flipped || (g.netPrior < 0) !== (g.netRecent < 0)), '전환 배지는 부호가 실제 바뀔 때만')
} else { console.log('  ❌ 응답 없음'); fail++ }

// ── ④ 채권편 나머지 ─────────────────────────────────────────────────────────
console.log('\n═══ ④ 채권편(인하사이클·상관·YCC·부채) ═══')
const b = await get('bonds')
if (b) {
  const dbt = b.ycc?.usDebt
  console.log(`  미국 총부채 $${dbt ? (dbt.total / 1e12).toFixed(2) : '—'}조(${dbt?.date}) · 1년 +${dbt?.yoyPct}%`)
  check(dbt != null && dbt.total > 30e12 && dbt.total < 60e12, '총부채 상식 범위')
  const ins = b.cutCycles?.summary?.find(s => s.kind === 'insurance')
  const cri = b.cutCycles?.summary?.find(s => s.kind === 'crisis')
  console.log(`  인하 사이클 — 보험성 ${ins?.n}건(주가표본 ${ins?.nWithSpx}) 중위 ${ins?.medSpx12}% · 위기성 ${cri?.n}건 통계억제 ${cri?.suppressed != null}`)
  check(cri?.nWithSpx >= 5 || cri?.suppressed != null, '표본 5건 미만이면 통계 억제(선별 편향 방어)')
  // 인하 사이클 표의 침체 개월수가 창(18개월) 안에 있나 — 라벨과 잣대 일치
  const over = (b.cutCycles?.cycles ?? []).filter(c => c.recessionAfterMonths != null && c.recessionAfterMonths > 18)
  check(over.length === 0, `침체 표기가 전부 18개월 창 안(초과 ${over.length}건)`)
  const eq = b.correlation?.rows?.filter(r => r.group === 'equity') ?? []
  const sa = eq.reduce((s, r) => s + (r.all ?? 0), 0) / (eq.length || 1)
  const ss = eq.reduce((s, r) => s + (r.stress ?? 0), 0) / (eq.length || 1)
  console.log(`  상관 — 주식군 평상시 ${sa.toFixed(2)} → 발작기 ${ss.toFixed(2)} · 발작일 ${b.correlation?.stressDays}일`)
  check(b.correlation?.rows?.every(r => r.all == null || Math.abs(r.all) <= 1), '상관계수 범위')
  check(b.ycc?.jgb?.length > 100, `일본 10Y 시계열 ${b.ycc?.jgb?.length}개월`)
} else { console.log('  ❌ 응답 없음'); fail++ }

// ── ⑤ 코인 랩 기존 축 회귀 ──────────────────────────────────────────────────
console.log('\n═══ ⑤ 코인 랩 기존 축 회귀 ═══')
for (const [ep, label] of [['crypto-funding', '펀딩비·OI'], ['crypto-demand', '현물vs선물'], ['btc-etf', 'ETF 순유입'], ['coin-lab', '코인 랩 본체']]) {
  const j = await get(ep, 120000)
  check(j != null && !j.error, `${label} 정상 응답`)
}

console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
