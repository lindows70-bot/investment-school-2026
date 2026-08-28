# 🔌 킬스위치 체크리스트

- [x] Phase 0 데이터 실측 (판정표는 context-notes)
- [ ] `lib/oecdCli.ts` — fetchCli SSOT + 키 상수(v1→v2), `cliNextPrev`·기준월 추가
- [ ] reader 3곳 교체 — `regionSeason`·`portfolio-flow`·`season-navigator` (writer만 올리면 조용히 죽는다)
- [ ] `lib/killSwitch.ts` — 순수 함수, 임계값은 `seasonNavigator` 판정식에서 역산
- [ ] `api/season-navigator` — `killSwitch` 필드 + 캐시 v11→v12
- [ ] `TYPICAL_LAG.oecdCli` 등록 (실측 2개월)
- [ ] 컴포넌트 — 4계절 다이어그램 아래 + 물가축 AND 게이트 경고
- [ ] 독립 재계산 검증 (FRED 원천에서 임계값 다시 계산해 화면값과 대조)
- [ ] `npm run check:build` → 커밋 → 배포 → 프로덕션 확인
- [ ] `docs/history/2026-08.md` 기록 + `docs/README.md` 한 줄
