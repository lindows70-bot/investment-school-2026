// 🔒 공용 lib 단위 불변식(2026-10-19 8차 점검) — 6·7차에서 새로 만든 공용 fetcher·규칙표가 '글자만 같은 복제'가 아니라 **같은 결과**를 내는지.
//   실제 lib 를 컴파일해 부른다(재구현 금지 — CLAUDE.md lib 단위검증 레시피). 네트워크는 쓰지 않는다(순수 함수만).
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-shared-libs`
const LIBS = ['googleNews', 'upbit', 'assetRoleRules', 'classifyAsset', 'assetClassifier', 'chunkReload', 'fred', 'kst', 'studentCharts']

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
const SC = require(`${OUT}/lib/studentCharts.js`)

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

// ── 학생 차트 자료 고르기(내 종목 차트 · 코인 차트 · 2026-11-14) ──
{
  const D = 86_400_000, t0 = Date.parse('2026-01-05T00:00:00+09:00')
  const line = n => Array.from({ length: n }, (_, i) => ({ t: t0 + i * D, v: 100 + i }))
  const week = n => Array.from({ length: n }, (_, i) => ({ t: t0 + i * 7 * D, v: 100 + i }))
  const ohlcDay = n => Array.from({ length: n }, (_, i) => ({ date: new Date(t0 + 9 * 3600_000 + i * D).toISOString().slice(0, 10), open: 1, high: 1, low: 1, close: 200 + i, volume: 0 }))
  const ohlcWeek = n => Array.from({ length: n }, (_, i) => ({ date: new Date(t0 + 9 * 3600_000 + i * 7 * D).toISOString().slice(0, 10), close: 300 + i }))
  const stock = { charts: { '1D': line(60), '1W': week(60), '1M': line(60) }, ohlcCharts: {} }
  const coin = { charts: { '1D': line(24), '1W': line(7), '1M': line(30), '1Y': [] }, ohlcCharts: { '1M': ohlcDay(90), '1Y': ohlcWeek(52) } }
  check('차트: 주식 3개월 = 일봉 60 · 1년 = 주봉 최근 53점(52주) · 5년 = 월봉 60', SC.holdingSeries('US', stock, '3M').pts.length === 60 && SC.holdingSeries('KR', stock, '1Y').pts.length === 53 && SC.holdingSeries('KR', stock, '1Y').pts[52].v === 159 && SC.holdingSeries('US', stock, '5Y').pts.length === 60)
  const c5 = SC.holdingSeries('CRYPTO', coin, '5Y')
  check('차트: 코인 보유 3개월 = 캔들 일봉 90 · 1년 = 주봉 52 · 5년은 1년 자료 + 그렇다는 한마디', SC.holdingSeries('CRYPTO', coin, '3M').pts.length === 90 && SC.holdingSeries('CRYPTO', coin, '1Y').note === null && c5.pts.length === 52 && /1년까지/.test(c5.note ?? ''))
  check('차트: 코인 5기간 = 시간봉 24 · 일봉 7 · 일봉 30 · 캔들 90 · 캔들 52', ['1D', '1W', '1M', '3M', '1Y'].map(r => SC.coinSeries(coin, r).length).join(',') === '24,7,30,90,52')
  const flat = { charts: { '1D': Array.from({ length: 24 }, (_, i) => ({ t: t0 + i * 3600_000, v: 5 })) }, ohlcCharts: {} }
  check('차트: 코인 직선(조회 실패 때 API 가 채운 현재가)은 버린다 · 주식은 평평해도 둔다', SC.coinSeries(flat, '1D').length === 0 && SC.cleanLine(flat.charts['1D'], false).length === 24)
  const wk = SC.ohlcToLine(ohlcWeek(3), 7, t0 + 16 * D)
  check('차트: 주봉은 봉의 끝날에 놓고 진행 중인 마지막 봉은 지금을 넘지 않는다', wk[0].t === t0 + 6 * D && wk[1].t === t0 + 13 * D && wk[2].t === t0 + 16 * D)
  check('차트: 캔들 날짜는 한국 자정 · 못 읽는 행은 버린다', SC.ohlcToLine([{ date: '2026-01-05', close: 10 }, { date: 'x', close: 11 }, { date: '2026-01-06', close: 0 }, { date: '2026-01-07', close: 12 }])[0].t === t0 && SC.ohlcToLine([{ date: '2026-01-05', close: 10 }, { date: 'x', close: 11 }, { date: '2026-01-07', close: 12 }]).length === 2)
  check('차트: 기간 등락 = 첫 점 대비 마지막 점 · 점이 하나면 null(0% 로 꾸미지 않는다)', Math.abs(SC.periodChangePct([{ t: 1, v: 100 }, { t: 2, v: 80 }, { t: 3, v: 125 }]) - 25) < 1e-9 && SC.periodChangePct([{ t: 1, v: 100 }]) === null)
  check('차트: 간격 이름 — 일봉 7개 = 7일 · 일봉 60 = 2개월 · 주봉 53 = 12개월 · 월 간격 60 = 5년', SC.spanLabel(line(7)) === '최근 7일' && SC.spanLabel(line(60)) === '최근 2개월' && SC.spanLabel(week(53)) === '최근 12개월' && SC.spanLabel(Array.from({ length: 60 }, (_, i) => ({ t: t0 + i * 30.44 * D, v: 1 + i }))) === '최근 5년')
  check('차트: 평단 선은 최저의 절반~최고의 두 배 안일 때만(밖이면 선 하나가 흐름을 납작하게 만든다)', SC.avgInRange(120, line(60)) && SC.avgInRange(50, line(60)) && !SC.avgInRange(49, line(60)) && !SC.avgInRange(400, line(60)) && !SC.avgInRange(null, line(60)) && !SC.avgInRange(0, line(60)))
  const hl = SC.highLow([{ t: 1, v: 5 }, { t: 2, v: 9 }, { t: 3, v: 2 }, { t: 4, v: 9 }])
  check('차트: 최고·최저 점(같은 값이면 먼저 나온 점) · 평평하면 null', hl.hi.t === 2 && hl.lo.t === 3 && SC.highLow([{ t: 1, v: 5 }, { t: 2, v: 5 }]) === null)
  check('차트: 자료가 없으면 빈 선(지어내지 않는다)', SC.holdingSeries('US', null, '1Y').pts.length === 0 && SC.coinSeries(undefined, '3M').length === 0 && SC.holdingSeries('CRYPTO', { charts: {}, ohlcCharts: {} }, '3M').pts.length === 0)
}
if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (공용 lib 단위)')
