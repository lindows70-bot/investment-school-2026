// 시장 탭 원천 파서 검증 — 실측 스냅샷(fixtures/market-board.json)으로 단위(원→억원, 수량×가격 재계산)·이상치 필터·연속일·고저 판정을 독립 재계산과 대조
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-market-board`
const LIBS = ['marketBoardShared', 'krMarketBoard', 'foreignOrgFlow', 'usMarketBoard', 'upbitMarket', 'cnnFng', 'cryptoFng', 'fxTrend', 'strongSectors']

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
  include: LIBS.map(l => `${ROOT}/src/lib/${l}.ts`),
}
writeFileSync(`${ROOT}/.bt-market-board.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일이 타입 에러로 아무것도 못 내놔도 옛 .js 로 거짓 green
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-market-board.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
for (const l of LIBS) {
  if (!existsSync(`${OUT}/lib/${l}.js`)) { console.log(`❌ 컴파일 결과 없음: ${l}`); process.exit(1) }
}

// '@/…' 별칭 → 컴파일 산출물
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = Module.createRequire(import.meta.url)
const S = require(`${OUT}/lib/marketBoardShared.js`)
const KR = require(`${OUT}/lib/krMarketBoard.js`)
const FL = require(`${OUT}/lib/foreignOrgFlow.js`)
const US = require(`${OUT}/lib/usMarketBoard.js`)
const UP = require(`${OUT}/lib/upbitMarket.js`)
const CNN = require(`${OUT}/lib/cnnFng.js`)
const CF = require(`${OUT}/lib/cryptoFng.js`)
const FX = require(`${OUT}/lib/fxTrend.js`)
const SS = require(`${OUT}/lib/strongSectors.js`)

const F = JSON.parse(readFileSync(`${ROOT}/scripts/fixtures/market-board.json`, 'utf8'))

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}
const n = v => Number(String(v).replace(/[,+%]/g, ''))
const near = (a, b, eps = 1e-6) => a != null && b != null && Math.abs(a - b) <= eps

// ── ① 국내 지수 ───────────────────────────────────────────────────────────
{
  const q = KR.parseIndexPolling(F.indexPolling)
  const by = Object.fromEntries(q.map(x => [x.code, x]))
  check('지수 3종 파싱', q.length === 3 && by.KOSPI && by.KOSDAQ && by.KPI200)
  check('코스닥 등락 +1.21%(네이버 — 야후 +0.98% 가 틀렸던 값)', by.KOSDAQ?.changePct === 1.21)
  check('코스피 전일 대비 +63.01 · 기준 시각 = localTradedAt', by.KOSPI?.change === 63.01 && by.KOSPI?.asOf === '2026-09-23T20:15:00+09:00')
  // 독립 재계산: 값 − 등락폭 = 전일 종가 → 등락률
  const k = by.KOSDAQ
  check('등락률 = 등락폭 ÷ (값 − 등락폭) (독립 재계산 ±0.01%p)', Math.abs(k.change / (k.value - k.change) * 100 - k.changePct) < 0.01)
  check('시가·현재가가 저가~고가 안(불변식)', q.every(x => x.low <= x.open && x.open <= x.high && x.low <= x.value && x.value <= x.high))
  const fall = KR.parseIndexPolling({ datas: [{ itemCode: 'X', closePriceRaw: '100', compareToPreviousClosePriceRaw: '12.5', fluctuationsRatioRaw: '11.1', compareToPreviousPrice: { code: '5' } }] })[0]
  check('하락 코드(5)면 원천 값이 양수여도 음수로', fall.change === -12.5 && fall.changePct === -11.1)
  const flat = KR.parseIndexPolling({ datas: [{ itemCode: 'X', closePriceRaw: '100', compareToPreviousClosePriceRaw: '0', fluctuationsRatioRaw: '0.00', compareToPreviousPrice: { code: '3' } }] })[0]
  check('보합 코드(3)면 0', flat.change === 0 && flat.changePct === 0)
  check('빈 응답 → 빈 배열(지어내지 않음)', KR.parseIndexPolling(null).length === 0 && KR.parseIndexPolling({ datas: [{}] }).length === 0)

  const m = KR.parseIndexMinute(F.indexMinuteKospi, 90)
  const raw = F.indexMinuteKospi
  check(`분봉 ${raw.length}개 → 90개 이하로 줄임`, m.points.length <= 90 && m.points.length >= 60)
  check('분봉 마지막 점 = 원천 마지막 봉(값·시각 유지)', m.points.at(-1).v === raw.at(-1).currentPrice && m.asOf === '2026-09-23T15:32:00+09:00')
  check('분봉 마지막 값 = 지수 현재가(7,080.92)', m.points.at(-1).v === by.KOSPI.value)
  check('분봉 시각 오름차순', m.points.every((p, i) => i === 0 || p.t > m.points[i - 1].t))
  check('분봉 첫 점 = 09:00 KST', new Date(m.points[0].t).toISOString() === '2026-09-23T00:00:00.000Z')
}

// ── ② 투자자별 합계 · 등락 수 ─────────────────────────────────────────────
{
  const p = KR.parseIntegration(F.integrationKospi)
  check('투자자별(억원) 개인 −14,649 · 외국인 −4,942 · 기관 +3,189', p.investors.personal === -14649 && p.investors.foreign === -4942 && p.investors.institutional === 3189)
  check('기준일 bizdate → 2026-09-23', p.investors.bizdate === '2026-09-23')
  check('등락 수 상승 311 · 보합 55 · 하락 548', p.upDown.rise === 311 && p.upDown.steady === 55 && p.upDown.fall === 548)
  // 단위 타당성(억원): 같은 날 외국인 순매매 상위 10+10 종목 합(원 단위 원천 ÷ 1e8)과 자릿수가 같아야 한다.
  //   원천이 백만원이었다면 −49억이 되어 상위 종목 합(−1,103억)보다 20배 작아진다.
  const sec = F.flowForeignKospi.sections
  const top = [...sec.buyRankList, ...sec.sellRankList].reduce((s, r) => s + Number(r.accTradeAmount), 0) / 1e8
  const ratio = Math.abs(p.investors.foreign / top)
  check(`투자자별 단위 타당성 — 외국인 합계/상위 종목 순합 = ${ratio.toFixed(2)}(0.1~10 = 같은 자릿수)`, ratio >= 0.1 && ratio <= 10)
  const turnoverEok = n(F.integrationKospiTurnoverMillion.replace('백만', '')) / 100
  check(`투자자별 |값| ≤ 그날 거래대금(${Math.round(turnoverEok).toLocaleString()}억)`, [p.investors.personal, p.investors.foreign, p.investors.institutional].every(v => Math.abs(v) <= turnoverEok))
  check('빈 응답 → 둘 다 null(0 으로 메우지 않음)', (() => { const e = KR.parseIntegration({}); return e.investors === null && e.upDown === null })())
}

// ── ③ 국내 특징종목 · 업종 · 뉴스 ─────────────────────────────────────────
{
  const up = KR.parseKrMovers(F.upKosdaq, 10)
  const breaks = F.upKosdaq.stocks.filter(s => Math.abs(n(s.fluctuationsRatio)) > 30.05)
  check(`가격제한폭(±30%) 밖 ${breaks.length}종(와이즈플래닛컴퍼니 +280.83% — 상장 첫날)을 걸러 개수 기록`, breaks.length >= 1 && up.filtered.priceLimitBreak === breaks.length && !up.items.some(i => i.name === '와이즈플래닛컴퍼니'))
  check('정확히 +30.00%(상한가)는 남긴다', up.items.some(i => i.changePct === 30))
  check('limit 개수 지킴 · 받은 줄 수 기록', up.items.length === 10 && up.scanned === F.upKosdaq.stocks.length)
  const s0 = F.upKosdaq.stocks.find(s => s.itemCode === up.items[0].code)
  check('거래대금·시총 = 원천 원 ÷ 1e8(억원)', up.items[0].tradeValueEok === Math.round(n(s0.accumulatedTradingValueRaw) / 1e8) && up.items[0].marketCapEok === Math.round(n(s0.marketValueRaw) / 1e8))
  const q = KR.parseKrMovers(F.quantKospi, 20)
  const etf = F.quantKospi.stocks.filter(s => s.stockEndType === 'etf').length, etn = F.quantKospi.stocks.filter(s => s.stockEndType === 'etn').length
  check(`ETF ${etf}·ETN ${etn} 표시가 원천 stockEndType 과 일치`, q.items.filter(i => i.etp === 'ETF').length === etf && q.items.filter(i => i.etp === 'ETN').length === etn)
  const dn = KR.parseKrMovers(F.downKospi, 10)
  check('하락 목록 등락률은 음수(부호 코드)', dn.items.every(i => i.changePct < 0))
  check('목록 기준 시각 = 종목 localTradedAt 최댓값', KR.latestAsOf(up.items) === up.items.map(i => i.asOf).sort().at(-1))

  const ind = KR.parseIndustry(F.industry)
  const home = ind.items.find(i => i.name === '가정용품'), semi = ind.items.find(i => i.name === '반도체와반도체장비')
  check('업종 +162% 는 가격제한폭 밖 종목이 섞였다고 표시(상승 4·하락 5 병기)', home.limitBreakSuspect && home.rise === 4 && home.fall === 5)
  check('정상 업종은 표시 안 함', semi && !semi.limitBreakSuspect)

  const news = KR.parseMainNews(F.mainNews)
  check('주요 뉴스 10건 · 원문 제목·언론사·시각', news.length === 10 && news.every(x => x.title && x.office && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(x.datetime)))
  check('뉴스 링크 = n.news.naver.com/mnews/article/{officeId}/{articleId}', news[0].url === `https://n.news.naver.com/mnews/article/${F.mainNews.result[0].officeId}/${F.mainNews.result[0].articleId}`)
  check('HTML 엔티티 복원', KR.parseMainNews({ result: [{ officeId: '1', articleId: '2', title: 'A &quot;B&quot; &amp; C' }] })[0].title === 'A "B" & C')
}

// ── ④ 주체별 순매매 — 단위·연속일·함께·역행 ─────────────────────────────────
{
  const rank = FL.parseTrendForeignOrg(F.flowForeignKospi)
  const raw = [...F.flowForeignKospi.sections.buyRankList, ...F.flowForeignKospi.sections.sellRankList]
  // 단위 독립 재계산: 금액(원) ≈ 순매수 수량 × 현재가 — 체결가 평균 ≠ 종가라 ±10% 안이면 '원' 단위가 맞다(억·천원이면 1e8·1e3 배 어긋난다)
  const ratios = raw.filter(r => Math.abs(n(r.prevChangeRate)) <= 30).map(r => n(r.accTradeAmount) / (n(r.accTradeVolume) * n(r.nowPrice)))
  check(`원천 금액 단위 = 원(수량×가격 재계산 비율 ${Math.min(...ratios).toFixed(3)}~${Math.max(...ratios).toFixed(3)}, 20종)`, ratios.length === 20 && ratios.every(x => x > 0.9 && x < 1.1))
  check('삼성전자 외국인 순매수 12,833억(원 ÷ 1e8)', rank.buy[0].name === '삼성전자' && rank.buy[0].netEok === 12833)
  check('순매도 금액은 음수', rank.sell.every(r => r.netEok < 0))
  check('파서의 unitRatio 가 독립 재계산과 같다', rank.buy.every(r => { const x = raw.find(y => y.itemcode === r.code); return near(r.unitRatio, n(x.accTradeAmount) / (n(x.accTradeVolume) * n(x.nowPrice)), 1e-9) }))
  const s0 = raw.find(r => r.itemcode === '005930')
  check('거래량 대비 비중 = |순매수 수량| ÷ 그날 거래량', rank.buy[0].volShare === Math.round(Math.abs(n(s0.accTradeVolume)) / n(s0.dailyTradeVolume) * 1000) / 10)
  check('기준일 = bizdateTo', rank.bizdate === '2026-09-23')

  const org = FL.parseTrendForeignOrg(F.flowOrganKosdaq)
  const wise = org.sell.find(r => r.name === '와이즈플래닛컴퍼니')
  check('상장 첫날(+280%) 종목은 순위에 남기되 priceLimitBreak 표시', wise && wise.priceLimitBreak === true && org.sell.filter(r => r.priceLimitBreak).length === 1)
  const efs = [...org.buy, ...org.sell].filter(r => r.etf)
  check('ETF 표시 = 원천 type EF', efs.every(r => r.type === 'EF') && [...org.buy, ...org.sell].filter(r => r.type === 'EF').length === efs.length)

  // 연속일 독립 재계산 — 날짜 내림차순 원천 행을 그대로 세어 본다
  const indep = (rows, bizdate, key) => {
    const i0 = rows.findIndex(r => r.bizdate === bizdate.replace(/-/g, '')); if (i0 < 0) return null
    const sg = Math.sign(n(rows[i0][key])); let c = 0
    for (let i = i0; i < rows.length && Math.sign(n(rows[i][key])) === sg && sg !== 0; i++) c++
    return sg * c
  }
  const T = Object.fromEntries(Object.entries(F.trend).map(([c, rows]) => [c, FL.parseStockTrend(rows)]))
  const sam = FL.streakFrom(T['005930'], '2026-09-23', 'foreign'), samO = FL.streakFrom(T['005930'], '2026-09-23', 'organ')
  check(`삼성전자 외국인 ${sam.n}일째 순매수 = 독립 재계산 ${indep(F.trend['005930'], '2026-09-23', 'foreignerPureBuyQuant')}`, sam.n === indep(F.trend['005930'], '2026-09-23', 'foreignerPureBuyQuant') && sam.n === 3)
  check(`삼성전자 기관 ${samO.n}일째 순매수 = 독립 재계산`, samO.n === indep(F.trend['005930'], '2026-09-23', 'organPureBuyQuant') && samO.n === 6)
  const dsn = FL.streakFrom(T['034020'], '2026-09-23', 'foreign')
  check(`두산에너빌리티 외국인 ${Math.abs(dsn.n)}일째 순매도(음수) = 독립 재계산`, dsn.n === indep(F.trend['034020'], '2026-09-23', 'foreignerPureBuyQuant') && dsn.n === -10 && !dsn.capped)
  const w = FL.streakFrom(T['0010S0'], '2026-09-23', 'foreign')
  check('상장 첫날 종목(추이 1행)은 1일째 — capped 아님(요청 30행보다 적음)', w.n === -1 && w.capped === false)
  const all = FL.streakFrom([{ date: '2026-09-23', foreign: 5, organ: 1 }, { date: '2026-09-22', foreign: 5, organ: 1 }], '2026-09-23', 'foreign', 2)
  check('요청 행을 다 받고 끝까지 같은 방향이면 capped', all.n === 2 && all.capped === true)
  check('기준일 행이 없으면 null(어제부터 세지 않는다)', FL.streakFrom(T['005930'], '2026-09-24', 'foreign') === null)
  check('기준일 0 이면 0일', FL.streakFrom([{ date: '2026-09-23', foreign: 0, organ: 1 }], '2026-09-23', 'foreign').n === 0)
  const top = FL.enrichTop(rank.buy[0], T['005930'], rank.bizdate)
  check('삼성전자: 외국인·기관 함께 순매수(together=buy)', top.together === 'buy')
  const samyang = rank.buy.find(r => r.name === '삼양식품')
  check('주가 역행: 하락(−2.72%)인데 순매수', samyang && FL.enrichTop(samyang, null, rank.bizdate).contrarian === true && FL.enrichTop(rank.buy[0], null, rank.bizdate).contrarian === false)
  check('추이가 없으면 연속일·함께 = null', (() => { const e = FL.enrichTop(rank.buy[0], null, rank.bizdate); return e.foreignStreak === null && e.together === null })())
}

// ── ⑤ 미국 특징종목 필터 · SPY ────────────────────────────────────────────
{
  const NOW = Date.parse('2026-09-27T00:00:00Z')
  const r = US.parseUsMovers(F.usUp, NOW, 10)
  const qual = F.usUp.filter(s => !/\s/.test(s.symbolCode) && !(NOW - Date.parse(s.listedAt) < 7 * 86400000) && Number(s.marketValue) >= 3e8)
  const sumF = r.filtered.smallCap + r.filtered.newListing + r.filtered.rightsUnits
  check(`걸러낸 개수 + 남은 종목 = 받은 줄 수(${sumF} + ${qual.length} = ${r.scanned})`, sumF + qual.length === r.scanned && r.scanned === 100)
  check(`시총 3억 달러 미만 ${r.filtered.smallCap}종 제거 — 남은 것은 전부 3억 달러 이상`, r.items.every(i => i.marketCapUsd >= 3e8) && r.filtered.smallCap > 50)
  check('상승 1위(+309%, 시총 2천만 달러 MSGY)가 빠진다', !r.items.some(i => i.symbol === 'MSGY') && r.items[0].symbol === qual[0].symbolCode)
  check('권리·유닛(심볼에 공백) 제거', r.filtered.rightsUnits === F.usUp.filter(s => /\s/.test(s.symbolCode)).length && !r.items.some(i => /\s/.test(i.symbol)))
  const syn = US.parseUsMovers([
    { symbolCode: 'A', marketValue: '300000000', listedAt: '2000-01-01T00:00:00Z', fluctuationsRatio: '5' },
    { symbolCode: 'B', marketValue: '9e9', listedAt: new Date(NOW - 6 * 86400000).toISOString(), fluctuationsRatio: '50' },
    { symbolCode: 'C', marketValue: null, listedAt: '2000-01-01T00:00:00Z', fluctuationsRatio: '5' },
  ], NOW, 10)
  check('경계: 시총 정확히 3억 달러는 남기고, 상장 6일째는 거르고, 시총 없음은 소형주로', syn.items.length === 1 && syn.items[0].symbol === 'A' && syn.filtered.newListing === 1 && syn.filtered.smallCap === 1)
  check('원천 목록은 기준 시각이 없다 — marketStatus null(지어내지 않음)', r.marketStatus === null)

  const spy = US.parseYahooIntraday(F.spy, Date.parse('2026-09-27T00:00:00Z'))
  check('SPY 771.35 · 전일 767.18 · +0.54%(previousClose 기준)', spy.price === 771.35 && spy.prevClose === 767.18 && Math.abs(spy.changePct - (771.35 / 767.18 - 1) * 100) < 1e-9)
  check('SPY 5분봉 79개 · 기준 시각 = regularMarketTime', spy.points.length === 79 && spy.asOf === new Date(F.spy.chart.result[0].meta.regularMarketTime * 1000).toISOString())
  check('장 마감 뒤 → CLOSED', spy.marketStatus === 'CLOSED')
  const reg = F.spy.chart.result[0].meta.currentTradingPeriod.regular
  check('정규장 안 → OPEN', US.parseYahooIntraday(F.spy, (reg.start + 60) * 1000).marketStatus === 'OPEN')
}

// ── ⑥ 공포·탐욕 1년 — 1년 전·연간 고저(같은 값이면 최근 날짜) ───────────────────
{
  const c = CNN.parseCnnFngYear(F.cnn)
  // 독립 재계산: UTC 날짜별 마지막 값 → 최신에서 365일 창 → 최고/최저(동점은 최근)
  const byDate = new Map()
  for (const p of [...F.cnn.fear_and_greed_historical.data].sort((a, b) => a.x - b.x)) byDate.set(new Date(p.x).toISOString().slice(0, 10), p.y)
  const ds = [...byDate.keys()].sort(); const last = ds.at(-1)
  const from = new Date(Date.parse(last) - 365 * 86400000).toISOString().slice(0, 10)
  const win = ds.filter(d => d >= from)
  let hi = null, lo = null
  for (const d of win) { const v = byDate.get(d); if (!hi || v >= hi.v) hi = { v, date: d }; if (!lo || v <= lo.v) lo = { v, date: d } }
  check(`CNN 지금 ${c.now} · 1년 전 ${c.yearAgo}(원천 previous_1_year 50.66 → 반올림 51)`, c.now === 37 && c.yearAgo === 51)
  check(`CNN 연간 최고 ${c.yearHigh.v}(${c.yearHigh.date}) = 독립 재계산`, c.yearHigh.date === hi.date && c.yearHigh.v === Math.round(hi.v) && c.yearHigh.date === '2026-05-01')
  check(`CNN 연간 최저 ${c.yearLow.v}(${c.yearLow.date}) = 독립 재계산`, c.yearLow.date === lo.date && c.yearLow.v === Math.round(lo.v) && c.yearLow.date === '2025-11-20')
  check('CNN 같은 날 두 점(자정·23:59:59)은 한 날로', c.points === win.length)
  const tie = CNN.parseCnnFngYear({ fear_and_greed: { score: 50 }, fear_and_greed_historical: { data: [{ x: Date.parse('2026-01-02'), y: 80 }, { x: Date.parse('2026-03-02'), y: 80 }, { x: Date.parse('2026-02-02'), y: 10 }, { x: Date.parse('2026-04-02'), y: 10 }] } })
  check('CNN 동점이면 가장 최근 날짜', tie.yearHigh.date === '2026-03-02' && tie.yearLow.date === '2026-04-02')
  check('CNN 점수 없음 → null(가짜 50 없음)', CNN.parseCnnFngYear({ fear_and_greed: {} }) === null)

  const y = CF.parseFngYear(F.cryptoFng)
  const rows = F.cryptoFng.data.map(r => ({ ts: Number(r.timestamp), v: Number(r.value) }))
  const ts0 = rows[0].ts
  const w = rows.filter(r => r.ts >= ts0 - 365 * 86400 && r.ts <= ts0).sort((a, b) => a.ts - b.ts)
  let h2 = null, l2 = null
  for (const r of w) { if (!h2 || r.v >= h2.v) h2 = r; if (!l2 || r.v <= l2.v) l2 = r }
  const kd = s => new Date((s + 9 * 3600) * 1000).toISOString().slice(0, 10)
  check(`코인 1년 전 ${y.yearAgo}(${y.yearAgoDate}) = 정확히 365일 전 행`, y.yearAgo === rows.find(r => r.ts === ts0 - 365 * 86400)?.v && y.yearAgoDate === kd(ts0 - 365 * 86400))
  check(`코인 연간 최고 ${y.yearHigh.v}(${y.yearHigh.date})·최저 ${y.yearLow.v}(${y.yearLow.date}) = 독립 재계산`, y.yearHigh.v === h2.v && y.yearHigh.date === kd(h2.ts) && y.yearLow.v === l2.v && y.yearLow.date === kd(l2.ts))
  const gap = CF.parseFngYear({ data: F.cryptoFng.data.filter(r => Number(r.timestamp) !== ts0 - 365 * 86400) })
  check('365일 전 행이 빠지면 1년 전 = null(이웃 날로 메우지 않음)', gap.yearAgo === null && gap.yearAgoDate === null)
}

// ── ⑦ 환율 추이(하나은행) — 날짜로 자르기·고저 ─────────────────────────────
{
  const rows = FX.parseFxPages(F.fxPages)
  check(`5쪽 × 60행 → 날짜 중복 없이 ${rows.length}행, 오름차순`, rows.length === 300 && rows.every((r, i) => i === 0 || r.date > rows[i - 1].date))
  const t = FX.buildFxTrend(rows)
  check('최신 고시일 2026-09-23 · 1,359.0 · 전일 대비 +3.5', t.latest.date === '2026-09-23' && t.latest.v === 1359 && t.latest.change === 3.5)
  check('1달 = 2026-08-23 초과 ~ 9/23(날짜로 자름)', t.m1.from === '2026-08-23' && t.m1.points[0].date > '2026-08-23' && t.m1.points.at(-1).date === '2026-09-23')
  const indep = (m) => {
    const from = new Date(Date.UTC(2026, 8 - m, 23)).toISOString().slice(0, 10)
    const w = rows.filter(r => r.date > from && r.date <= '2026-09-23')
    let hi = null, lo = null
    for (const r of w) { if (!hi || r.v >= hi.v) hi = r; if (!lo || r.v <= lo.v) lo = r }
    return { n: w.length, hi, lo }
  }
  for (const [k, m] of [['m1', 1], ['m3', 3], ['y1', 12]]) {
    const i = indep(m)
    check(`${k} 고점 ${t[k].high.v}(${t[k].high.date})·저점 ${t[k].low.v}(${t[k].low.date}) = 독립 재계산(${i.n}일)`,
      t[k].points.length === i.n && t[k].high.v === i.hi.v && t[k].high.date === i.hi.date && t[k].low.v === i.lo.v && t[k].low.date === i.lo.date)
  }
  check('1쪽(3달치)만 있으면 1년 추이 = null(짧은 기간을 1년이라 부르지 않음)', FX.buildFxTrend(FX.parseFxPages([F.fxPages[0]])) === null)
  const hl = S.highLow([{ date: '2026-01-01', v: 5 }, { date: '2026-01-02', v: 5 }])
  check('고저 동점 → 가장 최근 날짜', hl.high.date === '2026-01-02' && hl.low.date === '2026-01-02')
}

// ── ⑧ 코인 · 요즘 강한 분야 · 공통 ────────────────────────────────────────
{
  const b = UP.buildCoinBoard(F.upbitTickers, [{ market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' }], 5)
  check('코인 상승 상위 = 등락률 내림차순 · % = signed_change_rate × 100', b.up.every((x, i) => i === 0 || x.changePct <= b.up[i - 1].changePct)
    && b.up[0].changePct === Math.round(Math.max(...F.upbitTickers.map(t => t.signed_change_rate)) * 10000) / 100)
  check('코인 거래대금 상위 = 24h 거래대금(억원) 내림차순', b.tradeValue.every((x, i) => i === 0 || x.tradeValue24hEok <= b.tradeValue[i - 1].tradeValue24hEok))
  check('코인 이름 = 업비트 한글명(목록 없으면 심볼)', b.tradeValue.concat(b.up, b.down).every(x => x.symbol === 'BTC' ? x.name === '비트코인' : x.name === x.symbol))

  const items = [
    { key: 'a', label: 'A', emoji: '', group: 'gics', ret1w: 1, ret1m: 2, quadrant: 'leading', score: 3, count: 10 },
    { key: 'b', label: 'B', emoji: '', group: 'theme', ret1w: 5, ret1m: 6, quadrant: 'leading', score: 8, count: 20 },
    { key: 'c', label: 'C', emoji: '', group: 'gics', ret1w: -1, ret1m: -2, quadrant: 'lagging', score: -4, count: 5 },
  ]
  check('강한 분야 = 쏠림점수 내림차순 상위 N', SS.pickStrongSectors(items, 2).map(i => i.key).join() === 'b,a')
  const reps = SS.pickReps([
    { ticker: '005930', name: '삼성전자', market: 'KR', ret1w: 3.14 },
    { ticker: 'SHEL', name: 'Shell', market: 'US', ret1w: 9 },
    { ticker: 'X', name: 'X', market: 'US', ret1w: null },
  ], 2)
  check('대표 종목 = 1주 수익률 상위(없는 값 제외) · 국기는 flagOf', reps.length === 2 && reps[0].ticker === 'SHEL' && reps[1].flag === '🇰🇷' && reps[1].ret1w === 3.1)

  const failed = S.collectFailed({ a: { ok: true, source: 's', data: { x: { ok: false, source: 't' } } }, b: { c: { ok: false, source: 'u', reason: 'r' } }, d: [{ ok: false, source: 'v' }] })
  check('실패 경로 모으기(성공 원천 안은 들여다보지 않음)', failed.join() === 'b.c')
  check('점 줄이기: 마지막 점 유지', (() => { const d = S.downsample(Array.from({ length: 393 }, (_, i) => i), 90); return d.length <= 90 && d.at(-1) === 392 && d[0] === 0 })())
  const kst = (s) => Date.parse(s)
  check('국내 캐시: 평일 10시 짧게 · 20:30 길게 · 일요일 길게',
    S.krSessionTtlMs(kst('2026-09-22T10:00:00+09:00'), 1, 2) === 1 && S.krSessionTtlMs(kst('2026-09-22T20:30:00+09:00'), 1, 2) === 2 && S.krSessionTtlMs(kst('2026-09-27T10:00:00+09:00'), 1, 2) === 2)
  check('미국 캐시: 화 10시(뉴욕) 짧게 · 토요일 길게',
    S.usSessionTtlMs(kst('2026-09-22T10:00:00-04:00'), 1, 2) === 1 && S.usSessionTtlMs(kst('2026-09-26T10:00:00-04:00'), 1, 2) === 2)
}

console.log('')
if (fail) {
  console.log(`❌ ${fail}건 실패`)
  process.exit(1)
}
console.log('✅ 전부 통과 (시장 탭 원천)')
