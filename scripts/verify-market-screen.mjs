// 학생 시장 화면 규칙 검증 — marketScreen(원천 조각 상태·기준 시각 문구·몇 시간 전·순매매 배지·시장 합치기·등락 수 설명·걸러낸 개수·업종 막대·국면 말·공포탐욕 기간)
//   실제 lib 을 컴파일해 부른다(재구현 금지). 마지막 줄은 야간 감사가 읽는 '✅ 전부 통과 (…)'.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-mkscreen`

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
  include: [`${ROOT}/src/lib/marketScreen.ts`],
}
writeFileSync(`${ROOT}/.bt-mkscreen.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 타입 에러로 아무것도 못 내놔도 옛 .js 로 거짓 green 이 난다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-mkscreen.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/marketScreen.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = Module.createRequire(import.meta.url)
const M = require(`${OUT}/lib/marketScreen.js`)

let fail = 0
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${ok ? '✅' : '❌'} ${label} → ${JSON.stringify(got)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
  if (!ok) fail++
}

// ── viewOf ──
const pick = d => d.a
eq('viewOf 불러오는 중', M.viewOf({ state: 'loading', data: null }, pick), { kind: 'loading' })
eq('viewOf idle 도 불러오는 중(아직 안 부름)', M.viewOf({ state: 'idle', data: null }, pick), { kind: 'loading' })
eq('viewOf 요청 실패', M.viewOf({ state: 'failed', data: null }, pick), { kind: 'failed' })
eq('viewOf 원천 ok:false = 못 가져옴', M.viewOf({ state: 'ok', data: { a: { ok: false, reason: 'x', source: 's' } } }, pick), { kind: 'failed' })
eq('viewOf 모양이 다름(조각 없음) = 못 가져옴', M.viewOf({ state: 'ok', data: {} }, pick), { kind: 'failed' })
eq('viewOf pick 이 던짐 = 못 가져옴', M.viewOf({ state: 'ok', data: {} }, d => d.x.y), { kind: 'failed' })
const OKP = { a: { ok: true, data: [1], asOf: 'x', source: 's' } }
eq('viewOf 다시 부르는 중 — 이전에 받은 조각은 그대로(다른 카드 깜빡임 방지)', M.viewOf({ state: 'loading', data: OKP }, pick), { kind: 'ok', data: [1], asOf: 'x' })
eq('viewOf 다시 부르는 중 — 이전에 못 가져온 조각은 불러오는 중', M.viewOf({ state: 'loading', data: { a: { ok: false, reason: 'x', source: 's' } } }, pick), { kind: 'loading' })
eq('viewOf 다시 부르다 요청 실패 = 못 가져옴(옛 데이터로 성공인 척 안 함)', M.viewOf({ state: 'failed', data: OKP }, pick), { kind: 'failed' })
eq('viewOf ok 빈 목록 = 받음(없음은 화면이 사실대로)', M.viewOf({ state: 'ok', data: { a: { ok: true, data: [], asOf: null, source: 's' } } }, pick), { kind: 'ok', data: [], asOf: null })

// ── 날짜·시각 ──
eq('mdDow 2026-09-23 = 수', M.mdDow('2026-09-23'), '9/23(수)')
eq('mdDow 못 읽음 = null', M.mdDow('20260923'), null)
eq('ymdDot', M.ymdDot('2025-11-20'), '2025.11.20')
eq('asOfLabel 마감(KST)', M.asOfLabel('2026-09-23T20:15:00+09:00', 'CLOSE'), '9/23(수) 장 마감')
eq('asOfLabel 장중 = HH:mm 기준', M.asOfLabel('2026-09-24T10:05:30+09:00', 'OPEN'), '10:05 기준')
eq('asOfLabel 상태 모름 = 날짜+시각', M.asOfLabel('2026-09-24T10:05:30+09:00', null), '9/24(목) 10:05 기준')
eq('asOfLabel UTC 문자열도 KST 로', M.asOfLabel('2026-09-24T01:05:00.000Z', 'OPEN'), '10:05 기준')
eq('asOfLabel 날짜만 + 마감', M.asOfLabel('2026-09-23', 'CLOSE'), '9/23(수) 장 마감')
eq('asOfLabel 날짜만 + 모름', M.asOfLabel('2026-09-23', null), '9/23(수) 기준')
eq('asOfLabel 미국 마감은 미국 날짜(한국 9/26 05:00 = 미국 9/25)', M.asOfLabel('2026-09-25T20:00:00.000Z', 'CLOSED', 'NY'), '미국 9/25(금) 장 마감')
eq('asOfLabel 미국 장중은 한국 시각', M.asOfLabel('2026-09-25T15:30:00.000Z', 'OPEN', 'NY'), '한국 시각 00:30 기준')
eq('asOfLabel null = null', M.asOfLabel(null, 'OPEN'), null)
eq('asOfLabel 못 읽음 = null', M.asOfLabel('어제', 'OPEN'), null)

const NOW = Date.parse('2026-09-27T12:00:00+09:00')
eq('agoText 30초 = 방금', M.agoText('2026-09-27T11:59:30+09:00', NOW), '방금')
eq('agoText 미래(기기 시계 차) = 방금', M.agoText('2026-09-27T12:03:00+09:00', NOW), '방금')
eq('agoText 59분', M.agoText('2026-09-27T11:00:30+09:00', NOW), '59분 전')
eq('agoText 3시간', M.agoText('2026-09-27T08:40:00+09:00', NOW), '3시간 전')
eq('agoText 하루 넘으면 날짜', M.agoText('2026-09-25T18:00:00+09:00', NOW), '9/25(금)')
eq('agoText null', M.agoText(null, NOW), null)
eq('agoText 5분 넘게 미래 = null(틀린 시각)', M.agoText('2026-09-27T12:06:00+09:00', NOW), null)
eq('agoText 5분 미래까지는 방금', M.agoText('2026-09-27T12:05:00+09:00', NOW), '방금')

eq('holdingKey 대문자·공백 제거', M.holdingKey('US', ' nvda '), 'US:NVDA')

// ── 순매매 배지 ──
const base = { foreignStreak: null, organStreak: null, together: null, contrarian: null, etf: false, priceLimitBreak: false }
const texts = bs => bs.map(b => b.text)
eq('배지 없음(모름은 전부 생략)', texts(M.flowBadges(base, 'buy', 'FOREIGNER', false)), [])
eq('외국인 3일째 순매수(순매수 목록)', texts(M.flowBadges({ ...base, foreignStreak: { n: 3, capped: false } }, 'buy', 'FOREIGNER', false)), ['3일째'])
eq('1일째는 배지 없음', texts(M.flowBadges({ ...base, foreignStreak: { n: 1, capped: false } }, 'buy', 'FOREIGNER', false)), [])
eq('기관 목록은 기관 연속일을 본다(외국인 5일째 무시)', texts(M.flowBadges({ ...base, foreignStreak: { n: 5, capped: false }, organStreak: { n: 2, capped: false } }, 'buy', 'ORGANIZATION', false)), ['2일째'])
eq('순매도 목록은 음수 연속일만', texts(M.flowBadges({ ...base, foreignStreak: { n: -4, capped: false } }, 'sell', 'FOREIGNER', false)), ['4일째'])
eq('방향이 어긋난 연속일은 생략', texts(M.flowBadges({ ...base, foreignStreak: { n: 4, capped: false } }, 'sell', 'FOREIGNER', false)), [])
eq('30일 다 이어짐 = 이상', texts(M.flowBadges({ ...base, foreignStreak: { n: 30, capped: true } }, 'buy', 'FOREIGNER', false)), ['30일째 이상'])
eq('함께 샀어요(순매수 목록)', texts(M.flowBadges({ ...base, together: 'buy' }, 'buy', 'FOREIGNER', false)), ['함께 샀어요'])
eq('함께 팔았어요(순매도 목록)', texts(M.flowBadges({ ...base, together: 'sell' }, 'sell', 'ORGANIZATION', false)), ['함께 팔았어요'])
eq('함께 아님(false)·목록과 다른 방향은 생략', texts(M.flowBadges({ ...base, together: false }, 'buy', 'FOREIGNER', false)).concat(texts(M.flowBadges({ ...base, together: 'sell' }, 'buy', 'FOREIGNER', false))), [])
eq('주가와 반대 · ETF · ±30%', texts(M.flowBadges({ ...base, contrarian: true, etf: true, priceLimitBreak: true }, 'buy', 'FOREIGNER', false)), ['주가와 반대', 'ETF', '±30% 넘음'])
eq('역행 null(등락 모름)은 생략', texts(M.flowBadges({ ...base, contrarian: null }, 'buy', 'FOREIGNER', false)), [])
eq('내 종목이 맨 앞', texts(M.flowBadges({ ...base, foreignStreak: { n: 2, capped: false } }, 'buy', 'FOREIGNER', true)), ['내 종목', '2일째'])

// ── 시장 합치기 ──
const k = [{ code: 'A', netEok: 900 }, { code: 'B', netEok: 300 }]
const q = [{ code: 'C', netEok: 500 }, { code: 'D', netEok: 100 }]
const m1 = M.mergeFlowTop([{ market: 'KOSPI', rows: k }, { market: 'KOSDAQ', rows: q }], 3)
eq('합치기 = 금액 큰 순 Top n + 시장 표시', m1.rows.map(r => `${r.code}:${r.market}`), ['A:KOSPI', 'C:KOSDAQ', 'B:KOSPI'])
eq('합치기 missing 없음', m1.missing, [])
const m2 = M.mergeFlowTop([{ market: 'KOSPI', rows: [{ code: 'S', netEok: -800 }, { code: 'T', netEok: -50 }] }, { market: 'KOSDAQ', rows: [{ code: 'U', netEok: -200 }] }], 2)
eq('순매도도 크기(절댓값) 순', m2.rows.map(r => r.code), ['S', 'U'])
const m3 = M.mergeFlowTop([{ market: 'KOSPI', rows: k }, { market: 'KOSDAQ', rows: null }], 5)
eq('한 시장 못 가져옴 → missing + 남은 시장만', [m3.missing, m3.rows.map(r => r.code)], [['KOSDAQ'], ['A', 'B']])

// ── 등락 수 ──
eq('지수 오름 + 내린 종목 더 많음 → 어긋남 설명', M.breadthNote({ rise: 311, fall: 548 }, 0.9) != null, true)
eq('지수 내림 + 오른 종목 더 많음 → 어긋남 설명', M.breadthNote({ rise: 600, fall: 300 }, -1.2)?.startsWith('지수는 내렸지만'), true)
eq('방향 같음 → null', M.breadthNote({ rise: 600, fall: 300 }, 1.2), null)
eq('보합 지수(±0.05 안) → null', M.breadthNote({ rise: 100, fall: 500 }, 0.04), null)
eq('모름 → null', M.breadthNote({ rise: null, fall: 5 }, 1), null)

// ── 걸러낸 사실 ──
eq('국내 뺀 수 0 → 문구 없음', M.krMoverFilterNote({ priceLimitBreak: 0 }), null)
eq('국내 뺀 수 2', M.krMoverFilterNote({ priceLimitBreak: 2 }), '하루 ±30%를 넘은 2종목(상장 첫날·거래 재개·정리매매)은 뺐어요.')
eq('미국 뺀 이유별', M.usMoverFilterNote({ smallCap: 85, newListing: 2, rightsUnits: 0 }, 100, 3e8, 7), '순위 100위 안에서 시가총액 3억 달러 미만 85 · 상장 7일 이내 2종목은 뺐어요.')
eq('미국 뺀 게 없어도 규칙은 적는다', M.usMoverFilterNote({ smallCap: 0, newListing: 0, rightsUnits: 0 }, 30, 3e8, 7), '시가총액 3억 달러 미만·상장 7일 이내는 빼고 보여줘요.')

// ── 업종 ──
const ind = [
  { no: 1, name: '가정용품', changePct: 162, limitBreakSuspect: true },
  { no: 2, name: '반도체', changePct: 3.2, limitBreakSuspect: false },
  { no: 3, name: '은행', changePct: -1.6, limitBreakSuspect: false },
  { no: 4, name: '없음', changePct: null, limitBreakSuspect: false },
  { no: 5, name: '보험', changePct: 0, limitBreakSuspect: false },
]
eq('오른 순(±30% 의심·보합·등락 모름 제외)', M.topIndustries(ind, 'up', 3).map(i => i.name), ['반도체'])
eq('보합 경계 |x|<0.05 는 순위에서 빠짐(0.04 빠짐 · 0.05 들어감)', M.topIndustries([{ no: 1, name: 'a', changePct: 0.04, limitBreakSuspect: false }, { no: 2, name: 'b', changePct: 0.05, limitBreakSuspect: false }, { no: 3, name: 'c', changePct: -0.04, limitBreakSuspect: false }], 'up', 5).map(i => i.name).concat(M.topIndustries([{ no: 3, name: 'c', changePct: -0.04, limitBreakSuspect: false }], 'down', 5).map(i => i.name)), ['b'])
eq('의심 업종은 그 방향만 따로', [M.suspectIndustries(ind, 'up').map(i => i.name), M.suspectIndustries(ind, 'down').map(i => i.name)], [['가정용품'], []])
eq('뺀 업종 문구', M.suspectIndustryText({ name: '가정용품', changePct: 162.34, count: 12, rise: 4, fall: 5 }), '가정용품 +162.3%(12종목 중 오른 4·내린 5)')
eq('뺀 업종 문구 — 종목 수 모름', M.suspectIndustryText({ name: 'x', changePct: -31.2, count: null, rise: null, fall: null }), 'x \u221231.2%')
eq('내린 순(내린 업종만)', M.topIndustries(ind, 'down', 2).map(i => i.name), ['은행'])
eq('모두 오른 날 내린 순 = 빈 목록', M.topIndustries([{ no: 1, name: 'a', changePct: 0.3, limitBreakSuspect: false }], 'down', 5), [])
eq('막대 폭 — 의심 업종 제외한 최대가 100, 의심은 100, 0% 는 0', M.industryBars(ind.slice(0, 3).concat([ind[4]])), [100, 100, 50, 0])
eq('막대 최소 2', M.industryBars([{ changePct: 10, limitBreakSuspect: false }, { changePct: 0.05, limitBreakSuspect: false }]), [100, 2])

// ── ETF·ETN ──
const mv = [{ code: '1', etp: 'ETN' }, { code: '2', etp: null }, { code: '3', etp: 'ETF' }, { code: '4', etp: null }]
eq('기본 = 주식만 + 뺀 개수', (r => [r.items.map(i => i.code), r.removed])(M.filterEtp(mv, false)), [['2', '4'], 2])
eq('ETF·ETN 포함 = 그대로', (r => [r.items.map(i => i.code), r.removed])(M.filterEtp(mv, true)), [['1', '2', '3', '4'], 0])

// ── 순매매 범위 ──
eq('합침 둘 다', M.flowScopeText(['KOSPI', 'KOSDAQ'], []), '코스피·코스닥을 합친')
eq('합침 한 시장 실패 = 실제 범위', M.flowScopeText(['KOSPI', 'KOSDAQ'], ['KOSDAQ']), '코스피만 본(코스닥 못 가져옴)')
eq('한 시장 선택', M.flowScopeText(['KOSDAQ'], []), '코스닥')

// ── 홈 요약 ──
eq('스파크 — 값 없는 점 버리고 시간순', M.sparkSeries([{ t: 3, v: 2 }, { t: 1, v: 1 }, { t: 2, v: null }]), [{ t: 1, v: 1 }, { t: 3, v: 2 }])
eq('스파크 — 모든 값이 같으면(가짜 평평선) null', M.sparkSeries([{ t: 1, v: 5 }, { t: 2, v: 5 }, { t: 3, v: 5 }]), null)
eq('스파크 — 2점 미만 null', M.sparkSeries([{ t: 1, v: 5 }]), null)
eq('스파크 — 배열 아님 null', M.sparkSeries(undefined), null)
const many = Array.from({ length: 400 }, (_, i) => ({ t: i, v: i % 7 }))
const sp = M.sparkSeries(many, 80)
eq('스파크 — 400점 → 80 이하 + 마지막 점 유지', [sp.length <= 80, sp[sp.length - 1].t], [true, 399])
const YR = { yearHigh: { v: 71, date: '2026-05-01' }, yearLow: { v: 5, date: '2025-11-20' }, range: { from: '2025-09-26', to: '2026-09-26', fullYear: true } }
const S1 = M.fngYearSummary(50, YR)
eq('1년 요약 — 1년치', S1, { fullYear: true, rangeText: '최근 1년', high: { v: 71, when: '2026.5.1' }, low: { v: 5, when: '2025.11.20' } })
eq('홈 한 줄', M.fngYearLine(S1), '최근 1년 최고 71(2026.5.1) · 최저 5(2025.11.20)')
eq('1년 요약 — 지금이 최고를 넘으면 최고 = 지금', M.fngYearSummary(80, YR).high, { v: 80, when: '지금' })
eq('1년 요약 — 기록이 1년에 못 미침', M.fngYearLine(M.fngYearSummary(50, { ...YR, range: { from: '2025-11-20', to: '2026-09-26', fullYear: false } })), '기록 기간(2025.11.20~2026.9.26) 최고 71(2026.5.1) · 최저 5(2025.11.20)')
eq('1년 요약 — 고저 없음 null', M.fngYearSummary(50, { yearHigh: null, yearLow: null, range: null }), null)
eq('홈 한 줄 — 기간 모름(range null)이면 기록 기간', M.fngYearLine(M.fngYearSummary(50, { ...YR, range: null })), '기록 기간 최고 71(2026.5.1) · 최저 5(2025.11.20)')

// ── 국면·공포탐욕 ──
eq('국면 말 4종', Object.keys(M.QUAD_TEXT).sort(), ['improving', 'lagging', 'leading', 'weakening'])
eq('기간 1년치', M.fngRangeName({ from: '2025-09-26', to: '2026-09-26', fullYear: true }), '1년')
eq('기간 1년 못 됨 = 실제 기간', M.fngRangeName({ from: '2025-11-20', to: '2026-09-26', fullYear: false }), '2025.11.20~2026.9.26')
eq('기간 없음', M.fngRangeName(null), null)
const H = { v: 71, date: '2026-05-01' }, L = { v: 5, date: '2025-11-20' }
eq('지금이 고저 안 → 그대로', M.fngExtremes(50, H, L), { high: H, low: L })
eq('지금이 최고를 넘음 → 최고 = 지금', M.fngExtremes(72, H, L).high, { v: 72, date: null })
eq('지금이 최저 이하 → 최저 = 지금', M.fngExtremes(5, H, L).low, { v: 5, date: null })
eq('지금 모름 → 그대로', M.fngExtremes(null, H, L), { high: H, low: L })

// ── fxBasisNote — 하나은행 카드와 앱 환율(한눈 시황·내 자산)이 다를 때만 이유 한 줄 ──
eq('앱도 하나은행·같은 값 → 문구 없음', M.fxBasisNote({ rate: 1359, source: 'hana' }, 1359), null)
eq('앱이 하나은행 오늘 회차(1,362.3) vs 카드 확정일(1,359) → 다른 시각 값', M.fxBasisNote({ rate: 1362.3, source: 'hana' }, 1359),
  '한눈 시황·내 자산은 같은 하나은행 고시의 다른 시각 값(1,362.30원)으로 계산해요 — 고시는 하루에도 여러 번 바뀌어요.')
eq('하나은행 실패 → 다른 원천(fawazahmed0 1,361.27) → 다를 수 있음', M.fxBasisNote({ rate: 1361.27, source: 'fawazahmed0' }, 1359),
  '지금은 하나은행 고시를 새로 못 받아 한눈 시황·내 자산은 다른 환율(1,361.27원)로 계산 중이에요 — 조금 다를 수 있어요.')
eq('마지막 성공값(last-good)도 하나은행 새 값이 아님 → 다를 수 있음', M.fxBasisNote({ rate: 1355.5, source: 'last-good' }, 1359) != null, true)
eq('다른 원천이어도 값이 같으면 → 문구 없음(설명할 차이가 없다)', M.fxBasisNote({ rate: 1359, source: 'last-good' }, 1359), null)
eq('고정 상수(stale-constant) → 문구 없음(앱 환율을 못 받음 — 그 화면이 밝힌다)', M.fxBasisNote({ rate: 1400, source: 'stale-constant' }, 1359), null)
eq('앱 환율 응답 없음 → 문구 없음', M.fxBasisNote(null, 1359), null)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (학생 시장 화면 규칙)')
process.exit(fail ? 1 : 0)
