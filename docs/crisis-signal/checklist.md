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
- [ ] 배포 후 프로덕션 응답을 원천에서 독립 재계산해 대조
- [ ] 세 폭(1280 · 768 · 375) 화면 확인
- [ ] 야간 불변식 등록 · docs/history · docs/README
