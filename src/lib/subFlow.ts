// 소섹터 자금순환 RRG 판정 SSOT — SectorCanvas(드릴다운 카드)·sector-rotation(통합 랭킹)이 공유(제2원칙)
export type SubQ = 'leading' | 'weakening' | 'lagging' | 'improving'
export interface SubFlowIn { key: string; ret1w: number | null; ret1m: number | null; ret1y: number | null }
export interface SubFlowOut {
  q: SubQ
  score: number      // 쏠림 점수 = 0.6·상대강도(1M) + 0.4·모멘텀(1W), 섹터 내 소섹터 평균 대비 %p
  buy: boolean       // 매수 적격 = 상대강세(주도·태동) + 1주>0 + 추세유지(1개월 OR 1년 양수) — 칼날·일시반등 이중 차단
  sell: boolean      // 매도 신호 = 과열(weakening, 강했으나 모멘텀 반전)
  profit: boolean    // 1년>0 = 익절 구간 / 아니면 비중 축소·손절 구간
}

export function scoreSubFlow(subs: SubFlowIn[]): Record<string, SubFlowOut> {
  const sv = subs.filter(s => s.ret1m != null && s.ret1w != null)
  if (sv.length < 2) return {}
  const smM = sv.reduce((a, s) => a + (s.ret1m as number), 0) / sv.length
  const smW = sv.reduce((a, s) => a + (s.ret1w as number), 0) / sv.length
  const out: Record<string, SubFlowOut> = {}
  sv.forEach(s => {
    const rs = (s.ret1m as number) - smM, mom = (s.ret1w as number) - smW
    const q: SubQ = rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging'
    const buy = (q === 'leading' || q === 'improving') && (s.ret1w as number) > 0 && ((s.ret1m as number) > 0 || (s.ret1y ?? 0) > 0)
    out[s.key] = { q, score: Math.round((0.6 * rs + 0.4 * mom) * 10) / 10, buy, sell: q === 'weakening', profit: (s.ret1y ?? 0) > 0 }
  })
  return out
}
