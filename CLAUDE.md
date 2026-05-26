# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-05-26 (오늘 세션 작업 반영)

## 프로젝트 개요

Next.js 14 (App Router) + Supabase + Tailwind CSS + TypeScript 로 구축한
**투자학교 학생 포트폴리오 관리 & 투자 교육 플랫폼**.

- 학생들이 자신의 보유 자산을 등록·추적하고 수익률을 확인
- 피터 린치·워렌 버핏 철학 기반 투자 분석 도구 제공
- 최일 선생님의 매크로 전략 브리핑 및 투자 교육 콘텐츠 제공
- 실시간 주가·환율·매크로 데이터 시각화

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
| 배포 | Vercel (region: icn1, Seoul) |

---

## 디렉토리 구조 (실제)

```
src/
├── app/
│   ├── page.tsx                      # / → /dashboard 리다이렉트
│   ├── layout.tsx                    # 루트 레이아웃 (SidebarLayout + IdleTimer)
│   ├── login/page.tsx                # 로그인 + 회원가입 탭 통합 + 비밀번호 재설정
│   ├── signup/page.tsx               # /signup → /login?tab=signup 리다이렉트
│   │
│   ├── dashboard/page.tsx            # 대시보드 (메인 홈)
│   ├── assets/page.tsx               # 자산 관리
│   ├── history/page.tsx              # 거래 기록 & 현금흐름
│   ├── analysis/page.tsx             # 투자 전략 분석 (피터린치 + 워렌버핏)
│   ├── valuation/page.tsx            # 최일 가치분석 터미널
│   ├── research/page.tsx             # 종목 리서치 (캔들 차트 + 피터린치 진단 위저드)
│   ├── watchlist/page.tsx            # 관심 종목
│   ├── admin/page.tsx                # 관리자 (teacher 전용)
│   ├── master-strategy/page.tsx      # 최일 전략 브리핑 (Core/Satellite)
│   ├── investment-academy/page.tsx   # 투자 아카데미 (교육 콘텐츠)
│   ├── school-lounge/page.tsx        # 스쿨 라운지 (커뮤니티 게시판)
│   ├── school-league/page.tsx        # 스쿨 리그 대시보드 ★ 신규
│   ├── macro-hub/page.tsx            # 매크로 허브 (3탭: 글로벌매크로·채권·스트레스테스트)
│   │
│   ├── api/
│   │   ├── stock-price/route.ts      # GET·POST 주가 조회 (KR·US·CRYPTO), 최대 50개
│   │   ├── stock-info/route.ts       # GET 종목 상세정보 + 순현금 자동 계산(FMP/Naver)
│   │   ├── market-indices/route.ts   # GET 글로벌 시장 지수
│   │   ├── exchange-rate/route.ts    # GET 환율 (USD/KRW)
│   │   ├── macro-data/route.ts       # GET 매크로 데이터 (CPI·금리·주가)
│   │   ├── financials/route.ts       # GET 재무제표 (FMP/DART)
│   │   ├── lynch-classify/route.ts   # GET 피터린치 종목 분류
│   │   ├── lynch-batch/route.ts      # POST 미분류 종목 일괄 분류
│   │   ├── school-league/route.ts    # GET 스쿨 리그 집계 (service_role) ★ 신규
│   │   ├── migrate-asset-roles/route.ts # POST asset_role 전체 소급 정정 ★ 신규
│   │   ├── admin/delete-user/route.ts  # POST 학생 계정 삭제 (teacher 전용)
│   │   └── migrate-asset-role/route.ts # GET asset_role 컬럼 DDL (일회성 유틸)
│   │
│   └── components/
│       ├── AddInvestmentModal.tsx    # 종목 추가·수정 모달 — classifyAsset 자동 분류 연동
│       ├── TransactionModal.tsx      # 추가매수·매도 모달 — classifyAsset 폴백
│       ├── AppHeader.tsx             # 페이지 공통 헤더 (환율·날짜 표시)
│       ├── BondSimulator.tsx         # 채권 시뮬레이터
│       ├── StressTest.tsx            # 매크로 스트레스 테스트 룸
│       ├── LynchWizard.tsx           # 피터 린치 3단계 진단 위저드 ★ 신규
│       ├── SchoolLeague.tsx          # 스쿨 리그 대시보드 컴포넌트 ★ 신규
│       ├── CandleChart.tsx           # 캔들 차트 기본 컴포넌트
│       ├── FullCandleChart.tsx       # 풀 캔들 차트 (1D/1W/1M/1Y 탭)
│       ├── IdleTimer.tsx             # 비활성 30분 자동 로그아웃
│       └── Layout/
│           ├── Sidebar.tsx           # 사이드바 네비게이션
│           ├── SidebarLayout.tsx     # 전체 레이아웃 래퍼
│           └── TopHeader.tsx         # 상단 헤더
│
├── lib/
│   ├── classifyAsset.ts              # Core/Satellite 자동 분류 함수 ★ 신규
│   ├── supabase/client.ts            # 클라이언트 Supabase 인스턴스
│   ├── supabase/server.ts            # 서버 Supabase 인스턴스 (cookies)
│   └── utils.ts                     # 유틸 함수
├── types/
│   ├── index.ts                      # 공통 타입 정의
│   └── react-simple-maps.d.ts        # 타입 선언
└── middleware.ts                     # 라우트 보호 (인증 미들웨어)
```

---

## 오늘 세션 작업 완료 목록 (2026-05-26)

### ✅ 1. 스마트 리밸런싱 알림 & 시뮬레이터 (`dashboard/page.tsx`)
- 대시보드 중간 (월별차트 ↔ 보유종목 테이블 사이) 아코디언 위젯 삽입
- Core/Satellite 편차 **5%p 이상**일 때만 주황색 경고 배너 노출
- "시뮬레이션 열기" → 확장 시 2컬럼 레이아웃
  - 좌: 목표 vs 현재 수평 막대 비교 + 편차 배지
  - 우: 매매 처방전 카드 + 이동 필요 금액 + 가상 리밸런싱 실행 버튼 (0.8s 애니메이션)
- `strategy_configs.core_pct` 연동 → 목표 비중 자동 로드
- 보유자산 테이블에 **자산분류 배지** 추가 (`🛡 CORE` / `🚀 SAT`) — RebalanceWidget 색상 동기화

### ✅ 2. `classifyAsset` 자동 분류 함수 (`src/lib/classifyAsset.ts`)
- 티커·종목명·마켓을 입력받아 `'CORE' | 'SATELLITE'` 반환
- 분류 규칙:
  - CRYPTO → 무조건 SATELLITE
  - 레버리지·인버스 포함 → SATELLITE 강제
  - 미국 지수 ETF (SPY/VOO/QQQ/나스닥/S&P500 등) → CORE
  - 한국 지수 ETF (코스피/코스닥/KODEX200 등) → CORE
  - 우량 채권 (TLT/IEF/AGG/국채 등) → CORE
  - 테마·섹터 ETF (AI/바이오/방산/배터리/중국/우주 등) → SATELLITE
  - 개별주식 (ETF 브랜드 없음) → SATELLITE
- `AddInvestmentModal`: 종목명 조회 완료 시 자동 분류 + `⚡ 자동 분류` 배지
- `TransactionModal`: 기존 `asset_role` 없으면 폴백 자동 분류

### ✅ 3. 기존 데이터 소급 정정 (`POST /api/migrate-asset-roles`)
- Supabase service_role로 전체 investments 조회
- `classifyAsset` 결과와 DB 값 비교 → 불일치 시 `update().eq('id')` 병렬 실행
- **핵심 버그 수정**: `upsert` 대신 `update` 사용 (upsert는 NOT NULL 컬럼을 DEFAULT로 덮어써 실패)
- 직접 DB 수정: 27건 (삼성전자·SK하이닉스·BTC·ETH·PLTR 등 → SATELLITE)
- `school-league` API 호출 시 자동 소급 정정 실행 후 집계

### ✅ 4. LynchWizard 피터 린치 진단 위저드 (`research/page.tsx` + `LynchWizard.tsx`)
- 종목 리서치에 **🔬 피터린치 진단** 탭 추가
- 3단계 Step Wizard:
  - STEP 1: PER + EPS 성장률 입력 → PEG 실시간 계산 + 배지
  - STEP 2: 정성 체크리스트 14항목 (린치 선호 10 + 기피 4)
  - STEP 3: 6대 유형 판정 + 매도 타이밍 처방전 카드
- 종목 리서치에서 검색 후 위저드 탭 이동 시 **자동 채움** (PER·EPS·이름 API 연동)
- 순현금 자동 계산: FMP 배런스시트(US) + Naver annual(KR) → `stock-info` API 응답에 `hasCash` 포함

### ✅ 5. SchoolLeague 스쿨 리그 대시보드 (`/school-league`)
- 사이드바 SCHOOL 섹션에 **🏆 School League** 메뉴 추가
- 실 DB 연동 (`GET /api/school-league`) — service_role로 전체 학생 집계
- **Section 1: 스쿨 실명 리더보드**
  - 등록자 누적 수익률 기준 랭킹
  - 미등록자 3명 → 최하단 점선 배치 + "포트폴리오 준비 중" 배지
  - "내 위치" 하이라이트 배너 (N위, 상위 %, 위 학생과 %p 차이)
- **Section 2: Top 1·2 포트폴리오 엿보기** — 도넛 차트 + 효자종목 Top 3
- **Section 3: 우리 반 인기 종목** — 가로 막대 차트 (등록자 기준 집계)
- **Section 4: 스쿨 평균 vs 나** — Core/Sat 비교 바 차트
  - 진단 배너: **스쿨 평균이 아닌 내 전략 목표 대비** 판단
  - `strategy_configs.core_pct` 로드 → targetCore 기준으로 Case 1/2/3 분기
- **Section 5: 피터 린치 6대 분류 자산 성향 분석** ← 오늘 추가
  - Satellite 종목의 `lynch_category` 기반 6대 유형 분포 집계
  - 스쿨 평균 vs 내 비중 6행 × 2열 진행 바 비교
  - 교육 피드백 배너: 스쿨 평균 최다 유형 자동 감지 + 훈수 메시지

---

## 라우트 & 기능 상세

### 공개 라우트

| 경로 | 기능 |
|------|------|
| `/login` | 이메일/비밀번호 로그인 + 회원가입 탭 통합. 비밀번호 재설정(resetPasswordForEmail) 모달 포함. idle 30분 후 자동 리다이렉트. |
| `/signup` | `/login?tab=signup` 으로 리다이렉트 (통합 페이지) |

### 인증 필요 라우트

| 경로 | 기능 | 주요 특징 |
|------|------|-----------|
| `/dashboard` | 메인 대시보드 | 글로벌 시장 지수 6개. KPI 카드. 월별 PnL 차트. 피터린치 파이차트. **리밸런싱 위젯** (Core/Sat 편차 5%p 이상 시 경고). 보유종목 테이블 자산분류 배지. |
| `/assets` | 자산 관리 | US/KR/CRYPTO 섹션. Core/Satellite 토글. **classifyAsset 자동 분류 배지**. 추가매수·매도 모달. |
| `/history` | 거래 기록 | 매수·매도 내역. 현금흐름 차트. 실현손익. |
| `/analysis` | 투자 전략 분석 | 피터린치 PEG 분석. 워렌버핏 레이더 차트. |
| `/valuation` | 최일 가치분석 | FMP/DART 5개년 재무. 10배거 포인트 시스템. |
| `/research` | 종목 리서치 | 캔들 차트. **🔬 피터린치 진단 위저드 탭** (3단계). |
| `/watchlist` | 관심 종목 | 종목 추가/삭제. 현재가 표시. |
| `/macro-hub` | 매크로 허브 | 글로벌 매크로 지도. 채권 시뮬레이터. 스트레스 테스트. |
| `/master-strategy` | 최일 전략 브리핑 | strategy_configs 연동. PDF 다운로드. teacher 전용 수정. |
| `/investment-academy` | 투자 아카데미 | 정적 교육 콘텐츠. |
| `/school-lounge` | 스쿨 라운지 | 게시판 + 댓글 + 공지사항. |
| `/school-league` | **스쿨 리그** ★ | 실명 리더보드. Top 엿보기. 인기 종목. 평균 vs 나. 린치 성향 분석. |
| `/admin` | 관리자 | teacher 전용. 학생 목록·삭제. |

---

## API 엔드포인트 상세

### 기존 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| `GET/POST /api/stock-price` | 주가 조회 (배치 최대 50개, 60초 캐시) |
| `GET /api/stock-info` | 종목 상세 + **순현금 자동 계산** (US:FMP, KR:Naver annual) |
| `GET /api/market-indices` | 글로벌 시장 지수 6개 |
| `GET /api/exchange-rate` | USD/KRW 환율 (1시간 캐시) |
| `GET /api/macro-data` | CPI·금리·NVDA/PLTR 36개월 월봉 |
| `GET /api/financials` | 재무제표 (FMP US + DART KR) |
| `GET /api/lynch-classify` | 피터린치 종목 자동 분류 |
| `POST /api/lynch-batch` | 미분류 종목 일괄 분류 |
| `POST /api/admin/delete-user` | 학생 계정 삭제 (teacher) |

### 신규 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| `GET /api/school-league` | 전체 학생 포트폴리오 집계 (service_role). 소급 정정 자동 실행. lynchDistribution·schoolLynchAvg 포함. |
| `POST /api/migrate-asset-roles` | 전체 investments asset_role을 classifyAsset으로 소급 재분류. update() 방식 (upsert 사용 금지) |

---

## Supabase 데이터베이스

### 테이블 목록

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `profiles` | 사용자 프로필 | `id, email, full_name, role('teacher'\|'student')` |
| `investments` | 보유 종목 | `user_id, ticker, name, market, currency, purchase_price, quantity, purchase_date, lynch_category, asset_role('CORE'\|'SATELLITE')` |
| `transactions` | 거래 내역 | `user_id, investment_id, ticker, type('buy'\|'sell'), price, quantity, total_amount, realized_pnl, transaction_date` |
| `watchlist` | 관심 종목 | `user_id, ticker, name, market, added_at` |
| `lounge_posts` | 게시글 | `user_id, author_name, content, is_admin_post, is_edited` |
| `lounge_comments` | 댓글 | `post_id, user_id, author_name, content` |
| `notices` | 공지사항 | `title, content, tag` |
| `strategy_configs` | 최일 전략 설정 | `core_pct, satellite_pct, core_stocks[], satellite_stocks[], pdf_url, updated_at` |

### 현재 학생 현황 (2026-05-26 기준)
| 이름 | 이메일 | 종목 등록 | 비고 |
|------|--------|----------|------|
| 김상균 | lindows70@gmail.com | 19개 | teacher 겸임 |
| 이근행 | rmsgod00@naver.com | 25개 | |
| 유 | yjy7575@naver.com | 3개 | |
| 이민행 | alsgod00@naver.com | 3개 | |
| 송승규 | sksean23@naver.com | 0개 | 미등록 |
| 김선아 | def72@naver.com | 0개 | 미등록 |
| Elena YU | elenayu.mit@gmail.com | 0개 | 미등록 |

---

## classifyAsset 분류 로직 (`src/lib/classifyAsset.ts`)

```
SATELLITE 강제:
  ├─ market === 'CRYPTO' (BTC, ETH, XRP 등)
  ├─ 레버리지·인버스·2X·3X 포함
  └─ ETF 브랜드 있어도 테마 키워드 포함 시
     (AI, 방산, 배터리, 우주, 원자력, 차이나, 일본, 바이오 등)

CORE 판별:
  ├─ 미국 지수: SPY, VOO, QQQ, S&P500, 나스닥, 다우, DIA 등
  ├─ 한국 지수: KOSPI200, KODEX200, TIGER200 등
  ├─ 우량 채권: TLT, IEF, AGG, BND, 국채, Treasury 등
  └─ 직접 티커: 102110, 069500, 360750, 133690 등

SATELLITE (기본값):
  └─ 위 CORE 조건 미해당 모든 종목
```

**DB 소급 정정 주의사항**:
- `upsert`는 사용 금지 — NOT NULL 컬럼을 DEFAULT로 덮어써 업데이트 실패
- 반드시 `update({ asset_role }).eq('id', id)` 사용

---

## 환경 변수

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://jfqhriwgnlopxewdocpr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 서버 전용, 절대 클라이언트 노출 금지

# 외부 API
FMP_API_KEY=...          # Financial Modeling Prep (미국 재무데이터 + 배런스시트)
DART_API_KEY=...         # DART OpenAPI (한국 재무데이터)
KIS_APP_KEY=             # 한국투자증권 (미사용/예약)
KIS_APP_SECRET=          # 한국투자증권 (미사용/예약)
DATA_GO_KR_SERVICE_KEY=  # 공공데이터포털 (미사용/예약)
```

---

## 외부 데이터 소스

| 서비스 | 용도 | 비용 | 제한 |
|--------|------|------|------|
| 네이버 증권 polling API | KR 실시간 주가 | 무료 | Rate limit 주의 |
| 네이버 fchart XML | KR 차트 데이터 | 무료 | - |
| Yahoo Finance v8 | US 주가·지수·차트 | 무료 | 401 차단 가능 |
| yahoo-finance2 라이브러리 | US 배당·펀더멘털 | 무료 | historical() deprecated |
| 업비트 API | 암호화폐 KRW 시세 | 무료 | - |
| World Bank API | 글로벌 CPI·실업률·부채 | 무료 | 1~2년 지연 |
| FRED CSV | 미국 기준금리 | 무료 | - |
| fawazahmed0 환율 | USD/KRW | 무료 | - |
| FMP (Financial Modeling Prep) | 미국 재무제표 + 배런스시트 | 무료 250회/일 | limit=5 |
| DART OpenAPI | 한국 사업보고서 | 무료 10,000회/일 | list.json 방식 |
| 네이버 SEIBro 스크래핑 | KR ETF 분배금 | 무료 | 세션 부하 주의 |

---

## 피터 린치 6대 분류

| 영문 키 | 한국어 | 설명 |
|---------|--------|------|
| `fast_grower` | 고성장주 | 연 20%+ 성장 |
| `stalwart` | 대형우량주 | 안정적 10~12% |
| `slow_grower` | 저성장주 | 연 성장률 2~5% |
| `cyclical` | 경기순환주 | 경기와 동행 |
| `asset_play` | 자산주 | 숨겨진 자산 |
| `turnaround` | 턴어라운드주 | 적자→흑자 전환 |

자동 분류: `/api/lynch-classify` → `investments.lynch_category` 업데이트

---

## 미완성 / 예약 기능

| 항목 | 상태 | 비고 |
|------|------|------|
| `KIS_APP_KEY / KIS_APP_SECRET` | ⏳ 미사용 | ETF 분배금 대체 목적 |
| `DATA_GO_KR_SERVICE_KEY` | ⏳ 미사용 | 공공데이터포털 ETF 정보 |
| `investment-academy` 콘텐츠 | 📝 정적 | 실제 교육 콘텐츠 추가 예정 |
| SchoolLeague 주간·월간 탭 | ⏳ 미구현 | 현재 누적 수익률만 지원 |
| SchoolLeague 실시간 자동 갱신 | ⏳ 미구현 | 현재 페이지 진입 시 1회 로드 |
| LynchWizard 순현금 KR 자동화 | ⚠️ 불완전 | Naver annual `순현금` 행 있을 때만 작동 |
| 주간 뉴스레터 | 🔧 외부 스킬 | `weekly-newsletter` 스킬로 별도 운영 |

---

## 다음 작업 우선순위

### 🔴 높음 (버그·데이터 품질)
1. **SchoolLeague Lynch 분포 데이터 품질 개선**
   - 현재 `lynch_category = null`인 종목이 많아 분포 차트에 데이터 공백 발생
   - 해결책: 스쿨 리그 API 호출 시 미분류 Satellite 종목 자동 Lynch 분류 실행 연동

2. **순현금 KR 데이터 신뢰도 향상**
   - Naver annual API의 `순현금`/`순차입금` 행 파싱 실패 케이스 보완
   - DART 배런스시트 폴백 추가 검토

### 🟡 중간 (기능 완성)
3. **SchoolLeague 주간·월간 탭 구현**
   - 현재 누적 수익률만 지원 → 주간/월간 수익률 계산 로직 추가
   - 기준: 거래 내역(`transactions`) 기반 기간별 수익률 계산

4. **LynchWizard STEP 2 체크리스트 체크 상태 유지**
   - "다시 진단하기" 후 체크리스트 초기화됨 → 이전 선택 저장 옵션 검토

### 🟢 낮음 (개선·추가 기능)
5. **Investment Academy 콘텐츠 채우기**
   - 현재 정적 뉴모피즘 UI만 있음 → 투자 기초 학습 콘텐츠 삽입

6. **SchoolLeague 실시간 자동 갱신**
   - 현재 페이지 진입 시 1회 로드 → 주기적 polling 또는 Supabase Realtime 연동

7. **보유자산 페이지 classifyAsset 일괄 적용 버튼**
   - 기존 종목 중 asset_role 미설정 건 한 번에 정정하는 UI 버튼

---

## 개발 명령어

```bash
npm run dev         # 개발 서버 (http://localhost:3000)
npm run build       # 프로덕션 빌드
npm run lint        # ESLint
npx tsc --noEmit    # 타입 체크
npx vercel --prod   # Vercel 프로덕션 배포
```

## 배포

- **프로덕션**: https://investment-school-portfolio.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio

---

## 코딩 컨벤션

- 거의 모든 페이지가 `'use client'` (서버 컴포넌트 최소화)
- 인라인 style 객체와 Tailwind 클래스 혼용 (dark-mode 전용 커스텀 컬러)
- `any` 타입 사용 시 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 필수
- Supabase 쿼리는 항상 `error` 핸들링 포함
- API route에서 외부 데이터 실패 시 캐시 fallback 반환
- 컴포넌트 파일 PascalCase, 유틸 camelCase
- 차트: 포트폴리오 시각화 → Recharts, 금융 캔들 → lightweight-charts
- **DB 업데이트 원칙**: `upsert` 사용 금지 → `update().eq()` 사용 (NOT NULL 컬럼 보호)
- **배치 업데이트**: `Promise.all()` 병렬 실행 (30개 단위 권장)
