# 🔬 ETF 분산 대안 (ETF Alternative) — 옵션 A

## 목표
통합추천(unified-reco)·AI 리밸런싱(ai-rebalance)의 **각 개별주 추천에 "같은 섹터를 ETF로 분산 진입"하는 대안을 병기**한다. 개별주가 부담스러운 학생에게 내재 분산된 섹터 ETF 선택지를 준다.

## 원칙 (절대 불변)
- ⛔ **6축 점수·선정·정렬 절대 불변** — 개별주 채점 로직은 손대지 않는다. ETF는 **정보 배지/병기**로만 붙는다(타점 신호등·라쉬케 적용과 동일 원칙).
- 앱 철학 부합: ETF = 내재 분산 → "확정적으로 잃지 않게·분산·반-하이프"에 정확히 맞음. 사용자 ETF-first 선호 충족.
- 제2원칙: 합산 PEG는 X-Ray와 **동일 SSOT**로 계산(같은 종목=같은 값). 새로 계산하지 않는다.

## 각 개별주에 붙는 `etfAlt` (없으면 생략)
| 필드 | 내용 | 출처 |
|---|---|---|
| ticker·name | 시장 매칭 섹터 ETF (US주→US ETF / KR주→KR 프록시, KR 없으면 US 폴백+표기) | GICS→ETF 맵 |
| sectorLabel | 섹터 한글 라벨 | gicsSectorMeta |
| timing | 타점 배지(신호등·라쉬케·매물평단) | `entryTiming` SSOT 재사용 |
| blendedPeg·pegCoverage | 합산 PEG(구성종목 가중, 커버리지 40%↑만) | `etfLookThrough` SSOT(추출) |

## 매핑
- 개별주의 GICS `sector`(이미 아이템에 있음) → 광의 섹터 ETF. `SECTOR_TO_ROT`와 동일한 GICS 문자열 키.
- **정직 캐비엇**: 광의 섹터 ETF라 세부 업종과 다를 수 있음(예: NVDA[기술]→XLK는 메가테크 위주). "완벽 대응 아닌 섹터 분산 참고"로 UI 명시.

## SSOT 추출 (제2원칙)
1. **합산 PEG** → `portfolio-xray`의 Phase 4 로직을 `etfLookThrough.getBlendedPeg(ticker, market)`로 추출. portfolio-xray도 이 함수를 쓰도록 리팩터(값 불변 보장).
2. **GICS→섹터ETF 맵** → `etfAlternative.ts`에 정의(season-sector에 동일 데이터 있음 — 정적 티커라 저위험, 향후 통합 여지 context-notes에 기록).

## 성능
추천 최종 12종 → **(GICS섹터, 시장)로 dedup** → 유니크 ETF ~6~10개. 각 ETF 1회만 entryTiming(캔들)+합산PEG(topHoldings) 계산(동시성·캐시). 종목별 중복 계산 없음.

## 적용 범위
- **A-1**: unified-reco route → 아이템에 `etfAlt` 첨부 · `UnifiedReco.tsx` 카드에 "🔬 ETF 분산 대안" 행.
- **A-2**: ai-rebalance route 매수 후보(코어/위성)에 `etfAlt` 첨부 · 매수 카드에 병기.

## 검증
- 매핑 정확성(GICS 11 × US/KR 전수), 합산 PEG가 X-Ray와 동일값(제2원칙), 타점이 기술차트와 동일(SSOT), dedup 동작, 점수·순위 불변(before=after).
- `npm run check` 통과 → 배포.
