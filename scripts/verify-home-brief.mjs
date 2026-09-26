// 홈 한눈 시황(homeBrief) 검증 — 모름(null)이 0·'없음'으로 둔갑하지 않고, 날짜 창·중복·KST 경계를 규칙대로 지키는지
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-home-brief`

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
  include: [`${ROOT}/src/lib/homeBrief.ts`, `${ROOT}/src/lib/studentFormat.ts`, `${ROOT}/src/lib/theme.ts`],
}
writeFileSync(`${ROOT}/.bt-home-brief.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 이번 컴파일이 타입 에러로 아무것도 못 내놔도
// existsSync가 옛 .js를 발견해 거짓 green을 낸다.
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-home-brief.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}

if (!existsSync(`${OUT}/lib/homeBrief.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/…' 별칭을 이번 컴파일 결과로 돌린다(실제 lib 을 그대로 검증 — 재구현 금지)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }

const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/homeBrief.js`)

let fail = 0
function check(label, cond) {
  if (cond) {
    console.log(`✅ ${label}`)
  } else {
    console.log(`❌ ${label}`)
    fail++
  }
}

const TODAY = '2026-09-26'
const T = M.lineText
const has = (line, text) => line.parts.some(p => p.text === text)
const part = (line, text) => line.parts.find(p => p.text === text)
const FOMC = ['2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09', '2027-01-27']   // FOMC_SCHEDULE 과 같은 모양
const base = {
  indices: [{ id: 'sp500', changePct: 0.4 }, { id: 'kospi', changePct: 0.93 }, { id: 'kosdaq', changePct: -1.04 }],
  usdKrw: 1371.4,
  signals: { asOf: '2026-09-25T23:30:00Z', count: 3 },
  events: [],
  movers: { held: [], checked: 20, failed: 0 },
  fomcDates: FOMC,
}
const run = (patch, today = TODAY) => M.buildHomeBrief({ ...base, ...patch }, today)

// ── 1줄(시장)
const b0 = run({})
check('시장: 코스피 +0.9% 빨강(up)', part(b0.market, '코스피 +0.9%')?.tone === 'up')
check("시장: 코스닥 음수는 '−'(하이픈 아님) + down", part(b0.market, '코스닥 −1.0%')?.tone === 'down')
check('시장: 원·달러 1,371원', has(b0.market, '원·달러 1,371원'))
check('시장: 구분자 포함 전체 문자열', T(b0.market) === '코스피 +0.9% · 코스닥 −1.0% · 원·달러 1,371원')
check('시장: 보합(0.04%) → flat, 0.0%', part(run({ indices: [{ id: 'kospi', changePct: 0.04 }, { id: 'kosdaq', changePct: 1 }] }).market, '코스피 0.0%')?.tone === 'flat')
const bNoKospi = run({ indices: [{ id: 'kosdaq', changePct: 1.0 }] })
check('시장: 코스피만 빠짐 → "코스피 못 가져옴"(muted), 코스닥은 그대로', part(bNoKospi.market, '코스피 못 가져옴')?.tone === 'muted' && has(bNoKospi.market, '코스닥 +1.0%'))
const bNoIdx = run({ indices: null })
check('시장: 지수 null → "지수 못 가져옴" 한 조각(0% 아님)', part(bNoIdx.market, '지수 못 가져옴')?.tone === 'muted' && !T(bNoIdx.market).includes('0.0%'))
check('시장: 환율 null → "원·달러 못 가져옴"(0원 아님)', part(run({ usdKrw: null }).market, '원·달러 못 가져옴')?.tone === 'muted' && !T(run({ usdKrw: null }).market).includes('0원'))

// ── 2줄(내 종목) — 신호
check('신호: asOf 오늘(KST) → 오늘 신호 3건', has(b0.mine, '오늘 신호 3건'))
check('신호: 2026-09-25T20:00:00Z = KST 9/26 05:00 → 오늘', has(run({ signals: { asOf: '2026-09-25T20:00:00Z', count: 2 } }).mine, '오늘 신호 2건'))
check('신호: 2026-09-25T14:59:00Z = KST 9/25 23:59 → 어제', has(run({ signals: { asOf: '2026-09-25T14:59:00Z', count: 1 } }).mine, '어제 신호 1건'))
const bOld = run({ signals: { asOf: '2026-09-23T00:00:00Z', count: 5 } })
check('신호: 3일 전 → "신호 기록이 오래됐어요"(warn), 건수 안 보임', part(bOld.mine, '신호 기록이 오래됐어요')?.tone === 'warn' && !T(bOld.mine).includes('5건'))
const bSigNull = run({ signals: { asOf: null, count: 0 } })
check('신호: asOf null → "신호 못 가져옴"(0건 아님)', part(bSigNull.mine, '신호 못 가져옴')?.tone === 'muted' && !T(bSigNull.mine).includes('0건'))
check('신호: signals null → "신호 못 가져옴"', part(run({ signals: null }).mine, '신호 못 가져옴')?.tone === 'muted')
check('신호: 미래 asOf → 오늘이라 단정하지 않음(못 가져옴)', has(run({ signals: { asOf: '2026-09-27T03:00:00Z', count: 1 } }).mine, '신호 못 가져옴'))
check('신호: 월초 어제 계산(10/1 → 9/30)', T(run({ signals: { asOf: '2026-09-30T05:00:00Z', count: 4 } }, '2026-10-01').mine).includes('어제 신호 4건'))

// ── 2줄 — 실적(날짜로 거른다 — dDay 는 캐시에서 낡을 수 있어 안 본다)
const ev = [
  { type: 'earnings', dDay: 3, date: '2026-09-29', name: '마이크론', ticker: 'MU' },
  { type: 'earnings', dDay: 3, date: '2026-09-29', name: '마이크론', ticker: 'MU' },   // 같은 종목 중복
  { type: 'earnings', dDay: 8, date: '2026-10-04', name: '나이키', ticker: 'NKE' },
  { type: 'exDiv', dDay: 1, date: '2026-09-27', name: '코카콜라', ticker: 'KO' },
  { type: 'earnings', dDay: -1, date: '2026-09-25', name: '지난실적', ticker: 'OLD' },
]
check('실적: 9/29 포함·같은 종목 중복은 1건·10/4/배당/지난 것 제외 → 7일 안 1건', has(run({ events: ev }).mine, '실적 발표 7일 안 1건'))
check('실적: 빈 목록 → "7일 안 실적 발표 없음"', has(b0.mine, '7일 안 실적 발표 없음'))
check('실적: events null → "실적 일정 못 가져옴"', part(run({ events: null }).mine, '실적 일정 못 가져옴')?.tone === 'muted')
check('실적: 8일 뒤(10/4)만 있음 → 2줄은 없음, 3줄엔 10/4 나이키 실적', has(run({ events: [ev[2]] }).mine, '7일 안 실적 발표 없음') && has(run({ events: [ev[2]] }).upcoming, '10/4 나이키 실적'))
const stale = [{ type: 'earnings', dDay: 0, date: '2026-09-25', name: '어제실적', ticker: 'Y' }]   // 캐시가 하루 묵어 dDay 0 인데 날짜는 어제
check('실적: 낡은 dDay 0 이라도 날짜가 어제면 2줄·3줄 모두 제외', has(run({ events: stale }).mine, '7일 안 실적 발표 없음') && !T(run({ events: stale }).upcoming).includes('어제실적'))
check('실적: 7일째(10/3)는 포함', has(run({ events: [{ type: 'earnings', date: '2026-10-03', name: 'A', ticker: 'A' }] }).mine, '실적 발표 7일 안 1건'))
check("실적: 오늘 날짜 → '오늘 마이크론 실적'", has(run({ events: [{ type: 'earnings', date: TODAY, name: '마이크론', ticker: 'MU' }] }).upcoming, '오늘 마이크론 실적'))

// ── 2줄 — 움직임(held 는 보유만 — 호출부 책임)
const held3 = [
  { name: 'TIGER 코리아원자력', changePct: -5.8 },
  { name: '삼성전자', changePct: 1.2 },
  { name: '한화에어로스페이스', changePct: 7.1 },
  { name: '비트코인', changePct: 5.0 },
]
const bMv = run({ movers: { held: held3, checked: 20, failed: 0 } })
check("움직임: 5% 이상 3개 → 큰 순 2개 + '외 1종목'", T(bMv.mine).endsWith('한화에어로스페이스 +7.1%, TIGER 코리아원자력 −5.8% 외 1종목'))
check("움직임: 하락 종목은 '−' + down, 상승은 up", part(bMv.mine, 'TIGER 코리아원자력 −5.8%')?.tone === 'down' && part(bMv.mine, '한화에어로스페이스 +7.1%')?.tone === 'up')
check('움직임: 5% 미만만 → "5% 넘게 움직인 종목 없음"', has(run({ movers: { held: [held3[1]], checked: 20, failed: 0 } }).mine, '5% 넘게 움직인 종목 없음'))
const bFail = run({ movers: { held: [], checked: 20, failed: 2 } })
check('움직임: 일부 실패 → 구분자 뒤 따로 "일부 종목은 확인 못 함"(warn)', part(bFail.mine, '일부 종목은 확인 못 함')?.tone === 'warn' && T(bFail.mine).endsWith('5% 넘게 움직인 종목 없음 · 일부 종목은 확인 못 함'))
const bFailMv = run({ movers: { held: held3, checked: 20, failed: 1 } })
check('움직임: 일부 실패 + 종목 있음 → 마지막 종목 뒤에 구분자가 먼저 온다', T(bFailMv.mine).endsWith('TIGER 코리아원자력 −5.8% 외 1종목 · 일부 종목은 확인 못 함'))
const bAllFail = run({ movers: { held: [], checked: 12, failed: 12 } })
check("움직임: 전부 실패(failed=checked) → '움직임 못 가져옴' 하나만('없음'·'일부' 없음)", T(bAllFail.mine).endsWith(' · 움직임 못 가져옴') && part(bAllFail.mine, '움직임 못 가져옴')?.tone === 'muted' && !T(bAllFail.mine).includes('움직인 종목 없음') &&!T(bAllFail.mine).includes('일부'))
check("움직임: checked 0·failed 3 → '움직임 못 가져옴'", has(run({ movers: { held: [], checked: 0, failed: 3 } }).mine, '움직임 못 가져옴'))
check("움직임: checked 0·failed 0(확인할 보유 없음) → '없음'", has(run({ movers: { held: [], checked: 0, failed: 0 } }).mine, '5% 넘게 움직인 종목 없음'))
check('움직임: failed 0 → 경고 없음', !T(b0.mine).includes('확인 못 함'))
check('움직임: movers null → "움직임 못 가져옴"', part(run({ movers: null }).mine, '움직임 못 가져옴')?.tone === 'muted')
check('내 종목: 머리말', T(b0.mine).startsWith('내 종목: '))

// ── 3줄(다가오는 일정) — FOMC 는 미국 발표일 +1(한국 새벽)
const bF = run({ fomcDates: ['2026-12-09', '2026-09-16', '2026-10-28', '2026-07-29'] })
check('FOMC: 지난 회의 건너뛰고 정렬 안 된 목록에서 다음 — 미국 10/28 → 한국 10/29 새벽', T(bF.upcoming) === '다가오는 일정: 10/29 새벽 FOMC 금리 발표')
check("FOMC: 미국 발표일이 어제 → 한국은 오늘 새벽 → '오늘 새벽 FOMC 금리 발표'", has(run({ fomcDates: ['2026-09-25', '2026-10-28'] }).upcoming, '오늘 새벽 FOMC 금리 발표'))
check('FOMC: 미국 발표일이 오늘 → 한국 내일(9/27) 새벽', has(run({ fomcDates: [TODAY] }).upcoming, '9/27 새벽 FOMC 금리 발표'))
check('FOMC: 미국 발표일 그제 → 지난 것(다음 회의로)', has(run({ fomcDates: ['2026-09-24', '2026-10-28'] }).upcoming, '10/29 새벽 FOMC 금리 발표'))
check('FOMC: null → "FOMC 일정 못 가져옴"', part(run({ fomcDates: null }).upcoming, 'FOMC 일정 못 가져옴')?.tone === 'muted')
const bExhausted = run({}, '2027-02-01')   // 수동 표가 2027-01-27 에서 끝남
check("FOMC: 표 소진(남은 회의 없음) → 'FOMC 일정 못 가져옴', '일정이 없어요' 안 나옴", part(bExhausted.upcoming, 'FOMC 일정 못 가져옴')?.tone === 'muted' && !T(bExhausted.upcoming).includes('없어요'))
check("FOMC: 빈 배열도 '못 가져옴'", has(run({ fomcDates: [] }).upcoming, 'FOMC 일정 못 가져옴'))
check('일정: 날짜순 — 실적(9/29) 먼저, FOMC(10/29) 뒤', T(run({ events: ev }).upcoming) === '다가오는 일정: 9/29 마이크론 실적 · 10/29 새벽 FOMC 금리 발표')
check('일정: 날짜순 — FOMC(9/28) 먼저', T(run({ fomcDates: ['2026-09-27'], events: ev }).upcoming) === '다가오는 일정: 9/28 새벽 FOMC 금리 발표 · 9/29 마이크론 실적')
check('일정: 날짜순 + 못 가져옴은 뒤에', T(run({ fomcDates: null, events: ev }).upcoming) === '다가오는 일정: 9/29 마이크론 실적 · FOMC 일정 못 가져옴')
check('일정: 실적 31일 뒤(10/27)는 30일 창 밖 → FOMC 만', T(run({ events: [{ type: 'earnings', date: '2026-10-27', name: 'X', ticker: 'X' }] }).upcoming) === '다가오는 일정: 10/29 새벽 FOMC 금리 발표')
const bEvNull = run({ events: null })
check("일정: events null → '실적 일정 못 가져옴'", part(bEvNull.upcoming, '실적 일정 못 가져옴')?.tone === 'muted' && !T(bEvNull.upcoming).includes('없어요'))
check('일정: 둘 다 null → 둘 다 못 가져옴', T(run({ events: null, fomcDates: null }).upcoming) === '다가오는 일정: FOMC 일정 못 가져옴 · 실적 일정 못 가져옴')

// 실제에 가까운 입력 한 벌 — 눈으로 확인용
const sample = M.buildHomeBrief({
  indices: [{ id: 'sp500', changePct: 0.59 }, { id: 'kospi', changePct: 0.93 }, { id: 'kosdaq', changePct: 1.02 }],
  usdKrw: 1394.8,
  signals: { asOf: '2026-09-25T23:31:12Z', count: 2 },
  events: [ev[0], ev[2], ev[3]],
  movers: { held: [{ name: 'TIGER 코리아원자력', changePct: -5.8 }, { name: '삼성전자', changePct: 1.2 }], checked: 21, failed: 1 },
  fomcDates: FOMC,
}, TODAY)
console.log(`\n  ${T(sample.market)}\n  ${T(sample.mine)}\n  ${T(sample.upcoming)}`)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (홈 한눈 시황)')
process.exit(fail ? 1 : 0)
