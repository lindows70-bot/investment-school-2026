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
  include: [`${ROOT}/src/lib/scale.ts`, `${ROOT}/src/lib/seasonNavigator.ts`],
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
const { buildScale, goldPoints } = require(`${OUT}/lib/scale.js`)

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

// ── 입력(2026-09-29 프로덕션 실측값) ──
const FULL = {
  today: '2026-09-29',
  realYield: { nominal: { v: 5.17, date: '2026-09-25' }, real: { v: 2.83, date: '2026-09-25' }, bei: { v: 2.34, date: '2026-09-28' } },
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
