// 종목 검색 파서 검증 — 네이버 자동완성·업비트 목록 실측 모양으로 필터·별칭·병합을 확인
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-search`

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
  include: [`${ROOT}/src/lib/stockSearch.ts`],
}
writeFileSync(`${ROOT}/.bt-search.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

try {
  execSync(`npx tsc -p "${ROOT}/.bt-search.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
}

if (!existsSync(`${OUT}/lib/stockSearch.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/x' 를 컴파일된 ${OUT}/x 로 잇는 리졸버 (이 lib은 '@/' import가 없어 실제로는 안 쓰인다)
const Module = await import('node:module')
const origResolve = Module.default._resolveFilename
Module.default._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = `${OUT}/${request.slice(2)}`
  }
  return origResolve.call(this, request, ...rest)
}

const { createRequire } = Module.default
const require = createRequire(import.meta.url)
const S = require(`${OUT}/lib/stockSearch.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

check('별칭: 타이거 미국 → TIGER 미국', S.expandQuery('타이거 미국') === 'TIGER 미국')
check('별칭: 코덱스200 → KODEX200', S.expandQuery('코덱스200') === 'KODEX200')
check('별칭 없는 말은 그대로', S.expandQuery('삼성') === '삼성')

const naver = [
  { code: '005930', name: '삼성전자', typeCode: 'KOSPI', typeName: '코스피', nationCode: 'KOR', category: 'stock' },
  { code: 'NVDA', name: '엔비디아', typeCode: 'NASDAQ', typeName: '나스닥 증권거래소', nationCode: 'USA', category: 'stock' },
  { code: '4231', name: '타이거스폴리머', typeCode: 'TOKYO', typeName: '도쿄', nationCode: 'JPN', category: 'stock' },
]
const st = S.parseNaverItems(naver)
check('네이버: 한국·미국만 남김', st.length === 2 && st.every(r => r.market === 'KR' || r.market === 'US'))
check('네이버: KR 은 6자리 코드·원화', st[0].ticker === '005930' && st[0].currency === 'KRW' && st[0].exchange === '코스피')
check('네이버: US 는 달러', st[1].ticker === 'NVDA' && st[1].currency === 'USD')

const upbit = [
  { market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' },
  { market: 'BTC-ETH', korean_name: '이더리움', english_name: 'Ethereum' },
  { market: 'KRW-ETH', korean_name: '이더리움', english_name: 'Ethereum' },
]
const cr = S.matchUpbit(upbit, '비트')
check('업비트: 원화 마켓만 · 한글 이름 포함', cr.length === 1 && cr[0].ticker === 'BTC' && cr[0].market === 'CRYPTO' && cr[0].currency === 'KRW')
check('업비트: 영문·티커로도', S.matchUpbit(upbit, 'eth').length === 1 && S.matchUpbit(upbit, 'ETH')[0].ticker === 'ETH')
check('업비트: 빈 검색어 → 없음', S.matchUpbit(upbit, ' ').length === 0)

const m = S.mergeResults(st, cr, 10)
check('병합: 주식 먼저, 코인 뒤, 중복 없음', m.length === 3 && m[2].market === 'CRYPTO')
check('병합: 개수 상한', S.mergeResults(st, cr, 2).length === 2)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (종목 이름 검색)')
process.exit(fail ? 1 : 0)
