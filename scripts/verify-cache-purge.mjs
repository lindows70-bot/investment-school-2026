// app_cache 정리 검증 — 허용 목록 밖 키는 절대 안 지우고, 보존 기간(날짜) 판정이 정확한지
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import Module from 'node:module'
import { findDatedCacheKeys, parseRulePrefixes, prefixFromDefinition } from './cacheDateGuard.mjs'

const ROOT = 'C:/Users/lindo/investment-school-portfolio'
const OUT = `${ROOT}/.bt-cache-purge`

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
  include: [`${ROOT}/src/lib/cachePurge.ts`, `${ROOT}/src/lib/appCache.ts`],
}
writeFileSync(`${ROOT}/.bt-cache-purge.tsconfig.json`, JSON.stringify(tsconfig, null, 2))

// 이전 실행의 컴파일 결과를 먼저 지운다 — 안 지우면 컴파일 실패 때 옛 .js 로 거짓 green 이 난다
rmSync(OUT, { recursive: true, force: true })
try {
  execSync(`npx tsc -p "${ROOT}/.bt-cache-purge.tsconfig.json"`, { stdio: 'pipe' })
} catch (e) {
  console.log(e.stdout?.toString() ?? '')
  console.log(e.stderr?.toString() ?? '')
  process.exit(1)
}
if (!existsSync(`${OUT}/lib/cachePurge.js`) || !existsSync(`${OUT}/lib/appCache.js`)) {
  console.log('❌ 컴파일 결과 없음')
  process.exit(1)
}

// '@/…' 별칭 → 컴파일 산출물
const orig = Module._resolveFilename
Module._resolveFilename = function (r, ...a) { return orig.call(this, r.startsWith('@/') ? `${OUT}/${r.slice(2)}` : r, ...a) }
const require = Module.createRequire(import.meta.url)
const P = require(`${OUT}/lib/cachePurge.js`)
const A = require(`${OUT}/lib/appCache.js`)

let fail = 0
function check(label, cond) {
  if (cond) console.log(`✅ ${label}`)
  else { console.log(`❌ ${label}`); fail++ }
}

const DAY = 86_400_000
const NOW = Date.parse('2026-09-26T06:40:00Z')
const ago = d => new Date(NOW - d * DAY).toISOString()
const ANCIENT = '2000-01-01T00:00:00Z'

// ── ① 규칙 자체 ──
check('규칙 검사 통과(금지 문자·중복·3일 미만 없음)', P.validateRules(P.PURGE_RULES).length === 0)
check('규칙 검사가 LIKE 와일드카드를 잡는다', P.validateRules([{ prefix: 'a_b', keepDays: 5, why: '' }]).length === 1 && P.validateRules([{ prefix: 'a%', keepDays: 5, why: '' }]).length === 1)
check('규칙 검사가 구분자·빈 접두어를 잡는다', P.validateRules([{ prefix: 'a:b', keepDays: 5, why: '' }]).length === 1 && P.validateRules([{ prefix: '', keepDays: 5, why: '' }]).length === 1)
check('규칙 검사가 짧은 보존·중복을 잡는다', P.validateRules([{ prefix: 'x', keepDays: 1, why: '' }]).length === 1 && P.validateRules([{ prefix: 'x', keepDays: 3, why: '' }, { prefix: 'x', keepDays: 3, why: '' }]).length === 1)
const rule = p => P.PURGE_RULES.find(r => r.prefix === p)
const DAILY = ['market-flow-kr-v10', 'sector-rotation-v15', 'win-lose-v9', 'market-breadth-v2', 'tech-screener-v4', 'hi52-radar-v3',
  'insider-market-v1', 'analyst-rerating-v1', 'usm-grade-v1', 'core-reco-run-v1', 'swing-cron-run-v1', 'etf-snap-run-v1', 'insider-scan-run-v1', 'covered-call-xray-v2']
check('일별 문서·cronHealth 마커는 10일 이상 보존(cronHealth 8일 역탐색 · 최장 look-back 6일)', DAILY.every(p => rule(p) && rule(p).keepDays >= 10))
check('긴 TTL 기록은 TTL 보다 길게(guidance-snap 35d · etf-snap/insider-day 400d · rtms-rent 30d)',
  rule('guidance-snap').keepDays > 35 && rule('etf-snap-v1').keepDays > 400 && rule('insider-day-v1').keepDays > 400 && rule('rtms-rent-v2').keepDays > 30)
// M1(2026-09-27) — 날짜 키인데 목록에 없던 17종. 값 = 그 접두어를 읽는 유일한 getCache 의 maxAge(시간) — 전부 라우트 1곳(git grep 전수)
const M1_TTL_H = {
  'alpha-hunter-v3': 24, 'earn-results-v1': 6, 'fx-attribution-v2': 6, 'guidance-radar': 24, 'lynch-matrix-v2': 12,
  'morningstar-rating-v6': 24, 'permanent-loss-v2': 12, 'portfolio-backtest-v5': 12, 'portfolio-flow-v12': 12,
  'portfolio-reco-kr-v8': 12, 'tax-helper-v1': 6, 'weekly-report-me-v6': 6,                       // 사용자별 — 날짜 키 유지
  'corr-matrix-v2': 24,                                                                              // 사용자별 — M1 목록 밖, 전수 스캔에서 발견
  'bonds-v8': 6, 'crypto-demand-v2': 6, 'dividend-portfolio-v2': 12, 'ultra-dividend-v4': 12, 'cofix-v1': 12,   // 날짜 뺀 공유 문서
}
const m1Bad = Object.entries(M1_TTL_H).filter(([p, h]) => !rule(p) || rule(p).keepDays * 24 <= h).map(([p]) => p)
check(`M1 17종(+corr-matrix-v2)이 전부 규칙에 있고 keepDays > reader TTL${m1Bad.length ? ' — 문제: ' + m1Bad.join(', ') : ''}`, m1Bad.length === 0)
// btc-etf-v8 — 앱 reader 는 오늘 키만(btc-etf 3h · crypto-demand 24h). seed 스크립트는 like 'btc-etf-v%' 최신 60행 중 flow 가 가장 늦은
//   문서 하나만 쓰고 lastgood 보다 새것일 때만 쓴다(되돌리지 않는다) → 옛 일자 문서를 지워도 결과가 나빠지지 않는다. 그 전제를 코드에서 확인한다
const seedSrc = readFileSync(`${ROOT}/scripts/seed-btc-etf-lastgood.mjs`, 'utf8')
check('btc-etf-v8 규칙 keepDays ≥ 10(> reader 24h) · seed 의 전제(최신 1건 선택·lastgood 보다 새것일 때만 씀) 그대로 · lastgood 키는 규칙 밖',
  rule('btc-etf-v8')?.keepDays >= 10 &&
  /\.sort\(\(a, b\) => b\.flow\[b\.flow\.length - 1\]\.date\.localeCompare/.test(seedSrc) && /\)\[0\]/.test(seedSrc) &&
  /cur\?\.payload\?\.flowAsOf >= flowAsOf/.test(seedSrc) &&
  !P.shouldPurge('btc-etf-flow-lastgood-v1', ANCIENT, NOW) && !P.shouldPurge('btc-etf-v7:2026-09-24', ANCIENT, NOW))

// ── ② 허용 목록 밖은 아무리 오래돼도 안 지운다 ──
const NEVER = [
  'rtms-trade-v2:11110:202408',          // 나이를 안 보는 .in('key') reader(re-map·re-apt-pins)
  'tech-chart-v2:000660:KR:D', 'usm-history-v1', 'signal-history-v1', 'season-sector-v3', 'canon-fund-v2:000150:KR',
  'macro-screened-universe:v17', 'btc-etf-v4:2026-06-16', 'btc-etf-flow-lastgood-v1', 'oecd-cli-kr-v2',
  'jarvis-metrics-v14:000150:KR:2026-07-10',   // 옛 버전 — 크론이 아니라 SQL 파일로 지운다
  'true-fcf-v2:000080:KR', 'kr-name-v1:000080', 'cron-health-latest', 'timing-watch-latest-v2',
]
check('허용 목록 밖 키 15종은 2000년 행이어도 안 지운다', NEVER.every(k => !P.shouldPurge(k, ANCIENT, NOW)))
check('rtms-trade-v2 는 허용 목록에 없다(나이 안 보는 reader)', !rule('rtms-trade-v2'))
const UNDATED5 = ['bonds-v8', 'crypto-demand-v2', 'dividend-portfolio-v2', 'ultra-dividend-v4', 'cofix-v1']
check('날짜 뺀 새 키(콜론 없음)는 2000년 행이어도 안 지우고, 옛 날짜 키는 4일 전이면 지운다',
  UNDATED5.every(p => !P.shouldPurge(p, ANCIENT, NOW) && P.shouldPurge(`${p}:2026-09-20`, ago(4), NOW)))
check('tech-chart-v2 는 허용 목록에 없다(날짜 없는 키 — 덮어쓴다)', !rule('tech-chart-v2'))

// ── ③ 접두어 경계 ──
check('sector-v3 규칙이 season-sector-v3 를 안 지운다', !P.shouldPurge('season-sector-v3', ANCIENT, NOW))
check('sector-v3 규칙이 xsector-v3:… 를 안 지운다', !P.shouldPurge('xsector-v3:ai:13:abc', ANCIENT, NOW))
check('sector-v3 규칙이 sector-v31:… 를 안 지운다', !P.shouldPurge('sector-v31:ai:13:abc', ANCIENT, NOW))
check('접두어만 있는 키(콜론 없음)는 안 지운다', !P.shouldPurge('sector-v3', ANCIENT, NOW) && !P.shouldPurge('win-lose-v9', ANCIENT, NOW))
check("'|' 구분 키는 안 지운다", !P.shouldPurge('sector-v3|ai', ANCIENT, NOW))
check('대소문자가 다르면 안 지운다', !P.shouldPurge('Sector-v3:ai:13:abc', ANCIENT, NOW))
check('prefixOf — 첫 : 또는 | 앞', P.prefixOf('a-v1:x|y') === 'a-v1' && P.prefixOf('a-v1|x:y') === 'a-v1' && P.prefixOf('plain') === 'plain')
check('사용자별 키(버전 상수 결합)도 경계 일치', P.PURGE_RULES.some(r => r.prefix.startsWith('unified-reco-v')) &&
  P.shouldPurge(`${P.PURGE_RULES.find(r => r.prefix.startsWith('unified-reco-v')).prefix}:u:2026-09-01:fp`, ago(4), NOW))

// ── ④ 날짜 판정 ──
check('종목별(3일): 2.9일 전은 남기고 3.1일 전은 지운다', !P.shouldPurge('jarvis-metrics-v17:000150:KR', ago(2.9), NOW) && P.shouldPurge('jarvis-metrics-v17:000150:KR', ago(3.1), NOW))
check('옛 날짜 키 잔여분도 같은 규칙으로 걷힌다', P.shouldPurge('jarvis-metrics-v17:000150:KR:2026-08-17', ago(40), NOW))
check('일별(10일): 9.9일 전은 남기고 10.1일 전은 지운다', !P.shouldPurge('win-lose-v9:2026-09-16', ago(9.9), NOW) && P.shouldPurge('win-lose-v9:2026-09-16', ago(10.1), NOW))
check('경계: 정확히 keepDays 는 남긴다(초과만 지운다)', !P.shouldPurge('win-lose-v9:2026-09-16', ago(10), NOW))
check('시각을 못 읽으면 남긴다', !P.shouldPurge('win-lose-v9:2026-09-16', 'not-a-date', NOW) && !P.shouldPurge('win-lose-v9:2026-09-16', '', NOW))
check('미래 시각은 남긴다', !P.shouldPurge('win-lose-v9:2026-09-16', new Date(NOW + DAY).toISOString(), NOW))
check('기록(400일): 399일 전은 남긴다', !P.shouldPurge('etf-snap-v1:2025-08-24', ago(399), NOW) && P.shouldPurge('etf-snap-v1:2025-08-20', ago(402), NOW))
check('cutoffIso = now − keepDays', P.cutoffIso({ prefix: 'x', keepDays: 10, why: '' }, NOW) === ago(10))
check('키 속 날짜가 아니라 updated_at 으로 판정(오래된 날짜 키라도 최근 갱신이면 남긴다)', !P.shouldPurge('insider-day-v1:20250101', ago(1), NOW))

// ── ⑤ 오늘(KST)만 읽기 — 키에서 날짜를 뺀 캐시의 날짜 경계 ──
const t = s => Date.parse(s)
check('KST 23:59:59 와 다음날 00:00 은 다른 날', !A.sameKstDay(t('2026-09-26T14:59:59Z'), t('2026-09-26T15:00:00Z')))
check('KST 00:00 과 23:59:59 는 같은 날', A.sameKstDay(t('2026-09-25T15:00:00Z'), t('2026-09-26T14:59:59Z')))
check('UTC 날짜가 달라도 KST 같은 날이면 같다(08:59 KST vs 09:00 KST)', A.sameKstDay(t('2026-09-25T23:59:00Z'), t('2026-09-26T00:00:00Z')))

// ── ⑥ 정리 묶음 — 규칙 순서 돌리기·규칙당 묶음 상한·URL 크기 ──
const n = P.PURGE_RULES.length
const o1 = P.purgeOrder(n, Date.parse('2026-09-26T06:40:00Z')), o2 = P.purgeOrder(n, Date.parse('2026-09-27T06:40:00Z'))
check('규칙 순서: 하루에 모든 규칙을 한 번씩(빠짐·중복 없음)', o1.length === n && new Set(o1).size === n && o1.every(i => i >= 0 && i < n))
check('규칙 순서: 다음 날 시작 규칙이 한 칸 돈다', o2[0] === (o1[0] + 1) % n)
check('규칙 순서: KST 날짜 기준(같은 KST 날 00:10 과 23:50 은 같은 시작)', P.purgeOrder(n, Date.parse('2026-09-25T15:10:00Z'))[0] === P.purgeOrder(n, Date.parse('2026-09-26T14:50:00Z'))[0])
check('규칙 순서: n 일 안에 모든 규칙이 한 번씩 맨 앞에 온다(맨 끝 rtms-rent-v2 도)',
  new Set(Array.from({ length: n }, (_, d) => P.purgeOrder(n, Date.parse('2026-01-01T03:00:00Z') + d * DAY)[0])).size === n)
check('규칙 순서: 규칙 0개면 빈 배열', P.purgeOrder(0, NOW).length === 0)
check('규칙당 묶음 상한 1~10(앞 규칙이 예산을 독식하지 않게)', P.MAX_BATCHES_PER_RULE >= 1 && P.MAX_BATCHES_PER_RULE <= 10)
const enc = ks => ks.reduce((s, k) => s + encodeURIComponent(`"${k}"`).length + 3, 0)
const longKeys = Array.from({ length: 100 }, (_, i) => `portfolio-xray-v5:04d455c3-d95e-4376-b038-616c53ac585d:2026-09-${String(i % 30).padStart(2, '0')}:8dby4o${i}`)
const lc = P.chunkKeys(longKeys)
check('in(keys) 묶음: 긴 키 100개는 8 KB 넘지 않게 잘린다', lc.length > 1 && lc.every(c => enc(c) <= 8192))
check('in(keys) 묶음: 잘라도 키를 잃거나 겹치지 않는다', lc.flat().length === 100 && new Set(lc.flat()).size === 100 && lc.flat().every((k, i) => k === longKeys[i]))
const sc = P.chunkKeys(Array.from({ length: 250 }, (_, i) => `k-v1:${i}`))
check('in(keys) 묶음: 짧은 키는 개수 100 으로 자른다', sc.length === 3 && sc[0].length === 100 && sc[2].length === 50)
const huge = 'x-v1:' + 'a'.repeat(9000)
check('in(keys) 묶음: 혼자 상한을 넘는 키도 버리지 않는다', P.chunkKeys(['a-v1:1', huge, 'a-v1:2']).flat().length === 3)
check('in(keys) 묶음: 빈 입력 → 빈 결과', P.chunkKeys([]).length === 0)

// ── ⑦ 코드와의 대조 — '키로 쓰이는' 경계 일치만 센다(부분 문자열이면 sector-v3 가 season-sector-v3 로 통과한다) ──
const R = require(`${OUT}/lib/recoCacheVersion.js`)
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 따옴표로 시작해 접두어 뒤에 키 구분자(: |)·따옴표·결합(+)·like(%)·템플릿(${)가 오는 경우만 '키로 쓰임'
const keyUse = form => new RegExp(`['"\`]${esc(form)}(?=[:|'"\`+%]|\\$\\{)`)
const exactKey = key => new RegExp(`['"\`]${esc(key)}['"\`]`)
const formsOf = prefix => {
  const f = [prefix]
  if (prefix.endsWith(R.UNIFIED_RECO_V)) f.push(`${prefix.slice(0, -R.UNIFIED_RECO_V.length)}\${UNIFIED_RECO_V}`)   // 버전 상수 결합 키
  return f
}
check('경계 일치: sector-v3 는 season-sector-v3 에 안 걸린다', !keyUse('sector-v3').test("'season-sector-v3'") && keyUse('sector-v3').test('`sector-v3:${key}`'))
check('경계 일치: 옛 v1 은 v17 에 안 걸린다', !keyUse('jarvis-metrics-v1').test('`jarvis-metrics-v17:${tk}`'))
check('경계 일치: 경로 문자열(/api/news-catalyst)은 키가 아니다', !keyUse('news-catalyst').test("fetch('/api/news-catalyst')"))
check("경계 일치: '+' 결합 키 — 앞 버전을 올리면 옛 규칙이 코드에서 사라진 것으로 잡힌다",
  formsOf(`ai-rebalance-v52+${R.UNIFIED_RECO_V}`).some(f => keyUse(f).test('`ai-rebalance-v52+${UNIFIED_RECO_V}:${user.id}`')) &&
  !formsOf(`ai-rebalance-v52+${R.UNIFIED_RECO_V}`).some(f => keyUse(f).test('`ai-rebalance-v53+${UNIFIED_RECO_V}:${user.id}`')))

// app-cache-purge-rest.sql 은 A-2~A-27 을 한 문장으로 묶은 일회성 사본이라 같은 옛 접두어를 담는다
const SELF = ['src/lib/cachePurge.ts', 'scripts/verify-cache-purge.mjs', 'supabase/app-cache-purge.sql', 'supabase/app-cache-purge-rest.sql']
const files = execSync('git ls-files src scripts supabase', { cwd: ROOT, stdio: 'pipe' }).toString().trim().split('\n')
  .filter(f => /\.(ts|tsx|js|mjs|cjs|py|sql)$/.test(f) && !SELF.includes(f))
const corpus = files.map(f => ({ f, s: readFileSync(`${ROOT}/${f}`, 'utf8') }))
const usedIn = re => corpus.filter(c => re.test(c.s)).map(c => c.f)

const missing = P.PURGE_RULES.filter(r => !formsOf(r.prefix).some(f => usedIn(keyUse(f)).length)).map(r => r.prefix)
check(`허용 목록 접두어가 전부 코드에서 키로 쓰인다('+' 결합 키 포함)${missing.length ? ' — 없음: ' + missing.join(', ') : ''}`, missing.length === 0)
// 날짜를 뺀 5종 — 옛 `${prefix}:{날짜}` 를 쓰거나 읽는 코드가 남아 있으면 새 키와 갈라진다
const undatedLeft = UNDATED5.flatMap(p => usedIn(new RegExp(`['"\`]${esc(p)}:`)).map(f => `${p}@${f}`))
check(`날짜 뺀 5종의 옛 날짜 키(prefix:…) 참조가 코드에 0건${undatedLeft.length ? ' — 남음: ' + undatedLeft.join(', ') : ''}`, undatedLeft.length === 0)

// SQL 파일 A 섹션(옛 버전 삭제) — 거기 적힌 접두어·키를 코드가 하나도 안 읽어야 한다
const sql = readFileSync(`${ROOT}/supabase/app-cache-purge.sql`, 'utf8')
const aStart = sql.indexOf('-- A. 옛 버전'), aEnd = sql.indexOf('-- B. 보존 기간 초과')
check('SQL 파일에서 A·B 섹션을 찾았다', aStart > 0 && aEnd > aStart)
// 주석 줄은 뺀다(제외 사유 설명에 btc-etf-v% 같은 문자열이 있다) — SQL 문장 속 토큰만
const aSql = sql.slice(aStart, aEnd).split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n')
const aTokens = Array.from(new Set(Array.from(aSql.matchAll(/'([^']+)'/g)).map(m => m[1]).filter(t => t !== ':' && t !== '|')))
check(`SQL A 섹션 토큰을 읽었다(${aTokens.length}개)`, aTokens.length > 300)
const aHits = aTokens.flatMap(t => usedIn(t.includes(':') ? exactKey(t) : keyUse(t)).map(f => `${t}@${f}`))
check(`SQL A 섹션의 접두어·키가 코드에서 0건${aHits.length ? ' — 걸림: ' + aHits.slice(0, 8).join(', ') : ''}`, aHits.length === 0)
check('SQL A 섹션에 허용 목록(현재) 접두어가 없다', !aTokens.some(t => P.PURGE_RULES.some(r => r.prefix === t)))

// ── ⑧ 커밋 훅: 캐시 키에 날짜(scripts/cacheDateGuard.mjs · precommit-guard ④) ──
const purgeSrc = readFileSync(`${ROOT}/src/lib/cachePurge.ts`, 'utf8')
const RP = parseRulePrefixes(purgeSrc)
const RPres = new Set(Array.from(RP).map(p => p.replace('${UNIFIED_RECO_V}', R.UNIFIED_RECO_V)))
check(`훅의 규칙 파서 = 실제 PURGE_RULES(${RP.size}종 · 상수 결합 키 포함)`,
  RP.size === P.PURGE_RULES.length && P.PURGE_RULES.every(r => RPres.has(r.prefix)))
const srcLines = corpus.filter(c => c.f.startsWith('src/')).flatMap(c => c.s.split(/\r?\n/))
const resolveReal = n => prefixFromDefinition(n, srcLines)
const G = (lines, f = 'src/x.ts') => findDatedCacheKeys(new Map([[f, lines]]), RP, resolveReal)
const blockedBy = lines => G(lines).violations.length > 0
check('훅 ① 목록 밖 날짜 키 신규 추가 → 차단(kstDate · ${today} · toISOString · 월 키 · 따옴표+연결 · 키 없는 버전 변수 대입)', [
  'const cacheKey = `probe-new-v1:${kstDate()}`',
  'const cached = await getCache<X>(`probe-new-v1:${user.id}:${today}:${fp}`, 6 * 3600_000)',
  "await setCache(`probe-new-v1:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`, out)",
  'const k = `probe-new-v2:${lawd}:${new Date().toISOString().slice(0, 7)}`',
  "const cacheKey = 'probe-new-v1:' + kstDate()",
  "const cacheKey = 'probe-new-v1:' + today",
  "await setCache('probe-new-v1:' + dateKey, out)",
  "const k = `probe-new-v1:${new Date().toISOString().split('T')[0]}`",
  'const radarKey = `probe-radar:${user.id}:${dateKey}:${fp}`',
].every(l => blockedBy([l])))
const pipe = G(['const k = `win-lose-v9|${kstDate()}`'])
check("훅 ① 규칙에 있는 접두어라도 구분자 '|' 날짜 키 → 차단(shouldPurge 는 `접두어:` 만 지운다)",
  pipe.violations.length === 1 && /\|/.test(pipe.violations[0].why) && !P.shouldPurge('win-lose-v9|2026-09-01', ANCIENT, NOW))
check('훅 한계(의도) — 한 글자 변수 `${d}` 는 잡지 않는다(오탐 방지)', !blockedBy(['const cacheKey = `probe-new-v1:${d}`']))
check('훅 ① 상수 함수 키 — 정의를 찾아 목록 밖이면 차단', findDatedCacheKeys(new Map([['src/x.ts', ['const v = await getCache(PROBE_KEY(kstDate()), 1)']]]), RP,
  n => prefixFromDefinition(n, ['export const PROBE_KEY = (d: string) => `probe-new-v1:${d}`'])).violations.length === 1)
check('훅 ② PURGE_RULES 에 있는 접두어 → 통과(일별·사용자별·상수 결합·상수 함수)', [
  'const cacheKey = `win-lose-v9:${kstDate()}`',
  'const radarKey = `guidance-radar:${user.id}:${today}:${fp}`',
  'const cacheKey = `ai-rebalance-v52+${UNIFIED_RECO_V}:${user.id}:${kstDate()}:${fp}`',
  'let mf = await getCache<MarketFlowKrResult>(MARKET_FLOW_KR_KEY(kstDate()), 24 * 3600_000)',
  'const v = await getCache(SECTOR_ROTATION_KEY(today), 1)',
].every(l => !blockedBy([l])))
check('훅 ③ 예외 주석 → 통과', !blockedBy(['const cacheKey = `probe-new-v1:${kstDate()}`   // 캐시날짜예외: 시험용']))
check('훅 ④ 날짜 없는 키 → 통과', [
  'const cacheKey = `probe-new-v1:${ticker}:${market}`',
  "const cached = await getCache<X>('probe-new-v1', 6 * 3600_000, { sameKstDay: true })",
  'const key = `tech-chart-v2:${t}:${m}:${iv}`',
].every(l => !blockedBy([l])))
check('훅 오탐 없음 — URL·경로·JSX key={}·브라우저 저장소·주석 줄·로그 문자열', [
  'const r = await fetch(`https://api.example.com/v1:${kstDate()}`)',
  'fetch(`${base}/api/x?date=${today}`)',
  '<li key={`row:${date}`}>',
  '{rows.map(r => <Row key={`row:${r.id}:${today}`} />)}',
  'const storageKey = `dismissed:${today}`',
  "localStorage.setItem(`seen-v1:${today}`, '1')",
  'sessionStorage.setItem(`tab-v2:${kstDate()}`, t)',
  '  // 옛 키는 `probe-new-v1:${kstDate()}` 였다',
  'console.log(`done:${today}`)',
].every(l => !blockedBy([l])))
// 현재 코드 전체를 '추가된 줄'로 보면 한 줄도 걸리지 않아야 한다(btc-etf-v8 도 2026-09-27 규칙에 편입 — 옛 줄을 고쳐도 막히지 않는다)
const whole = findDatedCacheKeys(new Map(corpus.filter(c => /^src\/.*\.tsx?$/.test(c.f)).map(c => [c.f, c.s.split(/\r?\n/)])), RP, resolveReal)
const wholeP = Array.from(new Set(whole.violations.map(v => v.prefix)))
check(`현재 src 전체에서 정리 못 되는 날짜 키 0건(걸림: ${wholeP.join(', ') || '없음'} · 못 푼 상수 ${whole.unresolved.length})`,
  wholeP.length === 0 && whole.unresolved.length === 0)
check('규칙 파일을 못 읽으면 파서가 0종을 돌려준다(훅은 이때 이 검사만 건너뛴다)', parseRulePrefixes('').size === 0 && parseRulePrefixes('const x = 1').size === 0)

// 끝에서 끝 — 임시 인덱스(HEAD + 합성 파일)로 실제 훅을 돌린다. 작업 트리·실제 인덱스는 건드리지 않는다
{
  const tmp = mkdtempSync(`${tmpdir()}/cdg-`)
  const env = { ...process.env, GIT_INDEX_FILE: `${tmp}/index` }
  const git = (args, input) => spawnSync('git', args, { cwd: ROOT, env, input, encoding: 'utf8' })
  // 규칙은 작업 트리의 cachePurge.ts 로(커밋 전 규칙 변경도 반영) · noRules 면 규칙 파일을 인덱스에서 뺀다(fail-open 확인)
  const hook = (body, { noRules = false } = {}) => {
    git(['read-tree', 'HEAD'])
    if (noRules) git(['update-index', '--force-remove', 'src/lib/cachePurge.ts'])
    else {
      const rb = git(['hash-object', '-w', '--stdin'], purgeSrc).stdout.trim()
      git(['update-index', '--add', '--cacheinfo', `100644,${rb},src/lib/cachePurge.ts`])
    }
    const blob = git(['hash-object', '-w', '--stdin'], body).stdout.trim()
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},src/__cache_date_probe__.ts`])
    return spawnSync(process.execPath, ['scripts/precommit-guard.mjs'], { cwd: ROOT, env, encoding: 'utf8' })
  }
  try {
    const r1 = hook('const cacheKey = `probe-new-v1:${kstDate()}`\n')
    check('훅 끝에서 끝 ① 목록 밖 날짜 키 → exit 1 + 이유 문구', r1.status === 1 && /날짜 키는 영구 누적/.test(r1.stdout) && /probe-new-v1/.test(r1.stdout))
    const r1b = hook('export const PROBE_KEY = (d: string) => `probe-new-v1:${d}`\nexport const x = () => getCache(PROBE_KEY(kstDate()), 1)\n')
    check('훅 끝에서 끝 ① 상수 함수 키(정의를 인덱스에서 찾음) → exit 1', r1b.status === 1 && /probe-new-v1/.test(r1b.stdout))
    const r2 = hook('const radarKey = `guidance-radar:${user.id}:${today}:${fp}`\nconst mf = getCache(MARKET_FLOW_KR_KEY(kstDate()), 1)\n')
    check('훅 끝에서 끝 ② 목록에 있는 접두어 → exit 0', r2.status === 0 && !/날짜 키는 영구 누적/.test(r2.stdout))
    const r3 = hook('const cacheKey = `probe-new-v1:${kstDate()}`   // 캐시날짜예외: 시험용\n')
    check('훅 끝에서 끝 ③ 예외 주석 → exit 0', r3.status === 0)
    const r4 = hook("const cacheKey = 'probe-new-v1'\n")
    check('훅 끝에서 끝 ④ 날짜 없는 키 → exit 0', r4.status === 0)
    const r5 = hook('export const A = () => <li key={`row:${date}`}>x</li>\nconst storageKey = `dismissed:${today}`\n')
    check('훅 끝에서 끝 오탐 없음 — JSX key={} · storageKey → exit 0', r5.status === 0 && !/날짜 키는 영구 누적/.test(r5.stdout))
    const r6 = hook('const etfKey = `btc-etf-v8:${kstDate()}`   // 주석만 고친 옛 줄\n')
    check('훅 끝에서 끝 btc-etf-v8 옛 줄(주석만 수정) → exit 0(규칙 편입)', r6.status === 0)
    const r7 = hook('const cacheKey = `probe-new-v1:${kstDate()}`\n', { noRules: true })
    check('훅 끝에서 끝 규칙 파일을 못 읽으면 이 검사만 경고 후 건너뜀 → exit 0', r7.status === 0 && /캐시 날짜 키 검사 건너뜀/.test(r7.stdout))
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (캐시 정리)')
process.exit(fail ? 1 : 0)
