// 학생 간단 모드 효과 측정 보고 — 주별 접속 학생 수·월별 기록 건수(읽기 전용, 서비스 키)
// 성공 기준(docs/student-mode/plan.md): 접속 기록 도입(2026-09-26) 후 4주, 주 1회 이상 여는 학생 수와 월 기록 건수를 도입 전 기준선과 비교
// 실행: node scripts/student-mode-report.mjs
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('❌ .env.local 에 SUPABASE URL·서비스 키가 없다'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const START = '2026-09-26'            // 접속 기록 시작일(KST)
const SYNTHETIC_MEMO = '자동 동기화'   // 거래 내역 화면이 자동으로 만든 행 — 학생이 적은 기록이 아니다

async function all(table, select) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}&order=created_at.asc&offset=${from}&limit=1000`, { headers: H, cache: 'no-store' })
    if (!r.ok) throw new Error(`${table} ${r.status} ${(await r.text()).slice(0, 120)}`)
    const j = await r.json(); rows.push(...j); if (j.length < 1000) return rows
  }
}
const kstDay = iso => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10)
const kstMonth = iso => kstDay(iso).slice(0, 7)
// 기록 시작일부터 7일 단위 주차(1주차 = 9/26~10/2)
const weekOf = day => Math.floor((Date.parse(day) - Date.parse(START)) / (7 * 864e5)) + 1

try {
  const profiles = await all('profiles', 'id,role,created_at')
  const students = new Set(profiles.filter(p => p.role === 'student').map(p => p.id))
  const [visits, inv, tx] = await Promise.all([
    all('student_visits', 'user_id,visit_date,created_at'),
    all('investments', 'user_id,created_at'),
    all('transactions', 'user_id,memo,created_at'),
  ])

  console.log(`학생 ${students.size}명 · 접속 기록 시작 ${START} (KST)\n`)

  // ① 주별 접속한 학생 수(선생님 제외)
  const byWeek = new Map()
  for (const v of visits) {
    if (!students.has(v.user_id) || v.visit_date < START) continue
    const w = weekOf(v.visit_date)
    if (!byWeek.has(w)) byWeek.set(w, { users: new Set(), days: 0 })
    byWeek.get(w).users.add(v.user_id); byWeek.get(w).days++
  }
  console.log('① 주별 접속 학생 수 (접속한 날 합계)')
  if (!byWeek.size) console.log('   아직 학생 접속 기록 없음')
  for (const w of Array.from(byWeek.keys()).sort((a, b) => a - b)) {
    const s = new Date(Date.parse(START) + (w - 1) * 7 * 864e5).toISOString().slice(5, 10)
    console.log(`   ${w}주차(${s}~) ${byWeek.get(w).users.size}명 / ${students.size}명 · 접속일 ${byWeek.get(w).days}`)
  }

  // ② 월별 학생 기록 건수 — 도입 전 기준선(5~9월)과 같은 방식: 종목 등록 + 거래 기록(자동 동기화 행 제외)
  const months = new Map()
  const bump = (m, k) => { if (!months.has(m)) months.set(m, { inv: 0, tx: 0, users: new Set() }); months.get(m)[k]++ }
  for (const r of inv) if (students.has(r.user_id)) { bump(kstMonth(r.created_at), 'inv'); months.get(kstMonth(r.created_at)).users.add(r.user_id) }
  for (const r of tx) if (students.has(r.user_id) && r.memo !== SYNTHETIC_MEMO) { bump(kstMonth(r.created_at), 'tx'); months.get(kstMonth(r.created_at)).users.add(r.user_id) }
  console.log('\n② 월별 학생 기록 (종목 등록 · 거래 기록 · 기록한 학생 수)')
  for (const m of Array.from(months.keys()).sort()) {
    const x = months.get(m)
    console.log(`   ${m}  등록 ${x.inv} · 거래 ${x.tx} · ${x.users.size}명`)
  }

  // ③ 도입 이후(9/26~) 기록 — 월 경계와 무관하게
  let after = 0; const afterUsers = new Set()
  for (const r of [...inv, ...tx.filter(t => t.memo !== SYNTHETIC_MEMO)])
    if (students.has(r.user_id) && kstDay(r.created_at) >= START) { after++; afterUsers.add(r.user_id) }
  console.log(`\n③ 도입 이후(${START}~) 학생 기록 ${after}건 · ${afterUsers.size}명`)
  console.log('\n✅ 보고 완료 (학생 간단 모드 측정)')
} catch (e) {
  console.error('❌ 조회 실패:', e.message)
  process.exitCode = 1
}
