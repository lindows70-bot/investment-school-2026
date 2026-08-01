# 📰 어닝 결과 모닝 브리핑 — 설계 (2026-08-01)

## 목적
보유 종목 실적 발표 다음날 아침, 브리핑에서 beat/miss + 주가 반응을 바로 확인 — "어제 발표 어땠나"를 찾아다니지 않게.

## 데이터 (Phase 0 실측)
- ✅ Yahoo `earningsHistory`: 발표 직후 actual·estimate·**surprisePercent** 반영(GOOGL 7/22 발표분 +214%·SK하이닉스 .KS +85% — KR도 제공 실측)
- ❌ 발표일 자체는 어느 모듈도 안 줌 — 발표 후 calendarEvents는 다음 분기로 점프(GOOGL→10/28) → **사전 적립 맵**(`earn-dates-v1`) 필수
- 재사용: 주가 반응=getTechCandles(일별 캐시) · 예정일=calendarEvents(이벤트 캘린더와 동일 소스)

## 계산 (결정론)
- 적립: 라우트가 보유 종목 calendarEvents의 미래 발표일을 공유 맵에 merge(과거 21일 유지) — 캘린더 방문 의존 없이 자급
- 대상: 적립일이 [오늘−3, 오늘]인 보유 종목
- beat/miss: earningsHistory 최신 actual 분기, 단 `발표일−분기말 < 100일` 결합 검증(불일치=집계 중)
- 반응: 발표일 **이전** 마지막 종가 → 최신 종가 %(BMO/AMC 불명이라 전일 종가 앵커 통일)
- AI 미사용(전부 결정론 문장 조립 — 시의성 신호라 창작 위험 배제)

## 정직 캐비엇
- 발표 당일 반응 미집계 표시 · 서프라이즈는 EPS 컨센서스 대비(가이던스·질은 Jarvis 어닝콜에서) · 첫날은 적립 맵이 비어 다음 발표(PLTR 8/3)부터 작동

## 구현
lib/earnResults.ts(SSOT) · /api/earnings-results(auth·6h) · 브리핑 ①½ 아래 섹션
