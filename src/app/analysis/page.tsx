'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type LynchKey = 'slow_grower'|'stalwart'|'fast_grower'|'cyclical'|'turnaround'|'asset_play'|'na'
type Market = 'US'|'KR'|'CRYPTO'

interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  lynch_category: LynchKey|null
}

const USD_KRW = 1_350

const LYNCH_META: Record<string, { label: string; color: string; desc: string }> = {
  slow_grower: { label:'완만한 성장주', color:'#9ca3af', desc:'안정적 배당·저성장 대기업' },
  stalwart:    { label:'대형 우량주',   color:'#60a5fa', desc:'연 10~20% 성장, 경기 방어' },
  fast_grower: { label:'빠른 성장주',   color:'#34d399', desc:'연 20%+ EPS 성장, 높은 성장 잠재력' },
  cyclical:    { label:'경기 순환주',   color:'#fb923c', desc:'경기 사이클에 민감한 산업재·에너지' },
  turnaround:  { label:'회생 기업주',   color:'#f87171', desc:'적자·위기에서 회복 중인 기업' },
  asset_play:  { label:'자산 보유주',   color:'#c084fc', desc:'부동산·자원 등 숨겨진 자산 보유' },
  na:          { label:'N/A',           color:'#4b5563', desc:'ETF / 암호화폐' },
}

function toKrw(inv: Investment) {
  return inv.purchase_price * inv.quantity * (inv.currency === 'USD' ? USD_KRW : 1)
}
function fmtKrw(n: number) {
  return n >= 1e8 ? `₩${(n/1e8).toFixed(1)}억` : n >= 1e7 ? `₩${(n/1e4).toFixed(0)}만` : `₩${Math.round(n).toLocaleString('ko-KR')}`
}

export default function AnalysisPage() {
  const router = useRouter()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading,     setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data:{session} } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }
      const { data } = await sb.from('investments').select('id,ticker,name,market,currency,purchase_price,quantity,lynch_category').eq('user_id',uid)
      setInvestments(data ?? [])
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Lynch 분류별 집계 ─────────────────────────────────────────
  const totalKrw = investments.reduce((s,i)=>s+toKrw(i), 0)

  const lynchGroups = Object.keys(LYNCH_META).map(k => {
    const group = investments.filter(i => (i.lynch_category ?? 'na') === k)
    const invested = group.reduce((s,i)=>s+toKrw(i),0)
    return {
      key: k,
      ...LYNCH_META[k],
      count:    group.length,
      invested,
      pct:      totalKrw > 0 ? (invested / totalKrw) * 100 : 0,
      tickers:  group.map(i => i.ticker).join(', '),
    }
  }).filter(g => g.count > 0).sort((a,b) => b.invested - a.invested)

  // ── 리밸런싱 제안 (단순 규칙 기반) ───────────────────────────
  const RECOMMENDED: Record<string, number> = {
    fast_grower:  30, stalwart: 30, cyclical: 15,
    slow_grower:  10, turnaround: 10, asset_play: 5,
  }

  const rebalance = Object.entries(RECOMMENDED).map(([k, rec]) => {
    const current = lynchGroups.find(g => g.key === k)?.pct ?? 0
    const diff = current - rec
    return { key: k, ...LYNCH_META[k], current, recommended: rec, diff }
  }).sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff))

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const th = { padding:'10px 14px', textAlign:'left' as const, fontSize:10, fontWeight:600, color:'#4b5563', textTransform:'uppercase' as const, letterSpacing:'0.07em', whiteSpace:'nowrap' as const }
  const td = { padding:'10px 14px', borderTop:'1px solid #1f2937' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── 1. 피터 린치 분류별 현황 ── */}
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #1f2937' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>피터 린치 분류별 보유 현황</div>
          <div style={{ fontSize:12, color:'#4b5563', marginTop:3 }}>투자금액 기준 비중 분석</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#0d1117' }}>
              {['분류','특징','종목 수','투자금액','비중','포함 종목'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lynchGroups.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign:'center', color:'#374151', padding:'40px 0' }}>
                  분류된 종목이 없습니다. 자산관리 페이지에서 종목을 추가하면 자동 분류됩니다.
                </td></tr>
              ) : lynchGroups.map(g => (
                <tr key={g.key}>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, color:g.color, background:`${g.color}15`, border:`1px solid ${g.color}35` }}>
                      {g.label}
                    </span>
                  </td>
                  <td style={{ ...td, color:'#4b5563', fontSize:12, maxWidth:200 }}>{g.desc}</td>
                  <td style={{ ...td, color:'#f1f5f9', fontWeight:700, textAlign:'center' }}>{g.count}</td>
                  <td style={{ ...td, color:'#cbd5e1', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtKrw(g.invested)}</td>
                  <td style={{ ...td, whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:60, height:4, background:'#1f2937', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(g.pct,100)}%`, background:g.color, borderRadius:99 }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:g.color, fontVariantNumeric:'tabular-nums' }}>{g.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ ...td, color:'#4b5563', fontSize:11, fontFamily:'monospace' }}>{g.tickers || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. 리밸런싱 제안 ── */}
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #1f2937' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>포트폴리오 리밸런싱 제안</div>
          <div style={{ fontSize:12, color:'#4b5563', marginTop:3 }}>피터 린치 권장 비중과 현재 비중 비교</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#0d1117' }}>
              {['분류','현재 비중','권장 비중','차이','제안'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rebalance.map(r => {
                const over  = r.diff > 5
                const under = r.diff < -5
                const suggestion = over ? `${Math.abs(r.diff).toFixed(0)}%p 축소 고려` : under ? `${Math.abs(r.diff).toFixed(0)}%p 확대 고려` : '적정 비중'
                const suggColor  = over ? '#f87171' : under ? '#60a5fa' : '#34d399'
                return (
                  <tr key={r.key}>
                    <td style={{ ...td, whiteSpace:'nowrap' }}>
                      <span style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',borderRadius:99,fontSize:11,fontWeight:600,color:r.color,background:`${r.color}15`,border:`1px solid ${r.color}35` }}>{r.label}</span>
                    </td>
                    <td style={{ ...td }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:50, height:4, background:'#1f2937', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.min(r.current,100)}%`, background:r.color, borderRadius:99 }}/>
                        </div>
                        <span style={{ fontSize:12, fontVariantNumeric:'tabular-nums', color:'#f1f5f9' }}>{r.current.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ ...td, fontSize:12, color:'#4b5563', fontVariantNumeric:'tabular-nums' }}>{r.recommended}%</td>
                    <td style={{ ...td, fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums', color: r.diff>5?'#f87171':r.diff<-5?'#60a5fa':'#4b5563' }}>
                      {r.diff>=0?'+':''}{r.diff.toFixed(1)}%p
                    </td>
                    <td style={{ ...td }}>
                      <span style={{ fontSize:11, fontWeight:600, color:suggColor }}>{suggestion}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid #1f2937', fontSize:11, color:'#374151' }}>
          * 권장 비중은 일반적인 피터 린치 포트폴리오 기준이며, 개인 투자 성향에 따라 조정하세요. 투자의 책임은 본인에게 있습니다.
        </div>
      </div>
    </div>
  )
}
