#!/usr/bin/env node
// 🔍 Gemini 코드 리뷰 폴백 — Codex 가 한도 쿨다운·실패일 때 같은 커밋 구간을 Gemini 2.5 flash 로 읽기 전용 리뷰한다.
//
// 왜 생겼나(2026-09-13): Codex 무료 한도가 두 번(9/5·9/13) 통째로 소진돼 각각 한 달씩 리뷰가 통째로 비었다.
//   Codex 대체가 아니라 **공백 메우기**다 — 역할 분담표의 Gemini 는 '정합성' 담당이고 코드 리뷰어로 얕다는 걸 알고 쓴다.
//   메타/Grok/Groq 오픈모델 검토(9/13)는 이 PC(내장 GPU·VRAM 1GB)와 무료 한도(Groq 8k 토큰/일) 때문에 기각됐다.
//
// 설계는 gemini-audit.mjs 와 같다 — **요청 1회**. 증거(diff)를 로컬에서 만들어 한 번에 넘기고 판단만 시킨다.
// ⚠️ 커밋 제목(=작성자의 결론)은 프롬프트에 넣지 않는다(2026-09-24) — "리뷰어에게 CLAIM 을 넘기면 동의 쪽으로 기운다"
//   (addyosmani/agent-skills doubt-driven-development 에서 가져온 규칙). 건수만 알리고 diff·stat 으로만 판단시킨다.
//   Codex 는 codex-companion 이 프롬프트를 만들어 여기서 손댈 수 없다 — agent-roles 스킬에 같은 원칙을 적어 둔다.
//   무료 티어는 하루 20회라 재시도 폭주가 한도를 태운 전례가 있다(재시도 최대 2회·503 만).
//
// 사용: node scripts/gemini-review.mjs --base <sha> [--head <sha>]
//   출력 마지막 줄에 '✅ 리뷰 완료' 를 찍는다 — nightly-audit 는 exit 0 + 이 문구를 함께 본다('돌긴 했는데 못 했다' 방지).
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'

const args = process.argv.slice(2)
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const base = opt('--base'), head = opt('--head', 'HEAD')
if (!base) { console.error('사용법: node scripts/gemini-review.mjs --base <sha> [--head <sha>]'); process.exit(1) }

const MODEL = process.env.GEMINI_AUDIT_MODEL || 'gemini-2.5-flash'
const MAX_DIFF = 180_000   // 자. flash 컨텍스트는 훨씬 크지만 무료 티어 분당 토큰 한도를 넘기지 않게 보수적으로.

const sh = (cmd, a) => spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const log = sh('git', ['log', '--oneline', '--no-decorate', `${base}..${head}`]).stdout.trim()
const stat = sh('git', ['diff', '--stat', `${base}..${head}`]).stdout.trim()
let diff = sh('git', ['diff', '--no-color', `${base}..${head}`, '--', 'src', 'scripts', 'vercel.json', 'package.json']).stdout
if (!log) { console.log('리뷰할 커밋이 없습니다.'); console.log('✅ 리뷰 완료 (0건)'); process.exit(0) }
let truncated = false
if (diff.length > MAX_DIFF) { diff = diff.slice(0, MAX_DIFF); truncated = true }

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  try {
    const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch { /* 아래에서 안내 */ }
  return null
}
const key = apiKey()
if (!key) { console.error('GEMINI_API_KEY 를 찾지 못했습니다(.env.local 또는 환경변수).'); process.exit(1) }

const prompt = `너는 이 저장소(Next.js 14 · Supabase · TypeScript 투자 교육 앱)의 **읽기 전용 코드 리뷰어**다. 코드는 고치지 말고 발견만 보고하라.
이 프로젝트가 반복해서 당한 결함 유형을 특히 보라:
- 캐시 키를 안 올린 채 응답 스키마·내용을 바꿈(writer 만 올리고 reader 가 옛 키를 읽는 것 포함)
- 폴백(\`A ?? B\`)이 판정에 들어가 데이터 공백이 조용히 성공으로 둔갑
- 응답에 이미 있는 필드를 화면이 안 씀('있는데 안 쓴 데이터')
- 인덱스 산술로 기간을 셈(결측에 밀려 다른 기간이 됨) · 서버 UTC vs 학생 KST · 장중 미완성 봉을 종가로 씀
- 한국식 등락 색(빨강=상승·파랑=하락)과 미국식이 한 화면에 섞임
- 부분실패 결과를 캐시에 박제 · 실패했는데 워터마크(last-head 류)를 전진
- 개인 데이터(보유·손익·비중)가 무료 LLM 키로 나감(personal: true 누락)

보고 형식(한국어, 간결): 심각도 순으로 발견마다 — [P1/P2/P3] 한 줄 요약 / 파일:줄(diff 의 +줄 기준 추정, 확신 없으면 "줄 확인 필요") / 무엇이 왜 문제인가 / 어떻게 재현·검증하나.
⛔ diff 에 없는 파일·줄을 지어내지 마라. 확신이 없으면 "확인 필요"로 표시하라.
발견이 없으면 "발견 없음"이라고만 답하라. 억지로 만들지 마라.
${truncated ? '\n⚠️ diff 가 상한을 넘어 앞부분만 전달됐다. 그 사실을 서두에 밝혀라.\n' : ''}
=== 리뷰 구간 ===
커밋 ${log.split('\n').length}건(제목은 일부러 뺐다 — 작성자의 결론을 넘기면 리뷰어가 동의 쪽으로 기운다. diff 만 보고 판단하라)

=== 변경 통계 ===
${stat}

=== diff ===
${diff}`

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`
const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })

let out = null
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    const j = await res.json()
    if (j.error) {
      const msg = (j.error.message || '').split('\n')[0]
      if (res.status === 503 && attempt < 3) { await new Promise(r => setTimeout(r, 4000 * attempt)); continue }
      console.error(`❌ ${j.error.status || res.status}: ${msg}`)
      if (res.status === 429) console.error('   → 일일 한도 소진. 내일 다시 시도하거나 감사 전용 키를 분리하세요.')
      process.exit(1)
    }
    out = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? ''
    break
  } catch (e) {
    if (attempt < 3) { await new Promise(r => setTimeout(r, 4000 * attempt)); continue }
    console.error('❌ 호출 실패:', e.message); process.exit(1)
  }
}

const commits = log.split('\n').length
console.log(out?.trim() || '(빈 응답)')
console.log(`\n─ ${MODEL} · 요청 1회 · 커밋 ${commits}건 · diff ${diff.length.toLocaleString()}자${truncated ? '(일부 잘림)' : ''}`)
console.log(`✅ 리뷰 완료 (${commits}건)`)
