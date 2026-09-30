// 투자학교 저울(lib/scale) 검증 — 실제 lib 을 컴파일해 규칙을 시험한다: 이름표 없는 숫자 금지 · 오래된 값 날짜 선언 · 비교 칩은 원천 기준만 ·
//   금·코인 ① '없음' · ③ 계절은 재료가 폴백이면 판정 쉼(2단계) · 금 1년 비교는 날짜로 찾기(인덱스 산술 금지) · (라이브) /api/scale 프로덕션 응답 모양
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-scale`

writeFileSync(`${ROOT}/.bt-scale.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: {
    outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false,
    incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src`,
  },
  include: [`${ROOT}/src/lib/scale.ts`, `${ROOT}/src/lib/seasonNavigator.ts`, `${ROOT}/src/lib/scaleHoldings.ts`, `${ROOT}/src/lib/assetClassifier.ts`, `${ROOT}/src/lib/scaleScore.ts`],
}, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일이 실패해도 옛 .js 로 거짓 green 을 낸다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p ${ROOT}/.bt-scale.tsconfig.json`, { cwd: ROOT, stdio: 'pipe' })
} catch (e) {
  console.log('❌ 컴파일 실패')
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/scale.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const require = Module.createRequire(import.meta.url)
const { buildScale, goldPoints, chipsOf, diffChips, rollSnap } = require(`${OUT}/lib/scale.js`)
const { scaleAssetOf, countByScaleAsset } = require(`${OUT}/lib/scaleHoldings.js`)
const { snapOf, addSnap, computeScaleScore, COHORT_GATE } = require(`${OUT}/lib/scaleScore.js`)

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

// ── 입력(2026-09-29 프로덕션 실측값) ──
const FULL = {
  today: '2026-09-29',
  realYield: { nominal: { v: 5.17, date: '2026-09-25' }, real: { v: 2.83, date: '2026-09-25' }, bei: { v: 2.34, date: '2026-09-28' }, avg10: { v: 0.77, from: '2016-09', to: '2026-08' } },
  m2: { yoy: 5.66, month: '2026-08' },
  factset: { fwd: 19.2, avg5: 19.8, avg10: 19, date: '2026-09-25' },
  kb: { yoy: 4.4, asOf: '2026-09', mortgage: { v: 4.48, asOf: '2026-08' } },
  season: {
    us: { quad: 'inflation', cliMonth: '2026-08', cliOk: true }, kr: { quad: 'inflation', cliMonth: '2026-08', cliOk: true },
    cpiYoY: 3.4, cpiMonth: '2026-08', cpiOk: true, rateDir: 'hike', rateDirOk: true, nextFomc: '2026-10-28',
  },
  gold: { last: { date: '2026-09-26', close: 3650 }, yearAgo: { date: '2025-09-26', close: 2920 } },
  fng: { now: 73, weekAgo: 78, monthAgo: 69, cls: 'Greed', date: '2026-09-29' },
}
const cellOf = (r, asset, q) => r.rows.find(x => x.asset === asset).cells.find(c => c.q === q)

const r = buildScale(FULL)
check('줄 순서 = 채권 → 주식 → 부동산 → 금 → 코인(채권 이자가 잣대라 맨 위)', r.rows.map(x => x.asset).join(',') === 'bond,stock,realestate,gold,coin')
check('모든 줄이 세 칸(①②③)', r.rows.every(x => x.cells.map(c => c.q).join(',') === 'cash,price,season'))
const oks = r.rows.flatMap(x => x.cells).filter(c => c.status === 'ok')
check(`숫자 칸(ok ${oks.length}개 = ①② 7 + ③ 5)은 전부 출처·날짜 이름표가 있다`, oks.length === 12 && oks.every(c => c.source && c.date))
check('금·코인 ① = 없음(현금흐름이 없다는 사실)', ['gold', 'coin'].every(a => cellOf(r, a, 'cash').status === 'none' && cellOf(r, a, 'cash').chip === '없음'))
// 줄 끝 꼬리표 — ① 칸의 사실과 어긋나지 않아야 한다(있음 ↔ 코어 · 없음 ↔ 위성). 코인만 5% 수업 원칙
check('꼬리표 5줄 전부 있고 ① 있음 줄은 코어, 없음 줄은 위성', r.rows.every(x => typeof x.tail === 'string' && x.tail.length > 0)
  && r.rows.filter(x => x.cells[0].chip === '있음').every(x => /코어/.test(x.tail)) && r.rows.filter(x => x.cells[0].chip === '없음').every(x => /위성/.test(x.tail) && !/코어/.test(x.tail)))
check('코인 줄에만 5% 수업 원칙 · 경고 어휘(위험·주의·경고) 없음', /5%/.test(r.rows.find(x => x.asset === 'coin').tail) && r.rows.filter(x => x.asset !== 'coin').every(x => !/5%/.test(x.tail)) && r.rows.every(x => !/위험|주의|경고/.test(x.tail)))
check('주식 줄 꼬리표는 지수 ETF(코어)와 개별 종목(위성)을 가른다', /지수 ETF/.test(r.rows.find(x => x.asset === 'stock').tail) && /개별 종목/.test(r.rows.find(x => x.asset === 'stock').tail))
check('부동산 ① = 숫자 없는 설명(전국 전세가율 원천이 없다) + 부동산 화면 링크', cellOf(r, 'realestate', 'cash').status === 'text' && cellOf(r, 'realestate', 'cash').href === '/s/realestate' && !/\d/.test(cellOf(r, 'realestate', 'cash').sentence))
check('③ 계절 다섯 칸 모두 ok · 여름 칩 = 승인 표(채권 역풍·주식 보통·부동산 보통·금 순풍·코인 보통)', r.rows.every(x => x.cells[2].status === 'ok') && r.rows.map(x => x.cells[2].chip).join(',') === '역풍,보통,보통,순풍,보통')
check('봄이면 채권 보통·주식 순풍·부동산 순풍·금 역풍·코인 순풍', (() => { const b = buildScale({ ...FULL, season: { ...FULL.season, us: { ...FULL.season.us, quad: 'goldilocks' }, kr: { ...FULL.season.kr, quad: 'goldilocks' } } }); return b.rows.map(x => x.cells[2].chip).join(',') === '보통,순풍,순풍,역풍,순풍' })())
check('미국·한국 계절이 다르면 주식 칩에 둘 다(미국 겨울 역풍 · 한국 봄 순풍)', cellOf(buildScale({ ...FULL, season: { ...FULL.season, us: { ...FULL.season.us, quad: 'recession' }, kr: { ...FULL.season.kr, quad: 'goldilocks' } } }), 'stock', 'season').chip === '미국 역풍 · 한국 순풍')
check('부동산 칩은 한국 계절로(미국 가을·한국 겨울 → 보통)', cellOf(buildScale({ ...FULL, season: { ...FULL.season, us: { ...FULL.season.us, quad: 'stagflation' }, kr: { ...FULL.season.kr, quad: 'recession' } } }), 'realestate', 'season').chip === '보통')
check('상세에 "수업 원칙 · 과거 경향이지 약속이 아님"', cellOf(r, 'bond', 'season').detail.includes('과거 경향이지 약속이 아님'))
check('채권 ③ = 미국 여름 + FedWatch 금리 예상(인상 · 다음 결정 날짜)', cellOf(r, 'bond', 'season').sentence === "미국은 지금 ☀️ 여름(경기↑ 물가↑)이에요. 시장은 앞으로 금리 '인상'을 예상해요(다음 결정 2026.10.28).")
check('주식 ③ = 미국·한국 둘 다 · 상세에 "한국 계절은 미국 물가를 써서" 밝힘', /미국 ☀️ 여름.*한국 ☀️ 여름/.test(cellOf(r, 'stock', 'season').sentence) && cellOf(r, 'stock', 'season').detail.includes('미국 물가(세계 물가의 기준)'))
check('부동산 ③ = 한국 계절 + 금리의 중력 · 이름표에 OECD 한국 경기선행 기준월', cellOf(r, 'realestate', 'season').sentence.startsWith('한국은 지금 ☀️ 여름') && cellOf(r, 'realestate', 'season').source.includes('OECD 한국 경기선행 2026-08'))
check('금 ③ = 미국 CPI 3.4% 올랐어요(2026.8)', cellOf(r, 'gold', 'season').sentence.includes('3.4% 올랐어요(2026.8)'))
check('③ 이름표 날짜 = 재료 기준월 중 가장 오래된 것(2026-08)', cellOf(r, 'bond', 'season').date === '2026-08')
const S0 = FULL.season
const sCase = (patch) => buildScale({ ...FULL, season: { ...S0, ...patch } })
check('미국 경기선행지수 폴백 → 미국 계절 칸 전부 hold("미국 경기선행지수 자료가 아직…")', ['bond', 'stock', 'gold', 'coin'].every(a => { const c = cellOf(sCase({ us: { ...S0.us, cliOk: false } }), a, 'season'); return c.status === 'hold' && c.sentence.includes('미국 경기선행지수') }))
check('한국 경기선행지수만 폴백 → 부동산 ③ hold · 주식 ③ 은 미국만 말하고 한국은 쉰다고 밝힘', cellOf(sCase({ kr: { ...S0.kr, cliOk: false } }), 'realestate', 'season').status === 'hold' && !cellOf(sCase({ kr: { ...S0.kr, cliOk: false } }), 'stock', 'season').sentence.includes('한국') && cellOf(sCase({ kr: { ...S0.kr, cliOk: false } }), 'stock', 'season').detail.includes('한국 계절은 쉬어요'))
check('CPI 폴백 → 계절 hold("미국 물가")', cellOf(sCase({ cpiOk: false, cpiMonth: null }), 'bond', 'season').sentence.includes('미국 물가 자료'))
check('CPI 3.4%(>3) + FedWatch 실패 → 물가축은 확정이라 계절은 말하되 금리 예상 문장은 뺀다', (() => { const c = cellOf(sCase({ rateDirOk: false }), 'bond', 'season'); return c.status === 'ok' && !c.sentence.includes('예상해요') && !c.source.includes('FedWatch') })())
check('CPI 2.8%(≤3) + FedWatch 실패 → 물가축이 폴백 hold 에 걸려 있어 계절을 말하지 않는다("금리 예상")', cellOf(sCase({ cpiYoY: 2.8, rateDirOk: false }), 'bond', 'season').sentence.includes('금리 예상 자료'))
check('간절기 → "계절이 바뀌는 중" 문구 · 칩 없음(판정 안 함)', cellOf(sCase({ us: { ...S0.us, quad: 'shoulder' } }), 'bond', 'season').sentence.includes('간절기(계절이 바뀌는 중') && cellOf(sCase({ us: { ...S0.us, quad: 'shoulder' } }), 'bond', 'season').chip === null)
check('부동산 ② 주담대 4.48% + 이름표에 주담대 기준월 2026-08 · 날짜 = 두 월 중 오래된 것', cellOf(r, 'realestate', 'price').sentence.includes('4.48%') && cellOf(r, 'realestate', 'price').source.includes('주담대 금리(신규취급) 2026-08') && cellOf(r, 'realestate', 'price').date === '2026-08' && cellOf(r, 'realestate', 'price').detail.includes('약 448만원'))
check('주담대 기준월이 없으면 금리 문장을 빼고 KB 만', !cellOf(buildScale({ ...FULL, kb: { ...FULL.kb, mortgage: null } }), 'realestate', 'price').sentence.includes('주택담보대출'))
check('채권 ① 문장에 원천 값 5.17%', cellOf(r, 'bond', 'cash').sentence.includes('5.17%'))
check('채권 ② = 명목 5.17% → 물가 뺀 2.83%, 상세에 예상 물가 2.34%(자기 날짜 병기)', /5\.17%.*2\.83%/.test(cellOf(r, 'bond', 'price').sentence) && cellOf(r, 'bond', 'price').detail.includes('2.34%') && cellOf(r, 'bond', 'price').detail.includes('2026.9.28'))
check('주식 ① 이익수익률 = 100÷19.2 = 5.2', cellOf(r, 'stock', 'cash').sentence.includes('약 5.2원'))
check('주식 ② 칩 = 원천 비교 기준(5년 평균 19.8)으로만 — 19.2 < 19.8 → 낮음', cellOf(r, 'stock', 'price').chip === '5년 평균보다 낮음')
check('주식 ② 상세에 이익수익률 vs 국채 이자(날짜 병기)', /5\.2% vs 미국 10년 국채 이자 5\.17%\(2026\.9\.25\)/.test(cellOf(r, 'stock', 'price').detail))
check('부동산 ② KB 전년비 4.4% 올랐어요(월간 기준월 2026-09)', cellOf(r, 'realestate', 'price').sentence.includes('4.4% 올랐어요') && cellOf(r, 'realestate', 'price').source.includes('매매가격지수(전국) 2026-09'))
check('금 ② 포기하는 이자 2.83% + 금값 1년 전보다 25.0% 올랐어요(3650/2920) · 상세에 두 원천 날짜', /2\.83%.*25\.0% 올랐어요/.test(cellOf(r, 'gold', 'price').sentence) && cellOf(r, 'gold', 'price').detail.includes('DFII10 2026.9.25'))
check('코인 ② 칩 = 원천 분류 번역(Greed → 탐욕) · 지금·1주·1달 전 점수', cellOf(r, 'coin', 'price').chip === '탐욕' && /73점, 1주 전 78점, 1달 전 69점/.test(cellOf(r, 'coin', 'price').sentence))
check('어느 칸도 사라·팔라 말을 하지 않는다', !r.rows.flatMap(x => x.cells).some(c => /사세요|파세요|매수하|매도하|사라|팔라|추천/.test(c.sentence + (c.detail ?? ''))))
check('가장 오래된 기준일 = 2026-08(경기선행·CPI·주담대 월간)', r.oldestDate === '2026-08')

// ── 원천이 비면: 숫자 대신 hold ──
const empty = buildScale({ today: '2026-09-29', realYield: null, factset: null, kb: null, gold: null, fng: null, season: null })
const holds = empty.rows.flatMap(x => x.cells).filter(c => c.q !== 'season' && c.status === 'hold')
check(`원천 전부 실패 → 숫자 칸 7개가 hold(숫자 없음)`, holds.length === 7 && holds.every(c => !/\d/.test(c.sentence) && c.source == null && c.date == null))
check('원천 전부 실패 → ③ 계절 다섯 칸도 hold(가짜 계절 없음)', empty.rows.every(x => x.cells[2].status === 'hold' && !/여름|겨울|봄|가을/.test(x.cells[2].sentence)))
check('원천 실패해도 금·코인 ① 없음·부동산 ① 설명은 그대로(사실이라 원천이 필요 없다)', ['gold', 'coin'].every(a => cellOf(empty, a, 'cash').status === 'none') && cellOf(empty, 'realestate', 'cash').status === 'text')
check('날짜 없는 값은 숫자로 쓰지 않는다(FactSet date 없음 → hold)', cellOf(buildScale({ ...FULL, factset: { ...FULL.factset, date: '' } }), 'stock', 'price').status === 'hold')
check('5년 평균이 없으면 칩 = 비교 기준 없음(임의 경계 금지)', cellOf(buildScale({ ...FULL, factset: { ...FULL.factset, avg5: null } }), 'stock', 'price').chip === '비교 기준 없음')

// ── 오래된 값: 문장 맨 앞에 날짜 ──
const stale = buildScale({ ...FULL, today: '2026-10-10' })   // FactSet 9/25 → 15일
check('FactSet 15일 지남 → 주식 문장 앞에 "2026.9.25 기준 — 아직 새 값이 안 왔어요"', cellOf(stale, 'stock', 'price').sentence.startsWith('2026.9.25 기준 — 아직 새 값이 안 왔어요.'))
check('KB 월간(9월)은 10/10 에 오래됐다고 하지 않는다(월간 주기)', !cellOf(stale, 'realestate', 'price').sentence.includes('아직 새 값'))
check('오늘 값은 날짜 선언 없음', !cellOf(r, 'coin', 'price').sentence.includes('아직 새 값'))

// ── 금 1년 비교는 날짜로 찾는다 ──
const bars = []
for (let d = Date.parse('2024-10-01T00:00:00Z'); d <= Date.parse('2026-09-26T00:00:00Z'); d += 86_400_000) {
  const dt = new Date(d); if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue
  bars.push({ date: dt.toISOString().slice(0, 10), close: 2000 + bars.length })
}
const gp = goldPoints(bars)
check(`금 마지막 봉 2026-09-25(금요일) · 1년 전 = 2025-09-25 이전 가장 가까운 거래일(${gp?.yearAgo?.date})`, gp.last.date === '2026-09-25' && gp.yearAgo.date === '2025-09-25')
const holed = bars.filter(b => !(b.date >= '2025-09-01' && b.date <= '2025-09-30'))   // 1년 전 근처 한 달 구멍
check('1년 전 근처에 이력 구멍(10일 넘음) → 비교하지 않는다(이웃 날로 메우지 않음)', goldPoints(holed).yearAgo === null)
check('1년 전 비교가 없으면 금 ② hold', cellOf(buildScale({ ...FULL, gold: { ...FULL.gold, yearAgo: null } }), 'gold', 'price').status === 'hold')

// ── 4단계: 오늘 바뀐 칸 ──
const c1 = chipsOf(r)
check('칩 스냅샷 = 칩 있는 칸만(쉬는 칸·칩 없는 칸 제외 — 부동산 ② 만 칩 없음 → 14칸 · 채권 ② 는 6차부터 칩 있음)', Object.keys(c1).length === 14 && c1['bond:season'] === '역풍' && c1['bond:price'] === '10년 평균보다 높음' && !('realestate:price' in c1))
const s1 = rollSnap(null, '2026-09-28', c1)
check('첫 스냅샷 → 비교 기준 없음(바뀐 칸 0)', s1.prevChips === null && diffChips(s1.prevChips, c1, r.rows).length === 0)
const s1b = rollSnap(s1, '2026-09-28', c1)
check('같은 날 다시 계산 → 비교 기준을 오늘 칩으로 덮지 않는다', s1b.prevDay === null && s1b.prevChips === null)
const autumn = buildScale({ ...FULL, season: { ...FULL.season, us: { ...FULL.season.us, quad: 'stagflation' } } })
const c2 = chipsOf(autumn)
const s2 = rollSnap(s1, '2026-09-29', c2)
const ch = diffChips(s2.prevChips, c2, autumn.rows)
check(`다음 날 미국만 가을로 → 바뀐 칸 = 주식 ③(보통 → 미국 역풍 · 한국 보통)·코인 ③(보통→역풍) · 부동산(한국 여름)은 그대로 · 비교 날짜 9/28 (${ch.map(x => x.name + ':' + x.to).join(',')})`, s2.prevDay === '2026-09-28' && ch.length === 2 && ch.every(x => x.q === 'season' && x.from === '보통') && ch.find(x => x.asset === 'stock')?.to === '미국 역풍 · 한국 보통' && ch.find(x => x.asset === 'coin')?.to === '역풍')
const s2b = rollSnap(s2, '2026-09-29', chipsOf(autumn))
check('같은 날 두 번째 계산에도 비교 기준(9/28)이 유지된다', s2b.prevDay === '2026-09-28' && diffChips(s2b.prevChips, chipsOf(autumn), autumn.rows).length === 2)
const heldOut = buildScale({ ...FULL, fng: null })
check('쉬는 칸(원천 실패)은 바뀜으로 세지 않는다', diffChips(c1, chipsOf(heldOut), heldOut.rows).length === 0)

// ── 4단계: 내가 가진 줄(보유 → 저울 줄) ──
const H = [
  ['BTC', '비트코인', 'CRYPTO', 'coin'], ['005930', '삼성전자', 'KR', 'stock'], ['AAPL', 'Apple', 'US', 'stock'],
  ['TLT', 'iShares 20+ Year Treasury Bond ETF', 'US', 'bond'], ['148070', 'KOSEF 국고채10년', 'KR', 'bond'],
  ['GLD', 'SPDR Gold Shares', 'US', 'gold'], ['411060', 'ACE KRX금현물', 'KR', 'gold'],
  ['329200', 'TIGER 리츠부동산인프라', 'KR', 'realestate'], ['VNQ', 'Vanguard Real Estate ETF', 'US', 'realestate'],
  ['360750', 'TIGER 미국S&P500', 'KR', 'stock'], ['USO', 'United States Oil Fund', 'US', null],
  ['091170', 'KODEX 은행', 'KR', 'stock'], ['139270', 'TIGER 200 금융', 'KR', 'stock'],
]
const wrong = H.filter(([t, n, m, want]) => scaleAssetOf(t, n, m) !== want).map(([t, n, m, want]) => `${n}→${scaleAssetOf(t, n, m)}(기대 ${want})`)
check(`보유 → 저울 줄 ${H.length}종(금융·은행은 금 아님 · 원유는 줄 없음)`, wrong.length === 0, wrong.join(' · '))
const cnt = countByScaleAsset(H.map(([t, n, m]) => ({ ticker: t, name: n, market: m })))
check('줄마다 종목 수 — 주식 5·채권 2·금 2·부동산 2·코인 1(원유 제외)', cnt.stock === 5 && cnt.bond === 2 && cnt.gold === 2 && cnt.realestate === 2 && cnt.coin === 1)

// ── 5단계: 채점표 ──
const sn = snapOf('2026-10-01', 'inflation', 'inflation', true, '5년 평균보다 낮음', 73)
check('여름 스냅샷 = 승인 표(채권 역풍·주식 보통·부동산 보통·금 순풍·코인 보통)', sn && ['bond', 'stock', 'realestate', 'gold', 'coin'].map(a => sn.wind[a]).join(',') === 'head,neutral,neutral,tail,neutral')
check('부동산은 한국 계절로(미국 여름·한국 겨울 → 부동산 보통, 주식은 미국 여름 보통)', snapOf('2026-10-01', 'inflation', 'recession', true, null, null).wind.realestate === 'neutral')
check('간절기·계절 재료 폴백이면 적지 않는다', snapOf('2026-10-01', 'shoulder', 'inflation', true, null, null) === null && snapOf('2026-10-01', 'inflation', 'inflation', false, null, null) === null)
const h1 = addSnap([], sn)
check('같은 날 두 번째 적립은 무시(불변 기록)', h1.length === 1 && addSnap(h1, { ...sn, fng: 10 }) === null)
// 가짜 시세 — 금 매일 +0.1%, 채권 매일 −0.03%, 주식·코인 보합, KB 월 +0.5%
const days = [], gold = [], bond = [], flat = []
for (let t = Date.parse('2026-09-15T00:00:00Z'), i = 0; t <= Date.parse('2028-03-31T00:00:00Z'); t += 86_400_000, i++) {
  days.push(new Date(t).toISOString().slice(0, 10)); gold.push(100 * 1.001 ** i); bond.push(100 * 0.9997 ** i); flat.push(100)
}
const kbD = [], kbV = []
for (let m = 0; m < 20; m++) { const d = new Date(Date.UTC(2026, 8 + m, 1)); kbD.push(d.toISOString().slice(0, 7)); kbV.push(100 * 1.005 ** m) }
const SER = { gold: { dates: days, values: gold }, bond: { dates: days, values: bond }, stock: { dates: days, values: flat }, coin: { dates: days, values: flat }, realestate: { dates: kbD, values: kbV } }
// 12달 × 달마다 여러 장(매주) — 달마다 첫 장만 진입으로 세야 한다
const SH = []
for (let m = 0; m < 12; m++) for (const dd of [1, 8, 15, 22]) { const d = new Date(Date.UTC(2026, 9 + m, dd)).toISOString().slice(0, 10); SH.push({ ...sn, d }) }
const early = computeScaleScore(SH, SER, '2026-12-15')
check(`3개월이 안 지난 달은 채점하지 않는다(12/15 기준 성숙 0) · 진입 달 ${early.cohortsStarted} · 첫 성적 ${early.firstResultMonth}(2026-10 + 9달 + 3달 = 2027-10)`, early.matured === 0 && early.cohortsStarted === 12 && early.firstResultMonth === '2027-10' && !early.gateOpen && early.stats === null)
const mid = computeScaleScore(SH, SER, '2027-09-10')   // 2026-10~2027-06 진입 9달 성숙
check(`게이트 전(성숙·비교 가능 ${mid.comparable}달 < ${COHORT_GATE}) → 숫자 없음`, mid.comparable === 9 && !mid.gateOpen && mid.stats === null)
const late = computeScaleScore(SH, SER, '2028-01-31')
check(`달마다 한 번만 센다(적립 ${late.days}장 → 채점 ${late.comparable}달)`, late.days === 48 && late.comparable === 12)
check(`금(순풍) − 채권(역풍) 3개월 차이 > 0 · 맞은 달 ${late.stats?.hits}/12 · 평균 ${(late.stats?.meanSpread * 100).toFixed(2)}%p`, late.gateOpen && late.stats.hits === 12 && late.stats.meanSpread > 0.09 && late.stats.meanSpread < 0.13)
check(`차이 대부분을 금이 만들었다고 밝힌다(${late.stats?.topAsset?.name} ${Math.round((late.stats?.topAsset?.share ?? 0) * 100)}%) · 한 계절(여름)에서만 검증`, late.stats.topAsset?.asset === 'gold' && late.stats.topAsset.share > 0.5 && late.stats.seasons.length === 1)
const kbMissing = computeScaleScore(SH, { ...SER, realestate: { dates: kbD.slice(0, 9), values: kbV.slice(0, 9) } }, '2028-01-31')
check('KB 지수가 청산 달에 아직 없으면 그 달은 미성숙(추정으로 메우지 않는다)', kbMissing.comparable < 12)

// ── 6차: 채권·금 ② 비교 기준(DFII10 10년 평균) · 코인 ③ M2 ──
check('채권 ② 칩 = 10년 평균(0.77)과 견줌 → 2.83 은 높음 · 문장에 10년 평균 병기', cellOf(r, 'bond', 'price').chip === '10년 평균보다 높음' && cellOf(r, 'bond', 'price').sentence.includes('지난 10년 평균은 0.77%'))
check('채권 ② 출처·상세에 평균의 기간(2016.9~2026.8)이 있다', /10년 평균/.test(cellOf(r, 'bond', 'price').source) && /2016\.9~2026\.8/.test(cellOf(r, 'bond', 'price').detail ?? ''))
check('금 ② 칩 = 포기하는 이자가 10년 평균보다 큼', cellOf(r, 'gold', 'price').chip === '포기하는 이자가 10년 평균보다 큼')
const noAvg = buildScale({ ...FULL, realYield: { ...FULL.realYield, avg10: null } })
check('10년 평균이 없으면 채권·금 ② 칩 = 비교 기준 없음(임의 경계 금지)', cellOf(noAvg, 'bond', 'price').chip === '비교 기준 없음' && cellOf(noAvg, 'gold', 'price').chip === '비교 기준 없음' && !cellOf(noAvg, 'bond', 'price').sentence.includes('10년 평균'))
check('0.77 vs 0.80 (차이 < 0.05) → 10년 평균과 같음', cellOf(buildScale({ ...FULL, realYield: { ...FULL.realYield, real: { v: 0.80, date: '2026-09-25' } } }), 'bond', 'price').chip === '10년 평균과 같음')
check('코인 ③ 문장에 M2 전년비 + 기준월 · 출처에 M2SL · 이름표 날짜는 가장 오래된 재료(2026-08)', cellOf(r, 'coin', 'season').sentence.includes('시중에 풀린 돈(M2)은 1년 전보다 5.7% 늘었어요(2026.8)') && /M2SL/.test(cellOf(r, 'coin', 'season').source) && cellOf(r, 'coin', 'season').date === '2026-08')
const noM2 = buildScale({ ...FULL, m2: null })
check('M2 가 없으면 코인 ③ 은 계절만 말하고 약속 문구가 없다', !cellOf(noM2, 'coin', 'season').sentence.includes('M2') && cellOf(noM2, 'coin', 'season').status === 'ok' && /자료가 아직 안 들어와/.test(cellOf(noM2, 'coin', 'season').detail ?? ''))
check("'곧 붙어요' 같은 약속 문구가 어느 칸에도 없다", [r, noM2, noAvg].every(x => x.rows.flatMap(y => y.cells).every(c => !/곧 붙어요|곧 열려요/.test(`${c.sentence} ${c.detail ?? ''}`))))
check('M2 −1.2% → 줄었어요', cellOf(buildScale({ ...FULL, m2: { yoy: -1.2, month: '2026-08' } }), 'coin', 'season').sentence.includes('1.2% 줄었어요'))

// ── (라이브) 프로덕션 /api/scale ──
try {
  const res = await fetch('https://investment-school-2026.vercel.app/api/scale', { signal: AbortSignal.timeout(60_000) })
  if (res.status === 404) console.log('⏭️  라이브 — /api/scale 아직 배포 전(404)')
  else {
    const j = await res.json()
    const live = j.rows.flatMap(x => x.cells)
    const liveOk = live.filter(c => c.status === 'ok')
    check(`라이브 /api/scale — 5줄 · 숫자 칸 ${liveOk.length}개 전부 이름표`, j.rows.length === 5 && liveOk.every(c => c.source && c.date))
    const liveHold = live.filter(c => c.status === 'hold')
    check('라이브 — 원천이 빈 칸 0개(계절 포함)', liveHold.length === 0, liveHold.map(c => c.sentence.slice(0, 20)).join(' · '))
  }
} catch (e) { fail++; console.log(`❌ 라이브 /api/scale 호출 실패 — ${e.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (투자학교 저울)')
process.exitCode = fail ? 1 : 0
