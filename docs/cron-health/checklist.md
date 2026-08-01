# 🚨 크론 헬스 모니터 체크리스트

- [x] Phase 0 — 크론 13개 ↔ 산출물 키 매핑 실측(판정표 context-notes)
- [x] SSOT lib(cronHealth.ts) — lastExpected·판정 순수 로직(+ttlH 워밍형 모드)
- [x] /api/cron-health — report + heal(예산 가드·auth)
- [x] vercel.json 크론 등록(09:40 KST)
- [x] 브리핑 상단 빨간 배너
- [x] 검증: 단위 13케이스 + 라이브 13/13 대조(오탐 2건 수정)
- [x] tsc → lint → check:build(&&) → 배포 → CLAUDE.md 기록
