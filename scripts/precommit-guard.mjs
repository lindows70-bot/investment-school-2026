#!/usr/bin/env node
// 🛡️ 커밋 전 기계적 검사 — CLAUDE.md 원칙 중 '사람이 매번 기억해야 했던' 것들을 자동으로 잡는다.
//
// 왜 필요했나(실측 근거)
//  ① 제1-b(디자인 값 하드코딩 금지)를 문서에만 두니 색상 하드코딩이 645 → 885곳으로 늘었다.
//  ② 캐시 키를 writer만 올리고 reader를 빼먹어 신호가 조용히 죽은 적이 있다(sector-rotation v9→v11).
//
// 설계 원칙
//  · **staged diff의 추가 라인만** 검사한다 — 기존 하드코딩까지 훑으면 매 커밋이 경고 스팸이 된다.
//  · 기본은 **경고(통과)**, 심각한 것만 차단. 스타일 검사가 커밋을 막아 우회(--no-verify)를 습관화시키면
//    아예 없는 것보다 나쁘다. 차단은 '조용히 깨지는' 캐시 키 불일치 하나만.
//  · 우회: git commit --no-verify
import { execSync } from 'child_process'

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) } catch { return '' } }
const C = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

// 추가된 라인만(+로 시작, +++ 제외) · src/ 대상만
const diff = sh('git diff --cached -U0 -- src/')
const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1))
const stagedFiles = sh('git diff --cached --name-only -- src/').trim().split('\n').filter(Boolean)
if (added.length === 0) process.exit(0)

let blocked = false
const warn = (t) => console.log(`${C.y}⚠️  ${t}${C.x}`)

// ── ① 제1-b: 색상 하드코딩(theme.ts 자신은 예외 — 토큰 정의처) ─────────────
if (!stagedFiles.every(f => f.endsWith('src/lib/theme.ts'))) {
  const hex = added.filter(l => /#[0-9a-fA-F]{6}\b/.test(l) && !/theme\.ts/.test(l))
  const inTheme = stagedFiles.length === 1 && stagedFiles[0].endsWith('src/lib/theme.ts')
  if (hex.length && !inTheme) {
    warn(`색상 하드코딩 ${hex.length}줄 추가됨 (제1-b: TK 토큰 사용)`)
    hex.slice(0, 3).forEach(l => console.log(`${C.d}      ${l.trim().slice(0, 100)}${C.x}`))
    console.log(`${C.d}      → src/lib/theme.ts 의 TK 에서 가져오세요. 필요한 색이 없으면 먼저 물어보세요.${C.x}`)
  }
}

// ── ② 제1-b: 글자 크기 리터럴(FS 스케일 사용) ──────────────────────────────
const fs = added.filter(l => /fontSize:\s*[0-9]/.test(l))
if (fs.length) {
  warn(`fontSize 리터럴 ${fs.length}줄 추가됨 (제1-b: FS 스케일 사용)`)
  fs.slice(0, 3).forEach(l => console.log(`${C.d}      ${l.trim().slice(0, 100)}${C.x}`))
  console.log(`${C.d}      → FS.micro/tiny/body/lg/xl/h2/h1. 0.5px 단위 새 값은 위계를 만들지 못하고 파편화만 남깁니다.${C.x}`)
}

// ── ③ 캐시 키 버전업 시 옛 키를 참조하는 reader 잔존 → 차단 ────────────────
//    writer만 올리면 reader가 옛 키를 읽어 조용히 죽는다(실제 발생). 이건 경고로는 부족하다.
const newKeys = new Set()
for (const l of added) for (const m of l.matchAll(/['"`]([a-z][a-z0-9-]*?)-v(\d+)[:'"`]/g)) newKeys.add(`${m[1]}|${m[2]}`)
const stale = []
for (const k of newKeys) {
  const [name, ver] = k.split('|')
  const n = Number(ver)
  if (n <= 1) continue
  // ⚠️ 직전 버전(n-1) 하나만 보면 **건너뛴 버전업을 놓친다**.
  //    v9 → v11 로 올리면 v10 을 찾다가 못 찾고 통과시켜, 정작 이 훅을 만든 근거인
  //    v9 reader 잔존 사고를 그대로 흘려보낸다(Codex 리뷰가 잡아낸 실제 결함).
  //    → n 미만 **모든** 옛 버전을 찾는다.
  const raw = sh(`git grep -n --cached -E "${name}-v[0-9]+" -- src/`).trim()
  if (!raw) continue
  const olds = new Set()
  const hits = raw.split('\n').filter(line => {
    let found = false
    for (const m of line.matchAll(new RegExp(`${name}-v(\\d+)`, 'g'))) {
      if (Number(m[1]) < n) { olds.add(Number(m[1])); found = true }
    }
    return found
  })
  if (hits.length) stale.push({ name, olds: [...olds].sort((a, b) => a - b), to: n, hits })
}
if (stale.length) {
  blocked = true
  console.log(`${C.r}${C.b}⛔ 캐시 키 버전업 누락 — reader가 옛 키를 참조 중입니다${C.x}`)
  for (const s of stale) {
    const list = s.olds.map(v => `v${v}`).join('·')
    console.log(`${C.r}   ${s.name}: v${s.to} 로 올렸는데 옛 버전(${list}) 참조가 남아 있습니다${C.x}`)
    s.hits.slice(0, 6).forEach(h => console.log(`${C.d}      ${h.slice(0, 120)}${C.x}`))
  }
  console.log(`${C.d}   → writer만 올리면 reader는 옛 키를 읽어 신호가 조용히 죽습니다(sector-rotation v9→v11 사건).${C.x}`)
  console.log(`${C.d}     grep -rnE "${stale[0].name}-v[0-9]+" src/ 로 전수 확인 후 함께 올리세요.${C.x}`)
}

if (blocked) {
  console.log(`\n${C.d}우회가 필요하면: git commit --no-verify${C.x}`)
  process.exit(1)
}
process.exit(0)
