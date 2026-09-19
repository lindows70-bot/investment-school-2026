# 🇺🇸 미국 스마트머니 체크리스트

## 0단계 — 실측
- [x] SEC 일별 인덱스·제출 원문 실측 4일 (건수·크기·P 비율·속도) → context-notes 판정표
- [ ] Vercel IP 에서 SEC 속도 — 첫 슬롯 크론(월요일 09-21 11:20 KST) 마커·처리 건수로 확인(막히면 GitHub Actions 로 이전). 09-19 는 처리할 게 없어 못 쟀음

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
- [ ] CLAUDE.md + `docs/README.md` 한 줄

## 절 1 — 지금 돈이 풀리고 있나, 마르고 있나 (2026-09-19)
- [x] `lib/usLiquidity.ts` — 매크로 날씨(순유동성·HY)·수익률곡선·매크로 국면(금리 방향·FOMC)·4계절(유리/불리 섹터) **조립** + FRED DRTSCILM(대출태도) 신규 + UUP·BTC·SPY 4주(상관 레이더와 같은 티커)
- [x] `/api/us-liquidity` 6h 캐시(계기판 3개 미만이면 미캐시) · 화면 절 1(답 한 줄·계기판 5·유리/불리 섹터·교차 자산 3)
- [x] 실측 5/5 지표 확보: 순유동성 $5.87조(+$770억) · HY 2.70 · 곡선 +0.25/+0.87 정상 · 3.63% 인상 반영 · 대출태도 +0.0%
- [ ] 확률 시나리오(Bull/Base/Bear) — **만들지 않기로**(가짜 정밀). 국면·섹터는 4계절 SSOT 가 답한다

## 절 2 — 돈이 어느 섹터로 가고 있나 (2026-09-19)
- [x] Phase 0: 무료 자금유입 API 없음(Yahoo sharesOutstanding=ETF 에서 undefined · iShares CSV 는 HTML 차단). **Yahoo totalAssets·navPrice 는 있음** → 스냅샷 적립 역산
- [x] `lib/etfFlow.ts` — 40개 대표 ETF(지수·섹터 11·스타일·지역·테마·채권·레버리지) · flow = ΔAUM − 시장 등락분 · 1주 가속 · 가격-자금 괴리 · 거래량 5일/20일
- [x] `/api/cron/etf-snap` 화~토 19:20 KST(주말 스킵 가드) · `/api/etf-flow` 6h · cronHealth 1줄 · 화면 절 2(그룹 접기, 첫 1주는 값·거래량만)
- [x] 첫 스냅샷 40/40 (09-18 분) · 프로덕션 적재 시작
- [ ] **검증(1주 뒤 09-26)** — SPY·QQQ 1주 역산 순유입을 공개 집계(etf.com Fund Flows)와 대조. 부호·자릿수가 맞아야 표시 유지. Yahoo totalAssets 가 매일 안 바뀌면(주간 갱신) 이 절은 '주간 흐름'으로 격하

## 다음 절 (별건)
- [ ] 절 4 애널리스트(리비전 기반)
- [ ] 내부자 목록 성적 적립(등재일 종가 → 60거래일) — 표본 10건부터 표시
