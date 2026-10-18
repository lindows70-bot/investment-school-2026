// 🔒 크론 ↔ 상태판 정합 불변식(2026-10-19) — vercel.json 의 크론마다 cronHealth 모니터가 있고(경로), 모니터의 kst·days 가 스케줄과 맞는지.
//   etf-snap 요일('daily' vs `2-6`)·etf-flow 누락이 "감시 목록에 없는 것은 죽어도 모른다" 공백에서 나왔다 — 두 표를 사람이 대조하지 않는다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const crons = JSON.parse(readFileSync(`${ROOT}/vercel.json`, 'utf8')).crons ?? []
const src = readFileSync(`${ROOT}/src/lib/cronHealth.ts`, 'utf8')

let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++ }

// 모니터 표 파싱(한 줄에 한 모니터)
const monitors = Array.from(src.matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'[^']*',\s*kst:\s*'(\d{2}):(\d{2})',\s*days:\s*'([^']+)'[^\n]*?heal:\s*(null|'([^']*)')(?:[^\n]*?cron:\s*(null|'([^']*)'))?/g))
  .map(m => ({ id: m[1], hh: Number(m[2]), mm: Number(m[3]), days: m[4], heal: m[6] ?? null, cron: m[7] === undefined ? undefined : (m[8] ?? null) }))
check('모니터 표를 읽었다', monitors.length >= 25, `${monitors.length}개`)

const stripQ = p => p.split('?')[0]
const monitorPath = m => (m.cron !== undefined ? m.cron : (m.heal ? stripQ(m.heal) : null))

// 스케줄 → KST 시각·요일 집합
function kstOf(schedule) {
  const [mm, hh, , , dow] = schedule.trim().split(/\s+/)
  const h = Number(hh), m = Number(mm)
  const kh = (h + 9) % 24, shift = h + 9 >= 24 ? 1 : 0
  let days
  if (dow === '*') days = new Set([0, 1, 2, 3, 4, 5, 6])
  else {
    days = new Set()
    for (const part of dow.split(',')) {
      const r = part.split('-').map(Number)
      if (r.length === 2) for (let d = r[0]; d <= r[1]; d++) days.add((d + shift) % 7)
      else days.add((r[0] + shift) % 7)
    }
  }
  return { kst: `${String(kh).padStart(2, '0')}:${String(m).padStart(2, '0')}`, days }
}
const DAYS_OF = { daily: new Set([0, 1, 2, 3, 4, 5, 6]), weekday: new Set([1, 2, 3, 4, 5]), tue: new Set([2]), mon: new Set([1]), 'tue-sat': new Set([2, 3, 4, 5, 6]) }
const sameSet = (a, b) => a.size === b.size && Array.from(a).every(x => b.has(x))

// ① 크론마다 모니터
const byPath = new Map()
for (const c of crons) { const p = stripQ(c.path); if (!byPath.has(p)) byPath.set(p, []); byPath.get(p).push(c) }
for (const [p, list] of byPath) {
  if (p === '/api/cron-health') continue   // 상태판 자신
  const ms = monitors.filter(m => monitorPath(m) === p)
  check(`크론 ${p} 에 모니터가 있다`, ms.length >= 1, ms.length ? '' : `vercel.json 스케줄 ${list.map(c => c.schedule).join(' · ')}`)
  if (!ms.length) continue
  // ② 요일·시각 — 같은 경로의 슬롯(insider-scan ×3) 중 하나라도 모니터와 맞으면 통과
  for (const m of ms) {
    const want = DAYS_OF[m.days]
    const hit = list.map(c => kstOf(c.schedule)).find(k => k.kst === `${String(m.hh).padStart(2, '0')}:${String(m.mm).padStart(2, '0')}` && sameSet(k.days, want))
    check(`모니터 ${m.id} 의 kst·days 가 스케줄과 같다`, !!hit, hit ? '' : `모니터 ${String(m.hh).padStart(2, '0')}:${String(m.mm).padStart(2, '0')}/${m.days} vs 스케줄 ${list.map(c => `${c.schedule} → ${kstOf(c.schedule).kst}/${Array.from(kstOf(c.schedule).days).join('')}`).join(' · ')}`)
  }
}
// ③ 모니터마다 크론(로컬 러너는 cron: null 로 선언)
for (const m of monitors) {
  const p = monitorPath(m)
  if (p === null) { check(`모니터 ${m.id} 는 로컬 러너(cron: null 선언)`, m.cron === null); continue }
  check(`모니터 ${m.id} 의 경로 ${p} 가 vercel.json 에 있다`, byPath.has(p))
}

if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (크론 ↔ 상태판 정합)')
