# 🏛️ 우선주 축 체크리스트

- [x] Phase 0 데이터 실측 (판정표는 `context-notes.md`)
- [ ] `src/lib/preferredStock.ts` SSOT 작성 (순수 함수·결정론)
- [ ] `dividendProfile.ts` — `preferred` 필드 + 해당 없는 축 null + 경보 분기 + 캐시 v8→v9
- [ ] `ultraDividendUniverse.ts` — `preferred` 티어 + 4종 등재
- [ ] `DividendExplorer.tsx` — 우선주 패널·배지·경보 문구
- [ ] `DividendIncomeLab.tsx` — 티어 색상
- [ ] 판정 단위검증 — 표본 28종(우선주 7·보통주 10·ETF 4·KR 4 등)에서 오탐 0 재확인
- [ ] tsc → lint → check:build (`&&` 체이닝) → 배포
- [ ] 독립 재계산 검증 — 프로덕션 응답에서 4종 등급 불일치 소멸·액면 추정 $100 확인
- [ ] 화면 검증 (학생 눈으로 읽히는지)
- [ ] CLAUDE.md / docs/README.md 기록
