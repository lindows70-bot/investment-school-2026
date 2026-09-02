#!/usr/bin/env node
// 🛑 Stop 훅 — 클로드가 "다 됐습니다"로 턴을 끝내려는 순간 검사한다. 실패하면 턴이 끝나지 않는다.
//
// 왜 필요했나(2026-09-02 실측 근거 — 이 세션에서 내가 직접 뚫은 두 구멍)
//  ① 캐시 키 범프 누락: CLAUDE.md 에 "응답 내용만 바뀌어도 키를 올려라" 가 명시돼 있는데 건너뛰었다.
//     배포 후 프로덕션이 옛 문구('41.6배')를 서빙해서야 발견했다. **커밋 훅은 이걸 못 잡는다**
//     — 스키마가 그대로라 diff 만 봐서는 알 수 없고, '내용이 바뀌었나'는 사람이 판단해야 했다.
//  ② 타입 오류를 남긴 채 턴을 끝낼 뻔함. 배포 직전 check:build 가 마지막 방어선이었다.
//  → "CLAUDE.md 의 지시는 부탁이지 보장이 아니다. 훅은 강제다"(Anthropic 공식 문서 · 하네스 영상 08:15).
//     매번 지켜져야 하는 규칙은 문서가 아니라 장치로 옮긴다.
//
// 설계
//  · **코드를 안 건드린 턴은 즉시 통과**(스탬프 mtime 비교) — 대화만 한 턴에 13초를 쓰지 않는다.
//  · stop_hook_active 면 무조건 통과 — 무한 루프 방지(공식 권장).
//  · 차단은 exit 2 + stderr(그 내용이 클로드에게 되돌아간다).
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'src')
const STAMP = join(ROOT, '.claude', '.stop-guard-stamp')
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const tryS = (c) => { try { return sh(c) } catch { return '' } }

/* ── 0. 훅 입력 — 루프 방지 ───────────────────────────────────────────────── */
//  ⚠️ `stop_hook_active` 면 전부 통과시키면 **타입 오류도 재시도 한 번으로 뚫린다**(설계 검증에서 발견).
//     그래서 둘을 갈랐다:
//       · 타입 오류(객관·항상 고칠 수 있음) → 재시도해도 계속 막는다. 단 연속 MAX_BLOCK 회면 풀어준다
//         (tsc 가 우리 변경과 무관한 이유로 깨진 경우까지 교착시키지 않기 위한 안전판).
//       · 캐시 키(휴리스틱·오탐 가능) → 한 번만 알리고 재시도는 통과. "올릴 필요 없다"는 판단을 존중한다.
const COUNT = join(ROOT, '.claude', '.stop-guard-count')
const MAX_BLOCK = 3
let input = ''
try { input = readFileSync(0, 'utf8') } catch { /* stdin 없음 — 수동 실행 */ }
let retry = false
try { retry = !!(input && JSON.parse(input).stop_hook_active) } catch { /* 파싱 실패는 무시 */ }
const blockCount = existsSync(COUNT) ? Number(readFileSync(COUNT, 'utf8')) || 0 : 0
if (retry && blockCount >= MAX_BLOCK) {
  console.error(`⚠️ Stop 훅이 ${MAX_BLOCK}회 연속 막았습니다 — 교착 방지를 위해 통과시킵니다.\n` +
                `   타입 오류가 남아 있다면 배포 전 npm run check:build 로 반드시 확인하세요.`)
  try { writeFileSync(COUNT, '0') } catch { /* 무시 */ }
  process.exit(0)
}

/* ── 1. src/ 를 건드렸나 — 안 건드렸으면 즉시 통과 ────────────────────────── */
const newestMtime = (dir) => {
  let m = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs)
  }
  return m
}
const stamp = existsSync(STAMP) ? Number(readFileSync(STAMP, 'utf8')) || 0 : 0
let newest = 0
try { newest = newestMtime(SRC) } catch { process.exit(0) }
if (newest <= stamp) process.exit(0)          // 코드 변경 없음 → 검사 생략

const problems = []

/* ── 2. 타입 검사 ─────────────────────────────────────────────────────────── */
try {
  sh('npx tsc --noEmit')
} catch (e) {
  const out = String(e.stdout ?? e.stderr ?? e).trim().split('\n').filter(Boolean).slice(0, 12)
  problems.push(`🔴 타입 오류 ${out.length}건 — 고치고 끝내세요.\n${out.map(l => '   ' + l).join('\n')}`)
}

/* ── 3. 캐시 키 범프 누락 ─────────────────────────────────────────────────── */
//  캐시를 쓰는 라우트/lib 의 **주석 아닌 라인**이 바뀌었는데 캐시 키 리터럴이 HEAD 와 같으면 알린다.
//  (스키마가 같아 커밋 훅이 못 잡는 자리 — 실제로 crisis-radar v7 에서 뚫렸다)
const KEY_RE = /['"`][a-z][a-z0-9-]*(?::[a-z0-9-]+)*[-:]v\d+/gi
const isComment = (l) => { const t = l.trim(); return t === '' || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') }

//  재시도(stop_hook_active)일 땐 건너뛴다 — 휴리스틱이라 "올릴 필요 없다"는 판단을 존중한다.
const changed = retry ? [] : tryS('git diff --name-only HEAD -- src/').trim().split('\n').filter(Boolean)
for (const f of changed) {
  const abs = join(ROOT, f)
  if (!existsSync(abs)) continue
  const cur = readFileSync(abs, 'utf8')
  const keysCur = cur.match(KEY_RE)
  if (!keysCur) continue                                   // 캐시 키가 없는 파일은 대상 아님
  const old = tryS(`git show HEAD:${f}`)
  if (!old) continue                                       // 신규 파일 — 범프 개념 없음
  const keysOld = old.match(KEY_RE) ?? []
  if (JSON.stringify(keysCur) !== JSON.stringify(keysOld)) continue   // 이미 올렸다

  // 주석 아닌 변경이 실제로 있는지
  const diff = tryS(`git diff -U0 HEAD -- "${f}"`)
  const meaningful = diff.split('\n')
    .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .map(l => l.slice(1))
    .filter(l => !isComment(l))
  if (meaningful.length) {
    problems.push(
      `🟡 캐시 키 범프 누락 의심 — ${f}\n` +
      `   키 ${keysCur.slice(0, 3).join(', ')} 가 그대로인데 실질 라인 ${meaningful.length}줄이 바뀌었습니다.\n` +
      `   응답 '내용'만 바뀌어도 키를 올려야 합니다(스키마가 같으면 커밋 훅이 못 잡습니다).\n` +
      `   올릴 필요가 없는 변경이라면 그렇다고 답하고 끝내면 됩니다 — 다음 시도는 통과합니다.`)
  }
}

/* ── 4. 판정 ──────────────────────────────────────────────────────────────── */
if (problems.length) {
  try { writeFileSync(COUNT, String(blockCount + 1)) } catch { /* 무시 */ }
  console.error(`⛔ 턴을 끝내기 전에 확인이 필요합니다 (Stop 훅 · ${blockCount + 1}/${MAX_BLOCK})\n\n${problems.join('\n\n')}`)
  process.exit(2)     // 2 = 차단 + stderr 를 클로드에게 되돌림
}
try { writeFileSync(COUNT, '0') } catch { /* 무시 */ }
writeFileSync(STAMP, String(Date.now()))
process.exit(0)
