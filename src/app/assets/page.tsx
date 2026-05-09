'use client'

/**
 * /assets — 자산관리
 * 기존 /dashboard 의 종목 카드 그리드를 이 페이지로 이동
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import AddInvestmentModal from '@/app/components/AddInvestmentModal'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market    = 'US' | 'KR' | 'CRYPTO'
type TimeFrame = '1D' | '1W' | '1M'
type LynchKey  = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'
type SortKey   = 'return' | 'name' | 'invested'
type PriceStatus = 'idle' | 'loading' | 'done' | 'error'

interface PricePoint { t: number; v: number }
interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  purchase_date: string; lynch_category: LynchKey|null
  created_at?: string  // AddInvestmentModal 타입과 호환 (optional)
}
interface LivePrice {
  currentPrice: number; change: number; changePct: number
  charts: Record<TimeFrame, PricePoint[]>; source: 'live'|'cache'; error?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const USD_KRW = 1_350
const CHART_UP   = '#ef4444'
const CHART_DOWN = '#3b82f6'
const CHART_FLAT = '#6b7280'
const FRAMES: TimeFrame[] = ['1D','1W','1M']

const LYNCH_META: Record<string, { label: string; color: string }> = {
  slow_grower: { label: '완만한 성장주', color: '#9ca3af' },
  stalwart:    { label: '대형 우량주',   color: '#60a5fa' },
  fast_grower: { label: '빠른 성장주',   color: '#34d399' },
  cyclical:    { label: '경기 순환주',   color: '#fb923c' },
  turnaround:  { label: '회생 기업주',   color: '#f87171' },
  asset_play:  { label: '자산 보유주',   color: '#c084fc' },
  na:          { label: 'N/A',           color: '#4b5563' },
}
const MARKET_COLOR: Record<Market, string> = { US:'#34d399', KR:'#60a5fa', CRYPTO:'#fb923c' }
const ETF_BRANDS = ['TIGER','KODEX','ACE','PLUS','KBSTAR','ARIRANG','HANARO','SOL']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function chartDir(s: PricePoint[]) {
  if (s.length < 2) return 'flat'
  const d = s[s.length-1].v - s[0].v
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
}
function fmtPrice(n: number, cur: 'USD'|'KRW') {
  return cur === 'KRW'
    ? n >= 10_000 ? `₩${(n/10_000).toFixed(1)}만` : `₩${Math.round(n).toLocaleString()}`
    : `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}
function fmtPct(n: number) { return `${n>0?'+':''}${n.toFixed(2)}%` }
// toKrwTotal은 페이지 내 stats 계산에 사용

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, frame, currency, uid }: { data: PricePoint[]; frame: TimeFrame; currency: 'USD'|'KRW'; uid: string }) {
  const dir   = chartDir(data)
  const color = dir==='up' ? CHART_UP : dir==='down' ? CHART_DOWN : CHART_FLAT
  const last  = data[data.length-1]?.v ?? 0
  const gradId = `sg-${uid}-${frame}-${dir}`
  const yDomain: [number|string, number|string] = (() => {
    if (!data.length) return ['auto','auto']
    const vals = data.map(d=>d.v), mn=Math.min(...vals), mx=Math.max(...vals), rng=mx-mn
    const pad = rng < mx*0.001 ? mx*0.005 : rng*0.15
    return [mn-pad, mx+pad]
  })()
  return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:9, fontWeight:600, color:'#4b5563', textAlign:'center', marginBottom:3 }}>{frame}</div>
      <div style={{ height:44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:2,right:1,bottom:2,left:1 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="100%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <YAxis domain={yDomain} hide width={0}/>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} isAnimationActive={false}/>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip content={({ active, payload }: any) => {
              if (!active||!payload?.length) return null
              return <div style={{ background:'#1f2937',border:'1px solid #374151',borderRadius:6,padding:'3px 7px',fontSize:11,color:'#f1f5f9',whiteSpace:'nowrap' }}>{fmtPrice(payload[0].value,currency)}</div>
            }}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize:9, color, textAlign:'center', marginTop:2, fontVariantNumeric:'tabular-nums' }}>
        {data.length ? fmtPrice(last,currency) : '—'}
      </div>
    </div>
  )
}

// ─── Investment Card ──────────────────────────────────────────────────────────
function InvestmentCard({ inv, live, priceStatus, onEdit, isClassifyDone }: {
  inv: Investment; live: LivePrice|null; priceStatus: PriceStatus
  onEdit: (i: Investment) => void; isClassifyDone: boolean
}) {
  const costPer   = inv.purchase_price
  const currPrice = live?.currentPrice ?? costPer
  const ret       = ((currPrice - costPer) / costPer) * 100
  const retColor  = ret > 0.05 ? CHART_UP : ret < -0.05 ? CHART_DOWN : CHART_FLAT
  const charts    = live?.charts ?? { '1D':[],'1W':[],'1M':[] }
  const isETF     = ETF_BRANDS.some(k => inv.name.toUpperCase().includes(k))
  const isNA      = inv.market === 'CRYPTO' || isETF

  return (
    <div
      style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:14, padding:'16px 16px 12px', display:'flex', flexDirection:'column', gap:12, cursor:'pointer', transition:'border-color 0.15s,transform 0.15s,box-shadow 0.15s' }}
      onClick={() => onEdit(inv)}
      onMouseEnter={e => { const el=e.currentTarget as HTMLDivElement; el.style.borderColor='#374151'; el.style.transform='translateY(-2px)'; el.style.boxShadow='0 8px 28px rgba(0,0,0,0.5)' }}
      onMouseLeave={e => { const el=e.currentTarget as HTMLDivElement; el.style.borderColor='#1f2937'; el.style.transform='none'; el.style.boxShadow='none' }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.3px' }}>{inv.name}</span>
            <span style={{ fontSize:9, fontWeight:700, color:MARKET_COLOR[inv.market], border:`1px solid ${MARKET_COLOR[inv.market]}44`, borderRadius:4, padding:'1px 4px' }}>{inv.market}</span>
          </div>
          {/* 배지 자리 */}
          <div style={{ height:22, display:'flex', alignItems:'center', marginTop:4 }}>
            {(() => {
              if (isNA) return <span style={{ background:'#1f2937', color:'#6b7280', fontSize:10, padding:'2px 7px', borderRadius:4, border:'1px solid #374151', fontWeight:500 }}>N/A</span>
              const cat = inv.lynch_category
              if (cat && cat !== 'na' && LYNCH_META[cat]) return (
                <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:500, color:LYNCH_META[cat].color, background:`${LYNCH_META[cat].color}15`, border:`1px solid ${LYNCH_META[cat].color}35` }}>
                  {LYNCH_META[cat].label}
                </span>
              )
              if (!isClassifyDone) return (
                <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#374151' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  분류 중...
                </span>
              )
              return null
            })()}
          </div>
        </div>
        <span style={{ fontSize:10, fontWeight:600, color:'#4b5563', background:'#1f2937', border:'1px solid #374151', borderRadius:6, padding:'2px 6px', fontFamily:'monospace', flexShrink:0 }}>{inv.ticker}</span>
      </div>

      {/* Sparklines */}
      <div style={{ display:'flex', gap:6, background:'#0d1117', borderRadius:9, padding:'8px 6px 6px', border:'1px solid #1f2937', position:'relative' }}>
        {priceStatus === 'loading' && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(13,17,23,0.7)', borderRadius:9 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        )}
        {FRAMES.map(f => <Sparkline key={f} data={charts[f]} frame={f} currency={inv.currency} uid={inv.ticker.toLowerCase()}/>)}
      </div>

      {/* Stats — 현재가 / 매수가 / 평가손익 / 수익률 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4 }}>
        <div>
          <div style={{ fontSize:9, color:'#4b5563', marginBottom:2 }}>현재가</div>
          <div style={{ fontSize:11, fontWeight:700, color:'#f1f5f9', fontVariantNumeric:'tabular-nums' }}>
            {priceStatus==='loading'?'…':fmtPrice(currPrice,inv.currency)}
          </div>
        </div>
        <div>
          <div style={{ fontSize:9, color:'#4b5563', marginBottom:2 }}>매수가</div>
          <div style={{ fontSize:11, fontWeight:500, color:'#4b5563', fontVariantNumeric:'tabular-nums' }}>
            {fmtPrice(costPer,inv.currency)}
          </div>
        </div>
        {/* 평가손익 = (현재가 - 매수가) × 수량 */}
        <div>
          <div style={{ fontSize:9, color:'#4b5563', marginBottom:2 }}>평가손익</div>
          <div style={{ fontSize:11, fontWeight:700, color: live ? retColor : '#374151', fontVariantNumeric:'tabular-nums' }}>
            {live
              ? `${(currPrice - costPer) * inv.quantity >= 0 ? '+' : ''}${fmtPrice((currPrice - costPer) * inv.quantity, inv.currency)}`
              : '—'}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:9, color:'#4b5563', marginBottom:2 }}>수익률</div>
          <div style={{ fontSize:12, fontWeight:800, color:live?retColor:'#374151', fontVariantNumeric:'tabular-nums' }}>
            {live?fmtPct(ret):'—'}
          </div>
        </div>
      </div>

      {/* Return bar */}
      {live && (
        <div style={{ width:'100%', height:3, background:'#1f2937', borderRadius:2, marginTop:-6 }}>
          <div style={{ width:`${Math.min(Math.abs(ret),100)}%`, height:3, background:ret>0?'#ef4444':ret<0?'#3b82f6':'#6b7280', borderRadius:2, transition:'width 0.6s ease' }}/>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const router = useRouter()
  const [investments,   setInvestments]   = useState<Investment[]>([])
  const [priceMap,      setPriceMap]      = useState<Record<string,LivePrice>>({})
  const [priceStatus,   setPriceStatus]   = useState<PriceStatus>('idle')
  const [dbLoading,     setDbLoading]     = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterMarket,  setFilterMarket]  = useState<Market|'all'>('all')
  const [sortBy,        setSortBy]        = useState<SortKey>('return')
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editTarget,    setEditTarget]    = useState<Investment|null>(null)
  const [classifyDone,  setClassifyDone]  = useState<Set<string>>(new Set())
  const classifyAttempted = useRef<Set<string>>(new Set())
  const abortRef = useRef<AbortController|null>(null)

  useEffect(() => {
    if (!dbLoading) return
    const t = setTimeout(() => setDbLoading(false), 5000)
    return () => clearTimeout(t)
  }, [dbLoading])

  const fetchInvestments = useCallback(async (silent = false) => {
    if (!silent) setDbLoading(true)
    try {
      const sb = createClient()
      const { data:{session} } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }
      const { data, error } = await sb
        .from('investments')
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,created_at')
        .eq('user_id', uid).order('created_at',{ascending:false})
      if (error) { console.error('[Assets]', error.message); setInvestments([]); return }

      // 중복 제거: id 기준 → ticker 기준 순서로 2중 필터
      // (DB UNIQUE 제약 적용 전 남은 중복 데이터도 UI에서 차단)
      const raw = data ?? []

      // 1) id 중복 제거
      const seenId = new Set<string>()
      const dedupeById = raw.filter(inv => {
        if (seenId.has(inv.id)) return false
        seenId.add(inv.id)
        return true
      })

      // 2) ticker 중복 제거 (같은 ticker → created_at 오래된 것 1개만 유지)
      const seenTicker = new Set<string>()
      const unique = dedupeById.filter(inv => {
        const key = inv.ticker.toUpperCase()
        if (seenTicker.has(key)) return false
        seenTicker.add(key)
        return true
      })

      if (unique.length !== raw.length)
        console.warn(`[Assets] 중복 ${raw.length - unique.length}건 필터링됨. supabase-unique-constraint.sql 실행 권장`)

      setInvestments(unique)
      return unique
    } catch(e) { console.error('[Assets]', e); setInvestments([]) }
    finally { setDbLoading(false) }
  }, [router])

  const fetchPrices = useCallback(async (invs: Investment[]) => {
    if (!invs.length) return
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    setPriceStatus('loading')
    try {
      const res = await fetch('/api/stock-price', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(invs.map(i=>({ticker:i.ticker,market:i.market}))), signal:ctrl.signal })
      if (!res.ok) throw new Error(`${res.status}`)
      const results: ({ticker:string}&LivePrice)[] = await res.json()
      const map: Record<string,LivePrice> = {}; results.forEach(r=>{map[r.ticker.toUpperCase()]=r})
      setPriceMap(map); setPriceStatus('done')
    } catch(e) { if ((e as Error).name !== 'AbortError') setPriceStatus('error') }
  }, [])

  const autoClassify = useCallback(async (invs: Investment[]) => {
    const targets = invs.filter(i => !i.lynch_category && i.market !== 'CRYPTO' && !classifyAttempted.current.has(i.id))
    if (!targets.length) return
    const sb = createClient()
    for (const inv of targets) {
      classifyAttempted.current.add(inv.id)
      try {
        const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(),5000)
        const res = await fetch(`/api/lynch-classify?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`,{signal:ctrl.signal}); clearTimeout(t)
        if (!res.ok) continue
        const {category} = await res.json() as {category: LynchKey|null}
        if (category) {
          await sb.from('investments').update({lynch_category:category}).eq('id',inv.id)
          setInvestments(prev => prev.map(i => i.id===inv.id ? {...i,lynch_category:category} : i))
        }
        setClassifyDone(prev => { const n=new Set(prev); n.add(inv.id); return n })
      } catch { setClassifyDone(prev => { const n=new Set(prev); n.add(inv.id); return n }) }
      await new Promise(r=>setTimeout(r,200))
    }
  }, [])

  useEffect(() => {
    fetchInvestments().then(invs => { if (invs?.length) { fetchPrices(invs); autoClassify(invs) } })
  }, [fetchInvestments, fetchPrices, autoClassify])

  const handleRefresh = useCallback(async () => {
    const invs = await fetchInvestments(true)
    if (invs?.length) { fetchPrices(invs); autoClassify(invs) }
  }, [fetchInvestments, fetchPrices, autoClassify])

  const handleAdded = useCallback((inv: Investment) => {
    setInvestments(prev => { if (prev.some(p=>p.id===inv.id)) return prev; fetchPrices([inv]); autoClassify([inv]); return [inv,...prev] })
  }, [fetchPrices, autoClassify])

  const live = (inv: Investment) => priceMap[inv.ticker.toUpperCase()] ?? null
  const getReturn = (inv: Investment) => { const lv=live(inv); if (!lv) return null; return ((lv.currentPrice-inv.purchase_price)/inv.purchase_price)*100 }

  const toKrwTotal = (inv: Investment) => inv.purchase_price*inv.quantity*(inv.currency==='USD'?USD_KRW:1)
  const totalCostKrw = investments.reduce((s,i)=>s+toKrwTotal(i),0)
  const hasUsd = investments.some(i=>i.currency==='USD')
  const fmtKrw = (n:number) =>
    n>=1e8 ? `₩${(n/1e8).toLocaleString('ko-KR', { minimumFractionDigits:1, maximumFractionDigits:1 })}억`
    : n>=1e4 ? `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`
    : `₩${Math.round(n).toLocaleString('ko-KR')}`

  const filtered = investments
    .filter(inv => { const q=search.toLowerCase(); return (filterMarket==='all'||inv.market===filterMarket)&&(!q||inv.name.toLowerCase().includes(q)||inv.ticker.toLowerCase().includes(q)) })
    .sort((a,b) => {
      if (sortBy==='name') return a.name.localeCompare(b.name,'ko')
      if (sortBy==='invested') return toKrwTotal(b)-toKrwTotal(a)
      return (getReturn(b)??-Infinity)-(getReturn(a)??-Infinity)
    })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}input::placeholder{color:#374151}select option{background:#1f2937}`}</style>

      {/* 요약 스트립 */}
      {!dbLoading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
          {[
            { label:'보유 종목', value:`${investments.length}개`, accent:'#f1f5f9' },
            { label:'총 투자금액', value:fmtKrw(totalCostKrw), sub:hasUsd?'USD 환산 포함':undefined, accent:'#9ca3af' },
            { label:'수익 종목', value:`${investments.filter(i=>live(i)&&live(i)!.currentPrice>i.purchase_price).length}개`, accent:'#ef4444' },
            { label:'손실 종목', value:`${investments.filter(i=>live(i)&&live(i)!.currentPrice<i.purchase_price).length}개`, accent:'#3b82f6' },
          ].map(({label,value,sub,accent})=>(
            <div key={label} style={{ background:'#111827',border:'1px solid #1f2937',borderRadius:10,padding:'12px 14px' }}>
              <div style={{ fontSize:9,fontWeight:600,color:'#4b5563',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:18,fontWeight:800,color:accent,fontVariantNumeric:'tabular-nums' }}>{value}</div>
              {sub&&<div style={{ fontSize:9,color:'#374151',marginTop:2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 컨트롤 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <div style={{ position:'relative', flexGrow:1, minWidth:150, maxWidth:260 }}>
          <svg style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#4b5563',pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="종목명 / 티커" style={{ width:'100%',padding:'7px 10px 7px 26px',background:'#111827',border:'1px solid #1f2937',borderRadius:8,color:'#f1f5f9',fontSize:12,outline:'none',boxSizing:'border-box' }} onFocus={e=>{e.currentTarget.style.borderColor='#2563eb'}} onBlur={e=>{e.currentTarget.style.borderColor='#1f2937'}}/>
        </div>
        {(['all','US','KR','CRYPTO'] as const).map(m=>(
          <button key={m} onClick={()=>setFilterMarket(m)} style={{ padding:'6px 11px',borderRadius:99,fontSize:11,fontWeight:600,cursor:'pointer',border:'1px solid',transition:'all 0.12s', background:filterMarket===m?(m==='all'?'rgba(255,255,255,0.06)':`${({US:'#34d399',KR:'#60a5fa',CRYPTO:'#fb923c'} as Record<string,string>)[m]}18`):'transparent', color:filterMarket===m?(m==='all'?'#f1f5f9':({US:'#34d399',KR:'#60a5fa',CRYPTO:'#fb923c'} as Record<string,string>)[m]):'#4b5563', borderColor:filterMarket===m?(m==='all'?'#374151':`${({US:'#34d399',KR:'#60a5fa',CRYPTO:'#fb923c'} as Record<string,string>)[m]}44`):'#1f2937' }}>
            {m==='all'?'전체':m}
          </button>
        ))}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)} style={{ padding:'7px 9px',background:'#111827',border:'1px solid #1f2937',borderRadius:8,color:'#4b5563',fontSize:11,outline:'none',cursor:'pointer' }}>
          <option value="return">수익률순</option>
          <option value="name">이름순</option>
          <option value="invested">투자금액순</option>
        </select>
        <button onClick={()=>fetchPrices(investments)} disabled={priceStatus==='loading'||!investments.length} style={{ padding:'7px 10px',background:'#111827',border:'1px solid #1f2937',borderRadius:8,color:'#4b5563',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:11,opacity:priceStatus==='loading'?0.5:1,transition:'color 0.15s' }} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#f1f5f9'}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#4b5563'}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:priceStatus==='loading'?'spin 0.8s linear infinite':'none' }}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
          현재가
        </button>
        <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:5,padding:'8px 14px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 0 20px rgba(37,99,235,0.3)',flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          종목 추가
        </button>
      </div>

      {/* 카드 그리드 */}
      {dbLoading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12 }}>
          {[0,1,2].map(i=><div key={i} style={{ height:200,background:'#111827',borderRadius:14,animation:'pulse 1.5s ease-in-out infinite' }}/>)}
        </div>
      ) : investments.length === 0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 0',gap:14 }}>
          <div style={{ fontSize:36 }}>💼</div>
          <div style={{ fontWeight:700,fontSize:16,color:'#6b7280' }}>포트폴리오가 비어있습니다</div>
          <div style={{ fontSize:13,color:'#374151' }}>첫 번째 종목을 추가해 투자 현황을 추적하세요</div>
          <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ padding:'10px 24px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' }}>+ 종목 추가하기</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:'48px 0',color:'#374151',fontSize:13 }}>검색 결과가 없습니다</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12 }}>
          {filtered.map(inv=>(
            <InvestmentCard key={inv.id} inv={inv} live={live(inv)} priceStatus={priceStatus} onEdit={t=>{setEditTarget(t);setModalOpen(true)}} isClassifyDone={classifyDone.has(inv.id)||!!inv.lynch_category||inv.market==='CRYPTO'}/>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddInvestmentModal initial={editTarget??undefined} onClose={()=>{setModalOpen(false);setEditTarget(null)}} onRefresh={handleRefresh} onAdded={handleAdded} onChanged={handleRefresh}/>
      )}
    </div>
  )
}
