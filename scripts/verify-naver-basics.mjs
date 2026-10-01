// 국내 기본 지표 파서(lib/naverIntegration) 검증 — 문자열 → 숫자 규칙 · 네이버 integration 라이브 형식 · 프로덕션 /api/stock-price 국내 지표가 비어 있지 않고 /api/stock-info 와 같은 값인지
//   2026-10-01 신설 — 네이버 basic 에서 per·eps·배당·시총·52주가 사라져 주가 라우트·린치 분류의 국내 지표가 통째로 null 이었는데 빌드·타입체크·화면이 전부 통과했다(null 은 조용하다).
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-naver-basics`
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/src/lib/naverIntegration.ts`],
}, null, 2))
rmSync(OUT, { recursive: true, force: true })
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) }
catch (e) { console.log('❌ 컴파일 실패'); console.log(e.stdout?.toString() ?? ''); process.exit(1) }
if (!existsSync(`${OUT}/lib/naverIntegration.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require = Module.createRequire(`${ROOT}/package.json`)
const { numOf, wonOfJoEok, parseNaverBasics } = require(`${OUT}/lib/naverIntegration.js`)

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', Referer: 'https://m.stock.naver.com/' }
const B = 'https://investment-school-2026.vercel.app'

// ── 순수 규칙 ──
check('숫자 풀기 — "12.25배"·"22,292원"·"0.61%"·"-1,234원"', numOf('12.25배') === 12.25 && numOf('22,292원') === 22292 && numOf('0.61%') === 0.61 && numOf('-1,234원') === -1234)
check('숫자가 없으면 null("N/A"·"-"·빈 값) — 0 으로 만들지 않는다', numOf('N/A') === null && numOf('-') === null && numOf('') === null && numOf(undefined) === null)
check('시총 — "1,596조 341억" · "8,471억" · "2조"', wonOfJoEok('1,596조 341억') === 1596e12 + 341e8 && wonOfJoEok('8,471억') === 8471e8 && wonOfJoEok('2조') === 2e12)
check('시총에 조·억이 없으면 null(단위를 짐작하지 않는다)', wonOfJoEok('1,596,034') === null && wonOfJoEok('N/A') === null)
const SAMPLE = { totalInfos: [{ code: 'marketValue', value: '1,596조 341억' }, { code: 'highPriceOf52Weeks', value: '380,000' }, { code: 'lowPriceOf52Weeks', value: '86,500' }, { code: 'per', value: '12.25배' }, { code: 'eps', value: '22,292원' }, { code: 'pbr', value: '3.17배' }, { code: 'dividendYieldRatio', value: '0.61%' }, { code: 'dividend', value: '1,668원' }] }
const p = parseNaverBasics(SAMPLE)
check('표본(삼성전자 2026-10-01 실측 형식) 전 필드', p.per === 12.25 && p.eps === 22292 && p.pbr === 3.17 && p.dividendYield === 0.0061 && p.annualDividend === 1668 && p.marketCap === 1596e12 + 341e8 && p.high52w === 380000 && p.low52w === 86500)
const loss = parseNaverBasics({ totalInfos: [{ code: 'per', value: 'N/A' }, { code: 'eps', value: '-1,234원' }, { code: 'dividendYieldRatio', value: 'N/A' }] })
check('적자 기업 — PER 은 null · EPS 는 음수 그대로(회생주 판정 재료) · 배당 null', loss.per === null && loss.eps === -1234 && loss.dividendYield === null)
check('응답이 없거나 모양이 다르면 전부 null', Object.values(parseNaverBasics(null)).every(v => v === null) && Object.values(parseNaverBasics({ totalInfos: 'x' })).every(v => v === null))

// ── 라이브: 네이버 integration 형식(주식 2 + ETF 1) ──
try {
  for (const [code, name, isEtf] of [['005930', '삼성전자', false], ['035420', 'NAVER', false], ['102110', 'TIGER 200', true]]) {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers: UA })
    const b = parseNaverBasics(r.ok ? await r.json() : null)
    const okHiLo = b.high52w != null && b.low52w != null && b.high52w > b.low52w
    if (isEtf) check(`네이버 ${name}(ETF) — 52주 최고 > 최저(${b.high52w} > ${b.low52w})`, okHiLo)
    else check(`네이버 ${name} — PER ${b.per} · EPS ${b.eps} · 시총 ${b.marketCap ? Math.round(b.marketCap / 1e12) + '조' : null} · 52주 ${b.low52w}~${b.high52w}`, b.per != null && b.eps != null && b.marketCap != null && b.marketCap > 1e12 && okHiLo)
  }
} catch (e) { fail++; console.log(`❌ 네이버 integration 호출 실패 — ${e.message}`) }

// ── 라이브: 프로덕션 두 표면이 같은 값(국내) ──
try {
  const [sp, si] = await Promise.all([
    fetch(`${B}/api/stock-price?ticker=005930&market=KR`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()),
    fetch(`${B}/api/stock-info?ticker=005930&market=KR`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()),
  ])
  const a = sp?.fundamentals ?? {}, c = si?.fundamentals ?? {}
  check(`프로덕션 주가 라우트 삼성전자 — PER ${a.pe} · 시총 ${a.marketCap ? Math.round(a.marketCap / 1e12) + '조' : null} · 배당 ${a.dividendYield} · 52주 ${a.low52w}~${a.high52w}`,
    typeof a.pe === 'number' && a.pe > 0 && typeof a.marketCap === 'number' && a.marketCap > 1e14 && typeof a.dividendYield === 'number' && a.high52w > a.low52w)
  check(`두 표면 52주 최고·최저 일치(${a.high52w}/${a.low52w} = ${c.high52w}/${c.low52w})`, a.high52w === c.high52w && a.low52w === c.low52w)
  check(`두 표면 시가총액 1% 안에서 일치(${a.marketCap} vs ${c.marketCap})`, typeof c.marketCap === 'number' && Math.abs(a.marketCap - c.marketCap) / c.marketCap < 0.01)
  check(`두 표면 배당수익률 0.1%p 안에서 일치(${a.dividendYield} vs ${c.dividendYield})`, typeof c.dividendYield === 'number' && Math.abs(a.dividendYield - c.dividendYield) < 0.001)
  // 2026-10-01 — 종목 정보의 국내 PER 이 '작년 말 주가' 기준(재무제표 행)이었다. 이제 두 표면·네이버 화면이 같은 최근 4분기 기준이어야 한다
  check(`종목 정보 PER 기준 = 최근 4분기(peBasis ${c.peBasis})`, c.peBasis === 'ttm')
  check(`두 표면 PER 3% 안에서 일치(${a.pe} vs ${c.pe})`, typeof c.pe === 'number' && typeof a.pe === 'number' && Math.abs(a.pe - c.pe) / c.pe < 0.03)
  const nv = parseNaverBasics(await fetch('https://m.stock.naver.com/api/stock/005930/integration', { headers: UA }).then(r => r.json()))
  check(`종목 정보 PER = 네이버 화면 PER 3% 안(${c.pe} vs ${nv.per})`, nv.per != null && Math.abs(c.pe - nv.per) / nv.per < 0.03)
  check(`PEG = PER ÷ 성장률(${c.peg} = ${c.pe} ÷ ${c.earningsGrowth != null ? (c.earningsGrowth * 100).toFixed(1) : null})`, typeof c.peg !== 'number' || (c.earningsGrowth > 0 && Math.abs(c.peg - c.pe / (c.earningsGrowth * 100)) < 0.02))
} catch (e) { fail++; console.log(`❌ 프로덕션 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (국내 기본 지표)')
process.exitCode = fail ? 1 : 0
