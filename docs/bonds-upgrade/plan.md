# 📜 채권편 강화 — 설계 (2026-08-22)

## 목적

기존 채권 축은 **듀레이션 나침반 + ETF 손익 시뮬 + 금리 3형제**뿐이었다.
정작 채권이 "무슨 말을 하고 있는지"를 읽는 도구 — 곡선 모양, 역전, 인하의 성격, 발작 시 파급 — 이 없었다.
사용자 6개 요구를 데이터로 답할 수 있는 형태로 구현한다.

| # | 요구 | 구현 |
|---|---|---|
| 1 | 일드커브 컨트롤(YCC) | 교육 카드 + 일본 10Y 실데이터 + '베센트 풋'(바이백) 연결 |
| 2 | 단기-중기-장기 채권 비교 | 만기 곡선 차트(11개 만기) + 3개월 전 대비 이동 |
| 3 | 3M/10Y·2Y/10Y 역전 트래킹 + Red Alert | 두 스프레드 동시 추적 · 3단계 경보 · 대시보드/브리핑 배너 |
| 4 | 경기 좋을 때 인하하면? | 인하 사이클 역사 분류(보험성 vs 위기성) + 이후 자산 경로 |
| 5 | 채권 발작 시 상관관계 | **조건부** 상관 — 평상시 vs 발작기를 갈라서 |
| 6 | 전반 강화 | 위를 채권 페이지에 통합 · PDF 매크로 서사 반영 |

## 데이터 (Phase 0 실측 → `context-notes.md`)

- ✅ FRED 만기 11종 · `T10Y2Y`·`T10Y3M` 공식 스프레드 · `USREC`·`SAHMREALTIME`·`FEDFUNDS`·`UNRATE` · 일본 `IRLTLT01JPM156N`
- ✅ Yahoo `^MOVE`(채권 변동성) · 자산 14종 일봉
- ❌ NBER 실시간 사용 불가(후행) · 일본 정책금리 계열 종료 · ^GSPC는 1985-01부터
- 재사용: 금리 국면 = `macro-regime` SSOT · ETF 가격 = `getTechCandles` SSOT · 금리 3형제 = `realYield` SSOT

## 계산 (결정론)

```
역전 경보  none  : 두 스프레드 모두 ≥ 0.25%p
          watch : 둘 중 하나라도 0 ≤ x < 0.25%p        🟡
          brief : 둘 중 하나라도 < 0, 연속 < 10거래일   🟠
          red   : 둘 중 하나라도 < 0, 연속 ≥ 10거래일   🔴 ← 대시보드·브리핑 경보

인하 유형  insurance : 침체 아님 AND 실업률 12개월 변화 < +0.5%p
          crisis    : 침체 중 OR 실업률 12개월 변화 ≥ +0.5%p
          (침체가 뒤따랐는지는 '결과'로 따로 표기 — 원인과 결과를 섞지 않는다)

발작일     |Δ10Y| ≥ 10bp  또는  |TLT 일간수익률| 상위 10%
조건부상관 corr(평상시) vs corr(발작일) 를 나란히
```

## 정직 캐비엇 (UI에 명시)

- **2022-10 ~ 2024-12 역전은 534일·−1.89%p였는데 침체가 오지 않았다.** 역전 카드 옆에 상설 표기.
- 리드타임 7~23개월 — **타이밍 도구가 아니다.**
- 인하 사이클 자산 성과는 **1986년 이후 표본**(^GSPC 이력 한계).
- 상관은 과거값이며 국면이 바뀌면 부호도 바뀐다(2022년 주식·채권 동반 하락이 실례).
- ⛔ 매도 지시 아님 — 경보는 국면 인식이지 매매 신호가 아니다.

## 구현

| 파일 | 역할 |
|---|---|
| `src/lib/yieldCurve.ts` (신규) | 곡선·두 스프레드·역전 에피소드·경보 레벨 SSOT(순수+FRED) |
| `src/lib/cutCycleHistory.ts` (신규) | 인하 사이클 분류 + 이후 경로 SSOT |
| `src/lib/bondCorrelation.ts` (신규) | 조건부 상관 SSOT |
| `src/app/api/yield-curve/route.ts` (신규) | **가벼운** 곡선·경보 전용(배너가 쓴다) |
| `src/app/api/bonds/route.ts` | 상관·인하사이클 동승 · 캐시 v4→v5 |
| `src/app/components/YieldCurveChart.tsx` (신규) | 만기 곡선 + 3개월 전 대비 |
| `src/app/components/YieldCurveAlertBanner.tsx` (신규) | 🔴 Red Alert — 대시보드·브리핑 |
| `src/app/components/BondCorrelationPanel.tsx` (신규) | 평상시 vs 발작기 상관 |
| `src/app/components/CutCycleHistory.tsx` (신규) | 인하 사이클 역사표 |
| `src/app/components/YccExplainer.tsx` (신규) | YCC 교육 + 일본 실데이터 |
| `src/app/components/BondsDashboard.tsx` | 위를 채권 페이지에 배치 |
