// 🔍 Strategy(MSTR) 우선주 4종이 우리 배당 엔진에서 어떻게 잡히는지 실측(프로덕션 라우트 경유).
//   ⚠️ 로컬 fetch 는 야후가 401 로 막는다 — 프로덕션(브라우저 헤더+yahoo-finance2)이 진짜 값이다.
const P = 'https://investment-school-2026.vercel.app/api/dividend-explorer'
for (const t of ['STRC', 'STRK', 'STRF', 'STRD', 'MSTR', 'MSTY']) {
  try {
    const r = await fetch(`${P}?ticker=${t}&market=US`, { signal: AbortSignal.timeout(60000) })
    const j = r.ok ? await r.json() : null
    if (!j) { console.log(`${t}: HTTP ${r.status}`); continue }
    const pct = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%'
    console.log(`\n${t}  "${j.name}"  $${j.price ?? '—'}`)
    console.log(`   배당률 ${pct(j.dividendYield)} · 연배당 ${j.annualDividend ?? '—'} · 주기 ${j.frequency} · 지급월 ${JSON.stringify(j.paymentMonths)}`)
    console.log(`   배당성향 ${pct(j.payoutRatio)} · FCF커버 ${j.fcfCover ?? '—'} · 연속인상 ${j.consecutiveYears ?? '없음'} · 등급 ${j.dividendGrade ?? '없음'}`)
    console.log(`   5년CAGR ${pct(j.dividendGrowth5y)} · 1년 ${pct(j.dividendGrowth1y)} · 스타일 ${j.style ?? '—'} · YoC10y ${pct(j.yoc10y)}`)
    console.log(`   안전 ${j.safetyScore ?? '—'}(${j.safetyGrade ?? '—'}) · 파생ETF ${j.isDerivativeEtf} · 함정 ${j.isTrapWarning} → ${JSON.stringify(j.trapReasons)}`)
  } catch (e) { console.log(`${t}: ❌ ${e.message}`) }
}
