// 학생 기록하기가 쓰는 매수·매도 → DB 쓰기 규칙 SSOT — 기존 두 모달(AddInvestmentModal·TransactionModal)과 같은 규칙
//   ① 같은 종목 추가 매수 = 가중평단(소수 둘째 자리) + 수량 합산  ② 새 종목 = investments insert → 거래 insert
//   ③ 매도 = 실현손익 (매도가−평단)×수량, avg_cost_basis 기록, 전량이면 보유 행 삭제
import type { SupabaseClient } from '@supabase/supabase-js'

export type Market = 'US' | 'KR' | 'CRYPTO'
export type Role = 'CORE' | 'SATELLITE'
export interface TradeInput { ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'; price: number; quantity: number; date: string; role: Role }
export interface ExistingHolding { id: string; quantity: number; purchase_price: number; name: string; asset_role: Role | null }

interface TxBase {
  user_id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  type: 'buy' | 'sell'; price: number; quantity: number; total_amount: number; fee: 0
  memo: string; transaction_date: string; realized_pnl: number | null; avg_cost_basis: number | null
}
export interface TxRow extends TxBase { investment_id: string }
export interface InvestmentInsert {
  user_id: string; ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'
  purchase_price: number; quantity: number; purchase_date: string; lynch_category: null; asset_role: Role
}
export type TradeError = { kind: 'error'; message: string }
export type BuyPlan = { kind: 'new'; insert: InvestmentInsert; tx: TxBase } | { kind: 'dca'; investmentId: string; update: { quantity: number; purchase_price: number }; tx: TxRow } | TradeError
export type SellPlan = { kind: 'sell'; investmentId: string; after: { type: 'delete' } | { type: 'update'; quantity: number }; tx: TxRow } | TradeError

const r2 = (n: number) => Math.round(n * 100) / 100

function invalid(i: TradeInput): TradeError | null {
  if (!i.ticker.trim()) return { kind: 'error', message: '종목을 골라 주세요.' }
  if (!(i.price > 0)) return { kind: 'error', message: '가격은 0보다 커야 해요.' }
  if (!(i.quantity > 0)) return { kind: 'error', message: '수량은 0보다 커야 해요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return { kind: 'error', message: '날짜를 확인해 주세요.' }
  return null
}

function txBase(userId: string, i: TradeInput, type: 'buy' | 'sell', memo: string): TxBase {
  return {
    user_id: userId, ticker: i.ticker.toUpperCase(), name: i.name, market: i.market, currency: i.currency,
    type, price: i.price, quantity: i.quantity, total_amount: i.price * i.quantity, fee: 0,
    memo, transaction_date: i.date, realized_pnl: null, avg_cost_basis: null,
  }
}

export function planBuy(userId: string, existing: ExistingHolding | null, i: TradeInput): BuyPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) {
    return {
      kind: 'new',
      insert: { user_id: userId, ticker: i.ticker.toUpperCase(), name: i.name, market: i.market, currency: i.currency, purchase_price: i.price, quantity: i.quantity, purchase_date: i.date, lynch_category: null, asset_role: i.role },
      tx: txBase(userId, i, 'buy', '최초 매수'),
    }
  }
  const qty = existing.quantity + i.quantity
  const avg = (existing.quantity * existing.purchase_price + i.quantity * i.price) / qty
  return { kind: 'dca', investmentId: existing.id, update: { quantity: qty, purchase_price: r2(avg) }, tx: { ...txBase(userId, i, 'buy', '추가 매수'), investment_id: existing.id } }
}

export function planSell(userId: string, existing: ExistingHolding | null, i: TradeInput): SellPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) return { kind: 'error', message: '갖고 있지 않은 종목은 팔 수 없어요.' }
  if (i.quantity > existing.quantity + 1e-9) return { kind: 'error', message: `최대 ${existing.quantity}주까지 팔 수 있어요.` }
  const remaining = existing.quantity - i.quantity
  return {
    kind: 'sell', investmentId: existing.id,
    after: remaining <= 1e-9 ? { type: 'delete' } : { type: 'update', quantity: remaining },
    tx: { ...txBase(userId, i, 'sell', '매도'), investment_id: existing.id, realized_pnl: r2((i.price - existing.purchase_price) * i.quantity), avg_cost_basis: existing.purchase_price },
  }
}

/** 거래 시점 다신호 스냅샷 — 필드 이름은 AddInvestmentModal 의 mkSnap 과 같다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotOf(sig: any, price: number) {
  if (!sig) return null
  return {
    peg: sig.peg, growth_rate: sig.growth, category: sig.category,
    price_at_record: price, recorded_at: new Date().toISOString(),
    opMargin: sig.opMargin, sector: sig.sector, flow: sig.flow, mfi: sig.mfi,
    seasonTag: sig.seasonTag, season: sig.season, fomcStance: sig.fomcStance, rateDir: sig.rateDir,
  }
}

/** 계획을 DB 에 쓴다. 실패하면 사람이 읽을 문장을 돌려준다(성공 = null). */
export async function executeTrade(sb: SupabaseClient, plan: BuyPlan | SellPlan): Promise<string | null> {
  if (plan.kind === 'error') return plan.message
  const t = plan.tx
  let sig = null
  try {
    const r = await fetch(`/api/decision-snapshot?ticker=${encodeURIComponent(t.ticker)}&market=${t.market}&name=${encodeURIComponent(t.name)}`)
    if (r.ok) sig = await r.json()
  } catch { /* 스냅샷 실패해도 거래는 진행 — 모달과 같다 */ }
  const snapshot_data = snapshotOf(sig, t.price)

  if (plan.kind === 'new') {
    const { data: created, error } = await sb.from('investments').insert(plan.insert).select('id').single()
    if (error || !created) return error?.code === '23505' ? '이미 가진 종목이에요. 새로고침 후 다시 해 주세요.' : `저장 실패: ${error?.message ?? '알 수 없음'}`
    const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, investment_id: created.id, snapshot_data })
    if (txErr) console.warn('[tradeWrite] 거래 기록 실패(보유는 저장됨):', txErr.message)
    if (plan.insert.market !== 'CRYPTO') {
      ;(async () => {
        try {
          const res = await fetch(`/api/lynch-classify?ticker=${encodeURIComponent(plan.insert.ticker)}&market=${plan.insert.market}`)
          if (!res.ok) return
          const { category, isEtf } = await res.json()
          const cat = (!isEtf && category && category !== 'na') ? category : null
          if (cat) await sb.from('investments').update({ lynch_category: cat }).eq('id', created.id)
        } catch { /* 분류 실패해도 종목은 저장됨 — 모달과 같다 */ }
      })()
    }
    return null
  }
  if (plan.kind === 'dca') {
    const { error } = await sb.from('investments').update(plan.update).eq('id', plan.investmentId)
    if (error) return `저장 실패: ${error.message}`
    const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, snapshot_data })
    if (txErr) console.warn('[tradeWrite] 거래 기록 실패(보유는 저장됨):', txErr.message)
    return null
  }
  const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, snapshot_data })
  if (txErr) return `저장 실패: ${txErr.message}`
  const { error } = plan.after.type === 'delete'
    ? await sb.from('investments').delete().eq('id', plan.investmentId)
    : await sb.from('investments').update({ quantity: plan.after.quantity }).eq('id', plan.investmentId)
  return error ? `보유 수량 반영 실패: ${error.message}` : null
}
