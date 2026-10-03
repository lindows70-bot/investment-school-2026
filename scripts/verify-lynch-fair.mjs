// 린치 적정가 SSOT(lib/lynchAnalysis.lynchFairValue) 검증 — 계산 규칙 · 세 화면이 그 함수를 부르는지(자기 배수표를 다시 만들지 않았는지) · 프로덕션 종목 정보로 계산이 성립하는지
//   2026-10-01 신설 — 같은 종목의 적정가가 화면마다 달랐다(SK하이닉스 ₩2,691,756 / ₩4,908,064 / ₩11,215,650). EPS 와 배수표가 화면마다 따로였고, 값이 그럴듯해 빌드·화면검증으로는 안 잡혔다.
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import Module from 'node:module'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-lynch-fair`
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, incremental: false, noEmitOnError: true, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/src/lib/lynchAnalysis.ts`, `${ROOT}/src/lib/fyEps.ts`],
}, null, 2))
rmSync(OUT, { recursive: true, force: true })
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) }
catch (e) { console.log('❌ 컴파일 실패'); console.log(e.stdout?.toString() ?? ''); process.exit(1) }
if (!existsSync(`${OUT}/lib/lynchAnalysis.js`)) { console.log('❌ 컴파일 결과 없음'); process.exit(1) }
const _res = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) { if (req.startsWith('@/')) req = `${OUT}/${req.slice(2)}`; return _res.call(this, req, ...rest) }
const require = Module.createRequire(`${ROOT}/package.json`)
const L = require(`${OUT}/lib/lynchAnalysis.js`)
const FYE = require(`${OUT}/lib/fyEps.js`)   // fyEpsFromGrid(순수) — getFyEps 는 app_cache 라 여기선 부르지 않는다

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}${why ? ` — ${why}` : ''}`) } }

// ── 계산 규칙 ──
// 보통 종목: 배수 = PER ÷ PEG(성장률), 분류 상한 안에서
const a = L.lynchFairValue({ eps: 100, pe: 20, peg: 2, category: 'stalwart', market: 'US', price: 2000 })
check(`보통 종목 — 배수 = PER ÷ PEG(20÷2 = 10) · 적정가 = EPS × 배수(${a.fairPrice}) · 괴리 ${a.gapPct}%`, a.multiple === 10 && a.fairPrice === 1000 && a.gapPct === 100 && a.jump === false)
const b = L.lynchFairValue({ eps: 100, pe: 40, peg: 0.5, category: 'stalwart', market: 'US', price: 4000 })
check(`성장률이 높아도 분류 상한에서 멈춤(우량주 상한 ${L.LYNCH_MULTIPLE_CAP.stalwart} → ${b.multiple})`, b.multiple === L.LYNCH_MULTIPLE_CAP.stalwart && b.jump === false)
// 이익 급증: PEG<0.3 & 성장>100% → 상한이 아니라 기본값
const c = L.lynchFairValue({ eps: 224313, pe: 8.15, peg: 0.07, category: 'cyclical', market: 'KR', price: 1828000 })
check(`이익 급증(PEG 0.07 · 성장 ${Math.round(8.15 / 0.07)}%) — 배수는 상한 ${L.LYNCH_MULTIPLE_CAP.cyclical} 이 아니라 기본 ${L.LYNCH_MULTIPLE_DEFAULT.cyclical}(${c.multiple}) · jump`, c.jump === true && c.multiple === L.LYNCH_MULTIPLE_DEFAULT.cyclical && c.fairPrice === 224313 * L.LYNCH_MULTIPLE_DEFAULT.cyclical)
check(`근거 문장에 EPS 와 배수가 들어감("${c.basis}")`, c.basis.includes('224,313') && c.basis.includes(`${c.multiple}배`))
// 성장률을 따로 주면 그 값으로 급증 판정(PER÷PEG 와 달라도)
const d = L.lynchFairValue({ eps: 100, pe: 20, peg: 0.2, growthPct: 50, category: 'cyclical', market: 'KR', price: 2000 })
check('성장률을 따로 주면 그 값으로 판정 — PEG 0.2 라도 성장 50% 면 급증 아님', d.jump === false)
// 적자·EPS 없음
const e = L.lynchFairValue({ eps: -500, pe: 0, peg: 0, category: 'turnaround', market: 'KR', price: 10000 })
const n = L.lynchFairValue({ eps: null, pe: 0, peg: 0, category: null, market: 'US', price: 100 })
check('적자·EPS 없음 — 적정가·괴리 null(예상 EPS 로 대신 만들지 않는다)', e.fairPrice === null && e.gapPct === null && n.fairPrice === null)
// EPS 이상값 보정은 기존 sanitizeEps 그대로
const s = L.lynchFairValue({ eps: 1000, pe: 0, peg: 0, category: 'stalwart', market: 'US', price: 1000 })
check(`EPS 이상값(주가 ÷ EPS = 1배)은 sanitizeEps 로 보정(${s.eps} = ${L.sanitizeEps(1000, 1000, 'stalwart')})`, s.eps === L.sanitizeEps(1000, 1000, 'stalwart') && s.eps < 1000)

// ── 경기순환주 정점 표시(2026-10-02) — 가격은 그대로 두고 '최근 이익이 확정 연도 최고치를 넘었다'는 사실만 ──
const FY = { max: 6564, from: '2023', to: '2025', n: 3 }
const pk = L.lynchFairValue({ eps: 22292, pe: 12.38, peg: 0.38, category: 'cyclical', market: 'KR', price: 276000, fyEps: FY })
const pkNo = L.lynchFairValue({ eps: 22292, pe: 12.38, peg: 0.38, category: 'cyclical', market: 'KR', price: 276000 })
check(`경기순환주 + 최근 EPS(22,292) > 확정 연도 최고(6,564) → peak · 이유 문장에 연도 수와 기간 · 적정가는 그대로(${pk.fairPrice} = ${pkNo.fairPrice})`, pk.peak === true && pk.jump === false && pk.holdNote.includes('3개 결산 연도(2023~2025)') && pk.fairPrice === pkNo.fairPrice && pkNo.peak === false && pkNo.holdNote === null)
check('최근 EPS 가 과거 최고보다 낮으면 peak 아님(현대차: 30,697 < 46,042)', L.lynchFairValue({ eps: 30697, pe: 11.3, peg: 1.77, category: 'cyclical', market: 'KR', price: 347000, fyEps: { max: 46042, from: '2023', to: '2025', n: 3 } }).peak === false)
check('경기순환주가 아니면 peak 아님(성장주의 최고 이익은 정상이다) · 비교 연도가 3개 미만이면 판정하지 않음', L.lynchFairValue({ eps: 22292, pe: 12, peg: 0.5, category: 'fast_grower', market: 'KR', price: 276000, fyEps: FY }).peak === false && L.lynchFairValue({ eps: 22292, pe: 12, peg: 0.5, category: 'cyclical', market: 'KR', price: 276000, fyEps: { ...FY, n: 2 } }).peak === false)
const both = L.lynchFairValue({ eps: 224313, pe: 8.15, peg: 0.07, category: 'cyclical', market: 'KR', price: 1828000, fyEps: { max: 58955, from: '2023', to: '2025', n: 3 } })
check('이익 급증과 정점이 겹치면 이유 문장은 급증 쪽(먼저 걸리는 가드)', both.jump === true && both.peak === true && !both.holdNote.includes('결산 연도'))

// ── 화면이 SSOT 를 부르는가(자기 배수표를 다시 만들지 않았는가) ──
const src = f => readFileSync(`${ROOT}/src/${f}`, 'utf8')
const auto = src('app/components/LynchAutoPanel.tsx'), mtd = src('app/components/macro/MacroTerminalDashboard.tsx'), lec = src('app/components/LynchEarningsChart.tsx')
check('린치 자동 분석 — lynchFairValue 호출 · 자체 배수표(CAT_MULT) 없음', /lynchFairValue\(/.test(auto) && !/CAT_MULT/.test(auto))
// 2026-10-03: PEG 칸이 '강력 매수 구간'이라 적고 같은 패널 이익선 칸이 '저평가 근거로 쓸 수 없다'고 적던 모순 — PEG 칸·종합 의견·리서치 상단 PEG 블록이 모두 fair.peak 를 본다
check('린치 자동 분석 — PEG 칸과 종합 의견이 정점(fair.peak)을 본다', /fair\.peak && peg <= 1\.0 \? \{ label: PEG_PEAK_LABEL/.test(auto) && /: fair\.peak\r?\n\s+\? '경기순환주의 지금 이익이/.test(auto))   // \r?\n — git 이 작업 사본을 CRLF 로 바꾸면 \n 만으로는 안 잡힌다(2026-10-03 거짓 빨강)
const rp = src('app/research/page.tsx')
// 2026-10-03: 정점 가드가 가치 축(유니버스 스크리너)까지 — 종합 판정 '매수 적합 81' 옆에 '저평가 근거로 쓸 수 없다'가 나란히 있던 모순
const scr = src('lib/macroPhaseScreener.ts'), rv = src('app/api/research-verdict/route.ts'), ur = src('app/api/unified-reco/route.ts')
check('스크리너 — 경기순환주 정점을 lynchFairValue(종목 정보 입력)로 판정하고 PEG·이익수익률·린치 점수를 중립으로', /lynchFairValue\(\{ eps: f\.eps/.test(scr) && /const pegGrad = pegPeak \? 0\.5 : pegGrad0/.test(scr) && /const eyScore = pegPeak \? 0\.4 : eyScore0/.test(scr) && /\(isPegBaseEffect\(peg, earnGrowth\) \|\| pegPeak\) \? 0\.5/.test(scr) && /macro-screened-universe:v18/.test(scr))
check('종합 판정 — 정점 플래그는 유니버스 값을 읽기만(재계산 없음) · cons 에 같은 이유 문장 · 저PEG 찬성 근거 억제', /const pegPeak = ax\?\.pegPeak \?\? false/.test(rv) && /pegPeak && peakNote\) cons\.push/.test(rv) && /!pegSuspect && !pegPeak && m\.peg/.test(rv) && !/lynchFairValue\(/.test(rv))
check('통합추천 — 정점이면 💎 저PEG 배지 대신 경고', /p\.s\.pegPeak \? '🏔️ 저PEG 이익 정점 의심' : '💎 저PEG'/.test(ur))
check('리서치 PEG 해석 블록 — 같은 함수(lynchFairValue)로 정점 판정 · 색·문구 모두 pegWarn/pegPeak', /const pegFair = stockInfo \? lynchFairValue\(/.test(rp) && (rp.match(/pegWarn \? TK\.amber500/g) ?? []).length === 2 && /pegPeak \? `\$\{PEG_PEAK_LABEL\} — \$\{pegFair!\.holdNote\}`/.test(rp))
check('매크로 터미널 — lynchFairValue 호출 · calcFairMultiple 직접 호출 없음', /lynchFairValue\(/.test(mtd) && !/calcFairMultiple\(/.test(mtd))
check('린치 이익 차트 — 진단 칸 적정가가 lynchFairValue(모델 배수 × EPS 가 아님)', /const ssot\s*=\s*lynchFairValue\(/.test(lec) && /const latestFair\s*=\s*ssot\.fairPrice/.test(lec))

// ── fyEps 격자 규칙(2026-10-03 — 3년→5년 · US 확장) ──
const grid = { '2021': { eps: 0 }, '2022': { eps: 3067 }, '2023': { eps: -12517 }, '2024': { eps: 27182 }, '2025': { eps: 58955 }, '2026E': { eps: 300000 } }
const fg = FYE.fyEpsFromGrid(grid, ['2021', '2022', '2023', '2024', '2025', '2026E', '2027E'])
check(`격자 → 0(자료 없음)은 빼고 적자 연도는 세고 E 는 제외: ${JSON.stringify(fg)}`, fg && fg.max === 58955 && fg.from === '2022' && fg.to === '2025' && fg.n === 4)
check('확정 연도가 3개 미만이면 null(판정하지 않는다)', FYE.fyEpsFromGrid({ '2024': { eps: 1 }, '2025': { eps: 2 } }, ['2024', '2025', '2026E']) === null)
check('재무 API 격자가 비어 있으면 null', FYE.fyEpsFromGrid({}, []) === null)

// ── 라이브: 프로덕션 종목 정보로 계산이 성립 ──
try {
  const B = 'https://investment-school-2026.vercel.app'
  for (const [t, mk, cat] of [['005930', 'KR', 'cyclical'], ['GOOGL', 'US', 'stalwart']]) {
    const [si, sp] = await Promise.all([
      fetch(`${B}/api/stock-info?ticker=${t}&market=${mk}`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()),
      fetch(`${B}/api/stock-price?ticker=${t}&market=${mk}`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()),
    ])
    const f = si?.fundamentals ?? {}
    const v = L.lynchFairValue({ eps: f.eps, pe: f.pe, peg: f.peg, growthPct: typeof f.earningsGrowth === 'number' ? f.earningsGrowth * 100 : null, category: cat, market: mk, price: sp?.currentPrice })
    check(`프로덕션 ${t} — ${v.basis} = ${v.fairPrice != null ? Math.round(v.fairPrice).toLocaleString('ko-KR') : null} · 지금 ${sp?.currentPrice} · 괴리 ${v.gapPct}%`,
      v.fairPrice != null && v.fairPrice > 0 && v.gapPct != null && v.multiple >= 8 && v.multiple <= L.LYNCH_MULTIPLE_CAP[cat] && Math.abs(v.fairPrice - v.eps * v.multiple) < 1e-6)
  }
  // 이익선 트레이서의 '현재' EPS 가 종목 정보의 최근 4분기 EPS 와 같은 값인가(2026-10-03 통일 — 그전엔 결산 EPS 라 SK하이닉스가 두 화면에서 반대 신호)
  for (const [t, mk] of [['000660', 'KR'], ['NVDA', 'US']]) {
    const [tr, si] = await Promise.all([
      fetch(`${B}/api/lynch-earnings-tracer?ticker=${t}&market=${mk}`, { signal: AbortSignal.timeout(60_000) }).then(r => r.json()),
      fetch(`${B}/api/stock-info?ticker=${t}&market=${mk}`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()),
    ])
    const e = si?.fundamentals?.eps
    check(`트레이서 ${t} — 현재 EPS ${tr?.currentEps}(${tr?.currentEpsBasis}) = 종목 정보 최근 4분기 EPS ${e}`,
      tr?.currentEpsBasis === 'ttm' && typeof e === 'number' && tr?.currentEps === e)
  }
  const fy = (await fetch(`${B}/api/stock-info?ticker=005930&market=KR`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()))?.fundamentals?.fyEps
  check(`프로덕션 종목 정보에 확정 연도 EPS 최고치가 실림 — KR 은 재무 API 5년(삼성전자 ${fy ? `${fy.max} · ${fy.from}~${fy.to} · ${fy.n}년` : fy})`, !!fy && fy.max > 0 && fy.n >= 5 && fy.from < fy.to)
  const fyUs = (await fetch(`${B}/api/stock-info?ticker=XOM&market=US`, { signal: AbortSignal.timeout(40_000) }).then(r => r.json()))?.fundamentals?.fyEps
  check(`프로덕션 US 종목 정보에도 확정 연도 EPS 최고치가 실림(엑슨모빌 ${fyUs ? `${fyUs.max} · ${fyUs.from}~${fyUs.to} · ${fyUs.n}년` : fyUs})`, !!fyUs && fyUs.max > 0 && fyUs.n >= 4 && fyUs.from < fyUs.to)
} catch (err) { fail++; console.log(`❌ 프로덕션 호출 실패 — ${err.message}`) }

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (린치 적정가 SSOT)')
process.exitCode = fail ? 1 : 0
