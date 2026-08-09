# 🏛️ 부동산 정책 레이더 체크리스트

- [x] Phase 0 데이터 실측 (판정표를 context-notes에)
- [x] 기존 기능 중복 확인 (news-catalyst·market-catalyst·crypto-regulation 전부 종목 단위 — 중복 없음)
- [ ] `lib/lawApi.ts` — 법령정보 API 클라이언트(XML·`<admrul id>` 속성 주의·부처 코드)
- [ ] `lib/rePolicy.ts` — 경로 분류·강도 판정·정치 필터(순수 함수·결정론)
- [ ] `api/re-policy` — 법령+뉴스 수집·캐시 `re-policy-v1`(6h)·부분실패 박제 금지
- [ ] `components/RePolicyRadar.tsx` — 신호등 + 확정/예고 2축 + 4경로 카드 + 캐비엇
- [ ] 대시보드 최상단 배치 + 각 지표로 연결
- [ ] **OC 발급 후** `LAW_API_OC` 를 `.env.local` + Vercel 환경변수에 등록
- [ ] 분류 정확도 손 채점(최근 30건) — 자동 분류만 믿지 않는다
- [ ] 정치 필터 역검(제외 목록을 눈으로 — 시장 기사를 잘못 거르지 않는지)
- [ ] tsc → lint → `check:build` → 배포 → **로그인 후 화면검증**(무반응 버튼은 이 방법으로만 잡힌다)
- [ ] CLAUDE.md 기록 + `docs/README.md` 인덱스 추가
