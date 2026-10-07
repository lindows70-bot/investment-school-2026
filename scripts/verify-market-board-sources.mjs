// 시장 탭 원천 생존 감시 — 실제 lib 로 네이버·업비트·CNN·alternative.me·야후를 한 번씩 불러 응답 형식·단위·신선도가 그대로인지 본다(야간 감사 불변식)
//   ⚠️ 이 PC 에서 도는 감시다 — Vercel(icn1)에서의 도달은 /api/market-board/probe 로 따로 본다.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-market-board-live`
const LIBS = ['krMarketBoard', 'foreignOrgFlow', 'usMarketBoard', 'upbitMarket', 'cnnFng', 'cryptoFng', 'fxTrend', 'fxHana']

writeFileSync(`${ROOT}/.bt-market-board-live.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/next-env.d.ts`, ...LIBS.map(l => `${ROOT}/src/lib/${l}.ts`)],   // next-env: fxHana 의 fetch next.revalidate 타입
}, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일 실패 때 옛 .js 로 거짓 green
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-market-board-live.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
for (const l of LIBS) if (!existsSync(`${OUT}/lib/${l}.js`)) { console.log(`❌ 컴파일 결과 없음: ${l}`); process.exit(1) }

const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = Module.createRequire(import.meta.url)
const KR = require(`${OUT}/lib/krMarketBoard.js`)
const FL = require(`${OUT}/lib/foreignOrgFlow.js`)
const US = require(`${OUT}/lib/usMarketBoard.js`)
const UP = require(`${OUT}/lib/upbitMarket.js`)
const CNN = require(`${OUT}/lib/cnnFng.js`)
const CF = require(`${OUT}/lib/cryptoFng.js`)
const FX = require(`${OUT}/lib/fxTrend.js`)
const FXH = require(`${OUT}/lib/fxHana.js`)

let fail = 0
function check(label, cond, why = '') {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}${why ? ` — 원천: ${why}` : ''}`); fail++ }
}
const DAY = 86_400_000
const ageDays = iso => (Date.now() - Date.parse(iso)) / DAY
// 긴 연휴(추석 5일 + 주말)를 넘지 않는 한 신선해야 한다
const KR_STALE = 10, US_STALE = 7
const why = p => (p.ok ? '' : p.reason)

const [idx, min, integK, integQ, dailyK, dailyQ, mv, ind, news, rankF, trend, usMv, spy, cnn, cfng, fx, coin] = await Promise.all([
  KR.fetchKrIndices(), KR.fetchKrIndexMinute('KOSDAQ'), KR.fetchKrIntegration('KOSPI'), KR.fetchKrIntegration('KOSDAQ'),
  KR.fetchKrInvestorsDaily('KOSPI'), KR.fetchKrInvestorsDaily('KOSDAQ'),
  KR.fetchKrMovers('priceTop', 'KOSPI', 10), KR.fetchKrIndustry(79), KR.fetchKrMainNews(10),
  FL.fetchFlowRank('FOREIGNER', 'KOSPI', 10), FL.fetchStockTrend('005930', 5),
  US.fetchUsMovers('quantTop', 10), US.fetchUsEtfIntraday('SPY'),
  CNN.fetchCnnFngYear(), CF.fetchCryptoFngYear(), FX.fetchFxTrend(), UP.fetchCoinBoard(5),
])
// 앱 환율 SSOT 1순위(하나은행) + 독립 대조용 2순위 원천(fawazahmed0 — 통화별 값 차이로 단위·100엔당 같은 스케일 변화를 잡는다)
const [hana, fz] = await Promise.all([
  FXH.fetchHanaFx(FXH.FX_NEED, 8000),
  fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { signal: AbortSignal.timeout(8000) })
    .then(r => (r.ok ? r.json() : null)).catch(() => null),
])

check('국내 지수 3종(polling)', idx.ok && idx.data.length === 3, why(idx))
check(`국내 지수 기준 시각 ${KR_STALE}일 이내`, idx.ok && idx.asOf && ageDays(idx.asOf) < KR_STALE, idx.ok ? idx.asOf : why(idx))
check('지수 분봉(api.stock.naver.com)', min.ok && min.data.length > 10, why(min))
check('투자자별·등락 수(코스피·코스닥)', integK.ok && integQ.ok && integK.data.investors && integK.data.upDown && integQ.data.upDown, why(integK) || why(integQ))
for (const [mk, d, g] of [['코스피', dailyK, integK], ['코스닥', dailyQ, integQ]]) {
  const inv = d.ok ? d.data : null
  const sum = inv ? inv.personal + inv.foreign + inv.institutional + inv.otherCorp : NaN
  check(`${mk} 4주체(기타법인 포함) 합 = 0`, inv && Math.abs(sum) <= 1, inv ? `합 ${sum}` : why(d))
  const same = inv && g.ok && g.data.investors && inv.bizdate === g.data.investors.bizdate
    ? ['personal', 'foreign', 'institutional'].every(k => inv[k] === g.data.investors[k]) : null
  check(`${mk} 4주체 원천의 개인·외국인·기관 = integration 값(같은 KRX 기준)`, same !== false, same === null ? '기준일이 달라 비교 못 함' : `daily ${JSON.stringify(inv)} vs integ ${JSON.stringify(g.ok && g.data.investors)}`)
}
check('특징종목 목록(m.stock)', mv.ok && mv.data.items.length > 0 && mv.data.items.every(i => i.tradeValueEok != null), why(mv))
check('업종(m.stock industry)', ind.ok && ind.data.items.length > 20, why(ind))
check('주요 뉴스(front-api)', news.ok && news.data.length >= 5 && news.data.every(n => n.title && n.url), why(news))
check('주체별 순매매(trendForeignOrg)', rankF.ok && rankF.data.buy.length > 0 && rankF.data.sell.length > 0, why(rankF))
// 단위 규약 감시 — 원천이 금액 단위를 바꾸면(원 → 천원·백만원) 수량×가격 재계산 비율이 1 에서 크게 벗어난다
const rankRows = rankF.ok ? [...rankF.data.buy, ...rankF.data.sell] : []
const ratios = rankRows.filter(r => !r.priceLimitBreak && r.unitRatio != null).map(r => r.unitRatio)
// 잠정 구간(원천 금액 "0")이면 단위를 잴 금액이 없다 — 대신 수량×현재가로 센 금액이 0 이 아닌지 본다(2026-10-07: 상위 5가 전부 '0억'이던 사고)
const qtyRows = rankRows.filter(r => r.amountFromQty)
if (rankRows.length && qtyRows.length === rankRows.length) {
  check(`순매매 잠정 구간 — 금액을 수량×현재가로 셈(${qtyRows.length}행 · 0억 아닌 행 ${qtyRows.filter(r => r.netEok !== 0).length})`, qtyRows.filter(r => r.netEok !== 0).length >= 5)
} else {
  check(`순매매 금액 단위 = 원(수량×가격 비율 ${ratios.length ? `${Math.min(...ratios).toFixed(3)}~${Math.max(...ratios).toFixed(3)}` : '없음'})`, ratios.length >= 5 && ratios.every(x => x > 0.8 && x < 1.25))
}
check('종목별 추이(m.stock trend)', Array.isArray(trend) && trend.length > 0 && trend[0].foreign != null, trend ? '' : '실패')
check('미국 특징종목(stock.naver.com global) — 거른 뒤에도 남음', usMv.ok && usMv.data.items.length > 0 && usMv.data.items.every(i => i.marketCapUsd >= US.US_MIN_CAP_USD), why(usMv))
check(`SPY 5분봉(야후) · 기준 시각 ${US_STALE}일 이내`, spy.ok && spy.data.points.length > 0 && spy.asOf && ageDays(spy.asOf) < US_STALE, why(spy))
check(`CNN 공포·탐욕 1년 · 기준 시각 ${US_STALE}일 이내`, cnn.ok && cnn.data.yearHigh && cnn.data.points > 200 && ageDays(cnn.asOf) < US_STALE, why(cnn))
check('코인 공포·탐욕 1년(alternative.me)', !!cfng && cfng.points > 300 && cfng.yearHigh != null, cfng ? '' : '실패')
check(`환율 추이(하나은행) 1년 · 고시일 ${KR_STALE}일 이내`, fx.ok && fx.data.y1.points.length > 200 && ageDays(`${fx.data.latest.date}T00:00:00+09:00`) < KR_STALE, why(fx))
check('업비트 원화 시세', coin.ok && coin.data.scanned > 50, why(coin))
check(`앱 환율 1순위(하나은행 매매기준율) 전 통화 · 고시일 ${KR_STALE}일 이내`,
  !!hana && hana.noticeDate && ageDays(`${hana.noticeDate}T00:00:00+09:00`) < KR_STALE && FXH.FX_NEED.every(c => hana.rates[c] > 0),
  hana ? `고시일 ${hana.noticeDate ?? '확인 못 함'}` : '못 받음(→ 앱이 2순위 원천으로 떨어진다)')
const usd = fz?.usd
const gaps = hana && usd?.krw ? ['USD', ...FXH.FX_NEED].map(c => {
  const other = c === 'USD' ? usd.krw : usd.krw / usd[c.toLowerCase()]
  return { c, gapPct: Math.abs(hana.rates[c] / other - 1) * 100 }
}) : []
const worst = gaps.reduce((a, g) => (g.gapPct > (a?.gapPct ?? -1) ? g : a), null)
check(`하나은행 환율 단위 = 다른 원천과 3% 안(최대 ${worst ? `${worst.c} ${worst.gapPct.toFixed(2)}%` : '대조 못 함'})`,
  gaps.length === FXH.FX_NEED.length + 1 && gaps.every(g => g.gapPct < 3))

console.log('')
if (fail) {
  console.log(`❌ ${fail}건 실패 — 원천 형식·도달·신선도가 바뀌었을 수 있습니다(시장 탭이 '못 가져옴'으로 보입니다)`)
  process.exit(1)
}
console.log('✅ 전부 통과 (시장 탭 원천 생존)')
