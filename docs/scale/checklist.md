# 투자학교 저울 — 체크리스트

기획 `docs/student-mode/scale-plan.md` · 결정·실측 `context-notes.md`. 단계마다 세 폭(375/768/1280) 실측.

## 0단계 — Phase 0 실측
- [x] 원천 6개 실제 응답 확인(2026-09-29 프로덕션) — 판정표는 context-notes
- [x] FactSet 러너 최근 적재(2026-09-25 · 4일 전) · 금 GC=F 2년 일봉 · 공포탐욕 날짜로 찾기
- [ ] realYield 전체 시계열(2003~) — 채권 ② 칩 기준용(지금 2년 주별 111점뿐)
- [ ] M2 기준월(coin-lab 은 desc limit 37 원값 — units=pc1 아님) — 코인 ③ 용

## 1단계 — ①②열(기존 필드만)
- [x] `src/lib/scale.ts` 순수 조립 · `scripts/verify-scale.mjs` 26건(야간 감사 등록)
- [x] `/api/scale`(scale-v1 · 1h · 숫자 칸이 하나라도 비면 캐시 안 함)
- [x] `/s/scale` 화면 · 배우기 '더 알아보기'에 입구 카드
- [ ] 배포 · 프로덕션 세 폭 실측

## 2단계 — 필드 추가(③열·주담대)
- [ ] `regionSeason` 에 cpiMonth·cliMonth·폴백 플래그(지금은 CPI 못 받으면 2.5%, CLI 못 받으면 100 으로 조용히 채움)
- [ ] macro-regime rateDir 실패 플래그 · re-market kpi asOfMortgage(v3 + reader)
- [ ] ③열 계절 이름 + 근거 숫자

## 3단계 — 선생님 원칙
- [ ] 계절 × 자산 순풍/역풍 표 — **선생님 승인 후에만** ③ 칩
- [ ] 코어/위성 꼬리표 문구

## 4단계 — 배우기 연결·매일 여는 이유
- [ ] 요약 카드(칩만) · 저울의 용어 · 오늘 바뀐 칸 · 내가 가진 줄(브라우저에서만)

## 5단계 — 채점표 적립(표시는 나중)
- [ ] 전용 테이블 · 소급 없음 · 표본 수 + cohorts 게이트 · 채점 규칙 Codex 리뷰
