// 🧮 거래 이력 → 보유 상태 재구성 SSOT (순수 함수·의존성 0)
//
//   왜 필요한가 — 지금까지 매수/매도는 **증분**으로 보유를 갱신했다(새 수량·새 평단을 직접 계산해 저장).
//   증분 방식은 "거래를 추가만" 할 때는 맞지만, **거래를 고치거나 지우면 복구할 방법이 없다.**
//   그래서 잘못 기입했을 때 학생이 반대매매(매도)로 상쇄하는 수밖에 없었고, 그 결과
//   **있지도 않은 매도 기록과 실현손익이 이력에 남았다**(2026-08-23 사용자 신고).
//
//   → 거래 목록을 날짜순으로 재생해 최종 수량·평단·각 매도의 실현손익을 **다시 계산**한다.
//     거래가 진실의 원천(source of truth)이고 보유는 그 결과다. 수정·삭제가 가능해지는 근거.
//
//   평단 규약 — 한국식 이동평균(매도해도 평단 불변). TransactionModal 의 기존 계산과 동일하다.
//     매수: 수량 += q · 원가 += q × 체결가 · 평단 = 원가 ÷ 수량
//     매도: 실현손익 = (매도가 − 그 시점 평단) × q · 수량 −= q · 원가 −= q × 평단 (평단 불변)

export interface RebuildTx {
  id: string
  type: 'buy' | 'sell'
  /** 체결 단가 */
  price: number
  quantity: number
  transaction_date: string
  /** 같은 날짜 안에서의 순서를 잡기 위한 보조 키(없으면 id) */
  created_at?: string | null
}

export interface RebuildSellResult {
  id: string
  /** 그 시점 평단 기준 실현손익 */
  realizedPnl: number
  /** 그 매도 직전의 평단 */
  avgCostBasis: number
}

export interface RebuildResult {
  /** 최종 보유 수량 — 0 이면 전량 매도된 상태 */
  quantity: number
  /** 최종 평단(수량 0 이면 마지막 평단 유지) */
  avgPrice: number
  /** 매도별 실현손익 재계산 결과 */
  sells: RebuildSellResult[]
  /** 실현손익 합계 */
  realizedTotal: number
  /** ⚠️ 보유 수량보다 많이 판 시점이 있으면 여기 기록 — 데이터가 깨진 신호다 */
  problems: string[]
}

/** 부동소수 오차 흡수 — 소수점 6자리(주식 소수점 매수가 6자리까지 온다) */
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 거래 목록에서 보유 상태를 재구성한다.
 * ⚠️ 입력 순서에 의존하지 않는다 — 내부에서 날짜·생성시각으로 정렬한다.
 */
export function rebuildFromTransactions(txs: RebuildTx[]): RebuildResult {
  const sorted = txs.slice().sort((a, b) => {
    if (a.transaction_date !== b.transaction_date) return a.transaction_date < b.transaction_date ? -1 : 1
    const ac = a.created_at ?? '', bc = b.created_at ?? ''
    if (ac !== bc) return ac < bc ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

  let qty = 0, cost = 0, avg = 0
  const sells: RebuildSellResult[] = []
  const problems: string[] = []

  for (const t of sorted) {
    const q = Number(t.quantity), p = Number(t.price)
    if (!isFinite(q) || q <= 0 || !isFinite(p) || p < 0) {
      problems.push(`${t.transaction_date} 거래의 수량·단가가 올바르지 않습니다(수량 ${t.quantity}·단가 ${t.price})`)
      continue
    }
    if (t.type === 'buy') {
      qty = r6(qty + q)
      cost = cost + q * p
      avg = qty > 0 ? cost / qty : avg
    } else {
      if (q > qty + 1e-6) {
        // 보유보다 많이 판 기록 — 값을 지어내지 않고 사실만 남긴다(⛔가짜 정밀 금지)
        problems.push(`${t.transaction_date} 매도 수량(${q})이 그 시점 보유 수량(${r6(qty)})보다 많습니다`)
      }
      const realized = (p - avg) * q
      sells.push({ id: t.id, realizedPnl: r2(realized), avgCostBasis: r2(avg) })
      qty = r6(qty - q)
      cost = cost - q * avg
      if (qty <= 1e-6) { qty = 0; cost = 0 }   // 전량 매도 — 잔여 원가는 0(부동소수 찌꺼기 제거)
    }
  }

  return {
    quantity: qty,
    avgPrice: qty > 0 ? r2(cost / qty) : r2(avg),
    sells,
    realizedTotal: r2(sells.reduce((s, x) => s + x.realizedPnl, 0)),
    problems,
  }
}

/** 재구성 결과가 현재 저장된 보유와 얼마나 다른가 — 수정 전 미리보기용 */
export function diffAgainstStored(
  rebuilt: RebuildResult,
  stored: { quantity: number; purchase_price: number },
): { qtyChanged: boolean; avgChanged: boolean; qtyDelta: number; avgDelta: number } {
  const qtyDelta = r6(rebuilt.quantity - Number(stored.quantity))
  const avgDelta = r2(rebuilt.avgPrice - Number(stored.purchase_price))
  return {
    qtyChanged: Math.abs(qtyDelta) > 1e-6,
    avgChanged: Math.abs(avgDelta) > 0.01,
    qtyDelta, avgDelta,
  }
}
