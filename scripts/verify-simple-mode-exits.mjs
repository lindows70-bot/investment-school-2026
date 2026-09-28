// 간편 화면(/s) 출구 검증 — 학생 화면·컴포넌트의 모든 href 를 모아 /s 밖으로 나가는 링크를 센다(5단계 원칙: 간편에서 누른 건 간편 안에서 끝난다)
//   허용 = ①상단 '분석 화면' 전환 버튼 2곳(영구) ②아직 가벼운 화면을 못 만든 출구(임시 — 단계가 끝날 때마다 뺀다). 그 밖에 하나라도 있으면 빨강.
//   외부 기사(https://…, 새 창)·/login·/s 안은 출구가 아니다. 템플릿 리터럴은 `${` 앞까지만 본다(경로 접두어로 판정).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN = ['src/app/s', 'src/app/components/student']

/** 영구 허용 — 분석 화면으로 가는 유일한 문(사용자 결정 2026-09-27: 문은 하나, 막지는 않는다) */
const PERMANENT = [
  { file: 'src/app/components/student/home/Greeting.tsx', href: '/dashboard', why: '홈 인사말의 분석 화면 전환 버튼' },
  { file: 'src/app/components/student/StudentShell.tsx', href: '/dashboard', why: 'PC 왼쪽 메뉴의 분석 화면 전환 버튼' },
]
/** 임시 허용 — phase5-plan 의 단계가 끝나면 그 줄을 지운다(지우면 이 검사가 그 출구를 잡는다) */
const TEMPORARY = [
  { file: 'src/app/s/stock/[ticker]/page.tsx', href: '/research?q=', until: '4단계 종목 상세 더 알아보기' },
  { file: 'src/app/s/learn/page.tsx', href: '/investment-academy', until: '5단계 수업 자료 껍데기' },
  { file: 'src/app/s/learn/page.tsx', href: '/master-strategy', until: '5단계 수업 자료 껍데기' },
  { file: 'src/app/s/learn/page.tsx', href: '/weekly-report', until: "5단계 내 자산 '이번 주'" },
  { file: 'src/app/s/learn/page.tsx', href: '/school-lounge', until: '5단계 /s/lounge' },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const norm = p => p.split('\\').join('/')

// href="..." · href={'...'} · href={`...`} · { href: '...' } — 템플릿은 `${` 앞까지
const HREF_RE = /href(?:=\{?|:\s*)\s*(["'`])((?:(?!\1).)*?)\1/g
const exits = []
for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = norm(relative(ROOT, file))
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(HREF_RE)) {
      const raw = m[2]
      const href = raw.includes('${') ? raw.slice(0, raw.indexOf('${')) : raw
      if (!href || href.startsWith('#')) continue
      if (/^https?:\/\//.test(href)) continue                     // 외부 기사 — 새 창
      if (href === '/s' || href.startsWith('/s/') || href.startsWith('/s?')) continue
      if (href.startsWith('/login')) continue
      exits.push({ file: rel, href, line: src.slice(0, m.index).split('\n').length })
    }
  }
}

let fail = 0
const check = (label, ok, detail = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) fail++ }

const key = e => `${e.file}|${e.href}`
const perm = new Map(PERMANENT.map(a => [key(a), a]))
const temp = new Map(TEMPORARY.map(a => [key(a), a]))
const unlisted = [], usedTemp = new Set(), usedPerm = new Set()
for (const e of exits) {
  const k = key(e)
  if (perm.has(k)) { usedPerm.add(k); continue }
  if (temp.has(k)) { usedTemp.add(k); continue }
  unlisted.push(e)
}
console.log(`── 간편 화면 출구: ${exits.length}건(영구 ${usedPerm.size} · 임시 ${usedTemp.size} · 미허용 ${unlisted.length}) ──`)
for (const k of usedTemp) { const a = temp.get(k); console.log(`   ⏳ ${a.file} → ${a.href} (${a.until}까지)`) }
check('분석 화면으로 가는 문 = 전환 버튼 2곳이 실제로 있다', usedPerm.size === PERMANENT.length, [...perm.keys()].filter(k => !usedPerm.has(k)).join(', ') || '')
check('허용 목록 밖 출구 0건', unlisted.length === 0, unlisted.map(e => `${e.file}:${e.line} → ${e.href}`).join(' · '))
const staleTemp = TEMPORARY.filter(a => !usedTemp.has(key(a)))
check('임시 허용 목록에 이미 사라진 출구가 남아 있지 않다(단계가 끝났으면 줄을 지운다)', staleTemp.length === 0, staleTemp.map(a => `${a.file} → ${a.href}`).join(' · '))

console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 전부 통과 (간편 화면 출구)')
process.exitCode = fail ? 1 : 0
