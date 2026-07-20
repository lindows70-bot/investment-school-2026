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

## 4단계 — 검증·배포
- [x] `npm run check` 통과 (tsc + lint, 내 파일 이슈 0)
- [ ] 배포 후 라이브 검증(auth-gated): 합산 PEG=X-Ray 동일, 타점=기술차트 동일, 매핑 정확
- [ ] 커밋 + 배포 + CLAUDE.md 기록
