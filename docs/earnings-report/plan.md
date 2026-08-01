# 📑 실적 리포트 — 설계 (2026-08-01)

## 목적
NotebookLM에 PDF를 수동 업로드해야 볼 수 있던 "기업 실적 보고서 요약"을, **원문을 자동 수집해 매 분기 갱신되는 화면**으로. 학생이 "이 회사가 이번 분기에 뭘 벌었고 다음 분기를 어떻게 보는지"를 뉴스 헤드라인이 아니라 **회사가 직접 쓴 문서**로 읽는다.

## 데이터 (Phase 0 실측 결과)
- ✅ **SEC 8-K Item 2.02 → EX-99.1/99.2** (무료·무키·node:https)
  - 티커→CIK 맵 `company_tickers.json` 10,412종(778KB)
  - `submissions/CIK{10자리}.json` → `filings.recent.items`에 '2.02'(Results of Operations) 필터
  - full submission `{accession}.txt`에서 **문서 TYPE으로 추출** — `<TYPE>EX-99.1`
  - 4/4 성공: NVDA(보도자료 20.2KB + **CFO Commentary 15.2KB**)·GOOGL 24.1KB·MSFT 23.0KB·AVGO 23.4KB
- ❌ **파일명 정규식(`/ex[-_]?99/i`)은 2/3 실패** — NVDA `q1fy27pr.htm`·GOOGL `googexhibit991q22026.htm`(회사마다 제각각) → TYPE 방식이 정답
- ❌ **컨퍼런스 콜 Q&A 전문**: SEC에 없음(Motley Fool·Seeking Alpha는 유료·스크랩 리스크) → 제외. EX-99.1(실적+가이던스) + EX-99.2(CFO 세그먼트 분석)로 핵심은 커버
- ⚠️ **한국(DART)**: 잠정실적 공시는 확보되나 **숫자 위주**(서술형 IR은 회사 홈페이지 PDF) → v1은 미국만
- 재사용: `getCache/setCache`(3계층) · `callGeminiJSON`+`KO_STYLE`(문체 SSOT) · `UNIVERSE_KEY`(시총 상위 50 선정) · `research-verdict`(6축·타점 결합)

## 계산 (결정론)
- **대상 50종** = 유니버스 US 중 `marketCap` 상위 50(동적 — 시총 변동 자동 반영). 하드코딩 티커 리스트 없음
- **최신 실적 8-K** = `items`에 '2.02' 포함한 가장 최근 8-K 1건
- **문서 선택** = `<TYPE>` 이 `EX-99`로 시작하는 문서 전부(99.1 보도자료 + 99.2 CFO 코멘터리)
- **요약** = Gemini(서술만) — 판정·점수는 기존 SSOT(6축·타점·어닝 서프라이즈)가 담당

## 정직 캐비엇 (UI에 명시할 것)
- 컨콜 Q&A 전문 미포함(SEC 공시 범위 밖)
- 요약은 AI 생성 — 원문 링크 항상 병기, 숫자는 원문 확인
- 미국 상장사만(한국은 DART 잠정실적이 숫자 위주라 v1 제외)
- 투자 추천 아님

## 구현
- SSOT lib `src/lib/earningsReport.ts` — 수집·추출·정제·요약
- 캐시 `sec-ticker-cik-v1`(30일) · `earnings-report-v2:{ticker}`(분기 단위 100일) · `earnings-report-index-v2`(목록)
- API `/api/earnings-reports`(공개·읽기) · `/api/cron/earnings-reports`(배치 수집·Gemini 한도 분산)
- 크론 매일 09:50 KST + `cronHealth` 등록
- 화면 `/earnings-reports` — 목록 + 종목 심층(원문 요약 × 앱 지표)
