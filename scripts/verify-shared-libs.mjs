// 🔒 공용 lib 단위 불변식(2026-10-19 8차 점검) — 6·7차에서 새로 만든 공용 fetcher·규칙표가 '글자만 같은 복제'가 아니라 **같은 결과**를 내는지.
//   실제 lib 를 컴파일해 부른다(재구현 금지 — CLAUDE.md lib 단위검증 레시피). 네트워크는 쓰지 않는다(순수 함수만).
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-shared-libs`
const LIBS = ['googleNews', 'upbit', 'assetRoleRules', 'classifyAsset', 'assetClassifier', 'chunkReload', 'fred', 'kst']

writeFileSync(`${ROOT}/.bt-shared-libs.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/next-env.d.ts`, ...LIBS.map(l => `${ROOT}/src/lib/${l}.ts`)],
}, null, 2))
rmSync(OUT, { recursive: true, force: true })
try { execSync(`npx tsc -p "${ROOT}/.bt-shared-libs.tsconfig.json"`, { stdio: 'pipe' }) }
catch (e) { console.log(e.stdout?.toString() ?? ''); console.log(e.stderr?.toString() ?? ''); process.exit(1) }
for (const l of LIBS) if (!existsSync(`${OUT}/lib/${l}.js`)) { console.log(`❌ 컴파일 결과 없음: ${l}`); process.exit(1) }

const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = Module.createRequire(import.meta.url)
const GN = require(`${OUT}/lib/googleNews.js`)
const UP = require(`${OUT}/lib/upbit.js`)
const RR = require(`${OUT}/lib/assetRoleRules.js`)
const CA = require(`${OUT}/lib/classifyAsset.js`)
const CR = require(`${OUT}/lib/chunkReload.js`)
const FR = require(`${OUT}/lib/fred.js`)
const KST = require(`${OUT}/lib/kst.js`)

let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++ }

// ── 구글 뉴스 RSS 파서 — CDATA·일반 제목 · 링크 http 만 · pubDate → YYYY-MM-DD · 매체 · take ──
const xml = `<?xml version="1.0"?><rss><channel><title>"삼성전자" - Google 뉴스</title>
<item><title><![CDATA[삼성전자 3분기 실적 &amp; 전망 - 한국경제]]></title><link>https://news.google.com/rss/articles/abc</link><pubDate>Thu, 16 Oct 2026 23:10:00 GMT</pubDate><source url="https://hankyung.com">한국경제</source></item>
<item><title>두번째 기사</title><link>javascript:void(0)</link><pubDate>not a date</pubDate></item>
<item><title></title><link>https://x</link></item>
<item><title>세번째</title><link>https://news.google.com/3</link><pubDate>Fri, 17 Oct 2026 01:00:00 GMT</pubDate></item>
</channel></rss>`
const items = GN.parseGoogleNewsXml(xml)
check('RSS: 제목 없는 항목은 빼고 3건 · 채널 제목(피드 제목)은 항목이 아니다', items.length === 3 && items.every(i => !/Google 뉴스/.test(i.title)))
check('RSS: CDATA 제목 + &amp; 디코드 · 링크 · 날짜(UTC) · 매체', items[0].title === '삼성전자 3분기 실적 & 전망 - 한국경제' && items[0].link === 'https://news.google.com/rss/articles/abc' && items[0].date === '2026-10-16' && items[0].source === '한국경제')
check('RSS: http(s) 아닌 링크는 null · 못 읽는 날짜는 null(지어내지 않는다)', items[1].link === null && items[1].date === null)
check('RSS: take 로 앞에서 자른다', GN.parseGoogleNewsXml(xml, 1).length === 1)

// ── 업비트 마켓 코드 ──
check('업비트: XRP → KRW-XRP · krw-btc → KRW-BTC(이미 KRW- 면 그대로)', UP.upbitMarketOf('xrp') === 'KRW-XRP' && UP.upbitMarketOf('KRW-BTC') === 'KRW-BTC')

// ── 역할 규칙표 + 2분류 ↔ 5분류 접힘 일치(표본) ──
const samples = [
  ['SPY', 'SPDR S&P 500 ETF Trust', 'US', 'CORE'], ['QQQ', 'Invesco QQQ Trust', 'US', 'CORE'], ['TLT', 'iShares 20+ Year Treasury Bond ETF', 'US', 'CORE'],
  ['GLD', 'SPDR Gold Shares', 'US', 'SATELLITE'], ['PSLV', 'Sprott Physical Silver Trust', 'US', 'SATELLITE'], ['SOXL', 'Direxion Daily Semiconductor Bull 3X', 'US', 'SATELLITE'],
  ['NVDA', 'NVIDIA', 'US', 'SATELLITE'], ['GS', 'Goldman Sachs', 'US', 'SATELLITE'], ['BTC', '비트코인', 'CRYPTO', 'SATELLITE'],
  ['069500', 'KODEX 200', 'KR', 'CORE'], ['360750', 'TIGER 미국S&P500', 'KR', 'CORE'], ['148070', 'KOSEF 국고채10년', 'KR', 'CORE'],
  ['005930', '삼성전자', 'KR', 'SATELLITE'], ['091160', 'KODEX 반도체', 'KR', 'SATELLITE'],
]
for (const [t, n, m, want] of samples) check(`역할 2분류: ${n}(${t}) = ${want}`, CA.classifyAsset(t, n, m) === want, `got ${CA.classifyAsset(t, n, m)}`)
// ⚠️ isCommodityLike 는 이름 글자('GOLD')로 보므로 골드만삭스도 참이다 — 규칙표는 **ETF 에만** 적용되고(위 표본에서 GS 는 STOCK → 새틀라이트), 그래서 주식엔 닿지 않는다
check('규칙표: 레버리지(SOXL·곱버스) · 채권(TLT·국고채) · 광의지수(SPY·KODEX 200) · 원자재(GOLD)', RR.isLeverage('SOXL', '') && RR.isLeverage('X', 'KODEX 200 곱버스') && RR.isBond('TLT', '') && RR.isBond('X', 'TIGER 국고채30년') && RR.isBroadIndex('SPY', '') && RR.isBroadIndex('X', 'KODEX 200') && RR.isCommodityLike('X', 'SPDR Gold Shares'))

// ── ChunkLoadError 판별 ──
check('청크 오류 판별: ChunkLoadError · Loading chunk 123 failed · 동적 import 실패 = 참 · 일반 TypeError = 거짓',
  CR.isChunkLoadError({ name: 'ChunkLoadError', message: 'x' }) && CR.isChunkLoadError(new Error('Loading chunk 4bd1 failed.')) && CR.isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/a.js')) && !CR.isChunkLoadError(new TypeError('x is not a function')))

// ── FRED URL 직렬화 ──
const u = FR.buildFredUrl('CPIAUCSL', 'KEY', { sort_order: 'desc', limit: 14, units: undefined, observation_start: '' }, '&units=pc1')
check('FRED URL: series·key·json 기본 + 정의된 파라미터만 + extra 조각 그대로', u.startsWith('https://api.stlouisfed.org/fred/series/observations?') && /series_id=CPIAUCSL/.test(u) && /api_key=KEY/.test(u) && /file_type=json/.test(u) && /sort_order=desc/.test(u) && /limit=14/.test(u) && !/units=&|observation_start=/.test(u) && u.endsWith('&units=pc1'))

// ── KST 달력일 ──
check('KST: UTC 2026-10-18 15:30 = 한국 10-19 · UTC 14:59 = 10-18', KST.kstDate(new Date('2026-10-18T15:30:00Z')) === '2026-10-19' && KST.kstDate(new Date('2026-10-18T14:59:00Z')) === '2026-10-18' && KST.kstMonth(new Date('2026-10-31T16:00:00Z')) === '2026-11')

if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (공용 lib 단위)')
