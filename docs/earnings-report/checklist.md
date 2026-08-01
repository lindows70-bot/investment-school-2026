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

## 🇰🇷 한국 실적 카드 (2026-08-02 추가)

- [x] DART 잠정실적 원문 실측 → 서술 부재 확정, 숫자 확보 가능 확인
- [x] 제미나이 "완전히 가능" 주장 검증(오류 2건 발견 — context-notes 판정표)
- [x] SSOT lib `krEarnings.ts` (셀 단위 파싱·단위 정규화·정정 채택·빈 항목 null)
- [x] `/api/kr-earnings` + `/api/cron/kr-earnings`(09:15 KST) + cronHealth 등록
- [x] 실적 리포트 화면 🇺🇸/🇰🇷 탭 + 매출↑이익↓ 자동 경고 + 흑자/적자 전환 표시
- [x] 실컴파일 검증 3사 12개 값 DART 원문 일치 · 첫 수집 50종 23초
- [ ] 전체 화면 검증 (사용자 일정 — 구축 완료 후 일괄)

## 운영 메모
- 크론이 매일 전량 수집(50종 ~75초) + 요약 10종. 같은 분기(accession 동일)면 재수집·재요약 없음
- 프롬프트를 고친 뒤 특정 종목만 다시 요약: `?force=TICKER,TICKER&limit=N`
- 요약 품질 전수 점검 스크립트 패턴은 context-notes 참조(한자·높임체·영어 검사)
