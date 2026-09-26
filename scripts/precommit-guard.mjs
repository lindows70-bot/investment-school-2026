#!/usr/bin/env node
// 🛡️ 커밋 전 기계적 검사 — CLAUDE.md 원칙 중 '사람이 매번 기억해야 했던' 것들을 자동으로 잡는다.
//
// 왜 필요했나(실측 근거)
//  ① 제1-b(디자인 값 하드코딩 금지)를 문서에만 두니 색상 하드코딩이 645 → 885곳으로 늘었다.
//  ② 캐시 키를 writer만 올리고 reader를 빼먹어 신호가 조용히 죽은 적이 있다(sector-rotation v9→v11).
//
// 설계 원칙
//  · **staged diff의 추가 라인만** 검사한다 — 기존 하드코딩까지 훑으면 매 커밋이 경고 스팸이 된다.
//  · **기존 파일 수정은 경고(통과)** — 스타일 검사가 레거시 수정을 막으면 우회(--no-verify)가 습관이 되어
//    아예 없는 것보다 나쁘다. 이 판단은 유지한다.
//  · **신규 파일은 차단** (2026-09-02 추가). 경고만으로는 안 지켜진다는 게 실측으로 드러났다 —
//    문서에 제1-b 를 적어둔 뒤로도 색상 하드코딩 645 → 885 → **946**, fontSize 리터럴 4,211 → **4,786**
//    (39종)으로 계속 늘었고 FS 토큰은 663곳(14%)뿐이다. 새로 태어나는 파일만이라도 원천 차단한다.
//    (근거: "규칙 문서는 에이전트가 실수로 안 따른다 — 구조로 강제해야 한다" · /design 스킬 검토 2026-09-02)
//  · 차단 대상은 셋 — 신규 파일의 디자인 값 하드코딩 · '조용히 깨지는' 캐시 키 불일치 ·
//    정리 목록에 없는 날짜 캐시 키(2026-09-27 — 영구 누적으로 DB 한도 초과 사고).
//  · 우회: 그 줄에 `토큰예외: <이유>`(날짜 키는 `캐시날짜예외: <이유>`)를 적거나(권장), 최후에 git commit --no-verify
import { execSync } from 'child_process'
import { findDatedCacheKeys, parseRulePrefixes, prefixFromDefinition } from './cacheDateGuard.mjs'

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) } catch { return '' } }
const C = { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

// 추가된 라인만(+로 시작, +++ 제외) · src/ 대상만
const diff = sh('git diff --cached -U0 -- src/')
const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1))
const stagedFiles = sh('git diff --cached --name-only -- src/').trim().split('\n').filter(Boolean)
if (added.length === 0) process.exit(0)

// ── 신규 파일 판별 + 파일별 추가 라인 ──────────────────────────────────────
//  경고만으로는 안 지켜진다는 게 실측으로 드러났다(2026-09-02): 문서에 제1-b 를 적어둔 뒤로도
//  색상 하드코딩 645 → 885 → **946**, fontSize 리터럴 4,211 → **4,786**(39종)으로 계속 늘었다.
//  FS 토큰은 663곳(리터럴의 14%)뿐이다. 규칙 문서는 에이전트가 그냥 안 따른다.
//  → **신규 파일만** 차단한다. 기존 파일 수정은 경고 그대로 두어 `--no-verify` 습관화를 피한다
//    (이 훅이 원래 세운 판단을 유지하면서, 새로 유입되는 것만 원천 차단).
const newFiles = new Set(
  sh('git diff --cached --name-status --diff-filter=A -- src/').trim().split('\n')
    .filter(Boolean).map(l => l.split('\t').pop()).filter(f => f && !f.endsWith('src/lib/theme.ts')),
)
/** 파일 → 이번에 추가된 라인들 */
const addedByFile = new Map()
{
  let cur = null
  for (const l of diff.split('\n')) {
    const m = l.match(/^\+\+\+ b\/(.+)$/)
    if (m) { cur = m[1]; continue }
    if (cur && l.startsWith('+') && !l.startsWith('+++')) {
      if (!addedByFile.has(cur)) addedByFile.set(cur, [])
      addedByFile.get(cur).push(l.slice(1))
    }
  }
}
/** 토큰을 못 쓰는 정당한 사유가 있으면 그 줄에 `토큰예외: 이유` 를 적는다(침묵 우회 대신 이유를 남기게). */
const EXEMPT = /토큰예외:/

//  💬 주석 줄은 검사 대상이 아니다 — 이 프로젝트는 주석에 **실측 근거**를 적는 문화라
//     "구 카드 배경이 '#12151f' 였다" 같은 서술이 스타일 값으로 오탐된다(2026-09-04 실제 차단).
//     주석에 적힌 hex 는 화면을 칠하지 않는다. 단 코드 **뒤에 붙은** 주석은 앞부분이 코드이므로
//     여전히 걸린다(줄 **시작**이 주석일 때만 제외한다).
const isCommentLine = (l) => {
  const t = l.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

let blocked = false
const warn = (t) => console.log(`${C.y}⚠️  ${t}${C.x}`)

// ── ① 제1-b: 색상 하드코딩(theme.ts 자신은 예외 — 토큰 정의처) ─────────────
if (!stagedFiles.every(f => f.endsWith('src/lib/theme.ts'))) {
  const hex = added.filter(l => !isCommentLine(l) && /#[0-9a-fA-F]{6}\b/.test(l) && !/theme\.ts/.test(l))
  const inTheme = stagedFiles.length === 1 && stagedFiles[0].endsWith('src/lib/theme.ts')
  if (hex.length && !inTheme) {
    warn(`색상 하드코딩 ${hex.length}줄 추가됨 (제1-b: TK 토큰 사용)`)
    hex.slice(0, 3).forEach(l => console.log(`${C.d}      ${l.trim().slice(0, 100)}${C.x}`))
    console.log(`${C.d}      → src/lib/theme.ts 의 TK 에서 가져오세요. 필요한 색이 없으면 먼저 물어보세요.${C.x}`)
  }
}

// ── ② 제1-b: 글자 크기 리터럴(FS 스케일 사용) ──────────────────────────────
const fs = added.filter(l => !isCommentLine(l) && /fontSize:\s*[0-9]/.test(l))
if (fs.length) {
  warn(`fontSize 리터럴 ${fs.length}줄 추가됨 (제1-b: FS 스케일 사용)`)
  fs.slice(0, 3).forEach(l => console.log(`${C.d}      ${l.trim().slice(0, 100)}${C.x}`))
  console.log(`${C.d}      → FS.micro/tiny/body/lg/xl/h2/h1. 0.5px 단위 새 값은 위계를 만들지 못하고 파편화만 남깁니다.${C.x}`)
}

// ── ②-b 신규 파일은 토큰만 허용 → 차단 ──────────────────────────────────────
//    "규칙 문서로는 안 지켜지고 구조로 강제해야 한다"(2026-09-02 검토) — 새로 태어나는 파일만이라도
//    처음부터 깨끗하게 둔다. 기존 946곳·4,786곳은 건드리지 않으므로 리팩터 부담도 없다.
const newViolations = []
for (const f of newFiles) {
  for (const l of (addedByFile.get(f) ?? [])) {
    if (EXEMPT.test(l) || isCommentLine(l)) continue
    if (/#[0-9a-fA-F]{6}\b/.test(l)) newViolations.push({ f, l, why: '색상 하드코딩 → TK' })
    else if (/fontSize:\s*[0-9]/.test(l)) newViolations.push({ f, l, why: 'fontSize 리터럴 → FS' })
  }
}
if (newViolations.length) {
  blocked = true
  console.log(`${C.r}${C.b}⛔ 신규 파일에 디자인 값 하드코딩 (제1-b) — ${newViolations.length}건${C.x}`)
  for (const v of newViolations.slice(0, 8)) {
    console.log(`${C.r}   ${v.f} — ${v.why}${C.x}`)
    console.log(`${C.d}      ${v.l.trim().slice(0, 110)}${C.x}`)
  }
  if (newViolations.length > 8) console.log(`${C.d}      … 외 ${newViolations.length - 8}건${C.x}`)
  console.log(`${C.d}   → 신규 파일은 TK(색)·FS(글자) 토큰만 씁니다. 기존 파일 수정은 경고만 하니 리팩터 부담은 없습니다.${C.x}`)
  console.log(`${C.d}     토큰으로 표현 못 할 정당한 사유가 있으면 그 줄에 "토큰예외: <이유>" 를 적으세요(침묵 우회 대신 이유를 남깁니다).${C.x}`)
}

// ── ③ 캐시 키 버전업 시 옛 키를 참조하는 reader 잔존 → 차단 ────────────────
//    writer만 올리면 reader가 옛 키를 읽어 조용히 죽는다(실제 발생). 이건 경고로는 부족하다.
const newKeys = new Set()
//    `+` 도 본다 — `ai-rebalance-v52+${UNIFIED_RECO_V}` 같은 결합 키의 앞 버전을 올릴 때(정리 허용 목록 잔존까지 잡힌다)
for (const l of added) for (const m of l.matchAll(/['"`]([a-z][a-z0-9-]*?)-v(\d+)[:'"`+]/g)) newKeys.add(`${m[1]}|${m[2]}`)
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

// ── ④ 캐시 키에 날짜 — 정리 목록(PURGE_RULES)에 없는 접두어면 차단 ─────────────
//    app_cache 에는 지우는 장치가 없어 날짜 키가 영구 누적된다(2026-09-26 tech-chart 926 MB → DB 한도 초과·읽기 전용).
//    CLAUDE.md 문장만으로는 새 날짜 키가 계속 태어난다 — 판정은 scripts/cacheDateGuard.mjs(검증: verify-cache-purge.mjs).
{
  const rulePrefixes = parseRulePrefixes(sh('git show :src/lib/cachePurge.ts'))
  const resolve = (name) => prefixFromDefinition(name, sh(`git grep -h --cached -E "\\b${name}\\s*(:[^=]+)?=" -- src/`).split('\n'))
  const { violations, unresolved } = findDatedCacheKeys(addedByFile, rulePrefixes, resolve)
  if (unresolved.length) {
    warn(`날짜가 든 캐시 키 상수 ${unresolved.length}곳 — 정의를 못 찾아 접두어를 확인하지 못했습니다`)
    unresolved.slice(0, 3).forEach(u => console.log(`${C.d}      ${u.f} — ${u.name} · ${u.l.trim().slice(0, 90)}${C.x}`))
  }
  if (violations.length) {
    blocked = true
    console.log(`${C.r}${C.b}⛔ 캐시 키에 날짜 — 정리 목록(PURGE_RULES)에 없는 접두어 ${violations.length}건${C.x}`)
    for (const v of violations.slice(0, 8)) {
      console.log(`${C.r}   ${v.f} — ${v.prefix}${C.x}`)
      console.log(`${C.d}      ${v.l.trim().slice(0, 110)}${C.x}`)
    }
    if (violations.length > 8) console.log(`${C.d}      … 외 ${violations.length - 8}건${C.x}`)
    console.log(`${C.d}   → 날짜 키는 영구 누적 — 날짜를 빼고 TTL/sameKstDay 로, 꼭 필요하면 cachePurge.ts PURGE_RULES 에 keepDays 와 함께 등록하세요.${C.x}`)
    console.log(`${C.d}     정당한 사유가 있으면 그 줄에 "캐시날짜예외: <이유>" 를 적으세요(침묵 우회 대신 이유를 남깁니다).${C.x}`)
  }
}

if (blocked) {
  console.log(`\n${C.d}우회가 필요하면: git commit --no-verify${C.x}`)
  process.exit(1)
}
process.exit(0)
