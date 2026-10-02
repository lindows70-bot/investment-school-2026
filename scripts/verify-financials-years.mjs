// 재무 API(/api/financials) 확정 연도 검증(국내 + 미국) — 5개 확정 연도의 EPS·매출이 비어(0) 있지 않은지 · DART 사업보고서 값과 같은지
//   2026-10-02 신설 — DART 수집이 ①올해(보고서가 없는 해)를 기준으로 불러 2022~2024 만 닿았고 ②손익을 포괄손익계산서 한 장(CIS)으로 내는 회사는 통째로 버려,
//   SK하이닉스 2021·2022 가 0 으로 나갔다. 0 은 '자료 없음'인데 이익 차트가 '적자 구간'으로 그렸다. 값이 0 이라 빌드·타입체크는 전부 통과한다.
const B = 'https://investment-school-2026.vercel.app'
let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

// 과거 EPS 는 네이버 잣대(지금 주식 수 기준)로 나가야 한다 — DART 원값(보고서를 낸 시점의 EPS)은 액면분할 뒤 몇 배 다르다.
//   dart = DART 사업보고서 기본주당이익(2026-10-02 fnlttSinglAcntAll 실측) · tol = 네이버 잣대로 옮긴 값이 DART 원값과 이 비율 안이어야 한다(정의 차이)
//   split = 액면분할 종목: 옮긴 값이 DART 원값의 1/split 근처여야 한다(LS ELECTRIC — 네이버 1,911 vs DART 9,647)
const CASES = [
  { t: '000660', name: 'SK하이닉스(손익이 CIS 한 장)', dart: { 2021: 13989, 2022: 3242 }, tol: 0.1 },
  { t: '005930', name: '삼성전자(IS·CIS 둘 다)', dart: { 2021: 5777, 2022: 8057 }, tol: 0.05 },
  { t: '329180', name: 'HD현대중공업(CIS · 과거 적자)', dart: { 2021: -10713, 2022: -3966 }, tol: 0.05 },
  { t: '010120', name: 'LS ELECTRIC(액면분할 — DART 원값을 그대로 쓰면 5배)', dart: { 2021: 2890, 2022: 3077 }, tol: 0.1, split: 5 },
]
const cy = new Date(Date.now() + 9 * 3600_000).getUTCFullYear()
// 영업이익(억원) — 계정 부분일치로 '기타이익'을 영업이익으로 잡던 결함 감시. 기대값 = DART 2025년 사업보고서 영업이익(dart_OperatingIncomeLoss) ÷ 1억
const OP_CASES = [{ t: '010140', name: '삼성중공업(기타이익 행이 영업이익보다 먼저 온다)', op: { 2023: 2333, 2024: 5027, 2025: 8622 } }]
for (const c of OP_CASES) {
  try {
    const j = await fetch(`${B}/api/financials?ticker=${c.t}&market=KR`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json())
    const bad = Object.entries(c.op).filter(([y, v]) => j?.financials?.[y]?.operatingProfit !== v).map(([y, v]) => `${y}: ${j?.financials?.[y]?.operatingProfit} ≠ ${v}`)
    check(`${c.name} — 영업이익이 DART 영업이익 행과 같음(${Object.entries(c.op).map(([y, v]) => `${y} ${v}억`).join(' · ')})`, bad.length === 0, bad.join(' / '))
  } catch (e) { fail++; console.log(`❌ ${c.name} 호출 실패 — ${e.message}`) }
}
for (const c of CASES) {
  try {
    const j = await fetch(`${B}/api/financials?ticker=${c.t}&market=KR`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json())
    const fin = j?.financials ?? {}
    const past = Object.keys(fin).filter(k => !k.endsWith('E')).sort()
    // 직전 연도(cy-1) 보고서는 3월쯤 나오므로, 1~3월엔 가장 최근 한 해가 비어도 통과시킨다
    const must = past.filter(y => Number(y) <= cy - 2 || new Date().getUTCMonth() >= 3)
    const empty = must.filter(y => !(fin[y]?.eps !== 0 && fin[y]?.revenue > 0))
    check(`${c.name} — 확정 ${must.length}개 연도(${must[0]}~${must.at(-1)}) EPS·매출이 비어 있지 않음${empty.length ? ` (빈 해: ${empty.join(', ')})` : ''}`, past.length >= 5 && empty.length === 0)
    const k = c.split ?? 1
    const bad = Object.entries(c.dart).filter(([y, v]) => !(fin[y]?.eps !== 0 && fin[y].eps / (v / k) > 0 && Math.abs(fin[y].eps / (v / k) - 1) <= c.tol)).map(([y, v]) => `${y}: ${fin[y]?.eps} vs DART ${v}${k !== 1 ? ` ÷ ${k}` : ''}`)
    check(`${c.name} — 빈 해를 채운 EPS 가 네이버 잣대(${Object.keys(c.dart).map(y => `${y} ${fin[y]?.eps}`).join(' · ')} · DART 원값${k !== 1 ? ` ÷ ${k}` : ''} 의 ±${c.tol * 100}%)`, bad.length === 0, bad.join(' / '))
    // 네이버가 주는 해는 네이버 값 그대로여야 한다(DART 로 덮지 않는다)
    const nv = await fetch(`https://m.stock.naver.com/api/stock/${c.t}/finance/annual`, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' } }).then(r => r.json()).catch(() => null)
    const epsRow = nv?.financeInfo?.rowList?.find(r => r.title === 'EPS')
    const nvYears = (nv?.financeInfo?.trTitleList ?? []).filter(t => t.isConsensus === 'N').map(t => t.key)
    const mism = nvYears.map(key => [key.slice(0, 4), parseFloat(String(epsRow?.columns?.[key]?.value ?? '').replace(/,/g, ''))]).filter(([y, v]) => Number.isFinite(v) && v !== 0 && fin[y] && fin[y].eps !== v).map(([y, v]) => `${y}: ${fin[y].eps} ≠ 네이버 ${v}`)
    check(`${c.name} — 네이버가 주는 해(${nvYears.map(k2 => k2.slice(0, 4)).join('·')})는 네이버 EPS 그대로`, nvYears.length > 0 && mism.length === 0, mism.join(' / '))
  } catch (e) { fail++; console.log(`❌ ${c.name} 호출 실패 — ${e.message}`) }
}

// ── 미국: 적자·영업손실이 0(자료 없음)으로 가려지지 않는가 ──
//   2026-10-02 — FMP 무료 플랜이 거절(402)하는 종목은 야후 폴백이 EPS = 순이익 ÷ 지금 주식 수(적자는 0)였고 과거 영업이익은 전부 0 이었다.
//   기대값 = 회사가 보고한 회계연도 값(야후 fundamentalsTimeSeries 연간 · 2026-10-02 실측). 확정된 과거라 바뀌지 않는다. tol = 원천 반올림 여유
const US_CASES = [
  { t: 'COHR', name: 'COHR(6월 결산 · 2023·2024 적자)', eps: { 2023: -2.93, 2024: -1.84 }, op: { 2024: 123 } },
  { t: 'TXN', name: 'TXN(예전엔 순이익 ÷ 지금 주식 수 = 9.58)', eps: { 2022: 9.41, 2023: 7.07 }, op: { 2022: 10397, 2023: 7331 } },
  { t: 'PLTR', name: 'PLTR(FMP 경로 · 2022 영업손실)', eps: { 2022: -0.18 }, op: { 2022: -161 } },
]
for (const c of US_CASES) {
  try {
    const j = await fetch(`${B}/api/financials?ticker=${c.t}&market=US`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json())
    const fin = j?.financials ?? {}
    const near = (x, v, tol) => typeof x === 'number' && Math.abs(x - v) <= Math.max(tol, Math.abs(v) * 0.02)
    const badE = Object.entries(c.eps).filter(([y, v]) => !near(fin[y]?.eps, v, 0.011)).map(([y, v]) => `${y} EPS ${fin[y]?.eps} ≠ ${v}`)
    const badO = Object.entries(c.op).filter(([y, v]) => !near(fin[y]?.operatingProfit, v, 1)).map(([y, v]) => `${y} 영업이익 ${fin[y]?.operatingProfit} ≠ ${v}`)
    check(`${c.name} — 회계연도 EPS(${Object.entries(c.eps).map(([y, v]) => `${y} ${v}`).join(' · ')}) · 영업이익(${Object.entries(c.op).map(([y, v]) => `${y} ${v}`).join(' · ')}백만 달러)`, badE.length + badO.length === 0, [...badE, ...badO].join(' / '))
  } catch (e) { fail++; console.log(`❌ ${c.name} 호출 실패 — ${e.message}`) }
}

// ── 야후 형식 검증에서 떨어지는 종목(신규 상장 SPCX — earningsHistory 행에 추정치 칸이 없다)도 통째로 실패하지 않는가 ──
//   2026-10-03 — 그 한 모듈 때문에 요청 전체가 실패해 응답이 success:false · 전부 0 이었다. 기대값 = 야후 연간 시계열 2023~2025(2026-10-03 실측)
try {
  const j = await fetch(`${B}/api/financials?ticker=SPCX&market=US`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json())
  const f = j?.financials ?? {}
  check(`SPCX — 형식 검증 실패에도 응답 성공 · 현재가 ${j?.currentPrice} · 2024 매출 ${f['2024']?.revenue} · 2025 EPS ${f['2025']?.eps}`,
    j?.success === true && j.currentPrice > 0 && Math.abs((f['2024']?.revenue ?? 0) - 14015) < 2 && Math.abs((f['2025']?.eps ?? 0) - -0.51) < 0.011)
} catch (e) { fail++; console.log(`❌ SPCX 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (재무 API 확정 연도)')
process.exitCode = fail ? 1 : 0
