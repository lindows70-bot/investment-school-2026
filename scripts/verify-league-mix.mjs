// 스쿨 리그 상위 3종목 비중·구성 검증 — 티커 합치기·상위3+기타=100·빈 포트·시세 없음 표시·묶음 라벨
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-league-mix`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT,
    module: 'commonjs',
    moduleResolution: 'node',
    noEmit: false,
    declaration: false,
    incremental: false,
    noEmitOnError: true,
    target: 'es2020',
    rootDir: `${ROOT}/src`,
  },
  include: [
    `${ROOT}/src/lib/leagueMix.ts`,
    `${ROOT}/src/lib/assetClassifier.ts`,
    `${ROOT}/src/lib/marketFlag.ts`,
  ],
}
writeFileSync(`${ROOT}/.bt-league-mix.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 실패해도 옛 .js 로 거짓 green
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-league-mix.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/leagueMix.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/' 별칭 → 컴파일 결과(실제 lib 을 그대로 실행)
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, join(OUT, req.slice(2)), ...rest)
  return orig.call(this, req, ...rest)
}
const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/leagueMix.js`)

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}
const near = (a, b, eps = 0.1) => Math.abs(a - b) <= eps + 1e-9
const sumTop = r => r.topHoldings.reduce((s, h) => s + h.weightPct, 0) + r.otherPct

// ① 티커 합치기 — 분할매수 2행(소문자 섞임)이 한 종목
const r1 = M.buildLeagueMix([
  { ticker: '005930', name: '삼성전자', market: 'KR', value: 300, priced: true },
  { ticker: 'aapl',   name: '애플',     market: 'US', value: 100, priced: true },
  { ticker: 'AAPL',   name: '애플',     market: 'US', value: 250, priced: true },
  { ticker: '069500', name: 'KODEX 200', market: 'KR', value: 200, priced: true },
  { ticker: 'KRW-BTC', name: '비트코인', market: 'CRYPTO', value: 100, priced: true },
  { ticker: 'GLD',    name: 'SPDR Gold Shares', market: 'US', value: 50, priced: true },
])
check('합치기: AAPL 2행 → 1종목(350 → 1위)', r1.topHoldings[0].ticker === 'AAPL' && near(r1.topHoldings[0].weightPct, 35))
check('합치기: 티커는 대문자', r1.topHoldings.every(h => h.ticker === h.ticker.toUpperCase()))
check('상위 3 = AAPL·삼성전자·KODEX 200', r1.topHoldings.map(h => h.ticker).join(',') === 'AAPL,005930,069500')
check('상위 3 + 기타 = 100(±0.1)', near(sumTop(r1), 100))
check('기타 종목 수 = 2(합친 뒤 5종 − 3)', r1.otherCount === 2)
check('기타 비중 = 15%', near(r1.otherPct, 15))
check('market 정규화(KR/US/CRYPTO)', r1.topHoldings[0].market === 'US' && r1.topHoldings[1].market === 'KR')
check('assetType: KODEX 200 = ETF', r1.topHoldings[2].assetType === 'ETF')
check('assetType: 삼성전자 = STOCK', r1.topHoldings[1].assetType === 'STOCK')
check('응답에 금액 필드 없음(value 누출 없음)', r1.topHoldings.every(h => !('value' in h)) && r1.mix.every(m => !('value' in m)))

// ⑤ 구성 묶음 라벨
const labels = Object.fromEntries(r1.mix.map(m => [m.label, m.weightPct]))
check('구성: 상위 3개만', r1.mix.length === 3)
check('구성: 내림차순', r1.mix.every((m, i, a) => i === 0 || a[i - 1].weightPct >= m.weightPct))
check('구성: 미국 주식 35%', near(labels['미국 주식'], 35))
check('구성: 한국 주식 30%', near(labels['한국 주식'], 30))
check('구성: 한국 ETF 20%', near(labels['한국 ETF'], 20))
const full = M.buildLeagueMix([
  { ticker: 'KRW-BTC', name: '비트코인', market: 'CRYPTO', value: 40, priced: true },
  { ticker: 'GLD', name: 'SPDR Gold Shares', market: 'US', value: 30, priced: true },
  { ticker: '7203.T', name: '도요타', market: 'US', value: 20, priced: true },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US', value: 10, priced: true },
])
const fl = full.mix.map(m => m.label)
check('구성: 코인 라벨', fl[0] === '코인' && full.mix[0].key === 'CRYPTO')
check('구성: 원자재 라벨(GLD)', fl[1] === '원자재')
check('구성: 일본 접미사(.T) → 기타 국가 주식', fl[2] === '기타 국가 주식')
const etfUs = M.buildLeagueMix([{ ticker: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US', value: 10, priced: true }])
check('구성: SPY → 미국 ETF', etfUs.mix[0]?.label === '미국 ETF' && etfUs.mix[0]?.key === 'US_ETF')
// 상장 국가 기준(문서화된 선택): KR 상장 해외 ETF 는 한국 ETF
const krUsEtf = M.buildLeagueMix([{ ticker: '360750', name: 'TIGER 미국S&P500', market: 'KR', value: 10, priced: true }])
check('구성: TIGER 미국S&P500 → 한국 ETF(상장 국가 기준)', krUsEtf.mix[0]?.label === '한국 ETF')

// ③ 합계 0 → 빈 배열
const z = M.buildLeagueMix([{ ticker: 'AAPL', name: '애플', market: 'US', value: 0, priced: true }])
check('합계 0 → topHoldings·mix 빈 배열, other 0', z.topHoldings.length === 0 && z.mix.length === 0 && z.otherPct === 0 && z.otherCount === 0)
const e = M.buildLeagueMix([])
check('보유 0행 → 빈 배열 · pricedAll true', e.topHoldings.length === 0 && e.mix.length === 0 && e.pricedAll === true)

// ④ 시세 없음 표시
const u = M.buildLeagueMix([
  { ticker: 'AAPL', name: '애플', market: 'US', value: 100, priced: true },
  { ticker: 'AAPL', name: '애플', market: 'US', value: 100, priced: false },
  { ticker: '005930', name: '삼성전자', market: 'KR', value: 50, priced: true },
])
check('시세 없음: pricedAll false', u.pricedAll === false)
check('시세 없음: 합친 종목도 priced false', u.topHoldings.find(h => h.ticker === 'AAPL')?.priced === false)
check('시세 없음: 다른 종목은 priced true', u.topHoldings.find(h => h.ticker === '005930')?.priced === true)
check('종목 3개 이하 → 기타 0 · 0종', u.otherPct === 0 && u.otherCount === 0 && near(sumTop(u), 100))
check('전부 시세 있음 → pricedAll true', r1.pricedAll === true)

// 반올림이 흩어지는 경우(1/7씩)도 합 100±0.1
const seven = M.buildLeagueMix(Array.from({ length: 7 }, (_, i) => ({ ticker: `T${i}`, name: `T${i}`, market: 'US', value: 1, priced: true })))
check('1/7 × 7: 상위3 + 기타 = 100(±0.1)', near(sumTop(seven), 100) && seven.otherCount === 4)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (리그 구성 비중)')
process.exit(fail ? 1 : 0)
