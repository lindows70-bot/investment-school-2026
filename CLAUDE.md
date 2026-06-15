# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-06-15 — 🌟 종목 투자 프로필 카드(리서치 상단: 해자·스타등급·상대PSR 3초 요약) + 🧭 AI 본부장 상황 인지형 처방 + 🌟 모닝스타식 스타 등급 + 💵 PSR 전 화면

## 프로젝트 개요

Next.js 14 (App Router) + Supabase + Tailwind CSS + TypeScript 로 구축한
**투자학교 학생 포트폴리오 관리 & 투자 교육 플랫폼**.

- 학생들이 자신의 보유 자산을 등록·추적하고 수익률을 확인
- 피터 린치·워렌 버핏 철학 기반 투자 분석 도구 제공
- 최일 선생님의 매크로 전략 브리핑 및 투자 교육 콘텐츠 제공
- 실시간 주가·환율·매크로 데이터 시각화
- **CME FedWatch + FRED API 기반 거시경제 대시보드**
- **🎯 비밀병기 12대 킬러 기능 (Zero Input AI 분석, 아래 로드맵) — 전체 완성 + 🏛️ 국민연금 대시보드**
- **🎛️ AI 포트폴리오 운용 본부** — 진단(4계절 정합)→매도(손익 4분면)→통합 매수(계절×가치×수급 3축+버핏ROE·FwdEPS+권장 편입액)를 본부장 브리핑이 한 처방으로. 자동 분석·추천까지(체결 금지)
- **🔬 ETF 투시경(X-Ray)** — 보유 ETF를 Look-Through 분해(구성종목·섹터·국가). 실질 노출·숨은 몰빵·계절 정합 반영·합산 PEG. 해외형 KR ETF는 쌍둥이 지수(SPY/QQQ) 차용. STOCK 코어 엔진 무손상

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

### 린치 밸류에이션 이익성장률(G) 이상값 → 가짜 '강력매수' (2026-06)
- **증상**: 이튼(ETN)이 린치 밸류에이션 엔진=**강력 매수**(스코어 20.35)인데 Jarvis=매도검토·뉴스레이더=밸류부담(PEG 4.91)으로 정반대 → 학생 혼란
- **원인**: 린치 우량주 스코어 `(G+DY)/PER`에 이익성장률 **G=770%**(이상값, 기저효과·데이터 글리치)가 클램핑 없이 투입. 수학적으로 **스코어 = 1/PEG**인데 PEG 4.91이면 스코어는 ~0.23이어야 정상 → G 770%는 PEG 내재 G(7.7%)와 **100배 괴리**한 제2원칙 위반
- **수정**: `LynchValuationEngine.effectiveGrowth(m)` — PEG가 있으면 내재 성장률(PER/PEG)이 진실값. 표시 G가 PEG 내재값과 2.5배↑ 괴리/비양수/100%↑면 PEG 기준으로 교체. FastGrower·Stalwart 패널 공유
- **검증**: ETN 770%→7.7%·스코어 0.23→🔴교체고려(Jarvis·뉴스레이더 일치) / 정상 15%·65%는 유지(린치 스코어=1/PEG로 PEG와 일관)

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

## 🚀 피터 린치 10배거 검증기 (2026-06) — 투자 리서치 탭

대형주 위주 유니버스로는 텐배거(10루타)가 불가능("코끼리는 못 난다")는 한계 해결. **학생이 아무 종목이나 입력하면 린치의 10루타 7대 기준으로 실시간 채점**(제미나이 아이디어3 = 학생 참여형 발굴).
- **`/api/tenbagger`** (6h 캐시·maxDuration:60): `?ticker=&market=`(시장 자동추론). **고정 유니버스 하드코딩 없음(제1원칙)** — 기존 엔진 전부 재사용:
  - 🏠 **시총 룸**(작을수록↑, 가중30 — 린치 핵심): **KR은 항상 원화→USD 환산**. <$10B PASS·<$50B PARTIAL·≥$50B FAIL(대형 불가)
  - 📈 고성장(25, **매출성장률 우선** — 적자 하이퍼그로스 IONQ 755% 포착) · 💎 저PEG(20, <0.5 진주 — 단 **매출성장<18%면 시클리컬 함정 PARTIAL**) · 🔍 언더커버리지(10, **KR=네이버 reportCount·US=Yahoo analystCount** ≤3) · 🕵️ 내부자매수(8) · 🛡️ 재무생존력(7, 이자보상배율<1.5=좀비 FAIL)
  - 점수 = 가중 충족도 → 0~100. **실격 점수 상한: 대형주(시총FAIL)→최대35, 좀비→최대49**(다른 항목 좋아도 10배거 본질적 불가). 🚀후보 뱃지(≥60 & 시총<$30B & 비좀비)
- **`TenbaggerHunter.tsx`**: 종목 입력창(영어티커 대문자) + 7대 체크리스트(✅/⚠️/❌ + 실제값) + 린치 평결 + 빠른검색칩
- ⚠️ **정직 가드레일**: "린치 기준 '충족도'이지 수익 예측 아님 · 희귀·고위험 대부분 실패 · 위성 소액·분산만 · 교육용"
- 🔧 **검증으로 얻은 핵심 교훈(반드시 유지)**:
  - **숫자=buildSignalMetrics SSOT, 이름=stock-info**: 4개 소스 병렬 호출 시 stock-info 중복(직접+canon-fund) throttle로 "자료없음" 발생 → 숫자는 buildSignalMetrics 한 곳에서. `SignalMetrics`에 **marketCap·revenueGrowth·analystCount 추가**(이미 호출하던 financialData/summaryDetail에서, 추가 fetch 0, 캐시 jarvis-metrics **v7**)
  - **US 커버리지 버그**: `getAnalystSignal` US 경로는 reportCount 미제공(네이버 전용) → US 종목이 항상 "0건 충족"(월가가 다 보는데 오판) → US는 Yahoo `numberOfAnalystOpinions` 사용
  - **성장 단위**: Yahoo earningsGrowth/revenueGrowth는 소수(0.36=36%, 7.55=755%) — `<5면 ×100, else 그대로` 휴리스틱은 755%(7.55)에서 깨짐 → **revenueGrowth 클린 소수 ×100** 직접 사용
  - **저PEG≠저평가**: 저PEG+저성장은 경기순환 이익정점(시클리컬 함정) — 삼성중공업 PEG 0.05·성장16%를 "진주"로 오표시하던 것 수정(리밸런서 시클리컬 함정과 동일 철학)
  - ⚠️ **Yahoo KR 시총 부정확 가능**(SK텔레콤·Bloom Energy 등 실제보다 높게) — 로직 아닌 데이터 소스 한계
- **코어 유니버스 확장(macroPhaseScreener)**: 리밸런서 매수후보 풀 US15→30·KR10→20 = **50개**. 섹터 다변화(헬스케어 LLY·UNH / 필수소비재 PG·WMT·COST / 산업재 CAT / 에너지 XOM·CVX / 금융 BAC·KB금융·신한 / 방산 한화에어로 / 2차전지 LG엔솔·삼성SDI)
- 🚀 **리밸런서 코어/위성 투트랙 통합(2026-06, 제미나이 아이디어1)**: 리밸런서 매수 추천을 **코어(안정 80%)+위성(공격 20%)**으로 분리
  - 예산: 회수 예산의 20%만 위성(최대 절대 8%p 한정), 80% 코어(macro-ai-picks 대형주)
  - 위성: `SATELLITE_UNIVERSE`(중소형 성장주 18종, 코어와 별개) → `screenSatellite`가 라이트 10배거 점수(시총룸+매출성장+저PEG+비좀비, buildSignalMetrics만 — 추가 fetch 적음)로 상위 2 선별. 좀비 강등·보유종목 제외
  - UI: 🛡️코어 편입 / 🚀위성 후보(고위험 소액) 분리 + 10배거 헌터 탭 연계 안내. 캐시 ai-rebalance v9
  - ⚠️ 위성 점수 라벨은 **"성장스크리닝"**(라이트 3기준)으로 표기 — 헌터의 7대 기준 점수와 다르므로 "10배거 N점" 표기 금지(혼동 방지)
  - 검증: 코어/위성 80/20 예산분리 정확(코어 13.1%+위성 3.3%=16.4%), 원익IPS 100점(시총$4.8B·매출33%·PEG0.13)·IONQ 82점 상위. 제1원칙(후보 풀만 큐레이션, 분석값 실데이터)
- **향후 아이디어**: 학생 피칭→AI검증→유니버스 동적 편입(제미나이 아이디어3 확장)

---

## 🤖 AI 포트폴리오 리밸런싱 (2026-06) — 자산 & 모니터링 탭 · 앱 최종 목적지

신규 추천만이 아니라 **내 실제 손익을 반영해 무엇을 빼고 무엇을 담을지** 제안하는 AI 자동 포트폴리오 관리의 1·2단계. **자산&모니터링 → 🤖 AI 리밸런싱** 탭.
- **핵심 설계 = 기존 엔진 합성(새로 안 만듦)**: 매도진단=`jarvisBriefing`(buildSignalMetrics+evaluateSignal) / 매수후보=`macro-ai-picks` / 손익=`investments`(평단가·수량)+`stock-price` 현재가 / 분산=린치 황금비율(`IDEAL_RATIOS`)+`getSector`
- **`/api/ai-rebalance`** (Supabase auth·force-dynamic·maxDuration:120·24h 개인캐시):
- ⭐ **수익률 연동형 4분면**(제미나이 협업 — "일방적 매도 금지"): 매도는 한 종류가 아님
  - **TAKE_PROFIT**(수익중+고평가): 분할 익절(비중 절반 회수)
  - **CUT_LOSS**(손실중+**thesis붕괴** 영업적자·FCF적자·마진<-10%): 손절 + 본전상승률 기회비용
  - **HOLD_DIP**(손실중+**단순 고평가뿐**): 보류 "저점 매도 금물" → ⭐단순 고평가만으로 손실 종목 손절 강요 안 함(사용자 핵심 요구)
  - **DEFEND**(저평가/호재): 사수 / **KEEP**: 유지
- ⏳ **Time to Recovery**: 본전까지 필요 상승률 = `-r/(1+r)` 확정 수학(−15%→+17.6%, −50%→+100%) — 손실 회피 심리 치료
- ⚖️ **Phase 2 분산 최적화**: 매수 후보를 황금비율 **부족 분류에 갭 가중 배분**(`fillScore=aiScore×(1+부족갭/35)`) + 분류/섹터 **Before→After**(현재−회수분+배분분, 권장선 마커) + 최대 섹터 집중도 전→후
- 🎯 **Phase 3 목표 추종 집중 트림**(`applyConcentrationTrim`): 종목별 매도 신호가 없으면 한 분류 86% 과집중이어도 리밸런싱이 작동 안 하던 한계 해결("나무만 보고 숲 못 봄"). **황금비율 +15%p 초과 분류를 점진 축소**해 예산 생성(신호 무관)
  - ⭐ 안전("일방적 매도 금지" 확장): 초과분 절반만·종목당 최대 절반 트림, **깊은 손실(-15%↓) 보호**(저점매도 방지), **최저PEG 핵심 1종목 보호**, 고PEG부터 트림. `trimWeight`가 `releaseWeight`에 합산 → sellBudget 증가 → 부족 분류로 갭 가중 재배분 → Before→After 실제 개선(86%→~56%)
  - UI 3분할: 신호 교체매매(익절/손절) / ✂️분산 트림 / 🎯신규 편입(예산 재배분). 매수 후보 독립 섹션(예산이 트림에서 나와도 표시)
- ⚠️ **밸류에이션 함정 2종 경고(2026-06, 유튜브 요약 참조 — 영구 원리만 채택, 시한부 콜·특정수치는 하드코딩 제외=제1원칙)**:
  - 🔁 **시클리컬 가치함정**(`CyclicalTrap`): 경기순환주 비중≥40% + 저PEG(<0.8) → "경기순환주는 이익 정점에서 PER 최저=함정, 저PEG≠저평가"(린치). 메모리 슈퍼사이클(삼성 2Q26 영업이익 82~100조 전망=사상최대=정점) 맥락에서 SK 0.09·NVDA 저PEG가 정점 함정일 수 있음
  - 💭 **하이프 프리미엄**(`HypePremium`): 영업적자(opMargin<0=이익 실체 없음) 보유 종목 → "이익 없이 스토리·유명인 투자소식으로 프리미엄=거품"(버핏, OKLO·JOBY류). 일방적 매도 아닌 매출폭증·물리적 해자 실재 확인 후 비중관리
  - 🧟 **좀비 기업**(`ZombieRisk`): 이자보상배율<1.5(영업이익으로 이자도 못 갚음) 보유 종목 경고. **buildSignalMetrics(SSOT)가 이미 호출하던 fundamentalsTimeSeries에서 interestExpense 추가 추출**(추가 fetch 0, 최근4분기 영업이익합/이자비용합). 좀비타이머(현금런웨이)·하이프(영업적자)와 별개 신호 — 흑자여도 빚 못 갚는 구조적 위험. 검증: 삼성 72배(건전)·PLTR 무차입(null). 캐시 jarvis-metrics v5
  - ⭐ **밸류에이션/재무 함정 3종 완성**: 🔁시클리컬(정점)·💭하이프(거품)·🧟좀비(부채). 전부 하드코딩 0(실데이터) · 일방적 매도 금지 원칙 유지
  - ⛔ **의도적 제외**: 기술적분석(MACD·RSI·볼린저)은 앱의 펀더멘탈 우선 철학상 제외(노이즈 캔슬러가 거르는 '소음'). 나머지 원리(물리적 해자·하이프 필터)는 이미 구현됨(해자붕괴 경보기·뉴스레이더 isNoise·페어트레이딩 P/S)
- 🔧 **통화 환산 비중 버그 수정(2026-06, 중요)**: 비중 계산이 `현재가×수량`을 ₩·$ 구분 없이 합산 → ₩가격(수십만)이 $가격(수백)을 압도해 **국내종목이 비중 독식**(SK하이닉스 한 종목 86.2%는 사실상 환산 오류였음). `/api/exchange-rate`로 **전 종목 원화 환산 후 비중 계산**(폴백 1380). 혼합 통화 포트폴리오의 핵심 정확도 수정
- 🧭 **섹터 페널티(2026-06, 제미나이 피드백)**: 매수 후보 배분이 린치 분류 갭만 보고 섹터 집중은 무시 → 반도체 빼서 또 반도체(삼성·MSFT) 편입해 Tech 71% 잔존. `fillScore`에 `sectorPenalty` 추가(현재 섹터비중 ≥50%→×0.35·≥35%→×0.55·≥20%→×0.8) → 결 다른 섹터(금융·헬스케어) 강제 분산 유도. 검증: 매수후보 Financial·Communication·Consumer·Healthcare로 분산, 최대섹터 59.8→50.8%
- 🧭 **분류 페널티(2026-06)**: 섹터는 분산되나 분류는 약함(빠른성장주 47.9→46.9, 트림한 만큼 Meta·셀트리온 또 빠른성장주로 채워짐). 원인=`fillScore`가 과다분류에 보너스 0만 주고 페널티 없음. `categoryMult`로 통합(부족분류 +gap/35 보너스 / 과다분류 −, 하한 0.4) — 섹터 페널티와 동일 철학. 빠른성장주(과다 17.9%p)→×0.55 감점
- 🧾 **실행 가이드(2026-06)**: 제미나이가 제안한 "1-Click 일괄 실행 버튼"은 **거부**(자동매매=시스템 금융규칙·앱 교육용 원칙 위반, 무면허 투자일임 위험). 안전한 대안으로 비중→₩금액 환산(`portfolioValue` 추가, 매도/트림/매수 카드에 ≈₩금액) 표시 + "자동 주문 없음·직접 실행" 명시. **거래 자동화는 넘지 않는 선**
  - 📌 캐시 키 v6 · `?refresh=1`로 새로고침 강제 재계산
- **`AiRebalancePanel.tsx`**: AI 코칭 내러티브 + 1-Click 교체매매 카드(익절/손절·수익률·본전상승률·신규편입) + 저점매도 방지/사수 칩 + 분산 개선 바. 국내종목은 한국명 표시
- ⚠️ **안전장치**: 자동거래 절대 없음·"교육용 시뮬레이션, 투자 추천 아님" 명시·**승률 등 가짜 숫자 금지**(제미나이 "95%" 제거)·현금 중립(매도=매수)·전 지표 SSOT(제2원칙)·Gemini는 심리 인지 코칭만(익절 축하/손절 위로)
- 검증(2026-06): ETN −0.1%·고평가지만 thesis 멀쩡 → HOLD_DIP "버텨라"(저점매도 방지 정상 작동)

---

## 📰 포트폴리오 뉴스 촉매 레이더 (2026-06) — 자산 & 모니터링 탭

보유 개별주식의 최신 뉴스를 수집·분석해 **HOLD_STRONG(견고 보유) / OBSERVE(관찰 중) / RE_EVALUATE(재검토 필요)** 3단계로 분류. 피터 린치 "뉴스 소음은 걸러내고 투자 thesis에 영향 주는 신호만" 철학. **대시보드 자산&모니터링 → 📰 뉴스 촉매 레이더** 탭(상관관계 매트릭스 다음).
- **`/api/news-catalyst`** (Supabase auth 필수·force-dynamic·maxDuration:60): 사용자 investments → 개별주식만(assetClassifier) → ticker 디듀프 → 동시성 3으로 분석
  - **뉴스 소스**: US=Yahoo Finance RSS(`feeds.finance.yahoo.com/rss/2.0/headline?s=`, 기존 Jarvis 검증 소스), KR=**네이버 증권 종목뉴스**(`m.stock.naver.com/api/news/stock/{종목6자리}`, 종목 특화)+Google News RSS(`news.google.com/rss/search`, 아그리게이터)+Yahoo `.KS/.KQ` 백업. **네이버·Google 인터리브**(대형주는 네이버 거시뉴스에 종목특화 Google이 안 밀리고, 소형주는 네이버 특화뉴스가 채워짐 — 인텔리안테크 우주항공 등 Google 약한 종목 보강)
  - **ticker별 개별 캐시**: `app_cache(news-catalyst-v3:TICKER:MKT:YYYYMMDD, 3h)` — 전체 포트폴리오 한 키로 묶지 않음(한 명이 종목 추가/삭제해도 나머지 캐시 유지). A·B 학생이 같은 NVDA 조회 시 동일 분석 공유(제2원칙)
  - **Gemini 출력 필드**: catalystStatus·keyFact(핵심 팩트 1문장)·**newsItems(유형별 주요 뉴스 2~3건)**·actionGuide(린치 행동 가이드)·riskLevel(LOW/MEDIUM/HIGH)·relevantMetric(연결 재무지표)·isNoise(주가 시황성 필터)
  - 🗞️ **유형별 뉴스 2~3건 색깔 구분(2026-06)**: keyFact 한 줄만으론 계약·실적·협약 등 서로 다른 호재/악재를 한 가지만 봄 → Gemini가 헤드라인에서 **서로 다른 유형 2~3건 추출**(중복 유형 금지). category 7종(계약수주·실적·협약제휴·신제품기술·규제소송·인사지배구조·시장수급)+tone(호재▲/악재▼/중립)+summary(헤드라인 근거 한 줄). UI는 카드에 유형 칩(아이콘+색상)+요약+톤 마크. 시장 전반·노이즈뿐이면 빈 배열, 헤드라인 밖 창작 금지(할루시네이션 방어 유지). 백엔드 검증(유효 category·최대 3건). 캐시 v6
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

## 🤖 AI 리밸런싱 가독성·정합성·풀 확장 (2026-06-06)

리밸런싱 화면 가독성 개선(전/후 도넛) + 검증 중 발견한 다수 버그 수정 + 후보 풀 100/100 확장.

### 📊 포트폴리오 전→후 도넛 대시보드 (`AiRebalancePanel.tsx` `BeforeAfterDonuts`)
글로만 가득하던 리밸런싱 결론을 **파이차트 2개(전/후)**로 한눈에. `data.sellBudget > 0`일 때 내러티브 위에 렌더.
- **색상 SSOT**: 유지🔵 / 매도·축소🔴 / 신규 코어🟢 / 위성🟣 / 기타⚫
- **범례 = 변화 항목 우선**: 전 도넛 = 매도·축소 종목 **전부**(회수 %), 후 도넛 = 신규 편입 **전부**(편입 %) + 유지 상위4. `pack()`은 소액 '유지'만 '기타'로 합산하고 **변화 항목(매도/신규/위성)은 작아도 항상 개별 표시**
- **부분 트림 정밀 분할**: 부분 트림 종목은 도넛에서 **'남는 양(파랑)+파는 양(빨강)' 2슬라이스로 분할** → 빨강 면적 합 = 회수예산과 정확히 일치(과거엔 전체 보유가 빨강이라 매도량 과장 착시). 중앙 카운트는 슬라이스가 아닌 **실제 종목 수**(beforeCount/afterCount)
- **매도 유형 태그**: 익절·절반(🟠 TAKE_PROFIT)/손절·전량(🔴 CUT_LOSS)/분산·축소(🔵 trim) + 익절 있을 때 "수익중·고평가라 50%만 실현(나머지 추세 유지)" 설명 워딩. 매도 %는 **회수 비중(releaseWeight)** — 부분 트림은 파는 양만 표기

### 🛡️ 내러티브 가드레일 (제2원칙/SSOT)
- **증상**: Gemini 내러티브가 손실(−13.8%) 종목 PLTR을 "수익 중"이라 하고, 분산 목적 축소를 "차익 실현(익절)"으로 오표기 → 도넛 태그와 충돌
- **수정**: 프롬프트 절대 규칙 추가 — ①손익 음수면 '수익 중' 금지 ②'분산트림'을 '익절/차익실현'으로 부르지 말 것('차익 실현'은 TAKE_PROFIT 종목만). 캐시 v9→v10
- 검증: 이후 PLTR이 "손실 중·수익 실현이 아닌 분산"으로 정확 서술

### ⚡ 매수/매도 즉시 반영 — 캐시 무효화 + 지문(fingerprint)
보유 변경 후에도 리밸런싱·상관행렬·Jarvis 브리핑 등에 사라진 종목이 잔존하던 문제.
- **원인**: `user.id`로 키된 조립 캐시(ai-rebalance·corr-matrix·guidance-radar)가 24h 유지 / Jarvis는 일일 스냅샷
- **① 명시적 무효화**: `appCache.bustUserCache(userId)`(`%userId%` 키만 삭제, 티커 공유캐시는 보존) + `POST /api/cache/bust` + 클라 헬퍼 `bustServerCache()`를 매수/매도/삭제 성공 직후 호출(TransactionModal·AddInvestmentModal 전 경로)
- **② 지문 자동 무효화(더 견고)**: `appCache.holdingsFingerprint(userId)`(티커+수량 해시)를 **ai-rebalance·corr-matrix·guidance-radar 캐시 키에 추가** → 보유가 바뀌면 키 자체가 달라져 옛 캐시 자동 회피(bust 타이밍·과거 캐시 무관)
- **③ Jarvis 브리핑**: 현재 보유목록과 **교차 필터**(매도 종목 즉시 숨김) + `portfolio-updated` 이벤트 구독으로 같은 화면 즉시 재조회

### 🐛 학교 집계 버그 2종 (school-league / school-index)
- **Top Picks '보유 N명' = 행 수 버그**: `school-league`가 투자 '행' 수를 세어, 한 학생이 같은 종목 2행(분할매수 등)이면 1명인데 2명으로 과다 집계 → **고유 사용자(Set<user_id>) 집계**로 수정
- **Top Picks는 일일 스냅샷이었음**: TEM 매도 후에도 "2명" 잔존의 진짜 원인 = `school_index_stock_snapshots`(크론 일일 스냅샷)이 매도 전(6/5) 상태를 박제. 라이브 DB 실측(TEM 1명)으로 확인 후 크론 수동 재실행 → 6/6 스냅샷 재생성(TEM 1명→익명화 ETC). **크론 자기정화 추가**: 같은 base_date에서 빠진 종목/섹터의 묵은 행을 `.in()`으로 삭제(재실행 시 자동 정리)
- ⚠️ 교훈: 리밸런서의 "손절·전량"은 **권유일 뿐 자동 매매 없음**(설계상 읽기 전용). 실제 제거는 자산관리에서 매도/삭제해야 investments에서 빠짐

### 🌐 후보 풀 확장 — 코어 50→100, 위성 18→100
- **코어 매수 유니버스**(`macroPhaseScreener`): US 30→60 + KR 20→40 = **100**. 섹터 대폭 다변화(반도체·SW·헬스케어·금융·산업재·통신·소재·조선·바이오·엔터). 스크리너 동시성 4→6(주간 크론+stale-fallback). macro-ai-picks 캐시 `weekly→weekly:v2`
- **위성(10배거) 풀**: 18→**100**. ⭐ **핵심 설계 = 크론 사전채점**: 리밸런싱 요청 내 100회 라이브 fetch는 타임아웃 → **`src/lib/satelliteScreener.ts`**(신규)로 분리(Next 라우트는 임의 export 불가). `computeSatelliteScores`(전체 채점)를 **`/api/cron/satellite-scores`**(매일 03:30 KST)가 `SAT_SCORE_KEY`에 적재 → `screenSatellite`는 **캐시만 읽고 보유 제외+상위 선택(fetch 0)**, 콜드(크론 전)면 상위 30만 라이브 채점해 타임아웃 방지. ai-rebalance 캐시 v10→v12, `SatelliteCandidate = SatelliteScore & { allocWeight }`
- **누락종목 추적·교체**: 크론이 99/100만 채점 → 실측 결과 **CFLT(Confluent)·CYBR이 stock-info 미해결**(이름조차 반환 안 됨) → CFLT를 **ZETA(Zeta Global, 시총 $5.5B·PEG 0.77)**로 교체 → 100/100 채점 확인
- 검증: 100종목 풀에서 신규 발굴 확인 — 위성에 **고영($1.5B·매출 42%·PEG 0.49)**, 코어에 ABBV·KB금융·HD한국조선해양 선별. 삼중 일치(매도=신규=예산 7.7%) 유지

### 운영 메모
- `git add -A` 주의: 추적 안 되던 파일까지 휩쓸어 커밋에 섞임 → `reset --soft`로 의도한 파일만 재커밋(시맨틱 커밋 원칙)
- CRLF/LF 경고는 autocrlf 정규화 노이즈(무해)

---

## 💰 스마트머니 수급 레이더 (2026-06-06) — 외국인/기관/개인 돈의 흐름

펀더멘탈이 주가의 '방향'이라면 수급은 '연료'. KR은 외인/기관/개인 직접, US는 프록시(MFI+내부자+13F)로 스마트머니 유입·이탈을 추적. 제미나이 컨설팅을 비판적으로 수용(신규 테이블 반려·기존 엔진 재사용·'연료지 방향은 펀더멘탈' 톤 유지).

### SSOT — `src/lib/moneyFlow.ts` (`getMoneyFlow(ticker, market, name, selfBase?)`)
모든 수급 분석의 단일 출처. 종목별 `app_cache(money-flow-v5:CODE:MKT:DATE, 24h)`.
- **KR 직접**: `m.stock.naver.com/api/stock/{6자리}/trend?pageSize=60`(JSON, 모바일 UA+Referer) → 외인/기관/개인 5/20/60일 누적 순매수 + 외국인 보유율. **추정 대금 = 순매수 수량 × 평균종가**(부호가 순매수 방향과 항상 일치 — Σ수량×종가는 부호 어긋남 버그)
- **US 프록시**: ① **MFI(14)** Yahoo 3개월 일봉에서 계산(typical price×volume 기반 0~100) ② **내부자** `getInsiderSignal`(EDGAR) 재사용 ③ **13F 거인** `shadow-13f` 재사용(best-effort, 펀드캐시 워밍 시 ~1s, 타임아웃 16s)
- **린치 판정**: 🟢유입(KR=외인+기관 동반매수&개인매도 / US=내부자매수+MFI<70) · 🔴과열(신고가+개미독박 또는 MFI>80) · 🟡소외(KR 외인보유<12%) · ⚪중립
- ⚠️ **US 13F '미보유 vs 집계중' 구분**(`giantKnown`): 콜드 타임아웃 graceful 0을 '진짜 미보유'로 오판(AAPL→거짓 소외주) → ok 플래그로 구분. **추적 거인은 9인뿐 → 0이 흔하고 매칭 미스 가능 → '거인 0=소외주' 단정 제거, 거인 보유는 양(+)신호로만**
- `/api/money-flow` (개별주식 가드·일별 캐시·selfBase로 13F 내부호출)

### Phase 1·2 — 종목별 레이더 `MoneyFlowRadar.tsx` (리서치 비밀병기)
- KR=3주체 에너지 바(±대금·▲▼) / US=MFI 게이지(20·80 임계)+내부자·13F 칩. 정직성 푸터(추정·패시브 포함·교육용)

### Phase 3 — 리밸런서 카드 배지 `MoneyFlowBadge.tsx`
- 매도(SwapCard)·분산축소·코어매수·위성매수 4종 카드에 **클라이언트 lazy** 칩 부착(일별 캐시 공유)
- 🟢유입/🔴이탈·과열/🟡소외/⚪중립 + **칩 탭하면 카드 폭 전체로 상세 펼침**(▾캐럿, hover 아닌 클릭 — 학생 발견성). "저PEG+수급유입" 융합 판단을 한 카드에서

### Phase 4 — 포트폴리오 수급 대시보드 `PortfolioFlowDashboard.tsx`
대시보드 **자산&모니터링 → 📡 수급 레이더** 탭. 내 종목 전체 스마트머니 한눈에.
- **`/api/portfolio-flow`**(auth·maxDuration 60): 보유종목 순회 `getMoneyFlow`+`getCanonicalFundamentals`(PEG) 집계. 신규 수집 0. **제미나이 신규 테이블 반려 → `app_cache` + `holdingsFingerprint` 키**(매수/매도 시 자동 무효화 + `portfolio-updated` 이벤트 재조회)
- UI: ① 스마트머니 동행지수(종목 수 기준 유입 비율, 네온 바) ② 🔥유입 순항 / ⚠️개미 과밀 2단 보드 ③ **린치 4분면 매트릭스**(저PEG×수급): 🏆메이저 주도주(저PEG+유입) · 💎저평가 대기(저PEG+수급잠잠) · ⚠️상투·과열(고PEG+수급몰림/이탈) · 🔍재검토(둘 다 약함)
- ⚠️ **라벨 정합성 수정(검증 중)**: 고PEG+유입(ETN)을 '재검토(수급약함)'로 오배치 → 상투·과열로 통합 / '소외된 진주'가 메가캡(NVDA·GOOGL)을 '기관 미발견'으로 오라벨(y축은 기관지분율 아님) → '💎 저평가 대기'로 정정
- 동시성5 배치, 종목·집계 모두 캐시라 재방문 즉시

### Phase 4 보강 — 화면 밀도·완성도 (제미나이 컨설팅 비판 수용)
제미나이 4안 평가 후 **#2 비중 히트맵·#4 앵커 브리핑 채택**, #3 도넛 보류, AI 호출 반려.
- **비중 히트맵(#2)**: `FlowEntry.weight`(원가 기준 `purchase_price×quantity`, USD→KRW 정규화, 추가 fetch 0) → 4분면 칩을 **비중 클수록 크고·굵고·진하게 + 비중% 직접 표기**. 분산 집중도 한눈에
- **앵커 브리핑(#4)**: `buildHeadline` **결정론적 한 줄 요약(AI 미사용 → Zero Cost·무환각)**. 4분면 카운트+대표종목(비중순)+과열종목 조합. 상단 배너로 와꾸 고정. ⚠️ 제미나이의 AI 생성 제안은 **반려**(할루시네이션 이력)
- **동행지수 스파크라인(#1)**: 매일 `smartMoneyRate`를 `app_cache(portfolio-flow-hist:userId, 최근14일·60일TTL)` **누적 기록**(US 위주 포폴은 일별 역산 불가 → 누적 방식). 14% 옆 SVG 꺾은선+전일대비 ▲▼. 2점 미만은 '추이 누적 중'. 라벨에 '(밸류 무관 자금 유입률)' 추가해 ETN 과열을 '유입(좋음)'으로 오해 방지
- **근접 후보(우선순위 임박)**: 매수 우선순위(LEADER) 비면 → `FlowEntry.momentum`(0~100: KR 외인/기관 매수전환+개인이탈 / US MFI상승+과매도탈출+내부자) ≥40인 저평가 대기(PEARL) 상위 2개를 **🔜 우선순위 임박**으로 표시 → 빈 보드를 선행 신호로 채움
- **보드 ↔ 4분면 정합**: 보드를 status가 아닌 **4분면 기준(LEADER/CROWDED)으로 정렬** → ETN이 '유입(좋음)·상투(나쁨)' 양쪽 모순 표시되던 것 해소(경보 보드에만). **빈 사분면 Empty State**(흐린 대형 이모지+점선+중앙정렬, 위험칸 비면 '✓ 위험 없음' 긍정 메시지)

### 🧪 스트레스 검증 (2026-06-07) — 어떤 종목이 들어와도 무사고
전 학생 보유 종목 **61종 전수 + 엣지케이스 2종 = 63종**을 프로덕션 `money-flow` 전수 호출.
- **이상(500/크래시/잘못된 상태) 0건** · 상태 분포 UNSUPPORTED 26·NEUTRAL 33·INFLOW 1·NEGLECTED 3
- **개별주식 가드 정확**: 크립토(ETH·XRP·BTC)·레버리지/원자재 ETF(TSLL·AGQ·PSLV)·美 ETF(QQQ·XBI·IBB)·韓 ETF 15종·**알파벳 KR ETF코드(0131V0·0091P0 등)**·잘못된 티커(ZZZZZ·999999) = 26종 전부 UNSUPPORTED graceful 차단
- **실주식 37종 전부 정상 분석**(우선주 005387·코스닥 파두/대한광통신 포함, UNSUPPORTED로 샌 실주식 0)
- 결론: `portfolio-flow`는 STOCK만 필터→`money-flow` 순회라, 다른 학생이 ETF·코인·우선주·잡주 무엇을 담아도 개별주식만 골라 정상 작동

---

## 🧭 매크로 국면 SSOT 통일 (2026-06-07) — 제2원칙

**문제**: 매크로 '금리 방향' 결론이 화면마다 모순. FedWatch(FF선물)는 "동결/인상"인데 macro-ai-picks(MacroAiTerminal)·MacroDashboard는 "금리 인하 초입/사이클". 기준금리도 3.64(EFFR) vs 3.75(목표상단)로 불일치.

**근본 원인**: 매크로 결론이 4~5곳에서 독립 계산 + 아무도 FedWatch 방향을 안 봄. `detectMacroPhase`가 정적 레벨(금리 밴드+CPI+장단기차)만으로 "인하 초입" 단정.

**해결 — 단일 SSOT(`/api/macro-regime`)**:
- **`macroPhaseScreener.fetchMacroData(selfBase)`**: 기준금리를 `DFEDTARU`(상단 3.75)→**`FEDFUNDS`(EFFR 3.63, FedWatch와 동일출처)**. **FedWatch FF선물 net 방향(rateDir: cut/hold/hike)** + **다음 FOMC 날짜**도 산출(`fetchRateDirection`이 `/api/fedwatch` meetings에서). 캐시 `macro-phase-data-v3`
- **`detectMacroPhase`**: `rateDir==='cut'`(실제 인하 컨센서스)일 때만 `rate_cut_early`. 그 외엔 `peak_rate`(**금리 고점·동결**) — 정적 레벨만으로 '인하' 단정 금지
- **`/api/macro-regime`**(신규): `{ fedRate, rateDir, rateDirLabel, phase, label, description, nextFomc{date,dDay} }` 단일 SSOT
- **MacroDashboard**: 포지션 카드3을 SEP 점도표 단독→**rateDir 기준**(cut=인하사이클/hold=고점·동결/hike=동결~소폭인상). 다음 FOMC도 하드코딩(`2025년 6월 D-20`)→SSOT 동적값. SEP는 참고용으로 강등
- **macro-ai-picks**: selfBase 전달 + 캐시 v3 → 기준금리·국면 자동 일치
- ⚠️ **BondSimulator·MacroStressTester는 미수정**: 사용자가 시나리오를 직접 토글하는 교육용 도구라 '현재=인하' 라이브 결론을 주장하지 않음(충돌 없음)
- 검증(2026-06-07): `/api/macro-regime` = `fedRate 3.63 · rateDir 인상 · 금리 고점·동결 · 다음FOMC 2026년 6월 17~18일 D-10`. macro-ai-picks·MacroDashboard·FedWatch 전부 일치

---

## 🌐 국내 시장 수급 랭킹 (2026-06-07) — 외국인/기관 순매수 상위 + 타임라인 + 추천 엔진

### 데이터 소스 실측 결과 (정직하게)
제미나이가 추천한 4개 엔드포인트를 전부 `curl`로 실측:
- **네이버 `dealRank`(⭐추천)**: 에러 HTML 반환 = **존재하지 않는 환각**
- **KRX `getJsonData`/`menu.cmd`**: "LOGOUT"/빈 응답 = **OTP 토큰 필요, bld 부정확**
- **KIS Open API**: 진짜이지만 appkey·secret·OAuth 발급 필요(Zero-Setup 아님)
- **data.go.kr**: T+1 지연(제미나이도 반려)
→ 검증된 **per-ticker `fetchKrTrend`(moneyFlow.ts) 재사용**으로 주요 코스피/코스닥 113종목 유니버스 랭킹 구현. YouTube 시장 전체 랭킹과 사실상 일치(대한전선·삼성전기·한미반도체·NAVER 등).

### 핵심 파일
- **`src/lib/marketFlowKr.ts`**: POOL(113개 개별주식만, ETF 큐레이션 원천차단) + `fetchKrTrend` 재사용. 1일·5일·20일 누적 순매수 대금(Σ수량×종가) + 쌍끌이 연속일수 + 일별 종가(closes) + PEG 뱃지
- **`/api/market-flow-kr`**: 일별 캐시(`market-flow-kr-v3:DATE`) + `/api/cron/market-flow-kr`(매일 16시 KST 워밍)
- **`/api/kr-chart`**: 1Day 인트라데이 프록시(네이버 분봉, CORS회피, 표시 12행 lazy·캐시)
- **`MarketFlowKr.tsx`**: 외국인/기관 순매수 Top12 + 쌍끌이 3탭 × **[1일/5일 누적/20일 누적]** 토글. 가운데 **미니 주가 스파크라인**(기간 연동: 1일=1Day분봉/5일=1주/20일=1개월). 행 클릭 → 타임라인 펼침(▾)

### `/api/money-flow/timeline` + `InvestorTimeline.tsx` — 일별 매매동향
- `GET?ticker=005930&days=20`: 최근 20일 외인/기관/개인 일별 순매수 대금(억) + 누적(cum)
- `InvestorTimeline.tsx`: 누적 요약 배지 + 일별 테이블 + **인라인 막대**(초록=매수/빨강=매도, 규모 비례)
- **발굴→검증 동선**: 시장 랭킹에서 종목 클릭 → "며칠째 누가 담나" 타임라인 인라인 펼침

### 수급 레이더 탭 구조
대시보드 자산&모니터링 → 📡 수급 레이더: **[📡 내 종목] / [🌐 시장 랭킹] / [🎯 맞춤 추천]** 3탭 토글

### 🎯 린치×수급 융합 추천 엔진 (`/api/portfolio-reco-kr` + `PortfolioRecoKr.tsx`)
내 포폴 상태 × 시장 수급 조인. 추가 수집 0. 캐시 `portfolio-reco-kr-v1:userId:date:fp` (holdingsFingerprint 자동 무효화).
- **① 빈집 채우기**: 내 포폴에 없는 섹터 + 메이저 매집(쌍끌이≥2 or 외인·기관 5일 동반) → 섹터 분산 + 수급 동시 충족
- **② 진주 발굴**: 미보유 + PEG<1.0 + 쌍끌이 2일+ = 수급 붙은 저평가 신규 편입 후보
- **③ 보유 불타기**: 보유(유니버스) + 외인 1일·5일 모두 순매수 → 비중 확대 검토 타이밍
- 각 추천 카드 클릭 → `InvestorTimeline` 펼침(재사용)
- 검증: 신한지주(PEG 0.50·3일 쌍끌이)·하나금융(0.69·3일)·LG(0.60·2일) 정확 추출 ✅

### 유의사항 (정직하게)
- 유니버스 113종목 기준(전 종목 아님). 초소형주·당일 핫 테마주는 풀 확장으로 커버 가능
- 랭킹은 **당일 1거래일** 기준. 쌍끌이 뱃지는 **연속일수**. 5일/20일 누적은 **기간 합산**
- 대금 = 일별 순매수 수량×종가 추정(SSOT와 동일 공식). 교육용

### 🎯 추천 엔진 v2 보강 — 통합 점수·개인 이탈·₩ 가이드 (2026-06-08)
제미나이 제안과 비교해 중복 로직(빈집/진주/불타기)은 유지, **진짜 신규 3가지만** 구현:
- **통합 Reco Score(0~100)**: PEG 가치(35) + 수급강도(40: 쌍끌이+5일대금) + 개인이탈(15) + 섹터갭(10, 정렬에만 반영·표시점수는 공정하게 0)
- **개인 이탈 조건**: `individual.d1 < 0`(개인이 팔고 메이저가 받는 구조) = 린치 최강 신호. 👤 배지 + 보너스 점수
- **₩ 권장 매수 가이드**: 포트폴리오 원가 기준 신규=2%/추가=1% 환산 표시(자동 실행 없음, 참고 지침)
- `marketFlowKr.MarketFlowEntry`에 `individual(d1/d5/d20)` 추가, 캐시 v3→v4
- ⚠️ **버그 2종 수정**: ① 5일 누적 음수가 점수에 그대로 감점(LG 0점) → `max(0, f5+o5)` ② 종목 중복 출현(빈집·진주에 동일 종목, 점수 다름=섹터보너스 차이) → `fillGapSet`으로 중복 제거 + `toItem(sectBonus=0)` 점수 통일
- 학생 발견성: 카드 하단에 "📅 최근 20일 매매동향 보기" 명시 버튼(클릭 힌트 부재 해결)

---

## 🌍 글로벌 시총 Top 10 터미널 (2026-06-08)

KR vs US 시총 거인 체급 비교 — 자산 글로벌 분산 필요성을 수치로 체감하는 교육 앵커. 투자 리서치 → 🌍 글로벌 시총 Top 10 탭.

### 데이터 소스 (실측 검증)
- **KR**: 네이버 모바일 `api/stocks/marketValue/KOSPI`(이미 검증된 SSOT 재사용). `marketValueRaw` 필드가 **원 단위 그대로**(×1e6 불필요 — 첫 시도에서 단위 버그 발견·수정)
- **US**: Yahoo `quoteSummary.summaryDetail.marketCap`(yahoo-finance2 라이브러리). ⚠️ Yahoo `v7/v10` REST 직접 호출은 모두 실패(크럼 인증 필요) → 라이브러리 경로가 유일한 길
- 큐레이션 25개 후보(NVDA·AAPL·MSFT…)를 시총순 정렬해 US Top10 추출. KR은 STOCK 가드 통과 종목만 상위 10
- 환율은 `/api/exchange-rate` 재사용. 12h 캐시(`global-top10-v1:DATE`)

### 3대 킥 (제미나이 제안 채택)
- 🏷️ 린치 분류 뱃지(고정 매핑 — DB 의존 없이 시총 상위 고정 종목 정확 분류)
- 💱 원화 환산 병기: `7697조원 ($4.97T)` 형태로 체급 직관
- 🚫 ETF 차단(`getAssetType`)

### UI 디테일
- 🇺🇸/🇰🇷 대칭 2열, 시총 비례 바(US=파랑/KR=초록), 메달 순위
- 교육 앵커 문구: "미국 1위 시총은 한국 1위 대비 N배 규모 — 글로벌 분산 필요성을 수치로 확인"
- ⚠️ **행 높이 정렬 버그**: US 행에 USD 줄이 추가로 있어 KR보다 1줄 더 높았음(시각적 어긋남) → USD를 KRW 옆 괄호로 합쳐 양쪽 모두 "숫자 1줄+등락률 1줄" 동일 구조로 통일
- 검증: 삼성전자 1,923조 vs NVDA 7,697조(약 4배) — 정확

---

## 🧭 4계절 매크로 내비게이터 (2026-06-09) — 기능 13

최일 『4계절 투자법』을 주식 전용 환경에 이식. **성장×물가 2×2 사분면**(골디락스/인플레이션/스태그플레이션/리세션)으로 현재 계절을 판정하고, 내 포트폴리오가 그 계절에 맞게 짜였는지 0~100점으로 평가. 대시보드 투자리서치 → 🧭 4계절 내비게이터.
- ⭐ **핵심 = 새 판정기가 아니라 macro-regime SSOT의 뷰**: 앱에 이미 매크로 판정이 둘(macro-regime 6 phase·macro-weather 3 날씨) + 2026-06-07 SSOT 통일. Gemini 스펙대로 3번째 독립 판정기를 더하면 "맑음+금리고점+가을스태그" 동시 표시로 제2원칙 위반 → **물가/금리축은 macro-regime을 그대로 읽고, 성장축만 보강**
- **`src/lib/seasonNavigator.ts`**(순수함수, 외부호출 0): `seasonOf(growth, inflation)` → 사분면+간절기(SHOULDER). `[계절×린치6분류]` 적합도 매트릭스(0~1) + 우대섹터 +0.2 보정. `seasonalAlignment = Σ(주식비중×적합도)×100`. 11개 단위테스트 통과
- **`/api/season-navigator`**(auth·force-dynamic·`season-navigator-v1:userId:date:fp` 캐시·holdingsFingerprint 자동 무효화): 물가/금리축+역전경보=macro-regime / 성장축=OECD CLI / 보유=lynch_category+getSector(재사용)+환율 정규화
- **`SeasonNavigator.tsx`**: 2×2 휠(현재 사분면 glow) + 정합성 게이지 + 종목별 적합도 바 + 장단기 역전 빨강 경보 + 행동가이드/우대섹터/현금조언
- ⚠️ **성장축 데이터 검증(Phase 0)**: Gemini가 제안한 한국 재고순환선은 FRED에서 stale(KORPROINDMISMEI 2024-03·BSCICP03KRM665S 2023-12)=환각 → 대체재 **OECD 경기선행지수 CLI** 발견. 한국 KORLOLITOAASTSAM·미국 USALOLITOAASTSAM 둘 다 신선(2026-04). CLI 레벨(100기준)+모멘텀(3개월차)로 성장 방향 판정
- ⚠️ **축 정합성**: macro-regime이 美 Fed 기반이므로 성장축도 美 CLI(USALOLITOAASTSAM) 사용(두 축 같은 경제권). 한국 CLI는 향후 시장별 확장 여지
- ⚠️ **현금 = 조언 텍스트만**(점수 항 아님): investments에 현금 개념 없음(ticker·purchase_price·quantity뿐) → Gemini의 Seasonal Alignment Score 현금항은 데이터가 없어 정의 불가. 점수는 보유 주식 적합도만, 권장 현금 비중은 "직접 확인" 안내로만. 스키마 변경 0
- ⚠️ **장단기 역전 경보 무료**: macro-regime이 이미 fetch하는 yieldCurve(DGS2/GS10) `< 0` 한 줄로 Gemini의 조기경보 구현(추가 데이터 0)
- 검증(2026-06-09): US CLI 100.85↑+CPI YoY 3.78% → ☀️여름(인플레이션 국면), 역전 OFF(T10Y2Y +0.38). macro-regime "금리 고점·동결" 라벨과 일관. 봄(성장주)/겨울(방어주) 적합도 양극 정상
- ⭐ **시장별 계절(국장/미장)**: 성장축에 미국·한국 각각의 OECD CLI를 써 시장별로 판정, 물가축은 글로벌 공통(한국 CPI는 FRED stale=글로벌 기준). 종목을 시장으로 갈라 자기 시장 계절로 채점(`holdingFit` lib 추출 SSOT). UI는 메인 다이어그램=미국 앵커 + 🌏 시장별 배지 strip + 종목행 국기
- ⭐ **🛒 이 계절 매수 후보**: 현재 계절 우대 섹터의 종목을 유니버스(코어 100)에서 추려 퀀트 점수순(린치가중35+PEG35+마진20+FCF10)으로 제시(보유 제외). **macro-ai-picks가 적재한 공유 캐시 재사용**(추가 스크리닝 0) — `runScreener`가 `all`(슬라이스 전 100종)을 반환, `macro-screened-universe:v1`에 적재. 🐛 부수: `screenOne`이 빈값 `price.sector` 대신 `assetProfile.sector` 사용(섹터 필터·LLM 정확도 동시 개선)
- 검증(2026-06-09): 여름 우대(Energy·Materials·Industrials) 채점 — HD한국조선 100·삼성중공업 98·ConocoPhillips 95·Honeywell 95·Chevron 89, 보잉 39(PEG 23 고평가 필터)·포스코퓨처엠 41(PEG 4.5) 하위 정상
- 가독성: 2×2 축 라벨 세로회전 제거→가로 명확화(고성장/저성장·고물가/저물가), 흐린 #6e7f8f→#9aa7b5/#a8b5c2 상향. 정합성 표 헤더·범례·유리/중립/불리 글자 판정 추가(설명 없이 이해)
- 설계 결정·검증 적립: `docs/season-navigator/checklist.md`·`context-notes.md`
- ⚠️ **계절 적합도(holdingFit) 핵심 수정(2026-06-10)**: 초기엔 린치분류 기반(FIT 매트릭스)+우대섹터 +0.2 보정이었는데, 인플레에서 cyclical=1.0이라 상한에 걸려 **비우대 cyclical(은행·반도체)이 우대 cyclical(에너지·산업재)과 똑같이 계절 100** → '우대 섹터' 무력화. **섹터 50% + 린치분류 50% 블렌드로 재설계**(우대섹터=1.0/비우대=0.5). 에너지 1.0·은행 0.75로 분리. 통합 추천·보유 정합성 동시 적용. 캐시 season-navigator v3→v4

## 🎯 통합 3축 추천 (2026-06-10) — 4계절+수급 융합

4계절(매크로 방향)과 수급 맞춤추천(연료)을 **하나의 점수로 융합**. "둘 중 하나를 버리는 통합"이 아니라 직교하는 3축을 합침. 수급 레이더 탭 → [🎯 통합 추천].
- **`/api/unified-reco`**(auth·force-dynamic·`unified-reco-v2` 캐시·holdingsFingerprint): base=macro-screened 캐시(100). 3축 채점:
  ① **계절 적합**(seasonNavigator `holdingFit`, US/KR 시장별 계절) ② **펀더멘탈 가치**(screenOne 퀀트 score ×100) ③ **수급**(KR=marketFlowKr 실수급 / US=getMoneyFlow MFI+내부자+13F 프록시)
  - **통합 = 계절 25% + 가치 40% + 수급 35%**(방향=펀더멘탈 최대비중, 앱 철학)
- **`UnifiedReco.tsx`**: 종목당 통합점수 + 투명 3축 미니바 + 배지(저PEG·쌍끌이·개인이탈·13F거인·계절우대). KR은 매매동향 펼침
- 성능: KR40 캐시 즉시 / US는 계절+펀더 상위25만 MFI fetch(동시성5) / 최종15만 canonical PEG(제2원칙)
- ⚠️ **정직성**: US 수급은 MFI 프록시('수급\*' 라벨). US 상위25 밖은 supplyKnown=false → 빗금 '미집계'(가짜 50 금지). PEG는 stock-info SSOT. 보유 제외
- 사용자 확정: 한국+미국 모두, 투명 3축 표시
- 검증: 가중치 검산(3축高96>부분66/54>약함44) · holdingFit 수정 후 우대섹터(에너지·조선) 상위 재정렬 확인
- ⭐ **원칙적 선별(2026-06-10)**: 임의 `slice(0,15)` 제거 → ① 통합 65점 이상(품질 바닥) ② 섹터당 최대 4종(분산) ③ 최대 12종. `selectionRule` UI 명시. 캐시 unified v4→v5
- 🐛🐛 **계절 silent 오판 수정(2026-06-10, 치명적)**: unified-reco·season-navigator가 `/api/macro-regime`을 **HTTP 자기호출**로 가져오는데 실패 시 catch로 기본값(CPI2.5·hold)→hot=false→**골디락스 오판**. 실제 CPI3.9·hike=인플레(여름)인데 에러 없이 전체 추천을 틀린 계절로 계산(school-league 401 자기호출 버그와 동일). → **`fetchMacroData` in-process 직접 호출**로 교체(CPI는 FRED 직접·24h 캐시로 견고). 캐시 unified v5·season v7
- ⭐ **한국 최소 3종 보장(MIN_KR=3)**: 국내 학생용 → KR<3이면 품질바닥(65)+섹터cap 넘는 최상위 KR로 최저 미국 종목 교체. selectionRule 명시. 캐시 v6
- ⚡ **KR 수급 캐시 워밍 안정화**: market-flow-kr 크론이 16:00 KST 장마감 후에만 워밍 → 장중/주말 라이브 스크랩(느림). **최근 5일 캐시 폴백 + 라이브 1회 적재**로 스크랩 하루 최대 1회. ⭐부수효과: 캐시 채워지며 KR이 실수급으로 공정 랭크(KB금융 통합 84=실력 2위·신한지주 3일쌍끌이·기아 진입, 수급약한 삼성중공업 자연탈락)
- 🏰 **심화 검증(2026-06-10) — 버핏 ROE + Fwd EPS**: 최종 12종에만 4번째 축 배지(점수·선별 무손상). 🏰고ROE≥20%(버핏 퀄리티, canonical 재사용)·📈Fwd EPS 모멘텀(getAnalystSignal 이익추정 상·하향). ⚠️**DCF는 검증서 제거**: 원시 FCF 변동성(TXN 팹capex)으로 비현실적 값(-2637%) → 수학은 맞으나 오도. 라이브 검증으로 확인 후 신뢰가능한 ROE로 대체(BuffettDCFPanel의 5단계 FCF정상화는 배지엔 과함). 캐시 v7→v8
- `docs/unified-reco/plan.md`·`context-notes.md`

---

## 🎛️ AI 포트폴리오 운용 본부 (2026-06-10) — 진단·매도·매수 통합

기존 AI 리밸런싱 탭을 "① 진단 → ② 매도·리밸런싱 → ③ 통합 매수" 한 흐름의 운용 본부로 승격. 검증된 엔진 합성(리밸런싱 코어 무손상). 사용자 확정: 자동 분석·추천까지(체결 금지) / 기존 리밸런싱 승격.
- **`OperationsHQ.tsx`**: ① 진단 헤더 — 4계절 정합도 게이지 + 시장별 국면 + 계절 미스매치(적합도<0.5) 비중 점검. 적합비중 65%↑면 '대부분 적합', 미만이면 '절반 중립—우대섹터 확대 여지'(메시지 모순 수정)
- 리밸런싱 탭 = OperationsHQ + 기존 AiRebalancePanel + UnifiedReco(③ 통합 매수) 합성
- **🎖️ AI 본부장 종합 브리핑(`/api/hq-briefing`)**: season-navigator(진단) + unified-reco(매수 3축) + **ai-rebalance(손익 4분면=매도)** 3개 인증결과 합성 → Gemini가 "**X를 손절(손실·thesis붕괴), 그 회수 N%로 통합 1위 Y 편입**" 식 매도↔매수 연결 처방 3~4문장. 결정론적 폴백. ⚠️ buys 비면 캐시 skip→재생성. 인증 쿠키 전달 self-fetch. 캐시 hq-briefing-v3
- ⛔ 가드레일: 자동체결 금지·가짜수익 금지·손실깊은종목 저점매도 강요 금지(프롬프트 강제)
- 정합도는 여름 국면에서 tech편중 포폴이 정직하게 하락(82→69, 골디락스 오판 때 82가 거품)
- ✅ **필살기 완성(2026-06-10)**: 밸류에이션·수급·4계절·린치·버핏ROE·FwdEPS·거시를 한 점수·한 처방으로 통합. 대장정에서 11개 버그(계절silent오판·우대섹터무력화·스크리너throttle·L1staleness·DCF쓰레기값 등)를 화면검증→코드추적→수정→재검증으로 전부 포착

---

## 🔬 ETF 투시경(X-Ray) — Look-Through 분해 (2026-06-10)

학생 포폴의 큰 비중(교사 계정 39.8%)인 ETF를 구성종목·섹터로 투명 분해. 기존 STOCK 엔진 무손상(분해는 별도 레이어). 운용 본부 ① 진단 아래 통합.
- **Phase 0 실측**: US=Yahoo `topHoldings`(종목+비중+11섹터) ✅ / KR 국내형=Naver `etfAnalysis`(`etfTop10MajorConstituentAssets` 6자리코드+비중 + `sectorPortfolioList` 12섹터 + 자산/국가비중) ✅ / **KR 해외형(TIGER 미국S&P500 등)=종목명만(itemCode=""·weight="-"), 섹터·국가는 완전** ⚠️
- **제미나이 안 교정**: ① "네이버 PDF 크롤러" 불필요(etfAnalysis로 충분) ② 새 etf_components 테이블 반려(app_cache 7일) ③ **Top10 100% 재정규화 반려**(SPY Top10=35%를 몰빵으로 왜곡 → 섹터는 네이티브 비중, 종목은 원시 비중+'기타 분산')
- **사용자 확정**: 해외형은 섹터만(비중 추정 금지 — 정직) / 운용 본부 진단에 통합
- **`src/lib/etfLookThrough.ts`**(SSOT, `etf-comp-v3` 7일): `getEtfComposition` — topHoldings·sectorWeights(**GICS 영문 통일맵**: Naver IT/Yahoo technology→Technology, 제2원칙)·usWeight(국가비중)·isEquityEtf(KR=EQUITY 60%↑)·**isLeveraged**(키워드+티커셋 — 스왑 구조라 분해 부적합)
- **`/api/portfolio-xray`**(auth·fp 캐시 12h): 실질 종목 노출=직접+ETF경유(원시 비중) **중복 합산**(SK하이닉스 9.7%=직접 8.2%+TIGER200 1.5%) · 실질 섹터=네이티브 섹터벡터 가중합 · 커버리지 정직 분해 · **숨은 몰빵 경고**(ETF경유 포함 15%↑)
- **`PortfolioXray.tsx`**: 투시 토글+종목/섹터/ETF명세. OperationsHQ 진단 아래(ETF 미보유 시 자동 숨김)
- **Phase 3 — 4계절 정합성 ETF 반영**: 주식형·비레버리지 ETF를 정합성 분모에 포함. ETF fit=Σ(섹터비중×섹터적합 1.0/0.5), 계절은 usWeight≥50→미국. 비주식·레버리지·미분해는 제외(정직). season v8·hq-briefing v4
- ⚠️ **실DB 검증서 잡은 갭 2건**: ① 신형 영숫자 KR코드(0131V0 등)를 `\D` 제거가 파괴 → 코드 그대로 사용(네이버 직접 수용 실측) ② 레버리지(TSLL·AGQ) 분해 시 실노출(2X) 왜곡 → isLeveraged 제외+경고
- 검증: 라이브 6/6+6/6+5/5 · 실DB 5명 ETF 24개 분해(K방산 Top10=99.7% 커버·국고채 비주식 제외) · 화면 검산(커버리지 합 100.0%·중복합산 수학 일치)
- ⭐ **쌍둥이 지수 차용(2026-06-10)**: 해외형 KR ETF 종목비중 해결 — 사용자 제보(운용사 사이트) 라이브 검증 결과 TIGER/KODEX SPA(숨은 API 미발견)·KRX(LOGOUT) 전부 실패 → `etfBaseIndex`(추종지수)가 표준지수(S&P500→SPY·NASDAQ100→QQQ·필반→SOXX·다우→DIA·러셀2000→IWM, 정확 매칭만)면 **검증된 US 쌍둥이 ETF 구성비중 차용**(동일 지수 실측값, 새 크롤러 0). 비표준지수(테크TOP10 INDXX 등)는 정직하게 섹터만 유지. weightSource(native/twin)·twinTicker. etf-comp v4·xray v3. 검증 5/5(TIGER S&P500→SPY NVDA 7.9%) · 화면 검산: NVDA 실질 6.5%(직접 5.6+SPY경유 0.54+QQQ경유 0.38) 오차 0
- 💎 **Phase 4 합산 PEG(2026-06-10)**: 비중 있는 ETF의 상위 구성종목 PEG를 **canonical SSOT 가중평균**으로 합성 → ETF 밸류 판정(임계 1.0/2.2 = 뉴스레이더 valuationOf와 동일, 제2원칙). 음수·극단값(>10) 제외, **커버리지 40% 미만 미표시**(반쪽 평균 과신 방지)·커버리지 % 병기. 쌍둥이 차용분도 합산 가능. 푸터에 시클리컬 저PEG 함정 캐비엇. xray v4. 검증 3/3: TIGER200=0.61(cov100%)·TIGER S&P500(SPY차용)=1.75 적정·비중미제공=null
- `docs/etf-xray/plan.md`

---

## 🏛️ 연준 양대책무 대시보드 (2026-06-10) — 고용 안정 + 워시 절사평균 PCE

Fed Watch가 물가·금리 중심이라 연준 양대책무의 한 축(고용)이 비어 있던 것을 채우고, 2026 신임 케빈 워시 의장이 최우선시한 절사평균 PCE까지 통합. 거시경제(Fed Watch) 탭 MacroWeather 다음.
- **Phase 0 실측**: FRED 8종 전부 무료·신선(PAYEMS 159001·UNRATE 4.3·ICSA 225K·JTSJOL 7618·SAHMREALTIME 0.1·PCETRIM12M 2.35·PCEPI pc1 3.77). 제미나이 `SAHMREALTIME`·`JTSJOL` 안 실측 확인
- **`/api/fed-dual-mandate`**(공개·`fed-dual-mandate-v2` 12h 캐시): 고용 4종(비농업 MoM·실업률·ICSA 주간4주추세·구인배율=JOLTs/실업자) + 삼의법칙(SAHMREALTIME, 0.5 임계) + 워시 절사평균 PCE vs 헤드라인(노이즈갭). **신호등(과열/균형/냉각)·워시 판정 결정론적**
- **`DualMandateDashboard.tsx`**: 💼 고용 신호등+4지표+삼의법칙 게이지(0.5 침체선) / 🎯 워시 나침반(헤드라인 vs 절사평균 노이즈필터 비교·목표 2.0선)
- ⚠️ **가드레일(중요)**: 절사평균이 계절/macro-regime SSOT를 **silent하게 뒤집지 않음** — 참고 맥락으로만(헤드라인 CPI 3.9% vs 절사 2.35%가 다른 얘기를 해도 계절 판정은 macro-regime SSOT 유지). 푸터에 명시
- 검산: 신호등=균형·삼의 0.1(임계까지 0.4%p 여유)·노이즈갭 1.42%p(헤드 3.77 vs 절사 2.35=헤드라인 일시충격) 전부 PASS
- 🩹 **라벨 충돌 해소(2026-06-10)**: 고용 신호등 '균형(골디락스)' → **'균형(연착륙)'** — 4계절 투자법의 골디락스(성장↑·물가↓ 사분면)와 같은 단어·다른 축이라 학생 혼동. 고용은 연착륙으로 통일(코드에 ⚠️ 주석으로 이유 고정)
- 🩹 **비농업 +0K 콜드캐시 버그**: PAYEMS가 콜드 시점 1개월만 수집되면 momK=0이 캐시에 박제 → 화면 +0K. **setCache는 momK=0이면 저장 안 함 + getCache는 momK=0이면 무시·재계산**(비농업이 정확히 0인 달은 사실상 없음). v1→v2
- 🎯 **+0K 진범 확정(2026-06-12)**: 위 캐시 가드·재시도에도 +0K가 계속 보인 진짜 원인은 **UI 단위 버그** — momK는 이미 천명 단위(172=+172K)인데 `fmtK(n/1000)`(ICSA용 포매터)를 잘못 공유해 172→0.172→'+0K' 표시. API는 처음부터 늘 172를 반환했음. **교훈: 화면 표시 버그를 데이터/캐시 문제로 단정하기 전에, API 응답값과 렌더 수식을 끝까지 대조할 것**(같은 단위 접미사 K라도 원천 단위가 다를 수 있음)
- ✅ **HQ 브리핑 연준 기조 주입 완료**: `hq-briefing`이 `fed-dual-mandate`를 병렬 페치 → `policyTilt`(dovish/hawkish/neutral) 산출. 고용 균열+절사평균을 **매수 톤 보조 근거로만** 프롬프트/폴백에 주입("헤드라인 높으나 워시 기조물가 낮아 비둘기적일 수"). 🕊️/🦅/⚖️ 칩 표시. **가드레일: 계절/국면 SSOT 불변 명시**(금리 방향 힌트로 종목 성격 코멘트만). cache v4→v5
- 🎓 **최일 쌤의 통합 진단(2026-06-11)**: 고용 🟢만 보고 "물가도 잡혔다" 오독 방지 — 고용상태×절사평균 vs 목표×rateDir을 **전부 동적 조립**한 융합 해석 박스(v2→v3). 제미나이의 고정 문구(절사 2.8% 박제) 제안은 거부(실측 2.35% — 데이터 바뀌면 거짓말하는 박제 금지 원칙). 같은 지시서의 ETF Look-Through 지시서는 전부 기구현(쌍둥이 차용·레버리지 가드·합산 PEG는 제미나이 스펙에도 없는 상위 구현)이라 작업 불필요 판정
- 🩹 **기조 라벨 상대화(2026-06-11)**: FF선물이 연내 **인상**을 반영(rateDir=hike)하는데 칩이 '비둘기 우위(완화 쪽)'라는 **절대적** 표현 — FedWatch 화면과 정면 모순으로 보임. policyTilt에 macro-regime `rateDir` 합류: **'완화 쪽'은 rateDir=cut AND 절사평균≤2.0일 때만**, 그 외 dovish는 **'시장 대비 비둘기 여지'**(= 기조물가가 시장의 긴축 베팅만큼 단단하지 않아 덜 매파적일 수 있음 — 인하 단정 금지). 노트에 시장 프라이싱 한 줄(인상/동결/인하 반영 중) + Gemini 가드레일('금리 인하 예상'·'완화 국면' 절대 표현 금지, 상대 표현만). v5→v6. **원칙: 정책 기조 칩은 시장 프라이싱(FF선물)과 모순되게 읽히면 안 됨 — 항상 상대적 프레임**

---

## 📈 US 차트 타임프레임 KR 통일 (2026-06-10) — 자산관리 1D 버그

자산관리 탭에서 US 종목 1D 차트가 "전부 당일(06/10)·납작한 가격폭"으로 깨져 보이던 문제.
- **원인**: US(Yahoo)는 `YF_RANGE` 1D를 `range=1d, interval=5m`(오늘 장중 5분봉)으로 정의 → 캔들이 전부 당일. 반면 KR(네이버)은 1D=일봉 30개라 둘이 불일치(자산관리 탭에 US·KR 혼재 → US만 튐). 차트 컴포넌트(CandleChart/FullCandleChart)는 **색상 hex만** 바뀌었을 뿐 무관
- **수정**: `stock-price/route.ts`의 `YF_RANGE`를 KR과 동일한 **일/주/월봉 입도**로 변경 — 1D=일봉30(`3mo/1d`), 1W=주봉26(`6mo/1wk`), 1M=월봉24(`2y/1mo`), 1Y=월봉60(`5y/1mo`). `yfChart`(라인)·`yfOhlcChart`(캔들)이 동일 `YF_RANGE` 공유(SSOT) + `.slice(-take)`로 KR과 캔들 수 일치
- 검증: NVDA 1D=30캔들(2026-04-29~06-10 날짜 전부 다름)·1W=26·1M=24·1Y=60 ✅
- ⚠️ **배포 주의(중요)**: `vercel --prod`는 git이 아니라 **작업 디렉토리 전체**를 배포한다. 당시 git HEAD가 실제 코드보다 한참 뒤처져(미커밋 40+·미추적 30+) 있었고, 이 US 인트라데이 설정이 미배포 상태로 작업트리에만 있다가 재배포 시 "갑자기" 프로덕션에 드러났음 → **작업트리 전체 안전망 커밋**(`3f97133`, 87파일/12,343줄) + GitHub push로 정리

---

## 🎯 리밸런싱 신규편입 SSOT 통일 (2026-06-10) — 제2원칙

운용 본부 ①진단 브리핑·③통합매수와 ②리밸런싱의 **매수 추천 종목이 서로 달라** 학생이 혼란.
- **원인**: ①③은 `unified-reco`(통합 3축 = 계절×가치×수급)인데, ②리밸런싱 코어 후보만 `macro-ai-picks` **별도 엔진 + 자체 갭/섹터 재랭킹**을 써 종목이 갈림(SSOT 위반). 예: ②=BLK·V·ABBV vs ③=COP·KB금융·TXN·CVX
- **수정**: `ai-rebalance/route.ts`의 코어 후보 소스를 **`unified-reco` 상위 4종**으로 교체(보유제외·섹터분산·3축 채점을 unified-reco가 이미 수행). 회수 예산(coreBudget)은 통합점수 비례 배분 유지 — **"무엇을 살지"는 ③과 일치, "얼마나"는 회수액 기준**. 위성(10배거 CELH·CRDO)은 의도적 별도 공격 슬리브라 유지. cookie 전달(unified-reco 인증) / cache v13→v14
- 검증: ②코어=COP86·KB금융84·TXN82·CVX81 → ①(1순위 COP)·③(86/84/82/81)과 종목·순서·점수 완전 일치 ✅

---

## 🩹 시장 수급 랭킹 묵은 데이터 셀프힐 (2026-06-11) — 외부 발행 지연 동결

'시장 수급 랭킹 → 쌍끌이 연속매집'이 지난주 데이터에 종일 멈춰 있던 버그(신한지주 3일 쌍끌이로 표시됐으나 실제론 외인 3일 순매도=streak 0).
- **원인 진단(추측 금지·DB 실측)**: `app_cache`의 `market-flow-kr-v4:2026-06-10` 페이로드가 close=107,500(=06-05 종가)·dataDate 06-05인데 updated_at은 06-10T07:31(크론 정상 실행). 네이버 트렌드는 현재 06-10까지 발행 → **크론 실행 시점(16:00 KST)에 투자자 순매수 동향 미발행** → 묵은 스냅샷이 24h 동결
  - 원인1: 크론 `0 7 * * 1-5`(**16:00 KST**) — 장 마감(15:30) 직후라 외국인/기관 순매수 동향 미발행(다른 크론은 18~20 UTC인데 이것만 07 UTC)
  - 원인2: 캐시가 **일자키+TTL만 보고 데이터 신선도 자체는 미검증**(셀프힐 부재)
- **수정**: ① `MarketFlowKrResult.dataDate`(최신 거래일 YYYY-MM-DD) + `latestTradeDate()` 프로브(삼성전자 1 fetch) ② `market-flow-kr` GET **셀프힐** — 라이브 최신 거래일 프로브 후 `cached.dataDate < live`면 재계산 ③ 크론 `0 7`→`0 11`(20:00 KST, 발행 후)
- **검증**: dataDate 06-05→06-10, 신한 streak 3→0(close 107,500→98,200), 쌍끌이 목록이 지난주(신한·하나·LG)→실제(롯데칠성·한국콜마·대한항공·에스디바이오)로 갱신
- ⚠️ **재발 방지 원칙(중요)**: **외부 소스(네이버/KRX/Yahoo 등) 발행 지연 + 일배치 캐시 = 종일 동결 패턴.** 일별 캐시는 벽시계 날짜키만 믿지 말고 **데이터 자체의 최신 거래일(dataDate)로 신선도를 판정**해 셀프힐하라. 같은 패턴이 의심되는 다른 일배치(satellite-scores·school-index 등) 점검 대상

---

## ⚔️ 섹터 피어 X-Ray 기저효과 PEG 가드 (2026-06-11) — BP 0.01 착시

X-Ray가 BP(PEG 0.01)를 CVX보다 '더 싸고 탄탄한 1등'으로 추천 — 운용 본부(CVX 1순위)와 모순돼 학생 혼란.
- **원인(실측)**: BP 원시 이익성장 **+1,019%**(작년 이익 붕괴 후 회복 = 기저효과) → PEG=PER÷G가 0.01로 수렴. 배당성향 160%·ROE 5.8%로 '탄탄'과도 거리. **경기순환주 저PEG 함정**(린치 원리) — 린치 밸류 엔진엔 `effectiveGrowth` 가드(ETN 770% 사건)가 있었지만 X-Ray(`getSectorPeers`)엔 없었음(제2원칙 위반)
- **가드**: `PEG<0.3 && 원시G>100%` → Fwd EPS 성장 기준 정상화. **Fwd 성장도 100%↑면 trailing EPS 자체가 붕괴 저점이라 정상화 불가 → PEG '—' 처리**(순위·라이벌·bestValue 판정 자동 제외). `pegBaseEffect` 배지(⚠️기저효과, 호버 설명) + 푸터 함정 경고
- **검산**: BP rawG 475%·FwdG 230% → '—' 제외 ✅ / TTE 57%·SHEL 27%·EQNR 29% 미발동(정상값 유지) ✅ → 이후 라이벌 판정은 진짜 PEG끼리(TTE 0.73 vs CVX 0.76)
- 참고: 통합매수(③)와 X-Ray의 1등이 다른 것 자체는 설계 의도 — ③은 유니버스 내 계절×가치×수급 편입 적합성, X-Ray는 글로벌 동종업계 순수 가치 스냅샷(BP는 유니버스 밖)
- ✅ **추천 엔진 전체 확장(2026-06-11)**: `isPegBaseEffect(peg<0.3 && G>100%)`를 **canonicalFundamentals(SSOT)**에 공통 헬퍼로 승격. ① `marketFlowKr` PEG 적재 시 `pegSuspect` 동시 판정(canon-fund 캐시 공유·비용 0, 키 v4→v5) ② **맞춤 추천**(v7): suspect면 PEG 가치점수(최대 35) **0점** + 진주/임박 저PEG 자격 박탈 ③ **통합 추천**(v10): 💎 뱃지 박탈 + '⚠️ 저PEG 기저효과 의심' 배지 ④ UI 경고 배지(호버 교육 설명). **검증: SK하이닉스 0.09(+305%)·원익IPS 0.13·LG이노텍 0.14(+137%) 발동 / HD한국조선해양 0.16(+85%, 진짜 수주 사이클)·삼성전자 0.56 미발동** — 함정과 진짜 저평가를 분별
- ⚠️ **주의(중요)**: PowerShell로 한글 포함 파일을 `Get-Content -Raw | -replace | Set-Content` 일괄 치환하면 **CP949↔UTF-8 충돌로 한글 주석 전체가 깨짐**(이번에 4파일 손상→git checkout 복구). 다중 파일 문자열 치환도 반드시 **Edit 도구**로 할 것

---

## 📊 연준 핵심지표 차트보드 (2026-06-11) — 거시경제 탭

양대책무 카드가 '지금 숫자'만 보여줘 추세가 안 보이던 것을 보완 — FRED 시계열 4분면 그리드.
- **`/api/fed-charts`**(공개·12h 캐시): FRED 7시리즈 일괄 Promise.all(BFF — 분당 제한 회피). **일별 기준금리(DFEDTARU)는 `frequency=m&aggregation_method=eop`로 월말 다운샘플링**(월별 시리즈와 주기 통일 — 제미나이 지적 반영)
- **`FedChartsBoard.tsx`**(Recharts 2×2): ①물가 3겹(헤드라인 CPI vs 근원 vs **절사평균 PCE** + 목표 2%선 — 노이즈 벗기기 교육) ②PPI 전월비 막대(CPI의 상류·2~3개월 선행, 최근 2개월 vs 직전 6개월 비교로 **재가속 경고 동적 배지**) ③고용 듀얼(비농업 막대+실업률 라인) ④연준의 실탄(FF금리 vs 절사평균 갭=실질 긴축 강도)
- 해석 문구 전부 동적 계산(박제 금지) · **컨센서스(예측 vs 결과) 비교는 무료 신뢰원 없어 정직 제외** · 계절/국면 SSOT 불변
- 검증: PPI 1.06%=인베스팅 1.1% ✓ · 근원 CPI 2.82%=뉴스 2.8% ✓ · 고용 +172K=양대책무 일치 ✓ · 재가속 경고 발동(4월 1.4%·5월 1.06% 연속 서프라이즈) ✓ · 절사평균 최신월 null은 발행 시차(connectNulls 처리)
- ✅ **CPI vs PCE 보강(2026-06-12, v3)**: ①차트에 **근원 PCE(PCEPILFE, 연준 공식 목표)** 라인 추가 + 🎓 교육 아코디언(지출범위·대체효과·가중치 3대 차이 + 최일 쌤 실전 팁). 제미나이 보충 의견 검증 중 2건 보정: ① CPI 가중치 '2년 1회'는 구식 — **2023년부터 연 1회 갱신** ② 통설(근원 CPI>PCE)과 달리 **현재 실데이터는 근원 PCE 3.29% > 근원 CPI 2.82%**(의료·서비스 압력 국면) → 시점 단정 문구 금지, inflationNote에 **CPI↔PCE 괴리 양방향 동적 해석**(±0.3%p 이상일 때만, 주거 시차 vs 의료서비스 압력으로 출처 해석)

---

## 🧬 피터 린치 7대 분류 Matrix & 함정 레이더 (2026-06-12) — 진단 탭

운용 본부 ① 진단에 보유 주식의 린치 7대 분류 시각화 추가(제미나이 지시서 기반, 'AI 1억 백지 퀀트 빌더'의 분류 엔진 베이스).
- **`/api/lynch-matrix`**(v2·12h 캐시·fp 무효화): ①**티커 병합**(분할매수 여러 행→1종목, 카테고리 충돌 시 최대 비중 행 채택) ②**MECE 단판 분류** ③함정 레이더 = `isPegBaseEffect` SSOT 재사용. 비중은 **평가액(현재가) 기준**(stock-price 배치, 실패 시 원가 폴백) — ai-rebalance '분산 개선'과 동일 기준
- **`classifyLynchMece()`를 lynchAnalysis.ts(SSOT)로 승격**: 사용자 지정 > 펀더멘탈 자동(G<-10%→턴어라운드 / 경기민감 섹터→경기순환 / G≥20%→고성장 / G≥10%→우량 / 그 외→저성장) > 미분류. 첫 매치 단판이라 중복 소속 구조적 불가
- **`LynchClassificationMatrix.tsx`**: 도넛(Recharts Pie) + 클릭 펼침 분포표(PEG·성장률·분류 출처) + 🚨 함정 배지(클릭 시 린치 페르소나 해설). Tailwind 대신 기존 인라인 다크테마 준수
- ✅ **사수(DEFEND) 기저효과 가드 + 분류 SSOT 통일(같은 날)**: 진단 탭이 "GEV PEG 0.21 믿지 마라" 경고하는데 ② 사수 패널은 같은 PEG를 호재로 표기하던 모순 해소. ① `SignalMetrics`에 `earningsGrowth` 추가(canon-fund 우선, jarvis-metrics v8) → `evaluateSignal` BUY에서 suspect PEG 제외 ② ai-rebalance(v15): MECE 분류 적용 + `pegSuspect` 필드, 사수 칩 UI는 suspect면 ⚠️ 붉은 배지 ③ 검증: 사수 4종→2종(NVDA 0.48·PLTR 0.59만 잔류, GEV·인텔리안테크 탈락), Matrix(44.2/33.7/21.9) = 분산 개선 수치 **소수점까지 일치**
- 교훈(제2원칙 확장): "같은 지표는 같은 출처"를 넘어 **"같은 분류는 같은 분류기, 같은 비중은 같은 평가 기준(원가 vs 평가액)"**까지 통일해야 화면 간 모순이 안 생긴다

---

## 🛰️ AI 1억 백지 퀀트 빌더 (2026-06-13) — 신규 메뉴(자산&모니터링)

보유 무관 '백지'에서 코어-새틀라이트 포트폴리오를 설계하는 킬러 기능(제미나이 기획 기반). 총투자금(억 단위) 입력 → 처방전.
- **`lib/quantBuilder.ts`**(설계 SSOT·12h 전 사용자 공유 캐시): Core(50~70%, 국면 연동) = SPY·QQQ·SCHD + **KODEX 200 상시 15~20%**(한국 학생 홈 마켓 — v1이 100% 미국이던 것을 사용자 피드백으로 수정). Satellite = unified-reco SSOT 점수 재사용(제2원칙 — 통합매수와 동일 점수·기저효과 가드)
- **3축 게이트**: 🏰버핏(ROE 15%↑) · 💎린치(PEG 1.0↓&기저효과) · 📡수급(60↑). **fail은 명백한 결격만**(추정하향·PEG 2↑·ROE 8%↓·수급 40↓) — v1은 fail이 과도해 12후보 중 1종 생존→위성 40% 독식 버그. **종목당 상한 10%** + 미달분 Core 환류(현금 방치 금지)
- **UI(`QuantBuilderLab.tsx`)**: 궤도 시각화(Core 행성+위성, 3축 전부 통과=초록/2축=보라) · ETF 투시경 합성 실질 섹터 도넛 · **52주 위치 게이지+1년 주봉 스파크라인**(v3 — `fetchPriceContext`, Yahoo 1주봉, 바닥권~신고가권 라벨, "어느 위치에서 사라는 건지" 교육)
- **복사하기**: `/api/quant-builder/copy` — 서버 캐시 설계안 재사용(클라 비중 변조 방지), 현재가=가상 매입가, `asset_role` CORE/SATELLITE 기록, 중복 티커 스킵 정직 보고, transactions 자동 기록
- 'AI 1억 백지 퀀트 빌더'의 분류·점수 엔진은 1단계(린치 Matrix)와 unified-reco를 그대로 재사용 — 신규 판정기 0개

---

## 🔥 오늘 시장의 눈 — 마켓 카탈리스트 (2026-06-13) — 실시간 대시보드 최상단

"오늘 돈과 눈이 쏠릴 곳"을 아침에 알려주는 촉매 레이더(스페이스X 상장일 실전 검증).
- **`/api/market-catalyst`**(공개·3h 캐시): ①메가 뉴스 ≤3건 = Google News RSS → Gemini 선별("헤드라인에 있는 사건만" 환각 가드) ②수급 블랙홀 = **전부 정량**(Yahoo trendingSymbols 거래량÷3개월평균 1.5배↑ 또는 ±3%↑ / KR은 market-flow-kr 쌍끌이 캐시 재사용) ③자비스 한줄 처방(린치/버핏 페르소나·뇌동매수 경계·함정 레이더 연계)
- **v3 핵심 교훈**: 한국어 국내 시황 쿼리만으론 스페이스X 상장급 글로벌 메가가 국내 스팩 뉴스에 밀려 누락 → **Google News 미국판(en) 피드 2종 추가**(당일 마켓·IPO/Nasdaq debut) + 헤드라인 앞배치 + 우선순위 규칙(글로벌 메가>섹터 수급>개별 특징주). v2: KR 종목은 6자리 코드 대신 한글 종목명 표기 지시
- 검증: 스페이스X 상장 1순위 포착 + 수급 블랙홀의 SPCL 거래량 107배와 뉴스가 화면 안에서 연결됨(메가 뉴스→수급 쏠림 교육 완성)
- 월별 평가손익 차트: 소액 월(6월 -4.5천원)이 ±120만 축에서 1px 미만→안 보이던 것 `minPointSize=3`으로 해결(데이터는 정상이었음 — 누적선 차분으로 검산하는 법 기록)

---

## ⏳ 투자 타임머신 — 하드코딩 백테스트를 실데이터로 (2026-06-13)

기존 '투자 타임머신' 탭이 `BACKTEST_DATA`/`BACKTEST_SUMMARY` **완전 하드코딩**(+108% 등 지어낸 숫자)이었음 — 하드코딩 금지(제1원칙)를 가르치는 앱의 플래그십이 정면 위반. 레버리지 시뮬레이터는 이미 완성돼 있어 미수정(제미나이 제안 #1 불필요).
- **`/api/portfolio-backtest`**: 내 실보유 종목을 `stock-price-history`(Yahoo·Naver 실제 연도별 평균가)로 백테스트. 가격배수 Σ(원가비중×배수)로 인덱싱(통화 무관). Core/Satellite 분해 + 벤치마크(US/KR 원가비중 혼합 SPY+KODEX200). 생존편향·후견편파 정직 고지
- **출처 토글(v3)**: `?source=real|quant` — real=investments / quant=퀀트빌더 추천안을 **DB 미기록** 직접 백테스트. PortfolioTimeMachine에 [내 실제 포트 ↔ AI 퀀트빌더 추천] 토글
- **코인·원자재 포함(v5)**: 업비트 월봉 API(`/v1/candles/months`, 무료·무인증·**1회 72개월**)로 stock-price-history에 CRYPTO 지원 추가. 코인·원자재=**대안자산(alt)** 별도 라인 + 전체(Total)에 합산. 벤치마크 비중은 주식만(대안자산 제외). 검증: BTC 7개년·PSLV 6개년 실수신, 19종 전부 포함(코인1·원자재1 alt 분리)
- **교훈**: ① 사용자가 "복사 안 했다"는데 내가 "오염"이라 단정 → 틀림(cleanup 0종). **추측 말고 자산관리(투자 19종=미국9[PSLV 은ETF]+한국9+코인1)로 사실 확인이 먼저** ② 코인은 업비트(KRW)라 Yahoo 불가, 월봉으로 연평균 산출

## 🛰️ 퀀트 빌더 가상종목 오염 차단 (2026-06-13)

복사하기(`/api/quant-builder/copy`)가 가상 종목을 실제 `investments`에 **구분 플래그 없이** insert → `investments`를 읽는 **35개 화면 전부**(총자산·월별손익·리밸런싱·계절정합·이 백테스트)가 가상을 진짜처럼 계산하던 잠재 결함. 사용자 선택: **분리**.
- 복사 라우트 **폐기(410)** — DB 기록 제거. `/api/quant-builder/cleanup`(가상 트래킹 거래 표식으로 식별·삭제) 추가했으나, **대부분 학생이 복사 안 함 → 정리 버튼은 혼란 유발이라 UI에서 제거**(라우트는 백엔드 잔존)
- 추천안 성과는 타임머신 출처 토글로(오염 0)

## 🧭 UX 정리 묶음 (2026-06-13)

- **국민연금 자산현황 이관**: 거시경제 탭(금리·인플레와 맥락 불일치) → **글로벌 시총 Top 10 탭**(시총 거인 기업 + 거인 투자자의 장바구니 = '거인' 테마 통일). 컴포넌트 이동만, UI 무수정
- **마켓 카탈리스트 기본 접힘**: 메인 화면 점유 최소화 — 평소 1줄 헤더(1순위 미리보기), 헤더 클릭 시 펼침
- **맞춤 추천(국내) 명시**: 외인·기관 일별 수급 공시가 있는 **한국 주식만** 대상(미국은 통합추천 탭). 탭 라벨 `(국내)` + 헤더 🇰🇷 배지. ※ market-flow-kr 기반이라 모수 확장과 무관

## 📈 AI 리밸런싱 모수 100→약 220종 확장 (2026-06-13)

`macroPhaseScreener.ts` 유니버스 = 리밸런싱·통합추천·4계절·퀀트빌더·운용본부가 공유하는 후보 풀(`macro-screened-universe`).
- **US 60→125**(반도체장비·SW·헬스케어·금융·산업재·소비) · **KR 40→94**(코스피 중형 + **코스닥 성장주**: 소부장·바이오·로봇·2차전지). 합계 219종 전부 유니크
- S&P500(대형주) 전체는 의도적 제외 — **숨은 10배거는 코스닥 소형주**라 그쪽 보강. 630종(S&P500+코스피100+코스닥30)은 종목당 Yahoo 1콜 × 120s 한도로 불가
- 안정화: 동시성 6→8, `macro-ai-picks` maxDuration 120→**300s**, 캐시 `macro-screened-universe:v2→v3`(unified-reco·season-navigator 동시 반영). **실측 26s 완료**
- ⚠️ 효과는 다운스트림 사용자별 캐시(12~24h) 만료 후 또는 새로고침 시 노출

---

## 🪙 코인 랩 — 비트코인 독립 분석 엔진 (2026-06-14)

주식 엔진(PER·PEG·EPS)은 이익 없는 코인에 0% 적용 → **완전 독립** 신설(제미나이 '코인 랩' 기획 + 자체 설계). 투자 리서치 탭.
- **`/api/coin-lab`**(공개·1h 캐시): 4축 — ①사이클(반감기 4년 게이지 + **메이어 멀티플**=가격÷200일이평, 유료 MVRV 무료 대체) ②심리(공포탐욕 alternative.me + BTC/ETH 도미넌스) ③온체인(mempool.space 해시레이트·난이도) ④유동성(FRED M2 vs BTC 100정규화 오버레이) + 🇰🇷김치프리미엄(업비트 vs 글로벌)
- **데이터 전부 무료·무인증**: CoinGecko(global·markets·market_chart)·alternative.me·mempool.space·업비트·FRED
- **국면×리스크 처방**(매수 지시 아님): 공포탐욕+메이어 조합 → accumulate(공포·저평가)/caution(탐욕·과열)/neutral. 학생 **가드레일**: 코인 ≤5% 권장 + **내 실제 코인 비중과 연동**(초과 시 경고). "이자 없는 로켓 연료, 잃어도 되는 돈만, -80% 드로다운은 정상"
- ⚠️ **초판 버그 2건(검증서 발견·수정)**: ① **CoinGecko 동시 버스트 → 429로 전멸** → 순차 호출 + 브라우저 UA + 429 1회 재시도 + 업비트÷환율 폴백 + **핵심 성공 시에만 캐시**(부분실패 박제 방지). ② M2 vs BTC 오버레이 기준월이 BTC 300일 범위 밖이라 BTC 라인 전멸 → **두 시리즈 교집합(~9개월)** 정규화. 캐시 v1→v3
- 교훈: **무료 외부 API 다수 집계 시 같은 호스트는 순차 호출**(버스트 429), **부분실패 결과는 캐시 박제 금지**(핵심 키 성공 조건부 setCache)

---

## 🔷 코인 랩 확장 — 알트코인·10년차트·이중축 (2026-06-14)

코인 랩(₿비트코인)에 [🔷 알트코인] 서브탭 + 비트코인 장기 차트 추가. "캔들이 아니라 네트워크 실사용을 본다"(코인판 린치).
- **`/api/altcoins`(공개·12h): ETH·SOL·XRP 가격 vs 네트워크 펀더멘탈 이중축 오버레이.** 코인별 최선의 **무료·무키** 지표 — **ETH·XRP=활성주소(DAU·CoinMetrics 커뮤니티), SOL=일일 수수료(DefiLlama)**. 디커플링 판정(hype/healthy/value/neutral) + 자비스 동적 처방
- **무료 데이터 소싱 교훈(중요)**: ① CoinMetrics 커뮤니티는 BTC·ETH·XRP만 무료, **SOL은 403(유료)** → SOL은 트랜잭션 수수료(=실사용 동행)로 대체 ② **CoinGecko 무료는 365일 초과 401**(엔터프라이즈 전용) → **중장기 가격은 Yahoo Finance(BTC-USD·ETH-USD 등 주봉, 무료)**로 우회 ③ Token Terminal·Helius는 키 필요 → 키 없는 원칙상 제외
- **비트코인 10년 차트 × 반감기**: Yahoo BTC-USD 10년 주봉(262p) **로그 스케일** + 반감기(2016·2020·2024) 세로 점선 마커(`position:insideTop`으로 클리핑 회피) + 🎓반감기 교육 아코디언(21만블록 보상절반·공급충격·S2F 디지털금)
- **차트 다년화로 판정 살아남**: 1년 동반하락(전부 중립)→3년으로 보니 **SOL healthy(+341%/수수료+22350%)·XRP hype(+135%/DAU-1.8%, 가격만 펌핑)·ETH neutral** 등 교과서 사례 복원
- **M2 vs BTC 이중축**: 단일 100정규화 축은 BTC 스윙(+180%)에 M2(+9.8%)가 평평한 직선으로 묻힘 → **좌축 M2($T)·우축 BTC($) 각자 스케일**로 M2 완만한 우상향 가시화. 교훈: 스케일 차 큰 두 시계열은 정규화보다 **이중축**
- **④ 네트워크**: 조잡한 SVG 스파크라인 → Recharts 영역 차트. ④+⑤를 2단 배치(풀폭 가로 늘어짐 해소)
- ⚠️ CoinGecko 다수 호출은 순차(버스트 429), 부분실패는 캐시 박제 금지(핵심 키 성공 조건부 setCache) — coin-lab 초판서 학습

## 🌟 종목 투자 프로필 카드 (2026-06-15) — 리서치 페이지 상단 캡스톤

제미나이 옵션1(종목 상세 '투자 프로필' 탭)을 우리 구조에 맞게 우월 구현. 단일 종목의 **해자·스타등급(공정가치)·상대 PSR**을 3초 요약 카드로 리서치 페이지 최상단에 배치.
- ⚠️ **제미나이 안 교정**: 리서치 페이지엔 이미 🏰해자경보기·⚔️섹터피어(PSR 포함)가 있어 제미나이대로면 **중복** → 기존 컴포넌트는 '상세'로 두고 이 카드는 '3초 캡스톤'(정보 위계). "QuantBuilderLab 차트 재사용"도 오답(빌더는 포트폴리오용) → 실제 재사용은 buffettDcf·morningstarRating·getMoatBreach·getSectorPeers
- **`src/lib/stockProfile.ts`**(`buildStockProfile`): stock-info(DCF입력·peg·psr·roe·opMargin) + stock-price(현재가) + lynch-classify(카테고리) + getMoatBreach(해자) + getSectorPeers(상대PSR) 병렬 → `computeStarRating`(공유 SSOT). 신규 계산 0
- **`/api/stock-profile`**(공개·6h 캐시·개별주식 가드): ETF·코인 unsupported 차단
- **`StockProfileCard.tsx`**: ① 해자 배지(폭+추세) ② 스타 게이지(공정가치 라인 대비 현재가 위/아래) ③ 상대 PSR 막대(종목 vs 동종 중앙값) + 불확실성·자본배분. 리서치 분석 카드 맨 위(개별주식만)
- ⭐ **제2원칙 핵심**: 카테고리를 **lynch-classify(DB 우선)** 로 받아 포트폴리오 모닝스타(investment.lynch_category)와 동일 → 같은 종목 별점이 화면마다 일치. 검증: NVDA ★2·PLTR ★1·SK하이닉스 ★3·GEV/TEM 별점보류가 운용본부 모닝스타와 **정확히 일치**. PLTR 기저효과=false(peg 0.57)도 전 화면 일관. 공유 SSOT 함수가 두 기능에서 동일 결과를 내는 게 입증됨
- 검증(2026-06-15): NVDA·PLTR·SK·GEV·TEM 정상 / QQQ·BTC unsupported 차단 / 상대PSR 동종 중앙값 비교(피어 부족 시 절대값만·graceful)

## 🧭 AI 본부장 상황 인지형 처방 — 리스크 체크 레이어 (2026-06-15)

`hq-briefing`(본부장 종합 브리핑)에 규제·밸류·해자를 인지하는 `Context-Aware Layer` 추가. 제미나이 옵션3(규제+상대PSR+해자를 AI 프롬프트에 주입) 채택하되 우리 데이터·철학에 맞게 우월 구현.
- ⚠️ **제미나이 안 교정 3건**: ① `moat_grade`+`relative_psr`를 따로 붙이지 않고 **모닝스타 등급 단일 소스 재사용**(해자+공정가치 P/FV+기저효과). P/FV가 절대 상대PSR보다 정확한 밸류 신호 ② **규제는 코인 자산에만**(정직) — 주식 종목별 규제 DB 없음, 있는 건 `crypto-regulation` 기후. 코인 보유 감지(admin 쿼리) + climate≠green일 때만 주입 ③ **판정은 결정론적(코드), AI는 서술만** — 제미나이처럼 AI에게 "규제 위험인지 판단"시키면 환각(앱의 반복 원칙: Gemini는 코칭만)
- **`riskChecks` 결정론적 산출**(4종): 🔴/🟡 규제(코인) · 공정가치 대비 고평가(모닝스타 ★1~2) · 해자 없음(moatWidth none) · 기저효과(baseEffect). morningstar-rating 결과에서 추출 → 프롬프트 `[리스크 체크]`로 주입 + 가드(규제🔴=신규 매수 '대기' 명시 / 해자없음=비중 3%↓ 권고 / 고평가·기저효과=추격 자제·분할 익절). 결정론적 폴백에도 포함
- **`HqBriefing.riskChecks`** + OperationsHQ 브리핑 카드 **상단에 🧭 리스크 체크 섹션 굵게**(제미나이 요청). hq-briefing이 morningstar-rating·crypto-regulation 추가 합성(둘 다 35s/10s 타임아웃·graceful — 콜드 타임아웃 시 해당 리스크만 생략). 캐시 v6→v7
- 원칙: "리스크 체크에 없는 내용 지어내지 마라"(할루시네이션 가드) · 계절/국면 SSOT 불변 · 자동체결 금지
- ⚠️ **기저효과 기준 통일(검증서 발견·수정, morningstar v2→v3·hq-briefing v7→v8)**: 모닝스타 별점·리스크체크가 기저효과를 `growth>100%`만으로 판정했으나, 함정레이더·PSR·섹터피어는 `isPegBaseEffect`(**peg<0.3 AND growth>100%**) 사용 → **PLTR(peg 0.57·growth 251%)**이 모닝스타에선 기저효과, 함정레이더에선 아님으로 **화면 간 모순**(제2원칙 위반). 모닝스타도 동일 공식으로 통일(StarInputs에 peg 추가) → PLTR은 전 화면 '기저효과 아님(단순 고평가)', GEV(0.22)·SK하이닉스(0.09)·인텔리안테크(0.21)는 전 화면 일치. 교훈: **새 기능에 기저효과/밸류 가드를 넣을 땐 반드시 기존 SSOT 공식(`isPegBaseEffect`)을 그대로 써야 한다 — 비슷하지만 다른 임계(growth만 vs peg+growth)는 제2원칙을 깬다**(client 컴포넌트가 쓰는 lib이라 server-only canonical import 대신 동일 공식 인라인)

## 🌟 모닝스타식 스타 등급 (2026-06-15) — 운용 본부 진단 캡스톤

세계적 평가사 모닝스타의 공개 방법론(경제적 해자·공정가치·불확실성·자본배분)을 **기존 엔진으로 재현**(교육용). 흩어진 분석(DCF·해자·ROE·PSR)을 한 별점으로 묶는 진단 캡스톤. AI 운용 본부 ① 진단에 통합.
- ⚠️ **제미나이 안 교정 2건**: ① "AI DCF 연산이 핵심" → 거부. 이미 결정론적 DCF(버핏 패널)·해자 엔진 보유 → Gemini DCF는 환각·불일치(제2원칙 위반). **AI 미사용 결정론적 합성**이 정답. ② 모닝스타 정수 **Uncertainty Rating 누락** → 추가. 별점은 단순 ±20%가 아니라 **불확실성에 따라 밴드가 달라짐**(안정주 -20%면 ★5, 변동성 큰 적자주는 -60%는 싸야 ★5) — "위험할수록 더 큰 안전마진" 교육 포인트
- **`src/lib/buffettDcf.ts`**(신규 SSOT): `calcDCF`+`deriveDcfInputs`를 버핏 패널에서 추출 → 패널·모닝스타가 동일 계산 공유(제2원칙). 동작 무변경
- **`src/lib/morningstarRating.ts`**: `computeStarRating` — ① **Uncertainty**(해자폭+적자여부+카테고리 → Low/Med/High/Very High) ② **별점**(불확실성별 P/FV 밴드: Low ★5≤0.80 / Very High ★5≤0.40, 해자 붕괴 시 -0.5) ③ **자본배분**(ROE+순부채 → 우수/보통/미흡) ④ **해자 추세**(getMoatBreach verdict → 개선/안정/훼손)
- **`/api/morningstar-rating`**(auth·force-dynamic·maxDuration 120·`morningstar-rating-v1:user:date:fp` 24h): 보유 STOCK만 → 현재가 배치(stock-price POST 1회) + 종목별 stock-info(DCF입력·ROE·영업이익률)+getMoatBreach(해자). 신규 계산 0. 적자·FCF음수·데이터부족 → `dcfOk=false`(별점 보류, 해자만 표시 — 정직)
- **`MorningstarRatings.tsx`**: ★별점 게이지(0.5단위) + 🏰해자 배지 + 할인/할증% + 펼침 상세(현재가·공정가치·불확실성·해자추세·자본배분). 평균 별점. 운용본부 진단에 마운트(보유 주식 없으면 자동 숨김)
- **원칙**: 모닝스타 실제 별점·적정가 베끼지 않음(저작권) — **공개 방법론을 우리 DCF·해자로 재현한 교육용**. 밴드 % 상수는 공개 방법론(FRED 폴백처럼 허용). "별점은 가치지 타이밍 아님" 교육 문구 명시. 공정가치=버핏식 보수적 DCF라 메가트렌드 성장주는 비싸게 나올 수 있음(정직 고지)
- ⚠️ **기저효과 가드 + 경기순환주 caveat(검증 중 발견·수정, v1→v2)**: 화면 검증서 **GEV가 ★5(56% 저평가)** 인데, 같은 진단 탭의 린치 Matrix는 GEV를 "기저효과 경고"로 띄워 **한 화면 내 모순**(ETN·BP 사건과 동일 패턴·제2원칙 위반). 실데이터 확인 결과 GEV earningsGrowth **+214.7%**(분사 후 적자→흑자 기저효과)가 DCF 성장률(상한 35%)을 부풀려 공정가치 과대 → '저평가' 착시. **수정**: `computeStarRating`에 `growth` 입력 + 린치 Matrix와 **동일 기준**(growth>100%=`isPegBaseEffect` 철학) `baseEffect` 판정 → **기저효과 + 저평가 방향이면 별점 보류**(`stars=null`) + ⚠️기저효과 배지(고평가 방향은 보수적이라 유지). 경기순환주(COP 199% 고평가 등)는 현재 이익 기준 DCF의 본질적 한계라 푸터 caveat 추가. 검증: GEV growth 2.147→보류 / COP −0.14·NVDA 0.65→영향 없음(유지). 교훈: **DCF·PEG·PSR 어디든 '기저효과(이익 폭증 저점 회복)'는 동일 SSOT 기준으로 가드해야 화면 간 모순이 안 생긴다**(반복 패턴)

## 💵 PSR(주가매출비율) 전 화면 도입 (2026-06-15) — 적자기업·성장주 밸류 척도

"버핏 ROE(수익성)·린치 EPS(성장성)"에 **매출 주도권(PSR)** 축을 추가. PER/PEG가 무의미한 적자기업·고성장주를 "매출 대비 얼마나 비싼가"로 평가(린치 '순이익의 함정'). 제미나이 기획 채택하되 **절대 임계 하드코딩은 거부**(제1원칙) — 상대 PSR(동종 대비)로만 판정.
- ⚠️ **사실관계**: PSR이 완전히 빠진 게 아니었음 — 페어트레이딩(비밀병기12)이 이미 P/S z-score를 씀(글로벌 1등 대비, 더 정교). 빠진 건 **PSR을 펀더멘탈 숫자로 화면 노출**하는 것.
- **① SSOT 토대**: stock-info `fundamentals.psr` 노출 + `canonicalFundamentals.psr` 추가. ⚠️ **시총÷매출 역산은 폐기** — Naver 경로 marketCap이 부정확(NVDA 10배·삼성 5배 과대)해 PSR이 깨짐 → **Yahoo `priceToSalesTrailing12Months` 직접값**을 단일 출처로(getPairSignal과 동일 신뢰원, 통화·단위 일관). `fetchDcfFromYahoo`에 summaryDetail 추가해 KR·US 메인+Yahoo폴백 3경로 모두 채움. 검증: NVDA 19.6·PLTR 58.7(고평가)·CRM 3.2·RIVN 4.07·PLUG 5.2(적자기업도 산출)
- **② 섹터 피어 X-Ray 상대 PSR 컬럼**: `getSectorPeers`에 psr + `psrMedian`(동종 중앙값). 이미 받아오는 피어 데이터 재사용(비용 0). 중앙값 대비 ±15%로 저/고평가 색칠. **절대 임계 없음**(산업마다 정상 PSR 다름 — SaaS 10 정상, 은행 2도 비쌈) → 같은 업종끼리만 비교
- **③ 적자기업 밸류 브레이크(뉴스레이더)**: `valuationOf` LOSS 케이스에 PSR을 **Gemini 프롬프트 맥락으로 주입**. 피어 없는 단일 종목이라 절대 판정 금지 → "매출 폭발+PSR 낮음=과매도 성장주 / 매출 둔화+PSR 높음=스토리 거품"을 매출성장률과 **함께** 판단하게. cache v6→v7
- **④ 퀀트빌더·통합추천**: unified-reco item에 psr(canonical 재사용·비용 0, cache v10→v11) → 퀀트빌더 위성 펀더멘탈 패널에 💵 매출배수(PSR) 칩(cache v3→v4)
- ⚠️ **정직한 한계**: KR은 Yahoo priceToSalesTrailing12Months 절대값이 부정확할 수 있음(삼성 5.45 등 — 같은 데이터를 페어트레이딩도 사용, 상대 비교는 동일 소스라 내부 일관). "업계 평균 PSR DB"는 없어 동종 피어 N종 중앙값으로 대체(UI에 명시)
- 교훈: 제미나이의 `PSR>5`/`<2`/`>10` 절대 Rule은 본인이 "산업마다 다르다"고 해놓고 박은 **자기모순 하드코딩** → 거부. 상대 판정으로만 채택

## 🏛️ 규제 레이더 — 암호화폐 법안/규제 신호등 (2026-06-14) — 코인 랩

"코인 가격은 기술이 아니라 法이 움직인다" — CLARITY/GENIUS 법안 등 암호화폐 규제를 신호등으로. 제미나이 기획(수동 Supabase 테이블)을 **AI 자동 큐레이션**으로 개선(Zero Cost·자동 신선·관리 부담 0).
- **`/api/crypto-regulation`**(공개·6h 캐시): Google News RSS(EN 규제+법안 2쿼리, KR 1쿼리, when:45~60d) → 중복 제거 ≤26헤드라인 → Gemini가 신호등 분류. 마켓 카탈리스트에서 검증된 RSS+Gemini 패턴 재사용
  - **신호등**: 🟢green(제도권 편입·유동성 유입) / 🟡yellow(논의 중·불확실) / 🔴red(규제 강화·유동성 차단). 전반 규제 기후 + 개별 법안 ≤5개(title 한글·impact·status·summary 투자관점 1줄·assets 관련 코인)
  - ⚠️ **환각 가드(법안은 사실·고위험)**: "헤드라인에 실제로 있는 법안만, 없는 조항·날짜·표결결과 창작 금지, 불확실하면 status='논의 중'". 마켓 카탈리스트·뉴스 레이더와 동일 원칙
  - 결과 bills 0개면 캐시 박제 안 함(부분실패 방지)
- **`RegulatoryRadar.tsx`**: 규제 기후 배지(신호등+한줄) 헤더 클릭 펼침 + 법안 카드(신호등 점·상태 배지·관련 코인 칩·투자 1줄) + 범례·교육 푸터. **코인 랩 양쪽 뷰(₿/🔷) 공통**(법안은 코인 전체 영향)
- 검증(2026-06-14): 기후 🟢green · CLARITY 법안(상원 은행위 통과·BTC/ETH/전체)·일본 증권형 규제·SEC 주식화 규제 정확 분류, 환각 없이 헤드라인 근거만

## 📡 수급 레이더 동행지수 0% 고착 수정 (2026-06-14)

게이지가 `status==='INFLOW'`만 셌는데 **US INFLOW는 내부자 매수 전용** → 13F거인·MFI 신호를 놓쳐 0% 고착(아래 임박 보드와 모순).
- `momentumOf`에 13F 거인 신호 추가(add+30/보유+15) · 동행지수 = `INFLOW || momentum≥40`(유입+임박, 보드 임박과 일치) · 라벨 "유입·임박" · 캐시 v5→v6

---

## 배포

- **프로덕션**: https://investment-school-portfolio.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio
