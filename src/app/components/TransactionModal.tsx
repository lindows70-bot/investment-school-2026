'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Market = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'

interface Investment {
  id: string
  ticker: string
  name: string
  market: Market
  currency: 'USD' | 'KRW'
  purchase_price: number
  quantity: number
  purchase_date: string
  lynch_category: LynchKey | null
}

interface TransactionModalProps {
  investment: Investment
  initialMode: 'buy' | 'sell'
  currentPrice?: number
  onClose: () => void
  onSuccess: () => void
}

const N = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

const inputStyle: React.CSSProperties = {
  background: '#13162a',
  boxShadow: SHI,
  border: 'none',
  borderRadius: 9,
  padding: '10px 13px',
  color: '#dde4f0',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#454868',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
  display: 'block',
}

const today = new Date().toISOString().split('T')[0]

export default function TransactionModal({
  investment,
  initialMode,
  currentPrice,
  onClose,
  onSuccess,
}: TransactionModalProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>(initialMode)
  const [price, setPrice] = useState<string>(
    currentPrice != null ? String(currentPrice) : String(investment.purchase_price)
  )
  const [quantity, setQuantity] = useState<string>('1')
  const [date, setDate] = useState<string>(today)
  const [memo, setMemo] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  const priceNum = parseFloat(price) || 0
  const qtyNum = parseFloat(quantity) || 0
  const totalAmount = priceNum * qtyNum

  const newAvgPrice =
    mode === 'buy' && investment.quantity + qtyNum > 0
      ? (investment.quantity * investment.purchase_price + qtyNum * priceNum) /
        (investment.quantity + qtyNum)
      : 0

  const remainingQty = investment.quantity - qtyNum
  const realizedPnl = (priceNum - investment.purchase_price) * qtyNum
  const isFullSell = mode === 'sell' && qtyNum >= investment.quantity

  const currencySymbol = investment.currency === 'KRW' ? '₩' : '$'

  const formatNum = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2 })

  const fetchCurrentPrice = async () => {
    setPriceLoading(true)
    try {
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ticker: investment.ticker, market: investment.market }]),
      })
      if (res.ok) {
        const data = await res.json()
        if (data[0]?.currentPrice) setPrice(String(data[0].currentPrice))
      }
    } catch {
      /* ignore */
    } finally {
      setPriceLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (priceNum <= 0) { setError('거래 단가를 입력해주세요'); return }
    if (qtyNum <= 0) { setError('수량을 입력해주세요'); return }
    if (mode === 'sell' && qtyNum > investment.quantity) {
      setError(`최대 매도 가능 수량은 ${investment.quantity}개입니다`)
      return
    }
    if (!date) { setError('거래일을 선택해주세요'); return }

    setLoading(true)
    setError(null)

    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const uid = session?.user?.id
      if (!uid) { setError('로그인이 필요합니다'); setLoading(false); return }

      const amount = priceNum * qtyNum

      if (mode === 'buy') {
        await sb.from('transactions').insert({
          user_id: uid,
          investment_id: investment.id,
          ticker: investment.ticker,
          name: investment.name,
          market: investment.market,
          currency: investment.currency,
          type: 'buy',
          price: priceNum,
          quantity: qtyNum,
          total_amount: amount,
          fee: 0,
          memo: memo || null,
          transaction_date: date,
        })

        const newQty = investment.quantity + qtyNum
        const newAvg =
          (investment.quantity * investment.purchase_price + qtyNum * priceNum) / newQty
        await sb
          .from('investments')
          .update({
            quantity: newQty,
            purchase_price: Math.round(newAvg * 100) / 100,
          })
          .eq('id', investment.id)
      } else {
        const pnl = (priceNum - investment.purchase_price) * qtyNum

        await sb.from('transactions').insert({
          user_id: uid,
          investment_id: investment.id,
          ticker: investment.ticker,
          name: investment.name,
          market: investment.market,
          currency: investment.currency,
          type: 'sell',
          price: priceNum,
          quantity: qtyNum,
          total_amount: amount,
          fee: 0,
          realized_pnl: Math.round(pnl * 100) / 100,
          avg_cost_basis: investment.purchase_price,
          memo: memo || null,
          transaction_date: date,
        })

        const remaining = investment.quantity - qtyNum
        if (remaining <= 0.0001) {
          await sb.from('investments').delete().eq('id', investment.id)
        } else {
          await sb.from('investments').update({ quantity: remaining }).eq('id', investment.id)
        }
      }

      onSuccess()
      onClose()
    } catch (e) {
      setError('거래 처리 중 오류가 발생했습니다')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: N,
            boxShadow: '0 0 0 1px #282c44, 12px 12px 32px #0a0c18, -6px -6px 20px #282c44',
            borderRadius: 18,
            maxWidth: 460,
            width: 'calc(100% - 32px)',
            padding: '28px 24px 24px',
            animation: 'slideUp 0.2s ease-out',
            color: '#dde4f0',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#dde4f0' }}>
              {investment.name} 거래
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#454868',
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 4px',
              }}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* Info bar */}
          <div
            style={{
              background: '#13162a',
              boxShadow: SHI,
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: '#8b92b8',
            }}
          >
            보유 <strong style={{ color: '#dde4f0' }}>{investment.quantity}주</strong>
            &nbsp;|&nbsp;평단{' '}
            <strong style={{ color: '#dde4f0' }}>
              {currencySymbol}{formatNum(investment.purchase_price)}
            </strong>
          </div>

          {/* BUY / SELL toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {(['buy', 'sell'] as const).map((m) => {
              const isActive = mode === m
              const activeColor = m === 'buy' ? '#ef4444' : '#3b82f6'
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.15s',
                    ...(isActive
                      ? {
                          background: N,
                          boxShadow: SHO,
                          color: activeColor,
                          borderLeft: `3px solid ${activeColor}`,
                        }
                      : {
                          background: '#13162a',
                          boxShadow: SHI,
                          color: '#454868',
                          borderLeft: '3px solid transparent',
                        }),
                  }}
                >
                  {m === 'buy' ? '매수' : '매도'}
                </button>
              )
            })}
          </div>

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 거래단가 */}
            <div>
              <label style={labelStyle}>거래단가</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="0"
                  min="0"
                  step="any"
                />
                <button
                  onClick={fetchCurrentPrice}
                  disabled={priceLoading}
                  style={{
                    background: '#13162a',
                    boxShadow: priceLoading ? SHI : SHO,
                    border: 'none',
                    borderRadius: 9,
                    color: '#8b92b8',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '0 14px',
                    cursor: priceLoading ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {priceLoading ? '…' : '현재가'}
                </button>
              </div>
            </div>

            {/* 수량 */}
            <div>
              <label style={labelStyle}>
                수량
                {mode === 'sell' && (
                  <span style={{ marginLeft: 6, color: '#3b82f6' }}>
                    (최대 {investment.quantity})
                  </span>
                )}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={inputStyle}
                placeholder="0"
                min="0"
                step="any"
                max={mode === 'sell' ? investment.quantity : undefined}
              />
            </div>

            {/* 거래일 */}
            <div>
              <label style={labelStyle}>거래일</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 메모 */}
            <div>
              <label style={labelStyle}>메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                style={inputStyle}
                placeholder="메모를 입력하세요"
              />
            </div>
          </div>

          {/* Summary box */}
          <div
            style={{
              background: '#13162a',
              boxShadow: SHI,
              borderRadius: 10,
              padding: '14px 16px',
              marginTop: 20,
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#454868' }}>거래금액</span>
              <span style={{ color: '#dde4f0', fontWeight: 600 }}>
                {currencySymbol}{formatNum(totalAmount)}
              </span>
            </div>

            {mode === 'buy' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#454868' }}>새 평단가</span>
                <span style={{ color: '#dde4f0', fontWeight: 600 }}>
                  {currencySymbol}{formatNum(newAvgPrice)}
                </span>
              </div>
            )}

            {mode === 'sell' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>실현손익</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: realizedPnl > 0 ? '#ef4444' : realizedPnl < 0 ? '#3b82f6' : '#dde4f0',
                    }}
                  >
                    {realizedPnl >= 0 ? '+' : ''}
                    {currencySymbol}{formatNum(realizedPnl)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>잔여수량</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600 }}>
                    {Math.max(0, remainingQty).toLocaleString()}주
                  </span>
                </div>
                {isFullSell && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      borderRadius: 7,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#f87171',
                      fontSize: 12,
                    }}
                  >
                    ⚠️ 전량 매도 — 보유 종목에서 삭제됩니다
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 13px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                background: '#13162a',
                boxShadow: SHI,
                color: '#454868',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2,
                padding: '12px 0',
                borderRadius: 9,
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                background:
                  mode === 'buy'
                    ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                    : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '처리 중…' : mode === 'buy' ? '매수 확인' : '매도 확인'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
