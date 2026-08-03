# 2026 투자학교 포트폴리오 앱

Next.js 14(App Router) + Supabase + Vercel(icn1). 투자학교 학생용 **포트폴리오 관리 + 투자 교육** 플랫폼.
프로덕션 https://investment-school-2026.vercel.app · GitHub lindows70-bot/investment-school-2026

> **이 파일은 원칙·함정·현재 상태만 담는다.** 완료된 기능의 상세 기록은 `docs/history/`로 분리했다(2026-08-03).
> 4,066줄·433k자가 매 세션 로딩돼 성능 경고가 떠서 나눴다 — **내용은 하나도 버리지 않았다.**

## 📚 기록은 어디에

| 찾는 것 | 볼 곳 |
|---|---|
| **왜 그렇게 만들었나 · 무엇을 기각했나** | `docs/history/2026-0N.md` (274개 섹션 전량 보존) |
| 기능별 설계·데이터 실측 판정표 | `docs/<기능>/plan.md`·`context-notes.md` (`docs/README.md` 인덱스) |
| 배포 절차 · 백테스트 해부 · 기능 착수 | `.claude/skills/` (deploy-verify · backtest-autopsy · feature-kickoff) |

- `docs/history/2026-05.md` — 앱 뼈대·린치/버핏 분석기·비밀병기 1~7단계
- `docs/history/2026-06.md` — 비밀병기 완성·AI 리밸런싱·수급 레이더·4계절 내비게이터
- `docs/history/2026-07.md` — 기술 신호 백테스트·부동산 인텔리전스·킬러 로드맵 7종·주간 리포트
- `docs/history/2026-08.md` — 실적 리포트(SEC/DART)·화면검증 라운드·성적표 재설계
- `docs/history/기타.md` — 디렉토리 구조·API 엔드포인트 목록·초기 터미널들

⚠️ **새 기록을 CLAUDE.md에 쌓지 마라.** 완료된 기능은 해당 월 히스토리에, 원칙·재발 함정만 여기에.

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

## ⛔ 절대 원칙 — 어길 수 없는 것

기능 기록에 흩어져 있던 것을 모았다. **새 기능을 붙이기 전에 이 목록과 충돌하는지 먼저 검열한다.**

- **⛔ 자동매매 금지** — 조언·시뮬레이션까지. 주문 체결은 어떤 경우에도 없다. 토스 실거래는 `TOSS_TRADING_ENABLED` 게이트 + 사람 확인 뒤에만(현재 기본 false).
- **⛔ WHAT/WHEN 분리** — 기술 신호(EMA·구름·라쉬케·타점)는 **6축 점수·종목 선정에 절대 반영하지 않는다.** 배지·근거·타이밍으로만. 종목 선정(WHAT)은 펀더멘탈, 진입 시점(WHEN)은 신호등.
- **⛔ 가짜 정밀 금지** — 승률·점수를 지어내지 않는다. **표본수를 항상 병기**하고, 없으면 없다고 한다. 표본 10건 미만은 통계가 아니라 일화.
- **⛔ 일방적 매도 강요 금지** — 손실 종목에 **단순 고평가만으로** 손절을 강요하지 않는다(HOLD_DIP 철학). 미국 빅테크·최고 종목은 중장기 적립 대상이라 DCF 고평가 단독으로 익절을 권하지 않는다.
- **⛔ 개인 계좌 데이터 경계** — 토스 개인 계좌(잔고·보유·주문)는 소유자 본인 세션만(`assertTossOwner`, fail-closed). 공유 캐시 키·학생 노출 컴포넌트·`NEXT_PUBLIC_`에 절대 넣지 않는다. `.env.local` 전용 키: TOSS_*·KRX_ID/PW(커밋·Vercel 금지).
- **⛔ 코인 가드** — 학생 권장 상한 5%(≥10% 위험). "이자 없는 로켓 연료, 잃어도 되는 돈만."
- **⛔ LuxAlgo 등 유료 지표 코드 복제 금지** — 공개 개념만 우리 결정론으로 재구현.

## ⚠️ 반복 함정 — 두 번 이상 당한 것

같은 실수를 반복해서 기록이 쌓인 것들. **커밋 훅·스킬이 일부만 막아준다.**

### 빌드·배포
- **`npm run check` 통과 ≠ `next build` 통과** — JSX 텍스트의 곧은 따옴표(`react/no-unescaped-entities`), 타입캐스트+연산자(`(w as number) >= 10` 괄호 필수)는 빌드에서만 잡힌다. 반드시 `npm run check:build`.
- **검증 명령에 파이프 금지** — `... | tail`은 exit code를 가려 실패한 빌드가 커밋·배포까지 흘러간다. **`&&` 체이닝**으로.
- **로컬 `npm run build` 절대 금지** — dev 서버의 `.next`를 덮어써 흰 화면. `check:build`가 `.next-build`로 분리 빌드한다. **dev 서버가 떠 있을 때 같은 폴더에서 `next build` 금지.**
- **"배포 성공" ≠ "내 코드가 배포됨"** — `vercel --prod`는 git이 아니라 작업 디렉토리를 올린다. 커밋이 조용히 실패했을 수 있으니 **배포 후 `git log --oneline -1` 확인**.
- **`git add -A` 금지** — 병렬 세션 산출물까지 쓸어담는다. 파일을 명시할 것.
- **vercel CLI 버전 고정** — `npx vercel@54.20.1 --prod --yes`(신규 릴리스 전파 지연으로 `notarget` 발생 이력).

### 캐시 (34건 기록 — 최다 재발)
- **응답 '내용'만 바뀌어도 키를 올려라** — 스키마가 같으면 **커밋 훅이 못 잡는다**. 라벨·문구·메타데이터 변경도 대상(v6→v7 실제 사고).
- **writer만 올리면 reader가 조용히 죽는다** — 키 버전업 시 `git grep`으로 reader 전수 확인. 상수로 묶는 게 안전(`UNIFIED_RECO_V`·`MARKET_FLOW_KR_KEY`·`SECTOR_ROTATION_KEY`).
- **읽기 전용 폴백이 있는 캐시를 범프하면 워밍까지가 한 세트** — 안 데우면 하류가 에러 없이 폴백으로 계산해 **자기 캐시에 박제**한다(marks-cycle 2주 사망).
- **Next.js Data Cache가 GET을 박제**(9건) — App Router 라우트의 모든 외부/supabase GET에 **`cache: 'no-store'`**. "refresh를 해도 옛 값"이면 앱 캐시가 아니라 이걸 먼저 의심.
- **무인자 GET 라우트는 `export const dynamic = 'force-dynamic'`** — 없으면 빌드 시 정적 생성되어 외부 API가 느린 날 빌드가 죽고, 빌드 시점 데이터가 박제된다.

### 데이터·판정
- **`market: 'US'`는 '한국이 아님'** — 유럽·일본·중국 포함. 국기·국적 표시엔 `origin`을 써야 한다(실적 리포트 상위 50이 전부 일본·승패 해부실 케링 US 오표기).
- **폴백이 '판정'에 들어가면 데이터 공백이 조용히 성공으로 둔갑** — 결과 배지는 원천 값 존재를 확인한 뒤에만. 같은 null을 두 곳에서 다른 폴백으로 해석하면 화면이 모순된다.
- **`A ?? B` 를 쓰기 전에 A가 실제로 오는지 실측하라** — 필드가 아예 없으면 폴백이 **100% 발동**하고, 코드만 읽어선 안 보인다. **전 항목이 같은 값이면 폴백 100% 신호다**(지수 6/6에서 시가 == 전일종가 → 갭 하락일에 시가 > 고가라는 불가능한 값). 검산 규칙을 하나 붙여라 — 시가는 저가~고가 안에 있어야 한다.
- **단위는 합계 검산으로 안 잡힌다** — 스케일 오류는 부호·합계 불변식을 통과한다. **원문 라벨 + 외부 독립 출처 절대값 대조**로만 검증(수급 100배 축소 사고).
- **외부 API 스케일 규약은 바뀐다** — 상수 나눗셈보다 **값 기반 판별**(`^TNX` ÷10 이중 나눗셈 사고).
- **Supabase select 기본 1,000행 상한** — "최신 데이터가 특정 날짜에서 끊겨 보임"이 전형 증상. range 페이지네이션 + id 보조 정렬.
- **행정·공공 통계는 '당월 vs 누계' 계열 구분을 원값으로 확인** — 연중 단조증가 + 1월 리셋이면 누계(차분 필요).
- **자유 서식 공시는 텍스트 패턴이 아니라 표 구조로 읽는다** — 정규식을 늘리는 방향은 11번째 표기가 나올 때까지 끝나지 않는다.
- **TS2802** — `for..of`/스프레드 on Map·matchAll → **`Array.from()`**(5회 재발).

### 화면 (74건 기록 — 최다 유형)
- **배지·툴팁은 숫자를 상쇄하지 못한다** — 경고를 달아도 권유 문구·수치가 그대로면 학생은 권유로 읽는다. 배지로 부족하면 **필터·문구 자체를 뒤집어라**.
- **같은 종목·분류가 두 표면에 동시에 뜰 수 있으면 축을 병기하라** — 축이 다른 신호(가치 vs 타이밍)는 숨기지 말고 한 칩에 함께(6회 반복).
- **요약은 상세의 부분집합이어야 한다** — 배너(요약)와 카드(상세)가 다른 기준으로 계산되면 반대 신호가 한 화면에 공존한다.
- **비교하라고 만든 표는 잣대가 하나여야 한다** — `A ?? B` 폴백을 비교 표에 쓰면 행마다 다른 것을 재게 된다.
- **발췌·상위 N 목록은 선정 기준과 모수를 함께 적어라** — 같은 "3개"가 어떤 축에선 전수이고 어떤 축에선 1/9이다.
- **"최근 N건"으로 화면을 채우면 신호가 익기 전엔 텅 빈다** — 시간이 지나야 값이 붙는 지표는 '최근순'이 아니라 **'값이 있는 것'**을 기본 소스로.
- **화면에 개수를 쓰면 데이터에서 뽑아라** — 리터럴로 박으면 조용히 거짓말이 된다.
- **집계의 '기타/기본' 버킷에 성격을 주장하는 라벨을 쓰지 마라** — '광역(분산)'이 기본값이면 테마 ETF가 분산으로 둔갑한다.
- **등락 색은 한국식(빨강=상승·파랑=하락)으로 전 화면 통일** — 컴포넌트 하나만 미국식이면 −6%가 빨강으로 찍혀 바로 옆 표와 정반대로 읽힌다(수급 칩 실사고).
- **손실 종목에 '수익 확정'을 권하지 마라** — 매도 문구는 분기 조건이 아니라 **실제 손익**에서 나와야 한다. 리밸런싱은 비중 얘기지만 학생은 종목 판단으로 읽는다. 팔 수익이 없으면 "신규 자금으로 조절"이 정답이다.
- **위로 문구보다 사실이 낫다** — −48%에 "믿고 버텨라" 대신 **"원금 회복에 +94% 필요"**. 손실 구간을 한 버킷으로 묶으면 −0.1%와 −48%가 같은 말을 듣는다.
- **개수는 크기를 담지 못한다** — "4개 상승 우위"가 KOSPI −5.12% 폭락일에 뜬다. 개수를 쓰면 **평균/합계 폭을 병기**하고, 부호가 어긋나면 그 사실 자체를 표시하라.
- **긴 이평선은 짧은 표시창에서 직선처럼 보이는 게 정상** — 수학이지 버그가 아니다.

### 도구·환경
- **PowerShell로 한글 포함 파일 일괄 치환 금지** — CP949 충돌로 한글 주석이 통째로 깨진다. 다중 파일 치환은 **Edit 도구** 또는 bash sed(ASCII만).
- **`/watch`는 `PYTHONUTF8=1`** (Korean Windows cp949 크래시). Windows는 `python3` 아닌 `python`.
- **C: 디스크 만석 재발** — 빌드가 ENOSPC·OOM으로 죽는다. 영상·임시파일은 작업 후 즉시 정리.
- **lib 단위검증 레시피** — 프로젝트 tsconfig extends로 temp 컴파일 + `Module._resolveFilename` 별칭 패치 + `NODE_PATH=프로젝트/node_modules`. **재구현하지 말고 실제 lib을 컴파일해 검증한다.**

## 🧭 검증 원칙 — 이 프로젝트가 실제로 값을 본 것

- **Phase 0 데이터 실측이 코드보다 먼저.** 제미나이·챗지피티가 준 엔드포인트는 절반이 환각이었다. 필드명·스케일·단위를 원문 라벨로 확인할 것.
- **승률은 baseline 대비 초과분만 의미 있다.** 기준선 없는 승률은 국면을 신호 탓으로 돌린다. 백테스트엔 적용해놓고 운영 대시보드엔 빠져 있던 이력이 있다.
- **좋아 보이는 결과는 기본적으로 가짜다** — `backtest-autopsy` 스킬 4단(종목 분산·최다 점유율·시점 분산·이상치 제거). 실제로 여러 가짜 엣지를 죽였다.
- **평균 edge만 보면 속는다** — 중위·승률·이상치 제거를 함께 본다.
- **교과서에 있다 ≠ 우리 표본에서 통한다** — FVG(−1.42)·ADX≥25(−0.26)·눌림목 거래량 조건은 실측에서 역효과·무효였다. **음수·반증도 기록에 남긴다.**
- **화면검증(사람이 표를 읽는 것)이 마지막 방어선** — 금액 실재 검산은 라벨 의미(영업이익 vs 세전이익)를 못 잡는다.
- **자기 코드의 사각지대는 자기가 못 본다** — Codex 리뷰가 커밋 훅의 논리 구멍을 잡았다. Gemini 정합성 감사가 2주 죽어 있던 기능을 찾았다.

## 🤝 멀티 에이전트 역할 분담

역할이 겹치면 소음만 는다.

| 도구 | 역할 | 언제 |
|---|---|---|
| **Claude(나)** | 구현·검증 | 항상 |
| **Codex** (`/codex:review`) | 코드 리뷰 = 로직 결함·설계 가정 | 새 판정 로직·임계값 / 캐시·SSOT 구조 변경 / 공유 lib 수정 / "이 가정이 맞나" 싶을 때. ⛔ 문구 교체·검증된 패턴 반복엔 쓰지 않음 |
| **Gemini** (`scripts/gemini-audit.mjs`) | 정합성 = **파일 간 모순** | SSOT 지표·캐시 키 전수 점검. ⛔ 세 번째 코드 리뷰어로 쓰지 말 것 |
| **야간 감사** (`scripts/nightly-audit.mjs`) | 읽기 전용 보고서 | 매일 02:00 → `.audit/latest.md` |

⚠️ **Codex 무료 한도 소진 — 2026-08-27까지 사용 불가.** 그때까지 리뷰는 자체 검증 + Gemini.
⚠️ 판정은 **반드시 재현으로 확인 후 채택**. 다른 에이전트도 틀린다.

## 제1원칙: 데이터 하드코딩 금지

> **어떤 학생이 어떤 종목을 입력하더라도 동일한 원칙으로 분석**

- 모든 종목 목록은 `investments` DB에서 동적 파생
- ETF·원자재·코인 필터: `assetClassifier.getAssetType()` SSOT 사용
- Lynch 멀티플: `lynchAnalysis.calcFairMultiple()` SSOT 사용
- EPS 이상값 방어: `lynchAnalysis.sanitizeEps()` SSOT 사용
- 카테고리별 하드코딩 데이터 (beta, PEG 등) 완전 제거
- API 폴백만 허용 (FRED 폴백 macroData.ts 등 공공 데이터)

---

## 제1원칙-b: 디자인 값도 하드코딩 금지 — 토큰(`src/lib/theme.ts`)에서 가져다 쓴다

> 제1원칙은 **데이터** 하드코딩을 막았는데 **디자인 값**은 빠져 있었다. 그 사이 색상 잔여 하드코딩이 645곳 → **885곳**으로 늘었고(신규 작업에서 계속 유입), `fontSize`는 **4,211곳에 38종**으로 파편화됐다.

- **색상** = `TK`(61종). 새 hex를 파일에 직접 쓰지 마라. 필요한 색이 TK에 없으면 **먼저 물어봐라**(임의 추가 금지).
- **글자 크기** = `FS`(7단). 0.5px 단위로 새 값을 만들지 마라 — 사람 눈은 0.5px를 구분하지 못해 **위계는 안 생기고 파편화만 남는다**(9/9.5/10/10.5/11/11.5/12/12.5/13/13.5가 실제로 그렇게 쌓였다).
- **라운드·여백** = `RAD`(5단)·`SP`(4px 그리드).
- ⚠️ **일괄 치환 금지**: 값을 옮기면 좁은 칩·표에서 레이아웃이 밀린다. **신규 코드와 지금 손보는 화면에서만** 토큰을 쓰고, 나머지는 그 화면을 리디자인할 때 함께 이관한다(색상 코드모드처럼 픽셀 불변이 아니다).
- 근거: 제목 13 / 본문 11 = **1.18배**뿐이라 "디자인이 평평하다"는 인상이 생겼다. FS는 제목/본문을 **1.92배**로 벌린다.

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
npm run build       # 프로덕션 빌드 (⚠️ dev의 .next 덮어씀 — 로컬 실행 금지)
npm run check       # ★ 타입체크 + lint (로컬 검증용 — .next 안 건드림)
npm run check:build # ★ strict 빌드 검증 — .next-build 로 분리(dev의 .next 무손상, 재시작 불필요)
npm run lint        # ESLint
npx vercel --prod --yes  # Vercel 프로덕션 배포 (원격 빌드 — 로컬 .next 무관)
```

**주의**:
- `npm run dev` 는 `scripts/dev.js`로 포트3000 종료 → `.next` 삭제 → 3초 대기 → 시작 (캐시 충돌 근본 차단)
- **로컬에서 `npm run build` 절대 금지** → dev 서버의 `.next`를 덮어써 흰 화면·"dev 재시작 필요" 유발. 가벼운 검증은 `npm run check`, JSX/SWC strict 빌드 검증이 필요하면 **`npm run check:build`**(next.config `distDir`가 env `NEXT_DIST_DIR=.next-build`를 읽어 분리 폴더로 빌드 → dev 무손상). `.next-build`는 .gitignore + **.vercelignore** 둘 다 등록됨(안 그러면 476MB 산출물이 Vercel 업로드돼 100MB 초과 배포 실패)
- 배포는 항상 `npx vercel --prod --yes` (Vercel 원격 빌드)

---

## 배포

- **프로덕션**: https://investment-school-2026.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio
