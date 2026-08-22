// ✅ 배포 후 독립 검증 — 화면이 읽는 프로덕션 응답에서 결함이 실제로 사라졌는지 대조.
//    ①같은 발행사 4종의 등급 불일치 소멸 ②해당 없는 축이 전부 null ③액면 추정 ④보통주 회귀 없음
const P = 'https://investment-school-2026.vercel.app/api/dividend-explorer'
const get = async (t) => {
  const r = await fetch(`${P}?ticker=${t}&market=US`, { signal: AbortSignal.timeout(90000) })
  return r.ok ? r.json() : null
}
const pct = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%'

console.log('═══ ① 우선주 4종 — 해당 없는 축이 전부 null 인가 ═══')
const NA = ['payoutRatio', 'fcf', 'fcfCover', 'consecutiveYears', 'dividendGrade', 'dividendGrowth5y', 'dividendGrowth1y', 'yoc5y', 'yoc10y', 'style', 'safetyScore', 'safetyGrade']
let bad = 0
for (const t of ['STRF', 'STRC', 'STRK', 'STRD']) {
  const j = await get(t)
  if (!j) { console.log(`${t}: ❌ 응답 없음`); bad++; continue }
  const pf = j.preferred
  const leaks = NA.filter(k => j[k] != null)
  if (!pf) { console.log(`${t}: ❌ preferred 필드 없음(캐시 미범프 의심)`); bad++; continue }
  if (leaks.length) { console.log(`${t}: ❌ 남아있는 축 ${leaks.join(',')}`); bad++ }
  console.log(`\n${t} "${j.name}"  $${j.price}`)
  console.log(`   배당률 ${pct(j.dividendYield)} · 주기 ${j.frequency} · 쿠폰 ${pf.isVariableRate ? '변동' : pf.couponPct + '%'} · 액면추정 ${pf.parEstimate != null ? '$' + pf.parEstimate : '—'} · 괴리 ${pf.parGapPct != null ? pf.parGapPct + '%' : '—'}`)
  console.log(`   발행사 "${pf.issuerName}" · 시리즈 "${pf.seriesLabel ?? '—'}"`)
  console.log(`   안전등급 ${j.safetyGrade ?? 'null(매기지 않음)'} · 경보 ${j.isTrapWarning}`)
  console.log(`   사유: ${j.trapReasons.map(r => '\n     • ' + r).join('')}`)
}

console.log('\n═══ ② 보통주·ETF 회귀 확인 — 축이 그대로 살아 있어야 한다 ═══')
for (const t of ['MSTR', 'O', 'MO', 'SCHD', 'MSTY']) {
  const j = await get(t)
  if (!j) { console.log(`${t}: ❌`); bad++; continue }
  const ok = j.preferred == null
  if (!ok) bad++
  console.log(`  ${t.padEnd(6)} preferred=${j.preferred == null ? 'null ✅' : '❌ 오탐'} · 안전 ${j.safetyScore ?? '—'}(${j.safetyGrade ?? '—'}) · 성향 ${pct(j.payoutRatio)} · 연속 ${j.consecutiveYears ?? '—'} · 스타일 ${j.style ?? '—'}`)
}

console.log(`\n${bad === 0 ? '✅ 전부 통과' : `❌ 문제 ${bad}건`}`)
process.exitCode = bad === 0 ? 0 : 1
