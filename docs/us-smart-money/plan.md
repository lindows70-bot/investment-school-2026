# 🇺🇸 미국 스마트머니 — 설계 (2026-09-19)

## 목적
**학생이 미국 시장에서 "큰돈이 지금 어디로 가나"를 볼 곳이 없다.** 사용자가 가져온 4개 보고서(내부자 매수·애널리스트 리레이팅·ETF 자금 흐름·유동성)는 각각 그 질문의 한 조각인데,
앱에는 그 조각들이 종목 상세(CEO의 장바구니·노이즈 캔슬러)·섹터 시계·매크로 날씨로 **흩어져 있고 시장 전체를 훑는 것은 하나도 없다.**
이게 해결되면 학생은 종목을 고르기 전에 "누가 사고 있나"를 먼저 보고, 관심종목을 그 목록에서 시작한다.
**메뉴 하나(`/us-smart-money`)·화면 하나·질문 넷** — 탭 없이 위에서 아래로(시장 → 섹터 → 회사). 이번 착수는 3번째 절 **내부자 매수 스캐너**만.

## 데이터 (Phase 0 실측 2026-09-19 — context-notes 판정표)
- ✅ SEC EDGAR 일별 인덱스 `daily-index/{Y}/QTR{n}/form.{YYYYMMDD}.idx` — 그날 전 제출 목록(0.6초). Form 4 하루 900~1,971건.
- ✅ 제출 원문 `Archives/{file}.txt` — XML 이 통째로 들어 있어 기존 파서(코드 P·취득 A) 그대로. 건당 11~25KB, PC 에서 7건/s 실패 0.
- ✅ 발행사 티커는 XML `<issuerTradingSymbol>` — CIK 맵 불필요.
- ⚠️ 단가가 각주로 넘어가 비는 건이 있다(표본 1/40) → 금액 '미상'으로 분리, 0 으로 넣지 않는다.
- ❌ 기관 수급(13F 실시간)·TipRanks 승률 — 무료 소스 없음 → 표시하지 않는다.
- 재사용: `getInsiderSignal.ts` 의 SEC 유틸·Form 4 파서(→ `lib/secForm4.ts` 로 추출), Yahoo quoteSummary(시총·52주 저가·EPS 리비전·섹터), `gicsSectorMeta`, `analystShared.revisionSignalOf`.
- 저장: 새 테이블 없이 `app_cache` 일별 문서 `insider-day-v1:{YYYYMMDD}`(그날 P 매수 + 처리한 accession 집합). 30일 = 30키.

## 계산 (결정론 · `src/lib/insiderMarket.ts`)
보고서의 3필터를 그대로. **임계값은 보고서 값이며 우리 백테스트로 검증된 수치가 아니다** — 화면에 그렇게 적는다.
1. 질: 코드 P·취득 A 만(옵션·RSU 는 코드가 다르다). 종목 30일 합계 **$100K 이상** 또는 **시총의 0.1% 이상**(스몰캡 구제).
2. 클러스터: 서로 다른 내부자 **2인 이상** 최우선. 현재가가 52주 저가 대비 **+15% 이내**면 '저점 매수' 표시.
3. 컨버전스: EPS 추정치 상향 신호(`revisionSignalOf` = 노이즈 캔슬러와 같은 규칙) → '추정치 상향' 표시.
- 리스크: 트레일링 EPS < 0 → ⚠️ 적자 표시(같은 목록 안, 숨기지 않음).
- 순위: 클러스터 인원 → 시총 대비 비중 → 금액. 상위 7 펼침, 나머지 접힘.
- 답 한 줄·섹터 집계는 수치 문장(LLM 없음).

## 정직 캐비엇 (UI)
"내부자 매수는 통계적으로 우위가 보고된 지표지만 **우리 표본으로 검증된 것은 아니다** · 매도 신호 없음(파는 이유는 수만 가지) · 기관 수급은 무료 데이터가 없어 보지 않는다 · 단가 미상 건은 금액 합계에서 빠져 있다".

## 구현
- `src/lib/secForm4.ts` — SEC GET(https·gzip·재시도)·`parseForm4Xml`·일별 인덱스 파서 (getInsiderSignal 이 import)
- `src/lib/analystShared.ts` — `revisionSignalOf(up, down)` (getAnalystSignal 이 import)
- `src/lib/insiderMarket.ts` — 일별 스캔(커서=처리 accession 집합, 회당 예산) · 30일 집계·필터·보강 · 키 `INSIDER_DAY_KEY`·`INSIDER_MARKET_KEY`·`INSIDER_SCAN_MARK`
- `/api/cron/insider-scan` 매시간(예산 600건 · 최근 2일 + 미완료 날) · `/api/insider-market` 집계(06:50 KST 크론, 12h 캐시, refresh=1 마커)
- `/us-smart-money` 화면 + 사이드바(🌍 시장 탐구) · cronHealth 2줄 · `scripts/insider-backfill.mjs`(30일 초기 적재, PC)
- 성적 적립은 **이번엔 안 한다** — 표본이 쌓인 뒤 스윙과 같은 관례로 붙인다(체크리스트에 남김).
