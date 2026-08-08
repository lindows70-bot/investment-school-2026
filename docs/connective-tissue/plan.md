# 🔗 연결 조직 — 설계 (2026-08-08)

## 목적
학생이 브리핑에서 "삼성E&A · 권장 편입 250만원 · 🟢 진입 적기"를 본다. **그다음 할 수 있는 게
없다.** 그 카드에 링크가 하나도 없어서, 근거를 더 보려면 대시보드 통합추천 탭에 들어가 같은
종목을 목록에서 다시 찾아야 하고, 사기로 마음먹으면 자산관리에서 티커를 **손으로 다시 타이핑**
해야 한다. 리서치 화면은 종합 매수 판정까지 보여주고도 나가는 링크가 0건인 종착역이다.

이게 해결되면: 학생은 어느 화면에서 종목을 보든 **그 자리에서 다음 행동**(근거 더 보기 · 차트
확인 · 관심 담기 · 보유 등록)으로 갈 수 있다. 화면 33개가 서로를 아는 하나의 앱이 된다.

## 데이터 (Phase 0 실측)
- ✅ 이미 있는 패턴: `hi52-radar/page.tsx:60-61`·`tech-screener`가 종목 행마다 `📉 차트`
  (`/tech-chart?ticker=&market=`)·`🎯 종합 판정`(`/research?q=`) 칩을 단다 — **이걸 SSOT 컴포넌트로
  추출해 이식**한다(신규 발명 0).
- ✅ `AddInvestmentModal`은 `initial?: Investment` prop 으로 프리필을 이미 지원. 다만 `/assets`가
  URL을 안 읽어서(useSearchParams 0건) 딥링크가 불가능했을 뿐.
- ✅ 관심종목 추가는 supabase `watchlist` 테이블 직접 insert(research/page.tsx 패턴).
- ❌ 푸시·이메일 알림 없음(nodemailer/resend/webhook grep 0) — 이번 범위 아님.

## 계산 (결정론)
판정 로직 변경 **0**. 순수 내비게이션·프리필만. 점수·추천·배지에 영향 없음.

## 정직 캐비엇 (UI)
- '담기'는 **관심종목 추가**이고 '보유 등록'은 **실제 매수 기록**이다 — 두 버튼의 뜻을 문구로 구분.
- ⛔ 자동매매 금지 원칙 유지: 어떤 버튼도 주문을 내지 않는다. '보유 등록'은 학생이 이미 산 것을
  기록하는 행위이고, 모달에서 수량·단가를 직접 입력한다(자동 채움 금지).

## 구현
- `src/app/components/StockActionChips.tsx` (신설) — 종목 단위 액션 SSOT
  · 🎯 종합 판정 `/research?q=` · 📉 차트 `/tech-chart?ticker=&market=`
  · ⭐ 관심 (watchlist insert, 이미 있으면 '담김' 표시) · ➕ 보유 등록 `/assets?add=&name=&market=`
  · `compact` 모드(칩 2개만) — 좁은 카드용
- `/assets` — `?add=TICKER` 읽어 모달 자동 오픈 + 프리필(useSearchParams)
- 이식 대상(9곳): UnifiedReco 카드 · briefing ③담을 것 · research 상단 · assets 보유 행 ·
  watchlist 행 · ExitPlanBoard · TimingWatchBanner · signal-report scored 행 · reco-hub 안내
- 캐시 영향 없음(판정 불변) · 크론 없음
