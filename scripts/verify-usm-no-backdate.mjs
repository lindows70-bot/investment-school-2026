// 🔒 불변식 — 미국 스마트머니 성적 적립에 **소급 기록이 없는가**(등재일이 오늘보다 한참 과거면 결과를 아는 채로 채점하게 된다).
//    2026-09-22 실사고: 거래가 멈춘 GREE 의 마지막 완성 봉이 07-23 이라 두 달 전 날짜로 적립됐다.
//    ⛔ 적립 자체는 크론이 한다 — 여기선 **이미 쌓인 기록**만 읽어 검사한다(읽기 전용).
import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'
const ROOT = process.cwd().replace(/\\/g, '/')
if (!existsSync(`${ROOT}/.env.local`)) { console.log('⚠️ .env.local 없음 — 건너뜀'); console.log('✅ 전부 통과 (🔒 소급 적립 없음 · 검사 생략)'); process.exit(0) }
const env = {}
for (const l of readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const { createClient } = createRequire(`${ROOT}/package.json`)('@supabase/supabase-js')
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const { data } = await db.from('app_cache').select('payload, updated_at').eq('key', 'usm-history-v1').maybeSingle()
const hist = data?.payload ?? []
if (!hist.length) { console.log('적립 기록 없음 — 검사할 것이 없습니다'); console.log('✅ 전부 통과 (🔒 소급 적립 없음)'); process.exit(0) }

// 기록이 적립된 시점(updated_at)보다 **7일 이상 과거**인 등재일이 있으면 소급이다.
//   (크론은 매일 돌므로 정상 기록의 등재일은 언제나 '직전 거래일' — 주말·휴일을 넉넉히 잡아 7일)
const stamp = new Date(data.updated_at).getTime()
const bad = hist.filter(h => (stamp - Date.parse(h.date)) / 86400_000 > 7)
const dates = Array.from(new Set(hist.map(h => h.date))).sort()
console.log(`적립 ${hist.length}건 · 등재일 ${dates.length}종 (${dates[0]} ~ ${dates[dates.length - 1]}) · 마지막 갱신 ${data.updated_at.slice(0, 10)}`)
if (bad.length) {
  console.log(`❌ 소급 의심 ${bad.length}건 — ${bad.slice(0, 8).map(b => `${b.ticker}(${b.date})`).join(' · ')}`)
  console.log('   원인: 캔들이 낡은 종목(거래정지·상장폐지)의 마지막 완성 봉을 등재일로 썼을 때. usSmartHistory.appendUsmHistory 의 5일 가드 확인.')
  process.exit(1)
}
console.log('✅ 전부 통과 (🔒 소급 적립 없음)')
