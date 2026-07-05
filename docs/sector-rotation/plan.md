# 🧭 섹터 로테이션 시계 (Sector Rotation Clock) — 설계

## 컨셉
"4계절 = 경제 계절", "막스 시계추 = 시장 심리"라면 이건 **섹터의 계절** — 돈이 🌱주도→🔥과열→🍂이탈→❄️태동을 시계방향 순환. 새 판정기 0(제1·2원칙): 기존 sectorEngine·SectorCanvas 재사용.

## 데이터 (기존 SSOT 재사용)
17개 섹터 = GICS 11(energy·materials·industrials·discretionary·staples·healthcare·financials·infotech·communication·utilities·realestate) + 테마 6(quantum·ai-semi·power·phys-ai·ai-bio·defense).
`/api/sector?key=X`(computeSector, 6h 캐시) 결과의 **섹터 stocks 평균 수익률**로 섹터별 ret1w/1m/1y 산출 → 섹터 탭과 동일값(제2원칙).

## RRG 좌표 (횡단면 상대강도 — 외부 벤치마크 불필요)
- mean1m·mean1w = 17섹터 평균
- **X 상대강도** = ret1m − mean1m (한 달간 peer 대비 초과)
- **Y 모멘텀** = ret1w − mean1w (최근 1주 peer 대비 — 가속/둔화)
- 사분면: X>0&Y>0 🌱주도 / X>0&Y≤0 🔥과열 / X≤0&Y≤0 🍂이탈 / X≤0&Y>0 ❄️태동
- **자금쏠림 점수** = 0.6·X + 0.4·Y → 🔥유입 Top / ❄️이탈 Top

## 위젯
- **A 로테이션 시계**: 17섹터를 4사분면 원형에 배치(목업 그대로). 클릭 → 드릴다운.
- **B 자금 순환 랭킹**: 🔥유입 Top3 / ❄️이탈 Top3.
- **C 드릴다운**: 선택 섹터의 기존 `SectorCanvas`(소섹터 카드 + 대장주 표) 그대로 임베드.

## 정직성 (막스 철학 연결)
- 가격 상대강도 기준(수급의 결과=가격) — 리터럴 '자금'은 KR 드릴다운 실수급으로 보강 여지. 명시.
- 반-하이프 가드: 🔥과열(강했으나 둔화)=차익경계, ❄️태동(약했으나 가속)=역발상. 막스 시계추와 동일 철학.
- 예측 아님, 현재 위치. 신규상장주(weeks<52)는 1y 제외.

## 제미나이 대비
- SMPI(수익률×per-종목 거래량속도) 거부(단위 뒤섞임) → RRG 표준(상대강도+모멘텀).
- 2D 나침반 → 원형 시계(4계절·막스와 시각 통일).
- 새 엔진 0 — sectorEngine·SectorCanvas 재사용.

## 종목 보강 (2단계)
sectorConfigs 각 소섹터 미국3+한국3 목표. 제미나이 리스트 골격 참고, **티커 전수 실측 검증**(제1원칙). 3:3 미달 소섹터 채움 → 기존 SectorCanvas 대장주 표에 자동 반영.

## 구현
- `/api/sector-rotation`(공개·6h): 17개 `/api/sector` 병렬 집계 → RRG. 과반 실패 시 캐시 박제 금지.
- `SectorRotation.tsx`: 원형 시계 SVG + 랭킹 + `<SectorCanvas sectorKey=selected/>` 드릴다운.
- 대시보드 '테마·섹터 분석' 또는 신규 상단 탭.
