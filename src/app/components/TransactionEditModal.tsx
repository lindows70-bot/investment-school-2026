'use client'
/**
 * ✏️ 거래 수정·삭제 모달
 *
 * 왜 만들었나 — 잘못 기입한 거래를 고칠 방법이 없어서, 학생이 **반대매매(매도)로 상쇄**하는 수밖에 없었다.
 *   그 결과 있지도 않은 매도 기록과 실현손익이 이력에 남고, 평단까지 틀어진다(2026-08-23 사용자 신고).
 *
 * 핵심 — 거래를 고치면 보유(수량·평단)와 **모든 매도의 실현손익을 처음부터 다시 계산**한다.
 *   증분 갱신으로는 되돌릴 수 없기 때문이다. 계산은 `portfolioRebuild` SSOT 하나만 쓴다.
 *   ⛔ 이건 **기록 정정**이지 매매가 아니다(자동매매 금지 원칙과 무관).
 */
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { rebuildFromTransactions, type RebuildTx } from '@/lib/portfolioRebuild'
import { TK, FS, RAD, SP } from '@/lib/theme'

export interface EditableTx {
  id: string
  ticker: string
  name: string
  type: 'buy' | 'sell'
  price: number
  quantity: number
  transaction_date: string
  memo: string | null
  currency: string
  investment_id: string | null
}

export default function TransactionEditModal({ tx, onClose, onSaved }: {
  tx: EditableTx
  onClose: () => void
  onSaved: () => void
}) {
  const [price, setPrice] = useState(String(tx.price))
  const [qty, setQty] = useState(String(tx.quantity))
  const [date, setDate] = useState(tx.transaction_date?.slice(0, 10) ?? '')
  const [memo, setMemo] = useState(tx.memo ?? '')
  const [mode, setMode] = useState<'edit' | 'confirmDelete'>('edit')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** 저장 후 결과 미리보기 — 무엇이 어떻게 바뀌는지 보여주고 나서 커밋한다 */
  const [preview, setPreview] = useState<{ before: string; after: string; problems: string[] } | null>(null)

  const isKR = tx.currency === 'KRW'
  const cur = (n: number) => isKR ? `₩${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`
  const priceNum = parseFloat(price.replace(/,/g, '')) || 0
  const qtyNum = parseFloat(qty.replace(/,/g, '')) || 0

  const changed = useMemo(() =>
    priceNum !== Number(tx.price) || qtyNum !== Number(tx.quantity)
    || date !== tx.transaction_date?.slice(0, 10) || (memo || '') !== (tx.memo || ''),
    [priceNum, qtyNum, date, memo, tx])

  /** 티커의 전 거래를 다시 읽어 재구성 → investments·매도 실현손익 반영 */
  async function applyRebuild(sb: ReturnType<typeof createClient>, uid: string): Promise<string[]> {
    const { data: all } = await sb.from('transactions')
      .select('id,type,price,quantity,transaction_date,created_at')
      .eq('user_id', uid).ilike('ticker', tx.ticker)
    const list = (all ?? []) as RebuildTx[]
    const r = rebuildFromTransactions(list)

    if (r.quantity > 0) {
      if (tx.investment_id) {
        await sb.from('investments')
          .update({ quantity: r.quantity, purchase_price: r.avgPrice })
          .eq('id', tx.investment_id)
      }
    } else if (tx.investment_id) {
      // 전량 매도 상태가 되면 보유에서 제거(기존 매도 로직과 같은 규약)
      await sb.from('investments').delete().eq('id', tx.investment_id)
    }

    // 매도별 실현손익 재계산 — 앞선 거래가 바뀌면 뒤 매도의 평단 기준도 달라진다
    for (const s of r.sells) {
      await sb.from('transactions')
        .update({ realized_pnl: s.realizedPnl, avg_cost_basis: s.avgCostBasis })
        .eq('id', s.id)
    }
    return r.problems
  }

  async function run(kind: 'save' | 'delete') {
    setErr(null)
    if (kind === 'save') {
      if (qtyNum <= 0) { setErr('수량은 0보다 커야 합니다'); return }
      if (priceNum <= 0) { setErr('단가는 0보다 커야 합니다'); return }
      if (!date) { setErr('거래일을 입력해주세요'); return }
    }
    setBusy(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const uid = session?.user?.id
      if (!uid) { setErr('로그인이 필요합니다'); setBusy(false); return }

      // 변경 전 상태(미리보기 비교용)
      const { data: invBefore } = await sb.from('investments')
        .select('quantity,purchase_price').eq('id', tx.investment_id ?? '').maybeSingle()
      const before = invBefore ? `${invBefore.quantity}주 @ ${cur(Number(invBefore.purchase_price))}` : '보유 없음'

      if (kind === 'delete') {
        const { error } = await sb.from('transactions').delete().eq('id', tx.id).eq('user_id', uid)
        if (error) throw error
      } else {
        const { error } = await sb.from('transactions').update({
          price: priceNum,
          quantity: qtyNum,
          total_amount: Math.round(priceNum * qtyNum * 1e6) / 1e6,
          transaction_date: date,
          memo: memo || null,
        }).eq('id', tx.id).eq('user_id', uid)
        if (error) throw error
      }

      const problems = await applyRebuild(sb, uid)

      const { data: invAfter } = await sb.from('investments')
        .select('quantity,purchase_price').eq('id', tx.investment_id ?? '').maybeSingle()
      const after = invAfter ? `${invAfter.quantity}주 @ ${cur(Number(invAfter.purchase_price))}` : '보유 없음(전량 매도)'
      setPreview({ before, after, problems })

      window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'tx-edit' } }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : '처리 중 오류가 발생했습니다')
    } finally { setBusy(false) }
  }

  const label = { background: TK.bg0, border: `1px solid ${TK.line1}`, borderRadius: RAD.sm, padding: '8px 11px', color: TK.slate100, fontSize: FS.body, width: '100%', boxSizing: 'border-box' as const }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: SP.lg }}>
      <div onClick={e => e.stopPropagation()} style={{ background: TK.card, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.lg}px`, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, marginBottom: 6, flexWrap: 'wrap' }}>
          <b style={{ fontSize: FS.lg, color: TK.slate100 }}>✏️ 거래 수정</b>
          <span style={{ fontSize: FS.tiny, color: TK.sub3 }}>{tx.name} · {tx.ticker}</span>
          <span style={{ fontSize: FS.tiny, fontWeight: 800, color: tx.type === 'buy' ? TK.red400 : TK.blue400 }}>
            {tx.type === 'buy' ? '매수' : '매도'}
          </span>
        </div>

        {/* 저장 완료 — 무엇이 바뀌었는지 보여주고 닫는다 */}
        {preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
            <div style={{ background: `${TK.green400}0e`, border: `1px solid ${TK.green400}44`, borderRadius: RAD.sm, padding: '11px 13px' }}>
              <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.green400, marginBottom: 5 }}>✅ 반영됐습니다</div>
              <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.75 }}>
                보유가 <b style={{ color: TK.slate200 }}>{preview.before}</b> → <b style={{ color: TK.slate200 }}>{preview.after}</b> 로 바뀌었습니다.
                {' '}이 종목의 <b style={{ color: TK.slate200 }}>모든 매도 실현손익도 다시 계산</b>했습니다.
              </div>
            </div>
            {preview.problems.length > 0 && (
              <div style={{ background: `${TK.amber400}0e`, border: `1px solid ${TK.amber400}44`, borderRadius: RAD.sm, padding: '10px 13px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7 }}>
                ⚠️ <b style={{ color: TK.amber400 }}>확인이 필요한 점</b>
                {preview.problems.map((p, i) => <div key={i} style={{ marginTop: 3 }}>· {p}</div>)}
              </div>
            )}
            <button onClick={() => { onSaved(); onClose() }}
              style={{ padding: '10px', borderRadius: RAD.sm, border: 'none', background: TK.blue600, color: '#fff', fontSize: FS.body, fontWeight: 700, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        ) : mode === 'confirmDelete' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
            <div style={{ background: `${TK.red400}0e`, border: `1px solid ${TK.red400}44`, borderRadius: RAD.sm, padding: '11px 13px', fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.75 }}>
              <b style={{ color: TK.red400, fontSize: FS.body }}>이 거래를 지울까요?</b>
              <div style={{ marginTop: 5 }}>
                {tx.transaction_date?.slice(0, 10)} · {tx.type === 'buy' ? '매수' : '매도'} {tx.quantity}주 @ {cur(Number(tx.price))}
              </div>
              <div style={{ marginTop: 5 }}>
                지우면 이 종목의 <b style={{ color: TK.slate200 }}>수량·평단·실현손익이 남은 거래만으로 다시 계산</b>됩니다. 되돌릴 수 없습니다.
              </div>
            </div>
            <div style={{ display: 'flex', gap: SP.sm }}>
              <button disabled={busy} onClick={() => setMode('edit')}
                style={{ flex: 1, padding: '10px', borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.sub2, fontSize: FS.body, cursor: 'pointer' }}>
                취소
              </button>
              <button disabled={busy} onClick={() => run('delete')}
                style={{ flex: 1, padding: '10px', borderRadius: RAD.sm, border: 'none', background: TK.red600, color: '#fff', fontSize: FS.body, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? '처리 중…' : '삭제'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
            <div style={{ fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.7, marginBottom: 2 }}>
              고치면 이 종목의 <b style={{ color: TK.sub2 }}>수량·평단·실현손익을 전부 다시 계산</b>합니다 —
              {' '}반대매매로 상쇄하지 마세요(있지도 않은 매도 기록이 남습니다).
            </div>

            <div>
              <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 3 }}>거래일</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={label} />
            </div>
            <div style={{ display: 'flex', gap: SP.sm }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 3 }}>수량</div>
                <input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" style={label} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 3 }}>{tx.type === 'buy' ? '매수' : '매도'} 체결 단가</div>
                <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" style={label} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 3 }}>메모</div>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 수량 잘못 기입해서 정정" style={label} />
            </div>

            <div style={{ fontSize: FS.tiny, color: TK.sub4, background: TK.bg0, borderRadius: RAD.sm, padding: '8px 11px' }}>
              거래금액 <b style={{ color: TK.slate200, fontFamily: 'monospace' }}>{cur(priceNum * qtyNum)}</b>
              <span style={{ color: TK.sub4 }}> ({qtyNum}주 × {cur(priceNum)})</span>
            </div>

            {err && <div style={{ fontSize: FS.tiny, color: TK.red400, whiteSpace: 'pre-line' }}>{err}</div>}

            <div style={{ display: 'flex', gap: SP.sm, marginTop: 2 }}>
              <button disabled={busy} onClick={() => setMode('confirmDelete')}
                style={{ padding: '10px 14px', borderRadius: RAD.sm, border: `1px solid ${TK.red400}55`, background: 'transparent', color: TK.red400, fontSize: FS.body, fontWeight: 700, cursor: 'pointer' }}>
                🗑️ 삭제
              </button>
              <button disabled={busy} onClick={onClose}
                style={{ flex: 1, padding: '10px', borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.sub2, fontSize: FS.body, cursor: 'pointer' }}>
                닫기
              </button>
              <button disabled={busy || !changed} onClick={() => run('save')}
                style={{ flex: 1, padding: '10px', borderRadius: RAD.sm, border: 'none', background: changed ? TK.blue600 : TK.bg3, color: changed ? '#fff' : TK.sub4, fontSize: FS.body, fontWeight: 700, cursor: busy || !changed ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
