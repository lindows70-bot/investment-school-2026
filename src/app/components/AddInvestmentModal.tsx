'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { bustServerCache } from '@/lib/bustCache'
import { classifyAsset } from '@/lib/classifyAsset'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market   = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'

type AssetRole = 'CORE' | 'SATELLITE'
interface Investment {
  id:             string
  ticker:         string
  name:           string
  market:         Market
  currency:       'USD' | 'KRW'
  purchase_price: number
  quantity:       number
  purchase_date:  string
  lynch_category: LynchKey | null
  asset_role?:    AssetRole  // 코어/새틀라이트 포지션
  created_at?:    string
}

interface Props {
  initial?:   Investment
  onClose:    () => void
  onRefresh:  () => Promise<void>
  onAdded?:   (inv: Investment) => void
  onChanged?: () => void
}

// ─── Static config ────────────────────────────────────────────────────────────
const MARKETS: { id: Market; label: string; flag: string; currency: 'USD' | 'KRW' }[] = [
  { id: 'US',     label: '미국 주식 / ETF', flag: '🇺🇸', currency: 'USD' },
  { id: 'KR',     label: '한국 주식',        flag: '🇰🇷', currency: 'KRW' },
  { id: 'CRYPTO', label: '암호화폐',          flag: '🪙',  currency: 'KRW' },
]

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: '#141414', border: '1px solid #2a2a2a',
    borderRadius: 18, width: '100%', maxWidth: 500,
    maxHeight: '88vh', overflowY: 'auto' as const,
    boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    animation: 'slideUp 0.2s ease-out',
  },
  body:    { padding: '20px 24px 28px' },
  section: { marginBottom: 16 },
  label:   {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#7f93a8',
    marginBottom: 6, letterSpacing: '0.07em', textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '10px 12px', background: '#1e1e1e',
    border: '1px solid #2a2a2a', borderRadius: 9,
    color: '#f1f5f9', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  hint:    { fontSize: 11, color: '#8599ae', marginTop: 6, lineHeight: 1.5 },
  divider: { border: 'none', borderTop: '1px solid #1e1e1e', margin: '18px 0' },
  errBox:  {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 12px', color: '#f87171', fontSize: 13, marginBottom: 14,
  },
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spin = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
)

// ─── 이름 조회 훅 (Lynch 분류 제거 — 대시보드에서 자동 처리) ──────────────────
type NameStatus = 'idle' | 'loading' | 'found' | 'error'

function useNameLookup() {
  const [name,   setName]   = useState<string | null>(null)
  const [status, setStatus] = useState<NameStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookup = useCallback((ticker: string, market: Market) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!ticker.trim()) { setName(null); setStatus('idle'); return }

    setStatus('loading')
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${market}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        if (data.error && !data.name) throw new Error(data.error)
        setName(data.name ?? ticker.toUpperCase())
        setStatus('found')
      } catch {
        setName(null); setStatus('error')
      }
    }, 700)
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setName(null); setStatus('idle')
  }, [])

  return { name, status, lookup, reset }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AddInvestmentModal({ initial, onClose, onRefresh, onAdded, onChanged }: Props) {
  const isEdit = !!initial

  const [market,        setMarket]        = useState<Market>(initial?.market ?? 'US')
  const [ticker,        setTicker]        = useState(initial?.ticker ?? '')
  const [name,          setName]          = useState(initial?.name   ?? '')
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchase_price?.toString() ?? '')
  const [quantity,      setQuantity]      = useState(initial?.quantity?.toString() ?? '')
  const [purchaseDate,  setPurchaseDate]  = useState(
    initial?.purchase_date ?? new Date().toISOString().split('T')[0]
  )
  const [assetRole,        setAssetRole]        = useState<AssetRole>(initial?.asset_role ?? 'CORE')
  const [autoClassified,   setAutoClassified]   = useState(false)   // 자동 분류 적용 여부
  const [manualOverride,   setManualOverride]   = useState(!!initial) // 편집 모드는 수동 우선
  const [focused,          setFocused]          = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  // DCA 힌트: 같은 티커 이미 보유 중인지 미리 감지
  const [dcaHint, setDcaHint] = useState<{ id:string; name:string; qty:number; price:number } | null>(null)

  const { name: lookedUpName, status: nameStatus, lookup, reset: resetLookup } = useNameLookup()

  // 편집 모드 아닐 때 티커/시장 변경 → 이름 자동 조회
  useEffect(() => {
    if (isEdit) return
    if (ticker.length >= 1) lookup(ticker, market)
    else resetLookup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, market])

  // DCA 감지: 티커 변경 시 이미 보유 중인 종목인지 확인
  useEffect(() => {
    if (isEdit || !ticker.trim()) { setDcaHint(null); return }
    const sb = createClient()
    const t = setTimeout(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setDcaHint(null); return }
      const { data } = await sb.from('investments')
        .select('id,name,quantity,purchase_price')
        .eq('user_id', user.id)
        .eq('ticker', ticker.trim().toUpperCase())
        .maybeSingle()
      setDcaHint(data
        ? { id: data.id, name: data.name, qty: data.quantity, price: data.purchase_price }
        : null)
    }, 900)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, isEdit])

  // 조회 완료 → 종목명 자동 입력 + 자산 포지션 자동 분류
  useEffect(() => {
    if (isEdit || nameStatus !== 'found' || !lookedUpName) return
    setName(lookedUpName)
    // 수동 오버라이드 중이 아닐 때만 자동 분류 실행
    if (!manualOverride) {
      const classified = classifyAsset(ticker, lookedUpName, market)
      setAssetRole(classified)
      setAutoClassified(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookedUpName, nameStatus, isEdit])

  const currency = MARKETS.find(m => m.id === market)?.currency ?? 'USD'

  const iStyle = (id: string): React.CSSProperties => ({
    ...S.input,
    ...(focused === id ? { borderColor: '#2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.15)' } : {}),
  })
  const bind = (id: string) => ({ onFocus: () => setFocused(id), onBlur: () => setFocused(null) })

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const finalName = (name.trim() || lookedUpName || ticker).toUpperCase()
    if (!ticker.trim())             { setError('티커를 입력해주세요.'); return }
    if (!purchasePrice)             { setError('매수가를 입력해주세요.'); return }
    if (!quantity)                  { setError('수량을 입력해주세요.'); return }
    if (parseFloat(purchasePrice) <= 0) { setError('매수가는 0보다 커야 합니다.'); return }
    if (parseFloat(quantity)       <= 0) { setError('수량은 0보다 커야 합니다.'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setSaving(false); return }

    const normalizedTicker = ticker.trim().toUpperCase()

    // ── 추가 모드: 중복 티커 → DCA 추가매수 처리 ──────────────────
    if (!isEdit) {
      const { data: existing } = await supabase
        .from('investments')
        .select('id,name,quantity,purchase_price')
        .eq('user_id', user.id)
        .eq('ticker', normalizedTicker)
        .maybeSingle()

      if (existing) {
        // DCA: 평단 재계산 + 수량 합산
        const existingQty   = existing.quantity
        const existingPrice = existing.purchase_price
        const newQty        = parseFloat(quantity)
        const newPrice      = parseFloat(purchasePrice)
        const newAvgPrice   = (existingQty * existingPrice + newQty * newPrice) / (existingQty + newQty)

        const { error: upErr } = await supabase
          .from('investments')
          .update({
            quantity:       existingQty + newQty,
            purchase_price: Math.round(newAvgPrice * 100) / 100,
          })
          .eq('id', existing.id)

        if (upErr) { setError(`업데이트 실패: ${upErr.message}`); setSaving(false); return }

        // 거래 내역 자동 기록 (실패해도 종목 업데이트는 성공 처리)
        try {
          await supabase.from('transactions').insert({
            user_id:          user.id,
            investment_id:    existing.id,
            ticker:           normalizedTicker,
            name:             finalName,
            market,
            currency,
            type:             'buy',
            price:            newPrice,
            quantity:         newQty,
            total_amount:     newPrice * newQty,
            fee:              0,
            memo:             `DCA 추가매수`,
            transaction_date: purchaseDate,
          })
        } catch { /* ignore */ }

        await bustServerCache(); await onRefresh(); setSaving(false); onClose(); return
      }
    }

    const payload = {
      user_id:        user.id,
      ticker:         normalizedTicker,
      name:           finalName,
      market,
      currency,
      purchase_price: parseFloat(purchasePrice),
      quantity:       parseFloat(quantity),
      purchase_date:  purchaseDate,
      lynch_category: null,  // 저장 직후 자동분류 API 호출로 업데이트
      asset_role:     assetRole,  // ★ 코어/새틀라이트 포지션
    }

    if (isEdit) {
      const { error } = await supabase.from('investments').update(payload).eq('id', initial!.id)
      if (error) { setError(`수정 실패: ${error.message}`); setSaving(false); return }

      // ★★★ 핵심 수정: 편집 시 수량·단가 변경 → 거래 내역 자동 기록 ★★★
      // 기존 코드는 투자 수정 시 transactions 테이블에 기록하지 않아
      // 투자기록·대시보드에 변경 사항이 누락되는 버그가 있었음
      const oldQty   = initial!.quantity
      const oldPrice = initial!.purchase_price
      const newQty   = parseFloat(quantity)
      const newPrice = parseFloat(purchasePrice)

      // 수량이 달라진 경우에만 거래 내역 생성
      if (Math.abs(newQty - oldQty) > 0.0001) {
        const qtyDiff  = newQty - oldQty
        const txType   = qtyDiff > 0 ? 'buy' : 'sell'
        const absQty   = Math.abs(qtyDiff)

        try {
          await supabase.from('transactions').insert({
            user_id:          user.id,
            investment_id:    initial!.id,
            ticker:           normalizedTicker,
            name:             finalName,
            market,
            currency,
            type:             txType,
            price:            newPrice,
            quantity:         absQty,
            total_amount:     newPrice * absQty,
            fee:              0,
            // 매도인 경우 실현 손익 계산 (기존 평단 기준)
            realized_pnl:     txType === 'sell'
              ? Math.round((newPrice - oldPrice) * absQty * 100) / 100
              : null,
            avg_cost_basis:   txType === 'sell' ? oldPrice : null,
            memo:             txType === 'buy' ? '수정: 추가매수 반영' : '수정: 일부매도 반영',
            transaction_date: purchaseDate,
          })
          console.log(`[Modal] 거래내역 자동 기록 완료: ${normalizedTicker} ${txType} ${absQty}주`)
        } catch (txErr) {
          // 거래내역 기록 실패해도 investments 수정은 성공 처리 (데이터 불일치 방지 로그만)
          console.warn('[Modal] 거래내역 자동 기록 실패 (investments 수정은 성공):', txErr)
        }
      }

      await onRefresh(); onChanged?.()
    } else {
      const { data: created, error } = await supabase
        .from('investments')
        .insert(payload)
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,created_at')
        .single()

      if (error) {
        // 23505 = unique_violation (혹시라도 중복 시 DCA로 재시도 안내)
        if (error.code === '23505') {
          setError(`중복 감지 오류 — 페이지를 새로고침 후 다시 시도해주세요.`)
          setSaving(false)
          return
        }
        console.error('[Modal] insert 실패:', error.message)
        await onRefresh()
      } else if (created) {
        // 신규 종목 최초 매수 → 거래 내역 자동 기록
        // 신규 종목 최초 매수 거래 기록 (실패해도 종목 추가는 성공 처리)
        try {
          await supabase.from('transactions').insert({
            user_id:          user.id,
            investment_id:    created.id,
            ticker:           normalizedTicker,
            name:             finalName,
            market,
            currency,
            type:             'buy',
            price:            parseFloat(purchasePrice),
            quantity:         parseFloat(quantity),
            total_amount:     parseFloat(purchasePrice) * parseFloat(quantity),
            fee:              0,
            memo:             `최초 매수`,
            transaction_date: purchaseDate,
          })
        } catch { /* ignore */ }

        // ── 피터 린치 자동분류 (백그라운드, ETF·CRYPTO 제외) ──
        if (market !== 'CRYPTO') {
          ;(async () => {
            try {
              const res = await fetch(
                `/api/lynch-classify?ticker=${encodeURIComponent(normalizedTicker)}&market=${market}`
              )
              if (res.ok) {
                const { category, isEtf } = await res.json()
                const lynchCat = (!isEtf && category && category !== 'na') ? category : null
                if (lynchCat) {
                  await supabase.from('investments').update({ lynch_category: lynchCat }).eq('id', created.id)
                }
              }
            } catch { /* 분류 실패해도 종목 추가는 성공 */ }
          })()
        }

        onAdded?.(created as Investment)
        onRefresh().catch(() => {})
      } else {
        await onRefresh()
      }
    }

    await bustServerCache()
    setSaving(false); onClose()
  }

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('investments').delete().eq('id', initial!.id)
    await bustServerCache(); await onRefresh(); setDeleting(false); onClose()
  }

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .modal-scroll::-webkit-scrollbar       { width: 4px }
        .modal-scroll::-webkit-scrollbar-track { background: transparent }
        .modal-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4) }
      `}</style>

      <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={S.modal} className="modal-scroll">

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px', margin: 0 }}>
                {isEdit ? '종목 수정' : dcaHint ? '📊 DCA 추가매수' : '종목 추가'}
              </h2>
              <p style={{ fontSize: 12, color: '#8599ae', marginTop: 3 }}>
                {isEdit
                  ? `${initial!.ticker} · ${initial!.name}`
                  : dcaHint
                    ? `${dcaHint.name} — 평단 재계산 후 거래 내역 자동 기록`
                    : '피터 린치 분류는 저장 후 AI가 자동 분석합니다'}
              </p>
            </div>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#1e1e1e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7f93a8', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div style={S.body}>

              {/* ── 시장 선택 ── */}
              <div style={S.section}>
                <label style={S.label}>시장</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {MARKETS.map(m => {
                    const active = market === m.id
                    return (
                      <button key={m.id} type="button"
                        onClick={() => { setMarket(m.id); setTicker(''); setName(''); resetLookup() }}
                        style={{
                          padding: '10px 8px', borderRadius: 9, border: '1px solid', cursor: 'pointer',
                          transition: 'all 0.15s', textAlign: 'center' as const,
                          background:  active ? 'rgba(37,99,235,0.15)' : '#1e1e1e',
                          borderColor: active ? '#2563eb' : '#2a2a2a',
                          color:       active ? '#60a5fa' : '#7f93a8',
                        }}>
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{m.flag}</div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m.id}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── 티커 ── */}
              <div style={S.section}>
                <label style={S.label}>티커 / 심볼</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...iStyle('ticker'), paddingRight: nameStatus === 'loading' ? 36 : 12 }}
                    {...bind('ticker')}
                    value={ticker}
                    onChange={e => setTicker(e.target.value)}
                    placeholder={
                      market === 'US'     ? 'AAPL, NVDA, SPY…'  :
                      market === 'KR'     ? '005930, 293490…'    : 'BTC, ETH, XRP, SOL…'
                    }
                    autoCapitalize="characters" autoComplete="off" spellCheck={false}
                  />
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    {nameStatus === 'loading' && <Spin size={13} color="#8599ae"/>}
                    {nameStatus === 'found' && lookedUpName && (
                      <span style={{ fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 5, padding: '2px 7px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ✓ {lookedUpName}
                      </span>
                    )}
                    {nameStatus === 'error' && <span style={{ fontSize: 11, color: '#f87171' }}>조회 실패</span>}
                  </div>
                </div>

                {/* 시장별 안내 */}
                {market === 'KR' && (
                  <div style={S.hint}>
                    네이버 증권 기준 <strong style={{ color: '#f1f5f9' }}>6자리 종목 코드</strong>를 입력하세요.
                    <br/>
                    KOSPI 삼성전자 → <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>005930</code>
                    &nbsp;·&nbsp;
                    KOSDAQ 카카오게임즈 → <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>293490</code>
                  </div>
                )}
                {market === 'CRYPTO' && (
                  <div style={S.hint}>
                    <strong style={{ color: '#f1f5f9' }}>업비트 원화(KRW)</strong> 기준 티커를 입력하세요.
                    <br/>
                    예: <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>BTC</code>
                    {' '}·{' '}
                    <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>ETH</code>
                    {' '}·{' '}
                    <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>XRP</code>
                    {' '}·{' '}
                    <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>SOL</code>
                  </div>
                )}
              </div>

              {/* ── 종목명 ── */}
              <div style={S.section}>
                <label style={S.label}>
                  종목명
                  {nameStatus === 'loading' && <span style={{ marginLeft: 6 }}><Spin size={10} color="#8599ae"/></span>}
                </label>
                <input
                  style={iStyle('name')} {...bind('name')}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={
                    nameStatus === 'loading' ? '자동 조회 중…' :
                    nameStatus === 'error'   ? '직접 입력해주세요 (예: 삼성전자)' :
                    '종목명 (자동 입력 또는 직접 입력)'
                  }
                />
                {nameStatus === 'error' && (
                  <p style={{ ...S.hint, color: '#f87171' }}>⚠ 종목을 찾지 못했습니다. 직접 입력해주세요.</p>
                )}
              </div>

              <hr style={S.divider}/>

              {/* ── 매수가 / 수량 ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>매수가 ({currency === 'KRW' ? '₩' : '$'})</label>
                  <input type="number" step="any" min="0"
                    style={iStyle('price')} {...bind('price')}
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    placeholder={currency === 'KRW' ? '75000' : '180.50'}
                  />
                </div>
                <div>
                  <label style={S.label}>수량</label>
                  <input type="number" step="any" min="0"
                    style={iStyle('qty')} {...bind('qty')}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>

              {/* 총 매수금액 미리보기 */}
              {purchasePrice && quantity && parseFloat(purchasePrice) > 0 && parseFloat(quantity) > 0 && (
                <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 8, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#8599ae' }}>이번 거래금액</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                    {currency === 'KRW' ? '₩' : '$'}
                    {(parseFloat(purchasePrice) * parseFloat(quantity)).toLocaleString(
                      currency === 'KRW' ? 'ko-KR' : 'en-US',
                      { minimumFractionDigits: currency === 'KRW' ? 0 : 2, maximumFractionDigits: currency === 'KRW' ? 0 : 2 }
                    )}
                  </span>
                </div>
              )}

              {/* DCA 추가매수 미리보기 배너 */}
              {dcaHint && !isEdit && (
                <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:9, padding:'11px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#818cf8', marginBottom:6, letterSpacing:'0.05em' }}>
                    📊 DCA 추가매수 감지
                  </div>
                  <div style={{ fontSize:12, color:'#7f93a8', lineHeight:1.7 }}>
                    현재 보유:{' '}
                    <strong style={{ color:'#94a3b8' }}>{dcaHint.qty}주</strong>
                    {' × '}
                    <strong style={{ color:'#94a3b8', fontVariantNumeric:'tabular-nums' }}>
                      {currency==='KRW' ? '₩' : '$'}{dcaHint.price.toLocaleString(currency==='KRW'?'ko-KR':'en-US')}
                    </strong>
                    {' '}(현재 평단)
                    {purchasePrice && quantity && parseFloat(purchasePrice) > 0 && parseFloat(quantity) > 0 && (() => {
                      const addQty  = parseFloat(quantity)
                      const addPrc  = parseFloat(purchasePrice)
                      const newQty  = dcaHint.qty + addQty
                      const newAvg  = (dcaHint.qty * dcaHint.price + addQty * addPrc) / newQty
                      const sym     = currency === 'KRW' ? '₩' : '$'
                      const fmt     = (n: number) => n.toLocaleString(currency==='KRW'?'ko-KR':'en-US', { maximumFractionDigits: currency==='KRW'?0:2 })
                      return (
                        <>
                          <br/>
                          추가 후 →{' '}
                          <strong style={{ color:'#a5b4fc' }}>{newQty}주</strong>
                          , 새 평단{' '}
                          <strong style={{ color:'#a5b4fc', fontVariantNumeric:'tabular-nums' }}>{sym}{fmt(newAvg)}</strong>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* ── 매수일 ── */}
              <div style={S.section}>
                <label style={S.label}>매수일</label>
                <input type="date"
                  style={iStyle('date')} {...bind('date')}
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* ── 자산 포지션 (자동 분류 + 수동 오버라이드) ── */}
              <div style={S.section}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <label style={{ ...S.label, margin:0 }}>자산 포지션 전략</label>
                  {/* 자동분류 배지 + 오버라이드 토글 */}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {autoClassified && !manualOverride && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
                        background:'rgba(56,189,248,0.12)', color:'#38bdf8',
                        border:'1px solid rgba(56,189,248,0.3)',
                      }}>
                        ⚡ 자동 분류
                      </span>
                    )}
                    {manualOverride && (
                      <span style={{
                        fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
                        background:'rgba(251,191,36,0.12)', color:'#fbbf24',
                        border:'1px solid rgba(251,191,36,0.3)',
                      }}>
                        ✏️ 수동 설정
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (manualOverride) {
                          // 자동 분류로 되돌리기
                          setManualOverride(false)
                          if (ticker && name) {
                            const classified = classifyAsset(ticker, name, market)
                            setAssetRole(classified)
                            setAutoClassified(true)
                          }
                        } else {
                          setManualOverride(true)
                        }
                      }}
                      style={{
                        fontSize:9, padding:'2px 8px', borderRadius:4,
                        border:'1px solid #2a2a2a', background:'#181818',
                        color:'#8a9aaa', cursor:'pointer',
                      }}>
                      {manualOverride ? '🔄 자동으로' : '✏️ 수동 변경'}
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {([
                    { role:'CORE'      as AssetRole, icon:'🏛', label:'코어 (기반)',      desc:'ETF · 채권 · 인덱스' },
                    { role:'SATELLITE' as AssetRole, icon:'🛰', label:'새틀라이트 (위성)', desc:'개별주식 · 테마 · 암호화폐' },
                  ]).map(({ role, icon, label, desc }) => (
                    <button key={role} type="button"
                      onClick={() => {
                        setAssetRole(role)
                        setManualOverride(true)    // 클릭 시 수동 오버라이드로 전환
                        setAutoClassified(false)
                      }}
                      style={{
                        flex:1, padding:'10px 8px', borderRadius:9, border:'none', cursor:'pointer',
                        textAlign:'center' as const, transition:'all 0.15s',
                        background: assetRole === role ? '#1e1e1e' : '#181818',
                        boxShadow:  assetRole === role
                          ? '0 0 0 2px ' + (role==='CORE'?'#34d399':'#fbbf24')
                          : '0 0 0 1px #2a2a2a',
                        // 수동 오버라이드 아닐 때 선택 안 된 버튼 흐릿하게
                        opacity: !manualOverride && assetRole !== role ? 0.5 : 1,
                      }}>
                      <div style={{ fontSize:18, marginBottom:3 }}>{icon}</div>
                      <div style={{ fontSize:11, fontWeight:700, color: assetRole===role ? (role==='CORE'?'#34d399':'#fbbf24') : '#8a9aaa', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:9, color:'#8a96a8', lineHeight:1.4 }}>{desc}</div>
                    </button>
                  ))}
                </div>
                {/* 자동 분류 근거 안내 */}
                {autoClassified && !manualOverride && (
                  <div style={{ fontSize:10, color:'#8a96a8', marginTop:6, paddingLeft:2 }}>
                    {assetRole === 'CORE'
                      ? '✅ 지수형 ETF · 채권으로 코어 자동 분류됨'
                      : '✅ 개별종목 · 테마 ETF · 암호화폐로 새틀라이트 자동 분류됨'}
                  </div>
                )}
              </div>

              {/* ── 오류 ── */}
              {error && <div style={S.errBox}>⚠ {error}</div>}

              {/* ── 액션 버튼 ── */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {isEdit && (
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', fontSize: 14, cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                    {deleting ? <Spin/> : confirmDel ? '확인 삭제' : '삭제'}
                  </button>
                )}
                <button type="button" onClick={onClose}
                  style={{ padding: '11px 20px', borderRadius: 9, border: '1px solid #2a2a2a', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  취소
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {saving ? <><Spin color="#fff"/> 저장 중…</> : isEdit ? '수정 완료' : dcaHint ? '📊 DCA 추가매수' : '종목 추가'}
                </button>
              </div>

              {confirmDel && (
                <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center' as const, marginTop: 10 }}>
                  한 번 더 누르면 영구 삭제됩니다
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
