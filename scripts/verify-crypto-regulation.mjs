// 규제 레이더(프로덕션 /api/crypto-regulation) 검증 — 항목마다 근거 기사(sources)가 1개 이상 · 링크는 http(s) · 신호등 값은 3종 중 하나 · 캐시 날짜 오늘
//   2026-09-30 신설 — 근거 없는 항목을 서버가 버리는 srcIdx 가드가 조용히 무력해지면(스키마 변경·프롬프트 회귀) 화면이 다시 링크 없는 요약이 된다
let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

try {
  const res = await fetch('https://investment-school-2026.vercel.app/api/crypto-regulation', { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) { fail++; console.log(`❌ 라이브 HTTP ${res.status}`) }
  else {
    const j = await res.json()
    if (j.error) { fail++; console.log(`❌ 응답 오류 — ${j.error}(원천 헤드라인 0건이거나 AI 실패)`) }
    else {
      const bills = Array.isArray(j.bills) ? j.bills : []
      check(`항목 ${bills.length}개(1개 이상)`, bills.length >= 1)
      check('신호등 값 3종만(전반 + 항목)', ['green', 'yellow', 'red'].includes(j.climate) && bills.every(b => ['green', 'yellow', 'red'].includes(b.impact)))
      const noSrc = bills.filter(b => !Array.isArray(b.sources) || b.sources.length === 0)
      check(`항목마다 근거 기사 1개 이상(없는 항목 ${noSrc.length})`, noSrc.length === 0, noSrc.map(b => b.title).join(' · '))
      const badUrl = bills.flatMap(b => b.sources ?? []).filter(s => !s || typeof s.title !== 'string' || !s.title || !/^https?:\/\//.test(String(s.url)))
      check(`근거 링크 전부 http(s) + 제목(불량 ${badUrl.length})`, badUrl.length === 0)
      check('항목당 근거 3개 이하', bills.every(b => (b.sources ?? []).length <= 3))
      const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
      check(`asOf 가 최근 24시간(${String(j.asOf).slice(0, 10)} · 오늘 KST ${kst})`, typeof j.asOf === 'string' && Date.now() - Date.parse(j.asOf) < 24 * 3600_000)
      for (const b of bills) console.log(`   · ${b.impact} ${b.title} — 근거 ${(b.sources ?? []).length}개`)
    }
  }
} catch (e) { fail++; console.log(`❌ 라이브 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (규제 레이더 근거 링크)')
process.exitCode = fail ? 1 : 0
