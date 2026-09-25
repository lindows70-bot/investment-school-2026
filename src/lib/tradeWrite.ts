// 학생 기록하기가 쓰는 매수·매도 → DB 쓰기 규칙 SSOT — 기존 두 모달(AddInvestmentModal·TransactionModal)과 같은 규칙
//   ① 같은 종목 추가 매수 = 가중평단(100 이상은 소수 둘째 자리 · 그 아래는 유효숫자 8자리) + 수량 합산  ② 새 종목 = investments insert → 거래 insert
//   ③ 매도 = 실현손익 (매도가−평단)×수량, avg_cost_basis 기록, 전량이면 보유 행 삭제
import type { SupabaseClient } from '@supabase/supabase-js'
import { bustServerCache } from '@/lib/bustCache'

export type Market = 'US' | 'KR' | 'CRYPTO'
export type Role = 'CORE' | 'SATELLITE'
export interface TradeInput { ticker: string; name: string; market: Market; currency: 'USD' | 'KRW'; price: number; quantity: number; date: string; role: Role }
// name·asset_role 은 DCA 때 바뀌지 않는다(AddInvestmentModal 기준 — 학생 화면은 기존 보유의 역할을 수정하지 않는다)
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
// baseQuantity = 계획이 기준으로 삼은 보유 수량(DB 에서 읽은 값 그대로 — 계산 금지). 쓰기 때 .eq('quantity', …) 로 걸어
// 다른 탭이 그새 수량을 바꿨으면 0행이 되게 한다(낡은 화면이 새 수량을 덮어쓰지 못하게)
export type BuyPlan = { kind: 'new'; insert: InvestmentInsert; tx: TxBase } | { kind: 'dca'; investmentId: string; baseQuantity: number; update: { quantity: number; purchase_price: number }; tx: TxRow } | TradeError
export type SellPlan = { kind: 'sell'; investmentId: string; baseQuantity: number; after: { type: 'delete' } | { type: 'update'; quantity: number }; tx: TxRow } | TradeError
/** partial = 매도의 보유 반영은 됐는데 거래 기록이 실패 — 화면은 다시 저장하게 두면 안 된다(수량이 두 번 빠진다) */
export type TradeResult = { ok: true } | { ok: false; message: string; partial: boolean }

const r2 = (n: number) => Math.round(n * 100) / 100
// 평단 반올림 — 100 이상은 소수 둘째 자리(모달과 같음), 그 아래(소액 코인 0.015원 등)는 유효숫자 8자리. r2 는 0.015 → 0.02 로 망가뜨린다
const roundAvg = (n: number) => n >= 100 ? r2(n) : Number(n.toPrecision(8))
// 수량 표시 — 부동소수 잡음 없이 소수 8자리까지(끝 0 제거)
const fmtQty = (q: number) => q.toLocaleString('ko-KR', { maximumFractionDigits: 8 })
const STALE_MSG = '이 종목 정보가 바뀌었어요 — 새로고침 후 다시 기록해 주세요.'
const HALF_MSG = '보유 수량은 반영됐지만 거래 기록 저장에 실패했어요 — 선생님께 알려 주세요'

function invalid(i: TradeInput): TradeError | null {
  if (!i.ticker.trim()) return { kind: 'error', message: '종목을 골라 주세요.' }
  if (!(i.price > 0)) return { kind: 'error', message: '가격은 0보다 커야 해요.' }
  if (!(i.quantity > 0)) return { kind: 'error', message: '수량은 0보다 커야 해요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return { kind: 'error', message: '날짜를 확인해 주세요.' }
  return null
}

function txBase(userId: string, i: TradeInput, type: 'buy' | 'sell', memo: string): TxBase {
  return {
    user_id: userId, ticker: i.ticker.trim().toUpperCase(), name: i.name, market: i.market, currency: i.currency,
    type, price: i.price, quantity: i.quantity, total_amount: i.price * i.quantity, fee: 0,
    memo, transaction_date: i.date, realized_pnl: null, avg_cost_basis: null,
  }
}

export function planBuy(userId: string, existing: ExistingHolding | null, i: TradeInput): BuyPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) {
    return {
      kind: 'new',
      insert: { user_id: userId, ticker: i.ticker.trim().toUpperCase(), name: i.name, market: i.market, currency: i.currency, purchase_price: i.price, quantity: i.quantity, purchase_date: i.date, lynch_category: null, asset_role: i.role },
      tx: txBase(userId, i, 'buy', '최초 매수'),
    }
  }
  const qty = existing.quantity + i.quantity
  const avg = (existing.quantity * existing.purchase_price + i.quantity * i.price) / qty
  return { kind: 'dca', investmentId: existing.id, baseQuantity: existing.quantity, update: { quantity: qty, purchase_price: roundAvg(avg) }, tx: { ...txBase(userId, i, 'buy', '추가 매수'), investment_id: existing.id } }
}

export function planSell(userId: string, existing: ExistingHolding | null, i: TradeInput): SellPlan {
  const bad = invalid(i); if (bad) return bad
  if (!existing) return { kind: 'error', message: '갖고 있지 않은 종목은 팔 수 없어요.' }
  if (i.quantity > existing.quantity) return { kind: 'error', message: `최대 ${fmtQty(existing.quantity)}${i.market === 'CRYPTO' ? '개' : '주'}까지 팔 수 있어요.` }
  const remaining = existing.quantity - i.quantity
  return {
    kind: 'sell', investmentId: existing.id, baseQuantity: existing.quantity,
    // 전량 매도 판정은 TransactionModal.tsx:217 과 같은 기준(0.0001) — 코인 등 소수 잔량도 삭제로 처리
    after: remaining <= 0.0001 ? { type: 'delete' } : { type: 'update', quantity: remaining },
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

/**
 * 계획을 DB 에 쓴다. 실패하면 사람이 읽을 문장 + 부분 기록 여부를 돌려준다.
 * update·delete 는 반영된 행을 돌려받아 정확히 1행인지 본다 — 0행(다른 탭에서 지웠거나 RLS 가 막음)을 성공으로 보지 않는다.
 * userId 는 항상 로그인한 학생 본인이어야 한다 — 이 함수는 그 자체를 검사하지 않고 Supabase RLS 가 최종 방어선이다.
 */
export async function executeTrade(sb: SupabaseClient, plan: BuyPlan | SellPlan): Promise<TradeResult> {
  if (plan.kind === 'error') return { ok: false, message: plan.message, partial: false }
  const t = plan.tx
  let sig = null
  try {
    const r = await fetch(`/api/decision-snapshot?ticker=${encodeURIComponent(t.ticker)}&market=${t.market}&name=${encodeURIComponent(t.name)}`, { signal: AbortSignal.timeout(5000) })
    if (r.ok) sig = await r.json()
  } catch { /* 스냅샷 실패·5초 초과여도 거래는 진행 — 모달과 같다 */ }
  const snapshot_data = snapshotOf(sig, t.price)

  // 저장이 실제로 성공했을 때만 — 기존 두 모달이 저장 뒤 항상 하던 일(서버 캐시 무효화 + 전역 동기화 이벤트)
  const afterSuccess = async (): Promise<TradeResult> => {
    await bustServerCache()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('portfolio-updated', {
        detail: { source: 'student-record', type: t.type, ticker: t.ticker, quantity: t.quantity },
      }))
    }
    return { ok: true }
  }
  const fail = (message: string, partial = false): TradeResult => ({ ok: false, message, partial })
  const one = (data: unknown) => Array.isArray(data) && data.length === 1

  if (plan.kind === 'new') {
    const { data: created, error } = await sb.from('investments').insert(plan.insert).select('id').single()
    if (error || !created) return fail(error?.code === '23505' ? '이미 가진 종목이에요. 새로고침 후 다시 해 주세요.' : `저장 실패: ${error?.message ?? '알 수 없음'}`)
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
    return afterSuccess()
  }
  if (plan.kind === 'dca') {
    const { data, error } = await sb.from('investments').update(plan.update).eq('id', plan.investmentId).eq('quantity', plan.baseQuantity).select('id')
    if (error) return fail(`저장 실패: ${error.message}`)
    if (!one(data)) return fail(STALE_MSG)
    const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, snapshot_data })
    if (txErr) console.warn('[tradeWrite] 거래 기록 실패(보유는 저장됨):', txErr.message)
    return afterSuccess()
  }
  // 매도는 보유 반영(기준 수량 조건)을 먼저 확인하고 거래를 적는다 — 선생님 TransactionModal 은 거래→삭제 순서지만,
  // 여기선 다른 탭 충돌로 0행이 날 수 있어 거래를 먼저 쓰면 보유와 안 맞는 고아 거래가 남는다
  const { data, error } = plan.after.type === 'delete'
    ? await sb.from('investments').delete().eq('id', plan.investmentId).eq('quantity', plan.baseQuantity).select('id')
    : await sb.from('investments').update({ quantity: plan.after.quantity }).eq('id', plan.investmentId).eq('quantity', plan.baseQuantity).select('id')
  if (error) return fail(`저장 실패: ${error.message}`)
  if (!one(data)) return fail(STALE_MSG)
  // 전량 매도는 보유 행이 이미 지워졌다 — investment_id 가 FK(on delete set null)라 지운 id 를 걸면 insert 가 실패한다.
  // 예전 순서(거래→삭제)도 삭제 때 null 이 되므로 최종 상태는 같다
  const investment_id = plan.after.type === 'delete' ? null : plan.tx.investment_id
  const { error: txErr } = await sb.from('transactions').insert({ ...plan.tx, investment_id, snapshot_data })
  if (txErr) return fail(`${HALF_MSG} (${txErr.message})`, true)
  return afterSuccess()
}
