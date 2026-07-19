# 2026 투자학교 포트폴리오 앱

> **최종 업데이트**: 2026-07-09 — 🧭 메뉴 대정리 2단계(기능 분산 해소): 학생·본인 피드백("기능이 너무 많고 여러 탭에 흩어져 어디부터 볼지 모름")에 대응. **1단계 = 🎯 오늘의 매매 브리핑 원페이지**(결정에 필요한 5섹션을 한 화면에: 오늘 신호·정리할 것·담을 것·판 읽기·스탠스). **2단계 = 사이드바 용도별 5그룹 재편**(도구 종류 기준 4그룹 → 사용자 여정 기준: 📌매일·💼내 자산·🔍종목 확인·🌍시장 탐구·🎓교육·학교). 주력 3대 화면(로테이션 시계·통합추천·AI 리밸런싱)을 사이드바 딥링크로 승격. 검증: 5그룹 순서·색상·딥링크 하이라이트 화면 확인.
> 이전(2026-07-09): 📋 실전 매매 3종 세트: ①**매매 플랜 카드**(통합추천 전용) — "몇 주를 살까"를 1%리스크룰로 역산(수량=포트×리스크%÷(진입가−ATR손절가)=매매 단위 리스크 패리티), 분할 3단계(신호등 연동)+2R·3R 익절선+갭리스크 경고(명목 15%+). ②**타점 전환 워처** — 매일 08:30 KST 크론이 전 학생 보유 종목 신호등 스캔→전일 대비 🟢돌파/🔴이탈 전환을 대시보드 배너로(본인 보유만 필터). ③막스 시계추에 온도→**권장 현금 밴드**. + 로테이션 시계 전면 리디자인(필 라벨·전역 충돌 해소·축 방향 명확화). 검증: 플랜 12종 수식 소수점 일치·엣지 3건(소수량·눌림가 클램프·갭경고) 수정.
> 이전(2026-07-08): 🚦 타점 신호등(WHEN 레이어) 3대 추천 엔진 통합: 통합추천(수급레이더›통합추천)·AI리밸런싱·퀀트빌더·섹터로테이션 매수랭킹 카드에 EMA112·224 정배열+일목 구름 위치+ATR손절을 **결정론 배지**로 부착. 🟢진입적기(정배열+구름위)/🟡분할·대기(구름속·눌림목)/🔴진입유예(역배열+구름아래). ⛔ **점수·선정·정렬 절대 불변**("WHAT은 펀더멘탈, WHEN은 기술" 분리 — 제미나이의 비중 1.5배/0% 조정안은 점수 오염·휩쏘로 거부). AI리밸런싱 매도측엔 '🚨 최후 방어선 붕괴(역배열+구름 이탈)' 근거 병기(판정 안 뒤집음). 신설 `lib/entryTiming.ts`·`lib/techChartData.ts`(tech-chart 캔들 SSOT 추출·캐시 공유)·`TimingBadge`. 자체검증 12+종 독립 재계산 일치(PLTR 최후방어선·OXY 눌림목·TXN 매물대소화).
> 이전(2026-07-07): 📉 기술적 차트 전용 화면(종목 리서치 › 기술적 차트): 증권사식 한국식 캔들(양봉 빨강/음봉 파랑)+EMA112·224+일목균형표 구름대(26봉 선행)+거래량+**모멘텀 서브패널(MACD·RSI·스토캐스틱·CCI 탭 선택)**+🧭**신호 판독기**(교과서 신호×펀더멘탈 SSOT 교차검증 — 🚨가짜반등[기저효과·고평가·영업적자]/🟢신호정합/🔪칼날/⏳조기청산/⚠️매도 결정론 판정, AI 미사용). 내 포트 칩+티커 검색+일/주/월봉. 기술신호는 이 화면 전용(추천·리밸런싱 점수 미반영=반-하이프 유지). 신설 `lib/techSignals.ts`·`lib/subFlow.ts` SSOT. 자체검증 25+종목 무사고.
> 이전(2026-07-07): 🎯 섹터 로테이션 실전 랭킹 3종(테마·섹터 분석 › 로테이션 시계): ①소섹터 통합 매수/매도 랭킹(17섹터 전 소섹터를 이중 자금쏠림 점수로·ETF 배지·익절/비중축소 분기) ②52주 신고가×소섹터 국면 스캐너("최고가는 다 같은 최고가가 아니다" — 주도=신뢰/태동=약한무리속대장/과열=추격주의, hi52 필드 추가) ③유입1위 섹터 드릴다운 기본 표시. 신설 `lib/subFlow.ts` SSOT(드릴다운 카드↔랭킹 동일 로직). 🐛 핵심: 로테이션 self-fetch가 옛 배포 때려 신필드(hi52) 유실 → **in-process computeSector 직접 호출**로 해결(school-league base URL 버그 클래스). + 이수페타시스(007660·MLB 기판) 추가.
> 이전(2026-07-05): 🚨 글로벌 위기 감지 레이더(투자 리서치) — 시장 버블 4대 지표 실데이터: ①Shiller CAPE(multpl 41.6) ②버핏지표(FRED 시총÷GDP 218%·과거값 실측) ③**선행 PER(FactSet 주간 PDF 실측 20.1·로컬 러너 경유)** ④위험프리미엄(어닝일드−10년물). 종합 Alert 신호등 + 지표별 30년 역사차트 + 반원 게이지 + 쉬운 설명. 하드코딩 거부(제1원칙), FactSet 원본 PDF 직접 파싱(pdf-parse). + 🏛️블랙록 트래커(SEC 13F) + 🚀IPO 하이프 사이클(신규상장주 6단계).
> 이전(2026-07-04): 🚨 빚투 경보 탭(수급 레이더) 3종 레버리지 완성: ①신용잔고(빚투) 비율 역사백분위 경보(네이버 실데이터) ②반대매매(강제청산) 미수금 대비 비중(금융투자협회 FreeSIS, 2023-10 영풍제지 5,257억 앵커) ③공매도 — 🇺🇸미국 FINRA(Yahoo) 잔고·커버일수 + 🇰🇷한국 KRX 로그인 러너(선생님 PC 작업스케줄러 매일 20:00 → Supabase 적재, 웹앱은 로그인 사용자 종목만 필터·잔고 모멘텀 기저효과 가드). 롱빚투↔숏공매도 양방향 레버리지 교육. KRX 무료 API·pykrx 익명은 공매도 불가(전수 실측) → 계정 로그인이 유일 경로.
> 이전(2026-07-03): 🌐 글로벌 비즈니스 사이클(피델리티식·투자리서치 탭) — OECD CLI 13개국 실데이터로 국면(Early/Mid/Late/Recession, 레벨×모멘텀+과열 규칙) 자동판정 S-곡선. 하드코딩 배치 거부(제1원칙), 피델리티 Q2 2026 공식과 9/13 일치.
> 이전(2026-07-02): 🌊 레이 달리오 매크로 사이클 분석 페이지(투자리서치 탭) — ①부채 사이클 6단계 현재위치 FRED 실데이터 자동추정 ②버블 7지표 체크 ③역사 오버레이(현재 vs 2008 vs 2020 실측) ④All Weather(macro-regime 계절 SSOT + Yahoo 20년 백테스트, 2008 방어·2022 실패 정직 노출) + 빅사이클 US vs 중국 국력지표(World Bank 실데이터). 제미나이 설계안을 앱 원칙(Zero-Input·실데이터·SSOT)으로 승격.
> 이전(2026-07-02): 🌊 엘리어트 파동 교육 차트(개념도+실차트 ZigZag 스윙, 파동번호 단정 안 함) + 🕯️ 주간 캔들 장악형 신호(주 분절 조각 버그 수정)
> 이전(2026-07-01): 🌊 증거 기반 매크로 오버라이드(계절 이론이 실패할 때[섹터성적표 diverge]+빅테크 CapEx 급증[주글라르 surge] 시, 계절 불리 기술주의 적합도를 'Fwd EPS 가속' 증거가 있을 때만 복구 → AI 리밸런싱·통합추천·퀀트빌더가 실제 주도주를 추천에서 밀어내지 않게. 무늬만 AI·역성장은 복구 안 함[반-하이프]. unified-reco SSOT 1곳 수정 → 3개 엔진 자동 상속)
> 이전(2026-07-01): 🏭 주글라르 CAPEX 추적기(하이퍼스케일러 5사 연간 설비투자 합산 → AI 설비투자 사이클, 2025 $379B·+69%=상승기) + 📊 섹터 성적표 행 클릭→대장주 Fwd EPS 리비전(실적 뒷받침 vs 테마 펌핑 교차검증, getAnalystSignal 재사용·MSFT 0/0→na 보정) — 4계절 내비게이터 파동 3종(키친 재고·주글라르 CAPEX·콘드라티예프 메가트렌드) 완비
> 이전(2026-06-28): 🌊 경제 파동 중첩 시뮬레이터(키친·주글라르·콘드라티예프 사인파 합성 — '4계절=단/중기 파동 vs 현실=콘드라티예프 AI 장기파동' 괴리의 근본 설명) + 🔥 역풍 돌파/❄️ 순풍 무력 배지(불리인데 상위=매크로 이김·서술적) + 🍂 4계절 내비게이터 × GICS 섹터 실제 성적표(이번 계절 우대/불리 섹터가 실제로 오르나 검증 — US S&P 섹터 ETF 11·KR 섹터 ETF 10+유틸리티 테마지수, 유리 vs 불리 평균 격차→이론대로/반대 판정) + 🏛️ GICS 11 전통 산업 섹터 완성(에너지·소재·산업재·자유소비재·필수소비재·헬스케어·금융·IT·커뮤니케이션·유틸리티·부동산, 테마와 분리된 신규 그룹·US+KR 혼합) + 🌈 비트코인 레인보우 차트(로그 회귀 9밴드) + 📡 자산관리·관심종목 종목별 수급 레이더(차트 하단) + 🧠 AI반도체 섹터에 샌디스크(NAND)·VICR(전력모듈) 추가 + 📈 주가차트 캔들수 통일(1D/1W/1M=60·1Y 월봉 장기, 신규상장주 데이터 한계 정직 표시)
> 이전(2026-06-28): 🧬 테마·섹터 분석 6개 섹터 완성(🛰️양자·🧠차세대AI반도체&신소재·⚡전력망&원전·🦾피지컬AI·🧬AI바이오·🚀우주항공&방산) + 소테마 컬럼 + 🆕신규상장 배지(SpaceX SPCX 상장주 편입)
> 이전(2026-06-26): 🧬 테마·섹터 분석 프레임워크(제네릭 sectorEngine — config 1개로 섹터 추가) + 3개 섹터(🛰️양자컴퓨팅·🧠AI반도체·⚡AI전력망&원전) 신규 메뉴 그룹
> 이전(2026-06-26): 🛰️ 양자 테마 인텔리전스(섹터 히트맵·테마지수/MDD·대장주 베타·퓨어플레이·정책바스켓·Pre-IPO proxy·실적 D-day·미니차트, 글로벌 24종 US+KR+JP+EU+CN+CA) + 🌡️ 추세속도(Trend Speed) 맵(MA10 이격도 히트맵, 머니디자인 재현) + 🌐 외국인 종목별 코스피/코스닥 필터 + 🎯 국민연금 매집/축소 종목(DART 5%룰) + 🏛️ 국민연금(연기금) 수급 추적(누적 추세+일별 컬럼) + 🟢 토스 Open API 검증(IP 허용목록 제약 → 고정 IP 실거래 러너 토대 보존)
> 이전(2026-06-25): 🏦 금융주 가드 전 그루탭 확장(피터린치 이익선·최일 PER/PEG/PSR) + 보유종목 42종 전수검증(VRT 지주사 오탐·삼성생명 자본배분 임계 완화)
> 이전(2026-06-22): 📈 모멘텀(Fwd EPS 리비전+주가추세) 4번째 가중축 + 급락주(falling knife) 매수 제외(통합추천·AI 리밸런싱·위성 공통 `priceTrendKnife` SSOT) + 🏢 코인 관련 주식 보강(비트마인·Bullish 추가 7종목, 종목별 코인 베타[ETH/BTC]·저상관 신뢰도 가드·매매 타이밍[추세·52주]·로그 스케일 오버레이)
> 이전(2026-06-15): 🌊 알트시즌 인덱스(BTC.D 시장국면) + 💵 스테이블코인 레이더(유동성·페그·디페깅 시뮬·도미넌스) + 🎯 알파 헌터(가치·가격 괴리) + 🏦 BTC 현물 ETF

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
- **4차(2026-07-10) — 최저대비 #6e7f8f 전면 퇴출**: 사용자 지적(타점 워처 배너 설명 문구 흐릿) → 앱에 남아 있던 `#6e7f8f`(4.1:1, AA 미달)를 표준 서브텍스트 `#8a9aaa`(5.8:1)로 **42개 파일 96곳 일괄 교체**. 워처 배너 설명은 9.5px→11px + `#a8b5c2`(8.1:1) 추가 상향. ⚠️ 다중 파일 치환은 **bash sed(ASCII hex만)**로 — PowerShell은 CP949 한글 파손(기존 교훈), 치환 후 한글 무결·삽입/삭제 라인 대칭 검증 필수. 이제 앱 서브텍스트 최저선 = #7f93a8(5.3:1).

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
- **`/api/altcoins`(공개·12h): ETH·SOL·XRP·TRX 가격 vs 네트워크 펀더멘탈 이중축 오버레이.** 코인별 최선의 **무료·무키** 지표 — **ETH·XRP·TRX=활성주소(DAU·CoinMetrics 커뮤니티), SOL=일일 수수료(DefiLlama)**. 디커플링 판정(hype/healthy/value/neutral) + 자비스 동적 처방
- ⭐ **트론(TRX) 추가(2026-06-15)**: 스테이블코인 송금 허브(USDT 트론 $89B)·활성주소 ~5M(최대). NET_SCALE을 source→**netUnit 기준(K=1e3/M=1e6)**으로 변경(TRX DAU 수백만=M 표시). 검증: 가격 +357% vs DAU +42.6% → hype(가격이 실사용 앞섬). cache v4→v5
- **무료 데이터 소싱 교훈(중요)**: ① CoinMetrics 커뮤니티는 BTC·ETH·XRP만 무료, **SOL은 403(유료)** → SOL은 트랜잭션 수수료(=실사용 동행)로 대체 ② **CoinGecko 무료는 365일 초과 401**(엔터프라이즈 전용) → **중장기 가격은 Yahoo Finance(BTC-USD·ETH-USD 등 주봉, 무료)**로 우회 ③ Token Terminal·Helius는 키 필요 → 키 없는 원칙상 제외
- **비트코인 10년 차트 × 반감기**: Yahoo BTC-USD 10년 주봉(262p) **로그 스케일** + 반감기(2016·2020·2024) 세로 점선 마커(`position:insideTop`으로 클리핑 회피) + 🎓반감기 교육 아코디언(21만블록 보상절반·공급충격·S2F 디지털금)
- ⭐ **200주 이동평균선 추가(2026-06-15)**: 10년 차트에 200주 MA(약 4년 강력 지지선·역사적 바닥 반등) 파란선. `withMa200`(클라 계산·추가 fetch 0). ⚠️ **핵심 함정**: longChart는 `interval=1wk` 요청이지만 Yahoo가 10y range에 **실측 격주(14일) 간격**(262p)으로 반환 → 200포인트≠200주(7.7년 평균 오류). **간격 중앙값 자동 감지 → 200주(1400일) 윈도우 포인트 수 산출**(격주→100p). 검산: 윈도우 100 → $62,413(현재가 $66,290·비율 1.06) = '200WMA 반등' 이미지 ~$60k와 일치. 교훈: **롤링 윈도우는 '포인트 수'가 아니라 '시간 간격'으로 — 데이터 소스의 실제 간격을 측정해 환산할 것**(interval 파라미터를 그대로 믿지 말 것). ⭐ **전 구간 표시(2026-06-15)**: 200주 MA는 4년치 쌓인 2020부터만 나와 차트 왼쪽 1/3이 비던 문제 → **초기 200주 미만 구간은 expanding window(있는 만큼 평균)**로 이어 그려 차트 처음(2016)부터 선이 나오고 200주 쌓이면 고정 윈도우로 수렴(끝값 $62,413 불변). Yahoo BTC가 2014~라 2016 이전은 원천 불가. ⭐ **세로 확대(2026-06-15)**: 로그 스케일에서 $10k~$100k 변동(올해 폭락 포함)이 작게 보이던 것 → 높이 300→460 + ½decade 눈금([300,1k,3k,10k,30k,100k])으로 상단 구간 해상도↑
- **차트 다년화로 판정 살아남**: 1년 동반하락(전부 중립)→3년으로 보니 **SOL healthy(+341%/수수료+22350%)·XRP hype(+135%/DAU-1.8%, 가격만 펌핑)·ETH neutral** 등 교과서 사례 복원
- **M2 vs BTC 이중축**: 단일 100정규화 축은 BTC 스윙(+180%)에 M2(+9.8%)가 평평한 직선으로 묻힘 → **좌축 M2($T)·우축 BTC($) 각자 스케일**로 M2 완만한 우상향 가시화. 교훈: 스케일 차 큰 두 시계열은 정규화보다 **이중축**
- **④ 네트워크**: 조잡한 SVG 스파크라인 → Recharts 영역 차트. ④+⑤를 2단 배치(풀폭 가로 늘어짐 해소)
- ⚠️ CoinGecko 다수 호출은 순차(버스트 429), 부분실패는 캐시 박제 금지(핵심 키 성공 조건부 setCache) — coin-lab 초판서 학습

## 🌊 알트시즌 인덱스 + 디페깅 강화 (2026-06-15) — 코인 랩

제미나이 제안 반영. **알트시즌 인덱스**(코인 랩 ₿ 뷰): BTC 도미넌스로 '비트코인 피신 vs 알트코인 랠리' 시장 국면 판독.
- **`AltSeasonIndex.tsx`**(추가 fetch 0 — coin-lab `sentiment.btcDom/ethDom` 재사용): 지수=100−BTC.D(0~100) · 비트시즌↔알트시즌 게이지 + 도미넌스 분해(BTC/ETH/기타알트) + 동적 해석. zone: BTC.D≥55 비트우위(안전선호·피신) / ≤42 알트시즌(위험선호·사이클 후반 과열 주의) / 중립. 검증: BTC.D 56.2%→점수 44·비트우위
- **디페깅 시뮬 '내 자산 손실' 강화**(제미나이 ③): 투자금(만원) 입력 → 신뢰충격 시 법정담보 vs 알고리즘 각 **잔존 금액·손실액** 표시("시스템 붕괴"를 "내 자산 손실"로 체감). UST면 ₩1000만→₩0
- ⚠️ **미채택(데이터 한계)**: ① 담보 질 상세(국채 vs 현금 vs 상업어음 %)=분기 attestation(PDF) 실시간 무료 불가 → 종류·페그로 대체(byMech 푸터 교육) ② 규제↔개별코인 신호등=crypto-regulation이 코인 전반 기후라 개별 매칭 불가
- ⛓️ **체인별 분포(2026-06-15)**: DefiLlama `stablecoinchains`(무키) → 이더리움 51%/트론 29%/솔라나 5%/BSC 등 누적바+리스트. "달러가 어느 생태계로 흐르나(솔라나·Base 부상=자금 이동)". cache v4→v5
- 🎖️ **AI 본부장 유동성 연결(2026-06-15)**: hq-briefing에 `liquidity` 리스크 추가 — **코인 보유 + 스테이블 시총 30일 −3%↓**(매수 대기 자금 이탈) 시 "코인 비중 방어" 경고(−6%↓=red). 코인 보유 시에만 스코핑(주식만 보유한 학생엔 노이즈 없음). hq-briefing v8→v9. 스테이블 레이더(혈액)↔운용본부(처방) 연결 완성

## 💵 스테이블코인 레이더 (2026-06-15) — 코인 랩 신규 서브탭(₿/🔷/💵)

"비트코인=디지털 금이면 스테이블코인=디지털 달러(암호시장의 현금·유동성)". 제미나이 3안(투명성·유동성흐름·디페깅시뮬)을 무료·무키 데이터로 통합. 데이터=**DefiLlama 스테이블코인 API**(무키, USD 페그 기준, 실측 $314B·381종).
- **`/api/stablecoin`**(공개·6h): ① **유동성 게이지**=전체 USD 스테이블 시총 추이(`stablecoincharts/all`→totalCirculatingUSD.peggedUSD)+30일 증감(매수 대기 자금=강세 연료). ⚠️ 제미나이 'CEX 유입'은 온체인 유료(Glassnode)라 **시총 발행 증감으로 재해석**(무료·견고) ② **종류별 위험도**(pegMechanism: 법정담보 91.5%/암호 8.4%/알고리즘 0.1%)+점유율 ③ **페그 모니터**(price 대비 $1 이탈)
- **`StablecoinRadar.tsx`**: ① 시총 AreaChart ② 종류 위험도 바+페그 모니터 리스트 ③ **📉 디페깅 스트레스 시뮬레이터**(신뢰충격 슬라이더→법정담보 방어 vs 알고리즘 UST 데스스파이럴 붕괴 인터랙티브·데이터 무관 순수 교육)
- ⚠️ **검증 수정**: ① 페그 경보를 **주요코인($1B+)·하방($1↓)만** → yield형(USDY/USYC +12%는 이자누적 의도)·죽은코인(-100%) 노이즈 제거(위험은 늘 하방=USDC SVB $0.87·UST $0.01) ② DefiLlama 원본 **오타 `crytpo-backed` 정규화**. cache v1→v3
- ⚠️ **정직 한계**: 담보 상세 구성(국채 vs 현금 %)은 분기 attestation(PDF)이라 실시간 무료 불가 → 종류·페그로 대체. 교훈: 무료 소스는 '종류·시총·페그'까지, '담보 명세'는 유료/공시 영역
- ⚠️ **이자형(yield) 토큰 오경보 수정**: USYC($1.13 +12.83%) 등 이자 누적형은 $1 초과가 설계상 정상인데 페그 모니터에 빨강 경보로 떴음 → +2%↑ 지속은 '이자형'(보라) 구분, 빨강 제외(진짜 페그 이탈은 늘 하방). depegAlerts도 주요코인($1B+)·하방(-0.5%↓)만
- ⭐ **스테이블코인 도미넌스(2026-06-15)**: = 스테이블 시총 ÷ 전체 암호 시총(CoinGecko global 무키) = **코인판 '현금 비중'** 역발상 지표(주식 칵테일파티 지수와 동형). 높음(≥12%)=대기 현금 풍부(공포·바닥 가능, 강세 연료 대기) / 낮음(≤6%)=현금 소진(과열 정점). 과열↔공포 게이지 + 동적 해석. 검증: 13.5%(high·이 조정장의 바닥권). cache v4

## 🎯 알파 헌터 — 가치·가격 괴리 탐지 (2026-06-15) — 자산&모니터링 신규 탭

"가치(이익)는 오르는데 주가는 안 따라가는 곳"이 알파(저평가 기회), "주가만 펌핑된 곳"이 거품. 제미나이 설계를 우리 데이터·교훈에 맞게 구현.
- **`/api/alpha-hunter`**(auth·fp 캐시 v2 24h): 대상=내 보유 STOCK ∪ 추천 유니버스(`macro-screened-universe:v3` 캐시 점수 상위60). 종목별 **가치축=이익성장률(canonical.growth SSOT)** + **가격축=Yahoo 주봉 1년 실제 수익률(현재가 vs 12개월 전, KR .KS→.KQ 폴백)**. 괴리=성장률−주가수익률, ±20%p↑ 신호
- **분류**: 🟢alpha(괴리≥+20=저평가) / 🔴bubble(≤−20=거품) / 🟡caution(기저효과) / 〰️fair
- ⚠️ **기저효과 가드(검증서 2건 수정)**: ① **PLTR(peg 0.6·이익+251%)이 알파 1등(+250%p) 오분류** — `isPegBaseEffect`는 peg<0.3 게이트라 PLTR 못 잡음. 알파헌터는 **성장률이 직접 가치축**이라 `isPegBaseEffect OR growth>100%`(일회성 폭증=가짜 성장)로 확장 → PLTR/GEV 🟡caution(알파 제외). ⚠️ 모닝스타(공정가치 축, isPegBaseEffect만)와 기준이 다른 건 **축이 달라서 정당**(알파헌터=성장률 직접, 모닝스타=DCF 35%클램핑 후) — 둘 다 'PLTR 저평가 아님'으로 결론 일관. ② **가격축이 stock-price-history 연평균 YoY**(2026 반년 평균 섞여 INTU −44% 왜곡)→ **Yahoo 실제 1년**(INTU −62.9% 정확)으로 교체. + Y축 극단 기저효과(1692%) 압축 → domain cap(allowDataOverflow)
- 🔪 **떨어지는 칼날 분리(검증 3차)**: BSX가 '저평가 1등(+110%p)'인데 실제 $109→$46 −57% 폭락·RSI 17 추세붕괴 → "가치↑+가격↓=저평가" 단정이 **falling knife를 못 거름**(과거 trailing 이익 vs 미래 기대 하락의 괴리를 기회로 오인). 수정: 괴리상 저평가여도 **주가 1년 −35%↓ 급락이면 `knife`** 분리("싸 보여도 이유가 있다 — thesis 확인", 주황 🔪·하단 정렬). 완만/상승+이익견조만 진짜 alpha. 교훈: **가치-가격 괴리만으론 '떨어지는 칼날'과 '진짜 저평가'를 구분 못 함 — 가격 모멘텀(급락 여부)을 반드시 함께 봐야**(이상적으론 forward EPS 추세까지). cache v3
- **`AlphaHunter.tsx`**: ScatterChart(X=주가수익률 Y=이익성장률·4분면·좌상=저평가/우하=거품, 보유=흰 테두리) + 🟢알파/🔴거품 리스트. 제미나이의 '우하단=저평가' 방향 오류 정정(X=가격 Y=가치면 좌상이 저평가)
- 제미나이 'QuantBuilderLab 탭'은 부적합(빌더는 백지 설계) → **자산&모니터링 신규 탭**. 검증: 401 가드·타입·lint 통과

## 🏦 비트코인 현물 ETF — 순유입/유출 + 누적 거래량 (2026-06-15) — 코인 랩

Coinglass(순유입/유출)·TheBlock(누적 거래량) 차트를 무료·무키로 재현. 데이터 소스 실측 조사 후 구현.
- **`/api/btc-etf`**(공개·24h 캐시): ② **누적 거래량** = Yahoo 현물 ETF 10종(IBIT·FBTC·BITB·ARKB·BTCO·EZBC·BRRR·HODL·BTCW·GBTC) 일별 거래대금(volume×close) 합산·누적. **2024-01-10 출범부터**(GBTC는 그 전 폐쇄형 신탁이라 제외 — TheBlock '현물 ETF' 정의 정합). 검증 **$2.04t = TheBlock $2t 일치** / ① **순유입/유출** = Farside Investors 공개 테이블 파싱(Total 열=일별 순유입 $M, 괄호=유출) + 출범 이후 누적($53.7B) + BTC가격
- **`BtcEtfFlows.tsx`**: ① ComposedChart(🟢유입/🔴유출 막대 + 우축 BTC가격선) ② AreaChart(누적 거래량). 코인 랩 ₿비트코인 뷰
- ⚠️ **Farside Cloudflare 403 → node:https 우회(SEC EDGAR 교훈 재현)**: undici fetch는 TLS 지문으로 403 차단, curl·node:https는 200. `httpGet`(node:https) 헬퍼로 우회. **이 패턴(undici 막히면 node:https)을 외부 스크래핑 표준으로**
- ⭐ **flow 전체 이력 확장(2026-06-15, v4)**: 메인 `/btc/`는 최근 2주뿐이지만 **`farside.co.uk/bitcoin-etf-flow-all-data/` 페이지가 전체 624일(2024-01-11~현재) 일별 flow를 무료·무키로** 제공(node:https 200, 737KB) — 조사로 발견. flow 소스를 all-data로 교체 → ①도 **2024 출범~현재 전체**(2주→2.4년). BTC 가격선 range 5y로 전 구간 매칭. 누적 순유입은 전체 일별 직접 합산($53.7B, Total행 스크랩보다 견고). **CoinGlass/Apify는 무료 키 발급 필요 → Farside all-data(무키)가 Zero Cost 부합**. 교훈: 무료 소스도 "요약 페이지(2주) vs 전체 데이터 페이지(2년)"가 따로 있을 수 있으니 끝까지 탐색
- 조사 교훈: TheBlock이 "SOURCE: YAHOO FINANCE" 명시 → 누적 거래량은 우리 기존 무키 소스로 재현 가능했음. flow는 공시(창출/환매)라 별도 소스(Farside) 필요

## 🌟 종목 투자 프로필 카드 (2026-06-15) — 리서치 페이지 상단 캡스톤

제미나이 옵션1(종목 상세 '투자 프로필' 탭)을 우리 구조에 맞게 우월 구현. 단일 종목의 **해자·스타등급(공정가치)·상대 PSR**을 3초 요약 카드로 리서치 페이지 최상단에 배치.
- ⚠️ **제미나이 안 교정**: 리서치 페이지엔 이미 🏰해자경보기·⚔️섹터피어(PSR 포함)가 있어 제미나이대로면 **중복** → 기존 컴포넌트는 '상세'로 두고 이 카드는 '3초 캡스톤'(정보 위계). "QuantBuilderLab 차트 재사용"도 오답(빌더는 포트폴리오용) → 실제 재사용은 buffettDcf·morningstarRating·getMoatBreach·getSectorPeers
- **`src/lib/stockProfile.ts`**(`buildStockProfile`): stock-info(DCF입력·peg·psr·roe·opMargin) + stock-price(현재가) + lynch-classify(카테고리) + getMoatBreach(해자) + getSectorPeers(상대PSR) 병렬 → `computeStarRating`(공유 SSOT). 신규 계산 0
- **`/api/stock-profile`**(공개·6h 캐시·개별주식 가드): ETF·코인 unsupported 차단
- **`StockProfileCard.tsx`**: ① 해자 배지(폭+추세) ② 스타 게이지(공정가치 라인 대비 현재가 위/아래) ③ 상대 PSR 막대(종목 vs 동종 중앙값) + 불확실성·자본배분. 리서치 분석 카드 맨 위(개별주식만)
- ⭐ **제2원칙 핵심**: 카테고리를 **lynch-classify(DB 우선)** 로 받아 포트폴리오 모닝스타(investment.lynch_category)와 동일 → 같은 종목 별점이 화면마다 일치. 검증: NVDA ★2·PLTR ★1·SK하이닉스 ★3·GEV/TEM 별점보류가 운용본부 모닝스타와 **정확히 일치**. PLTR 기저효과=false(peg 0.57)도 전 화면 일관. 공유 SSOT 함수가 두 기능에서 동일 결과를 내는 게 입증됨
- 검증(2026-06-15): NVDA·PLTR·SK·GEV·TEM 정상 / QQQ·BTC unsupported 차단 / 상대PSR 동종 중앙값 비교(피어 부족 시 절대값만·graceful)
- 💡 **성장가치(PEG)↔절대가치(DCF) 관점 충돌 융합 띠(2026-06-15, v1→v2)**: 검증서 발견 — NVDA가 상단 KPI는 "PEG 0.48 저평가"인데 별점은 "★2 73% 고평가"로 **같은 화면에서 정반대**(학생 혼란). 버그 아닌 관점 차이(PEG=성장 반영 / DCF=성장률 35% 클램핑 보수적). ETN 2축 융합 전례와 동일 처방 → **별점(절대가치)과 PEG(성장가치)가 반대 신호일 때만** 융합 설명 띠 자동 노출: [DCF고평가+PEG≤1.0]→"성장 신뢰 관점 차이", [DCF저평가(≥10%)+PEG>2.2]→"성장 둔화 우려". **기저효과 PEG는 제외**(신뢰 불가·PLTR 교훈). StockProfile에 peg 노출(비용 0). 검증: NVDA(PEG0.48↔DCF73%고평가) 띠 표시 / AAPL(둘 다 고평가) 띠 없음(충돌 없으면 노이즈 안 냄)

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

> ⭐ **GENIUS Act 보강(2026-06-15, v2)**: 작년 통과된 핵심 스테이블코인 법(GENIUS Act)이 최근 45~60일 일반 쿼리엔 안 잡혀 빠지던 문제 → **GENIUS 전용 쿼리**(시행·OCC·Treasury, when:120d) 추가 + 프롬프트에 "통과·시행된 핵심 법도 시행 헤드라인 있으면 status='시행'으로 포함"(통과됐다고 빼지 말 것). 환각 가드는 유지(헤드라인 근거만). 검증: GENIUS Act가 'yellow·시행 및 세부규칙 제정 중·USDT/USDC'로 노출


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

## 🏢 코인 관련 주식 패널 (2026-06-19) — 코인 랩 신규 서브탭(₿/🔷/💵/🏢)

"코인 관련 주식을 어떻게 평가할 것인가"를 **2축 프레임**으로 시각화. 코인 랩 4번째 탭(🏢).
- **`/api/crypto-stocks`**(공개·6h 캐시): Yahoo Finance 1년 주봉으로 MSTR·COIN·MARA·HOOD·CRCL + BTC-USD 수집 → 서버에서 **BTC 베타**(`Cov(주식,BTC)/Var(BTC)`)·**상관계수**·1년 수익률·정규화 가격(첫주=100) 계산. stock-info API는 이들 종목 실패라 Yahoo 직접 호출
- **2축 평가**: ① BTC 베타(얼마나 BTC 레버리지냐 — 베타 2.0=2배) ② 본업 가치(BTC 빼면 뭘로 돈 버나 — 거래소 수수료/채굴 스프레드/스테이블 이자/리테일)
- **`CryptoStocksPanel.tsx`**: 정규화 오버레이 차트(BTC+5종목, 첫주=100) · **끝점 라벨=실제 누적수익률(%)**(정규화 지수 62를 +62%로 오독 방지 — `value−100`으로 표기, 양/음 색) · 종목 카드(베타 게이지 0~3·1년 수익률·BTC상관) · 클릭 시 자비스 해설 · 비즈니스 모델 설명
- 검증(2026-06-19): MSTR 베타1.17/−70%, COIN 1.12/−47%, MARA 1.26/−1%, HOOD 0.89/+38%, CRCL 0.95/−67% (BTC −38%) — 카드 수익률과 차트 라벨 일치
- ⭐ **종목 확대 + 매매 타이밍(2026-06-22)**: 사용자 요청으로 **비트마인(BMNR, ETH 트레저리·톰 리)·Bullish(BLSH, 기관 거래소·피터 틸·코인데스크·2025 상장)** 추가(서클·코인베이스·로빈후드는 기존 포함) → 7종목. **매수/매도 타이밍** = 주봉 단기(4주)·장기(~30주) 이평 정렬로 추세(🟢상승/🟡횡보/🔴하락) + 52주 레인지 위치(0=저점·100=고점) 산출(`priceTiming`, 추가 fetch 0 — 이미 받는 주봉 재사용). 카드에 추세 배지+52주 위치 바, 자비스 해설에 타이밍 문구(고점권=추격주의/저점권+하락=떨어지는 칼날 주의). 캐시 crypto-stocks v1→v2. 검증: BMNR 베타 4.12(ETH 초레버리지)·BLSH 0.99·MSTR 🔴바닥·HOOD/MARA 🟢상승추세
- ⭐ **오버레이 차트 로그 스케일(2026-06-22)**: BMNR이 연중 ~30배(정규화 2928) 급등해 선형 Y축을 독점 → 나머지 종목이 바닥에 깔려 비교 불가(사용자 지적). **Y축 로그 스케일**로 전환(`scale="log"`·domain=[min×0.9, max×1.1]·ticks 동적 [30·100·300·1000·3000]). 정규화 지수(첫주=100)는 항상 양수라 로그 적용 가능, '같은 비율 변화=같은 세로 거리'로 공정 비교. 끝점 라벨 겹침 방지도 선형(<6)→로그 거리(<0.07)로 교정. 교훈: **변동성이 수십 배 차이 나는 자산을 한 차트에 겹칠 땐 로그 스케일이 정답**(BTC 10년 차트와 동일 원리)
- ⭐ **종목별 벤치마크(2026-06-22)**: ETH 트레저리인 비트마인(BMNR)을 BTC 베타로 보던 부정확함 교정 → STOCKS에 `benchmark`('BTC'|'ETH') 추가, BMNR=ETH. ETH-USD 주봉 추가 수집해 BMNR 베타·상관·기준수익률을 ETH 기준으로 계산. 카드 라벨·자비스팁·푸터 수식 전부 벤치마크 동적화. 오버레이 차트에 ETH 라인(점선) 추가(BTC도 점선으로 통일). 캐시 crypto-stocks v2→v3. CryptoStock 필드 `btcBeta/btcCorr`→`beta/corr`+`benchmark`+`benchmarkReturn1y`
- ⚠️ **저상관 베타 신뢰도 가드(정교화 핵심)**: BMNR ETH 베타 3.06이지만 **ETH 상관 0.06**(주가가 ETH 주간 등락과 디커플 — 증자·보유확대·내러티브 주도) → |corr|<0.3이면 자비스팁이 "베타는 참고만, 고유 변동성으로 해석" 경고 + 카드 상관값 앰버색⚠️. 교훈: **상관이 낮으면 베타는 통계적 노이즈** — 수치만 믿게 두지 말고 신뢰도를 함께 표기
- ⭐ **오버레이 가독성(2026-06-22)**: 9개 라인(7종목+BTC+ETH)이 220px에 겹쳐 구분 불가(사용자 지적). ① **차트 높이 220→340px** ② **범례 클릭으로 라인 켜고 끄기**(`hidden` Set·Legend onClick → Line `hide`, 꺼진 항목 취소선) — 겹칠 땐 끄고 둘씩 비교 ③ **색상 분산**(파랑/보라 뭉침 해소: BMNR #818cf8→보라 #a855f7·BLSH 청록→핑크 #ec4899·MARA 보라→빨강 #ef4444 → 7색조 균등). BTC·ETH 벤치마크는 점선으로 종목과 구분. 캐시 불필요(클라 렌더)

## 🏛️ 투자자별 매매동향 (2026-06-19) — 수급 레이더 신규 탭(네이버페이式)

코스피/코스닥 **시장 단위** 개인·외국인·기관 일별 순매수를 타임라인으로(특히 외국인 추세). 수급 레이더 3번째 탭.
- **`/api/market-investor-trend`**(공개·6h 캐시): `finance.naver.com/sise/investorDealTrendDay`(무인증·EUC-KR) 파싱. bizdate 페이징 **7회 체이닝 ≈ 70거래일(3개월)**. 원자료 단위 **백만원 → 억원 환산(÷100)**(앱 전체 통일). 검산: `개인+외국인+기관+기타법인=0`(시장 순매수 합)·`기관계=6개 세부 합` 일치 확인
  - 반환: rows(개인/외국인/기관계+세부 6종) · `foreignCumSeries`(외국인 누적, 과거→최신) · 기간 누적
- **`MarketInvestorTrend.tsx`**: 코스피/코스닥 토글 + ① 투자자별 순매수 막대(**1일/1주/1개월/3개월** 기간 합산 토글 — 슬라이스 후 합산) ② 외국인 누적 순매수 추세(Area, 우상향=매집) ③ 일별 표(외국인 강조)
  - ⚠️ **막대 라벨 위치(recharts 3.8 규약)**: `y`=값쪽 끝(음수면 막대 바닥), `height`=base−value(음수면 음수), **0선=`y+height`**(양·음 공통). 라벨은 `(value≥0 ? y : y+height) − 6` = 항상 0선/꼭대기 위 → 막대 안·X축 글자와 안 겹침. Y축은 규모 따라 억/조 자동 전환
- 검증(2026-06-19): 외국인 3개월 −7,912억(지속 순매도)을 개인 +4,543억이 받아냄 · 코스닥도 정상

## 📡 내 종목 수급 3축 확장 (2026-06-19) — 계절×펀더멘탈×수급

'내 종목 수급'(PortfolioFlowDashboard)은 펀더멘탈×수급 2축이라 통합추천(3축)과 헷갈린다는 피드백 → **계절(방향) 축 추가**.
- **`/api/portfolio-flow`**: 통합추천과 동일 SSOT 경로(`fetchMacroData`+OECD CLI→`seasonOf`)로 US·KR 현재 계절 산출(전부 캐시). 종목별 `holdingFit`로 계절 적합도 0~100 → `favored(≥75)/neutral/unfavored(≤50)`
  - ⚠️ **섹터는 영문 GICS 필수**: `cf.sector`(SSOT)는 한국어 세분류("오일·가스 탐사", "반도체")+KR은 null이라 영문 우대섹터('Energy'…)와 매칭 불가 → `yahoo-finance2 assetProfile.sector`(30일 캐시, KR `.KS`→`.KQ` 폴백)로 별도 수집(통합추천과 동일 소스)
  - ⚠️ **린치 분류 투입**: `lynchCategory`를 안 넘기면 stalwart 폴백(최저 55점)이라 `불리(≤50)`가 수학적으로 못 뜸 → `classifyLynchMece(null, cf.growth, gics)`로 산출해 투입(추가 fetch 0). 이제 가을(스태그) 기술주=35점→불리 정상 표시
- **`PortfolioFlowDashboard.tsx`**: 🌦️ 지금 계절 카드(US/KR 계절+유리/불리 종목명) · 보드/매트릭스에 계절 배지(🌱유리/⚠️불리)
- **이중계상 버그 수정(SSOT)**: 유입·임박 판정 = `status==='INFLOW' || momentum≥40`인데 CROWDED(이탈) 종목도 momentum 높으면 유입에 잡혀 한 종목이 🟢🔴 동시 표시 → [`src/lib/flowShared.ts`](src/lib/flowShared.ts) `isInflowNear`(CROWDED 제외) 단일 판정으로 통일(클라/서버 공용 — server route에서 함수 import 시 next/headers 번들 유입 빌드에러 차단). 매트릭스에 🔴(이탈·과열) 표식 추가
- **헤더·브리핑 정합성**: 개수만 있고 종목명 없던 문제 → 유입·임박/이탈·과열/계절유리 **종목명 노출**. 브리핑이 이탈 종목을 '수급 잠잠'으로 오기술하던 모순 → status 기준 재구성(유입·임박 우선 → 진짜 잠잠만 잠잠 → 이탈 별도 경고) + 조사 은/는 자동 처리
- 동행지수 50% 옆 무라벨 선 = 일별 추이 스파크라인 → 라벨 부착
- 검증(2026-06-19): 38%=3/8 · 유입 3(GEV·NVDA·인텔리안)·이탈 1(SK하이닉스)·계절유리 3(GEV·SPCX·COP) 전부 일치

## 🏛️ FOMC 디코더 (2026-06-19) — 거시경제(Fed Watch) 탭 최상단

차트·확률 위주였던 Fed Watch 탭에 "방금 회의가 무슨 말을 했고 그래서 돈이 어디로"라는 **서사형 해석**이 통째로 비어 있던 문제 → 직전 FOMC 해석 카드 신설.
- **`/api/fomc-decoder`**(공개·6h 캐시): [`lib/fomcSchedule.ts`](src/lib/fomcSchedule.ts)(fedwatch와 공용 SSOT)로 직전 회의 결정론 앵커 → Google News RSS(성명서·점도표·기자회견, 실제 뉴스) → Gemini 구조화 해석. 환각가드(헤드라인 근거만·창작 금지). 의장은 앱 설정대로 '워시 의장' 프레이밍(실제 뉴스 근거 + 가공)
  - 산출: decision(금리결정)·stance(매파/중립/비둘기 신호등)·chairRemarks(발언+해석)·macroDirection·assetImplication(주식·채권·달러·코인)
  - ⚠️ route 파일은 `GET` 등 정해진 export만 허용 → FOMC 일정을 route에서 export하면 빌드에러. `lib/fomcSchedule.ts`로 분리
- **🆚 의장 기조 vs 시장(FF선물) 갭** — 핵심 정합성 장치. 금리방향 신호가 2계통(① `rateDir` FF선물 정량 SSOT=macro-regime·4계절·통합추천·hq-briefing이 사용 / ② FOMC 디코더 stance 뉴스·AI)으로 분리돼 어긋나면 탭 간 모순 발생. 디코더가 `macro-regime`의 `rateDir`을 재사용해 의장 stance와 대조 → aligned(🤝)/partial(↔️)/diverge(⚡) 표시. 정량 SSOT는 오염 없이 대조만. 검증: 매파↔인상=🤝일치
- **`FomcDecoder.tsx`**: 신호등 헤더 + 결정 + 의장↔시장 갭 + 발언 인용·해석 + 매크로 방향 + 자산칩
- 검증(2026-06-19): 직전 Jun '26(2일 전)·동결 3.50~3.75%·매파·인상 시사 / rateDir=hike·phase=peak_rate·CPI 4.3%와 일관

## 🎯 의사결정 저널 + 적중률 (2026-06-19) — 투자기록 탭(진단→판단품질 피드백 루프)

앱이 '진단'은 넘치는데 "내 판단이 맞았나"를 닫는 루프가 전무 → 거래 시점 신호를 박제하고 나중 채점.
- **기존 `snapshot_data`(snapshot 메커니즘은 2026-05-31부터 PEG·성장·분류만) 확장** — 별도 컬럼 X. (사용자가 추가한 `signal_snapshot` 컬럼은 불필요했음 — 기존 snapshot_data 사용)
- **`/api/decision-snapshot`**(공개·종목신호만): 매수/매도 시점 SSOT 신호를 한 번에 박제 — 펀더멘탈(`canonicalFundamentals`)+수급(`getMoneyFlow`)+계절([`lib/currentSeason`](src/lib/currentSeason.ts) 공용 분리)+FOMC(`/api/fomc-decoder`)+영문GICS(yahoo). 전부 기존 SSOT/캐시 재사용
- **5개 기록 지점 연결**: TransactionModal(매수·매도) + AddInvestmentModal(최초·DCA·수정). 기존 키(`peg·growth_rate·category`) 유지로 TimeMachineNote 호환
- **`DecisionCalibration.tsx`**(투자기록 → 🎯 의사결정 적중률 탭): 기존 거래+priceMap만으로 매수 결정 채점(신규 API 0). 전체 적중률 + 신호 차원별(밸류·수급·계절·FOMC) 버킷 승률 + 강점/약점 자동 도출
  - ⚠️ **빈 {} 스냅샷 오염 차단**: AddInvestmentModal 과거 초기매수는 `snapshot_data={}`(truthy)라 단순 보유승률로 오염시킴 → `hasSignal`(peg/flow/seasonTag/fomcStance 중 하나라도 non-null)인 매수만 채점. 검증: 기존 118매수 중 신호 0·빈{} 114 → 정직하게 빈 상태, 오늘 매수부터 집계

## 🔔 국면 전환 트립와이어 (2026-06-19) — 거시경제(Fed Watch) 탭, FOMC 디코더 직하

계절·금리가 '뒤집힐 때' 내 포트의 어떤 종목이 유↔불리로 바뀌는지 능동 경고 — FOMC→계절→포트 닫힌 루프(FOMC 디코더의 완성).
- **`/api/regime-tripwire`**(auth): `getCurrentSeason`(공용) + 전역 국면 이력(`regime-history-v1` 캐시) 비교로 전환 감지. 계절 quadrant가 실제 바뀐 지점만 전환으로 집계(rateDir만 변한 건 제외)
  - 보유종목을 **이전 quad vs 현재 quad로 각각 `holdingFit` 채점** → favored↔unfavored flip 감지(불리해진 것 우선 정렬). 추가 fetch는 캐시된 canonicalFundamentals+gicsSector뿐
  - 전환 없으면 "안정 N일째 + 현재 유리/불리 개수 + 다음 FOMC D-day"
- **`RegimeTripwire.tsx`**: 전환 시 ⚠️불리해진/🌱유리해진 종목 칩(from→to), 안정 시 현황. Fed Watch 탭 FOMC 디코더 바로 아래
- 첫 로드는 이력이 비어 baseline 설정(안정 표시), 실제 계절 전환부터 flip 경고 작동

## 🔮 역-DCF 기대치 투자 (2026-06-19) — 리서치 페이지(종목 상세)

기존 PEG·DCF가 '싸다/비싸다'면, 이건 **현재 주가에 시장이 심어둔 내재 성장 기대를 역산**해 '그게 현실적인가'로 매수를 반증 가능한 베팅으로(Mauboussin·expectations investing).
- **`/api/reverse-dcf`**(공개·종목신호): `canonicalFundamentals`(PE·성장률) 재사용, 닫힌형 역산 `g = (PE/termPE·(1+r)^N)^(1/N) − 1`. 가정 투명공개(요구수익 9%·10년·종착 PER 15)
  - ⚠️ **가드 3종(필수, PEG 함정 일반화)**: ① 절대난이도 — 내재기대 >20%면 '10년 지속 극소수'라 실제 무관하게 demanding(없으면 PLTR PE144·실제251%가 conservative 오판) ② 기저효과 — 실제성장 >60%는 작년 저점 회복 스파이크라 **verdict=unknown(판단 보류)**(fair로 단정 금지 — 배지/본문 모순 방지) ③ 초저PER(<~6.5) — 은·원자재 트러스트(PSLV PE1.45→내재 −13.7%) 등 자산형은 '부적합·PBR/NAV로' (음수 성장 헤드라인 차단)
  - 학생 보유 63종목 전수 검증(2026-06-19): ETF·가상티커 36개 전부 unknown(계산불가) graceful · 개별주 verdict 타당(AAPL/TXN/OXY demanding·GOOGL/현대차 conservative·삼성생명 fair·기저효과 KR주 unknown)
- **`ReverseDcf.tsx`**: 내재기대 vs 실제성장 게이지 + verdict(🔥과도/⚖️합리/🌱보수) + 가정 공개. 리서치 종목 상세(MoneyFlowRadar 다음)

## 🏛️ 국민연금 자산현황 — 하드코딩 자산배분 제거 (2026-06-19)

검증 결과: Top10 보유종목(국내 DART majorstock 5%룰 + 해외 SEC 13F-HR)은 **전부 라이브**(24h 캐시·cron 없음·이벤트/분기 갱신). 단 **자산배분 막대(해외34/국내채28/대체16/국내주14/해외채8)만 하드코딩 상수**였음.
- NPS 자산군 비중은 **무료 실시간 API 없음**(월간 PDF·~2개월 지연 / 기금운용본부 JS렌더 / 뉴스 RSS 없음) → 직접 확인 후 **하드코딩 제거**(라이브만 표시). `ALLOCATION` 상수·`allocation` 필드·UI 막대·`ALLOC_COLORS` 모두 삭제
- 참고: 국내 `UNIVERSE`(70종목)는 값이 아닌 **DART 스캔 대상 코드 리스트**(NPS 5%↑ 보유 탐색용)라 하드코딩 아님. 공시後 주가 큰 수치(SK하이닉스 +1572%)는 fchart·global-top10 시총과 일치하는 **소스 충실 반영**(앱 버그 아님)

## 🤖 AI 리밸런싱 대개편 — 코어-새틀라이트 의사결정 시스템 (2026-06-21)

"진단 대시보드"였던 AI 리밸런싱을 **코어-새틀라이트 처방전**으로 전면 개편(제미나이 멀티에셋 기획 + 현실 보정). 기존 per-stock 진단·unified-reco·satellite·내러티브는 보존하고 그 위에 자산군 레이어 추가.
- **`lib/portfolioRole.ts`**(SSOT): 전 보유를 5분류+BLOCKED MECE 매핑 — `CORE_INDEX`(광의지수만)·`CORE_BOND`·`SATELLITE_BTC`·`SATELLITE_GHOST`·`SATELLITE_GENERAL`(섹터/테마ETF·개별주·원자재)·`BLOCKED`(레버리지·비BTC알트). 검증: ETH·XRP·TSLL·AGQ 차단. ⚠️ 섹터/테마 ETF는 코어 아님(새틀라이트 프록시)
- **`ai-rebalance` `buildCoreSatellite`**: 전 자산 비중 + **코어 동적밴드 40~70%**(4계절·금리, `coreTargetBand`) + **캡 10%**(BTC·유령 초과/미달) + **3액션**(🗑️버릴·✂️줄일·🛒보강) + 조언형 가이드
  - 3액션 이유에 이번 세션 기술 총동원: 역-DCF(기대과도🔥)·수급(이탈 CROWDED)·계절(불리 holdingFit)을 매도측에 주입(보유종목 한정 캐시 재사용)
  - 🔧 모순 가드: 역DCF/수급/계절 신호 뜬 종목은 jarvis '사수(DEFEND)'에서 KEEP 강등(PLTR PEG착시 사수↔줄일 충돌 차단)
- **`CoreSatelliteHero.tsx`**: 자산군 바 + 코어밴드/캡 게이지 + 3액션 카드(강력한 단일 이유·태그). `AiRebalancePanel`에 히어로 우선 배치 + 기존 상세진단은 토글로 접음(복잡함 해소)
- ⚠️ **버그픽스 핵심**: ① 자산군 MV — `stock-price` POST 50개 한도 초과(63종목)→40개 청크, 크립토는 Upbit 원화라 market기반 ×usdKrw하면 1380배 폭증→`currency` 필드로 환산(99.4% 정책부적합 오류 수정) ② 원화환산 전 자산 totalValue 기준
- 캐시 v15→v20. 실행은 조언까지(자동 체결 X). 계절↔분산 충돌(여름=경기순환 우대 vs 린치 분산)은 양쪽 정보 표시로 사용자 판단에 위임

---

## 📈 모멘텀 4번째 가중축 — Fwd EPS + 주가추세 (2026-06-22)

"같은 경기순환주라도 반도체(AI 수요·이익 가속)는 오르고 에너지(유가 급락·이익 역성장)는 내린다 — 사이클 *방향*은 매크로 라벨이 아니라 이익 모멘텀+주가 추세가 가른다"는 사용자 통찰을 시스템화. 추천 철학에 **모멘텀**을 4번째 가중축으로 추가하고 **급락주(falling knife) 매수 추천 제외**.
- **SSOT = `macroPhaseScreener.computeMomentum`**(신규, 추가 fetch 0 — `screenOne`이 이미 받는 Yahoo 모듈 재사용 + `earningsTrend` 모듈 1개 추가):
  - **Fwd EPS 방향** = **EPS 리비전**(애널리스트가 차기연도 추정치를 30일 전 대비 올리나/내리나)이 진짜 모멘텀. ⚠️ **`forwardEps/trailing` 절대비율은 사용 금지** — 저점 회복 *기대* 선반영으로 왜곡(COP는 그 비율이 +56%라 '가속'으로 오판). 후행 이익이 깊은 역성장(≤−10%)이면 리비전 상향이어도 '회복 기대'일 뿐이라 한 단계 눌러 과신 차단
  - **가격 추세** = 50일·200일선 정렬 + 52주 위치. 정배열 상승=`up`, 200일선·정배열 모두 깨짐=`down`, 그 외(눌림목/횡보)=`side`
  - **떨어지는 칼날** = `down` + 200일선 8%+ 하회 + (52주 하락 또는 52주 저점 15% 이내). **눌림목은 칼날 아님**(COP는 200일선 위·정배열이라 칼날 제외)
  - `momentumScore = Fwd EPS 0.6 + 가격추세 0.4`(Fwd EPS 가중↑ — "가장 중요")
- **`ScreenedStock`에 모멘텀 필드 추가** → 공유 유니버스(`macro-screened-universe:v3→v4`)를 쓰는 **모든 메뉴 자동 전파**(통합추천·AI 리밸런싱·4계절 매수후보·알파헌터·퀀트빌더)
- **`unified-reco` 4번째 가중축**: `W = {계절 0.20, 펀더 0.30, 수급 0.20, 모멘텀 0.30}`(모멘텀·펀더 공동 최고). **칼날 종목은 선별에서 제외**(메인+KR 백필). 모멘텀 배지(📈 이익 가속/📉 역성장·🚀 상승추세/🔻 하락추세·🔪 급락) + 투명 4축 미니바(`UnifiedReco.tsx`). 캐시 unified-reco v11→v12
- **AI 리밸런싱**: 매수후보가 unified-reco에서 와서 모멘텀·칼날 제외 **자동 상속**. 캐시 ai-rebalance v20→v21
- ⚠️ **실데이터 검산(2026-06-22)**: 같은 경기순환주 — **반도체 NVDA·SK하이닉스 momentum 91**(리비전 상향·정배열 상승) vs **에너지 COP·XOM·CVX 53**(후행 −20~−45%·눌림목, 칼날 아님). 30% 가중이라 에너지가 반도체보다 통합점수에서 크게 밀림 → "주가 빠지는데 1순위 추천" 문제 해소. COP의 펀더 약점(역-DCF demanding)은 별도 가치축이 잡음
- 교훈: **Fwd EPS '성장률'이 아니라 '리비전 방향'을 봐야 한다** — forwardEps 절대값은 경기순환주 저점에서 회복 기대로 부풀어(기저효과) 하강 사이클을 상승으로 오판한다(역-DCF·PEG 기저효과 가드와 같은 원리)
- ⚠️ **EPS 방향 배지 모순 가드(2026-06-22)**: 모멘텀 `📈 이익 가속`(earningsTrend 컨센서스 값 변화)과 기존 `📉 이익추정 하향`(getAnalystSignal 애널수)이 한 카드에 동시 표시되던 제2원칙 위반(Qualcomm) → 모멘텀이 EPS 방향 SSOT이므로 **애널 배지는 모멘텀 방향과 어긋날 때 숨김**(일치 시 보강 정보로 유지). UnifiedReco 헤더도 "세 축→네 축"·가중치에 모멘텀 30% 추가. unified-reco v12→v13
- ⚠️ **위성(10배거) 칼날 가드 보강(2026-06-22)**: 가격추세·칼날 판정을 `priceTrendKnife`(SSOT)로 추출 → 통합추천(`computeMomentum`)·위성(`buildSignalMetrics`)이 **동일 정의** 공유. `SignalMetrics`에 `priceTrend·knife` 추가(추가 fetch 0 — 이미 받는 summaryDetail·defaultKeyStatistics·price 재사용, jarvis-metrics v8→v9). `satelliteScreener`가 칼날을 강등(점수≤25)+`🔪급락추세` 사유+**선별에서 제외**(SAT_SCORE_KEY v1→v2). 위성도 매출성장(Fwd 프록시)에 더해 급락주 차단. ai-rebalance v22→v23
- 교훈: **칼날(급락+하락추세) 정의는 한 SSOT(`priceTrendKnife`)로** — 통합추천만 막고 위성은 안 막으면 같은 종목이 한 곳선 제외·다른 곳선 추천되는 모순(반복 패턴)

## 📦 AI 리밸런싱 보강 — 재고 적체(사이클 고점 선행) + 보유 추세/칼날 매도 (2026-06-22)

제미나이 '현장의 촉(catalyst)' 아이디어를 비판적으로 수용 — 이미 있는 것(내부자 매수=수급 연동·어닝 sentiment=Jarvis)은 재구축 안 하고, **진짜 빈틈 2개**만 보강. "최고 수익률"엔 사이클 고점 회피 + 손실 빨리 자르기가 핵심.
- **📦 재고 회전율(경기순환 고점 선행)**: 후행 PER/PEG가 '이익 폭증=저PER'로 속이는 사이클 고점을, **재고증가율 > 매출증가율**(YoY)로 선행 포착. `buildSignalMetrics`에 balance-sheet FTS(`inventory`) 1콜 추가(재무 FTS 매출 재사용) → `inventoryBuildup`·`invGapPct`. **가드**: `재고+5%↑ & 매출보다 15%p+ 빠름 & 매출 저성장(<20%)` — ⚠️매출 고성장 램프업(NVDA 블랙웰 비축 재고+128%/매출+85%)은 **제외**(검산서 false-positive 발견·보정), '매출 안 느는데 재고만 쌓임'만 포착. `evaluateSignal` SELL 룰 + `CyclicalTrap`(함정 레이더에 📦재고+N%p 배지) 반영. 경기순환 winner가 재고 적체면 → 분할 익절(사이클 꺾이기 전 차익실현)
- **📉 보유 종목 추세/칼날 매도(비대칭 해소)**: 모멘텀(주가추세·칼날)을 매수 후보엔 넣었는데 **보유 매도 진단엔 빠져 있던 비대칭** 해소 — `buildSignalMetrics`가 이미 가진 `priceTrend·knife` 재사용. `evaluateSignal` SELL에 **🔪칼날(50·200일선 정배열 붕괴)** 추가(winner=익절/sound loser=경고만, 저점매도 강요 안 함), ai-rebalance 줄일것에 **단순 하락추세(추세 이탈)** 소프트 트림 사유 추가
- ❌ **제외**: 제미나이 '제품 가격 스프레드(D램 고정가·신조선가)' = 무료 실시간 API 없음(제1원칙 위반) → 재고 회전율이 같은 사이클-고점 신호를 무료로 대체. 내부자 '매수'는 이미 수급 반영(이중계상 방지)
- 캐시: jarvis-metrics v9→v10, ai-rebalance v23→v24. 검산(2026-06-22): CAT 재고+10%/매출+22%·SK하이닉스 +10%/+198%·KO −7%/+12% 전부 정상, NVDA +128%/+85%는 가드로 제외
- ⚠️ **위성 기저효과 PEG 가드(2026-06-22)**: 화면 검증서 발견 — AFRM(유령 발굴)이 **PEG 0.02**(흑자전환 직후 착시)로 +25점 인플레. 원인 = `buildSignalMetrics`가 canon-fund 캐시 콜드 시 `PE/(성장×100)` 폴백으로 아티팩트 생성(canonical은 0.73). 통합추천(코어)엔 `isPegBaseEffect` 가드가 있는데 **위성엔 없던 불일치**. → satelliteScreener에 `pegSuspect = isPegBaseEffect(peg, earningsGrowth) || peg<0.1`(데이터 아티팩트 하한 보강 — 흑자전환은 이익성장 불안정해 isPegBaseEffect만으론 누락) 추가 → 착시 저PEG는 +25 보너스 제외 + `⚠️PEG 기저효과` 배지. SAT_SCORE_KEY v2→v3, ai-rebalance v24→v25. 교훈: **기저효과 가드는 전 스크리너(코어·위성)에 동일 적용해야 — 한쪽만 막으면 같은 착시가 다른 경로로 샌다**

## 🎯 종목 리서치 종합 매수 판정 (2026-06-23) — AI 리밸런싱 근거 총망라

리서치 페이지엔 신호 카드가 많지만 **"그래서 이 종목 매수해도 되나?"를 한눈에 판별하는 종합 결론이 없던** 빈틈을, AI 리밸런싱과 **동일한 4축+리스크 엔진**으로 합성한 판정 카드로 채움. 리서치 페이지 최상단(투자 프로필 위).
- **빠진 것 보충**: 리서치엔 수급·역DCF·내부자·좀비·해자·PSR·어닝은 있었으나 **모멘텀(Fwd EPS 방향)·재고적체·계절 적합·종합 판정**이 없었음 → 전부 추가
- **`buildSignalMetrics` 모멘텀 SSOT 확장**: `computeMomentum`을 export하고, buildSignalMetrics가 earningsTrend 모듈 추가해 **momentumScore·fwdEpsDir 노출**(priceTrendKnife→computeMomentum로 교체, 통합추천과 동일 정의). 리서치·리밸런싱·브리핑·위성이 같은 모멘텀 SSOT 공유. jarvis-metrics v10→v12
- **`/api/research-verdict`**(공개·종목신호·`research-verdict-v2:TICKER:MKT:DATE` 6h): buildSignalMetrics + getCurrentSeason+holdingFit(계절) + reverse-dcf + getMoneyFlow를 합성 → **4축(계절20·가치30·수급20·모멘텀30) − 리스크 감점(칼날·좀비·재고·하이프)** → `verdict`(✅매수적합/⚖️신중/⛔부적합) + score + 찬성/주의 근거 리스트 + 한 줄 결론. **신규 판정기 0개**(전부 기존 SSOT 재사용·제2원칙)
- **`ResearchVerdict.tsx`**: 판정 배지+점수, 4축 미니바, 👍매수근거/⚠️주의 2열, "상세는 아래 카드 참조" 안내
- ⚠️ **검증 중 발견·수정 — 금융주 좀비 오판(중요)**: KB금융(은행)이 **이자보상배율 0.0 → 좀비 → 부적합** 오판. 은행·보험은 이자비용이 영업의 핵심(예금이자)이라 이자보상배율이 구조적으로 무의미 → `buildSignalMetrics`에서 **금융 섹터(financ|bank|insurance|capital market|asset manage)는 interestCoverage=null** 처리(좀비 오판 차단). **SSOT 수정이라 리서치·리밸런싱·브리핑 동시 교정**. 검증: KB금융 좀비 제거 후 ✅매수적합(81, 저PEG0.43·계절우대·수급유입·이익가속) / JPM도 좀비 false / TEM(진짜 적자)은 좀비 유지. jarvis-metrics v11→v12, ai-rebalance v25→v26
- 검증(2026-06-23): PLTR ⛔(43·역DCF과도+하락추세+칼날)·COP ⚖️(60)·JPM ⚖️(64·금융가드)·TEM ⛔(0·진짜좀비+적자) — 유형별 판정 정확

## 🏦 금융주 오진단 전면 수정 (2026-06-23) — 좀비·해자·자본배분 3종

KB금융(은행)이 AI 리밸런싱·본부장 브리핑·투자 프로필에서 **3가지 잘못된 진단**을 받던 것을 전부 SSOT에서 교정. 은행·보험은 일반 기업 지표(이자보상배율·총마진·순부채)가 구조적으로 무의미하기 때문.
- **🧟 좀비(이자보상배율)** — 은행은 이자비용=영업 핵심(예금 이자)이라 이자보상배율이 0 수렴 → `buildSignalMetrics`에서 금융주 `interestCoverage=null`(2026-06-22 선반영). AI 리밸런싱 버릴것·하이프·브리핑 동시 교정
- **🏰 해자(총마진)** — 은행은 '총마진' 개념이 없어 `getMoatBreach`가 'none'(해자 없음) 오판 → **ROE 기반 프록시**로 전환(ROE≥15 wide·≥8 moderate·≥4 narrow). 예금 기반·전환비용·규제 라이선스가 실질 해자. `MoatResult.isFinancial` 노출. 검증: KB금융 none→moderate·JPM→wide
- **💼 자본배분(stewardship)** — 은행은 예금이 'totalDebt'로 잡혀 순부채>0 → 'poor'(미흡) 오판 → `morningstar-rating`·`stockProfile`이 `moat.isFinancial`이면 `netDebtPos=null`(ROE만으로 평가). 검증: KB금융 poor→standard·JPM standard
- **감지**: `getMoatBreach`가 `assetProfile.sector/industry`에서 `/financ|bank|insurance|capital market|asset manage/i` → `isFinancial` 단일 판정, 다운스트림이 재사용(제2원칙)
- 캐시: jarvis-metrics v12·morningstar-rating v3→v4·hq-briefing v10→v11·stock-profile v2→v3·ai-rebalance v26. 검증: KB금융 ✅매수적합(81)·해자 moderate·자본배분 standard·좀비 제거 / NVDA(비금융)는 영향 없음(exemplary 유지)
- 교훈: **금융주는 일반 기업 재무 지표가 통째로 안 맞는다 — 이자보상배율·총마진·순부채는 전부 금융 가드 필요**(섹터 감지 1곳에서 isFinancial 산출 → 전 지표 일괄 적용)

## 🐛 워렌버핏 탭 KB금융 누락 — ETF 브랜드 오매칭 (2026-06-23)

분석 페이지(`analysis/page.tsx`) 워렌버핏 그리드에서 KB금융(은행)이 빠지던 버그. 피터린치 탭엔 나오는데 버핏엔 안 나옴.
- **원인**: `isEtf` 헬퍼의 `ETF_BRANDS_LIST`에 바 `'KB'`(KB자산운용 ETF 잡으려던 것)가 있어 **"KB금융".includes('KB')=true** → 은행이 ETF로 오분류 → 버핏 그리드(`buffettStocksOnly = assetType==='stock'`)에서 제외. getAssetType(SSOT)은 STOCK으로 맞게 판정했으나 이 느슨한 브랜드 휴리스틱이 덮어씀
- **같은 류 잠재버그**: `'NH'`(NH투자증권)·`'파워'`(파워로직스)·`'MASTER'`(Mastercard US)·`'FOCUS'`·`'WON'` 등 바 토큰이 종목명 부분일치로 오분류
- **수정**: ① 풀 브랜드명만(`'KB'`→`'KBSTAR'`, 'NH'·'파워'·'MASTER'·'FOCUS'·'ETF' 제거, KOSEF·TIMEFOLIO·마이티 추가) ② **KR 시장 한정**(`inv.market==='KR' && ...`)으로 US 종목명 오매칭(Mastercard→MASTER) 원천 차단. 1차 방어는 getAssetType, 이건 SSOT가 놓친 KR ETF만 잡는 보조
- 검증(실DB 전수): KB금융 old=ETF→new=주식 **복구**, 실제 ETF(TIGER·KODEX·PLUS·SOL·ACE·1Q 등 15종) 전부 ETF 유지, 다른 주식 오분류 0
- 교훈: **종목 분류는 getAssetType(SSOT) 단일 기준으로 — 이름 부분일치 브랜드 휴리스틱은 'KB금융'↔'KBSTAR' 같은 접두어 충돌을 일으킨다**(풀 브랜드명+시장 한정 필수)

## 🔒 토스증권 Open API — 데이터 경계 원칙 (2026-06-24)

토스 키는 **선생님 개인 계정**용. 시세는 공용 OK, **개인 계좌정보(잔고·보유·주문)는 학생에게 절대 노출 금지**. 코드로 강제(설계상 차단).
- **2종 데이터 분리**: ① 🌐 시세·종목 조회(개인정보 아님)=학생 공용 허용 / ② 🔒 개인 계좌(잔고·보유·주문내역)=소유자 본인 세션만
- **소유자 게이트 `src/lib/tossOwner.ts`**(`assertTossOwner`): 로그인 사용자 email === `TOSS_OWNER_EMAIL`(env)일 때만 ok. **fail-closed**(소유자 이메일 미설정 시 아무도 통과 못 함 — 실수로 전체 공개 방지). 모든 개인계좌 라우트는 이 게이트 필수, 미통과 403
- **금지**: 개인 계좌 데이터를 ① 공유 캐시 키(user 무관)에 저장 ② 학생 노출 컴포넌트/집계(school-league·school-index 등)에 포함 ③ `NEXT_PUBLIC_` 노출 — 셋 다 금지. 개인 데이터는 소유자 user_id 스코프 + 게이트 뒤에서만
- **실행 경계(재확인)**: 시세/잔고 **조회**는 AI·앱 가능 / 실제 **주문 체결**(실거래)은 `TOSS_TRADING_ENABLED` 게이트 + 사람 확인 뒤에만(자동매매 금지)
- env: `TOSS_API_KEY`·`TOSS_SECRET_KEY`(서버 전용 시크릿)·`TOSS_TRADING_ENABLED`(기본 false)·`TOSS_OWNER_EMAIL`(개인계좌 소유자). 전부 .env.local + Vercel Production만, NEXT_PUBLIC_ 금지

## 🔬 종목 리서치 그루별 탭 개편 (2026-06-24) — 1단계

검색 종목 1개를 **종합 평가 + 그루별(린치/버핏/최일) 분석**으로 나눠 보는 탭 구조로 개편. 기존 [차트 리서치][피터린치 진단(3단계 위저드)] → **[📈 차트 리서치][🔍 피터린치 분석][🏰 워렌버핏 분석][🧭 최일 가치분석]**.
- **📈 차트 리서치**: 캔들+핵심지표+체크포인트 + 🎯 종합 매수 판정(전체 평가) + 시장 시그널(수급·페어·13F)
- **🔍 피터린치 분석**: **위저드 제거 → 한 페이지 자동 분석**(`LynchAutoPanel` 신규: 6대 분류·PEG 해석[기저효과 가드]·이익선 EPS×적정PER 이격·종합 의견) + 어닝콜(JarvisInsight)+노이즈캔슬러
- **🏰 워렌버핏 분석**: StockProfileCard(스타·공정가치·해자)+해자경보기+역DCF+좀비타이머+섹터피어+내부자(스킨인더게임)
- **🧭 최일 가치분석**: 2단계 placeholder(`/valuation` 1,460줄을 `ChoiValuationPanel`로 추출 예정 — SSOT 재사용)
- 구조: 차트 탭은 `{activeTab==='chart' && (<>...</>)}`, 그루 탭은 검색된 `stockInfo`를 공유해 단일종목 컴포넌트 재배치(검색 미실행 시 `GuruEmptyNotice`). 비주식은 `NonStockNotice`
- ⚠️ **2단계 예정**: 최일 가치분석 전체 추출(`/valuation`·리서치 탭 둘 다 사용) + 검색바를 탭 상단 공유로 이동

### 2단계 — 최일 가치분석 전체 추출(2026-06-24)
- **`ChoiValuationPanel.tsx`**(신규, 1,460줄): `/valuation` 페이지를 **파일 복사 후 컴포넌트화**(재타이핑 0). 시그니처 `ValuationPage()`→`ChoiValuationPanel({ ticker, market, embedded })`, `startAnalysis(tkArg?, mkArg?)` 인자 추가, `embedded && ticker` 시 입력 없이 자동조회 useEffect, `embedded`면 헤더·입력부 숨김·패딩 제거
- **`/valuation/page.tsx`**: 얇은 래퍼(`<ChoiValuationPanel />`)로 교체 — 입력 UI 포함 전체 그대로(동작 무변경)
- **리서치 🧭 탭**: `<ChoiValuationPanel ticker market embedded />` — 검색종목 자동 분석. **SSOT**(메뉴·탭 동일 컴포넌트)
- ⚠️ 함정: `onClick={startAnalysis}`는 인자 추가 후 이벤트를 ticker로 넘겨 크래시 → `onClick={() => startAnalysis()}` 수정

## 🏢 지주사 가드 + 섹터피어 X-Ray 탭 이동 (2026-06-24)

- **섹터 피어 X-Ray(피터 린치의 쇼핑몰) → 워렌버핏 탭에서 🔍 피터린치 탭으로 이동**: "같은 진열대에서 제일 좋은 걸 사라"는 린치 철학이라 린치 탭이 맞음(개편 시 오배치 수정)
- **🏢 지주사 가드**(금융주 가드와 동일 철학): 지주사는 **자회사 지분법이익 구조**라 총마진(96%·매출원가 거의 없음)·PER·PEG 표준 프레임이 부적합 → **NAV·SOTP(자회사 가치 합산)**로 평가
  - 감지 `assetClassifier.isHoldingCompany(ticker, name, industry)`: ⚠️ Yahoo industry가 제각각(SK스퀘어=Semiconductors·LG=Consumer Electronics·삼성물산=건설)이라 **큐레이션 KR 지주사 티커(SK스퀘어·SK·LG·삼성물산·HD현대·GS·CJ·두산·한화·LS·효성·코오롱·한진칼) + 이름(지주·홀딩스·Holdings) + Conglomerates** 혼합
  - `getMoatBreach`: 지주사도 총마진 null('96%' 오표시 차단)+ROE 기반 해자, 멘트 "자회사 포트폴리오가 실질 해자·NAV/SOTP 평가"(금융주 분기 확장, isFinancial=true 공유→자본배분 netDebt 가드도 적용)
  - `reverse-dcf`: 지주사면 "역-DCF 부적합 — NAV·SOTP로 평가, 자회사 호황 시 EPS 급등→저PER 착시" 우선 분기
  - 캐시: stock-profile v3→v4·morningstar v4→v5 (reverse-dcf는 무캐시=즉시)
- 검증: SK스퀘어(402340) PER 5.5·PEG 0.04·총마진 96%가 기존엔 칩메이커처럼 보였으나, 지주사로 인식돼 NAV 평가 안내
- ✅ **전 기능 일관 완성(2026-06-24)**: 역-DCF·해자(총마진 N/A·ROE)·자본배분(netDebt 무시)·**피터린치 이익선(LynchAutoPanel: EPS 왜곡→NAV)**·**PSR 상대밸류(StockProfileCard: 비교 부적합)**·**섹터피어 X-Ray(SectorPeerXray: 캐비엇 배너)** 전부 지주사를 NAV·SOTP로 일관 안내(제2원칙). 검증: isHoldingCompany가 SK스퀘어·SK·LG·삼성물산·농심홀딩스(홀딩스 키워드)=지주사, 삼성전자·SK하이닉스·Apple=일반으로 정확 분별
- 교훈: **금융주·지주사처럼 '매출원가/표준 PER'이 구조적으로 안 맞는 업종은 isX 감지 1곳 → 총마진·순부채·역DCF 일괄 가드**(특수 업종 패턴)

## 🏦 금융주 가드 전 그루탭 확장 (2026-06-25)

리서치 그루별 탭(피터린치·워렌버핏·최일)에서 **삼성생명(보험)**이 탭마다 정반대 판정(피터린치 이익선 +135% 고평가 ↔ 워렌버핏 78% 저평가 ★5)을 내던 제2원칙 위반 해소. 보험사 EPS는 투자손익·준비금에 휘둘려 PER·이익선이 왜곡(삼성생명 PER 31배지만 **PBR 0.45=자본 절반 가격**), 실제 가치는 P/B·ROE·내재가치(EV)로 평가해야 함.
- **`assetClassifier.isFinancialCompany(ticker, name, industry)`**(신규): 이름 키워드(생명·화재·손해·금융·은행·증권·캐피탈·카드·보험) + Yahoo industry(financ|bank|insurance|capital market|asset manage). 지주사 가드와 동일 패턴. client(industry 없음)는 이름으로 보강
- **LynchAutoPanel(피터린치 이익선)**: 금융주면 "🏦 EPS 이익선 비교 부적합 → P/B·ROE·내재가치(EV)로 평가"로 전환(고평가 단정 제거). `special = holding || financial`
- **ChoiValuationPanel(최일 가치분석)**: 상단 캐비엇 배너 + 종합판단 카드 주석 — PER·PEG·매출기반(PSR) 적정주가가 보험사·지주사엔 부적합 안내(점수 로직 무변경, 안내만). 보험사 "매출"은 수입보험료라 PSR 곱할 성질 아님
- 검증: 삼성생명·KB금융·삼성화재·미래에셋증권=🏦금융 / 삼성전자·SK하이닉스·Apple=일반 / SK스퀘어=🏢지주(오탐 0)

## 🔍 보유종목 42종 전수검증 (2026-06-25)

학생 보유 개별주식 42종(고유 66종목 중 STOCK)을 프로덕션 API 3종(stock-profile·research-verdict·reverse-dcf)으로 전수 호출 → **크래시·에러 0건**. 발견·수정 2건:
- **VERTIV(VRT) 지주사 오탐**: 영문 "Vertiv **Holdings**"가 `isHoldingCompany`의 영문 `holdings?` 키워드에 걸려 지주사 오판 → 미국 운영회사 법인명에 "Holdings"가 흔하므로 **영문 holdings 키워드 제거**(한글 지주/홀딩스 + 큐레이션 KR 티커 + Conglomerates industry만 신뢰). 두산·SK스퀘어 등 진짜 지주사는 유지
- **삼성생명 자본배분 "미흡"(stewardship poor)**: 보험사는 자본이 거대해 ROE가 구조적으로 낮음(5.3%)인데 `stewardshipOf`의 `roe<0.08→poor`에 걸림 → `StarInputs.isFinancial` 추가, 금융주는 poor 임계를 **ROE<3%로 완화**(stockProfile·morningstar-rating 동시 적용, `moat.isFinancial` 재사용). 검증: stewardship poor→standard
- 교훈: **특수업종 감지 키워드는 영문 일반명사("Holdings")로 넓히면 미국 운영회사를 오탐 — 한글/큐레이션 티커 기준이 안전**. 자본배분(ROE) 임계도 금융주는 별도 완화 필요(섹터 구조적 저ROE)

## 🟢 토스증권 Open API — 검증 결과 & IP 허용목록 제약 (2026-06-26)

토스 Open API로 KR 시세를 보강하려다 **검증 과정에서 IP 허용목록 제약**을 확인. 결론: 토스는 **실거래 게이트웨이**라 IP가 고정된 환경에서만 호출 가능 → 학생 웹앱(Vercel)엔 부적합, 시세는 네이버 무료 소스 유지.
- **API 계약(확인 완료)**: 인증 `POST /oauth2/token`(client_credentials, form-encoded) → access_token(expires_in 86400) / 시세 `GET /api/v1/prices?symbols=005930`(평문 6자리) → `result[].lastPrice`. 호가·체결·캔들·상하한가도 제공. **재무제표·EPS·컨센서스 endpoint는 없음**(시세·종목·환율·계좌·주문만) → 8개년 재무/forward는 기존 DART·FMP·네이버 유지가 정답
- **로컬 검증 성공**: 선생님 PC IP에서 토큰 200·시세 200(삼성전자 ₩359,500) → **키·코드 정상**
- ⚠️ **Vercel 403 'IP address not allowed'**: 토스는 발급 시 등록한 IP만 허용(한국투자·키움 등 모든 실거래 API 공통 보안). Vercel 서버리스는 egress IP가 랜덤·광범위 → 허용목록 등록 비현실적. **읽기전용 데이터 API(네이버·DART·FMP·FRED)와 근본적으로 다른 이유 = 진짜 돈을 움직이는 게이트웨이라 IP를 잠금**
- **결정(SSOT 보존)**: ① `stock-price` KR 경로의 토스 폴백 배선 **제거**(Vercel에선 영원히 403 = 죽은 코드) → 네이버 단독 핫패스 유지 ② **`src/lib/tossQuote.ts`는 보존**(검증된 토스 클라이언트 토대, 향후 실거래 러너 기반) ③ `.env.local`에 키 활성(로컬), Vercel에도 동일 키 존재하나 IP 제약으로 미작동
- ⚠️ **로컬 키 위치 함정(해결)**: 키를 `.env.local`이 아니라 `.env.example`(주석 처리)에 넣어 로컬에서 미인식 — Next.js는 `.env.local`만 읽음. `.env.example`은 git 추적 템플릿이라 **실키 금지**(플레이스홀더만). 보안 점검 결과 `.env.example`엔 플레이스홀더만 있어 노출 없음
- 🎯 **향후 실거래 구조(정석)**: 고정 IP 환경(선생님 PC 또는 저렴한 VPS)에 키를 두고 그 IP만 토스에 등록 → 안전하게 매매. 학생 웹앱은 신호만 표시(키 미보유). 웹앱에서 직접 호출하려면 static-IP 프록시(QuotaGuard 등) 1개 경유. **자동 체결 금지·`TOSS_TRADING_ENABLED` 게이트·사람 확인 원칙 유지**

## 🏛️ 국민연금(연기금) 수급 추적 (2026-06-26) — 수급 레이더 › 투자자별 매매동향

코스피 큰손 국민연금(NPS) 수급을 추적. **신규 수집 0** — 기존 `market-investor-trend`이 이미 파싱하던 네이버 일별 투자자 매매동향의 **`연기금등` 세부 항목** 재활용.
- **`market-investor-trend` route**: `pensionCumSeries`(연기금 누적 순매수, 외국인 누적과 동일 패턴) + `cum.pension` 추가. rows 재활용이라 비용 0. 캐시 `mkt-investor-v2→v3`(형태 변경)
- **`MarketInvestorTrend.tsx`**: ① 🏛️ 국민연금(연기금) 누적 순매수 추세 차트(보라·우상향=매집/우하향=매도) + 최근 5일/20일 순매수 요약 칩 ② 일별 매매동향 표에 **연기금 컬럼 추가**(개인/외국인/기관/연기금 5열) — 하루 변동성 큰 장에서 일별 NPS 수급 직접 확인
- ⚠️ **정직 캐비엇**: '연기금등' = 국민연금 주력 + 사학·공무원·우정사업 연기금 합산(국민연금이 압도적 비중). 우리 수치는 **코스피 전체 NET(매수−매도)** — 기사의 "1.3조 매도 폭탄" 같은 건 특정 종목·이벤트성 gross라 단위가 다름(NPS는 장기보유라 net 순흐름은 보통 작고 가끔 스파이크)
- **종목별 NPS 매매**는 글로벌 시총 Top10 탭의 🏛️ 국민연금 대시보드(DART 5%룰 지분 증감)로 안내 연결. 종목별 일별 국민연금 매매는 KRX OTP/유료라 무료론 (시장 연기금 + DART 5%룰) 조합이 최선
- 검증(2026-06-26): cum.pension(−571억) == pensionCumSeries 마지막값 정합 · 외국인 누적 −1.02조 검산 일치 · 최근5일 −51억/20일 −226억 칩 일치

## 🌐 외국인 종목별 코스피/코스닥 필터 + 🎯 국민연금 매집/축소 종목 (2026-06-26)

"외국인·연기금이 코스피/코스닥에서 어느 종목을 사모으나"를 종목 단위로. **데이터 가용성 먼저 검증**(추측 금지) 후 가능한 것만 구현.
- ⚠️ **데이터 한계(검증 결론)**: 네이버 종목별 trend API(`m.stock.naver.com/api/stock/{code}/trend`)는 **외국인/기관계/개인만** 제공 — **연기금 분리 없음**(005930 전체 필드 확인). KRX는 종목별 연기금 있으나 **OTP/유료**. → 외국인 종목별=가능, 연기금 종목별 일별=무료 불가 → **DART 5%룰 지분변동으로 대체**
- **[외국인] 코스피/코스닥 필터**: `marketFlowKr`에 `market('KOSPI'|'KOSDAQ')` 필드 추가. 네이버 `stockExchangeType.code`(KS/KQ) **라이브 검증 후 KOSDAQ 18종 고정**(`KOSDAQ_SET`·정적 참조 데이터라 하드코딩 허용, 런타임 비용 0). `krMarketOf()` export. `MarketFlowKr.tsx`에 전체/코스피/코스닥 필터(보라) + 종목별 시장 칩. 캐시 `market-flow-kr-v5→v6`. 검증: 코스닥 외국인 5일 순매수 Top3=원익IPS·이오테크닉스·HPSP(반도체 장비 쏠림 정확 포착)
- **[연기금] 국민연금 매집/축소 종목**: `nps-portfolio`가 이미 반환하던 `domestic[].stakeChg`(DART 5%룰 지분 증감) 재활용(비용 0). `NpsPortfolio.tsx`에 🎯 '담는·던지는 종목' 섹션(📈지분 확대/📉축소 2열, %p+현재 지분율). 검증: 매집 삼성전기·현대모비스(+1.01%p) / 축소 현대차(−0.18%p)
- ⚠️ **정직 캐비엇(중요)**: 연기금 종목별 = **DART 5%룰 공시 기준 누적 변동(일별 매매 아님)**, 5%+ 보유 종목만, 시점 지연 가능 → 기사 "삼성전기 던지고"(최근 일별 매도)와 우리 데이터(삼성전기 +1.01%p 매집)가 **방향 다를 수 있음**(공시 시점차). 일별 시장 단위는 투자자별 매매동향 탭 연기금 누적 추세로 보완
- 교훈: **투자자별 종목 수급은 "외국인/기관계"까지만 무료(네이버), "연기금 종목별 일별"은 KRX OTP/유료** — 무료로는 (시장 연기금 추세 + DART 5%룰 종목 지분변동) 조합이 최선

## 🌡️ 추세속도(Trend Speed) 맵 (2026-06-26) — 시장 랭킹에 모멘텀 히트맵

머니디자인 TREND MAP("기관 순매수 TOP + 추세속도 5일 히트맵") 분석 → 우리 데이터로 재현. 시장 랭킹에 [📋리스트 ↔ 🌡️추세속도 맵] 토글.
- **추세속도 = MA10 이격도(%) = (종가−10일 이동평균)/MA×100, ±15% 상한**. 부호=추세방향(🔴상승/🔵하락)·크기=강도·5일 변화=가속/둔화/전환. closes 재사용(추가 fetch 0)
- **`marketFlowKr`**: `trendSpeed`(최근 5거래일 최신→과거) + `recentDates`(컬럼 날짜) 추가. `computeTrendSpeed`(MA10·±15 clamp). closes 20→30개 저장. 캐시 v5→**v10**(아래 시행착오)
- **`MarketFlowKr.tsx`**: 추세맵 모드 — 외국인/기관/쌍끌이 순매수 랭킹 종목의 추세속도 5일 색상 히트맵(🔴빨강 상승/🔵파랑 하락, 짙을수록 강함) + 가속/둔화/전환 판정. 시장/기간/주체 필터 연동(기관 순매수×추세속도 = 스크린샷 재현)
- ⚠️ **시행착오(중요 교훈)**:
  - **MA20는 역효과**: 사용자가 "더 완만하게(MA20)" 요청 → 오히려 급등주의 baseline(20일평균)이 낮아져 이격도가 **+84.6까지 폭증**(완만화 실패). → **MA10로 롤백 + ±15% 클램프**가 정답(원본 톤). 교훈: **이격도는 MA가 길수록 추세에서 멀어진 종목의 값이 더 커진다 — "완만"하려면 MA를 늘리지 말고 상한(clamp)으로**
  - **recentDates 신선도 버그**: 풀 첫 종목에서 날짜 캡처 → 그 종목 per-stock 트렌드가 묵으면 라벨 stale(06/05) ↔ dataDate(06/26) 불일치. → **newestBiz(가장 신선한 종목) 기준 캡처**로 수정
  - **per-stock 트렌드 신선도 편차**: 네이버 `m.stock.naver.com/api/stock/{code}/trend`는 종목마다 캐시 신선도가 달라, 콜드 컴퓨트 순간 일부 종목 closes가 stale될 수 있음(삼성전기 API 1,757,000 vs 라이브 1,993,000). 재계산하면 해소 — 클램프가 이상치 시각 피해도 완화
  - ⚠️ **캐시 키 연속 변경 = 콜드 재계산 타임아웃 주의**: v6→v10으로 짧은 시간에 6번 배포하니 매번 첫 요청이 113종목 콜드 재계산(~1~2분) 트리거 → 그 순간 로드 시 500/504. **캐시 키 버전업은 꼭 필요할 때만, 연속 배포 자제**
- 검증(2026-06-26): 4종목 독립 재계산 == API값(소수점 일치) · 라이브종가 == API종가 · ±15 클램프 정상 · 판정(삼성전기 +11→-3.8 하락전환·SK 상승가속·에코프로비엠 하락가속) 정확. 현재 시장 급락 국면이라 -15 saturation 다수(실제 신호) · 머니디자인式 교육용 근사(독자지표와 공식 다름)

## 🛰️ 양자 테마 인텔리전스 (Quantum Theme Intelligence) (2026-06-26) — 투자 리서치 탭

양자컴퓨팅 섹터 분석. **핵심 철학: 양자주는 이익이 없는 '꿈의 테마'라 PER·PEG·DCF 전부 무의미** → 밸류가 아니라 **모멘텀·테마동조화·정책촉매**로 본다(금융주/지주사 가드와 같은 "표준 프레임 부적합" 패턴). 제미나이 기획 + 자체 강화.
- **`lib/quantumUniverse.ts`**(SSOT·정적 큐레이션): 글로벌 24종(US 13·KR 5·JP 2·EU 2·CN 1·CA 1) + 종목별 `sub`(하드웨어/보안·통신/장비)·`modality`(이온트랩·초전도·중성원자·광학·실리콘스핀·어닐링·PQC)·`purePlay`·`govAwardUsdM`·`yahoo`(해외 심볼). + `QUANTUM_POLICY`(미정부 Award 9건)·`QUANTUM_PREIPO`(비상장 4사+proxy). **티커는 production stock-price/Yahoo로 전수 검증**
- **`/api/quantum-sector`**(공개·6h): 주봉(US/해외=Yahoo `range=2y&interval=1wk`, KR=네이버 fchart) → 1W/1M/1Y 수익률 + **IONQ(대장주) 베타·상관**(주봉 회귀, 코인관련주 패널 로직 이식) + 서브섹터 동일가중 집계 + **테마 지수**(퓨어플레이 동일가중 78주 rebase100)·**MDD**·대장주 5종 오버레이 + **실적 D-day**(yahoo-finance2 quoteSummary calendarEvents) + `spark`(미니차트용 주봉 종가)
- **`QuantumSectorCanvas.tsx`**: ①서브섹터 히트맵 3카드 ②테마지수·MDD·로그스케일 오버레이 차트 ③실적 D-day(임박순·D-7강조) ④테마동조화 표(미니 주가차트+베타·상관+모달리티, **무늬만 양자** 경고=비퓨어+저베타) ⑤퓨어플레이 토글 ⑥정책 바스켓+Pre-IPO proxy. 대시보드 투자리서치 탭(`quantum`)
- ⚠️ **데이터/구현 교훈(중요)**:
  - **Yahoo 주봉 중복 트레일링 바**: `interval=1wk`는 진행중인 현재 주를 직전 완성주와 동일 종가로 중복(IONQ [...49.31,49.31]) → **1주 수익률 0% 버그**. 트레일링 중복 1개 제거로 수정(KR 네이버는 무영향)
  - **어닝 일자**: yahoo-finance2 `quote(symbols, {validateResult})`는 옵션 위치 오류로 0건 → **`quoteSummary(t, {modules:['calendarEvents']})`**가 정답(앱 검증 방식). `calendarEvents.earnings.earningsDate[0]`
  - **토스 API 차트 불가**: 학생 요청(토스式 차트)이나 토스는 IP 허용목록으로 Vercel서 403 → **Yahoo/네이버 실주봉으로 미니차트**(동일 정확도, 웹앱서 작동). spark=최근 30주봉 종가, SVG 영역라인(초록 상승/빨강 하락)
  - **수익률·베타는 비율이라 환율 무관** → 해외(JPY·EUR·GBp·CNY·CAD) 섞여도 직접 비교 OK. 시총가중 대신 **동일가중**(IBM·인피니언 등 대형주 dwarf 방지·테마 폭 측정)
  - **베타 vs 상관 학생 설명**: 베타=움직임 폭(IONQ 1% 오를 때 몇 %)·상관=방향 일치도(-1~+1). 헤더에 ⓘ 호버 + 풀어쓴 라벨('베타(움직임 폭)'·'상관(동행도)'). 저상관(|r|<0.3) 노랑 강조=무늬만 양자
- 검증(2026-06-26): IONQ 1년 +22.5%·우리로 +293.8% 독립재계산 일치 · 베타위계(IONQ 1.0→대형주/해외 0.0~0.4) · 무늬만양자 정확(IBM·KT·SKT·장비주·해외 대형주) · 실적 16/24·spark 24/24 · 테마 MDD −44%. **정직 한계**: 정부Award·모달리티=큐레이션 메타(발표 시 갱신)·비상장 직접투자 불가(proxy 참고)·KR 어닝 미제공

## 🧬 테마·섹터 분석 프레임워크 (2026-06-26) — 신규 메뉴 그룹 + 제네릭 엔진

양자 테마를 **재사용 가능한 섹터 엔진으로 일반화** → 새 메뉴 그룹 '테마·섹터 분석'에 여러 섹터를 config만으로 추가. **공통 철학: 모멘텀·테마동조화·밸류체인 위치(PER·PEG 부적합 테마 多)**.
- **`lib/sectorEngine.ts`**(SSOT): 섹터 무관 공통 계산 — 주봉(US/해외=Yahoo `range=2y&interval=1wk`·KR=네이버 fchart) → 1W/1M/1Y 수익률 + 대장주 베타·상관(주봉 회귀) + 서브섹터 동일가중 + 테마지수(퓨어플레이 78주 rebase100)·MDD·오버레이 + 실적 D-day(yahoo-finance2 quoteSummary calendarEvents) + spark(미니차트). `computeSector(config)` 하나가 전부 처리
- **`lib/sectorConfigs.ts`**: `SECTORS` 레지스트리 — 섹터별 **유니버스+서브섹터+앵커+옵션(정책/Pre-IPO)**만 정의. **새 섹터 = config 1개 추가**(엔진·API·컴포넌트 수정 0)
- **`/api/sector?key=`** + **`SectorCanvas({sectorKey})`**: 단일 API·단일 컴포넌트가 모든 섹터 렌더(서브섹터 카드·테마차트·D-day·베타표+미니차트·퓨어토글·조건부 정책/Pre-IPO). 옛 quantum-sector route·QuantumSectorCanvas 제거
- **대시보드**: 신규 그룹 `sectors`(🧬 테마·섹터 분석) — 탭 `quantum`·`aisemi`·`power`. 투자리서치에서 양자 이관(메뉴 비대화 방지)
- **현재 3개 섹터**:
  - 🛰️ **양자컴퓨팅**(24종, anchor IONQ): 하드웨어/보안·통신/장비 + 모달리티 태그 + 미정부 정책 바스켓 9 + Pre-IPO proxy 4(양자 전용 extras)
  - 🧠 **AI 반도체**(24종, anchor NVDA): 설계/HBM·메모리/파운드리/장비/인프라. 검증: 메모리 1년 +702%(SK하이닉스 841·MU 808 슈퍼사이클)·NVDA +22%(선반영 후 횡보)
  - ⚡ **AI 전력망 & 원전**(27종, anchor GEV): 전력기기·그리드/원전·SMR/전선·케이블/데이터센터전력. 검증: 그리드 +115% 실수요 강세 vs SMR −11.9%(NuScale −73.6% 거품) 양극단·Bloom +1036%(분할 아님)
- ⚠️ **검증 교훈**: 큰 수익률(메모리 +800%·Bloom +1036%)은 **raw close vs adjclose 대조로 분할/배당 왜곡 확인**(전부 ≈일치=진짜). Yahoo 주봉 중복 트레일링 바 제거(1주 0% 버그)·어닝은 quoteSummary calendarEvents·해외 라이브는 Yahoo 국제 접미사(.T/.PA/.L/.SS/.V)·수익률·베타는 비율이라 환율 무관·동일가중(대형주 dwarf 방지). 전력/원전은 베타·상관 낮음(이질적 하위테마라 NVDA형 응집 아님 — 정상)
- 향후: 로봇·우주항공·2차전지 등도 config 1개로 추가

## 🧬 테마·섹터 분석 6개 섹터 확장 (2026-06-28)

제네릭 엔진(`sectorEngine.ts`)에 **config 1개씩만** 추가해 3→6개 섹터로 확장. 엔진·API(`/api/sector?key=`)·컴포넌트(`SectorCanvas`) 무수정 — 프레임워크 설계가 검증됨.
- **6개 섹터**(`sectorConfigs.ts` `SECTORS` 레지스트리·대시보드 그룹 `sectors` 🧬):
  - 🛰️ **양자컴퓨팅**(anchor IONQ) · 🧠 **차세대 AI 반도체 & 신소재**(anchor NVDA, 34종·6서브 — `material` 신소재·기판·패키징[LG이노텍 FC-BGA·삼성전기·Ibiden·Corning…] 추가) · ⚡ **AI 전력망 & 원전**(anchor GEV) · 🦾 **피지컬 AI**(anchor TSLA) · 🧬 **AI 바이오**(anchor TEM) · 🚀 **우주항공 & 방산**(anchor RTX, 26종·5서브: 프라임/우주·발사/방산AI·드론/항공·엔진/K-방산)
- **소테마(서브섹터) 컬럼**(전 섹터): 테마 동조화 표에 종목별 소테마 칩(`subMeta` 색상) 추가 — 어느 하위테마인지 한눈에
- ⚠️ **LG이노텍 '무늬만' 교육 사례**: 피지컬AI(β0.26/r0.10 vs TSLA)·AI반도체(β0.19/r0.06 vs NVDA) 둘 다 무늬만 — 진짜 AI 기판 플레이는 Ibiden(β1.0, NVIDIA 직납). 데이터로 '무늬만' 분별
- ⚠️ **큰 수익률 분할 검증**: 메모리 +702%·삼성전기 +1370%·Bloom +1036%·Planet Labs +346% 전부 raw close≈adjclose 대조로 진짜 확인(분할/배당 왜곡 아님)

### 🚀 SpaceX(SPCX) — Pre-IPO 오판 → 실제 상장주 편입
- **사용자 지적**: SpaceX를 비상장(Pre-IPO 프록시 카드)으로 넣으려다 "상장한 지 2주 지났다"는 지적 — **2026.6 나스닥 상장(SPCX, 검증: Yahoo $153 NMS)**. 옛 지식으로 단정한 실수
- **수정**: 우주·발사 서브섹터의 **대장주(purePlay)**로 편입 + 테마지수 오버레이 RKLB→SPCX. SPCL(2X 레버리지 ETF)·SPAX(T-REX 2X)는 제외(레버리지 ETF)
- 교훈: **종목 상장 여부를 옛 지식으로 단정 말 것** — Yahoo/stock-price로 티커 실측이 먼저(제1원칙의 '추측 금지' 패턴)

### 🆕 신규상장 N주차 배지
- 상장 1년 미만 종목은 **1년 수익률·대장주 베타가 구조적으로 빈칸**(`retPct`는 52주, `betaCorr`는 ≥12주 필요) → 학생이 빈칸 이유를 몰라 혼란
- **엔진**: `SectorStockOut.weeks`(주봉 개수) 노출(`w.length`)
- **`SectorCanvas` Row**: `isNew = weeks<52 && ret1y==null` → `🆕 신규상장 N주차` 배지(하늘색·호버 설명). **무늬만 판정에서 제외**(`fake = !isNew && …`) — 데이터 부족이지 테마 연동 낮은 게 아님. 52주 쌓이면 배지 자동 소멸+지표 정상 계산
- 검증: SPCX weeks=3·ret1y=null·beta=null → '🆕 신규상장 3주차' 정상 표시

## 📈 주가차트 캔들수 통일 + 1Y 월봉 장기화 (2026-06-28)

자산관리·리서치 차트(`FullCandleChart`, OHLC)의 탭별 캔들 밀도를 증권사처럼 통일. `stock-price/route.ts`의 `YF_RANGE`(US 야후)·`naverOhlcChart`/`naverChart`(KR 네이버) 공통 정책.
- **전 탭 60캔들 통일**: 1D=일봉60(~3개월)·1W=주봉60(~14개월)·1M=월봉60(5년). US `range/interval/take`와 KR `timeframe/count`를 같은 밀도로.
- **1Y = 월봉 장기**(증권사 '월' 최장 뷰 매칭): 처음엔 분기봉(3mo)로 만들었으나 **야후 `interval=3mo`가 종목마다 불규칙**(GEV 119=주봉·NVDA 330=월봉 — 신뢰 불가)이라 폐기 → **`range=15y&interval=1mo` 깔끔한 월봉, take 120**(약 10년). KR도 네이버 월봉 120. ⚠️ `range=max`는 야후가 불규칙(어린 종목서 주봉 반환)이라 `15y`로 고정.
- ⚠️ **신규상장주 데이터 한계(정직)**: GE Vernova(GEV·2024-04 상장)는 월봉이 28개월치뿐이라 1M·1Y 모두 ~28캔들이 **최대**(없는 과거 못 만듦) — SPCX 신규상장 배지와 같은 원리. 화면에 캔들이 적은 건 버그가 아니라 상장 후 전체 데이터.
- 교훈: **야후 `interval=3mo`/`range=max`는 종목별로 입도가 들쭉날쭉 — 장기 월봉은 `15y/1mo` 고정이 안전**. 분기 집계가 필요하면 월봉을 받아 직접 묶는 게 일관됨(이번엔 월봉 장기로 결론).

## 🧠 AI반도체 섹터 종목 추가 — 샌디스크·VICR (2026-06-28)

`sectorConfigs.ts` AI반도체(ai-semi) 유니버스 보강(엔진 무수정, config만).
- **샌디스크(SNDK)** → `memory`(NAND 플래시, 2025 WD 분사). ⚠️ 1Y +4,334% 극단값이라 글리치 의심해 검증 → **분할 기록 없음·raw=adjclose 일치·일/주봉 연속 상승**으로 NAND 슈퍼사이클 실데이터 확인(MU +807%·SK하이닉스 +841%와 같은 결). "샌디스크 ~$50" 인식은 훈련 시점(2025초) 기준이라 낡음 — 실측 신뢰.
- **VICR(Vicor)** → `infra`(AI GPU 고밀도 전력변환 모듈 PoP).
- 검증: 둘 다 데이터 정상(SNDK 72주봉·VICR 105주봉), prod ai-semi 36종목.

## 🏛️ GICS 11 전통 산업 섹터 (2026-06-28)

테마·섹터 분석의 제네릭 엔진(`sectorEngine.computeSector`)으로 **전통 GICS 11섹터를 config만으로** 신설. 기존 🧬 테마(교차 바스켓)는 그대로 두고 **별도 그룹 🏛️ GICS 전통 산업 섹터**로 분리.
- **교육 설계**: GICS=MECE(모든 종목 정확히 한 섹터) vs 테마=중복 바스켓. 같은 NVDA가 GICS 'IT'와 테마 'AI반도체' 양쪽에 — **분류 기준의 차이**를 학생이 비교. 각 GICS 태그라인에 섹터 성격(시클리컬 저PER 함정·방어주 고배당·금리 민감 등) 명시.
- **11섹터(US+KR 글로벌 혼합, anchor)**: ⚡에너지(XOM)·🧱소재(LIN)·🏗️산업재(CAT)·🛒자유소비재(AMZN)·🥫필수소비재(COST)·💊헬스케어(LLY)·💰금융(JPM)·💻IT(MSFT)·📡커뮤니케이션(GOOGL)·🔌유틸리티(NEE)·🏢부동산리츠(PLD). 섹터당 ~10~25종, 하위업종(subMeta) 3~4개.
- **💰 금융 섹터**(은행·보험·증권·카드 25종): ⚠️ 태그라인=PER/총마진/이자보상배율 부적합·ROE/PBR 관점(앱 금융주 가드 철학과 일관).
- **배선**: `sectorConfigs.ts`에 config 11개 + `SECTORS` 등록 / `dashboard/page.tsx`에 dashTab 유니온·메뉴 그룹 `gics`·탭 블록. 엔진·`/api/sector`·`SectorCanvas` **무수정**(프레임워크 검증됨).
- 검증: 11섹터 전 종목 데이터 정상(깨진 KR 티커 0), 타입체크 통과, prod 스모크 OK.

## 📡 자산관리·관심종목 종목별 수급 레이더 (2026-06-28)

보유/관심 종목 차트 하단에 **스마트머니 수급 레이더**(`MoneyFlowRadar`, 기존 SSOT) 항상 표시.
- `assets/page.tsx`·`watchlist/page.tsx`의 `FullCandleChart` 아래에 `<MoneyFlowRadar ticker name market />` 추가.
- **KR=외국인/기관/개인 3주체 일별 순매수**(네이버), **US=MFI+내부자+13F 프록시**(미국은 일별 3주체 공시 없음 — 정직 분기). `/api/money-flow` 공개·개별주식 가드·일별 캐시 공유.
- **STOCK 게이팅**: ETF·코인 제외(assets는 `isNA`, watchlist는 `getAssetType`) — 불필요 호출 차단.
- ⚠️ 보유 많으면 카드마다 호출 → KR 캐시 빠름, US 13F 콜드 시 다소 느림(카드별 "분석 중…" 후 채움, 일별 캐시라 재방문 즉시).

## 🌈 비트코인 레인보우 차트 (2026-06-28) — 코인랩 ₿ 뷰

코인랩 10년 차트 아래에 로그 회귀 9밴드 레인보우 추가.
- **`/api/coin-lab` `buildRainbow(longPts)`**(추가 fetch 0 — 기존 10년 주봉 재사용): `log10(price)=a·ln(제네시스 이후 일수)+b` **자체 최소제곱 적합**(하드코딩 계수 없음) + 잔차 σ로 9밴드(파이어세일~최대버블) 생성. `current`(현재 구간+공정가 대비 배수)·`fit{a,b,sigma}` 반환. 캐시 v10→v11.
- **`BtcRainbowChart.tsx`**: ComposedChart 9밴드 색대(b8 빨강부터 그려 b0 파랑이 덮어쓰며 색대 형성, `baseValue={yMin}`·로그 Y축) + 흰 가격선 + 현재구간 배너 + 범례(현재 강조) + 교육/정직성 캐비엇.
- **X축 연도 중복 수정**: 격주 데이터라 연도 2번 찍힘 → `yearTicks`(연도당 첫 포인트만 눈금).
- ⚠️ **데이터 소스(검증 완료)**: 코인 데이터는 대부분 코인 전용 소스(코인게코·업비트·alternative.me·mempool.space·DefiLlama·Farside). **야후 BTC-USD는 "장기 가격 이력"에만** — 코인게코 무료는 365일 초과 401(엔터프라이즈)·업비트는 원화/2017년~라 10년 USD 이력 없음. 교차검증: 야후 $60,369 ≈ 코인게코 $60,348(0.03% 차이) — 야후 BTC-USD는 글로벌 코인 현물가지 주식 데이터 아님.
- ⚠️ **정직 한계**: 회귀는 과거 추세 외삽(미래 보장 X), 적합 구간(Yahoo 10년=2016~)에 따라 띠 위치 달라짐(표준 blockchaincenter는 2010~ 전체). 색대 해석·현재 구간 판정은 동일 작동. 검증: 현재 [매수 BUY!]·공정가 0.5배·밴드 단조증가·262p.

## 🍂 4계절 내비게이터 × GICS 섹터 실제 성적표 (2026-06-28)

"이번 계절에 *유리하다고 분류한* GICS 섹터가 실제로 오르는가"를 섹터 ETF 수익률로 검증. 4계절 내비게이터(투자리서치) 하단, 포트폴리오 정합성과 매수후보 사이.
- **`SEASON_META`에 계절별 `unfavored` 추가**(섹터 로테이션 클락 — 교육용 표준 경향). favored만 있던 것에 불리 섹터를 명시(골디락스→방어/실물 불리, 인플레→고듀레이션 성장·금리민감 불리, 스태그플레이션→성장·금융 불리, 리세션→경기민감·금융 불리).
- **`/api/season-sector`**(공개·`season-sector-v2`·6h 캐시): `getCurrentSeason`(US/KR 계절 SSOT) + 섹터 ETF 수익률.
  - **US = S&P 섹터 ETF 11개**(XLE·XLB·XLI·XLY·XLP·XLV·XLF·XLK·XLC·XLU·XLRE) — GICS 11섹터 1:1 공식 지수, 야후 6mo 일봉. 1M=21거래일·3M=63거래일 수익률.
  - **KR = 대표 섹터 ETF 10개**(091160 반도체=기술·091170 은행=금융·091180 자동차=자유소비재·117680 철강=소재·117460 에너지화학=에너지·117700 건설=산업재·227560 생활소비재=필수·266420 헬스케어·266360 미디어&엔터=커뮤니케이션·329200 리츠=부동산), 네이버 fchart. ⚠️ 완전 GICS 아님(narrow 프록시).
  - ⭐ **KR 유틸리티(깨끗한 ETF 없음) → 🏛️GICS 섹터 차트와 동일한 '테마지수'**: `SECTORS['utilities']`의 KR 구성종목(한국전력·한국가스공사) **동일가중 수익률**로 대체(config 직접 참조 = SSOT). → KR도 11섹터.
  - 각 섹터를 현재 계절 `favored/unfavored/neutral` 분류 + **검증 지표**(유리 섹터 3M 평균 − 불리 섹터 3M 평균 = 격차 → ≥+1.5%p `aligned`(이론대로) / ≤−1.5 `diverge`(반대) / 그외 `mixed`).
- **`SeasonSectorScoreboard.tsx`**: US/KR 토글 + 3개월 수익률 순 막대(중앙 0선·유리 초록/불리 빨강/중립 회색) + 검증 배너 + 정직성 캐비엇.
- ⚠️ **버그(검증 중 발견)** — 배너 '불리 섹터 —' 오표시: 초판 `buildValidation`이 타입수정 전 옛 키(`unfAvg3m`)로 결과를 **공유 app_cache(Supabase)에 dev가 캐시** → prod이 묵은 캐시 서빙(컴포넌트는 `unfavAvg3m` 읽음 → 빈값). **캐시 키 v1→v2**로 무효화 해결. **교훈: dev·prod가 같은 app_cache를 공유하므로 응답 스키마 바꿀 땐 캐시 키 버전업 필수**(season-index·market-flow 동결 패턴과 동류).
- 검증(2026-06-28): 화면 수치 독립 재계산 전부 일치(XLK 36.7%·KODEX반도체 68.8%·US 유리평균 1.7%·불리평균 18%·격차 −16.3%p). 정렬·분류·검산 OK, US 11·KR 11섹터.
- ⭐ **교육 핵심 — 이론 vs 현실 괴리**: 현재 US·KR 모두 **여름(인플레이션)** 국면이라 이론상 에너지·소재·산업재가 유리한데, **실제론 에너지 꼴찌(−12.5%)·기술/반도체 1위(+36.7%·+68.8%)** → `diverge`(이론과 반대) 정직 표시. **왜 4계절 권장 섹터와 실제 시장 주도 섹터가 상반하는가**(= 추후 심화 고민 주제)의 단서:
  - ① **구조적 메가테마 > 순환적 계절**: AI·반도체 슈퍼사이클 같은 구조적 성장은 매크로 계절 로테이션을 압도(2023~ 시장 주도 = 기술, 계절 무관).
  - ② **계절 지표의 시차·정의**: OECD CLI(성장축)·CPI(물가축)는 후행/저빈도라 시장이 선반영한 국면과 어긋날 수 있음.
  - ③ **유동성·정책**: 금리 인하 기대·AI 자본지출이 전통 인플레-수혜(에너지·소재)보다 성장주에 더 큰 동력.
  - ④ **섹터 구성의 변질**: GICS 섹터 내 비중 변화(IT의 AI 집중·커뮤니케이션의 플랫폼화)로 과거 통계적 계절 민감도가 약화.
  - → 도구는 **"교과서 이론은 평균적 경향이지 매달 맞는 게 아니며, 괴리 자체가 국면 전환/구조 변화의 신호일 수 있다"**를 정직하게 가르치는 게 목적(매수 신호 아님).

### 🔥 역풍 돌파 / ❄️ 순풍 무력 배지 (2026-06-28)
괴리를 '알파 신호'로 승화(제미나이 제안을 **서술적으로만** 채택 — 점수 가점 거부). `season-sector`에 플래그(캐시 v3):
- **🔥 역풍 돌파**: `fit==='unfavored'` & 3M 수익률 상위2 & 양수 → 계절상 불리한데 오르는 = 구조적 테마·실적이 매크로 역풍을 이김.
- **❄️ 순풍 무력**: `fit==='favored'` & 하위2 & 음수 → 계절상 유리한데 부진.
- ⚠️ **점수/추천에 영향 0** — 막대 옆 아이콘으로 *사실*만 표시. 매수 판단은 기존 실적·밸류 SSOT가 함(앱의 반-하이프 원칙: 제미나이의 '콘드라티예프 면책권=가점/패널티 면제'는 거부, 맥락 라벨로만).
- 검증: US 🔥기술·❄️에너지 / KR 🔥반도체·❄️소재.

## 🌊 경제 파동 중첩 시뮬레이터 (2026-06-28) — 4계절 내비게이터

'4계절(거시)과 현실(AI)이 왜 어긋나나'를 경제 파동 이론으로 시각 설명. 4계절 내비게이터, 섹터 성적표 다음(괴리→근본원인 흐름).
- **`EconomicWaveSimulator.tsx`**(순수 클라이언트·API 0): 키친(3.5년·재고)·주글라르(9.5년·설비투자)·콘드라티예프(55년·기술혁신) 사인파 + **종합 시장 추세**(합) 합성. 진폭 슬라이더 3개(기본 1·2·5) + 종합 국면 라벨(값·기울기로 성장확장/회복/둔화/침체) + 교육 아코디언.
- **핵심 메시지**: 4계절은 단·중기 파동(키친·주글라르)을 재는데, 시장은 **콘드라티예프 장기 파동(AI)** 위에 있어 교과서를 무시한다 — 괴리는 버그가 아니라 '더 큰 파동이 끌고 간다'는 신호. (앱 연결: 키친=📦재고회전율 레이더, 주글라르=AI 전력망/CAPEX 테마, 콘드라티예프=🧬AI반도체·양자 테마)
- 검증: 기본값(1·2·5) 종합 t=60=+5.32 상승 → '성장 및 확장 국면'(제미나이 스크린샷 일치).
- ⚠️ 교육용 사인파 모델(실측 경기 데이터 아님)임을 명시.
- ⚠️ **빌드 함정(재발 주의)**: JSX 텍스트의 곧은 따옴표 `"`가 `next build`의 `react/no-unescaped-entities`에서 **에러**(단 `npm run check`는 통과 — 로컬 lint가 이 룰을 안 켬). → 한국어 인용부호/`&ldquo;`로 escape 필수. **교훈: `npm run check` 통과 ≠ `next build` 통과 — JSX 텍스트의 따옴표/꺾쇠는 escape**.

## 🏭 주글라르 CAPEX 추적기 + 📊 섹터 대장주 Fwd EPS (2026-07-01) — 4계절 내비게이터

파동 이론을 실데이터로 — '향후 후보' 2건 구현. 둘 다 4계절 내비게이터(파동 시뮬레이터 다음, 섹터 성적표 클릭).
- **🏭 `/api/juglar-capex`**(공개·24h): 하이퍼스케일러 5사(AMZN·GOOGL·MSFT·META·ORCL) 연간 CAPEX 합산(Yahoo FTS **`annualCapitalExpenditure`** raw endpoint·절대값) → AI 설비투자 사이클 위치. ⚠️ FY 말월 상이(MS 6월·ORCL 5월)로 **단독 연도(4개사 미만) 드롭**(ORCL 2026 등). verdict: YoY≥25 surge / ≥5 expand / else slow. **`JuglarCapexTracker.tsx`**(막대+YoY 라벨+국면 배너+기업칩). 검증(원천 재계산 일치): 2022 $150B→2023 $149B(-0.9%)→2024 $224B(+50.6%)→**2025 $379B(+69%)=surge**.
- **📊 `/api/sector-eps`**(섹터 행 클릭 시): GICS Yahoo명→🏛️섹터 config 키 매핑 → 해당 시장 대장주(overlayTickers 우선 3) → **`getAnalystSignal` 재사용**(12M Fwd EPS 리비전 up/down/mixed). '섹터가 실적 뒷받침 상승인지 테마 펌핑인지' 교차검증. `SeasonSectorScoreboard`에 행 클릭 펼침. 검증: 기술 클릭 → **NVIDIA ▲41/▼2 상향**·Broadcom ▲28/▼10 상향(= 🔥역풍돌파가 실적 근거임을 입증) / 에너지 → XOM·CVX·COP 상향. KR은 리비전 무료데이터 없어 na.
  - ⚠️ **MSFT ▲0/▼0 보정**: Yahoo가 일부 종목(MSFT) 리비전 카운트를 0/0으로 줘 `getAnalystSignal`이 'mixed(혼조)'로 분류 → 오해 소지. **표시단(route)에서만** `up30·down30 모두 0이면 dir='na'(데이터 없음)` 보정(SSOT `getAnalystSignal`은 불변). 교훈: 0/0 리비전은 '혼조'가 아니라 '데이터 없음'.

## 🌊 엘리어트 파동 교육 차트 (2026-07-01) — 개념도 + 실차트 객관적 스윙

사용자 요청: "엘리어트 파동을 차트로 가르치고 현재 위치도 보여달라." 위 캔들 리스크 신호로는 부족 → 4계절 내비게이터, 캔들 신호 다음에 전용 교육 컴포넌트 추가.
- **① 이상적 개념도**(`IdealWaveDiagram`, 정적 SVG): 임펄스 5파(1-2-3-4-5, 초록) + 조정 3파(A-B-C, 빨강) 교과서 예시. 실데이터 아님, 순수 개념 전달.
- **② 실제 차트 + 객관적 스윙**: `/api/elliott-wave-edu`(시장별 12h 캐시) — QQQ(US)·코스피200(KR) 주봉 3년 → **표준 ZigZag 알고리즘(8% 임계)** 으로 고점/저점 스윙을 순서대로 검출. 마지막 스윙은 아직 반전 미확정이라 `confirmed:false`(진행 중, 점선 마커)로 구분.
- **현재 위치**: 마지막 확정 스윙 이후 며칠/몇% 움직였는지(`sincePivotPct`) + 방향. 확정 스윙 개수(고점/저점)도 노출.
- ⚠️ **핵심 원칙**: 실제 파동 번호(몇 파인가)는 분석가마다 다르게 세는 **주관적** 판단이라 제1원칙(하드코딩·주관배제) 위반 → 단정 안 함. 화면의 번호는 **공식 엘리어트 카운트가 아니라 ZigZag가 찾은 스윙 순번**임을 UI 라벨·교육 아코디언에 명시(파동을 "세는 방식"의 개념만 전달).
- 검증: ZigZag 알고리즘을 3년 QQQ 데이터로 독립 재계산 → 스윙 7개(확정 6+진행 1) 산출값이 API와 완전 일치. 현재 +28.9%(2026-03-23 저점 이후).
- ⚠️ **작업 중 겪은 환경 이슈(기록)**: 세션 도중 Bash 셸의 PATH가 깨져(`grep`·`head`·`node`·`npm` 등 external binary 전부 command not found, builtin만 동작) heredoc 기반 `git commit -m "$(cat <<'EOF'...)"`이 **조용히 실패**(빈 메시지로 커밋 시도 → husky pre-commit spawn 에러) → **배포는 성공했는데 정작 새 코드가 반영 안 된 상태로 나갈 뻔함**. 해결: `export PATH="/c/Program Files/Git/usr/bin:...:/c/Program Files/nodejs:$PATH"`로 표준 경로 명시 복구 + 커밋 메시지는 Write 도구로 파일 작성 후 `git commit -F`. **교훈: 배포 후 반드시 `git log --oneline -1`로 실제 커밋된 코드가 나갔는지 확인할 것** — "vercel 배포 성공"이 "내가 방금 짠 코드가 배포됨"을 보장하지 않는다(선행 커밋 실패 시 이전 상태가 재배포될 수 있음).

## 🌊 레이 달리오 매크로 사이클 분석 페이지 (2026-07-02) — 투자 리서치 탭

사용자 요청(제미나이 설계안 참고). 정적 교육/사용자입력 계산기 대신 **앱 원칙(Zero-Input·실데이터·SSOT)으로 승격**.
- **`/api/dalio-cycle`**(공개·24h): FRED 직접 fetch(**GFDEGDQ188S** 부채/GDP·**TDSP** 가계DSR·**DFII10** 실질금리·**WALCL** Fed BS·**T10Y2Y** 수익률곡선·**M2SL** pc1) — 전 시리즈 실측 검증 완료.
  - ① **부채 사이클 6단계 현재위치 자동 추정**: 각 지표의 국면 lean(early/late/stimulus) 조합으로 stageIndex 산출. ⚠️ '단정' 아니라 근거 지표 5개와 함께 '추정'으로 제시(제1원칙).
  - ② **버블 7지표**: 정량 가능(완화통화=실질금리·신용팽창=부채/GDP·유동성=M2)은 실데이터, 투기열풍=칵테일 파티 지수(재사용)·밸류에이션=역DCF/PSR로 안내(link).
  - ③ **역사 오버레이**: 같은 지표를 현재 vs 2008 vs 2020 FRED 실측 병렬(부채/GDP 123% now vs 73%(2008) = 1.7배).
  - ④ **All Weather**: 계절=`getCurrentSeason` SSOT(4계절 내비게이터와 동일값) + Yahoo `range=max` 월봉으로 SPY/TLT/IEF/GLD/DBC 20년 백테스트. 검증: 2008 AW +3%(SPY −17.8% 방어!) / 2020 +13.5% / **2022 −8.3%(금리쇼크로 채권+주식 동반하락=All Weather 실패)** — 강점·약점 정직 노출.
- **`RayDalioAnalysis.tsx`**: INTRO 라이브보드 + 4섹션 + "달리오 정적(All Weather) vs 우리 동적(4계절·퀀트빌더)" 비교 교육. 빅사이클은 지정학 실시간 무료데이터 부재로 **교육 중심**(제국수명 SVG·3대 사이클) + 정직 캐비엇.
- ✅ **빅 사이클 국력지표 실데이터화(2026-07-02, 제미나이 지적 반영·v2→v3)**: 제미나이가 US 88/CN 78 같은 **창작 점수**를 제안했으나 제1원칙 위반이라 거부 → **World Bank 무료·무키 API**로 🇺🇸 vs 🇨🇳 5개 실측(명목GDP·수출·국방비·R&D%·인구) + 기축통화 비중(IMF COFER 공개통계 상수). 가짜 8대 배지 → 실데이터 막대 + 기축통화 골드 콜아웃 + 섹션 sticky 퀵내비. ⚠️ **공통 연도 비교 필수**: mrv=1(최신 1개)은 한쪽만 null이면 지표 드롭(미 수출 2025 null) → **두 국가 모두 값 있는 최근 공통 연도**(mrv=5)로 공정 비교. 검증(프로덕션): GDP·국방비·R&D=미국 우위, 수출·인구=중국 우위(달리오 '외부 질서 사이클'이 실데이터로). 제미나이의 슬라이더·자가진단 계산기는 Zero-Input 원칙과 충돌해 미채택.
- ⚠️ **또 next build 함정(반복)**: `{w as number >= 10}`가 SWC에서 `as`+비교 연산 충돌로 "Unexpected token, Expected jsx identifier" 파싱 에러 → **`(w as number) >= 10` 괄호 필수**. + `no-unused-vars`(spyGrowth). **`npm run check` 통과 ≠ `next build` 통과** — JSX 내 타입캐스트+연산자는 괄호로 감쌀 것. **배포 후 `git log`로 실제 커밋 확인은 물론, `next build` 로컬 선검증이 안전**(이번에 첫 배포 exit 1로 실패, 로컬 빌드로 원인 잡고 재배포).

## 🕯️ 주간 캔들 리스크 신호(장악형 패턴) — 엘리어트 파동 대신 (2026-07-01)

사용자가 엘리어트 파동(EWI) 스크린샷 제안 → 검토 후 재설계. 파동 카운팅은 분석가마다 다르게 셀 수 있는 **주관적** 기법이라 앱의 하드코딩·주관배제 원칙(제1원칙)과 충돌 → **거부**. 대신 시가·종가 대소비교뿐인 **완전 객관적** 장악형(Engulfing) 캔들 패턴만 채택 — 기존 "기술적분석(MACD·RSI) 의도적 제외" 원칙의 예외(주관 개입 0인 패턴만 허용).
- **`/api/candle-pattern`**(공개·12h 캐시): 앵커 QQQ·SPY(야후 주봉)·코스피200(네이버 주봉 069500). ⚠️ **마지막 봉은 진행 중(미완결)이라 제외**하고 완결된 최근 2주(n-3,n-2)로 베어리시/불리시 인걸핑 판정(prevBull&curBear&curO≥prevC&curC≤prevO, 역도 불리시).
- **`CandlePatternRisk.tsx`**: 4계절 내비게이터, 주글라르 CAPEX 추적기 다음. 리스크 배너 + 앵커별 O/C 상세 + "왜 엘리어트 파동은 안 쓰나" 교육 아코디언 + "매매 지시 아닌 보조 경고, 속임형(false signal) 흔함" 캐비엇.
- 검증: QQQ 06-22주 실측 O742.02→C706.52가 직전주(O738.10→C740.62)를 완전 감싸 실제 베어리시 인걸핑 확인(사용자 스크린샷 내용과 정확히 일치).
- ⚠️ **주 분절 조각 버그(2026-07-02 화면검증서 발견·수정, v2)**: Yahoo는 월말·분기 경계에서 **현재 주를 두 조각으로 쪼갬**(06-29+07-01, 둘 다 실시간 봉 — 06-29 종가가 736.40→725.17로 계속 변함 실측). '마지막 1개만 제거' 로직이 06-29 조각을 완결주로 오인 → 진짜 최신 완결주(06-22)의 베어리시 인걸핑이 '없음'으로 **조기 해제**됨. 수정: **이번 주 월요일(UTC) 이후 봉 전부 필터**(네이버는 주 마지막 거래일 라벨이라 같은 기준 안전). **교훈: '마지막 봉 = 진행 중 봉 1개'라는 가정은 Yahoo 주봉에서 깨진다 — 완결 여부는 개수가 아니라 날짜(이번 주 경계)로 판정할 것.**

## 🏷️ GICS 테마·섹터 배지 — AI 리밸런싱·퀀트빌더 공통 (2026-07-01)

추천/탈락 종목이 어느 섹터인지 한눈에 보이도록 두 탭에 공통 배지 신설.
- **`lib/gicsSectorMeta.ts`**(SSOT): Yahoo GICS 11섹터명 → 한글·아이콘·색(🏛️GICS 섹터 탭과 동일 아이콘 체계: ⚡🧱🏗️🛒🥫💊💰💻📡🔌🏢). **`components/SectorBadge.tsx`**: 공용 배지(size sm/xs).
- **`satelliteScreener.SatelliteScore`에 `sector` 추가**: `buildSignalMetrics`가 이미 fetch하는 `assetProfile.sector` 재사용(추가 비용 0). `SAT_SCORE_KEY` v3→v4.
- **`ai-rebalance.ActionItem`·`BuyIdea`에 `sector` 추가**: 버릴것·줄일것·보강할것·위성후보 전부 `secByTicker`(이미 계산됨)·`SatelliteScore.sector`로 채움(추가 fetch 0). 캐시 v30→v31.
- 적용처: `AiRebalancePanel`(코어 편입 후보·위성 후보) · `CoreSatelliteHero`(버릴/줄일/보강 3섹션) · `QuantBuilderLab`(위성 처방전 행, unified-reco `item.sector` 재사용).
- 효과: 같은 섹터가 여러 곳(예: Technology 과다)에 몰려 있으면 학생이 배지 색만 보고 즉시 인지 — 이전엔 텍스트로만 표시되거나(리밸런싱 코어) 아예 없던(위성·버릴/줄일/보강) 곳에 시각화 추가.

## 🐛 AI 리밸런싱 검증 수정 3종 (2026-07-01)

화면 검증(사용자 스크린샷)으로 발견·수정:
- **🌊 오버라이드 배너 정직화**: 게이트(diverge+CapEx surge) 활성이나 실제 부스트된 후보 0개인데 "작동 중"이라 오도. 원인: `holdingFit` sectorFit 바닥 0.5 + 반도체=cyclical(여름 이미 0.75)이라 override 임계(fit<0.5) 미도달. → **실제 🌊 후보 있을 때만 active=true(종목명 표기), 없으면 '대기'로 고지**(반도체는 경기순환 분류로 여름 이미 우대 설명). ai-rebalance `waveOverride:{active,boosted,note}`.
- **기저효과 저PEG 가치 인플레 가드**: Micron 가치 100 + '저PEG 기저효과 의심' 동시 표기 모순. 원인: 스크리너 `pegScore=max(0,1.5−PEG×0.3)` **미캡** → PEG 0.03이 **1.49**로 가치 과대 + 기저효과 무가드. → ① 스크리너(SSOT): pegScore **상한 1.0** + `isPegBaseEffect`면 중립 0.5(다음 universe 재계산 시). ② unified-reco(v15): 기저효과 종목 **가치 상한 68** 후 통합 재계산(즉시·gap 없음). Micron 가치 100→68·통합 86→~76. ⚠️ `isPegBaseEffect` growth는 **소수**(1.0=+100%) 규약 — 퍼센트로 넘기지 말 것.
- **분산 내러티브 정직화**: 최대 섹터 61.6%→61.7%(개선 0)인데 "편중 구조 개선"이라 과칭. 원인: 규칙이 '분산 개선을 설명하라'로 무조건 개선 전제 + 핵심 대형주(SK하이닉스 35.8% 등)가 손실·최저PEG 보호로 트림 불가→회수예산 0.7%뿐. → `concImproved`(집중도 ≥1%p 감소) 판정 → 미개선 시 프롬프트·폴백 둘 다 '핵심 대형주 보호로 소폭만 조정·직접 판단'으로 정직 서술. 캐시 ai-rebalance v28→v30.

## 🌊 증거 기반 매크로 오버라이드 (2026-07-01) — 계절 역풍 vs 실제 승자 정렬

**문제(사용자 통찰):** `unified-reco`의 계절 가중(20%, `seasonScore = holdingFit×100`)이 여름(인플레)에 기술주를 깎고 에너지를 밀어주는데, 실제론 기술 +48%·에너지 −14% → **계절 축이 수익률에 역풍**. AI 리밸런싱·퀀트빌더가 이 후보를 그대로 받아 *실제 주도주를 추천에서 밀어냄*. "이대로 가이드가 맞나"라는 의구심이 코드로 입증됨.

**해결 = 제미나이 "증거 기반 오버라이드" + 자체 "신뢰도 게이트" 종합:**
- **언제(게이트):** 그 시장 계절 신뢰도 = **diverge**(섹터 성적표 `spread3m ≤ −1.5`) AND 빅테크 **CapEx surge**(주글라르 `verdict==='surge'`)일 때만. 정상 국면(aligned)에선 순수 4계절 유지(대칭적·계절 이론 존중).
- **얼마나(제미나이 공식):** 계절 불리(`fit<0.5`)·수혜섹터(`sector==='Technology'`) 종목만 `adjFit = fit + 0.5·min(1,ΔCapEx/0.5)·M_sig`로 복구. `M_sig` = Fwd EPS `accel`→1·`flat`→0.5·`decline/unknown`→0. **이익 가속 증거 없으면 복구 안 함**(무늬만 AI·역성장·거품 차단 = 반-하이프). 예: NVDA 여름 fit 0.4 + 0.5(CapEx+69%·EPS accel) = 0.9 → seasonScore 40→90.
- **반영(SSOT 1곳 → 3엔진 자동 상속):**
  - `unified-reco`(v14): `adjustedSeason()` + `🌊 CapEx 수혜(매크로 역풍 돌파)` 배지. 캐시 `season-sector-v3`·`juglar-capex-v1`을 **getCache로 읽기만**(추가 fetch·자기호출 0, cold면 오버라이드 off=안전).
  - `ai-rebalance`(v27): 후보를 unified-reco에서 받으므로 자동 반영(🌊 배지 reason 포함) + **🌊 진단 배너**(`waveOverride`) + regimeNote 보강 → "단순 4계절 가이드를 그대로 따르지 않고 실적·CapEx 증거 종목 중심으로 조정" 정직 고지.
  - `quant-builder`: unified-reco SSOT fetch라 자동 상속 — **CapEx 승자가 위성 *자격* 획득(상한 30% 불변=리스크 총량 유지).** ⚠️ 제미나이의 위성 상한 43.8% 확장은 **거부**(교육앱 AI 집중 리스크↑·반-하이프 충돌).
- **기존 가드 전부 유지:** 🔪칼날 제외·기저효과 PEG·역DCF/PEG 밸류·하이프(영업적자) — 모멘텀 틸트가 고점·거품·칼날을 사지 않게 바운드.
- ⚠️ **제미나이와 다른 판단(기록):** ① 위성 상한 확장 거부(자격만) ② 오버라이드는 diverge일 때만(상시 X) ③ 키친 재고 브레이크는 ai-rebalance 보유종목(buildSignalMetrics `inventoryBuildup`)에서 처리(unified-reco 유니버스엔 재고 데이터 없음). ④ "AI 면책권 가점"이 아니라 "증거(CapEx+EPS) 있을 때만 *잘못된 계절 페널티를 해제*" — 하드코딩 특혜 0, 신뢰도 회복 시 자동 환원.
- 검증: 게이트 현재 ON(US·KR diverge + CapEx surge +69%), 타입체크 통과. (오버라이드 효과는 로그인 필요한 unified-reco/ai-rebalance에서 NVDA류 seasonScore 복구로 나타남)

## 🌐 글로벌 비즈니스 사이클 (2026-07-03) — 투자 리서치 탭

피델리티 Global Business Cycle Update를 **OECD CLI 실데이터 자동 판정**으로 재현(제미나이의 국가 위치 하드코딩 안은 제1원칙 위반이라 거부). 설계 `docs/fidelity-cycle/plan.md`.
- **`/api/global-cycle`**(공개·24h `global-cycle-v2`): FRED `{ISO3}LOLITOAASTSAM` 13개국(US·KR·CN·JP·DE·GB·FR·IT·CA·AU·IN·BR·MX, 전부 신선 실측) → 국면 판정 + 곡선 위치 + CLI 24개월 스파크. 과반 실패 시 캐시 박제 금지
- **판정(v2)**: CLI<100·모멘텀+=회복 / ≥100·+=확장 / ≥100·−=후기 / <100·−=수축 + ⭐**과열 규칙: CLI>102면 모멘텀 +여도 후기**(피델리티 AART 공개 방법론의 Late 정의="잠재 초과 가열"). v1은 모멘텀 부호만 봐서 한국(102.6)·브라질(103.8)·멕시코·인도를 mid로 오분류 → 사용자가 피델리티 Q2 2026 공식 화면과 대조해 발견, v2로 **9/13 일치**(곡선 순서는 거의 동일: 중국→일본→미국→캐나다→인도→한국→멕시코→브라질→영국)
- **`GlobalBusinessCycle.tsx`**: 원본 스타일 S-곡선(중립 회색+수축 빨강 꼬리·상단 국면 헤더 탭·물가압력 바) + 국기 솔리드 버블(클릭 상세·펄스) + **밴드 내 균등 분산·위/아래 교차 라벨**(혼잡 겹침 해결) + 국면 성적표 + 📅 데이터 기준월 배지
- ⚠️ **정직 캐비엇**: 잔여 불일치 4개국(호주·독일·프랑스·이탈리아)은 방법론 차이 — OECD CLI는 유로존 모멘텀을 소폭 −로 읽는데 피델리티 독자 지표(고용·신용·이익·재고)는 개선으로 읽는 경계 케이스. UI에 명시
- **조사 교훈**: ① 피델리티 페이지는 JS 렌더링 SPA(curl=셸 19KB)라 직접 스크랩 불가 + 독점 리서치 복제는 ToS/IP 리스크 → **공개 방법론(백서)에서 규칙을 가져와 공개 데이터로 재현**이 정답 ② 외부 공식 차트와 어긋나면 "시점 차이"로 단정 말고 **로직 결함 가능성 먼저 검증**(이번엔 과열 미반영이 진짜 원인) ③ 검증 기법: 우리 알고리즘에 과거 CLI를 넣어 시점 스캔(재현 실험)

## 🚨 개인 빚투 레이더 (2026-07-03) — 수급 레이더 6번째 탭

개인 신용거래(빚투) 위험 교육 + 실투자 참고. 제미나이의 **슬라이더 입력·반대매매 시뮬레이터는 거부/제외**(신용잔고는 매일 공표되는 실데이터라 입력받으면 Zero-Input 위반 / 시뮬레이터는 사용자가 "학생 안 씀" 확정) → **실데이터 표시 전용**. 설계 `docs/leverage-radar/plan.md`.
- **`/api/leverage-radar`**(공개·12h `leverage-radar-v1`): 네이버 `sise_deposit.naver` 40페이지(EUC-KR TextDecoder) 파싱 → 일별 **고객예탁금·신용잔고**(억원) 800일(3.3년). 검증: 2026-07-01 예탁금 1,200,837억·신용 367,436억 = 네이버 원값 완전 일치
- **판정(결정론·절대 임계 하드코딩 없음)**: 빚투 비율(신용÷예탁금) **역사적 백분위** ≥80 위험 / ≥60 주의(+신용잔고 자체 백분위 보조). 실측 스토리: 신용잔고 38조 사상최고권(백분위 98%)인데 예탁금도 120조로 급증해 **비율은 30.6%(백분위 24%)=안정** — '절대 잔고'와 '실탄 대비 비율'을 분리해 읽는 교육 포인트가 실데이터로 살아있음
- **`LeverageRadar.tsx`**: KPI 4종(신용잔고·예탁금·비율·20일 변화) + 이중축 추이 차트(최고/최저 마킹) + 비율 추이 + **양방향 교육**(사상최고=과열·달리오 신용팽창 연결 / 급감=반대매매 청산 후 역발상 바닥 신호) + 레버리지 시뮬레이터 교차 링크
- ⚠️ 빌드 함정: `[...map.values()]`·`[...str.matchAll()]` 스프레드는 tsconfig 타깃에서 에러 → **`Array.from()`** 사용(check:build로 사전 포착)
- 💥 **반대매매 실측 추가(v2)**: 금융투자협회 FreeSIS **무인증 JSON POST**(`freesis.kofia.or.kr/meta/getMetaDataList.do`, OBJ_NM=`STATSCU0100000060BO`) → 일별 위탁매매 미수금(TMPV5)·반대매매금액(TMPV6)·비중(TMPV7), 3년이 **1콜**(천원→억 환산). 의미 검증: 2023-10-19 비중 69%·5,257억 = 영풍제지 사태 '역대 최고' 보도 일치. 스파이크 차트+역대최악 교육 앵커. 기준일이 네이버와 하루 다를 수 있어 배지에 날짜 표기

## 📉 공매도 레이더 (2026-07-03) — 빚투 경보 탭 하단

공매도(숏 베팅) 정보 추가 요청 — **Phase 0 실측으로 KR 무료 소스 부재 확정** 후 정직 구성.
- ⚠️ **KR 종목별 공매도 = 무료·무키 소스 없음(전수 실측)**: ① 네이버 공매도현황 탭 **폐지**(m.stock 페이지 soft-404, JS 번들 38개 전수 grep '공매도' 0건) ② KRX data.krx.co.kr **LOGOUT**(getJsonData·OTP CSV·쿠키 프리플라이트 전부) ③ 공매도포털 sori.krx.co.kr 폐쇄 ④ FreeSIS에 대차잔고 오브젝트 미발견(020=시총·080=거래량·090=CMA로 판독)
- ✅ **US 공매도 = Yahoo 실데이터**(FINRA 격주 공시): `defaultKeyStatistics`의 sharesShort·shortRatio(커버일수)·shortPercentOfFloat·sharesShortPriorMonth. ⚠️ **yahoo-finance2가 주식수 필드를 Date로 오변환**(epoch 오해) → `rawNum = date.getTime()/1000` 복원 필수
- **`/api/short-interest`**(auth·fp 캐시 12h + 종목별 일일 공유캐시): 보유 US 개별주식만. 신호 결정론: 🔴heavy(유통10%↑)·🟣squeeze(유통5%↑+커버5일↑)·🟠rising(전월+15%↑)·🟢calm
- **`ShortInterestRadar.tsx`**: US 테이블(잔고·전월비·유통%·커버일수·신호, hover 해석) + 🎓 KR 3대 지표 교육 카드(거래비중·순보유잔고 T+2·대차잔고 + "무료 API 부재 — KRX·MTS 직접 확인" 정직 고지). 양방향 교육(잔고↑=하락압력 & 숏커버링 급등 연료)
- 교훈: **한국 공매도 데이터는 KRX 독점 + 로그인 게이트라 무료 자동화 불가**(2023 금지 이후 네이버도 탭 제거). 참고자료의 '무료 조회 방법'도 실측 없이 믿지 말 것

### 🇰🇷 한국 공매도 실데이터 확보 (2026-07-04) — KRX 계정 로그인 로컬 러너

챗지피티/제미나이 안내를 전수 재검증하다 **진짜 경로 발견**: KRX가 공매도 통계를 **무료 회원가입 로그인** 뒤로 옮겼고(`short.krx.co.kr` 접속 시 "로그인 또는 회원가입이 필요합니다" — 기존 LOGOUT 응답의 진짜 의미), **최신 pykrx가 KRX 계정 로그인 세션(KRX_ID/KRX_PW env, 1h 만료·자동 재로그인)을 정식 구현**. 사용자 무료 계정 등록 → 실검증 성공.
- ❌ 재확인된 환각들: KRX Open API(openapi.krx.co.kr) 카탈로그 **31종 전수 열람 = 공매도 0종**(챗지피티 "2025년부터 제공" 거짓) · pykrx 익명 사용 불가(로그인 필수) · 제미나이 pykrx 예시 함수는 순매수 함수(공매도 아님)
- **`scripts/krx-short-runner.py`**(선생님 PC 전용): .env.local의 KRX_ID/PW 로드 → pykrx로 ① 시장 전체(KOSPI·KOSDAQ) 공매도 비중 Top15×2(공매도 1만주↑ 필터) ② 학생 보유 KR 종목(investments 합집합, ETF 자동 제외) 60일 거래 추이+순보유잔고 → Supabase `app_cache('krx-short-daily')` REST upsert. 실측: 시장Top 30·보유 24종목 적재 성공
- **`/api/kr-short`**(공개·읽기 전용): 러너 적재분 서빙(TTL 7일 — 주말 stale 허용, 기준일 표기). **웹앱은 KRX 계정 무접근**(토스 러너와 동일 보안 경계)
- **`ShortInterestRadar`** 확장: 🇰🇷 보유종목 테이블(당일 비중·잔고·60일 스파크, 색 기준 비중 10%↑🔴/잔고 3%↑🔴) + 🔥 시장 공매도 비중 Top12(KOSPI/KOSDAQ 토글)
- 검증(라이브): 한미반도체 비중 10.41%·잔고 6.63% / 에이피알 12.93% / 시장Top 에스원 38.26%
- ⚠️ 운영: 러너는 **선생님 PC에서 일 1회**(장 마감 후, 작업 스케줄러) — KRX 봇게이트가 데이터센터 IP를 막아 Vercel 직접 수집 불가. KRX_ID/PW는 .env.local 전용(커밋·Vercel 금지). 삼성전자 잔고 0은 공시 잔고가 실제 극소(오류 아님)

### 🇰🇷 KR 공매도 — 개인화 필터·모멘텀·기저효과 가드·자동화 (2026-07-04)
- ⭐ **미국판 동급 업그레이드**: 러너가 잔고 시계열(60일)+수량 저장 → 테이블에 **잔고 수량·잔고 20일 변화율·신호 배지** 추가(미국판 sharesShort·전월비·signal과 동형). 신호 결정론: 🔴숏과다(잔고 3%↑)·🟠숏증가(20일 +20%↑ & pct≥0.3)·🔵숏커버링(20일 −20%↓ & pct≥0.1 = 상승 압력 가능)·🟡당일집중(거래비중 10%↑)·🟢평온
- ⭐ **개인화 필터(핵심 버그 수정)**: 러너는 효율상 **전체 학생 보유 KR 합집합**을 1회 수집(공유 캐시)하는데, 초기엔 `/api/kr-short`가 필터 없이 전체를 서빙 → 학교 전체 종목 노출. **로그인 사용자 investments와 교차 필터**(service-role 조회 후 `mine.has(ticker)`)로 본인분만, 미로그인은 시장 Top만(holdings 비움). DB 실증: 이근행 21·Elena 10·김상균 8·유 1종목 — 각자 자기 종목만
- ⭐ **잔고 모멘텀 기저효과 가드**(PEG 기저효과와 동일 원리): SK하이닉스 20일 변화 +12016%는 20일 전 잔고 1,800주(0.0003%) 극소 분모發 착시 — 수학적으론 맞으나 오도. 신호 판정은 이미 `pct≥0.3` 게이트로 안전(🟢평온)하나 **숫자 색만 경고색**이라 화면 자기모순 → 잔고 <0.3%면 변화율 **회색+별표(*)** 처리(신호 게이트와 일치)+각주. 검증: KB금융 +906%*·SK 12016%* 회색 / 원익IPS −28.8% 파랑(실질) 유지
- ⭐ **작업 스케줄러 자동화**: `KRX-Short-Runner`(매일 20:00, 장마감 후) 등록 — `schtasks //Create ... cmd /c python scripts\krx-short-runner.py >> scripts\logs\krx-short.log`. PC 절전 시 다음 실행에서 최신 거래일 자동 보정(러너 내장). 로그로 성공 확인
- ⚠️ **검증 방법론**: 저장 캐시가 아니라 **KRX 재조회로 독립 검산**(원익IPS 404,583주·−28.8% 등 소수점 일치) — 파이프라인 오염 여부까지 확인. 시장 Top 저유동성 왜곡은 공매도 1만주↑ 필터 + 캐비엇

## 🏛️ 블랙록(BlackRock) 포트폴리오 트래커 (2026-07-04) — 글로벌 시총 Top10 탭

세계 1위 운용사 블랙록(래리 핑크·$12조 AUM)의 SEC 13F를 트래킹. 국민연금 트래커와 같은 '거인' 테마. 설계 `docs/blackrock-tracker/plan.md`.
- ⚠️ **핵심 함정 — "블랙록 = 시장 그 자체"**: 실측 결과 13F Top이 정확히 시총 순서(NVDA 5.88·AAPL 5.08·GOOGL 4.07·MSFT 3.84%·iShares TR 2.82%). iShares 인덱스가 시장 시총가중 복제 → "무엇을 보유하나"는 인사이트 0. **진짜 신호 = 분기별 변화(QoQ)·집중도·"패시브 지배" 교육**
- **`/api/blackrock`**(공개·`blackrock-13f-v2` 30일 캐시·maxDuration 120): **BlackRock, Inc. CIK 0002012383**(구 법인 1364742·1086364 등 2017·2024 종료·통합 — 전문검색으로 현재 본체 확정). 2분기(2026-Q1·2025-Q4) 13F 파싱(각 23MB·5만행) → nps-portfolio·shadow-13f 인프라 재사용(Node https·닫는태그 무결성). ① Top20 ② QoQ 델타(늘림/줄임/신규/청산, shadow-13f 델타 로직) ③ 섹터 집중도(Top100)
- **`BlackRockTracker.tsx`**: INTRO(시장복제 캐비엇)+Top20(시총순=복제 교육)+분기 스마트머니 무브+섹터 도넛+"13F(보유) vs 하우스뷰(전망)" 교육
- ⚠️ **발행사명 정제 버그(검증서 수정, v1→v2)**: ① SEC XML `&amp;` 미디코드로 "JOHNSON &amp; JOHNSON"·"S&P GLOBAL"이 맵 매칭 실패→기타 → `deHtml` 디코드 ② **"NETFLIX"의 'ETF' 부분문자열**이 ETF 정규식에 오매칭→넷플릭스가 ETF(자체) → `\bETF\b` 단어경계 ③ 섹터맵 42→85종목 확장 → 기타 22.9%→9.9%. 검증: J&J→헬스케어·NFLX→커뮤니케이션·MU→IT 정정, IT 37.2% 편중 선명
- ⭐ **cron 워밍**: `/api/blackrock?refresh=1` 주1회(월 21:00 UTC) — 30일 캐시라 그냥 호출론 재파싱 안 함 → refresh 파라미터로 캐시 우회 강제 재파싱(macro-ai-picks 패턴), 새 분기 13F를 캐시 만료 전 미리 갱신. 학생은 30일 캐시로 즉시 응답
- 검증(라이브): Top 비중 SEC 원본 소수점 일치 · $5.72T·4,558종목 · QoQ 늘림(XOM·반도체장비)/줄임(Intuit·Snowflake) · 45일지연·iShares포함·롱온리 정직 캐비엇
- 교훈: **대형 13F 파싱(46MB)은 30일 캐시+주1회 refresh 워밍** / **부분문자열 매칭은 단어경계 필수**(NETFLIX⊃ETF) / **SEC XML 엔티티 디코드 필수**(&amp;)

## 🏛️ 블랙록 트래커 (2026-07-04) — 글로벌 시총 Top10 탭
세계 1위 운용사 블랙록 SEC 13F(CIK 0002012383·최신 2026-Q1·$5.72조·4,558종목) — 국민연금 인프라 재사용. 설계 `docs/blackrock-tracker/plan.md`.
- ⚠️ **함정: 블랙록=시장 복제**(Top이 시총순, iShares 인덱스 지배) → "무엇을 보유"는 인사이트 0, **QoQ 변화·집중도**가 신호
- **`/api/blackrock`**(30일 캐시·`?refresh=1` 강제재파싱·주1회 cron 워밍): 2분기 13F 파싱(Node https·닫는태그검증) → Top20·QoQ 델타(늘림/줄임/신규/청산)·섹터 도넛
- ⚠️ **발행사명 정제 버그(v1→v2)**: `&amp;` 미디코드(J&J·S&P 기타분류)·**"NETFLIX"⊃"ETF" 오매칭**(단어경계 `\bETF\b`)·섹터맵 42→85(기타 22.9%→9.9%)
- 교훈: 대형 13F(46MB) = 30일캐시+주1회 refresh 워밍 / 부분문자열 매칭은 단어경계 / SEC XML 엔티티 디코드 필수

## 🚀 IPO 하이프 사이클 (2026-07-04) — 투자 리서치 탭
신규 상장주 6단계 수명주기(HYPE→REALITY→PAIN→SMART MONEY→RECOVERY→UPTREND) 곡선에 실제 상장주 자동 매핑. 제미나이의 가상 슬라이더 대신 실데이터(제1원칙).
- **`/api/ipo-cycle`**: 유명 IPO 15종 상장가·주봉으로 국면 판정(상장가 배수 게이트 — RIVN 0.14배 +116%반등=매집이지 회복 아님). ⭐ **period1/period2 정확 slice**로 티커 재사용 오염 회피(SPCX=옛 SPAC ETF, range=max 97주봉 → period1/period2로 SpaceX 5주봉 clean). SpaceX·Circle·CoreWeave 편입으로 HYPE/PAIN 채움
- **`IpoHypeCycle`**: 하이프 곡선 SVG(6색 그라디언트)+종목 노드+X축 타임테이블/Y축 PRICE+국면별 린치/달리오 대응전략
- 교훈: 신규 IPO 티커는 Yahoo range=max서 옛 동명 티커 오염 → **period1/period2로 상장일부터 정확 slice**

## 🚨 글로벌 위기 감지 레이더 (2026-07-04~05) — 투자 리서치 탭
시장 버블 4대 지표 실데이터 + 종합 Alert. 제미나이/구글의 하드코딩 숫자(41.6배 등) 대신 실계산(제1원칙).
- **4대 지표**: ① Shiller CAPE(multpl.com 41.6·평균17) ② **버핏지표**(FRED NCBEILQ027S÷GDP=218%·2000/2008/2020 과거값 실측) ③ **선행 PER**(FactSet 20.1·주의) ④ 위험프리미엄(어닝일드−10년물=−1.4%p)
- **`/api/crisis-radar`**(12h 캐시): 4지표 실측+신호등+종합 alertLevel. 각 지표 30년 역사 시계열(CAPE·PER·ERP=multpl 월별 테이블 파싱, 버핏=FRED, ERP=어닝일드−GS10)
- **`CrisisRadar`**: Alert 배너 + 반원 게이지 4개(ERP는 반전) + 종합 표 + **지표별 상세 카드**(역사 미니차트+🎓쉬운설명+과거위기칩)
- ⭐ **선행 PER FactSet 실측(2026-07-05)** — 내 오판 정정: "선행PER 무료 불가"는 틀림. **가공된 최종 수치는 무료 공개**(FactSet Earnings Insight 주간 PDF). `pdf-parse`로 "forward 12-month P/E ratio ... is 20.1" 추출. ⚠️ **Vercel은 FactSet CDN이 데이터센터 IP 차단** → **선생님 PC 로컬 러너**(`scripts/factset-forward.mjs`, `PDFParse` v2, 매주 토 21:00 작업스케줄러 `FactSet-Forward-PE`)가 PDF 파싱→`app_cache('factset-forward-pe')`, route는 읽기만(KRX·토스 러너 패턴). 결과 20.1배=구글 20.2 일치·신호 '주의'로 정정
- ⚠️ **버그 수정 이력**: multpl 스크랩 정규식 `Current[^0-9]*` → 페이지 앞쪽 '1.5' 오추출 → `is VALUE, a change` 앵커(v2). 선행/후행 PER 혼동 → 선행 primary·후행 차트 병기(차트 기준선 후행 규격 16/25)
- 교훈: **"AI가 실시간 계산 불가" ≠ "데이터 무료 없음"** — 금융사가 가공·무료 공개한 최종 수치(PDF/리포트)를 실측 채택. Vercel IP 차단 소스(FactSet·WSJ·gurufocus·macromicro)는 로컬 러너 경유

## 🏆 2026 상반기 수익률 챔피언십 (2026-07-05) — 종목 리서치 탭
4대 시장(S&P500·나스닥100·코스피·코스닥) 상반기(1~6월) 실제 수익률 랭킹 + FOMO 계산기 + 비교차트. 제미나이는 "미래 데이터 불가"라 가짜 예시만 → 오늘 7/5이라 **1~6월은 확정 과거**, 실스캔.
- **`scripts/h1-champions.mjs`**(로컬 러너): S&P500 502종(위키)·나스닥100(정적)·코스피/코스닥 시총상위 각~290(네이버) → H1 수익률 스캔(US=Yahoo period1/period2, KR=네이버 fchart) → Top10/시장 + 대장주 일별 series + 지수 4종(^GSPC·^IXIC·KOSPI·KOSDAQ) → `app_cache('h1-champions-2026')`. H1 고정 과거라 1회 스캔이면 충분(값 불변)
- **`/api/h1-champions`**(캐시 서빙 365일) + **`H1Champions.tsx`**: 시장탭 랭킹보드(메달)·FOMO 계산기(슬라이더→"1월 투자했다면")·누적수익 영역차트·4분할 비교(지수↔대장주 토글)
- 실측 1위: SanDisk +831%·삼성전기 +709%·주성엔지 +560%·Micron +292%(전부 반도체 슈퍼사이클) / 지수: 코스피 +96.7%·나스닥 +11.7%·S&P +8.6%·코스닥 −3.1%. 검증: raw=adjclose·분할없음 확인(진짜)
- ⛔ 린다 라쉬케 ADX/SMA 모드(제미나이 제안)는 거부 — 앱의 반-기술적분석 철학. 대신 "이미 급등 종목 추격 위험" 캐비엇으로 IPO 하이프 사이클 연계
- ⚠️ **빌드 함정 재발**: `Tooltip labelFormatter` 타입 에러 + **`;` 구분자로 check:build 실패를 무시하고 배포**(Vercel 빌드 실패) → 교훈: 빌드→커밋→배포는 반드시 **`&&` 체이닝**(`;` 아님)으로 실패 시 중단. check:build EXIT 확인 필수

## ⚙️ ROIC(투하자본이익률) SSOT + 빚으로 부풀린 ROE 경고 (2026-07-05)

대표님 통찰: "기업은 ROIC가 높을수록 좋다 / 본업으로 번 돈(OCF)−투자한 돈(CAPEX)=FCF." 제미나이 답변을 **코드 실측으로 검증** — FCF 주장은 사실이나(좀비타이머·버핏DCF·CUT_LOSS·배당함정 전부 `freeCashflow` 사용 확인) **ROIC는 코드에 문자 그대로 0건**이었고, 제미나이의 "ROE+순부채 가드=사실상 ROIC"는 **과장**(ROE는 분모가 자기자본뿐이라 빚으로 부풀린 효율을 못 거름).
- **진짜 ROIC 도입**: `buildSignalMetrics`(지표 SSOT)에 `roic = NOPAT(EBIT×0.79, 세율21%) ÷ 투하자본(총부채+자기자본−현금)` + `roeInflated`(ROE는 높은데 ROIC 낮음 = 부채 부풀림). **추가 fetch 0** — EBIT는 이미 받는 financials FTS 4분기 영업이익 합(`ebitTtm`), 자기자본은 이미 받는 balance-sheet FTS `stockholdersEquity` 추출, 총부채·현금은 `financialData`. 금융주는 null(부채=원재료라 무의미, 이자보상배율·좀비 가드와 동일 철학). cacheKey jarvis-metrics v12→v13
- **roeInflated 판정**: `roe≥15 & roic<12 & (roe−roic)≥8%p` — AT&T(ROE 18%/ROIC 8%·부채 $160B)만 잡고 NVDA(114%/83%·무차입)·KO(43%/19%·ROIC 자체 우수)는 제외
- **전 결정 메뉴 노출(2026-07-05, "모든 메뉴에 ROIC" 요청)** — 표시만이 아니라 **점수·비중에 반영**:
  - **🎯 종합 매수 판정**(research-verdict v3): 고ROIC≥15%=⚙️'복리 기계' 찬성 / roeInflated=⚙️'부채로 부풀린 효율(진짜 ROIC N%)' 주의(pros/cons 기존 렌더)
  - **🎯 통합 추천**(unified-reco v15→v16): 최종 12종에 buildSignalMetrics 붙여 ⚙️고ROIC 배지 + **qualityTilt로 점수 조정**(roic≥20 +3·≥15 +1.5·roeInflated −6) → `combined`→`suggestWeight`→₩비중 자동 반영. **리밸런싱(매수카드 badges 상속)·퀀트빌더(unified 상속) 자동 전파**
  - **🌟 모닝스타 별점·투자 프로필**(morningstarRating `stewardshipOf` + morningstar-rating v6·stockProfile v5): **자본배분 판정 ROIC 1순위**(빚까지 반영한 진짜 효율) — 복리기계(roic≥15 & 비부풀림)=우수 / roic<7 또는 roeInflated=미흡 / ROE는 폴백. **두 화면 동시**(제2원칙: 같은 종목=같은 별점)
- ⚠️ **미착수(정직)**: 10배거 헌터(시총·성장 중심이라 ROIC 부차) · FCF의 OCF−CAPEX 분해 화면(사용자 확정: Yahoo `freeCashflow` 완성값 유지)
- **검증(라이브)**: research-verdict T inflated✅·NVDA 복리기계·KO 우수 / stock-profile 자본배분 **T=미흡(ROE 18%→ROIC 8% 강등)·NVDA/KO=우수** — 독립 probe(7종목 US+KR)와 소수점 일치. 교훈: **ROE≫ROIC 갭 = 부채로 굴린 가짜 효율**(대표님이 걸러내려던 바로 그것)

## 🐛 AI 리밸런싱 자산군 0% 붕괴 — 가격 스로틀 시 원가 폴백 (2026-07-05)

증상: AI 리밸런싱 화면의 **자산군 구성(코어-새틀라이트)·전 분류 비중·최대 섹터 비중이 전부 0%**, PLTR 손익도 "본전 +—%"(콜드 캐시 첫 실행 12:09 AM 스크린샷).
- **원인**: ai-rebalance가 `unified-reco` 자기호출(라인 395)을 buildCoreSatellite 가격 배치(라인 502)보다 **먼저** 실행 — ROIC 도입으로 통합추천 최종 12종에 buildSignalMetrics(+FTS 24콜)를 붙인 게 **콜드 스타트 Yahoo 부하를 키워**, 이어지는 stock-price 배치가 429 스로틀 → 가격 전멸 → `mv=price×수량=0` → `total||1`로 전 비중 0%. 진단 pnl(—)도 같은 원인(가격 실패).
- **근본 수정(앱 공통 '원가 폴백' 원칙)**: `buildCoreSatellite` MV 계산에 **라이브 가격 실패 시 원가(매입가×수량) 폴백** 추가 → 스로틀이 나든 말든 `total>0` 보장, 0% 붕괴 원천 불가. ⚠️ 크립토(업비트 KRW) 원가를 market 기준으로 ×1380 하는 통화 버그 방지 위해 investments `select`에 **`currency` 추가**(라이브 경로와 동일 환산). 캐시 ai-rebalance v31→v32(0% 박제 캐시 무효화)
- 교훈: **자기호출 체인(A→B)에서 A가 외부 API 부하를 키우면 B의 같은 호스트 호출이 스로틀될 수 있다** — 표시 지표(비중·MV)는 라이브 실패에 대비해 **항상 원가 폴백**을 둘 것(pnl·평가액이 화면에서 0/—로 붕괴하면 학생 신뢰 상실). ROIC 자체는 유지(캐시 warm되면 부하 소멸)

## 🕰️ 하워드 막스 마켓 사이클 시계추 (2026-07-05) — 매크로·사이클·위기 탭

하워드 막스 철학(2차적 사고·리스크=영구손실·시계추·비효율/안전마진)을 **새 판정기 0개로 기존 SSOT 재조립**(제1·2원칙). 설계 `docs/marks-cycle/plan.md`.
- **`/api/marks-cycle`**(공개·6h `marks-cycle-v1`): 4개 기존 API 자기호출 병렬 → 각 0~100 '탐욕 온도'(100=과열/낙관·0=공포/침체) → 가중 종합. 축 실패 시 제외+가중 재정규화, 2개 미만이면 503(캐시 박제 방지)
  - 심리 0.30 = cocktail-party `partyScore`(CNN F&G) / 밸류 0.30 = crisis-radar `(danger×2+caution)/(n×2)×100` / 레버리지 0.20 = leverage-radar `current.ratioPercentile` / 신용 0.20 = macro-weather `hySpread` → `(8−hy)/5.5×100`(저스프레드=안일=탐욕)
  - 구간(막스 비대칭 스탠스): ≥75 극단낙관→🛡️방어 / 58~75 낙관→신중 / 42~58 균형→중립 / 25~42 비관→관심 / <25 극단비관→⚔️공격("남들이 팔 때 산다, 단 🔪칼날 제외")
- **`MarksCycle.tsx`**: SVG 진자 시계추(공포↔탐욕 반원, cocktail 게이지 각도 매핑 재사용) + 스탠스 카드 + 4축 분해 바(중앙=균형 마커) + **2차적 사고 박스**(1차적 표면 vs 2차적 '이미 가격에 반영됐나' 동적 대비, 역-DCF·노이즈캔슬러 연결) + 정직 캐비엇
- ⚠️ **정직 가드(막스 본인 원칙)**: "사이클은 알아도 **타이밍은 모른다**" → 예측 아닌 현재 **위치**만. 가짜 정밀 금지(정성 구간 우선). 부실채권·사모펀드는 학생 투자 대상 아님 → *원리*(안전마진·역발상)만. 리스크=변동성 아닌 **영구손실**("투매=손실 확정"). **레이 달리오 페이지(부채 사이클 메커니즘)와 상호보완**(막스=군중 심리 시계추)
- **검증(라이브)**: 4/4 축 실데이터 — 심리 32(공포)·밸류 87.5(버블 3/4)·레버리지 24·신용 95 → 종합 **60(낙관·신중)**. 검산 59.7≈60 ✓. ⭐**교육 핵심**: '밸류 극단인데 심리 공포'라는 divergence를 4축이 드러냄(단일 F&G로는 '공포=매수' 오판, 막스식 다층 읽기)
- ✅ **C. 리스크 재정의(변동성 vs 영구손실, 2026-07-05)**: `/api/permanent-loss`(auth·fp캐시) — 내 종목을 buildSignalMetrics(적자·FCF적자·좀비·ROE부풀림·재고적체)+getMoatBreach(해자붕괴) 재사용해 **🔴잘라야 할 영구손실 / 🟢견뎌야 할 변동성** 2열 분류. `PermanentLossRadar.tsx`를 막스 페이지 하단에 마운트(미로그인 graceful). 막스: "펀더멘탈 멀쩡한 하락은 견디는 것, thesis 훼손은 잘라내는 것 — 무서워서 팔면 손실 확정." 신규 판정기 0
  - ⚠️ **화면검증 수정(v1→v2)**: 떨어지는 칼날(PLTR류·급락+추세붕괴)이 '변동성 견뎌라'로 오분류돼 **무지성 물타기 유도** 위험 → `knife`면 '🔪급락·추세붕괴, thesis 재점검·물타기 금물' 노트+배지로 분리(막스 "싼 데는 이유가 있다" 원칙). 교훈: 변동성 버킷에 칼날을 태연히 넣으면 안 됨
  - ✅ **SPCX 검증(오탐 아님)**: 스페이스X 영업적자+좀비 분류를 실측 확인 — SPCX=`Space Exploration Technologies`(EQUITY·NasdaqGS·Aerospace) 실데이터, 영업이익률 −41.6%·신규상장 2분기라 이자 커버리지 음수 = 진짜 pre-profit 상태(오염 아님, 정직한 경고)
- ✅ **D. 강제 매도자 역발상 매수 창(2026-07-05)**: marks-cycle에 `opportunity` 추가(캐시 v2→v3) — 시장 공포(온도<42) + 강제청산 스파이크(leverage-radar `misu.forcedPctPercentile≥60`) 조합 → 🩸강한창/🌊공포/⚠️강제청산/닫힘 4단계 배너. 막스 4번째 기둥(남들이 팔 수밖에 없을 때 안전마진). 🔪칼날 제외·알파헌터 연결. 검증(라이브): 온도60(공포아님)+반대매매 81% → 'forced'(divergence 정확 포착)

## 📉 224일 이동평균선 — 추가 후 사용자 요청으로 삭제 (2026-07-05)

세 화면 공용 `FullCandleChart`에 224일선을 넣었으나 **사용자 요청으로 원복**. 이유: 224일 MA는 하루 변화가 (오늘−224일전)÷224로 아주 작아 **60일(3개월) 표시 구간에선 매끈한 직선처럼 보이는 게 정상**인데(급등주=우상향 직선·하락주=우하향 직선, 값도 검산 정확), 사용자 기대(출렁이는 선)와 불일치 → 전량 삭제(withMa·Candle.ma·1D 워밍업 fetch·폴리라인 모두 원복). 교훈: **긴 이평선은 짧은 표시창에선 직선처럼 보임이 수학적 정상 — 주가 추종 곡선을 원하면 짧은 이평선(60일 등)이어야.** 향후 이평선 추가 시 이 점을 먼저 설명하고 기간 선택을 받을 것.

## 🧭 섹터 로테이션 시계 (2026-07-05) — 테마·섹터 분석 그룹 첫 탭

"4계절=경제 계절·막스 시계추=시장 심리"의 하위 = **섹터 자금 순환**. 17섹터(GICS 11+테마 6)를 상대강도×모멘텀 4국면(🌱주도→🔥과열→🍂이탈→❄️태동, 시계방향)에. 설계 `docs/sector-rotation/plan.md`. 제미나이의 SMPI(수익률×per-종목 거래량속도) 거부(단위 뒤섞임) → RRG 표준 채택.
- **`/api/sector-rotation`**(공개·6h): 17개 기존 `/api/sector`(computeSector) **자기호출 집계**(새 판정기 0·섹터 탭과 동일 수익률=제2원칙). 섹터 평균수익률(동일가중, 1y는 weeks<52 신규상장 제외) → **횡단면 RRG**: rs=ret1m−평균1m·mom=ret1w−평균1w·사분면=부호조합·쏠림점수=0.6rs+0.4mom. 12개 미만 성공 시 캐시 박제 금지, 6개 미만 503
- **`SectorRotation.tsx`**: 원형 시계 SVG(4사분면·시계방향 화살표·테마는 테두리 링) + 🔥유입/❄️이탈 랭킹 + **클릭 드릴다운=기존 `SectorCanvas` 임베드**(소섹터 카드+대장주 표 재사용)
- 정직: 가격 상대강도 기준(수급의 결과=가격)·예측 아닌 현재 위치·막스 시계추와 동일 철학(과열 경계·소외+반등 기회)
- 검증(라이브): 17/17 집계 · AI바이오 주도(1M+16.8) / AI반도체 과열(월강세+주둔화 mom−7.5) / 에너지 이탈(−8.5) / 우주항공 태동(mom+7.3). rs·mom·score 검산 일치
- ✅ **소섹터 3:3 종목 보강 완료(2026-07-05)**: GICS 11 각 소섹터에 검증된 대표종목 추가(2배치 ~81종) → **30개 소섹터 완전 3:3 달성**. 기존 SectorCanvas 대장주 표에 자동 반영
  - **전수 실측 검증(제1원칙)의 효과** — 상폐/합병/티커드리프트 3종 적발·제외: **쌍용C&E**(003410, 2024 사모화 상폐)·**HD현대인프라코어**(042670, 합병)·**Barrick GOLD**(티커가 'B'로 변경돼 GOLD는 이제 'Gold.com'). 개명도 확인(휠라홀딩스→미스토홀딩스·엔씨소프트→NC·LIG넥스원→LIG디펜스앤에어로스페이스)
  - ⚠️ **한국 구조적 부재 소섹터는 정직하게 US-강세 유지**(가짜 KR 티커 안 넣음 = 제미나이 실수 반복 안 함): 에너지 E&P·유전서비스·정유단독 / 소재 광산 / 필수 담배(KT&G 1사) / 헬스 의료보험(국영) / 커뮤니 인터넷(NAVER·카카오 2사) / 유틸 수도(국영 비상장) / 부동산 인프라·물류·헬스 리츠. 각 note에 사유 명시
  - 검증(라이브 재감사): 산업재·자유소비재·헬스케어(payer제외)·IT·유틸(water제외) 등 전부 3:3 ✓

## 💰 소섹터 자금 순환 + 대표 ETF 매수제안 + 매도신호 (2026-07-05) — 섹터 드릴다운(SectorCanvas)

섹터 로테이션 시계의 하위 — **섹터 안에서 어느 소섹터로 돈이 몰려 오르나**를 짚고, **ETF로 태우거나 돈 빠지면 익절**하도록. 사용자 선호(ETF 우선·매도타이밍)를 반영. 로테이션과 동일 로직(제2원칙).
- **소섹터 RRG**(`SectorCanvas`): `d.subsectors`(각 ret1w/1m/1y)에 로테이션과 동일 공식 적용 — 소섹터 횡단면 rs=ret1m−평균·mom=ret1w−평균·사분면·쏠림점수(0.6rs+0.4mom). 신규 계산·fetch 0(기존 SectorResult 재사용)
- **UI**: ① 💰 자금흐름 배너(🔥돈몰림·상승 vs 🧊소외, 리더에 대표 ETF) ② 소섹터 카드에 국면 배지(🌱주도/🔥과열/🍂이탈/❄️태동)+쏠림 순 정렬+1위 강조 ③ **액션 행** — 주도·태동=📈ETF 분할매수 / **과열(강했으나 모멘텀 하락)=⚠️매도·익절 신호(돈 빠지기 시작)** / 이탈=🔻진입 자제
- **`sectorConfigs.SECTOR_ETF`**(신규): 소섹터→대표 ETF(미국+한국) 매핑, `etfFor(sectorKey,subKey)`(소섹터 우선→섹터 폴백). **ETF 52종 전수 실측 검증**(US 36·KR 16 — SOXX·ITA·XBI·KBWB·091160 KODEX반도체·449450 PLUS K방산 등). 없는 소섹터는 '개별종목 참고' 정직 표기
- 매도신호 근거 = **RRG '과열(weakening)' = 강세였으나 모멘텀 반전** = 클래식 분산·익절 구간. 예측 아닌 현재 국면
- 전 섹터 탭 + 로테이션 드릴다운 공통(SectorCanvas 단일 컴포넌트)
- ⚠️ **신중화 3종(2026-07-05 화면검증, 실투자 핵심 기능이라 이중 가드)**:
  - **① 절대 상승 게이트(보수)**: RRG 상대강도만으론 섹터 전체 하락 시 '덜 빠진' 소섹터에 매수신호(원전·SMR 1M−8.2%인데 분할매수) → **매수 = 상대강세(주도·태동) AND 1주>0 AND 1개월>0**(사용자 확정 보수 기준·칼날+일시반등 이중 차단). 미달이면 '⏳ 반등 확인 후 진입'
  - **② 배너-카드 모순 차단**: 배너가 쏠림점수 1위를 무조건 '돈 몰림·상승+ETF 추천'으로 광고했는데 1위가 과열(제약·항공엔진)이면 카드는 매도신호 → 정반대 신호. **배너 주인공 = '매수 적격 1위'만**(`smBuyTop`), 없으면 "매수 적격 소섹터 없음 — 1위도 과열(익절 구간)" 정직 표시. 카드 초록 테두리·'돈 몰리는' 문구도 동일 기준
  - **③ 강조**: 매수 = 초록 박스 + ETF 배지(🇺🇸+🇰🇷 나란히) / 매도·익절 = 주황 강조 박스 + "보유 중이면 분할 익절 검토(보유 ETF 명시)"
- 교훈: **배너(요약)와 카드(상세)가 같은 데이터의 다른 기준으로 계산되면 반대 신호가 화면에 공존한다 — 요약은 반드시 상세 신호의 부분집합으로**(막스 시계추 divergence와 달리 이건 정당한 다층이 아니라 순수 모순)

## 🎯 소섹터 통합 랭킹 + 52주 신고가×국면 스캐너 (2026-07-07) — 로테이션 시계

섹터 로테이션 시계(테마·섹터 분석)에 학생이 "지금 뭘 사고 뭘 익절할지"를 등수로 보는 실전 화면 3종 추가. 전부 기존 SSOT 재사용(제2원칙).
- **`src/lib/subFlow.ts`(신설 SSOT)**: 소섹터 RRG 판정(`scoreSubFlow`) — SectorCanvas 드릴다운 카드와 sector-rotation 통합 랭킹이 **동일 로직 공유**(q·score·buy·sell·profit). 기존 SectorCanvas 인라인 로직을 lib로 승격.
- **🎯 소섹터 통합 매수/매도 랭킹**: 17섹터 전 소섹터를 스캔 → `buys`(매수 게이트 통과)·`sells`(과열) 랭킹. **점수 = 섹터 쏠림(17섹터 평균 대비) + 소섹터 쏠림(섹터 내 평균 대비) = 이중 자금 쏠림**(둘 다 %p, 합산 정당). ETF 배지·메달·클릭 드릴다운. 매도는 1년+ = 💰분할익절 / 1년− = ✂️비중축소 분기.
- **🔥 52주 신고가 × 소섹터 국면 스캐너**("최고가는 다 같은 최고가가 아니다"): `sectorEngine`에 `hi52`(현재가÷최근52주 최고가×100, 추가 fetch 0) 추가 → 신고가 98%+ 종목을 소섹터 국면과 결합. **🌱주도=섹터 강세·신뢰 / ❄️태동=약한 무리 속 대장·품질 / 🔥과열=추격 주의**. 국면 다양성 보장(주도 10캡 + 비주도 전부 포함)으로 교육적 대조 항상 노출. 사례: BAC 신고가+은행 주도=신뢰 / KO 신고가+음식료 태동=품질대장 / ASE 1년+303%인데 태동=약한 무리 속 대장.
- **UX**: 로드 시 자금 유입 1위 섹터 드릴다운 자동 표시(클릭 몰라도 상세가 보임) + "🔥 유입 1위 기본 표시" 배지 + 클릭 안내. 랭킹 점수에 "점" 단위 + "수익률 아님" 명시.
- ⚠️ **자동차 배너 자기모순 수정(smBotOut)**: 자유소비재에서 자동차(1주+·1개월−)가 상대강도 꼴찌라 점수 최하위(소외·이탈)인 동시에 유일한 매수 적격(돈 몰림) → 한 배너에 정반대. 소외·이탈 주인공을 **'쏠림 최하위 중 매수 적격 아닌' 소섹터**(`smBotOut`)로 교체.
- 🐛🐛 **핵심 버그 — 로테이션 self-fetch가 옛 배포 때려 신필드(hi52) 유실**: `highs`가 항상 0. 디버그(`_dbg`)로 추적하니 rotation의 `fetch(${base}/api/sector)`가 **`base = NEXT_PUBLIC_APP_URL || origin` 경유로 hi52 필드가 없는 옛 배포 코드를 때리고 있었음**(withHi52:0, 종목 keys에 hi52 없음). buys/sells는 옛 코드에도 있던 subsectors라 정상 작동해 문제가 안 보였음. **school-league base URL 버그·macro-regime silent 오판과 동일 클래스**. → **HTTP self-fetch 제거, `computeSector` in-process 직접 호출(`loadSector`, /api/sector와 동일 `sector-v3` 캐시 공유)**로 근본 해결. 캐시 rotation v1→v8(디버깅 중 연속 버전업).
- ⚠️ **재발 방지 원칙(중요)**: **엔진(sectorEngine 등)에 새 출력 필드를 추가할 때, 그 필드를 소비하는 다른 라우트가 HTTP self-fetch로 데이터를 받으면 옛 배포/캐시를 때려 신필드가 조용히 유실될 수 있다.** self-fetch(`${base}/api/…`)보다 **in-process 직접 호출**이 안전(제2원칙 캐시 공유 + 배포 원자성). CLAUDE.md의 school-league(401)·macro-regime(silent 오판)과 같은 패턴 — 자기호출 base URL은 반복되는 함정.
- ⚠️ **캐시 버전업 연속 배포 주의**: rotation을 v3→v8로 짧은 시간에 6번 배포 → 매번 콜드 재계산(17섹터) + 브라우저/CDN 스테일로, 화면검증 스크린샷이 배포 과도기 상태(보험 '비중축소' vs API '익절')를 찍음. **캐시 키 버전업은 꼭 필요할 때만**(추세속도 맵 v6→v10 교훈 재확인).
- **이수페타시스(007660) 추가**(같은 날): MLB 고다층 PCB 대장주(엔비디아·구글 TPU 공급) → 차세대 AI반도체 material + IT hardware 두 소섹터(삼성전기와 동일 배치). 티커 실측 검증(₩101,300). 삼성전기는 기존 두 섹터에 이미 존재.
- 검증(라이브): 신고가 leading 10(BAC·JPM·Eli Lilly·GE Aerospace…)+improving 8(Linde·ASE +303%·Guardant…) · 매수 AI신약개발 +15.8 · 매도 10개 전부 익절 · 은행 소섹터 주도→태동 국면전환도 신고가 패널에 정확 반영

## 📉 기술적 차트 전용 화면 (2026-07-07) — 종목 리서치 › 기술적 차트

증권사식 기술 차트를 **가치판단+수급+계절+거시**와 나란히 놓는 실전 타점 도구. 기존 차트(FullCandleChart)는 건드리지 않고 **전용 화면 신설**(사용자 요청). 제미나이가 준 참고 JSX를 우리 원칙으로 승격.
- **`/api/tech-chart`**(공개·30분 캐시): 장기 OHLCV(일 480/주 320/월 240봉 — EMA224·구름대에 필요). KR=네이버 fchart(EUC-KR)·US=Yahoo v8. 주/월봉 진행중 트레일링 바 제거(sectorEngine 교훈).
- **`TechnicalChartPro.tsx`**: 한국식 캔들(양봉 빨강 #F0475B/음봉 파랑 #3B82F6)·**EMA 112·224**(골드/오렌지)·**일목균형표 구름대**(선행스팬 9-26-52, 26봉 미래 투영·교차점 보간·경계선)·거래량·십자선·툴팁·정배열/구름위치 상태 배지·평단선(실보유만·가중평균). **모멘텀 서브패널**(툴바 탭 MACD/RSI/Stoch/CCI 중 1개만 — 화면 간결): MACD 히스토그램·시그널선, RSI 30/70 음영, 스토캐스틱 20/80, CCI ±100. 십자선·툴팁 서브패널 연동. **추가 fetch 0**(480봉 클라 계산). 팔레트=네이비/틸/골드. 높이 동적(패널 유무).
- **`/tech-chart` 페이지**: 내 포트 종목 칩(가중평균 평단·크립토 제외·getAssetType) + 티커 검색(숫자=KR/영문=US) + 일/주/월봉 토글 + 첫 종목 자동 표시.
- **`lib/techSignals.ts`(SSOT)**: MACD(12·26·9)·RSI(14 Wilder)·스토캐스틱(14·3)·CCI(20) + `readSignals`(최근 5봉 크로스/구간 이벤트 결정론 판독). 차트 렌더링·신호 판독기 공유.
- 🧭 **`SignalReader.tsx`(신호 판독기)** — 핵심 차별점: 교과서 모멘텀 신호를 **stock-info SSOT(PEG·FCF·영업이익률·성장)와 교차검증**해 가짜 신호를 걸러냄. **AI 미사용·전부 결정론**(환각 0).
  - 판정: 🔪떨어지는칼날(과매도+영업적자) / 🚨가짜반등(매수신호+부실) / 🟢신호정합(매수신호+저평가) / ⏳조기청산주의(과매수지만 저PEG="텐배거는 과매수에서 논다"·린치) / ⚠️매도신호(매도크로스+비우량) / 〰️이벤트없음(휩쏘 경고) / ℹ️펀더無(ETF)
  - 3대 함정 교육 아코디언(횡보 휩쏘·칼날 오판·조기 청산)
- ⛔ **핵심 원칙**: 기술신호는 **이 화면 전용** — 통합추천·리밸런싱 점수에는 **절대 미반영**(앱의 "기술적분석=노이즈, 펀더멘탈 우선" 철학 유지, 이 화면만 명시적 예외). 제미나이의 막스 시계추에 RSI 반영 안(C안 거부 — 심리축은 CNN F&G SSOT, 이중계상).
- ⚠️ **신규상장/신생 종목 정직 처리**: 52봉 미만은 미래 투영폭 축소(`forwardBars` — SPCX 등 캔들이 화면 채우게). 112봉↑224봉 미만은 EMA112만 그리고 정배열/역배열 배지 생략(신생 KR ETF 0091P0·0131V0 등). 알파벳 KR ETF 코드 네이버 fchart 정상 해석.
- ⚠️ **신호 판독기 정밀화(자체 검증서 발견·수정)**: 전 학생 보유 20종 판정 재현 중 2건 결함 발견 →
  - ① **기저효과 저PEG 미포착**: 인텔리안테크(PEG 0.20·성장 427%)·에이피알(PEG 0.18·성장 171%)가 골든크로스에도 '이벤트없음'으로 샘 → **`pegBase`(isPegBaseEffect SSOT: peg<0.3 & 성장>100%)를 '가짜반등' 트리거에 추가** → 🚨가짜반등(기저효과)
  - ② **FCF적자 단독 과잉경보**: 현대차(영업 5% 흑자·캡티브금융)·ORCL(영업 36%·AI capex)이 FCF적자만으로 '가짜반등' 오탐 → **진짜 부실은 영업적자(opLoss<−10%)로 한정**, FCF적자 단독은 caveat 주석으로 완화(CashRunwayTimer 좀비가드 'ROE+ & FCF− = 좀비 아님' 철학). 칼날 판정도 opLoss 기준(FCF 오탐 제거)
  - 판정 기준=기존 SSOT와 동일(PEG 2.2=Jarvis SELL·기저효과 공식·영업적자 −10%, 제2원칙)
- **자체 검증(2026-07-07)**: 스크린샷 25종 + 자체 스크립트 26종 = **50+종 무사고**(레버리지·원자재·우선주·코스닥·해외지수·신생ETF·저가주·대형가격주·미세 데드크로스[PLTR 141 vs 142]·구름 경계[NVDA 4.8pt]). EMA·구름·MACD·RSI·CCI 전부 독립 재계산과 소수점 일치. NVDA 세 화면(신고가 과열·로테이션 이탈·기술차트 구름아래) 일관.
- ⚠️ **vercel CLI 버전 고정**: 배포 중 vercel@54.21.1 신규 릴리스로 `npm error notarget` → **`npx vercel@54.20.1`로 고정** 배포(우리 코드 무관, npm 레지스트리 전파 지연)
- ⭐ **KR 티커 검색 시 종목명 표시(2026-07-09)**: 6자리 코드로 검색하면 헤더에 코드만 떠 무슨 종목인지 모르던 문제. `techChartData.getKrName`(네이버 모바일 `basic` API `stockName`, 7일 캐시 — 기존 stock-price와 동일 소스, 제2원칙) 추가 → tech-chart 라우트가 KR일 때 `name` 반환 → 페이지가 응답 후 헤더 갱신(검색 직후 코드→종목명 교체, 내 포트 칩은 이미 이름 있어 무영향). 검증(프로덕션): 071050→한국금융지주·005930→삼성전자·000660→SK하이닉스·042660→한화오션.

## 🚦 타점 신호등 — 3대 추천 엔진에 기술 타이밍 레이어 (2026-07-08)

기술적 지표(EMA112·224·일목 구름·ATR)를 실제 종목/ETF 추천에 활용. 제미나이 안(112/224 골든크로스+구름 돌파로 비중 1.5배/0% 조정, 즉시 매도 실행)을 **거부**하고 재설계 — 핵심 철학: **"WHAT(선정)은 펀더멘탈, WHEN(타이밍)은 기술" 분리**.
- ⛔ **거부 이유**: ① 기술 상태로 비중 조작 = 점수 오염(펀더멘탈 최고 종목이 눌림목이라고 추천에서 사라짐 = 린치가 경계한 "최고의 주식 놓치기"). ② 정배열/구름은 며칠 단위로 바뀌어 점수에 넣으면 추천 리스트 휩쏘. ③ 즉시 매도 실행 = 자동매매 금지 원칙 위반.
- **`lib/techChartData.ts`(신설)**: tech-chart 캔들 수집·캐시를 lib로 추출 — 라우트·entryTiming이 **동일 캐시(`tech-chart-v1`) 공유**(제2원칙·hi52 self-fetch 함정 회피). tech-chart 라우트도 이걸 쓰게 리팩터.
- **`lib/entryTiming.ts`(신설 SSOT)**: 일봉 480봉 → EMA112·224 정배열 + 26봉 선행 일목 구름 위치 + ATR(2×) 손절선 **결정론 판정**. `timingFromCandles`(순수)·`getEntryTiming`(단일)·`getEntryTimings`(배치 동시성4). **224봉 미만(신생·미해석 ETF)은 null 정직 생략**.
  - 🟢 **진입 적기**(정배열+구름 위) / 🟡 **분할·대기**(구름 속=매물대 소화 / 정배열+구름아래=눌림목 / 역배열+구름위=전환 시도) / 🔴 **진입 유예**(역배열+구름 아래=추세 바닥)
  - `trendBreak`(역배열+구름 아래) = 보유 종목 '최후 방어선 붕괴' 경고용
- **`TimingBadge.tsx`(공용)**: compact(칩)/full(배지+가이드+ATR손절) — 4개 추천 화면 공유.
- **적용 4곳(전부 점수·순위·선정 불변)**:
  - **③ 통합추천(unified-reco v17)**: 최종 12종에 timing 부착 → UnifiedReco 카드에 full 배지. 4축 미니바·기존 배지 그대로.
  - **② AI 리밸런싱(ai-rebalance v33)**: 매수(보강) 카드 timing 상속(compact) + **매도측(버릴/줄일)에 trendBreak 시 '🚨 최후 방어선 붕괴' 근거 병기**(판정 절대 안 뒤집음 — 저점매도 강요 금지 원칙 유지, 기존 🔪칼날[단기 급락]보다 느린 장기 추세 붕괴 신호로 상호보완). NVDA/GEV는 구름 위라 trendBreak=false → 경고 안 뜸(보수적 게이트 정상).
  - **🛰️ 퀀트빌더(quant-builder v5)**: 위성 카드에 timing 상속(unified-reco에서). 코어 ETF엔 미부착(타점 대상 아님).
  - **🧭 섹터 로테이션(sector-rotation v9)**: 매수 랭킹 대표 ETF(US 우선·KR 폴백)에 compact 배지 → "돈이 몰리고(수급)+구름 위(타점)" 이중 확인. 정유·미드스트림이 수급 2위인데 XLE는 🟡눌림목 = 성급한 진입 방지.
- **검증(2026-07-08, 라이브)**: 통합추천 12종 독립 재계산 100% 일치(OXY 눌림목·TXN 매물대소화·8종 진입적기·순위 85→78 내림차순 불변·ATR손절 GS $980.06/오리온 ₩127,931 소수점 일치). PLTR 역배열+구름아래→trendBreak=true로 리밸런싱 '최후 방어선 붕괴' 정확. 로테이션 XLE 눌림목/PHO·IHI 전환시도(역배열+구름위)/ARKG 진입적기 일치.
- ⚠️ **원칙 재확인**: 기술신호는 **정보 배지일 뿐 강제 아님** · AI 미사용(결정론) · tech-chart 화면과 동일 SSOT(배지 클릭→기술차트로 눈 확인) · 자동매매 없음. 제미나이 안의 "즉시 매도 실행"·"비중 폭발"은 우리 원칙과 충돌해 배지·경고로만 수용.
- ⚠️ **빌드 함정(재확인)**: `[...map.values()]` 스프레드는 tsconfig 타깃에서 TS2802 → **`Array.from(map.values())`**. tsc가 잡아줘서 사전 수정(check→build→커밋→배포 `&&` 체이닝 준수).

## 📋 실전 매매 3종 세트 — 플랜 카드·타점 워처·현금 밴드 (2026-07-09)

타점 신호등(WHEN)에 이어 "몇 주를(HOW MUCH)·기다리던 신호가 왔는지(ALERT)"까지 매매 전 주기 완성. 제미나이의 리스크 패리티 안을 '매매 1건 단위'로 실전화(가상 슬라이더·SMPI·하드코딩 3:3표는 거부 — 기존에 실데이터로 이미 있음).
- **① 📋 매매 플랜 카드(`TradePlanCard.tsx`)** — **통합추천 탭 전용**(리밸런싱·퀀트빌더엔 신호등 배지만, 플랜은 신규 매수의 홈에만):
  - **1% 리스크 룰**: 수량 = (포트폴리오 × 리스크 0.5/1/2%) ÷ (진입가 − ATR손절가). 변동성 큰 종목은 자동으로 적게 = **매매 단위 리스크 패리티**(BAC 91주 ↔ AMAT 2주, 같은 33만원 리스크). US는 `/api/exchange-rate` 1회 공유 fetch.
  - **분할 3단계(신호등 연동)**: 🟢 1/3→눌림(구름상단)→반등확인 / 🟡 절반+구름상단 돌파 확인 후 / 🔴 유예. **2R·3R 익절 참고선**(손익비 1:2 교육).
  - `entryTiming`에 price·cloudTop·atr 추가(unified-reco v18). 옛 캐시는 `timing.price != null` 가드로 안전.
  - ⚠️ **검증서 잡은 엣지 3건**: ⓐ 수량 ≤3주면 '1/3(0주)' 어색 → "1주씩 분할"(0주면 소수점매매·관망 안내) ⓑ 급등주는 구름상단 < ATR손절선 → 눌림 기준 `max(구름상단, 손절선)` 클램프(손절 아래 물타기 차단, 라벨 '손절 참고선 위 되돌림') ⓒ **저변동주 갭 리스크** — 1%룰은 손절가 체결을 가정하는데 갭 하락은 건너뜀·저변동주일수록 명목 비중 폭증(BAC 24%) → 명목 15% 초과 시 상한 권장 경고.
  - 검증: 12종 전수 수식(주당리스크·수량·금액·포트%·2R/3R) 독립 재계산 소수점 일치.
- **② 🔔 타점 전환 워처** — `/api/cron/timing-watch`(매일 08:30 KST=미 마감 후·한국 개장 전): 전 학생 보유 KR/US 종목(크립토 제외) 신호등 스캔 → 전일 스냅(`timing-watch-latest`) 대비 전환 감지 → `timing-watch-changes` 적재. `/api/timing-watch`(auth)가 **본인 보유만 필터**(kr-short 개인화 패턴). `TimingWatchBanner`가 대시보드 최상단(마켓 카탈리스트 아래)에 — **변화 없으면 렌더 0**(조용). 첫 실행 67종 스캔·63종 판정(4종 신생 null 정직). 첫날은 베이스라인, 알림은 익일부터.
- **③ 💰 막스 시계추 권장 현금 밴드** — 4축 실데이터 온도 → 결정론 밴드(75+=30~40% 방어 / 58~75=20~30% / 42~58=15~25% / 25~42=10~20% / 25↓=10~15% 공격 투입). 제미나이의 감정 슬라이더 조작 시뮬은 Zero-Input 위반으로 거부, 실온도 번역만.
- 🎨 **로테이션 시계 전면 리디자인(2026-07-08~09)**: 라벨 텍스트→**다크 캡슐 필**(폭 추정+국면색 테두리+선택 시 색반전) · 좌우 자동 플립+**전역 충돌 해소**(좌/우 그룹이 달라도 가로 겹침을 세로로 분리 — 우주방산↔AI반도체 가림 수정) · 사분면 코너 라디얼 틴트·점 글로우·코너 칩 최상위 레이어 · **축 라벨을 프레임 밖으로**(Y: 모멘텀(1주 페이스) ▲가속/▼둔화, X: 상대강도(17섹터 평균 대비 1개월 수익률) ◀약함/강함▶ — 초록=좋은 방향). 교훈: 산점도 라벨은 같은 쪽 그룹별 세로 분산만으론 부족 — **플립으로 그룹이 갈리면 전역 가로겹침 패스 필수**.

## 🧭 통합추천 × 섹터 로테이션 틸트 연결 (2026-07-09)

사용자 통찰("주도주가 바뀌는 장인데 통합추천에 로테이션이 반영되나?")로 확인된 구조적 틈 — 통합추천 4축(계절20·가치30·수급20·모멘텀30)에 **섹터 단위 자금 회전**이 직접 안 들어가 있었음(종목 단위 모멘텀 30%가 간접 대리, wave override는 기술 섹터 한정).
- **설계 결정: 5번째 가중축 ❌ → 제한된 틸트(±4) + 배지 ✅**(qualityTilt/ROIC와 동일 패턴). 이유: 섹터 국면은 rs/mom 부호로 며칠 만에 뒤집혀 축으로 넣으면 **추천 리스트 휩쏘** + 기존 4축 희석. 틸트는 "WHAT은 펀더멘탈" 우선순위 유지하며 동점권에서만 주도/이탈 섹터를 가름.
- **구현**(unified-reco v19): `sector-rotation-v9` 캐시 최근 3일 **읽기만**(콜드면 틸트 0 graceful — 17섹터 재계산 촉발 금지). Yahoo GICS 섹터명→로테이션 키 매핑(**GICS 11만** — 테마 6은 종목 중복 소속이라 제외). 틸트: 🌱주도 +4 / ❄️태동 +2 / 🔥과열 −1 / 🍂이탈 −3. **선정(step ⑤) 전 반영** → 주도 섹터 종목이 컷라인·동점권에서 앞섬. 🧭 국면 배지 + `rotationQuad`/`rotationTilt` 필드 노출. selectionRule에 틸트 명시.
- ⚠️ **기저효과 재계산 경로 틸트 유지**: step ⑥ 기저효과 가드가 combined를 원시 4축에서 재계산하는데 초판은 틸트가 조용히 유실 → `+ t.rotTilt` 포함(qualityTilt는 그 뒤 가감이라 무관).
- 검증(라이브 2026-07-09): 로테이션 국면이 사용자 판단과 일치 — **IT lagging(−3)·헬스케어/금융/산업재 leading(+4)** = 주도주 교체 국면을 틸트가 정확히 반영(최대 7점 스윙).
- 리밸런싱·퀀트빌더는 unified-reco 후보를 그대로 받으므로 **자동 상속**.

## 📊 최일 가치분석 PER 밴드 차트 (2026-07-09)

리서치 최일 탭 부제에 'PER밴드(준비 중)'라고만 있고 실체가 없던 것을 사용자가 발견("실제로 PER 밴드는 어디에 있는거야?") → 정직하게 "없음"을 인정하고 실제 구현. **신규 백엔드 0** — 기존 `/api/lynch-earnings-tracer`(연도별 EPS·연평균 주가·실제 PER, 48h 캐시) 재사용(제2원칙).
- **`PerBandChart.tsx`**: 역사적 흑자 연도 실제 PER의 **분위수 5선**(최저/25%/중앙/75%/최고, 파랑→빨강 점선) × 각 연도 EPS = 밴드 + 연평균 주가(흰 굵은 선) 오버레이. 마지막 구간은 최신 EPS 평행 연장+현재가(증권사 방식). 현재 PER의 밴드 위치 판정 배너(저평가권/중앙아래/중앙위/고평가권 + 해석).
- **마운트**: `ChoiValuationPanel` [5.5단](적정주가 산출 다음) → `/valuation` 메뉴·리서치 최일 탭 동시 반영(SSOT).
- **정직 가드**: PER 표본 <3개년이면 생략 사유 표시(적자·신생) · 적자 연도 밴드 공백 · **시클리컬 저PER 함정 캐비엇**("밴드 하단≠매수 신호") · 금융주·지주사 부적합(P/B·NAV) · "표본 적어 통계 아닌 역사적 참고 구간" 명시.
- **검증(화면+독립 재계산)**: 한국금융지주 4.1~4.8x·현재 6.8 고평가권 / NVDA 51.5~210.7x·현재 67.2 **저평가권**(역사 중앙 89x 아래) / KO 22.9~28.0x·27.1 고평가권(75%선 26.5 초과 경계 정확) / 삼성전자 7.7~32.5x·42.4 고평가권(**사이클 저점 EPS 착시** — 캐비엇의 실사례) / 표본 2개 종목은 정직 생략 작동. 밴드 가격 레벨(EPS×분위수)도 화면과 재계산 일치.
- 교육 대조: 삼성전자(저점 EPS→고PER 착시)와 NVDA(절대 PER 높아도 자기 역사 대비 싸게 거래)가 한 화면 구성으로 "PER은 맥락"임을 가르침. NVDA 밴드 저평가권 ↔ 로테이션 IT 이탈은 모순 아닌 다른 축(역사 배수 vs 자금 흐름).
- ⚠️ **전 학생 67종 전수검증 + 보완 2건(같은 날)**: 밴드 25·정직 생략 28·ETF 가드 9·신생 5·**에러 0**. SK하이닉스 생략 원인 = DART 확정 3개년 중 2023 메모리 적자 → 흑자 PER 표본 2개(정상 동작). 검증이 잡은 이슈 → ① **턴어라운드 밴드 왜곡**(HD현대중공업 26.8~427배 — 이익 미미 연도의 극단 PER 혼입): 밴드 폭 8배+ 경고 배너. **제외가 아닌 경고**인 이유 = PLTR(152~206배)류 정당한 고배수 성장주 보존. + 현재 PER 100배+(두산에너빌 554배) 스토리 프리미엄 주석 ② **금융주·지주사 판정 모순**(삼성생명 현재 28배 vs 밴드 7~11배에 '고평가권 추격매수 주의') → isFinancialCompany/isHoldingCompany 감지 시 판정 배너를 P/B·NAV 캐비엇으로 교체(차트는 참고 유지). 교훈: **PER 극단값은 '비쌌다'가 아니라 '이익이 없었다'의 흔적** — 밴드·분위수 계산에 턴어라운드 연도가 섞이면 상단 밴드가 배수가 아닌 이익 부재의 기록이 된다(기저효과 가드 패턴의 PER 밴드 버전).
- ⚠️ **최종 화면검증 보완 2건(같은 날)**: ① HD현대중공업 427배 왜곡 밴드가 Y축을 지배해 주가·하단 밴드가 바닥에 깔림(경고 "상단 신뢰 말라"와 차트가 모순) → **왜곡 밴드(최저의 8배 초과)는 차트·범례에서 생략**(수치는 헤더에 유지) ② **20년 EPS 시뮬 CAGR null 모순**(밴드와 무관, 검증 중 발견): simData 라인은 폴백 10/15%로 그리고 tenBaggerPoints 판정은 폴백 0% → "단기CAGR(?%) 도달불가"인데 파란 선은 17년차 10배 돌파하는 화면 모순. → CAGR 산출 불가 시나리오는 **라인·범례 생략** + 푸터를 '도달 불가'(성장률 알지만 미달)/'CAGR 산출 불가'(확정 실적 부족) 분리. 교훈: **같은 null을 두 곳에서 다른 폴백(15% vs 0%)으로 해석하면 화면 모순이 된다** — 폴백도 제2원칙(단일 해석) 대상.

## 🏠 부동산 인텔리전스 Phase 0~1 (2026-07-11) — 포트폴리오 3번째 축 신설

주식·코인에 이은 대형 신규 섹션 — **사이드바 '🏠 부동산' 독립 그룹**(주황) + `/real-estate`. 기획: 주식 프레임(사이클·밸류·수급·심리 4축)을 부동산 언어로 번역(벌집순환모형=로테이션 시계 / 미분양=재고 적체 / 전세가율·PIR=밸류). 전체 설계 `docs/real-estate/plan.md`(5단계)·`context-notes.md`(실측 판정표)·`checklist.md`.
- **Phase 0 — 데이터 전수 실측**: ⭐ **한은 ECOS가 부동산 통계 허브**(KB 매매/전세지수·부동산원 실거래지수·미분양·기준금리·주담대를 전부 재배포 — 개별 기관 API 불필요). 키 3종 검증: ECOS(즉시발급)·data.go.kr(실거래 상세 — **키 발급과 별개로 API별 '활용신청' 필수**, 401의 전형 원인)·R-ONE(정식 주소 www.reb.or.kr/r-one — 옛 r-one.co.kr은 죽음. 심리지수 15년 이력·주간 매매지수·행정구역별 거래량 테이블 ID 발견). Vercel env 3종 등록.
- **Phase 1 — 시장 대시보드**(`/api/re-market` 12h 캐시·`lib/ecos.ts` 공용 fetcher): KPI 4종(기준금리 2.5%·주담대 4.32%·KB 아파트 YoY +3.4%·미분양 65,239호=2007~ 백분위 56%) + 4패널 — ①KB 매매/전세 × 기준금리("금리는 중력") ②실거래가격지수 전국/서울/수도권(호가 아닌 체결가·전환점 민감) ③미분양=재고 적체 레이더(백분위) ④케이스실러×모기지(글로벌 축). 검증: 2022 금리 급등기(1.75→3.5%) 매매지수 110.8→104.2 하락 — 역사 정합.
- ⚠️ **ECOS 항목코드 함정(실측으로 발견·수정)**: 매매지수(901Y062)는 P63 계열인데 **전세지수(901Y063)는 P64 계열** — 같은 코드로 호출하면 조용히 null. 통계코드마다 StatisticItemList 실측 필수. 캐시 re-market-v2.
- 정직 캐비엇: 지수=표본조사·실거래 신고 ~30일 지연·지역 편차·매수 추천 아닌 위치 관측. 다음: Phase 2 벌집순환모형(R-ONE 거래량×가격) → Phase 3 단지 리서치(RTMS 실거래) → Phase 4 포트폴리오 통합.
- **Phase 2 — 🐝 벌집순환모형**(`/api/re-honeycomb` 24h 캐시·`lib/rone.ts`·`/real-estate/honeycomb`): 전국+17시도의 가격(3개월 변화, ±0.3% 보합밴드) × 거래량(3개월합 YoY)으로 고전 6국면(②호황→③침체진입→④침체→⑤불황→⑥회복진입→①회복, 시계방향) 자동 판정 — 부동산판 로테이션 시계. 6구역 셰이딩 산점도 + 지역 클릭 24개월 궤적 + 국면 카드/테이블. 첫 판정: 전국 호황(가격+0.6%·거래+5.5%) vs **서울 침체진입(가격+2%·거래 −6.9% = 상투 경계)** vs 지방 회복기 다수 — 지역 분화가 실데이터로 드러남.
- ⚠️ **R-ONE 함정 2건(실측 발견·수정)**: ① **시도 CLS 코드가 통계표마다 다름**(가격 서울=500008 vs 거래량 서울=500002 — 같다고 가정하면 조용히 엉뚱한 지역 조인) → 테이블별 맵 분리(lib/rone) ② **거래현황은 월별 2행**(동(호)수 100001 + 면적 100002 천㎡) — 미필터 시 면적이 호수를 덮어써 서울 3개월 '1,669호'(실은 면적 합) 오염 → ITM_ID 필터 후 22,900호 수동 검산 일치(캐시 v2). 교훈: **R-ONE은 CLS(지역)·ITM(항목) 두 축 모두 테이블별 실측 필수** — ECOS P63/P64 함정의 R-ONE 버전. + route 상수 export 금지 재확인(HC_PHASES).
- ⭐ **육각형 벌집 시계(사용자 "벌집모형이 아닌데?")**: 초판 산점도는 정량 좌표(RRG식)라 고전 육각형이 아님 → 육각형 다이어그램 신설(꼭짓점=6국면 시계방향·변 화살표·꼭짓점 밖 지역명 배치·선택 지역 24개월 국면 전이 궤적을 꼭짓점 경로로[과거=안쪽 반경 오프셋]). 산점도는 '정밀 지도'로 유지(궤적 12개월 제한 — 저기저 YoY 스파이크가 우측 끝에 붙던 노이즈 해소). 검증: 서울 전이 경로 6회(호황→회복→호황→침체진입) 독립 재계산 일치. 화면검증 수정 3건: 🇰🇷전국 마커가 지역명 가림→목록 칩 통합 / '현재' 라벨을 마커 아래·안쪽으로 / 지역명 스택을 중심 반대 방향 확장. 정밀 지도 궤적은 제거(저기저 YoY 클램핑 아티팩트 — 여정은 육각형 담당·역할 분담).
- **Phase 3 — 🔍 아파트 단지 리서치**(`/api/re-apt`·`lib/rtms.ts`·`/real-estate/apt`): 국토부 RTMS 실거래(호가 아님) — 지역(큐레이션 시군구 46곳) 24개월 수집(과거월 불변이라 월 캐시 30일·해제거래 cdealType 제외) → 단지 랭킹(매매 건수 Top40) → 면적대(±2㎡) 월 중위 매매/전세 + 개별 거래 산점 차트. **밸류 3축 = ①전세가율(6개월 중위·사용가치 비율) ②고점 대비(역대 최고 실거래) ③지역 벌집 국면(re-honeycomb 캐시 연동)** + 주담대(re-market 연동) — 부동산 3개 화면이 SSOT로 맞물림. PIR은 무료 소득 데이터 부재로 정직 보류. 검증(라이브): 강남 도곡렉슬 60㎡ — 매매 중위 27.9억/전세 10억=전세가율 35.8%(강남 저전세가율 현실 정합)·고점 31.7억 대비 −12%·서울 침체진입 연동·최근 거래 2026-07-08까지 수신. ⚠️ **동(洞) 그룹핑 결함(사용자 '송파 대림' 발견·수정)**: 단지명만 그룹핑해 가락동 대림(15.8억)과 오금동 대림(23억)이 병합 — 같은 달 13억·24.6억이 한 차트에. `umdNm` 파싱 → 그룹 키='법정동+단지명'(월 캐시 v2). 표본 불변식 검증(노원·분당·해운대) 통과·전세가율 지역 정합(강남 30<노원 47<해운대 50%). ⚠️ 운영: data.go.kr 개발키 일 1,000회 제한(지역 첫 로드 96콜 — 전 지역 일괄 워밍 불가, 과거월 30일 캐시로 완화)·전월세 테이블 단지명 표기 차이로 전세 조인 빈 단지는 null 정직 표시. ⭐ **단지 검색**(사용자 '오금동 대림이 목록에 없다'): Top40(매매 건수순) 밖 단지 접근 불가 → API `apt` 파라미터 부분일치 해석(공백 무시·정확 일치 우선·거래 많은 순) + UI 검색창·검색 단지 칩. 검증: '오금동 대림'/'오금동대림'→오금동 대림(23.3억), '대림'→거래 최다 가락동 대림.
- **🗺️ 서울 자치구 평당가 히트맵**(`/api/re-map`·`SeoulAptMap.tsx`·`public/geo/seoul-gu.json` 25개구 경계): 구별 최근 3개월 매매 ㎡당 중위가×3.3=평당가 색칠(react-simple-maps 재사용) + 호버 평당가 + 클릭=단지 리서치 로드 + 순위. **캐시 전용 설계**(외부 콜 0 — data.go.kr 한도 보호): 이미 수집된 구만 색칠, 미수집=회색·클릭 시 수집 후 자동 색칠(수집될수록 지도가 채워지는 구조). 단지별 핀은 좌표 지오코딩 키 필요라 정직 보류. 검증: 강남 1.2억>송파 0.8>노원 0.35(현실 서열 정합·839~1542건 표본). ⚠️ **Next.js Data Cache가 supabase GET fetch를 박제(진범·중요 함정)**: 첫 배포에서 강남만 색칠 — 캐시 행은 전부 존재·신선한데 라우트 내 supabase-js 조회만 옛 상태(3개 구)를 계속 반환. 디버깅 여정: ①로컬 재현 9/9 정상 ②prod REST 직접 fetch 200 정상 ③중복 행 없음 ④per-key getCache→in() 일괄로 재작성해도 '첫 실행 시점 상태'에 고정. **진범 = Next.js가 라우트 핸들러 안의 GET fetch(supabase-js 내부 포함)를 Data Cache에 저장 — `dynamic='force-dynamic'`이어도 첫 응답이 박제돼 이후 호출·재배포까지 그 시점 데이터를 서빙**(빈 응답이 박제되면 getCache가 영원히 null = '일부 키만 되는' 미스터리의 정체). 수정: `createClient(..., { global: { fetch: (u,o)=>fetch(u,{...o,cache:'no-store'}) } })`로 no-store 강제 → 즉시 8개 구 정상. 교훈: **App Router 라우트에서 supabase/외부 GET이 '옛 데이터에 고정'되면 Next Data Cache부터 의심 — DB·동시성·RLS보다 먼저**. (in() 일괄 쿼리 재설계 자체는 75회 개별 조회보다 옳아서 유지).

## 🫧 부동산 심화 게이지 3종 (2026-07-11) — /real-estate 하단

사용자 공부 폴더(최일CFA/부동산관련 72파일) 전수 검토 → 3건 선별 구현(전부 라이브 실데이터·`/api/re-gauge` 24h 캐시·부분실패 캐시 박제 금지).
- **① 적정성 게이지(주금공 2016 방법론)**: 거품 = 가격 − 근본가치(전세÷주담대 금리). KB 서울아파트 매매(901Y062 P63ACA) vs 근본가치(전세 901Y063 P64ACA ÷ 121Y006), 2004-01=100 재기준 269개월. ⚠️ 보고서 자체 비판(기준시점 민감) 수용 → 절대 괴리가 아닌 **역사 백분위 판정**(≥85 과열/≥65 상단/≤20 하단). 검증: 괴리 −28.6% = 266.2/372.9 검산 일치·백분위 60%=중립.
- **② M2 vs 서울아파트(1986~)**: M2 구계열(101Y004 BBHA00, 1986~2003.9)을 **2003.10 겹침 비율로 신계열(161Y006)에 접합** → 484개월. 1986=100 재기준 로그축. 검증: M2 102.9배(43조→4,400조 정합)·아파트 8.6배(KB 12.07→104 정합). ⚠️ ECOS M2는 신·구 계열 분리(101Y=구·161Y=신) — 구계열만 쓰면 2003년에 끊김.
- **③ 매매수급지수(부동산원 R-ONE A_2024_00076·ITM 100001)**: 부동산판 공포탐욕(100=균형). 전국/서울/수도권/지방권 101개월. ⚠️ 수급 테이블 시도 CLS는 가격 테이블과 동일 체계(서울 500008) — 거래량 테이블(500002)과는 다름(CLS 테이블별 실측 원칙 재확인). 검증: 서울 110.2(매도자 우위) vs 지방 93(매수자 우위) = 원본 API 일치.
- 폴더 검토 판정: KB xlsx 30개=ECOS 라이브로 대체(불채택)·실거래 2006~23 xlsb=정적 스냅샷이라 보류·2040 서울플랜 등 정책 문서=교육 큐레이션 옵션.
- **🏙️ 2040 서울플랜 교육 페이지**(`/real-estate/plan2040`·사이드바 부동산 그룹): 최상위 법정계획을 학습용 큐레이션 — 미래상·**중심지 체계(3도심·7광역중심·12지역중심, 서울시 공식 페이지 실측)**·7대 목표(공식 문구+투자 관점 번역)·'계획≠확정 사업·선반영·미시 검증 병행' 3대 캐비엇. **중심지 카드 클릭 → `/real-estate/apt?lawd=` 딥링크**(AptResearch `initialLawd` prop + useSearchParams Suspense — 검증: ?lawd=11170→용산구 자동 선택). ⭐ **공간구조 지도**(`SeoulPlanMap.tsx`): 25구 GeoJSON(SeoulAptMap과 공유) 위에 3도심(🔴10px)·7광역중심(🔵6px)·12지역중심(⚪3.5px) 마커를 근사 좌표로 배치(react-simple-maps Marker, onClick은 `<g>`에 — Marker는 coordinates·children만 받음). 마커 클릭=단지 리서치 딥링크. 검증: 22개 마커 전부 서울 경계 내(isPointInFill), 강남→강남구·잠실→송파구·서울도심→종로구 등 구 정합, 창동·상계만 도봉↔노원 걸침이라 노원 상계 쪽으로 미세조정(딥링크 lawd 일치). 정적 정책 참조 데이터(하드코딩 허용 범주·출처 명시). + 적정성 차트 괴리(%)를 우측 축으로 분리(좌축 지수 스케일에 눌려 안 보이던 화면검증 수정). ⭐ **원본 공식 도면 전량 수록(사용자 '원본 맵을 전부 담아라')**: 서울시 도시계획포털 정적 이미지(`/static/image/new/sub_13_*.png`)를 발견해 `public/plan2040/`에 수록(12장·1.3MB) — 종합 공간구조도(map-master)·4대 주제도(중심지 체계/광역교통축/산업경제축/공원녹지수변축)·7대 목표 일러스트 7장(각 목표 카드 상단). 흰 배경 도면이라 img에 background:#fff. 검증: 프로덕션 12/12 로드 성공. 교훈: **JS 렌더링 SPA도 도면류는 정적 /static 이미지로 서빙되는 경우가 많다 — 페이지 HTML에서 img src 패턴(sub_XX_NNN)을 찾으면 원본 확보 가능**(공공 정책 홍보물·출처 명시).

## 🔄 비트코인 4년 사이클 내비게이터 (2026-07-11) — 코인 랩 ₿ 뷰

'비트코인 사이클' 포스터(반감기 4국면: 제1상승→제2상승→침체→상승준비) 검토 후 2건 채택 — 기존 반감기 게이지·레인보우와 중복 없는 부분만(신규 소스 0·Yahoo BTC-USD range=max 재사용).
- **① 국면 이름표**: 반감기(2024-04-20) 후 경과일 → 사이클 연차(0~3) → 4국면 결정론 판정. 4국면 필+📍지금 여기+국면별 과거 연도(2016~2027). 현재 = **3년차 침체기(Bear)** — 우리 실측(BTC 1Y −38%·알트시즌 '비트 우위 피신'·스테이블 도미넌스 13.5% 공포권)과 정합. "하락을 공포가 아니라 사이클의 자리로 읽는 훈련" 프레임.
- **② 사이클 오버레이**: 2016·2020·2024 사이클을 반감기가=100으로 정규화해 겹침(x=반감기 후 개월·0.5개월 버킷·로그축) + 현재 위치 세로선. 현재 0.95×(반감기 가격 아래!) @26.5개월.
- ⚠️ **정점 36개월 한정(검산서 발견·수정, v13)**: 초판은 2020 사이클 정점이 46개월(=다음 반감기 직전 2024-03 랠리)로 잡혀 "과거 고점은 12~18개월" 설명과 화면 모순 → 정점 집계를 36개월 이내로 한정(곡선은 전 구간 유지). 수정 후 정점 = 2016 17개월·24.6× / 2020 17개월·6.7× / 2024 15개월·1.7× — **3사이클 모두 12~18개월 창에 정렬 + 정점 배수가 24.6→6.7→1.7×로 체감**(사이클 수확 체감의 실측 — ETF 시대 사이클 약화 반론의 근거이기도).
- 정직 캐비엇: 표본 3개=통계 아님·ETF 시대 사이클 단축/소멸 반론·매수 신호 아닌 위치 관측·코인 ≤5% 가드 유지. coin-lab 캐시 v11→v13.
- ⭐ **원본 포스터 정렬로 재구성(v14, 사용자 피드백 "원본은 4개 그래프·국면 가독성")**: 반감기 정렬 → **침체기 시작(반감기+약 2년) 정렬**로 변경 — 사이클 4개(2014·2018·2022·2026 시작, Yahoo BTC 2014-09~라 확보) + 차트에 **4색 국면 밴드**(ReferenceArea: 침체 파랑 0~12개월→준비·승부구간 보라 12~24→제1상승 초록 24~36→제2상승 노랑 36~48) + 국면 필 순서도 원본대로. 검증: 정점이 전부 제2상승기 밴드 안(36·39·37.5개월 — 36개월 캡 자연 소멸), 배수 체감 44.2→8.7→5.9×, 현재 = 흰 선이 침체 밴드 2.5개월차·0.87×. 교훈: **오버레이 정렬 기준(반감기 vs 침체기 시작)이 바뀌면 '정점 위치' 서사가 달라진다** — 원본 그림을 재현할 땐 정렬 기준부터 맞출 것.
- ⭐ **달력 연도 정렬로 최종 교정(v15, 사용자 "원본은 침체기 후반인데 우리는 초입 — 뭐가 맞나?")**: 실제 역사로 판정 — 고점이 2017-12·2021-11이라 침체는 **연초부터** 시작 = 원본(달력 연도)이 맞고 '반감기+2년' 근사는 침체 시작을 4~6개월 늦게 잡음 → **침체 연도 1/1 정렬**(2014·2018·2022·2026). 현재 = 침체기 6.5개월차(중반, 원본 인식과 일치)·0.82×. 국면 판정도 `mNow÷12`로 차트 밴드와 통일(제2원칙). 밴드 fillOpacity 0.07→0.18+경계 점선(색 구분 지적). 검증: 정점 전부 제2상승기 밴드(47·45·42개월)·배수 체감 41.8→6.0→3.0×·2014 선은 9개월부터(야후 2014-09 한계, 각주 명시). 교훈: **근사 상수(반감기+2년)보다 실제 사건 날짜(고점 직후 침체)가 기준 — "뭐가 맞나"는 역사로 판정한다.** + 침체기 밴드 라벨이 현재 세로선(6.5개월)과 겹쳐 첫 밴드만 insideTopLeft 정렬(화면검증 수정).

## 🧠 AI반도체 섹터 HBM 밸류체인 12종 보강 (2026-07-11)

사용자 공유 moomoo/SEMIVISION 'HBM Supercycle' 밸류체인 맵과 기존 `ai-semi`(36종) 대조 → 빈 층위 편입(config만·엔진 무수정·**티커 12종 전수 실측 후 편입**):
- **장비(본딩·씨닝·CMP)**: KLIC(본더)·ASMPT(0522.HK — **QMarket에 HK 신설**+🇭🇰)·시바우라(6590.T)·**Disco(6146.T 다이싱·씨닝 1위)**·도쿄세이미츠(7729.T)·Ebara(6361.T CMP·다각화)·ACMR(세정·중국 노출)
- **습식 소재(반복매출 소모품)**: Resonac(4004.T — HBM NCF·CMP 슬러리)·Fujibo(3104.T CMP 패드)·SKC(011790 유리기판)
- **설계(EDA)**: Cadence·Synopsys — "모든 AI 칩의 설계 도구"
- ⛔ **의도적 제외(무늬만 위험)**: Toray·Fujifilm·DuPont·Dow·한화(다각화 대기업 — LG이노텍 교훈), GOOGL/MSFT 등(수요처 — 반도체 아님)
- 검증(라이브): 12/12 주봉 106개·스파크 정상, HK 경로(yahoo 필드) 작동. **고수익 4종 분할왜곡 스팟체크**(Resonac +355% raw≈adj·분할 0 등) — HBM 밸류체인이 실제로 1년 +200~350% 랠리(포스터의 '돈이 흐르는 길목'이 실측으로 확인). sector-v3 캐시 키(종목수+지문)라 자동 무효화 → 로테이션 시계·신고가 스캐너·드릴다운 자동 반영.
- 교육 포인트: 포스터=WHAT(밸류체인 지도), 우리 엔진=WHEN·밸류(기저효과·재고적체·과열 경고) — 소재주까지 순환매가 번진 것 자체가 사이클 후반 신호일 수 있음.

## 🎼 린다 라쉬케 3박자 판독 (2026-07-12) — 기술차트 신호 판독기

라쉬케 매매법(유튜브 분석 기반)을 결정론 모듈로 이식 — 기술차트 화면 전용 원칙 유지(점수·추천 절대 미반영). `techSignals.readRaschke`(SSOT) + SignalReader 카드.
- **매수 3박자**: ① MACD 방향 = 영선 아래 골든크로스(15봉 내) → 영선 돌파 + 히스토 3봉 확대 ② RSI 에너지 = 30/70이 아닌 **50선 돌파**(10봉 내)+현재 50 위 ③ 거래량 = 신호봉 ≥1.5×20봉 평균(무거래량 데이터=null 정직)
- **연쇄 4단계 진행바**: CCI −100 탈출(선행 신호탄) → RSI 50 돌파 → MACD 영선 돌파 → **첫 눌림목**(영선 돌파 20봉 내 + MACD>0 유지 + 히스토 2봉 축소 + 10봉 고점 대비 2~8% 되돌림 = 라쉬케 최적 타점). 현재 단계 📍 하이라이트
- **매도 2신호**: 하락 다이버전스(60봉 내 스윙 고점 2개 — 가격 고점↑ & RSI 고점 2p↓·직전 RSI>60 게이트) / MACD 데드크로스+RSI 70 하향이탈 동시(각 5봉)
- 차트: MACD 서브패널 '0 영선'·RSI '50 라쉬케선' 핑크 강조. 홀리그레일(ADX+되돌림)은 기존 ADX 칩·신호등 눌림목이 동일 철학이라 중복 구현 안 함. 터틀수프(가짜 돌파 역이용)는 💧유동성 스윕이 이미 동일 개념
- 검증(8종 실데이터·독립 재계산 8/8 ✅): NVDA stage2(영선 아래 GX 2봉+RSI 50 돌파 — 전환 시도) / 삼성전자·SK하이닉스 **하락 다이버전스 감지**(가격 신고점 vs RSI 77.7→62.5·81.7→68.1 — 신고가권 에너지 소진, 시장 정합) / KO 다이버전스+RSI 58 / 에코프로비엠 stage1. 화면 렌더 = 스크립트 값 완전 일치
- 활용 가이드(카드에 내장): 3/3 완성이어도 추격 대신 첫 눌림목 대기 · 매도신호는 분할 익절 검토(가치판단과 함께) · 손절은 ATR 참고선 연동
- ⚠️ **눌림목(stage4) '3박자 0/3' 모순 수정(사용자 IBB 발견)**: 3박자는 '최근 10~15봉 갓 발생 크로스'를 세는데 눌림목은 20봉 창 → **최적 타점(눌림목)에 도달하면 돌파가 15봉 넘게 지나 3박자가 자동 0/3**이 되는 시간창 불일치. "첫 눌림목(최적 타점) + 3박자 0/3"이 한 카드에 공존. 수정: ① 눌림목 게이트에 **RSI>50 필수 추가**(에너지 소진이면 진입 자리 아님) ② stage4 체크리스트를 **'갓 나온 크로스'→'추세 유지 3요소'(MACD>0·RSI>50·2~8% 되돌림)**로 전환, '3박자 N/3' 표기 제거 ③ **급등(수직) 함정 경고**(직전 30봉 EMA20 대비 25%+ 이격 이력 시 '홀리그레일은 건강한 추세 전제, 첫 눌림목도 함정 가능'). 검증(IBB 실데이터): stage4·MACD+6.68·RSI64·3.5% 되돌림·급등아님 → '추세 확립 첫 눌림목'으로 일관 표시(0/3 사라짐). 교훈: **연쇄 단계(눌림목)와 순간 신호(갓 크로스)는 시간창이 달라 같은 카드에 섞으면 모순 — 단계별로 측정 관점을 바꿔야**
- ⚠️ **연쇄 차트 마커(사용자 "판독기는 연쇄를 보여주는데 차트엔 표시가 없다")**: 판독기 연쇄바(CCI→RSI50→영선→첫눌림목)가 *차트 어디서* 일어났는지 봉 위치 마커로. `techSignals.raschkeSequenceMarks`(SSOT·차트전용) — 각 이벤트 봉 인덱스 탐색. **핵심 함정: readRaschke의 barsAgo는 10~15봉 단창이라 성숙한 눌림목에선 옛 이벤트를 못 잡음** → 긴 창 탐색이 필요. 단 무제한 lastUp은 **과거 완료 연쇄를 현재로 오인**(NVDA stage2인데 4월의 옛 영선·눌림목 마킹) → **recency 창(CCI/RSI50 30봉·영선 40봉) + stage 게이트(s≤stage만 표시)**로 현재 진행 연쇄만. TechnicalChartPro에 🎼라쉬케 토글+봉 아래 번호핀(①②③④·현재 단계 📍 글로우)+범례. 검증: IBB stage4=CCI 06-03→RSI50 06-11→영선 06-15→눌림목 07-10(0봉전, 판독기와 정확 일치)·NVDA stage2=CCI+RSI50만(옛 연쇄 억제)·005930 stage1=CCI만·MPC stage3=CCI→RSI50→영선. 교훈: **시퀀스 마커는 recency 창+상태 게이트로 '현재 진행 중'만 — 무제한 역탐색은 옛 완료 시퀀스를 현재로 오인한다.** ⚠️ **겹침 정리(화면검증)**: 500봉이라 봉 간격 ~2px → 며칠 차 마커가 가로로 붙어 유동성 라벨과도 겹침 → ① **번호핀 세로 사다리 배치**(각 봉 아래 +18+k×15px) ② **텍스트는 현재 단계(📍)만**(범례가 ①②③④ 설명·나머지는 숫자 핀만) ③ **💧유동성 토글 기본 OFF**(사용자 '차트가 어지럽다·중요한 것만'). 스크린샷 5종 stage 재검증: NVDA 2·원익IPS 1·KB금융 3·XBI 4·IBB 4 = 마커 수와 정확 일치.

## 🎼 라쉬케 실사용 적용 — 추천 2곳(매수 타이밍·매도 조기경보) (2026-07-12)

라쉬케 판독기를 기술차트 전용에서 **실제 매수 추천·매도 진단에 활용**. 사용자 확정: 두 곳만(중복·부적합 제외). ⛔ **점수·선정·정렬 절대 불변** — 배지·경보로만(타점 신호등과 동일 원칙).
- **설계 판단**: 이미 타점 신호등(entryTiming: EMA112·224+구름+ATR)이 4곳에 배지로 있음 → 라쉬케는 **중복 없는 고유 가치**에만 적용. entryTiming=구조(추세 건강한가)·느림 / 라쉬케=모멘텀 연쇄(추세가 도는 순간)·첫눌림목·RSI50 에너지·**하락 다이버전스(entryTiming엔 없는 조기 익절 경보)**.
- **구현 = entryTiming에 `RaschkeLite` 부착(추가 fetch 0)**: `timingFromCandles`가 같은 캔들로 `readRaschke(D)` 호출 → `raschke{stage·pullback·pullbackPct·parabolicRun·bearDiv+RSI값}`. 224봉 이상이라 항상 산출. 4곳 전부 자동 상속(EntryTiming 필드라).
- **① 매수 — 통합추천 매매 플랜 카드(`TradePlanCard`)**: 분할 3단계 아래에 🎼 연쇄 stage 트리거 — stage0 대기 / 1 CCI신호탄(RSI50 확인) / 2 RSI50돌파(MACD영선 대기) / 3 영선돌파(첫눌림목 대기) / 4 첫눌림목(1차 진입 적기, 급등이면 함정 경고). "신호등=구조, 라쉬케=모멘텀 순간, 둘 다 초록일 때 최강" 명시(두 축 모순 오해 방지). unified-reco 캐시 v19→v20.
- **② 매도 — AI 리밸런싱 익절 카드**: 익절(TAKE_PROFIT) 종목에 라쉬케 **하락 다이버전스** 근거 병기("주가 신고점↑ vs RSI N→M↓ 에너지 소진, 분할 익절 조기 타이밍") — 기존 `trendBreak`(최후 방어선 붕괴=늦은 신호)보다 이른 top 경보. `tag==='익절'`일 때만(손절/트림 노이즈 방지). ai-rebalance 캐시 v33→v34.
- **의도적 제외**: 퀀트빌더(백지 자산배분=타이밍 아님)·섹터로테이션(ETF 모멘텀 노이즈+RRG·신호등 이미 있음).
- **검증**: 전 보유 70종 라쉬케 전수 자체검증(66판정·불변식 위반 0·에러 0, stage4 5종 전부 RSI>50 게이트 통과) + entryTiming.raschke 부착 실측(IBB green+stage4 3.5%눌림목·NVDA yellow+stage2·삼성전자 다이버전스 RSI77.7→62.5·MPC/GEV green+stage3).
- ⚠️ **연쇄 자기모순 수정(화면검증)**: 매매 플랜 카드에서 **신호등 🟢 진입적기인데 라쉬케 stage 0~1 → '연쇄 대기·관망'** 표기가 공존(BAC·LRCX·KLAC·JPM). 원인=연쇄(0→4)는 **바닥 반전 시퀀스 탐지**라 이미 상승 추세 자리잡은 종목은 오래전 돌파해 stage 낮음('관망' 아님). **신호등 상태로 프레임 분기**: 🟢 stage<4 = '추세 이미 진행 중 — 연쇄 트리거 불필요, 첫 눌림목 시 추가진입'(관망 워딩 제거) / 🟢 stage4 = '첫 눌림목 추가진입(불타기) 적기' / 🟡🔴 = 연쇄 stage 그대로(바닥 반전 시퀀스가 진짜 유용한 국면). IBB '0/3' 버그와 동일 클래스(연쇄 단계는 국면 맞는 곳에서만 유효). 클라 전용 수정(캐시 무관). 
- ⚠️ **발견성 수정(사용자 '화면에서 못 찾겠다')**: 라쉬케를 매매 플랜 카드(**접힌 버튼**) 안에만 넣어 겉면에서 안 보임 → 실사용 안 됨. **TimingBadge(신호등 라인) 겉면에 🎼 칩 노출** — 모든 추천 카드에 상태별: 🎼 첫 눌림목(타점, green)/추세 진행중(green 확립, muted grey — 중복 주장 안 함)/RSI50 돌파·CCI 신호탄·영선 돌파(yellow·red 미확립). 상세 가이드는 매매 플랜 안 유지. 교훈: **기능을 접힌 서브패널에만 넣으면 실사용 0 — 행동 가치 있는 요약은 카드 겉면에.** **2차(사용자 '아직도 펼쳐야 보인다')**: 칩만으론 회색 '추세 진행중'(green 다수)이 눈에 안 띔 → **행동 가치 있는 라쉬케(첫눌림목·RSI50돌파·CCI신호탄·영선돌파)는 TimingBadge 풀 변형에 1줄 설명까지 겉면 노출**(펼침 불필요). green '추세 진행중'은 칩만(비행동=클러터 방지). 사용자 확정. 검증: NH투자증권/OXY/SK이노=RSI50/CCI 1줄·IBB=첫눌림목 3.5% 1줄·green 8종=칩만.

## 💵 FCF 반영 강화 — 수익률 등급제·이익-현금 괴리·버블/하락장 방어 틸트 (2026-07-12)

대표님 통찰("FCF는 버블·하락장에서 특히 중요"). 내부 검토 결과 **FCF가 부호만(흑자 1.0/적자 0.3) 얕게 반영**되고 있었음 — 스크리너 점수의 10%(통합점수 실효 ~3%)·모를 땐 흑자 가정(관대)·**FCF 수익률(주가 대비 현금)·이익-현금 괴리는 랭킹에 전무**(fcfYield는 LynchValuationEngine 하드코딩 데모값만). 사용자 확정: 수익률 등급제+괴리 배지+국면 틸트.
- **① FCF 수익률 등급제**(`macroPhaseScreener.screenOne`): `fcfScore = 부호만` → **FCF 수익률(FCF/시총) 연속 등급**(≥5%→1.0·3~5→0.85·1~3→0.65·0~1→0.45). 비중 10% 유지(가중치 불변). 효과: NVDA 0.9%·GOOGL 0.6%→0.45(비쌈=저FCF수익률 반영), 삼성 3.6%·COP 4%→0.85. **부호만 보던 것을 '주가 대비 현금창출력'으로.**
- **② 이익-현금 괴리(OCF 기준)**: 영업흑자인데 **영업현금흐름(OCF)까지 적자** = 이익이 현금으로 안 들어옴(분식·버블 조기경보) → fcfScore 0.15 + ⚠️배지. ⚠️ **FCF만 적자·OCF 흑자는 CAPEX 성장(ORCL 데이터센터·OCF+32B)이라 괴리 아님**(재고적체 가드가 NVDA 램프업 제외한 것과 동일 철학) → 완화(0.4). 초판 FCF<0 기준은 ORCL 오탐 → OCF 기준으로 정교화.
- **③ 버블/하락장 국면 방어 틸트**(unified-reco): 막스 시계추 온도 **과열(≥65) OR 공포(≤32)** 국면일 때만 FCF 수익률 5%+ 가점(+3)·괴리 감점(−5)·FCF적자 −2(`getCache` 읽기만·콜드 off). "버블·하락장엔 현금이 왕" 국면 연동. 검증: 현재 온도 70(과열)→틸트 ON.
- ⚠️ **금융주 가드(검증서 오탐 발견·수정)**: 은행·보험·증권(JPMorgan·KB금융·증권사 13종)이 괴리 오탐, 한화생명 FCF수익률 260%(보험 float 왜곡) → OCF/FCF가 예금·대출·트레이딩·float으로 출렁여 무의미 → `isFinancialCompany` 가드로 FCF 지표 중립(이자보상배율·총마진 가드와 동일 패턴). 검증: 금융주 fcfYield 전부 null, 괴리 13→7종(Super Micro 회계이슈·시클리컬 저마진 등 defensible). 유니버스 v4→v6·unified-reco v20→v22.
- **추가 fetch 0**(freeCashflow·operatingCashflow·marketCap 이미 수집). DCF(버핏·모닝스타)는 별점용이라 랭킹 미연결 유지. FCF 수익률 5%+ 상위: 한국전력 22.6%·CJ제일제당 21.6%·카카오 20.1%·SK이노 19.4%.
- ⚠️ **배지 화면 노출(사용자 '반영됐는데 안 보인다')**: 점수엔 녹았으나 💵배지가 5%+에서만 떠 상위 종목(금융 null·저수익률 반도체)에 안 보임 → 통합추천에 **저FCF수익률(현금 대비 고평가↓) 배지 추가**(우수≥5%/양호3~5%/고평가<1%). AMAT·TXN 감점 근거가 화면에 드러남. unified-reco v22→v23.
- **개별종목 리서치 FCF 품질 카드(2026-07-12)**: 사용자 요청 — 리서치 워렌버핏·최일 탭에 FCF 배지. **`/api/stock-fcf`**(스크리너 screenOne과 **동일 로직·동일 금융 가드**=제2원칙, Yahoo 1콜) + **`FcfQualityCard`**: FCF수익률 등급(우수/양호/보통/고평가↓)·이익-현금 괴리(OCF)·CAPEX 성장 구분(OCF흑자·FCF적자)·금융주 중립 안내(P/B·ROE)·ETF 가드. 라이브 검증: NVDA/AMAT expensive(0.6~0.9%)·GS 금융 na·삼성 good(3.6%)·ORCL capex(OCF흑자·FCF적자)·QQQ unsupported.

## 🔥 TTM Squeeze + ⚓ Anchored VWAP + 🛡️ SuperTrend + 가치게이트 알림 체인 (2026-07-12)

"최신 트렌드 기술지표를 매수/매도 alert로" 요청 → 웹 리서치(2025~26 상위: Anchored VWAP·TTM Squeeze·RSI다이버전스·Minervini RS) + 제미나이 안(TTM+SuperTrend 알림 아키텍처) **비판적 재구성**. 우리 스택(EMA·구름·MACD·RSI·Stoch·CCI·MFI·ADX·라쉬케·유동성스윕·매물대POC·타점신호등)과 대조해 중복 제거.
- **채택/거부**: TTM Squeeze ✅(진짜 갭) / Anchored VWAP ✅(제미나이 누락·SuperTrend보다 실전 우월) / SuperTrend는 **시각 라인만**(신호 SSOT=우리 신호등·라쉬케·trendBreak라 독립 알림=중복·모순 위험) / 제미나이 "강제청산·강력매수" 톤은 **거부**(일방적 매도 금지 원칙) → "검토 권유".
- **SSOT `techSignals`**: `computeTTMSqueeze`(BB20⊂KC1.5×ATR 압축 판정 + 모멘텀 선형회귀 4색), `computeAnchoredVWAP`(직전 스윙 저점 앵커 = 기관 평균단가, 매물대POC와 상호보완), `computeSuperTrend`(ATR 트레일링·시각용). 추가 fetch 0.
- **기술차트**: 🔥스퀴즈 서브패널(ind 탭 — 모멘텀 히스토그램 4색 + 압축(빨강)/해제(초록) 점) · ⚓VWAP 라인+앵커마커+토글 · 🛡️추세선 방향전환 끊어그림 토글 · 상태배지(스퀴즈 압축N봉/분출·VWAP 위아래) · 범례·교육카드.
- **판독기**: ⚓VWAP·🔥스퀴즈 상태 배너 + **🎯 스마트 알림 체인**(가치게이트[fundGood]×변동성 상방분출 → "분할 진입 검토"·미통과 시 "추격 자제, WHAT은 펀더멘탈"). 청산은 기존 trendBreak+라쉬케 다이버전스 재사용(SuperTrend 불필요).
- ⛔ **점수·추천 절대 미반영**(차트·교육·alert 전용). 검증: 전 보유 67종 스퀴즈 ON 10종(PLUG 5봉·278470 30봉 등, ~15% 분포=정상) + VWAP/SuperTrend 불변식(VWAP∈가격범위·앵커=저점·dir∈{1,-1}) 통과. 삼성 VWAP +32%·SK +58%(대랠리로 기관평단 멀리 아래).
- 교훈: **유튜브/제미나이 '알림 아키텍처'는 좋은 뼈대(가치게이트×타이밍 체인)지만, 절반은 우리 기존 신호와 중복 — 신규 지표는 갭에만(TTM·AVWAP), 청산·추세는 기존 SSOT 재사용해 모순 방지. 강제 매매 톤은 항상 거부.**
- ⭐ **분석 렌즈(프리셋)로 클러터 해소(사용자 '지표가 너무 많아 복잡')**: 지표 8개+서브패널 7개 동시 노출 → 🔎렌즈 6종(⭐핵심=EMA·구름·매물대·MACD / 📈추세·타점=+SuperTrend·라쉬케 / 💰매물·평단=매물대·VWAP·유동성·MFI / 🔥변동성돌파=스퀴즈·VWAP·SuperTrend[신규3종] / ⚡모멘텀=라쉬케·RSI / 🔬전체). 렌즈 클릭=관련만 ON·나머지 OFF, 현재 토글 상태와 일치하는 렌즈 자동 하이라이트(activeLens). 기본=핵심 렌즈(라쉬케 기본 OFF로 깔끔 시작). 세부 토글은 미세조정용 유지(수동 조정 시 '사용자 지정'). 5종 재검증: VWAP·POC·dist%·SuperTrend 색 전부 소수점 일치.

## 📦 FVG(공정가치 갭) 결정론 오버레이 (2026-07-12) — 기술차트 전용

트레이딩뷰 커뮤니티 지표 조사 + 제미나이 5종 안 재판정 후 **1종만 채택**. SMC(LuxAlgo) 중 가장 객관적인 FVG만 결정론 구현.
- ⛔ **제미나이 5종 중 4종 거부/기구현**: Nadaraya-Watson 엔벨로프=**리페인팅**(과거 재작성·실시간 신호 사후 소멸 → 우리 룩어헤드 금지 원칙 위반)·ML KNN=**블랙박스+가짜 확률%**(제미나이 '95%' 제거 사건 반복 + 선정 게이트 = 기술 미반영 원칙 위반)·UT Bot=**SuperTrend와 ATR 트레일링 중복**·Volume Profile/유동성 스윕=**이미 구현**. FVG만 순수 산수(리페인팅·주관 0)라 채택.
- **`techSignals.detectFVG`(SSOT)**: 3봉 불균형 — 상승 갭(bull) i-1봉 고가 < i+1봉 저가 → 빈 공간 [i-1.high, i+1.low] / 하락 갭(bear) i-1봉 저가 > i+1봉 고가. 되메움(mitigation)=이후 저가/고가가 갭을 완전 관통하면 소멸 → **미충족(unfilled) 갭만** 최근순 max 6개 반환(클러터 방지). lookback 140봉.
- **`TechnicalChartPro`**: 📦FVG 토글(갭 있을 때만 노출·기본 OFF) + **'💰 매물·평단' 렌즈에 편입**(LensCfg에 fvg 추가, applyLens/curCfg/activeLens 동기화) + 반투명 존 박스(상승=라임 #a3e635 지지·하락=빨강 저항, 갭 형성 봉→우측 끝) + 범례 + 교육 카드("자석처럼 되메워지는 빈틈, 매물대·유동성 스윕과 겹치면 신뢰↑, 단독 매수 신호 아닌 되돌림 타점 후보").
- ⛔ 점수·추천 절대 미반영(차트·교육 전용). 검증: 합성 데이터 3종(상승 갭·하락 갭·되메움 제외[]) 불변식 통과 — 상승/하락 정확 탐지, 되메운 갭 제외 확인. ⭐ **가독성 3종 정리(2026-07-12, NVDA 화면검증)**: 매물·평단 렌즈 5중 오버레이로 우측 밀집 → ①갭 라벨 12px 내 근접 시 텍스트 생략(박스·선 유지, 유동성 라벨 패턴) ②`minPct=0.3` 초소형 갭(폭<0.3%) 제외(노이즈 컷) ③반환 max 6→4개. NVDA prod 501봉 재검증: 6→4개, 초소형(07-08 0.28%) 제외, 잔여 4개 폭 0.90~3.16%·bull 2/bear 2(현재가 아래 지지·위 저항).

## 📊 매물·평단(VWAP·POC·FVG·스퀴즈) 매수/매도 실사용 적용 (2026-07-12)

신규 기술지표(⚓Anchored VWAP·📊매물대POC·📦FVG·🔥TTM스퀴즈)를 라쉬케 적용 패턴 그대로 실제 매수/매도에. **신호등(추세)·라쉬케(모멘텀)가 못 보는 '매물/평단' 축**이라 중복 없음(SuperTrend는 신호등 중복이라 시각만 유지·제외).
- **`entryTiming.ts` `SupplyLite`(SSOT·추가 fetch 0)**: 같은 일봉 D에서 `computeAnchoredVWAP`+`computePOC`+`detectFVG`+`computeTTMSqueeze` 산출 → aboveVwap/vwapDistPct·abovePoc/pocDistPct·supportStrong(둘 다 위)·supportWeak(둘 다 아래)·overExtended(VWAP +15%↑ 과대이격)·fvgBuy(현재가 아래 상승 갭=되돌림 매수 존)·fvgSell(현재가 위 하락 갭=저항)·squeeze. `timingFromCandles`가 base에 supply 부착 → unified-reco·ai-rebalance·quant-builder·sector-rotation **자동 상속**.
- **매수(통합추천 매매 플랜 카드 `TradePlanCard`)**: 라쉬케 아래 '📊 매물·평단 지지' 섹션 — 지지 탄탄/약함/혼조 + ⚓기관평단·📊매물대 위아래·이격% + 📦되돌림 매수 존(FVG 지정가 후보) + 🔥스퀴즈 압축/분출.
- **매도(AI 리밸런싱 익절)**: `ai-rebalance` route가 익절(TAKE_PROFIT) 종목 reason에 ⚓기관평단 +N% 과대이격·📦머리 위 저항 갭(+N%) 병기(라쉬케 하락 다이버전스와 함께, 판정 불변·일방적 매도 강요 아님). 캐시 v34→v35.
- **발견성**: `TimingBadge` 풀 변형에 📊 지지 탄탄(cyan)/약함(orange) 칩(혼조는 생략). unified-reco 캐시 v23→v24.
- ⛔ **점수·선정·정렬 절대 불변**(배지·근거만). 검증: NVDA supply가 차트와 일치(POC 186.85 동일·VWAP 204.53·되돌림 매수 존 189.66~195.74·저항 갭 203.77~206.5), 5종목 FVG 독립 재계산 불변식 통과. ⚠️ **과대이격 분기(화면검증 수정)**: LRCX(VWAP +37.9%)·AMAT(+47.7%)가 VWAP·POC 크게 위인데 '지지 탄탄·눌림 지지 확보'로 표기 → 지지선이 38~78% 아래라 과장(모순). `supportStrong && overExtended`(VWAP≥15%)면 매수 카드·TimingBadge 칩을 **'📊 과대이격(지지선 멀다)'**로 분기(추격보다 되돌림·분할 진입). GS(+14.6%)는 '지지 탄탄' 유지. 클라 전용(캐시 무관). 교훈: **'둘 다 위=지지 탄탄'은 크게 위(과대이격)일 땐 거짓 — 지지의 '방향'뿐 아니라 '거리'까지 봐야**(신호등 green+라쉬케 관망 자기모순과 같은 클래스).

## 📊 매물대 중심선(POC) 오버레이 (2026-07-12) — 기술차트 + 신호 판독기

유튜브('수익 연구소' PnD채널=돈치안+볼륨프로파일 영상, yt-dlp 자막 전문 분석) 검토 → **1개만 선별 채택**. 유동성 헌팅 논리=💧스윕 기구현·"눌림목 후 재돌파"=라쉬케/신호등 기구현·돈치안=전고저 레벨과 중복·'태미지 승률70%' 서사와 지표 코드 복제는 거부(LuxAlgo 원칙) → 진짜 갭은 **볼륨 프로파일 POC**뿐.
- **`techSignals.computePOC`(SSOT)**: 최근 120봉 가격×거래량 히스토그램(40구간, 봉 거래량을 고~저 구간에 균등 분배=표준 근사) → POC(최대 거래 가격대)·가치영역(POC에서 양옆 큰 쪽부터 누적 70%)·above/distPct·집중도(sharePct). 무거래량(지수)·30봉 미만 정직 null.
- **기술차트**: 📊매물대 토글(기본 ON) — POC 점선(하늘 #38bdf8)+좌측 라벨+VA 연한 음영 + 툴바 상태 배지(위=수익권 다수·지지/아래=손실권·저항) + 범례 + '읽는 법' 교육 카드(거래량 가중 — 시간 가중인 일목 구름과 상호보완 명시).
- **판독기**: 정보 배너(POC 값·위/아래 %·VA 범위) — 판정 로직 미반영(스윕 배너와 동일 원칙).
- ⛔ 점수·추천 절대 미반영(차트·교육 전용) · 추가 fetch 0(캔들 재사용). 검증: 5종 불변식(POC∈120봉 고저범위·vaLow≤poc≤vaHigh·above 부호 일치) 전부 통과, SPCX(19봉) 생략.
- 교훈: **유튜브 '독점 지표'는 대부분 공개 표준(돈치안 1950s·볼륨프로파일)의 재조합 — 코드 복제 대신 공개 개념만 우리 결정론으로 재구현**(제목이 '볼린저밴드'여도 실내용은 달랐음 — 자막 확보 후 판단, yt-dlp가 도구).
- ⭐ **원본식 가로 막대(사용자 '오른쪽에 거래량 세워놓은 것처럼')**: 초판 POC 점선+VA 음영 → `PocRead.profile`(40구간 가격대별 거래량, frac=POC 대비 0~1) 추가 → **차트 우측 앵커 가로 막대**(볼륨 프로파일 표준 표시 — POC 구간 진한 파랑 0.75·가치영역 0.35·밖 회색 0.18, 최대 폭 110px) + POC 점선·좌측 라벨 유지.
- ✅ **전 보유 67종 전수검증**: 불변식 8종(POC∈120봉 고저·VA가 POC 포함·above 부호·40구간·POC구간 frac=1=최대·frac 0~1·POC∈VA) — **66 통과·위반 0·에러 0**(생략 1=SPCX 신생). 스크린샷 값 소수점 대조: 원익IPS 119,708.75(+4.4%)·KB 155,768.75·IBB 171.98·파두 49,639.38 전부 일치.

## 💧 유동성 레벨·스윕 오버레이 (2026-07-10) — 기술차트 + 신호 판독기

'New Liquidity Indicator' 조사(트레이딩뷰 LuxAlgo·Mirage / 크립토 M2 / BIS GLI 3도메인) 후 1번만 채택 — **SMC '유동성 스윕' 개념의 결정론 버전**(스크립트 복제 아님·주관 0). 크립토 M2는 코인랩에 기구현(오버레이)·BIS GLI는 분기 지연이라 기존 주간 순유동성(macro-weather)이 상위호환으로 미채택.
- **`techSignals.detectLiquidity`(SSOT)**: 스윙 피벗(좌우 5봉 극값) = 유동성 레벨(전 고점·저점 = 손절 밀집 구간) → **꼬리 관통 + 종가 회복 = 스윕**(개미 털기) / **종가 돌파 = 레벨 소멸**(진짜 돌파 — 스윕 아님). 거래량 델타(매수/매도 체결 구분)는 무료 데이터 부재 → 20봉 평균 1.5배 급증(volBoost)으로 정직 근사.
- **기술차트**: 💧유동성 토글(기본 ON) — 살아있는 레벨 점선(전저점 틸 #2dd4bf·전고점 주황 #fb923c, 최근 3개씩) + 최근 60봉 스윕 💧마커('스윕·거래량↑').
- **신호 판독기**: 최근 10봉 스윕 정보 배너 — **여정 ③ '속임수 하락'의 실측 연결**. "단독 매수 신호 아님 — 구름·추세(신호등)와 함께" 명시. 판정 로직(가짜반등 등) 미반영.
- ⛔ 거부: Mirage식 0~100점+자동 진입·익절가(가짜 정밀·단타 조장), LuxAlgo 복제(저작권). 점수·추천 절대 미반영(차트·교육 전용 원칙).
- 검증(라이브 3종 독립 재계산): NVDA 전저점 194.74 스윕(06-25 low 192.13→close 195.74)·삼성전자 전고점 스윕 2건 등 **스윕 조건 실봉 대조 전부 통과**, GS는 최근 스윕 0(정직).
- ⚠️ **라벨 declutter(화면검증 수정)**: 비슷한 가격대 레벨 라벨이 서로·스윕 텍스트·평단/ATR 라벨과 겹침(NVDA 188~195·IBB·XBI 밀집) → 선은 전부 유지, **텍스트만 Y축 12px 근접 시 생략**(평단·ATR 위치를 선점 목록에 포함, 💧 이모지는 항상 표시). 화면 정합 확인: NVDA 여정 ①②(구름 속)+스윕 배너(9봉 전 $194.74) = 차트 배지·검산 봉수와 일치, IBB 매도신호+ADX 39.8 추세장 신뢰도 문구·여정 ⑤⑥ = '구름 위' 배지와 정합.
- 📖 **범례+교육 카드(사용자 "무슨 뜻인지 모르겠다")**: 범례 3항목(전저점=손절 대기 / 전고점=익절·돌파주문 대기 / 💧스윕) + 교육 해설 그리드에 '💧 읽는 법' 카드 — 주문 뭉치=유동성, 스윕=개미 털기 흔적(여정 ③ 연결), **종가 이탈(진짜 붕괴)과 구분**, 단독 매수 신호 아님. 교훈: 새 오버레이는 범례·읽는 법 카드를 같은 커밋에 — 지표만 그리면 학생은 못 읽는다.
- ✅ **전수 검증(전 보유 67종 × 일/주/월봉 = 201케이스)**: 4대 불변식(①피벗=좌우 5봉 극값 ②최초 접촉 순서 ③스윕/소멸 조건 실봉 정합 ④살아있는 레벨 무결) 실봉 전수 대조 — **198 통과·위반 0·에러 0**(생략 3=신규상장 캔들 부족 정직 생략). 집계: 레벨 6,872·살아있는 1,653·스윕 2,223(거래량↑ 동반 709). 스윕은 일봉 1,256>주봉 719>월봉 248로 짧은 봉일수록 흔함 — "스윕은 흔한 패턴, 단독 신호 아님" 캐비엇의 정량 근거.

## 🔺 밸류 삼각형 + 🗺️ 추세의 여정 (2026-07-10) — SNS 교육 콘텐츠 검토·선별 도입

사용자가 공유한 SNS 스크린샷 5장 검토 — 모멘텀 4종 포스터(이미 7/7 구현·판독기가 상위호환)·MFI+EMA20 콤보(중복+단타 조장 우려로 미채택)는 제외, 2건만 채택(신규 판정기 0):
- **🔺 밸류 삼각형("1분 주가 계산")** — 리서치 워렌버핏 탭, StockProfileCard 아래. 항등식 **PBR = PER × ROE**(시총/자본 = 시총/순익 × 순익/자본)를 SVG 삼각형(꼭짓점=시총·자본·순이익, 변=PBR·PER·ROE)으로 실데이터 자동 채움(Zero-Input). `buildSignalMetrics`에 `equity` 노출(이미 계산하던 stockholdersEquity, 추가 fetch 0, jarvis-metrics v13→**v14**) + `/api/value-triangle` + `ValueTriangle.tsx`. 금융주는 "PBR 변이 진짜 평가축" 강조(기존 텍스트 안내를 실수치로).
  - ⚠️ **PER 앵커(자체검증 발견·수정)**: 초판은 순이익=Yahoo ROE×자본으로 도출 → NVDA 삼각형 PER 22 vs 같은 화면 상단 PER 31~45 **제2원칙 위반**(Yahoo ROE는 평균자본 기준이라 순이익 과대). → **PER을 stock-info SSOT 앵커**로: 순이익=시총÷PER(컴포넌트가 화면 PER을 prop으로 전달), ROE=순이익÷자본(도출값·푸터에 기준 명시). PER 미제공만 Yahoo ROE 폴백. 검증: NVDA PER 31=31·검산 25.11≈PBR 25.13 / 삼성전자 3.95 정확 / 삼성생명 PBR 0.75·금융주 감지 / QQQ 가드 차단.
  - 교훈: **파생 지표(순이익 도출)의 기준을 고를 땐 '앱에서 가장 많이 노출되는 지표'를 앵커로** — ROE 앵커는 항등식은 닫아도 PER이 다른 화면과 어긋난다.
- **🗺️ 추세의 여정 교육**(SignalReader) — SNS 'Journey of a Trend' 6단계를 우리 신호등 언어로 번역: ①②혼돈·매물대=🟡구름속(휩쏘 구간) / ③④속임수 하락→구조돌파=🟢구름상단 돌파(확인 후 진입 이유) / ⑤⑥추세=🟢 유지·붕괴=🔴 최후방어선. '유동성 스윕' 등 주관 해석은 객관 판정(EMA·구름)만 쓴다고 명시(엘리어트 거부와 동일 원칙).
  - ⭐ **📍 현재 위치 자동 판정(사용자 지적 "설명만 있고 이 종목이 어디인지 없다" 반영)**: `journeyStage`(순수 계산·entryTiming SSOT와 동일 공식) — 구름속=①②매물대 / 구름위+최근 12봉 내 돌파=③④직후 / 구름위 장기유지=⑤⑥진행 / 구름위·역배열=③④전환시도 / 구름아래·정배열=④문앞 눌림 / 역배열+구름아래=⑤⑥역주행(붕괴). 배너+해당 카드 "📍 지금 여기" 배지, ①~⑥ 범례 명시, 주/월봉 탭은 "일봉 기준" 안내, 251봉 미만 정직 생략. 검증 7종: GS ⑤⑥진행(=통합추천 🟢)·XLP ④문앞(=워처 🟢→🟡 눌림과 정합)·PLTR ⑤⑥역주행(=trendBreak)·삼성전자 ①②매물대·SPCX 생략 — **신호등 SSOT와 전 종목 일관**.
  - 교육 섹션 2개(3대 함정·여정)는 아코디언 제거·상시 펼침(접혀 있으면 학생이 못 봄 — 사용자 요청).
  - ⭐ **약식 판정 티어(사용자 지적: 신생 ETF가 전부 생략)**: TIGER 코리아원자력(217봉)·코리아AI전력기기(177)·1Q우주항공테크(152)가 251봉 기준에 걸려 여정 침묵 — 차트는 이미 구름+EMA112를 그리는데 불일치. **130~250봉 = 약식(구름 + 가격 vs EMA112 프록시, 기술차트 강등 규칙과 동일) + ⚠️약식 배지**, 130봉 미만만 생략(SPCX 18봉). 약식에선 '붕괴 확정' 대신 '추세 이탈' 신중 표현. 검증: 3종 모두 ⑤⑥ 역주행[약식] = 차트의 '구름 아래(약세·저항)' 배지와 정합.
  - ✅ **밸류 삼각형 전 보유 67종 전수검증**: 실주식 42종 PBR·항등식·NI/ROE 검산 전부 통과(PER앵커 35·적자 ROE폴백 6·파두 PBR 115 소자본 극단은 사실), ETF 25종 가드 차단, 에러 0.

## 🔭 20년 EPS 시뮬레이션 리디자인 — 텐배거 레이스 트랙 (2026-07-09)

사용자 피드백("차트가 뭔 소리인지 한눈에 안 와닿음") — 기존 화면 문제: ① 결론(몇 년 뒤 10배)이 차트 어디에도 없음 ② Y축이 원시 EPS(200000000 등 무의미) ③ 선형 축에서 지수 폭발로 10배 기준선이 바닥에 깔림 ④ 성장률 비슷하면 선 3개가 겹쳐 무지개 한 줄.
- **🏁 레이스 트랙(결론 우선)**: 차트보다 먼저, 시나리오 4개(장기 성장 지속/최근 1년 속도/애널리스트 추정/보수적 8%)를 가로 바 한 줄씩 — 트랙 전체=20년, 🏁=10배 도달 지점, 우측에 "약 N년 뒤 10배 🏆" 큰 글씨. 미달=빗금+"20년+ 걸림", 실적 부족="산출 불가". **애널 추정 도달연차 신규 산출**(적정주가와 동일 성장률 `analysis.cagrEps` — 제2원칙).
- **Y축 = 배수(×) 공통 언어**: 원시 EPS → 현재 EPS=1× 기준 배수. 10배 기준선이 정확히 10×에. 종목 무관 동일 축.
- **로그 축 전용(선형 토글 제거)**: 사용자 판단 채택 — 복리+배수 축에서 선형은 **수학적으로 항상** "끝에서만 폭발" 형태라 무의미. 로그에선 복리 곡선=직선(기울기=성장 속도), 10배선 교차점=도달 시점. `logScale` 상태·토글 삭제.
- 검증(독립 재계산): 652%→2년(7.52²=56배)·85.8%→4년(1.858⁴=11.9배)·8%→20년+(1.08²⁰=4.7배) 화면과 일치. 도달불가 푸터와 정합.
- ⚠️ 알려진 표시 한계(기존 설계 유지): 차트 라인은 SIM_MAX 60% 캡이라 극단 CAGR 종목은 🏁 마커(실제 성장률 기준 연차)와 라인 교차점이 어긋날 수 있음 — 마커는 기준선 위 고정(주석에 명시된 의도), 정확한 답은 레이스 트랙이 담당.

## 🧭 메뉴 대정리 — 브리핑 원페이지 + 사이드바 재그룹 (2026-07-09)

기능이 40+ 화면으로 불어나 "어디부터 어디까지 봐야 할지 모르겠다"(학생·본인 피드백)는 복잡성 문제 해소. 신규 판정기·엔진 0 — **이미 있는 기능을 결정 흐름에 맞게 재배치**한 순수 UX/정보구조 작업.

### 1단계 — 🎯 오늘의 매매 브리핑 원페이지 (`/briefing`)
매일 아침 "오늘 뭘 결정해야 하나"를 한 화면에. 5섹션 각각 독립 로딩(섹션별 `useFetch` 훅, 하나 느려도 나머지 먼저 표시) + 각 섹션 하단 딥링크로 상세 탭 연결.
- **①오늘 신호** = `/api/timing-watch`(타점 전환 워처 — 본인 보유 신호등 전환)
- **②정리할 것** = `/api/ai-rebalance` → `coreSatellite.drop/trim` 상위 4 (딥링크 → `?tab=rebalance`)
- **③담을 것** = `/api/unified-reco` 상위 5 + TimingBadge + TradePlanCard (딥링크 → `?tab=moneyflow&view=unified`)
- **④판 읽기** = `/api/sector-rotation` 유입/이탈 상위 3 + 매수 1위 ETF·타점 (딥링크 → `?tab=rotation`)
- **⑤스탠스** = `/api/marks-cycle` 온도→현금 밴드 + 계절(usSeason/krSeason) (딥링크 → `?tab=marks`)
- **대시보드 딥링크 처리**(`dashboard/page.tsx`): `?tab=`(ALLOW: rebalance/moneyflow/rotation/marks/season/quantbuilder) + `?view=`(moneyflow 서브탭: mine/market/investor/reco/unified/leverage → setFlowView). `useEffect`로 URLSearchParams 파싱해 초기 탭·서브탭 설정.
- ⚠️ **딥링크 버그 수정**: "통합추천 전체(12종)" 링크가 `?tab=moneyflow`만 있어 기본 '내 종목 수급' 서브탭으로 가던 것 → `&view=unified` 추가 + setFlowView 처리로 통합추천 서브탭 직행.

### 2단계 — 사이드바 용도별 5그룹 재편 (`Sidebar.tsx`)
도구 **종류** 기준 4그룹(MAIN/ANALYSIS/RESEARCH/SCHOOL)을 사용자 **여정** 기준 5그룹으로:
- 📌 **매일**(초록): 오늘의 매매 브리핑 · 대시보드
- 💼 **내 자산**(파랑): 자산 관리 · 거래 기록
- 🔍 **종목 확인**(노랑): 종목 리서치 · 기술적 차트 · 관심종목 · 피터린치 · 워렌버핏 · 최일 가치분석
- 🌍 **시장 탐구**(보라): 섹터 로테이션 시계 · 수급·통합추천 · AI 리밸런싱 · Macro Hub — **주력 3대 화면을 사이드바 딥링크로 승격**(`?tab=rotation` / `?tab=moneyflow&view=unified` / `?tab=rebalance`)
- 🎓 **교육·학교**(남보라): 투자 아카데미 · 최일 전략 · 스쿨 라운지 · 스쿨 리그
- **데이터 주도 단일 렌더러**: 4개 중복 `.map` 블록 → `GROUPS.map` 하나로 통합. 그룹별 `color` + `rgba()` 헬퍼로 색상 자동 적용(97줄 삽입·134줄 삭제).
- ⚠️ **쿼리 딥링크 active 판정**(핵심): 로테이션·통합추천·리밸런싱은 pathname이 전부 `/dashboard`로 동일 → 하이라이트가 겹침. href에 `?`가 있으면 **쿼리 파라미터까지 정확 일치**(`searchParams.get(k)===v`)해야 active로 판정. `/dashboard`(쿼리 없음)·`/analysis?tab=`(currentTab 매칭)은 별도 분기. `useSearchParams`는 이미 Suspense로 감쌈.
- 기존 페이지·라우트 제거 0, ADMIN·프로필/로그아웃 영역 보존.
- 검증(화면): 5그룹 순서·색상·구분선 일치 / 같은 `/dashboard` 경로 3개 중 통합추천만 하이라이트(쿼리 매칭 작동 증명) / 통합추천 딥링크가 내 종목 탭 아닌 통합추천 서브탭으로 직행.

---


## 🔔 오늘의 타점 신호 워처 확장 (2026-07-13) — 종목 타점 전환(#4) + 섹터 자금 이탈(#3)

기존 '타점 전환 워처'(신호등 EMA·구름만)를 신규 기술지표까지 스캔하는 '오늘의 매수/매도 신호'로 승격. 매일 08:30 KST 크론.
- **#4 종목 타점 전환**(`cron/timing-watch`): entryTiming SSOT에서 신호등+🎼라쉬케(첫눈림목·하락다이버전스)+🔥스퀴즈(분출)+📊매물평단(지지 전환) 압축 상태(SigState) 스냅 → 전일 대비 전환만 diff. 매수=진입적기 돌파·첫눈림목 도달·스퀴즈 상방분출·지지 전환 / 매도=최후방어선 붕괴·하락다이버전스·지지 상실·스퀴즈 하방분출. 종목당 최우선 전환 1개(매도 우선). 추가 fetch 0.
- **#3 섹터 자금 이탈**: 보유 종목 GICS 섹터(`getSector` 7일 캐시) → 로테이션 캐시 국면 매핑. 주도/태동 → 과열/이탈 전환 시 🍂 '섹터 자금 이탈' 매도알림(익절·비중축소 검토, 신규 매수는 유입 섹터 ETF 우선). 로테이션 캐시 있을 때만 동시성5. 메모리 'etf-first-sell-signal' 선호 충족.
- **`TimingWatchBanner`·브리핑 ① 오늘 신호**: 매수/매도 그룹 분리 칩(하루 1회 등장, 변화 없으면 렌더 0). ⛔ 알림만·자동주문 없음.
- ⚠️ **버그 2종 수정**: ① 첫 확장 시 예 v1 스냅(TimingLight 문자열)과 신규 SigState를 diff → `p.bearDiv`=undefined라 전 종목 '하락 다이버전스' 오탐 → 캐시 키 **v2 분리**(첫 실행=깨끗한 베이스라인)+객체 타입 방어. ② **appCache no-store 전역 수정(중요)**: baseline이 DB엔 있는데 getCache가 None — **Next Data Cache가 supabase GET을 박제**(부동산 히트맵에 이어 재발). `appCache.admin()` 클라이언트 fetch에 `cache:'no-store'` 강제 → 모든 getCache/setCache가 항상 라이브(신선도는 updated_at TTL 자체 판정). 교훈: **App Router에서 app_cache 조회가 '옆/빈 응답에 고정'되면 Next Data Cache부터 의심 — 이제 전역 차단.**
- 검증(prod): scanned 67·resolved 63, 베이스라인에 6개 신호 차원(light·rkStage·bearDiv·sqFired·support·sectorQuad) 적재 확인, 섹터 국면 40/67(improving 25·lagging 10·weakening 1·leading 4). 첫 실행=베이스라인(오탐 0), 알림은 익일 크론부터.


## ⬛ 관망(횡보) 필터 (2026-07-13) — VPF 유튜브 기법 분석 → 알맹이만 채택

'VPF(브압 압력 필터)' 유튜브(트레이딩 센세, 자막 yt-dlp 분석) 검토. 핵심 = VWAP 돌파/이탈/리테스트(이미 구현) + '회색 지대=횡보엔 진입 자제'. ⛔ 거부: ① 150만→270억 하이프 서사(지어냄) ② VPF 자작 Pine Script 비공개(구독 미끼)라 복제 불가·검증 불가 ③ OHLCV로 진짜 매수/매도 델타는 불가능(틱·호가 필요, 영상도 근사일 뿐 — MFI가 우리 정직한 근사). → **알맹이(횡보 회피)만 공개 지표 ADX로 재현.**
- **`entryTiming.supply`에 `choppy`(ADX<20=추세 없음)·`adx` 추가**(같은 캔들·추가 fetch 0). 매물·평단 최우선 상태 '⬛ 관망(횡보)' — 매수 카드(TradePlanCard)·TimingBadge 칩. "가짜 돌파 잦아 손실 최다 구간, 방향 확정 전 신규 진입 자제".
- ⚠️ **green 신호등 자기모순 차단**: green(정배열+구름위=구조적 상승추세)은 '느린 상승'이지 '방향 없는 횡보'가 아님 → **관망은 신호등 yellow·red(구조 미확립)일 때만** 표시(라쉬케 green 처리와 동일 원칙). 검증: NVDA(yellow·ADX17)=관망 표시 / GS·KO·XLU(green·ADX 11~18)=제외 / IBB(ADX39)=추세강해 제외. unified-reco v24→v25. ⛔ 점수·선정 불변(배지만).
- 교훈: 유튜브 '비밀 지표'는 대부분 하이프+비공개 미끼 — 공식은 못 봐도 자막으로 알맹이는 완전 분석되며, 진짜 가치(횡보 회피)만 공개 표준(ADX)으로 재현하면 충분.
- **발견성 보완(종목 리서치 종합 매수 판정)**: 통합추천은 green(추세) 위주라 ⬛관망이 잘 안 뜨고, 관망 종목(NVDA 등)은 보유 제외되어 통합추천서 안 보이는 발견성 갭 → `research-verdict`(v3→v4)에 `getEntryTiming` 병렬 fetch 추가, choppy 시 '⬛ 관망(횡보·ADX N)' 주의 근거 노출(보유·추천 무관 아무 종목이나 검색해 확인). green 게이트 동일. 매수 적합+관망 동시일 땐 한줄결론에 'WHAT은 좋음·WHEN은 대기' 명시(모순 오해 차단). 검증: NVDA(yellow·ADX17)=관망 근거 노출·IBB(ADX39)·GS(green)=제외. 참고로 기술차트 판독기는 이미 'ADX 추세 N 박스권' 칩으로 동일 조건 상시 노출 중(아무 종목). ⭐ **섹터 로테이션 매수 랭킹 확장(2026-07-13)**: 실전 매수 후보 랭킹은 compact TimingBadge라 관망이 안 보이던 갭 → **compact 배지에도 ⬛관망 칩 추가**(신호등 미확립·green게이트 동일). 돈 몰려도 대표 ETF 추세 강도 약하면 가짜 돌파 주의. `etfTiming.supply.choppy` 이미 적재라 클라 렌더만 수정. 퀀트빌더 위성도 자동 반영. 검증(라이브): XLE(yellow·ADX19)=⬛관망 / SOXX(green·ADX17)·XLP(green·ADX11)=green게이트로 억제 / ARKG·KBWB(green·비choppy)=표시 안함. ⚠️ **문구 리워딩(화면검증 모순 수정)**: 초판은 '추세 없는 횡보/추세 미형성'이라 써서 **같은 카드의 '🚀 주가 상승추세(50·200 정배열)'·라쉬케 '영선 돌파(추세 확정)'와 정면 모순**(NVDA·오리온). ADX는 추세 *강도*(존재 아님)라 **'⬛ 추세 강도 약함(방향 확신 낮음) — 돌파 신호도 가짜(휩쏘)일 수 있음, 확정 후 진입'**으로 전면 교체 → 상승추세·영선돌파와 상호보완(VPF '가짜 돌파 필터' 개념과 정확히 일치: 돌파 났으나 ADX 약하면 확인 후). 매수카드·TimingBadge·research-verdict(v4→v5)·oneLiner 동시. 검증: NVDA '상승추세(정배열)'+'추세 강도 약함(ADX17)' 일관·모순 문구 잔존 0. 교훈: **ADX<20을 '추세 없음/횡보'로 단정하면 MA 정배열·돌파 신호와 충돌 — '추세 강도 약함'으로 표현해야 다축 트렌드 신호와 공존한다.**


## 💰 스마트머니 수급 — 외국인 단독 압도 매수 유입 판정 (2026-07-13)

사용자 지적(파두): 외국인 +1580억으로 기관(−627)·개인(−997) 매도를 다 받아내는데 라벨이 '수급 중립'.
- **원인**: `judgeKr` INFLOW가 `dualBuy`(외인 AND 기관 *동반* 순매수)만 인정 → 외국인 단독 압도 매수는 기관이 팔면 중립으로 떨어짐(외국인 단독 확신 수급을 놓침).
- **수정**: `soloMajorBuy = !dualBuy && (외인+기관 합산 순매수>0) && 개인 순매도` 추가 → INFLOW('단독 매집', 🌍외국인/🏛️기관 매집 배지). **쌍끌이(동반)보다 신뢰도 한 단계 낮게** 캐비엇(한 주체 주도라 돌아서면 되돌림 빠름). money-flow KR v5→v6. getMoneyFlow SSOT라 통합추천 KR 수급 점수에도 자동 반영.
- **과유입 오탐 방지 검증**: 파두 → 🌍외국인 매집·INFLOW ✅ / SK하이닉스·삼성전자(외국인 대량 *매도*·개인 매수=🚨개미 독박 구조, majorsNet<0)는 정확히 **중립 유지** — '메이저가 개인 물량 받아냄(유입)'과 '메이저가 팔고 개인이 받음(개미 독박)'을 majorsNet 부호로 정확 분별. ⚠️ **매도측 대칭 보강(사용자 후속 통찰, 같은 날)**: '수급은 개미와 반대로 해석 — 외인+기관 동반 매도를 개미가 다 받아내면 중립이 아니라 하락 신호여야'. 기존 CROWDED가 **nearHigh(고점 근처)일 때만** 발동 → SK하이닉스류(고점 아님)를 중립으로 흘림. **antBag(메이저 합산 순매도+개인 순매수)이면 고점 무관 CROWDED**로 판정(매수측 soloMajorBuy와 대칭). dualSell(외인+기관 동반 매도)=강한 이탈('📉 동반 매도' 배지)·혼조(외인만 대량 매도, 기관 일부 매수)=단독 이탈 코멘트 분기. 라벨 '개미 독박·과열'→'개미 독박·이탈'. money-flow KR v6→v7. 검증: SK하이닉스(외인·기관 동반 매도)·삼성전자(외인 대량 매도 주도)=🔴CROWDED·하락신호 ✅ / 파두(외국인 단독 매집)=🟢INFLOW 유지. **최종 대칭**: 유입=메이저가 개미 물량 받음(dualBuy·soloMajorBuy) / 이탈=개미가 메이저 물량 받음(dualSell·개미독박), 중립=메이저↔개미 뚜렷한 대립 없을 때만.


## 🚦 종합 매수 판정에 기술 타이밍 배지 추가 (2026-07-13)

사용자 요청: 학생이 새 종목 검색 시 종합 매수 판정에서 **기술적 면(타이밍)도 판단**하도록. 기존엔 관망(ADX)만 근거로 썼고 AI 리밸런싱·통합추천에 붙는 신호등·라쉬케·매물평단 배지가 없었음.
- **`research-verdict`(v5→v6)**: `getEntryTiming`으로 이미 받던 `timing`(EntryTiming)을 응답에 추가 → 컴포넌트가 **AI 리밸런싱·통합추천과 동일한 `TimingBadge`** 그대로 렌더(제2원칙 — 같은 SSOT·같은 컴포넌트). 4축 바 아래 '🚦 기술적 타이밍(WHEN)' 별도 섹션.
- **표시**: 🚦 타점 신호등(진입 적기/대기/유예) + 🎼 라쉬케(첫눌림목·CCI/RSI50/영선·하락 다이버전스) + 📊 매물·평단(지지 탄탄/과대이격/약함/관망) + 손절 참고. green 게이트·과대이격·관망 리워딩 로직 전부 상속(TimingBadge 재사용이라 자동).
- **중복 제거**: 기존 관망 con(주의·리스크)은 TimingBadge 관망 칩과 중복이라 제거(oneLiner의 WHAT/WHEN 노트는 유지).
- ⛔ **점수·판정 불변** — WHAT(펀더멘탈 4축)=점수 / WHEN(기술 타이밍)=배지만(푸터 명시). 검증(라이브): NVDA(yellow·stage2·관망 ADX17)·GS(green·지지탄탄·green게이트로 관망 억제)·SK하이닉스(yellow·하락다이버전스·과대이격 ADX27) 전부 timing 실려 배지 정상 — AI 리밸런싱과 동일 표시.


## 📈 수급 차트 + 포트 스마트머니 이탈 강력 경고 (2026-07-13)

사용자 요청: 종목의 수급(외인/기관/개인)을 **차트로 주가와 오버레이**해 스마트머니 매집/이탈을 눈으로(아무 종목이나) + 내 포트 종목이 SK하이닉스처럼 스마트머니가 계속 빠지면 강력 경고.
- **① `SupplyFlowChart.tsx`**(종목 리서치·MoneyFlowRadar 아래): 검증된 `/api/money-flow/timeline`(fetchKrTrend, days 40→60) 재사용 → 외국인·기관·개인 **누적 순매수(억/조)를 좌축, 주가를 우축**에 오버레이(Recharts ComposedChart). 우상향=매집/우하향=이탈을 주가와 대조. **판정 배너**: 🚨지속이탈(외인+기관 누적<0 & 최근5일<0)·⚠️이탈우위·🟢매집·⚪혼조 + 같은 기간 주가%. KR 개별주식 전용(US·데이터부족 자동 숨김). ⛔ 점수 미반영·교육용.
- **② 🚨 포트 스마트머니 이탈 경고**(`PortfolioFlowDashboard` 상단): `status===CROWDED`(외인+기관 이탈+개미독박, getMoneyFlow SSOT) 보유 종목을 **4분면(저평가=PEARL)에 가려지던 것까지 status 기준 전용 빨강 배너**로 부각 — "SK하이닉스형, 개인이 받아내는 분산 구조, 비중·손절선 점검". crowdedList 재사용(비용 0).
- 검증(라이브): **SK하이닉스 외인+기관 60일 −44.7조·최근5일도 이탈·주가 +62.4% → 🚨지속이탈**(스마트머니 빠지는데 개미가 올린 divergence 정확 포착) / 파두 +4,910억·+15.9% → 🟢매집. 전부 timeline/getMoneyFlow SSOT 재사용, 신규 수집 0.


## 🏛️ 미국 수급 레이더 정교화 — 전체 기관 보유·분기 순증감 (2026-07-13)

사용자 질문("한국은 외인/기관/개미 일별 수급을 잘 가져오는데 미국은 MFI 프록시뿐인가? 구글이 준 FMP 방법론으로 더 정교화 가능?") → **조사·검증 후 정직 결론 + Yahoo 무료 격상**.
- **정직한 구조적 결론**: 미국은 **투자자 유형별 일별 순매수를 아예 공시하지 않음**(한국거래소가 모든 주문을 외인/기관/개인 태깅해 일별 공시하는 건 한국·대만 등 극소수 시장 특성). 유료든 무료든 어떤 API도 미국 일별 3주체 수급 불가 — 데이터 자체가 없음.
- **구글/FMP 방법론 실측 검증**: ① 제시 코드 URL이 `financialmodelingprep.com{ticker}`로 **경로 누락=실행 불가** ② FMP 기관 엔드포인트는 **유료**(앱 키로 전부 `Limit Reach`, 무료 250/일도 재무로 소진) ③ 결국 FMP가 주는 건 **13F(분기)+내부자 = 우리가 이미 SEC EDGAR로 무료로 쓰는 그 데이터**. 더 정교한 게 아니라 같은 데이터 유료 재판매.
- **진짜 무료 격상(Yahoo `quoteSummary`, 이미 쓰는 라이브러리·무키)**: `majorHoldersBreakdown`(기관 보유%·기관 수)+`institutionOwnership`(Top 기관 QoQ pctChange)+`netSharePurchaseActivity`(내부자 6개월 순매매). `moneyFlow.ts` `fetchUsInstitutional` 추가, `UsFlow`에 instPct/instCount/instTrend/instAdders/instCutters/insiderNetPct. cache US v5→v6.
- ⚠️ **Top10 QoQ 방향 과신호 차단(검증서 발견)**: 초판은 미세 변동(0.05%)까지 세어 **전 종목 accum**(패시브 인덱스펀드+신규편입 100% 아티팩트 탓). → **|Δ|≥50% 아티팩트 제외 + 3%↑ 의미변동만 + margin≥3**일 때만 방향 인정 → 대부분 혼조(과신호 0), 명확한 매집만 포착. 검증(라이브): AAPL 65.7%·혼조·NEUTRAL / **TSLA 44.9%·순매집4↑1↓·내부자+76 → INFLOW** / NVDA 70.8%·혼조 / **BA 75.4%·순매집·INFLOW** / PLTR·INTC 혼조·NEUTRAL.
- `judgeUs`: (내부자 매수 OR 기관 분기 순매집)+MFI<70 → 🟢유입 / 기관 순감소+고점 → 🔴과열. `MoneyFlowRadar` US에 🏛️기관 보유% 게이지+분기 순증감+내부자 순매매 칩. **여전히 분기·45일 지연 한계는 푸터에 정직 명시**(한국식 일별 추적은 미국 원천 불가).


## 🐛 미국 종목 '외인' 오표기 제거 (2026-07-14)

사용자 지적: US 종목(보잉)의 종합 매수 판정 근거에 "스마트머니 유입(외인·기관 매집)" — **미국엔 '외국인' 투자자 구분이 없음**(외인/기관/개인 일별 태깅은 한국거래소만). 우리 US 수급 = 13F 기관(국적 무관 전체)+내부자+MFI 프록시이지 '외국인'이 아님. 한국식 문구가 US 표시로 누출.
- **전수 검증 후 3곳 시장별 분기**(portfolio-flow는 이미 게이팅됨): ① `research-verdict`(종합 매수 판정 INFLOW/CROWDED 근거) → US='기관·내부자 매집'/'기관 순감소·MFI 과매수', KR='외인·기관' ② `ai-rebalance`(매도 사유 CROWDED, sig 엔트리에 market 추가) → US='기관 순감소·MFI 과매수' ③ `PortfolioFlowDashboard` 이탈 경고 배너 → 시장 중립('한국: 외국인·기관 / 미국: 기관·큰손'). cache research-verdict v6→v7·ai-rebalance v35→v36.
- 검증(라이브): 보잉·테슬라(US)='기관·내부자 매집'·외인 누출 0 / 파두(KR)='외인·기관 매집' 유지.
- 개념 정리(학생 안내용): 미국 13F는 국적 불문 '기관'만 집계 — 외국 기관이 미국주를 사도 '외국인'으로 분리 공시 안 됨. 한국식 '외국인 수급'은 미국에 원천 부존재.


## 🐛 US 내부자 지표 모순 라벨 정리 + 전 학생 70종 전수 조사 (2026-07-14)

사용자 지적: US 수급 레이더에 "내부자 매수 없음"(EDGAR)과 "내부자 6개월 순매수 우위"(Yahoo)가 동시 표기 = 모순.
- **원인**: 두 지표가 다른 것을 잼 — EDGAR `insiderBuyers`=공개시장 매수(코드 P·90일, 린치의 진짜 매수 신호) vs Yahoo `netSharePurchaseActivity`=6개월 순 지분변동(그랜트·옵션행사·매도 합산). 장내매수 0인데 6개월 순증이면 그건 **매수가 아니라 그랜트·베스팅** → "순매수 우위"는 부정확.
- **수정**: EDGAR 칩 '🕵️ 90일 장내매수 N명/없음'(공개시장 명시) / Yahoo 칩 '📊 내부자 지분 6개월 순증(그랜트 포함)/순감'(매수 아닌 순 지분변동). 둘이 개념적으로 구분돼 모순 해소·교육적. judgeUs 코멘트도 동일 정리. 임계 5→10.
- ⚠️ **스핀오프/IPO 아티팩트 억제(전수 조사서 발견)**: GEV +285·SPCX +318·ALIT −114 등 순 지분%>100%는 스핀오프/신규상장 분배 아티팩트(실제 순매매 불가) → **|100| 초과 칩·코멘트 억제**, 의미있는 값(VRT −21·TSLA +76·BA +70)만 표시.
- **전 학생 보유 70종 전수 조사(서비스롤로 investments 추출→라이브 money-flow)**: **에러/크래시 0 · US 외인 누출 0**(이전 커밋 검증) · ETF·코인·레버리지 28종 정상 UNSUPPORTED 차단 · US 실주식 18종 전부 기관% 수신(추세 mixed12·accum5·distrib0=보수적 과신호 0) · KR 실주식 24종(INFLOW13·CROWDED11, 현 외국인 매도 장세 반영). 내부자 라벨 4종(GEV·SPCX·ALIT·VRT)은 이제 순증/순감으로 비모순 확인.


## 🎯 시계추 조정 요구 안전마진 — 제미나이 '실전 퀀트 스크리너' 기획 검토 (2026-07-14)

제미나이가 제안한 3대 엔진을 기존 앱과 정밀 대조 → **2개는 이미 완비, 1개만 정량화 부재라 보강**.
- **A. 펀더멘탈×기술 크로스 스크리너 = 이미 완비**: research-verdict(4축 계절·가치·수급·모멘텀)+TimingBadge(TTM Squeeze·SuperTrend·RSI·구름·ADX·라쉬케·VWAP/POC/FVG)가 펀더멘탈+기술을 합성. ⛔ 기술을 '선정 필터'로 쓰자는 부분은 앱 원칙(기술신호=선정 미반영, WHAT은 펀더멘탈)상 거부.
- **B. 볼라틸리티 리스크 패리티 = 이미 완비**: TradePlanCard의 1%룰(수량=포트×리스크%÷(진입가−ATR손절가))이 **수학적으로 역변동성 배분(w∝1/(ATR/Price))과 동일** — 변동성 큰 종목 자동 소량. 2×ATR 손절도 있음(entryTiming.atrStop). 다중종목 배분은 퀀트빌더가 담당. 신규 불필요.
- **C. 하워드 막스 시계추 조정 안전마진 = 유일한 갭 → 보강**: marks-cycle에 시계추(온도)·현금밴드는 있었으나 '안전마진 확보'가 **정성 문구뿐**, 정량 %가 없었음. **`requiredMos = 20% × (1 + 시계추/50)` [5~40] 클램프** 추가(탐욕일수록↑ — 공정가치 대비 더 싸야 매수). Zero-Input(기존 온도 재사용, 제미나이의 사용자 적정가 입력은 앱 원칙에 안 맞아 제외). marks-cycle 페이지·**브리핑 ⑤ 스탠스**에 표시 + **모닝스타 별점 할인율과 비교**하도록 브리지(할인>요구치=진입 신호). cache marks-cycle v3→v4.
- 검증(라이브): 온도 71(낙관)→28%, 공식 검산(90→36·75→30·50→20·25→10·10→5) 완전 일치. 제미나이 예시(+40 탐욕→36%·−40 공포→4%)와 정합.
- 교훈: 제미나이 '실전 퀀트' 기획의 알맹이 대부분은 이미 구현돼 있었고(리스크패리티는 1%룰과 수학적 동일), 진짜 신규는 '시계추→요구 안전마진 정량화' 하나. 사용자 직감대로 '오늘의 매매 브리핑'에 들어갈 스탠스 정보였음.


## 📋 매매 플랜 카드 단순화 — '지금 살까?' 결론 먼저 (2026-07-14)

사용자 지적: 오늘의 매매 브리핑 ③담을 것의 매매 플랜을 펼치면 학생 눈에 복잡(계산·수식만 나열)하고 **"추천 종목을 지금 사라는지·기다렸다 사라는지·사지 말라는지" 결론이 없음**.
- **정보 위계 재설계**(계산·수식 불변, 배치만): ① **🎯 오늘의 행동**(신호등→학생 언어 큰 결론) — 🟢=✅지금 사도 됨(먼저 N주 분할, 눌림에 추가) / 🟡=⏳절반만 지금·나머지는 구름 상단 돌파 확인 후 / 🔴=🚫지금 사지 마세요(돌파 확인 후 소액) / 수량0=⏸️관망. ② **핵심 3줄**(지금 담을 양 N주+₩ · 손절선 · 감당 리스크 %토글) ③ **🔬 상세 근거**(주당리스크 산식·2R/3R 익절선·라쉬케·매물평단)는 **접기 토글**로 기본 숨김.
- 결론 = 3분할 진입 플랜의 첫 단계를 최상단·큰 글씨로 승격(기존엔 분할 플랜 텍스트에 묻혀 있었음). "몇 주"도 '최종 목표 vs 지금 1차'를 분리 표기.
- 브리핑 5섹션 검증(내부 일관성): ①오늘 신호(워처 전환) ②정리할것(리밸런싱 drop/trim) ③담을것(통합추천+타점+플랜) ④판읽기(로테이션 유입/이탈) ⑤스탠스(막스 온도 66→요구안전마진 26%=20×(1+16/50) 검산 일치·권장현금 20~30%). Morgan Stanley 플랜 검산: 19주×$221×환율≈634만=포트 19.1% 일치.


## 🌐 스크리너 유니버스 221→514 대폭 확장 (2026-07-14)

사용자 요청("서치 종목수 최대로 넓혀라") — 먼저 **한계 실측**: 병목은 시간(maxDuration 300s·221종=23초·8%)도 스로틀도 아님. Yahoo 6모듈 quoteSummary 동시성8 종목당 ~105ms, **연속 596콜에도 429 스로틀 0**. 안전 권장 ~500, 여유~600(다운스트림은 캐시 재사용이라 화면 속도 무영향, 주간 크론만 길어짐).
- **`macroPhaseScreener` US 126→331(+205)·KR 95→183(+88) = 514종**. US 추가=스테이플·헬스케어·산업재·유틸리티·리츠·SW·중형 성장주 / KR 추가=코스닥 성장(바이오·게임·소부장)·건설·소재·소비재.
- ⭐ **전 신규 티커 실존 검증(제1원칙)**: 티커+분류만 지정, **종목명은 Yahoo `price`/네이버 `basic` API 실측값**으로 채워 오탈자 0. 인수·상폐 티커(ANSS·JNPR·HES·DFS·PARA 등 9종)는 name null로 자동 제외.
- **실측 검증(프로덕션)**: `macro-ai-picks?refresh=1` 514종 스크리닝+Gemini = **67초**(300s의 22%). v7 캐시 **505종 적재**(US 327·KR 178, 98.2% 성공·9종 일시 누락은 다음 크론 복구). 신규 티커 반영 확인(NEE·ROST·LIN·FTNT·TSM·336260·225570 등).
- cache `macro-screened-universe:v6→v7`(writer macro-ai-picks + reader unified-reco·season-navigator·alpha-hunter 4곳 일괄). 통합추천·AI 리밸런싱·4계절·퀀트빌더·알파헌터가 확장 풀 자동 상속.


## 🧭 섹터 로테이션 대표주 확대 3:3→5:5 (2026-07-14) — 332→~440종

사용자 지적: 스크리너 유니버스(221→514 확장)와 **섹터 로테이션은 별개 풀**(`sectorConfigs.ts` 16배열, 종목수 안 늘어남). 확인 후 5:5로 확대.
- **두 풀은 독립**: `macro-screened-universe`(통합추천·리밸런싱·4계절·퀀트빌더·알파헌터가 쓰는 개별종목 후보) vs `sectorConfigs`(섹터 로테이션이 쓰는 17섹터 대표 바스켓·`computeSector`). 목적이 다름(개별종목 발굴 vs 섹터 자금흐름 측정).
- **소섹터당 US+2·KR+2 편입**: GICS 11섹터 위주(테마 6섹터는 이미 5+). 109종 신규 전수 실존 검증(Yahoo/네이버, 인수·상폐 EXAS·FI·SJW 일시실패 자동 제외=제1원칙), 종목명 API 실측값. 32unique→~438(16배열)+퀀텀40.
- **효과**: 52주 신고가 스캐너·드릴다운 대장주 표에서 더 많은 종목 포착 + RRG 섹터 평균 더 견고(RRG 신호 자체는 3:3도 충분했으나 개별종목 커버리지↑).
- **검증(프로덕션)**: sector-v3 캐시가 종목수 지문으로 자동 무효화 → financials 섹터 **25→37종** 재계산·신규 8종(C·USB·TRV·ALL·PYPL·024110·001450·016360) 라이브 확인. 로테이션 17섹터 집계 정상(유입10·이탈5·신고가18). rotation 캐시 v9→v10.
- ⚠️ **재확인: 섹터 로테이션과 스크리너는 두 개의 독립 유니버스** — 한쪽 확장이 다른 쪽에 자동 전파되지 않음(각각 관리).


## ⚔️ 승패 해부실 (2026-07-14) — 사이드바 📌매일(브리핑 아래) + 브리핑 ④½ 요약

변동성 장 승패 요인 분석(일회성)을 **매일 자동 갱신 상설 화면**으로 승격 — "지금 장에서 오르는 종목 vs 떨어지는 종목은 뭐가 다른가" = 시장의 채점 기준(요인 로테이션)을 역관측. 사용자 확정: 유니버스=스크리너 514+학교 보유 합집합 / 배치=사이드바 매일 그룹 `/win-lose` + 브리핑 요약. 설계 `docs/win-lose/plan.md`.
- **`lib/winLose.ts`(SSOT·순수함수·클라서버 공용)**: 그룹 분할(기간별 임계 1w±1.5/1m±3/3m±5) + **7요인 격차 통계**(①추세 정배열비율 ②52주 위치 ③시장 US비중 ④영업이익률 ⑤EPS 상향비율 ⑥주도·태동 섹터비율 ⑦PEG) + **오늘의 교훈 결정론 조립**(격차 Top3 + '못 가른 요인' 문장 — AI 미사용·환각 0. 조사 은/는 받침 자동 판별)
- **`/api/win-lose`**(공개·`win-lose-v1:KST일자` 12h·maxDuration 300·매일 08:50 KST 크론 워밍): 펀더·추세·EPS방향 = `macro-screened-universe`(ScreenedStock priceTrend·fwdEpsDir·opMargin·peg) 재사용, 섹터 국면 = rotation v11 캐시 읽기만(콜드 null graceful), **수익률·52주 위치만 Yahoo 차트 신규**(KR .KS→.KQ — 알파헌터 선례, 동시성 8·522종 30초·성공 60%↓ 캐시 박제 금지). 유니버스 밖 보유 종목 추세는 캔들 MA50/200 폴백(priceTrendKnife 철학)
- **프라이버시**: 학교 보유 종목은 유니버스에 섞되 '보유' 표식 없음(단독보유 노출 차단) — ⭐'내 보유' 하이라이트는 클라에서 본인 RLS 조회로만
- **`/win-lose` 페이지**: 스코어보드+기간 토글(1주/1개월/3개월 — 클라 재그룹) / ⚔️대전표(나비 바·**무변별 요인 회색 처리** = "숫자 좋다고 오르는 게 아니다" 시각화) / 🧭섹터 전장 지도(로테이션 국면순·승률바·승패 종목칩·미분류는 '📦 섹터 미분류') / 🎯산점도(52주 위치×수익률·추세 색·내보유 흰 테두리) / 🏆💀 Top8(배지) / 캐비엇("과거 채점 기준이지 미래 보장 아님·승자 추격 신호 아님")
- **브리핑 ④½ 요약**: ④판읽기 다음 — 스코어+Top3 요인 칩+교훈 1줄+`/win-lose` 딥링크(같은 API·같은 lib = 제2원칙)
- 🐛 **rotation v9→v11 정합 수정(동시 발견)**: 오늘 로테이션 캐시를 v11로 올렸는데 `unified-reco`(틸트)·`cron/timing-watch`(섹터 이탈)가 **죽은 v9 키를 계속 읽어 조용히 무력화** → v11로 수정. 교훈: **공유 캐시 키 버전업 시 writer만 올리면 reader들이 조용히 죽는다 — `grep -rn "키이름"`으로 reader 전수 확인 필수**(macro-screened-universe 확장 때는 했는데 rotation 때 누락)
- 검증(라이브): 522종 30초·성공 521(99.8%)·로테이션 조인 452 · 첫날 교훈 = "①미국 비중(격차 57) ②상승추세(43) ③52주 위치(35) / 주도섹터·PEG·EPS상향은 무변별" — 수동 분석(66종)과 방향 일치·대유니버스에서 통계 강화. 캐시 히트 1.2초. 화면·브리핑 렌더 확인(교훈·대전표·전장지도·Top8 전부 정상)
- ⭐ **🏫 우리 포트 승패 보드(2026-07-15, v1→v2)**: 사용자 요청 — 학생 전체 보유(ETF·코인 포함)의 오르는/내리는 시각화 + 소섹터 라벨 + 내 보유. `WLSchoolRow` 추가 — 보유 합집합 70종(주식42·ETF24·코인3·원자재1, CRYPTO는 Yahoo `-USD`)의 수익률·추세 2열 보드(헤더 아래). **소섹터 라벨 역매핑**: 개별주=`SECTORS` 등록순(테마 6 먼저→GICS 11 — 첫 매칭 우선이라 테마 라벨 자연 우선, 한미반도체→🔧장비·삼성전자→💾HBM·메모리·PLTR→🤖방산AI) / ETF=`SECTOR_ETF` 역맵(ARKG→AI바이오·PHO→수도신재생·PLUS K방산→항공방산) / 코인=🪙암호화폐 / 미매핑 광의 ETF(TIGER S&P500·KODEX200·IBB)=📦 정직 폴백. 가격은 유니버스∪보유 1회 수집(중복 fetch 0·32초). 프라이버시: 보유자·인원수 미포함, ⭐내보유는 클라 RLS만. ⭐ **라벨 폴백 체인 완성(같은 날, v2→v4 — 사용자 "'주식'만 나오는 건 오류?")**: 오류 아님(바스켓 밖 종목의 정직 폴백)이나 개선 — 체인 = ①소섹터(테마 우선) ②GICS 대섹터(ScreenedStock.sector) ③ETF=portfolioRole SSOT(📈광의지수/📜채권/⚠️레버리지/📦테마) ④주식 US=canonical 업종(한글) ⑤주식 KR=**네이버 업종**(`integration` API industryCode → `sise_group.naver?type=upjong` 목록 1콜 EUC-KR 파싱 79업종 맵·7일 캐시 `naver-upjong-map-v1`). 라벨 39→**68/70**(파두=반도체와반도체장비·대한광통신=통신장비·두산=복합기업·한국카본=조선·KODEX200=광의지수·TSLL=레버리지). 잔여 2 = ALIGHT(전 소스 무업종)·PSLV(원자재는 assetType 칩). ⚠️ 교훈: **Yahoo가 섹터를 안 주는 코스닥주는 네이버 industryCode+업종맵이 정답**(canonical sector도 KR은 null — 실측 확인). 검증: 라벨 39/70 부착·집계불가 1종 정직 표기·보드 스토리("오르는 21종=미국 바이오·전력·금융 / 내리는 48종=한국 반도체 소부장·방산·중공업")가 화면에서 즉시 읽힘

## 🧭 승패 해부실 섹터 미분류 완전 해소 (2026-07-15) — win-lose v5→v7

사용자 질문("전장 지도에 왜 '섹터 미분류'가 있지? 잘못된 거 아냐?") — 오류 아님(Yahoo가 섹터를 안 주는 코스닥주·유니버스 밖 보유 주식의 정직 폴백)이지만, 학교 보드에서 검증한 네이버 업종 경로를 통계 유니버스에도 적용해 **미분류 0·로테이션 조인 521/521** 달성.
- **진범 2종**: ① 유니버스 밖 보유 주식(s=null)·Yahoo 미제공 코스닥주 → sector null(16종) ② **스크리너가 섹터 미상을 null이 아닌 `'—'` 문자열로 저장**(53종) — truthy라 `!r.sector` 필터를 통과하고 화면에선 sectorMeta('—')=null → 미분류 렌더. 스크린샷의 대형 미분류 행(46승패)의 정체가 ②였음
- **수정(route ⑥·⑥½)**: ⓐ row 빌드 시 `SECTOR_TO_ROT`에 있는 유효 GICS 11만 인정(`'—'`/'기타'는 null 정규화) ⓑ sector-null 행 패치 — KR=`krIndustryOf`(네이버 industryCode→업종명)→**`upjongToGics` 키워드 매퍼**(반도체·통신장비→Technology / 조선·기계·복합기업·**전기제품(2차전지)**→Industrials / 화장품→Consumer Defensive / 자동차→Consumer Cyclical 등 11룰) / US=Yahoo `assetProfile.sector` 직접(PLUG=Industrials·TEM=Healthcare·IONQ=Technology 정확) ⓒ 패치 행 `SECTOR_TO_ROT` 로테이션 재조인(rotQuad/rotScore) — rotJoined 452→**521(100%)**로 대전표 ⑥요인(주도·태동 섹터 비율) 통계 신뢰도 동반 상승
- **검증(프로덕션)**: 미분류 69종(53+16)→**0** · 표본 정합(에코프로비엠=Industrials·데브시스터즈=Communication Services·HPSP/이오테크닉스=Technology) · 화면에서 미분류 행 소멸·전 섹터가 로테이션 국면순 정렬
- ⚠️ **교훈**: ① "미분류·미상" 값은 소스마다 표기가 다르다(null vs `'—'` vs '기타') — **다운스트림에서 유효 화이트리스트(SECTOR_TO_ROT 키)로 정규화**해야 조용한 미분류 누적을 막는다 ② 네이버 업종 매퍼는 실측 기반 점증(첫 배포서 2차전지주 4종이 '전기제품' 업종으로 남아 실측 후 룰 추가) — 키워드 룰은 남은 미분류를 실측해 보강하는 루프가 정석


## 🏙️ 서울 열린데이터광장 연동 — 단지 핀·개요 + 서울 매매 수집 전환 (2026-07-15)

사용자 제안("서울시 Open API 검증해봐") → 전수 실측 후 진짜 가치 2건만 채택. 인증키 = `SEOUL_API_KEY`(.env.local + Vercel, 서버 전용·1회 1,000건).
- **Phase 0 실측 판정**: ① `tbLnOpendataRtmsV`(매매) — **국토부와 건별(동·금액·계약일·전용면적) 100% 일치 + 서울시가 10건 더 신선**(강남 2026-06 교차검증 184/184), ARCH_AREA=전용면적 확인, 보관은 **2024년~현재만**(2023 이전 없음 실측) ② `OpenAptInfo`(공동주택 마스터 2,879단지) — **좌표(XCRD/YCRD)+세대수+준공+주차** = 보류했던 단지 핀 해결 ③ 전월세(`tbLnOpendataRentV`)는 강남 연 7만행(전 유형·필터 불가)이라 **미전환**(국토부 유지) ④ ⛔ 재개발·재건축 API(OA-2253)는 **2026-07-15자 서비스 종료** 실측 — 쓰면 안 됨
- **`lib/seoulApt.ts`(신설)**: `seoulTradeMonth`(연도×자치구 캐시 `seoul-rtms-trade-v1:{cgg}:{yr}` 과거7d/당해6h + 버스트 dedup 메모) — ⚠️ RCPT_YR=접수연도라 계약월 조회는 해당연도+익년 스캔(12월 계약이 익년 접수분에 실림). `getSeoulAptMaster`(`seoul-apt-master-v1` 7d) + `matchAptMaster`(공백·괄호·'아파트' 접미 정규화, 같은 법정동 우선)
- **`rtms.ts` 매매 전환**: 서울 25구(lawd 11*)는 서울시 API 우선 → **같은 월별 캐시 키(`rtms-trade-v2:{lawd}:{ym}`)에 적재**(re-map 히트맵 등 기존 소비자 무수정 호환 — rotation reader 교훈 적용), null(범위 밖·장애)이면 국토부 폴백. data.go.kr 일 1,000콜 쿼터를 지방 전용으로 온존
- **단지 핀(`/api/re-apt-pins`) — 마스터 × 최근 12개월 실거래 캐시 조인**: 마스터엔 재건축 멸실(개포주공1단지 USE_YN=Y 잔존)·통합 표기(압구정현대아파트↔RTMS 현대N차)·신축 세대수 0(디에이치퍼스티어) 오염 존재 → **거래 있는 단지만 핀 + 클릭 쿼리=정확한 RTMS 그룹 키**("래미안 대치 팰리스"→"대치동 래미안대치팰리스" 표기차도 norm 조인 해결). 외부 콜 0(캐시 전용·re-map 패턴 supabase no-store). 미수집 구는 마스터 상위 폴백
- **단지 개요 카드**: re-apt selected.overview — 세대수·동수·준공·주차(세대당)·난방(검증: 도곡렉슬 3,002세대·34개동·2006-01·1.48대 / 은마 4,424·0.68대 = 실스펙 정합). 의무관리단지만이라 미매칭 null 정직
- **검색 미스 정직 고지**: 검색·핀 쿼리가 실거래 미발견이면 1위 단지 조용한 폴백 대신 `queryMiss` + ⚠️ 안내("재건축 멸실·표기 차이 가능")
- ✅ **화면 전수검증(2026-07-15)**: 은마 77㎡ 밸류 3축 독립 재계산 — 국토부=서울시 건별 완전 일치(202606 33.7/34.5/34.8억), 전세가율 20.1%=7÷34.8 검산 일치, 고점 38억·면적 타입(77/84) 실제 정합 / 강남 평당가 재계산 1.22≈화면 1.2(표본 669) / 마스터 3단지(은마·올림픽선수기자촌·용산센트럴파크) 원본 일치. 화면 61건·34.8억 vs 재계산 58건·34.5억 차이 = **과거월 30일 캐시 스냅샷 이후 유입된 신고**(06-23 계약 33.7억 등 — 신고 30일 지연 특성, 버그 아님·캐비엇 그대로)
- 🩹 **지역 국면 '—' 공백 수정(화면검증 발견)**: re-honeycomb-v2 캐시(24h 계산·3일 읽기 TTL)가 벌집 페이지 미방문 시 만료 → 단지 리서치 국면이 '—'로 빔. **읽기 stale 14일 완화(월 단위 통계라 무해) + 일일 크론 워밍(`/api/re-honeycomb` 05:30 KST)** — 캐시 생명주기가 사용자 방문에 의존하던 결함 해소. 교훈: **B화면이 A화면의 캐시를 '읽기만' 하는 구조는 A 미방문 시 조용히 빈다 — 크론 워밍 또는 stale 허용 필수**
- ⚠️ 참고: 단지 랭킹의 신축(어반허브서울스테이션 70건 등)은 분양 물량 일괄 신고(직거래 다수)라 '거래 활발'≠'유통 활발'일 수 있음(실데이터 그대로 — 향후 직거래 비중 배지 후보)
- ⚠️ **빌드 함정 재발(교훈 재확인)**: `grep | head; npm run check:build | tail && git commit && deploy` — **파이프가 exit 코드를 가려**(tail이 성공하면 통과) TS2802 실패 빌드가 커밋·배포까지 흘러감. 검증 명령은 `npm run check:build > log 2>&1 && echo OK` 처럼 **파이프 없이 exit를 직접 && 체이닝**할 것. (TS2802 = `for..of Map` — `Array.from(map.entries())`, 반복 3회째)


## 🎨 디자인 토큰 SSOT 통합 — src/lib/theme.ts (2026-07-16)

"기능 90% 완성 → 디자인 고도화" 1단계. 파일마다 흩어진 hex 색상을 단일 출처로 통합(기능·픽셀 무변경 — 리디자인 토대).
- **`src/lib/theme.ts`(신설)**: `TK` 객체 = 앱 전체 색상 SSOT — 배경·보더 24종(bg0~bg10·card·border·grid·line·flat) + 텍스트 램프(slate100~600 + **sub~sub15** = 가독성 패스 산물 유사 그레이, 리디자인 시 수렴 후보) + 액센트 39종(Tailwind 표준명 red400·green400 등 + neonLime·btcOrange). **JS 상수라 Recharts·lightweight-charts(캔버스)·SVG 전부 호환**(CSS 변수는 SVG 속성·캔버스에서 깨져 기각).
- **코드모드 일괄 치환**: 상위 82색(전체 6,839곳 중 91%)을 **161파일 6,430곳** 자동 치환 — ①JSX 속성 `stroke="#hex"`→`{TK.x}` ②정확일치 `'#hex'`→`TK.x` ③혼합 문자열 `'1px solid #hex'`→백틱 `${TK.x}`(알파 접미 `#hex55`→`${TK.x}55` 포함) ④기존 백틱 내 hex ⑤import 자동 삽입. 잔여 645곳 = 10회 미만 롱테일(추후 화면별 리디자인 때 정리).
- ⚠️ **코드모드 함정 2건(빌드가 포착·수정)**: ① DOM 스타일 무공백 대입 `el.style.color='#hex'`를 JSX 속성으로 오인해 `={TK.x}` 중괄호 래핑(2파일) — 사전 grep에서 `color` 키워드를 제외한 실수, 정정 패스로 해소 ② **`as const` 금지** — TK가 리터럴 타입이 되면 기본 파라미터(`border = TK.line1`)의 추론이 그 리터럴로 좁아져 호출부 타입 에러(8파일). string으로 넓혀 해소.
- **검증**: check·check:build 통과(exit 직접 체이닝) + 프로덕션 렌더 색상 실측 — 인라인 스타일 계산값(rgb)이 토큰 hex와 7종 전수 일치(#7f93a8·#0f1117·#f87171·#e2e8f0·#4ade80·#8a9aaa·#8599ae), 콘솔 에러 0, Recharts 렌더 정상. **런타임 값이 동일 hex 문자열이라 픽셀 불변이 구조적으로 보장**.
- **효과**: 이후 리디자인은 theme.ts 값만 바꾸면 전 화면 반영. 다음 단계 = 화면별 디자인 개선(sub2~15 그레이 수렴·카드 스타일 통일 등). ⚠️ tailwind.config.ts ink/zinc 토큰은 별도 시스템(클래스용) — theme.ts와 함께 관리.


## 🪙 승패 해부실 '내 보유' 3D 강조 — 디자인 고도화 1호 (2026-07-16)

토큰 통합 후 첫 화면별 디자인 작업. 기존 ⭐+반투명 흰 테두리 → **금화 배지 + 뉴모피즘 융기** (시안 4종+3D 3종을 위젯 목업으로 제시 → 사용자 선택: 3D-1+코인 조합).
- **`Coin` 컴포넌트**(win-lose/page.tsx): radial-gradient 금화(₩ 각인·`TK.coinLight/coinDark/coinEdge/coinText` — theme.ts에 코인 4색 추가). 우리 포트 승패·Top8 행 + 헤더 범례에 사용.
- **`MINE_ROW` 융기**: `linear-gradient(145deg, bg8→bg4)` + 왼쪽 3px 골드 바(amber400) + 이중 그림자(`4px 5px 12px bg0, -2px -2px 7px line2` — admin 뉴모피즘과 동일 문법) = 내 종목만 보드에서 떠오름. `.wl-mine:hover` 2px 상승+골드 글로우(페이지 내 `<style>` 주입 — 인라인 스타일은 :hover 불가).
- **골드 언어 통일**: 산점도 내보유 stroke 흰색→amber400, 전장 지도 칩 테두리 흰색→골드+미세 글로우. '⭐/흰 테두리 = 내 보유' 문구 전부 갱신.
- **디자인 결정 근거**: 내 보유가 보드의 절반(~26종)이라 '다수 동시 강조에도 안 시끄러운' 방향(C안 글로우 카드 기각) + 금색='내 돈' 메타포 + 모바일(호버 없음)에서도 입체감 유지.
- ⚠️ 검증: check·build 통과, 프로덕션 범례 금화 렌더·에러 0 확인. 내보유 행 융기는 RLS(로그인)라 브라우저 비로그인 검증 불가 — 코드 경로 단순 조건 스타일이라 범례 렌더로 갈음.


## 🏃 모멘텀 이론 보강 — 12-1·변동성조정 요인 + 모멘텀 크래시 경보 (2026-07-16)

사용자 제공 모멘텀 글 3편(TradingView·알파스퀘어·키움자산운용) + 학술 원전(Jegadeesh-Titman 1993·Daniel-Moskowitz JFE 2016) 조사 → **대부분 기구현 확인**(이익모멘텀=Fwd EPS 리비전 0.6가중·52주 신고가 hi52·RRG 상대강도·휩쏘 ADX 가드·칼날 SSOT·오실레이터=기술차트 전용) 후 진짜 빈틈 3개만 보강. 점수·선정 절대 불변(관측·캐비엇 전용).
- **A안 ① 🏃 12-1 모멘텀 요인**(승패 해부실 8요인): 학술 표준 = 최근 1개월(21봉) 제외 12개월 수익률 — **최근 1개월은 단기 반전 경향이라 빼는 게 정석**(Jegadeesh-Titman). ② **⚖️ 변동성 조정 모멘텀**(9요인): mom12 ÷ 연율화 σ(샤프형 — 키움 글 "변동성 대비 수익률 표준화"). 둘 다 **추가 fetch 0**(win-lose가 이미 수집하는 400일 일봉 재사용, 252봉 미만 신규상장 null 정직). `WLRow.mom12/volAdj` + `factorStats` ⑧⑨ + 캐비엇에 단기 반전 교육.
- **B안 ⚠️ 모멘텀 크래시 국면 경보**(Daniel-Moskowitz 2016 — 패닉 후 반등장에서 모멘텀 전략 붕괴·사전 감지 가능): 판정 = 1개월 기준 **패자 그룹의 12-1 모멘텀 평균이 승자보다 ≥10%p 높음**(역전 = 지금 오르는 건 낙폭과대주) + 양그룹 표본 ≥10. `WLApi.momCrash` → 승패 해부실 경고 배너 + **unified-reco(v26)가 캐시 읽기만으로 헤더 캐비엇**("달리는 말 추격이 무너지는 구간·분할 신중") — 점수 미반영 명시. win-lose 캐시 v7→v8.
- **검증(라이브·독립 재계산)**: 521/521 전 종목 mom12·volAdj 산출 · NVDA mom12 25.1%·volAdj 0.70 = Yahoo raw 재계산 소수점 일치 · **momCrash=true 실측 — 승자 157종 평균 +7.0% vs 패자 258종 +83.8%(역전 76.8%p)** = 12개월 대승자(KR 반도체 +400~800%)가 무너지고 약체가 오르는 현 반전 장을 정확 포착(경보 기능이 첫날부터 실전 작동).
- ✅ **화면 전수검증(2026-07-16)**: 스코어보드(157/+10.0·106·258/−16.6)·대전표 9요인 18수치·교훈 격차(61/48/34)·무변별 3종(EPS 9·주도태동 6·PEG 7 <12)·우리 포트(21/47/1) — **26개 수치 전부 독립 재계산과 일치**. 역전 요인은 패자 숫자 빨강 강조(betterSide 렌더)로 정상 표시.
- ✅ **기간 토글 3종 전수검증(2026-07-16)**: 1주(204/+5.2·140·177/−4.9 — 교훈 12-1 역전 단독 Top·무변별 7종 순서까지 일치)·1개월(기검증)·3개월(182/+29.1·120·219/−21.1 — Top3 52주49·추세48·**12-1 43 정방향**) 재계산 완전 일치 + 표본 4종(원익IPS +38.9·SK하이닉스 3m +67.0·한국카본 −53.1·IONQ −16.8) 소수점 일치. ⭐ **12-1이 1주·1개월=역전 / 3개월=정방향** — '역전' 표기가 기간별 방향을 정확히 분기(반전이 최근 1개월에 시작됐다는 스토리를 세 탭이 함께 증언). 크래시 배너는 1개월 기준 국면 경보라 전 탭 고정 표시(문구에 기준 명시 — 모순 아님).
- 🩹 **교훈 역전 명시(화면검증 발견·수정)**: "승패를 가른 건 ① 12-1 모멘텀(격차 61)"만으론 **패자가 높은 역전 요인**임이 문장에서 안 드러나 "이 요인이 좋아서 이겼다" 오독 여지 → buildLesson이 betterSide=lose 요인에 **"(격차 61·역전 — 패자가 높음)"** 자동 표기(클라 순수함수라 캐시 무관). 교훈: 격차 통계는 '크기'와 '방향'이 별개 정보 — 요약 문장에 방향까지 실어야 크래시 장에서 정확.
- 조사 판정 기록: 크로스섹셔널 12-1이 우리 가격축(추세 구조)에 없던 진짜 갭 / C안(unified-reco 모멘텀 축에 12-1 직접 반영)은 **비추천으로 기각**(기존 리비전+추세가 학술적으로 충분·점수 체계 흔들 위험). 52주 신고가 모멘텀(George-Hwang)이 크래시에 덜 취약하다는 후속 연구 = 우리 hi52 선택의 학술적 방어.


## 🏗️ 부동산 공급 파이프라인 — 보강 1탄 (2026-07-17)

부동산 전수 조사(2026-07-16) 후 사용자 확정("전부 하나씩") 첫 구현 — 벌집(수요 국면)의 반쪽인 **공급 사이클**. 벌집 페이지 하단.
- **전수 조사 결과(백로그 태스크 등록)**: ①공급 파이프라인 ②소비심리+주간지수(R-ONE ID 확보) ③월세·전환율 축(R-ONE A_2024_00155~158 실측 확인) ④교육 모듈(갭투자 시뮬·주택vs코스피 — ECOS 291Y524 시도별 주택시가총액 1995~) ⑤Phase4 포트폴리오 통합+분양축+PIR 근사(903Y202 가구소득). 경매 낙찰가율은 R-ONE에도 없음 재확인(보류 유지).
- **`/api/re-supply`**(공개·`re-supply-v2` 24h·maxDuration 120): 18지역(전국+17시도) × [인허가(ECOS 901Y105)·착공(R-ONE T233033129823134)·준공(T237273130004614)·미분양(ECOS 901Y074 지역 항목 I410A~S)] → **12개월 이동합** + 역사 백분위 → verdict(인허가·착공 둘 다 ≤25%='cliff 절벽 예고' / ≥75%='glut 공급 확대' / 중립).
- **`SupplyPipeline.tsx`**: 지역 칩(verdict 이모지) + 판정 배너 + KPI 4종(인허가/착공/준공/미분양 + 백분위) + 3선 시차 차트(인허가 보라·착공 청록·준공 흰색 + 미분양 앰버 우축) + 시차 교육("인허가→1~2년→착공→2~3년→준공").
- ⚠️ **R-ONE 착공·준공 CLS 실측 확정(중요)**: CLS_NM이 '총계/소계'뿐이라 지역명이 행에 없음 — CLS_ID 순서를 **역사 지문으로 검증**(전국=시도합 검산·세종 50262는 2011년 행 자체 결측[2012 출범]·대구 50154는 2021 호황 5,521→2025 침체 19 = 실제 서사 일치) → `RONE_SUPPLY_CLS` 맵 확정(수도권 우선 배열: 전국·서울·인천·경기·부산·대구…). 분류 트리 API(SttsApiTblCls)는 빈 응답이라 못 씀.
- ⚠️ **ECOS 인허가 = '연초부터 누계' 시리즈(실측 발견·v2 수정)**: 2025-12=379,834(연간)→2026-01=16,531 리셋 — 그대로 12개월합하면 186만호 뻥튀기. **월별 차분(1월은 그대로·음수 정정치는 결측)** 변환. 검산: 2025-12 시점 TTM=379,834=누계 원값 정확 일치(차분→합 왕복 무결성). 교훈: **행정 통계는 '당월 vs 누계' 계열 구분을 원값 실측으로 확인**(값이 연중 단조증가+1월 리셋이면 누계).
- **검증(라이브)**: 18/18 지역 · 전국 인허가 TTM 36.8만(백분위 7%)·착공 29.3만(18%)·준공 26.5만·미분양 65,239(re-market 동일 SSOT) → **verdict=cliff(공급 절벽 예고)** — 2025~26 실제 인허가 급감 국면과 정합. 서울·대구 cliff / 세종·경기 중립(지역 분화).
- ⚠️ **로컬 디스크 100% 사태**: C: 238GB 만석으로 check:build ENOSPC·워커 사망 — 캐시 정리(.next-build·.next·npm cache ~1.1GB 확보)로도 부족해 **로컬 빌드 검증을 Vercel 원격 빌드(Ready 확인)로 갈음**(tsc·lint는 로컬 통과). 사용자 디스크 정리 필요 고지.


## 🧠⚡ 부동산 보강 2탄 — 소비심리지수 게이지 + 주간 매매 펄스 (2026-07-17)

부동산 전수 조사 백로그 태스크 #2. 둘 다 R-ONE 실측 기반·기존 인프라 재사용.
- **④ 소비심리지수 게이지**(`re-gauge` v1→v2·`ReDeepGauges` 4번째 카드): 국토연구원 주택시장 소비심리지수(T232543129897499, 2011-07~ 15년, MM·ITM 10001) — 전국·서울·수도권·지방 4계열 + **시도 스냅샷은 CLS 미지정 1콜**(최근 3개월 전 지역 행 → RONE_PSY_CLS 역맵으로 지역명 부여). 공식 3국면(<95 하강 / 95~115 보합 / ≥115 상승) 배지 + 지역 칩(높은 순) + 15년 차트(115/95 기준선). ③수급지수(중개사 현장)와 ④심리지수(일반 가구 기대·전망)의 축 차이를 교육 캐비엇으로 명시.
- ⚠️ **심리 CLS도 '소계'뿐** — 착공·준공과 동일하게 역사 지문으로 확정(2011 지방강세: 지방 136>수도권 123 / 2026 수도권강세: 서울 130>지방 106 — 두 국면 일관). `RONE_PSY_CLS` 맵 lib/rone 등재(전국 50004·수도권 50005·서울 50006·지방 50008 + 17시도).
- **⚡ 주간 매매 펄스**(`/api/re-weekly` 신설·`WeeklyPulse` — 벌집 페이지 HoneycombCycle 다음): 부동산원 주간 아파트 매매가격지수(T244183132827305, **DTACYCLE_CD=WK·WRTTIME=YYYYWW**) 19지역 ~131주 — 1주/4주/13주 변화율 랭킹 + 26주 스파크 + 전국·서울·수도권 추이. "월별 벌집보다 빠른 전환점 신호" 프레임 — 실측 사례: 벌집 서울=③침체진입(거래 마름)인데 주간은 서울 +0.3% 상승 1위(가격↑·거래↓ 서사 일치).
- ⚠️ **주간지수는 2026-06 재기준=100** — 절대 레벨 과거 비교 무의미, 변화율로만(UI 캐비엇 명시). 주간 테이블은 CLS_NM에 실제 지역명이 옴(소계 아님 — 심리와 반대, 테이블별 실측 원칙 재확인). `RONE_WEEKLY_CLS` 맵 등재.
- **lib/rone `roneSeries` 확장**: `cycle` 파라미터('MM'|'WK', 기본 MM — 기존 호출부 무변경) + `clsId: null` 허용(CLS 미필터 스냅샷) + `RoneRow.clsId` 필드(소계 행 식별용).
- 검증(라이브·독립 재계산): 심리 202605 원값 완전 일치(전국 114.9·서울 129.9·지방 106.3·제주 91.7, 202606 빈 응답=발표 시차) · 주간 3지역(전국·서울·제주) 1주/4주/13주 소수점 일치 · 두 화면 렌더·콘솔 에러 0. 캐시: re-gauge-v2·re-weekly-v1(둘 다 부분 실패 박제 금지).

## 🐛 부동산 대시보드 전수검증 + 외부 fetcher no-store 수정 (2026-07-17)

사용자 화면검증 요청 → ECOS·R-ONE 원천 독립 재계산으로 전 수치 대조. **re-market 전 수치 원천 완전 일치**(기준금리 2.5·주담대 4.32·KB YoY +3.4%=101.748/98.417·미분양 65,239호 백분위 56%=233개월 표본·실거래지수 서울 196.3/수도권 158.7/전국 129.4·미분양 피크 2009-03 165,641호·케이스실러 332.7·모기지 6.33%). 적정성 게이지(−28.6%·백분위 60%·269개월)도 원천 재계산 소수점 일치.
- ⚠️ **검증이 잡은 진짜 버그 — Next Data Cache가 외부 원천 GET을 박제(3번째 재발)**: M2 배수(102.9 vs 원천 103.5)·수급 기준월(2026-05 vs 원천 2026-06) 미세 불일치 추적 → `re-gauge?refresh=1`로 강제 재계산해도 옛 값 → **`ecos.ts`·`rone.ts`·`rtms.ts` fetch에 no-store 부재**가 진범. endYm이 같은 달이면 URL이 동일 → Next Data Cache가 옛 응답을 박제 → 원천에 새 달(M2 202605·수급 202606)이 발행돼도 재계산이 박제된 응답으로 계산됨(부동산 전 화면 잠재 영향).
- **수정**: 3파일 fetch에 `cache: 'no-store'`(seoulApt는 기적용). 수정 후 refresh → M2 103.5/아파트 8.7(202605)·수급 2026-06(전국 98.8·서울 112.6·수도권 104.7·지방 93.5) 정상 유입, 화면 렌더·콘솔 에러 0 확인.
- ⚠️ **교훈(패턴 확정)**: re-map(supabase)→appCache(전역)→이번(외부 데이터 fetcher)까지 같은 함정 3회 — **App Router에서 쓰는 모든 GET fetch(내부 supabase든 외부 API든)는 URL이 날짜별로 안 바뀌면 no-store 필수**. 새 fetcher 작성 시 기본 탑재할 것. "refresh를 해도 옛 값"이면 앱 캐시가 아니라 Next Data Cache부터 의심.

## 🐝 벌집순환모형 화면 전수검증 + vol3m 표시 창 버그 수정 (2026-07-17)

사용자 화면검증 요청(벌집·정밀지도·국면카드·주간펄스·공급 서울) — R-ONE·ECOS 원천 독립 재계산으로 대조.
- **판정 전수 정합**: 18개 지역 국면 배지를 judge 규칙(가격 3m ±0.3 밴드 × 거래 YoY 부호)에 수동 대입 — 엣지 포함 전부 일치(충북 +0.3=경계값→보합→④·경북 −0.3→보합→①·부산 0%→①). 국면 칩 카운트(3·2·1·3·2·6, 전국 제외)·정밀 지도 좌표 배치·육각형 꼭짓점 배정 일치.
- **원천 재계산 일치**: 전국·서울·경기·울산·세종 가격 3m·거래 YoY 소수점 일치(서울 +2.0=102.7/100.7 · −6.9%=22,900/24,599). ⚠️ 재계산 시 기준월 주의 — 가격은 202606까지 발행됐지만 **거래량이 202605까지라 판정 기준월=둘 다 있는 202605**(내 첫 재계산이 202606 창으로 어긋났던 원인).
- 🐛 **vol3m·asOf 표시 창 버그(검증이 발견·수정, v2→v3)**: 서울 배너 '3개월 16,467호'가 실제 판정 창 합(22,900호)과 상이 — vol3m·asOf가 **가격 최신월(lastYm) 기준 창**을 써서 거래량 미발행 달(202606=0)이 합에 혼입돼 과소 표기 + '기준 2026-06' 라벨도 판정 창(2026-05)과 불일치. 판정·YoY는 nowM 창이라 정확(표시만 어긋남). → vol3m·asOf를 nowM 기준으로 통일, reader(re-apt 국면 연동) 캐시 키 동시 버전업. 검증: 배너 22,900호·기준 2026-05, 국면·카운트 불변.
- **공급 파이프라인 서울 4축 완전 일치**: 인허가 4.1만·18% / 착공 3.1만·10% / 준공 4.5만·7% / 미분양 985호(202605)·55% — 누계 차분·TTM·백분위 전 과정 재계산 일치, cliff 판정(둘 다 ≤25%) 정합.
- 주간 펄스는 전일 검증 완료분(전국·서울·제주 소수점 일치) + 상승8·하락1·보합10 카운트 손검산 일치. 교육 스토리 정합: 벌집 서울 ③침체진입(가격↑·거래↓) ↔ 주간 서울 +0.3% 상승 1위.
- ⚠️ **교훈**: 두 시계열(가격·거래)을 합성하는 지표는 **모든 표시값이 '둘 다 존재하는 기준월' 한 창**을 써야 한다 — 한쪽 최신월을 기준 삼으면 미발행 달이 0으로 섞여 조용히 과소 표기된다(PER 밴드 폴백 이중해석·같은 null 다른 폴백 교훈의 시계열 버전).

## 💰 부동산 보강 3탄 — 월세·수익률 축 (2026-07-17)

백로그 태스크 #3. "월세로 돌린 이율이 대출이자를 이기는가" — 임대시장의 금리(전환율)를 레버리지 비용(주담대)과 대조.
- **Phase 0 실측 판정**: R-ONE A_2024_00155~158 = 전부 ITM 100001 '전월세 전환율'·CLS 29개(실명)·2011-01~ 185개월. **주택유형은 2021-06 저금리기 지문으로 확정** — 아파트(4.95) < 종합(5.76) < 단독(7.01) 서열 → **157=아파트**·155=종합·158=단독·156=시군구. ⛔ **ECOS 월세지수(901Y115)는 정직 제외** — 실측 결과 2024-05에서 중단 + 같은 TIME 3중복 오염 + 서울(R70F) 데이터 없음.
- **`/api/re-rent`**(공개·`re-rent-v1` 24h·부분실패 박제 금지): 전환율 전국·서울·지방 3계열 + 시도 스냅샷(CLS 미지정 1콜 — 이 테이블은 CLS_NM 실명이라 이름 직접 매핑) + 주담대(121Y006, re-market 동일 SSOT) → **스프레드 = 전환율 − 주담대** + 역사 백분위(결정론). `RONE_CONV_TBL/CLS` lib/rone 등재.
- **`RentYieldSpread.tsx`**(/real-estate 하단): KPI 3종 + 15년 시계열(전부 %라 단일축 — 전환율 3선·주담대 점선·스프레드 Area) + 시도 칩(전환율 높은 순 + 지역 스프레드) + 교육 캐비엇(지방 고전환율 = 공실·유동성 리스크 보상 — 주식 고배당 함정과 동형).
- **단지 리서치 월세 확장**(re-apt + AptResearch 4번째 밸류 카드): 같은 면적대 월세 거래(monthlyRent>0) 최근 6개월 중위 보증금·월세·표본수 + **월세수익률 = 연월세 ÷ (매매중위 − 월세보증금중위)**(실투자금 기준) vs 주담대 비교(캐리 +/역마진권). 표본 0이면 카드 자체 미표시(정직).
- ⚠️ **캐비엇 실측 교정(자체 검증서 발견)**: 초판에 "2022~23 스프레드 0 이하 실사례"라 썼으나 **전국은 0 이하가 없었음**(최소 +0.31%p, 2022-09) — 서울만 2022-06~2023-02 9개월 실제 역마진(최저 −0.83%p). 실측값으로 문구 교체. 교훈: 캐비엇의 역사 사례도 데이터로 검증 후 쓸 것(박제 금지의 문구 버전).
- **검증(라이브·독립 재계산)**: 전국 전환율 6.17 = 원값 6.1663 일치 · 스프레드 +1.85 = 6.17−4.32 검산 · 백분위 19%(캐리 축소 — 2011~16 고스프레드 역사 대비 정합) · 시도 서열(울산 11.2% 최고 → 서울 4.7% 최저 = 현실 정합) · 도곡렉슬 60㎡ 월세 5.4억/181만(34건) → **수익률 1.0% = 181×12÷(27.8억−5.4억) 소수점 검산 일치**(강남 1%대 = 시세차익형 현실 정합·역마진권 표시) · 두 화면 렌더·콘솔 에러 0.

## 💸📈 부동산 보강 4탄 — 갭투자 X-Ray + 주택 vs 코스피 (2026-07-17)

백로그 태스크 #4를 사용자 협의로 재해석 — 순수 교육 시뮬레이터("보통 교육모듈 별로 필요치 않아") 대신 **Zero-Input 실전 관측 도구 2개**, LTV/DSR 계산기는 드롭(입력 필요·규제 하드코딩 위험·은행 앱 대체). 목업 시안 제시 → 사용자 확정.
- **💸 갭투자 X-Ray**(단지 리서치 밸류 카드 아래): 실투자금(갭=매매중위−전세중위)·레버리지 배율(매매÷갭·가격 10% 변동=내 돈 N% 양방향)·**역전세 스트레스 = 전세중위 × 시도 아파트 전세지수 역사 최대 낙폭(실측)** — 슬라이더·가정 0. 시도 MDD는 `jeonse-mdd-v1:{시도}` 30일 캐시(역사 낙폭 준불변).
- ⭐ **전세지수 테이블 지문 확정(A_2024_00053)**: R-ONE 테이블 ID 미공개 → 매매지수(00045) 인접 ID 지문 스캔 — 서울 2022-06→2023-07 낙폭으로 판별(00045 매매 −10.7%·00048 −11.1% vs **00053 −19.1% = 전세 특징**, KB 서울 아파트 전세 −16.0% 동일 구간·형태 대조로 확정 — 부동산원이 KB보다 낙폭 크게 잡는 특성). **CLS는 매매지수(RONE_PRICE_CLS)와 완전 동일 체계 실측** → 그대로 재사용. 이력 2003-11~272개월. ⚠️ 00050(−18.8%)은 시군구 테이블이라 CLS 500008이 다른 지역 — **미지 테이블 지문 스캔 시 CLS 구성부터 확인**(테이블별 CLS 함정의 지문 스캔 버전).
- **📈 주택 vs 코스피**(`/api/house-vs-kospi` 7d + `HouseVsKospi` — /real-estate 하단): KOSPI지수(802Y001 일별 1콜 8천행→연말 추출) vs KB 아파트지수(전국·서울) **가격끼리** 재기준 로그 레이스 + **구간 토글(1995~/2010~/최근10년)** = 시작점 효과 교육. 주택시가총액(291Y524, 전국 1995~·시도 2010~·십억원)은 보조 KPI — **"시총은 신축 재고 증가 포함이라 가격 상승과 다름"** 캐비엇으로 지수 비교가 공정한 이유 명시. ⛔ 코스피 시가총액 시리즈는 ECOS 부재 실측(통계표 전수 검색) → 시총 vs 시총 비교 불가 판정.
- **검증(라이브·독립 재계산)**: 서울 전세 MDD −19.5%(트로프 2023-07) 원천 재계산 완전 일치 · 도곡렉슬 갭 17.8억=27.8−10 ✓ 레버리지 1.6=27.8÷17.8 ✓ 스트레스 2.0억=10×19.5% ✓ · 노원 중계그린(전세가율 47%) 레버리지 1.9배 > 강남 1.6배(교육 대조 작동) · 코스피 7.7배=6820.6÷882.94(1995 연말) ✓ 아파트 전국 3.2배·서울 5.1배 · 2010~ 토글 시 코스피 3.3·서울 1.9배로 재계산(시작점 효과 실데이터 확인) · 주택시총 822조→7,158조(8.7배) · 두 화면 렌더·콘솔 에러 0.
- 스토리: 지수 기준 30년은 코스피 승(7.7 vs 5.1) — 단 배당 미반영(코스피 유리하게 과소)·전세 레버리지·거주가치 미반영(아파트 유리하게 과소) 양쪽 캐비엇 병기(정직).

## 💼 부동산 보강 5탄(Phase 4) — 관심 단지 워치리스트 + 국면 전환 알림 + 분양축 (2026-07-17)

부동산 백로그 마지막 태스크. "포트폴리오 통합"의 실체 = 학생이 아파트를 보유 등록할 순 없으니 **주식 관심종목의 부동산판(우리 집·이사 갈 집 모니터링)**으로 설계.
- **⭐ 관심 단지 워치리스트**: `re_watchlist` 테이블(supabase/re_watchlist.sql — ⚠️ SQL Editor 1회 실행 필요·RLS 본인만) + `/api/re-watchlist`(GET=목록+시세 요약·POST·DELETE). GET 요약은 **rtms 월캐시 재사용**(단지·면적대 ±2㎡ 최근 6개월 매매/전세 중위·최근 거래일·벌집 국면 조인, 상한 10단지). 단지 리서치 헤더에 `StarAptButton`(미로그인·테이블 미생성 시 숨김) + `/real-estate` 상단 `ReWatchlist` 카드(딥링크 `?lawd=&apt=` — AptResearch `initialApt` 지원 추가). 테이블 미생성 시 `needsSetup` 정직 반환(관리자 안내 문구).
- **🔔 벌집 국면 전환 알림**(`RePhaseAlert` — /real-estate·벌집 페이지 상단): re-honeycomb 재계산 시 직전 스냅(`re-phase-latest`)과 diff → `re-phase-changes`(7일 배너·응답 `phaseChanges` 필드). 타점 워처 패턴 — 첫 재계산은 베이스라인, 알림은 다음 국면 변화부터. 전환 없으면 렌더 0.
- **🏷️ 분양축**: 공급 파이프라인에 신규 분양세대수(R-ONE T244633134461863, 2015-10~·ITM 10001) 4번째 선 — **인허가→분양→착공→준공 완성**. ⚠️ CLS가 착공·준공 테이블과 또 다른 체계(전국 50001·서울 50005 — 실측 `RONE_PRESALE_CLS`). re-supply v2→v3(분양 ttm은 2016-09부터 — 12개월 창 정직 null).
- **실측 후 정직 보류 2건**: 매입자 연령대(A_2024_00610)는 **GRP(지역)×CLS(연령대) 2축 구조**라 현 fetcher(CLS 필터만)로 지역 분리 불가 — GRP_ID 필터 지원 확장 후 재도전. PIR(903Y202)은 여러 세부값(소득 6,762만원·자산·가구원수)이 한 항목에 혼합된 요약 통계라 차원 분리 실측 필요.
- **검증(라이브)**: 분양 전국 TTM 131,742호 = 원천 12개월 합 **정확 일치**·백분위 17%(인허가 7%·착공 18%와 절벽 서사 정합)·분양 포인트 117개월(2016-09~) · KPI 5종·범례 렌더 · 비로그인 graceful(워치리스트·별버튼 숨김, API 401) · 콘솔 에러 0. 워치리스트 E2E는 테이블 생성 후 사용자 확인 필요.

## 🔍 관심 단지 E2E + 공급 파이프라인 화면 전수검증 — med 관례 통일 (2026-07-17)

사용자가 re_watchlist SQL 실행·단지 2곳 등록 후 화면검증 요청 — 캐시 원본(deals) 직접 재계산으로 대조.
- **⭐ 관심 단지 E2E 완전 일치**: 올림픽선수기자촌2단지 83㎡(6건·중위 28.5억·전세 8억·28.1%·최근 07-03)·압구정 한양1차 50㎡(3건·39억·5.7억·14.6%·06-05) — app_cache의 rtms 월캐시 deals를 꺼내 개별 거래가까지 나열·독립 재계산 = 카드와 완전 일치.
- 🐛 **med 관례 차이 발견·수정(제2원칙 위반)**: 같은 단지 매매중위가 관심 카드 28.5 vs 단지 리서치 28.4 — 교차 검증이 잡음. 원인 = 신설 워치리스트 med가 **짝수 표본에서 상단값**(s[m]), re-apt·re-map은 **두 가운데 값 평균**(표준 중위). 동일 6건 [27.7,27.9,28.4,28.5,28.7,29.9]에서 28.5 vs 28.45→28.4로 갈림. → 워치리스트 med를 표준 관례로 통일(수정 후 카드=리서치 동일값). ⚠️ 교훈: **중위값도 제2원칙 대상 — 새 라우트에 med를 다시 쓰지 말고 관례(짝수=평균)까지 복사할 것**(같은 null 다른 폴백·같은 지표 다른 창 교훈의 통계 함수 버전).
- **공급 파이프라인 검증**: 분양 13.2만=원천 12개월 합 일치(기검증) · **준공 26.5만 백분위 1% = 재계산 일치 + 현재값이 2011년 이후 역대 최저 실측**(min=현재 — "지금 입주 물량이 15년래 최저") · 인허가 TTM 피크 2016-06 85.4만호 = 차트 좌측 최고봉 정합 · 미분양 우축 피크(2008-09 16.5만) 정합.
- 벌집 시계는 직전 전수검증과 동일(변경 없음).

## ⚖️ 모닝 표면 3종 정합성 — 타점 신호 × Jarvis 펀더 교차 주입 (2026-07-18)

사용자 지적("Jarvis 처방전·타점 신호·매매 브리핑이 서로 모순되지 않는지 검증") — 실측으로 **양방향 모순 2건 확정 후 해소**.
- **실측 모순**: 타점 배너 PLTR '🎼 첫 눌림목(매수 기회)' ↔ Jarvis 'SELL(매도검토)' — 선생님 화면의 매도검토 1이 정확히 PLTR(같은 아침 한 화면에서 매수·매도 동시 노출). 역방향도: VRT 타점 '하방 분출(매도)' ↔ Jarvis 'BUY'. 원인 = 버그가 아니라 **두 표면이 다른 축**(타점=기술 WHEN·Jarvis=펀더 WHAT)을 설명 없이 병렬 노출(ETN 가치×모멘텀 사건과 동일 클래스).
- **수정(ETN 2축 융합 전례)**: `/api/timing-watch` 서빙 라우트가 본인 최신 `user_daily_briefings` 판정을 `sig.fund`로 주입(개인화·graceful) → `TimingWatchBanner`·브리핑 ① 칩이 충돌 시 **'⚠️ 펀더 매도검토'/'🟢 펀더 매수기회' 병기** + 툴팁(매수타점+펀더SELL="신규 진입·불타기 자제, 반등은 정리 기회" / 매도타점+펀더BUY="저점 매도 주의"). 신호 자체는 숨기지 않음(정직) — WHAT은 펀더멘탈 우선 원칙 명문화.
- **나머지 표면 정합 확인**: 리밸런싱 ②정리할 것의 PLTR(줄일 것)=Jarvis SELL 방향 일치 ✓ · SK하이닉스 트림은 분산 목적(사유 명시된 정당한 다층·Jarvis BUY와 비모순) ✓ · ③담을 것(unified-reco)은 보유 제외라 무관 ✓.
- 검증: 선생님 계정 시뮬(보유 PLTR·최신 판정 SELL → 칩 발동 확정) — 배너는 RLS라 화면 확인은 사용자 새로고침으로.
- ⚠️ 교훈: **같은 종목이 두 요약 표면에 동시에 뜰 수 있으면 축이 다른 신호끼리 반드시 교차 주입** — 신호를 숨기는 게 아니라 두 축을 한 칩에 병기(반복 패턴: ETN 뉴스레이더·신호등 green게이트·관망 리워딩에 이은 4번째).

## 📏 볼린저 밴드 오버레이 (2026-07-18) — SNS 포스터 2종 검토 → 1건 채택

사용자 공유 포스터('12 Price Action Patterns' SMC 오더블록 12종 + '볼린저 밴드 롱 포지션') 전수 대조 → **12+1개 중 진짜 갭 1건만 채택**(선별 원칙).
- **기구현/기각 판정**: SMC 12패턴은 전부 오더블록 변주 — 스윕+OB=💧스윕 ✓·FVG+OB=📦FVG ✓·더블바텀=전저점 스윕 ✓·CHoCH/BOS=신호등 전환·여정·레벨 소멸 3층 커버 ✓·리테스트=눌림목·라쉬케 ✓. **오더블록 자체는 기각** — FVG와 존 중복(5번째 존=클러터) + 임펄스 판정 주관(LuxAlgo "SMC 중 FVG만" 원칙 재확인). 추세선=주관 기각(엘리어트 동일). 볼린저 매매법(스퀴즈→상단 돌파 롱)은 🔥TTM Squeeze가 상위호환 기구현.
- **채택 1건 — 볼린저 밴드 3선 오버레이**: `techSignals.computeBollinger(20, 2σ)`(TTM 내부와 동일 수학 — 모집단 σ) + 기술차트 폴리라인(상·하단 파랑 1.1px·중단 SMA20 노랑 점선) + 📏토글(기본 OFF) + **🔥 변동성 돌파 렌즈 편입**(LensCfg.bb — 전 렌즈 cfg 동기화 필수) + 범례 2항목 + 읽는 법 카드(**밴드 워킹=강추세 특징 vs 횡보 상단터치=되돌림 — ADX 문맥 없이 단독 신호 금지** 캐비엇). 추가 fetch 0·점수 미반영.
- 검증(라이브): NVDA 501봉 독립 재계산(상단 214.59·중단 202.12·하단 189.66 — 동일 수식 구조 보장) · 렌즈 클릭 시 파랑 path 2+중단 점선 1 렌더·범례·교육 카드·렌즈 설명 갱신·콘솔 에러 0.

## 🔍 원익IPS 기술차트 화면 전수검증 — 오실레이터 5종 소수점 일치 + 워딩 충돌 2건 수정 (2026-07-18)

사용자 화면검증 요청(240810 일봉·변동성 돌파 렌즈) — 프로덕션 캔들 480봉으로 전 지표 독립 재계산.
- **수치 완전 일치(소수점)**: 등락 −1.40% · RSI 52.4(50돌파 1봉 전: 47.1→53.2 정확) · CCI −9 · MFI 41.6 · ADX 17.8 · MACD 시그널 아래▼ · **ATR14=18,707.3→손절 103,285**(라벨 소수점까지) · POC 119,709(+17.5%)·VA 97,978~147,235 · 라쉬케 하락 다이버전스(고점 183,300/RSI 69.8 → 187,800/57.7 — 가격 HH·RSI LH 정확) · EMA 정배열(120,421>98,995) · VWAP +13.3% · 볼린저(상단 181,661·중단 140,510·하단 99,359 — 급등락 구간 밴드 확장 시각 정합).
- 🩹 **워딩 충돌 2건 수정(문구 리워딩 교훈의 판독기 적용)**: ① 배지 '정배열·구름 위(강세)' vs 판독기 "ADX로 **추세가 죽은** 박스권" → "추세 강도가 약한 박스권(방향 확신 낮음 — 정배열 등 구조 신호와 별개)" ② 같은 라쉬케 카드에서 "RSI 50 돌파·**매수세 장악**" 체크 vs 매도 박스 "**에너지 소진**(다이버전스)" 정면 충돌 → bearDiv 병존 시 '단기 재점화(다이버전스 경고 병존 — 소진 후 반등일 수 있음)'로 완화 + 연쇄 진행 문구에 신중 캐비엇. 시간창이 다른 신호(스윙 고점 소진 vs 직전 눌림 재점화)는 둘 다 참이지만 워딩까지 충돌하면 안 됨(IBB 0/3·관망 리워딩과 동일 클래스).
- 참고: ⬛관망 칩이 안 뜨는 건 정상(green 신호등 게이트 — 정배열+구름 위) · ADX 칩 '박스권' 상시 노출은 판독기 전용 설계 유지.

## 💸 연말 절세 도우미 — 해외주식 양도세 손익통산 (2026-07-18) — 킬러 로드맵 #1

7대 킬러 로드맵(사용자 확정: 절세→신호성적표→이벤트캘린더→희석경보→상관레이더→펀딩비→채권축) 1탄. "더 벌게"가 아니라 **확정적으로 잃지 않게** — 세금 축이 앱에 0%였던 구조적 빈틈을 채움. 설계 `docs/tax-helper/plan.md`.
- **`/api/tax-helper`**(auth·`tax-helper-v1:{user}:{일자}:{fp}` 6h): 올해 `transactions`(sell) 집계 — **해외(currency=USD) 확정 양도차익** → 250만 공제 → 초과분 22% 예상 세금 + **남은 비과세 여유**(room=max(0, 250만−실현)). 보유 US 종목 현재가 배치 → ① taxable>0이면 **손실 매도 후보**(전량 매도 시 절약=min(손실,과세표준)×22%, 절약순) ② room>0이면 **공제 여유 익절 후보**(주당이익 → 여유 내 매도 가능 주수 — 익절+재매수=취득가 상향, 미래 절세). 세법 상수는 `TAX` 한 곳(개정 시 1곳 수정).
- **`TaxHarvestHelper.tsx`** — 거래 기록 5번째 탭: KPI 4종(확정 양도차익·공제 게이지·예상 세금·여유)+연말 D-day+후보 테이블+국내/코인 참고 칩+정직 캐비엇.
- **과세 규칙(2026)**: 해외주식·美상장 ETF=250만 공제·22%·통산 가능 / 국내 상장주 소액주주=비과세(참고 표시만) / **KR 상장 해외 ETF=배당소득세 15.4% 별도**(통산 불가 — market=KR이라 집계상 '국내'로 빠지는 것을 교육 칩으로 안내) / 코인=2027 과세 유예. **워시세일 없음** → "매도 직후 재매수로 포지션 유지하며 손실만 실현" 프레임(손절 강요 아님 — HOLD_DIP 철학 정합).
- ⚠️ **정직 캐비엇 3종(UI 명시)**: ① 환율은 현재 환율 일괄 근사(세법 정확값=결제일 환율·신고는 증권사 내역 기준) ② 이 앱 기록 기준(공제는 인별 전 계좌 합산) ③ 과세연도 귀속=결제일(T+1) — 연말 매도는 며칠 여유(컷오프 날짜 하드코딩 회피 — 휴장일마다 다름).
- **검증(실DB 독립 재계산)**: 김상균 올해 US 매도 7건 합산 $1,451.22=₩2,148,423 검산 일치 → 과세표준 0·여유 ₩351,577 → gain 후보 5종(GOOGL 주당 52,451·NVDA 26,100·MPC 98,937·XBI·IBB — 여유 내 주수·활용액 수식 정합) / 손실 보유(PLTR −33.6만 등)는 taxable=0이라 후보 제외 정확. **검증이 표시 이슈 발견·수정**: 소수점 매매 보유(GOOGL 2.968518주)가 그대로 노출 → maxQty 소수 2자리 절사 + 여유 익절 '종목별 단독 기준'(합산 시 한도 초과 가능) 주석.
- ⛔ 자동매매 없음·세무 상담 아님(교육·참고). 향후 v2: 11~12월 브리핑 ⑤스탠스 요약 1줄.

## 🔍 투자기록 4탭 화면 전수검증 — 타임머신 현재가 폴백 버그 수정 (2026-07-18)

절세 도우미 배포 직후 사용자 화면검증(절세·적중률·타임머신·현금흐름 4탭) — 독립 재계산 대조.
- **💸 절세 도우미 완전 일치**: D-166(7/18→12/31 검산)·₩215만=$1,451.22×1,480·사용률 86%=2,148,423/250만·여유 ₩35만·미래절세 ₩8만=351,577×0.22 · gain 후보 5종(NVDA 6.42주·GOOGL 2.96주·XBI 3.4주·MPC 1주·IBB 2.88주)의 주당이익·활용액 전부 재계산 일치 + 활용액 내림차순 정렬 정합. 소수점 절사 수정도 반영 확인.
- **🎯 의사결정 적중률 내부 정합 완전 검증**: 전체 29%=2/7 — 계절축(유리2×100%+중립5×0%=2승)·밸류축(고PEG1승+저PEG1승)·수급축(유입1+중립1) **세 축 모두 승수 2로 교차 일치** + 전체 평균 +2.4%가 계절축·수급축 가중평균(둘 다 2.43) 재계산과 일치. FOMC '매파장 매수 7건'=현 국면 정합.
- **💰 현금 흐름**: 순투자 2,990만=3,615−626 ✓ · 실현 +₩215만 = 절세 도우미 해외 실현과 동일값(제2원칙 정합 — KR 실현 0).
- 🐛 **👻 타임머신 복기 — 전량 매도 종목 현재가 폴백 버그(검증이 발견·수정)**: 6건 중 5건이 "현재가=매도가·+0.0%·🛡하락 방어 성공"(보유 중인 COP만 실제 −4.1%). 원인 = history 페이지 priceMap이 **보유 종목만** 조회 → 전량 매도(GEV·ETN·TEM)는 `priceMap[t] ?? tx.price` 폴백으로 가짜 판정 — **복기가 가장 필요한 전량 매도 종목이 정작 복기 불능**인 구조. 수정: ① 가격 요청을 보유 ∪ 매도 거래 티커 합집합으로 ② 미수신 시 폴백 금지 → '⏳ 현재가 미확인' + 코멘트 생성기 가드(결과 서술 금지). 수정 후 실측: GEV $1,348.67→$1,057.84(−21.6% 진짜 방어)·ETN $876→$400·TEM $7.15→$52.47(기회비용) — 진짜 복기 작동.
- ⚠️ 교훈: **폴백 값이 '판정'에 들어가면 데이터 공백이 조용히 '성공 판정'으로 둔갑한다** — 결과 배지는 원천 값 존재를 확인한 뒤에만, 공백은 정직하게 공백으로(vol3m 표시 창·med 관례와 같은 '조용한 오염' 클래스). ※ TEM 매도가 $7.15 기록은 입력 이상 가능성(사용자 확인 대상 — 데이터는 기록 그대로 표시).

## 📋 앱 신호 성적표 (2026-07-18) — 킬러 로드맵 #2 · 사이드바 📌매일

"이 앱의 신호를 얼마나 믿어야 하나"를 앱 스스로 실제 주가로 채점 — 정직 원칙(가짜 승률 금지)의 자기 검증판. 설계 `docs/signal-report/plan.md`.
- **채점 대상 v1**: ① 🤖 Jarvis SELL/BUY — `user_daily_briefings`에 2026-06-02부터 이미 적립돼 **즉시 30일+ 채점 가능**(이 기능의 착수 순서를 앞당긴 이유) ② 🚦 타점 전환 워처 — changes가 당일분 덮어쓰기라 **타이밍 크론 안에서 `signal-history-v1`에 인라인 append**(별도 크론 없이 원자적·같은 날 중복 방지·상한 2,000건). ③ 통합추천은 v2 정직 보류(auth·보유제외 얽힌 라우트 — 엔진 lib 분리 필요).
- ⭐ **Jarvis 이벤트 압축(자기상관 제거)**: 같은 종목에 매일 같은 판정이 재적재(PEG>2.2면 매일 SELL) → 행 단위 채점은 승률 왜곡 → **연속 런의 첫날만 1이벤트**(단절 >7일 또는 판정 변경 시 새 이벤트).
- **`/api/signal-report`**(공개·`signal-report-v1:{일자}` 12h·이벤트 0건이면 캐시 박제 금지): 가격 SSOT = `techChartData` 480일봉(타이밍 크론이 매일 전 보유 종목을 캐시 워밍 — 추가 부하 ~0). 진입가=이벤트일 이하 최근 종가(±1일 캐비엇), **+30일**(익은 것만)·**현재까지**(7일+만 — 하루 노이즈 배제) 수익률. 승 판정: BUY=상승 / **SELL=하락**("피했으면 면한 손실" — 공매도 아님 UI 명시). 익명 관례=승패 해부실 보드와 동일(종목 신호만·보유자 무표기).
- **`/signal-report` 페이지**: 소스×방향 4그룹 카드(적중률·30일/현재 평균·베스트/역주행 사례 칩·최근 이벤트 표) + 표본수 상시 병기 + 캐비엇(선택 편향·배당 미반영·과거≠미래).
- **첫 채점 실측(교육적으로 극적인 결과)**: Jarvis **SELL 27건 — 30일 적중률 87%·평균 −15%**(매도검토가 실제로 하락을 맞힘) vs **BUY 14건 — 적중률 18%·평균 −9.5%**(현 반전장에서 매수기회 신호 부진 — 모멘텀 크래시 국면과 정합하는 정직한 성적). 역주행 사례도 정직 노출(PLTR SELL 후 +16.6%·ALIT +89.7%).
- **검증**: AAPL SELL(06-11 entry 295.63→30일 +6.7%→현재 +12.9%)·LG전자 BUY(06-12 225,500→−19.1%→−20.6%)·TXN(경과 23일이라 ret30 null=게이트 정상) — 독립 재계산 소수점 완전 일치.
- ⚠️ 타이밍 그룹은 2026-07-18부터 적립(첫 화면은 '적립 중' — 익일 크론부터 채워짐).
- 🐛 **화면 전수검증이 잡은 절단 버그(v1→v2)**: 그룹 통계 8종·칩 4종·최근 16행은 재계산과 소수점 완전 일치했으나, TXN 원시 시계열 추적에서 **07-08 신규 런 이벤트가 누락**된 것을 발견 — 진범 = **Supabase select 기본 1,000행 상한**(SELL/BUY 1,456행 중 오름차순 1,000행=~07-04까지만 수신 → 7월 신호 통째 절단). range 페이지네이션 + **id 보조 정렬**(동일 base_date가 페이지 경계에서 중복/누락 방지) 수정 → SELL 27→29(TXN 07-08·한국카본 07-11)·BUY 14→16(SK하이닉스 07-18) 정상 유입. ⚠️ 교훈: **집계 라우트가 큰 테이블을 select할 땐 1,000행 상한을 항상 의심 — "최신 데이터가 특정 날짜에서 끊겨 보임"이 전형 증상**(외부 발행 지연 동결 패턴의 DB 버전). 다른 전량 조회 라우트(school-league 등)도 행수 증가 시 같은 함정 후보.

## 📅 내 종목 이벤트 캘린더 (2026-07-18) — 킬러 로드맵 #3 · 자산 관리 상단 + 브리핑 ①½

보유 종목의 어닝 D-day·배당락·지급일 타임라인 + 배당 현금흐름 — 매매 플랜의 갭 리스크 경고를 '날짜'와 연결. 설계 `docs/event-calendar/plan.md`.
- **`/api/event-calendar`**(auth·`event-calendar-v1:{user}:{일자}:{fp}` 12h): 보유 US·KR 주식+ETF(크립토 제외·같은 티커 수량 병합) → Yahoo `calendarEvents`(어닝·배당락·지급일)+`summaryDetail`(연배당·시가배당률)+`chart events=div`(최근 12개월 지급 이력) 동시성 4·KR .KS→.KQ 폴백. 산출: ①향후 90일 이벤트 타임라인(D-day 순) ②연간 예상 배당 ₩(수량×연배당×환율) ③**월별 예상 배당 = 과거 12M 지급 이력을 다음 해 같은 달로 투영**(추정 명시).
- **`EventCalendarPanel`**: 풀(자산 관리 상단 — 타임라인+연간/월별 배당 바차트+종목별 표, 어닝 D-7 이내 '갭 변동성 주의' 배지) / 컴팩트(**브리핑 ①½ 이번 주 이벤트** — D-7 이내만·없으면 렌더 0·자체 헤더+자산관리 딥링크). 같은 API 공유(제2원칙).
- ⭐ **검증이 뒤집은 가정 2건(원천 실측)**: ① **KR 어닝일이 Yahoo .KS에서 실제 제공**(SK하이닉스 07-28·KB금융 07-23 — sectorEngine 시절 "KR은 null" 가정은 보유 대형주에선 깨짐) → "KR 미제공" 단정 캐비엇을 조건부(`krNoEarnings`)·완화 문구로 교정 ② **calendarEvents 배당락은 지난 일정인 경우 다수**(다음 일정 공시 전) → `dd≥0` 필터가 정확히 걸러냄 + "다음 일정 공시 전엔 안 보임" 캐비엇 추가. 교훈: **"이 소스는 안 준다"는 과거 실측도 대상 집합이 바뀌면 재실측**(옛 지식으로 단정 금지 패턴의 자기 가정 버전).
- 실측(교사 계정): 어닝 시즌 정중앙 — GOOGL D-4·KB금융 D-5·SK하이닉스 D-10·PLTR D-16·MPC D-17·COP D-19·NVDA D-39 / 연배당 US $16.85+KR ₩10,798. 브리핑 ①½가 이번 주 GOOGL·KB금융으로 즉시 발동.
- 정직 캐비엇: 어닝일 수시 변경(±수일)·월별 배당은 과거 패턴 투영(증배·감배 미반영)·환율 현재 기준.
- ✅ **화면 전수검증(같은 날)**: 자산 관리 캘린더 — 어닝 7건 D-day·날짜(GOOGL 07-22 D-4 ~ NVDA 08-26 D-39) 원천 실측과 완전 일치 · 배당 표 7행(9,506/6,000/5,788/5,783/4,598/3,867/200원)·합계 ₩4만·23종목(25보유−코인−원자재) 검산 일치 · **월별 바 재구성 완전 일치**(8·9·11·12·2·3·5·6월 지급·2월 최대 8,281원·7/10/1/4월 공백). 브리핑 ①½도 정상 작동(D-7 필터라 2건만 — GOOGL D-4·KB금융 D-5, SK하이닉스 D-10은 설계상 제외 — "브리핑에 없다"는 인상은 D-7 컴팩트 설계). 검증이 잡은 표시 이슈: 1만 미만 월 금액이 전부 '0만' → 천 단위 표기 수정(4,360원→4천).
- 🐛 **배당 SSOT 통일(v1→v2, 대시보드 화면검증 발견)**: 캘린더 연 ₩4만·7종목 vs 대시보드 KPI '월간 예상 배당금' 연 ₩12만·16종목 — **3배 어긋난 제2원칙 위반**. 원인 = 캘린더가 Yahoo `summaryDetail.dividendRate` 직접 사용 → **ETF 분배금이 전부 null**(KR TIGER류·US XLP/IBB — 빠진 최대 몫이 TIGER 미국S&P500 3.2만·TIGER 200 2.9만). 수정: 연배당·수익률 = **`/api/stock-info fundamentals.annualDividend`**(대시보드 KPI와 동일 SSOT·KR ETF는 stock-info 내부에서 네이버 합산) + Yahoo는 날짜(어닝·배당락)·지급 이력 투영만 담당 + **연간 집계를 심볼 루프 밖으로**(Yahoo 미해석 KR ETF도 포함). 검증: 재현 계산 16종목·연 122,397원 = 대시보드 KPI 정확 수렴. 교훈: **배당·PEG처럼 이미 SSOT가 지정된 지표는 새 기능에서 원천 API를 직접 때리지 말 것** — "같은 지표 = 같은 출처"는 신규 화면에도 소급 적용(PEG SSOT 사건의 배당 버전).
- 🚨 희석 경보 배너 화면검증(대시보드): SK하이닉스 유상증자 NEW·07-10(최신 정정 디듀프)만 표시 = **개인화 정확**(대한광통신·파두·한국카본은 타 학생 보유·KB금융 자회사 증자는 필터 제외) · 타점 배너 PLTR '첫 눌림목+펀더 매도검토' 병기 = Jarvis 처방전 '매도검토 1'과 정합.

## 🚨 DART 희석 경보 (2026-07-18) — 킬러 로드맵 #4 · 대시보드 상단 배너

유상증자·CB·BW·EB·감자 = 개미 계좌를 실제로 깨뜨리는 이벤트 1순위인데 앱이 침묵하던 영역. 보유 KR 종목의 DART 공시를 감시. 설계 `docs/dilution-alert/plan.md`.
- **Phase 0 실측이 필터를 만들었다**(원시 키워드 매칭 20건 분석): ① "유상증자결정(**종속회사/자회사**의 주요경영사항)"은 모회사 주주 희석 아님 — SK하이닉스·KB금융·한화에어로가 전부 이 유형(우량주 오탐의 주범) → 제외 ② "자기교환사채 **만기전취득**"·매수선택권행사 = 오버행 축소(호재)인데 키워드에 걸림 → 취득/상환 제외 ③ 발행가액확정·청약결과는 후속 노이즈 → **주요사항보고서(…결정) 본공시만**.
- **`/api/dilution-alert`**(auth·종목별 공유 캐시 `dilution-v1:{ticker}:{일자}` 24h — 학생 간 공유·제2원칙·013(결과없음)도 캐시): 보유 KR STOCK → getCorpCode + `list.json` 180일 → CORE−EXCLUDE 필터 → 유형 분류(유상증자/CB/BW/EB/감자) → **종목×유형 최신 1건 디듀프**([기재정정] 중복 컷 — SK하이닉스 결정+정정 2회=1이벤트).
- **`DilutionAlertBanner`**: 대시보드 상단(타점 워처 아래) — 경보 없으면 렌더 0. 칩=유형 배지+종목+날짜+**DART 원문 링크**(dsaf001/main.do?rcpNo=)+NEW(30일 내). "⛔ 매도 지시 아님 — 용도·규모는 원문 확인(성장 투자용 증자도 있음)" 캐비엇.
- **실측(원시 20→필터 8→디듀프 5건)**: ⭐ **SK하이닉스 본체 유상증자(06-24 결정·07-10 정정)**·**파두 CB 발행(06-30·NEW)**·대한광통신 유상증자(02-23)·한국카본 감자(05-13)·LG전자 감자(02-12) — 보유 종목에 진행 중인 진짜 희석 이벤트가 실재(기능이 첫날부터 실전 작동).
- ⚠️ 교훈: **DART 공시 키워드 매칭은 반드시 실측으로 오탐 유형을 걸러야 한다** — '유상증자'라는 단어만 믿으면 자회사 증자·후속 공시·오버행 축소(호재)까지 경보가 되어 우량주마다 빨간불이 뜬다(신호의 절반 이상이 오탐이었음: 20→5).

## 🕸️ 이종 자산 상관 수렴 레이더 (2026-07-18) — 킬러 로드맵 #5 · 막스 시계추 탭(MarksCycle 하단)

주식·채권·금·달러·BTC 5축의 일별 수익률 상관을 롤링으로 재고 **"위기 시 ρ→1 수렴"**(모든 자산이 함께 떨어져 분산 소멸)을 경보로. 앱의 corr-matrix(내 개별 주식 간 상관=전부 기술주면 가짜분산)와 달리 **이종 자산군(asset class) 간** 상관 = 포트폴리오 전체의 진짜 방어력. 경보만·기계적 현금화 강요 없음. 설계 `docs/correlation-radar/plan.md`.
- **`/api/correlation-radar`**(공개·`correlation-radar-v1:{일자}` 12h): 5축 캔들 = `techChartData.getTechCandles` SSOT 재사용(SPY·TLT·GLD·UUP·BTC-USD, 신규 수집 0) + HY스프레드 = `/api/macro-weather` 자기호출(위기 맥락 보조·읽기만·graceful). 공통 거래일 정렬(BTC 주말봉 자동 제외) → 일별 수익률 → 최근 30일 vs 평시 200일 피어슨 r(10쌍) → **평균 쌍상관** recent vs baseline delta. 경보 결정론: `converging`(meanRecent≥0.40 & delta≥+0.20)/`watch`(delta≥0.15 or meanRecent≥0.35)/`calm`. 축 2개 미만 503·공통 60일 미만 캐시 박제 금지.
- **`CorrelationRadar.tsx`**: 평시↔최근 5×5 히트맵 2개(양+빨강 동조/음−초록 헤지)·평균 상관 대비 KPI 3종·쌍별 변화(수렴 심한 순)·**달러(UUP)는 위기 때 오히려 오르는 진짜 헤지** 교육 포인트. 막스 시계추 탭 MarksCycle 하단 마운트.
- ⚠️ **정직 캐비엇**: 상관은 후행(과거 30일 창)·위기 예측 아님(현재 분산 상태 관측)·경보=비중·리스크 점검 신호이지 매도 지시 아님. 제미나이의 "기계적 현금화"는 거부.
- **검증(라이브·독립 재계산)**: 501 공통일·HY 2.71%(macro-weather 정합) · **stock×gold recent 0.6561·gold×dollar recent −0.6262 = Yahoo 원천 독립 피어슨 재계산과 소수점 4자리 완전 일치**. ⭐ 교육적 divergence: 금×주식 0.26→0.66·금×BTC 0.21→0.71(위험선호 동조 상승)인데 **달러는 디커플**(주식×달러 −0.27→−0.52·금×달러 −0.35→−0.63·달러×BTC −0.12→−0.49 음의 상관 심화) → 평균은 낮게(delta +0.01=calm)이나 "달러만 진짜 헤지"라는 스토리를 5축이 드러냄(단일 지표로는 못 봄).
- 🐛 **화면검증 — 위험자산 수렴 가림 해소(v1→v2)**: 최근 매트릭스 금×BTC 0.71·주식×금 0.66·주식×BTC 0.55로 **3대 위험자산이 강하게 동조**하는데 초록 "분산 정상 — 자산군이 제각각 움직임" 배지가 이를 가림(섹터 로테이션 배너-카드 모순과 동일 클래스 — 초록 요약이 상세 수렴을 가림). 전체 5축 평균이 낮은 건 **달러·채권 헤지가 상쇄**하기 때문. → **위험자산 클러스터(주식·금·BTC 3쌍) 평균 상관** `riskMeanRecent` 산출(≥0.5=`riskConverge`), 판정(calm)은 불변(전체 포폴 기준 정확)하되 헤드라인·노트·🔥경고 스트립에 "위험자산끼리 수렴 중 — 지금 분산은 달러·채권 헤지가 상쇄, 이 축 없으면 취약" 명시. 검증(라이브): riskMeanRecent 0.638=(0.656+0.548+0.711)/3·평시 0.328 독립 재계산 일치, 헤드라인 '위험자산 수렴 중(평균 +64%)' 정직 노출. 캐시 v2. 교훈: **초록 '분산 정상' 요약은 위험자산 하위 클러스터가 수렴하면 반드시 병기 — 전체 저상관이 헤지 축(달러) 하나에 의존할 때 "제각각 움직임"은 거짓**(요약은 상세의 부분집합 원칙의 상관 버전).

## 🪙 크립토 펀딩비·OI 과열 레이더 (2026-07-18) — 킬러 로드맵 #6 · 코인 랩 ₿ 뷰(ETF 플로우 다음)

BTC·ETH·SOL 무기한 선물의 **펀딩비(funding rate)**와 **미결제약정(OI)**로 레버리지 과열/청산 위험을 재는 레이더. 현물 가격만 보면 안 보이는 레버리지 쏠림(청산 캐스케이드 연료)을 드러냄. 경보만·매매 지시 아님. 설계 `docs/crypto-funding/plan.md`.
- **`/api/crypto-funding`**(공개·`crypto-funding-v1:{일자}:{시간버킷}` 1h): **Binance 무료·무키**(Phase 0 실측: premiumIndex·fundingRate?limit=1000[실제 500 반환]·openInterestHist?period=1d&limit=30). 연율화 펀딩=8h펀딩비×3×365 · 30일 평균 · 이력 백분위 · OI 명목가($)+30일 변화%. 코인 순차 호출(버스트 429 방지·coin-lab 교훈). 코인 2개 미만 503(Binance 차단 graceful).
- **판정(결정론)**: 🔴`long_hot`(연율 ≥30%·심함 ≥60% — 롱이 숏에 이자 지급=롱 과밀=작은 하락에도 연쇄청산) / 🔵`short_skew`(연율 ≤−5% — 숏 과밀=역발상 반등·숏스퀴즈 연료) / 🟢`neutral`. OI 30일 +25%↑=레버리지 빌드업 보강.
- **`CryptoFundingRadar.tsx`**: 종합 배너 + 코인 카드(연율 펀딩 게이지[−50~+100% 매핑]·30일평균·백분위·OI·OI 30일 변화·연율 펀딩 스파크라인[0 기준선·양빨강/음파랑]). 코인 ≤5% 가드·"과열이 곧 하락 아님(고펀딩 지속 랠리도 흔함)" 캐비엇.
- ⭐ **Binance Vercel 접근 확인**: icn1(Seoul)에서 fapi.binance.com HTTP 200 — 일부 데이터센터 IP 차단 우려했으나 라이브 정상(Farside처럼 node:https 우회 불필요).
- **검증(라이브·독립 재계산)**: BTC **연율 펀딩 3.4%·30일평균 5.9%·백분위 65%·OI $6.40B·30일 +3.2% = Binance 원천 독립 재계산과 완전 일치**(소수점). 현 조정장이라 3코인 전부 neutral(저펀딩·OI froth 낮음)=현실 정합. ETH $4.18B·SOL $0.67B(−4.8% 디레버리징). 화면 전수검증(3코인 9수치)도 전부 일치.
- 🐛 **화면검증 부수 발견 — 코인랩 M2·상관 note HTML 엔티티 리터럴 노출(coin-lab v15→v16)**: ⑤ M2 vs BTC 하단 문구에 `&lsquo;`/`&rsquo;`가 곡선 따옴표로 안 바뀌고 글자 그대로 노출. 원인 = **API route의 JS 문자열**(coin-lab `note`·`macroNote`)에 HTML 엔티티를 써서 클라가 `{value}`로 렌더 → 미디코드. 실제 곡선 따옴표 문자(‘’)로 교체. ⚠️ 교훈: **JSX 텍스트의 엔티티는 React가 디코드하지만, API route/데이터 문자열에 넣은 엔티티는 `{value}` 렌더 시 리터럴로 노출된다 — route.ts·데이터 문자열엔 실제 유니코드 문자를 쓸 것**(route 문자열엔 JSX 아니라 no-unescaped-entities 린트도 안 걸림). 전 API route 스캔 결과 나머지 엔티티(blackrock·news-catalyst)는 전부 decode 함수(정상).

## 📜 채권 축 신설 (2026-07-18) — 킬러 로드맵 #7(마지막) · `/bonds` 독립 페이지

채권을 앱의 **4번째 자산군**으로 신설(주식·부동산·코인에 이은). 금리 국면에 맞는 채권 포지션(장기채로 금리인하 베팅 vs 단기채 방어)을 읽는 방어적 자산배분 축. 설계 `docs/bonds/plan.md`.
- **`/api/bonds`**(공개·`bonds-v1:{일자}` 6h): ① **듀레이션 나침반** = `/api/macro-regime` SSOT 재사용(rateDir·yieldCurve·hySpread·fedRate — 제2원칙·자기호출 읽기만) → 결정론 판정: rateDir=cut→장기채 유리 / hike→단기채 방어 / hold→중기채 균형 + 수익률곡선 역전(<0)=침체 선행 경고 + HY≥4%=국채 선호·<4%=크레딧 캐리. ② **채권 ETF**(US=SHY·IEF·TLT·LQD·HYG, KR=148070 KOSEF 국고채10년) `techChartData` SSOT로 1M/3M/1Y 수익률. ③ **금리 ±1%p 손익 시뮬** = ΔP≈−수정듀레이션×Δy(SHY 1.9·IEF 7.4·TLT 16.5·LQD 8.4·HYG 3.4·KR 8.0 — ETF 잘 알려진 특성값 참조 상수·근사 명시).
- **`BondsDashboard.tsx`/`/bonds`**: 나침반 카드(금리 방향·권장 듀레이션·크레딧·수익률곡선) + ETF 표(듀레이션·수익률·금리±1%p 손익) + 🎓 채권 기초 교육(채권=차용증·금리↔가격 역관계·듀레이션=시소 길이·크레딧 스프레드·수익률곡선 역전 비유). 캐비엇: 근사 듀레이션·과거≠미래·2022 장기채 −30% 실사례.
- **검증(라이브·독립 재계산)**: macro SSOT 정합(fedRate 3.63·동결·곡선 +0.31·HY 2.71 → 중기채·크레딧 캐리·정상 곡선) · **TLT $84.52·1M −1.9%·3M −2.0%·1Y −0.7% = Yahoo 원천 독립 재계산과 완전 일치** · 듀레이션 손익 = ±modDur 정확 · /bonds 200·coinlab 딥링크 307(auth). 6종 ETF 실가격 수신.

## 🧭 자산군 사이드바 — 채권·암호화폐 독립 그룹 (2026-07-18)

사용자 요청("주요 자산군을 따로 분류"). 초판은 💎자산군 통합 그룹(주식·채권·부동산·코인 4바로가기)이었으나 **사용자 피드백으로 재설계**: "대부분이 주식 관련이고 부동산은 이미 별도 영역이 있으니, 진입점이 없던 채권·암호화폐만 부동산처럼 각자 독립 그룹으로." → 💎자산군 그룹 제거 + **📜 채권**(teal `#2dd4bf` → /bonds 듀레이션 나침반) · **🪙 암호화폐**(TK.btcOrange → /dashboard?tab=coinlab 코인 랩) 를 🏠부동산 아래에 독립 그룹으로. dashboard 딥링크 ALLOW에 `coinlab` 추가.
- ⭐ 부수효과: /bonds·coinlab 딥링크 모두 다른 그룹에 없는 고유 목적지라 **주식·부동산 이중 하이라이트 문제가 자연 해소**(통합 그룹이었으면 /research·/real-estate가 두 곳 동시 활성). 밸런스 개요 화면은 미구현(사용자 확정: 메뉴 분류만).

## 🪙 암호화폐 사이드바 4하위 + 🗺️ 종목 추천 지도(허브) (2026-07-18)

사용자 피드백 2건.
- **암호화폐 하위 4메뉴**: 코인 랩 내부 4뷰(비트/알트/스테이블/코인주식)를 사이드바로 노출. `CoinLab`이 `?cv=btc|alt|stable|stocks` 파라미터를 마운트 시 읽어 초기 뷰 진입(사이드바 `<a>` 풀 네비 → 리마운트 시 cv 재적용). 사이드바 🪙 암호화폐 그룹 = ₿비트코인·🔷알트코인·💵스테이블코인·🏢코인 관련 주식.
- **🗺️ 종목 추천 지도(`/reco-hub`·RecoHub)**: "여러 화면이 각기 다른 근거로 추천해 학생 혼란"에 대응 — **엔진 재구축 0·데이터 fetch 0**의 정적 안내 지도(SSOT 무손상). ① 위계도(🔍특수 렌즈들 → 🎯통합 추천[4축 종합] → 🤖AI 리밸런싱[내 손익 반영 최종]) ② 렌즈별 '무슨 근거로 추천하나' 카드(🌐거시경제 AI=매크로 국면×린치퀀트 / 🎯맞춤 국내=외인·기관 실수급 / 🎯알파 헌터=가치–가격 괴리 / 🚀10배거=고성장 소형 7기준 / 🧭섹터 로테이션=자금 흐름)+바로가기 ③ 교육(겹치는 종목=신뢰도↑·1위 다른 건 각도 차이·최종은 리밸런싱·매수 전 종합 매수 판정 재확인).
- **사이드바 중복 정리**: 시장 탐구에 흩어져 있던 추천(섹터 로테이션·수급 통합추천·AI 리밸런싱)을 **🎯 종목 추천** 그룹으로 이관(추천 지도 진입점 추가) → 시장 탐구는 Macro Hub만. dashboard ALLOW에 `macroai·alphahunter·tenbagger·coinlab` 딥링크 추가. 검증: /reco-hub 200·전 딥링크 307(auth) 라우팅 확인.
- 설계 철학: 추천 창구가 많은 건 각기 다른 렌즈라 정당 — **재구축이 아니라 근거·위계를 드러내는 지도 레이어**로 혼란 해소(기존 SSOT 위계: macro-screened-universe → unified-reco → ai-rebalance 그대로).

## 🏰 통합추천 퀄리티 5번째 축 승격 + 가중치 재설계 (2026-07-18)

사용자 근본 재검토 요청("4가지 요소만 따지면 되나·비중이 맞나"). 분석 결과 — 4축이 빠른·반전 잘 하는 신호(수급·모멘텀=50%)에 기울고, **방어적 앱에 가장 중요한 '퀄리티(재무 건전성)'가 양(+)의 점수로는 사실상 빠짐**(가치축에 마진으로만 묻혀 실효 ~6% + ROIC는 틸트). 학술 팩터(규모·저변동성)는 의도적 제외(규모=10배거 헌터 별도 렌즈, 저변동성=칼날·좀비 가드가 겸함) 확인. **B안 확정: 퀄리티를 5번째 축으로 승격.**
- **4축 → 5축**: 💎가치 25 · 🏰퀄리티 20 · 📈모멘텀 20 · 💰수급 15 · 🌦️계절 20. **펀더멘탈(가치+퀄리티)=45% 앵커** / 빠른신호(모멘텀+수급) 50→35 / 매크로 20. (수급 20→15=연료는 가볍게, 모멘텀 30→20=앱 자체 감지한 모멘텀 크래시 위험).
- **`macroPhaseScreener` 분해(이중계산 방지·신규 수집 0)**: `ScreenedStock`에 `valueScore`(PEG 저평가·기저효과 가드 포함)·`qualityScore`(마진 0.55+FCF 0.45, 이익-현금 괴리 감점, 금융주 중립) 노출. 기존 composite `score`는 타 소비자(macro-ai-picks·season·alpha·win-lose)용 그대로 유지.
- **`unified-reco`**: 5축 재채점(계절은 holdingFit 별도라 composite의 lynchW 중복 제거 효과). 기저효과 가드는 **가치축만 60 캡**(퀄리티는 별개 축이라 불변). `fundScore`→`valueScore`+`qualityScore`. UnifiedReco UI 5축 바(💎🏰📈💰🌦️).
- **캐시**: `macro-screened-universe:v7→v8`(5 reader 일괄: alpha·macro-ai-picks·season·unified·win-lose) · `unified-reco v26→v27` · `hq-briefing v11→v12`(브리핑에 퀄리티 점수 병기). 다운스트림(AI 리밸런싱·퀀트빌더·본부장 브리핑)은 combined/badges 소비라 자동 상속(fundScore 미참조 확인).
- **검증**: check·build 통과 · 배포 후 `macro-ai-picks?refresh=1`(62.8s)로 v8 재적재 → win-lose 522종 로딩 확인(유니버스 라이브). 값·비중 정직 캐비엇: 팩터 비중에 수학적 정답은 없음 — **앱 철학(Get Rich Slowly·확정적으로 잃지 않게·펀더멘탈 우선)에 비중을 정렬한 판단**. ⚠️ unified-reco 5축 실값은 로그인 필요(사용자 화면검증 대상).
- 교훈: 추천 축은 **양의 점수(reward)와 가드(penalty)를 구분** — 퀄리티는 가드(칼날·좀비)로만 있으면 '나쁜 걸 뺄' 뿐 '좋은 걸 보상'하지 못한다. 방어적 앱일수록 퀄리티를 양의 축으로 승격해야.

### 💎🏰 가치·퀄리티 축 다지표 강화 (2026-07-18, 같은 날)
사용자 화면검증 후 지적("가치=PEG 하나뿐이라 대부분 100 포화·변별 안 됨"). **추가 fetch 0으로 다축화**(스크리너가 이미 fetch하던 `financialData`에 ROE·부채비율·PER 포함 — 시스템 부담 0).
- **💎 가치**(기존 PEG 단일·PEG≤1.67 만점 포화) → **PEG(촘촘: `(2.2−peg)/1.7`) 50% + 어닝일드(E/P=1/PER) 25% + FCF수익률 25%**. 성장·이익·현금 3각도. 검증: 8/12 포화(100)→**21~75 분산**(CSX PEG2.31→21·HLT PER49→38·진짜 저평가 상위).
- **🏰 퀄리티**(기존 마진+FCF) → **영업이익률 30% + ROE(자본효율) 30% + 저부채 D/E(재무안정성) 25% + 이익질(현금전환) 15%**. 금융주는 마진·ROE만(부채·FCF 무의미). ⭐ **핵심**: ROE+저부채 조합이 **'빚으로 부풀린 ROE'를 축 레벨에서 상쇄**(기존엔 최종12종 roeInflated 틸트로만) — 검증: TPR ROE 61%인데 D/E 575%→퀄리티 64(ROE만이면 만점이었을 것). 대표님이 걸러내려던 레버리지 착시를 정확히 감점.
- ROIC 정밀 틸트(최종 12종)는 유지 — 축=ROE 프록시(전 유니버스 500+종 계산 가능)·틸트=빚까지 반영한 정밀 ROIC(최종만). 캐시 universe v8→v9(전 reader)·unified-reco v27→v28. 검증: 7종목 라이브 Yahoo 독립 재계산 일치·유니버스 v9 재적재(61.9s).
- 교훈: **이미 fetch 중인 데이터에 원하는 지표가 있으면 '시스템 부담'은 착각** — quoteSummary `financialData` 한 모듈에 ROE·부채비율·PER·PSR·PBR·마진이 다 있어 추가 콜 0으로 다축 강화 가능(새 축 추가 전 fetch 중인 필드부터 확인).

### 🧭 주도섹터 6번째 축 승격 (2026-07-18, 같은 날)
사용자 요청("실제 돈이 도는 주도주 섹터를 축으로 — 수급·계절 줄여서"). 기존 섹터 로테이션 **±4 틸트 → 정식 6번째 축**으로 승격.
- **4→5→6축**: 💎가치25·🏰퀄리티20·📈모멘텀20·🧭주도섹터10·💰수급10·🌦️계절15. 재원 = 수급 15→10·계절 20→15(펀더멘탈 45% 앵커 불변).
- **비중 10% 판단**: 주도섹터는 모멘텀·수급과 성격이 겹치고 며칠 만에 뒤집히는 반전 위험(모멘텀 크래시)이라 과중 금지 — 단 기존 ±4 틸트(max 7점 스윙)보단 확실히. 10%면 leading(100)↔lagging(38) = 62점 축차 ×0.10 = **약 6점 combined 스윙**(틸트와 비슷한 폭이나 quadrant 아닌 실제 쏠림 크기 반영·연속).
- **`rotationScore`(0~100)** = 로테이션 시계 `sector-rotation-v11` 캐시의 RRG 쏠림점수(0.6 상대강도 + 0.4 모멘텀, %p)를 `(score+12)/24×100`로 정규화. 미집계(테마·섹터 없음)=중립 50. 틸트 제거(이중계산 방지). rotationTilt→rotationScore. 캐시 unified-reco v28→v29(유니버스 무관 — 로테이션 캐시서 산출).
- **검증(라이브)**: sector-rotation 실측 — energy 쏠림 13.8→축 100(주도)·realestate 85·financials 80·**IT −2.8→축 38(이탈 lagging)**. 지금 반전장(12개월 대승자 IT 무너지고 에너지·금융·방어주 상승)이 추천에 정확히 반영. 독립 재계산 일치. UI 6축 바(🧭주도섹터 핑크 #f472b6). 다운스트림(리밸런싱·퀀트빌더·본부장) 자동 상속.
- ⭐ 최종 통합추천 축 구성: **펀더멘탈(가치+퀄리티 45%) 앵커 + 모멘텀 20 + 주도섹터 10 + 수급 10 + 계절 15**. 느린·안정 신호(펀더+계절=60%)가 빠른·반전 신호(모멘텀+주도섹터+수급=40%)보다 무겁게 — "Get Rich Slowly·확정적으로 잃지 않게" 철학 정렬.

### 🐛 통합추천 KR 수급 미집계 해소 (2026-07-19, 화면검증)
사용자 지적("삼성E&A는 수급 레이더엔 데이터가 잘 들어오는데 통합추천에선 왜 미집계?"). **원인**: unified-reco의 KR 수급은 `marketFlowKr` 큐레이션 POOL(시장 랭킹 ~113종)에서만 조인하는데, 추천 유니버스(`macro-screened-universe` ~183종)엔 든 삼성E&A(028050)가 POOL엔 없어 `krFlow.get()`=undefined → 수급 50(내부 중립)·supplyKnown=false → **미집계 빗금**. 반면 수급 레이더(`MoneyFlowRadar`)는 종목별로 네이버를 직접 때려(`getMoneyFlow`) 아무 KR 종목이나 나옴.
- **수정(US 패턴 대칭)**: US가 상위 25종을 getMoneyFlow로 fetch하듯, **KR도 POOL에서 빠진 상위 preRank 15종을 getMoneyFlow(수급 레이더와 동일 SSOT)로 폴백 fetch**. `krSupplyFromFlow`(krSupply와 동일 척도 — 5일 순매수·외인기관 동반매수 +24 근사·개인 이탈, dualStreak는 per-ticker 트렌드에 없어 고정 보너스로 근사)로 채점. UNSUPPORTED 제외. 배지 🔥 외인·기관 쌍끌이/👤 개인 이탈. cache unified-reco v29→v30.
- **검증(라이브·독립 재계산)**: 삼성E&A getMoneyFlow — 외인 +882,044·기관 −162,711·개인 −673,249 → status INFLOW(외국인 단독 매집) → krSupplyFromFlow=45(base 30+외인15−기관12+개인이탈12, 쌍끌이 아님) = 재계산 일치. 통합점수 82(미집계 50)→81(수급 45 실측)+ROIC. 기관 매도 중이라 쌍끌이 배지 없이 👤개인 이탈만(정직 — 외국인 단독 매집은 쌍끌이보다 한 단계 낮음).
- ⚠️ **교훈**: 큐레이션 POOL(marketFlowKr)과 추천 유니버스(macro-screened-universe)는 **모집단이 다르다** — 유니버스에 들었지만 POOL 밖인 종목은 POOL 조인 시 조용히 '미집계'로 빠진다. 종목별 fetch 가능한 SSOT(getMoneyFlow)로 폴백하면 수급 레이더와 값이 일치(제2원칙).

### 🎯 통합추천 매수 타점 하이라이트 (2026-07-19)
사용자 요청("추천종목 중 기술적 매수 타점이 온 종목을 이쁘게 하이라이트"). `UnifiedReco.tsx`에 시각 강조 레이어 추가 — **기존 타점 SSOT 재사용, 점수·선정·정렬 절대 불변**(WHEN은 시각만, 반복 원칙).
- **`buyTierOf(it.timing)`**: 🎯prime = 신호등 green(정배열·구름위) + 급소 트리거(라쉬케 첫 눌림목 OR 스퀴즈 상방 분출) + 깨끗(과대이격·하락 다이버전스 아님) / 🟢ready = green + 깨끗 / 그 외 = 하이라이트 없음.
- **디자인**: prime = 금색 테두리 + 숨쉬는 글로우 애니메이션(`@keyframes urcGlow`) + 시머 리본(`urcShine`) "지금이 매수 타점 · [트리거]" / ready = 초록 테두리 + 은은한 글로우 + 리본. 리본은 카드 상단에 음수 마진 full-bleed. `prefers-reduced-motion` 대응(애니메이션 정지). 헤더에 범례.
- ⚠️ **claude-design MCP는 이 세션서 미연결**이라 도구 호출 불가 → 실제 앱에 반영되는 `UnifiedReco.tsx` React/CSS로 직접 구현(다크·그라데이션·글로우는 visualize 목업 도구의 플랫 원칙과 상충 → 앱 스타일 그대로 재현한 standalone HTML을 브라우저 창서 스크린샷 검증).
- 검증: check·build 통과·배포 READY. 목업 렌더 확인(prime 금색 pop / ready 초록 / 일반 물러남 — 위계 명확). 실제 하이라이트는 로그인 후 통합추천 화면서 타점 온 종목에 표시.

### 🎨 종목 추천 지도(/reco-hub) 인포그래픽 재디자인 (2026-07-19)
사용자 요청("추천지도 페이지를 캔바/피그마/claude-design로 이쁘고 선명하게 그래픽화"). **정직한 판단**: 캔바·피그마·claude-design는 앱과 분리된 별도 디자인 파일이라 실제 `/reco-hub`가 안 바뀜 → **컴포넌트(`RecoHub.tsx`)를 직접 인포그래픽으로 재작성**(데이터·링크·문구 100% 보존, 시각 레이어만). claude-design MCP는 이 세션서 미연결이라 도구 호출 불가.
- **추천 파이프라인 시각화**: 특수 렌즈 5종(컬러 메달리온 5개) → 🎯통합 추천(6축 emoji) → 🤖AI 리밸런싱, 그라데이션 노드 카드 + 펄스 화살표 흐름.
- **히어로**: 그라데이션 + radial 글로우 메달리온. **렌즈 카드**: 컬러 메달리온(둥근 사각) + 그라데이션 배경 + 액센트 바 + hover lift. **종합·최종**: 대형 피처 카드(radial 글로우). **읽는 법**: 아이콘 불릿. `prefers-reduced-motion` 대응.
- 검증: check·build 통과(전 토큰 존재 확인)·배포 READY. ⚠️ 브라우저 미리보기 창이 앞선 라이브 접속 타임아웃 후 멈춰 새 목업 스크린샷 실패 — 빌드·배포로 갈음(다음 세션 브라우저 재시작 후 확인 가능). /reco-hub는 공개 페이지라 로그인 후 실제 화면 확인.

### 🎯 종합 매수 판정 4축 → 6축 통일 (2026-07-19)
사용자 지적(추천 지도 "4축" 문구) — 통합추천은 6축인데 **종합 매수 판정(research-verdict)은 옛 4축**(계절·가치·수급·모멘텀)이라 두 엔진 축 구성이 어긋남(퀄리티·주도섹터 누락). 사용자 확정: 6축 통일. **차트 리서치 탭·운용본부는 같은 `ResearchVerdict` 컴포넌트라 자동 반영.**
- **🏰 퀄리티 축 신설**: 영업이익률(40%) + 자본효율(ROIC 우선·roeInflated면 상쇄, 40%) + 이익질(FCF, 20%). **SignalMetrics 재사용 → 추가 fetch 0**.
- **🧭 주도섹터 축 신설**: `sector-rotation-v11` 캐시 RRG 쏠림점수(unified-reco와 동일 SSOT·읽기만·SECTOR_TO_ROT 매핑). 콜드/미매핑 중립 50. 근거에 🧭 주도/태동 pros·과열/이탈 cons.
- 가중치 = 통합추천과 동일(가치25·퀄리티20·모멘텀20·주도섹터10·수급10·계절15). 리스크 감점(칼날−20·좀비−20·재고−10·하이프−8) 유지.
- `ResearchVerdict.tsx` 6축 바(통합추천 동일 순서·색상 💎🏰📈🧭💰🌦️), 문구 4축→6축(컴포넌트·reco-hub·research 주석). cache research-verdict v7→v8.
- **검증(라이브 독립 재계산)**: 삼성전자 75(가치100·퀄100·모71·주도38·수32·계60 = 75.2, IT 이탈 38·수급 CROWDED) / SK하이닉스 63(가치50=PEG 0.09 기저효과 가드·퀄100=ROIC46) — 소수점 일치. check·build 통과·배포 READY.

### 🧭 퀀트 빌더 위성 섹터 분산 (2026-07-19)
사용자 지적(퀀트 빌더 위성이 금융 3종 Goldman·Citi·JPMorgan 쏠림). 원인 = 위성 후보는 통합추천(6축) 상위 + 3축 게이트(버핏 ROE·린치 PEG·수급) 통과만 봤지 **섹터 분산은 미고려**(AI 리밸런싱엔 섹터 페널티 있으나 퀀트빌더 위성엔 없던 비대칭).
- **수정**: `quantBuilder`에 `SAT_SECTOR_CAP=2` — 품질순(passCount→통합점수) 정렬 유지하며 그리디 선별에 **섹터당 최대 2종** 캡. 금융 3종 쏠림 방지. 섹터 상한에 막힌 종목은 Core로 환류(미배치 현금 없음). axisRule 문구·헤더 주석에 '섹터당 최대 2종' 명시. cache quant-builder v5→v6.
- ⚠️ 참고: 퀀트빌더 위성은 **6축 통합추천이 뼈대**(후보 풀·비중 비례) + 3축 게이트(결격 제거) + 섹터 캡 2. Core(SPY·QQQ·SCHD·KODEX200)는 6축 아닌 4계절 국면별 시장 ETF 배분(별도 층). 검증: check·build 통과·배포 READY(위성 실선별은 로그인 필요 — auth-gated).

### 🔗 사이드바 채권 그룹 — 기존 채권 페이지 링크 추가 (2026-07-19)
사용자 지적(채권 그룹에 듀레이션 나침반만 있고 기존 채권 콘텐츠 링크 없음). Macro Hub의 채권 탭을 채권 그룹에서 바로 접근하도록 딥링크.
- **macro-hub 탭 딥링크 신설**: `?tab=bond|stress` 진입 시 해당 탭 자동 오픈 — **window.location.search useEffect**(client-only, Suspense 불필요). 기존엔 URL 파라미터 처리가 없어 항상 macro 탭만 열렸음.
- **Sidebar 📜 채권 그룹**: 🧭 듀레이션 나침반(/bonds) + 📊 채권 시뮬레이터(/macro-hub?tab=bond, BondSimulator 듀레이션·볼록성 학습) + ⚡ 금리 스트레스 테스트(/macro-hub?tab=stress).
- ⚠️ **이중 하이라이트 방지**: bare `/macro-hub`(시장탐구 Macro Hub)가 else 분기(startsWith)라 `?tab=bond` URL서도 하이라이트됐음 → `/dashboard`·`/real-estate`처럼 **정확일치+탭없음만** 예외 분기 추가(자식 채권 항목과 충돌 해소). 검증: check·build 통과·배포 READY.

### 🌍 Macro Hub 세계지도 재디자인 (2026-07-19)
사용자 요청("세계 지도맵을 더 이쁘고 가독성 좋게, 제미나이 추천 라이브러리로 교체"). **제미나이 추천 냉정 평가**: Highcharts Maps=상용 배포 **유료 라이선스**(Zero Cost 위반)·AmCharts 5=무료티어 **amCharts 로고 강제 노출**·D3+TopoJSON=무료 최고 **그런데 이미 쓰는 react-simple-maps가 바로 그것**. → **라이브러리 교체 거부, 기존 지도 디자인 재작업**(새 의존성 0·라이선스 0).
- **`geoMercator` → `geoEqualEarth`**: 고위도 왜곡 심한 메르카토르 → 현대 등면적 투영(OWID·전문 대시보드 표준, react-simple-maps 기본 투영이라 확실 지원).
- **Sphere**(둥근 세계 경계 + 바다 radial 그라데이션) + **Graticule**(은은한 경위선 그리드) → 프로 지도 느낌. 비활성 육지 `#0d1f35`→`#1b3450`(바다보다 밝게 지형 또렷)·국경 다듬기.
- ⚠️ **Sphere·Graticule 타입 정의 누락**(런타임 export는 존재) → `import * as ReactSimpleMaps` 네임스페이스에서 캐스팅(eslint-disable-next-line any). 교훈: react-simple-maps @types가 런타임 export를 다 안 담음 — 없는 export는 네임스페이스 캐스팅.
- **프레이밍 검증**(설치된 d3-geo로 투영 좌표 재계산): scale 148·center [12,8] — 데이터 국가(미국·유로존·한국·중국·일본·인도·호주·남아공·브라질) 전부 800×320 뷰포트 내, 크롭은 남극(y378)·파타고니아 최남단·알류샨(빈 지역)뿐. check·build 통과·배포 READY(macro-hub auth-gated라 라이브 스크린샷은 로그인 필요).
- ⭐ **2차 과감한 재디자인(같은 날, 사용자 "변화가 은은하다 → ①+②+③ 다 적용")**: ① 데이터 국가 `feDropShadow` 글로우 필터 + 밝은 반투명 테두리(rgba white 0.5) → 채색국이 어두운 지도에서 확 떠오름 ② 지도 확대(높이 320→400·scale 150·center [12,6] — 파타고니아까지 보임)·그리드 강화(step 30→20·굵기 0.28→0.45)·바다 3-stop 그라데이션 ③ 색 램프 6단계 불연속 버킷 → **연속 RGB 보간**(`lerpHex`, 초록→라임→앰버→오렌지→빨강 `HEAT_STOPS`) + 범례를 그라데이션 바로. 프레이밍 재검증(높이 400)·check·build 통과·배포 READY. ⚠️ vercel 첫 배포 'Not authorized' 일시 글리치 → 재시도 성공(코드 무관).

## 🎉 7대 킬러 로드맵 전체 완성 (2026-07-18)

"더 벌게"가 아니라 **확정적으로 잃지 않게** — 방어 레이어 7종 완비: #1 💸절세 도우미 · #2 📋앱 신호 성적표 · #3 📅이벤트 캘린더 · #4 🚨DART 희석 경보 · #5 🕸️이종 자산 상관 수렴 레이더 · #6 🪙크립토 펀딩비·OI 과열 레이더 · #7 📜채권 축. 전부 Zero-Input·기존 SSOT 재사용·화면검증→독립 재계산 무사고. + 채권 축으로 자산군 4축(주식·채권·부동산·코인) 밸런스 완성.

## 배포

- **프로덕션**: https://investment-school-2026.vercel.app
- **Region**: icn1 (Seoul)
- **GitHub**: https://github.com/lindows70-bot/investment-school-2026
- **Vercel 프로젝트**: lindows70-bots-projects/investment-school-portfolio
