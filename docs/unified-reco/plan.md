# 🎯 통합 3축 추천 엔진 (Unified Reco)

## 목표
4계절(매크로 방향)과 수급 레이더 맞춤추천(연료)을 하나의 기준으로 융합해 종목 추천.
"둘 중 하나를 버리는 통합"이 아니라 **직교하는 3축을 하나의 점수로 융합**.

## 3축 (각 0~100) → 투명 표시 + 통합점수
1. **계절 적합 (매크로 방향)** — 현재 계절 우대 섹터/린치분류 적합도. seasonNavigator `holdingFit` 재사용
2. **펀더멘탈 가치 (퀀트)** — PEG·마진·FCF·린치가중. macroPhaseScreener `screenOne` score 재사용
3. **수급 (연료)** — KR: 외인/기관/개인 실수급(marketFlowKr) · US: MFI+내부자+13F 프록시(moneyFlow)

통합 = 계절 25% + 펀더멘탈 40% + 수급 35% (방향은 펀더멘탈 — 앱 철학)

## 결정 (사용자 확정)
- 대상: **한국+미국 모두**. 단 US 수급은 MFI 프록시(약함) → 명시
- 표시: **투명 3축 + 통합점수** (왜 추천됐는지 보임 — 교육)

## 제약 (정직)
- US엔 진짜 외인/기관 수급 없음 → MFI 프록시. UI에 '프록시' 라벨
- PEG는 canonical(stock-info) SSOT로 표시(제2원칙) — screenOne의 Yahoo PEG는 스크리닝용

## 데이터 조인
- base = `macro-screened-universe:v1` 캐시(100: US60+KR40, lynch·sector·peg·score·opMargin·market)
- KR 수급 = `market-flow-kr-v*` 캐시(113) 6자리 조인 — 즉시
- US 수급 = `getMoneyFlow`(per-ticker, 24h 캐시) — 계절+펀더멘탈 상위 N만 fetch(성능 바운드)

## 성능 전략
- KR 40: 3축 전부 캐시 → 즉시
- US 60: 계절+펀더멘탈 즉시, 상위 ~25만 MFI fetch(동시성 5)
- 최종 top ~15에 canonical PEG fetch(표시 정확도)

## 배치
- 수급 레이더 탭에 4번째 서브뷰 [🎯 통합 추천] 추가
