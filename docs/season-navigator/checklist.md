# 🧭 4계절 매크로 내비게이터 — 빌드 체크리스트

> 기능 13. 최일 『4계절 투자법』을 주식 전용(Stock-Only) 환경에 이식.
> 핵심 원칙. 새 매크로 판정기를 만들지 않고 `/api/macro-regime` SSOT의 사람 친화적 2×2 뷰로 구현한다.

## Phase 0 — 데이터 검증 ✅ 완료
- [x] FRED 성장축 데이터 실측 (Gemini의 한국 재고순환선은 stale → 환각 확인)
- [x] OECD CLI 한국(KORLOLITOAASTSAM)·미국(USALOLITOAASTSAM) 신선도 확인 → 둘 다 2026-04, 사용 가능
- [x] 장단기차 T10Y2Y는 macro-regime이 이미 fetch → 역전 경보 무료

## Phase 1 — 순수 로직 (seasonOf + 적합도 매트릭스) ✅ 완료
- [x] `src/lib/seasonNavigator.ts` 생성 (순수함수, 외부 호출 0)
- [x] `seasonOf(growthSignal, inflationSignal)` → 2×2 사분면(골디락스/인플레/스태그/리세션) + 간절기
- [x] `[계절 × lynch분류/섹터]` 계절 적합도 매트릭스(0~1) 정의 + 섹터 보정(+0.2)
- [x] `seasonalAlignment(holdings, season)` = Σ(주식 비중 × 적합도) × 100
- [x] verify. 11개 단위테스트 전부 통과(4사분면+간절기+점수+섹터보정+엣지) · 타입체크 0

## Phase 2 — API (macro-regime + CLI + investments 조인)
- [ ] `/api/season-navigator` 생성 (Supabase auth, force-dynamic, holdingsFingerprint 캐시)
- [ ] macro-regime 재사용(물가/금리축) + OECD CLI fetch(성장축, 12h 캐시)
- [ ] 보유종목 lynch_category + getSector(재사용) → 정합성 점수
- [ ] verify. 실제 학생 DB로 점수 산출, 매크로 결론이 macro-regime과 100% 일치

## Phase 3 — UI (단일 강력 카드)
- [ ] `src/app/components/SeasonNavigator.tsx` 생성
- [ ] 2×2 휠 배너 + 정합성 게이지 + yieldCurve 역전 경보
- [ ] 현금은 조언 텍스트로만(점수 항 아님) 표시
- [ ] verify. 화면 국면 문구가 MacroDashboard·macro-ai-picks와 동일한지 대조

## Phase 4 — 배포
- [ ] 정직성 푸터(교육용·현금 미추적 명시)
- [ ] 타입체크 + 배포
- [ ] CLAUDE.md에 기능 13 기록
