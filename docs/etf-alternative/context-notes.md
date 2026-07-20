# ETF 분산 대안 — 컨텍스트 노트

## 설계 결정
- **점수 체계 불변**: ETF를 6축 채점에 넣지 않는다(ETF는 자체 PEG/EPS/ROE 없음 → 억지로 넣으면 가짜 지표·점수 비교성 붕괴). 개별주 추천의 **분산 대안 배지**로만 병기 = 옵션 A. (옵션 B=ETF 정식 편입은 점수 비교성 문제로 기각)
- **왜 광의 GICS 섹터 ETF인가**: unified-reco 아이템은 GICS `sector`(11개)만 가짐(세부 industry 없음). 그래서 광의 섹터 ETF로 매핑. 세부 소섹터 ETF(SOXX 등)를 쓰려면 스크리너가 Yahoo industry를 실어야 함 → 향후 확장 여지(v2). 현재는 광의 섹터 + 정직 캐비엇.
- **시장 매칭**: US주→US 섹터 ETF, KR주→KR 프록시 ETF. KR 프록시 없는 섹터(유틸리티 등)는 US ETF 폴백 + "국내 대응 ETF 없음" 표기(정직).

## SSOT (제2원칙)
- **합산 PEG**: `portfolio-xray` Phase 4(구성종목 canonical PEG 가중평균·커버리지 40%↑)를 `etfLookThrough.getBlendedPeg`로 추출 → X-Ray와 etfAlternative가 **동일 함수** 사용. "같은 ETF = 같은 합산 PEG" 보장.
- **타점**: `entryTiming` SSOT 그대로 재사용(기술차트·신호등·라쉬케와 동일). ETF도 캔들 있으면 동일 판정.
- **GICS→ETF 맵 중복(정직 기록)**: season-sector route에 동일 US_ETF/KR_ETF 데이터가 있음. 정적 티커 리스트(계산값 아님·변동 드묾)라 저위험이라 판단, 이번엔 `etfAlternative.ts`에 별도 정의하고 season-sector는 미변경. 향후 gicsSectorMeta로 단일화 여지(계산 지표가 아니라 제2원칙 위험도 낮음). ⚠️ 티커 수정 시 두 곳 동기화 필요.

## 성능
- dedup 키 = `${gicsSector}:${market}`. 최종 12종 → 유니크 ETF ~6~10. entryTiming 배치(동시성)+합산PEG(topHoldings, 캐시). 종목별 중복 계산 없음.
- 합산 PEG는 best-effort: topHoldings 실패/커버리지<40%면 null(타점·ETF명은 유지). graceful.

## 캐비엇 (UI 명시)
- 광의 섹터 ETF라 세부 업종과 다를 수 있음(NVDA[기술]→XLK 메가테크 위주).
- KR 프록시 ETF는 완전 GICS 아님(반도체=기술 프록시 등).
- ETF는 분산 참고 선택지 — 개별주 추천 점수를 대체·변경하지 않음.
