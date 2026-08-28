# 🔌 킬스위치 체크리스트

- [x] Phase 0 데이터 실측 (판정표는 context-notes)
- [x] `lib/oecdCli.ts` — fetchCli SSOT + 키 상수(v1→v2), `cliNextPrev`·기준월 추가
- [x] reader 3곳 교체 — `regionSeason`·`portfolio-flow`·`season-navigator`
- [x] `lib/killSwitch.ts` — 순수 함수, 임계값은 `seasonNavigator` 판정식에서 역산
- [x] `api/season-navigator` — `killSwitch` 필드 + 캐시 v11→v12
- [x] `TYPICAL_LAG.oecdCli` 등록 (실측 2개월)
- [x] 컴포넌트 — 4계절 축 진단 아래 + 물가축 AND 게이트 경고
- [x] 독립 재계산 검증 — `scripts/verify-kill-switch.mjs` 15건 전부 통과
- [x] `npm run check:build` → 커밋 → 배포 → 프로덕션 확인
      - `season-sector` = `inflation`(☀️ 여름) — 검증 스크립트 판정과 일치
      - `app_cache` v2 8개 지역 전부 기록, **v1과 cli·cliPrev 가 소수점 12자리까지 동일**(판정 무변화 확인)
- [x] `docs/history/2026-08.md` 기록
- [ ] 🔒 화면 렌더 확인 — `season-navigator` 는 로그인 필요라 **사용자 확인 대기**
- [ ] 🧹 `oecd-cli-*-v1` 8행은 reader 가 없어 방치 상태(무해). 지우려면 사용자 확인 후
