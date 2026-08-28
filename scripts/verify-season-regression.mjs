// 🌦️ CLI SSOT 교체 회귀 검증 — 킬스위치 화면 **하나만** 보면 안 되는 이유
//   fetchCli 를 lib/oecdCli 로 합치고 캐시 키를 v1→v2 로 올렸다.
//   이 원천은 5개 지역 계절(regionSeason)을 거쳐 8개 라우트로 퍼진다 —
//   판정이 조금이라도 달라졌으면 그 전부가 조용히 틀어진다.
//
//   검증 방식: 프로덕션 app_cache 의 **v1(옛 값) vs v2(새 값)** 를 직접 대조한다.
//   seasonOf 는 (cli, cliPrev, cpi, rateDir) 의 순수 함수이므로,
//   두 값이 같으면 다운스트림 판정이 같음이 **증명**된다(엔드포인트를 하나씩 찍는 것보다 강하다).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^\s*[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let fail = 0
const ok = (label, cond, detail = '') => { console.log(`${cond ? '  ✅' : '  ❌'} ${label}${detail ? ' — ' + detail : ''}`); if (!cond) fail++ }

const { data } = await sb.from('app_cache').select('key,payload').ilike('key', '%oecd-cli%')
const byKey = Object.fromEntries((data ?? []).map(r => [r.key, r.payload]))
const regions = ['us', 'kr', 'de', 'fr', 'it', 'gb', 'jp', 'cn']

// ⚠️ ①은 **일회성 마이그레이션 확인**이다. v1 은 reader 가 없어 정리 대상이므로,
//    사라진 뒤에도 이 스크립트가 실패하면 안 된다 — 없으면 '정리 완료'로 읽고 건너뛴다.
//    (그래서 이 스크립트는 야간 감사의 상시 불변식에 넣지 않았다 — 상시 참인 명제가 아니다)
const hasV1 = regions.some(r => byKey[`oecd-cli-${r}-v1`])
console.log(hasV1
  ? '① v1(옛 수집) vs v2(새 SSOT) — 판정 입력이 한 톨도 안 바뀌었는가\n'
  : '① v1 캐시가 정리됨 — 대조는 2026-08-28 에 완료(docs/history 기록). v2 무결성만 확인한다\n')
for (const r of regions) {
  const a = byKey[`oecd-cli-${r}-v1`], b = byKey[`oecd-cli-${r}-v2`]
  if (!b) { ok(`${r.toUpperCase()} v2 존재`, false, '아직 수집 전이거나 수집 실패'); continue }
  if (a) {
    ok(`${r.toUpperCase()} cli·cliPrev 완전 일치`,
      a.cli === b.cli && a.cliPrev === b.cliPrev,
      `v1 ${a.cli}/${a.cliPrev} · v2 ${b.cli}/${b.cliPrev}`)
  }
  ok(`${r.toUpperCase()} 새 필드가 실제로 기록됨`,
    typeof b.cliNextPrev === 'number' && typeof b.month === 'string', `cliNextPrev=${b.cliNextPrev} month=${b.month}`)
}

console.log('\n② CLI 원천을 쓰는 화면들이 살아 있는가(로그인 불필요한 것만)\n')
const BASE = 'https://investment-school-2026.vercel.app'
for (const [p, pick] of [
  ['/api/season-sector', j => `US ${j?.us?.quad} / KR ${j?.kr?.quad ?? '—'}`],
  ['/api/dalio-cycle', j => `debtGdp ${j?.debt?.debtGdp}`],
  ['/api/macro-regime', j => `cpi ${j?.cpiYoY} · ${j?.rateDir}`],
]) {
  try {
    const r = await fetch(BASE + p, { cache: 'no-store' })
    const j = await r.json()
    ok(`${p} 정상 응답`, r.status === 200 && !j.error, `${r.status} · ${pick(j)}`)
  } catch (e) { ok(`${p} 정상 응답`, false, e.message) }
}

console.log(`\n${fail === 0 ? '✅ 회귀 없음' : `❌ 실패 ${fail}건`}`)
process.exitCode = fail === 0 ? 0 : 1
