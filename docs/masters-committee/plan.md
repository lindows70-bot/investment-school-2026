# 🎩 거장 위원회 (Masters' Committee) — 설계 (2026-08-06)

> 출처: 오픈소스 "AI Berkshire"(GitHub ⭐2,200+, 유튜브 QJC 퀀텀점프클럽 쇼츠 S0nKcbBlYgc) 개념을
> **우리 결정론으로 재구현**. 코드 복제 아님(우리 스택은 Gemini + 자체 SSOT).

## 목적
종목 하나를 놓고 가치투자 거장 4인(버핏·멍거·단요핑·리루)의 잣대로 **각자 독립 판정 →
교차 반박 → 의장 종합**을 보여준다. 학생이 얻는 것: ① 양비론 없는 강제 결론
(통과/회색/불통과 + 매수 가격 구간) ② 한 종목을 4가지 다른 각도로 뜯는 법
③ 레드라인(하나라도 걸리면 탈락) 사고방식.

## 데이터 (Phase 0 실측 결과 — 2026-08-06)
- ✅ stock-info.fundamentals: US·KR 동일 23키 실측 확인 — pe·peg·pbr·eps·forwardEps·
  earningsGrowth·returnOnEquity·grossMargins·operatingMargins·freeCashflow·totalDebt·
  totalCash·sharesOutstanding·payoutRatio·annualDividend·dividendYield·high52w·low52w·
  psr·marketCap (NVDA·005930 실측. KR sector 는 null 가능 — 전 체크가 null 안전해야 함)
- ✅ /api/stock-fcf: fcfYield·qualityGap(이익-현금 괴리)·opMargin·grade
- ✅ /api/reverse-dcf: impliedGrowth·actualGrowth·gap·verdict (멍거 인버전 재료)
- ✅ lib 재사용: getMoatBreach(해자)·calcDCF+deriveDcfInputs(버핏 DCF)·
  buildSignalMetrics(ROIC)·isPegBaseEffect(기저효과)·callGeminiJSON
- ❌ dilution-alert: 보유 종목 한정 + auth(401) → 임의 티커 위원회에선 제외(정직 기록)

## 계산 (결정론 — 판정은 코드, AI는 서술만)
- 거장별 체크 4~5개, 각 PASS/WARN/FAIL → 거장 판정 = FAIL≥2 → 불통과 / FAIL=1 or WARN≥2 → 회색 / 그 외 통과
  - 버핏: 해자(moatWidth wide/narrow)·ROE≥15%(부풀림 아님)·FCF수익률≥3%·순부채≤0 또는 부채<시총 20%·DCF 안전마진
  - 멍거(인버전 의장): 레드라인 관장 + 역-DCF 기대과도·이익질(qualityGap)·기저효과
  - 단요핑(본분): 영업이익률≥15%·마진>업계 중앙 프록시(총마진≥30%)·주주환원(배당 or 자사주 payout>0)·이익-현금 일치
  - 리루(저평가 심도): PEG≤1.2·어닝일드(1/PE)>4%·PBR 합리(≤5 성장주 예외)·52주 위치 하단 보너스
- 레드라인(하나라도 → 위원회 즉시 불통과): ① 이익-현금 괴리(qualityGap) ② ROE 부풀림
  (ROIC 대비) ③ 기저효과 저PEG(isPegBaseEffect SSOT) ④ 적자 지속+전망 부재(eps<0 &&
  forwardEps<0) ⑤ 역-DCF 기대과도 최상급 ⑥ 데이터 결측 3키 이상(검증 불가면 사지 않는다)
- 매수 가격 구간 = 버핏 DCF intrinsicPerShare × (1−안전마진 30%) ~ × (1−15%).
  DCF 불가(적자·기저효과)면 구간 없이 "산정 보류"(가짜 정밀 금지)
- 종합: 레드라인 → 불통과 / 통과≥3 & 불통과 0 → 통과 / 불통과≥2 → 불통과 / 그 외 회색

## AI(Gemini) — 서술만
결정론 판정 결과를 입력으로, 한 번의 callGeminiJSON 으로: 4인 각자의 발언(자기 체크
결과를 페르소나 문체로) + 교차 반박 2~3개(데이터에 있는 것만 지적) + 의장 종합 3문장 +
거울 테스트(회사를 5문장으로 설명 시도 — 판정 미반영, 교육 장치).

## 정직 캐비엇 (UI 명시)
- 판정은 앱 데이터 기준 결정론이며 거장 본인의 의견이 아니다(교육용 재현)
- 매수 관점 판정 — 보유 종목 불통과 ≠ 매도 지시(보유분은 출구 플랜에서)
- 6축 통합점수에 미반영(별도 레이어) · 거울 테스트는 판정에 미반영
- 데이터 결측 항목은 그 체크를 건너뛰지 않고 WARN 처리(폴백이 판정에 숨지 않게)

## 구현
- src/lib/mastersCommittee.ts — 순수 판정 함수(SSOT)
- /api/masters-verdict?ticker=&market= — 수집+판정+Gemini 서술, 캐시 masters-committee-v1:{T}:{M} 7d
- src/app/components/MastersCommittee.tsx — /research 화면 패널
