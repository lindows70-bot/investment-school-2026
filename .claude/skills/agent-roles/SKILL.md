---
name: agent-roles
description: Use when deciding whether to bring in Codex or Gemini for cross-checking work in this app (2026 투자학교) — before committing a non-trivial change. Defines which of the three agents does what, when to invoke each, and when to invoke none.
---

# 에이전트 역할 분담 (2026 투자학교)

세 에이전트가 **같은 일을 하면 소음만 늘고 한도만 탄다.** 역할이 갈려 있어야 값어치가 있다.

| 에이전트 | 맡는 일 | 왜 이 역할인가 |
|---|---|---|
| **클로드**(나) | 구현·설계·검증·기록 | 대화 문맥과 CLAUDE.md 이력을 들고 있다 |
| **Codex** | 코드 리뷰 — 로직 결함·엣지 케이스 | 다른 모델의 독립 시선. 내 코드의 사각지대를 본다 |
| **Gemini** | 정합성 감사 — 파일 간 모순 | 1M 컨텍스트. src/ 378파일·9.2만 줄이 통째로 들어간다 |

⛔ **Gemini를 세 번째 코드 리뷰어로 쓰지 마라.** 그건 Codex와 겹친다. Gemini는 "여러 파일에 걸친 정합성"만 본다.

## 언제 Codex (`/codex:review`)

구현 후 커밋 직전에, 아래 하나라도 걸리면.
- 새 판정 로직·임계값 설계
- 캐시 키·SSOT 구조 변경
- 여러 화면이 공유하는 lib 수정
- "이 가정이 맞나" 싶은 설계 결정이 들어간 변경

⛔ 안 돌림: 문구 교체 · 검증된 패턴 반복 · 단순 버그 수정 · 스타일 변경.

## 언제 Gemini (`node scripts/gemini-audit.mjs`)

**한 파일만 보면 멀쩡한데 여러 파일을 함께 봐야 드러나는** 문제를 의심할 때.

```bash
node scripts/gemini-audit.mjs ssot PEG
```
```bash
node scripts/gemini-audit.mjs cache-keys
```
```bash
node scripts/gemini-audit.mjs contradiction 매수 추천
```

- **`ssot <지표>`** — 새 화면·API가 기존 지표(PEG·배당·섹터·계절·수급·중위값)를 쓰기 시작했을 때. 이 앱은 같은 지표를 다르게 계산해 **52회** 사고를 냈다.
- **`cache-keys`** — 캐시 키를 올린 직후, 또는 여러 라우트를 건드린 작업 뒤. 커밋 훅이 staged 라인만 보므로 **전수 점검은 이쪽 몫**이다.
- **`contradiction <기능>`** — 같은 종목·같은 시점에 두 화면이 반대 결론을 낼 수 있는 기능을 추가했을 때. **49회** 반복된 유형이다.

⛔ 안 돌림: 단일 파일 변경 · 새 지표라 비교 대상이 없을 때 · 이미 감사한 지표를 안 건드렸을 때.

## 셋 다 안 쓰는 경우

문구 교체, 스타일 변경, 이미 검증된 패턴의 반복, 오타 수정. **대부분의 커밋이 여기 해당한다.**

## 공통 규칙 (반드시)

1. **지적은 재현으로 확인한 뒤 채택한다.** 다른 에이전트도 틀린다. Codex 첫 리뷰의 지적은 재현으로 확증됐지만, 확증 안 되면 버리고 그 사실을 사용자에게 말한다.
2. **한도를 나눠 쓴다.** Codex=ChatGPT 구독 한도, Gemini=구글 계정 1,000회/일. 매 커밋마다 돌리면 정작 필요할 때 막힌다.
3. **감사는 읽기 전용.** `gemini-audit.mjs`는 `--approval-mode plan`으로 강제한다. 에이전트가 코드를 고치게 두지 마라 — 고치는 것은 내 몫이고, 고친 뒤엔 내가 검증한다.
4. **사용자에게 매번 묻지 않는다.** 2026-07-28에 판단을 위임받았다. 기준에 걸리면 조용히 돌리고 결과만 보고한다.
