# 🔗 연결 조직 체크리스트

## Phase A — 기반
- [x] StockActionChips SSOT 컴포넌트 (칩 4종 + compact + only)
- [x] /assets `?add=` 딥링크 프리필(모달 자동 오픈 + URL 정리)
- [x] 검증: `?add=NVDA&name=NVIDIA&market=US` → 모달 열림·티커/종목명 채움·**매수가/수량은 빈칸**(자동 채움 금지 준수)

## Phase B — 추천 → 행동 (가장 큰 갭)
- [x] UnifiedReco 종목 카드(4칩) + ⭐핵심 추천 칩(compact 3칩)
- [x] briefing ③ 담을 것(4칩) · ② 정리할 것(판정·차트만 — 이미 보유라 등록 제외)
- [x] research 상단(종착역 해소 — 차트·보유등록)

## Phase C — 보유 → 근거·출구
- [x] assets 보유 행(판정·차트)
- [x] ExitPlanBoard 행(판정·차트)
- [x] watchlist 행(➕ 보유 등록 — 관심↔보유 분리 해소)

## Phase D — 경보 → 종목
- [x] TimingWatchBanner 칩 전체를 차트 링크로(대시보드)
- [x] briefing ① 신호 칩도 동일 규약
- [x] 🚨 희석 경보를 브리핑에도(대시보드 전용이던 것)

## 마무리
- [x] tsc → lint → check:build → 배포
- [x] 라이브 검증: 브리핑 한 화면에 링크 32개(판정 10·차트 13·보유등록 9·관심 버튼 5). 이전 0개.
- [x] 희석 경보 브리핑 노출 실증(SK하이닉스 유상증자 공시)
- [x] CLAUDE.md·docs/README 기록

## 남은 이식 후보(다음 라운드)
- signal-report 채점 행 → 그 종목 리서치
- reco-hub 렌즈 카드 → 오늘 실제 추천과 연결(현재 정적 안내)
- assets 보유 → 거장 위원회 전체 화면(현재 배지만, 리밸런싱 탭 경유 필요)
