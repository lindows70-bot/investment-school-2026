'use client'
// 📉 기술적 차트 전용 화면 — 증권사식 캔들+EMA(112·224)+일목균형표 구름대+모멘텀. 내 포트 종목 칩 + 자유 검색 + 일/주/월봉
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAssetType } from '@/lib/assetClassifier'
import TechnicalChartPro from '@/app/components/TechnicalChartPro'
import SignalReader from '@/app/components/SignalReader'
import type { TechCandle } from '@/app/api/tech-chart/route'

interface Holding { ticker: string; name: string; market: 'KR' | 'US'; avgPrice: number | null }
type TF = 'D' | 'W' | 'M'

const BORDER = '#1e293b'

export default function TechChartPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [sel, setSel] = useState<Holding | null>(null)
  const [query, setQuery] = useState('')
  const [tf, setTf] = useState<TF>('D')
  const [candles, setCandles] = useState<TechCandle[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 내 포트 종목(개별주식+ETF, KR/US만 — 크립토는 캔들 미지원)
  useEffect(() => {
    (async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('investments')
        .select('ticker,name,market,purchase_price,quantity').eq('user_id', user.id)
      if (!data) return
      const seen = new Map<string, Holding>()
      for (const r of data) {
        const mkt = String(r.market ?? '').toUpperCase()
        if (mkt !== 'KR' && mkt !== 'US') continue
        if (getAssetType(r.ticker, r.name, mkt) === 'CRYPTO') continue
        const key = `${r.ticker}:${mkt}`
        const prev = seen.get(key)
        // 같은 종목 여러 행(분할매수) → 가중평균 평단
        if (prev) {
          seen.set(key, prev)   // 평단은 첫 행 기준 유지(간이) — 아래에서 합산으로 대체
        } else {
          seen.set(key, { ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: mkt as 'KR' | 'US', avgPrice: null })
        }
      }
      // 가중평균 평단 계산(수량×매입가 합 ÷ 수량 합)
      const acc: Record<string, { cost: number; qty: number }> = {}
      for (const r of data) {
        const mkt = String(r.market ?? '').toUpperCase()
        const key = `${r.ticker}:${mkt}`
        if (!seen.has(key)) continue
        const p = Number(r.purchase_price), q = Number(r.quantity)
        if (!isFinite(p) || !isFinite(q) || q <= 0) continue
        acc[key] = { cost: (acc[key]?.cost ?? 0) + p * q, qty: (acc[key]?.qty ?? 0) + q }
      }
      const list = Array.from(seen.entries()).map(([key, h]) => ({
        ...h, avgPrice: acc[key] && acc[key].qty > 0 ? acc[key].cost / acc[key].qty : null,
      }))
      setHoldings(list)
      if (list.length && !sel) load(list[0], 'D')   // 첫 보유종목 자동 표시
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async (h: Holding, tfArg?: TF) => {
    const useTf = tfArg ?? tf
    setSel(h); setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/tech-chart?ticker=${encodeURIComponent(h.ticker)}&market=${h.market}&tf=${useTf}`)
      const j = await r.json()
      if (j.error) { setErr(j.error); setCandles(null) }
      else setCandles(j.candles)
    } catch { setErr('시세를 불러오지 못했습니다.'); setCandles(null) }
    setLoading(false)
  }, [tf])

  const search = () => {
    const t = query.trim().toUpperCase()
    if (!t) return
    const mkt: 'KR' | 'US' = /^\d/.test(t) ? 'KR' : 'US'
    const owned = holdings.find(h => h.ticker === t)
    load(owned ?? { ticker: t, name: t, market: mkt, avgPrice: null })
  }

  const changeTf = (t: TF) => { setTf(t); if (sel) load(sel, t) }

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1180, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,#141824,#0d1017)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9' }}>📉 기술적 차트 — 증권사식 캔들·이동평균·일목균형표</div>
        <div style={{ fontSize: 12, color: '#8599ae', marginTop: 4, lineHeight: 1.5 }}>
          가치판단(밸류·수급·계절·거시)에 <b style={{ color: '#cbd5e1' }}>기술적 타점</b>을 더하는 보조 화면.
          EMA 112·224 정배열/역배열 + 일목균형표 구름대(지지·저항)로 매수/매도 타이밍을 가늠합니다.
        </div>
      </div>

      {/* 검색 + 타임프레임 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="티커 검색 — 미국: AAPL·NVDA / 한국: 6자리 코드(005930)"
          style={{ flex: '1 1 300px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none' }} />
        <button onClick={search} style={{ background: '#2563eb', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔍 검색</button>
        <div style={{ display: 'inline-flex', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          {(['D', 'W', 'M'] as TF[]).map(t => (
            <button key={t} onClick={() => changeTf(t)} style={{
              padding: '9px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: tf === t ? '#1d4ed8' : 'transparent', color: tf === t ? '#fff' : '#8599ae',
            }}>{t === 'D' ? '일봉' : t === 'W' ? '주봉' : '월봉'}</button>
          ))}
        </div>
      </div>

      {/* 내 포트 종목 칩 */}
      {holdings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8599ae', fontWeight: 700, marginRight: 4 }}>💼 내 포트</span>
          {holdings.map(h => (
            <button key={h.ticker + h.market} onClick={() => load(h)} style={{
              padding: '5px 11px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              background: sel?.ticker === h.ticker ? '#1d4ed8' : '#0f1117',
              color: sel?.ticker === h.ticker ? '#fff' : '#cbd5e1',
              border: `1px solid ${sel?.ticker === h.ticker ? '#3b82f6' : BORDER}`,
            }}>{h.market === 'KR' ? '🇰🇷' : '🇺🇸'} {h.name}</button>
          ))}
        </div>
      )}

      {/* 종목 헤더 + 차트 */}
      {sel && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9' }}>{sel.name}</span>
          <span style={{ fontSize: 12.5, color: '#8599ae', fontFamily: 'monospace' }}>{sel.ticker} · {sel.market === 'KR' ? '한국' : '미국'} · {tf === 'D' ? '일봉' : tf === 'W' ? '주봉' : '월봉'}</span>
          {candles?.length ? (() => {
            const c = candles[candles.length - 1], p = candles[candles.length - 2]
            const chg = p ? c.close - p.close : null
            const pct = chg != null && p ? (chg / p.close) * 100 : null
            const col = (chg ?? 0) >= 0 ? '#F0475B' : '#3B82F6'
            return (<>
              <span style={{ fontSize: 20, fontWeight: 900, color: col, fontFamily: 'monospace' }}>
                {sel.market === 'KR' ? Math.round(c.close).toLocaleString() : c.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              {chg != null && pct != null && <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'monospace' }}>
                {chg >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</span>}
            </>)
          })() : null}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#8599ae', fontSize: 13, textAlign: 'center', padding: '60px 0' }}>📉 차트 데이터를 불러오는 중…</div>
      ) : err ? (
        <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>⚠️ {err}</div>
      ) : candles && sel ? (
        <>
          <TechnicalChartPro data={candles} market={sel.market} avgPrice={sel.avgPrice} />
          <SignalReader ticker={sel.ticker} market={sel.market} candles={candles} tf={tf} />
        </>
      ) : (
        <div style={{ color: '#8599ae', fontSize: 13, textAlign: 'center', padding: '60px 0' }}>
          👆 내 포트 종목을 클릭하거나 티커를 검색하면 증권사식 기술 차트가 표시됩니다.
        </div>
      )}
    </div>
  )
}
