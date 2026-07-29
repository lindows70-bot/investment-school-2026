#!/usr/bin/env node
// 🌙 야간 읽기 전용 감사 — 자는 동안 돌려 아침에 보고서만 남긴다.
//
// ⛔ 코드를 고치지 않는다(구조적으로 불가):
//    · Gemini 감사 = `--approval-mode plan`(읽기 전용)
//    · Codex 리뷰  = review 전용 커맨드(수정 금지가 커맨드 정의에 명시)
//    고치는 것은 사람이 아침에 보고서를 읽고 판단해서 한다.
//    ⚠️ '밤새 코드를 고치는' 자동화는 의도적으로 만들지 않았다 — 검토 없이 쌓인 변경은
//       아침에 재검증하는 비용이 더 크다(2026-07-28 판단).
//
// 왜 야간인가: 2026-07-28 Gemini 첫 감사가 **2주 죽어 있던 기능**(marks-cycle v3/v4 불일치로
//   FCF 방어 틸트 미발동)을 잡았다. 매일 돌았다면 2주가 아니라 하루 만에 잡혔다.
//
// 한도 배려: 오늘 커밋이 없으면 리뷰를 건너뛰고, 캐시 키 후보가 0이면 API 호출조차 하지 않는다.
//
// 사용: node scripts/nightly-audit.mjs   (작업 스케줄러가 매일 1회 호출)
import { spawnSync } from 'child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts })

const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const out = [`# 🌙 야간 감사 — ${kst}`, '']
const t0 = Date.now()

// ── ① 오늘 커밋에 대한 Codex 리뷰 ──────────────────────────────────────────
out.push('## 🔍 Codex 코드 리뷰')
let head = null
try {
  // ⚠️ 기준을 '오늘 00:00 이후'로 잡으면 안 된다 — 감사는 새벽에 도는데 작업은 전날 했으므로
  //    매번 0건이 된다(첫 실행에서 실제로 그랬다). **지난 감사 이후 전부**를 본다.
  //    PC가 며칠 꺼져 있어도 놓치지 않는다.
  head = sh('git', ['rev-parse', 'HEAD']).stdout.trim()
  const stamp = '.audit/last-head'
  let base = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : ''
  // 첫 실행(또는 기록된 커밋이 rebase·gc 로 사라진 경우) → 최근 24시간으로 폴백
  // ⚠️ `cat-file -e SHA^{commit}` 을 쓰지 마라 — Windows cmd 에서 **`^` 가 이스케이프 문자**라
  //    shell:true 로 넘기면 SHA 가 잘려 항상 실패한다(실측: status 128, "Not a valid object name").
  //    캐럿 없는 `cat-file -t` 로 타입만 확인한다.
  const alive = !!base && sh('git', ['cat-file', '-t', base]).stdout.trim() === 'commit'
  if (!alive) base = sh('git', ['rev-list', '-1', '--before="24 hours ago"', 'HEAD']).stdout.trim()

  const n = base ? Number(sh('git', ['rev-list', '--count', `${base}..HEAD`]).stdout.trim() || 0) : 0

  if (!base) out.push('- 기준 커밋을 찾지 못했습니다(저장소 이력 부족). 건너뜀.')
  else if (n === 0) out.push('- 지난 감사 이후 새 커밋 없음 → 리뷰 건너뜀(한도 절약).')
  else {
    out.push(`- 지난 감사 이후 커밋 ${n}건 리뷰 (\`${base.slice(0, 7)}..HEAD\`)`, '')
    const r = sh('node', [
      '"C:/Users/lindo/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs"',
      'review', '--wait', '--scope', 'branch', '--base', base,
    ], { timeout: 15 * 60_000 })
    const body = `${r.stdout || ''}${r.stderr || ''}`
      .split('\n').filter(l => !/^\[codex\]|DeprecationWarning|trace-deprecation|^\s+at /.test(l))
      .join('\n').trim()
    out.push(body || '(출력 없음)')
  }
} catch (e) { out.push(`- ⚠️ 실패: ${e.message}`) }

// ── ② 캐시 키 정합성 감사 ─────────────────────────────────────────────────
out.push('', '## 🔑 캐시 키 정합성 (writer/reader 버전 불일치)')
try {
  const r = sh('node', ['scripts/gemini-audit.mjs', 'cache-keys'], { timeout: 10 * 60_000 })
  const body = `${r.stdout || ''}${r.stderr || ''}`
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n').filter(l => !/DeprecationWarning|trace-deprecation|True color|Ripgrep|^\s+at /.test(l))
    .join('\n').trim()
  out.push(body || '(출력 없음)')
} catch (e) { out.push(`- ⚠️ 실패: ${e.message}`) }

// ── 보고서 저장 ───────────────────────────────────────────────────────────
out.push('', '---',
  `_${Math.round((Date.now() - t0) / 1000)}초 · 읽기 전용(코드 변경 없음) · 지적은 재현으로 확인 후 채택할 것_`)

mkdirSync('.audit', { recursive: true })
const path = `.audit/${kst}.md`
writeFileSync(path, out.join('\n'), 'utf8')
writeFileSync('.audit/latest.md', out.join('\n'), 'utf8')
// 다음 감사의 기준점 — 여기까지 봤다는 표식(PC 가 며칠 꺼져 있어도 그 사이 커밋을 놓치지 않는다)
if (head) writeFileSync('.audit/last-head', head, 'utf8')
console.log(`[nightly-audit] ${path} 작성 완료 (${Math.round((Date.now() - t0) / 1000)}초)`)
