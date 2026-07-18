# 💸 절세 도우미 체크리스트

- [x] Phase 0: transactions 스키마 실측 (realized_pnl=종목 통화·transaction_date·currency 확인)
- [x] plan.md / context-notes.md 작성
- [ ] `/api/tax-helper` 구현 (auth·fp 캐시·환율·현재가 배치·loss/gain harvest 산출)
- [ ] `TaxHarvestHelper.tsx` 구현 (KPI·게이지·후보 리스트·교육 칩·캐비엇)
- [ ] history 페이지 5번째 탭 마운트
- [ ] `npm run check` + `check:build` (exit 직접 && 체이닝·파이프 금지)
- [ ] 배포 + `git log` 확인
- [ ] 검증: 실DB 학생 계정 실현손익 독립 재계산 대조 (수식 검산: taxable·estTax·room·절약액)
- [ ] CLAUDE.md 기록
