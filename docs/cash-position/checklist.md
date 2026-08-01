# 💰 현금 등록 체크리스트

- [x] user_cash.sql (⚠️ SQL Editor 1회 실행 필요 — 미실행 시 needsSetup 안내)
- [x] SSOT lib(cashPosition.ts) — 평가액·환산·밴드 판정
- [x] /api/cash-position (GET/PUT·needsSetup graceful)
- [x] CashPositionCard(자산 관리 상단) — 입력·비중 게이지
- [x] 연결: 막스 시계추 실측 병기 · 브리핑 ⑤ 칩 · 주간 리포트 게이지 실측 전환
- [x] 검증: 밴드·경계 9케이스 + 실DB 평가액 재계산 정합
- [x] tsc → check:build(&&) → 배포 → CLAUDE.md 기록
