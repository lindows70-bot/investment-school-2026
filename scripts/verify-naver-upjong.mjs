// 국내 업종 SSOT(lib/naverUpjong) 검증 — 네이버 업종 목록 79개를 라이브로 받아 업종명→야후 11개 섹터가 '기타' 빼고 전부 풀리는지 ·
//   integration.industryCode 가 표로 풀리는지(삼성전자 278 = 반도체와반도체장비) · (라이브) 프로덕션 /api/stock-info 국내 종목 업종이 null 이 아닌지
//   2026-09-30 신설 — 네이버 basic 의 업종 필드가 사라져 국내 전 종목 업종이 '모름'이었다. 표가 반쪽이 되면 조용히 다시 '모름'이 된다.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-upjong`

writeFileSync(`${ROOT}/.bt-upjong.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/naverUpjong.ts`],
}, null, 2))
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p ${ROOT}/.bt-upjong.tsconfig.json`, { cwd: ROOT, stdio: 'pipe' })
} catch (e) {
  console.log('❌ 컴파일 실패'); console.log(e.stdout?.toString() ?? ''); console.log(e.stderr?.toString() ?? ''); process.exit(1)
}
if (!existsSync(`${OUT}/lib/naverUpjong.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
// appCache 가 '@/lib/cachePurge' 별칭을 쓴다 — 컴파일된 폴더 안으로 돌린다
const require = Module.createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const { upjongToGics, upjongToLynchSector, industryNameOf } = require(`${OUT}/lib/naverUpjong.js`)

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', Referer: 'https://m.stock.naver.com/' }

// ── 순수 규칙 ──
check('업종명 없으면 null(지어내지 않는다)', upjongToGics(null) === null && upjongToGics('기타') === null)
check('통신장비·전자제품 = Technology(야후 기준) · 철강 = Basic Materials · 문구류 = Industrials',
  upjongToGics('통신장비') === 'Technology' && upjongToGics('전자제품') === 'Technology' && upjongToGics('철강') === 'Basic Materials' && upjongToGics('문구류') === 'Industrials')
check('가정용기기와용품 = Consumer Cyclical(가정용품 Defensive 와 헷갈리지 않는다)', upjongToGics('가정용기기와용품') === 'Consumer Cyclical' && upjongToGics('가정용품') === 'Consumer Defensive')
check('린치 세분 — 통신서비스만 저성장(통신장비는 Technology) · 반도체 Semiconductors · 철강 Steel · 전자제품 Consumer Durables · 나머지는 야후 11개',
  upjongToLynchSector('무선통신서비스') === 'Telecommunications' && upjongToLynchSector('통신장비') === 'Technology' && upjongToLynchSector('반도체와반도체장비') === 'Semiconductors'
  && upjongToLynchSector('비철금속') === 'Steel' && upjongToLynchSector('전자제품') === 'Consumer Durables' && upjongToLynchSector('은행') === 'Financial Services' && upjongToLynchSector('기타') === null)
const map = new Map([['278', '반도체와반도체장비']])
check('integration.industryCode(문자열·숫자 둘 다) → 업종명', industryNameOf({ industryCode: '278' }, map) === '반도체와반도체장비' && industryNameOf({ industryCode: 278 }, map) === '반도체와반도체장비' && industryNameOf({}, map) === null && industryNameOf(null, map) === null)

// ── 라이브: 네이버 업종 목록 전수 ──
try {
  const r = await fetch('https://m.stock.naver.com/api/stocks/industry?page=1&pageSize=100', { headers: UA })
  const groups = r.ok ? (await r.json())?.groups ?? [] : []
  check(`네이버 업종 목록 ${groups.length}개(70개 이상)`, groups.length >= 70)
  const miss = groups.filter(g => g.name !== '기타' && !upjongToGics(String(g.name)))
  check(`업종명 → 섹터 미분류 0개('기타' 제외)`, miss.length === 0, miss.map(g => g.name).join(','))
  const missL = groups.filter(g => g.name !== '기타' && !upjongToLynchSector(String(g.name)))
  check(`업종명 → 린치 라벨 미분류 0개('기타' 제외)`, missL.length === 0, missL.map(g => g.name).join(','))
  const live = new Map(groups.map(g => [String(g.no), String(g.name)]))
  const s = await fetch('https://m.stock.naver.com/api/stock/005930/integration', { headers: UA })
  const j = s.ok ? await s.json() : null
  const name = industryNameOf(j, live)
  check(`삼성전자 integration.industryCode → 업종명(${name ?? 'null'}) → 섹터(${upjongToGics(name) ?? 'null'})`, name === '반도체와반도체장비' && upjongToGics(name) === 'Technology')
} catch (e) { fail++; console.log(`❌ 네이버 업종 목록 호출 실패 — ${e.message}`) }

// ── 라이브: 프로덕션 /api/stock-info 국내 종목 ──
try {
  const res = await fetch('https://investment-school-2026.vercel.app/api/stock-info?ticker=005930&market=KR', { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) { fail++; console.log(`❌ 라이브 /api/stock-info HTTP ${res.status}`) }
  else {
    const j = await res.json()
    check(`라이브 /api/stock-info 삼성전자 — 업종 ${j.industry ?? 'null'} · 섹터 ${j.fundamentals?.sector ?? 'null'}`, j.industry === '반도체와반도체장비' && j.fundamentals?.sector === 'Technology')
  }
} catch (e) { fail++; console.log(`❌ 라이브 /api/stock-info 호출 실패 — ${e.message}`) }

// ── 라이브: 프로덕션 /api/stock-price 국내 종목(같은 표를 쓰는 두 번째 표면 — 하나만 고치면 화면끼리 어긋난다) ──
try {
  const res = await fetch('https://investment-school-2026.vercel.app/api/stock-price?ticker=005930&market=KR', { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) { fail++; console.log(`❌ 라이브 /api/stock-price HTTP ${res.status}`) }
  else {
    const j = await res.json()
    check(`라이브 /api/stock-price 삼성전자 — 섹터 ${j.fundamentals?.sector ?? 'null'}(stock-info 와 같은 값)`, j.fundamentals?.sector === 'Technology')
  }
} catch (e) { fail++; console.log(`❌ 라이브 /api/stock-price 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (국내 업종 SSOT)')
process.exitCode = fail ? 1 : 0
