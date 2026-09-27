// 환율 채택 검증 — 실제 환율만 live, 고정 상수(stale-constant)·조회 실패는 live=false(= 그 결과는 캐시하지 않는다)
//   + 1순위 원천 하나은행 매매기준율(fxHana) 파싱 — 하나은행 행만·100엔당 엔화·고시일은 같은 값일 때만·멈춘 고시·빠진 통화
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-fx-live`

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
  // next-env.d.ts — fxHana 의 fetch(..., { next: { revalidate } }) 타입(Next 가 RequestInit 을 넓힌다)
  include: [`${ROOT}/next-env.d.ts`, `${ROOT}/src/lib/fx.ts`, `${ROOT}/src/lib/fxAccept.ts`, `${ROOT}/src/lib/fxHana.ts`],
}
writeFileSync(`${ROOT}/.bt-fx-live.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일이 실패해도 옛 .js 로 거짓 green 을 낸다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-fx-live.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/fx.js`) || !existsSync(`${OUT}/lib/fxHana.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/lib/…' 별칭 → 컴파일 산출물(실제 lib 을 그대로 검증한다 — 재구현 금지)
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, `${OUT}/${req.slice(2)}`, ...rest)
  return orig.call(this, req, ...rest)
}
const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/fx.js`)
const H = require(`${OUT}/lib/fxHana.js`)

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}
const F = M.USD_KRW_FALLBACK
const same = (a, b) => a.rate === b.rate && a.live === b.live

// ── 순수 판정(readUsdKrw) ──
check('외부 2순위(fawazahmed0) 환율 → 그 값·live', same(M.readUsdKrw({ rate: 1391.25, source: 'fawazahmed0' }), { rate: 1391.25, live: true }))
check('외부 3순위(exchangerate-api) 환율 → 그 값·live', same(M.readUsdKrw({ rate: 1402.5, source: 'exchangerate-api' }), { rate: 1402.5, live: true }))
check('마지막 성공 환율(last-good) → 실제 과거 환율이라 live', same(M.readUsdKrw({ rate: 1388, source: 'last-good' }), { rate: 1388, live: true }))
check('고정 상수(stale-constant) → 값은 같아도 live 아님', same(M.readUsdKrw({ rate: F, source: 'stale-constant' }), { rate: F, live: false }))
check('스케일 오류(500 이하) → 폴백·live 아님', same(M.readUsdKrw({ rate: 13.9, source: 'fawazahmed0' }), { rate: F, live: false }))
check('rate 가 문자열 → 폴백·live 아님', same(M.readUsdKrw({ rate: '1391', source: 'fawazahmed0' }), { rate: F, live: false }))
check('rate NaN → 폴백·live 아님', same(M.readUsdKrw({ rate: NaN }), { rate: F, live: false }))
check('rate 없음 → 폴백·live 아님', same(M.readUsdKrw({ source: 'fawazahmed0' }), { rate: F, live: false }))
check('null 응답 → 폴백·live 아님', same(M.readUsdKrw(null), { rate: F, live: false }))
check('source 없는 정상 값(하위호환) → live', same(M.readUsdKrw({ rate: 1400.01 }), { rate: 1400.01, live: true }))
check('1순위 하나은행(hana) → 그 값·live', same(M.readUsdKrw({ rate: 1359, source: 'hana', noticeDate: '2026-09-23', noticeRound: 6255 }), { rate: 1359, live: true }))

// ── 네트워크 경로(fetchUsdKrw) — fetch 를 바꿔 끼워 세 갈래를 확인 ──
const realFetch = globalThis.fetch
const mock = (impl) => { globalThis.fetch = impl }
mock(async () => ({ ok: true, json: async () => ({ rate: 1391.25, source: 'fawazahmed0' }) }))
check('fetch 성공 → live', same(await M.fetchUsdKrw('http://x'), { rate: 1391.25, live: true }))
check('getUsdKrw 값 불변(정상 환율 그대로)', (await M.getUsdKrw('http://x')) === 1391.25)
mock(async () => ({ ok: true, json: async () => ({ rate: F, source: 'stale-constant' }) }))
check('HTTP 200 이지만 stale-constant → live 아님(이전엔 live 로 잘못 판정)', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
check('stale-constant 일 때 getUsdKrw 값은 이전과 같다(상수)', (await M.getUsdKrw('http://x')) === F)
mock(async () => ({ ok: false, json: async () => ({}) }))
check('HTTP 오류 → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
mock(async () => { throw new Error('timeout') })
check('fetch 예외(타임아웃) → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
mock(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad json') } }))
check('JSON 파싱 실패 → 폴백·live 아님', same(await M.fetchUsdKrw('http://x'), { rate: F, live: false }))
globalThis.fetch = realFetch

// ── 하나은행 매매기준율 파싱(fxHana) — 실측 응답(2026-09-27, 추석 연휴 중 · 마지막 고시 09-23 회차 6255)의 필드 모양 그대로 ──
const hanaRow = (code, close, bank = 'HANA') => ({ reutersCode: `FX_${code}KRW`, stockExchangeType: { code: bank }, closePrice: close, degreeCount: 6255, localTradedAt: '2026-09-26T05:45:27+09:00' })
const LIST = {
  normalList: [
    { reutersCode: '.DXY', stockExchangeType: { code: 'IUS' }, closePrice: '100.97' },
    hanaRow('USD', '1,359.00', 'SHB'),   // 다른 은행 행이 먼저 와도 하나은행 행만 받는다
    hanaRow('DKK', '207.14'), hanaRow('USD', '1,359.00'), hanaRow('SEK', '137.08'), hanaRow('CHF', '1,640.41'),
    hanaRow('GBP', '1,800.13'), hanaRow('EUR', '1,548.44'), hanaRow('JPY', '864.09'), hanaRow('CNY', '202.13'), hanaRow('HKD', '173.25'),
    hanaRow('VND', '5.24'),
  ],
  majorList: [hanaRow('USD', '1,359.00'), { reutersCode: 'EURUSD', closePrice: '1.1391' }],
}
const NEED = H.FX_NEED
const p = H.parseHanaList(LIST, NEED)
check('목록 → USD 1,359.00 · 회차 6255', p && p.rates.USD === 1359 && p.round === 6255)
check('100엔당 고시 864.09 → 1엔당 8.6409', p && Math.abs(p.rates.JPY - 8.6409) < 1e-9)
check('유로·스위스·파운드 그대로(1단위당)', p && p.rates.EUR === 1548.44 && p.rates.CHF === 1640.41 && p.rates.GBP === 1800.13)
check('필요 통화 8종 + USD + KRW:1 만(베트남 동 등 안 씀)', p && p.rates.KRW === 1 && NEED.every(c => p.rates[c] > 0) && p.rates.VND === undefined && Object.keys(p.rates).length === NEED.length + 2)
check('다른 은행(SHB) 행만 있으면 USD 없음 → null', H.parseHanaList({ normalList: [hanaRow('USD', '1,359.00', 'SHB')] }, NEED) === null)
check('USD 스케일 오류(1.359) → null', H.parseHanaList({ normalList: [hanaRow('USD', '1.359')] }, NEED) === null)
check('엔화가 1엔당(8.64)으로 바뀌어 와도 그대로', H.parseHanaList({ normalList: [hanaRow('USD', '1,359.00'), hanaRow('JPY', '8.64')] }, NEED).rates.JPY === 8.64)
check('빈 응답·모양 다름 → null', H.parseHanaList(null, NEED) === null && H.parseHanaList({ foo: 1 }, NEED) === null)

const ROWS = [{ localTradedAt: '2026-09-23', closePrice: '1,359.00' }]
check('고시일 = 일별 첫 행(값이 같을 때) → 2026-09-23', H.parseHanaNoticeDate(ROWS, 1359) === '2026-09-23')
check('일별 첫 행 값이 다르면(다른 회차) 고시일 null — 지어내지 않는다', H.parseHanaNoticeDate(ROWS, 1362.3) === null)
check('일별 응답 없음 → null', H.parseHanaNoticeDate(null, 1359) === null && H.parseHanaNoticeDate([], 1359) === null)
const NOW = Date.parse('2026-09-27T12:00:00+09:00')
check('추석 연휴(4일 전 고시) → 멈춘 게 아님', H.isHanaStale('2026-09-23', NOW) === false)
check('10일 넘은 고시 → 멈춤', H.isHanaStale('2026-09-16', NOW) === true)
check('고시일 모름 → 멈춤으로 보지 않음', H.isHanaStale(null, NOW) === false)

const route = (list, rows) => async (url) => {
  const body = String(url).includes('/prices') ? rows : list
  if (body === 'fail') throw new Error('timeout')
  return { ok: body != null, json: async () => body }
}
mock(route(LIST, ROWS))
let f = await H.fetchHanaFx(NEED, 1000, NOW)
check('fetchHanaFx 정상 → 1,359 · 고시일 09-23 · 회차 6255', f && f.rate === 1359 && f.noticeDate === '2026-09-23' && f.noticeRound === 6255 && f.rates.JPY < 20)
mock(route(LIST, 'fail'))
f = await H.fetchHanaFx(NEED, 1000, NOW)
check('일별 조회만 실패 → 환율은 쓰고 고시일 null', f && f.rate === 1359 && f.noticeDate === null)
mock(route('fail', ROWS))
check('목록 실패 → null(다음 원천)', (await H.fetchHanaFx(NEED, 1000, NOW)) === null)
mock(route({ normalList: LIST.normalList.filter(r => !String(r.reutersCode).includes('DKK')) }, ROWS))
check('통화 하나(DKK)라도 빠지면 → null(원천 섞지 않는다)', (await H.fetchHanaFx(NEED, 1000, NOW)) === null)
mock(route(LIST, [{ localTradedAt: '2026-08-01', closePrice: '1,359.00' }]))
check('고시가 멈춤(두 달 전) → null', (await H.fetchHanaFx(NEED, 1000, NOW)) === null)
globalThis.fetch = realFetch

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (환율 live 판정)')
process.exit(fail ? 1 : 0)
