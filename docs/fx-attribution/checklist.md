# 💱 환율 기여도 분해 체크리스트

- [x] Phase 0 — purchase_date 커버리지·KRW=X 일봉·실측 유의성(판정표 context-notes)
- [x] SSOT lib(fxAttribution.ts) — 행 단위 분해·가중 합계·시나리오
- [x] /api/fx-attribution (auth·fp 일별 캐시·부분실패 박제 금지)
- [x] FxAttributionCard + 자산 관리 마운트(USD 보유 없으면 렌더 0)
- [x] 검증: 단위 12 + 라이브 3 = 15/15 일치
- [x] tsc → check:build(&&) → 배포 → CLAUDE.md 기록
