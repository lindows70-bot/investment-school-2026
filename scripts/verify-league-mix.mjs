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
check('구성: 한국 상장 ETF 20%', near(labels['한국 상장 ETF'], 20))
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
check('구성: SPY → 미국 상장 ETF(키 US_ETF)', etfUs.mix[0]?.label === '미국 상장 ETF' && etfUs.mix[0]?.key === 'US_ETF')
// 상장 국가 기준(문서화된 선택): KR 상장 해외 ETF 는 한국 ETF
const krUsEtf = M.buildLeagueMix([{ ticker: '360750', name: 'TIGER 미국S&P500', market: 'KR', value: 10, priced: true }])
check('구성: TIGER 미국S&P500 → 한국 상장 ETF(키 KR_ETF · 담은 자산 국적 아님)', krUsEtf.mix[0]?.label === '한국 상장 ETF' && krUsEtf.mix[0]?.key === 'KR_ETF')
const foreignEtf = M.buildLeagueMix([{ ticker: 'VUSA.L', name: 'Vanguard S&P 500 UCITS ETF', market: 'US', value: 10, priced: true }])
check('구성: 런던 상장 ETF → 기타 국가 상장 ETF(키 OTHER_ETF)', foreignEtf.mix[0]?.label === '기타 국가 상장 ETF' && foreignEtf.mix[0]?.key === 'OTHER_ETF')
check('구성: ETF 라벨은 전부 "상장 ETF"(자산 국적 주장 없음)', [r1, etfUs, krUsEtf, foreignEtf].every(r => r.mix.every(m => !m.key.endsWith('_ETF') || m.label.endsWith('상장 ETF'))))

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

// ⑥ 구성 나머지 비율(mixOtherPct) — 보여준 묶음 + 나머지 = 100
const mixSum = r => r.mix.reduce((s, m) => s + m.weightPct, 0) + r.mixOtherPct
check('mixOtherPct: r1 묶음 5종 중 3종 표시 → 나머지 15%', near(r1.mixOtherPct, 15) && near(mixSum(r1), 100))
check('mixOtherPct: full 묶음 4종 중 3종 → 나머지 10%(미국 상장 ETF)', full.mix.length === 3 && near(full.mixOtherPct, 10) && near(mixSum(full), 100))
check('mixOtherPct: 묶음 1개 → 0', etfUs.mixOtherPct === 0)
check('mixOtherPct: 합계 0 → 0', z.mixOtherPct === 0 && e.mixOtherPct === 0)
check('mixOtherPct: 1/7 × 7(한 묶음) → 0', seven.mixOtherPct === 0)

// ⑦ pricedAll 은 실제로 합친 행만 — 티커 없는 행(합치기에서 빠짐)은 시세 판정에 안 들어간다
const noTicker = M.buildLeagueMix([
  { ticker: 'AAPL', name: '애플', market: 'US', value: 100, priced: true },
  { ticker: '  ', name: '빈 티커', market: 'US', value: 50, priced: false },
])
check('pricedAll: 티커 없는 행의 시세 없음은 무시', noTicker.pricedAll === true && noTicker.topHoldings.length === 1)

// ⑧ 노출 최소 — 1~3위 + 본인만
const S = (userId, totalReturn, isRegistered = true) => ({ userId, totalReturn, isRegistered })
const roster = [
  S('a', 5.0), S('b', 12.3), S('c', null), S('d', -2.0), S('e', 8.1), S('f', 8.1), S('g', null, false), S('h', 20.0),
]
const ids1 = M.detailIds(roster, 'd')
check('detailIds: 1~3위(h 20.0 · b 12.3 · e 8.1) + 본인 d', [...ids1].sort().join(',') === 'b,d,e,h')
check('detailIds: 경계 동률(e·f 8.1) → 입력 순서 앞(e)만 · 정확히 3명', ids1.has('e') && !ids1.has('f'))
check('detailIds: 수익률 null 은 순위 밖', !ids1.has('c'))
check('detailIds: 본인이 이미 3위 안 → 3명', M.detailIds(roster, 'b').size === 3)
check('detailIds: 본인이 명단에 없음 → 1~3위만', M.detailIds(roster, 'zzz').size === 3 && !M.detailIds(roster, 'zzz').has('zzz'))
check('detailIds: 본인 null → 1~3위만', M.detailIds(roster, null).size === 3)
check('detailIds: 순위 가능 2명뿐 → 2명', M.detailIds([S('x', 1), S('y', null), S('z', 3)], null).size === 2)
const odd = M.detailIds([S('x', NaN), S('y', Infinity), S('z', 1)], null)
check('detailIds: NaN/Infinity 는 순위 밖', !odd.has('x') && !odd.has('y') && odd.has('z'))
const em = M.emptyLeagueDetail()
check('emptyLeagueDetail: 빈 값 + detail false', em.topHoldings.length === 0 && em.mix.length === 0 && em.otherPct === 0 && em.otherCount === 0 && em.mixOtherPct === 0 && em.pricedAll === true && em.detail === false)
check('emptyLeagueDetail: 매번 새 배열(공유 참조 없음)', M.emptyLeagueDetail().mix !== M.emptyLeagueDetail().mix)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (리그 구성 비중)')
process.exit(fail ? 1 : 0)
