# 🎯 통합 3축 추천 — 컨텍스트 노트

## 핵심 통찰
4계절과 수급 맞춤추천은 경쟁 기준이 아니라 직교하는 축(매크로 방향 vs 수급 연료).
통합 = 하나를 버리는 게 아니라 3축(계절·펀더멘탈·수급)을 하나의 점수로 융합.

## 결정 (사용자 확정)
- 대상: 한국+미국 모두. US 수급은 MFI 프록시(약함) → 명시.
- 표시: 투명 3축 + 통합점수.

## 구현
- `/api/unified-reco`: base = macro-screened 캐시(100). 계절(US/KR CLI+macro-regime), 펀더멘탈(screenOne score), 수급(KR=marketFlowKr 캐시, US=getMoneyFlow MFI). 보유 제외. top15.
- 가중치: 계절 25% + 펀더멘탈 40% + 수급 35%(방향=펀더멘탈이 가장 무겁게, 앱 철학).
- 성능: KR 40 전부 캐시 즉시. US는 계절+펀더 상위 25만 MFI fetch(동시성5). 최종 15만 canonical PEG.
- UI: 수급 레이더 탭 4번째 서브뷰 [🎯 통합 추천]. 종목당 통합점수 + 3축 미니바 + 배지.

## 제약(정직)
- US 수급 = MFI/내부자/13F 프록시. UI에 '수급*' + 푸터 명시.
- PEG 표시는 canonical(stock-info) SSOT. screenOne Yahoo PEG는 스크리닝/랭킹용.
- 의존: macro-screened 캐시(macro-ai-picks 주간 크론)·marketFlowKr 캐시(일 크론). 콜드면 '준비 중' 안내.

## 검증
- 가중치 검산: 3축高=96 > 부분66·54 > 약함44. 순서 정상, 가치 최대비중 확인.
- 각 엔진은 이미 프로덕션 검증됨(screenOne·marketFlowKr·moneyFlow·canonical).
