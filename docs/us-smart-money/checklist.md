# 🇺🇸 미국 스마트머니 체크리스트

## 0단계 — 실측
- [x] SEC 일별 인덱스·제출 원문 실측 4일 (건수·크기·P 비율·속도) → context-notes 판정표
- [ ] Vercel IP 에서 SEC 속도 — 첫 크론 실행 로그로 확인(막히면 GitHub Actions 로 이전)

## 1단계 — SSOT
- [ ] `lib/secForm4.ts` 추출 (getInsiderSignal 이 같은 파서를 쓰는지 대조)
- [ ] `lib/analystShared.ts` `revisionSignalOf` 추출
- [ ] `lib/insiderMarket.ts` — 일별 스캔(커서·예산·멱등) · 30일 집계·필터·보강

## 2단계 — API·화면 (절 3 내부자 매수만)
- [ ] `/api/cron/insider-scan` (매시간) · `/api/insider-market` (06:50 KST · 12h 캐시 · 마커)
- [ ] `/us-smart-money` 화면 — 답 한 줄 · 카드 7 + 접힘 · 배지 4종 · 캐비엇 상시 · 종목 리서치 링크
- [ ] 사이드바 `🌍 시장 탐구` 한 줄 · cronHealth 2줄 · vercel.json 크론 2개
- [ ] `scripts/insider-backfill.mjs` 로 30일 초기 적재

## 3단계 — 검증·기록
- [ ] 독립 재계산 — 상위 3종목을 SEC 사이트에서 손으로 대조(매수자·금액·날짜)
- [ ] 단가 미상 건이 합계에서 빠지고 화면에 '미상'으로 표시되는지
- [ ] 화면검증(모바일 390px 포함) · tsc → lint → check:build → 배포 · 크론 첫 실행 로그
- [ ] CLAUDE.md + `docs/README.md` 한 줄

## 다음 절 (별건)
- [ ] 절 1 유동성(기존 SSOT 조립) · 절 2 ETF 흐름(Phase 0 무료 소스 실측부터) · 절 4 애널리스트(리비전 기반)
- [ ] 내부자 목록 성적 적립(등재일 종가 → 60거래일) — 표본 10건부터 표시
