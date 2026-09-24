# 🇺🇸 미국 스마트머니 체크리스트

## 0단계 — 실측
- [x] SEC 일별 인덱스·제출 원문 실측 4일 (건수·크기·P 비율·속도) → context-notes 판정표
- [x] Vercel IP 에서 SEC 속도 — 09-22 확인: 미처리 잔량 0, 09-21분 391건 전량 완료. 크론이 하루치를 따라잡는 것은 확인(초당 처리량 자체는 잔량이 없어 못 쟀고, 목적은 달성이라 더 재지 않는다)

## 1단계 — SSOT
- [x] `lib/secForm4.ts` 추출 (getInsiderSignal 이 같은 파서 사용) · 인덱스는 꼬리 정규식(이중 공백 회사명 실측)
- [x] `lib/analystShared.ts` `revisionSignalOf` 추출
- [x] `lib/insiderMarket.ts` — 일별 스캔(커서·예산·404=처리) · 30일 집계·필터·보강 · 실측 잡음 2종 차단(1인 $10K 미만 · ADR 단가 괴리)

## 2단계 — API·화면 (절 3 내부자 매수만)
- [x] `/api/cron/insider-scan` (하루 3회 — Hobby 는 매시간 불가) · `/api/insider-market` (06:50 KST · 12h 캐시 · partial 미캐시)
- [x] `/us-smart-money` 화면 — 답 한 줄 · 카드 7 + 접힘 · 배지 4종 · 읽는 법·캐비엇 · 종목 리서치 링크
- [x] 사이드바 `🌍 시장 탐구` 한 줄 · cronHealth 2줄 · vercel.json 크론 4개
- [x] `scripts/insider-backfill.mjs` 30일 적재 — 19일 완성 · 1,018건 · 257곳 통과 (`8a87f67`)

## 3단계 — 검증·기록
- [x] 독립 재계산 — SBLK 8명·$6,920,496 = openinsider 8명·$6,920,496 (다른 파서·경로, 1달러까지)
- [x] 단가 미상 건 분리(unpriced) · 화면 '단가 미상'
- [x] 화면검증(모바일 375px 2열) · tsc → lint → check:build → 배포 · 프로덕션 집계 캐시 확인
- [x] CLAUDE.md(함정 3줄·하네스 표) + `docs/README.md` 한 줄

## 절 1 — 지금 돈이 풀리고 있나, 마르고 있나 (2026-09-19)
- [x] `lib/usLiquidity.ts` — 매크로 날씨(순유동성·HY)·수익률곡선·매크로 국면(금리 방향·FOMC)·4계절(유리/불리 섹터) **조립** + FRED DRTSCILM(대출태도) 신규 + UUP·BTC·SPY 4주(상관 레이더와 같은 티커)
- [x] `/api/us-liquidity` 6h 캐시(계기판 3개 미만이면 미캐시) · 화면 절 1(답 한 줄·계기판 5·유리/불리 섹터·교차 자산 3)
- [x] 실측 5/5 지표 확보: 순유동성 $5.87조(+$770억) · HY 2.70 · 곡선 +0.25/+0.87 정상 · 3.63% 인상 반영 · 대출태도 +0.0%
- ⛔ 확률 시나리오(Bull/Base/Bear) — **만들지 않기로 결정**(가짜 정밀). 국면·섹터는 4계절 SSOT 가 답한다 — 체크박스가 아니라 결정이다

## 절 2 — 돈이 어느 섹터로 가고 있나 (2026-09-19)
- [x] Phase 0: 무료 자금유입 API 없음(Yahoo sharesOutstanding=ETF 에서 undefined · iShares CSV 는 HTML 차단). **Yahoo totalAssets·navPrice 는 있음** → 스냅샷 적립 역산
- [x] `lib/etfFlow.ts` — 40개 대표 ETF(지수·섹터 11·스타일·지역·테마·채권·레버리지) · flow = ΔAUM − 시장 등락분 · 1주 가속 · 가격-자금 괴리 · 거래량 5일/20일
- [x] `/api/cron/etf-snap` 화~토 19:20 KST(주말 스킵 가드) · `/api/etf-flow` 6h · cronHealth 1줄 · 화면 절 2(그룹 접기, 첫 1주는 값·거래량만)
- [x] 첫 스냅샷 40/40 (09-18 분) · 프로덕션 적재 시작
- [x] ~~**검증(1주 뒤 09-26)**~~ → **09-24 조기 기각**: Yahoo totalAssets 가 09-18~09-24 내내 동일(IBIT·SPY) — 역산이 가짜 유출을 만든다. 동결 구간 null 가드(`etf-flow-v2`). 순유입 축은 표시 없음
- [x] 발행주수(`quote().sharesOutstanding`) **적립 시작**(2026-09-24, 클라우드 세션) — 일별 스냅샷에 `shares` 필드(배치 quote 1회 · 실패해도 스냅샷은 저장) + `/api/etf-flow` 의 `sharesProbe`(askedDays·종목별 distinct/changed·verdict) · 키 `etf-flow-v3` · 불변식 ⑥ 6검사 추가 · 화면 "1주 뒤면 보인다" 약속 → 실제 상태 문구
- [ ] `sharesProbe.verdict` 가 `daily` 면 Δ주수×NAV 로 순유입 전환(오는 종목만 · `none` 은 '없음') · `stale` 이면 절 2 순유입 축은 표시 없음으로 확정하고 스냅샷 크론 축소 검토. **판정은 5일 이상(askedDays ≥ 5) 뒤** — 배포일 기준 약 09-30~10-01

## 절 4 — 전문가들이 마음을 바꾼 회사는 (2026-09-19)
- [x] `lib/analystRerating.ts` — 유니버스 미국 종목 + 내부자 통과 종목(470종) × Yahoo `upgradeDowngradeHistory`(30일 상향/하향 증권사 수)·`earningsTrend`(EPS 리비전)·`financialData`(목표가 여력)
- [x] 판정 3묶음: 진짜 리레이팅(3곳↑ 상향 + 리비전 up + 여력 15%↑) / 목표가만 오른 소음 / 무더기 하향. TipRanks 별점·승률(유료) 대신 노이즈 캔슬러 규칙
- [x] `/api/analyst-rerating` 12h 캐시·07:10 KST 크론(성공 70% 미만이면 미캐시) · cronHealth 1줄 · 화면 절 4
- [x] 실측: 470종 80초 · 진짜 1(SNPS: Wells Fargo·MS·Baird 상향, 추정치 20↑0↓, 여력 +41.8%) · 하향 3(AMRZ·DKS·COO)
- ⛔ 상향 이유 태깅(실적·신제품·마진·M&A) — 무료 데이터에 사유 텍스트가 없어 **만들지 않는다**(지어내지 않음)

## 전체 (4절 완료 2026-09-19)
- [x] Vercel SEC 속도 — 09-22 실측: 미처리 잔량 0, 09-21분 391건 전량 완료(크론이 따라잡음). 속도 자체는 못 쟀으나 목적 달성
- [ ] ~~ETF 순유입 vs etf.com(09-26 첫 1주값)~~ → 순자산 방식 기각(09-24) · 발행주수 방식은 위 `sharesProbe` 판정 뒤 대조 · 절 4 표본이 늘 0~5곳이면 임계 완화 검토(2곳?)
- [x] 성적 적립 — `lib/usSmartHistory.ts` · 20·60거래일 × SPY 초과분 · 첫 표본 88건(09-21) · `/api/usm-record` 07:30 KST 크론 · cronHealth 1줄

## 09-22 점검 (배포 3일차)
- [x] ETF 순유입 기간을 달력으로 확인 — 구멍이 크면 값 비움 · 실제 구간 툴팁 · 그룹 합계 개수 표기 · 불변식 8검사
- [x] 소급 적립 차단(마지막 봉 5일 초과 제외) — GREE 07-23 건 제거 · 불변식 신설
- [x] 브리핑 ④ 아래 한 줄 + 추천 지도 등록(스윙 타점 누락도 함께)
- [ ] 브리핑 한 줄은 **로그인 화면**이라 사용자 눈으로 확인 필요(API 응답은 확인됨)
- [x] 내부자·리레이팅 성적 적립(등재일 완성 종가 → 20·60거래일 × SPY 초과분) — 09-22 시작, 첫 표본 88건
