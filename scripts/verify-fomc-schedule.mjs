// 🔒 FOMC 일정표 불변식 — 앞으로 남은 회의가 2개 미만이면 빨강(표가 비면 금리 방향이 '동결'로 거짓 표시된다 · 2026-10-18 6차 점검)
//   + 날짜 오름차순·중복 없음·label 의 월/연도가 date 와 일치 · verify-home-brief 의 복제본이 같은 날짜 집합
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(`${ROOT}/src/lib/fomcSchedule.ts`, 'utf8')
const rows = Array.from(src.matchAll(/\{\s*label:\s*"([^"]+)",\s*month:\s*(\d+),\s*year:\s*(\d{4}),\s*date:\s*'(\d{4}-\d{2}-\d{2})'\s*\}/g))
  .map(m => ({ label: m[1], month: Number(m[2]), year: Number(m[3]), date: m[4] }))

let fails = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++ }

const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const future = rows.filter(r => r.date > todayKst)
check('일정표를 읽었다', rows.length >= 6, `${rows.length}건`)
check('앞으로 남은 회의 2개 이상(비면 금리 방향이 거짓 동결)', future.length >= 2, `오늘 ${todayKst} 기준 ${future.length}건 · 마지막 ${rows.at(-1)?.date ?? '-'}`)
check('날짜 오름차순·중복 없음', rows.every((r, i) => i === 0 || r.date > rows[i - 1].date))
check('label 월·연도 = date', rows.every(r => Number(r.date.slice(5, 7)) === r.month && Number(r.date.slice(0, 4)) === r.year))

const brief = readFileSync(`${ROOT}/scripts/verify-home-brief.mjs`, 'utf8')
const copy = Array.from(brief.matchAll(/'(\d{4}-\d{2}-\d{2})'/g)).map(m => m[1]).filter(d => rows.some(r => r.date === d) || d.startsWith('2026') || d.startsWith('2027'))
const copyLine = brief.match(/const FOMC = \[([^\]]+)\]/)?.[1] ?? ''
const copyDates = Array.from(copyLine.matchAll(/'(\d{4}-\d{2}-\d{2})'/g)).map(m => m[1])
check('verify-home-brief 복제본 = 일정표 날짜 집합', copyDates.length === rows.length && copyDates.every(d => rows.some(r => r.date === d)), `복제본 ${copyDates.length} · 원본 ${rows.length}`)
void copy

if (fails) { console.log(`\n❌ ${fails}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (FOMC 일정표)')
