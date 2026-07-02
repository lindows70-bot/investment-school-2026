# 🌐 피델리티 글로벌 비즈니스 사이클 — 설계 (2026-07-03)

> 참고: https://institutional.fidelity.com/app/item/RD_13569_40890/business-cycle-update.html
> 사용자 요청: 제미나이 아이디어 참고하되 "훨씬 더 이쁜 디자인으로 멋지게".

## 핵심 설계 판단 (제미나이 안과 다른 점)

⚠️ **제미나이 안의 하드코딩 거부(제1원칙)**: 제미나이는 국가별 위치(미국=Mid, 중국=Recovery…)를
정적 데이터로 박음 → 피델리티의 독점 리서치 결과를 베낀 것이고, 분기마다 낡아서 거짓말하는 화면이 됨.
**우리 = OECD CLI 실데이터로 국가별 국면 자동 판정** (4계절 내비게이터가 이미 쓰는 패턴의 다국가 확장).

## 데이터 (전부 실측 검증 완료, 2026-07-03)

FRED OECD 경기선행지수(CLI) — **13개국 전부 신선(2026-05)**, 무료·기존 FRED 키:
`{ISO3}LOLITOAASTSAM` — USA·KOR·CHN·JPN·DEU·GBR·IND·BRA·CAN·AUS·MEX·FRA·ITA
(실측: US 101.02 · KR 102.60 · CN 98.91 · JP 100.27 · BR 103.82 · MX 103.19 …)

## 국면 판정 알고리즘 (결정론적 — AI·하드코딩 0)

CLI **레벨**(100 기준) × **모멘텀**(3개월차)의 2×2 + 세분:
| 레벨 | 모멘텀↑ | 모멘텀↓ |
|---|---|---|
| <100 | **Early(회복)** — 바닥 반등 | **Recession(수축)** — 침체 진행 |
| ≥100 | **Mid(확장)** — 추세 위 가속 | **Late(후기)** — 정점 통과 감속 |

- 곡선상 x좌표: 국면 구간 내 위치를 (레벨 편차 + 모멘텀 크기)로 보간 → 같은 국면 국가도 다른 위치
- 국가끼리 겹치면 y 살짝 오프셋(피델리티 원본처럼 버블이 자연스럽게 흩어짐)
- ⚠️ 캐비엇 명시: OECD CLI는 발표 시차 ~1개월, 피델리티 공식 배치와 다를 수 있음(우리는 실데이터 자동 판정)

## API — `/api/global-cycle` (공개 · 24h 캐시 `global-cycle-v1`)

```ts
interface GlobalCycleResult {
  countries: {
    code: string; ko: string; flag: string           // 'US', '미국', '🇺🇸'
    cli: number; momentum: number                     // 레벨·3개월차
    phase: 'early'|'mid'|'late'|'recession'
    curveX: number                                    // 0~100 곡선상 위치
    spark: number[]                                   // CLI 최근 24개월(미니차트)
  }[]
  phaseGuide: { phase, favored: string[], note }[]   // 국면별 유리 자산/섹터(교과서 상수 — FRED 폴백류 허용)
  asOf: string
}
```
- FRED 13시리즈 Promise.all(기존 `fred()` 헬퍼 재사용, observation_start 2년)
- 국면별 유리 자산 가이드는 피델리티 공개 방법론의 교과서 경향(상수 허용 — 모닝스타 밴드와 같은 원리)

## UI — `GlobalBusinessCycle.tsx` (투자 리서치 탭 신설 `globalcycle`)

**프리미엄 디자인 (레이 달리오 곡선에서 검증된 기법 재사용):**
1. **S-곡선 SVG**: 상승(Early→Mid, 초록→골드 그라디언트) → 정점 → 하강(Late→Recession, 골드→빨강)
   + 면적 그라디언트 채움 + 국면 4구간 배경 밴드(Early/Mid/Late/Recession 라벨)
   + 상단 인플레이션 압력 그라디언트 바(피델리티 원본 요소)
2. **국가 버블**: 곡선 위 원형 노드(국기 이모지 + 국가명), 현재 선택국 펄스 애니메이션
   + 라벨은 paint-order stroke 외곽선(겹침 방지 — 달리오 곡선에서 검증)
3. **인터랙션**: 국가 클릭 → 우측/하단 상세 패널(CLI 값·모멘텀·국면 해설·CLI 24개월 스파크라인)
   — 제미나이의 hover 대신 클릭(모바일 대응, 앱 관례)
4. **국면별 성적표**: 4국면 카드(유리 자산·섹터) + 현재 미국·한국 국면 하이라이트
5. **SSOT 연결**: 미국·한국 국면이 4계절 내비게이터 계절과 나란히 표시
   ("피델리티 국면(성장 사이클) vs 우리 4계절(성장×물가)" 차이 교육 — 축이 달라 다를 수 있음 명시)

## 구현 순서 (체크리스트)
- [ ] `/api/global-cycle` — FRED 13개국 CLI + 판정 + 캐시
- [ ] 판정 알고리즘 단위 검산(레벨×모멘텀 4상한 + 보간)
- [ ] `GlobalBusinessCycle.tsx` — S-곡선 SVG + 버블 + 상세 패널 + 성적표
- [ ] dashboard 탭 배선(투자 리서치 그룹)
- [ ] `npm run check` + `npm run check:build`(분리 빌드 — dev 무손상)
- [ ] 배포 → 화면검증(국가 위치를 CLI 원값으로 독립 재계산 대조)

## 주의(기존 교훈 적용)
- 캐시 키 버전업 규율(스키마 변경 시), dev/prod 공유 app_cache
- JSX 따옴표 escape(`&ldquo;`), `(x as number)` 괄호 — next build 함정
- 배포 후 `git log` 확인, `.next-build`는 .vercelignore 등록됨
