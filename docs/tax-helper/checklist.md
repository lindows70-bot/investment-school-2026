# 💸 절세 도우미 체크리스트

- [x] Phase 0: transactions 스키마 실측 (realized_pnl=종목 통화·transaction_date·currency 확인)
- [x] plan.md / context-notes.md 작성
- [x] `/api/tax-helper` 구현 (auth·fp 캐시·환율·현재가 배치·loss/gain harvest 산출)
- [x] `TaxHarvestHelper.tsx` 구현 (KPI·게이지·후보 리스트·교육 칩·캐비엇)
- [x] history 페이지 5번째 탭 마운트
- [x] `npm run check` + `check:build` 통과 (exit 직접 && 체이닝)
- [x] 배포 (cb2c143 + 9cd3898) + Ready·git log 확인
- [x] 검증: 실DB 독립 재계산 — 김상균 US 실현 $1,451.22=₩2,148,423(7건 합산 검산 일치)·과세표준 0·여유 ₩351,577·gain 후보 5종(GOOGL·NVDA·MPC·XBI·IBB) 산출 정합. 검증이 소수점 주수 표시 이슈 발견 → 절사 수정
- [x] CLAUDE.md 기록
