# 📑 실적 리포트 체크리스트

- [x] Phase 0 데이터 실측 (판정표 → context-notes)
- [x] 유니버스 `marketCap` 노출 + `UNIVERSE_KEY` v11 (상위 50 동적 선정)
- [ ] SSOT lib `earningsReport.ts` (CIK 맵·8-K 탐색·EX-99 추출·정제)
- [ ] Gemini 요약 (서술만·KO_STYLE·환각 가드)
- [ ] `/api/earnings-reports` 서빙 + `/api/cron/earnings-reports` 배치
- [ ] `cronHealth` 등록 (신규 크론은 헬스 등록이 한 세트)
- [ ] 화면 `/earnings-reports` + 사이드바
- [ ] 독립 재계산 검증 (SEC 원문에서 다시 뽑아 화면값과 대조)
- [ ] tsc → lint → check:build (`&&` 체이닝·파이프 금지) → 배포
- [ ] CLAUDE.md 기록 + docs/README.md 한 줄
