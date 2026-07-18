# 📋 신호 성적표 체크리스트

- [x] plan.md / context-notes.md 작성 (이벤트 압축·적립 설계 결정 기록)
- [x] cron/timing-watch에 signal-history-v1 인라인 적립 (중복 방지·상한 2,000)
- [x] `/api/signal-report` (Jarvis 런 압축 + 캔들 채점 + 4그룹 통계·부분실패 캐시 박제 금지)
- [x] `/signal-report` 페이지 + 사이드바 📌매일 등재
- [x] check + check:build 통과, 배포(3cd8c48) Ready
- [x] 검증: 프로덕션 첫 채점 — Jarvis 이력 2026-06-02~·35종목·SELL 27건(30일 적중 87%·평균 −15%)·BUY 14건(18%·−9.5%) / AAPL·LG전자·TXN 3건 독립 재계산 소수점 완전 일치 / TXN ret30 null=30일 게이트 정상 / 타이밍 0건=적립 시작 전(정상)
- [x] CLAUDE.md 기록
