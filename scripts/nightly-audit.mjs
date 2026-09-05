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
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts })

const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const out = [`# 🌙 야간 감사 — ${kst}`, '']
const t0 = Date.now()

/** 각 단계의 성공 여부 — 하나라도 실패면 보고서 최상단에 띄우고 last-head 를 전진시키지 않는다 */
const status = { codex: 'skip', gemini: 'skip', invariants: 'skip' }

/** 🔒 상시 불변식 — "한 번 고쳤는데 나중에 조용히 어긋나는" 유형만 넣는다(2026-08-28 신설).
 *  그날 하루에 두 번 당했다: ①킬스위치 임계값이 판정식과 갈릴 수 있음
 *  ②국면 라벨이 금리 방향을 부정("금리 고점·동결"인데 "기준금리 인상")했는데 빌드·타입체크가 못 잡았다.
 *  ⛔ 일회성 마이그레이션 확인(verify-season-regression)은 넣지 않는다 — 상시 참인 명제가 아니다. */
const INVARIANTS = [
  { file: 'scripts/verify-regime-label.mjs', label: '국면 라벨 × 금리방향 모순' },
  { file: 'scripts/verify-kill-switch.mjs', label: '킬스위치 임계값 = 판정식' },
  // 2026-09-05 신설 — CPI 가 화면마다 달랐다(3.5% vs 3.3%). 인덱스 산술로 12개월을 세다가
  //   결측(2025-10)에 밀려 13개월 차분이 됐는데 빌드·타입체크·화면검증이 전부 통과했다.
  { file: 'scripts/verify-cpi-consistency.mjs', label: 'CPI 화면 간 값·기준월 일치' },
]

/**
 * 도구가 "돌긴 했는데 아무것도 못 했다"를 성공으로 세지 않기 위한 판정.
 * ⚠️ 2026-08-02 감사는 Codex 가 "Reviewer failed to output a response" 를 뱉었는데도
 *    보고서가 정상 완료로 끝났고, last-head 까지 전진해 **커밋 50건이 영구 미리뷰**로 남았다.
 */
const looksFailed = (r, body) =>
  r?.error != null || r?.status !== 0 ||
  /failed to output a response|rate.?limit|quota|usage limit|not authenticated|command not found/i.test(body)

/** ⏳ Codex 무료 한도 쿨다운 (2026-09-05 신설)
 *  실측: 한도가 소진되면 응답이 **복구 시각을 알려준다**
 *    `Codex error: You've hit your usage limit. ... try again at Sep 10th, 2026 10:51 PM.`
 *  그런데 그 값을 아무도 안 썼다('있는데 안 쓴 데이터' — 이 프로젝트 최다 결함 유형).
 *  결과로 두 가지가 났다:
 *    ① 한도가 없는 걸 알면서 **매일 리뷰를 걸고 타임아웃까지 기다렸다**(로그 실측 585·426·242초).
 *       9/5 실행은 그러다 강제 종료(0xC000013A)돼 보고서가 아예 안 써졌다.
 *    ② 보고서 배너에 `2026-08-27까지` 라는 **하드코딩 날짜**가 박혀 있어, 읽는 사람이 언제 풀리는지 몰랐다.
 *  → 복구 시각을 파일에 적어 두고 그 전에는 **시도조차 하지 않는다**. 배너 날짜도 이 값에서 나온다.
 *  ⚠️ 쿨다운이어도 last-head 는 전진시키지 않는다 — 미리뷰 구간은 그대로 남아야 한다. */
const COOLDOWN = '.audit/codex-cooldown.json'
function readCooldown() {
  try {
    const j = JSON.parse(readFileSync(COOLDOWN, 'utf8'))
    return Number.isFinite(j?.at) ? j : null
  } catch { return null }
}
/** 응답에서 복구 시각을 뽑는다 — 못 뽑으면 null(그때는 쿨다운을 새로 쓰지 않는다). */
function parseResumeAt(body) {
  const m = /try again at ([A-Z][a-z]{2}\.? \d{1,2}(?:st|nd|rd|th)?,? \d{4},? \d{1,2}:\d{2}\s?[AP]M)/i.exec(body || '')
  if (!m) return null
  const raw = m[1]
  // "Sep 10th, 2026 10:51 PM" → 서수 접미사를 떼야 Date.parse 가 읽는다. 타임존 표기가 없으므로 로컬(KST)로 해석된다.
  const at = Date.parse(raw.replace(/(\d+)(st|nd|rd|th)/i, '$1'))
  return Number.isFinite(at) ? { at, raw } : null
}

/** 마지막 감사 이후 며칠 비었는지 — 감사가 조용히 멈춘 걸 아침에 알아채는 유일한 단서 */
function gapDays() {
  try {
    if (!existsSync('.audit')) return 0
    const prev = readdirSync('.audit').filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort()
    const last = prev.filter(f => f.slice(0, 10) < kst).pop()
    if (!last) return 0
    return Math.round((Date.parse(kst) - Date.parse(last.slice(0, 10))) / 86400_000)
  } catch { return 0 }
}

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

  const cool = readCooldown()

  if (!base) out.push('- 기준 커밋을 찾지 못했습니다(저장소 이력 부족). 건너뜀.')
  else if (n === 0) { out.push('- 지난 감사 이후 새 커밋 없음 → 리뷰 건너뜀(한도 절약).'); status.codex = 'ok' }
  else if (cool && cool.at > Date.now()) {
    // 한도가 아직 안 풀렸다 — 부르지 않는다(불러 봐야 같은 에러를 받고 시간만 태운다).
    status.codex = 'cooldown'
    out.push(`- ⏳ **Codex 무료 한도 소진 — \`${cool.raw}\` 이후 재시도합니다.**`,
      '  (한도 응답이 알려준 시각입니다. 그 전에는 호출하지 않습니다 — 매번 타임아웃까지 기다리던 것을 없앴습니다)',
      `  미리뷰 커밋 ${n}건은 그대로 쌓여 있고, 기준점(last-head)은 전진시키지 않았습니다.`, '')
  }
  else {
    out.push(`- 지난 감사 이후 커밋 ${n}건 리뷰 (\`${base.slice(0, 7)}..HEAD\`)`, '')
    const r = sh('node', [
      '"C:/Users/lindo/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs"',
      'review', '--wait', '--scope', 'branch', '--base', base,
    ], { timeout: 15 * 60_000 })
    const body = `${r.stdout || ''}${r.stderr || ''}`
      .split('\n').filter(l => !/^\[codex\]|DeprecationWarning|trace-deprecation|^\s+at /.test(l))
      .join('\n').trim()
    if (looksFailed(r, body)) {
      status.codex = 'fail'
      // 한도 응답이면 복구 시각을 적어 둔다 → 그때까지 다시 부르지 않는다
      const resume = parseResumeAt(`${r.stdout || ''}${r.stderr || ''}`)
      if (resume) {
        writeFileSync(COOLDOWN, JSON.stringify({ ...resume, seenAt: new Date().toISOString() }, null, 2), 'utf8')
        out.push(`- ⏳ 한도 소진 — \`${resume.raw}\` 이후 재시도하도록 기록했습니다(\`${COOLDOWN}\`).`)
      }
      out.push(`- ❌ **리뷰 실패 — 커밋 ${n}건은 아직 검토되지 않았습니다.**`,
        '  (다음 감사가 같은 구간을 다시 시도합니다 — 기준점을 전진시키지 않았습니다)', '')
    } else status.codex = 'ok'
    out.push(body || '(출력 없음)')
  }
} catch (e) { status.codex = 'fail'; out.push(`- ⚠️ 실패: ${e.message}`) }

// ── ② 캐시 키 정합성 감사 ─────────────────────────────────────────────────
out.push('', '## 🔑 캐시 키 정합성 (writer/reader 버전 불일치)')
try {
  const r = sh('node', ['scripts/gemini-audit.mjs', 'cache-keys'], { timeout: 10 * 60_000 })
  const body = `${r.stdout || ''}${r.stderr || ''}`
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n').filter(l => !/DeprecationWarning|trace-deprecation|True color|Ripgrep|^\s+at /.test(l))
    .join('\n').trim()
  if (looksFailed(r, body)) { status.gemini = 'fail'; out.push('- ❌ **정합성 감사 실패 — 이번 회차는 점검되지 않았습니다.**', '') }
  else status.gemini = 'ok'
  out.push(body || '(출력 없음)')
} catch (e) { status.gemini = 'fail'; out.push(`- ⚠️ 실패: ${e.message}`) }

// ── ③ 상시 불변식 검증 ────────────────────────────────────────────────────
out.push('', '## 🔒 불변식 (판정식 ↔ 화면이 어긋났는지)')
try {
  const fails = []
  for (const inv of INVARIANTS) {
    const r = sh('node', [inv.file], {
      timeout: 8 * 60_000,
      // lib 단위검증 레시피 — 별칭(@/) 해석에 프로젝트 node_modules 가 필요하다
      env: { ...process.env, NODE_PATH: `${process.cwd()}/node_modules` },
    })
    const body = `${r.stdout || ''}${r.stderr || ''}`
      .split('\n').filter(l => !/DeprecationWarning|trace-deprecation|^\s+at /.test(l)).join('\n').trim()
    // ⚠️ '돌긴 했는데 아무것도 못 했다'를 통과로 세지 않는다 — 통과 문구가 **실제로 찍혔는지**까지 본다
    const passed = r.status === 0 && !r.error && /전부 통과/.test(body)
    out.push(`- ${passed ? '✅' : '❌'} **${inv.label}** (\`${inv.file}\`)`)
    if (!passed) {
      fails.push(inv.label)
      out.push('', '```', body.split('\n').filter(l => /❌|원천|실패/.test(l)).slice(0, 12).join('\n') || '(출력 없음)', '```', '')
    }
  }
  status.invariants = fails.length ? 'fail' : 'ok'
  if (fails.length) out.push('', `> ⚠️ **${fails.join(' · ')}** 가 깨졌습니다 — 화면이 서로 다른 말을 하고 있을 수 있습니다(제2원칙).`, '')
} catch (e) { status.invariants = 'fail'; out.push(`- ⚠️ 실패: ${e.message}`) }

// ── 보고서 저장 ───────────────────────────────────────────────────────────
out.push('', '---',
  `_${Math.round((Date.now() - t0) / 1000)}초 · 읽기 전용(코드 변경 없음) · 지적은 재현으로 확인 후 채택할 것_`)

// 최상단 상태 배너 — 보고서가 '있다'는 것과 '제대로 돌았다'는 건 다른 말이다.
const icon = { ok: '✅', fail: '❌', skip: '⏭️', cooldown: '⏳' }
const gap = gapDays()
const banner = [
  `**상태** — Codex 리뷰 ${icon[status.codex]} · 캐시 정합성 ${icon[status.gemini]} · 불변식 ${icon[status.invariants]}`,
]
if (gap > 1) banner.push(`> ⚠️ **직전 감사가 ${gap}일 전입니다** — 그 사이 감사가 돌지 않았습니다(PC 절전·배터리 등).`)
// ⚠️ 날짜를 하드코딩하지 마라 — '2026-08-27까지'가 박혀 있어 한도가 풀린 뒤에도 그렇게 읽혔다.
//    복구 시각은 한도 응답이 알려주므로 그 값에서 뽑는다(제1원칙: 화면 숫자는 데이터에서).
{
  const c = readCooldown()
  if (status.codex === 'cooldown' && c)
    banner.push(`> ⏳ **Codex 무료 한도 소진** — \`${c.raw}\` 이후 자동 재시도합니다. 기준점을 전진시키지 않으므로 밀린 구간은 그대로 다시 봅니다.`)
  else if (status.codex === 'fail')
    banner.push('> ⚠️ Codex 리뷰가 실패했습니다. 리뷰 기준점은 전진하지 않으므로 복구되면 자동으로 밀린 구간을 봅니다.')
}
out.splice(1, 0, ...banner, '')

mkdirSync('.audit', { recursive: true })
const path = `.audit/${kst}.md`
writeFileSync(path, out.join('\n'), 'utf8')
writeFileSync('.audit/latest.md', out.join('\n'), 'utf8')
// ⚠️ 기준점은 **리뷰가 실제로 성공했을 때만** 전진시킨다.
//    실패해도 갱신하면 그 구간은 영영 리뷰되지 않는다(2026-08-02 에 커밋 50건이 그렇게 유실됐다).
if (head && status.codex === 'ok') writeFileSync('.audit/last-head', head, 'utf8')
const summary = `codex=${status.codex} gemini=${status.gemini} invariants=${status.invariants}${gap > 1 ? ` gap=${gap}일` : ''}`
console.log(`[nightly-audit] ${path} 작성 완료 (${Math.round((Date.now() - t0) / 1000)}초) · ${summary}`)
// 실패가 있으면 비정상 종료 — 작업 스케줄러 'LastTaskResult' 에 남아 조용한 실패를 막는다
// ⏳ 'cooldown' 은 여기 넣지 않는다 — 알려진 날짜가 있고 스스로 풀리며 보고서가 그 사실을 말한다.
//    닷새 내내 비정상 종료를 남기면 진짜 실패가 묻힌다(경보 피로).
if (status.codex === 'fail' || status.gemini === 'fail' || status.invariants === 'fail') process.exitCode = 1
