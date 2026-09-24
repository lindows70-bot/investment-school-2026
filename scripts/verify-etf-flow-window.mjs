// 🔒 불변식 — ETF 순유입의 '1주/1개월'이 **실제 달력 기간**인가. 스냅샷이 빠진 날이 있으면 값을 내지 않아야 한다.
//    (CLAUDE.md: 인덱스 산술로 기간을 세지 마라 — 구멍이 나는 순간 조용히 다른 기간이 된다 · CPI 13개월 차분 사고와 같은 모양)
//    실제 src/lib/etfFlow.ts 를 tsc 로 컴파일해 buildEtfFlow 를 돌린다(재구현 금지). app_cache 는 스텁 — 네트워크·DB 접근 없음.
import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import Module from 'module'

const ROOT = process.cwd().replace(/\\/g, '/')
const OUT = `${ROOT}/.bt-etfflow`
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}.tsconfig.json`, JSON.stringify({
  extends: `${ROOT}/tsconfig.json`,
  compilerOptions: { outDir: OUT, module: 'commonjs', moduleResolution: 'node', noEmit: false, declaration: false, target: 'es2020', rootDir: `${ROOT}/src` },
  include: [`${ROOT}/src/lib/etfFlow.ts`],
}, null, 2))
try { execSync(`npx tsc -p "${OUT}.tsconfig.json"`, { cwd: ROOT, stdio: 'pipe' }) } catch (e) { console.log('tsc:', String(e.stdout ?? e).slice(0, 300)) }

// 스냅샷·캔들을 주입하는 스텁
const SNAPS = new Map()
writeFileSync(`${OUT}/lib/appCache.js`, `exports.getCache = async k => globalThis.__snaps.get(k) ?? null; exports.setCache = async () => {};`)
writeFileSync(`${OUT}/lib/techChartData.js`, `exports.getTechCandles = async () => []; exports.dropIncompleteBar = d => d;`)
globalThis.__snaps = SNAPS
const require2 = createRequire(`${ROOT}/package.json`)
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const { buildEtfFlow, ETF_SNAP_KEY } = require2(`${OUT}/lib/etfFlow.js`)

const day = off => new Date(Date.now() - 5 * 3600_000 - off * 86400_000).toISOString().slice(0, 10)
/** offsets(오늘로부터 며칠 전)마다 스냅샷을 넣는다. aum 은 매일 +1M(순유입 1M), nav 고정 → flow = 정확히 1M/일.
 *  qqqOffsets 를 따로 주면 같은 그룹(지수형) 안에서 한 종목만 구멍 난 상황을 만든다. */
function seed(offsets, qqqOffsets = null) {
  SNAPS.clear()
  const put = (off, t) => {
    const k = ETF_SNAP_KEY(day(off)), d = SNAPS.get(k) ?? { day: day(off), at: '', etfs: {} }
    d.etfs[t] = { aum: 1e11 + (40 - off) * 1e6, nav: 600, price: 600 }
    SNAPS.set(k, d)
  }
  for (const off of offsets) put(off, 'SPY')
  for (const off of qqqOffsets ?? []) put(off, 'QQQ')
}
const spy = f => f.items.find(i => i.t === 'SPY')

let fail = 0
const check = (label, cond, extra = '') => { console.log(cond ? 'PASS' : 'FAIL', label, extra); if (!cond) fail++ }

// ① 연속 6일(거래일 가정) → 1주 값이 나오고 구간이 5일
seed([5, 4, 3, 2, 1, 0])
let f = await buildEtfFlow(null)
check('연속 6개 → 1주 순유입 산출', spy(f)?.flow1w != null, `flow1w=${spy(f)?.flow1w} range=${spy(f)?.flow1wRange}`)
check('  구간이 5일', spy(f)?.flow1wRange === `${day(5).slice(5)}~${day(0).slice(5)}`)
check('  값이 5M(하루 1M × 5)', Math.round((spy(f)?.flow1w ?? 0) / 1e6) === 5, `${spy(f)?.flow1w}`)

// ② 중간에 구멍 — 같은 6개인데 20일에 걸쳐 있으면 '1주'가 아니다 → 값을 비운다
seed([20, 16, 12, 8, 4, 0])
f = await buildEtfFlow(null)
check('구멍 난 6개(20일 걸침) → 1주 값을 비움', spy(f)?.flow1w === null, `flow1w=${spy(f)?.flow1w}`)

// ③ 경계 — 6개가 12일에 걸치면(주말 포함 현실 범위) 여전히 산출
seed([11, 9, 7, 5, 3, 0])
f = await buildEtfFlow(null)
check('6개가 12일 이내면 산출(주말 포함 정상)', spy(f)?.flow1w != null, `range=${spy(f)?.flow1wRange}`)

// ④ 5개뿐이면 산출 금지(표본 부족)
seed([4, 3, 2, 1, 0])
f = await buildEtfFlow(null)
check('스냅샷 5개 → 1주 값 없음', spy(f)?.flow1w === null)

// ⑤ 같은 그룹에서 한 종목만 구멍 → 합계는 더한 개수를 밝히고, 그 종목 값은 비어야 한다
seed([5, 4, 3, 2, 1, 0], [30, 24, 18, 12, 6, 0])
f = await buildEtfFlow(null)
const idx = f.groups.find(g => g.group === 'index')
check('한 종목만 구멍 → 그룹 합계에 1/2 표기', idx?.flow1wOf === '1/2', `flow1wOf=${idx?.flow1wOf}`)
check('  구멍 난 종목(QQQ)은 값 없음', f.items.find(i => i.t === 'QQQ')?.flow1w === null)

// ⑥ 발행주수 실측표(sharesProbe) — 옛 스냅샷(필드 없음)은 '못 물어봄'으로 제외, 값이 매일 바뀌면 daily, 안 바뀌면 stale, 5일 미만이면 collecting
const seedShares = (spyShares, ibitShares = null) => {
  SNAPS.clear()
  spyShares.forEach((v, i) => {
    const off = spyShares.length - 1 - i, k = ETF_SNAP_KEY(day(off))
    // v === undefined 는 '발행주수를 안 물어본 옛 스냅샷' — 그날은 IBIT 에도 필드를 넣지 않는다
    SNAPS.set(k, { day: day(off), at: '', etfs: { SPY: { aum: 1e11, nav: 600, price: 600, ...(v === undefined ? {} : { shares: v }) }, IBIT: { aum: 6e10, nav: 60, price: 60, ...(v === undefined ? {} : { shares: ibitShares }) } } })
  })
}
seedShares([undefined, undefined, undefined])
f = await buildEtfFlow(null)
check('옛 스냅샷(필드 없음) → askedDays 0 · collecting', f.sharesProbe.askedDays === 0 && f.sharesProbe.verdict === 'collecting', JSON.stringify(f.sharesProbe))
seedShares([100, 101, 102, 103, 104, 105])
f = await buildEtfFlow(null)
check('6일 매일 바뀜 → daily', f.sharesProbe.verdict === 'daily' && f.sharesProbe.items[0]?.changed === 5, JSON.stringify(f.sharesProbe))
check('  야후가 안 준 종목(IBIT null)은 none 에', f.sharesProbe.none.includes('IBIT'))
seedShares([100, 100, 100, 100, 100, 100])
f = await buildEtfFlow(null)
check('6일 동결 → stale', f.sharesProbe.verdict === 'stale' && f.sharesProbe.items[0]?.distinct === 1, JSON.stringify(f.sharesProbe))
seedShares([100, 101, 102])
f = await buildEtfFlow(null)
check('3일뿐 → collecting(판정 보류)', f.sharesProbe.verdict === 'collecting')
check('  실측표는 순유입 값에 영향 없음', spy(f)?.flow1w === null)

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (🔒 ETF 순유입 기간 불변식)')
process.exit(fail ? 1 : 0)
