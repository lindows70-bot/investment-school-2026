// '오늘 알려드려요' 규칙 검증 — 날짜 순환(8규칙)·빈 규칙 건너뛰기·문구 분기(PER·지수 대비·집중도·환율 효과·코어위성)·날짜로 종가 찾기·한 번만 산 종목 고르기·동종 PER 중앙값
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
  include: [`${ROOT}/src/lib/learnTips.ts`, `${ROOT}/src/lib/learnTipsData.ts`, `${ROOT}/src/lib/peerPerMedian.ts`],
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
for (const f of ['learnTips', 'learnTipsData', 'peerPerMedian', 'studentFormat', 'theme', 'assetClassifier', 'marketFlag']) {
  if (!existsSync(`${OUT}/lib/${f}.js`)) { console.log(`❌ 컴파일 결과 없음: ${f}.js`); process.exit(1) }
}

const require2 = Module.createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const T = require2(`${OUT}/lib/learnTips.js`)
const D = require2(`${OUT}/lib/learnTipsData.js`)
const P = require2(`${OUT}/lib/peerPerMedian.js`)

let fail = 0
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fail++ }

// ── 픽스처 ──────────────────────────────────────────────────────────────
const TODAY = '2026-09-26'
const addDays = (ymd, n) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n)).toISOString().slice(0, 10)
const perRow = (o = {}) => ({ ticker: 'AAPL', name: '애플', market: 'US', pe: 20, targetPeSameBasis: 21, perMedian: 30, perCount: 5, peBasis: 'trailing', asOf: null, ...o })
const vsRow = (o = {}) => ({ ticker: '005930', name: '삼성전자', market: 'KR', buyDate: '2026-09-01', returnPct: 5.2, indexName: '코스피', indexReturnPct: 3.0, indexStartDate: '2026-09-01', endDate: '2026-09-25', endComplete: true, ...o })
const concIn = (rows) => ({ rows })
const cRow = (o = {}) => ({ ticker: '000660', name: 'SK하이닉스', market: 'KR', weightPct: 76.5, ...o })
const fxIn = (o = {}) => ({ count: 3, retUsd: 10.0, retKrw: 7.4, exposurePct: 45.3, fxNow: 1359, ...o })
const csIn = (o = {}) => ({ corePct: 60, satPct: 40, coreCount: 2, satCount: 3, ...o })
const all = () => ({
  per: [perRow(), perRow({ ticker: 'MSFT', name: '마이크로소프트', pe: 40, targetPeSameBasis: 41 })],
  vsIndex: [vsRow()],
  concentration: concIn([cRow(), cRow({ ticker: '005930', name: '삼성전자', weightPct: 23.5 })]),
  fx: fxIn(),
  coreSat: csIn(),
  scale: scIn(),
  dividend: [dvRow(), dvRow({ ticker: 'AAPL', name: '애플', market: 'US', dividendYield: 0.0044 })],
  hi52: [h52Row(), h52Row({ ticker: 'AAPL', name: '애플', market: 'US', currency: 'USD', price: 230, high52w: 260, low52w: 170 })],
})
const scIn = (o = {}) => ({ counts: { stock: 12, coin: 1 }, rows: [{ asset: 'bond', name: '채권', ok: true, chip: '역풍' }, { asset: 'stock', name: '주식', ok: true, chip: '미국 역풍 · 한국 보통' }, { asset: 'coin', name: '코인', ok: true, chip: '보통' }], asOf: '2026-09-30T00:00:00.000Z', ...o })
const dvRow = (o = {}) => ({ ticker: '005930', name: '삼성전자', market: 'KR', dividendYield: 0.0142, asOf: null, ...o })
const h52Row = (o = {}) => ({ ticker: '005930', name: '삼성전자', market: 'KR', currency: 'KRW', price: 269500, high52w: 380000, low52w: 84100, asOf: null, ...o })
const only = (k, v) => ({ per: null, vsIndex: null, concentration: null, fx: null, coreSat: null, scale: null, dividend: null, hi52: null, [k]: v })
const N = 8   // 규칙 수

// ── 1. 날짜 순환 ─────────────────────────────────────────────────────────
const days4 = Array.from({ length: N }, (_, i) => addDays(TODAY, i))   // 이름은 그대로 두고 N일(규칙 수만큼)
const kinds4 = days4.map(d => T.pickTip(d, all())?.kind)
check(`연속 ${N}일 → 시작 규칙 ${N}가지 모두 다름 (${kinds4.join(',')})`, new Set(kinds4).size === N && kinds4.every(Boolean))
check(`${N + 1}일째는 1일째와 같은 규칙`, T.pickTip(addDays(TODAY, N), all())?.kind === kinds4[0])
check('같은 날 같은 입력 → 같은 결과', JSON.stringify(T.pickTip(TODAY, all())) === JSON.stringify(T.pickTip(TODAY, all())))
const perDay = days4[kinds4.indexOf('per')]
const rev = all(); rev.per.reverse()
check('입력 순서가 바뀌어도 같은 종목', T.pickTip(perDay, all()).ticker === T.pickTip(perDay, rev).ticker)
// 시작 규칙일 때: 규칙 수(5)일마다 한 칸
const perPicks = [0, N, 2 * N, 3 * N].map(n => T.pickTip(addDays(perDay, n), all()).ticker)
check(`시작 규칙이면 ${N}일마다 종목이 넘어간다 (${perPicks.join(',')})`, perPicks[0] !== perPicks[1] && perPicks[0] === perPicks[2] && new Set(perPicks).size === 2)
// 다음 규칙으로 넘어와 매일 쓰일 때: 매일 한 칸(day % n) — per 만 있으면 N일 중 N−1일이 fallback
{
  const fbDays = [1, 2, 3].map(n => addDays(perDay, n))
  const picks = fbDays.map(d => T.pickTip(d, only('per', all().per)).ticker)
  check(`다음 규칙으로 넘어온 날은 매일 종목이 넘어간다 (${picks.join(',')})`, picks[0] !== picks[1] && picks[1] !== picks[2])
}

// ── 2. 빈 규칙 건너뛰기 · 전부 없음 ──────────────────────────────────────
const RULES = ['per', 'vsIndex', 'concentration', 'fx', 'coreSat', 'scale', 'dividend', 'hi52']
const nextOf = k => RULES[(RULES.indexOf(k) + 1) % N]
for (const d of days4) {
  const k = T.pickTip(d, all()).kind
  const inp = all(); inp[k] = null
  check(`${d}: 시작 규칙 ${k} 입력 null → 다음 규칙 ${nextOf(k)}`, T.pickTip(d, inp)?.kind === nextOf(k))
}
{
  const inp = all(); inp.per = []; inp.vsIndex = []
  check('per·vsIndex 가 빈 배열 → concentration', T.pickTip(perDay, inp)?.kind === 'concentration')
}
check('전부 null → null', T.pickTip(TODAY, { per: null, vsIndex: null, concentration: null, fx: null, coreSat: null, scale: null, dividend: null, hi52: null }) === null)
check('전부 빈 값(종목 0·달러 0·역할 0·저울 줄 0·배당 0·52주 0) → null', T.pickTip(TODAY, { per: [], vsIndex: [], concentration: concIn([]), fx: fxIn({ count: 0 }), coreSat: csIn({ coreCount: 0, satCount: 0 }), scale: scIn({ counts: {}, rows: [] }), dividend: [], hi52: [] }) === null)
check('날짜 형식이 틀리면 null', T.pickTip('2026/09/26', all()) === null)

// ── 2-b. 규칙 순서(tipRuleOrder) — 화면이 이 순서로 한 규칙씩 불러 첫 문장에서 멈춘다 ──
{
  // 화면의 지연 불러오기 흉내 — 순서대로 한 규칙 입력만 더하고, 문장이 나오면 멈춘다
  const lazy = (d, full) => {
    const acc = { per: null, vsIndex: null, concentration: null, fx: null, coreSat: null, scale: null, dividend: null, hi52: null }
    for (const k of T.tipRuleOrder(d)) {
      acc[k] = full[k]
      const t = T.pickTip(d, acc)
      if (t) return { tip: t, loaded: k }
    }
    return { tip: null, loaded: null }
  }
  for (const d of days4) {
    const o = T.tipRuleOrder(d)
    check(`${d}: 순서는 ${N}규칙 한 바퀴 (${o.join(',')})`, o.length === N && new Set(o).size === N && RULES.every(k => o.includes(k)))
    check(`${d}: 순서의 첫 규칙 = pickTip 시작 규칙`, o[0] === T.pickTip(d, all()).kind)
    check(`${d}: 한 규칙씩 불러도 전부 넣은 것과 같은 결과`, JSON.stringify(lazy(d, all()).tip) === JSON.stringify(T.pickTip(d, all())))
    const sparse = all(); sparse.per = []; sparse.fx = null
    check(`${d}: 빈 규칙이 섞여도 같은 결과`, JSON.stringify(lazy(d, sparse).tip) === JSON.stringify(T.pickTip(d, sparse)))
  }
  check('날짜 형식이 틀리면 빈 순서', T.tipRuleOrder('2026/09/26').length === 0)
}

// ── 3. ① PER ─────────────────────────────────────────────────────────────
const DEF = 'PER은 주가가 회사가 1년 동안 번 1주당 이익의 몇 배인지를 뜻해요.'
{
  const lo = T.pickTip(TODAY, only('per', [perRow()]))
  check('PER 제목 = 화면 PER(stock-info)', lo.title === '애플 PER은 20.0배예요')
  check('PER 중앙값보다 낮음 → 비슷한 기업들보다 덜 비싸게', lo.body === `${DEF} 비슷한 기업 5곳의 중앙값 30.0배보다 낮아서, 버는 돈에 비해 비슷한 기업들보다 덜 비싸게 거래되고 있어요.`)
  check('PER 비교 출처', lo.source === '앱 종목 정보 · 비슷한 기업 비교')
  const hi = T.pickTip(TODAY, only('per', [perRow({ pe: 40, targetPeSameBasis: 38, perCount: 3 })]))
  check('PER 중앙값보다 높음 → 비슷한 기업들보다 비싸게', hi.body.endsWith('중앙값 30.0배보다 높아서, 버는 돈에 비해 비슷한 기업들보다 비싸게 거래되고 있어요.'))
  const eq = T.pickTip(TODAY, only('per', [perRow({ pe: 30.02, targetPeSameBasis: 30.01, perCount: 4 })]))
  check('PER 표시값이 같으면 → 비슷해요', eq.body.endsWith('중앙값 30.0배와 비슷해요.'))
  const split = T.pickTip(TODAY, only('per', [perRow({ pe: 29, targetPeSameBasis: 32 })]))
  check('화면 PER·같은 잣대 PER 이 중앙값 양쪽에 걸치면 → 비슷해요', split.body.endsWith('중앙값 30.0배와 비슷해요.'))
  // I1: 원천 불일치 — BABA 네이버 63 vs 야후 25 같은 경우 비교하지 않는다
  const baba = T.pickTip(TODAY, only('per', [perRow({ ticker: 'BABA', name: '알리바바', pe: 63, targetPeSameBasis: 25, perMedian: 20 })]))
  check('화면 PER 63 vs 같은 잣대 25 (15% 초과) → 비교 없음 · 제목은 63', baba.title === '알리바바 PER은 63.0배예요' && baba.body === DEF && baba.source === '앱 종목 정보')
  const edge15 = T.pickTip(TODAY, only('per', [perRow({ pe: 23, targetPeSameBasis: 20 })]))
  check('정확히 15% 차이(20 vs 23)는 비교', edge15.source.includes('비슷한 기업 비교'))
  const over15 = T.pickTip(TODAY, only('per', [perRow({ pe: 23.1, targetPeSameBasis: 20 })]))
  check('15% 넘는 차이(20 vs 23.1)는 비교 없음', over15.source === '앱 종목 정보')
  const noSb = T.pickTip(TODAY, only('per', [perRow({ targetPeSameBasis: null })]))
  check('같은 잣대 PER 없음 → 비교 없음', noSb.body === DEF)
  const few = T.pickTip(TODAY, only('per', [perRow({ perCount: 2 })]))
  check('동종 2곳(<3) → 비교 없음', few.body === DEF && few.source === '앱 종목 정보')
  const noMed = T.pickTip(TODAY, only('per', [perRow({ perMedian: null })]))
  check('중앙값 null → 비교 없음', !noMed.body.includes('중앙값'))
  const annual = T.pickTip(TODAY, only('per', [perRow({ ticker: '005930', name: '삼성전자', market: 'KR', pe: 12.34, targetPeSameBasis: null, peBasis: 'annual' })]))
  check('peBasis annual → 직전 결산 연도 문장', annual.title === '삼성전자 PER은 12.3배예요' && annual.body === `${DEF} 이 숫자는 직전 결산 연도 이익 기준이에요.`)
  const krCmp = T.pickTip(TODAY, only('per', [perRow({ ticker: '005930', name: '삼성전자', market: 'KR', pe: 12, targetPeSameBasis: 12.5, perMedian: 20, perCount: 6 })]))
  check('국내 종목 비교 → "(해외 기업 포함)" 표기', krCmp.body === `${DEF} 비슷한 기업 6곳(해외 기업 포함)의 중앙값 20.0배보다 낮아서, 버는 돈에 비해 비슷한 기업들보다 덜 비싸게 거래되고 있어요.`)
  check('미국 종목 비교 → 해외 기업 표기 없음', !T.pickTip(TODAY, only('per', [perRow()])).body.includes('해외 기업'))
  const unknown = T.pickTip(TODAY, only('per', [perRow({ market: 'KR', peBasis: null, targetPeSameBasis: null })]))
  check('peBasis 모름 → 기준 문장 없음', unknown.body === DEF)
  check('asOf 없으면 생략', !('asOf' in unknown))
  const withAsOf = T.pickTip(TODAY, only('per', [perRow({ asOf: '2026-09-26T03:00:00Z' })]))
  check('asOf 있으면 날짜로', withAsOf.asOf === '2026-09-26')
  check('ETF(pe null)만 있으면 PER 규칙 없음 → null', T.pickTip(TODAY, only('per', [perRow({ ticker: '360750', name: 'TIGER 미국S&P500', market: 'KR', pe: null })])) === null)
  const mixed = T.pickTip(TODAY, only('per', [
    perRow({ ticker: '360750', name: 'TIGER', market: 'KR', pe: null }),
    perRow({ ticker: 'BTC', name: '비트코인', market: 'CRYPTO', pe: 0 }),
    perRow({ ticker: 'LOSS', name: '적자기업', pe: -5 }),
    perRow(),
  ]))
  check('ETF·코인·음수 PER 은 건너뛰고 주식을 고른다', mixed?.ticker === 'AAPL')
}

// ── 3-b. 동종 PER 중앙값(getSectorPeers 가 쓰는 peerPerMedian) ────────────
{
  const r = P.peerPerMedian('Apple Inc.', [
    { name: 'Alphabet Inc.', pe: 20 }, { name: 'Alphabet Inc. Class C', pe: 21 },      // GOOGL/GOOG → 한 곳
    { name: 'Berkshire Hathaway Inc. Class A', pe: 10 }, { name: 'Berkshire Hathaway Inc. Class B', pe: 11 },
    { name: 'Microsoft Corporation', pe: 30 }, { name: 'Apple Inc.', pe: 99 },          // 대상과 같은 회사 → 제외
    { name: 'Loss Co', pe: -3 }, { name: 'NoPe Co', pe: null },
  ])
  check(`같은 회사 다른 주식은 한 곳 · 대상 제외 · 양수만 (count ${r.perCount}, median ${r.perMedian})`, r.perCount === 3 && r.perMedian === 20)
  check('3곳 미만 → 중앙값 null · 개수는 그대로', (() => { const x = P.peerPerMedian('A', [{ name: 'B', pe: 10 }, { name: 'C', pe: 20 }]); return x.perMedian === null && x.perCount === 2 })())
  check('짝수 개 → 가운데 둘 평균', P.peerPerMedian('A', [{ name: 'B', pe: 10 }, { name: 'C', pe: 20 }, { name: 'D', pe: 30 }, { name: 'E', pe: 41 }]).perMedian === 25)
  check('대상의 다른 주식 종류(Alphabet A vs C)도 제외', P.peerPerMedian('Alphabet Inc. Class A', [{ name: 'Alphabet Inc. Class C', pe: 20 }, { name: 'X', pe: 1 }, { name: 'Y', pe: 2 }]).perCount === 2)
}

// ── 4. ② 산 뒤 대 지수 ───────────────────────────────────────────────────
{
  const ahead = T.pickTip(TODAY, only('vsIndex', [vsRow()]))
  check('앞섬 제목', ahead.title === '삼성전자는 산 뒤 +5.2%, 같은 기간 코스피 +3.0%')
  check('앞섬 본문 · 끝 날짜 · 코스피 기준', ahead.body === '산 날(9/1)부터 9/25까지 비교했어요(코스피 기준). 코스피보다 2.2%p 앞섰어요.')
  check('완성 봉 → 출처에 종가 · 기준일', ahead.source === '내 거래 기록 · 코스피 종가 (9/25 기준)' && ahead.asOf === '2026-09-25')
  check('앞섬 tone=up', ahead.tone === 'up')
  const live = T.pickTip(TODAY, only('vsIndex', [vsRow({ endDate: TODAY, endComplete: false })]))
  check('진행 중 봉 → 출처에 종가 없음', live.source === '내 거래 기록 · 코스피 (9/26 기준)' && live.body.includes('9/26까지'))
  const gap = T.pickTip(TODAY, only('vsIndex', [vsRow({ buyDate: '2026-09-06', indexStartDate: '2026-09-04' })]))
  check('지수 시작일 ≠ 산 날 → (지수는 M/D 종가부터)', gap.body.startsWith('산 날(9/6)부터 9/25까지 비교했어요(지수는 9/4 종가부터 · 코스피 기준).'))
  const behind = T.pickTip(TODAY, only('vsIndex', [vsRow({ returnPct: -2.0, indexReturnPct: 1.5 })]))
  check('뒤처짐 본문 · 음수 부호 − · tone=down', behind.body.endsWith('코스피보다 3.5%p 뒤처졌어요.') && behind.title.includes('−2.0%') && behind.tone === 'down')
  check('±0.5%p 안 → 비슷해요', T.pickTip(TODAY, only('vsIndex', [vsRow({ returnPct: 3.3 })])).body.endsWith('코스피와 비슷해요.'))
  check('정확히 0.5%p → 앞섰어요(밴드 밖)', T.pickTip(TODAY, only('vsIndex', [vsRow({ returnPct: 3.5 })])).body.endsWith('0.5%p 앞섰어요.'))
  check('내 수익 보합 → tone=flat', T.pickTip(TODAY, only('vsIndex', [vsRow({ returnPct: 0.02 })])).tone === 'flat')
  const sp = T.pickTip(TODAY, only('vsIndex', [vsRow({ ticker: 'AAPL', name: '애플', market: 'US', buyDate: '2025-08-04', indexStartDate: '2025-08-04', returnPct: 1.0, indexName: '미국 S&P 500', indexReturnPct: 1.2 })]))
  check('받침 조사: 애플은 · S&P 500과 · 코스피 기준 없음', sp.title.startsWith('애플은 산 뒤') && sp.body.endsWith('미국 S&P 500과 비슷해요.') && !sp.body.includes('코스피'))
  check('올해가 아니면 연도 표기(2025/8/4)', sp.body.startsWith('산 날(2025/8/4)부터 9/25까지'))
  check('산 날이 오늘이면 제외 → null', T.pickTip(TODAY, only('vsIndex', [vsRow({ buyDate: TODAY })])) === null)
  check('수익률이 NaN 이면 제외 → null', T.pickTip(TODAY, only('vsIndex', [vsRow({ returnPct: NaN })])) === null)
}

// ── 4-b. 받침 조사 ───────────────────────────────────────────────────────
{
  const title = name => T.pickTip(TODAY, only('vsIndex', [vsRow({ name })])).title
  check('긴 영문 이름(NVIDIA) → 은(는)', title('NVIDIA').startsWith('NVIDIA은(는) 산 뒤'))
  check('3글자 이하 약어 AMD → 는', title('AMD').startsWith('AMD는 산 뒤'))
  check('약어 LG → 는 · 약어 IBM → 은', title('LG').startsWith('LG는') && title('IBM').startsWith('IBM은'))
  check('한글+숫자(TIGER 200) → 은(백)', title('TIGER 200').startsWith('TIGER 200은'))
  check('카카오 → 는', title('카카오').startsWith('카카오는'))
}

// ── 5. ③ 집중도 ──────────────────────────────────────────────────────────
{
  const half = T.pickTip(TODAY, only('concentration', concIn([cRow(), cRow({ ticker: '005930', name: '삼성전자', weightPct: 23.5 })])))
  check('절반 넘게 → "내 자산의 76.5%가 SK하이닉스 한 종목이에요"', half.title === '내 자산의 76.5%가 SK하이닉스 한 종목이에요' && half.ticker === '000660' && half.market === 'KR')
  check('절반 넘게 본문 — 분산 설명 + 사라·팔라는 뜻 아님', half.body.startsWith('한 종목이 절반 넘게 차지하면') && half.body.endsWith('사라는 뜻도 팔라는 뜻도 아니에요.'))
  check('출처 = 종목 수 · 평가액 기준', half.source === '내 자산 2종목 · 지금 평가액 기준')
  const big = T.pickTip(TODAY, only('concentration', concIn([cRow({ weightPct: 41.8 }), cRow({ ticker: '005930', name: '삼성전자', weightPct: 41.1 }), cRow({ ticker: 'PLTR', name: 'PALANTIR', market: 'US', weightPct: 12.3 })])))
  check('30% 넘게 → 같은 제목꼴 · 30% 본문', big.title === '내 자산의 41.8%가 SK하이닉스 한 종목이에요' && big.body.startsWith('한 종목이 30%를 넘으면'))
  const spread = T.pickTip(TODAY, only('concentration', concIn([cRow({ weightPct: 28 }), cRow({ ticker: 'A', name: 'A', weightPct: 26 }), cRow({ ticker: 'B', name: 'B', weightPct: 24 }), cRow({ ticker: 'C', name: 'C', weightPct: 22 })])))
  check('30% 미만 → "가장 큰 종목은 …" · 나눠 있어요 본문', spread.title === '가장 큰 종목은 SK하이닉스, 내 자산의 28%예요' && spread.body.startsWith('가장 큰 종목도 30%가 안 돼서'))
  check('가장 큰 종목 하나만(입력 순서 무관)', T.pickTip(TODAY, only('concentration', concIn([cRow({ ticker: 'X', name: 'X', weightPct: 10 }), cRow({ weightPct: 90 })]))).ticker === '000660')
  check('비중 0·NaN 뿐이면 → null', T.pickTip(TODAY, only('concentration', concIn([cRow({ weightPct: 0 }), cRow({ weightPct: NaN })]))) === null)
  check('종목 없음 → null', T.pickTip(TODAY, only('concentration', concIn([]))) === null)
  check('tone 없음(등락 이야기가 아니다)', !('tone' in half))
}

// ── 6. ④ 환율 효과 ────────────────────────────────────────────────────────
{
  const cut = T.pickTip(TODAY, only('fx', fxIn()))
  check('원화 7.4% − 달러 10.0% = −2.6%p → 깎았어요 · tone down', cut.title === '환율이 내 달러 종목 수익률을 2.6%p 깎았어요' && cut.tone === 'down')
  check('본문 — 달러/원화 수익률 · 달러가 싸져서 · 노출 45%', cut.body === '달러로 보면 +10.0%, 원화로 바꾸면 +7.4%예요 — 그 차이가 환율 효과예요. 산 날보다 원·달러가 내려서(달러가 싸져서) 생긴 차이예요. 내 자산의 45%가 환율에 노출돼 있어요. 환율은 맞힐 수 없어서 지난 일만 봤어요.')
  check('출처 = 종목 수 · 지금 환율', cut.source === '내 달러 종목 3종 · 매입일 환율 대비 지금 1,359.00원')
  const lift = T.pickTip(TODAY, only('fx', fxIn({ retUsd: -3.0, retKrw: 1.2, exposurePct: null })))
  check('원화가 더 높으면 → 올렸어요(4.2%p) · 달러가 비싸져서 · 노출 문장 없음 · tone up', lift.title === '환율이 내 달러 종목 수익률을 4.2%p 올렸어요' && lift.body.includes('올라서(달러가 비싸져서)') && !lift.body.includes('노출') && lift.tone === 'up')
  const flat = T.pickTip(TODAY, only('fx', fxIn({ retUsd: 5.0, retKrw: 5.02 })))
  check('차이 0.05%p 미만 → 거의 안 움직였어요 · 비슷해서 · tone flat', flat.title === '환율은 내 달러 종목 수익률을 거의 안 움직였어요' && flat.body.includes('거의 같아요') && flat.tone === 'flat')
  check('달러 종목 없음(count 0) → null', T.pickTip(TODAY, only('fx', fxIn({ count: 0 }))) === null)
  check('환율 0·NaN → null', T.pickTip(TODAY, only('fx', fxIn({ fxNow: 0 }))) === null && T.pickTip(TODAY, only('fx', fxIn({ retKrw: NaN }))) === null)
}

// ── 6-b. ⑤ 코어·위성 ──────────────────────────────────────────────────────
{
  const mix = T.pickTip(TODAY, only('coreSat', csIn()))
  check('섞여 있음 → "코어 60% · 위성 40%" · 최일 전략으로', mix.title === '내 자산은 코어 60% · 위성 40%예요' && mix.body.endsWith("'최일 전략' 수업의 코어·위성 원칙을 보세요."))
  check('본문 앞 = 코어/위성 뜻 + 내가 정한 것', mix.body.startsWith('코어는 오래 들고 갈 큰 회사·지수 ETF, 위성은 더 크게 오르내릴 수 있는 종목이에요. 어느 쪽인지는 기록할 때 내가 정한 거예요.'))
  const allSat = T.pickTip(TODAY, only('coreSat', csIn({ corePct: 0, satPct: 100, coreCount: 0, satCount: 2 })))
  check('전부 위성 → 종목 수 · 크게 흔들릴 수 있어요', allSat.title === '내 자산은 전부 위성(2종목)이에요' && allSat.body.endsWith('코어가 없으면 자산 전체가 위성처럼 크게 흔들릴 수 있어요.'))
  const allCore = T.pickTip(TODAY, only('coreSat', csIn({ corePct: 100, satPct: 0, coreCount: 3, satCount: 0 })))
  check('전부 코어 → 기회도 적어요', allCore.title === '내 자산은 전부 코어(3종목)예요' && allCore.body.endsWith('크게 오를 기회도 그만큼 적어요.'))
  check('비중 반올림(59.6 → 60)', T.pickTip(TODAY, only('coreSat', csIn({ corePct: 59.6, satPct: 40.4 }))).title === '내 자산은 코어 60% · 위성 40%예요')
  check('종목 0 → null', T.pickTip(TODAY, only('coreSat', csIn({ coreCount: 0, satCount: 0 }))) === null)
  check('tone 없음 · 종목 링크 없음', !('tone' in mix) && !('ticker' in mix))
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

// ── 7-b. 봉 완성 판정(dropIncompleteBar 와 같은 규칙) ──────────────────────
{
  const at = iso => Date.parse(iso)
  check('KR 봉: 20:34 KST(11:34Z) → 미완성', D.isBarComplete('2026-09-25', 'KR', at('2026-09-25T11:34:00Z')) === false)
  check('KR 봉: 20:35 KST(11:35Z) → 완성', D.isBarComplete('2026-09-25', 'KR', at('2026-09-25T11:35:00Z')) === true)
  check('US 봉: 21:34Z → 미완성 · 21:35Z → 완성', D.isBarComplete('2026-09-25', 'US', at('2026-09-25T21:34:00Z')) === false && D.isBarComplete('2026-09-25', 'US', at('2026-09-25T21:35:00Z')) === true)
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

// ── 8-b. 지수 비교는 한국·미국 개별 주식만 (상장 시장 ≠ 자산의 국적) ───────
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
  const idxOf = t => D.indexFor(t, rows.find(r => r[0] === t)[2])
  check('한국 주식 → 코스피', idxOf('005930')?.name === '코스피')
  check('미국 주식 → 미국 S&P 500', idxOf('AAPL')?.name === '미국 S&P 500')
  check('한국·미국 밖 주식(HEIA.AS 🇳🇱) → 비교 지수 없음(null)', idxOf('HEIA.AS') === null)
  check('일본 주식(7203.T) → null · 코인 → null', D.indexFor('7203.T', 'US') === null && D.indexFor('KRW-BTC', 'CRYPTO') === null)
  check('.KS 접미사 → 코스피', D.indexFor('000660.KS', 'US')?.symbol === '^KS11')
}

// ── 9. 수익률 · vsIndex 한 줄 ────────────────────────────────────────────
{
  check('returnSince 10%', Math.abs(D.returnSince(100, 110) - 10) < 1e-9)
  check('returnSince 시세 없음 → null (0% 로 만들지 않음)', D.returnSince(100, null) === null && D.returnSince(0, 110) === null)
  const idx = D.indexFor('005930', 'KR')
  const cands = [{ date: '2026-02-27', close: 2000 }, { date: '2026-03-03', close: 2050 }, { date: '2026-09-25', close: 2400 }]
  const b = { ticker: '005930', name: '삼성전자', market: 'KR', currency: 'KRW', buyDate: '2026-03-02', buyPrice: 1000, quantity: 10 }
  const NOW_AFTER = Date.parse('2026-09-26T12:00:00Z')
  const r = D.buildVsIndexRow(b, 1100, idx, cands, TODAY, NOW_AFTER)
  // 3/2 봉이 없어 직전 2/27(2000), 오늘 봉이 없어 직전 9/25(2400) → +20%
  check('vsIndex 한 줄: 날짜로 찾은 지수 +20% · 내 +10%', r && Math.abs(r.indexReturnPct - 20) < 1e-9 && Math.abs(r.returnPct - 10) < 1e-9 && r.indexName === '코스피')
  check('vsIndex 한 줄: indexStartDate 2/27 · endDate 9/25 · 완성', r.indexStartDate === '2026-02-27' && r.endDate === '2026-09-25' && r.endComplete === true)
  const withToday = cands.concat([{ date: TODAY, close: 2460 }])
  const live = D.buildVsIndexRow(b, 1100, idx, withToday, TODAY, Date.parse('2026-09-26T03:00:00Z'))   // 12:00 KST — 장중
  check('오늘 진행 중 봉 → 버리지 않고 endComplete=false', live.endDate === TODAY && live.endComplete === false && Math.abs(live.indexReturnPct - 23) < 1e-9)
  check('vsIndex 한 줄: 시세 없음 → null', D.buildVsIndexRow(b, null, idx, cands, TODAY, NOW_AFTER) === null)
  check('vsIndex 한 줄: 산 날이 오늘 → null', D.buildVsIndexRow({ ...b, buyDate: TODAY }, 1100, idx, cands, TODAY, NOW_AFTER) === null)
  check('vsIndex 한 줄: 산 날 지수 봉이 없음 → null', D.buildVsIndexRow({ ...b, buyDate: '2026-01-05' }, 1100, idx, cands, TODAY, NOW_AFTER) === null)
  // 한 줄 → 문구까지 이어서
  const tip = T.pickTip(TODAY, only('vsIndex', [r]))
  check('한 줄 → 문구: 지수 시작일이 산 날과 다름을 밝힌다', tip.body === '산 날(3/2)부터 9/25까지 비교했어요(지수는 2/27 종가부터 · 코스피 기준). 코스피보다 10.0%p 뒤처졌어요.')
}

// ── 6. ⑥ 저울 연결 · ⑦ 배당 · ⑧ 52주 위치(2026-09-30 확장) ─────────────
{
  const sc = T.pickTip(TODAY, only('scale', scIn()))
  check('⑥ 제목 = 가장 많은 줄(주식 12종)', sc?.title === '내 자산 12종은 저울의 주식 줄이에요')
  check('⑥ 본문 = 오늘 그 줄의 칩 + 원칙 설명 + 다른 줄', sc?.body === "오늘 주식 줄의 계절 칸은 '미국 역풍 · 한국 보통'이에요. 순풍·역풍은 지금 계절이 그 자산에 유리한지 불리한지를 말하는 수업 원칙이고, 사라는 뜻도 팔라는 뜻도 아니에요. 그 밖에 코인 1종도 있어요.")
  check('⑥ 출처·저울 링크·기준일', sc?.source === '투자학교 저울 · 오늘 ③ 계절 칸' && sc?.link?.href === '/s/scale' && sc?.asOf === '2026-09-30' && !sc?.ticker)
  const held = T.pickTip(TODAY, only('scale', scIn({ rows: [{ asset: 'stock', name: '주식', ok: false, chip: null }, { asset: 'coin', name: '코인', ok: true, chip: '보통' }] })))
  check('⑥ 가장 많은 줄이 쉬는 날 → 다음 줄(코인 1종) · 쉬는 줄의 종목도 "그 밖에"로 센다', held?.title === '내 자산 1종은 저울의 코인 줄이에요' && held?.body.endsWith('그 밖에 주식 12종도 있어요.'))
  check('⑥ 전 줄이 쉬면 null', T.pickTip(TODAY, only('scale', scIn({ rows: [{ asset: 'stock', name: '주식', ok: false, chip: null }] }))) === null)
  check('⑥ 내 종목이 저울 줄에 하나도 없으면 null', T.pickTip(TODAY, only('scale', scIn({ counts: {} }))) === null)
  check("⑥ 명령어(사세요·파세요) 없음", !/사세요|파세요|팔아야|사야/.test(`${sc?.title} ${sc?.body}`))

  const dv = T.pickTip(TODAY, only('dividend', [dvRow()]))
  check('⑦ 제목 = 배당수익률 소수 둘째 자리(1.42%)', dv?.title === '삼성전자 배당수익률은 1.42%예요')
  check('⑦ 본문 = 뜻 + 배당 주는 종목 수 + 1년치로 잡은 값 설명', dv?.body === '배당은 회사가 번 돈의 일부를 주주에게 나눠 주는 거예요. 1년 배당금을 주가로 나눈 것이 배당수익률이에요. 살펴본 내 종목 1종 중 1종이 배당을 줘요. 최근 배당을 1년치로 잡은 값이라 배당이 막 오른 종목은 지난 1년 실제보다 높게 나와요.')
  check('⑦ 출처 = 더 알아보기와 같은 값 · 종목 링크', dv?.source === '앱 종목 정보(더 알아보기와 같은 값)' && dv?.ticker === '005930')
  check('⑦ 배당 없는 종목만이면 null', T.pickTip(TODAY, only('dividend', [dvRow({ dividendYield: null }), dvRow({ ticker: 'X', dividendYield: 0 })])) === null)
  check('⑦ 종목 수 = 살펴본 전체 vs 배당 있는 것', T.pickTip(TODAY, only('dividend', [dvRow(), dvRow({ ticker: 'X', name: 'X', dividendYield: null })]))?.body.includes('2종 중 1종'))

  const h = T.pickTip(TODAY, only('hi52', [h52Row()]))
  check('⑧ 제목 = 1년 최저~최고 사이 %(269,500 → 63%)', h?.title === '삼성전자는 1년 최저~최고 사이 63% 지점이에요')
  check('⑧ 본문 = 최저·최고·지금 원화 표기 + 자리일 뿐', h?.body.startsWith('지난 1년 최저 84,100원 · 최고 380,000원, 지금 269,500원이에요(0% = 최저, 100% = 최고).') && T.pickTip(TODAY, only('hi52', [h52Row({ ticker: 'AAPL', name: '애플', market: 'US', currency: 'USD', price: 230, high52w: 260, low52w: 170 })]))?.body.includes('지금 $230.00이에요') && h?.body.includes('비싸다는 뜻도') && h?.body.includes('싸다는 뜻도'))
  const usd = T.pickTip(TODAY, only('hi52', [h52Row({ ticker: 'AAPL', name: '애플', market: 'US', currency: 'USD', price: 230, high52w: 260, low52w: 170 })]))
  check('⑧ 달러 종목은 달러 표기 · 조사 은/는(애플은)', usd?.title.startsWith('애플은 1년 최저~최고 사이 67% 지점') && usd?.body.includes('$'))
  check('⑧ 최고 ≤ 최저·값 없음 → 건너뜀 → null', T.pickTip(TODAY, only('hi52', [h52Row({ high52w: 84100 }), h52Row({ ticker: 'Y', high52w: null })])) === null)
  check('⑧ 시세가 최고보다 높아도 100% 로 자른다', T.pickTip(TODAY, only('hi52', [h52Row({ price: 400000 })]))?.title.includes('100% 지점'))
  check('⑥⑦⑧ 순서 = 코어·위성 다음', RULES.slice(5).join(',') === 'scale,dividend,hi52' && T.tipRuleOrder(TODAY).length === N)
}

// ── 샘플 출력(보고용) ────────────────────────────────────────────────────
console.log('\n── 샘플 ──')
for (const d of days4) console.log(JSON.stringify(T.pickTip(d, all())))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (오늘 알려드려요)')
process.exit(fail ? 1 : 0)
