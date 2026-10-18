// 🔒 API 게이트 불변식(2026-10-18 6·7차 점검) — 유료·쿼터 외부 API 를 **입력값으로** 부르는 라우트는 인증 게이트가 있어야 한다.
//   미들웨어는 페이지만 지키고 /api 는 라우트가 각자 지킨다 — 문서로만 두면 새 라우트에서 또 빠진다(117곳이 비어 있었다).
//   규칙: 라우트 소스가 (유료·쿼터 키/lib 를 직접 참조) AND (searchParams·body 를 읽음) 이면 게이트 호출이 있어야 한다.
//   간접(lib 경유) 비용은 보지 않는다 — 그건 호출부가 아니라 lib 의 책임이고, 입력 없는 공개 라우트(캐시·크론 워밍)는 허용한다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = `${ROOT}/src/app/api`

const COST = /FMP_API_KEY|DART_API_KEY|dartJson\(|callGeminiJSON\(|fredRaw\(|fredObservations\(|DATA_GO_KR_SERVICE_KEY|ALPHA_VANTAGE_API_KEY|KIS_APP_KEY|GEMINI_API_KEY|ECOS_API_KEY|R_ONE_API_KEY|SEOUL_API_KEY|LAW_API_OC/
const INPUT = /searchParams\.get\(|req\.json\(\)|nextUrl\.searchParams/
const GATE = /requireUserOrCron\(|isCronRequest\(|cronUnauthorized\(|getAuthedUserId\(|auth\.getUser\(|canForceRefresh\(|assertTossOwner\(|isTeacher\(/
// 입력을 읽지만 외부 비용으로 가는 입력이 아닌 것(검증 뒤 사유를 적는다) — 비어 있어야 정상
const ALLOW = new Map([
  // 예: ['stock-price', '야후·네이버·업비트만(무료·무인증) — 유료 키 없음'],
])
// 6차·7차에서 게이트를 넣은 라우트 — 하나라도 빠지면 회귀
const MUST_GATE = ['financials', 'fred', 'lynch-eps-history', 'macro-fundamentals', 'shadow-13f', 'reverse-dcf', 'decision-snapshot',
  'lynch-earnings-tracer', 'research-verdict', 'stock-profile', 'tenbagger', 'value-triangle', 'stock-info', 'monthly-pnl', 'signal-report', 'win-lose']

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = `${dir}/${n}`
    if (statSync(p).isDirectory()) walk(p, out)
    else if (n === 'route.ts') out.push(p)
  }
  return out
}

let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++ }

const routes = walk(API).map(p => ({ id: path.relative(API, path.dirname(p)).replace(/\\/g, '/'), src: readFileSync(p, 'utf8') }))
check('라우트를 읽었다', routes.length > 100, `${routes.length}개`)

const ungated = routes.filter(r => COST.test(r.src) && INPUT.test(r.src) && !GATE.test(r.src) && !ALLOW.has(r.id))
check('유료·쿼터 키를 직접 쓰고 입력을 받는 라우트는 전부 게이트가 있다', ungated.length === 0, ungated.length ? `없음: ${ungated.map(r => r.id).join(', ')}` : '0건')

for (const id of MUST_GATE) {
  const r = routes.find(x => x.id === id)
  check(`${id} 게이트 유지`, !!r && GATE.test(r.src), r ? '' : '라우트 없음')
}

// 허용 목록 사유 유지 — 사유 없는 항목 금지
check('허용 목록 항목마다 사유가 있다', Array.from(ALLOW.values()).every(v => typeof v === 'string' && v.length > 5))

if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (API 게이트)')
