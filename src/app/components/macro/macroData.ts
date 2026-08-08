/**
 * macroData.ts — 거시경제 Fed Watch 대시보드 Mock 데이터
 *
 * 실제 API 연동 전 구조화된 Mock 데이터.
 * 각 섹션이 독립적으로 import 해서 사용할 수 있도록 named export 분리.
 *
 * 데이터 출처 (미래 연동 시 대체):
 *  - FRED API  : https://fred.stlouisfed.org/docs/api/fred/
 *  - FRB       : https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 */

// ────────────────────────────────────────────────────────────────────────────
// Section 1 : Inflation & Rate Navigator
// ────────────────────────────────────────────────────────────────────────────
export interface InflationPoint {
  month:       string   // 'YYYY-MM'
  headlinePCE: number   // Headline PCE YoY %
  corePCE:     number   // Core PCE YoY %
  fedRate:     number   // EFFR (Effective Federal Funds Rate) %
}

export const INFLATION_DATA: InflationPoint[] = [
  { month: '2023-01', headlinePCE: 5.4, corePCE: 4.9, fedRate: 4.50 },
  { month: '2023-03', headlinePCE: 4.2, corePCE: 4.6, fedRate: 4.83 },
  { month: '2023-06', headlinePCE: 3.0, corePCE: 4.2, fedRate: 5.08 },
  { month: '2023-09', headlinePCE: 3.4, corePCE: 3.7, fedRate: 5.33 },
  { month: '2023-12', headlinePCE: 2.6, corePCE: 3.2, fedRate: 5.33 },
  { month: '2024-03', headlinePCE: 2.7, corePCE: 2.8, fedRate: 5.33 },
  { month: '2024-06', headlinePCE: 2.5, corePCE: 2.6, fedRate: 5.33 },
  { month: '2024-09', headlinePCE: 2.1, corePCE: 2.7, fedRate: 5.08 },
  { month: '2024-12', headlinePCE: 2.4, corePCE: 2.8, fedRate: 4.58 },
  { month: '2025-03', headlinePCE: 2.3, corePCE: 2.6, fedRate: 4.33 },
  { month: '2025-06', headlinePCE: 2.2, corePCE: 2.5, fedRate: 4.08 },
  { month: '2025-09', headlinePCE: 2.1, corePCE: 2.4, fedRate: 3.83 },
  { month: '2025-12', headlinePCE: 2.2, corePCE: 2.3, fedRate: 3.58 },
  { month: '2026-03', headlinePCE: 2.3, corePCE: 2.4, fedRate: 3.33 },
  { month: '2026-05', headlinePCE: 2.4, corePCE: 2.5, fedRate: 3.33 },
]

// 연준 목표치
export const FED_TARGET = 2.0

// ────────────────────────────────────────────────────────────────────────────
// Section 2 : Dot Plot — 아래 LATEST_SEP(신형)으로 통합됨
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ 2026-08-08 정리: 같은 SEP 데이터를 구형(DOT_RATES/DOT_PLOT_DATA·SepRow/SEP_TABLE)과
//    신형(LATEST_SEP)이 **이중으로** 들고 있었다(구형 축 y2025~ · 신형 축 y2026~).
//    구형은 외부 참조 0이었고, 한쪽만 갱신하면 조용히 갈라지는 구조라 제거했다. 신형 하나만 유지한다.

// ────────────────────────────────────────────────────────────────────────────
// Section 3 : 연준 대차대조표 (QT — 양적 긴축)
// ────────────────────────────────────────────────────────────────────────────
export interface BalanceSheetPoint {
  month: string   // 'YYYY-MM'
  total: number   // Total Assets (조 달러, Trillions)
  tsy:   number   // US Treasuries
  mbs:   number   // MBS
}

// ────────────────────────────────────────────────────────────────────────────
// Section 2 SEP — 구조화 JSON (Static, FOMC 발표 시 값만 교체)
// ────────────────────────────────────────────────────────────────────────────
// 연 4회(3·6·9·12월) FOMC에서 발표. JSON 값만 업데이트하면 차트·테이블 자동 반영.
export interface SepTableRow {
  label:      string
  unit:       string
  y2026:      string
  y2027:      string
  y2028:      string
  longerRun:  string
  direction:  'up' | 'down' | 'neutral'
}

export interface SepDotYear {
  year:   string
  rates:  number[]   // 위원 19명의 예상 금리
  median: number     // 중간값
}

export interface SepConfig {
  publishDate:  string         // 'YYYY-MM'  e.g. '2025-03'
  publishLabel: string         // 표시용 텍스트
  currentRate:  number         // 현재 실효 연방기금금리 (ReferenceLine용)
  table:        SepTableRow[]
  dotPlot:      SepDotYear[]
}

/**
 * ★ LATEST_SEP — 가장 최근 FOMC SEP 데이터 (2025년 3월 기준)
 *   다음 발표(2025년 6월) 후 아래 값만 교체하면 전체 차트·테이블이 자동 업데이트됩니다.
 */
export const LATEST_SEP: SepConfig = {
  publishDate:  '2025-03',
  publishLabel: '2025년 3월 FOMC',
  currentRate:  3.33,

  table: [
    { label: '실질 GDP 성장률',   unit: '%', y2026: '1.7', y2027: '1.8', y2028: '1.9', longerRun: '1.8', direction: 'neutral' },
    { label: '실업률',            unit: '%', y2026: '4.4', y2027: '4.3', y2028: '4.3', longerRun: '4.2', direction: 'neutral' },
    { label: 'PCE 인플레이션',    unit: '%', y2026: '2.7', y2027: '2.2', y2028: '2.0', longerRun: '2.0', direction: 'down'    },
    { label: 'Core PCE',         unit: '%', y2026: '2.8', y2027: '2.2', y2028: '2.0', longerRun: '—',   direction: 'down'    },
    // ★ 금리 중간값 행은 dotPlot 데이터에서 동적으로 파생됨 — 여기서 하드코딩 금지
    //   DotPlotPanel 에서 sep.dotPlot[].median 값을 직접 읽어 테이블에 렌더링
  ],

  dotPlot: [
    {
      year: '2026',
      rates: [4.375,4.375,4.125,4.125,4.125,3.875,3.875,3.875,3.875,3.625,3.625,3.625,3.375,3.375,3.375,3.125,3.125,2.875,2.875],
      median: 3.875,
    },
    {
      year: '2027',
      rates: [3.625,3.375,3.375,3.125,3.125,3.125,2.875,2.875,2.875,2.625,2.625,2.625,2.625,2.375,2.375,2.125,2.125,2.125,1.875],
      median: 2.875,
    },
    {
      year: '2028',
      rates: [3.125,3.125,2.875,2.875,2.625,2.625,2.625,2.375,2.375,2.375,2.125,2.125,2.125,1.875,1.875,1.875,1.875,1.625,1.625],
      median: 2.125,
    },
    {
      year: 'Longer-run',
      rates: [3.0,3.0,3.0,2.875,2.875,2.875,2.75,2.75,2.75,2.75,2.625,2.625,2.5,2.5,2.5,2.375,2.375,2.25,2.25],
      median: 2.75,
    },
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Section 3 : 연준 대차대조표 Mock (FRED API 폴백용)
// ────────────────────────────────────────────────────────────────────────────
export const BALANCE_SHEET_DATA: BalanceSheetPoint[] = [
  { month: '2022-04', total: 8.97, tsy: 5.77, mbs: 2.74 },
  { month: '2022-07', total: 8.87, tsy: 5.73, mbs: 2.70 },
  { month: '2022-10', total: 8.69, tsy: 5.65, mbs: 2.69 },
  { month: '2023-01', total: 8.49, tsy: 5.43, mbs: 2.64 },
  { month: '2023-04', total: 8.40, tsy: 5.33, mbs: 2.59 },
  { month: '2023-07', total: 8.16, tsy: 5.08, mbs: 2.56 },
  { month: '2023-10', total: 7.95, tsy: 4.84, mbs: 2.50 },
  { month: '2024-01', total: 7.67, tsy: 4.72, mbs: 2.42 },
  { month: '2024-04', total: 7.41, tsy: 4.56, mbs: 2.33 },
  { month: '2024-07', total: 7.22, tsy: 4.41, mbs: 2.28 },
  { month: '2024-10', total: 6.99, tsy: 4.21, mbs: 2.26 },
  { month: '2025-01', total: 6.83, tsy: 4.10, mbs: 2.22 },
  { month: '2025-04', total: 6.72, tsy: 4.02, mbs: 2.18 },
  { month: '2025-07', total: 6.62, tsy: 3.95, mbs: 2.15 },
  { month: '2025-10', total: 6.54, tsy: 3.89, mbs: 2.12 },
  { month: '2026-01', total: 6.49, tsy: 3.85, mbs: 2.10 },
  { month: '2026-04', total: 6.46, tsy: 3.82, mbs: 2.09 },
]
