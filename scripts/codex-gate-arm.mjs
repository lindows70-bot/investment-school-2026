// Codex 자동 리뷰 게이트를 '한도 쿨다운이 끝난 뒤에만' 켜는 장치
// 쿨다운 중에 켜면 매 턴 종료마다 한도 소진된 Codex를 호출해 타임아웃까지 기다린다(CLAUDE.md 175줄 실사고).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const COOLDOWN = path.join(ROOT, '.audit', 'codex-cooldown.json')
const COMPANION = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs',
)

const force = process.argv.includes('--force')

function readCooldown() {
  try {
    return JSON.parse(fs.readFileSync(COOLDOWN, 'utf8'))
  } catch {
    return null
  }
}

const cd = readCooldown()
const now = Date.now()

if (cd?.at && now < cd.at && !force) {
  const hours = ((cd.at - now) / 3600000).toFixed(1)
  console.log(`⏳ Codex 한도 쿨다운 중 — 게이트를 켜지 않았습니다.`)
  console.log(`   복구 예정: ${cd.raw} (약 ${hours}시간 남음)`)
  console.log(`   그때 이 스크립트를 다시 실행하세요: node scripts/codex-gate-arm.mjs`)
  process.exitCode = 0
  process.exit()
}

if (!fs.existsSync(COMPANION)) {
  console.error(`❌ codex-companion.mjs 를 찾지 못했습니다: ${COMPANION}`)
  console.error(`   플러그인 버전이 올라갔다면 이 경로를 갱신하세요.`)
  process.exitCode = 1
  process.exit()
}

// 쿨다운이 지났다 — 다만 CLAUDE.md 239줄대로 ready:true 는 가용성의 증거가 아니다.
// 게이트만 켜고, 실제 가용 여부는 첫 리뷰가 판정한다.
const out = execFileSync(
  process.execPath,
  [COMPANION, 'setup', '--json', '--enable-review-gate', '--cwd', ROOT],
  { encoding: 'utf8' },
)

const report = JSON.parse(out.slice(out.indexOf('{')))
console.log(`✅ 게이트 활성화: ${report.reviewGateEnabled}`)
console.log(`   적용 범위: ${ROOT} (이 폴더에서 도는 세션만)`)
console.log(`   ⚠️ ready:true 는 인증만 본다 — 실제 가용성은 첫 리뷰가 갈린다(CLAUDE.md 239).`)
console.log(`   되돌리기: node "${COMPANION}" setup --disable-review-gate --cwd "${ROOT}"`)
