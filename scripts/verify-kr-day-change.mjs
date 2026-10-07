// 국내 당일 등락률 SSOT(krDayChange) 검증 — 실측 행 8종으로 네이버 표시값과 같은지 + (라이브) 네이버 종목 basic 등락률과 대조
//   배경(2026-09-27): 수급 표(marketFlowKr)가 이전 행 종가로 나눠 삼성전자 +3.24%(네이버 +3.62%)·엘앤에프 +0.18%(+1.01%)를 냈다.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-kr-day-change`

writeFileSync(`${ROOT}/.bt-kr-day-change.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/krDayChange.ts`],
}, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일이 실패해도 옛 .js 로 거짓 green 을 낸다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p ${ROOT}/.bt-kr-day-change.tsconfig.json`, { cwd: ROOT, stdio: 'pipe' })
} catch (e) {
  console.log('❌ 컴파일 실패')
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/krDayChange.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}
const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/krDayChange.js`)

let fail = 0
function check(label, cond, why = '') {
  if (cond) console.log(`✅ ${label}`)
  else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) }
}

// ── 실측 행(2026-09-23 마감, m.stock.naver.com/api/stock/{code}/trend 첫 행) → 네이버 basic fluctuationsRatio ──
const RISE = { code: '2' }, FALL = { code: '5' }, FLAT = { code: '3' }
const CASES = [
  ['삼성전자', { closePrice: '286,500', compareToPreviousClosePrice: '10,000', compareToPreviousPrice: RISE }, 3.6],   // 네이버 3.62 · 옛 계산 3.24
  ['SK하이닉스', { closePrice: '1,863,000', compareToPreviousClosePrice: '23,000', compareToPreviousPrice: RISE }, 1.3],   // 1.25 → 반올림 1.3
  ['NAVER', { closePrice: '196,000', compareToPreviousClosePrice: '-5,000', compareToPreviousPrice: FALL }, -2.5],   // −2.49
  ['현대차', { closePrice: '357,000', compareToPreviousClosePrice: '-3,500', compareToPreviousPrice: FALL }, -1.0],   // −0.97 · 옛 계산 −1.38
  ['삼성바이오로직스', { closePrice: '1,373,000', compareToPreviousClosePrice: '-18,000', compareToPreviousPrice: FALL }, -1.3],   // −1.29
  ['LG에너지솔루션', { closePrice: '352,000', compareToPreviousClosePrice: '1,500', compareToPreviousPrice: RISE }, 0.4],   // 0.43 · 옛 계산 0.00
  ['에코프로', { closePrice: '80,100', compareToPreviousClosePrice: '0', compareToPreviousPrice: FLAT }, 0],   // 0.00 · 옛 계산 −0.12
  ['엘앤에프', { closePrice: '109,500', compareToPreviousClosePrice: '1,100', compareToPreviousPrice: RISE }, 1.0],   // 1.01 · 옛 계산 0.18
]
for (const [name, row, want] of CASES) {
  const got = M.krDayChangePct(row)
  check(`${name} → ${want}%`, got === want, `계산 ${got}`)
}
check('하락 코드인데 전일 대비가 양수로 와도 음수', M.krDayChangePct({ closePrice: '196,000', compareToPreviousClosePrice: '5,000', compareToPreviousPrice: FALL }) === -2.5)
check('하한가 코드(4)도 음수', M.krDayChangePct({ closePrice: '70,000', compareToPreviousClosePrice: '30,000', compareToPreviousPrice: { code: '4' } }) === -30)
check('상한가(+30%) 그대로', M.krDayChangePct({ closePrice: '13,000', compareToPreviousClosePrice: '3,000', compareToPreviousPrice: { code: '1' } }) === 30)
check('전일 대비 없음 → null(이전 행으로 추정하지 않는다)', M.krDayChangePct({ closePrice: '286,500' }) === null)
check('종가 없음·0·빈 행 → null', M.krDayChangePct({ compareToPreviousClosePrice: '100' }) === null && M.krDayChangePct({ closePrice: '0', compareToPreviousClosePrice: '0' }) === null && M.krDayChangePct(null) === null)
check('숫자 타입으로 와도 계산', M.krDayChangePct({ closePrice: 286500, compareToPreviousClosePrice: 10000 }) === 3.6)

// ── 라이브: 네이버 trend 첫 행 → 우리 계산 vs 같은 날짜의 네이버 일별 시세(price) 등락률 ──
//   예전엔 basic(실시간 · 오늘 날짜)과 비교해, trend 가 아직 전날 행인 시간대(08:00 NXT 개장 ~ 저녁 trend 갱신 전)엔 비교 0종으로 거짓 빨강이었다
//   (2026-10-07 08:25 따라잡기 실행). price 는 날짜별 행이라 trend 의 날짜를 그대로 찾는다.
const H = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' }
const LIVE = ['005930', '000660', '005380', '373220', '066970']
const getJson = async url => { try { const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(10_000) }); return r.ok ? await r.json() : null } catch { return null } }
let compared = 0
const bad = []
for (const code of LIVE) {
  const [rows, prices] = await Promise.all([getJson(`https://m.stock.naver.com/api/stock/${code}/trend?pageSize=1`), getJson(`https://m.stock.naver.com/api/stock/${code}/price?pageSize=5&page=1`)])
  const r0 = Array.isArray(rows) ? rows[0] : null
  const ours = M.krDayChangePct(r0)
  const p = Array.isArray(prices) && r0?.bizdate ? prices.find(x => typeof x?.localTradedAt === 'string' && x.localTradedAt.replace(/-/g, '') === r0.bizdate) : null
  const theirs = p ? Number(p.fluctuationsRatio) : NaN
  if (ours == null || !Number.isFinite(theirs)) continue
  compared++
  if (Math.abs(ours - theirs) > 0.051) bad.push(`${code} ${r0.bizdate} 우리 ${ours} vs 네이버 ${theirs}`)
}
check(`라이브: 같은 날짜 네이버 일별 등락률과 0.05%p 안(비교 ${compared}/${LIVE.length}종)`, compared >= 4 && bad.length === 0, bad.join(' · ') || (compared < 4 ? `비교한 종목 ${compared} — 원천 필드가 바뀌었을 수 있다` : ''))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (국내 당일 등락률)')
process.exitCode = fail ? 1 : 0   // process.exit 는 fetch 핸들이 닫히는 중에 Windows libuv 단언 실패(종료 코드 127)를 냈다
