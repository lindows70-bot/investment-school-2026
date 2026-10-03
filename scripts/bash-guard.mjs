#!/usr/bin/env node
// 🚧 PreToolUse 훅 — CLAUDE.md 에 '금지'로 적혀 있는데 강제 장치가 없던 셸 명령 3종을 실행 전에 막는다.
//
// 왜 필요했나(2026-10-03)
//  CLAUDE.md 빌드·배포 섹션의 세 규칙은 문서뿐이었다 — "CLAUDE.md 의 지시는 부탁이지 보장이 아니다. 훅은 강제다."
//   ① `git add -A` 금지 — 병렬 세션 산출물까지 쓸어담는다. 파일을 명시할 것.
//   ② 로컬 `npm run build` 절대 금지 — dev 서버의 .next 를 덮어써 흰 화면. `npm run check:build` 를 쓴다.
//   ③ 검증 명령에 파이프 금지 — `... | tail` 은 exit code 를 가려 실패한 빌드가 커밋·배포까지 흘러간다.
//
// 설계
//  · Bash·PowerShell 도구 공통. 차단은 exit 2 + stderr(그 내용이 클로드에게 되돌아간다).
//  · 명령을 `&& || ; 줄바꿈` 으로 쪼갠 '구간'마다, 구간 맨 앞 명령만 본다 — 커밋 메시지 안의 문자열은 안 걸린다.
//  · 한계(정직하게): 따옴표 안의 `&&` 까지 쪼갠다. 오탐이 나면 이 파일의 규칙을 고친다(우회 습관을 만들지 않는다).
//  · 검증: `node scripts/bash-guard.mjs --self-test` (차단·통과 사례 전수)
import { readFileSync } from 'fs'

// 구간 분리: ||, &&, ;, 줄바꿈 (|| 를 먼저 — 파이프 | 와 섞이지 않게)
const segmentsOf = (cmd) => cmd.split(/\|\||&&|;|\r?\n/).map((s) => s.trim()).filter(Boolean)
// 파이프 분리: 단일 | 만 (||·|& 의 | 도 파이프로 본다 — |& 는 stderr 까지 파이프)
const stagesOf = (seg) => seg.split(/(?<!\|)\|(?!\|)/).map((s) => s.trim()).filter(Boolean)
// 구간 앞의 환경변수 대입(FOO=1 BAR=2 cmd)과 cd 경로 붙은 git -C 는 벗기고 본다
const stripEnv = (s) => s.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '')

function checkGitAdd(seg) {
  const m = stripEnv(seg).match(/^git\s+(?:-C\s+\S+\s+)?add\b(.*)$/)
  if (!m) return null
  const args = m[1].trim().split(/\s+/).filter(Boolean)
  const sweeping = args.some(
    (a) => a === '-A' || a === '--all' || a === '.' || /^-[a-zA-Z]*A[a-zA-Z]*$/.test(a),
  )
  if (!sweeping) return null
  return (
    '⛔ `git add -A`(·`--all`·`.`) 금지 — 병렬 세션 산출물까지 쓸어담는다(CLAUDE.md 빌드·배포).\n' +
    '   → 바꾼 파일을 이름으로 적어라: `git add scripts/a.mjs src/b.ts`'
  )
}

function checkLocalBuild(seg) {
  const s = stripEnv(seg)
  if (/^npm\s+run\s+build(?:\s|$)/.test(s)) {
    return (
      '⛔ 로컬 `npm run build` 절대 금지 — dev 서버의 .next 를 덮어써 흰 화면(CLAUDE.md 빌드·배포).\n' +
      '   → `npm run check:build` (.next-build 로 분리 빌드 · lint 캐시까지 지운다)'
    )
  }
  // next build 직접 호출은 분리 폴더(NEXT_DIST_DIR)를 지정했을 때만 허용 — check-build.js 와 같은 방식
  if (/^(?:npx\s+)?next\s+build(?:\s|$)/.test(s) && !/\bNEXT_DIST_DIR=/.test(seg)) {
    return (
      '⛔ `next build` 를 분리 폴더 없이 돌리면 dev 의 .next 를 덮어쓴다(CLAUDE.md 빌드·배포).\n' +
      '   → `npm run check:build`'
    )
  }
  return null
}

const VERIFY =
  /^(?:npm\s+run\s+(?:check(?::build)?|lint|test)\b|npm\s+test\b|(?:npx\s+)?tsc\b|node\s+\S*scripts[\\/](?:verify-|check-build))/

function checkPipe(seg, whole) {
  const stages = stagesOf(seg)
  if (stages.length < 2) return null
  if (!VERIFY.test(stripEnv(stages[0]))) return null
  if (/pipefail/.test(whole)) return null // set -o pipefail 이면 종료 코드가 살아남는다
  return (
    '⛔ 검증 명령에 파이프 금지 — `| tail` 등은 exit code 를 가려 실패한 빌드가 커밋·배포까지 흘러간다(CLAUDE.md 빌드·배포).\n' +
    '   → 파이프 없이 돌리거나 `&&` 로 이어라. 출력이 길면 파일로: `npm run check > .tmp-check.log 2>&1`'
  )
}

export function judge(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return null
  for (const seg of segmentsOf(cmd)) {
    const hit = checkGitAdd(seg) || checkLocalBuild(seg) || checkPipe(seg, cmd)
    if (hit) return hit
  }
  return null
}

/* ── 자기검증 ─────────────────────────────────────────────────────────────── */
if (process.argv.includes('--self-test')) {
  const BLOCK = [
    'git add -A',
    'git add --all',
    'git add .',
    'git add -Av',
    'cd sub && git add -A && git commit -m x',
    'git -C /repo add -A',
    'npm run build',
    'NODE_ENV=production npm run build',
    'cd app; npm run build',
    'npx next build',
    'npm run check 2>&1 | tail -20',
    'npm run check:build | tail',
    'npm run lint | grep error',
    'npx tsc --noEmit | head',
    'node scripts/verify-cpi-consistency.mjs | tail -3',
    'npm run check | Select-Object -Last 5',
    'npm run check:build |& tee build.log',
  ]
  const PASS = [
    'git add scripts/bash-guard.mjs .claude/settings.json',
    'git add -p src/a.ts',
    'git status --short',
    'git commit -m "npm run build 금지 훅 · git add -A 차단"',
    'npm run check:build',
    'npm run check && npm run check:build',
    'npm run check || echo failed',
    'NEXT_DIST_DIR=.next-build npx next build',
    'set -o pipefail && npm run check | tail -5',
    'npm run dev',
    'git log --oneline | head -5',
    'grep -rn foo src | head',
    'npm run build:icons',
    'echo "git add -A 는 금지"',
    '',
  ]
  let fail = 0
  for (const c of BLOCK) if (!judge(c)) { fail++; console.log(`❌ 막아야 하는데 통과: ${c}`) }
  for (const c of PASS) { const r = judge(c); if (r) { fail++; console.log(`❌ 통과해야 하는데 차단: ${c}\n   ${r.split('\n')[0]}`) } }
  console.log(`차단 ${BLOCK.length}건 · 통과 ${PASS.length}건 검사`)
  if (fail) { console.log(`❌ ${fail}건 실패`); process.exitCode = 1 }
  else console.log('🔒 bash-guard 자기검증 전부 통과')
  process.exit()
}

/* ── 훅 본체 ──────────────────────────────────────────────────────────────── */
let input = ''
try { input = readFileSync(0, 'utf8') } catch { /* stdin 없음 */ }
let cmd = ''
try { cmd = JSON.parse(input)?.tool_input?.command ?? '' } catch { /* 형식이 다르면 통과 — 훅 고장으로 작업을 막지 않는다 */ }
const reason = judge(cmd)
if (reason) {
  process.stderr.write(reason + '\n')
  process.exit(2)
}
