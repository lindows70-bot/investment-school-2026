# 💱 환율 기여도 분해 체크리스트

- [x] Phase 0 — purchase_date 커버리지·KRW=X 일봉·실측 유의성(판정표 context-notes)
- [ ] SSOT lib(fxAttribution.ts) — 행 단위 분해·가중 합계·시나리오
- [ ] /api/fx-attribution (auth·fp 일별 캐시·부분실패 박제 금지)
- [ ] FxAttributionCard + 자산 관리 마운트(USD 보유 없으면 렌더 0)
- [ ] 검증: 실측 표(PHO +1.8%→−4.4% 등)와 독립 재계산 대조
- [ ] tsc → check:build(&&) → 배포 → CLAUDE.md 기록
