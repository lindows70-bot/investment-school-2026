# 💰 현금 등록 — 설계 (2026-08-01)

## 목적
막스 시계추가 "권장 현금 20~30%"라 해도 **내 실제 현금이 몇 %인지 몰라 비교 불가**였던 빈틈. 현금은 앱이 알아낼 원천이 없는 유일한 자산 → 학생 입력(Zero-Input 원칙의 명시적 예외·주간 리포트 'unknown' 게이지 해소).

## 데이터
- 신규 테이블 `user_cash`(사용자당 1행·krw/usd·memo·RLS 본인만) — ⚠️ SQL Editor 1회 실행 필요, 미생성 시 `needsSetup` graceful(re_watchlist 관례)
- 자산 평가액 = 기존 SSOT 재사용: investments + `/api/stock-price` 배치(40청크) + `/api/exchange-rate`, **라이브 실패 시 원가 폴백**(ai-rebalance 0% 붕괴 교훈)
- 크립토는 `currency` 필드로 환산(업비트 KRW ×1380 폭증 방지 — 기존 버그 교훈)

## 계산 (결정론)
- cashKrw = krw + usd×환율 · totalKrw = 자산평가액 + cashKrw · cashPct = cashKrw/totalKrw×100
- 막스 권장 밴드(온도→20~30% 등, marks-cycle SSOT 재사용·재계산 금지) 대비 판정: 밴드 미만=공격적 / 안=적정 / 초과=보수적
- ⛔ "현금 늘려라/줄여라" 지시 아님 — 밴드 대비 위치 관측 + 판단은 학생

## 정직 캐비엇
- 학생이 입력한 값 기준(자동 연동 없음·갱신일 표기) · 증권사 예수금 실시간 아님 · 부동산·연금 등 앱 밖 자산 미포함

## 구현
lib/cashPosition.ts(SSOT) · /api/cash-position(GET/PUT·needsSetup) · CashPositionCard(자산 관리) · 막스 시계추 현금 밴드에 실측 병기 · 브리핑 ⑤ 칩 · 주간 리포트 게이지 실측 전환
