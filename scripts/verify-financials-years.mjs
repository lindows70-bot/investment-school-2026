// 재무 API(/api/financials) 국내 확정 연도 검증 — 5개 확정 연도의 EPS·매출이 비어(0) 있지 않은지 · DART 사업보고서 값과 같은지
//   2026-10-02 신설 — DART 수집이 ①올해(보고서가 없는 해)를 기준으로 불러 2022~2024 만 닿았고 ②손익을 포괄손익계산서 한 장(CIS)으로 내는 회사는 통째로 버려,
//   SK하이닉스 2021·2022 가 0 으로 나갔다. 0 은 '자료 없음'인데 이익 차트가 '적자 구간'으로 그렸다. 값이 0 이라 빌드·타입체크는 전부 통과한다.
const B = 'https://investment-school-2026.vercel.app'
let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

// 기대값 = DART 사업보고서 연결재무제표의 기본주당이익(원) — 2026-10-02 fnlttSinglAcntAll 실측(2023년 보고서의 전기·전전기 열). 확정된 과거라 바뀌지 않는다.
const CASES = [
  { t: '000660', name: 'SK하이닉스(손익이 CIS 한 장)', eps: { 2021: 13989, 2022: 3242, 2023: -13244 } },
  { t: '005930', name: '삼성전자(IS·CIS 둘 다)', eps: { 2021: 5777, 2022: 8057, 2023: 2131 } },
  { t: '329180', name: 'HD현대중공업(CIS · 과거 적자)', eps: { 2021: -10713, 2022: -3966, 2023: 278 } },
]
const cy = new Date(Date.now() + 9 * 3600_000).getUTCFullYear()
for (const c of CASES) {
  try {
    const j = await fetch(`${B}/api/financials?ticker=${c.t}&market=KR`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json())
    const fin = j?.financials ?? {}
    const past = Object.keys(fin).filter(k => !k.endsWith('E')).sort()
    // 직전 연도(cy-1) 보고서는 3월쯤 나오므로, 1~3월엔 가장 최근 한 해가 비어도 통과시킨다
    const must = past.filter(y => Number(y) <= cy - 2 || new Date().getUTCMonth() >= 3)
    const empty = must.filter(y => !(fin[y]?.eps !== 0 && fin[y]?.revenue > 0))
    check(`${c.name} — 확정 ${must.length}개 연도(${must[0]}~${must.at(-1)}) EPS·매출이 비어 있지 않음${empty.length ? ` (빈 해: ${empty.join(', ')})` : ''}`, past.length >= 5 && empty.length === 0)
    const bad = Object.entries(c.eps).filter(([y, v]) => fin[y]?.eps !== v).map(([y, v]) => `${y}: ${fin[y]?.eps} ≠ ${v}`)
    check(`${c.name} — 과거 EPS 가 DART 사업보고서 값과 같음(${Object.entries(c.eps).map(([y, v]) => `${y} ${v}`).join(' · ')})`, bad.length === 0, bad.join(' / '))
  } catch (e) { fail++; console.log(`❌ ${c.name} 호출 실패 — ${e.message}`) }
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (재무 API 확정 연도)')
process.exitCode = fail ? 1 : 0
