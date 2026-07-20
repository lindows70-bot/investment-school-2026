# ETF 분산 대안 — 체크리스트

## 1단계 — SSOT 토대 ✅
- [x] `etfLookThrough.ts`에 `blendedPegFromComposition` + `getBlendedPeg` 추출 (portfolio-xray Phase 4 로직)
- [x] `portfolio-xray/route.ts`를 `blendedPegFromComposition` 사용하도록 리팩터 (값 동일 — 동일 로직·covPct 계산식 일치)
- [x] `etfAlternative.ts` 신설 — `GICS_SECTOR_ETF`(US 11 + KR 프록시) + `etfAltStub` + `buildEtfAltMap`(dedup → 타점·합산PEG)
- [x] GICS 11 티커 = season-sector 검증맵과 동일 데이터 재사용(전수 실측 완료분)

## 2단계 — A-1 통합추천 ✅
- [x] `unified-reco/route.ts`: `UnifiedRecoItem.etfAlt` + 최종 선정 후 (섹터,시장) dedup → `buildEtfAltMap` 부착. 캐시 v30→v31
- [x] `UnifiedReco.tsx`: 카드에 "🔬 ETF 분산 대안" 행(ETF명·티커·섹터·타점 배지·합산 PEG·캐비엇)
- [x] 점수·선정·정렬 불변(최종 선정 후 부착 — timing 패턴과 동일)

## 3단계 — A-2 AI 리밸런싱 ✅
- [x] `ai-rebalance/route.ts`: `BuyCandidate.etfAlt`·`BuyIdea.etfAlt` — unified-reco 상속(제2원칙). 캐시 v36→v37
- [x] `CoreSatelliteHero.tsx` "🛒 보강" 매수 카드에 ETF 대안 행

## 4단계 — 검증·배포 ✅
- [x] `npm run check` 통과 (tsc + lint, 내 파일 이슈 0)
- [x] 라이브 화면검증(10카드): 매핑·dedup·PEG·타점 정확 → 정교화 2건(금융 하위 세분·US SPDR 이름) 반영
- [x] 커밋(134b0d9) + 배포(READY) + push + CLAUDE.md 기록

## v2 — 소섹터 전면 정밀화 ✅ (2026-07-21, Yahoo industry 기반)
- [x] 스크리너 ScreenedStock에 industry 추가(비용 0) → unified-reco 전파 → SUB_ETF(industry 정규식 20종)
- [x] 이름 추측 폐기(TSM≠QCOM 불일치) → industry로 일관 매핑(QCOM·TSM·NVDA 전부 SOXX)
- [x] 티커 실측 + yahoo-finance2로 매핑 검증(반도체·은행·항공·E&P·제약·철강 정확)
- [x] 유니버스 캐시 v9→v10(5곳)·unified v34·ai-rebalance v40 · 재스크린 완료
- 잔여: 매핑 안 되는 industry(Consumer Electronics 등)는 광의 GICS 유지(정직)
