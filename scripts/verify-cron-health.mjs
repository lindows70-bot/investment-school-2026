// 🔒 크론 상태판에 stale 이 없는가 — 상태판이 잡은 것을 야간 감사 보고서로 올린다
//
// 2026-11-14: 상태판의 btcEtf 모니터가 "flowAsOf 11/05 · 10일 전"을 stale 로 잡고 있었는데, 상태판은 누가 열어야 보이는 화면이라
// 열흘 동안 아무도 몰랐다(원천 TheBlock 이 주소를 또 바꿨다). 감시가 잡아도 알림이 없으면 감시가 아니다 — 매일 보는 보고서에 싣는다.
//   · Vercel 크론 모니터가 stale 이면 빨강(서버가 스스로 못 고친 것)
//   · 로컬 러너(이 PC 의 작업 스케줄러 — heal 이 없는 것)가 stale 이면 ⚠️ 만 — PC 가 꺼져 있던 날마다 빨강이면 진짜 실패가 묻힌다
//   · pending(예정 시각 직후 유예) 은 판정하지 않는다
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROD_HEADERS, PROD_AUTH_OK } from './prodAuth.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'https://investment-school-2026.vercel.app'
let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { console.log(`❌ ${label}${why ? ` — ${why}` : ''}`); fail++ } }

// 로컬 러너 = 상태판 표에서 cron 이 null 인 모니터(vercel.json 에 없는 것 — 이 PC 의 작업 스케줄러). heal: null 은 '서버가 스스로 못 고치는 Vercel 크론'도 포함하므로 기준이 아니다(nps·13F 등 4개가 섞였다)
const src = readFileSync(`${ROOT}/src/lib/cronHealth.ts`, 'utf8')
const LOCAL = new Set(Array.from(src.matchAll(/\{\s*id:\s*'(\w+)'[^\n]*cron:\s*null/g)).map(m => m[1]))

check('프로덕션 호출용 비밀값이 있다(.env.local CRON_SECRET)', PROD_AUTH_OK)
let j = null
try {
  const r = await fetch(`${APP}/api/cron-health`, { headers: { ...PROD_HEADERS, 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(170000), cache: 'no-store' })
  if (r.ok && /json/.test(r.headers.get('content-type') ?? '')) j = await r.json()
  else console.log(`   HTTP ${r.status}`)
} catch (e) { console.log(`   ${e?.message ?? e}`) }
check('상태판 응답을 받았다', !!j && Array.isArray(j.checks) && j.checks.length > 20)

if (j) {
  check('자기 호출 주소가 로그인 보호에 걸리지 않는다(selfBase.protected = false)', j.selfBase?.protected === false, JSON.stringify(j.selfBase))
  const stale = j.checks.filter(c => c.status === 'stale')
  const server = stale.filter(c => !LOCAL.has(c.id)), local = stale.filter(c => LOCAL.has(c.id))
  const line = c => `${c.id}(${c.label}${c.note ? ` · ${c.note}` : ''} · 마지막 ${c.lastRun ?? '없음'})`
  if (local.length) console.log(`⚠️ 로컬 러너 stale ${local.length}개 — 이 PC 가 꺼져 있었을 수 있다: ${local.map(line).join(' · ')}`)
  check(`Vercel 크론 모니터 stale 0개(전체 ${j.checks.length}개 · 로컬 러너 ${LOCAL.size}개 제외)`, server.length === 0, server.map(line).join(' · '))
  const hf = Array.isArray(j.healFailed) ? j.healFailed : []
  check('자동 복구 실패 0건', hf.length === 0, hf.join(', '))
}

console.log('')
if (fail) { console.log(`❌ ${fail}건 실패 (크론 상태판)`); process.exitCode = 1 }   // process.exit 은 윈도우에서 닫히는 중인 소켓과 부딪혀 충돌 코드를 남긴다(실측 0xC0000409)
else console.log('✅ 전부 통과 (크론 상태판)')
