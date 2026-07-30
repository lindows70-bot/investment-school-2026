# 🐎 신고가 레이더 체크리스트

- [x] Phase 0 백테스트 (84종·비중복·해부 4단 — 판정표는 context-notes)
- [x] 사용자 승인 — 별도 메뉴(종목 추천 그룹) 확정
- [x] 조합 lib (`hi52Radar.ts`) + 🧭 rotationShared SSOT 추출(3곳 복붙 제거)
- [x] API route (`/api/hi52-radar` — refresh=1·okCount<300 박제 금지·크론 09:25)
- [x] 화면 + 백테스트 수치 헤더 + momCrash 연동 + 캐비엇
- [x] 검증 — 그룹 판정 전수 시뮬 + 라이브 647종 스캔 + 화면 간 정합(CVX·Visa)
- [x] tsc → check:build → 배포 → 라이브 확인(342종·3그룹 정상)
- [ ] CLAUDE.md + docs/README.md 기록
