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

## Phase E — 잔여 연결 (완료)
- [x] signal-report 종목 칩 → 그 종목 리서치
- [x] reco-hub '읽는 법'의 "리서치로 확인하라" 안내에 실제 링크(정적 지도 원칙은 유지 — fetch 0)
- [x] 사이드바에 🐎 신고가 레이더 추가(크론·헬스까지 있는데 내비게이션에서만 빠져 있었다)
- [x] assets → 거장 위원회: Phase C의 🎯 종합 판정 칩으로 이미 도달 가능 — 별도 작업 불필요 확인

## Phase F — 데드코드 정리 (완료)
- [x] 컴포넌트 6종 삭제(BuffettDCFPanel·LynchWizard·SeoulPlanMap·macro 3종 고립 클러스터)
- [x] 서버액션 1·lib 3·라우트 6 삭제 — 총 **2,794줄**
- [x] ⚠️ LynchLineChart 의 손으로 박은 종목별 주가 시계열(제1원칙 위반) 함께 제거
- [x] 정책금리 15개국 테이블 복제 → `lib/policyRates.ts` SSOT
- [x] ⛔ 보존: tossQuote/tossOwner(보존 결정 기록 있음) · macroData(실제 폴백 사용 중)
- [x] 삭제 후 tsc·lint·check:build 통과 + 라이브 12화면 200/307 정상

## Phase G — 잔여 후보 처리 (완료)
- [x] middleware protectedPaths 13개 보강 — 라이브 전수 307 리다이렉트 확인
- [x] macroData 구형 중복 상수 제거(DOT_RATES·DOT_PLOT_DATA·SepRow·SEP_TABLE·toDots·타입 2)
      ⛔ LATEST_SEP 은 MacroDashboard 실사용 중이라 보존 — 조사 에이전트의 '참조 0' 판정은 오판이었다
- [x] **덤으로 발견·수정**: SEP 점도표 수치가 출처(발표 회차) 없이 화면에 나가고 있었다.
      세 분기 문구에 기준 병기 + 6개월 초과 시 `⚠️ N개월 전 전망` 자동 표시
- [x] reco-hub '오늘의 대표 종목' — **기각**(근거는 context-notes.md). 지도의 목적이 흐려지고
      API 6개를 새로 호출해야 하며, 이미 지도→렌즈 화면→종목 액션 두 클릭으로 도달한다

## 전부 완료 — 남은 것 없음

