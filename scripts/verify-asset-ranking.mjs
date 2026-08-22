// ✅ 자산 시총 순위 SSOT 단위검증 — 실제 lib 컴파일. 스크린샷(금 22.6조·BTC 2.33조)과 자릿수가 맞나.
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Module from 'node:module'

const ROOT = process.cwd()
const out = mkdtempSync(join(tmpdir(), 'ar-'))
writeFileSync(join(out, 'tsconfig.json'), JSON.stringify({
  extends: join(ROOT, 'tsconfig.json').replace(/\\/g, '/'),
  include: [], exclude: [],
  compilerOptions: { outDir: out.replace(/\\/g, '/'), rootDir: ROOT.replace(/\\/g, '/'), module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, types: ['node'], typeRoots: [join(ROOT, 'node_modules/@types').replace(/\\/g, '/')] },
  files: [join(ROOT, 'src/lib/assetRanking.ts').replace(/\\/g, '/')],
}))
execSync(`npx tsc -p "${join(out, 'tsconfig.json')}"`, { stdio: 'inherit', cwd: ROOT })
const orig = Module._resolveFilename
Module._resolveFilename = function (req, ...rest) {
  if (req === 'yahoo-finance2') return orig.call(this, join(ROOT, 'node_modules', req), ...rest)
  return orig.call(this, req, ...rest)
}
const M = await import('file://' + join(out, 'src/lib/assetRanking.js').replace(/\\/g, '/'))

const d = await M.buildAssetRanking()
if (!d) { console.error('❌ buildAssetRanking() null'); process.exit(1) }
console.log('순위  자산                시가총액        BTC 대비   단가')
d.assets.forEach((a, i) => {
  console.log(`${String(i + 1).padStart(3)}. ${a.name.padEnd(16)} $${(a.cap / 1e12).toFixed(2).padStart(6)}조   ${String(a.vsBtc ?? '—').padStart(6)}x   ${a.price != null ? '$' + a.price.toLocaleString() : '—'}`)
})
console.log(`\n비트코인 ${d.btcRank}위 · $${(d.btcCap / 1e12).toFixed(2)}조 · 금의 ${d.btcVsGoldPct}%`)

let fail = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail++ }
console.log('\n═══ 판정 ═══')
const gold = d.assets.find(a => a.key === 'gold')
const btc = d.assets.find(a => a.key === 'btc')
check(d.assets.length >= 8, `자산 ${d.assets.length}종 수집`)
check(d.assets.every((a, i) => i === 0 || d.assets[i - 1].cap >= a.cap), '시총 내림차순 정렬')
// 스크린샷 대조 — 금 22.6조 / BTC 2.33조. 시세가 움직였을 수 있으니 자릿수(같은 조 단위)만 본다
check(gold != null && gold.cap / 1e12 > 10 && gold.cap / 1e12 < 60, `금 $${(gold?.cap / 1e12).toFixed(1)}조 — 스크린샷 22.6조과 같은 자릿수`)
check(btc != null && btc.cap / 1e12 > 0.5 && btc.cap / 1e12 < 10, `비트코인 $${(btc?.cap / 1e12).toFixed(2)}조 — 스크린샷 2.33조과 같은 자릿수`)
check(gold != null && btc != null && gold.cap > btc.cap, '금 > 비트코인(스크린샷과 같은 대소관계)')
check(d.assets.every(a => a.cap > 0 && isFinite(a.cap)), '모든 시총이 유효한 양수')
check(d.notes.some(n => n.includes('같은 잣대가 아닙니다')), '금/주식 잣대 차이 캐비엇 포함')
check(d.notes.some(n => n.includes('5%')), '⛔ 코인 가드 5% 포함')
check(d.notes.some(n => n.includes('추정치')), '지상 재고가 추정치임을 명시')

// 🔴 통화 회귀 방지 — 아람코가 SAR 시총(6.39조)을 USD 로 착각해 3.75배 부풀려진 적이 있다(2026-08-23)
const aramco = d.assets.find(a => a.key === '2222.SR')
check(aramco == null || (aramco.cap / 1e12 > 1.0 && aramco.cap / 1e12 < 3.0),
  `사우디 아람코 $${aramco ? (aramco.cap / 1e12).toFixed(2) : '—'}조 — 환산 후 1~3조 범위(미환산 SAR 이면 6조대로 튄다)`)
check(aramco == null || aramco.note.includes('환산'), '환산한 종목은 note 에 환율·원통화를 남긴다')
const nvda = d.assets.find(a => a.key === 'NVDA')
check(aramco == null || nvda == null || nvda.cap > aramco.cap,
  `엔비디아($${nvda ? (nvda.cap/1e12).toFixed(2) : '—'}조) > 아람코($${aramco ? (aramco.cap/1e12).toFixed(2) : '—'}조) — 실제 대소관계`)
check(d.notes.some(n => n.includes('환율')), '캐비엇에 환율 환산 사실 명시')

rmSync(out, { recursive: true, force: true })
console.log(`\n${fail === 0 ? '✅ 전부 통과' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
