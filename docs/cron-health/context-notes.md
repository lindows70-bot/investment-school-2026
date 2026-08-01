# 크론 헬스 모니터 — 컨텍스트 노트

## 크론 ↔ 산출물 매핑 판정표 (2026-08-01 실측)
| 크론(KST) | 산출물 | 판정 방식 | 자동복구 |
|---|---|---|---|
| nps-portfolio 03:00 | app_cache `nps-portfolio` | updated_at | ❌(무거움·24h캐시) |
| shadow-13f 03:00 | `shadow-13f-funds` | updated_at | ❌ |
| satellite-scores 03:30 | SAT_SCORE_KEY | updated_at | ✅ |
| school-index 04:00 | DB school_index_stock_snapshots | max base_date | ✅ |
| macro-ai-picks 화 04:00 | UNIVERSE_KEY | updated_at(주간) | ❌(Gemini·주간) |
| morning-briefing 05:00 | DB user_daily_briefings | max base_date | ✅(마지막·예산가드) |
| re-honeycomb 05:30 | `re-honeycomb-v3` | updated_at | ✅ |
| blackrock 화 06:00 | `blackrock-13f-v2` | updated_at(주간) | ❌(46MB 파싱) |
| timing-watch 08:30 | `timing-watch-latest-v2` | updated_at | ✅ ⭐사고 당사자 |
| win-lose 08:50 | WIN_LOSE_KEY(일자) | 키 존재 | ✅ |
| tech-screener 09:10 | `tech-screener-v1:{일자}` | 키 존재 | ✅ |
| hi52-radar 09:25 | `hi52-radar-v2:{일자}` | 키 존재 | ✅ |
| market-flow-kr 평일 20:00 | MARKET_FLOW_KR_KEY(일자) | 키 존재 | ✅(GET 셀프힐 경유) |

## 채택하지 않은 안과 이유
- **크론 실행 로그 테이블 신설** — 13개 라우트 전부 수정 필요·산출물 캐시가 이미 실행 증거라 이중 기록. 기각.
- **stale 시 즉시 전체 자동 재실행** — nps·blackrock·macro-ai-picks는 무겁고(45~120s·Gemini) 주간이라 오탐 재실행 비용 큼 → 보고만. 복구는 idempotent 경량 크론만.
- **판정을 브리핑 페이지에서 클라 계산** — CRON_SECRET로 재실행하려면 서버 필수 + 캐시 키 SSOT import는 서버 lib이 정위치.

## 임계값 근거
- grace 45분: 가장 긴 크론(win-lose 300s 상한)의 5배 이상 여유 — 실행 지연을 미발화로 오탐하지 않게.
- heal 예산 240초: 라우트 maxDuration 300의 80%(응답 여유 60초).

## 검증에서 발견한 것 (2026-08-01 라이브 대조)
1. **워밍형 크론은 예정 시각 판정이 오탐** — nps·honeycomb는 라우트가 캐시 TTL로 재계산을 스스로 결정하므로, 사용자가 중간에 캐시를 갱신하면 다음 크론은 정상 실행돼도 updated_at 불변 → 기대 시각 판정으로는 가짜 stale. → `ttlH` 모드(최대 허용 나이 = TTL+24h+유예) 분리.
2. **죽은 키를 감시할 뻔** — 'shadow-13f-funds'는 7/25 CUSIP 작업 때 v4로 바뀐 옛 키(7/25에 멈춘 게 당연). 모니터가 옛 키를 보면 "7일째 미발화" 영구 오경보. → guru13f.ts의 FUND_CACHE_KEY를 export해 SSOT import(전 키 동일 원칙 — 리터럴 금지).
3. 수정 후 13/13 ok = 오늘(8/1) 크론 전부 정상 실측. 단위 검증 13케이스(요일·주간·유예 경계) 통과.
