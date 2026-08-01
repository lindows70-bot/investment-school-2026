# 📑 실적 리포트 체크리스트

- [x] Phase 0 데이터 실측 (판정표 → context-notes)
- [x] 유니버스 `marketCap` 노출 + `UNIVERSE_KEY` v11 (상위 50 동적 선정)
- [x] SSOT lib `earningsReport.ts` (CIK 맵·8-K 탐색·EX-99 추출·정제)
- [x] Gemini 요약 (서술만·KO_STYLE·환각 가드)
- [x] `/api/earnings-reports` 서빙 + `/api/cron/earnings-reports` 배치
- [x] `cronHealth` 등록 (id `earnReports` · 09:20 KST · status ok 확인)
- [x] 화면 `/earnings-reports` + 사이드바(종목 확인 그룹)
- [x] 독립 재계산 검증 (SEC 원문 직접 재조회 → TSLA 5/5·AAPL 2/2·MSFT 1/1 일치)
- [x] 50종 요약 전수 품질 스캔 (한자·높임체·영어 잔존 0)
- [x] tsc → lint → check:build (`&&` 체이닝·파이프 금지) → 배포
- [x] CLAUDE.md 기록 + docs/README.md 한 줄

## 운영 메모
- 크론이 매일 전량 수집(50종 ~75초) + 요약 10종. 같은 분기(accession 동일)면 재수집·재요약 없음
- 프롬프트를 고친 뒤 특정 종목만 다시 요약: `?force=TICKER,TICKER&limit=N`
- 요약 품질 전수 점검 스크립트 패턴은 context-notes 참조(한자·높임체·영어 검사)
