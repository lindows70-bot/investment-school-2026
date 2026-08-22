# 🏛️ 우선주 축 체크리스트

- [x] Phase 0 데이터 실측 (판정표는 `context-notes.md`)
- [x] `src/lib/preferredStock.ts` SSOT 작성 (순수 함수·결정론)
- [x] `dividendProfile.ts` — `preferred` 필드 + 해당 없는 축 null + 경보 분기 + 캐시 v8→v9
- [x] `ultraDividendUniverse.ts` — `preferred` 티어 + 4종 등재
- [x] `DividendExplorer.tsx` — 우선주 패널·배지·프리셋 탭·경보 문구
- [x] `DividendIncomeLab.tsx` — 우선주 카테고리 분리 + 티커 병기
- [x] 판정 단위검증 — 표본 26종 **26/26 통과·오탐 0** (`scripts/verify-preferred-detect.mjs`)
- [x] tsc → lint → check:build (`&&` 체이닝) → 배포 (`2712b77`·`4f7307b`)
- [x] 독립 재계산 검증 — 4종 등급 불일치 소멸·액면 추정 $100 일치 (`scripts/verify-preferred-prod.mjs`)
- [x] 화면 검증 — 추가 패널에서 4종이 전부 "Strategy Inc"로 보이던 문제 발견·수정
- [x] CLAUDE.md / docs/README.md 기록

## 남은 것

- KR 우선주(005935 등)는 판정만 넣어두고 유니버스엔 없다 — 필요해지면 등재만 하면 된다.
- 야후 `shortName` 32자 절단으로 STRF/STRD 시리즈 문자열이 동일하다. 쿠폰·액면 괴리로는 구분되고 티커도 병기했으므로 실사용엔 지장 없지만, 더 긴 이름을 주는 소스를 찾으면 개선 여지.
