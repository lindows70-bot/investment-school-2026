# ✅ 학생 화면 리디자인 — 체크리스트

## 0. 결정
- [x] 방향 선정 — 시안 9개 → "애플 다크 + 빛 한 점 + 역할 고정 칩"(2026-10-09 사용자)
- [x] 범위 — 학생 간편 화면 /s 다섯 장 → 셸 순
- [x] 새 hex 없이 기존 토큰으로 대응(표는 context-notes)

## 1. 홈
- [x] 공용 프리미티브 `components/student/ui.tsx`(Card·Label·Big·Chip·Tile·Glow — Row 는 아직 쓰는 곳이 없어 안 만듦) — 토큰만
- [x] `homeUi.card` 새 틀(라운드 16 · 패딩 16) — 전 카드 상속
- [x] 인사: 날짜 줄(FS.tiny) + 큰 제목(FS.h2 · 800 · 자간 −0.03em)
- [x] 검색: 알약 입력(RAD.pill)
- [x] 내 자산 카드: 라벨 → 수치(FS.h2) → 등락 한 줄 · 빛 한 점 · 선 차트 없음(데이터 없음)
- [x] 리그 타일(순위 + ↑↓ 칩 라임 · 두 장 이상일 때만) · 기록 타일(이번 주 건수 + 금 칩) 2열
- [x] 지수 3: 값 + 등락 + 축 없는 미니 선(36px)
- [x] 바로가기 4: 지수 아래로 · 같은 카드 틀
- [x] 나머지 카드(시황·강한 분야·공포탐욕·환율·일정·뉴스·거장) 새 틀 상속 확인
- [x] `npm run check:build` → 커밋 → 배포
- [x] 로그인 브라우저 375·768·820·1280 실측(넘침 0 · 첫 화면에 리그·기록 보임 · 글자 크기 종수)
- [x] `docs/history/2026-10.md` 기록

## 2. 시장
- [x] PageHead(날짜+큰 제목) · Segment(국내/미국/코인) · 지수 3칸 카드 안 상자 제거 · 강한 분야 1달 막대 · 네 폭 실측 · 기록(10/9)
- [x] 공포·탐욕 카드 안 탭(bg3 상자) → Segment · 1년 요약 상자 → 헤어라인(10/10 마무리 edf257d3)
- [ ] 미국·코인 탭 카드 머리 통일(보류 — 지금도 CardHead)

## 3. 내 자산
- [x] PageHead + '＋ 기록' · 평가금액 카드(FS.h1 + 빛) · 내 종목 목록 카드 행 · 네 폭 실측 · 기록(10/10)
- [x] 투자 구성·투자 체크 카드 머리 CardHead 통일 · 투자 체크 하늘색 테두리 제거 · 코어/위성 색(sky·orange)은 역할색으로 유지(10/10 edf257d3)

## 4. 리그
- [x] PageHead + ? 도움말 · 내 순위 카드(FS.h1 + 라임 칩 + 빛) · 순위표 헤어라인 행(내 행 면만 밝게 · '나' 칩) · 친구 칩 테두리 제거(10/10 배포 f71378cb)
- [x] 네 폭 실측(10/10 · 넘침 0 · 375 2,868 / 768 2,593 / 820 1,960 / 1280 1,807px) · 기록

## 5. 배우기
- [x] PageHead · 수업 자료·부동산·코인 칸 한 부품(NavTile) · 저울 요약 카드 같은 면 · 네 폭 실측(10/10 · 넘침 0 · 375 1,922 / 768 1,806 / 820 1,356 / 1280 1,279px) · 기록

## 6. 셸
- [x] 하단 탭 선택 = 틴트 파랑 · 왼쪽 메뉴 선택 = 면만 밝게 + 틴트 아이콘 · 로그인 화면(남색 바탕 · 같은 카드 면 · 제목 FS.h2 · Segment 탭 · 입력 칸 토큰) — 10/10 배포 1bf9aea4 · 로그인 375 실측(넘침 0)
- [x] 로그인 뒤 실측(10/10): 하단 탭 선택 글자 rgb(96,165,250)=blue400 · 비선택 sub · 왼쪽 메뉴 선택 면 rgb(26,29,39)=bg7 · 아이콘 blue400 · 넘침 0

## 7. 마무리(10/10 · edf257d3)
- [x] 카드 머리 CardHead 통일(내 투자 구성·투자 체크·내 계정)
- [x] 공포·탐욕 카드 안 탭 → Segment
- [x] 색 수렴: 링크 sky400 → blue400 11곳 · '내 종목' 배지 → teal400(한 뜻 한 색) · 뉴스 종목 이름 → slate100
- [x] 로그인 fontSize 리터럴 15줄 → FS · 잔여 회색 → sub
- [x] 배포 확인(10/10) · 홈 색 종수 재측정: 본문 8종(sub·slate200·slate100·blue400·slate300·slate500·red400·teal400 — 목표 8 도달) + 브랜드 서명 블록 7종(금·양피지색 — 브랜드 표식이라 제외)

## 8. 전수 점검(10/10 · 17장 계산된 스타일 실측)
- [x] 기간 탭 상자 제거 · 종목 상세 제목·카드 · 기록 카드 라운드 · 코인 기사 링크 44px · 저울 질문 상자 → 헤어라인 · 부동산 지표 상자 → 헤어라인
- [x] 배포 확인(432ca72a) · 재측정: 저울 카드 안 상자 15→0 · 44px 미만 5→0 / 코인 44px 미만 14→0 / 부동산 상자 6→0 · 넘침 0
- [ ] 범위 밖(공유 컴포넌트): 주간 리포트 · 투자 아카데미 · 최일 전략 패널

## 9. 더리치 메인 문법(10/12 · 3a44048f)
- [x] 바로가기 가로 아이콘 줄 · 시황 번호 · 시장 카드 가로 줄(코스닥·나스닥 추가) · 환율 고점·저점 말풍선 · 일정 날짜 칩
- [x] 배포 뒤 네 폭 실측(10/12 · 넘침 0 · bleed 769px↑ 꺼짐 확인) — 환율 말풍선 잘림 1건 → 높이 210(46564746)
- [x] 금·은 카드(10/13 21c40d10 — 야후 GC=F·SI=F, 주간 리포트와 같은 원천)`n- [x] 코스피·코스닥 카드 수급 3칸(10/16 9191358b — fetchKrIntegration 조각만 직접 호출)`n- [ ] 보류: 시간대 시황(데이터 없음)

## 10. 전수 점검 2차(10/18 · dc1e0ef6 · 7962020d)
- [x] 디자인 6건(44px · Segment inCard · 거장 칸 · 불어난 돈 넘침 · 차트 접근성 · 말풍선 표기)
- [x] 내용 8건(로그인 분기 7곳 · 일정 '없음' 시점 · FOMC 문구 · 부동산 오류 문구 · 리그 모름 처리 · movers 색 · 리터럴 6종 · 코인 등락 기준)
- [x] 배포 뒤 재측정(375 · 10/18): Segment 44 · 홈 cardInCard 0 · 거장 bg3 0 · 불어난 돈 넘침 0 · 리그 정상`n- [x] 홈 하이드레이션 오류(style 블록 이스케이프) — 셋 다 dangerouslySetInnerHTML

## 11. 전수 점검 5차(10/18 · ddb7f773 ~ a2facefd)
- [x] FRED fetcher SSOT `src/lib/fred.ts` — 18곳 이관(라우트 9 · lib 9) · 캐시 키 범프 없음(응답 불변)
- [x] rtms-trade-v2 정리 규칙 400일 + reader 2곳 나이 조건 + 불변식 재정의 · precommit-guard ③ 접두어 경계 오탐 수정
- [x] 월별 손익 API 비로그인 401
- [x] next lint → eslint src(ESLint 9 · FlatCompat) · .eslintrc.json 삭제 · pre-push·deploy-verify 문구
- [x] @supabase/ssr 0.12.7 · supabase-js 2.118.0 · check:build 2회 통과 · verify 4종 통과
- [x] 배포 뒤 실측(10/18 · a2facefd): 비로그인 monthly-pnl 401 · /api/fred FEDFUNDS 3건 498ms(앱 캐시 없는 경로 = 새 lib 실동작) · fed-charts·dual-mandate·global-cycle·macro-weather 200 · 홈 API 11 실패 0 · 내 자산 monthly-pnl 200·판 종목 +12.1% · 리그 1위/7명 · 채권 yield-curve 200 · 로그인 세션 유지(supabase 0.12)
- [ ] 보류: npm audit 잔여 11건(tailwind 4 필요) · 업비트 시세 3곳·RSS 파서 2곳·USD/KRW 이력 2곳 SSOT · re-policy 9초·portfolio-xray 8초

## 12. 전수 점검 6차(10/18 · 25073cab ~ 40ccb152)
- [x] A 남용 면: requireUserOrCron·internalHeaders SSOT · 게이트 12곳 · 자기 호출 표식 7곳 · tickers 상한 60(400) · fred 시리즈 형식·limit ≤ 2000 · re-apt 지역표 · shadow-13f KR 24h 캐시 · ai-rebalance refresh 게이트 · Gemini 4곳 single-flight+음성 캐시
- [x] B 일정표: FOMC 2027 8회 + verify-fomc-schedule · macro-regime 라벨 · LATEST_SEP 2026-09 · 정책금리 미국 FRED + 기준일 표시 · 코인 세금 날짜 분기(tax-helper v2) · shadow-13f 기간표 날짜 생성 · 로드맵 날짜 상태 · 배당 연속연수 2024 기준
- [x] C 느린 라우트: re-policy 병렬 · portfolio-xray 병렬
- [x] D SSOT: lib/upbit(7곳) · lib/googleNews(5곳) · fx-attribution 은 창 부족으로 유지(주석)
- [x] 배포 뒤 실측(10/18 · 40ccb152): 비로그인 8라우트 전부 **401** · re-apt 지역표 밖 400/종로 200 · 공개 라우트 9종 200 · 로그인 상태 financials 2.2s·fred 0.6s·reverse-dcf 3.2s·shadow-13f KR 1.3s→두 번째 0.4s(캐시) 전부 200 · re-policy **콜드(refresh=1) 2.9초**(전 9초 · 법령 44·뉴스 460·lawDown false) · portfolio-xray 0.9s(캐시 히트 — 콜드는 보유 변경 때 측정) · macro-data `rates.USA=3.875 · ratesLive.USA=true · ratesAsOf=2026-07-19` · macro-hub 캡션 "미국은 FRED 실시간 · 나머지 14개국은 2026-07-19 기준 수동값" · 로드맵 배지 지난 분기 3·진행 중 1 · tax-helper cryptoTaxNote 현행법 문구 · 매크로 대시보드 Fed Watch 탭 "2026년 9월 FOMC 기준"(옛 '2025년 3월'·'개월 전 전망' 0건)
- [ ] 보류: stock-info 자체 게이트(자기 호출자 수십 곳) · npm audit 11건(tailwind 4) · USD/KRW 이력 SSOT 창 확장

## 13. 전수 점검 7차(10/18 · f1efcbd7 ~ cacdbb77)
- [x] 🔴 국내 수급 5주 정지 — no-store 명시 · CronMonitor.fresh(dataDate 7일) · 불변식이 프로덕션 dataDate 확인(배포 뒤 상태판 stale 정직 표기 · 학생 보드 dataDate 10-16)
- [x] 제2원칙 8건(PEG 재계산 3곳 · ×100 · PER SSOT · 계절 origin 5곳 · 자산 분류 SSOT 4곳 · 역할 규칙표 통일 · 환율 폴백 3곳 · 스크리너 PEG SSOT 우선+pegSource · UNIVERSE_KEY v22)
- [x] stock-info 게이트 + 자기 호출 10곳 표식 + verify-api-gates(야간) · 불변식 4종 prodAuth
- [x] error.tsx·global-error.tsx(ChunkLoadError 1회 자동 새로고침) · 테마색 통일 · /s/learn/strategy 350→112kB
- [x] CLAUDE.md 환경변수 22개 표 · TOSS_TRADING_ENABLED 사실 정정
- [x] 배포 뒤 실측(10/18 · bef18c23): 익명 stock-info **401** · 내부 표식 200(3.5s) · reverse-dcf·research-verdict 내부 표식 200(axisSource=universe) · 크론 상태판 marketFlowKr `stale · dataDate=2026-09-11 · 38일 전` 정직 표기 · 학생 보드 individual.dataDate **2026-10-16**(캐시 재생성) · 유니버스 v22 워밍 114초(크론 비밀값 refresh=1) → verify-lynch-fair 전부 통과 · verify-market-board-sources 프로덕션 dataDate 통과 · etf-snap 일·월 거짓 stale 교정
- [x] 로그인 화면 실측(10/18 재로그인 · 1280): 대시보드 AI 멘토 족집게 PEG 0.05·0.63(SSOT 값) · '해당없음' 오탐 0 · API 실패 0 / 자산 화면 린치 배지 2·ETF 배지 1·N/A 9(ETF·코인) · 실패 0 / 스쿨 리그 exchange-rate 200 · 순위 정상 / 학생 전략 화면 패널 지연 로드 뒤 정상 표시(불러오는 중 잔존 0)
- [ ] 보류: regime-tripwire 계절(이력 스키마 US/KR) · 선생님 3장 번들 · KST 헬퍼 복제

## 14. 전수 점검 8차(10/19 · 84ddd3d2 ~ df2edab0)
- [x] verify-cron-monitors(vercel.json 33 크론 ↔ 상태판 1:1) · etfFlow 모니터 신설 · CronMonitor.cron 필드
- [x] 🔴 etf-flow 크론 열흘 저장 0건(환율 자기 호출 url.origin → NEXT_PUBLIC_APP_URL) — 신설 모니터가 잡음
- [x] verify-shared-libs(공용 lib 7종 실제 컴파일 검사 · RSS 파서·FRED URL 순수 함수 분리) · 야간 감사 등록 2종
- [x] KST SSOT lib/kst(64파일 코드모드) · regime-tripwire origin 계절(quads · 옛 이력 폴백) · internalAuth 분리
- [x] robots.txt + noindex · 리서치 381→191 kB · 매크로 허브 지연 로드(dynamic 옵션은 리터럴 — SWC)
- [x] verify-lynch-fair 65점 규칙 반영(거짓 빨강)
- [x] 배포 뒤 실측: robots 200 · meta noindex · 상태판 30 응답(etfFlow stale 정직 표기) · regime-tripwire 401(로그인 전용) · research·macro-hub 200 · etf-flow refresh cached·fxLive true · 불변식 5종 통과
- [ ] 보류: regime-tripwire 로그인 실측 · etfFlow 10/20 크론 뒤 ok 확인 · verify-crypto-panels ❌ 줄(exit 0) · 선생님 3장 번들 나머지