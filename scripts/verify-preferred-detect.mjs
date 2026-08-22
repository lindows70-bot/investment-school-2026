// ✅ 우선주 판정 SSOT 단위검증 — 실제 lib 을 컴파일해 검증한다(재구현 금지).
//    표본은 Phase 0 실측 응답 그대로. 기대: 우선주 7/7 적중 · 보통주·ETF·KR보통주 오탐 0.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Module from 'node:module'

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'pref-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  // rootDir 을 명시하지 않으면 단일 파일 컴파일 시 tsc 가 그 파일의 디렉터리를 루트로 잡아 출력 경로가 달라진다
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, jsx: 'react' },
  // ⚠️ include 를 비우지 않으면 확장한 프로젝트 tsconfig 의 include 가 그대로 상속돼 앱 전체가 컴파일된다
  include: [],
  exclude: [],
  files: [join(ROOT, 'src/lib/preferredStock.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })

const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith('@/')) return orig.call(this, join(out, 'src', req.slice(2)), ...rest)
  return orig.call(this, req, ...rest)
}
const { analyzePreferred, isPreferredTrap } = await import('file://' + join(out, 'src/lib/preferredStock.js').replace(/\\/g, '/'))

// Phase 0 실측 응답(2026-08-22 yahoo-finance2) — 값을 지어내지 않고 그대로 옮겼다
const S = (ticker, market, shortName, longName, quoteType, marketCap, annualDividend, price, expect) =>
  ({ ticker, market, shortName, longName, quoteType, marketCap, annualDividend, price, expect })

const SAMPLES = [
  // 🎯 Strategy 우선주
  S('STRC', 'US', 'Strategy Inc - Variable Rate Se', 'Strategy Inc', 'EQUITY', null, 12, 96.18, true),
  S('STRK', 'US', 'Strategy Inc - 8.00% Series A P', 'Strategy Inc', 'EQUITY', null, 8, 72.26, true),
  S('STRF', 'US', 'Strategy Inc - 10.00% Series A ', 'Strategy Inc', 'EQUITY', null, 10, 99.57, true),
  S('STRD', 'US', 'Strategy Inc - 10.00% Series A ', 'Strategy Inc', 'EQUITY', null, 10, 72.50, true),
  // 🔸 타사 우선주(일반화)
  S('BAC-PL', 'US', 'Bank of America Corporation Non', 'Bank of America Corporation', 'EQUITY', null, null, null, true),
  S('NLY-PF', 'US', 'Annaly Capital Management Inc 6', 'Annaly Capital Management, Inc.', 'EQUITY', null, null, null, true),
  S('AGNCN', 'US', 'AGNC Investment Corp. - Deposit', 'AGNC Investment Corp.', 'EQUITY', null, null, null, true),
  // ⚪ 보통주(오탐)
  S('MSTR', 'US', 'Strategy Inc', 'Strategy Inc', 'EQUITY', 47375839232, 0, 119.25, false),
  S('MO', 'US', 'Altria Group, Inc.', 'Altria Group, Inc.', 'EQUITY', 110353367040, 4.08, 66.09, false),
  S('O', 'US', 'Realty Income Corporation', 'Realty Income Corporation', 'EQUITY', 59233247232, 3.22, 62.6, false),
  S('T', 'US', 'AT&T Inc.', 'AT&T Inc.', 'EQUITY', 173296844800, 1.11, 25.29, false),
  S('VZ', 'US', 'Verizon Communications Inc.', 'Verizon Communications Inc.', 'EQUITY', 205453639680, 2.71, 49.45, false),
  S('AGNC', 'US', 'AGNC Investment Corp.', 'AGNC Investment Corp.', 'EQUITY', 12909893632, 1.44, 10.89, false),
  S('NLY', 'US', 'Annaly Capital Management Inc.', 'Annaly Capital Management, Inc.', 'EQUITY', 17456025600, 2.86, 23.16, false),
  S('ARCC', 'US', 'Ares Capital Corporation', 'Ares Capital Corporation', 'EQUITY', 14303014912, 1.92, 19.92, false),
  S('EPD', 'US', 'Enterprise Products Partners L.', 'Enterprise Products Partners L.P.', 'EQUITY', 82081726464, 2.14, 38.01, false),
  S('SPGI', 'US', 'S&P Global Inc.', 'S&P Global Inc.', 'EQUITY', 127144296448, 3.84, 431.2, false),
  // ⚪ ETF(오탐)
  S('MSTY', 'US', 'YieldMax MSTR Option Income Str', 'Yieldmax MSTR Option Income Strategy ETF', 'ETF', null, 11.81, 14.4, false),
  S('JEPI', 'US', 'JPMorgan Equity Premium Income ', 'JPMorgan Equity Premium Income ETF', 'ETF', null, 4.1, 56.9, false),
  S('SCHD', 'US', 'Schwab US Dividend Equity ETF', 'Schwab U.S. Dividend Equity ETF', 'ETF', null, 1.03, 26.4, false),
  S('QYLD', 'US', 'Global X NASDAQ 100 Covered Cal', 'Global X NASDAQ 100 Covered Call ETF', 'ETF', null, 1.9, 17.5, false),
  // ⚪ KR
  S('005930', 'KR', 'SamsungElec', 'Samsung Electronics Co., Ltd.', 'EQUITY', 1848487620640768, 1444, 78000, false),
  S('005935', 'KR', 'SamsungElec(1P)', 'Samsung Electronics Co., Ltd.', 'EQUITY', 1365855300485120, 1445, 65000, true),
  S('051910', 'KR', 'LGCHEM', 'LG Chem, Ltd.', 'EQUITY', 19764464320512, 10000, 280000, false),
  S('051915', 'KR', 'LGCHEM(1P)', 'LG Chem, Ltd.', 'EQUITY', 9259945295872, 10050, 140000, true),
  // 🧪 오탐 방어 — 클래스 표기가 붙지만 우선주가 아닌 것(시총이 있으면 배제돼야 한다)
  S('BRK-B', 'US', 'Berkshire Hathaway Inc. New', 'Berkshire Hathaway Inc.', 'EQUITY', 1050000000000, 0, 480, false),
]

let pass = 0, fail = 0
console.log('티커      기대   실제   쿠폰    액면추정  괴리      판정')
for (const s of SAMPLES) {
  const r = analyzePreferred(s)
  const got = r != null
  const ok = got === s.expect
  ok ? pass++ : fail++
  const coupon = r?.isVariableRate ? '변동' : r?.couponPct != null ? r.couponPct.toFixed(2) + '%' : '—'
  const par = r?.parEstimate != null ? '$' + r.parEstimate.toFixed(2) : '—'
  const gap = r?.parGapPct != null ? (r.parGapPct >= 0 ? '+' : '') + r.parGapPct.toFixed(1) + '%' : '—'
  console.log(`${s.ticker.padEnd(9)} ${String(s.expect).padEnd(6)} ${String(got).padEnd(6)} ${coupon.padEnd(7)} ${par.padEnd(9)} ${gap.padEnd(9)} ${ok ? '✅' : '❌ 불일치'}`)
}
console.log(`\n결과 ${pass}/${SAMPLES.length} 통과 · 실패 ${fail}`)

// 경보 임계 확인 — 우선주라고 전부 경보를 달면 안 된다
console.log('\n경보 임계(배당률 ≥8% || 액면 ≤−10% || 변동금리)')
for (const [tk, dy] of [['STRC', 0.126], ['STRK', 0.1148], ['STRF', 0.1024], ['STRD', 0.1415], ['BAC-PL', 0.061]]) {
  const s = SAMPLES.find(x => x.ticker === tk)
  const r = analyzePreferred(s)
  console.log(`  ${tk.padEnd(8)} 배당률 ${(dy * 100).toFixed(2)}% → 경보 ${isPreferredTrap(r, dy) ? '⚠️ 발동' : '없음'}`)
}
rmSync(out, { recursive: true, force: true })
process.exitCode = fail === 0 ? 0 : 1
