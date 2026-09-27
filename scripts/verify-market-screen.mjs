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
eq('개인 목록은 개인 연속일을 본다(외국인 5일째 무시)', texts(M.flowBadges({ ...base, foreignStreak: { n: 5, capped: false }, individualStreak: { n: 3, capped: false } }, 'buy', 'INDIVIDUAL', false)), ['3일째'])
eq('개인 순매수 목록에서 외국인·기관이 둘 다 팔았으면 그 사실', texts(M.flowBadges({ ...base, together: 'sell' }, 'buy', 'INDIVIDUAL', false)), ['외국인·기관은 팔았어요'])
eq('개인 순매도 목록에서 외국인·기관이 둘 다 샀으면 그 사실', texts(M.flowBadges({ ...base, together: 'buy' }, 'sell', 'INDIVIDUAL', false)), ['외국인·기관은 샀어요'])
eq('개인 목록에서 외국인·기관이 같은 쪽·엇갈림·모름이면 배지 없음', texts(M.flowBadges({ ...base, together: 'buy' }, 'buy', 'INDIVIDUAL', false)).concat(texts(M.flowBadges({ ...base, together: false }, 'buy', 'INDIVIDUAL', false)), texts(M.flowBadges(base, 'buy', 'INDIVIDUAL', false))), [])
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

// ── fngColor — 0 빨강 · 50 노랑 · 100 초록, 사이는 연속(칸 경계 없음) ──
eq('0 → 빨강(red500)', M.fngColor(0), 'rgb(239, 68, 68)')
eq('50 → 노랑(yellow500)', M.fngColor(50), 'rgb(234, 179, 8)')
eq('100 → 초록(green500)', M.fngColor(100), 'rgb(34, 197, 94)')
eq('범위 밖(−5·130)은 끝 색', [M.fngColor(-5), M.fngColor(130)], ['rgb(239, 68, 68)', 'rgb(34, 197, 94)'])
eq('24 와 26 은 거의 같은 색(경계에서 튀지 않음)', (() => { const p = s => s.match(/\d+/g).map(Number); const a = p(M.fngColor(24)), b = p(M.fngColor(26)); return a.every((c, k) => Math.abs(c - b[k]) < 12) })(), true)

// ── investorSumNote — 넷의 합 ──
eq('넷 합 0 → 판 만큼 샀다', M.investorSumNote({ personal: -14649, foreign: -4942, institutional: 3189, otherCorp: 16403 }), '넷을 더하면 0이에요 — 누가 판 만큼 누가 샀다는 뜻이에요.')
eq('반올림 1억 차이도 0 으로', M.investorSumNote({ personal: -14649, foreign: -4942, institutional: 3189, otherCorp: 16402 }), '넷을 더하면 0이에요 — 누가 판 만큼 누가 샀다는 뜻이에요.')
eq('기타법인 없음(폴백 원천) → 셋만으론 0 이 안 된다고', M.investorSumNote({ personal: -14649, foreign: -4942, institutional: 3189, otherCorp: null }), '기타법인 값을 못 받아 셋만 더하면 0이 안 돼요.')
eq('합이 크게 어긋나면 값 그대로 밝힘', M.investorSumNote({ personal: 100, foreign: 50, institutional: -20, otherCorp: 0 }), '넷을 더하면 +130억 — 원천 값 그대로예요.')
eq('셋 중 하나라도 없으면 문구 없음', M.investorSumNote({ personal: null, foreign: -4942, institutional: 3189, otherCorp: 16403 }), null)

// ── 차트 눈금 ──
eq('세로 눈금 7,017~7,137 → 둥근 값', M.niceTicks(7017.91, 7137, 5), [7025, 7050, 7075, 7100, 7125])
eq('환율 1,338~1,392 → 3개 안팎', M.niceTicks(1338, 1392, 3), [1350, 1375])
eq('범위 없음 → 빈 목록', M.niceTicks(5, 5), [])
const K = s => Date.parse(`${s}+09:00`)
eq('국내 장중 9:00~15:32 → 9·11·13·15시', M.hourTicks(K('2026-09-23T09:00:00'), K('2026-09-23T15:32:00')).map(t => M.kstParts(t).hm), ['09:00', '11:00', '13:00', '15:00'])
eq('미국 장중 22:30~05:00 → 23·1·3·5시', M.hourTicks(K('2026-09-25T22:30:00'), K('2026-09-26T05:00:00')).map(t => M.kstParts(t).hm), ['23:00', '01:00', '03:00', '05:00'])
const d1 = M.dayTicks(K('2026-08-24T00:00:00'), K('2026-09-23T00:00:00'))
eq('1달 → 안쪽 4곳 M.D', d1.ticks.map(d1.fmt), ['8.27', '9.4', '9.11', '9.19'])
const d3 = M.dayTicks(K('2026-06-23T00:00:00'), K('2026-09-23T00:00:00'))
eq('3달 → 매달 1일', d3.ticks.map(d3.fmt), ['7월', '8월', '9월'])
const dy = M.dayTicks(K('2025-09-24T00:00:00'), K('2026-09-23T00:00:00'))
eq('1년 → 두 달마다(6개)', dy.ticks.map(dy.fmt), ['10월', '12월', '2월', '4월', '6월', '8월'])
const d14 = M.dayTicks(K('2025-07-20T00:00:00'), K('2026-09-23T00:00:00'))
eq('14개월(주봉 60) → 두 달마다 월(연도로 넘기지 않음)', d14.ticks.map(d14.fmt), ['8월', '10월', '12월', '2월', '4월', '6월', '8월'])
const d5 = M.dayTicks(K('2021-10-01T00:00:00'), K('2026-09-23T00:00:00'))
eq('5년(월봉 60) → 해마다 1월 1일', d5.ticks.map(d5.fmt), ['2022년', '2023년', '2024년', '2025년', '2026년'])

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (학생 시장 화면 규칙)')
process.exit(fail ? 1 : 0)
