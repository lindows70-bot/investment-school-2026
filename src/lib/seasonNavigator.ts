// 4계절 매크로 내비게이터 SSOT 순수 로직 — 성장(OECD CLI)×물가(CPI) 2×2 사분면 + 보유 계절 적합도
// 핵심. 새 매크로 판정기가 아니라 macro-regime SSOT + CLI를 2×2로 번역하는 순수함수 계층(외부 호출 0)

// ── 성장축 / 물가축 신호 ────────────────────────────────────────────────────────
export type AxisDir = 'up' | 'down'

// 2×2 사분면(업로드 다이어그램 그대로) — 계절 별칭은 친근한 스킨일 뿐
export type Quadrant = 'goldilocks' | 'inflation' | 'stagflation' | 'recession' | 'shoulder'

export interface GrowthSignal {
  cli: number           // OECD CLI 최신 레벨(100 = 추세)
  cliPrev: number       // 3개월 전 레벨(모멘텀 산출용)
  dir: AxisDir          // 성장 방향(상승/하강)
  aboveTrend: boolean   // 레벨 100 상회 여부
}

export interface InflationSignal {
  cpiYoY: number        // macro-regime CPI YoY(%)
  rateDir: 'cut' | 'hold' | 'hike'
  hot: boolean          // 물가 압력 높음 여부
}

// CLI 레벨+모멘텀 → 성장 신호. 100 상회 또는 상승추세면 '성장 상방'
export function growthFromCli(cli: number, cliPrev: number): GrowthSignal {
  const dir: AxisDir = cli >= cliPrev ? 'up' : 'down'
  const aboveTrend = cli >= 100
  return { cli, cliPrev, dir, aboveTrend }
}

// CPI + 금리방향 → 물가 신호. CPI 3% 초과 또는 인상기조면 '물가 상방'
export function inflationFromRegime(cpiYoY: number, rateDir: 'cut' | 'hold' | 'hike'): InflationSignal {
  const hot = cpiYoY > 3.0 || rateDir === 'hike'
  return { cpiYoY, rateDir, hot }
}

// 성장 상방 여부(레벨·모멘텀 종합). 둘 다 같은 방향이면 명확, 엇갈리면 모멘텀 우선
function isGrowthUp(g: GrowthSignal): boolean {
  if (g.aboveTrend && g.dir === 'up') return true     // 추세 위 + 상승 = 확실한 확장
  if (!g.aboveTrend && g.dir === 'down') return false // 추세 아래 + 하락 = 확실한 수축
  return g.dir === 'up'                                // 엇갈리면 모멘텀(방향)을 신뢰
}

// 신호 강도가 약해 경계에 걸치면 간절기(SHOULDER) 발동
function isShoulder(g: GrowthSignal, i: InflationSignal): boolean {
  const cliFlat = Math.abs(g.cli - g.cliPrev) < 0.15 && Math.abs(g.cli - 100) < 0.3
  const infBorderline = i.cpiYoY > 2.5 && i.cpiYoY <= 3.0 && i.rateDir === 'hold'
  return cliFlat && infBorderline
}

// ── 사분면 판정 ─────────────────────────────────────────────────────────────────
export function seasonOf(g: GrowthSignal, i: InflationSignal): Quadrant {
  if (isShoulder(g, i)) return 'shoulder'
  const growthUp = isGrowthUp(g)
  if (growthUp && !i.hot) return 'goldilocks'    // 성장↑ 물가↓ = 골디락스(봄)
  if (growthUp && i.hot) return 'inflation'      // 성장↑ 물가↑ = 인플레이션(여름)
  if (!growthUp && i.hot) return 'stagflation'   // 성장↓ 물가↑ = 스태그플레이션(가을)
  return 'recession'                             // 성장↓ 물가↓ = 리세션(겨울)
}

// ── 계절 메타데이터(별칭·아이콘·해설·권장 현금·우대 섹터) ─────────────────────────
export interface SeasonMeta {
  quadrant: Quadrant
  seasonKo: string      // 친근한 계절 별칭
  icon: string
  label: string         // 사분면 정식 명칭
  cashHint: string      // 권장 현금 비중(조언 텍스트 — 점수 항 아님)
  guide: string         // 행동 가이드(최일 페르소나)
  favored: string[]     // 우대 GICS 섹터(Yahoo 표기)
}

export const SEASON_META: Record<Quadrant, SeasonMeta> = {
  goldilocks: {
    quadrant: 'goldilocks', seasonKo: '🌸 봄 (회복기)', icon: '🌸', label: '골디락스 (성장↑·물가↓)',
    cashHint: '권장 현금 10~20% — 유동성이 도는 국면이라 현금을 줄이고 주식을 가동할 시기입니다.',
    guide: '유동성이 돌고 물가가 안정된 최적 국면입니다. 저PEG 성장주와 바닥을 다진 우량주를 사들일 타이밍입니다.',
    favored: ['Technology', 'Consumer Cyclical', 'Financial Services'],
  },
  inflation: {
    quadrant: 'inflation', seasonKo: '☀️ 여름 (호황기)', icon: '☀️', label: '인플레이션 (성장↑·물가↑)',
    cashHint: '권장 현금 0~10% — 이익이 정점을 향하는 공격적 구간입니다.',
    guide: '경기가 확장하며 물가도 오르는 국면입니다. 시클리컬(소재·산업재)과 에너지로 인플레이션을 올라타세요.',
    favored: ['Energy', 'Basic Materials', 'Industrials'],
  },
  stagflation: {
    quadrant: 'stagflation', seasonKo: '🍁 가을 (후퇴기)', icon: '🍁', label: '스태그플레이션 (성장↓·물가↑)',
    cashHint: '권장 현금 40~50% — 위험 자산을 줄이고 현금을 확보할 국면입니다.',
    guide: '성장은 둔화되는데 물가는 높은 가장 까다로운 국면입니다. 이익 체력 없는 종목은 과감히 줄이고 에너지·실물 자산주 위주로 압축하세요.',
    favored: ['Energy', 'Utilities', 'Consumer Defensive'],
  },
  recession: {
    quadrant: 'recession', seasonKo: '❄️ 겨울 (침체기)', icon: '❄️', label: '리세션 (성장↓·물가↓)',
    cashHint: '권장 현금 30~40% — 방어적 포지션을 유지할 국면입니다.',
    guide: '디플레이션성 침체 국면입니다. 배당이 높고 변동성이 낮은 통신·유틸리티·필수소비재 대형 방어주로 압축하세요.',
    favored: ['Utilities', 'Consumer Defensive', 'Communication Services', 'Healthcare'],
  },
  shoulder: {
    quadrant: 'shoulder', seasonKo: '🌗 간절기 (전환 경계)', icon: '🌗', label: '간절기 (지표 상충)',
    cashHint: '권장 현금 30% 내외 — 방향이 불명확하니 보수적으로 운용하세요.',
    guide: '성장·물가 지표가 서로 충돌해 계절이 명확히 갈리지 않는 전환 구간입니다. 신규 베팅을 줄이고 다음 신호를 기다리세요.',
    favored: ['Consumer Defensive', 'Healthcare'],
  },
}

// ── 계절 × 보유 적합도 매트릭스 (린치 6대 분류 기반 0~1) ──────────────────────────
type LynchCat = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play'

const FIT: Record<Quadrant, Record<LynchCat, number>> = {
  // 골디락스. 성장주가 가장 빛나는 국면
  goldilocks:  { fast_grower: 1.0, stalwart: 0.8, cyclical: 0.6, turnaround: 0.7, asset_play: 0.5, slow_grower: 0.4 },
  // 인플레이션. 실물·경기민감이 인플레 헤지
  inflation:   { cyclical: 1.0, asset_play: 0.8, fast_grower: 0.7, stalwart: 0.6, turnaround: 0.5, slow_grower: 0.4 },
  // 스태그플레이션. 고듀레이션 성장주가 가장 취약
  stagflation: { asset_play: 0.9, slow_grower: 0.8, stalwart: 0.6, cyclical: 0.5, turnaround: 0.3, fast_grower: 0.2 },
  // 리세션. 방어·퀄리티가 생존
  recession:   { slow_grower: 1.0, stalwart: 0.8, asset_play: 0.5, turnaround: 0.4, cyclical: 0.3, fast_grower: 0.3 },
  // 간절기. 전반적으로 보수(중립값)
  shoulder:    { slow_grower: 0.7, stalwart: 0.7, asset_play: 0.6, turnaround: 0.5, cyclical: 0.5, fast_grower: 0.5 },
}

export interface Holding {
  ticker: string
  weight: number              // 포트폴리오 내 비중(%) — 주식 합 100 기준
  lynchCategory: LynchCat | null
  sector?: string             // Yahoo GICS 섹터(선택)
  market?: string             // 'KR' | 'US' — 시장별 계절 채점용(선택)
}

// 종목 한 개의 계절 적합도(0~1) — ★ 섹터(이 계절 우대 여부) 50% + 린치 분류 50% 블렌드
//   왜 50/50인가: 4계절 모델의 핵심은 '우대 섹터'인데, 린치분류만 쓰면 비우대 cyclical(은행·반도체)이
//   우대 cyclical(에너지·산업재)과 똑같이 1.0을 받아 '우대 섹터'가 무력화됨 → 섹터를 동등 주축으로 승격
export function holdingFit(h: Holding, quadrant: Quadrant): number {
  const cat = h.lynchCategory ?? 'stalwart'   // 미분류는 중립(대형우량주)으로 폴백
  const lynchFit = FIT[quadrant][cat] ?? 0.5
  const sectorFit = h.sector
    ? (SEASON_META[quadrant].favored.includes(h.sector) ? 1.0 : 0.5)   // 우대 섹터=1.0 · 그 외=0.5(중립)
    : 0.6                                                              // 섹터 미상=약중립
  return 0.5 * sectorFit + 0.5 * lynchFit
}

export interface AlignmentResult {
  score: number               // 0~100 계절 정합성 점수
  perHolding: { ticker: string; weight: number; fit: number; contribution: number }[]
}

// 종목별 계절 적합도 × 비중 가중합 → 0~100 점수
export function seasonalAlignment(holdings: Holding[], quadrant: Quadrant): AlignmentResult {
  const totalW = holdings.reduce((s, h) => s + h.weight, 0)
  if (totalW <= 0) return { score: 0, perHolding: [] }

  const perHolding = holdings.map(h => {
    const fit = holdingFit(h, quadrant)
    const contribution = (h.weight / totalW) * fit
    return { ticker: h.ticker, weight: h.weight, fit, contribution }
  })

  const score = Math.round(perHolding.reduce((s, p) => s + p.contribution, 0) * 100)
  return { score, perHolding }
}
