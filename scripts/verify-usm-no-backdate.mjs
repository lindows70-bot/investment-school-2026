// 🔒 불변식 — 미국 스마트머니 성적 적립에 **소급 기록이 없는가**(등재일이 적립한 날보다 한참 과거면 결과를 아는 채로 채점하게 된다).
//    2026-09-22 실사고: 거래가 멈춘 GREE 의 마지막 완성 봉이 07-23 이라 두 달 전 날짜로 적립됐다.
//    ⛔ 적립 자체는 크론이 한다 — 여기선 **이미 쌓인 기록**만 읽어 검사한다(읽기 전용).
//    🩹 2026-10-03: 예전엔 등재일을 '캐시 마지막 갱신일'과 비교해, 기록이 쌓일수록 정상 기록도 7일이 지나면 전부 걸렸다(거짓 빨강 101건).
//       이제는 각 기록의 **적립한 날(addedAt)** 과 비교한다. addedAt 이 없는 옛 기록은 적은 날을 알 수 없어 검사하지 않고 건수만 밝힌다.
import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'

const GAP_DAYS = 7   // 크론은 매일 돌므로 정상 기록의 등재일은 적립일의 '직전 거래일' — 주말·연휴를 넉넉히 잡아 7일
const dayGap = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400_000
/** 순수 판정 — 적립일이 있는 기록 중 등재일이 적립일보다 GAP_DAYS 넘게 과거인 것 */
const suspects = (hist) => hist.filter(h => h.addedAt && dayGap(h.date, h.addedAt) > GAP_DAYS)

let fail = 0
const check = (label, ok) => { if (ok) console.log(`✅ ${label}`); else { fail++; console.log(`❌ ${label}`) } }

// ── 판정식 자체 검사(DB 없이) — 거짓 빨강·놓침 양쪽 ──
const sample = [
  { ticker: 'OLD', date: '2026-09-21' },                              // 옛 기록(적립일 없음) — 아무리 오래돼도 검사 대상 아님
  { ticker: 'OK', date: '2026-09-21', addedAt: '2026-09-22' },        // 정상 — 지금이 몇 달 뒤여도 통과해야 한다(예전 거짓 빨강의 모양)
  { ticker: 'WKND', date: '2026-10-02', addedAt: '2026-10-05' },      // 주말 낀 정상
  { ticker: 'GREE', date: '2026-07-23', addedAt: '2026-09-22' },      // 실사고 모양 — 걸려야 한다
]
const ss = suspects(sample)
check('판정식 — 적립일 기준이라 오래된 정상 기록은 통과 · 옛 기록(적립일 없음)은 제외 · GREE 모양만 걸림', ss.length === 1 && ss[0].ticker === 'GREE')

// ── 실제 기록 ──
const ROOT = process.cwd().replace(/\\/g, '/')
if (!existsSync(`${ROOT}/.env.local`)) {
  console.log('⚠️ .env.local 없음 — 실제 기록 검사는 건너뜀')
} else {
  const env = {}
  for (const l of readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
  const { createClient } = createRequire(`${ROOT}/package.json`)('@supabase/supabase-js')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await db.from('app_cache').select('payload, updated_at').eq('key', 'usm-history-v1').maybeSingle()
  const hist = data?.payload ?? []
  if (!hist.length) {
    console.log('적립 기록 없음 — 검사할 것이 없습니다')
  } else {
    const dates = Array.from(new Set(hist.map(h => h.date))).sort()
    const withAt = hist.filter(h => h.addedAt).length
    console.log(`적립 ${hist.length}건 · 등재일 ${dates.length}종 (${dates[0]} ~ ${dates[dates.length - 1]}) · 마지막 갱신 ${String(data.updated_at).slice(0, 10)}`)
    console.log(`   적립일이 있는 기록 ${withAt}건 검사 · 옛 기록 ${hist.length - withAt}건은 적립일이 없어 제외(적립 당시 5일 가드를 거쳤다)`)
    const bad = suspects(hist)
    check(`실제 기록 — 등재일이 적립일보다 ${GAP_DAYS}일 넘게 과거인 기록 0건${bad.length ? `(의심 ${bad.length}건: ${bad.slice(0, 8).map(b => `${b.ticker} ${b.date}→${b.addedAt}`).join(' · ')})` : ''}`, bad.length === 0)
    if (bad.length) console.log('   원인: 캔들이 낡은 종목(거래정지·상장폐지)의 마지막 완성 봉을 등재일로 썼을 때. usSmartHistory.appendUsmHistory 의 5일 가드 확인.')
  }
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (🔒 소급 적립 없음)')
process.exitCode = fail ? 1 : 0
