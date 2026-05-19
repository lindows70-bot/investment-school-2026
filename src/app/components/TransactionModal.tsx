'use client'

/**
 * TransactionModal — 추가 매수 / 매도 처리
 *
 * ─── 추가 매수 UX 개선 (역산 알고리즘) ──────────────────────────────────────
 *  기존: 개별 체결가를 직접 입력 → 평단가 계산
 *  개선: 거래 후 최종 평단가(증권사 앱 기준) + 추가 수량 입력
 *        → 실제 체결가 자동 역산
 *
 *  역산 공식:
 *    newQty           = oldQty + addedQty
 *    executionPrice   = (newQty × newAvgPrice − oldQty × oldAvgPrice) / addedQty
 *
 *  예) 기존 1주 @₩900,000 보유, 1주 추가 매수 후 평단 ₩1,322,500
 *    executionPrice = (2 × 1,322,500 − 1 × 900,000) / 1 = ₩1,745,000 ✓
 *
 * ─── 매도 ───────────────────────────────────────────────────────────────────
 *  실제 매도 체결가를 직접 입력 (평단은 국내주식 매도 시 변하지 않음)
 *  잔여수량이 0 이하인 경우 / division-by-zero 예외 처리 포함
 *
 * ─── 전역 동기화 ─────────────────────────────────────────────────────────────
 *  완료 시 window.CustomEvent 'portfolio-updated' 발송
 *  → 대시보드·자산관리·투자기록 탭 페이지 새로고침 없이 즉시 리렌더링
 */

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
  purchase_price: number  // 현재 평균 단가 (기존 보유 기준)
  quantity: number        // 현재 보유 수량
  purchase_date: string
  lynch_category: LynchKey | null
}

interface TransactionModalProps {
  investment: Investment
  initialMode: 'buy' | 'sell'
  currentPrice?: number    // 실시간 현재가 (선택 입력 참고용)
  onClose: () => void
  onSuccess: () => void
}

// ─── 디자인 토큰 ─────────────────────────────────────────────────────────────
const N   = '#1b1e2e'
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
  marginBottom: 4,
  display: 'block',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#363855',
  marginTop: 5,
  lineHeight: 1.5,
}

const today = new Date().toISOString().split('T')[0]

export default function TransactionModal({
  investment,
  initialMode,
  currentPrice,
  onClose,
  onSuccess,
}: TransactionModalProps) {
  const [mode,         setMode]         = useState<'buy' | 'sell'>(initialMode)
  // 매수 모드: 거래 후 최종 평단가 (역산 기준)
  // 매도 모드: 실제 매도 체결가
  const [priceInput,   setPriceInput]   = useState<string>('')
  const [quantity,     setQuantity]     = useState<string>('1')
  const [date,         setDate]         = useState<string>(today)
  const [memo,         setMemo]         = useState<string>('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  const qtyNum      = Math.max(0, parseFloat(quantity)   || 0)
  const priceNum    = Math.max(0, parseFloat(priceInput) || 0)
  const currSym     = investment.currency === 'KRW' ? '₩' : '$'

  const formatNum = (n: number, decimals = 0) =>
    n.toLocaleString(investment.currency === 'KRW' ? 'ko-KR' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  // ── 매수 역산 계산 ─────────────────────────────────────────────────────────
  // priceInput = 거래 후 최종 평단가 (newAvgPrice)
  // executionPrice = 이번에 실제 체결된 단가
  const buyCalc = (() => {
    if (mode !== 'buy' || qtyNum <= 0 || priceNum <= 0) return null

    const oldQty    = investment.quantity
    const oldAvg    = investment.purchase_price
    const newQty    = oldQty + qtyNum
    const newAvg    = priceNum   // 사용자가 입력한 거래 후 최종 평단가

    // 역산: 실제 체결 단가 = (신규총투자금 - 기존총투자금) / 추가수량
    const rawExecPrice = ((newQty * newAvg) - (oldQty * oldAvg)) / qtyNum

    // 음수 또는 0이면 입력값 오류
    if (rawExecPrice <= 0) return null

    const execPrice  = Math.round(rawExecPrice * 100) / 100
    const totalAmt   = execPrice * qtyNum

    return { execPrice, newQty, newAvg, totalAmt }
  })()

  // ── 매도 계산 ──────────────────────────────────────────────────────────────
  const sellCalc = (() => {
    if (mode !== 'sell' || qtyNum <= 0 || priceNum <= 0) return null
    if (qtyNum > investment.quantity) return null

    const pnl         = (priceNum - investment.purchase_price) * qtyNum
    const remaining   = investment.quantity - qtyNum
    const totalAmt    = priceNum * qtyNum
    const isFullSell  = remaining <= 0.0001

    return { pnl, remaining, totalAmt, isFullSell }
  })()

  // ── 현재가 불러오기 ────────────────────────────────────────────────────────
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
        if (data[0]?.currentPrice) {
          // 매도 모드에서는 현재가를 체결가로 미리 채움
          // 매수 모드에서도 참고용으로 채움
          setPriceInput(String(data[0].currentPrice))
        }
      }
    } catch { /* ignore */ }
    finally { setPriceLoading(false) }
  }

  // ── 거래 실행 ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null)

    // ─ 공통 유효성 검사 ─
    if (qtyNum <= 0)  { setError('수량을 1 이상 입력해주세요'); return }
    if (priceNum <= 0) {
      setError(
        mode === 'buy'
          ? '거래 후 최종 평단가를 입력해주세요'
          : '매도 체결가를 입력해주세요'
      )
      return
    }
    if (!date) { setError('거래일을 선택해주세요'); return }

    // ─ 매수 유효성 검사 ─
    if (mode === 'buy') {
      if (!buyCalc) {
        setError(
          '입력한 평단가가 올바르지 않습니다.\n' +
          '거래 후 새 평단가는 기존 보유분의 평균과 이번 체결가의 가중평균이어야 합니다.'
        )
        return
      }
    }

    // ─ 매도 유효성 검사 ─
    if (mode === 'sell') {
      if (qtyNum > investment.quantity) {
        setError(`최대 매도 가능 수량은 ${investment.quantity}주 입니다`)
        return
      }
      if (!sellCalc) {
        setError('수량 또는 매도가를 다시 확인해주세요')
        return
      }
    }

    setLoading(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const uid = session?.user?.id
      if (!uid) { setError('로그인이 필요합니다'); setLoading(false); return }

      if (mode === 'buy' && buyCalc) {
        // ── 매수: 역산된 체결가로 거래 기록, 평단·수량 업데이트 ──────────────
        const { execPrice, newQty, newAvg, totalAmt } = buyCalc

        // 1) 거래 내역 기록 — 역산된 실제 체결가 저장
        await sb.from('transactions').insert({
          user_id:          uid,
          investment_id:    investment.id,
          ticker:           investment.ticker,
          name:             investment.name,
          market:           investment.market,
          currency:         investment.currency,
          type:             'buy',
          price:            execPrice,   // ★ 역산된 실제 체결 단가
          quantity:         qtyNum,
          total_amount:     totalAmt,
          fee:              0,
          memo:             memo || null,
          transaction_date: date,
        })

        // 2) 보유 종목 업데이트 — 새 수량 + 새 평단가
        await sb
          .from('investments')
          .update({
            quantity:       newQty,
            purchase_price: Math.round(newAvg * 100) / 100,  // 사용자 입력 평단가
          })
          .eq('id', investment.id)

      } else if (mode === 'sell' && sellCalc) {
        // ── 매도: 실제 체결가로 기록, 잔여수량 업데이트 ──────────────────────
        const { pnl, remaining, totalAmt, isFullSell } = sellCalc

        // 1) 거래 내역 기록
        await sb.from('transactions').insert({
          user_id:          uid,
          investment_id:    investment.id,
          ticker:           investment.ticker,
          name:             investment.name,
          market:           investment.market,
          currency:         investment.currency,
          type:             'sell',
          price:            priceNum,   // 실제 매도 체결가 그대로
          quantity:         qtyNum,
          total_amount:     totalAmt,
          fee:              0,
          realized_pnl:     Math.round(pnl * 100) / 100,
          avg_cost_basis:   investment.purchase_price,
          memo:             memo || null,
          transaction_date: date,
        })

        // 2) 보유 종목 업데이트
        if (isFullSell) {
          // 전량 매도 → 보유 종목 삭제
          await sb.from('investments').delete().eq('id', investment.id)
        } else {
          // 일부 매도 → 잔여 수량만 업데이트 (평단가는 국내주식 기준 불변)
          await sb
            .from('investments')
            .update({ quantity: remaining })
            .eq('id', investment.id)
        }
      }

      // ★ 전역 동기화 이벤트 발송 — 대시보드·자산관리·투자기록 즉시 갱신
      window.dispatchEvent(
        new CustomEvent('portfolio-updated', {
          detail: {
            source:    'transaction',
            mode,
            ticker:    investment.ticker,
            quantity:  qtyNum,
          },
        })
      )

      onSuccess()
      onClose()
    } catch (e) {
      setError('거래 처리 중 오류가 발생했습니다')
      console.error('[TransactionModal]', e)
    } finally {
      setLoading(false)
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: N,
            boxShadow: '0 0 0 1px #282c44, 12px 12px 32px #0a0c18, -6px -6px 20px #282c44',
            borderRadius: 18,
            maxWidth: 480,
            width: 'calc(100% - 32px)',
            padding: '28px 24px 24px',
            animation: 'slideUp 0.2s ease-out',
            color: '#dde4f0',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#dde4f0' }}>
                {mode === 'buy' ? '추가매수 기록' : '추가매도 기록'}
              </h2>
              <div style={{ fontSize: 12, color: '#454868', marginTop: 3 }}>{investment.name}</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#454868', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
              aria-label="닫기"
            >×</button>
          </div>

          {/* 현재 보유 정보 */}
          <div style={{ background: '#13162a', boxShadow: SHI, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#8b92b8' }}>
            보유{' '}
            <strong style={{ color: '#dde4f0' }}>{investment.quantity.toLocaleString()}주</strong>
            &nbsp;|&nbsp;현재 평단{' '}
            <strong style={{ color: '#dde4f0' }}>
              {currSym}{formatNum(investment.purchase_price, investment.currency === 'KRW' ? 0 : 2)}
            </strong>
            {currentPrice && (
              <>
                &nbsp;|&nbsp;현재가{' '}
                <strong style={{ color: '#fbbf24' }}>
                  {currSym}{formatNum(currentPrice, investment.currency === 'KRW' ? 0 : 2)}
                </strong>
              </>
            )}
          </div>

          {/* 매수 / 매도 토글 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {(['buy', 'sell'] as const).map(m => {
              const isActive    = mode === m
              const activeColor = m === 'buy' ? '#ef4444' : '#3b82f6'
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setPriceInput('') }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
                    cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                    ...(isActive
                      ? { background: N, boxShadow: SHO, color: activeColor, borderLeft: `3px solid ${activeColor}` }
                      : { background: '#13162a', boxShadow: SHI, color: '#454868', borderLeft: '3px solid transparent' }
                    ),
                  }}
                >
                  {m === 'buy' ? '+ 추가매수' : '− 추가매도'}
                </button>
              )
            })}
          </div>

          {/* 입력 폼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 가격 입력 필드 (매수/매도에 따라 라벨 다름) ── */}
            <div>
              {mode === 'buy' ? (
                <>
                  {/* 매수: 거래 후 최종 평단가 입력 */}
                  <label style={labelStyle}>
                    거래 후 최종 평단가
                    <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                  </label>
                  <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 8 }}>
                    📱 증권사 앱에 업데이트된 최종 평단가를 입력하세요
                  </div>
                </>
              ) : (
                <>
                  {/* 매도: 실제 체결가 입력 */}
                  <label style={labelStyle}>
                    매도 체결가
                    <span style={{ color: '#3b82f6', marginLeft: 4 }}>*</span>
                  </label>
                </>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#454868', fontSize: 13, pointerEvents: 'none' }}>
                    {currSym}
                  </span>
                  <input
                    type="number"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 24 }}
                    placeholder={mode === 'buy' ? '거래 후 평단가 입력' : '매도 단가 입력'}
                    min="0"
                    step="any"
                  />
                </div>
                <button
                  onClick={fetchCurrentPrice}
                  disabled={priceLoading}
                  style={{
                    background: '#13162a', boxShadow: priceLoading ? SHI : SHO,
                    border: 'none', borderRadius: 9, color: '#8b92b8',
                    fontSize: 12, fontWeight: 600, padding: '0 14px',
                    cursor: priceLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {priceLoading ? '…' : '현재가'}
                </button>
              </div>

              {/* 매수 모드 가이드 텍스트 */}
              {mode === 'buy' && (
                <p style={{ ...hintStyle, color: '#454868' }}>
                  💡 역산 공식: 실제 체결가 = (새 평단 × 전체수량 − 기존 평단 × 기존수량) / 추가수량
                </p>
              )}
              {/* 매도 모드 가이드 텍스트 */}
              {mode === 'sell' && (
                <p style={hintStyle}>
                  매도 시 잔여 보유분의 평단가는 변하지 않습니다
                </p>
              )}
            </div>

            {/* 수량 */}
            <div>
              <label style={labelStyle}>
                {mode === 'buy' ? '추가 매수 수량' : '매도 수량'}
                {mode === 'sell' && (
                  <span style={{ marginLeft: 6, color: '#3b82f6', fontWeight: 400, textTransform: 'none' }}>
                    (최대 {investment.quantity}주)
                  </span>
                )}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
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
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 메모 */}
            <div>
              <label style={labelStyle}>메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                style={inputStyle}
                placeholder="메모를 입력하세요"
              />
            </div>
          </div>

          {/* ── 거래 요약 박스 ── */}
          <div style={{ background: '#13162a', boxShadow: SHI, borderRadius: 10, padding: '14px 16px', marginTop: 20, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* 매수 요약 */}
            {mode === 'buy' && buyCalc && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#454868' }}>역산된 실제 체결가</span>
                  <span style={{ color: '#ef4444', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>
                    {currSym}{formatNum(buyCalc.execPrice, investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>이번 거래금액</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {currSym}{formatNum(buyCalc.totalAmt, investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>거래 후 평단가</span>
                  <span style={{ color: '#fbbf24', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {currSym}{formatNum(buyCalc.newAvg, investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>거래 후 총 보유수량</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600 }}>
                    {buyCalc.newQty.toLocaleString()}주
                  </span>
                </div>

                {/* 역산 검증 표시 */}
                <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 3 }}>
                    ✔ 역산 검증
                  </div>
                  <div style={{ fontSize: 11, color: '#454868', lineHeight: 1.6 }}>
                    기존 {investment.quantity}주 @ {currSym}{formatNum(investment.purchase_price, 0)}{' '}
                    + 추가 {qtyNum}주 @ {currSym}{formatNum(buyCalc.execPrice, 0)}{' '}
                    = 평단 {currSym}{formatNum(buyCalc.newAvg, 0)}
                  </div>
                </div>
              </>
            )}

            {/* 매수 입력 오류 안내 */}
            {mode === 'buy' && priceNum > 0 && qtyNum > 0 && !buyCalc && (
              <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>
                  ⚠️ 입력한 최종 평단가가 올바르지 않습니다.<br />
                  추가 매수 후의 평단가는 기존 평단 ({currSym}{formatNum(investment.purchase_price, 0)})과<br />
                  이번 체결가의 가중평균이어야 합니다.
                </div>
              </div>
            )}

            {/* 매도 요약 */}
            {mode === 'sell' && sellCalc && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>매도 체결가</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {currSym}{formatNum(priceNum, investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>매도 총액</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {currSym}{formatNum(sellCalc.totalAmt, investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>실현 손익</span>
                  <span style={{
                    fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: sellCalc.pnl > 0 ? '#ef4444' : sellCalc.pnl < 0 ? '#3b82f6' : '#dde4f0',
                  }}>
                    {sellCalc.pnl >= 0 ? '+' : ''}{currSym}{formatNum(Math.abs(sellCalc.pnl), investment.currency === 'KRW' ? 0 : 2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#454868' }}>매도 후 잔여수량</span>
                  <span style={{ color: '#dde4f0', fontWeight: 600 }}>
                    {Math.max(0, sellCalc.remaining).toLocaleString()}주
                  </span>
                </div>
                {sellCalc.isFullSell && (
                  <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 12 }}>
                    ⚠️ 전량 매도 — 보유 종목에서 삭제됩니다
                  </div>
                )}
              </>
            )}

            {/* 입력 대기 안내 */}
            {((mode === 'buy'  && (!priceNum || !qtyNum)) ||
              (mode === 'sell' && (!priceNum || !qtyNum))) && (
              <div style={{ color: '#363855', fontSize: 12, textAlign: 'center', padding: '6px 0' }}>
                {mode === 'buy'
                  ? '거래 후 최종 평단가와 추가 수량을 입력하면 체결가가 자동 계산됩니다'
                  : '매도 체결가와 수량을 입력하면 손익이 계산됩니다'}
              </div>
            )}
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div style={{ marginTop: 14, padding: '10px 13px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, whiteSpace: 'pre-line' }}>
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: 'none', cursor: 'pointer', background: '#13162a', boxShadow: SHI, color: '#454868', fontWeight: 600, fontSize: 14 }}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (mode === 'buy' ? !buyCalc : !sellCalc)}
              style={{
                flex: 2, padding: '12px 0', borderRadius: 9, border: 'none',
                cursor: (loading || (mode === 'buy' ? !buyCalc : !sellCalc)) ? 'not-allowed' : 'pointer',
                background: mode === 'buy'
                  ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                  : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                color: '#fff', fontWeight: 700, fontSize: 14,
                opacity: (loading || (mode === 'buy' ? !buyCalc : !sellCalc)) ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading
                ? '처리 중…'
                : mode === 'buy'
                  ? `추가매수 완료 (${qtyNum > 0 && buyCalc ? `체결가 ${currSym}${formatNum(buyCalc.execPrice, 0)}` : '단가 계산 중'})`
                  : '추가매도 완료'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
