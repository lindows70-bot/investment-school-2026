# 📅 이벤트 캘린더 체크리스트

- [x] plan.md 작성
- [x] `/api/event-calendar` (auth·fp 캐시 12h·quoteSummary+chart div·동시성 4·KR .KS→.KQ 폴백)
- [x] `EventCalendarPanel` 풀(자산 관리 상단) + 컴팩트(브리핑 ①½ — 이벤트 없으면 렌더 0)
- [x] check + check:build 통과·배포(ed0ef80)
- [x] 검증(대표님 보유 원천 실측): 어닝 GOOGL D-4·KB금융 D-5·SK하이닉스 D-10·PLTR D-16·MPC D-17·COP D-19·NVDA D-39 / US 연배당 $16.85 + KR ₩10,798 수신
  - ⭐ 발견 ①: **KR 어닝일이 Yahoo .KS에서 실제 제공**(대형주) — "KR 미제공" 단정 캐비엇을 조건부·완화 문구로 교정
  - ⭐ 발견 ②: calendarEvents 배당락은 **지난 일정**인 경우가 많음(다음 공시 전) → dd≥0 필터가 정확히 걸러냄 + "공시 전엔 안 보임" 캐비엇 추가
- [x] CLAUDE.md 기록
