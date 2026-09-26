// '오늘 알려드려요' 규칙 검증 — 날짜 순환·빈 규칙 건너뛰기·문구 분기·날짜로 종가 찾기·한 번만 산 종목 고르기
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-learn-tips`

const tsconfig = {
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/learnTips.ts`, `${ROOT}/src/lib/learnTipsData.ts`],
}
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일 실패에도 옛 .js 로 거짓 green 이 난다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
for (const f of ['learnTips', 'learnTipsData', 'studentFormat', 'theme']) {
  if (!existsSync(`${OUT}/lib/${f}.js`)) { console.log(`❌ 컴파일 결과 없음: ${f}.js`); process.exit(1) }
}

const require2 = Module.createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const T = require2(`${OUT}/lib/learnTips.js`)
const D = require2(`${OUT}/lib/learnTipsData.js`)

let fail = 0
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fail++ }

// ── 픽스처 ──────────────────────────────────────────────────────────────
const TODAY = '2026-09-26'
const addDays = (ymd, n) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n)).toISOString().slice(0, 10)
const all = () => ({
  per: [
    { ticker: 'AAPL', name: '애플', market: 'US', pe: 20, perMedian: 30, perCount: 5 },
    { ticker: 'MSFT', name: '마이크로소프트', market: 'US', pe: 40, perMedian: 30, perCount: 5 },
  ],
  vsIndex: [{ ticker: '005930', name: '삼성전자', market: 'KR', buyDate: '2026-09-01', returnPct: 5.2, indexName: '코스피', indexReturnPct: 3.0 }],
  events: [{ type: 'earnings', date: addDays(TODAY, 10), ticker: 'AAPL', name: '애플' }],
  movers: [{ ticker: 'NVDA', name: '엔비디아', changePct: -4.3, headline: 'Nvidia shares slide' }],
})

// ── 1. 날짜 순환 ─────────────────────────────────────────────────────────
const days4 = [0, 1, 2, 3].map(i => addDays(TODAY, i))
const kinds4 = days4.map(d => T.pickTip(d, all())?.kind)
check(`연속 4일 → 시작 규칙 4가지 모두 다름 (${kinds4.join(',')})`, new Set(kinds4).size === 4 && kinds4.every(Boolean))
check('5일째는 1일째와 같은 규칙', T.pickTip(addDays(TODAY, 4), all())?.kind === kinds4[0])
check('같은 날 같은 입력 → 같은 결과', JSON.stringify(T.pickTip(TODAY, all())) === JSON.stringify(T.pickTip(TODAY, all())))
const perDay = days4[kinds4.indexOf('per')]
const rev = all(); rev.per.reverse()
check('입력 순서가 바뀌어도 같은 종목', T.pickTip(perDay, all()).ticker === T.pickTip(perDay, rev).ticker)
// 규칙 안 종목 순환 — per 가 시작인 날(4일 간격)마다 종목이 넘어간다
const perPicks = [0, 4, 8, 12].map(n => T.pickTip(addDays(perDay, n), all()).ticker)
check(`규칙 안 종목도 날짜로 돌아간다 (${perPicks.join(',')})`, perPicks[0] !== perPicks[1] && perPicks[0] === perPicks[2] && new Set(perPicks).size === 2)

// ── 2. 빈 규칙 건너뛰기 · 전부 없음 ──────────────────────────────────────
const RULES = ['per', 'vsIndex', 'event', 'mover']
const nextOf = k => RULES[(RULES.indexOf(k) + 1) % 4]
for (const d of days4) {
  const k = T.pickTip(d, all()).kind
  const inp = all(); inp[k === 'event' ? 'events' : k === 'mover' ? 'movers' : k] = null
  check(`${d}: 시작 규칙 ${k} 입력 null → 다음 규칙 ${nextOf(k)}`, T.pickTip(d, inp)?.kind === nextOf(k))
}
{
  const inp = all(); inp.per = []; inp.vsIndex = []
  const k = T.pickTip(perDay, inp)?.kind
  check('per·vsIndex 가 빈 배열 → event', k === 'event')
}
check('전부 null → null', T.pickTip(TODAY, { per: null, vsIndex: null, events: null, movers: null }) === null)
check('전부 빈 배열 → null', T.pickTip(TODAY, { per: [], vsIndex: [], events: [], movers: [] }) === null)
check('날짜 형식이 틀리면 null', T.pickTip('2026/09/26', all()) === null)

// ── 3. ① PER ─────────────────────────────────────────────────────────────
const only = (k, arr) => ({ per: null, vsIndex: null, events: null, movers: null, [k]: arr })
{
  const lo = T.pickTip(TODAY, only('per', [{ ticker: 'AAPL', name: '애플', market: 'US', pe: 20, perMedian: 30, perCount: 5 }]))
  check('PER 제목', lo.title === '애플 PER은 20.0배예요')
  check('PER 중앙값보다 낮음 → 덜 비싸게', lo.body === 'PER은 주가가 1년 동안 번 이익의 몇 배인지를 뜻해요. 비슷한 기업 5곳의 중앙값 30.0배보다 낮아서, 버는 돈에 비해 덜 비싸게 거래되고 있어요.')
  check('PER 비교 출처', lo.source === '앱 종목 정보 · 비슷한 기업 비교')
  const hi = T.pickTip(TODAY, only('per', [{ ticker: 'MSFT', name: 'MS', market: 'US', pe: 40, perMedian: 30, perCount: 3 }]))
  check('PER 중앙값보다 높음 → 비싸게', hi.body.endsWith('중앙값 30.0배보다 높아서, 버는 돈에 비해 비싸게 거래되고 있어요.'))
  const eq = T.pickTip(TODAY, only('per', [{ ticker: 'X', name: 'X', market: 'US', pe: 30.02, perMedian: 30, perCount: 4 }]))
  check('PER 표시값이 같으면 → 비슷해요(높다·낮다 안 함)', eq.body.endsWith('중앙값 30.0배와 비슷해요.'))
  const few = T.pickTip(TODAY, only('per', [{ ticker: 'AAPL', name: '애플', market: 'US', pe: 20, perMedian: 30, perCount: 2 }]))
  check('동종 2곳(<3) → 비교 없음', few.body === 'PER은 주가가 1년 동안 번 이익의 몇 배인지를 뜻해요.' && few.source === '앱 종목 정보')
  const noMed = T.pickTip(TODAY, only('per', [{ ticker: 'AAPL', name: '애플', market: 'US', pe: 20, perMedian: null, perCount: 5 }]))
  check('중앙값 null → 비교 없음', !noMed.body.includes('중앙값'))
  const kr = T.pickTip(TODAY, only('per', [{ ticker: '005930', name: '삼성전자', market: 'KR', pe: 12.34, perMedian: 20, perCount: 5 }]))
  check('KR → 직전 결산 연도 표기 · 잣대가 달라 비교 없음', kr.title === '삼성전자 PER은 12.3배예요' && kr.body === 'PER은 주가가 1년 동안 번 이익의 몇 배인지를 뜻해요. (직전 결산 연도 이익 기준)' && kr.source === '앱 종목 정보')
  const etfOnly = T.pickTip(TODAY, only('per', [{ ticker: '360750', name: 'TIGER 미국S&P500', market: 'KR', pe: null, perMedian: null, perCount: 0 }]))
  check('ETF(pe null)만 있으면 PER 규칙 없음 → null', etfOnly === null)
  const mixed = T.pickTip(TODAY, only('per', [
    { ticker: '360750', name: 'TIGER', market: 'KR', pe: null, perMedian: null, perCount: 0 },
    { ticker: 'BTC', name: '비트코인', market: 'CRYPTO', pe: 0, perMedian: null, perCount: 0 },
    { ticker: 'LOSS', name: '적자기업', market: 'US', pe: -5, perMedian: null, perCount: 0 },
    { ticker: 'AAPL', name: '애플', market: 'US', pe: 20, perMedian: null, perCount: 0 },
  ]))
  check('ETF·코인·음수 PER 은 건너뛰고 주식을 고른다', mixed?.ticker === 'AAPL')
}

// ── 4. ② 산 뒤 대 지수 ───────────────────────────────────────────────────
{
  const row = (r, i, extra = {}) => only('vsIndex', [{ ticker: '005930', name: '삼성전자', market: 'KR', buyDate: '2026-09-01', returnPct: r, indexName: '코스피', indexReturnPct: i, ...extra }])
  const ahead = T.pickTip(TODAY, row(5.2, 3.0))
  check('앞섬 제목', ahead.title === '삼성전자는 산 뒤 +5.2%, 같은 기간 코스피 +3.0%')
  check('앞섬 본문', ahead.body === '산 날(9/1)부터 오늘까지 비교했어요. 코스피보다 2.2%p 앞섰어요.')
  check('앞섬 tone=up', ahead.tone === 'up')
  const behind = T.pickTip(TODAY, row(-2.0, 1.5))
  check('뒤처짐 본문 · 음수 부호 − · tone=down', behind.body.endsWith('코스피보다 3.5%p 뒤처졌어요.') && behind.title.includes('−2.0%') && behind.tone === 'down')
  const near = T.pickTip(TODAY, row(3.3, 3.0))
  check('±0.5%p 안 → 비슷해요', near.body.endsWith('코스피와 비슷해요.'))
  const edge = T.pickTip(TODAY, row(3.5, 3.0))
  check('정확히 0.5%p → 앞섰어요(밴드 밖)', edge.body.endsWith('0.5%p 앞섰어요.'))
  const flat = T.pickTip(TODAY, row(0.02, 1.0))
  check('내 수익 보합 → tone=flat', flat.tone === 'flat')
  const sp = T.pickTip(TODAY, only('vsIndex', [{ ticker: 'AAPL', name: '애플', market: 'US', buyDate: '2026-08-03', returnPct: 1.0, indexName: '미국 S&P 500', indexReturnPct: 1.2 }]))
  check('받침 조사: 애플은 · S&P 500과', sp.title.startsWith('애플은 산 뒤') && sp.body.endsWith('미국 S&P 500과 비슷해요.'))
  check('산 날이 오늘이면 제외 → null', T.pickTip(TODAY, row(1, 1, { buyDate: TODAY })) === null)
  check('수익률이 NaN 이면 제외 → null', T.pickTip(TODAY, row(NaN, 1)) === null)
}

// ── 5. ③ 일정 ────────────────────────────────────────────────────────────
{
  const ev = only('events', [
    { type: 'earnings', date: addDays(TODAY, -1), ticker: 'OLD', name: '어제기업' },     // 지난 일정
    { type: 'payDiv', date: addDays(TODAY, 20), ticker: 'KO', name: '코카콜라' },
    { type: 'exDiv', date: addDays(TODAY, 5), ticker: 'JNJ', name: '존슨앤드존슨' },
    { type: 'earnings', date: addDays(TODAY, 31), ticker: 'FAR', name: '먼기업' },       // 30일 밖
  ])
  const e = T.pickTip(TODAY, ev)
  check('가장 가까운 일정(지난 것 제외)', e.title === '10/1 존슨앤드존슨 배당락')
  check('배당락 설명 + 며칠 뒤', e.body === '이날 전에 사서 이날까지 가지고 있어야 이번 배당을 받아요. 오늘부터 5일 뒤예요.')
  check('지난 일정·30일 밖만 있으면 → null', T.pickTip(TODAY, only('events', [ev.events[0], ev.events[3]])) === null)
  const today = T.pickTip(TODAY, only('events', [{ type: 'earnings', date: TODAY, ticker: 'AAPL', name: '애플' }]))
  check('오늘 일정 포함 · 실적 문구', today.title === '9/26 애플 실적 발표' && today.body.endsWith('바로 오늘이에요.') && today.body.includes('예정일'))
  const d30 = T.pickTip(TODAY, only('events', [{ type: 'payDiv', date: addDays(TODAY, 30), ticker: 'KO', name: '코카콜라' }]))
  check('정확히 30일 뒤 포함 · 배당 지급', d30?.title === '10/26 코카콜라 배당 지급')
}

// ── 6. ④ 크게 움직인 종목 ────────────────────────────────────────────────
{
  const mv = T.pickTip(TODAY, only('movers', [
    { ticker: 'AAPL', name: '애플', changePct: 1.2, headline: null },
    { ticker: 'NVDA', name: '엔비디아', changePct: -4.3, headline: '  Nvidia shares slide  ' },
  ]))
  check('가장 크게 움직인 종목(절대값)', mv.title === '엔비디아 오늘 −4.3%' && mv.tone === 'down')
  check('뉴스 제목 있음 → 따옴표로', mv.body === '최근 뉴스 제목: "Nvidia shares slide"')
  check('출처 = 시각 미확인', mv.source === '하루 등락 · 뉴스 제목(시각 미확인)')
  const nh = T.pickTip(TODAY, only('movers', [{ ticker: 'AAPL', name: '애플', changePct: 2.4, headline: '' }]))
  check('뉴스 제목 없음(빈 문자열) → 못 찾았어요', nh.body === '관련 뉴스 제목을 못 찾았어요.' && nh.title === '애플 오늘 +2.4%' && nh.tone === 'up')
  check('보합(0.04%)만 있으면 → null', T.pickTip(TODAY, only('movers', [{ ticker: 'A', name: 'A', changePct: 0.04, headline: null }])) === null)
}

// ── 7. 날짜로 종가 찾기 ──────────────────────────────────────────────────
{
  const cs = [   // 일부러 순서를 섞고 주말·결측을 둔다
    { date: '2026-09-04', close: 104 }, { date: '2026-09-01', close: 101 }, { date: '2026-09-02', close: 102 },
    { date: '2026-09-07', close: 107 }, { date: '2026-09-03', close: NaN }, { date: '2026-09-25', close: 125 },
  ]
  check('당일 봉', D.closeOnOrBefore(cs, '2026-09-02')?.close === 102)
  check('주말(9/6) → 직전 금요일(9/4)', D.closeOnOrBefore(cs, '2026-09-06')?.date === '2026-09-04')
  check('결측(9/3 NaN) → 9/2', D.closeOnOrBefore(cs, '2026-09-03')?.close === 102)
  check('첫 봉보다 이른 날 → null', D.closeOnOrBefore(cs, '2026-08-31') === null)
  check('가장 가까운 봉이 7일보다 멀면(9/20 → 9/7) → null', D.closeOnOrBefore(cs, '2026-09-20') === null)
  check('7일 안(9/14 → 9/7)은 허용', D.closeOnOrBefore(cs, '2026-09-14')?.date === '2026-09-07')
  check('날짜 형식이 틀리면 null', D.closeOnOrBefore(cs, '20260902') === null)
}

// ── 8. 한 번만 사고 판 적 없는 종목 ──────────────────────────────────────
{
  const tr = (ticker, type, qty, price, date, memo = null) => ({ ticker, name: ticker, market: 'KR', currency: 'KRW', type, price: String(price), quantity: String(qty), transaction_date: date, created_at: `${date}T00:00:00Z`, memo })
  const hold = (ticker, qty, price) => ({ ticker, name: ticker, market: 'KR', currency: 'KRW', quantity: qty, purchase_price: price, purchase_date: '2026-01-01' })
  const trades = [
    tr('ONE', 'buy', 10, 1000, '2026-03-02'),
    tr('DCA', 'buy', 5, 1000, '2026-03-02'), tr('DCA', 'buy', 5, 1200, '2026-04-02'),
    tr('SOLD', 'buy', 10, 500, '2026-03-02'), tr('SOLD', 'sell', 4, 600, '2026-05-02'),
    tr('QTY', 'buy', 10, 1000, '2026-03-02'),
    tr('SYN', 'buy', 3, 1000, '2026-03-02', '자동 동기화'),
    tr('PRC', 'buy', 10, 1000, '2026-03-02'),
    tr('dup', 'buy', 2, 100, '2026-03-02'),
  ]
  const holds = [hold('ONE', 10, 1000.4), hold('DCA', 10, 1100), hold('SOLD', 6, 500), hold('QTY', 7, 1000), hold('SYN', 3, 1000),
    hold('PRC', 10, 1100), hold('NOREC', 1, 10), hold('DUP', 1, 100), hold('DUP', 1, 100)]
  const sb = D.singleBuyHoldings(trades, holds)
  check(`한 번만 산 종목만 남는다 (${sb.map(s => s.ticker).join(',')})`, sb.length === 1 && sb[0].ticker === 'ONE')
  check('산 날 = 거래일 · 산 값 = 보유 평단', sb[0].buyDate === '2026-03-02' && sb[0].buyPrice === 1000.4)
  check('나눠 산(DCA)·판 적 있음(SOLD)·수량 불일치·자동 동기화·평단 10% 차이·기록 없음·보유 중복 제외',
    !sb.some(s => ['DCA', 'SOLD', 'QTY', 'SYN', 'PRC', 'NOREC', 'DUP'].includes(s.ticker)))
}

// ── 8-b. 지수 비교는 개별 주식만 (상장 시장 ≠ 자산의 국적) ───────────────
{
  const tr = (ticker, name, market) => ({ ticker, name, market, currency: market === 'KR' ? 'KRW' : 'USD', type: 'buy', price: 100, quantity: 1, transaction_date: '2026-03-02', created_at: '2026-03-02T00:00:00Z', memo: null })
  const hold = (ticker, name, market) => ({ ticker, name, market, currency: market === 'KR' ? 'KRW' : 'USD', quantity: 1, purchase_price: 100, purchase_date: '2026-03-02' })
  const rows = [
    ['360750', 'TIGER 미국S&P500', 'KR'],     // 한국 상장 · 미국 기업 ETF
    ['005930', '삼성전자', 'KR'],
    ['AAPL', '애플', 'US'],
    ['HEIA.AS', '하이네켄', 'US'],             // 해외 접미사 주식
    ['KRW-BTC', '비트코인', 'CRYPTO'],
    ['SPY', 'SPDR S&P 500 ETF', 'US'],
  ]
  const sb = D.singleBuyHoldings(rows.map(r => tr(...r)), rows.map(r => hold(...r)))
  const got = sb.map(s => s.ticker)
  check(`한국 상장 미국 ETF(TIGER 미국S&P500) 제외 (${got.join(',')})`, !got.includes('360750'))
  check('미국 ETF(SPY)·코인도 제외', !got.includes('SPY') && !got.includes('KRW-BTC'))
  check('개별 주식 3종(한국·미국·해외 접미사)은 남는다', ['005930', 'AAPL', 'HEIA.AS'].every(t => got.includes(t)) && got.length === 3)
  const idxOf = t => D.indexFor(t, sb.find(s => s.ticker === t).market)?.name
  check('한국 주식 → 코스피', idxOf('005930') === '코스피')
  check('미국 주식 → 미국 S&P 500', idxOf('AAPL') === '미국 S&P 500')
  check('해외 접미사 주식(HEIA.AS) → 미국 S&P 500 (문서화된 한계)', idxOf('HEIA.AS') === '미국 S&P 500')
}

// ── 9. 수익률 · 지수 고르기 · vsIndex 한 줄 ──────────────────────────────
{
  check('returnSince 10%', Math.abs(D.returnSince(100, 110) - 10) < 1e-9)
  check('returnSince 시세 없음 → null (0% 로 만들지 않음)', D.returnSince(100, null) === null && D.returnSince(0, 110) === null)
  check('indexFor 한국 6자리 → 코스피', D.indexFor('005930', 'KR')?.symbol === '^KS11')
  check('indexFor 미국 → S&P 500', D.indexFor('AAPL', 'US')?.name === '미국 S&P 500')
  check('indexFor .KS 접미사 → 코스피', D.indexFor('000660.KS', 'US')?.symbol === '^KS11')
  check('indexFor 코인 → null', D.indexFor('KRW-BTC', 'CRYPTO') === null)
  const idx = D.indexFor('ONE', 'KR')
  const cands = [{ date: '2026-02-27', close: 2000 }, { date: '2026-03-03', close: 2050 }, { date: '2026-09-25', close: 2400 }]
  const b = { ticker: 'ONE', name: '원', market: 'KR', currency: 'KRW', buyDate: '2026-03-02', buyPrice: 1000, quantity: 10 }
  const r = D.buildVsIndexRow(b, 1100, idx, cands, TODAY)
  // 3/2 봉이 없어 직전 2/27(2000), 오늘 봉이 없어 직전 9/25(2400) → +20%
  check('vsIndex 한 줄: 날짜로 찾은 지수 +20% · 내 +10%', r && Math.abs(r.indexReturnPct - 20) < 1e-9 && Math.abs(r.returnPct - 10) < 1e-9 && r.indexName === '코스피')
  check('vsIndex 한 줄: 시세 없음 → null', D.buildVsIndexRow(b, null, idx, cands, TODAY) === null)
  check('vsIndex 한 줄: 산 날이 오늘 → null', D.buildVsIndexRow({ ...b, buyDate: TODAY }, 1100, idx, cands, TODAY) === null)
  check('vsIndex 한 줄: 산 날 지수 봉이 없음 → null', D.buildVsIndexRow({ ...b, buyDate: '2026-01-05' }, 1100, idx, cands, TODAY) === null)
}

// ── 샘플 출력(보고용) ────────────────────────────────────────────────────
console.log('\n── 샘플 ──')
for (const d of days4) console.log(JSON.stringify(T.pickTip(d, all())))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (오늘 알려드려요)')
process.exit(fail ? 1 : 0)
