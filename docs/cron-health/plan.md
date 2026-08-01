# 🚨 크론 헬스 모니터 — 설계 (2026-08-01)

## 목적
크론 미발화(8/1 타점 워처 사고)가 **조용히** 지나가는 것을 차단 — 산출물 캐시의 updated_at으로 매일 자동 점검, 안 돈 크론은 브리핑 상단 빨간 줄 + 경량 크론은 자동 재실행.

## 데이터 (Phase 0 실측)
- ✅ 크론 13개 전부 산출물이 app_cache 키 또는 DB 테이블에 남음(vercel.json + 각 라우트 실측)
- 키는 전부 lib SSOT 상수 import(WIN_LOSE_KEY·MARKET_FLOW_KR_KEY·SAT_SCORE_KEY·UNIVERSE_KEY) — 리터럴 복사 금지
- ⚠️ 요일 크론은 UTC 요일 기준: macro-ai-picks(월 19UTC)=화 04:00 KST·blackrock=화 06:00 KST

## 계산 (결정론)
- lastExpected = 지금 이전의 가장 최근 예정 시각(KST·요일 반영)
- artifact updated_at ≥ lastExpected → ok / now < lastExpected+45분 → pending / 그 외 stale
- 자동 복구: 크론 호출(Authorization 일치)일 때만, 경량 크론 화이트리스트, 240초 예산, 무거운 것(morning-briefing)은 마지막

## 정직 캐비엇
- 헬스 크론 자신이 안 돌면 못 잡음(브리핑 페이지 접속 시 라이브 재점검이 보조) · 복구는 idempotent 크론만

## 구현
- src/lib/cronHealth.ts (모니터 정의+판정 SSOT) · /api/cron-health (report+heal) · vercel.json 크론 40 0(09:40 KST) · 브리핑 상단 배너
