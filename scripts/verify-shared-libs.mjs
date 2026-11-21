// 🔒 공용 lib 단위 불변식(2026-10-19 8차 점검) — 6·7차에서 새로 만든 공용 fetcher·규칙표가 '글자만 같은 복제'가 아니라 **같은 결과**를 내는지.
//   실제 lib 를 컴파일해 부른다(재구현 금지 — CLAUDE.md lib 단위검증 레시피). 네트워크는 쓰지 않는다(순수 함수만).
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-shared-libs`
const LIBS = ['googleNews', 'upbit', 'assetRoleRules', 'classifyAsset', 'assetClassifier', 'chunkReload', 'fred', 'kst', 'studentCharts', 'capexCash', 'crisisSignal', 'usMargin', 'leverageLevel']

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
const CX = require(`${OUT}/lib/capexCash.js`)
const CS = require(`${OUT}/lib/crisisSignal.js`)
const UM = require(`${OUT}/lib/usMargin.js`)
const LV = require(`${OUT}/lib/leverageLevel.js`)

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

// ── 위기 신호등(2026-11-21) — 설비투자÷번 돈 순수 계산 · 등 7개 조립 · 종합 규칙 · 못 가져온 등은 초록이 아니다 ──
{
  const q = (date, ocfM, capexM) => ({ date, ocfM, capexM })
  // 2026-11-21 야후 실측값(백만 달러) — 수업 영상 EP55 화면의 10-Q 숫자와 같다(네 회사 115% · 1년 전 61%). 아마존은 2026-06 분기가 야후에 없다
  const real = [
    { ticker: 'AMZN', name: 'Amazon(AWS)', rows: [q('2025-06-30', 32515, 32183), q('2025-09-30', 35525, 35095), q('2025-12-31', 54459, 39522), q('2026-03-31', 26032, 44203), q('2026-09-30', 42422, 77259)] },
    { ticker: 'GOOGL', name: 'Alphabet', rows: [q('2026-09-30', 42290, 51355), q('2025-09-30', 48414, 23953), q('2026-06-30', 39069, 44924)] },   // 순서가 섞여 와도 날짜로 정렬한다
    { ticker: 'MSFT', name: 'Microsoft', rows: [q('2025-09-30', 45057, 19394), q('2026-09-30', 58000, 39367)] },
    { ticker: 'META', name: 'Meta', rows: [q('2025-09-30', 29999, 18829), q('2026-09-30', 32785, 33942)] },
  ]
  const four = CX.capexCashOf(real, '2026-11-21T00:00:00Z')
  const ratioOf = t => four.companies.find(c => c.ticker === t)?.ratioPct
  check('설비투자: 네 회사 합계 201,923 ÷ 175,497 = 115.1% · 1년 전 같은 분기 61.2%', four.capexM === 201923 && four.ocfM === 175497 && four.ratioPct === 115.1 && four.prev.ratioPct === 61.2 && four.prev.count === 4 && four.latestDate === '2026-09-30')
  check('설비투자: 회사별 — 아마존 182.1 · 알파벳 121.4 · 메타 103.5 · 마이크로소프트 67.9', ratioOf('AMZN') === 182.1 && ratioOf('GOOGL') === 121.4 && ratioOf('META') === 103.5 && ratioOf('MSFT') === 67.9)
  check('설비투자: 1년 전 분기는 날짜로 찾는다(분기가 빠져 있어도 2025-09-30) · 없으면 null', four.companies[0].prevDate === '2025-09-30' && CX.capexCashOf([{ ticker: 'A', name: 'A', rows: [q('2026-09-30', 100, 40), q('2026-06-30', 100, 30)] }]).prev === null)
  const withOrcl = CX.capexCashOf([...real, { ticker: 'ORCL', name: 'Oracle', rows: [q('2025-08-31', 8140, 8502), q('2026-08-31', 23103, 28499)] }, { ticker: 'OLD', name: 'Old', rows: [q('2026-03-31', 999, 1)] }])
  check('설비투자: 분기 끝이 한 달 다른 회사는 넣고(오라클 8월) · 넉 달 넘게 늦은 회사는 뺀다(전체 6 · 합계 5)', withOrcl.count === 5 && withOrcl.total === 6 && withOrcl.ratioPct === 116 && withOrcl.prev.ratioPct === 63.3 && withOrcl.prev.count === 5)
  check('설비투자: 자료 없음 = null · 번 돈 0 이하 회사는 비율을 세지 않는다 · 상식 밖 합계는 버린다(단위 사고)', CX.capexCashOf([]) === null && CX.capexCashOf([{ ticker: 'A', name: 'A', rows: [] }]) === null
    && CX.capexCashOf([{ ticker: 'A', name: 'A', rows: [q('2026-09-30', -5, 10)] }, { ticker: 'B', name: 'B', rows: [q('2026-09-30', 100, 30)] }]).companies[0].ratioPct === null
    && CX.capexCashOf([{ ticker: 'A', name: 'A', rows: [q('2026-09-30', 1, 1000)] }]) === null)

  // ── 빚 판정 SSOT · 미국 신용잔고(FINRA) — zip 풀기 · 시트 읽기 · 한국 빚투 레이더와 같은 잣대 ──
  check('빚 판정: 비율 80 자리↑ 위험 · 65 자리↑ 이면서 잔고 90 자리↑ 도 위험 · 60 자리↑ 주의 · 그 밖 안정', LV.leverageLevel(80, 0) === 'danger' && LV.leverageLevel(79, 0) === 'caution' && LV.leverageLevel(65, 90) === 'danger' && LV.leverageLevel(65, 89) === 'caution' && LV.leverageLevel(60, 0) === 'caution' && LV.leverageLevel(59, 100) === 'stable' && LV.percentileOf([1, 2, 3, 4], 2) === 50)
  const zlib = require('node:zlib')
  const mkZip = files => {
    const locals = [], centrals = []; let off = 0
    for (const f of files) {
      const name = Buffer.from(f.name), raw = Buffer.from(f.data), comp = f.deflate ? zlib.deflateRawSync(raw) : raw
      const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(f.deflate ? 8 : 0, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26)
      const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(f.deflate ? 8 : 0, 10); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42)
      locals.push(lh, name, comp); centrals.push(ch, name); off += 30 + name.length + comp.length
    }
    const cd = Buffer.concat(centrals), eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16)
    return Buffer.concat([...locals, cd, eocd])
  }
  const ssXml = `<sst><si><t>Year-Month</t></si><si><t>Debit Balances in Customers' Securities Margin Accounts</t></si><si><t>Free Credit Balances in Customers' Cash Accounts</t></si><si><t>Free Credit Balances in Customers' Securities Margin Accounts</t></si><si><t>2026-10</t></si><si><t>2026-09</t></si><si><t>1997-01</t></si></sst>`
  const shXml = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row><row r="2"><c r="A2" s="1" t="s"><v>4</v></c><c r="B2" s="2"><v>1448360</v></c><c r="C2"><v>210290</v></c><c r="D2"><v>212890</v></c></row><row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3"><v>1480054</v></c><c r="C3"><v>215328</v></c><c r="D3"><v>218581</v></c></row><row r="4"><c r="A4" t="s"><v>6</v></c><c r="B4"><v>103337</v></c><c r="C4"><v>68856</v></c><c r="D4" s="2"/></row></sheetData></worksheet>`
  const zipBuf = mkZip([{ name: 'xl/sharedStrings.xml', data: ssXml, deflate: true }, { name: 'xl/worksheets/sheet1.xml', data: shXml, deflate: false }])
  check('미국 신용잔고: zip 에서 두 조각을 푼다(deflate · 저장) · 없는 이름·깨진 파일은 null', UM.unzipText(zipBuf, 'xl/sharedStrings.xml') === ssXml && UM.unzipText(zipBuf, 'xl/worksheets/sheet1.xml') === shXml && UM.unzipText(zipBuf, 'nope.xml') === null && UM.unzipText(Buffer.from('not a zip'), 'x') === null)
  const sheetRows = UM.parseMarginSheet(ssXml, shXml)
  check('미국 신용잔고: 시트 → 월별 줄(오름차순) · 빈 칸은 null · 2026-10 = 1,448,360', sheetRows.length === 3 && sheetRows[0].ym === '1997-01' && sheetRows[0].marginM === null && sheetRows[2].ym === '2026-10' && sheetRows[2].debitM === 1448360 && sheetRows[2].cashM === 210290 && sheetRows[2].marginM === 212890)
  check('미국 신용잔고: 열 제목이 다르면 통째로 버린다(다른 표를 읽어 그럴듯한 숫자를 내지 않는다)', UM.parseMarginSheet(ssXml.replace('Debit Balances', 'Something Else'), shXml).length === 0 && UM.parseMarginSheet('', '').length === 0)
  const ymAt = i => `${2022 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`
  const months = (n, debitOf) => Array.from({ length: n }, (_, i) => ({ ym: ymAt(i), debitM: debitOf(i), cashM: 300, marginM: 200 }))
  const up = UM.usMarginOf(months(60, i => 1000 + i * 10), '2026-11-22T00:00:00Z')
  check('미국 신용잔고: 계속 쌓이면 위험 — 비율·잔고 모두 맨 위 자리 · 지금이 최고 · 1년 전 대비 +8.2% · 창 39개월', up.level === 'danger' && up.ratioPercentile === 100 && up.marginPercentile === 100 && up.peak.ym === up.ym && up.fromPeakPct === 0 && up.yoyPct === 8.2 && up.windowMonths === 39 && up.ym === '2026-12' && up.ratioPct === 318 && up.freeM === 500)
  check('미국 신용잔고: 같은 규칙의 과거 — 창을 채운 22개월을 세고 전부 위험 · 시작 2025-03', up.baseRate.months === 22 && up.baseRate.danger === 22 && up.baseRate.since === '2025-03' && up.historyFrom === '2022-01')
  const down = UM.usMarginOf(months(60, i => 2000 - i * 10))
  check('미국 신용잔고: 계속 줄면 안정 — 맨 아래 자리 · 최고는 첫 달 · 최고 대비 −29.5%', down.level === 'stable' && down.ratioPercentile === 3 && down.peak.ym === '2022-01' && down.fromPeakPct === -29.5)
  const full = months(60, i => 1000 + i * 10)
  check('미국 신용잔고: 창을 못 채우거나 · 창 안에 빠진 달이 있거나 · 예탁금 칸이 비면 null(지어내지 않는다)', UM.usMarginOf(months(38, i => 1000 + i)) === null && UM.usMarginOf(full.filter((_, i) => i !== 50)) === null && UM.usMarginOf(full.map((m, i) => i === 45 ? { ...m, marginM: null } : m)) === null && UM.usMarginOf([]) === null)
  check('미국 신용잔고: 옛 구간에 빈 칸·빠진 달이 있어도 최근 창이 온전하면 판정한다(과거 집계에서만 빠진다)', (() => { const o = UM.usMarginOf(full.map((m, i) => i === 5 ? { ...m, marginM: null } : m).filter((_, i) => i !== 10)); return o?.level === 'danger' && o.baseRate.months === 11 })())

  const rules = { flatPp: 0.25, redDays: 20, historyMinDays: 10, sahmPp: 0.5, hyWarn: 3.4, hyBad: 5, hySpike: 0.5, capexRed: 100, capexYellow: 50, levDanger: LV.LEV_DANGER_PCTL, levCaution: LV.LEV_CAUTION_PCTL, levComboRatio: LV.LEV_COMBO_RATIO_PCTL, levComboMargin: LV.LEV_COMBO_MARGIN_PCTL, usWindowM: UM.US_MARGIN_WINDOW_M }
  const curve = { alert: 'none', spreads: [{ key: 't10y2y', value: 0.29, date: '2026-11-20', invertedDays: 0, chg3m: -0.21 }, { key: 't10y3m', value: 0.6, date: '2026-11-20', invertedDays: 0, chg3m: -0.22 }],
    sahm: { v: 0, date: '2026-10-01', triggered: false },
    history: [{ from: '1978-08-18', leadMonths: 17, outcome: 'recession' }, { from: '2022-07-05', leadMonths: null, outcome: 'false_alarm' }, { from: '2025-02-26', leadMonths: null, outcome: 'too_soon' }],
    leadSummary: { medianMonths: 14, minMonths: 0, maxMonths: 34 }, series: [{ date: '2026-11-19', s2: 0.3, s3m: 0.62 }, { date: '2026-11-20', s2: 0.29, s3m: 0.6 }, { date: 'bad', s2: 1 }] }
  const liquidity = { gauges: [{ key: 'hy', value: '3.52%p', sub: '4주 +0.12%p', tone: 'warn', date: '2026-11-19' }, { key: 'rate', value: '3.88% · 인상', sub: '다음 FOMC 12월', tone: 'warn' }] }
  const radar = { alertLevel: 'danger', dangerCount: 3, asOf: '2026-11-21T05:00:00.000Z', metrics: [
    { key: 'cape', label: 'Shiller CAPE', value: 36.44, unit: '배', signal: 'danger', norm: '역사평균 ≈ 17배' }, { key: 'buffett', label: '버핏 지표', value: 251.6, unit: '%', signal: 'danger' },
    { key: 'pe', label: 'S&P 500 선행 PER', value: 17.1, unit: '배', signal: 'safe' }, { key: 'erp', label: '주식 위험 프리미엄', value: -0.79, unit: '%p', signal: 'danger' }] }
  // 2026-11-22 FINRA 실측(백만 달러) — 2026-10 잔고 1,448,360 · 예탁금 423,180 · 최고 2026-06 1,502,072 · 1년 전 1,183,654
  const usMargin = { asOf: '2026-11-22T00:00:00.000Z', ym: '2026-10', debitM: 1448360, freeM: 423180, ratioPct: 342, ratioPercentile: 100, marginPercentile: 92, level: 'danger', windowMonths: 39, peak: { ym: '2026-06', debitM: 1502072 }, fromPeakPct: -3.6, yoyPct: 22.4, baseRate: { months: 163, danger: 107, since: '2013-04' }, historyFrom: '1997-01' }
  const leverage = { current: { date: '2026-11-18', level: 'stable', ratio: 30.7, margin: 258612, margin20dChgPct: -13.4, ratioPercentile: 30 }, misu: { current: { date: '2026-11-19', forcedPct: 1.2, forcedPctPercentile: 80 }, series: new Array(732).fill(0) }, series: new Array(800).fill(0) }
  const mood = { source: 'cnn', partyScore: 10, rating: 'extreme fear', prevClose: 18.7, prev1Week: 37.4, vix: 35.89, asOf: '2026-11-21T05:00:00.000Z' }
  const base = { now: '2026-11-21T05:10:00.000Z', curve, liquidity, radar, usMargin, leverage, mood, capex: four, rules }
  const build = over => CS.buildCrisisSignal({ ...base, ...over })
  const colorOf = (s, k) => s.lights.find(l => l.key === k).color
  const sig = build({})
  const L = k => sig.lights.find(l => l.key === k)
  check('신호등: 등 8개 — 돈줄 3(금리차·기업 돈줄·일자리) · 거품 5(주식 값·미국 빚·한국 빚·설비투자·심리) · 미국 빚이 한국 빚보다 먼저', sig.lights.map(l => l.key).join(',') === 'curve,credit,jobs,value,usdebt,debt,capex,mood' && sig.lights.filter(l => l.group === 'money').length === 3 && sig.total === 8 && sig.measured === 8)
  check('신호등: 실측값 → 금리차 초록 · 돈줄 노랑 · 일자리 초록 · 값 빨강 · 미국 빚 빨강 · 한국 빚 노랑(반대매매) · 설비투자 빨강 · 심리 빨강', sig.lights.map(l => l.color).join(',') === 'green,yellow,green,red,red,yellow,red,red')
  check('신호등: 종합은 개수 — 빨강 4 · 노랑 2 · 초록 2 → 빨강', sig.counts.red === 4 && sig.counts.yellow === 2 && sig.counts.green === 2 && sig.overall.color === 'red' && sig.overall.headline === '빨강 4 · 노랑 2 · 초록 2' && sig.overall.todo.length === 3)
  const calmMood = { ...mood, partyScore: 50, rating: 'neutral' }
  const cheap = { ...four, ratioPct: 40 }
  const calmUs = { ...usMargin, level: 'stable' }
  const twoRed = build({ mood: calmMood, usMargin: calmUs }), noRedManyYellow = build({ mood: { ...mood, rating: 'fear' }, capex: { ...four, ratioPct: 60 }, radar: { ...radar, alertLevel: 'caution' }, usMargin: { ...usMargin, level: 'caution' } })
  const calm = build({ mood: calmMood, capex: cheap, radar: { ...radar, alertLevel: 'safe' }, usMargin: calmUs })
  check('신호등: 종합 경계 — 빨강 3 = 빨강 · 빨강 2 = 노랑 · 빨강 0·노랑 6 = 노랑 · 빨강 0·노랑 2 = 초록', build({ mood: calmMood }).counts.red === 3 && build({ mood: calmMood }).overall.color === 'red' && twoRed.counts.red === 2 && twoRed.overall.color === 'yellow' && noRedManyYellow.counts.red === 0 && noRedManyYellow.counts.yellow === 6 && noRedManyYellow.overall.color === 'yellow' && calm.counts.red === 0 && calm.counts.yellow === 2 && calm.overall.color === 'green')
  const blank = build({ curve: null, liquidity: null, radar: null, leverage: null, usMargin: null })
  check('신호등: 못 가져온 등은 초록이 아니라 모름 · 잰 등이 4개 미만이면 종합을 쉰다(할 일 없음)', blank.counts.none === 6 && blank.counts.green === 0 && blank.measured === 2 && blank.overall.color === 'none' && blank.overall.todo.length === 0 && /모름 6/.test(blank.overall.headline))
  check('신호등: 금리차 — watch·brief 노랑 · red 빨강 · 역전 일수는 두 금리차 중 긴 쪽', colorOf(build({ curve: { ...curve, alert: 'watch' } }), 'curve') === 'yellow' && colorOf(build({ curve: { ...curve, alert: 'brief' } }), 'curve') === 'yellow'
    && (() => { const l = build({ curve: { ...curve, alert: 'red', spreads: [{ ...curve.spreads[0], value: -0.3, invertedDays: 25 }, { ...curve.spreads[1], value: -0.1, invertedDays: 31 }] } }).lights[0]; return l.color === 'red' && l.state === '역전 31거래일째' })()
    && colorOf(build({ curve: { ...curve, alert: 'weird' } }), 'curve') === 'none')
  check('신호등: 금리차 날짜·줄 — 기준일 2026-11-20 · 석 달 전보다 좁아졌다는 말 · 값에 부호', L('curve').date === '2026-11-20' && /좁아졌어요/.test(L('curve').line) && L('curve').rows[0].value === '+0.29%p' && L('curve').rows[0].note === '석 달 전보다 −0.21%p')
  check('신호등: 일자리 — 삼의 법칙이 켜지면 빨강(노랑 없음) · 기준월', colorOf(build({ curve: { ...curve, sahm: { v: 0.53, date: '2026-10-01', triggered: true } } }), 'jobs') === 'red' && L('jobs').date === '2026-10' && L('jobs').dateKind === '기준월')
  check('신호등: 기업 돈줄 — tone 그대로(bad 빨강) · 기준일은 하이일드 행의 날짜 · 금리 방향은 곁에만', colorOf(build({ liquidity: { gauges: [{ key: 'hy', value: '5.6%p', tone: 'bad' }] } }), 'credit') === 'red' && L('credit').date === '2026-11-19' && L('credit').rows.length === 2 && colorOf(build({ liquidity: { gauges: [{ key: 'rate', value: 'x', tone: 'bad' }] } }), 'credit') === 'none')
  check('신호등: 주식 값 — 위기 레이더 판정 그대로 · 초록인 자 이름을 말한다 · 값 있는 자가 3개 미만이면 모름', /4개 중 3개가 빨강/.test(L('value').line) && /예상이익 배수\(선행 PER\)만 초록/.test(L('value').line) && colorOf(build({ radar: { ...radar, metrics: radar.metrics.slice(0, 2) } }), 'value') === 'none' && L('value').dateKind === '계산일' && L('value').rows[3].value === '−0.79%p' && L('value').rows[0].value === '36.44배')
  const us = L('usdebt')
  check('신호등: 미국 빚 — FINRA 판정 그대로(위험 빨강 · 주의 노랑 · 안정 초록) · 기준월 · 못 읽은 모양이면 모름', us.color === 'red' && us.date === '2026-10' && us.dateKind === '기준월' && colorOf(build({ usMargin: { ...usMargin, level: 'caution' } }), 'usdebt') === 'yellow' && colorOf(build({ usMargin: calmUs }), 'usdebt') === 'green' && colorOf(build({ usMargin: { ...usMargin, ym: '2026' } }), 'usdebt') === 'none' && colorOf(build({ usMargin: { ...usMargin, level: 'x' } }), 'usdebt') === 'none')
  check('신호등: 미국 빚 줄 — $1.45조 달러 · 맡겨 둔 돈의 3.4배 · 최고(2026.6)보다 3.6% 적다 · 1년 전보다 +22.4%', /\$1\.45조 달러/.test(us.line) && /3\.4배/.test(us.line) && /2026\.6보다는 3\.6% 적어요/.test(us.line) && us.rows[0].value === '$1.45조' && us.rows[0].note === '1년 전 같은 달보다 +22.4%' && us.rows[1].value === '$1.50조' && /−3\.6%/.test(us.rows[1].note) && us.rows[2].value === '342%')
  check('신호등: 미국 빚 — 과거에 빨강이었던 달 수를 함께 적는다(빨강이 곧 하락이라는 뜻이 아님) · 규칙 문장의 숫자는 상수에서', us.rows[3].value === '163개월 중 107개월이 빨강' && /2013\.4부터/.test(us.rows[3].note) && /39개월/.test(us.rule) && /80% 자리/.test(us.rule) && /60% 자리/.test(us.rule) && /지금이 기록상 가장 많아요/.test(build({ usMargin: { ...usMargin, peak: { ym: '2026-10', debitM: 1448360 }, fromPeakPct: 0 } }).lights[4].line))
  const lev = (level, pctl) => colorOf(build({ leverage: { ...leverage, current: { ...leverage.current, level }, misu: { current: { ...leverage.misu.current, forcedPctPercentile: pctl } } } }), 'debt')
  check('신호등: 한국 빚 — 빚투 레이더 판정 그대로 · 초록이어도 반대매매 60 자리 이상이면 노랑(59 는 초록) · 빨강은 그대로', lev('stable', 59) === 'green' && lev('stable', 60) === 'yellow' && lev('caution', 0) === 'yellow' && lev('danger', 0) === 'red' && CS.FORCED_SPIKE_PCTL === 60 && L('debt').name === '한국 빚' && /25\.9조 원/.test(L('debt').line) && /800거래일/.test(L('debt').rows[1].note))
  const cap = pct => colorOf(build({ capex: { ...four, ratioPct: pct } }), 'capex')
  check('신호등: 설비투자 — 100% 초과 빨강(딱 100 은 노랑) · 50% 초과 노랑(딱 50 은 초록) · 3곳 미만이면 모름', cap(100.1) === 'red' && cap(100) === 'yellow' && cap(50.1) === 'yellow' && cap(50) === 'green' && colorOf(build({ capex: { ...four, count: 2 } }), 'capex') === 'none' && /115%/.test(L('capex').line) && /1년 전 같은 분기에는 61%/.test(L('capex').line))
  check('신호등: 설비투자 — 1년 전 비교는 같은 회사 수일 때만 말한다', !/1년 전/.test(build({ capex: { ...four, prev: { ratioPct: 61.2, count: 3 } } }).lights.find(l => l.key === 'capex').line))
  check('신호등: 심리 — CNN 다섯 구간 그대로(양 끝 빨강) · CNN 이 아니거나 모르는 구간이면 모름', ['extreme fear', 'fear', 'neutral', 'greed', 'Extreme Greed'].map(rt => colorOf(build({ mood: { ...mood, rating: rt } }), 'mood')).join(',') === 'red,yellow,green,yellow,red' && colorOf(build({ mood: { ...mood, source: 'calc' } }), 'mood') === 'none' && colorOf(build({ mood: { ...mood, rating: 'panic' } }), 'mood') === 'none')
  check('신호등: 금리차 이력·차트 — 3번 중 침체 1 · 오경보 1 · 1978년부터 · 못 읽는 날짜 줄은 버린다', sig.curveHistory.total === 3 && sig.curveHistory.recession === 1 && sig.curveHistory.falseAlarm === 1 && sig.curveHistory.firstYear === '1978' && sig.curveHistory.medianMonths === 14 && sig.curveSeries.length === 2)
  const texts = [sig, twoRed, calm, blank, noRedManyYellow].flatMap(s => [s.overall.line, s.overall.rule, ...s.overall.todo, ...s.groups.map(g => g.line), ...s.lights.flatMap(l => [l.line, l.what, l.rule, l.state])])
  check('신호등: 문장 — 쌍점으로 끝나지 않는다 · 사라/팔라는 말이 없다 · 빈 문장 없음', texts.every(t => typeof t === 'string' && t.length > 0 && !/:\s*$/.test(t) && !/(매수하세요|매도하세요|사세요|파세요|팔아야|사야 해)/.test(t)))
  check('신호등: 묶음 한 줄 — 돈줄은 빨강 없이 노랑 1(기업 돈줄) · 거품은 빨강 4(미국 빚 포함) · 노랑 1(한국 빚)', sig.groups[0].line === '빨강은 없고 노랑 1개(기업 돈줄)예요.' && /^빨강 4개\(주식 값 · 미국 빚 · 설비투자 · 심리\) · 노랑 1개\(한국 빚\)예요\.$/.test(sig.groups[1].line))
}
if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (공용 lib 단위)')
