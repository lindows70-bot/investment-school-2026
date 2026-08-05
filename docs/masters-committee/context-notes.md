# 거장 위원회 — 컨텍스트 노트 (결정 기록)

## 데이터 실측 판정표 (2026-08-06)
| 소스 | 결과 | 비고 |
|---|---|---|
| stock-info.fundamentals | ✅ 23키 US·KR 동일 | NVDA·005930 실측. KR sector null 가능 |
| /api/stock-fcf | ✅ | fcfYield·qualityGap·opMargin·grade |
| /api/reverse-dcf | ✅ | impliedGrowth·gap·verdict |
| getMoatBreach / calcDCF / buildSignalMetrics(ROIC) | ✅ lib 직접 재사용 | morningstar-rating 라우트가 실증한 조합 |
| dilution-alert | ❌ 401 | 보유 종목+auth 한정 — 레드라인에서 제외 |

## 채택하지 않은 안과 이유
- **LLM이 판정**: 원칙 위반(판정은 코드). LLM은 페르소나 서술·반박·종합만.
- **실제 4개 병렬 LLM 에이전트**(원본 방식): Gemini 무료 티어에서 호출 5배 낭비.
  결정론 판정을 입력으로 **1회 호출**로 4인 발언+반박+종합을 구조화 생성 — 토론의
  교육 가치는 유지하고 비용은 1/5.
- **6축 통합점수 반영**: 펀더멘탈 선정 오염 금지(WHAT/WHEN 분리와 같은 원리의 레이어 분리).
- **거울 테스트를 판정에 반영**: "5문장 설명 가능"은 LLM 주관 판단이라 결정론 위반.
  교육 장치로만 노출하고 캐비엇 명시.
- **원본 레드라인 8개 그대로**: '경영진 정직성' 등은 우리 데이터로 결정론 판정 불가.
  데이터로 판정 가능한 6개로 재구성(가짜 정밀 금지 — 판정 못 하는 건 안 하는 척도 안 한다).

## 임계값 근거
- ROE 15%·ROIC 15/20: 앱 기존 임계값(unified-reco ⚙️ 배지)과 정합 — 제2원칙
- FCF수익률 3/5%: 기존 fcfTilt 밴드 재사용
- 안전마진 15~30%: 버핏 문헌 통상 범위. DCF 자체가 보수(성장률 35% 클램프)임을 캐비엇
- PEG≤1.2: 린치 적정(1.0) + 오차 여유. 기저효과 저PEG 는 isPegBaseEffect 로 먼저 걸러짐

## 검증에서 발견한 것
(구현 후 기록)
