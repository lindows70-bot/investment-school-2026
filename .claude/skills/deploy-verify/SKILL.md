---
name: deploy-verify
description: Use when about to verify, build, or deploy this app (2026 투자학교) — runs the project's exact check → build → deploy → confirm sequence and its known traps. Invoke before any `vercel --prod`, or when the user says 배포/deploy/검증.
---

# 배포 검증 절차 (2026 투자학교)

이 프로젝트는 배포 파이프라인에 **조용히 실패하는 함정**이 여러 개 있다. 전부 실제로 겪은 것이고, 순서를 지키지 않으면 "배포 성공"이라는 메시지를 받고도 잘못된 코드가 나간다.

## 0. 시작 전 — 절대 하지 말 것

- ❌ **`npm run build` 로컬 실행 금지.** dev 서버의 `.next`를 덮어써 흰 화면·"dev 재시작 필요"를 유발한다. 반드시 `npm run check:build`(별도 `.next-build` 폴더).
- ❌ **dev 서버가 떠 있을 때 같은 폴더에서 `next build` 금지.** 청크 404 → 하이드레이션 실패 → 폼이 브라우저 기본 GET 제출로 전락한다(로그인 불능 사고).
- ❌ **파이프로 검증 결과 가리기 금지.** `npm run check:build | tail` 은 tail이 성공하면 **빌드 실패를 숨긴다**. 실패한 빌드가 커밋·배포까지 흘러간 적이 있다.

## 1. 검증 — `&&` 체이닝으로만

```bash
npx tsc --noEmit > /tmp/t.log 2>&1 && echo TSC_OK \
  && npx next lint --file <변경한 파일들> > /tmp/l.log 2>&1 && echo LINT_OK \
  && npm run check:build > /tmp/b.log 2>&1 && echo BUILD_OK \
  || (echo FAIL; tail -n 20 /tmp/t.log /tmp/l.log /tmp/b.log)
```

- `;` 로 잇지 말 것 — 앞 단계 실패를 무시하고 진행한다.
- `grep -c` 처럼 **0을 반환하면 exit 1인 명령**을 체인 앞에 두지 말 것(체인이 끊긴다). 필요하면 `|| true`.

### `npm run check` 통과 ≠ `next build` 통과
로컬 lint는 일부 룰을 안 켠다. `next build`에서만 잡히는 것들:
- JSX 텍스트의 곧은 따옴표 `"` → `react/no-unescaped-entities` **에러**. 한국어 인용부호나 `&ldquo;`/`&rdquo;` 사용. **새 컴포넌트에 따옴표 문구를 넣을 땐 처음부터 이스케이프**.
- JSX 내 타입 캐스트 + 비교 연산: `{w as number >= 10}` → SWC 파싱 에러. `{(w as number) >= 10}` 로 괄호.
- `for..of` on Map/Set, `[...map.values()]` → TS2802. **`Array.from()`** 사용(반복 3회 이상 발생).

## 2. 캐시 키 버전업 확인 (조용히 깨지는 1순위)

로직·응답 스키마를 바꿨으면 캐시 키를 올려야 한다. **`app_cache`는 dev/prod가 공유**하므로 안 올리면 옛 값이 계속 서빙된다.

```bash
grep -rhoE "<키이름>-v[0-9]+" src/ | sort -u   # writer·reader 전수
```

- ⛔ **writer만 올리면 reader가 옛 키를 읽어 신호가 조용히 죽는다.** `sector-rotation` v9→v11 때 `unified-reco`·`timing-watch` 두 reader가 v9에 남아 틸트가 무력화됐다.
- 커밋 훅(`scripts/precommit-guard.mjs`)이 이걸 차단하지만, **훅은 마지막 방어선**이다. 먼저 grep으로 확인할 것.
- 공유 타입(`EntryTiming` 등)을 바꿨으면 그 타입을 캐시에 담는 **모든** 라우트의 키를 올린다.

## 3. 배포

```bash
npx vercel@54.20.1 --prod --yes > /tmp/d.log 2>&1 && echo DEPLOY_OK \
  && (grep -iE readyState /tmp/d.log | tail -n 1) || (echo FAIL; tail -n 15 /tmp/d.log)
```

- **버전 고정**(`@54.20.1`). 최신 릴리스 전파 지연으로 `npm error notarget` 이 난 적 있다.
- `vercel --prod` 는 git이 아니라 **작업 디렉토리 전체**를 배포한다. 커밋 안 한 코드도 나가고, 반대로 **선행 커밋이 실패하면 옛 상태가 재배포**된다.
- ⚠️ **"배포 성공"이 "내가 방금 짠 코드가 배포됨"을 보장하지 않는다.** 배포 후 `git log --oneline -1` 로 실제 커밋을 확인할 것.

## 4. 라이브 검증 — 화면이 auth 뒤면 어떻게 할까

대부분의 화면이 로그인 뒤에 있어 브라우저로 못 본다. 그럴 때:
1. **공개 API로 데이터 검증** — 값이 맞는지는 API 응답 + 독립 재계산으로 증명한다.
2. **배포 번들 직접 확인** — 로그인 경로의 코드가 실렸는지는 `performance.getEntriesByType('resource')` 로 JS 청크를 훑어 문자열/구조를 grep 한다(딥링크 가드 검증에 실제로 사용).
3. **못 한 검증은 못 했다고 말한다.** "로그인 경로는 실증하지 못했으나 URL 기반이라 타이밍과 무관하게 결정적이다" 처럼 근거와 한계를 함께 밝힌다.

## 5. 커밋 + 기록

- 커밋 메시지는 Write 도구로 파일에 쓰고 `git commit -F` — 셸 PATH가 깨지면 heredoc이 **빈 메시지로 조용히 실패**한 적이 있다.
- `git add -A` 금지(추적 안 되던 파일까지 휩쓴다). 의도한 파일만 명시.
- **CLAUDE.md에 기록**: 무엇을 왜 바꿨고, 검증에서 뭘 발견했고, 캐시 키를 어디까지 올렸는지. 이 프로젝트의 함정 사전이 곧 다음 세션의 하네스다.

## 6. 환경 이슈 체크리스트

- **디스크 100%** 재발 이력 → `check:build` ENOSPC·OOM. `df -h /c` 로 먼저 확인.
- **PowerShell로 한글 포함 파일 일괄 치환 금지** — CP949↔UTF-8 충돌로 한글 주석이 파손된다. 다중 파일 치환은 Python(`io.open(..., encoding='utf-8')`) 또는 Edit 도구.
- 캐시 키를 짧은 시간에 여러 번 올리면 매 배포가 콜드 재계산을 트리거해 첫 요청이 500/504가 난다. **꼭 필요할 때만.**
