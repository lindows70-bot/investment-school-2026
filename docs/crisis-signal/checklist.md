# 위기 신호등 체크리스트

측정이 실패한 등은 만들지 않는다(없는 데이터를 있다고 가정하지 않는다).

## 0. 자료·실측
- [x] 제미나이 문서 2종(막스 5신호 · 매크로 리포트) 읽기 — 세 번째 PDF 는 이미지 전용(글자 15자)
- [x] 영상 EP55 대본 180줄 + 신호등 화면 프레임
- [x] 기존 신호 7개 프로덕션 응답 실측(crisis-radar · marks-cycle · yield-curve · leverage-radar · cocktail-party · us-liquidity · juglar-capex)
- [x] 설비투자÷번 돈 — 야후 분기 자료 실측 + 영상 화면 숫자(10-Q)와 대조

## 1. SSOT
- [x] `capexCash.ts` — 목록 공유(주글라르) · `capexCashOf` 순수 계산
- [x] 기존 판정 임계 상수화(usLiquidity HY · yieldCurve 삼의 법칙 · 반대매매 60)
- [x] 하이일드 기준일(hyDate) 전달 — macro-weather → us-liquidity(키 v2)
- [x] crisis-radar 선행 PER 문구 거짓("평균보다 높아 주의") 수정 + 키 v10
- [x] `crisisSignal.ts` 조립기 + 단위 검사

## 2. API·화면
- [x] `/api/crisis-signal`
- [x] 홈 카드 · 바로가기 타일
- [x] `/s/signal` 상세

## 3. 검증·기록
- [x] 타입·린트 · check:build
- [x] 배포 후 프로덕션 응답을 원천에서 독립 재계산해 대조(불변식 18건 — FRED · 야후 · FINRA)
- [x] 세 폭(1280 · 768 · 375) 화면 확인(넘침 0 · 결함 3건 수정)
- [x] 야간 불변식 등록 · docs/history · docs/README

## 4. 미국 빚 등(2026-11-22 추가 지시)
- [x] FINRA 원천 실측(이력 xlsx · Vercel 도달) · 한국과 같은 판정 규칙을 lib 로
- [x] 등 8개 · 미국이 먼저 · 과거에 빨강이었던 달 수 병기
- [x] 불변식에 FINRA 페이지 대조

## 5. 야데니 모델 · VIX 차트 · 바닥 신호(2026-11-22)
- [x] 야데니 모델 등(원래 식 · 두 색 · ERP 와 병기)
- [x] VIX 긴 차트(FRED 1990~ + 야후 최근일 · 1년/5년/1990년부터)
- [x] 바닥 신호 5칸(영상 틀 · 숫자 재계산 · 이익 전망 주간 적립)
- [x] 단위 검사 · 프로덕션 불변식 29건
- [ ] 세 폭 화면 확인(로그인 대기)
- [ ] 이익 전망 칸 — 4주 적립 뒤(2026-12-18 무렵) 켜지는지 확인