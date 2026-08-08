# 💵 고FCF 성격 구분 — 설계 (2026-08-08)

## 목적
학생이 통합추천에서 "FCF수익률 28.2% 우수" 배지를 보고 매수 근거로 삼는데, 그 종목(IPARK)은
**최근 4년 합산 FCF가 적자**다(2022년 −1.87조). 올해 한 해의 수치가 다년 현금창출력을 대표하지
못하는 종목(건설 분양대금·경기순환·일시 호황)이 안정 현금창출 기업과 같은 '우수'를 받는다.
이게 해결되면: 학생은 "올해만 좋은 회사"와 "꾸준히 버는 회사"를 배지에서 구분할 수 있다.

## 데이터 (Phase 0 실측 — 2026-08-08)
- ✅ FTS 연간 cash-flow 시계열: 전 종목 4개 연도(freeCashFlow — OCF+CapEx 검산 통과 기확인)
- ❌ 지주회사 판별 필드: Yahoo industry가 HD현대="Oil & Gas Refining", LG="Consumer
  Electronics"(최대 자회사 업종으로 옴) — 'Conglomerates' 표식 없음. **지주 구분 기각.**
- 재사용: getTrueFcf(분기 TTM)·normalizeCashflow(통화 판별)·기존 스크리너 파이프라인

## 계산 (결정론) — assessFcfNature(ttmY, avgY, nYears)
- **mirage**: nY≥3 · avg<0 · ttm>0 → "최근 1년만 흑자(N년 합산 적자)". 점수는 avg로(실측: IPARK +28.2/−33.9)
- **volatile**: nY≥3 · ttm≥5 · 0≤avg<ttm×0.7 → "N년 평균 M%" 병기. 점수는 avg로(보수)
- **steady**: 그 외 → 종전대로 ttm
- 임계 근거: 안정군 실측 CV 0.08~0.4·avg/ttm ≥ 0.75(MSFT·오리온·글로비스·DL이앤씨) vs
  문제군 avg/ttm 0.65↓ 또는 음수. ×0.7이 두 군을 실측에서 가른다.

## 정직 캐비엇 (UI)
"N년 평균" 표본수 병기 · 예측 아님 · 숫자를 지우지 않고 병기(TTM 값은 그대로 표시)

## 구현
- trueFcf.ts: 연간 시계열 상시 수집(+annualFcf) → true-fcf-v2 · assessFcfNature 순수함수
- macroPhaseScreener: fcfAvgYield·점수를 scoreYield로·flags 분기 → universe v15
- unified-reco: 방어 가중(fcfTilt)을 scoreYield로·mirage는 🛟 제외 → v60
- stock-fcf: fcfYieldAvg·fcfYears·natureNote 응답 추가 · FcfQualityCard 캐비엇 행
