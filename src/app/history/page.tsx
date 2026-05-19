'use client'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts'

type Market = 'US' | 'KR' | 'CRYPTO'

interface Transaction {
  id: string
  ticker: string
  name: string
  market: Market
  currency: 'USD' | 'KRW'
  type: 'buy' | 'sell'
  price: number
  quantity: number
  total_amount: number
  fee: number
  realized_pnl: number | null
  avg_cost_basis: number | null
  memo: string | null
  transaction_date: string
  created_at: string
}

interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD' | 'KRW'
  purchase_price: number; quantity: number
  purchase_date: string
}

const N = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

const fmtPrice = (n: number, cur: 'USD' | 'KRW') =>
  cur === 'KRW'
    ? `₩${Math.round(n).toLocaleString('ko-KR')}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) => {
  const dt = new Date(d)
  return `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}`
}

const fmtKrw = (n: number) => {
  const v = isFinite(n) ? n : 0
  return v >= 1e8
    ? `₩${(v / 1e8).toFixed(1)}억`
    : v >= 1e4
    ? `₩${Math.round(v / 1e4).toLocaleString('ko-KR')}만`
    : `₩${Math.round(v).toLocaleString('ko-KR')}`
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [investments,  setInvestments]  = useState<Investment[]>([])
  const [priceMap,     setPriceMap]     = useState<Record<string, number>>({})
  const [loading,      setLoading]      = useState(true)
  const [usdKrw,       setUsdKrw]       = useState(1_350)
  const [activeTab,    setActiveTab]    = useState<'transactions' | 'cashflow'>('transactions')
  const [filterType,   setFilterType]   = useState<'all' | 'buy' | 'sell'>('all')

  // USD/KRW rate — localStorage cache (1 hour TTL)
  useEffect(() => {
    const CACHE_KEY = 'usd_krw_rate'
    const load = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { rate, savedAt } = JSON.parse(cached) as { rate: number; savedAt: string }
          if (Date.now() - new Date(savedAt).getTime() < 3_600_000) {
            setUsdKrw(Math.round(rate)); return
          }
        }
        const res = await fetch('/api/exchange-rate')
        if (res.ok) {
          const { rate } = await res.json() as { rate: number }
          if (rate > 0) {
            const rounded = Math.round(rate)
            setUsdKrw(rounded)
            localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: rounded, savedAt: new Date().toISOString() }))
          }
        }
      } catch { /* keep default */ }
    }
    load()
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }

      // ── 1. investments + transactions 동시 로드 ──────────────────────────────
      const [{ data: txRaw }, { data: invData }] = await Promise.all([
        sb.from('transactions').select('*').eq('user_id', uid).order('transaction_date', { ascending: false }),
        sb.from('investments').select('*').eq('user_id', uid),
      ])
      const txList = txRaw ?? []
      const invs   = invData ?? []

      // ── 2. 자동 동기화: investments vs transactions 수량 불일치 감지 & 복구 ──
      //
      // [올바른 가격 계산 방법]
      //   investments.purchase_price = 가중평균 단가 (모든 매수의 평균)
      //   transactions의 기록된 총 투자금 = Σ(price × qty)
      //   누락된 주식의 실제 매수가 = (평단×총수량 - 기록된총투자금) / 누락수량
      //
      //   예) SK하이닉스 평단₩1,322,500 × 2주 = ₩2,645,000 총투자금
      //       기록된 거래 = 1주 × ₩900,000 = ₩900,000
      //       누락 1주 가격 = (₩2,645,000 - ₩900,000) / 1 = ₩1,745,000  ← 정확!
      //       (₩1,322,500 사용 시 평단이 ₩1,111,250으로 틀어짐 ← 이전 버그)
      //
      // [잘못된 이전 자동동기화 레코드 처리]
      //   기존에 잘못된 가격(평단가 그대로)으로 삽입된 '자동 동기화' 메모 레코드를
      //   먼저 삭제한 뒤 올바른 가격으로 재생성한다.

      // Step A: 기존 '자동 동기화' 레코드 삭제 (잘못된 가격으로 생성된 것 제거)
      const autoSyncIds = txList
        .filter(t => t.memo?.includes('자동 동기화'))
        .map(t => t.id)
      if (autoSyncIds.length > 0) {
        await sb.from('transactions').delete().in('id', autoSyncIds)
      }

      // Step B: 삭제 후 순수 수동 기록만으로 수량·비용 집계
      const cleanTxList = txList.filter(t => !t.memo?.includes('자동 동기화'))

      const txQtyByTicker:  Record<string, number> = {}
      const txCostByTicker: Record<string, number> = {}  // 기록된 총 투자금

      cleanTxList.forEach(t => {
        const key = t.ticker.toUpperCase()
        if (t.type === 'buy') {
          txQtyByTicker[key]  = (txQtyByTicker[key]  ?? 0) + t.quantity
          txCostByTicker[key] = (txCostByTicker[key] ?? 0) + (t.price * t.quantity)
        } else {
          txQtyByTicker[key]  = (txQtyByTicker[key]  ?? 0) - t.quantity
          txCostByTicker[key] = (txCostByTicker[key] ?? 0) - (t.price * t.quantity)
        }
      })

      const today = new Date().toISOString().split('T')[0]
      let reconciled = autoSyncIds.length > 0  // 삭제가 있었으면 재조회 필요

      for (const inv of invs) {
        const key      = inv.ticker.toUpperCase()
        const txTotal  = txQtyByTicker[key]  ?? 0
        const txCost   = txCostByTicker[key] ?? 0
        const diff     = inv.quantity - txTotal   // 양수 = 누락된 매수 수량

        if (diff > 0.0001) {
          // ★ 핵심: 누락 주식의 실제 매수가 역산
          //   총 투자금 = 평단 × 전체수량 → 기록된 투자금 제외 = 누락분 투자금
          const totalCost   = inv.purchase_price * inv.quantity
          const missingCost = totalCost - txCost           // 누락된 총 투자금
          const missingPrice = Math.round(missingCost / diff)  // 누락 주당 실제 매수가

          console.log(`[History] 수량 불일치 자동 복구: ${inv.ticker} 누락 ${diff}주 @ ₩${missingPrice.toLocaleString()} (평단역산)`)

          try {
            await sb.from('transactions').insert({
              user_id:          uid,
              investment_id:    inv.id,
              ticker:           inv.ticker,
              name:             inv.name,
              market:           inv.market,
              currency:         inv.currency,
              type:             'buy',
              price:            missingPrice,       // ★ 역산된 실제 매수가
              quantity:         diff,
              total_amount:     missingPrice * diff,
              fee:              0,
              memo:             '자동 동기화 (편집으로 누락된 거래 복구)',
              transaction_date: today,
            })
            reconciled = true
          } catch (e) {
            console.warn('[History] 자동 복구 실패:', e)
          }
        }
      }

      // 복구가 일어난 경우 transactions 재조회
      if (reconciled) {
        const { data: txRefreshed } = await sb
          .from('transactions').select('*').eq('user_id', uid)
          .order('transaction_date', { ascending: false })
        setTransactions(txRefreshed ?? [])
      } else {
        setTransactions(txList)
      }
      setInvestments(invs)

      // ── 3. 현재가 조회 (미실현 손익 계산용) ──────────────────────────────────
      if (invs.length > 0) {
        try {
          const res = await fetch('/api/stock-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invs.map((i: Investment) => ({ ticker: i.ticker, market: i.market }))),
          })
          if (res.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prices: any[] = await res.json()
            const m: Record<string, number> = {}
            prices.forEach(p => { if (p.currentPrice) m[p.ticker.toUpperCase()] = p.currentPrice })
            setPriceMap(m)
          }
        } catch { /* 현재가 없어도 페이지는 정상 동작 */ }
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ★ 자산관리 탭에서 매수/매도/편집 발생 시 거래 내역 즉시 갱신
  useEffect(() => {
    const handler = () => {
      console.log('[History] portfolio-updated 이벤트 수신 → 거래내역 갱신')
      fetchAll()
    }
    window.addEventListener('portfolio-updated', handler)
    return () => window.removeEventListener('portfolio-updated', handler)
  }, [fetchAll])

  // ★ 브라우저 탭/창 전환 후 돌아올 때 자동 갱신 (캐시 데이터 방지)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('[History] 탭 전환 복귀 → 데이터 자동 갱신')
        fetchAll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchAll])

  const filtered = transactions.filter(t => filterType === 'all' || t.type === filterType)

  const cashFlowData = useMemo(() => {
    const totalBuyKrw = transactions
      .filter(t => t.type === 'buy')
      .reduce((s, t) => s + t.total_amount * (t.currency === 'USD' ? usdKrw : 1), 0)

    const totalSellKrw = transactions
      .filter(t => t.type === 'sell')
      .reduce((s, t) => s + t.total_amount * (t.currency === 'USD' ? usdKrw : 1), 0)

    // 실현 손익 — 매도 거래에서 확정된 손익
    const totalRealizedPnl = transactions
      .filter(t => t.type === 'sell' && t.realized_pnl !== null)
      .reduce((s, t) => s + (t.realized_pnl ?? 0) * (t.currency === 'USD' ? usdKrw : 1), 0)

    // 미실현 손익 — 현재 보유 종목의 평가손익 (현재가 - 평단 × 수량)
    const totalUnrealizedPnl = investments.reduce((s, inv) => {
      const cur = priceMap[inv.ticker.toUpperCase()]
      if (!cur) return s
      const diff = (cur - inv.purchase_price) * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)
      return s + diff
    }, 0)
    const hasPrices = Object.keys(priceMap).length > 0

    const netInvested = totalBuyKrw - totalSellKrw

    const monthlyMap: Record<string, { buy: number; sell: number }> = {}
    transactions.forEach(t => {
      const month = t.transaction_date.slice(0, 7)
      if (!monthlyMap[month]) monthlyMap[month] = { buy: 0, sell: 0 }
      const amtKrw = t.total_amount * (t.currency === 'USD' ? usdKrw : 1)
      if (t.type === 'buy') monthlyMap[month].buy += amtKrw
      else monthlyMap[month].sell += amtKrw
    })

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { buy, sell }]) => ({
        month,
        label: `${month.slice(2, 4)}/${month.slice(5, 7)}`,
        buy: Math.round(buy),
        sell: Math.round(sell),
      }))

    let cumulative = 0
    const cumulativeLine = monthly.map(m => {
      cumulative += m.buy - m.sell
      return { ...m, cumulative: Math.round(cumulative) }
    })

    return { totalBuyKrw, totalSellKrw, totalRealizedPnl, totalUnrealizedPnl, hasPrices, netInvested, monthly, cumulativeLine }
  }, [transactions, investments, priceMap, usdKrw])

  if (loading) return <LoadingSpinner />

  const tabs = [
    { id: 'transactions', label: '📋 거래 내역' },
    { id: 'cashflow', label: '💰 현금 흐름' },
  ]

  const filterBtns = [
    { id: 'all', label: '전체' },
    { id: 'buy', label: '매수' },
    { id: 'sell', label: '매도' },
  ]

  const summaryCards = [
    { label: '총 매수금액', value: cashFlowData.totalBuyKrw, accent: '#f87171', subLabel: '전체 매수 합계' },
    { label: '총 매도금액', value: cashFlowData.totalSellKrw, accent: '#60a5fa', subLabel: '전체 매도 합계' },
    {
      label: '미실현 평가손익',
      value: cashFlowData.totalUnrealizedPnl,
      accent: cashFlowData.totalUnrealizedPnl >= 0 ? '#f87171' : '#60a5fa',
      subLabel: cashFlowData.hasPrices ? '현재가 기준 보유 손익' : '현재가 로딩 중…',
      isUnrealized: true,
    },
    {
      label: '실현 손익',
      value: cashFlowData.totalRealizedPnl,
      accent: cashFlowData.totalRealizedPnl >= 0 ? '#f87171' : '#60a5fa',
      subLabel: '매도 확정 손익',
    },
    { label: '순 투자금액', value: cashFlowData.netInvested, accent: '#a78bfa', subLabel: '매수 - 매도' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as 'transactions' | 'cashflow')}
            style={{
              padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: activeTab === tab.id ? N : '#13162a',
              boxShadow: activeTab === tab.id ? SHO : SHI,
              color: activeTab === tab.id ? '#dde4f0' : '#454868',
              borderLeft: activeTab === tab.id ? '3px solid #6366f1' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab 1: 거래 내역 */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8 }}>
            {filterBtns.map(btn => (
              <button key={btn.id} onClick={() => setFilterType(btn.id as 'all' | 'buy' | 'sell')}
                style={{
                  padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: filterType === btn.id ? N : '#13162a',
                  boxShadow: filterType === btn.id ? SHO : SHI,
                  color: filterType === btn.id ? '#dde4f0' : '#454868',
                  borderLeft: filterType === btn.id ? '3px solid #6366f1' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              >{btn.label}</button>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#141728', borderBottom: '1px solid #252840' }}>
                    {['날짜', '구분', '종목명', '단가', '수량', '거래금액', '실현손익', '메모'].map(h => (
                      <th key={h} style={{
                        padding: '11px 14px',
                        textAlign: 'left',
                        fontSize: 10, fontWeight: 600, color: '#4b5563',
                        textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '60px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>🔄</div>
                        <div style={{ color: '#dde4f0', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                          아직 거래 내역이 없습니다
                        </div>
                        <div style={{ color: '#454868', fontSize: 12 }}>
                          자산관리 페이지에서 매수/매도를 진행하면 여기에 기록됩니다
                        </div>
                      </td>
                    </tr>
                  ) : filtered.map((t, idx) => (
                    <tr key={t.id} style={{ borderTop: '1px solid #1e2140', background: idx % 2 === 0 ? 'transparent' : 'rgba(20,23,40,0.5)' }}>
                      {/* 날짜 */}
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(t.transaction_date)}
                      </td>
                      {/* 구분 */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: t.type === 'buy' ? '#ef4444' : '#3b82f6',
                          border: `1px solid ${t.type === 'buy' ? '#ef444444' : '#3b82f644'}`,
                          borderRadius: 4, padding: '2px 6px',
                        }}>
                          {t.type === 'buy' ? '매수' : '매도'}
                        </span>
                      </td>
                      {/* 종목명 */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                        <div style={{ color: '#454868', fontFamily: 'monospace', fontSize: 11 }}>{t.ticker}</div>
                      </td>
                      {/* 단가 */}
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {fmtPrice(t.price, t.currency)}
                      </td>
                      {/* 수량 */}
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {t.quantity.toLocaleString()}
                      </td>
                      {/* 거래금액 */}
                      <td style={{ padding: '10px 14px', color: '#cbd5e1', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {fmtPrice(t.total_amount, t.currency)}
                      </td>
                      {/* 실현손익 */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {t.type === 'sell' && t.realized_pnl !== null ? (
                          <span style={{
                            fontWeight: 700,
                            color: t.realized_pnl >= 0 ? '#ef4444' : '#3b82f6',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {t.realized_pnl >= 0 ? '+' : ''}{fmtPrice(t.realized_pnl, t.currency)}
                          </span>
                        ) : (
                          <span style={{ color: '#363855' }}>—</span>
                        )}
                      </td>
                      {/* 메모 */}
                      <td style={{ padding: '10px 14px', color: '#454868', fontSize: 12 }}>
                        {t.memo || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note */}
          <p style={{ fontSize: 11, color: '#363855', textAlign: 'center' }}>
            환산금액은 USD×<strong style={{ color: '#4b5563' }}>₩{usdKrw.toLocaleString('ko-KR')}</strong> 기준입니다
          </p>
        </div>
      )}

      {/* Tab 2: 현금 흐름 */}
      {activeTab === 'cashflow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 5 Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {summaryCards.map(card => (
              <div key={card.label} style={{
                background: N, boxShadow: SHO, borderRadius: 12,
                padding: '16px 18px', borderLeft: `3px solid ${card.accent}`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#454868', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  {card.label}
                </div>
                {'isUnrealized' in card && !cashFlowData.hasPrices ? (
                  /* 현재가 로딩 전 */
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#454868', letterSpacing: '-0.3px' }}>—</div>
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.4px' }}>
                    {card.value >= 0 ? '+' : ''}{fmtKrw(card.value)}
                  </div>
                )}
                {card.subLabel && (
                  <div style={{ fontSize: 10, color: '#363855', marginTop: 4 }}>{card.subLabel}</div>
                )}
              </div>
            ))}
          </div>

          {/* Monthly bar chart */}
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '16px 18px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              월별 거래 현황
            </div>
            {cashFlowData.monthly.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#363855', fontSize: 13 }}>
                거래 내역이 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cashFlowData.monthly} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2140" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#454868', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#454868', fontSize: 10 }} axisLine={false} tickLine={false} width={56}
                    tickFormatter={(v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(0)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : `${v}`}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: '#1b1e2e', border: '1px solid #252840', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#dde4f0' }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{payload[0]?.payload?.label}</div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {payload.map((p: any, i: number) => (
                          <div key={i} style={{ color: p.color }}>
                            {p.name}: {p.value >= 1e4 ? `₩${Math.round(p.value / 1e4)}만` : `₩${p.value.toLocaleString()}`}
                          </div>
                        ))}
                      </div>
                    )
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                  <Bar dataKey="buy" name="매수" fill="#ef4444" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="sell" name="매도" fill="#3b82f6" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cumulative line chart */}
          <div style={{ background: N, boxShadow: SHO, borderRadius: 14, padding: '16px 18px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              누적 순투자금액 추이
            </div>
            {cashFlowData.cumulativeLine.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#363855', fontSize: 13 }}>
                거래 내역이 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={cashFlowData.cumulativeLine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2140" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#454868', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#454868', fontSize: 10 }} axisLine={false} tickLine={false} width={56}
                    tickFormatter={(v: number) => v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : `${v}`}
                  />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`₩${Math.round((v as number) / 1e4).toLocaleString()}만`, '누적 순투자']}
                    contentStyle={{ background: '#1b1e2e', border: '1px solid #252840', borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: '#dde4f0' }}
                    itemStyle={{ color: '#a78bfa' }}
                  />
                  <Line
                    type="monotone" dataKey="cumulative" stroke="#a78bfa" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#a78bfa' }} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Footer note */}
          <p style={{ fontSize: 11, color: '#363855', textAlign: 'center' }}>
            환산금액은 USD×<strong style={{ color: '#4b5563' }}>₩{usdKrw.toLocaleString('ko-KR')}</strong> 기준입니다
          </p>
        </div>
      )}
    </div>
  )
}
