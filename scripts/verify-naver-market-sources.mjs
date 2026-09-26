// 네이버 신규 원천(투자자별 매매동향) 감시 — 형식·코드표·단위·신선도·프로덕션 응답을 매일 실측한다
//
// 💥 2026-09-27: 옛 PC 페이지(investorDealTrendDay.naver)가 HTTP 410 으로 폐기됐는데 아무 감시에도 안 걸렸다 —
//    라우트는 200 + {"error":"no_data"} 로 조용히 비어 있었다. 원천이 또 바뀌면 여기서 먼저 빨갛게 뜬다.
//    ⚠️ 합계 검산(제로섬)은 스케일 불변이라 단위 오류를 못 잡는다 → 독립 원천(다음 금융·원 단위) 절대값 대조를 함께 한다.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROD = 'https://investment-school-2026.vercel.app'
const UA = { 'User-Agent': 'Mozilla/5.0' }
const FRESH_DAYS = 10   // 설·추석 연휴(최장 5~6일) + 주말을 넘기면 원천이 멈춘 것이다

let fail = 0
function check(label, cond, detail = '') {
  if (cond) console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`)
  else { console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
}
const getJson = async (url, headers = UA, ms = 20_000) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const ageDays = (iso) => Math.round((Date.parse(kstToday()) - Date.parse(iso)) / 86_400_000)
const iso8 = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
const num = (s) => Number(String(s ?? '').replace(/[,+\s]/g, ''))

// ── ① 투자자별 매매동향 — 실제 lib(src/lib/naverInvestorTrend.ts)을 그대로 불러 검증(재구현 금지) ──
console.log('── 투자자별 매매동향(stock.naver.com trend/daily) ──')
const INV = await import(pathToFileURL(`${ROOT}/src/lib/naverInvestorTrend.ts`).href)
let rows = []
try { rows = await INV.fetchInvestorDaily('KOSPI', 70) } catch (e) { console.log(`   조회 예외: ${e}`) }
check('코스피 70거래일 수집', rows.length >= 60, `${rows.length}행`)
if (rows.length) {
  check('최신 거래일 신선도', ageDays(rows[0].date) <= FRESH_DAYS, `${rows[0].date}(${ageDays(rows[0].date)}일 전)`)
  // 코드표가 완전하면 개인+외국인+기관계+기타법인 = 0(반올림 오차만). 네이버가 새 투자자 코드를 추가하면 여기서 깨진다
  const broken = rows.filter(r => Math.abs(r.personal + r.foreign + r.institution + r.otherCorp) > 3)
  check('제로섬 항등식(코드표 완전성)', broken.length === 0, broken.length ? `위반 ${broken.length}일 — 첫 ${broken[0].date}` : `${rows.length}일`)
  const subOff = rows.filter(r => Math.abs(r.institution - (r.finInvest + r.insurance + r.trust + r.bank + r.otherFin + r.pension)) > 3)
  check('기관계 = 세부 6개 합', subOff.length === 0, subOff.length ? `위반 ${subOff.length}일` : `${rows.length}일`)
}
// 원천에 모르는 코드가 생겼는지(코드표 밖 값은 lib 이 버린다 → 제로섬이 먼저 깨지지만 원인을 바로 보이게)
try {
  const raw = await getJson('https://stock.naver.com/api/domestic/market/trend/daily?marketType=KOSPI&tradeType=KRX&startIdx=0&pageSize=5')
  const KNOWN = new Set(['1000', '2000', '3000', '3100', '4000', '5000', '6000', '7000', '7100', '8000', '9000', '9001'])
  const unknown = new Set((raw?.content ?? []).flatMap(r => (r.netAmounts ?? []).map(x => x.investorGubun)).filter(c => !KNOWN.has(c)))
  check('원천 투자자 코드 = 알려진 12종', unknown.size === 0, unknown.size ? `새 코드 ${Array.from(unknown).join(',')}` : '')
} catch (e) { check('원천 투자자 코드 조회', false, String(e)) }

// 같은 네이버의 다른 엔드포인트(integration dealTrendInfo) — 같은 날이면 억 단위까지 같아야 한다
try {
  const ig = await getJson('https://m.stock.naver.com/api/index/KOSPI/integration')
  const d = ig?.dealTrendInfo
  const same = d?.bizdate && rows.find(r => r.date === iso8(d.bizdate))
  if (!same) console.log(`⚠️ integration 대조 생략 — 같은 날짜 없음(integration ${d?.bizdate ?? '없음'})`)
  else {
    const want = { personal: num(d.personalValue), foreign: num(d.foreignValue), institution: num(d.institutionalValue) }
    const diff = Object.entries(want).filter(([k, v]) => Math.abs(v - same[k]) > 1)
    check('integration(네이버 종합) 개인·외국인·기관 일치', diff.length === 0, diff.length ? diff.map(([k, v]) => `${k} ${same[k]}≠${v}`).join(' ') : `${same.date} ${want.personal}/${want.foreign}/${want.institution}억`)
  }
} catch (e) { check('integration 조회', false, String(e)) }

// 독립 원천 절대값 대조 — 다음 금융(원 단위). 단위(×100·÷100)·부호 오류는 **모든 날**을 어긋나게 하므로 다수결로 본다.
//   하루 이틀은 벤더 간 정정 차이로 크게 갈린다(실측 2026-09-17: 네이버 개인 +3,020·외국인 −22,546억 vs 다음 +6,761·−26,321억,
//   보도 잠정치(NXT 포함)는 +5,261·−24,606억 — 셋째 원천으로도 못 가렸다). 그런 날은 ⚠️ 로 보이되 실패로 세지 않는다.
try {
  const dm = await getJson('https://finance.daum.net/api/investor/KOSPI/days?page=1&perPage=20',
    { ...UA, Referer: 'https://finance.daum.net/domestic/investors' })
  const pairs = (dm?.data ?? []).map(x => ({ x, r: rows.find(r => r.date === String(x.date).slice(0, 10)) })).filter(p => p.r)
  const F = [['personal', 'individualStraightPurchasePrice'], ['foreign', 'foreignStraightPurchasePrice'], ['institution', 'institutionStraightPurchasePrice']]
  const off = []
  let n = 0
  for (const { x, r } of pairs) for (const [k, dk] of F) {
    const v = x[dk] / 1e8
    n++
    if (Math.abs(r[k] - v) > Math.max(500, Math.abs(v) * 0.05)) off.push(`${r.date} ${k} ${r[k]}≠${Math.round(v)}`)
  }
  const okShare = n ? (n - off.length) / n : 0
  check('다음 금융(원→억) 절대값 대조 — 80% 이상 일치', pairs.length >= 5 && okShare >= 0.8,
    pairs.length < 5 ? `겹치는 날 ${pairs.length}일뿐` : `${n - off.length}/${n}건 일치(${pairs.length}일 × 3주체)`)
  if (off.length) console.log(`   ⚠️ 어긋난 건: ${off.slice(0, 4).join(' · ')}`)
} catch (e) { console.log(`⚠️ 다음 금융 대조 생략 — 조회 실패(${e}) · 독립 원천 쪽 문제라 실패로 세지 않는다`) }

// 프로덕션(Vercel) 응답 — 로컬에서 원천이 살아 있어도 서버가 못 닿으면 화면은 빈다
try {
  const j = await getJson(`${PROD}/api/market-investor-trend?market=KOSPI`, UA, 60_000)
  check('프로덕션 /api/market-investor-trend', !j.error && (j.rows?.length ?? 0) >= 40, j.error ? `error: ${j.error}` : `${j.rows.length}행 · 최신 ${j.rows[0]?.date}`)
} catch (e) { check('프로덕션 /api/market-investor-trend', false, String(e)) }
try {
  const j = await getJson(`${PROD}/api/index-flow`, UA, 60_000)
  check('프로덕션 /api/index-flow', !j.error && (j.days?.length ?? 0) >= 200, j.error ? `error: ${j.error}` : `${j.days.length}일 · 최신 ${j.days.at(-1)?.d}`)
} catch (e) { check('프로덕션 /api/index-flow', false, String(e)) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (🔒 네이버 신규 원천 — 투자자별 매매동향)')
process.exit(fail ? 1 : 0)
