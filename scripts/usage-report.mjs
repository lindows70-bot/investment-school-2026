// 화면·탭 열람 집계 보고 — app_cache usage-v1:{YYYY-MM} 를 읽어 경로·탭 횟수와 사용자별 횟수(선생님/학생)를 표로 찍는다(읽기 전용)
//   사용: node scripts/usage-report.mjs [YYYY-MM]  (기본 이번 달 KST)
import fs from 'node:fs'
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const g = k => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
const url = g('NEXT_PUBLIC_SUPABASE_URL'), key = g('SUPABASE_SERVICE_ROLE_KEY')
const H = { apikey: key, Authorization: `Bearer ${key}` }
const ym = process.argv[2] ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7)
const row = (await fetch(`${url}/rest/v1/app_cache?key=eq.${encodeURIComponent(`usage-v1:${ym}`)}&select=updated_at,payload`, { headers: H }).then(r => r.json()))?.[0]
if (!row) { console.log(`${ym} 집계 없음 — 아직 아무도 안 열었거나 집계 시작 전`); process.exit(0) }
const d = row.payload
const profiles = await fetch(`${url}/rest/v1/profiles?select=id,full_name,role`, { headers: H }).then(r => r.json())
const who = Object.fromEntries((Array.isArray(profiles) ? profiles : []).map(p => [p.id, `${p.full_name ?? p.id.slice(0, 8)}(${p.role ?? '?'})`]))
const top = (o, n = 40) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)
console.log(`📊 열람 집계 ${ym} · 시작 ${String(d.since).slice(0, 16)} · 갱신 ${String(row.updated_at).slice(0, 16)}`)
console.log('\n[화면 경로] 세션당 1회')
for (const [k, n] of top(d.page)) console.log(String(n).padStart(5), k)
console.log('\n[대시보드 탭] 세션당 1회')
for (const [k, n] of top(d.tab, 60)) console.log(String(n).padStart(5), k)
console.log('\n[사용자]')
for (const [k, n] of top(d.byUser)) console.log(String(n).padStart(5), who[k] ?? k.slice(0, 8))
console.log('\n⚠️ 0건인 화면은 "안 쓴 화면"이 아니라 "집계 시작 뒤 아직 안 연 화면"이다 — 2~4주 뒤에 읽는다')
