// 🔗 채권 상관 SSOT — "채권이 발작할 때" 다른 자산이 어떻게 움직였나(조건부 상관).
//   ⚠️ 3년 전체 상관 하나만 보면 밋밋하다(실측: TLT↔SPY 0.16). 평온기와 발작기를 평균낸 값이기 때문이다.
//      사용자가 물은 건 "채권이 발작할 때"이므로 **발작일만 골라 따로 계산**한다.
//   ⛔ 상관은 과거값이고 국면이 바뀌면 부호도 바뀐다(2022년 주식·채권 동반 하락이 실례) — 화면에 명시.

const UA = { 'User-Agent': 'Mozilla/5.0' }

export interface CorrAsset {
  sym: string
  label: string
  /** 무엇인지 한 줄(학생용) */
  what: string
  group: 'bond' | 'equity' | 'alt' | 'fx'
}

/** 비교 자산 — Phase 0 에서 전부 753일+ 확보 확인 */
export const CORR_ASSETS: CorrAsset[] = [
  { sym: 'IEF', label: '미국 중기국채', what: '7~10년 국채 ETF', group: 'bond' },
  { sym: 'SHY', label: '미국 단기국채', what: '1~3년 국채 ETF', group: 'bond' },
  { sym: 'LQD', label: '투자등급 회사채', what: '우량 기업이 빌린 돈', group: 'bond' },
  { sym: 'HYG', label: '하이일드 회사채', what: '신용도 낮은 기업 채권', group: 'bond' },
  { sym: 'SPY', label: 'S&P 500', what: '미국 대형주', group: 'equity' },
  { sym: 'QQQ', label: '나스닥 100', what: '기술·성장주', group: 'equity' },
  { sym: 'XLU', label: '유틸리티', what: '금리에 가장 민감한 섹터', group: 'equity' },
  { sym: 'XLF', label: '금융', what: '예대마진 = 곡선 기울기 수혜', group: 'equity' },
  { sym: 'EEM', label: '신흥국 주식', what: '달러·금리에 취약한 쪽', group: 'equity' },
  { sym: 'GLD', label: '금', what: '실질금리의 거울', group: 'alt' },
  { sym: 'BTC-USD', label: '비트코인', what: '유동성에 가장 민감한 위험자산', group: 'alt' },
  { sym: 'DX-Y.NYB', label: '달러지수', what: '금리차가 만드는 통화 가치', group: 'fx' },
]

export interface CorrRow {
  sym: string; label: string; what: string; group: CorrAsset['group']
  all: number | null
  /** 채권 발작일만 골라 계산한 상관 */
  stress: number | null
  /** 발작일 평균 수익률(%) — 상관은 방향만 알려주므로 실제 크기를 함께 본다 */
  stressAvgRet: number | null
  /** 평상시 대비 발작기 상관 변화 */
  shift: number | null
}

export interface BondCorrResult {
  from: string; to: string
  days: number
  /** 발작일 정의와 개수 */
  stressDays: number
  stressRule: string
  /** 최근 발작일 목록(상위 5개, 크기순) */
  recentStress: { date: string; tltRet: number }[]
  rows: CorrRow[]
  /** 채권 변동성(^MOVE) 현황 */
  move: { last: number; date: string; pct1y: number | null; regime: 'calm' | 'normal' | 'stress' } | null
  notes: string[]
}

async function daily(sym: string, days: number): Promise<{ d: string; c: number }[]> {
  try {
    const p2 = Math.floor(Date.now() / 1000)
    const p1 = p2 - days * 86400
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${p1}&period2=${p2}&interval=1d`,
      { headers: UA, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!r.ok) return []
    const q = (await r.json())?.chart?.result?.[0]
    if (!q?.timestamp) return []
    const out: { d: string; c: number }[] = []
    for (let i = 0; i < q.timestamp.length; i++) {
      const c = q.indicators?.quote?.[0]?.close?.[i]
      if (typeof c === 'number' && c > 0) out.push({ d: new Date(q.timestamp[i] * 1000).toISOString().slice(0, 10), c })
    }
    return out
  } catch { return [] }
}

const retMap = (a: { d: string; c: number }[]) => {
  const m = new Map<string, number>()
  for (let i = 1; i < a.length; i++) m.set(a[i].d, a[i].c / a[i - 1].c - 1)
  return m
}

function pearson(x: number[], y: number[]): number | null {
  if (x.length < 30) return null
  const n = x.length
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b }
  return dx > 0 && dy > 0 ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null
}

/** 발작일 임계 — TLT 일간 |수익률| 상위 10%. 절대값(예: 1%)으로 박으면 국면에 따라 0건 또는 전건이 된다. */
export const STRESS_PCTILE = 0.10

export async function buildBondCorrelation(lookbackDays = 1095): Promise<BondCorrResult | null> {
  const tlt = await daily('TLT', lookbackDays + 30)
  if (tlt.length < 200) return null
  const tltR = retMap(tlt)

  const others = await Promise.all(CORR_ASSETS.map(a => daily(a.sym, lookbackDays + 30)))
  const move = await daily('^MOVE', lookbackDays + 30)

  // 발작일 = TLT 일간 변동폭 상위 10%
  const absSorted = Array.from(tltR.values()).map(Math.abs).sort((a, b) => b - a)
  const cut = absSorted[Math.floor(absSorted.length * STRESS_PCTILE)] ?? 0
  const stressDates = new Set(Array.from(tltR.entries()).filter(([, v]) => Math.abs(v) >= cut).map(([d]) => d))

  const rows: CorrRow[] = CORR_ASSETS.map((a, i) => {
    const oR = retMap(others[i])
    const common = Array.from(tltR.keys()).filter(d => oR.has(d))
    const all = pearson(common.map(d => tltR.get(d)!), common.map(d => oR.get(d)!))
    const sd = common.filter(d => stressDates.has(d))
    const stress = pearson(sd.map(d => tltR.get(d)!), sd.map(d => oR.get(d)!))
    const stressAvgRet = sd.length >= 20
      ? Math.round((sd.reduce((s, d) => s + oR.get(d)!, 0) / sd.length) * 10000) / 100
      : null
    return {
      sym: a.sym, label: a.label, what: a.what, group: a.group,
      all, stress, stressAvgRet,
      shift: all != null && stress != null ? Math.round((stress - all) * 100) / 100 : null,
    }
  })

  const recentStress = Array.from(tltR.entries())
    .filter(([d]) => stressDates.has(d))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([d, v]) => ({ date: d, tltRet: Math.round(v * 10000) / 100 }))
    .sort((a, b) => a.date < b.date ? 1 : -1)

  let moveOut: BondCorrResult['move'] = null
  if (move.length > 60) {
    const vals = move.map(m => m.c)
    const last = vals[vals.length - 1]
    const y1 = vals.slice(-252)
    const below = y1.filter(v => v < last).length
    const pct = y1.length ? Math.round((below / y1.length) * 100) : null
    moveOut = {
      last: Math.round(last * 10) / 10, date: move[move.length - 1].d, pct1y: pct,
      regime: last >= 120 ? 'stress' : last <= 80 ? 'calm' : 'normal',
    }
  }

  const notes = [
    `발작일은 미 장기국채(TLT) 하루 변동폭 상위 ${Math.round(STRESS_PCTILE * 100)}%인 날로 정의했습니다(기준 ±${(cut * 100).toFixed(2)}%). 고정 숫자로 박으면 조용한 해엔 0건, 시끄러운 해엔 전건이 됩니다.`,
    '상관 +1은 같이 움직임, −1은 반대로 움직임, 0은 무관을 뜻합니다. 부호보다 **평상시와 발작기가 얼마나 달라지는지**를 보세요.',
    '⚠️ 상관은 과거값이고 국면이 바뀌면 부호도 바뀝니다 — 2022년엔 주식과 채권이 함께 떨어져 "채권이 주식 헤지"라는 통념이 깨졌습니다.',
  ]

  return {
    from: tlt[0].d, to: tlt[tlt.length - 1].d, days: tlt.length,
    stressDays: stressDates.size,
    stressRule: `TLT 일간 |수익률| ≥ ${(cut * 100).toFixed(2)}%`,
    recentStress, rows, move: moveOut, notes,
  }
}
