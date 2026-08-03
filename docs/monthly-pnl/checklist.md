# 📈 진짜 월별 손익 시계열 체크리스트

- [x] Phase 0 데이터 실측 14/14 (판정표 → context-notes)
- [x] SSOT lib `monthlyPnl.ts` (순수 계산 + 캔들 수집, 실패 종목 명시 반환)
- [x] API route POST `/api/monthly-pnl` (개인 데이터 무캐시, force-dynamic)
- [x] 대시보드 토글 [월별 손익(시계열)] | [매수 시기별] + 캐비엇 문구
- [x] 독립 재계산(스모크 4로트 수기 검산 — 22로트 화면 대조는 프로덕션에서) 검증 — 마지막 달 누적 == 대시보드 평가손익 / 7월이 최대 하락 월인지
- [x] tsc && check:build && 배포 && git log 확인
- [ ] docs/README.md 한 줄 + history 기록
