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

## v2 후보 (백로그)
- 세부 소섹터 ETF(반도체→SOXX 등): 스크리너에 Yahoo industry 실어야 GICS 대섹터→소섹터 정밀화
- US 금융 하위 세분(증권 IAI·보험 KIE): 영문명 감지 신뢰도 낮아 보류
