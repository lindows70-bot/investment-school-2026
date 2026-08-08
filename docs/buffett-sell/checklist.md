# 🏰 버핏 매도 점검 체크리스트

- [x] Phase 0 데이터 실측 (판정표를 context-notes에 — incomeStatementHistory 사망 발견)
- [x] SSOT lib 작성 (buffettSell.ts — computeMoatErosion + combineBuffettSell 순수 판정)
- [x] 출구 플랜 통합 (exitPlan.ts buildOne + ExitPlanItem.buffett, quality_gap은 유니버스 조인)
- [x] 컴포넌트 (ExitPlanBoard 3축 칩 + 헤드라인, strong이면 매도 압력 신호에도 등재)
- [x] 캐시 (buffett-moat-v1 24h · exit-plan v2→v3)
- [ ] tsc → check:build → 배포 → 프로덕션 실증(보유 종목 카드)
- [ ] AI 리밸런싱 매도 진단에 사유 연결 (후속 — 표면 확장)
- [ ] 해자 침식 임계(−5%p) 소급 검증 (가격 비의존 축 — 역인과 없음, 하네스 재사용 가능)
- [ ] CLAUDE.md/히스토리 기록
