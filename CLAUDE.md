# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-06-04

## 프로젝트 개요

Next.js 14 (App Router) + Supabase + Tailwind CSS + TypeScript 로 구축한
**투자학교 학생 포트폴리오 관리 & 투자 교육 플랫폼**.

- 학생들이 자신의 보유 자산을 등록·추적하고 수익률을 확인
- 피터 린치·워렌 버핏 철학 기반 투자 분석 도구 제공
- 최일 선생님의 매크로 전략 브리핑 및 투자 교육 콘텐츠 제공
- 실시간 주가·환율·매크로 데이터 시각화
- **CME FedWatch + FRED API 기반 거시경제 대시보드**
- **🎯 비밀병기 12대 킬러 기능 (Zero Input AI 분석, 아래 로드맵) — 전체 완성 + 🏛️ 국민연금 대시보드**

---

## 🎯 비밀병기(Secret Weapon) 12대 킬러 기능 — 로드맵 & 현황 (전체 ✅ 완성)

> **공통 철학**: ① Zero Cost(무료 공개데이터·무료 AI) ② Lazy Caching(조회 시 1회 수집·캐시) ③ Zero Input(학생 입력 0, 자동 분석) ④ 피터 린치 페르소나
> **공통 가드**: 전부 **개별 주식(STOCK)만** — ETF·코인·원자재는 `getAssetType` SSOT로 차단

| # | 기능 | 위치 | 데이터원 | 상태 |
|---|------|------|---------|------|
| 1 | ⚖️ 포트폴리오 황금비율 로드맵 | 대시보드 | investments(DB) | ✅ |
| 2 | 👻 타임머신 복기 노트 | 거래기록 | transactions 스냅샷 | ✅ |
| 3 | 🍸 시장 칵테일 파티 지수 | 대시보드(거시) | CNN F&G + VIX/S&P | ✅ |
| 4 | 🤖 Jarvis 어닝콜 애널리스트 | 리서치 | Yahoo RSS + Gemini | ✅ |
| 5 | 🕵️ CEO의 장바구니(내부자 매수) | 리서치 | SEC EDGAR + DART(KR) | ✅ |
| 6 | 🌤️ 13분 날씨예보(매크로) | 대시보드(거시) | FRED | ✅ |
| 7 | 🎧 Jarvis 노이즈 캔슬러(애널리스트) | 리서치 | Yahoo + 네이버(KR) | ✅ |
| 8 | ⏳ 좀비 생존 타이머(현금 런웨이) | 리서치 | stock-info DCF값 재사용 | ✅ |
| 9 | ⚔️ 섹터 피어 X-Ray | 리서치 | Yahoo peers + 지표 | ✅ |
| 10 | 🐳 슈퍼 클론(13F 추적) | 리서치 | 美 SEC 13F-HR(전설9인) + 韓 DART 최대주주 | ✅ |
| 11 | 🏰 해자 붕괴 경보기 | 리서치 | Yahoo fundamentalsTimeSeries(총마진 추세) | ✅ |
| 12 | 📊 글로벌 페어-트레이딩 시그널 | 리서치 | Yahoo 일봉 P/S 비율 z-score(US앵커↔KR피어) | ✅ |

> 🎉 **비밀병기 12대 로드맵 전체 완성(2026-06)**
> 추가: **피터린치 진단 위저드 STEP 2 자동화**, **한국 종목 확장**(④⑤⑦⑩ KR), **Jarvis 모닝 처방전**, **학교 13F 인덱스**, **국민연금 대시보드**, **PEG SSOT 통일**, **전체 앱 가독성 개선** 완료.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14.2 (App Router, `'use client'` 위주) |
| DB / Auth | Supabase (PostgreSQL + RLS + Auth) |
| 스타일링 | Tailwind CSS (다크 모드 전용, inline style 혼용) |
| 차트 | Recharts (포트폴리오·분석), lightweight-charts (금융 캔들 TradingView OSS) |
| 지도 | react-simple-maps (글로벌 매크로 히트맵) |
| 아이콘 | lucide-react |
| 애니메이션 | framer-motion |
| 유틸 | tailwind-merge, clsx, date-fns, yahoo-finance2 |
| 외부 API | FRED API (거시경제), CME FF Futures via Yahoo Finance |
| 배포 | Vercel (region: icn1, Seoul) |

---

## 디렉토리 구조 (실제)

```
src/
├── app/
│   ├── page.tsx                        # / → /dashboard 리다이렉트
│   ├── layout.tsx                      # 루트 레이아웃 (SidebarLayout + IdleTimer)
│   ├── login/page.tsx                  # 로그인 + 회원가입 + 비밀번호 재설정 (PASSWORD_RECOVERY 처리)
│   ├── signup/page.tsx                 # /signup → /login?tab=signup 리다이렉트
│   │
│   ├── dashboard/page.tsx              # 대시보드 (메인 홈) — 거시경제 탭 포함
│   ├── assets/page.tsx                 # 자산 관리 (평단가 차트 연동)
│   ├── history/page.tsx                # 거래 기록 & 현금흐름
│   ├── analysis/page.tsx               # 투자 전략 분석 (피터린치 + 워렌버핏)
│   ├── valuation/page.tsx              # 최일 가치분석 터미널
│   ├── research/page.tsx               # 종목 리서치 (캔들 차트 + 피터린치 진단 위저드)
│   ├── watchlist/page.tsx              # 관심 종목
│   ├── admin/page.tsx                  # 관리자 (teacher 전용) — 비밀번호 재설정 기능 추가
│   ├── master-strategy/page.tsx        # 최일 전략 브리핑 (Core/Satellite)
│   ├── investment-academy/page.tsx     # 투자 아카데미 (교육 콘텐츠)
│   ├── school-lounge/page.tsx          # 스쿨 라운지 (커뮤니티 게시판)
│   ├── school-league/page.tsx          # 스쿨 리그 대시보드
│   ├── macro-hub/page.tsx              # 매크로 허브 (3탭: 글로벌매크로·채권·스트레스테스트)
│   │
│   ├── api/
│   │   ├── stock-price/route.ts        # GET·POST 주가 조회 (KR·US·CRYPTO)
│   │   ├── stock-info/route.ts         # GET 종목 상세정보 (PE·PEG·EPS·배당 등)
│   │   ├── stock-price-history/route.ts # 5년 연간 주가 이력
│   │   ├── market-indices/route.ts     # GET 글로벌 시장 지수
│   │   ├── exchange-rate/route.ts      # GET 환율 (USD/KRW)
│   │   ├── macro-data/route.ts         # GET 매크로 데이터
│   │   ├── financials/route.ts         # GET 재무제표 (FMP US + DART KR) — EPS 이력 포함
│   │   ├── lynch-classify/route.ts     # GET 피터린치 종목 자동 분류
│   │   ├── lynch-batch/route.ts        # POST 미분류 종목 일괄 분류
│   │   ├── lynch-eps-history/route.ts  # ★ Phase 3 EPS 분기 이력 배치 (NEW)
│   │   ├── macro-fundamentals/route.ts # ★ Phase 2 재무 기초 데이터 배치 (NEW)
│   │   ├── fred/route.ts               # ★ FRED API 프록시 (인플레이션·금리·QT)
│   │   ├── fedwatch/route.ts           # ★ CME FedWatch FF Futures 확률 계산
│   │   ├── cocktail-party/route.ts     # 🍸 비밀병기3 시장 칵테일 파티 지수 (CNN F&G + VIX/S&P, 1h캐시)
│   │   ├── macro-weather/route.ts      # 🌤️ 비밀병기6 13분 날씨예보 (FRED 순유동성·HY스프레드, 12h캐시)
│   │   ├── shadow-13f/route.ts         # 🐳 비밀병기10 슈퍼 클론 (美 전설9인 SEC 13F + 韓 DART, 12h캐시, maxDuration:45)
│   │   ├── nps-portfolio/route.ts      # 🏛️ 국민연금 자산현황 (국내 5%룰+해외 13F+자산배분, force-dynamic·24h캐시·maxDuration:60)
│   │   ├── school-index/route.ts       # 🏫 학교 13F 인덱스 최신 스냅샷 서빙 (service role, RLS 무관)
│   │   ├── cron/morning-briefing/route.ts  # 🤖 Jarvis 모닝 처방전 Cron (매일 05:00 KST, maxDuration:300)
│   │   ├── cron/school-index/route.ts  # 🏫 학교 13F 인덱스 Cron (매일 04:00 KST, maxDuration:120)
│   │   ├── correlation-matrix/route.ts # 📐 상관관계 매트릭스 API (Supabase auth, 24h 개인 캐시, maxDuration:60)
│   │   ├── guidance-radar/route.ts     # 📡 가이던스 모멘텀 레이더 (earningsTrend+스냅샷 적립, 24h 캐시, maxDuration:60)
│   │   ├── dividend-explorer/route.ts  # 💰 배당 익스플로러 (US+KR+ETF, Naver ETF 폴백, 48h 캐시, maxDuration:30)
│   │   ├── lynch-earnings-tracer/route.ts # 📈 린치 이익선 트레이서 (financials 재사용+Yahoo chart, 48h, maxDuration:45)
│   │   ├── v1/portfolio/realtime/route.ts       # Phase 3 EPS 데이터 (MOCK→SSOT)
│   │   ├── v1/market/realtime-portfolio/route.ts # DashboardContainer용 (MOCK)
│   │   ├── school-league/route.ts      # GET 스쿨 리그 집계 (service_role)
│   │   ├── migrate-asset-roles/route.ts # POST asset_role 전체 소급 정정
│   │   └── admin/delete-user/route.ts  # POST 학생 계정 삭제 (teacher 전용)
│   │
│   ├── actions/                        # ★ 서버 액션 ('use server') — 비밀병기 4·5·7 + 위저드 자동진단
│   │   ├── getEarningsInsight.ts       # 🤖 비밀병기4 Jarvis 어닝콜 (RSS+Gemini, US/KR)
│   │   ├── getInsiderSignal.ts         # 🕵️ 비밀병기5 CEO의 장바구니 (EDGAR US + DART KR)
│   │   ├── getAnalystSignal.ts         # 🎧 비밀병기7 노이즈 캔슬러 (Yahoo US + 네이버 KR)
│   │   ├── getQualitativeChecks.ts     # 🧠 위저드 STEP2 자동 정성진단 (내부자·애널 실데이터 + Gemini)
│   │   ├── getSectorPeers.ts           # ⚔️ 비밀병기9 섹터 피어 X-Ray (글로벌 GICS 큐레이션 맵, 6h캐시)
│   │   ├── getMoatBreach.ts            # 🏰 비밀병기11 해자 붕괴 경보기 (Yahoo fundamentalsTimeSeries 총마진추세, 6h캐시)
│   │   └── getPairSignal.ts            # 📊 비밀병기12 글로벌 페어-트레이딩 (일봉 P/S 비율 z-score, 6h캐시)
│   │
│   └── components/
│       ├── AddInvestmentModal.tsx      # 종목 추가·수정 모달
│       ├── TransactionModal.tsx        # 추가매수·매도 모달
│       ├── TenbaggerRadar.tsx          # ★ 피터 린치 텐배거 마일스톤 트래커 (동적 포트폴리오 기반)
│       ├── MacroDashboard.tsx          # ★ 거시경제 Fed Watch 오케스트레이터
│       ├── LynchEarningsChart.tsx      # 피터 린치 이익선 차트 (FRED 적자구간 처리)
│       ├── LynchSellSignalPanel.tsx    # 매도 시그널 패널
│       ├── LynchGhostStockPanel.tsx    # 유령 종목 추적기
│       ├── EarningsAlertTerminal.tsx   # ★ 어닝 터미널 — G 리비전 추적기 + PEG 알럿
│       ├── ShareholderYieldTerminal.tsx # ★ 주주환원율 터미널 — 배당+자사주 총환원율 (NEW)
│       ├── LynchValuationEngine.tsx    # ★ 린치 밸류에이션 — 6대 분류별 가치평가 엔진 (NEW)
│       ├── LeverageRiskSimulator.tsx   # ★ 레버리지 위험 시뮬레이터 — 음의 복리 교육 (NEW)
│       ├── BuffettAnalysisPanel.tsx    # ★ 워렌버핏 DCF 내재가치 분석기 (포트폴리오 연동) (NEW)
│       ├── CocktailPartyGauge.tsx      # 🍸 비밀병기3 칵테일 파티 지수 게이지 (CNN 스타일 반원 + VIX 차트)
│       ├── MacroWeather.tsx            # 🌤️ 비밀병기6 매크로 날씨예보 배너 (상시 펼침 + 폭풍우 교차경고)
│       ├── JarvisInsight.tsx           # 🤖 비밀병기4 어닝콜 애널리스트 (린치 3섹션 + 감성점수)
│       ├── InsiderReceipt.tsx          # 🕵️ 비밀병기5 황금 영수증 (클러스터 사이렌, USD/KRW)
│       ├── NoiseCanceller.tsx          # 🎧 비밀병기7 노이즈 캔슬러 (3신호 카드, US/KR 분기)
│       ├── LynchWizard.tsx             # 🧠 피터린치 진단 위저드 (STEP2 AI 자동 정성진단)
│       ├── TimeMachineNote.tsx         # 👻 비밀병기2 타임머신 복기 노트 (매도 스냅샷 vs 현재가)
│       ├── PortfolioBalanceRadar.tsx   # ⚖️ 비밀병기1 황금비율 로드맵 (6대 분류 레이더 + 분류별 보유종목 목록)
│       ├── CashRunwayTimer.tsx         # ⏳ 비밀병기8 좀비 생존 타이머 (ROE 4분면 + 유상증자 경보)
│       ├── SectorPeerXray.tsx          # ⚔️ 비밀병기9 섹터 피어 X-Ray (글로벌 GICS 동종 상대평가)
│       ├── ShadowTracker13F.tsx        # 🐳 비밀병기10 슈퍼 클론 (美 13F 전설9인 + 韓 DART 최대주주)
│       ├── MoatBreachDetector.tsx      # 🏰 비밀병기11 해자 붕괴 경보기 (4개년 총마진 추세)
│       ├── PairTradingMonitor.tsx      # 📊 비밀병기12 글로벌 페어-트레이딩 모니터 (기관 터미널 + z-게이지)
│       ├── NpsPortfolio.tsx            # 🏛️ 국민연금 자산현황 대시보드 (국내 5%룰 + 해외 13F + 자산배분)
│       ├── JarvisMorningBriefing.tsx   # 🤖 Jarvis 모닝 처방전 UI (대시보드 live탭 팝업모달) (NEW)
│       ├── SchoolIndexDashboard.tsx    # 🏫 투자학교 13F 인덱스 UI (파이·TopPicks·스마트머니 · 리서치탭) (NEW)
│       ├── CorrelationMatrix.tsx       # 📐 포트폴리오 상관관계 매트릭스 (피어슨 r 히트맵 · 가짜분산 경고) (NEW)
│       ├── GuidanceRevisionRadar.tsx   # 📡 가이던스 수정 모멘텀 레이더 (EPS 컨센서스 기울기 · 샴쌍둥이 하이라이트) (NEW)
│       ├── DividendExplorer.tsx        # 💰 글로벌 배당 익스플로러 & Safety Guard (프리셋 탭·함정 경보·파생 ETF 플래그) (NEW)
│       ├── GuidanceRevisionRadar.tsx   # 📡 가이던스 수정 모멘텀 레이더 (EPS 컨센서스 기울기 스캐닝) (NEW)
│       ├── LynchEarningsLineTracer.tsx # 📈 린치 이익선 트레이서 (역사적 EPS×15 이격도 추적) (NEW)
│       ├── ErrorBoundary.tsx           # ★ React 렌더링 에러 차단막 (탭별 격리) (NEW)
│       ├── ChangePasswordBanner.tsx    # 임시 비번 로그인 시 변경 안내 배너
│       ├── AIPortfolioDashboard.tsx    # AI 멘토 족집게 (PEG 분석, 적자기업 표시)
│       ├── FullCandleChart.tsx         # 풀 캔들 차트 (평단가 기준선 포함)
│       ├── CandleChart.tsx             # 기본 캔들 차트
│       ├── IdleTimer.tsx               # 비활성 30분 자동 로그아웃
│       ├── macro/
│       │   ├── MacroTerminalDashboard.tsx  # ★ Phase 1·2·3 오케스트레이터 (SSOT)
│       │   ├── InflationChart.tsx          # ★ FRED 실시간 PCE·EFFR 차트
│       │   ├── DotPlotPanel.tsx            # ★ CME FedWatch 버블차트 + 해설
│       │   ├── BalanceSheetChart.tsx       # ★ FRED 연준 대차대조표 QT 차트
│       │   ├── MacroStressTester.tsx       # ★ Phase 1: 금리 충격 스트레스 테스터
│       │   ├── DynamicCategorySwitcher.tsx # ★ Phase 2: 피터 린치 카테고리 자동 판정
│       │   ├── LynchLineTerminal.tsx       # ★ Phase 3: 실시간 린치 라인 터미널
│       │   ├── MacroStressTester.tsx       # ★ Phase 1 매크로 스트레스 테스터
│       │   ├── DashboardContainer.tsx      # FF Futures DashboardContainer
│       │   ├── UniversalLynchLineTerminal.tsx # Universal 버전 (하위호환)
│       │   ├── LynchLineChart.tsx          # DEMO 폴백 데이터 (STOCK_DATA export)
│       │   └── macroData.ts               # 거시경제 공공 데이터 (FRED 폴백)
│       └── Layout/
│           ├── Sidebar.tsx             # 사이드바 네비게이션
│           ├── SidebarLayout.tsx       # 전체 레이아웃 래퍼
│           └── TopHeader.tsx           # 상단 헤더
│
├── lib/
│   ├── lynchAnalysis.ts    # ★ 피터 린치 분석 SSOT (NEW — 모든 계산 로직 단일화)
│   ├── fredApi.ts          # ★ FRED API 서비스 레이어 (PCE·EFFR·QT)
│   ├── fedwatchApi.ts      # ★ CME FedWatch 클라이언트 서비스
│   ├── assetClassifier.ts  # SSOT 자산 유형 분류 (STOCK/ETF/CRYPTO/COMMODITY)
│   ├── dart.ts             # ★ DART OpenAPI 공용 유틸 (corp_code 24h캐시·majorstock·krPrice) — 내부자/슈퍼클론/국민연금 공유 (NEW)
│   ├── appCache.ts         # ★ 영구 캐시(Supabase app_cache) — L2 전 인스턴스 공유·콜드스타트 생존 (graceful) (NEW)
│   ├── canonicalFundamentals.ts # 📐 PEG SSOT (stock-info 단일출처·canon-fund 6h캐시 공유) (NEW)
│   ├── gemini.ts           # ★ Gemini JSON 호출 공용 헬퍼 (모델 폴백체인, graceful) (NEW)
│   ├── jarvisBriefing.ts   # 🤖 Jarvis 모닝 처방전 파이프라인 (지표·룰판정·대안·브리핑, PEG SSOT) (NEW)
│   ├── schoolIndex.ts      # 🏫 학교 13F 인덱스 집계(동일가중·익명 ETC·GICS섹터) 순수함수 (NEW)
│   ├── classifyAsset.ts    # Core/Satellite 자동 분류
│   ├── supabase/client.ts  # 클라이언트 Supabase 인스턴스
│   ├── supabase/server.ts  # 서버 Supabase 인스턴스 (cookies)
│   └── utils.ts            # 유틸 함수
├── middleware.ts            # 라우트 보호 (인증 미들웨어)
└── scripts/dev.js           # ★ 안전한 dev 서버 시작 (.next 정리 + 포트 종료 + 3초 대기)
```

---

## 핵심 SSOT 모듈 (`src/lib/lynchAnalysis.ts`)

> **모든 Lynch 분석 로직의 유일한 진실 소스** — 컴포넌트마다 중복 계산 금지

| 함수/상수 | 처리하는 예외 케이스 |
|-----------|-------------------|
| `safeNumber(val)` | "N/A", null, NaN, Infinity → 0 |
| `sanitizeEps(eps, price, cat)` | 음수 EPS→0, 이상값(API 단위 오류) → minPE 클램핑 |
| `calcFairMultiple(pe, peg, cat, market)` | PE/PEG→Lynch공식, 카테고리 캡(30/20/14…), 폴백 |
| `calcGap(price, eps, multiple)` | Lynch Line=0(적자) → null 반환, ∞% 방지 |
| `analyzeEpsMode(...)` | **3단계 EPS 모드**: actual / forward(턴어라운드) / revenue(혁신성장) / loss |
| `estimateBeta(pe, peg, market)` | PE/PEG→금리민감도, 0.5~2.5 클램핑 |
| `estimateCorrelation(market, cat)` | 시장+카테고리 조합 (반도체 KR=0.85 등) |
| `classifyLynchCategory(input)` | DB값 우선, 알고리즘 폴백 (경기순환 우선 체크) |
| `LYNCH_MULTIPLE_CAP` | fast_grower 30, stalwart 20, cyclical 14 등 |
| `LYNCH_CATEGORY_KR` | 영문 DB 키 → 한글 레이블 |

---

## EPS 분석 3단계 모드 (아이온큐·TEM 등 혁신기업 지원)

```
Mode 1: ACTUAL  — 흑자 기업 → 실제 EPS × Multiple
Mode 2: FORWARD — 적자→흑자 전환 중 → forwardEPS × 턴어라운드Multiple (20배)
Mode 3: REVENUE — 순적자 + 매출 폭발 (IonQ류) → P/S 기반 목표가
Mode 4: LOSS    — 전망도 없는 적자 → "적자 구간" 표시 (계산 불가)

REVENUE 모드 기준: forwardEPS ≤ 0 AND revenueGrowth > 50%
targetP/S = min(revenueGrowth / 10, 30)
```

---

## 거시경제 대시보드 — 매크로 터미널 3 Phase

### Phase 1: 매크로 스트레스 테스터
- SSOT beta/basePEG 계산 (`lynchAnalysis.estimateBeta`)
- 포트폴리오 개별주식 전종목 (ETF·코인 제외, `assetClassifier` SSOT)
- 카테고리별 차등 리스크 판정 (고성장/턴어라운드 vs 대형우량주)

### Phase 2: 동적 카테고리 스위처
- `/api/macro-fundamentals` 실데이터 (FMP + stock-info earningsGrowth + Naver)
- EPS 성장률: `/api/financials` YoY 실제값 + `stock-info.earningsGrowth` 교차검증
- DB `lynch_category` 최우선 → 알고리즘 폴백 (경기순환주 우선 체크 버그 수정)

### Phase 3: 실시간 린치 라인 터미널
- `/api/lynch-eps-history` 배치 (DART/FMP/Naver 실데이터)
- EPS 이상값 방어: 카테고리별 minPE 기준 클램핑
- Multiple: `dividendMap` PE/PEG → SSOT `calcFairMultiple` 실시간 재계산 (캐시값 절대 사용 안함)
- sessionStorage 캐시 v4 (6시간 TTL, EPS history만 저장, multiple 제외)
- 적자 기업 3단계 모드 처리 (actual / forward / revenue / loss)

### FRED API 실시간 연동
- Headline PCE (`PCEPI`, pc1) + Core PCE (`PCEPILFE`, pc1) + EFFR (`FEDFUNDS`)
- 연준 대차대조표: WALCL / WSHOTSL / WSHOMCB (주간→월평균 집계)
- API Key: `FRED_API_KEY` (`.env.local`, 서버 사이드 전용)

### CME FedWatch 실시간 연동
- Yahoo Finance FF Futures (ZQ 시리즈) 가격 → CME 다음달 접근법으로 postMeetingRate 계산
- 누적 경로 모델 (이전 FOMC consensusRate → 다음 FOMC preRate)
- 6시간 캐시 (FF Futures 가격 갱신 주기 반영)

---

## 자산관리 탭 주가 차트

- `FullCandleChart.tsx` — `avgPrice` prop 추가
- 1순위: `investments.purchase_price` (Supabase DB 실제 매수가)
- Y축: 캔들 데이터만 기준 (avgPrice 제외, 차트 찌그러짐 방지)
- `avgInView` 체크: 가시 범위 내에서만 평단가선 렌더링

---

## 피터 린치 텐배거 마일스톤 트래커

- 하드코딩 종목 목록 완전 제거 → `investments` props 완전 동적화
- ETF·원자재·코인 자동 제외 (`getAssetType() === 'STOCK'` 필터)
- localStorage 수동 입력 폐기 → `purchase_price` DB 자동 연동
- 1배(원금) → 2배(2루타) → 5배(홈런) → 10배🏆 마일스톤 게이지

---

## 어닝 터미널 — G 리비전 추적기 (2026-05-30 신규)

### `src/app/components/EarningsAlertTerminal.tsx`

**기능:**
- 보유 개별 주식의 12M Forward 이익성장률(G) 컨센서스 추이 시각화
- G 슬라이더 조정 → PEG 실시간 재계산 → 버블 차트 동기화
- 피터 린치 기준 매매 알럿 자동 판정

**알럿 로직 (우선순위):**
1. 🟡 체질 변화: 원래 G≥20% 이었으나 현재 G<12% → 고성장→중저성장 다운그레이드
2. 🟢 매수 적기: PEG ≤ 0.5
3. ⚡ 매수 경계: 0.4 ≤ PEG ≤ 0.6 (기준선 ±0.1)
4. 🔴 매도 고려: PEG ≥ 1.5
5. ⚡ 매도 경계: 1.4 ≤ PEG ≤ 1.6
6. ⚪ 합리적 보유: 0.6 ≤ PEG < 1.4

**PEG 공식:** `PEG = PE ÷ G(%)` (G는 % 정수, PE=20 + G=20% → PEG=1.0)

**G 추출 우선순위:**
1. PE/PEG 역산 (dividendMap)
2. `earningsGrowth` (stock-info YoY 실데이터)
3. 카테고리 기본값 (fast_grower=25, stalwart=12 등)

**버블 차트 설계:**
- X축: G 순위 균등 배치 (8종목 겹침 방지, 좌=저성장, 우=고성장)
- Y축: 실제 PEG 값 (0~3.0 클램핑)
- 버블 위 라벨: 실제 G% 표시
- TEMPUS AI 등 PE 없는 종목: 점선 버블 + "PE—"

**필터링:**
- `getAssetType() === 'STOCK'` 으로 ETF·코인·원자재 제외
- 티커 중복 방지 (Map dedup)
- 개별 주식 0개 → Empty State UI

**다국적 통화 지원:**
```
isKrTicker(): KRW / market=KR / 6자리 / .KS/.KQ
fmtPrice(): ₩(KRW) / ¥(JPY) / €(EUR) / $(기본 USD)
```

**KR 가격 이상값 방어:**
- PE 역산 EPS가 ₩100,000+ 이면 10배 버그로 판단 → ÷10 보정
- 삼성바이오로직스(₩750K+)처럼 정상 고가 주식은 보정 안 함

**카테고리 자동 보정:**
- DB가 fast_grower이지만 실제 G<12% → stalwart 표시
- 모든 배지 동일 회색 (⚠ 배지 없이 조용히 보정)

---

## 대시보드 신규 탭 (2026-05-31) — 4대 대분류 드롭다운 네비게이션

상단 탭이 10개로 늘어 가독성 문제 → **4개 대분류 드롭다운**으로 개편:

| 대분류 | 소분류 탭 |
|--------|-----------|
| 📊 자산 & 모니터링 | 실시간 대시보드 · 어닝 터미널 · 주주환원 터미널 |
| 🔍 린치 가치평가 | 린치 밸류에이션 · 린치 이익선 차트 · 매도 시그널 |
| 💡 투자 리서치 | AI 멘토 족집게 · 유령 종목 추적기 · 거시경제(Fed) |
| ⏳ 시뮬레이션 | 투자 타임머신(백테스트) · 레버리지 위험 시뮬 |

- hover/클릭 시 드롭다운, 활성 소분류의 **부모 그룹에 Gold 하이라이트** 유지
- 각 탭 컨텐츠는 `<ErrorBoundary>`로 감싸 **탭별 에러 격리** (한 탭 죽어도 나머지 정상)

---

## 주주환원율(Shareholder Yield) 터미널 — `ShareholderYieldTerminal.tsx`

- 컬럼: 종목(티커) | 린치분류 | 현재가 | 배당수익률 | 자사주매입률 | **총주주환원율** | 주식수 3년 추이
- 총주주환원율 = 배당수익률 + 자사주매입률
- Recharts 미니 스파크라인 (3년 발행주식수), 🟢 자사주 소각 / 🔴 주주가치 희석 배지
- 현재가는 `priceMap` 원본값 그대로 (10배 보정 안 함 — SK하이닉스 등 정상 고가주 보호)

---

## 린치 밸류에이션 엔진 — `LynchValuationEngine.tsx`

종목 선택 드롭다운 → `lynch_category` 감지 → **switch-case로 6대 분류별 전용 UI**:
- 고성장주: PEG 게이지 / 중성장: (G+DY)/PER 스코어 / 경기순환: PBR 밴드 + 황금 경고
- 저성장: 배당성향 게이지 / 회생주: 부채·이자보상 + 흑자전환 배지 / 자산주: 안전마진율

---

## 레버리지 위험 시뮬레이터 — `LeverageRiskSimulator.tsx`

- 자본시장연구원 통계 카드: 일반 ETF +25% vs 레버리지 -33%
- **시장 시나리오 토글** (횡보장의 덫 / 폭등장 / 폭락장) → 1·2·3배 음의 복리 실시간 계산
- 수식: `(1+x)(1-x)=1-x²` vs `(1+3x)(1-3x)=1-9x²` (3배는 9배 빠른 자산 파괴)
- 피터린치 원칙 기반 위험 감내도 진단 (투기 vs 이성적 투자자)

---

## 워렌버핏 DCF 내재가치 분석기 — `BuffettAnalysisPanel.tsx` (2026-05-31)

### `/analysis?tab=buffett` 하단에 배치 (포트폴리오 연동)

**100% 자동 분석 (슬라이더 제거):**
- 종목 선택 드롭다운 → Yahoo Finance 실데이터 자동 수집 → DCF 즉시 계산
- `getAssetType() === 'STOCK'` 필터 (ETF·코인·원자재 제외)

**DCF 입력값 5단계 폴백 (어떤 종목이 와도 graceful 처리):**
| 입력값 | 1순위 | 2순위(폴백) |
|--------|-------|------------|
| 유통주식수 | Yahoo `sharesOutstanding` | 시총÷현재가 |
| FCF | Yahoo `freeCashflow` | 시총÷정상PER×0.85 (고PER 정상화) |
| 순부채 | `totalDebt − totalCash` | 0 |
| 성장률 | `earningsGrowth`(35% 클램핑) | 린치 카테고리 기본값 |
| ROE/마진 | Yahoo 실데이터 | 카테고리·업종 추정 |

**stock-info API 확장:** Yahoo `financialData`+`defaultKeyStatistics`에서 DCF 실데이터(freeCashflow·sharesOutstanding·totalDebt·totalCash·ROE·grossMargins) 추가 수집. KR은 `.KS`→`.KQ` 순 시도.

**DCF 계산 (원시 통화 기준 — 통화 변환 없이 내재가치/주가 자동 동일 단위):**
```
FCFₙ = FCF₀×(1+g)ⁿ / PVₙ = FCFₙ/(1+r)ⁿ
TV = FCF₅×(1+gₚ)/(r−gₚ) / EV = ΣPV + TV/(1+r)⁵
내재가치/주 = (EV − 순부채) / 유통주식수
안전마진 = (내재가치 − 현재가)/내재가치 × 100
```

**경제적 해자 5개 항목 100% 자동 판정 (수동 입력 완전 제거):**
- ROE>15%, 매출총이익률>40%: 실데이터 → 카테고리·업종 추정
- 재무 안전성: **순부채 < 시총 40%** (대형주 부채 수용, FCF×5 기준 폐기)
- 브랜드 해자: 카테고리 OR ROE≥18% / 소비자 고착성: 섹터 OR 마진≥45%

**적자/데이터부족 방어 (핵심):**
- `dcfUnavailable` = 순이익 적자(**ROE<0**) OR FCF≤0 OR NaN/극단값
- 이유 구분: `loss`(적자 — 린치 회생주 프레임 안내) vs `nodata`(데이터 부족 — 해자·PEG 보완)
- ⚠️ **FCF 음수 ≠ 적자**: 삼성생명·한화에어로(흑자, FCF 일시 음수)는 정상 추정, 파두(ROE−89%)·TEM·PLUG는 분석불가

**교육용 동적 인사이트 카드:**
- 💎 **시장 프리미엄**: 안전마진 < −50%인 우량주 (Eaton·GOOGL — DCF 보수 모델 한계 설명)
- ⚡ **고성장 클램핑**: 실제 성장률 > 35% 적용값 (NVDA 65%→35% / TEM·IONQ 흑자전환 기저효과)
- ⚠️ **TV 의존도**: 내재가치의 75%+ 가 영구가치면 경고 (GEV 83%)
- 🧠 **품질×가격 2축 통합 진단**: 해자(품질) vs 안전마진(가격) — "좋은 기업도 비싸면 안 산다"

**검증 완료:** 실제 학생 DB 25종목 스모크 테스트 통과 (크래시 0). 흑자/적자/데이터부족 정확 분류.

---

## 🍸 시장 칵테일 파티 지수 — 비밀병기 3단계 (2026-05-31)

피터 린치 '칵테일 파티 이론'(파티에서 주식 대화의 열기 = 시장 과열도)을 객관적 데이터로 시각화. **대시보드 거시경제 탭 상단** 배치.

### 데이터 (하이브리드, 우선순위)
- **① CNN Fear & Greed Index (메인)** — `production.dataviz.cnn.io/index/fearandgreed/graphdata`. ⚠️ **완전 브라우저 헤더 필수**(User-Agent·Origin·Referer)로 418 봇차단 회피. 7개 지표 종합(모멘텀·강도·폭·풋콜·VIX·정크본드·안전자산) + 전일/1주/1달 추세
- **② VIX + S&P500 자체계산 (폴백)** — Yahoo Finance. CNN 차단 시 `vixGreed*0.5 + momentum*0.5`
- Cron·DB 불필요 — 실시간 fetch + **1시간 인메모리 캐시**

### 구성
- **`src/app/api/cocktail-party/route.ts`** — 하이브리드 fetch + 5단계 판정 + VIX 1년 추이(`fetchVixHistory`)
- **`src/app/components/CocktailPartyGauge.tsx`** — CNN 원본 스타일 반원 게이지

### 게이지 핵심 (디버깅으로 확정)
- **각도 매핑**: 0점=180°(왼쪽)·50점=90°(꼭대기)·100점=0°(오른쪽). SVG는 y가 아래로 + → 위쪽 반원은 `y = cy − len·sin(angle)`. (초기 버그: `cy + r·sin` → 바늘이 게이지 밖으로 튐)
- **5구간**(경계 25/45/56/76): 극공포🍷·공포🥂·중립🍸·탐욕🎉·극탐욕🚨. 현재 구간만 진하게 + glow 강조(CNN 스타일 라벨)
- **VIX 미니 라인차트**(Recharts, 1년 주간): 공포 임계선(20 경계/30 공포) + Y축 명시눈금 `[10,35] ticks[10,20,30]`(자동 도메인 버그 회피)
- **자체계산 과대 주의**: VIX+S&P만으론 사상 최고가에서 모멘텀 99%로 과열(90점) → CNN 7지표 종합(60점)이 더 정확 → CNN 메인 채택

---

## 🤖 Jarvis 어닝콜 애널리스트 — 비밀병기 4단계 (2026-05-31)

피터 린치 페르소나로 종목의 최근 분기 실적을 풀어주는 AI 애널리스트. **종목 리서치(`/research`) 페이지 하단**에 자동 배치.

### 3대 설계 원칙
| 원칙 | 구현 |
|------|------|
| **Zero Cost** | 유료 금융 API 미사용. Yahoo Finance 뉴스 RSS(`feeds.finance.yahoo.com/rss`) 초경량 스크래핑 + 이미 확보한 실데이터(PER·PEG·EPS·성장률) grounding. AI는 Gemini 2.5 Flash-Lite **무료 티어** |
| **Lazy Caching** | 조회 순간 `earnings_insights`에 `(ticker, quarter)` 없을 때만 1회 스크래핑+AI 분석 → upsert. 이후 동일 분기 조회는 DB 즉시 반환 |
| **Zero Input** | 학생 입력 0. 종목 선택 시 `JarvisInsight`가 `useEffect`로 서버액션 자동 호출 |

### 구성 파일
- **`supabase/earnings_insights.sql`** — DDL. `ticker·quarter·summary_text(JSON)·sentiment_score·created_at`, 복합 PK `(ticker,quarter)`, RLS(공개읽기/service_role쓰기). ⚠️ **Supabase SQL Editor에서 1회 실행 필요**
- **`src/app/actions/getEarningsInsight.ts`** — 서버액션('use server'). 흐름: DB조회→없으면 RSS스크래핑+Gemini분석(JSON스키마 강제)→upsert→반환. 키 없거나 테이블 없어도 graceful(`status: no_key|no_data|error`)
- **`src/app/components/JarvisInsight.tsx`** — 클라이언트. 로딩("Jarvis가 경영진의 어닝콜을 분석 중입니다…")→린치 구어체 3섹션(🌱성장스토리·🎙경영진태도·🧭다음분기가이던스)+감성점수(0~100)+출처 뉴스 토글

### 핵심 구현 포인트
- **분기 캐시 키**: `latestReportedQuarter()` — 현재월 기준 가장 최근 보고분기를 결정론적 산출(예: 5월→`2026 Q1`). 조회·저장 키 동일 보장
- **RSS 파서**: 의존성 0(정규식). 어닝 키워드(earnings·quarter·revenue·guidance·실적·매출…) 우선 필터, 부족 시 일반 헤드라인 폴백. KR은 `.KS` 심볼
- **Gemini 호출**: SDK 없이 `fetch`로 REST. `responseMimeType: application/json` + `responseSchema`로 구조 강제 → 파싱 안정성
- **환경변수**: `GEMINI_API_KEY` (서버 전용, `.env.local` + Vercel). 무료 발급: aistudio.google.com/app/apikey

### ⚠️ Gemini 무료 한도 대응 (2026-05-31 핫픽스)
무료 quota는 **모델별 '일일' 한도**(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). 종목을 연달아 조회하면 한 모델이 429로 소진됨. 3중 방어:
- **① 모델 폴백 체인**: `gemini-flash-lite-latest → gemini-2.5-flash-lite → gemini-flash-latest → gemini-2.5-flash`. 한 모델 429/5xx면 **즉시 다음 모델**(quota가 모델별 분리라 다른 모델은 살아있음)
- **② in-memory 캐시 6h**: DB 테이블(`earnings_insights`) 없어도 같은 종목 재호출 차단 → 한도 보호
- **③ rate_limited 상태 + 22초 자동 재시도**: 전 모델 소진 시 친근한 안내 후 컴포넌트가 자동 재조회
- 참고: `gemini-2.0-flash`는 이 키에서 free_tier limit=0(사용 불가)

---

## 🕵️ CEO의 장바구니 (Insider's Receipt) — 비밀병기 5단계 (2026-05-31)

피터 린치: *"내부자가 파는 이유는 수만 가지지만, 사는 이유는 단 하나 — 오를 것 같아서다."*
SEC EDGAR Form 4(내부자 공시)에서 최근 90일 **장내매수(코드 P)**만 추려 '황금 영수증'으로 표시. **종목 리서치(`/research`)** 하단, Jarvis 위에 배치.

### 구성 파일
- **`supabase/insider_signals.sql`** — DDL. PK `ticker`, `cluster·buyer_count·total_value·payload(jsonb)·as_of`, RLS(공개읽기/service_role쓰기). 24h 신선도. ⚠️ SQL Editor 1회 실행
- **`src/app/actions/getInsiderSignal.ts`** — 서버액션. ticker→CIK(전체맵 모듈캐시)→`/submissions`(90일 form=4)→각 Form4 XML 파싱→코드 P+취득 A만 집계→upsert. 서로 다른 내부자 ≥2명=`cluster`(고확신)
- **`src/app/components/InsiderReceipt.tsx`** — 황금 영수증 UI. 클러스터 시 🔥 사이렌(펄스 글로우). 내부자별 이름·직책·날짜·금액 + 린치 코멘트(결정론적, AI 불필요)

### ⚠️ SEC EDGAR 연동 핵심 교훈 (반드시 지킬 것)
- **`fetch`(undici) 금지 → Node `https` 모듈 사용.** undici fetch는 `Accept-Encoding`을 자동 부착하는데, SEC의 gzip 응답을 undici가 제대로 못 풀어 **XML 태그가 깨짐**(`includes('rptOwnerName')`=true인데 `<rptOwnerName>` 정규식 불일치 → 파싱 0건). `https`는 Accept-Encoding 미전송 → SEC가 평문 응답 → 정상. (안전용 매직바이트 `1f8b` gunzip 포함)
- **Form4 raw XML 경로**: `submissions.primaryDocument`(`xslF345X06/form4.xml`)의 **basename**(`form4.xml`)이 raw XML → 필링당 1요청
- **SEC throttle**: 과다요청 시 **200 응답에 손상된 본문**(여는 태그만 남고 내용 깨짐)을 줌. `secGet(url, valid)`로 무결성 검사(`isForm4`/`isJson`) 실패 시 **백오프 재시도**(1·2·3초). 배치 4개+500ms로 완만하게. 24h 캐시로 재요청 최소화
- **거래코드**: P=장내매수(시그널!) / S=매도 / A=부여 / M=옵션행사 / F=세금원천징수. **대형주는 P가 거의 없음**(부여+매도 위주) → 장내매수는 본질적으로 희귀·강력 시그널
- **US**(EDGAR) + **KR**(DART) 둘 다 지원

### 🇰🇷 한국 확장 (DART, 2026-05-31) — 미국판과 동등 정확도
`market==='KR'` → `krInsider()` 경로:
- **티커→corp_code**: `corpCode.xml`(ZIP 3.5MB→28MB, 상장사 3,920개) 모듈 캐시 24h. 005930→00126380
- **`elestock.json`**(임원·주요주주 소유보고) → 최근 90일 + 지분 증가(`sp_stock_lmp_irds_cnt`>0) 보고만, 최신순 상한 12
- **보고서 원문 확정**: 각 보고의 `document.xml`(ZIP→inflateRaw)에서 **`장내매수(+)` 취득행이 있는 것만** 인정 (스톡옵션·증여·무상 제외). ⚠️ 단순 `/장내매수/`가 아니라 `/장내매수\s*\(\s*[+＋]/` 패턴(실제 취득행)
- **금액**: elestock 증감주식수(정확) × 네이버 현재가(`polling.finance.naver.com`) = **추정**(거래단가 아님, 푸터에 명시)
- **통화**: `currency:'KRW'`, `source:'dart'` → 컴포넌트가 ₩억/만 포맷 + 출처 문구 분기
- 검증(2026-05): 삼성전자 → 장내매수 11건·10명·🔥클러스터·총 ₩16.5억 (조성희 상무 ₩9.2억 등)
- ⚠️ DART 통신은 SEC와 달리 undici fetch가 아닌 `node:https`(httpBuf)로 ZIP 바이너리 직접 처리 + zlib.inflateRaw

---

## 🌤️ 피터 린치의 13분 날씨예보 — 비밀병기 6단계 (2026-05-31)

피터 린치: *"거시경제 분석에 1년에 13분 이상 쓰면 그중 10분은 낭비다."*
복잡한 유동성·신용 지표를 **오늘의 날씨 아이콘 하나**(☀️맑음/⛅흐림/⛈️폭풍우)로 치환. **대시보드 거시경제 탭 최상단** 배치.

### 구성 파일
- **`src/app/api/macro-weather/route.ts`** — FRED 4개 시리즈 → 날씨 판정 (12h 인메모리 캐시, Cron 불필요). ⚠️ FRED 동시 호출 시 일부 빈응답(순유동성 null) → **순차 조회 + 3회 재시도 + `cache:'no-store'`**, 순유동성 null이면 캐시 20분으로 단축(곧 재시도)
- **`src/app/components/MacroWeather.tsx`** — 날씨 배너(클릭 시 상세 펼침) + 폭풍우 시 포트폴리오 교차경고

### 데이터·계산 (FRED, 이미 보유한 키)
- **순유동성 = WALCL − WTREGEN − RRPONTSYD×1000** (연준 BS − 재무부 TGA − 역레포, $M). 검증: 6,704,383 − 830,296 − 11,677 ≈ **$5.86조**
- **신용 스트레스 = BAMLH0A0HYM2** (하이일드 스프레드, %). 기업 부도위험 체온계
- ⚠️ **단위 주의**: WALCL·WTREGEN은 $백만, RRPONTSYD는 $십억 → RRP만 ×1000

### 날씨 판정 (HY 스프레드 주신호)
```
⛈️ 폭풍우 : HY > 5.5%  또는 4주 급등 +1.0%p↑ (블랙스완)
⛅ 흐림   : HY 4.0~5.5%  또는 (유동성 축소 & HY>3.4%)
☀️ 맑음   : HY < 4.0% & 유동성 확장
```
검증값(2026-05): HY 2.72%(4주 −0.11%p) + 순유동성 $5.86조 확장▲ → **☀️ 맑음** ✓

### 크로스체크 (블랙스완 대비)
⛈️ 폭풍우 감지 시 → 포트폴리오의 **회생주(`lynch_category='turnaround'`, 적자·고부채 취약)**에 경고등 + 종목명 노출. "폭풍우엔 빚 많은 기업이 먼저 흔들린다."

### 신규 API 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| `GET /api/macro-weather` | FRED 순유동성·HY스프레드 → 날씨 판정 (12h 캐시) |

---

## 🎧 Jarvis 노이즈 캔슬러 (Wall St. Noise Canceller) — 비밀병기 7단계 (2026-05-31)

피터 린치: *목표가·등급은 소음, 실적(earnings)은 신호.*
원래 기획("애널리스트 승률 필터")은 무료 데이터 불가 → **"목표가 소음은 끄고 '실적 추정치 리비전'만 증폭"**으로 재설계(더 정직·더 린치스러움). **종목 리서치(`/research`)** 하단, Jarvis 아래 배치.

### 구성 파일
- **`src/app/actions/getAnalystSignal.ts`** — 서버액션. `yf.quoteSummary`(financialData + recommendationTrend + earningsTrend). **in-memory 6h 캐시**(별도 SQL 불필요)
- **`src/app/components/NoiseCanceller.tsx`** — 🎧 종합 판정 배너 + 3신호 카드 + 린치 코멘트

### 3개 신호 (Yahoo, 무료)
1. **🔇 목표가 분산(노이즈 미터)** = (고가−저가)/평균. ≥80% "의견 제각각=시장도 모름"
2. **📈 EPS 추정치 리비전(핵심 신호)** = 최근 30일 상향(`upLast30days`) vs 하향(`downLast30days`) 애널리스트 수
3. **🔄 컨센서스 표류** = `recommendationTrend` 0m vs −3m 매수의견 비중 변화

### 종합 판정 (EPS 리비전 우선)
```
⚠️ 함정(trap)   : 리비전 하향 + 목표가는 낙관(상승여력>5%) → 겉은 매수, 속은 후퇴
🟢 신호(signal) : 리비전 상향(up30 ≥ down30×2 & ≥3명) → follow the earnings
🔇 노이즈(noise): 신호 없음 + 분산 ≥80% → 휘둘리지 마
〰️ 중립(neutral): 그 외
```
검증(2026-05): NVDA ▲40/▼2→신호 · TSLA ▲7/▼18+분산116%→노이즈 · PFE/BA 혼조→중립 ✓

### 한계
- 개인 애널리스트 승률은 여전히 불가 — 하지만 그게 필요 없는 설계

### 🇰🇷 한국 확장 (네이버, 2026-05-31) — 정직한 축소판
`market==='KR'` → `krAnalyst()`. ⚠️ **검증 결과 KR은 목표가 분산·EPS 리비전을 무료로 못 구함**(개별 목표가는 PDF 안에만, 리비전 카운트는 미제공). → 컨센서스 요약으로 축소:
- 데이터: 네이버 `m.stock.naver.com/.../integration`의 `consensusInfo`(목표가 평균·투자의견) + `researches`(리포트 활동) + `polling.finance.naver.com`(현재가). 전부 `fetch`로 OK(undici 이슈 없음)
- **투자의견 척도 반대**: 네이버는 5=강력매수~1=매도 (Yahoo는 1=Strong Buy). 컴포넌트가 `source` 기준으로 라벨 분기
- 판정(분산·리비전 없음 → 상승여력+의견 기반): 상승여력≥15%&의견≥3.8 → 🟢 / 상승여력<3% → ⚠️목표가소진 / 그외 〰️
- 컴포넌트 KR 카드: 🎯목표가·상승여력 / ⭐투자의견 / 📰리포트활동 (US의 분산·리비전·표류 카드 대체)
- 검증(2026-05): 삼성 +25%🟢 · 카카오 +72%🟢 · SK하이닉스 +4.5%〰️ · 현대차 +5.4%〰️
- in-memory 6h 캐시 (US·KR 공통)

---

## 🧠 피터린치 진단 위저드 STEP 2 자동화 (2026-06-01) — 수동 체크리스트 → AI 자동 진단

**문제**: 위저드 STEP 2의 14개 정성 체크리스트를 학생이 수동 체크 → 학생들이 모르고 싫어함, 빈 폼에 막막.
**해결**: 학생 입력 0 — 자동 진단 후 **읽기전용**으로 표시 (클릭 체크박스 완전 제거).

### 구성
- **`src/app/actions/getQualitativeChecks.ts`** — 서버액션. 3원 통합:
  - `insider_buying` ← `getInsiderSignal`(DART/EDGAR 실데이터): hasBuys면 자동 체크 + "내부자 N명 장내매수" 근거
  - `no_analyst`    ← `getAnalystSignal`(커버리지): US 애널 ≤3명 / KR 리포트 ≤3건 → "숨겨진 진주" 자동 체크
  - 나머지 12개 주관 항목 ← **Gemini 모델 폴백 체인**(temperature 0.2, 보수적 boolean). 검증: 코카콜라→불경기방어·반복구매 / 삼성전자→핫업종(반도체)·숨은자산 / 한국전력→사양업종·방어적·구조조정 등
- **`LynchWizard.tsx`** STEP 2: `step===2` 진입 시 자동 진단 → `checks` 자동 채움 → **감지된 신호만 읽기전용 카드**로 표시(클릭 불가). 0개면 "두드러진 정성 신호 없음 — 정량 지표 중심 판정" 안내
- in-memory 6h 캐시. AI 한도 초과 시에도 내부자·애널 실데이터는 자동(graceful)

### 핵심 버그 수정
- **종목코드 전달**: research가 위저드에 검색어(`query`) 대신 **해결된 코드**(`stockInfo.ticker`) 전달 → "삼성전자"(한글명) 검색 시 `"000000"`으로 조회 실패하던 버그 해결 + 6자리면 KR 자동 추론
- Gemini `reasons` OBJECT(properties 없음)는 빈 `{}` 반환 → AI 항목은 근거 생략(item.detail로 충분), 내부자·애널 항목만 🤖 근거 표시

---

## ⏳ 좀비 생존 타이머 — 킬러 기능 8단계 (2026-06-01)

적자 고성장주·회생주의 현금 소진(런웨이)과 유상증자 희석 위험을 타이머로 시각화. **리서치 페이지** 하단(개별주식만).
- **`src/app/components/CashRunwayTimer.tsx`** — props 기반(서버액션·캐시 불필요). research가 이미 받은 stock-info DCF값(`freeCashflow·totalCash·sharesOutstanding`) **재사용 → 추가 fetch 0**
- 계산: `런웨이(개월) = totalCash ÷ (|연간FCF| ÷ 12)`. FCF≥0(흑자) → "현금 안 까먹음, 해당없음"
- 4단계: ≥36개월 여유 / 18~36 보통 / 12~18 주의 / <12 위험 → **유상증자 희석 경보**(🚨)
- research StockInfo에 `freeCashflow·totalCash·sharesOutstanding` 캡처 추가(stock-info `fundamentals`에서)
- ⚠️ **핵심 수정(FCF≠적자)**: FCF 음수만으로 "좀비"로 오판하던 버그 → **ROE(손익)와 결합한 4사분면**:
  - ① ROE>0 & FCF≥0 → 💰건강 흑자 / ② ROE>0 & FCF<0 → 🟦흑자인데 현금흐름만 일시 마이너스(**좀비 아님** — 한화에어로·삼성생명류 방산·투자기) / ③ ROE<0 & FCF≥0 → ⚠️손익은 적자(FCF만 보고 안심 금지 — 파두류) / ④ ROE<0 또는 미확인 & FCF<0 → 🚨진짜 좀비 타이머
  - research가 stock-info `returnOnEquity` 캡처·전달
- ⚠️ **영업이익률 교차검증(2026-06)**: ROE는 일회성 이익(워런트 평가익 등)으로 거짓 양수가 될 수 있음(IonQ ROE+11%인데 영업이익률 −402%) → **영업이익률 < −10%면 무조건 적자 취급**(`opLoss`). stock-info에 `operatingMargins` 노출 추가
- 검증(2026-06): 한화에어로 ROE+18%·영업+11%·FCF−→②(좀비아님) / **IonQ ROE+11%(거짓)·영업−402%·FCF−→④진짜좀비** / PLUG→④🚨 / META→①건강

---

## ⚔️ 섹터 피어 X-Ray — 킬러 기능 9단계 (2026-06-01)

보유 종목을 동종 경쟁사 3~4개와 PEG·영업이익률·부채비율로 상대평가. 린치: "업종 내 가장 싸고 탄탄한 1등을 사라". **리서치 페이지**(개별주식만).
- **`src/app/actions/getSectorPeers.ts`** — 서버액션. Yahoo `recommendationsbysymbol`(피어) + `quoteSummary`(financialData·summaryDetail·defaultKeyStatistics·price)로 PEG·영업이익률·부채/시총. in-memory 6h
- ⭐ **체급(시총) 컬럼(2026-06)**: 비율 지표는 환율 무관이지만 '시총 체급'은 통화가 달라 비교 불가 → `mcapUsd`(KRW면 `USDKRW_APPROX=1380`으로 대략 환산) 컬럼 추가. 글로벌 1등 대비 위치 한눈에(검증: NVDA $5.37T·TSMC $2.28T·삼성전자 $1.66T·SK하이닉스 $1.22T). `price.currency`로 통화 판별
- **`src/app/components/SectorPeerXray.tsx`** — 비교 표(내 종목 하이라이트 + 가성비순 정렬) + 린치 코멘트
- 판정: 대상보다 **PEG↓ & 영업이익률↑**인 경쟁사 있으면 → 🔄 로테이션 제안 / 대상이 PEG 최저면 → 🏆 / 그외 〰️
- KR은 Yahoo .KS 피어가 빈약 → `none`("국내 동종업계 데이터 제한적") graceful
- ⚠️ **피어 소스 교체(2026-06) — 행동기반 → 큐레이션 글로벌 GICS 맵**:
  - Yahoo `recommendationsbysymbol`은 **행동기반(co-viewed)**이라 타 업종 섞임(팔란티어↔TSMC, APR↔식품) → **폐기**(폴백으로만 유지)
  - **`CURATED` 맵**: Yahoo `assetProfile.industry` 문자열 → 대표 글로벌 종목(美+韓) 18개 업종. 예: Semiconductors→[NVDA·AMD·TSM·MU·INTC·SK하이닉스], Software-Infrastructure→[MSFT·PLTR·NOW·ORCL·CRWD], Auto→[TSLA·현대차·기아·F·GM], Oil&Gas E&P→[COP·OXY·EOG·DVN], Oil&Gas Integrated→[XOM·CVX·SHEL]
  - **부채/시총 캡**: 자동차·은행은 금융 자회사 부채가 totalDebt에 포함돼 비현실적(Toyota 17452%) → 표시 300%↑ 캡 + 푸터 안내. (판정엔 미사용, 표시용)
  - ⓐ대상 먼저 조회→업종 파악 ⓑ업종이 맵에 있으면 **글로벌 동종업계** 사용(`source:'curated'`), 없으면 Yahoo 행동기반 폴백(`source:'yahoo'`)
  - ⭐ **환율 무관**: 비교 지표(PEG·영업이익률%·부채/시총%)가 전부 **비율** → KR↔US 직접 비교에 환율 변환 불필요
  - FMP 섹터피어는 **유료/일일250회 소진**으로 사용 불가 → Yahoo(=yfinance)가 KR·US GICS 동일 규격 제공(검증: NVDA·SK하이닉스·MU 모두 "Semiconductors")
- 검증(2026-06): SK하이닉스→글로벌 반도체(MU·NVDA…) / PLTR→MSFT 로테이션(TSMC 사라짐) / 현대차→글로벌 자동차
- ⚠️ **한국 중공업 티커 오버라이드(2026-06)**: Yahoo가 한국 조선사를 "Aerospace & Defense"로 오분류(삼성중공업·HD현대중공업이 미 방산주와 비교됨) → `TICKER_GROUP` 6자리코드 오버라이드로 보정. **`KR-Shipbuilding`**(삼성중공업·HD현대중공업·한화오션·HD현대미포·HD한국조선해양) / **`KR-PowerEquip`**(두산에너빌리티·HD현대일렉트릭·효성중공업·LS ELECTRIC·일진전기) → 한국 동종끼리 비교 + 표시 업종을 한글 그룹라벨로 통일. 검증: 삼성중공업→한국 조선사끼리 / 두산에너빌리티→한국 전력기기끼리

---

## 🐳 슈퍼 클론(13F Shadow Tracker) — 킬러 기능 10단계 (2026-06-01)

내가 보유한 종목을 **미국 전설적 투자자 9인**이 들고 있나 + 지난 분기 늘렸나/줄였나를 SEC 13F-HR로 추적. 린치: "거인을 복제하지 말고, 거인이 왜 샀는지를 이해하라". **리서치 페이지**(개별주식·미국만).
- **`src/app/api/shadow-13f/route.ts`** — **라우트 핸들러**(`maxDuration:45`). 펀드 보유내역 **인메모리 12h 캐시**(전 종목 공유) → 콜드미스 1회만 SEC 수집(~12s), 종목별 매칭은 즉시(~0.8s)
- **`src/app/components/ShadowTracker13F.tsx`** — 거인 목록(평가액·포트폴리오 비중·신규/확대/유지/축소/청산 배지) + 린치 코멘트
- **추적 펀드 9인(CIK 검증 완료, 모두 최신분기 제출)**: 버핏(버크셔 0001067983)·애크먼(퍼싱 0001336528)·드러켄밀러(듀케인 0001536411)·달리오(브리지워터 0001350694)·게이츠재단(0001166559)·맨델(론파인 0001061165)·리루(히말라야 0001709323)·코언(포인트72 0001603466)·테퍼(아팔루사 0001656456)
  - ⚠️ CIK 라벨 함정: 0001061165=**론파인**(바우포스트 아님), 0001603466=**포인트72**(히말라야 아님). 사이언(버리 0001649339)은 13F가 분기 스테일(2025-11)이라 **제외**
- ⚠️ **하드윈 교훈**:
  - SEC는 **Node `https`** 모듈로(undici fetch 금지 — gzip 응답 깨짐). User-Agent에 연락처 필수
  - 13F 정보테이블 **태그엔 네임스페이스 없음** → 단순 `<tag>…</tag>` 정규식. ⚠️`<[^>]*tag>` 식의 prefix 정규식은 **빈 문자열 반환 버그**(직접 정규식은 정상) → 단순 패턴 사용
  - **value 필드 = 달러 원금**(2023년 이후), /1e9=$B. 검증: 버크셔 Apple $57.8B(포트 22%) — ⭐**같은 발행사가 여러 행**(매니저·discretion별)으로 쪼개져 나오므로 `.filter().reduce()`로 **합산**해야 정확(단일 `.find()`는 $20.5B로 과소)
  - 13F는 **CUSIP만** 줌(티커 매핑 유료) → **발행사 약어명**("BANK AMER CORP"·"OCCIDENTAL PETE CORP"·"COCA COLA CO") 매칭이 핵심. 정규화(불용어·하이픈 제거)+**첫토큰 정확 + 나머지 3자 프리픽스** 매칭 → 버크셔 실보유 8종목(AAPL·KO·BAC·OXY·AXP·CVX·KHC·MCO) 전부 정확, 무보유(NVDA·DPZ) 정확 제외. **정밀도 우선**(거짓 "버핏 보유"가 거짓 누락보다 나쁨)
  - ⚠️ **truncation 방어**: SEC throttle 시 잘린 200을 주면 일부 종목만 파싱→거짓 청산/누락 → 검증자에 **닫는 루트태그 `</informationTable>` 필수** → 미완성 시 secGet 재시도
  - **신규/확대/유지/축소/청산**: 최신 vs 직전 분기 주식수 델타(±5% 경계). **청산(exit)도 표시**(예: 게이츠 재단이 MSFT 실제 전량매도 — 진짜 약세 신호. 스테일 지식으로 버그 오인 주의, 실데이터 검증 필수)
- 45일 공시지연 안내 + "투자추천 아님" 푸터 명시

### 🇰🇷 한국 확장(2026-06-01) — DART 최대주주 현황
- 한국엔 분기 13F 제도가 없지만 **최대주주 현황**(지배주주+특수관계인, 정기보고서)이 있음 → 국장도 '거인 추적' 가능
- **`src/lib/dart.ts`**(신규 공용 라이브러리): `dartBuf·unzipFirst·dartJson·getCorpCode(24h캐시)·krPrice·toStock6` — 🕵️내부자(getInsiderSignal)와 **공유**(중복 제거 + corp_code 캐시 공유). getInsiderSignal은 로컬 DART 헬퍼를 삭제하고 이걸 import
- 라우트 KR 경로: ticker가 6자리/`.KS`/`.KQ` 또는 market=KR → `krShareholders()`. 엔드포인트 **`hyslrSttus.json`**(최대주주 현황. ⚠️사용자가 말한 `hysldSttus`는 status=101 오답). 폴백 루프: 2026 1Q(11013)→2025 사업보고서(11011)→3Q→반기→2024 사업보고서
- 실제 필드: `nm`·`relate`·**`trmend_posesn_stock_qota_rt`**(기말 지분율%)·**`trmend_posesn_stock_co`**(기말 주식수)·`bsis_posesn_stock_co`(기초→증감 액션 산출). ⚠️사용자가 적은 `qota_rt`/`thstrm_stok_co`는 틀린 키
- 같은 인물이 **주식종류·계정별 중복 행** → 이름 기준 합산, '계'(합계) 제외, 상위 8
- **국민연금 거인 라벨**: `nm`에 '국민연금' 포함 → `isLegend`, 표시명 "국민연금공단 (NPS)", 멘탈케어 코멘트("자본시장의 거인이 뒤를 받친다 — 국장 변동성에 흔들리지 말라"). 그 외 최대주주·친인척·계열사 → "설립자 및 핵심 경영진" + "오너와 운명공동체" 코멘트
- 검증: POSCO홀딩스→★국민연금 8.34%(NPS) / 삼성전자→오너 일가 19.7%(삼성생명 8.42%·이재용 1.67%…)
- ⚠️ **하드윈 버그**: corpCode.xml은 `<corp_name>`과 `<stock_code>` 사이에 **`<corp_eng_name>`이 끼어 있음** → 기존 인접 정규식(`corp_name>\s*<stock_code`)이 **전 종목 매칭 실패(mapSize=0)** → KR corp 매핑이 조용히 죽어있었음(내부자 KR도 영향). `<list>` 경계 안 넘는 lazy 매칭 `<corp_code>(\d+)…(?:(?!</list>)[\s\S])*?<stock_code>\s*(\d{6})`로 수정 → 내부자·슈퍼클론 동시 복구
- UI: `ShadowTracker13F.tsx`가 `market`별 분기 — ₩(조/억) 포맷·"지분율"(US는 "비중")·DART 출처 배지·국민연금 행 시안 하이라이트(★거인)

---

## 🏰 해자 붕괴 경보기 — 킬러 기능 11단계 (2026-06-01, 마지막)

해자(경제적 해자)의 본질 = **가격결정력 = 총마진의 높이·지속성**. 4개년 총마진 추세를 보고 최신값이 정점 대비 얼마나 침식됐는지로 견고/균열/붕괴 경보. **리서치 페이지**(개별주식·US+KR).
- **`src/app/actions/getMoatBreach.ts`**(서버액션, 6h 인메모리 캐시) — Yahoo **`fundamentalsTimeSeries(module:'financials', type:'annual')`**로 4개년 매출·매출총이익·영업이익 → 연도별 총마진·영업이익률. + `quoteSummary.financialData`로 현재 ROE·TTM마진
- **`src/app/components/MoatBreachDetector.tsx`** — 총마진 4개년 추세 바(최신=강조색·정점=시안) + 현재 총마진/영업이익률/ROE 3지표 + 매출 YoY + 버핏·린치 코멘트
  - ⚠️ **UI 수정(2026-06)**: 막대 컨테이너 height(92px)<콘텐츠(막대78+%라벨+연도+간격≈110px)라 첫(가장 높은) 막대 %라벨이 위 헤더("해자의 높이")를 침범 → **height 122px로 확대**해 해결
- ⚠️ **핵심 교훈**: Yahoo `quoteSummary.incomeStatementHistory`는 2024.11부터 **grossProfit·operatingIncome를 안 줌(매출만 null 아님)** → **`fundamentalsTimeSeries`가 정답**(US·KR 동일 규격 4개년). lib import는 `const {default:YahooFinance}=await import('yahoo-finance2'); new YahooFinance(...)`. KR은 6자리→`.KS`(코스피) 우선, 빈응답이면 `.KQ`(코스닥) 폴백
- **판정**: `erosion = (4년정점총마진 − 최신총마진)/정점`. ≥20% **붕괴** / ≥8% **균열** / 그외 **견고**. ⭐**경기순환 자동 처리**: 최신값 기준이라 메모리 불황(삼성2023 30%)이 회복(2025 39%=정점)하면 erosion 0%=견고. ⭐**인텔 케이스 격상**: 침식 12%+ & **적자 ROE**(자본파괴 동반)면 붕괴. 적자·총마진<12%는 `early`(판단보류)
- **해자 폭**(절대 총마진): ≥40% wide / ≥25% moderate / ≥12% narrow / 그외 none
- 검증(2026-06): NVDA 56→75→71% 견고(wide) / **INTC 42→35% 침식18%+ROE-2.9% 붕괴** / KO·AAPL·PLTR 견고 / 삼성 37→30→39% **순환회복 견고** / SK하이닉스 35→-1.6→60% 견고 / POSCO 9→7.4% 균열(none·철강 커머디티) / 카카오 GM94% 견고
- ⭐ **환율 무관**: 비율(마진·ROE)이라 KR↔US 직접 비교 가능

---

## 📊 글로벌 페어-트레이딩 시그널 — 킬러 기능 12단계 (2026-06)

"글로벌 1등(US 앵커) 대비 이 종목이 통계적으로 얼마나 과도하게 저평가/고평가됐나"를 **z-score**로. 프롭데스크 상대가치(롱숏) 로직을 교육용으로. **리서치 페이지**(섹터 피어 X-Ray 하단).
- **`src/app/actions/getPairSignal.ts`**(서버액션, 6h 캐시) — Yahoo `chart`(일봉 3년)+`fundamentalsTimeSeries`(연매출)+`quoteSummary`(주식수·현재 P/S·업종)
  - **멀티플=P/S**(Price-to-Sales). ⭐P/E는 적자(EPS<0) 구간에서 깨짐(반도체 사이클) → 매출 기반 P/S 주지표. `P/S(t)=종가×주식수/직전보고 연매출`(trailing, lookahead 없음)
  - **비율=P/S(target)/P/S(anchor)** — 통화·절대수준 무관(둘 다 비율). 일봉 ~700+ 관측 → 평균·σ → 현재 z. 시그널: z≤−2 저평가 괴리 / z≥+2 고평가 프리미엄
  - `ANCHOR_MAP`: Yahoo industry → 글로벌 헤게모니(Semiconductors→NVDA·Consumer Electronics→AAPL·Auto→TSLA·Banks→JPM…). 앵커 없는 업종/대상=앵커 자신이면 graceful
- **`src/app/components/PairTradingMonitor.tsx`** — 기관 터미널 포맷([PAIR TRADING MONITOR]·ANCHOR⟷PEER·평균/현재 비율·z-게이지(−3σ~+3σ)·SIGNAL 배지) + 해설
- ⚠️ **정직성**: ① 평균회귀 보장 없음(밸류 트랩 가능) ② EPS 이력 ~4년이라 '수년'(5년 아님) ③ **|z|>3은 레짐 전환** 가능(단순 과열/소외로 단정 금물 — 코멘트에 명시) ④ 통계적 참고이며 투자추천 아님
- ⚠️ **KOSDAQ(.KQ) 폴백 수정(2026-06)**: KR 종목을 `.KS`(코스피)로만 시도하면 **코스닥 종목 실패**(예: 파두 440110.KQ·대한광통신 010170.KQ → "시계열 불러오지 못함"). `.KS→.KQ` 폴백 추가(업종 있는 쪽 우선) → **`getPairSignal`·`getSectorPeers` 동시 수정**(getMoatBreach는 이미 폴백 보유). 검증: 파두 440110.KQ→Semiconductors→NVDA z=+4.02 정상 계산
- 앵커 확장: 생활용품(PG)·식품(MDLZ)·화학(LIN)·통신장비(CSCO)·신발(NKE)·외식(MCD)·통신(VZ)·할인점(WMT)·산업기계(GE) 추가해 'no_anchor' 감소. 검증: 파두→NVDA z+4.0·두산에너빌리티→GE·SK텔레콤→VZ 정상
- 폴리시(2026-06): ① **한글 조사 자동화**(`josa()` 받침 판별 → "두산에너빌리티와"·"파두가", 영문은 안전표기 유지) ② **KR P/E 폴백**(Yahoo가 .KS/.KQ trailingPE 미제공 → 최근 흑자 EPS로 현재가÷EPS 계산, 단 흑자전환 직후 폭발값 방지 위해 ≤150x만 표시)
- 검증(PoC, 일봉): SK하이닉스 vs NVDA z=+5.2·삼성전자 vs AAPL +4.5·Micron vs NVDA +5.6(메모리 슈퍼사이클 재평가) / **NAVER vs Alphabet −1.3(정상범위)** → 차별화 정상 작동

---

## 🎨 가독성 개선 — 전체 색상 명도·대비 상향 (2026-06)

어두운 다크 배경(`#1a1d27`)에서 서브/보조 텍스트가 WCAG AA(4.5:1) 미달로 안 보이는 문제. **57개 파일 + tailwind.config.ts를 일괄 교체**해 전체 앱 가독성 통일.
- **교체 색상 (배경 `#1a1d27` 기준 대비비)**:
  - `#475569` (2.2:1 ❌) → `#8599ae` (5.7:1 ✅) — `textLow`, 가장 많이 쓰는 서브 텍스트
  - `#334155` (1.6:1 ❌) → `#7a8fa3` (5.0:1 ✅) — 가장 어두웠던 텍스트
  - `#374151` (1.6:1 ❌) → `#7a8fa3` (5.0:1 ✅) — 페이지 직접 하드코딩 색상
  - `#64748b` (3.5:1 ❌) → `#7f93a8` (5.3:1 ✅) — 세 번째로 어두운 서브 텍스트
  - `#6b7280` (3.5:1 ❌) → `#8a9aaa` (5.8:1 ✅)
  - `#4b5563` (2.2:1 ❌) → `#6e7f8f` (4.1:1 ↑)
  - `#9ca3af` (6.6:1 ✅) → `#a8b5c2` (8.1:1) — 이미 OK이나 조금 더 선명하게
- **tailwind.config.ts** `ink` 토큰도 동일하게 상향 (Tailwind 클래스 `text-ink-faint` 등)
- 타입체크 통과 · 빌드 READY · 전체 57개 파일 일괄 적용(grep-replace, git으로 복구 가능)

---

## 🚫 개별주식 전용 가드 (2026-06-01) — ETF·코인·원자재 차단

리서치 페이지의 린치 분석 기능(피터린치 진단 위저드·🕵️CEO장바구니·🤖Jarvis어닝콜·🎧노이즈캔슬러)은 **개별 주식(STOCK)만** 의미가 있음. ETF·코인·원자재는 발행 기업·내부자·EPS가 없어 분석 불가 → 차단.
- **3중 방어**:
  - ① `research/page.tsx`: `getAssetType(ticker,name,market)==='STOCK'` 가드 → 비주식이면 위저드·3개 컴포넌트 미마운트 + `NonStockNotice`("개별 주식 전용 분석입니다") 1회 표시
  - ② 서버액션 백스톱: `getInsiderSignal`·`getAnalystSignal`·`getQualitativeChecks` 진입 시 `getAssetType !== 'STOCK'` → `unsupported`/빈결과 (DART·Gemini 낭비 호출 방지). `getInsiderSignal` 입력에 `name?` 추가
- SSOT는 `@/lib/assetClassifier.getAssetType()` (STOCK/ETF/CRYPTO/COMMODITY). 검증: AAPL·삼성전자=STOCK / SPY·QQQ·KODEX200=ETF / BTC=CRYPTO / GLD·USO=COMMODITY

---

## 🏛️ 국민연금 자산현황 대시보드 (2026-06-01) — 거인의 장바구니

국민연금(NPS) 자산을 한 화면에: ①자산배분 개요 ②🇰🇷국내주식 Top10 ③🇺🇸해외주식 Top10. **대시보드 거시경제 탭**(칵테일 지수 옆).
- **`src/app/api/nps-portfolio/route.ts`**(라우트 핸들러, **`force-dynamic`**·`maxDuration:60`·24h 캐시) — 국내 크롤 ∥ 해외 13F 동시 수집
  - **🇰🇷 국내**: 큐레이션 KOSPI 대형주 ~70 동시성5 크롤 → `majorstock.json` 보고자=국민연금 필터 → 지분율·증감·공시일 + Naver `fchart` 일봉(공시일 종가+현재가) → 평가액·프록시. **Top10**
  - **🇺🇸 해외**: ⭐**국민연금도 SEC 13F-HR 제출!** (CIK **0001608046**, 검증). 기존 슈퍼클론 인프라(Node https + 닫는태그 검증)로 562종목 $132B 파싱 → 발행사명 정규화 합산(Alphabet CL A/C 등) → Top10
- **`src/app/components/NpsPortfolio.tsx`** — 자산배분 스택바 + 국내/해외 2개 표 + 정직성 안내
- ⚠️ **데이터 가용성(검증)**: 국내주식=DART 5%룰 ✅ / 해외주식=SEC 13F ✅ / **채권·대체투자=개별종목 의무공시 없음 → 자산군 비중(집계)만**(공시 기준 참고치 상수)
- ⚠️ **수익률 불가 → 프록시만**: 국민연금은 약식보고라 **종목별 매입단가 미공개**(majorstock에 가격 필드 없음) → 실제 수익률 계산 불가. 대신 **"마지막 공시일 이후 주가변화"** + 공시 시점(YY.MM) 병기 + *실제 NPS 수익률 아님* 명시
- ⚠️ **빌드 함정**: GET()이 인자 없으면 Next가 빌드 시 정적 생성하려다 크롤 타임아웃(SIGTERM) → `export const dynamic='force-dynamic'` 필수
- 검증(2026-06): 국내 SK하이닉스 7.35%·126조 등 61종목 275조 / 해외 NVIDIA $8.9B(6.8%)·Apple $7.9B·Alphabet $6.7B(합산)·MS·Amazon·Broadcom·Meta·Tesla 등 562종목 $132B(13F 2026-05-12)
- ⚠️ ETF(Invesco QQQ·iShares 등)도 13F에 포함돼 해외주식 목록에 노출됨 — 데이터는 정확(NPS 실보유)하나 '개별주식'은 아님(현재 그대로 표시, 필요 시 ETF 태그/필터 선택지 존재)

---

## ⚖️ 황금비율 로드맵 — 6대 분류별 보유 종목 (2026-06-01)

**`src/app/components/PortfolioBalanceRadar.tsx`**(비밀병기①) 하단에 "각 분류에 내 종목이 뭐가 있는지" 목록 추가 — 진단("빠른성장주 56% 과다")만으로는 어떤 종목을 조정할지 모호했던 점 보완.
- 기존 `lynch_category` 분류 데이터를 **재활용**(추가 API·비용 없음) — `useMemo`에서 `byCategory: Record<cat, {ticker,name,value,weight}[]>` 생성(종목별 포트 비중% + 비중 큰 순 정렬)
- UI: 6대 분류를 모두 나열(빈 분류는 "보유 종목 없음" → 균형 공백 한눈에), 분류별 색상 칩(종목명 + 비중%), 줄마다 "{분류비중}% · {n}종목" 표기
- `CATEGORY_COLORS` 맵(대형우량=파랑·빠른성장=초록·경기순환=주황·회생=빨강·자산보유=보라·저성장=회색) 하단 범례와 통일

---

## 🤖 Jarvis 모닝 포트폴리오 처방전 — 1단계(백엔드 파이프라인+DB) (2026-06)

매일 새벽 Cron이 전체 학생의 보유 종목을 순회하며 정량 룰로 SELL/BUY 시그널을 판정하고, 발동 종목에 한해 Gemini로 'Jarvis' 3문장 브리핑 + 동일업종 대안을 생성해 DB에 적재.
- **`src/app/api/cron/morning-briefing/route.ts`**(`force-dynamic`·`maxDuration:300`·매일 20:00 UTC=05:00 KST) — 전체 `investments` 로드 → 개별주식만(assetClassifier) → **종목 디듀프**(지표·내부자·브리핑 종목당 1회) → 학생별 시그널 판정 → `user_daily_briefings` upsert(`onConflict user_id,base_date,ticker`). `CRON_SECRET` 설정 시 검증. 전 단계 try/catch(한 종목/학생 실패해도 배치 지속)
- **`src/lib/jarvisBriefing.ts`** — `buildSignalMetrics`(Yahoo PEG·영업이익률·분기추세·FCF·ROE, 종목별 12h app_cache, KR .KS→.KQ 폴백) · `evaluateSignal`(순수 룰) · `recentInsiderAccumulation`(getInsiderSignal 30일 매집) · `getRecommendations`(getSectorPeers 동일업종 저PEG 대안) · `generateBriefing`(Gemini Jarvis 페르소나 + **결정론적 폴백**)
- **룰**: SELL=PEG>2.2 ∥ 영업이익률 2분기 연속 하락 ∥ FCF 적자 / BUY=(우량·고성장 & PEG<0.8) ∥ 최근 30일 내부자·대주주 매집
- **`src/lib/gemini.ts`** — 모델 폴백체인(`getEarningsInsight` 검증 체인 추출) JSON 호출. 키없음/429/에러 graceful
- ⚠️ **필수 SQL(1회)** — `user_daily_briefings`(아래) 생성해야 적재됨(없어도 배치는 graceful skip)
- 검증(2026-06, 실제 실행): users 5·holdings 73·stocks 45·uniqueTickers **37**·SELL 24·BUY 4·HOLD 17·**errors 0**·80s → 테이블 생성 후 **written 28**(재실행 18s, 캐시히트)
- **2단계 UI**: **`src/app/components/JarvisMorningBriefing.tsx`** — 대시보드 `live`탭. RLS로 본인+최신 base_date 브리핑 조회 → 시그널 배지(SELL/BUY)·제목·3문장·대안 칩
- **2단계 고도화(2026-06)**:
  - ⭐ **대안 필터 엄격화**: `getRecommendations(…, targetPeg)`에 **대안 PEG < 현재종목 PEG** 조건. 타겟 PEG는 **브리핑이 표시하는 값(buildSignalMetrics)** 우선(일관성), 불명 시 추천 안 함. 검증: ETN(PEG 3.02) 대안에서 Parker-Hannifin(3.31) 제외, Emerson(1.84)·Cummins(1.59)만. (※브리핑 PEG=`defaultKeyStatistics.pegRatio`, 섹터피어 X-Ray PEG는 별도 fetchMetric값이라 소수점 차이 있을 수 있음 — 각 기능 내부는 일관)
  - **개인화 검증**: 브리핑은 cron이 `user_id`별로 적재 + UI가 `.eq('user_id')`/RLS로 본인만 조회 → 전체 마스터 아님. 실측 leak 0 (5명 전원 보유종목과 1:1 일치)
  - **1일1회 가드레일**: **팝업 모달**(createPortal) 하루 1회 자동 오픈(localStorage `jarvis-brief-seen`=base_date). X·배경·ESC·**[오늘 하루 그만 보기]** 버튼 모두 플래그 갱신 → 당일 재로그인/새로고침 시 자동팝업 안 뜸. 재진입은 `live`탭 상단 칩(언제든 다시 열기)
  - 캐시 키 버전(`jarvis-brief-v3`)으로 로직 변경 시 브리핑 재생성
  - ⚠️ **PEG 불일치 버그 수정(2026-06)**: 같은 종목 PEG가 화면마다 달랐음(SK하이닉스 분석화면 0.09 vs 브리핑 3.34). 원인 = **PEG 계산 SSOT 불일치** — stock-info(분석화면)는 `PER/성장률`(KR은 Naver PER) 우선, briefing/getSectorPeers는 Yahoo `pegRatio` 우선(Yahoo는 KR trailingPE 미제공). → **`buildSignalMetrics`가 stock-info의 PEG를 SSOT로 사용**(selfBase로 `/api/stock-info` 호출, 20s 타임아웃, 지표수집 병렬 동시성6). 검증: 삼성 0.56·NVDA 0.53·PLTR 0.68·ETN 4.86 전부 분석화면과 일치. (부수효과: SK하이닉스 PEG 0.09 → SELL 미발동·HOLD)
  - ⚠️ **잔존행 버그**: 룰 변경으로 SELL→HOLD된 종목의 옛 SELL 행이 안 지워짐 → 크론이 매 실행 시 **당일(base_date) 행을 먼저 delete 후 재적재**(idempotent). 캐시 무효화는 키 버전(metrics-v3·brief-v5) + 필요시 `app_cache` ilike 삭제
  - ⭐ **PEG 전 화면 통일(SSOT, 2026-06)**: "같은 종목은 어느 화면에서든 동일 데이터"가 기본 원칙. **`src/lib/canonicalFundamentals.ts`**(`getCanonicalPeg`)가 **stock-info를 단일 출처**로, 종목별 `app_cache(canon-fund:CODE:MKT, 6h)`에 캐시 → 모든 기능이 같은 캐시 공유. 적용: **buildSignalMetrics(브리핑)·getSectorPeers(섹터피어 target+peers 전부)**. 분석화면·AI멘토·린치밸류에이션은 이미 stock-info(dMap.peg) 우선. getSectorPeers는 `headers()`로 base 구해 호출. Yahoo는 KR trailingPE 미제공으로 폴백만. 검증: SK 0.09·MU 0.05·NVDA 0.53·삼성 0.56가 전 화면 동일
  - ⭐ **일시 폴백까지 제거(2026-06)**: 대시보드 prep(AIPortfolioDashboard·LynchSellSignalPanel)의 **Yahoo(priceMap) PEG/PER/성장률 폴백 삭제** → stock-info(dividendMap) 로드 전엔 0(로딩), Yahoo값을 잠깐도 안 띄움. 터미널들(어닝·밸류에이션)은 이미 `div.peg`(stock-info)만 사용. **표시되는 모든 PEG = stock-info SSOT 단일 출처**
  - ⓘ `lynch-classify`의 Yahoo pegRatio는 6대 분류 '판정 로직'(저장값)일 뿐 화면에 PEG 숫자로 표시되지 않음. stock-price 라우트의 peg는 더 이상 표시에 미사용

```sql
create table if not exists public.user_daily_briefings (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  base_date       date not null,
  signal_type     varchar(8) not null check (signal_type in ('SELL','BUY','HOLD')),
  ticker          varchar(20) not null,
  stock_name      varchar(120),
  briefing_title  varchar(200),
  briefing_content text,
  recommendations jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, base_date, ticker)
);
create index if not exists idx_briefings_user_date on public.user_daily_briefings (user_id, base_date);
alter table public.user_daily_briefings enable row level security;
create policy "own briefings read" on public.user_daily_briefings for select using (auth.uid() = user_id);
```

---

## 🏫 투자학교 13F 인덱스 (School Insider Flow) (2026-06)

학생 전원의 집단지성을 **동일가중·익명 인덱스**로 결합. 새벽 Cron 집계(1단계) + 대시보드 UI(2단계).
- **1단계**: **`src/lib/schoolIndex.ts`**(순수 집계) + **`src/app/api/cron/school-index/route.ts`**(Cron, `0 19 * * *`=04:00 KST, maxDuration 120). 두 스냅샷 테이블 적재(`school_index_stock_snapshots`·`_sector_snapshots`)
  - ⭐ **동일가중**: 개인별 포트폴리오 내 비중(%) → 보유자 평균(예: A 40%·B 10% → 25%). 절대금액 합산 아님(자산가 왜곡 방지)
  - ⭐ **익명성**: 2명 이상 공동보유만 개별 노출. **단독보유는 `ETC`(기타자산)로 합산**(개인 식별 차단)
  - **분모=전 자산**(주식+ETF+코인) '전체 자산 중' 비중. 인덱스엔 STOCK만 편입 → 섹터 합 <100%(=학교 평균 주식배분)
  - weight_change=직전 base_date 대비. 학생별 try/catch 격리. GICS 섹터는 Yahoo assetProfile(종목 7일 캐시)
- **2단계 UI**: **`src/app/components/SchoolIndexDashboard.tsx`**(대시보드 `schoolflow` 탭=투자리서치›🏫학교 13F 인덱스). 3대 위젯: ①섹터 파이(Recharts·잔여=현금성/ETF) ②Top Picks 테이블(순위·비중·보유수·▲빨강/▼파랑 변동) ③스마트머니(매집/축소 카드). 로딩=스켈레톤·빈데이터=폴백
- ⚠️ **RLS 함정 → 서비스롤 API 서빙**: 클라이언트 RLS 조회가 막혀(정책 미적용/`auth.role()` 매칭실패) 데이터 있어도 빈 결과 → **`src/app/api/school-index/route.ts`**(service role, RLS 무관)로 전환. 익명 집계라 안전
- 검증(2026-06): ETC 41.36%(4명)·SK하이닉스 20.26%(3명)·삼성전자 15.62%(2명)… / Tech 34%·Financial 9.5% · 익명성(개별 전부 ≥2명) ✅

---

## 🛡️ 운영 강화 — 콜드미스/타임아웃 방어 (2026-06-01, 기술컨설팅 반영)

무거운 크롤(13F ~12s · 국민연금 ~24s)이 **콜드미스 시 학생 첫 화면을 지연**시키고, 인메모리 캐시는 **인스턴스별 미공유·재시작 시 소실** → 인스턴스마다 중복 크롤. 이를 **3계층 캐시 + 크론 사전 워밍**으로 방어.
- **3계층 캐시**: L1 인메모리(빠름) → **L2 DB(`app_cache`, 전 인스턴스 공유·콜드스타트 생존)** → 크롤. `src/lib/appCache.ts`의 `getCache/setCache`. 모두 **graceful**(테이블/크레덴셜 없으면 조용히 폴백 → 무중단)
  - 적용: `nps-portfolio`(key `nps-portfolio`, 24h) · `shadow-13f` 펀드보유내역(key `shadow-13f-funds`, 12h)
- **Vercel Cron 사전 워밍**(`vercel.json` `crons`): 매일 03:00 KST(`0 18 * * *` UTC)에 `/api/nps-portfolio`·`/api/shadow-13f` 호출 → **크론이 콜드 크롤을 대신 수행하고 DB를 채움** → 학생은 항상 L2 DB에서 즉시 응답(콜드 크롤 안 맞음)
- ⚠️ **필수 1회 작업(Supabase SQL)** — `app_cache` 테이블 생성해야 L2가 작동(없어도 기존 인메모리로 무중단 동작):
  ```sql
  create table if not exists app_cache (
    key text primary key,
    payload jsonb not null,
    updated_at timestamptz not null default now()
  );
  ```
- **Gemini 중복호출 방어(이미 구현 확인)**: `getEarningsInsight`는 **MEM(L1)→`earnings_insights` DB(L2)→Gemini** 순으로 DB를 AI 호출보다 먼저 확인 중. (추가 여지: 어닝시즌 상위 종목 Eager Caching = 향후 배치)

---

## 견고성 인프라 (2026-05-31)

### `scripts/dev.js` — 안전한 dev 서버 시작
`npm run dev` → ① 포트 3000 프로세스 종료 → ② `.next` 완전 삭제 → ③ **3초 안정화 대기** → ④ `fork(next/dist/bin/next)` 직접 실행
- `npm run build` 후 dev 실행 시 발생하던 webpack 청크 충돌(흰 화면) 근본 차단
- `npm run check` (tsc + lint, `.next` 건드리지 않음) — 로컬 검증은 build 대신 이걸로

### `ErrorBoundary.tsx` — 탭별 에러 격리
컴포넌트 크래시 → 전체 흰 화면 대신 해당 탭만 "⚠️ 재시도" 표시

---

## 로그인/인증 개선

### 비밀번호 재설정 버그 수정 (2026-05-29)
- **원인**: `onAuthStateChange`가 `PASSWORD_RECOVERY` 이벤트를 처리하지 않음
- **수정**:
  1. `PASSWORD_RECOVERY` 이벤트 → `isRecoveryMode = true` → 새 비밀번호 입력 UI 표시
  2. `?type=recovery` URL 파라미터 감지 처리
  3. `updateUser({ password })` → 성공 시 3초 후 로그인 화면 복귀
- **관리자 기능 추가**: `/admin` 학생 목록에 "🔑 비번 재설정" 버튼 추가
  - teacher 계정에서 클릭 시 해당 학생 이메일로 재설정 링크 즉시 발송

---

## API 엔드포인트 상세

### 기존 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| `GET/POST /api/stock-price` | 주가 조회 (배치 최대 50개) |
| `GET /api/stock-info` | 종목 상세 + PE·PEG·EPS·배당 |
| `GET /api/stock-price-history` | 5년 연간 주가 이력 (Lynch 차트용) |
| `GET /api/market-indices` | 글로벌 시장 지수 6개 |
| `GET /api/exchange-rate` | USD/KRW 환율 |
| `GET /api/financials` | 재무제표 (FMP US + DART KR) — EPS 연간 이력 포함 |
| `GET /api/lynch-classify` | 피터린치 종목 자동 분류 |
| `POST /api/lynch-batch` | 미분류 종목 일괄 분류 |

### 신규 엔드포인트 (2026-05-29 기준)
| 엔드포인트 | 설명 |
|---|---|
| `GET /api/fred` | FRED API 프록시 (API Key 서버 보호, 12시간 캐시) |
| `GET /api/fedwatch` | CME FF Futures → FOMC별 금리 확률 분포 계산 |
| `GET /api/lynch-eps-history` | Phase 3 EPS 분기 이력 배치 (forwardEPS + revenueGrowth + EPS이상값방어) |
| `GET /api/macro-fundamentals` | Phase 2 재무 기초 배치 (실데이터: epsGrowth·revenueGrowth·debtRatio) |
| `GET /api/school-league` | 전체 학생 포트폴리오 집계 (service_role) |
| `POST /api/migrate-asset-roles` | asset_role 전체 소급 재분류 |
| `POST /api/admin/delete-user` | 학생 계정 삭제 (teacher 전용) |

---

## Supabase 데이터베이스

### 테이블 목록
| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `profiles` | 사용자 프로필 | `id, email, full_name, role('teacher'|'student')` |
| `investments` | 보유 종목 | `user_id, ticker, name, market, currency, purchase_price, quantity, purchase_date, lynch_category, asset_role('CORE'|'SATELLITE')` |
| `transactions` | 거래 내역 | `user_id, investment_id, ticker, type('buy'|'sell'), price, quantity, realized_pnl` |
| `watchlist` | 관심 종목 | `user_id, ticker, name, market` |
| `lounge_posts` | 게시글 | `user_id, author_name, content, is_admin_post` |
| `lounge_comments` | 댓글 | `post_id, user_id, content` |
| `notices` | 공지사항 | `title, content, tag` |
| `strategy_configs` | 최일 전략 설정 | `core_pct, satellite_pct, core_stocks[], pdf_url` |
| `earnings_insights` | 🤖 Jarvis 어닝 분석 캐시 | `ticker, quarter, summary_text(JSON), sentiment_score, created_at` · PK(ticker,quarter) |
| `insider_signals` | 🕵️ CEO의 장바구니(내부자 매수) 캐시 | `ticker(PK), cluster, buyer_count, total_value, payload(JSON), as_of` · 24h 신선도 |

### 현재 학생 현황 (2026-05-29 기준)
| 이름 | 이메일 | 종목 등록 | 비고 |
|------|--------|----------|------|
| 김상균 | lindows70@gmail.com | 19개 | teacher 겸임 |
| 이근행 | rmsgod00@naver.com | 25개 | |
| 유 | yjy7575@naver.com | 3개 | |
| 이민행 | alsgod00@naver.com | 3개 | |
| 송승규 | sksean23@naver.com | 0개 | 미등록 |
| 김선아 | def72@naver.com | 0개 | 미등록 |
| Elena YU | elenayu.mit@gmail.com | 0개 | 비밀번호 재설정 이슈 해결 완료 |

---

## 환경 변수

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://jfqhriwgnlopxewdocpr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 서버 전용

# 외부 API
FMP_API_KEY=...          # Financial Modeling Prep (미국 재무 + EPS)
DART_API_KEY=...         # DART OpenAPI (한국 재무 + EPS)
FRED_API_KEY=...         # St. Louis Fed (인플레이션·금리·QT 데이터)
ALPHA_VANTAGE_API_KEY=...
GEMINI_API_KEY=...       # 🤖 Jarvis 어닝콜 애널리스트 (Gemini 2.5 Flash-Lite 무료 티어, 서버 전용)
```

**Vercel 환경변수 추가 필수**: `FRED_API_KEY` (서버 사이드 전용, `NEXT_PUBLIC_` 없음)

---

## 제1원칙: 데이터 하드코딩 금지

> **어떤 학생이 어떤 종목을 입력하더라도 동일한 원칙으로 분석**

- 모든 종목 목록은 `investments` DB에서 동적 파생
- ETF·원자재·코인 필터: `assetClassifier.getAssetType()` SSOT 사용
- Lynch 멀티플: `lynchAnalysis.calcFairMultiple()` SSOT 사용
- EPS 이상값 방어: `lynchAnalysis.sanitizeEps()` SSOT 사용
- 카테고리별 하드코딩 데이터 (beta, PEG 등) 완전 제거
- API 폴백만 허용 (FRED 폴백 macroData.ts 등 공공 데이터)

---

## 제2원칙: 모든 재무 데이터는 같은 종목이면 전 화면에서 동일한 값이어야 한다

> **"PEG가 화면마다 다르면 학생은 무엇을 믿어야 하는가?" — 데이터 신뢰성의 기본**

같은 종목의 PEG·PER·성장률·영업이익률 등 재무 지표가 분석화면·브리핑·섹터피어·밸류에이션 등 화면마다 다르게 나오면 학생이 혼란에 빠지고 앱 전체의 신뢰가 무너진다.

### 원칙

1. **단일 출처(SSOT)**: 모든 재무 지표는 반드시 하나의 계산 로직에서 나와야 한다. 같은 지표를 두 곳에서 다르게 계산하는 것은 버그다.
2. **공유 캐시**: SSOT에서 계산한 값은 `app_cache`에 저장해 모든 기능이 같은 캐시를 읽는다. 같은 종목을 여러 기능이 독립적으로 계산하는 것 금지.
3. **폴백은 SSOT 내부에서만**: 데이터 소스 폴백(FMP→Yahoo→Naver 등)은 SSOT 함수 내부에서만 처리. 호출부가 직접 다른 소스를 시도하는 것 금지.
4. **표시값 = 저장값 = 비교값**: 화면에 보이는 값, DB에 저장되는 값, 룰 판정에 쓰이는 값이 모두 동일해야 한다.

### 현재 구현 (2026-06-03 기준)

| 지표 | SSOT 소스 | 캐시 키 | 적용 화면 |
|---|---|---|---|
| **PEG** | `canonicalFundamentals.ts` → `/api/stock-info` | `canon-fund:TICKER:MKT` (6h) | 분석·브리핑·섹터피어·AI멘토·밸류에이션·매도시그널 |
| **PER** | `/api/stock-info` (US=FMP/Yahoo, KR=Naver) | stock-info 내부 캐시 | 전 화면 |
| **EPS·성장률** | `/api/stock-info` → `dividendMap` → 컴포넌트 | stock-info 내부 캐시 | 전 화면 |
| **총마진·OM** | Yahoo `fundamentalsTimeSeries` | `jarvis-metrics-v3:*` (12h) | 해자경보기·브리핑 |
| **P/S 시계열** | Yahoo `chart` + `fundamentalsTimeSeries` | `getPairSignal` 6h 캐시 | 페어-트레이딩 |

### 위반 시 대응 절차

1. **증상 발견**: 같은 종목 동일 지표가 화면 A≠화면 B
2. **소스 트레이스**: 두 화면이 각각 어느 API/라이브러리에서 값을 가져오는지 확인
3. **SSOT 지정**: 더 신뢰할 수 있는 소스를 SSOT로 결정 (KR=Naver PER 우선, US=FMP→Yahoo)
4. **캐시 통합**: SSOT 값을 `app_cache`에 저장, 나머지 호출부를 캐시 조회로 교체
5. **캐시 버전 업**: 기존 잘못된 값이 캐시에 남지 않도록 캐시 키 버전 증가 (e.g., `v3`→`v4`)
6. **CLAUDE.md 기록**: 어떤 지표가 어디서 깨졌고 어떻게 통일했는지 상세 기록

### 알려진 한계 (정직하게)

- `lynch-classify`의 Yahoo `pegRatio`는 **6대 분류 판정 로직**에만 사용 (화면 표시 X, 지표 표시와 분리)
- `stock-price` 라우트의 `peg` 필드는 **표시 미사용** (가격 전용 라우트로 분리)
- 유럽 종목(EUR, GBP)은 미지원 — 현재 US/KR만 SSOT 보장

---

## DB 업데이트 원칙

- `upsert` 사용 금지 → `update().eq()` 사용 (NOT NULL 컬럼 보호)
- 배치: `Promise.all()` 병렬 (30개 단위 권장)
- Lynch 분류: DB `lynch_category` 값이 알고리즘보다 항상 우선
- **`lynch_category` check constraint**: 6대 분류만 허용 (`slow_grower`·`stalwart`·`fast_grower`·`cyclical`·`turnaround`·`asset_play`) + null. **`na` 저장 불가** → ETF는 null

---

## 피터린치 6대 분류 알고리즘 (2026-05-31 전면 교정)

### `/api/lynch-classify` — `classify()` 9단계 우선순위

> **정통 6대 분류 통일**: '완만한 성장주' 명칭 완전 제거 → '저성장주'로 마이그레이션 (7개 파일 + SSOT)

```
① 부동산·리츠 → 자산주
② PER<0 또는 이익<-10% → 회생주
③ 통신·유틸리티 섹터 → 저성장주
④ 경기민감 섹터 → 경기순환주
   └ ★ 반도체·조선/기자재는 시총·성장률 무관 무조건 cyclical (삼성전자 포함)
   └ 그 외 사이클 섹터는 25%+ 초고성장이면 빠른성장주
⑤ EPS/매출 20%+ → 빠른성장주
⑥ 거대 시총(5B+) → 대형우량주 (고배당+저성장이면 저성장주)
⑦ 중소형 고배당 → 저성장주
⑧ PEG 폴백
⑨ 기본값 = stalwart (★ 과거 소형주→fast_grower 남발 버그 수정)
```

**섹터 세분화 (KR_INDUSTRY):**
- `통신` → Telecommunications (저성장) / `전력·가스·발전·난방·수도` → Utilities (저성장)
- `반도체` → Semiconductors / `가전·디스플레이` → Consumer Durables / `자동차` → Auto / `철강` → Steel / `화학` → Chemical (전부 경기민감)
- `보험·화재·생명` → Financial Services (우량주)

**하드코딩 보강:** 적자 매출고성장 신생(TEM·IONQ·RGTI 등 AI/양자) → fast_grower / 에너지·반도체(OXY·TXN·COHR) → cyclical / 적자회생(PLUG·FCEL) → turnaround

### 전체 학생 DB 재분류 결과 (2026-05-31)
- **Before**: 개별주식 46개 중 28개(78%)가 fast_grower 오분류 🚨
- **After**: 저성장주 2 · 대형우량주 7 · 빠른성장주 10 · 경기순환주 16 · 회생주 1 · 자산보유주 1 = **37개 100% 분류 완료**
- 재분류 스크립트(service_role PATCH)로 14개 종목 교정 (삼성전자→cyclical, SK텔레콤→slow, LG전자→cyclical, 삼성화재→stalwart 등)
- **데이터 오류 수정**: TSLL(레버리지 ETF)의 이름이 "TENARIS SA ADR"로 잘못 저장됨 → 정정 + `assetClassifier`에 레버리지 ETF 티커(TSLL·NVDL·SOXL 등) 등록하여 개별주식 분석 제외

---

## 외부 데이터 소스

| 서비스 | 용도 | 비용 | 제한 |
|--------|------|------|------|
| Naver 증권 | KR 실시간 주가 | 무료 | Rate limit |
| Yahoo Finance v8 | US 주가·지수·차트 | 무료 | 401 차단 가능 |
| FMP | 미국 재무제표 + EPS | 무료 250회/일 | |
| DART OpenAPI | 한국 사업보고서 + EPS | 무료 10,000회/일 | |
| FRED API | 인플레이션·금리·QT | 무료 120,000회/일 | 서버사이드 전용 |
| CME FF Futures (Yahoo) | 금리 확률 (FedWatch) | 무료 | 30분 캐시 |
| 업비트 API | 암호화폐 KRW 시세 | 무료 | |

---

## 코딩 컨벤션

- 거의 모든 페이지 `'use client'` (서버 컴포넌트 최소화)
- 인라인 style 객체 + Tailwind 클래스 혼용 (dark-mode 전용 커스텀 컬러)
- `any` 타입 사용 시 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 필수
- Supabase 쿼리는 항상 `error` 핸들링
- **Lynch 계산**: 반드시 `@/lib/lynchAnalysis` SSOT 함수 사용
- **자산 분류**: 반드시 `@/lib/assetClassifier.getAssetType()` 사용
- 차트: 포트폴리오→Recharts, 금융캔들→lightweight-charts

---

## 개발 명령어

```bash
npm run dev         # ★ 안전 시작 (scripts/dev.js: 포트종료+.next삭제+3초대기+fork)
npm run dev:quick   # 빠른 시작 (.next 정리 없이 next dev 직접)
npm run build       # 프로덕션 빌드
npm run check       # ★ 타입체크 + lint (로컬 검증용 — .next 안 건드림)
npm run lint        # ESLint
npx vercel --prod --yes  # Vercel 프로덕션 배포 (원격 빌드 — 로컬 .next 무관)
```

**주의**:
- `npm run dev` 는 `scripts/dev.js`로 포트3000 종료 → `.next` 삭제 → 3초 대기 → 시작 (캐시 충돌 근본 차단)
- **로컬에서 `npm run build` 지양** → dev 서버의 `.next`를 덮어써 흰 화면 유발. 검증은 `npm run check` 사용
- 배포는 항상 `npx vercel --prod --yes` (Vercel 원격 빌드)

---

## 📐 포트폴리오 상관관계 매트릭스 (2026-06-03)

금융 터미널급 기능. 보유 주식 간의 60일 일별 수익률 **피어슨 상관계수(r)**를 히트맵으로. 대시보드 **자산&모니터링 → 📐 상관관계 매트릭스** 탭.
- **`/api/correlation-matrix`** (Supabase auth 필수·maxDuration:60·24h 개인 캐시):
  - investments에서 STOCK만 필터(`assetClassifier`)
  - US=Yahoo Finance v8 chart(1d, 3mo), KR=Naver fchart(day, 65개) 일봉 종가 수집 (동시성5)
  - 일별 수익률: `(종가[t]-종가[t-1])/종가[t-1]`
  - 피어슨 r: `Σ(xi-x̄)(yi-ȳ) / (n-1)σxσy`. 공통 거래일 10일 미만 쌍은 null
  - 결과를 `app_cache(corr-matrix:USER_ID:DATE, 24h)` — 학생별 개인 캐시
- **`CorrelationMatrix.tsx`**: 정방형 히트맵. 셀 색상: r≥0.7=짙은빨강·0.5~0.7=주황·0.3~0.5=옐로우·0.1~0.3=청색·<0.1=에메랄드·대각선=회색. 호버 툴팁(종목명×r값). 종목 수에 따라 셀 사이즈 자동 조정(≤6: 62px / ≤10: 50px / 11+: 42px)
- **리스크 진단**: 평균 r 표시 + r≥0.7이면 **⚠️ 가짜 분산투자 경고** 카드 노출(피터 린치 인용구)
- ⚠️ **인증 필수(401 가드)**: 개인 포트폴리오 데이터라 미로그인 시 401 반환
- 검증: 완전 양의 상관=1.0·완전 음의 상관=-1.0·NVDA-like×AAPL-like=0.992 ✅

---

## 📈 린치 이익선 트레이서 (Lynch Earnings Line Tracer) (2026-06)

역사적 연간 EPS × 이익선과 주가의 이격도를 추적. 대시보드 **린치 가치평가 → 🔭 이익선 트레이서** 탭(독립 티커 입력, 포트폴리오 무관).
- **`/api/lynch-earnings-tracer`** (maxDuration:45·48h 캐시): `GET ?ticker=&market=`
  - 제1·2원칙 준수: EPS는 **기존 `/api/financials` 재사용**(US=FMP/Yahoo, KR=DART/Naver) — 중복 계산 없음
  - 연간 평균 주가: Yahoo v8 chart(10yr, 월봉) → 연평균
  - 린치 기본 이익선 = EPS × 15 / 역사적 중앙값 이익선 = EPS × 5년 중앙 PER
  - 연도별 이격도(Gap%) = (주가−이익선)/이익선×100 · 적자(EPS<0) 구간 표시 · EPS=0(미집계) 연도 건너뜀
  - 캐시 48h(역사적 EPS는 자주 안 바뀜) · assetClassifier로 STOCK만 허용
- **`LynchEarningsLineTracer.tsx`**: ComposedChart(Recharts) · 저평가=초록 음영(주가<이익선) · 고평가=빨강 음영 · 중앙값 PE선 토글 · 연도별 이격도 테이블 · KPI 카드 · 린치 코멘트 · 적자 폴백 안내
- 검증(2026-06): NVDA 중앙PER 89x·삼성전자 KRW 12.77x·이격도 계산 정상 ✅

---

## 📐 PEG 전 화면 단일 진실원(SSOT) 통일 (2026-06-03)

"같은 종목은 어느 화면에서든 동일한 PEG" — `src/lib/canonicalFundamentals.ts` 중심으로 전 기능 정렬.
- **근본 원인**: PEG 계산이 화면마다 달랐음. stock-info(분석화면)는 `PER/성장률`(KR=Naver PER), getSectorPeers·briefing은 Yahoo `pegRatio`(Yahoo는 KR trailingPE 미제공 → 대비 불가). SK하이닉스 분석화면 0.09 vs 브리핑 3.34 등 전면 불일치.
- **SSOT 구조**: `getCanonicalPeg()` → `/api/stock-info` → `app_cache(canon-fund:CODE:MKT, 6h)`. **모든 기능이 동일 캐시 공유**
- **적용 범위**:
  - `jarvisBriefing.ts` (브리핑 지표) → `getCanonicalPeg` 사용
  - `getSectorPeers.ts` (섹터 피어 target+peers 전부) → `fetchMetric`에 base 전달, SSOT 우선
  - 대시보드 AI멘토·매도시그널 prep → **Yahoo(priceMap) PEG 폴백 완전 제거** (stock-info 로딩 전엔 0으로 대기, Yahoo값 임시 표시 안 함)
  - 어닝 터미널·린치 밸류에이션 → 이미 `div.peg`(stock-info) 전용
- **잔존**: `lynch-classify`의 Yahoo pegRatio는 6대 분류 판정 로직용(화면 표시 X), `stock-price`의 peg는 표시 미사용

---

## 🤖 Jarvis 모닝 포트폴리오 처방전 (2026-06)

매일 새벽 Cron이 전체 학생 보유 종목을 순회해 정량 룰로 SELL/BUY 시그널을 판정하고 Jarvis 3문장 브리핑 생성.

### 1단계 — 백엔드 파이프라인
- **`src/lib/jarvisBriefing.ts`**: `buildSignalMetrics`(PEG SSOT·Yahoo 지표·분기 영업이익률 추세·FCF·ROE, 12h 캐시), `evaluateSignal`(순수 룰), `recentInsiderAccumulation`(30일 매집), `getRecommendations`(동일업종 저PEG 대안, **대안 PEG < 현재 PEG 엄격 조건**), `generateBriefing`(Gemini Jarvis 페르소나 + 결정론적 폴백)
- **룰**: SELL = PEG>2.2 ∥ 영업이익률 2분기 연속 하락 ∥ FCF 적자 / BUY = (우량·고성장 & PEG<0.8) ∥ 30일 내부자 매집
- **`/api/cron/morning-briefing`** (`force-dynamic`, maxDuration:300, 매일 05:00 KST): 전체 investments 로드 → 개별주식만 → **종목 디듀프**(종목당 지표·내부자·브리핑 1회) → **지표 수집 병렬(동시성6)** → 당일 행 삭제 후 재적재(idempotent) → `user_daily_briefings` upsert
- **PEG SSOT**: `buildSignalMetrics`가 `/api/stock-info`(selfBase) 호출 → KR PEG 불일치 해결
- 검증: users 5·holdings 73·stocks 45·uniqueTickers 37·SELL 22·BUY 10·HOLD 13·**errors 0**·93s

### 2단계 — 팝업 모달 UI
- **`src/app/components/JarvisMorningBriefing.tsx`**: `createPortal` 기반 팝업 모달. 하루 1회 자동 오픈(localStorage). X·배경·ESC·**[오늘 하루 그만 보기]** 버튼 모두 localStorage 날짜 플래그 갱신. 닫으면 작은 칩으로 재호출.
- **대안 필터 버그 수정**: Parker-Hannifin(3.31)이 ETN(3.02) 대안으로 나오던 버그 → `targetPegIn` 인자로 브리핑 PEG 기준 **엄격 필터**
- **개인화 검증**: 크론이 user_id별 적재 + UI가 `.eq('user_id')` + RLS → 전원 본인 보유종목 1:1 일치(leak 0)

### 필수 SQL
```sql
create table if not exists public.user_daily_briefings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  base_date date not null, signal_type varchar(8) not null check (signal_type in ('SELL','BUY','HOLD')),
  ticker varchar(20) not null, stock_name varchar(120), briefing_title varchar(200),
  briefing_content text, recommendations jsonb, created_at timestamptz not null default now(),
  unique (user_id, base_date, ticker));
create index if not exists idx_briefings_user_date on public.user_daily_briefings (user_id, base_date);
alter table public.user_daily_briefings enable row level security;
create policy "own briefings read" on public.user_daily_briefings for select using (auth.uid() = user_id);
```

---

## 🏫 투자학교 13F 인덱스 — School Insider Flow (2026-06)

학생 집단지성을 **동일가중·익명 인덱스**로 결합. 대시보드 투자리서치 탭 `schoolflow`.

### 1단계 — 집계 파이프라인
- **`src/lib/schoolIndex.ts`**: `aggregateSchoolIndex`(동일가중, ETC 익명화, GICS섹터), `getSector`(Yahoo 7일 캐시)
- **동일가중**: 개인별 포트폴리오 내 비중(%) → 보유자 평균. 절대금액 합산 아님(자산가 왜곡 방지)
- **익명성**: ≥2명 공동보유만 개별 노출. 단독보유 → `ETC`(기타자산) 합산
- **분모=전 자산**(주식+ETF+코인). weight_change=직전 base_date 대비
- **`/api/cron/school-index`** (`force-dynamic`, maxDuration:120, `0 19 * * *`=04:00 KST): 두 스냅샷 테이블 upsert

### 2단계 — 대시보드 UI
- **`src/app/components/SchoolIndexDashboard.tsx`**: ① 섹터 파이(Recharts·도넛·잔여=현금성/ETF) ② Top Picks 테이블(ETC는 맨 아래, 실종목 1~7위) ③ 스마트머니(매집/축소 카드)
- **`/api/school-index`** (service role, RLS 무관) — 클라이언트 RLS 조회가 막혀 서비스롤로 전환
- 검증: ETC 41.36%(4명)·SK하이닉스 20.26%(3명)·삼성전자 15.62% / Tech 34.09%·Financial 9.5% · 익명성(전부 ≥2명) ✅

### 필수 SQL
```sql
create table if not exists public.school_index_stock_snapshots (
  id bigint generated always as identity primary key,
  base_date date not null, ticker varchar(24) not null, stock_name varchar(120),
  gics_sector varchar(64), avg_weight numeric(6,2) not null default 0,
  student_count int not null default 0, weight_change numeric(6,2) not null default 0,
  created_at timestamptz not null default now(), unique (base_date, ticker));
create index if not exists idx_sis_stock_date on public.school_index_stock_snapshots (base_date);
create table if not exists public.school_index_sector_snapshots (
  id bigint generated always as identity primary key,
  base_date date not null, gics_sector varchar(64) not null,
  avg_weight numeric(6,2) not null default 0, created_at timestamptz not null default now(),
  unique (base_date, gics_sector));
create index if not exists idx_sis_sector_date on public.school_index_sector_snapshots (base_date);
alter table public.school_index_stock_snapshots enable row level security;
alter table public.school_index_sector_snapshots enable row level security;
create policy "read stock index" on public.school_index_stock_snapshots for select using (auth.role()='authenticated');
create policy "read sector index" on public.school_index_sector_snapshots for select using (auth.role()='authenticated');
```

---

## 🏛️ 국민연금(NPS) 자산현황 대시보드 (2026-06)

국민연금 자산을 한 화면에: ① 자산배분 개요 ② 🇰🇷 국내주식 Top10(DART 5%룰) ③ 🇺🇸 해외주식 Top10(SEC 13F).
- **`/api/nps-portfolio`** (`force-dynamic`·maxDuration:60·24h 캐시): 국내 크롤(KOSPI 대형주 ~70) ∥ 해외 13F 동시 수집
  - 🇰🇷 DART `majorstock.json` → 보고자=국민연금 필터 → 지분율·증감·공시일 + Naver fchart 프록시
  - 🇺🇸 **국민연금도 SEC 13F 제출!** (CIK **0001608046**) → 562종목 $132B 파싱, 발행사명 정규화 합산
- **`NpsPortfolio.tsx`**: 자산배분 스택바 + 국내/해외 2개 표 + 정직성 안내
- ⚠️ **수익률 불가**: 국민연금은 약식보고라 종목별 매입단가 미공개 → 실제 수익률 계산 불가. 대신 "마지막 공시일 이후 주가변화(프록시)" 표시
- ⚠️ **빌드 함정**: GET() 인자 없으면 Next가 빌드 시 정적 생성 시도 → 크롤 SIGTERM → `force-dynamic` 필수

---

## 📊 글로벌 페어-트레이딩 시그널 (2026-06) — 비밀병기 12단계

글로벌 1등(US 앵커) 대비 P/S 멀티플 비율의 z-score. 기관 터미널 스타일.
- **`src/app/actions/getPairSignal.ts`** (6h 캐시): 일봉 ~700개 P/S 비율 시계열 → 평균·σ → z. 멀티플=P/S(적자에 강함). KR은 .KS→.KQ 폴백. ANCHOR_MAP(18개 섹터). SSOT PEG와 연동
- **`PairTradingMonitor.tsx`**: 기관 터미널 포맷([PAIR TRADING MONITOR]·ANCHOR⟷PEER·평균/현재·z-게이지·SIGNAL 배지)
- **한글 조사 자동화**: `josa()` — 받침 유무에 따라 "이/가"·"와/과" 자동 선택
- **KR P/E 폴백**: Yahoo가 .KS/.KQ trailingPE 미제공 → 최근 흑자 EPS로 `현재가÷EPS` 계산 (≤150x만 표시)
- **KOSDAQ(.KQ) 폴백**: KR은 .KS→.KQ 순 시도 (파두 440110.KQ·대한광통신 010170.KQ 등)
- 검증: NVDA·KO·AAPL·PLTR 견고 / INTC 붕괴 / 삼성 순환회복 견고 / 파두 440110.KQ NVDA 페어 z=+4.02 ✅

---

## 🎨 전체 앱 가독성 개선 (2026-06-03)

어두운 다크 배경에서 서브 텍스트가 WCAG AA(4.5:1) 미달로 안 보이던 문제. **60+ 파일 + tailwind.config.ts 일괄 수정**.
- **1차 개선** (57개 파일 grep-replace):
  - `#475569`(2.2:1)→`#8599ae`(5.7:1) · `#334155`·`#374151`(1.6:1)→`#7a8fa3`(5.0:1) · `#64748b`(3.5:1)→`#7f93a8`(5.3:1) · `#6b7280`(3.5:1)→`#8a9aaa`(5.8:1) · `#4b5563`(2.2:1)→`#6e7f8f`(4.1:1) · `#9ca3af`→`#a8b5c2`
  - `tailwind.config.ts` ink 토큰 상향 + **zinc 오버라이드** (zinc-500 기본 `#71717a`(4.2:1)→`#9FA8B3`(8.4:1) 등)
  - rgba 텍스트 투명도 0.35→0.72 등 상향
- **2차 개선** (스크린샷 기반 핀포인트 수정):
  - KPI 바 라벨 `#454868`(1.9:1)→`#9aa0b8`(6.4:1) · CLOSED `#2e3050`(1.3:1)→`#8088a8`(4.7:1)
  - MARKET HOURS 닫힌상태 `#3d4060`(1.7:1)→`#8a90b0`(5.3:1) · 안내텍스트 `#2a2d42`(1.2:1)→`#7a7f9a`
  - 텐배거 KPI 열 헤더 `#2a3a50`(1.6:1)→`#8899aa`(6.2:1) · macro-hub `C.muted #1e3a5c`(1.65:1)→`#7fa0be`(7.0:1)
- **3차 개선** (TenbaggerRadar·macro-hub 핀포인트):
  - "MILESTONE" `#1e2d40`(1.4:1)→`#8a9db5`(7.1:1) · "포트폴리오 평단가 자동 연동" · 린치 인용구 본문 동일 수정
  - "NVDA·PLTR 36개월 점검 (무료·무인증)" — macro-hub page `C.muted` 수정
- **원칙**: 모든 배경(`#020617`~`#1b1e2e`) 대비 최소 4.5:1(WCAG AA) 이상 보장. 강조색(초록·빨강·파랑 등)은 건드리지 않음.

---

## 🐛 주요 버그 수정 (2026-06)

### school-league 수익률 0% 버그 (프로덕션 전용)
- **증상**: 스쿨 리그에서 모든 학생 수익률이 "—0.0%"
- **원인**: base URL 연산자 우선순위 버그 — `NEXT_PUBLIC_APP_URL || VERCEL_URL ? https://VERCEL_URL : localhost`로 파싱돼 프로덕션에서 보호된 배포URL로 self-fetch → 401 → 가격조회 실패
- **수정**: `const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin` (요청 origin 사용)

### Jarvis 처방전 PEG 불일치 + 잔존행 버그
- PEG SSOT 통일(위 섹션 참조) + 당일 행 삭제 후 재적재로 SELL→HOLD 전환 시 옛 행 잔존 제거

### KOSDAQ(.KQ) 종목 페어·섹터피어 실패
- `getSectorPeers`·`getPairSignal`이 KR을 .KS로만 시도 → .KS→.KQ 폴백 추가

### NPS DART corpCode 정규식 버그
- `<corp_eng_name>` 태그가 `<corp_name>`·`<stock_code>` 사이에 끼어 기존 인접 정규식이 전 종목 매칭 실패(mapSize=0) → `<list>` 경계 안전 lazy 매칭으로 수정

---

## 📡 가이던스 수정 모멘텀 레이더 (2026-06) — 투자 리서치 탭

EPS 컨센서스의 '기울기(변화율)'을 스캐닝. 사후 분석(어닝콜)과 차별화. **투자 리서치 → 📡 가이던스 모멘텀 레이더** 탭.
- **`/api/guidance-radar`** (Supabase auth, 24h 개인 캐시, maxDuration:60): earningsTrend + recommendationTrend 수집 → 스냅샷 적립 방식(매일 오늘 컨센서스 저장 → 30일 후 실제 리비전율 계산) → 초기엔 YoY growth 대리값(fallback:true 배지)
- 업/다운그레이드 = recommendationTrend 0m vs -1m 델타 · 시그널: ≥+3% 상향가속 · ≤-3% 가이던스축소 · ±3% 중립
- **`GuidanceRevisionRadar.tsx`**: 샴쌍둥이 하이라이트 카드(Top Pick / Downgrade Warning) + 모멘텀 테이블 · Skeleton UI
- 버그수정: `cleanName()`으로 Yahoo 내부 ID("189300.KS,0P00...") 대신 investments 한글명 우선 · worstWarn은 실제 decelerating만(0%짜리 오표시 방지)

---

## 💰 글로벌 배당 익스플로러 & Safety Guard (2026-06) — 주주환원 탭

포트폴리오 미보유 종목 탐색 + 배당 함정 자동 경보. **주주환원 터미널 탭** 하단.
- **`/api/dividend-explorer`** (인증 불필요, 48h 캐시, maxDuration:30): 시가배당률·연배당금·배당주기·배당성향·연속성장·FCF·배당함정 플래그
  - US: Yahoo `summaryDetail.dividendYield/payoutRatio/freeCashflow`
  - KR: Yahoo `.KS`→`.KQ` 폴백 + Naver `etfAnalysis`(ETF 전용: `dividendYieldTtm`, `dividendPerShareTtm`)
  - 정적 yield 폴백: `STATIC_YIELD`(MSTY 82%·TSLY 56%·JEPI 7.2%·SCHD 3.5% 등) — Yahoo가 ETF 분배금을 0으로 반환 시
  - KR currency-aware: `fmtCurrency(v,'KRW')` → ₩+정수, FCF → 억원/조원 단위
  - 파생 ETF `DERIVATIVE_ETFS`: MSTY·TSLY·NVDY·JEPI·JEPQ·QYLD 등 18종
  - 배당 함정 조건: `isDerivativeEtf` OR `payoutRatio > 0.8` OR `fcf < 0`
- **`DividendExplorer.tsx`**: 검색창 + 3개 프리셋 탭(🏆귀족주·📅월배당·⚠️초고배당/파생) + 썸네일 카드 + 상세 진단 + 피터 린치 페르소나 경고 카드
- ⚠️ **하드윈 버그 수정 목록**:
  - `payoutRatio >1 ? /100` 정규화 제거 — CVX `payoutRatio=1.2038`을 0.012(1.2%)로 잘못 변환하던 버그
  - `dr==null` → `dr==null||dr<=0` 조건 확장 — SCHD `dividendRate=0`(null 아닌)으로 연배당 역산 실패하던 버그
  - KR ETF(210780 TIGER 등) Naver `etfAnalysis` 폴백 추가 — Yahoo 미제공 국내 ETF 배당 데이터 해결
- ⚠️ ETF의 배당성향·연속성장 "—" 표시 = **정상 동작** (ETF는 순이익 기반 성향 개념 없음, 귀족주 DB는 개별기업만)
- 검증: KT&G 3.25%·₩6,000 ✅ / KIA 4.03%·₩6,800 ✅ / TIGER 3.70%·₩904(Naver) ✅ / JEPI 7.2%·$3.99 ✅ / SCHD 3.5%·$1.13 ✅

---

## 🏰 린치 이익선 트레이서 상세 (2026-06) — 린치 가치평가 탭

- **추가 내용**: X축 중복 버그 수정 (커스텀 `data` prop 제거 → 기존 LynchEarningsChart 동일 패턴으로 언더/오버 음영 마스킹), EPS 0 → null 처리, 적자 기업 종목명 항상 표시, KOSDAQ(.KQ) 폴백

---

## 📐 포트폴리오 상관관계 매트릭스 상세 (2026-06) — 자산&모니터링 탭

- **추가 내용**: 60일 일봉 피어슨 r 계산, WCAG AA 색상, 7개 셀 전수 재계산 검증 완료
- 🔍 **우측 AI 분산 진단 패널(2026-06)**: 매트릭스 표만 있어 우측이 비고 학생이 숫자→행동 연결을 못 하던 문제 → 2단 레이아웃(좌:히트맵 / 우:진단). **종목 쌍은 받은 매트릭스에서 클라이언트가 직접 계산(추가 API·비용 0)**:
  - 분산 상태 한줄평(avgR 등급별) · 🔗 동조화 커플(r≥0.5 상위3, "비중 합계 점검") · 🛡️ 헷지 커플(r<0.1 하위3, "리스크 방어막") · 🎓 매트릭스 읽는 법 3줄
  - `flex-wrap` 반응형(넓으면 좌우, 좁으면 세로)
- 🏭 **GICS 섹터 원인 설명(2026-06)**: "왜 같이 움직이나"를 섹터로 설명. **API에 `getSector`(schoolIndex, Yahoo assetProfile 7일캐시 재사용) 추가 → `CorrelationResult.sectors`**(캐시 키 v2). 컴포넌트가 쌍별 섹터 관계 한 줄 자동 생성:
  - 동조화+같은섹터 "🏭 둘 다 산업재 — 같은 산업이라 함께 움직임"(GEV×ETN 0.60) / 헷지+다른섹터 "🔀 기술↔산업재 — 산업이 달라 받쳐줌"(PLTR×ETN −0.16) / 동조화+다른섹터 "공통 테마(AI) 동반 반응"
  - GICS 영문→한글 매핑, 섹터 불명('기타')이면 설명 생략(graceful). 검증: GEV·ETN=산업재·PLTR·NVDA·SK하이닉스=기술·TEM=헬스케어·GOOGL=커뮤니케이션 / 인텔리안테크는 Yahoo 미제공→설명 생략·크래시 없음

---

## 🎨 가독성 개선 추가 (2026-06)

- **TenbaggerRadar 3차 수정**: MILESTONE·포트폴리오 평단가 자동 연동·린치 인용구 본문(#1e2d40 → #8a9db5 · 5.0:1 이상) · macro-hub C.muted(#1e3a5c → #7fa0be · 7.0:1)

---

## 🌐 거시경제 AI 매수 추천 터미널 (2026-06) — 투자 리서치 탭

FRED 매크로 + 피터 린치 6대 가중치 매트릭스 + 퀀트 스크리닝 + Gemini AI → 주간 캐시. **투자 리서치 → 🌐 거시경제 AI 추천** 탭.
- **`src/lib/macroPhaseScreener.ts`**: 매크로 국면 판별(6단계) + Lynch×Macro 가중치 매트릭스 + 유니버스 스크리닝(US15+KR10→US7+KR5)
  - FRED: `DFEDTARU`(Fed금리)·`CPIAUCSL`(CPI YoY역산)·`DGS2`·`GS10`(장단기금리차)·`BAMLH0A0HYM2`(HY스프레드) — 24h 캐시
  - 6개 국면: stagflation·recession_risk·peak_rate·rate_cut_early·easy_money·neutral
  - 퀀트 점수 = lynchWeight×0.35 + pegScore×0.35 + marginScore×0.2 + fcfScore×0.1
  - 고평가/FCF적자 → **탈락 아닌 플래그**로 LLM에 전달 → "분할매수 권장" 등 조언 생성 (제미나이 보강 ③)
- **`/api/macro-ai-picks`** (maxDuration:120, 주간 Cron `0 19 * * 1`=월 04:00 KST):
  - **Stale-while-revalidate**: 갱신 실패 시 기존 캐시 유지 + `isStale:true` 배너 (제미나이 보강 ④)
  - 매크로 Phase 변화 감지 시 자동 무효화
  - Gemini JSON 스키마: `macroSummary` + `recommendations[{ticker,macroFitReason,fundamentalReason,riskFactor,aiScore}]`
  - 쿼터: **US 7 + KR 5 = 12종목** 최종 전달 (제미나이 보강 ②)
- **`MacroAiTerminal.tsx`**: ①매크로 현황판(금리·CPI·장단기·HY 4개 KPI) ②AI 추천 아코디언 카드(aiScore 순·PEG 게이지·플래그 배지) ③매크로궁합·펀더멘탈·리스크 3분할 패널
- 검증(2026-06): 콜드 실행 11초 · 국면=금리인하초입 · NVDA 95점·삼성전자 90점·META 88점·PLTR 82점·기아 80점 · errors 0 ✅

---

## 📰 포트폴리오 뉴스 촉매 레이더 (2026-06) — 자산 & 모니터링 탭

보유 개별주식의 최신 뉴스를 수집·분석해 **HOLD_STRONG(견고 보유) / OBSERVE(관찰 중) / RE_EVALUATE(재검토 필요)** 3단계로 분류. 피터 린치 "뉴스 소음은 걸러내고 투자 thesis에 영향 주는 신호만" 철학. **대시보드 자산&모니터링 → 📰 뉴스 촉매 레이더** 탭(상관관계 매트릭스 다음).
- **`/api/news-catalyst`** (Supabase auth 필수·force-dynamic·maxDuration:60): 사용자 investments → 개별주식만(assetClassifier) → ticker 디듀프 → 동시성 3으로 분석
  - **뉴스 소스**: US=Yahoo Finance RSS(`feeds.finance.yahoo.com/rss/2.0/headline?s=`, 기존 Jarvis 검증 소스), KR=Google News RSS(`news.google.com/rss/search`, 무료·무인증) + Yahoo `.KS/.KQ` 병행
  - **ticker별 개별 캐시**: `app_cache(news-catalyst-v3:TICKER:MKT:YYYYMMDD, 3h)` — 전체 포트폴리오 한 키로 묶지 않음(한 명이 종목 추가/삭제해도 나머지 캐시 유지). A·B 학생이 같은 NVDA 조회 시 동일 분석 공유(제2원칙)
  - **Gemini 출력 6필드**: catalystStatus·keyFact(핵심 팩트 1문장)·actionGuide(린치 행동 가이드)·riskLevel(LOW/MEDIUM/HIGH)·relevantMetric(연결 재무지표)·isNoise(주가 시황성 필터)
  - RE_EVALUATE → OBSERVE → HOLD_STRONG 순 정렬, reEvaluateCount 상단 경보
- **`NewsCatalystRadar.tsx`**: RE_EVALUATE 경보 배너(펄스) + 4개 필터 탭(전체/재검토/관찰/견고) + 카드 펼침(행동 가이드 + 근거 헤드라인 토글)
- ⚖️ **가치×모멘텀 2축 통합(2026-06) — Jarvis 처방전과의 충돌 해결**:
  - **증상**: 이튼(ETN)이 Jarvis 모닝 처방전=**매도 검토**(PEG 4.91 고평가)인데 뉴스 레이더=**견고 보유/저위험**으로 정반대 표시 → 학생 혼란("보유? 매도?"). **버그가 아니라** 두 도구가 다른 축(Jarvis=가격/밸류에이션, 뉴스레이더=사업/모멘텀)을 측정 + 학생에게 설명 부재. 월가의 "가치 vs 모멘텀" 충돌이 그대로 노출됨
  - **해결(제미나이 컨텍스트 교차주입 + SSOT 보강)**: PEG SSOT(`canonicalFundamentals.getCanonicalPeg`)를 뉴스 분석에 주입 → Gemini가 **가치×모멘텀 융합 actionGuide** 작성. 단 **catalystStatus(사업축)는 가격 이유로 낮추지 않음**(순수 뉴스/thesis 축 유지)
  - **밸류에이션 등급은 코드가 결정론적 산출**(`valuationOf`): 고평가=PEG>2.2(=Jarvis SELL 기준과 정확히 일치, 제2원칙) / 저평가=PEG≤1.0 / 적정=그 사이. Gemini 판단에 안 맡김 → 두 화면 PEG 영구 일치
  - **UI 2축 분리**: 사업 배지(견고/관찰/재검토) + **가격 배지**(💲밸류 부담/적정가/가격 매력 · PEG값) 나란히. 충돌 조합엔 **융합 띠** 자동 노출 — [견고+고평가]→"⚖️ 좋은 사업·비싼 가격, 추격매수 자제·분할익절" / [악재+고평가]→"🚨 비중 축소 우선" / [견고+저평가]→"🟢 린치가 좋아할 자리". 헤더에 2축 개념 안내
  - **검증**: ETN PEG 4.91 주입 → 사업축 HOLD_STRONG·riskLevel HIGH·actionGuide "훌륭한 기업이나 PEG 4.91 과도, 좋은뉴스 무조건 추격매수는 초보 실수, 분할익절로 현금확보" ✓ (riskLevel·catalystStatus enum 방어 보정 + 캐시 v3)
  - **교육 효과**: "이 앱은 뉴스 좋다고 무지성 매수 권하지 않고 밸류에이션까지 보고 냉정하게 브레이크를 밟아준다" — 같은 종목이 두 화면서 다르게 보이던 모순이 "사업은 좋지만 가격이 비싸다"는 린치·버핏 핵심 교훈으로 전환
- ⚠️ **적자기업(PEG null) 밸류 브레이크 보강(2026-06)**:
  - **한계 발견**: 위 2축 통합은 고PEG(이튼) 충돌만 해결. TEM은 Jarvis=매도검토(영업이익률 -24%·ROE -81%·FCF적자)인데 뉴스 레이더는 **견고보유·중위험 무방비** — 가격 축이 PEG 전용인데 **적자기업은 PEG가 null**이라 브레이크가 안 걸림
  - **해결(PEG null → 수익성 폴백)**: `canonicalFundamentals`(SSOT)에 **opMargin·roe·fcf 노출 추가**(stock-info fundamentals에서). `valuationTier`에 **'LOSS' 추가** — 영업이익률<-10%(또는 ROE<0 & FCF<0)면 LOSS 우선. ⭐CashRunwayTimer 교훈: ROE는 일회성 이익으로 거짓 양수 가능 → **영업이익률을 우선 신뢰**
  - **UI**: ⚠️영업적자 빨강 배지(PEG 숨김 — 저PEG 함정 방지) + 융합 띠 "영업적자 기업 — 뉴스 호재여도 '진주' 아님, 흑자전환·현금 런웨이 먼저 확인, 추격매수 금물" / [적자+악재]→"손절 기준 명확히". 적자는 최소 중위험 보정(저위험 안심 차단)
  - **프롬프트**: 적자기업은 절대 '진주'라 부르지 말고 추격매수 금물 명시
  - **검증**: TEM 영업이익률 -24.3% → LOSS·고위험·재검토(Gemini가 적자+공매도 보고 격상)·actionGuide "추격매수 말고 흑자전환·현금런웨이 확인"·'진주' 미사용 ✓ / ETN 16%→EXPENSIVE·NVDA 65%→CHEAP 정상 유지 ✓ (캐시 v4)
  - **남은 정직한 한계**: 흑자기업은 PEG 축, 적자기업은 영업이익률 축으로 브레이크 — 둘 다 못 구하는 종목(데이터 부족)은 UNKNOWN(밸류 배지 없음, actionGuide 보수 안내만)
- ⚠️ **핵심 버그 수정(검증 중 발견) — Gemini 할루시네이션 차단**:
  - **증상**: NVDA의 keyFact가 "LG그룹이 엔비디아 GPU 1만 대 도입 결정"이라 단언했으나, 실제 수집된 5개 헤드라인엔 LG·한국·GPU 언급이 **전혀 없음**. 헤드라인이 전부 시장 전반 클릭베이트("AI 주식 백만장자" 등)라 Gemini가 **훈련 데이터에서 그럴듯한 가짜 뉴스를 창작** → 투자 교육 앱에서 학생이 사실로 오인하는 최악의 오류
  - **수정**: 프롬프트에 "⛔ 절대 규칙 — 헤드라인 밖 사실(기업명·금액·계약·수치) 창작 엄격 금지. 시장 전반·타종목 기사뿐이면 isNoise=true + '고유 중요 뉴스 없음'으로 정직하게" 명시. **캐시 키 v2로 무효화**
  - **재검증**: NVDA → `isNoise=true`·"고유 중요 뉴스 없음(시장 전반 기사만)"으로 정상화 / TEM(실뉴스) → consortium·FDA·공매도 전부 헤드라인 근거 매칭, 과잉억제 없음 ✅
  - **근거 투명성**: 표시 헤드라인 3→5개(Gemini가 분석한 전체 노출 — TEM 공매도 근거가 4·5번이라 숨겨지던 불일치 해결)
  - **한국어 출력 명시**: keyFact·actionGuide·relevantMetric 한국어(영어 헤드라인도 한국어 요약 — 안 하면 US 종목이 영어로 새던 문제)
- 검증(2026-06): 전체 8종목(견고6·관찰2·재검토0) · KR(SK하이닉스·인텔리안테크) Google News 실뉴스 정상 · errors 0 ✅
- Jarvis 모닝 브리핑과 역할 분리: 브리핑="언제 팔지(정량 룰)", 뉴스 레이더="오늘 무슨 일이 생겼는지(뉴스 이벤트)"

---

## 배포

- **프로덕션**: https://investment-school-portfolio.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio
