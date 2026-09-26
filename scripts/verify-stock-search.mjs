// 종목 검색 파서 검증 — 네이버 자동완성·업비트 목록 실측 모양으로 필터·별칭·병합을 확인
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'

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

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-search.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
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
// 실측(2026-09-26): 옛 브랜드는 네이버가 더 이상 안 돌려준다 → 현재 이름으로
check('별칭: 킨덱스 → ACE (옛 KINDEX)', S.expandQuery('킨덱스 미국') === 'ACE 미국')
check('별칭: 케이비스타 → RISE (옛 KBSTAR)', S.expandQuery('케이비스타200') === 'RISE200')
check('별칭: 아리랑 → PLUS (옛 ARIRANG)', S.expandQuery('아리랑 고배당') === 'PLUS 고배당')

// 별칭이 일반 종목과 겹친다(에이스침대→ACE침대) → 원문 결과를 먼저, 별칭 결과를 뒤에, 중복 제거
const aceBed = { ticker: '003800', name: '에이스침대', market: 'KR', currency: 'KRW', exchange: '코스닥' }
const aceEtf = { ticker: '360200', name: 'ACE 미국S&P500', market: 'KR', currency: 'KRW', exchange: '코스피' }
const ms = S.mergeStockLists([aceBed, aceEtf], [aceEtf, { ...aceBed }])
check('mergeStockLists: 원문 결과 먼저 + market:ticker 중복 제거', ms.length === 2 && ms[0].ticker === '003800' && ms[1].ticker === '360200')
const ms2 = S.mergeStockLists([], [aceEtf])
check('mergeStockLists: 원문이 비면 별칭 결과만', ms2.length === 1 && ms2[0].ticker === '360200')
check('mergeStockLists: 같은 티커라도 시장이 다르면 둘 다', S.mergeStockLists([aceEtf], [{ ...aceEtf, market: 'US' }]).length === 2)

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
// 실측: "비트" → 네이버가 주식 10개로 상한을 채워 비트코인이 사라짐 → 코인 자리 최대 3개 예약
check('병합: 개수 상한(코인 자리 보장 — 주식2+코인1을 2로 제한하면 주식1+코인1)', (() => {
  const limited = S.mergeResults(st, cr, 2)
  return limited.length === 2 && limited[0].market !== 'CRYPTO' && limited[1].market === 'CRYPTO'
})())

const tenStocks = Array.from({ length: 10 }, (_, i) => ({
  ticker: String(i).padStart(6, '0'), name: `종목${i}`, market: 'KR', currency: 'KRW', exchange: '코스피',
}))
const btcOnly = [{ ticker: 'BTC', name: '비트코인', market: 'CRYPTO', currency: 'KRW', exchange: '업비트' }]
const capped = S.mergeResults(tenStocks, btcOnly, 10)
check('병합: 주식 10개도 코인 1개는 끝에 남긴다', capped.length === 10 && capped[9].ticker === 'BTC')

const fiveCrypto = Array.from({ length: 5 }, (_, i) => ({
  ticker: `C${i}`, name: `코인${i}`, market: 'CRYPTO', currency: 'KRW', exchange: '업비트',
}))
const few = S.mergeResults(st, fiveCrypto, 10)
check('병합: 주식이 모자라면 코인이 남은 자리를 채운다', few.length === 7)

// 실측: 업비트 마켓 목록은 관련도·거래량 순이 아니라 임의 순서(KRW-BTC 가 289개 중 268번째) — 24h 거래대금으로 재정렬해야 한다
const bch = { ticker: 'BCH', name: '비트코인캐시', market: 'CRYPTO', currency: 'KRW', exchange: '업비트' }
const arb = { ticker: 'ARB', name: '아비트럼', market: 'CRYPTO', currency: 'KRW', exchange: '업비트' }
const tao = { ticker: 'TAO', name: '비트텐서', market: 'CRYPTO', currency: 'KRW', exchange: '업비트' }
const btc = { ticker: 'BTC', name: '비트코인', market: 'CRYPTO', currency: 'KRW', exchange: '업비트' }
const cryptoInput = [bch, arb, tao, btc]
const volumes = { BTC: 5e11, BCH: 1e10, TAO: 3e9, ARB: 2e10 }
const ranked = S.rankCrypto(cryptoInput, '비트', volumes)
check('rankCrypto: 앞글자 일치 우선 + 거래대금 내림차순 (ARB는 포함만 돼서 꼴찌)', ranked.map(r => r.ticker).join(',') === 'BTC,BCH,TAO,ARB')

const rankedNoVolume = S.rankCrypto(cryptoInput, '비트', {})
const arbIdxNoVol = rankedNoVolume.findIndex(r => r.ticker === 'ARB')
check('rankCrypto: 거래량 없어도 앞글자 일치 그룹이 ARB보다 앞', arbIdxNoVol === rankedNoVolume.length - 1)
check('rankCrypto: 거래량 없으면 짧은 이름이 앞(비트코인캐시=6자 는 맨 뒤 앞글자 그룹)', rankedNoVolume.findIndex(r => r.ticker === 'BCH') === 2)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (종목 이름 검색)')
process.exit(fail ? 1 : 0)
