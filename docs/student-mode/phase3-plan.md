# 학생 간단 모드 3단계 구현 계획 — 리그 · 배우기

> **For agentic workers:** superpowers:subagent-driven-development. 작업마다 명세 검토 → 품질 검토.

**Goal:** 캔버스 7판의 **리그**(`/s/league`)와 **배우기**(`/s/learn`)를 만든다. 지금은 둘 다 '준비 중' 화면이다.

**원칙(1·2단계와 같다):** 토큰만 · 한국식 등락색 · `studentFormat` · '없음'과 '못 가져옴'을 다른 문구로 · 학생에게 할 일을 시키지 않는다(답을 알려준다) · 코어/위성만 · 출처 없는 숫자 금지 · 개인 데이터를 공유 캐시·무료 LLM 으로 보내지 않는다.

## Phase 0 실측 (2026-09-26, 탐색 에이전트 — 코드 읽기)

| 필요 | 있나 | 원천 · 한계 |
|---|---|---|
| 리그 순위·수익률 | ✅ | `/api/school-league`(로그인) `students[{userId,name,isRegistered,totalReturn,realizedPp,coreRatio,topStocks(이름 3),holdingCount}]` · 8~20초 · 순위는 클라이언트 계산 |
| 수익률 계산식 | ✅ | `realizedPnl.ts:93-102` — (평가손익 + 매도로 확정한 손익) ÷ (지금 원금 + 판 종목 원금). 보유 달러 종목은 원금·평가를 같은 현재 환율로(환차익 미포함) · 시세 없으면 매수가(0%) |
| 친구 종목 **비중** | ❌ | 라우트가 종목별 평가액을 계산하고 버린다 → **상위 3종목 비중 + 기타**만 추가(금액 없음) |
| 친구 '특징' | 부분 | 섹터 SSOT 가 없다(5가지가 서로 다름). **국가(`flagOf`) × 자산 종류(`getAssetType`)** 로만 묶는다("한국 주식 34% · 미국 상장 ETF 22% · 코인 18%" — ETF 는 상장 시장만 말한다) |
| 명언 | ✅ 문서 | `docs/student-mode/quotes.md` 51개(원문 확인) → 코드 상수 없음 |
| ① PER 대 업종 | 부분 | 내 PER = `/api/stock-info` `fundamentals.pe`(KR 은 **직전 결산 연도** PER). **업종 평균 PER 없음** → `getSectorPeers` 가 이미 받는 동종 기업 PER 로 **중앙값**을 더한다(주로 미국, KR 은 동종 자료가 드묾 → 내 PER 설명만) |
| ② 산 뒤 수익 대 지수 | 부분 | 지수 캔들 `/api/tech-chart?ticker=^KS11|^GSPC&market=US&tf=D|W`(공개). `purchase_date` 는 **첫 매수일**이라 나눠 산 종목은 비교가 틀린다 → **한 번만 사고 판 적 없는 종목**만 |
| ③ 실적·배당 일정 | ✅ | `/api/event-calendar` — 날짜로 거른다 · KR 실적일은 대개 없음 · 배당 달은 배당락 달 |
| ④ 크게 움직인 종목 + 뉴스 | 부분 | `/api/day-movers`(held) + `/api/news-catalyst` `headlines`(제목만 · **그날 것 보장 없음**) → "최근 뉴스 제목"이라고 쓴다 |
| 매매 브리핑 한 줄 | ✅ | `buildHomeBrief(...).mine` 재사용 |
| 링크 | ✅ | 아카데미 `/investment-academy` · 최일 전략 `/master-strategy` · 주간 리포트 `/weekly-report` · 스쿨 라운지 `/school-lounge` · 더 알아보기 5묶음(아래) |

더 알아보기: 종목 분석(`/research`·`/earnings-reports`·`/tech-chart`·`/valuation`) · 종목 추천(`/reco-hub`·`/hi52-radar`·`/dashboard?tab=rotation`) · 시장·경제 흐름(`/macro-hub`·`/us-smart-money`) · 배당·채권·코인(`/dividend`·`/bonds`·`/dashboard?tab=coinlab&cv=btc`) · 부동산(`/real-estate`·`/real-estate/honeycomb`·`/real-estate/apt`).

## 캔버스와 달라지는 것

| 캔버스 | 구현 | 이유 |
|---|---|---|
| '왜 수익률이 달랐을까' — "한국 반도체·미국 기술주" | "한국 주식·미국 상장 ETF·코인" (국가 × 자산 종류, ETF 는 상장 시장) | 섹터를 한 가지로 정하는 SSOT 가 없다 |
| 친구 포트폴리오 종목 비중 | 상위 3종목 + 기타 | 금액 없이 비중만 · 노출 최소 |
| ① 업종 평균 PER | 동종 기업 PER **중앙값**(있을 때만) | 앱에 업종 평균 PER 원천이 없다 |
| ④ "그날 뉴스" | "최근 뉴스 제목" | 수집기가 시각을 버린다 |
| 폰 홈 화면에 추가 | 4단계 | PWA 는 4단계 |

## Task 1: 명언 상수 (`src/lib/quotes.ts`)
quotes.md 51개를 **글자 그대로** 옮긴다: `{ id, person, ko, original, source }`. `quoteOfDay(todayKst)` = 날짜 기반 순환(같은 날 같은 명언). B22 는 "그레이엄의 말을 버핏이 인용"으로 표시. 검증: 51개·id 중복 없음·제외 목록 문구 없음·같은 날 같은 결과·연속 51일 전부 다름.

## Task 2: 리그 응답에 상위 3종목 비중 (`/api/school-league`)
**1~3위와 본인만**(노출 최소 — 검토 반영) `topHoldings: { name, ticker, market, assetType, weightPct }[]`(평가액 상위 3) + `otherPct` + `pricedAll: boolean` 을 **추가**(기존 필드 불변 · 캐시 없음 · 금액 없음). 비중은 이 라우트가 이미 계산하는 평가액 ÷ 합계. 티커별로 합친 뒤 계산.

## Task 3: `/s/league`
내 순위 카드("3위 / 6명 · +9.1% · 2위와 1.4%p 차이") · ? 도움말(계산식 · 넣은 시점 미반영 · 시세 없으면 매수가 · 달러 환차익 미반영) · 순위표(등록·수익률 있는 학생, 나 강조) · 친구 포트폴리오(1·2위: 종목 수·코어:위성·상위 3 + 기타·'특징' = 국가×자산 종류 합산) · "아직 종목을 안 넣은 친구 N명". 홈 리그 한 줄 링크를 `/s/league` 로.

## Task 4: 오늘 알려드려요 규칙 (`src/lib/learnTips.ts`)
순수 함수 `pickTip(todayKst, inputs)` — 날짜로 규칙 ①~④ 순서를 돌리고, 그 규칙에 쓸 데이터가 없으면 다음 규칙. 각 규칙은 문장 + 숫자 + 출처·기준일을 돌려준다. 검증 스크립트.
- ① "{종목} PER 은 {x}배예요" + 뜻 한 줄 + (중앙값 있으면) "동종 기업 {n}곳 중앙값 {y}배보다 낮아서/높아서 …"
- ② "{종목}은 산 뒤 {a}%, 같은 기간 {지수}는 {b}%" — 한 번만 사고 판 적 없는 종목만
- ③ "{M/D} {종목} 실적 발표/배당락" — 30일 안
- ④ "{종목} 오늘 {±x}%" + 최근 뉴스 제목 1개

## Task 5: `/s/learn`
오늘의 명언 · 오늘 알려드려요(Task 4) · 오늘의 매매 브리핑 한 줄(`homeBrief.mine` + `/briefing` 링크) · 투자 아카데미 4 · 더 알아보기 5묶음(분석 화면으로 열림 안내).

## Task 6: 마무리
검증 스크립트 전부 · `check:build` · 화면 실측(크롬 · 3100 build-check) · 기록 · 배포.

## 범위 밖(따로 알림)
- `/api/school-league` GET 이 `asset_role` 을 `classifyAsset` 으로 **덮어쓴다**(수동 코어/위성 선택이 되돌아감) — 기존 동작, 별도 작업.
- `analysis/page.tsx:873-877` 의 버핏 "Rule No.1" 은 quotes.md 가 **원문 미확인으로 제외**한 문구 — 별도 작업.
