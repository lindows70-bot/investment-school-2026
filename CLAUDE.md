# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-05-26 (전체 코드 스캔 기준)

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
│   ├── research/page.tsx             # 종목 리서치 (캔들 차트)
│   ├── watchlist/page.tsx            # 관심 종목
│   ├── admin/page.tsx                # 관리자 (teacher 전용)
│   ├── master-strategy/page.tsx      # 최일 전략 브리핑 (Core/Satellite)
│   ├── investment-academy/page.tsx   # 투자 아카데미 (교육 콘텐츠)
│   ├── school-lounge/page.tsx        # 스쿨 라운지 (커뮤니티 게시판)
│   ├── macro-hub/page.tsx            # 매크로 허브 (3탭: 글로벌매크로·채권·스트레스테스트)
│   │
│   ├── api/
│   │   ├── stock-price/route.ts      # GET·POST 주가 조회 (KR·US·CRYPTO)
│   │   ├── stock-info/route.ts       # GET 종목 상세정보 (배당·펀더멘털)
│   │   ├── market-indices/route.ts   # GET 글로벌 시장 지수
│   │   ├── exchange-rate/route.ts    # GET 환율 (USD/KRW)
│   │   ├── macro-data/route.ts       # GET 매크로 데이터 (CPI·금리·주가)
│   │   ├── financials/route.ts       # GET 재무제표 (FMP/DART)
│   │   ├── lynch-classify/route.ts   # GET 피터린치 종목 분류
│   │   ├── lynch-batch/route.ts      # POST 미분류 종목 일괄 분류
│   │   ├── admin/delete-user/route.ts# POST 학생 계정 삭제 (teacher 전용)
│   │   └── migrate-asset-role/route.ts# GET asset_role 마이그레이션 유틸
│   │
│   └── components/
│       ├── AddInvestmentModal.tsx    # 종목 추가·수정 모달 (33KB)
│       ├── TransactionModal.tsx      # 추가매수·매도 모달 (31KB)
│       ├── AppHeader.tsx             # 페이지 공통 헤더 (환율·날짜 표시)
│       ├── BondSimulator.tsx         # 채권 시뮬레이터 (44KB)
│       ├── StressTest.tsx            # 매크로 스트레스 테스트 룸 (31KB)
│       ├── CandleChart.tsx           # 캔들 차트 기본 컴포넌트
│       ├── FullCandleChart.tsx       # 풀 캔들 차트 (1D/1W/1M/1Y 탭)
│       ├── IdleTimer.tsx             # 비활성 30분 자동 로그아웃
│       └── Layout/
│           ├── Sidebar.tsx           # 사이드바 네비게이션
│           ├── SidebarLayout.tsx     # 전체 레이아웃 래퍼
│           └── TopHeader.tsx         # 상단 헤더
│
├── lib/supabase/
│   ├── client.ts                     # 클라이언트 Supabase 인스턴스
│   └── server.ts                     # 서버 Supabase 인스턴스 (cookies)
├── types/
│   ├── index.ts                      # 공통 타입 정의
│   └── react-simple-maps.d.ts        # 타입 선언
├── middleware.ts                     # 라우트 보호 (인증 미들웨어)
└── lib/utils.ts                      # 유틸 함수
```

---

## 라우트 & 기능 상세

### 공개 라우트

| 경로 | 기능 |
|------|------|
| `/login` | 이메일/비밀번호 로그인 + 회원가입 탭 통합. 비밀번호 재설정(resetPasswordForEmail) 모달 포함. idle 30분 후 자동 리다이렉트. |
| `/signup` | `/login?tab=signup` 으로 리다이렉트 (통합 페이지) |

### 인증 필요 라우트 (로그인 안 하면 `/login` 으로 리다이렉트)

| 경로 | 기능 | 주요 특징 |
|------|------|-----------|
| `/dashboard` | 메인 대시보드 | 글로벌 시장 지수 6개(S&P500·나스닥·다우·닛케이·코스피·코스닥) 실시간 표시. 총자산·수익률·보유종목 수 KPI 카드. 월별 평가손익 차트(Core/Satellite 분리). 피터린치 파이차트. 자산 히트맵. 투자학교 알림. 자동 린치 분류. 배당 데이터 보완(stock-info). 30개씩 배치 가격 요청(25개+ 포트폴리오 대응). 탭 복귀 시 자동 갱신. |
| `/assets` | 자산 관리 | 보유 종목 목록(US/KR/CRYPTO 섹션 분리). 정렬(평가금액·수익률·종목명). Core/Satellite 역할 토글. 피터린치 분류 수동 변경. 추가매수·추가매도 모달. 종목 추가·수정·삭제. 네이버 SEIBro 배당 데이터 조회. 자산관리 완료 시 `portfolio-updated` 이벤트 발행. |
| `/history` | 거래 기록 | 매수·매도 거래 내역 목록(날짜순). 현금흐름 탭(Recharts BarChart). 실현손익(realized_pnl) 표시. 잘못된 중복 거래 자동 정리 기능. |
| `/analysis` | 투자 전략 분석 | **피터린치 탭**: PEG 비율 분석, 성장률 vs 주가 비교, 6대 분류 자동 판단. **워렌버핏 탭**: 안전마진·경제적 해자·ROE·부채비율 레이더 차트. 종목 검색 후 `/api/financials` 호출. |
| `/valuation` | 최일 가치분석 | FMP(미국) + DART(한국) API로 5개년 재무데이터 수집. EPS·영업이익·매출 성장 분석. PEG/PSR 시나리오별 적정주가 계산. 10배거 포인트 시스템(0~100점). CAGR 계산(실적 연도 기준, 음수 시 회복CAGR 폴백). 동적 PSR 배수(OI마진 기반). 미확인 컨센서스 배지. |
| `/research` | 종목 리서치 | 종목명/티커 검색. 1D/1W/1M/1Y 탭 OHLC 캔들 차트(lightweight-charts). 현재가·등락률·기초 펀더멘털. KR·US·CRYPTO 지원. |
| `/watchlist` | 관심 종목 | `watchlist` 테이블. 종목 추가/삭제. 현재가 실시간 표시. 관심 종목 → 바로 매수 연결. |
| `/macro-hub` | 매크로 허브 | **[탭1] 글로벌 매크로**: react-simple-maps 세계 지도 히트맵(CPI·실업률·부채·금리). NVDA·PLTR 36개월 월봉 vs 미국 기준금리 비교 차트(lightweight-charts TradingView). World Bank·FRED·Yahoo Finance 실시간 데이터. **[탭2] 채권 시뮬레이터**: 금리 슬라이더 → 1/3/10/30년 채권가격 PV 실시간 계산. 볼록성(Convexity) 가격곡선 차트. 매크로 신호등. 퀴즈. **[탭3] 스트레스 테스트**: 역사적 위기(2008·2020·2022) 시나리오 시뮬레이션. Core/Satellite 슬라이더. MDD·회복기간·수익률 배지. 최일 선생님 원포인트 레슨. |
| `/master-strategy` | 최일 전략 브리핑 | `strategy_configs` 테이블(싱글톤 row). Core/Satellite 권장 비중. 추천 Core·Satellite 종목 리스트. PDF 다운로드. **teacher 전용 업데이트 모달**: PDF 업로드, 비중 수정, 섹터 행 관리. |
| `/investment-academy` | 투자 아카데미 | 정적 투자 교육 콘텐츠. 뉴모피즘 디자인. 섹션별 학습 자료. |
| `/school-lounge` | 스쿨 라운지 | `lounge_posts` + `lounge_comments` + `notices` 테이블. 공지사항(teacher 전용 작성). 자유 게시글 작성·댓글. is_admin_post 구분. 수정·삭제. |
| `/admin` | 관리자 | **teacher role 전용**. 전체 학생 목록. 학생별 투자현황(종목수·투자금액·시장구성·린치분류율). 학생 계정 삭제(`/api/admin/delete-user`). 개별 포트폴리오 상세보기. |

---

## API 엔드포인트 상세

### `GET /api/stock-price?ticker=&market=`
- **POST** 도 지원 (배치 최대 50개)
- KR: 네이버 증권 polling API + fchart XML (1D/1W/1M/1Y)
- US: Yahoo Finance v8 차트 (query1/query2 fallback)
- CRYPTO: 업비트 KRW 기준
- 응답: `StockData { currentPrice, change, changePct, charts, ohlcCharts, fundamentals }`
- 캐시: 60초 인메모리, 만료 시 stale fallback
- **주의**: Vercel maxDuration 15초 설정

### `GET /api/stock-info?ticker=&market=`
- KR: 네이버 모바일 stock basic + finance/annual API (SEIBro 배당 포함)
- US: 네이버 해외주식 API
- 응답: 배당수익률·배당금·52주 고저가·PER·EPS 등
- 캐시: 1시간

### `GET /api/market-indices`
- S&P500·나스닥·다우·닛케이·코스피·코스닥
- Yahoo Finance v8 (`^GSPC`, `^IXIC`, `^DJI`, `^N225`, `^KS11`, `^KQ11`)
- 응답: 지수값·등락·1D 차트 포인트

### `GET /api/exchange-rate`
- fawazahmed0 환율 API (USD/KRW)
- ISR 1시간 캐시

### `GET /api/macro-data`
- Yahoo Finance (yahoo-finance2 라이브러리): NVDA·PLTR 36개월 월봉
- FRED CSV: 미국 기준금리 시계열
- World Bank API: 15개국 CPI·실업률·부채 데이터
- 응답: `MacroApi { countries, rates, stocks, fedRates, lastUpdated, dataQuality }`

### `GET /api/financials?ticker=&market=`
- **US**: FMP `/stable/income-statement` (primary) → Yahoo Finance (fallback)
  - 필드: `fiscalYear, epsDiluted, operatingIncome, revenue`
- **KR**: DART OpenAPI (list.json → 사업보고서)
  - 단위: 원(raw) ÷ 1e8 = 억원
- `export const dynamic = 'force-dynamic'`

### `GET /api/lynch-classify?ticker=&market=`
- US: Yahoo Finance v8(ETF 감지) + v10(섹터) → 규칙 기반 분류
- KR: 네이버 basic API industryCodeType → ETF 감지 + 섹터 분류
- 응답: `{ category: LynchKey | 'na', isEtf: boolean, source: string }`

### `POST /api/lynch-batch`
- 현재 사용자의 미분류 종목 일괄 자동 분류
- 서버에서 Supabase service role로 직접 업데이트

### `POST /api/admin/delete-user`
- teacher role 전용. 학생 auth.users + profiles 삭제

---

## Supabase 데이터베이스

### 테이블 목록

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `profiles` | 사용자 프로필 | `id(uuid), email, full_name, role('teacher'\|'student')` |
| `investments` | 보유 종목 | `user_id, ticker, name, market, currency, purchase_price, quantity, purchase_date, lynch_category, asset_role('CORE'\|'SATELLITE')` |
| `transactions` | 거래 내역 | `user_id, investment_id, ticker, type('buy'\|'sell'), price, quantity, total_amount, realized_pnl, transaction_date` |
| `watchlist` | 관심 종목 | `user_id, ticker, name, market, added_at` |
| `lounge_posts` | 게시글 | `user_id, author_name, content, is_admin_post, is_edited, created_at` |
| `lounge_comments` | 댓글 | `post_id, user_id, author_name, content, created_at` |
| `notices` | 공지사항 | `title, content, tag, created_at` |
| `strategy_configs` | 최일 전략 설정 | `core_pct, satellite_pct, core_stocks[], satellite_stocks[], pdf_url, pdf_display_name, updated_at` |

### 권한 구조
- **학생(student)**: 자신의 investments·transactions·watchlist CRUD
- **선생님(teacher)**: 모든 학생 데이터 조회, strategy_configs 수정, notices 작성, 학생 삭제
- **RLS**: user_id 기반으로 자신의 데이터만 접근 (service_role로 우회 가능)

### 관리자(teacher) 지정
```sql
UPDATE public.profiles SET role = 'teacher' WHERE email = 'your@email.com';
```

---

## 환경 변수

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://jfqhriwgnlopxewdocpr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # 서버 전용, 절대 클라이언트 노출 금지

# 외부 API (선택 — 없으면 해당 기능 폴백)
FMP_API_KEY=...          # Financial Modeling Prep (미국 재무데이터)
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
| FMP (Financial Modeling Prep) | 미국 재무제표 | 무료 250회/일 | limit=5 |
| DART OpenAPI | 한국 사업보고서 | 무료 10,000회/일 | list.json 방식 |
| 네이버 SEIBro 스크래핑 | KR ETF 분배금 | 무료 | 세션 부하 주의 |

---

## 피터 린치 6대 분류

| 영문 키 | 한국어 | 설명 |
|---------|--------|------|
| `slow_grower` | 완만한 성장주 | 연 성장률 2~5% |
| `stalwart` | 대형 우량주 | 안정적 10~12% |
| `fast_grower` | 빠른 성장주 | 연 20%+ 성장 |
| `cyclical` | 경기 순환주 | 경기와 동행 |
| `turnaround` | 회생 기업주 | 적자→흑자 전환 |
| `asset_play` | 자산 보유주 | 숨겨진 자산 |

자동 분류: `/api/lynch-classify` → Supabase `investments.lynch_category` 업데이트

---

## 주요 비즈니스 로직

### 채권 PV 공식 (BondSimulator)
```
P = Σ[C / (1+r)^t] + F / (1+r)^n
C = 표면이자, r = 유통금리, n = 만기, F = 원금(1,000)
```

### 최일 가치분석 점수 (Valuation)
- EPS 성장 CAGR → PEG 비율 계산
- PSR 배수: `max(2, min(OI마진% / 4, 10))` 동적 계산
- 음수 CAGR → 회복CAGR 폴백 (사이클 주식 대응)
- 총점 0~100, 70+ → 강력 매수 추천

### 포트폴리오 수익률 계산
- `평가금액 = currentPrice × quantity`
- `수익률 = (평가금액 - purchase_price × quantity) / (purchase_price × quantity) × 100`
- KRW/USD 환율 자동 적용

### 배치 주가 요청 (Dashboard)
- 30개씩 청크 분할 → 순차 POST `/api/stock-price`
- 25개+ 포트폴리오에서 400 에러 방지

---

## 컴포넌트 상세

### `AddInvestmentModal.tsx` (33KB)
- 새 종목 추가 / 기존 종목 수정
- 티커 검색 → 현재가 자동 조회
- Core/Satellite 역할 선택 (CORE 기본)
- 피터린치 분류 자동 판단 후 저장
- `investments` + `transactions` 동시 insert

### `TransactionModal.tsx` (31KB)
- 추가매수: `newAvgPrice = (oldQty×oldAvg + addedQty×price) / newQty` 역산
- 추가매도: 실현손익 계산 + `investments.quantity` 감소
- 전량 매도 시 `investments` 삭제 옵션
- Core/Satellite 역할 업데이트 지원

### `BondSimulator.tsx` (44KB)
- 매크로 신호등 (경기/물가 토글)
- 금리 슬라이더 0~10% (XAxis type="number" 연속 수치축)
- 4개 만기 채권가격 실시간 계산
- 볼록성(Convexity) 가격곡선 ComposedChart
- ReferenceLine label content로 4개 가격 말풍선 통합 렌더
- `currentPrices = useMemo(bondPV(rate/100, n))` — 임의 금리 지원
- 채권 퀴즈 3문항

### `StressTest.tsx` (31KB)
- 역사적 위기 시나리오 Mock Data (2008·2020·2022)
- Core/Satellite 슬라이더 + 실제 유저 비중 자동 로드
- MDD·회복기간·최종수익률 실시간 계산
- ComposedChart: 포트폴리오(Area) + 코어/새틀라이트(Line 점선)
- 시나리오별 매크로 원인 + 최일 선생님 명언 카드

### `AppHeader.tsx` (18KB)
- 페이지 타이틀 + USD/KRW 환율 + 현재 날짜
- 실시간 `/api/exchange-rate` 호출

### `IdleTimer.tsx` (9KB)
- 30분 비활성 → 자동 로그아웃 + `/login?reason=idle` 리다이렉트
- 5분 전 경고 팝업
- mousemove·keydown·scroll 등 DOM 이벤트 감지

---

## 인증 시스템

```
/login → 이메일+비밀번호 로그인 (supabase.auth.signInWithPassword)
       → 회원가입 탭 (supabase.auth.signUp)
       → 비밀번호 재설정 (supabase.auth.resetPasswordForEmail)
middleware.ts → 미인증 사용자 /login 리다이렉트
             → 로그인 사용자 /login 접근 시 /dashboard 리다이렉트
             → /admin은 별도 role='teacher' 체크 (페이지 레벨)
```

---

## 미완성 / 예약 기능

| 항목 | 상태 | 비고 |
|------|------|------|
| `KIS_APP_KEY / KIS_APP_SECRET` | ⏳ 미사용 | 한국투자증권 API (ETF 분배금 대체 목적) |
| `DATA_GO_KR_SERVICE_KEY` | ⏳ 미사용 | 공공데이터포털 ETF 정보 |
| `/api/migrate-asset-role` | 🔧 일회성 유틸 | asset_role 컬럼 마이그레이션용 |
| `investment-academy` 콘텐츠 | 📝 정적 | 실제 교육 콘텐츠 추가 예정 |
| 포트폴리오 총자산 변화 차트 | ⚠️ 미완성 | dashboard "현재가 로드 후 표시" 메시지 (가격 로드 후 정상 표시) |
| 주간 뉴스레터 | 🔧 외부 스킬 | `weekly-newsletter` 스킬로 별도 운영 |

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
- 차트 라이브러리: 포트폴리오 시각화 → Recharts, 금융 캔들 → lightweight-charts
