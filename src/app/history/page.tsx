'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Market  = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower'|'stalwart'|'fast_grower'|'cyclical'|'turnaround'|'asset_play'|'na'

interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number; purchase_date: string
  lynch_category: LynchKey|null; created_at: string
}
interface LivePrice { currentPrice: number }

const USD_KRW = 1_350
const MARKET_COLOR: Record<Market, string> = { US:'#34d399', KR:'#60a5fa', CRYPTO:'#fb923c' }

function fmt(n: number) { return Math.round(n).toLocaleString('ko-KR') }
function fmtPrice(n: number, cur: 'USD'|'KRW') {
  return cur==='KRW' ? `₩${fmt(n)}` : `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}

export default function HistoryPage() {
  const router = useRouter()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [priceMap,    setPriceMap]    = useState<Record<string,LivePrice>>({})
  const [loading,     setLoading]     = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data:{session} } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }
      const { data } = await sb.from('investments').select('*').eq('user_id',uid).order('created_at',{ascending:false})
      const invs = data ?? []
      setInvestments(invs)
      if (invs.length) {
        const res = await fetch('/api/stock-price',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(invs.map(i=>({ticker:i.ticker,market:i.market}))) })
        if (res.ok) {
          const results: ({ticker:string}&LivePrice)[] = await res.json()
          const m: Record<string,LivePrice> = {}; results.forEach(r=>{m[r.ticker.toUpperCase()]=r})
          setPriceMap(m)
        }
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const getReturn = (inv: Investment) => {
    const lv = priceMap[inv.ticker.toUpperCase()]
    if (!lv) return null
    return ((lv.currentPrice - inv.purchase_price) / inv.purchase_price) * 100
  }

  const totalCostKrw = investments.reduce((s,i)=>s+i.purchase_price*i.quantity*(i.currency==='USD'?USD_KRW:1),0)
  const totalCurrKrw = investments.reduce((s,i)=>{
    const lv=priceMap[i.ticker.toUpperCase()]
    return s+(lv?lv.currentPrice*i.quantity*(i.currency==='USD'?USD_KRW:1):i.purchase_price*i.quantity*(i.currency==='USD'?USD_KRW:1))
  },0)
  const totalPnL = totalCurrKrw - totalCostKrw
  const totalRet = totalCostKrw>0?((totalCurrKrw-totalCostKrw)/totalCostKrw)*100:0

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* 테이블 */}
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
            <thead>
              <tr style={{ background:'#0d1117', borderBottom:'1px solid #1f2937' }}>
                {['종목명','티커','시장','매수가','수량','총매수금액','현재가','평가금액','수익금액','수익률'].map(h=>(
                  <th key={h} style={{ padding:'11px 14px', textAlign: h==='수익률'||h==='수익금액' ? 'right' : 'left', fontSize:10, fontWeight:600, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investments.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:'48px 0', textAlign:'center', color:'#374151', fontSize:14 }}>종목이 없습니다. 자산관리에서 추가해주세요.</td></tr>
              ) : investments.map((inv,idx)=>{
                const ret    = getReturn(inv)
                const cost   = inv.purchase_price * inv.quantity
                const lv     = priceMap[inv.ticker.toUpperCase()]
                const currV  = lv ? lv.currentPrice * inv.quantity : null
                const pnl    = currV !== null ? currV - cost : null   // 수익금액
                const isUp   = ret !== null && ret > 0
                const isDown = ret !== null && ret < 0
                const retColor = isUp ? '#ef4444' : isDown ? '#3b82f6' : '#9ca3af'
                return (
                  <tr key={inv.id} style={{ borderTop:'1px solid #1f2937', background:idx%2===0?'transparent':'rgba(13,17,23,0.5)' }}>
                    <td style={{ padding:'10px 14px', color:'#f1f5f9', fontWeight:600 }}>{inv.name}</td>
                    <td style={{ padding:'10px 14px', color:'#4b5563', fontFamily:'monospace' }}>{inv.ticker}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:10,fontWeight:700,color:MARKET_COLOR[inv.market],border:`1px solid ${MARKET_COLOR[inv.market]}44`,borderRadius:4,padding:'1px 5px' }}>{inv.market}</span>
                    </td>
                    <td style={{ padding:'10px 14px', color:'#9ca3af', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtPrice(inv.purchase_price,inv.currency)}</td>
                    <td style={{ padding:'10px 14px', color:'#9ca3af', fontVariantNumeric:'tabular-nums' }}>{inv.quantity.toLocaleString()}</td>
                    <td style={{ padding:'10px 14px', color:'#cbd5e1', fontWeight:600, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtPrice(cost,inv.currency)}</td>
                    <td style={{ padding:'10px 14px', color:'#9ca3af', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{lv?fmtPrice(lv.currentPrice,inv.currency):'—'}</td>
                    <td style={{ padding:'10px 14px', color:'#cbd5e1', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{currV?fmtPrice(currV,inv.currency):'—'}</td>
                    {/* 수익금액 — 평가금액 - 총매수금액 */}
                    <td style={{ padding:'10px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                      {pnl !== null ? (
                        <span style={{ fontSize:12, fontWeight:700, color: pnl>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>
                          {pnl>=0?'+':''}{fmtPrice(pnl, inv.currency)}
                        </span>
                      ) : <span style={{ color:'#374151' }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                      {ret !== null ? (
                        <span style={{ fontSize:13,fontWeight:800,color:retColor,fontVariantNumeric:'tabular-nums' }}>
                          {ret>=0?'+':''}{ret.toFixed(2)}%
                        </span>
                      ) : <span style={{ color:'#374151' }}>—</span>}
                    </td>
                  </tr>
                )
              })}

              {/* 합계 행 */}
              {investments.length > 0 && (
                <tr style={{ borderTop:'2px solid #374151', background:'#0d1117' }}>
                  <td colSpan={5} style={{ padding:'11px 14px', fontWeight:700, color:'#f1f5f9', fontSize:12 }}>합계 ({investments.length}종목)</td>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#f1f5f9', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', fontSize:12 }}>
                    ₩{fmt(totalCostKrw)}
                    {investments.some(i=>i.currency==='USD') && <span style={{ fontSize:10, color:'#4b5563', marginLeft:4 }}>환산</span>}
                  </td>
                  <td style={{ padding:'11px 14px' }}/>
                  <td style={{ padding:'11px 14px', fontWeight:700, color:'#f1f5f9', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap', fontSize:12 }}>
                    {Object.keys(priceMap).length > 0 ? `₩${fmt(totalCurrKrw)}` : '—'}
                  </td>
                  {/* 수익금액 합계 */}
                  <td style={{ padding:'11px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                    {Object.keys(priceMap).length > 0 ? (
                      <span style={{ fontSize:13, fontWeight:800, color:totalPnL>=0?'#ef4444':'#3b82f6', fontVariantNumeric:'tabular-nums' }}>
                        {totalPnL>=0?'+':''}₩{fmt(totalPnL)}
                      </span>
                    ) : <span style={{ color:'#374151' }}>—</span>}
                  </td>
                  <td style={{ padding:'11px 14px', textAlign:'right', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:14,fontWeight:800,color:totalRet>=0?'#ef4444':'#3b82f6',fontVariantNumeric:'tabular-nums' }}>
                      {totalRet>=0?'+':''}{totalRet.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize:11, color:'#374151', textAlign:'center' }}>투자금액 합계는 USD×{USD_KRW.toLocaleString()} 원화 환산 기준입니다</p>
    </div>
  )
}
