# 📉 커버드콜 X-Ray 체크리스트

- [x] Phase 0 — adjclose(TR) 분리·KR 제공·벤치마크 종목명 전수 검증(판정표 context-notes)
- [x] SSOT lib(coveredCall.ts) — 매핑·공통구간·갭 판정(+both_down)
- [x] /api/covered-call-xray (공개·일별 캐시·부분실패 박제 금지)
- [x] CoveredCallXray 컴포넌트 + 배당 인컴 랩 마운트
- [x] 유니버스 보강: 482730·458760 편입
- [x] 검증: 단위 8 + 라이브 독립 재계산 4쌍 일치 + 자기모순 2건 수정
- [x] tsc → check:build(&&) → 배포 → CLAUDE.md 기록
