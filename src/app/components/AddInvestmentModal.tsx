'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market   = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'

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
  created_at?:    string   // 페이지별 Investment 타입과 호환
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
    display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
    marginBottom: 6, letterSpacing: '0.07em', textTransform: 'uppercase' as const,
  },
  input: {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '10px 12px', background: '#1e1e1e',
    border: '1px solid #2a2a2a', borderRadius: 9,
    color: '#f1f5f9', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  hint:    { fontSize: 11, color: '#475569', marginTop: 6, lineHeight: 1.5 },
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
  const [focused,    setFocused]    = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const { name: lookedUpName, status: nameStatus, lookup, reset: resetLookup } = useNameLookup()

  // 편집 모드 아닐 때 티커/시장 변경 → 이름 자동 조회
  useEffect(() => {
    if (isEdit) return
    if (ticker.length >= 1) lookup(ticker, market)
    else resetLookup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, market])

  // 조회 완료 → 종목명 자동 입력 (사용자가 직접 수정하지 않은 경우)
  useEffect(() => {
    if (isEdit || nameStatus !== 'found' || !lookedUpName) return
    setName(lookedUpName)
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

    // ── 추가 모드: 중복 티커 체크 (maybeSingle: 없어도 에러 없음) ──
    if (!isEdit) {
      const { data: existing, error: chkErr } = await supabase
        .from('investments')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('ticker', normalizedTicker)
        .maybeSingle()

      if (chkErr) console.warn('[Modal] 중복 체크 오류:', chkErr.message)

      if (existing) {
        setError(`이미 보유 중인 종목입니다 (${existing.name ?? normalizedTicker}). 해당 카드를 클릭하면 수정할 수 있습니다.`)
        setSaving(false)
        return
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
      lynch_category: null,   // 대시보드에서 AI가 자동 분류
    }

    if (isEdit) {
      const { error } = await supabase.from('investments').update(payload).eq('id', initial!.id)
      if (error) { setError(`수정 실패: ${error.message}`); setSaving(false); return }
      await onRefresh(); onChanged?.()
    } else {
      const { data: created, error } = await supabase
        .from('investments')
        .insert(payload)
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,created_at')
        .single()

      if (error) {
        // 23505 = unique_violation (DB UNIQUE 제약 위반)
        if (error.code === '23505') {
          setError(`이미 보유 중인 종목입니다 (${normalizedTicker}). 해당 카드를 클릭하면 수정할 수 있습니다.`)
          setSaving(false)
          return
        }
        console.error('[Modal] insert 실패:', error.message)
        await onRefresh()
      } else if (created) {
        onAdded?.(created as Investment)
        onRefresh().catch(() => {})
      } else {
        await onRefresh()
      }
    }

    setSaving(false); onClose()
  }

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('investments').delete().eq('id', initial!.id)
    await onRefresh(); setDeleting(false); onClose()
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
                {isEdit ? '종목 수정' : '종목 추가'}
              </h2>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                {isEdit
                  ? `${initial!.ticker} · ${initial!.name}`
                  : '피터 린치 분류는 저장 후 AI가 자동 분석합니다'}
              </p>
            </div>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#1e1e1e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
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
                          color:       active ? '#60a5fa' : '#64748b',
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
                    {nameStatus === 'loading' && <Spin size={13} color="#475569"/>}
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
                  {nameStatus === 'loading' && <span style={{ marginLeft: 6 }}><Spin size={10} color="#475569"/></span>}
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
                <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 8, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>총 매수금액</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                    {currency === 'KRW' ? '₩' : '$'}
                    {(parseFloat(purchasePrice) * parseFloat(quantity)).toLocaleString(
                      currency === 'KRW' ? 'ko-KR' : 'en-US',
                      { minimumFractionDigits: currency === 'KRW' ? 0 : 2, maximumFractionDigits: currency === 'KRW' ? 0 : 2 }
                    )}
                  </span>
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
                  {saving ? <><Spin color="#fff"/> 저장 중…</> : isEdit ? '수정 완료' : '종목 추가'}
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
