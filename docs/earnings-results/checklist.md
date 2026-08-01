# 📰 어닝 결과 브리핑 체크리스트

- [x] Phase 0 — earningsHistory 신선도·발표일 부재 실측(판정표 context-notes)
- [x] SSOT lib(earnResults.ts) — 적립 맵·결합 검증·반응 계산
- [x] /api/earnings-results (auth·fp 캐시 6h)
- [x] 브리핑 ①½ 아래 📰 섹션(발표 없으면 렌더 0)
- [x] 검증: 실컴파일 4케이스 + 캔들 원천 재계산 일치(SK하이닉스 상한가 +30% 실데이터 확인)
- [x] tsc → check:build(&&) → 배포 → CLAUDE.md 기록
