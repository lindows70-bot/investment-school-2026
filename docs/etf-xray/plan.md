# 🔬 ETF 투시경(X-Ray) — Look-Through 분해 엔진

## 목표
학생 포트폴리오의 큰 비중을 차지하는 ETF를 '기타 자산'으로 방치하지 않고,
구성종목·섹터로 투명하게 분해(Look-through)해 실질 노출도를 분석한다.
기존 STOCK 전용 코어 엔진은 무손상(가드레일 유지) — 분해는 별도 레이어.

## Phase 0 — 데이터 검증 ✅ (2026-06-10 실측)
- 🇺🇸 US ETF: Yahoo `topHoldings` 모듈 → 상위 10종목(symbol+holdingPercent) + sectorWeightings(11섹터) ✅ 완벽
- 🇰🇷 국내주식형: Naver `etfAnalysis` → `etfTop10MajorConstituentAssets`(6자리코드+비중%) + `sectorPortfolioList`(12섹터) + 자산/국가 비중 ✅ 완벽
- 🇰🇷 해외주식형(TIGER 미국테크TOP10 등): 종목명만 제공(itemCode=""·weight="-") ⚠️ — 단 섹터·국가 비중은 완전 제공
- 제미나이 안 교정: ① "네이버 PDF 크롤링" 불필요(etfAnalysis로 충분) ② 새 etf_components 테이블 반려(app_cache 재사용) ③ Top10 100% 재정규화 반려(SPY 왜곡) → 섹터는 네이티브 비중, 종목은 원시 비중+'기타 분산'

## 사용자 확정
- 해외주식형 KR ETF: **섹터만 분석**(종목은 이름만 표시, 비중 추정 안 함 — 정직)
- 배치: **운용 본부 ① 진단에 통합**(ETF 투시 토글 + 4계절 정합성 ETF 기여 반영)

## 아키텍처
1. `src/lib/etfLookThrough.ts` (SSOT): `getEtfComposition(ticker, market)` →
   topHoldings + sectorWeights(GICS 영문 통일) + isEquityEtf. app_cache 7일
   - 섹터명 통일 맵 필수: Naver IT/COMMUNICATION ↔ Yahoo technology ↔ 앱 GICS Technology (제2원칙 — 안 맞추면 4계절 우대섹터 매칭이 조용히 깨짐)
2. `/api/portfolio-xray`: 보유 전체 분해·합산 — 실질 종목 순위(직접+ETF경유 중복 합산) + 실질 섹터 비중. holdingsFingerprint 캐시
3. 4계절 정합성 ETF 통합: ETF fit = Σ(섹터비중 × 섹터적합) — 현재 ETF가 정합성에서 통째로 빠진 왜곡 해소
4. UI: OperationsHQ 진단에 'ETF 속살 투시' 섹션 — 실질 종목 Top + 실질 섹터 + 숨은 몰빵 경고

## Phase
- Phase 1: etfLookThrough.ts + 캐시 → verify: QQQ·KODEX200·TIGER미국S&P500 3유형 실측
- Phase 2: /api/portfolio-xray + 진단 UI → verify: 실DB 중복합산·섹터합 검산
- Phase 3: 4계절 정합성 ETF 기여 통합 → verify: 점수 전후 비교
- Phase 4(선택): 합산 PEG(비중 있는 ETF만, canonical SSOT 가중평균)

## 가드레일
- 레버리지 ETF(TSLL 등): 분해 제외 + 기존 경고 유지
- 채권/원자재 ETF: isEquityEtf=false → 분해 제외, '비주식 자산' 표기
- 추정치 금지: 비중 없으면 '비중 미제공' 정직 표기
