# 학생 간단 모드 2단계 구현 계획 — 홈 + 내 자산 보강

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 각 작업은 명세 검토 → 품질 검토를 거친다.

**Goal:** 캔버스 7판의 **홈**(오늘 시장·내 소식)을 `/s` 에 만들고, 내 자산에 **자산 성장 차트·이달 예상 배당**을 붙인다. 홈 검색에서 **보유하지 않은 종목**도 상세·기록으로 이어지게 한다.

**Architecture:** 판정·문구는 순수 lib(`homeBrief`·`cryptoFng`)로 뽑아 검증 스크립트로 고정한다. 홈 카드는 **각자 따로 불러온다**(한 카드가 느리거나 실패해도 나머지는 뜬다). 무거운 카드(리그·뉴스·자산 성장)는 **화면에 들어올 때** 부른다. 새 데이터 원천은 만들지 않는다 — 코인 공포·탐욕 기간값(1주·1달 전)만 같은 원천(alternative.me)에서 더 받는다.

**Tech:** Next.js 14 App Router · Supabase · 토큰(TK/FS/RAD/SP) · 차트는 Recharts(포트폴리오 관례) · 검증은 `scripts/verify-*.mjs`(실제 lib 컴파일 — `verify-treemap.mjs` 틀).

**설계 근거:** `plan.md`(확정 설계) · `context-notes.md` · Phase 0 실측(아래) · 캔버스 https://claude.ai/artifact/4THDHoK28RNSPeCjAcVvsa

---

## Phase 0 실측 (2026-09-26, 로그인 브라우저 · 개발 서버 · 동시 호출)

| 원천 | 응답 | 걸린 시간 | 쓰는 곳 |
|---|---|---|---|
| `/api/market-indices` (공개) | 배열 6: sp500·nasdaq·dowjones·nikkei·kospi·kosdaq — `value·changePct·updatedAt` | 5.3초 | 시황 1줄·지수 카드 |
| `/api/exchange-rate` (공개) | `rate` (등락 없음) | — | 시황 1줄 |
| `/api/stock-price` POST `[{BTC,CRYPTO}]` | `currentPrice·changePct`(업비트) | — | 비트코인 카드 |
| `/api/day-movers` (로그인) | `surges·drops[{held}]·checked·failed·threshold 5·asOf` — BTC 는 보유 아니어도 들어간다 | 8.4초 | 시황 2줄 |
| `/api/timing-watch` (로그인) | `{asOf, sigs[]}` — 크론 08:30 KST, 2일까지 옛 값 | — | 시황 2줄 |
| `/api/event-calendar` (로그인) | `events[{type earnings/exDiv/payDiv, date, dDay, ticker, name}]`·`monthly[{month,krw}]` — **거시 일정 없음** | 21.8초(콜드) | 시황 2·3줄·주요 일정·이달 배당 |
| `FOMC_SCHEDULE` (`src/lib/fomcSchedule.ts`) | 회의 성명 발표일 — FRB 출처, 연 1회 수동 | 0 | 시황 3줄·주요 일정 |
| `/api/cocktail-party` (공개) | `partyScore·prevClose·prev1Week·prev1Month·rating·source` — **source≠'cnn' 이면 가짜 50 가능** | 5.2초 | 공포·탐욕(미국 주식) |
| `/api/coin-lab` (공개) | `sentiment.fng·fngYesterday·fngClass` — **1주·1달 전 없음**(alternative.me `limit=2`) | 12.2초 · 100KB | → 새 `/api/coin-fng` |
| `/api/news-catalyst` (로그인) | `catalysts[{ticker,name,headlines[]}]` — **언론사·시각 없음**, Gemini(공개 데이터만) | 느림 | 내 종목 뉴스 |
| `FUNDS` (`src/lib/guru13f.ts`) | 거장 9인 이름·펀드·CIK — 파일이 `node:https` 를 import 해 브라우저에서 못 씀 | 0 | 거장 카드 |
| `/api/school-league` (로그인) | `students[{userId,isRegistered,totalReturn}]` — 순위는 클라이언트 계산, GET 이 `asset_role` 을 쓴다(기존 동작) | 19.5초 | 리그 한 줄 |
| `/api/monthly-pnl` POST | `points[{month,valueKrw,cumPnl}]` — **월말 단위**, 최근 36개월, `purchase_date` 필요 | 수십 초 | 자산 성장 차트 |

## 캔버스와 달라지는 것 (데이터가 없어서)

| 캔버스 | 구현 | 이유 |
|---|---|---|
| 주요 일정 "미국 개인소득·PCE", "고용보고서" | **FOMC + 내 종목 실적·배당만** | 앱에 CPI·PCE·고용 발표일 원천이 없다. 추가하려면 BLS·BEA 공식 일정을 확인해 넣어야 한다(**물어보고** — 새 숫자) |
| 내 종목 뉴스 "[언론사]·[시간]" | 제목 + 종목명만 | 뉴스 수집기가 RSS 의 언론사·시각을 버린다(분석 화면 쪽 수정은 범위 밖) |
| 자산 성장 "1달·6달·1년·전체" | **6달·1년·전체** | 원천이 월말 값뿐 — 1달은 점 1~2개 |
| 간편/분석 모드 스위치 | "분석 화면" 링크 | 모드 쿠키는 4단계 |
| 바로가기 5개(배당 달력·실적 일정 따로) | 4개 — **배당·실적 일정**(→ `/assets`)·거장(→ `/guru-portfolio`)·코인 랩(→ `/dashboard?tab=coinlab&cv=btc`)·부동산(→ `/real-estate`) | 배당·실적 일정은 같은 화면(`/assets` 의 일정 패널) |

## 지켜야 할 것

- 1단계 규칙 그대로: 토큰(신규 파일 hex·fontSize 숫자 금지) · 한국식 등락색 · `studentFormat` 로 숫자 표기 · **'없음'과 '못 가져옴'을 다른 문구로** · 학생에게 할 일을 시키지 않는다 · 코어/위성만.
- 모름(null)을 0 으로 쓰지 않는다: 신호 원천이 오늘 것이 아니면 "오늘 신호"라 쓰지 않는다 · `day-movers.failed > 0` 이면 "일부 확인 못 함" · CNN 이 아니면 미국 공포·탐욕 숫자를 보이지 않는다.
- 시각 의존 표시(장중/마감)는 **마운트 후에만** 계산(하이드레이션 사고 전례).
- 개인 데이터(보유·손익)를 공유 캐시·무료 LLM 으로 보내지 않는다. 새 라우트 `/api/coin-fng` 는 공개 데이터만.
- 캐시 키: `coin-lab` 응답이 바뀌지 않으면 키를 올리지 않는다(lib 추출만).

---

## Task 1: 코인 공포·탐욕 기간값 (`cryptoFng` lib + `/api/coin-fng`)

**Files:** Create `src/lib/cryptoFng.ts`, `src/app/api/coin-fng/route.ts`, `scripts/verify-crypto-fng.mjs` · Modify `src/app/api/coin-lab/route.ts`(같은 lib 로 호출 — 응답 필드 불변)

- `parseFng(json)` (순수): alternative.me `{data:[{value, value_classification, timestamp}]}` → `{ now, yesterday, weekAgo, monthAgo, cls, date }` (index 0·1·7·30, 없으면 null, `date` = data[0].timestamp(초) → KST 'YYYY-MM-DD'). 값이 숫자 아니면 null.
- `fetchCryptoFng(limit = 31)`: `https://api.alternative.me/fng/?limit=31&format=json`, `cache:'no-store'`, 8초 타임아웃, 실패 시 null.
- 라우트: `force-dynamic`, 모듈 메모리 1시간 캐시(성공만), `{ fng: CryptoFng | null, failed: boolean }`.
- coin-lab: 기존 `limit=2` 호출을 lib 로 바꾸되 `sentiment.fng·fngYesterday·fngClass` 값·형식을 그대로 — **응답 불변이면 캐시 키 유지**. 바뀌면 `coin-lab-v20` 과 reader 전수 범프.
- 검증: 정상 31개 → 0·1·7·30 · 5개뿐 → weekAgo·monthAgo null · 깨진 값 → null · 날짜 변환 KST.

## Task 2: 거장 목록을 브라우저에서 쓸 수 있게 (`guruFunds`)

**Files:** Create `src/lib/guruFunds.ts`(FUNDS 배열만, import 없음) · Modify `src/lib/guru13f.ts`(`export { FUNDS } from '@/lib/guruFunds'` 로 바꿔 기존 import 무손상)
- `git grep "FUNDS"` 로 사용처 전수 확인. `npm run check` 0.

## Task 3: 오늘의 한눈 시황 규칙 요약 (`homeBrief` lib)

**Files:** Create `src/lib/homeBrief.ts`, `scripts/verify-home-brief.mjs`

순수 함수 `buildHomeBrief(input, todayKst)` → `{ market: Line, mine: Line, upcoming: Line }`, `Line = { parts: Part[] }`, `Part = { text: string; tone?: 'up'|'down'|'flat'|'muted'|'warn' }`(색은 화면이 토큰으로).
- 입력(각각 null = 못 가져옴): `indices: {id, changePct}[] | null` · `usdKrw: number | null` · `signals: { asOf: string | null; count: number } | null` · `events: {type, dDay, name, ticker}[] | null` · `movers: { held: {name, changePct}[]; failed: number } | null` · `fomcNext: { date: string } | null`.
- **1줄(시장)**: `코스피 +0.9% · 코스닥 +1.0% · 원·달러 1,371원` — 지수가 null/빠지면 그 항목만 "못 가져옴".
- **2줄(내 종목)**: 신호 — `signals.asOf` 의 KST 날짜가 오늘이면 "오늘 신호 N건", 어제면 "어제 신호 N건", 그보다 오래되면 "신호 기록이 오래됐어요", null 이면 "신호 못 가져옴" · 실적 — `events` 중 earnings·dDay 0~7 개수 "실적 발표 7일 안 N건" · 움직임 — held ≥5% 종목명(최대 2개 + "외 N") 또는 "5% 넘게 움직인 종목 없음"; `failed > 0` 이면 "(일부 확인 못 함)".
- **3줄(다가오는 일정)**: FOMC 다음 회의(오늘 이후 첫 날짜) + 내 종목 실적 가장 가까운 1건, 날짜 `M/D`. 둘 다 없으면 "30일 안에 잡힌 일정이 없어요"(events 가 null 이면 "일정 못 가져옴").
- 검증: 신호 asOf 오늘/어제/3일 전/null · failed>0 · 지수 한 개 누락 · FOMC 지난 날짜 건너뜀 · 실적 8일 뒤는 2줄에서 제외·3줄엔 포함.

## Task 4: 홈 화면 `/s`

**Files:** Modify `src/app/s/page.tsx`(리다이렉트 → 홈) · Create `src/app/components/student/home/*`(카드별 파일) · `src/app/components/student/useJson.ts`(작은 fetch 훅: loading/ok/failed/unauth, 취소 가드, `enabled` 인자) · `useInView.ts`(IntersectionObserver, 한 번 보이면 true)

순서(캔버스 7판):
1. **인사** — `profiles.full_name`(본인 행) "반가워요, {이름}님" · 오른쪽 "분석 화면" 링크(`/dashboard`).
2. **검색창** — `/api/stock-search`(1단계 규칙: 300ms 디바운스·순서 역전 무시·실패/없음 구분). 결과 → `/s/stock/{ticker}?m={market}`.
3. **바로가기 4개** — 위 표의 경로. 아이콘+짧은 이름, 44px 이상.
4. **내 종목 평가금액 한 줄** — `useMyPortfolio` → `내 종목 평가금액 29,985,275원 · 오늘 +12,421원(0.0%)`, 누르면 `/s/assets`. 보유 0 이면 "첫 종목 기록하기".
5. **오늘의 한눈 시황** — `buildHomeBrief` 3줄 + "국내 장중/마감" 표시(마운트 후, KRX 09:00~15:30 평일) + "오늘의 매매 브리핑 전체 ›"(`/briefing`). 원천: market-indices · exchange-rate · timing-watch · event-calendar · day-movers · FOMC_SCHEDULE.
6. **지수 카드 3개** — 코스피·S&P 500(market-indices) · 비트코인(stock-price BTC). 값 + 등락색.
7. **공포·탐욕** — 탭 [코인 | 미국 주식]. 코인 = `/api/coin-fng`(지금·어제·1주 전·1달 전, 출처 "alternative.me · 기준일"). 미국 = `/api/cocktail-party`(source==='cnn' 일 때만 숫자, 아니면 "CNN 지수를 못 가져왔어요"; 출처 "CNN Fear & Greed"). 0~100 막대 + 구간 이름은 **원천이 준 분류를 번역만** 한다(alternative.me `value_classification`, CNN `rating`: extreme fear→극단 공포, fear→공포, neutral→중립, greed→탐욕, extreme greed→극단 탐욕). 두 원천의 구간 경계가 달라 우리가 임계값을 새로 정하지 않는다.
8. **주요 일정** — FOMC 다음 2회 + event-calendar 30일 안 실적·배당(내 종목 배지), 날짜순 최대 5개.
9. **내 종목 뉴스** (보이면 불러옴) — news-catalyst `headlines` 종목당 최대 2개, 최대 3종목. 제목만, "제목만 모았어요 · 자세히는 분석 화면" 링크(`/dashboard` 뉴스 탭은 딥링크 불가 → `/dashboard`).
10. **거장들의 포트폴리오** — `guruFunds` 앞 4명(이름·펀드) → `/guru-portfolio` · "더보기 ›".
11. **스쿨 리그 한 줄** (보이면 불러옴) — `isRegistered` 를 `totalReturn` 내림차순 → 내 `userId` 순위 `3위 / 6명 · +9.1%` → `/s/league`. 등록 안 됐으면 "리그는 종목을 기록하면 참여돼요".

각 카드: 로딩 한 줄 / 실패 "못 가져왔어요 · 다시" / 비어 있음 문구를 따로.

## Task 5: 보유하지 않은 종목 상세 + 검색에서 기록으로

**Files:** Modify `src/app/s/stock/[ticker]/page.tsx`, `src/app/s/record/page.tsx`
- 상세: 보유 목록에 없으면 `?m=` 시장으로 stock-price 를 직접 불러 **지금 가격·오늘 등락·가격 흐름**만 보이고, 보유·거래 섹션 대신 "아직 기록한 적 없는 종목이에요" + "이 종목 샀어요 — 기록하기"(`/s/record?ticker=…&m=…&n=이름`). `m` 이 없거나 잘못되면 "어느 시장 종목인지 몰라요 — 검색에서 다시 골라 주세요".
- 기록하기: `?ticker` 가 보유에 없고 `m`·`n` 이 있으면 `{ticker, name:n, market:m, currency: m==='US'?'USD':'KRW'}` 로 미리 고른다(매수 모드).

## Task 6: 내 자산 — 자산 성장 차트 + 이달 예상 배당

**Files:** Modify `src/app/components/student/useMyPortfolio.ts`(select 에 `purchase_date` 추가, 결과에 노출), `src/app/s/assets/page.tsx` · Create `src/app/components/student/GrowthChart.tsx`
- 성장 차트(보이면 불러옴): `/api/monthly-pnl` POST `{usdKrwNow, lots}`(dashboard 1107~1145 와 같은 입력). 선 2개 — 내 자산(`valueKrw`) · 넣은 돈(`valueKrw − cumPnl`). 범위 6달·1년·전체. `truncated` 면 "YYYY-MM 이전은 시세 이력이 없어 뺐어요". 실패/빈 값 구분. Recharts.
- 이달 예상 배당 줄: event-calendar `monthly` 중 이번 달 → "이달 남은 예상 배당금 N원 · 작년 배당 기준 추정" → `/assets`. 0 이면 "이달 남은 예상 배당 없음".
- 위치: 캔버스처럼 히트맵 아래 성장 차트, 종목 목록 앞 배당 줄.

## Task 7: 마무리

검증 스크립트 전부 · `check:build` · 375/768/1280 실측(홈·내 자산) · 선생님 화면 회귀 · 기록(checklist·context-notes·history) · 배포(main 병합·푸시 → 프로덕션 새 응답 확인).
