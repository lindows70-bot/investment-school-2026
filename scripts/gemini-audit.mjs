#!/usr/bin/env node
// 🔍 Gemini 전 저장소 정합성 감사 — 이 앱이 22~52회 반복한 '여러 파일에 걸친' 버그를 전담한다.
//
// 왜 Gemini인가(역할 분담)
//  · 클로드(구현·설계) / Codex(코드 리뷰=로직 결함) / **Gemini(정합성 감사=파일 간 모순)**
//  · 이 앱의 반복 사고는 한 파일만 보면 전부 멀쩡해 보인다 — PEG가 화면마다 달랐던 일,
//    배당이 캘린더와 대시보드에서 3배 어긋난 일, 중위값 관례가 달라 28.5 vs 28.4가 된 일,
//    rotation v9→v11 reader 잔존. src/ 378파일·9.2만 줄을 한 번에 봐야 잡힌다.
//  · Gemini 2.5 Pro의 1M 컨텍스트가 그걸 가능하게 한다(클로드·Codex는 파일을 골라 읽는다).
//
// 안전
//  · `--approval-mode plan` = **읽기 전용**. 감사가 코드를 고치는 일은 구조적으로 불가.
//  · ⚠️ `plan` 은 **폴더가 신뢰 목록에 없으면 조용히 default 로 덮어써진다**
//    ("Approval mode overridden to default because the current folder is not trusted").
//    그래서 `--skip-trust`(이 세션 한정 워크스페이스 신뢰)를 함께 줘야 plan 이 실제로 적용된다.
//    두 플래그는 세트다 — 하나만 주면 읽기 전용 보장이 깨진다.
//  · 지적은 반드시 재현으로 확인한 뒤 채택한다(다른 에이전트도 틀린다).
//
// 사용: node scripts/gemini-audit.mjs <ssot|cache-keys|contradiction> [대상]
import { spawnSync } from 'child_process'

const [, , mode, ...rest] = process.argv
const target = rest.join(' ').trim()

const COMMON = `너는 이 저장소(Next.js 투자 교육 앱)의 **정합성 감사관**이다.
코드를 고치지 마라. 발견 사항만 보고한다.

이 앱의 두 원칙:
- 제1원칙: 데이터·디자인 값 하드코딩 금지(색상은 src/lib/theme.ts 의 TK, 글자 크기는 FS).
- 제2원칙(SSOT): **같은 지표는 어느 화면에서든 같은 출처·같은 계산·같은 관례**여야 한다.
  관례에는 중위값 짝수 처리, 폴백 해석, 반올림, 단위까지 포함된다.

보고 형식(한국어, 간결하게):
각 발견마다 — [심각도 P1/P2/P3] 한 줄 요약 / 파일:줄 / 무엇이 어떻게 다른가 / 왜 문제인가.
확신이 없으면 "확인 필요"로 표시하고 단정하지 마라. 추측으로 파일·줄 번호를 지어내지 마라.
발견이 없으면 "발견 없음"이라고만 답하라. 억지로 만들어내지 마라.`

const PROMPTS = {
  ssot: () => `${COMMON}

과제: 지표 "${target}" 이(가) 이 저장소에서 **여러 곳에서 다르게 계산되는지** 감사하라.

1. "${target}" 을(를) 계산·가공·표시하는 모든 위치를 찾아라(lib · API route · 컴포넌트).
2. 각 위치의 **원천**(어느 API/캐시/필드에서 오나)과 **계산식**을 비교하라.
3. 다음이 서로 다르면 제2원칙 위반이다 — 원천 / 공식 / 단위·스케일 / 반올림 / 결측(null) 처리 / 임계값.
4. SSOT가 이미 지정돼 있는데 그걸 안 쓰고 원천 API를 직접 호출하는 곳이 있으면 특히 중요하게 보고하라.`,

  'cache-keys': () => `${COMMON}

과제: **캐시 키 writer/reader 불일치**를 전수 감사하라. 이 앱에서 22회 이상 반복된 사고 유형이다.

1. \`<이름>-v<숫자>\` 형태의 캐시 키를 전부 찾아라(setCache/getCache, app_cache).
2. 키 이름별로 **쓰는 곳(writer)과 읽는 곳(reader)의 버전이 일치하는지** 확인하라.
3. 한 키에 **서로 다른 버전이 공존**하면 보고하라 — writer만 올리고 reader를 빼먹으면
   reader가 옛 키를 읽어 신호가 조용히 죽는다(sector-rotation v9→v11 사고).
4. 응답 스키마(필드)를 바꿨는데 키 버전을 안 올린 흔적이 있으면 함께 보고하라.`,

  contradiction: () => `${COMMON}

과제: "${target}" 관련 화면·기능들이 **학생에게 서로 모순되는 내용을 보여주는지** 감사하라.

1. "${target}" 을(를) 다루는 화면·API를 전부 찾아라.
2. 같은 종목·같은 시점에 **정반대 결론**이 나올 수 있는 조합을 찾아라
   (예: 한쪽은 매수 적기, 다른 쪽은 매도 검토).
3. 축이 달라서 정당한 다층인지(가치 vs 모멘텀처럼), 아니면 진짜 모순인지 구분하라.
   정당한 다층이면 **두 축을 함께 설명하는 문구가 화면에 있는지** 확인하고, 없으면 그것을 보고하라.
4. 요약(배너·헤드라인)이 상세(카드·표)와 어긋나는 경우도 모순이다.`,
}

if (!PROMPTS[mode] || (mode !== 'cache-keys' && !target)) {
  console.log(`사용법:
  node scripts/gemini-audit.mjs ssot <지표명>          예) ssot PEG
  node scripts/gemini-audit.mjs cache-keys             (대상 불필요)
  node scripts/gemini-audit.mjs contradiction <기능명> 예) contradiction 매수 추천`)
  process.exit(1)
}

const prompt = PROMPTS[mode]()
console.log(`\x1b[2m[gemini-audit] mode=${mode}${target ? ` target=${target}` : ''} · 읽기 전용(plan) · 1M 컨텍스트\x1b[0m\n`)

// ⚠️ --skip-trust 없이 --approval-mode plan 만 주면 신뢰 안 된 폴더에서 default 로 덮어써진다(위 주석).
const args = ['-p', prompt, '--skip-trust', '--approval-mode', 'plan', '-m', 'gemini-2.5-pro']
const r = spawnSync('gemini', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(r.status ?? 1)
