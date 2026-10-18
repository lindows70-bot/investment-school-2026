// app_cache 고아 행 불변식 — 버전을 올린 뒤 남은 옛 접두어(코드에 리터럴도, `base-v${…}` 동적 키도 없는 'name-vN')의 행 수가 상한을 넘으면 실패.
//   정리 장치(cachePurge.PURGE_RULES)는 현재 접두어만 지우도록 설계돼 옛 버전 행은 아무도 안 지웠다(2026-10-18 실측: 12,064행 중 7,200행이 고아 —
//   jarvis-metrics-v17 5,970행). appCache.purgeStaleCache 의 '낮은 버전 정리' 단계가 같은 base 의 옛 행을 지우지만, 규칙 밖 base 는 여기서만 드러난다.
//   읽기 전용(키만 읽는다 · 값은 안 읽는다). .env.local 의 서비스 키를 쓰되 값은 출력하지 않는다.
//   ⚠️ 야간 감사는 exit 0 에 더해 마지막 줄 '✅ 전부 통과' 문구를 본다.
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ORPHAN_ROW_LIMIT = 300   // 이보다 많으면 빨강 — 버전 범프 직후 며칠은 옛 행이 남아 있을 수 있어 0 이 아니다
const ROOT = process.cwd()
const envPath = `${ROOT}/.env.local`
if (!existsSync(envPath)) { console.log('❌ .env.local 없음 — 서비스 키를 못 읽어 검사 불가'); process.exitCode = 1 }
else {
  const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.log('❌ SUPABASE 환경변수 없음'); process.exitCode = 1 }
  else {
    const H = { apikey: key, Authorization: `Bearer ${key}` }
    const counts = new Map(); let from = 0, total = 0
    for (;;) {
      const r = await fetch(`${url}/rest/v1/app_cache?select=key&order=key.asc`, { headers: { ...H, Range: `${from}-${from + 999}` }, signal: AbortSignal.timeout(20_000) })
      const rows = await r.json(); if (!Array.isArray(rows) || rows.length === 0) break
      for (const row of rows) { const p = String(row.key).split(':')[0]; counts.set(p, (counts.get(p) || 0) + 1) }
      total += rows.length; from += rows.length; if (rows.length < 1000) break
    }
    // 고아 = 코드에 같은 base 의 **더 높은 버전 리터럴**이 있는 'base-vN'(대체됨). 동적 키(`base-v${상수}`)로만 만들어지는 base 는 리터럴이 없어 비교 대상에서 자연히 빠진다(오탐 방지)
    const grep = cmd => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean) } catch { return [] } }   // git grep 은 매치 0 이면 exit 1
    const maxLit = new Map()
    for (const s of grep('git grep -h -o -E "[a-z0-9-]+-v[0-9]+" -- src')) { const m = /^(.+)-v(\d+)$/.exec(s); if (m) maxLit.set(m[1], Math.max(maxLit.get(m[1]) || 0, Number(m[2]))) }
    const orphans = [...counts.entries()].filter(([p]) => { const m = /^(.+)-v(\d+)$/.exec(p); return m && maxLit.has(m[1]) && Number(m[2]) < maxLit.get(m[1]) }).sort((a, b) => b[1] - a[1])
    const rows = orphans.reduce((s, [, n]) => s + n, 0)
    console.log(`app_cache ${total}행 · 접두어 ${counts.size}종 · 고아 접두어 ${orphans.length}종 ${rows}행 (상한 ${ORPHAN_ROW_LIMIT})`)
    if (orphans.length) console.log('  ' + orphans.slice(0, 12).map(([p, n]) => `${p}=${n}`).join(' · '))
    if (rows > ORPHAN_ROW_LIMIT) { console.log(`\n❌ 고아 행 ${rows} > ${ORPHAN_ROW_LIMIT} — 옛 버전 접두어가 정리되지 않고 있다`); process.exitCode = 1 }
    else console.log('\n✅ 전부 통과 (app_cache 고아 행 상한)')
  }
}
