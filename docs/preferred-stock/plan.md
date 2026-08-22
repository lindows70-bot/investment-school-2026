# 🏛️ 우선주(Preferred) 축 — 설계 (2026-08-22)

## 목적

Strategy(MSTR) 우선주 4종(STRC·STRK·STRF·STRD)이 배당 익스플로러 검색으로는 나오는데
**보통주 배당 잣대로 채점**되고 있었다. 같은 발행사 4종에 안전등급이 보통/보통/보통/위험으로 갈렸고,
그 원인은 리스크가 아니라 야후 `sharesOutstanding` 오염이었다(→ `context-notes.md`).

학생이 얻어야 할 결정: **"이건 주식이 아니라 채권에 가까운 것이고, 위험은 발행사 신용(=비트코인)에 달려 있다."**

## 데이터 (Phase 0 실측 결과)

- ✅ `price.shortName`(시리즈·쿠폰) · `price.longName`(발행사) · `price.quoteType` · `price.marketCap` · 배당 지급 이력
- ❌ `sharesOutstanding`(발행사 값 혼입) · `payoutRatio`·`freeCashflow`(시리즈 단위로 의미 없음) · 액면가(야후 미제공 → 파생)
- 재사용: `dividendProfile.ts` SSOT 그대로 — 배당률·주기·지급월 계산은 우선주에서도 정확했다(실측 확인).

## 계산 (결정론)

```
액면 추정      = 연배당금 ÷ 쿠폰율            (STRK 8 ÷ 0.08 = $100 — 실측 일치)
액면 대비 괴리 = (현재가 ÷ 액면추정 − 1) × 100
경보           = 배당률 ≥8% || 괴리 ≤ −10% || 변동금리
```

우선주로 판정되면 **해당 없는 축은 계산하지 않는다** — `fcfCover`·`payoutRatio`·`consecutiveYears`·
`dividendGrade`·`dividendGrowth5y/1y`·`yoc5y/10y`·`style`·`safetyScore/Grade` 전부 `null`.
값을 지우는 게 아니라, **애초에 그 축이 존재하지 않는 상품**이라 화면이 '해당 없음'이라고 말할 수 있게 하는 것이다.

## 정직 캐비엇 (UI 명시)

- 액면은 **추정**(원문 파생) — 야후가 액면가를 주지 않는다.
- 안전성 점수 없음 — 우선주 신용은 발행사 재무로 판단해야 하고, 우리 엔진엔 그 축이 없다.
- 시리즈 표기는 야후 `shortName` 32자 절단으로 STRF/STRD 가 동일 문자열이 된다(쿠폰율은 파싱 가능).

## 구현

| 파일 | 역할 |
|---|---|
| `src/lib/preferredStock.ts` (신규) | 판정 SSOT — 순수 함수·의존성 0 |
| `src/lib/dividendProfile.ts` | `preferred` 필드 추가 + 해당 없는 축 null 분기 · 경보 문구 분기 |
| `src/lib/ultraDividendUniverse.ts` | `preferred` 티어 신설 + 4종 등재 |
| `src/app/components/DividendExplorer.tsx` | `PreferredPanel`(성장 패널 대체) + 배지 + 경보 문구 분기 |
| `src/app/components/DividendIncomeLab.tsx` | 신규 티어 색상 |

**캐시**: `DIV_PROFILE_KEY` v8→v9(필드 추가 = 옛 응답이면 `preferred` 가 undefined) · `ultra-dividend` v3→v4.
reader 전수: `dividend-explorer`(writer) · `dividend-portfolio` · `ultra-dividend` — 셋 다 SSOT 상수를 쓰므로 자동 반영.
