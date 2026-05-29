# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-05-30

## 프로젝트 개요

Next.js 14 (App Router) + Supabase + Tailwind CSS + TypeScript 로 구축한
**투자학교 학생 포트폴리오 관리 & 투자 교육 플랫폼**.

- 학생들이 자신의 보유 자산을 등록·추적하고 수익률을 확인
- 피터 린치·워렌 버핏 철학 기반 투자 분석 도구 제공
- 최일 선생님의 매크로 전략 브리핑 및 투자 교육 콘텐츠 제공
- 실시간 주가·환율·매크로 데이터 시각화
- **CME FedWatch + FRED API 기반 거시경제 대시보드 (신규)**

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
│   │   ├── v1/portfolio/realtime/route.ts       # Phase 3 EPS 데이터 (MOCK→SSOT)
│   │   ├── v1/market/realtime-portfolio/route.ts # DashboardContainer용 (MOCK)
│   │   ├── school-league/route.ts      # GET 스쿨 리그 집계 (service_role)
│   │   ├── migrate-asset-roles/route.ts # POST asset_role 전체 소급 정정
│   │   └── admin/delete-user/route.ts  # POST 학생 계정 삭제 (teacher 전용)
│   │
│   └── components/
│       ├── AddInvestmentModal.tsx      # 종목 추가·수정 모달
│       ├── TransactionModal.tsx        # 추가매수·매도 모달
│       ├── TenbaggerRadar.tsx          # ★ 피터 린치 텐배거 마일스톤 트래커 (동적 포트폴리오 기반)
│       ├── MacroDashboard.tsx          # ★ 거시경제 Fed Watch 오케스트레이터
│       ├── LynchEarningsChart.tsx      # 피터 린치 이익선 차트 (FRED 적자구간 처리)
│       ├── LynchSellSignalPanel.tsx    # 매도 시그널 패널
│       ├── LynchGhostStockPanel.tsx    # 유령 종목 추적기
│       ├── EarningsAlertTerminal.tsx   # ★ 어닝 터미널 — G 리비전 추적기 + PEG 알럿 (NEW)
│       ├── AIPortfolioDashboard.tsx    # AI 멘토 족집게 (PEG 분석)
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
│   ├── classifyAsset.ts    # Core/Satellite 자동 분류
│   ├── supabase/client.ts  # 클라이언트 Supabase 인스턴스
│   ├── supabase/server.ts  # 서버 Supabase 인스턴스 (cookies)
│   └── utils.ts            # 유틸 함수
└── middleware.ts            # 라우트 보호 (인증 미들웨어)
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

## DB 업데이트 원칙

- `upsert` 사용 금지 → `update().eq()` 사용 (NOT NULL 컬럼 보호)
- 배치: `Promise.all()` 병렬 (30개 단위 권장)
- Lynch 분류: DB `lynch_category` 값이 알고리즘보다 항상 우선

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
npm run dev         # 개발 서버 (http://localhost:3000) + .next 자동 클린
npm run build       # 프로덕션 빌드
npm run lint        # ESLint
npx tsc --noEmit    # 타입 체크
npx vercel --prod   # Vercel 프로덕션 배포
```

**주의**: `npm run dev` 는 `.next`를 자동 삭제 후 시작 (배포 후 캐시 오염 방지)

---

## 배포

- **프로덕션**: https://investment-school-portfolio.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio
