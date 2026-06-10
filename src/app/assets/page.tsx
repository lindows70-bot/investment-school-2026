'use client'

/**
 * /assets — 자산관리
 * 수평 행 레이아웃: 종목정보 | 포트폴리오+재무 | 캔들차트
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AddInvestmentModal from '@/app/components/AddInvestmentModal'
import TransactionModal from '@/app/components/TransactionModal'
import FullCandleChart from '@/app/components/FullCandleChart'
import { type Candle } from '@/app/components/CandleChart'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market    = 'US' | 'KR' | 'CRYPTO'
type TimeFrame = '1D' | '1W' | '1M' | '1Y'
type LynchKey  = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'
type SortKey   = 'return' | 'name' | 'invested'
type PriceStatus = 'idle' | 'loading' | 'done' | 'error'

interface PricePoint { t: number; v: number }
type AssetRole = 'CORE' | 'SATELLITE'

interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  purchase_date: string; lynch_category: LynchKey|null
  /** 코어(기반) / 새틀라이트(위성) 포지션 — 기본값 CORE */
  asset_role: AssetRole
  created_at?: string
}
interface LivePrice {
  currentPrice: number; change: number; changePct: number
  charts: Record<TimeFrame, PricePoint[]>; source: 'live'|'cache'; error?: string
  ohlcCharts?: Record<TimeFrame, Candle[]>
  dividendYield?:  number | null
  payoutRatio?:    number | null
  annualDividend?: number | null
  per?:        number | null
  peg?:        number | null
  eps?:        number | null
  epsGrowth?:  number | null
  forwardEps?: number | null
  pbr?:        number | null
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const N   = '#1b1e2e'
const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

// ─── Config ───────────────────────────────────────────────────────────────────
const USD_KRW = 1_350
const FRAMES: TimeFrame[] = ['1D','1W','1M','1Y']

const LYNCH_META: Record<string, { label: string; color: string }> = {
  slow_grower: { label: '저성장주', color: '#a8b5c2' },
  stalwart:    { label: '대형 우량주',   color: '#60a5fa' },
  fast_grower: { label: '빠른 성장주',   color: '#34d399' },
  cyclical:    { label: '경기 순환주',   color: '#fb923c' },
  turnaround:  { label: '회생 기업주',   color: '#f87171' },
  asset_play:  { label: '자산 보유주',   color: '#c084fc' },
  na:          { label: 'N/A',           color: '#8a96a8' },
}
const MARKET_COLOR: Record<Market, string> = { US:'#34d399', KR:'#60a5fa', CRYPTO:'#fb923c' }
const ETF_BRANDS = ['TIGER','KODEX','ACE','PLUS','KBSTAR','ARIRANG','HANARO','SOL']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtKrwVal(n:number) {
  return n>=1e8 ? `₩${(n/1e8).toLocaleString('ko-KR', { minimumFractionDigits:1, maximumFractionDigits:1 })}억`
    : n>=1e4 ? `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`
    : `₩${Math.round(n).toLocaleString('ko-KR')}`
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
  const [txModalOpen,   setTxModalOpen]   = useState(false)
  const [txTarget,      setTxTarget]      = useState<Investment|null>(null)
  const [txMode,        setTxMode]        = useState<'buy'|'sell'>('buy')
  const [tfMap,         setTfMap]         = useState<Record<string,TimeFrame>>({})
  // 분류 변경 모달 상태
  const [roleModal,     setRoleModal]     = useState<Investment|null>(null)
  const [roleChanging,  setRoleChanging]  = useState(false)
  // 섹션별 정렬 기준: 'eval'(평가금액) | 'return'(수익률) | 'name'(종목명)
  type SortOption = 'eval' | 'return' | 'name'
  const [sortUS,     setSortUS]     = useState<SortOption>('eval')
  const [sortKR,     setSortKR]     = useState<SortOption>('eval')
  const [sortCRYPTO, setSortCRYPTO] = useState<SortOption>('eval')
  const classifyAttempted = useRef<Set<string>>(new Set())
  // ── 텐배거 트래커 평단가 (localStorage → FullCandleChart avgPrice prop 연동)
  const [tenbaggerPrices, setTenbaggerPrices] = useState<Record<string, number>>({})
  const abortRef = useRef<AbortController|null>(null)

  const getTf  = (ticker: string): TimeFrame => tfMap[ticker] ?? '1D'
  const setTf  = (ticker: string, tf: TimeFrame) => setTfMap(prev => ({ ...prev, [ticker]: tf }))

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
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category,asset_role,created_at')
        .eq('user_id', uid).order('created_at',{ascending:false})
      if (error) { console.error('[Assets]', error.message); setInvestments([]); return }

      const raw = data ?? []
      const seenId = new Set<string>()
      const dedupeById = raw.filter(inv => {
        if (seenId.has(inv.id)) return false
        seenId.add(inv.id); return true
      })
      const seenTicker = new Set<string>()
      const unique = dedupeById.filter(inv => {
        const key = inv.ticker.toUpperCase()
        if (seenTicker.has(key)) return false
        seenTicker.add(key); return true
      })
      if (unique.length !== raw.length)
        console.warn(`[Assets] 중복 ${raw.length - unique.length}건 필터링됨`)

      // ★ 방어 코드: asset_role 없는 기존 종목 → 'CORE' 기본값 자동 적용
      const withRole = unique.map(inv => ({
        ...inv,
        asset_role: (inv.asset_role as AssetRole | null | undefined) ?? 'CORE' as AssetRole,
      }))
      setInvestments(withRole)

      // ── 미분류 종목 자동 분류 (백그라운드) ─────────────────────────
      const ETF_BRANDS_CHECK = ['TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','SOL','RISE','1Q','ETF']
      const unclassified = unique.filter(i =>
        !i.lynch_category &&
        i.market !== 'CRYPTO' &&
        !ETF_BRANDS_CHECK.some(b => i.name.toUpperCase().includes(b))
      )
      if (unclassified.length > 0) {
        ;(async () => {
          const sbAuto = createClient()
          const uidAuto = uid
          let anyUpdated = false
          for (const inv of unclassified) {
            try {
              const res = await fetch(
                `/api/lynch-classify?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`,
                { cache: 'no-store' }
              )
              if (!res.ok) continue
              const { category, isEtf } = await res.json()
              if (isEtf || !category || category === 'na') continue
              const { error: upErr } = await sbAuto.from('investments')
                .update({ lynch_category: category })
                .eq('id', inv.id)
                .eq('user_id', uidAuto)
              if (!upErr) anyUpdated = true
            } catch { /* 무시 */ }
            await new Promise(r => setTimeout(r, 100))
          }
          if (anyUpdated) {
            // 분류 완료 → 목록 새로고침 (silent)
            fetchInvestments(true)
          }
        })()
      }

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
      // ── 가격 + 재무정보 병렬 조회 ─────────────────────────────────────
      // stock-price: 현재가·차트·OHLC (빠름)
      // stock-info:  PER·PEG·EPS·배당 등 상세 재무 (KR annual 포함, 느릴 수 있음)
      const [priceRes, infoResults] = await Promise.all([
        fetch('/api/stock-price', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify(invs.map(i=>({ticker:i.ticker,market:i.market}))),
          signal:ctrl.signal,
        }),
        // 전체 종목 조회 (슬라이스 제한 제거) — 배치로 나눠 서버 부하 방지
        (async () => {
          const BATCH = 6   // 한 번에 6개씩 순차 조회 (yahoo-finance2 과부하 방지)
          const all: (unknown)[] = []
          for (let i = 0; i < invs.length; i += BATCH) {
            const batch = invs.slice(i, i + BATCH)
            const results = await Promise.all(
              batch.map(inv =>
                fetch(`/api/stock-info?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`)
                  .then(r => r.ok ? r.json() : null)
                  .catch(() => null)
              )
            )
            all.push(...results)
          }
          return all
        })(),
      ])

      if (!priceRes.ok) throw new Error(`${priceRes.status}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: ({ticker:string}&LivePrice&{fundamentals?:any})[] = await priceRes.json()

      // stock-info map 구성 (ticker → fundamentals)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const infoMap: Record<string, any> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      infoResults.forEach((info: any, i: number) => {
        if (info && !info.error && invs[i]) {
          infoMap[invs[i].ticker.toUpperCase()] = info.fundamentals ?? {}
        }
      })

      const map: Record<string,LivePrice> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toN = (v: unknown): number | null => {
        if (typeof v === 'number' && isFinite(v) && v !== 0) return v
        return null
      }
      results.forEach(r => {
        // stock-info의 fundamentals 우선, 없으면 stock-price 것 사용
        const f = infoMap[r.ticker.toUpperCase()] ?? r.fundamentals ?? {}

        const eg = f.earningsGrowth
        const epsGrowth = eg != null
          ? (Math.abs(eg) < 20 ? +(eg * 100).toFixed(1) : +eg.toFixed(1))
          : null

        map[r.ticker.toUpperCase()] = {
          ...r,
          per:           toN(f.pe),
          peg:           toN(f.peg),
          eps:           toN(f.eps),
          epsGrowth,
          forwardEps:    toN(f.forwardEps),
          pbr:           toN(f.pbr),
          dividendYield: toN(f.dividendYield),
          payoutRatio:   toN(f.payoutRatio),
          annualDividend: toN(f.annualDividend),
        }
      })
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

  // ── 텐배거 트래커 평단가 localStorage 로드 ──────────────────
  // TenbaggerRadar 와 동일한 키 'tenbagger_base_prices_v1' 사용
  // { "ETN": 320, "NVDA": 120, "000660": 180000, ... } 형태
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tenbagger_base_prices_v1')
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>
        setTenbaggerPrices(parsed)
      }
    } catch { /* localStorage 접근 불가 환경 — 기본값 유지 */ }
  }, [])

  const handleRefresh = useCallback(async () => {
    const invs = await fetchInvestments(true)
    if (invs?.length) { fetchPrices(invs); autoClassify(invs) }
  }, [fetchInvestments, fetchPrices, autoClassify])

  const handleAdded = useCallback((inv: Investment) => {
    setInvestments(prev => { if (prev.some(p=>p.id===inv.id)) return prev; fetchPrices([inv]); autoClassify([inv]); return [inv,...prev] })
  }, [fetchPrices, autoClassify])

  const openBuyModal  = (inv: Investment) => { setTxTarget(inv); setTxMode('buy');  setTxModalOpen(true) }
  const openSellModal = (inv: Investment) => { setTxTarget(inv); setTxMode('sell'); setTxModalOpen(true) }
  const openEditModal = (inv: Investment) => { setEditTarget(inv); setModalOpen(true) }

  /** asset_role 변경 핸들러 */
  const handleRoleChange = useCallback(async (inv: Investment, newRole: AssetRole) => {
    if (inv.asset_role === newRole) { setRoleModal(null); return }
    setRoleChanging(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const uid = session?.user?.id
      if (!uid) return
      const { error } = await sb.from('investments')
        .update({ asset_role: newRole })
        .eq('id', inv.id)
        .eq('user_id', uid)
      if (error) { console.error('[AssetRole]', error.message); return }
      // 로컬 상태 즉시 반영 + 전역 동기화 이벤트
      setInvestments(prev => prev.map(i => i.id === inv.id ? { ...i, asset_role: newRole } : i))
      window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'asset_role' } }))
      setRoleModal(null)
    } finally {
      setRoleChanging(false)
    }
  }, [])

  const getLive   = (inv: Investment) => priceMap[inv.ticker.toUpperCase()] ?? null
  const getReturn = (inv: Investment) => { const lv=getLive(inv); if (!lv) return null; return ((lv.currentPrice-inv.purchase_price)/inv.purchase_price)*100 }

  const toKrwTotal = (inv: Investment) => inv.purchase_price*inv.quantity*(inv.currency==='USD'?USD_KRW:1)
  const totalCostKrw = investments.reduce((s,i)=>s+toKrwTotal(i),0)
  const hasUsd = investments.some(i=>i.currency==='USD')

  const filtered = investments
    .filter(inv => { const q=search.toLowerCase(); return (filterMarket==='all'||inv.market===filterMarket)&&(!q||inv.name.toLowerCase().includes(q)||inv.ticker.toLowerCase().includes(q)) })
    .sort((a,b) => {
      if (sortBy==='name') return a.name.localeCompare(b.name,'ko')
      if (sortBy==='invested') return toKrwTotal(b)-toKrwTotal(a)
      return (getReturn(b)??-Infinity)-(getReturn(a)??-Infinity)
    })

  // ── 섹션별 그룹화 + 정렬 ──────────────────────────────────────────────────

  /** 평가금액(원화) */
  const evalKrw = (inv: Investment) => {
    const lv = getLive(inv)
    const price = lv ? lv.currentPrice : inv.purchase_price
    return price * inv.quantity * (inv.currency === 'USD' ? USD_KRW : 1)
  }

  /** 섹션 정렬 함수 */
  const sortSection = (list: Investment[], opt: SortOption) => [...list].sort((a, b) => {
    if (opt === 'name')   return a.name.localeCompare(b.name, 'ko')
    if (opt === 'return') return (getReturn(b) ?? -Infinity) - (getReturn(a) ?? -Infinity)
    return evalKrw(b) - evalKrw(a)   // 'eval' 기본
  })

  /** 섹션 요약: 총 평가금액(원) + 평균 수익률 */
  const sectionSummary = (list: Investment[]) => {
    const totalEval = list.reduce((s, i) => s + evalKrw(i), 0)
    const rets = list.map(i => getReturn(i)).filter((r): r is number => r !== null)
    const avgRet = rets.length ? rets.reduce((s, r) => s + r, 0) / rets.length : null
    return { totalEval, avgRet }
  }

  const groupUS     = sortSection(filtered.filter(i => i.market === 'US'),     sortUS)
  const groupKR     = sortSection(filtered.filter(i => i.market === 'KR'),     sortKR)
  const groupCRYPTO = sortSection(filtered.filter(i => i.market === 'CRYPTO'), sortCRYPTO)

  const summaryUS     = sectionSummary(groupUS)
  const summaryKR     = sectionSummary(groupKR)
  const summaryCRYPTO = sectionSummary(groupCRYPTO)

  const fmtEval = (n: number) =>
    n >= 1e8 ? `₩${(n/1e8).toFixed(1)}억`
    : n >= 1e4 ? `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`
    : `₩${Math.round(n).toLocaleString('ko-KR')}`

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sortLabel: Record<SortOption, string> = {
    eval:   '평가금액 ↓',
    return: '수익률 ↓',
    name:   '종목명 순',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}input::placeholder{color:#7a8fa3}select option{background:#1f2937}`}</style>

      {/* 요약 스트립 */}
      {!dbLoading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
          {[
            { label:'보유 종목',   value:`${investments.length}개`,                                                                                               accent:'#f1f5f9' },
            { label:'총 투자금액', value:fmtKrwVal(totalCostKrw), sub:hasUsd?'USD 환산 포함':undefined,                                                           accent:'#a8b5c2' },
            { label:'수익 종목',   value:`${investments.filter(i=>getLive(i)&&getLive(i)!.currentPrice>i.purchase_price).length}개`,                               accent:'#ef4444' },
            { label:'손실 종목',   value:`${investments.filter(i=>getLive(i)&&getLive(i)!.currentPrice<i.purchase_price).length}개`,                               accent:'#3b82f6' },
          ].map(({label,value,sub,accent})=>(
            <div key={label} style={{ background:N, boxShadow:SHO, borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:9, fontWeight:600, color:'#8a96a8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:accent, fontVariantNumeric:'tabular-nums' }}>{value}</div>
              {sub&&<div style={{ fontSize:9, color:'#7a8fa3', marginTop:2 }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 컨트롤 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <div style={{ position:'relative', flexGrow:1, minWidth:150, maxWidth:260 }}>
          <svg style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'#8a96a8',pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="종목명 / 티커" style={{ width:'100%',padding:'7px 10px 7px 26px',background:N,boxShadow:SHI,border:'none',borderRadius:8,color:'#f1f5f9',fontSize:12,outline:'none',boxSizing:'border-box' }} onFocus={e=>{e.currentTarget.style.boxShadow=`${SHI}, 0 0 0 1px #2563eb`}} onBlur={e=>{e.currentTarget.style.boxShadow=SHI}}/>
        </div>
        {(['all','US','KR','CRYPTO'] as const).map(m=>(
          <button key={m} onClick={()=>setFilterMarket(m)} style={{ padding:'6px 11px',borderRadius:99,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',transition:'all 0.12s', background:filterMarket===m?(m==='all'?'rgba(255,255,255,0.06)':`${({US:'#34d399',KR:'#60a5fa',CRYPTO:'#fb923c'} as Record<string,string>)[m]}18`):N, color:filterMarket===m?(m==='all'?'#f1f5f9':({US:'#34d399',KR:'#60a5fa',CRYPTO:'#fb923c'} as Record<string,string>)[m]):'#8a96a8', boxShadow:filterMarket===m?SHI:SHO }}>
            {m==='all'?'전체':m}
          </button>
        ))}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)} style={{ padding:'7px 9px',background:N,boxShadow:SHI,border:'none',borderRadius:8,color:'#8a96a8',fontSize:11,outline:'none',cursor:'pointer' }}>
          <option value="return">수익률순</option>
          <option value="name">이름순</option>
          <option value="invested">투자금액순</option>
        </select>
        <button onClick={()=>fetchPrices(investments)} disabled={priceStatus==='loading'||!investments.length} style={{ padding:'7px 10px',background:N,boxShadow:SHO,border:'none',borderRadius:8,color:'#8a96a8',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:11,opacity:priceStatus==='loading'?0.5:1,transition:'color 0.15s,box-shadow 0.15s' }} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#f1f5f9';(e.currentTarget as HTMLButtonElement).style.boxShadow='9px 9px 22px #0e1020, -5px -5px 15px #282c44'}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#8a96a8';(e.currentTarget as HTMLButtonElement).style.boxShadow=SHO}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:priceStatus==='loading'?'spin 0.8s linear infinite':'none' }}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
          현재가
        </button>
        <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:5,padding:'8px 14px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 0 20px rgba(37,99,235,0.3)',flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          종목 추가
        </button>
      </div>

      {/* 종목 행 목록 */}
      {dbLoading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ height:220, background:N, boxShadow:SHO, borderRadius:14, animation:'pulse 1.5s infinite' }}/>
          ))}
        </div>
      ) : investments.length === 0 ? (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 0',gap:14 }}>
          <div style={{ fontSize:36 }}>💼</div>
          <div style={{ fontWeight:700,fontSize:16,color:'#8a9aaa' }}>포트폴리오가 비어있습니다</div>
          <div style={{ fontSize:13,color:'#7a8fa3' }}>첫 번째 종목을 추가해 투자 현황을 추적하세요</div>
          <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ padding:'10px 24px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer' }}>+ 종목 추가하기</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:'48px 0',color:'#7a8fa3',fontSize:13 }}>검색 결과가 없습니다</div>
      ) : (
        /* ── 섹션별 그룹 렌더 ── */
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* ─── 섹션 헬퍼 컴포넌트 (인라인 렌더 함수) ─── */}
          {(
            [
              { key:'US',     flag:'🇺🇸', label:'미국 주식',  group: groupUS,     summary: summaryUS,     sort: sortUS,     setSort: setSortUS     },
              { key:'KR',     flag:'🇰🇷', label:'한국 주식',  group: groupKR,     summary: summaryKR,     sort: sortKR,     setSort: setSortKR     },
              { key:'CRYPTO', flag:'🪙',  label:'암호화폐',   group: groupCRYPTO, summary: summaryCRYPTO, sort: sortCRYPTO, setSort: setSortCRYPTO },
            ] as Array<{
              key: string; flag: string; label: string;
              group: Investment[];
              summary: { totalEval: number; avgRet: number | null };
              sort: SortOption; setSort: (s: SortOption) => void;
            }>
          ).map(({ key, flag, label, group, summary, sort, setSort }) =>
            group.length === 0 ? null : (
              <div key={key}>
                {/* 섹션 헤더 */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                  {/* 타이틀 */}
                  <span style={{ fontSize:14, fontWeight:800, color:'#dde4f0' }}>{flag} {label}</span>
                  <span style={{ fontSize:11, color:'#9aa0b8' }}>({group.length}종목)</span>

                  {/* 요약 배지 */}
                  <span style={{ padding:'2px 10px', borderRadius:99, background:'#0a0e1a', boxShadow:SHI, fontSize:11, fontWeight:600, color:'#c084fc' }}>
                    {fmtEval(summary.totalEval)}
                  </span>
                  {summary.avgRet !== null && (
                    <span style={{
                      padding:'2px 10px', borderRadius:99, background:'#0a0e1a', boxShadow:SHI,
                      fontSize:11, fontWeight:700,
                      color: summary.avgRet >= 0 ? '#f87171' : '#60a5fa',
                    }}>
                      {summary.avgRet >= 0 ? '+' : ''}{summary.avgRet.toFixed(2)}%
                    </span>
                  )}

                  {/* 정렬 드롭다운 */}
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortOption)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginLeft:'auto', padding:'4px 9px', background:N, boxShadow:SHI, border:'none', borderRadius:8, color:'#a8b5c2', fontSize:11, outline:'none', cursor:'pointer' }}
                  >
                    <option value="eval">평가금액 높은 순</option>
                    <option value="return">수익률 높은 순</option>
                    <option value="name">종목명 순</option>
                  </select>
                </div>

                {/* 해당 섹션 종목 카드 목록 */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {group.map(inv => {
            const livePrice = getLive(inv)
            const isETF  = ETF_BRANDS.some(k => inv.name.toUpperCase().includes(k))
            const isNA   = inv.market === 'CRYPTO' || isETF
            const lynchMeta = inv.lynch_category && !isNA && inv.lynch_category !== 'na'
              ? LYNCH_META[inv.lynch_category] ?? null : null
            const isUp  = (livePrice?.changePct ?? 0) >= 0
            const C     = isUp ? '#ef4444' : '#3b82f6'
            const Cs    = isUp ? '#f87171' : '#60a5fa'
            const ret   = livePrice ? ((livePrice.currentPrice - inv.purchase_price) / inv.purchase_price) * 100 : 0
            const ohlc  = (priceMap[inv.ticker.toUpperCase()]?.ohlcCharts ?? {} as Record<TimeFrame, Candle[]>)[getTf(inv.ticker)] ?? []
            const prevClose = livePrice ? livePrice.currentPrice - livePrice.change : undefined

            return (
              <div
                key={inv.id}
                onClick={() => openEditModal(inv)}
                style={{
                  background: N, boxShadow: SHO,
                  borderRadius: 14, overflow: 'hidden',
                  borderLeft: `3px solid ${C}`,
                  display: 'flex', alignItems: 'stretch',
                  marginBottom: 0, cursor: 'pointer',
                }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLDivElement; el.style.boxShadow='9px 9px 22px #0e1020, -5px -5px 15px #282c44, 0 0 0 1px #6366f130' }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLDivElement; el.style.boxShadow=SHO }}
              >
                {/* ── Section 1: 종목 정보 (220px) ── */}
                <div style={{ width:220, flexShrink:0, padding:'14px 16px', display:'flex', flexDirection:'column', gap:5 }}>
                  {/* Name + market */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#dde4f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.name}</div>
                      <div style={{ fontSize:9, color:'#9aa0b8', fontFamily:'monospace', marginTop:1 }}>{inv.ticker}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0, marginLeft:4 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:MARKET_COLOR[inv.market], border:`1px solid ${MARKET_COLOR[inv.market]}44`, borderRadius:4, padding:'1px 5px' }}>{inv.market}</span>
                      {/* ★ 자산 포지션 배지 + 변경 버튼 */}
                      <button
                        onClick={e => { e.stopPropagation(); setRoleModal(inv) }}
                        title="자산 포지션 변경"
                        style={{
                          display:'flex', alignItems:'center', gap:3, padding:'1px 6px',
                          borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:700,
                          background: inv.asset_role === 'CORE' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                          color:      inv.asset_role === 'CORE' ? '#34d399' : '#fbbf24',
                        }}
                      >
                        {inv.asset_role === 'CORE' ? '🏛 CORE' : '🛰 SATELLITE'}
                        <span style={{ opacity:0.6 }}>✎</span>
                      </button>
                    </div>
                  </div>

                  {/* Lynch badge */}
                  {!isNA && lynchMeta && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:500, color:lynchMeta.color, background:`${lynchMeta.color}15`, border:`1px solid ${lynchMeta.color}35`, alignSelf:'flex-start' }}>
                      {lynchMeta.label}
                    </span>
                  )}
                  {!isNA && !inv.lynch_category && !classifyDone.has(inv.id) && (
                    <span style={{ fontSize:9, color:'#7a8fa3', alignSelf:'flex-start' }}>분류 중…</span>
                  )}
                  {isNA && <span style={{ fontSize:9, color:'#8a96a8', background:'#1f2937', padding:'2px 7px', borderRadius:4, border:'1px solid #7a8fa3', alignSelf:'flex-start' }}>N/A</span>}

                  {/* Current price + change */}
                  {livePrice && (
                    <div style={{ marginTop:2 }}>
                      <div style={{ fontSize:17, fontWeight:800, color:'#dde4f0', fontVariantNumeric:'tabular-nums', letterSpacing:'-0.3px' }}>
                        {inv.currency==='KRW' ? `₩${Math.round(livePrice.currentPrice).toLocaleString('ko-KR')}` : `$${livePrice.currentPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:Cs }}>
                        {isUp ? '▲' : '▼'} {Math.abs(livePrice.changePct).toFixed(2)}%
                        <span style={{ color:'#9aa0b8', marginLeft:5, fontWeight:400 }}>
                          {livePrice.change >= 0 ? '+' : ''}{inv.currency==='KRW' ? `₩${Math.round(livePrice.change).toLocaleString('ko-KR')}` : `$${livePrice.change.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dividend row */}
                  {(() => {
                    const dy    = livePrice?.dividendYield ?? 0
                    const annDiv = livePrice?.annualDividend ?? null
                    const curPrice = livePrice?.currentPrice ?? inv.purchase_price
                    const exRate   = inv.currency === 'USD' ? 1_350 : 1
                    // 연간 총 배당금 (원화)
                    const annualTotal = annDiv && annDiv > 0
                      ? annDiv * inv.quantity * (inv.currency === 'USD' ? 1_350 : 1)
                      : dy > 0
                        ? curPrice * inv.quantity * exRate * dy
                        : 0
                    const monthlyTotal = annualTotal / 12
                    const hasDividend  = dy > 0 || (annDiv ?? 0) > 0

                    const fmtSmall = (n:number) =>
                      n >= 1e8 ? `₩${(n/1e8).toFixed(1)}억`
                      : n >= 1e4 ? `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`
                      : `₩${Math.round(n).toLocaleString('ko-KR')}`

                    return (
                      <div style={{ background:'#0a0e1a', boxShadow:SHI, borderRadius:7, padding:'6px 9px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom: hasDividend ? 4 : 0 }}>
                          <span style={{ fontSize:10 }}>💰</span>
                          {hasDividend ? (
                            <span style={{ fontSize:11, fontWeight:800, color:'#34d399' }}>
                              {(dy * 100).toFixed(2)}%
                            </span>
                          ) : (
                            <span style={{ fontSize:9, color:'#7a8599' }}>배당 없음</span>
                          )}
                          {/* 주당 배당금 서브텍스트 */}
                          {annDiv && annDiv > 0 && (
                            <span style={{ fontSize:8, color:'#4b5568', marginLeft:2 }}>
                              {inv.currency === 'USD' ? `$${annDiv.toFixed(2)}/주` : `₩${Math.round(annDiv).toLocaleString('ko-KR')}/주`}
                            </span>
                          )}
                        </div>
                        {/* 예상 총 배당금 (연/월) */}
                        {hasDividend && annualTotal > 0 && (
                          <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                            <span style={{ fontSize:11, fontWeight:800, color:'#dde4f0', fontVariantNumeric:'tabular-nums' }}>
                              {fmtSmall(annualTotal)}
                            </span>
                            <span style={{ fontSize:8, color:'#9aa0b8' }}>연</span>
                            <span style={{ fontSize:9, color:'#34d399', fontVariantNumeric:'tabular-nums' }}>
                              {fmtSmall(monthlyTotal)}
                            </span>
                            <span style={{ fontSize:8, color:'#9aa0b8' }}>월</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Buy/Sell buttons */}
                  <div style={{ display:'flex', gap:6, marginTop:2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); openBuyModal(inv) }}
                      style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer',
                        background:'linear-gradient(135deg,#7f1d1d,#dc2626)', color:'#fff', fontSize:10, fontWeight:700 }}>
                      + 추가매수
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openSellModal(inv) }}
                      style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer',
                        background:'linear-gradient(135deg,#1e3a8a,#3b82f6)', color:'#fff', fontSize:10, fontWeight:700 }}>
                      - 추가매도
                    </button>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div style={{ width:1, background:'#1e2140', flexShrink:0, margin:'10px 0' }}/>

                {/* ── Section 2: 포트폴리오 + 재무 (280px) ── */}
                <div style={{ width:280, flexShrink:0, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Portfolio performance */}
                  <div>
                    <div style={{ fontSize:8, fontWeight:800, color:'#7a8599', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>포트폴리오</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:8 }}>
                      {[
                        { label:'현재가',  val: livePrice ? (inv.currency==='KRW' ? `₩${Math.round(livePrice.currentPrice).toLocaleString('ko-KR')}` : `$${livePrice.currentPrice.toFixed(2)}`) : '—', color:'#dde4f0' },
                        { label:'매수가',  val: inv.currency==='KRW' ? `₩${Math.round(inv.purchase_price).toLocaleString('ko-KR')}` : `$${inv.purchase_price.toFixed(2)}`, color:'#a8b5c2' },
                        /* ★ 매수수량 — 자산관리 카드 중앙 영역에 추가 */
                        { label:'매수수량', val: `${inv.quantity.toLocaleString('ko-KR')}주`, color:'#60a5fa' },
                        { label:'보유금액', val: livePrice ? (inv.currency==='KRW' ? fmtKrwVal(livePrice.currentPrice*inv.quantity) : `$${(livePrice.currentPrice*inv.quantity).toFixed(0)}`) : fmtKrwVal(inv.purchase_price*inv.quantity*(inv.currency==='USD'?USD_KRW:1)), color:'#c084fc' },
                        { label:'평가손익', val: livePrice ? (inv.currency==='KRW' ? ((livePrice.currentPrice-inv.purchase_price)*inv.quantity>=0?'+':'')+`₩${Math.round((livePrice.currentPrice-inv.purchase_price)*inv.quantity).toLocaleString('ko-KR')}` : ((livePrice.currentPrice-inv.purchase_price)*inv.quantity>=0?'+':'')+'$'+(Math.abs((livePrice.currentPrice-inv.purchase_price)*inv.quantity)).toFixed(2)) : '—', color: livePrice && livePrice.currentPrice >= inv.purchase_price ? '#f87171' : '#60a5fa' },
                        { label:'수익률',  val: livePrice ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '—', color: ret >= 0 ? '#f87171' : '#60a5fa' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ background:'#0a0e1a', boxShadow:SHI, borderRadius:7, padding:'6px 9px' }}>
                          <div style={{ fontSize:8, color:'#7a8599', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:11, fontWeight:700, color, fontVariantNumeric:'tabular-nums' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial metrics */}
                  <div>
                    <div style={{ fontSize:8, fontWeight:800, color:'#7a8599', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>핵심 지표</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                      {[
                        { label:'PER',      val: livePrice?.per        != null ? livePrice.per.toFixed(1)                                                                        : '—' },
                        { label:'PEG',      val: livePrice?.peg        != null ? livePrice.peg.toFixed(2)                                                                        : '—' },
                        { label:'EPS',      val: livePrice?.eps        != null ? (inv.currency==='KRW' ? `₩${Math.round(livePrice.eps).toLocaleString('ko-KR')}` : `$${livePrice.eps.toFixed(2)}`) : '—' },
                        { label:'EPS 성장', val: livePrice?.epsGrowth  != null ? `${livePrice.epsGrowth > 0 ? '+' : ''}${livePrice.epsGrowth.toFixed(1)}%`                        : '—' },
                        { label:'Fwd EPS',  val: livePrice?.forwardEps != null ? (inv.currency==='KRW' ? `₩${Math.round(livePrice.forwardEps).toLocaleString('ko-KR')}` : `$${livePrice.forwardEps.toFixed(2)}`) : '—' },
                        { label:'PBR',      val: livePrice?.pbr        != null ? livePrice.pbr.toFixed(2)                                                                        : '—' },
                        { label:'배당수익률', val: (livePrice?.dividendYield ?? 0) > 0 ? `${((livePrice!.dividendYield ?? 0)*100).toFixed(2)}%` : '—' },
                        {
                          label:'월 배당(예상)',
                          val: (() => {
                            const annDiv = livePrice?.annualDividend ?? null
                            const dy     = livePrice?.dividendYield ?? 0
                            const price  = livePrice?.currentPrice ?? inv.purchase_price
                            const exRate = inv.currency === 'USD' ? 1_350 : 1
                            const monthly = annDiv && annDiv > 0
                              ? annDiv * inv.quantity * exRate / 12
                              : dy > 0 ? price * inv.quantity * exRate * dy / 12 : 0
                            if (monthly <= 0) return '—'
                            const v = Math.round(monthly)
                            return v >= 10000 ? `₩${(v/10000).toFixed(1)}만` : `₩${v.toLocaleString('ko-KR')}`
                          })(),
                        },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background:'#0a0e1a', boxShadow:SHI, borderRadius:7, padding:'5px 8px' }}>
                          <div style={{ fontSize:7, color:'#7a8599', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#a8b5c2', fontVariantNumeric:'tabular-nums', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div style={{ width:1, background:'#1e2140', flexShrink:0, margin:'10px 0' }}/>

                {/* ── Section 3: 캔들차트 (flex:1) ── */}
                <div style={{ flex:1, minWidth:0, padding:'10px 12px 8px', display:'flex', flexDirection:'column' }}>
                  {/* Timeframe tabs */}
                  <div style={{ display:'flex', gap:5, marginBottom:6 }}>
                    {(FRAMES).map(t => (
                      <button key={t} onClick={e => { e.stopPropagation(); setTf(inv.ticker, t) }}
                        style={{
                          padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer',
                          fontSize:11, fontWeight:700, transition:'all 0.15s',
                          background: getTf(inv.ticker) === t ? '#fbbf24' : N,
                          boxShadow:  getTf(inv.ticker) === t ? '0 2px 8px rgba(251,191,36,0.3)' : SHI,
                          color:      getTf(inv.ticker) === t ? '#1b1e2e' : '#9aa0b8',
                        }}>{t}</button>
                    ))}
                    <span style={{ marginLeft:'auto', fontSize:9, color:'#7a8599', alignSelf:'center' }}>
                      {ohlc.length > 0 ? `${ohlc.length}캔들` : ''}
                    </span>
                  </div>

                  {/* Chart */}
                  <div style={{ flex:1 }}>
                    {ohlc.length > 1 ? (
                      <FullCandleChart
                        key={`${inv.ticker}-${getTf(inv.ticker)}`}
                        data={ohlc}
                        currency={inv.currency}
                        timeframe={getTf(inv.ticker)}
                        prevClose={prevClose}
                        height={220}
                        avgPrice={
                          // 1순위: Supabase DB 실제 매수 평단가 (포트폴리오 등록가 — 항상 정확)
                          inv.purchase_price > 0 ? inv.purchase_price
                          // 2순위: 텐배거 트래커 localStorage (포트폴리오 미등록 종목용)
                          : (tenbaggerPrices[inv.ticker.toUpperCase()] ?? tenbaggerPrices[inv.ticker])
                        }
                      />
                    ) : (
                      <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#7a8599', fontSize:11 }}>
                        {priceStatus === 'loading' ? '로딩 중…' : `${getTf(inv.ticker)} 차트 없음`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  )}
</div>
      )}

      {modalOpen && (
        <AddInvestmentModal
          initial={editTarget??undefined}
          onClose={()=>{setModalOpen(false);setEditTarget(null)}}
          onRefresh={handleRefresh}
          onAdded={(inv) => {
            // ★ 전역 동기화 이벤트 발송
            window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'add' } }))
            handleAdded({ ...inv, asset_role: (inv.asset_role as AssetRole | undefined) ?? 'CORE' })
          }}
          onChanged={() => {
            window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'edit' } }))
            handleRefresh()
          }}
        />
      )}

      {txModalOpen && txTarget && (
        <TransactionModal
          investment={txTarget}
          initialMode={txMode}
          currentPrice={priceMap[txTarget.ticker.toUpperCase()]?.currentPrice}
          onClose={() => setTxModalOpen(false)}
          onSuccess={() => {
            setTxModalOpen(false)
            // ★ 전역 동기화 이벤트 — 대시보드·투자기록 탭이 즉시 리렌더링되도록
            window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: { source: 'transaction' } }))
            fetchInvestments()
          }}
        />
      )}

      {/* ★ 자산 포지션 분류 변경 모달 */}
      {roleModal && (
        <AssetRoleModal
          investment={roleModal}
          onClose={() => setRoleModal(null)}
          onConfirm={(newRole) => handleRoleChange(roleModal, newRole)}
          loading={roleChanging}
        />
      )}
    </div>
  )
}

// ── 자산 포지션 분류 변경 모달 컴포넌트 ─────────────────────────────────────
function AssetRoleModal({
  investment, onClose, onConfirm, loading,
}: {
  investment: { name: string; ticker: string; asset_role: AssetRole }
  onClose: () => void
  onConfirm: (role: AssetRole) => void
  loading: boolean
}) {
  const [selected, setSelected] = useState<AssetRole>(investment.asset_role)
  const N   = '#1b1e2e'
  const SHO = '7px 7px 18px #0e1020, -4px -4px 12px #282c44'
  const SHI = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44'

  return (
    <>
      <style>{`@keyframes roleSlideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background:N, boxShadow:'0 0 0 1px #282c44, 12px 12px 32px #0a0c18',
            borderRadius:18, maxWidth:400, width:'calc(100% - 32px)', padding:'28px 24px 22px',
            animation:'roleSlideUp 0.2s ease-out', color:'#dde4f0' }}
        >
          {/* 타이틀 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>🏷 자산 포지션 변경</h3>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'#9aa0b8', fontSize:20, cursor:'pointer' }}>×</button>
          </div>

          {/* 종목 정보 */}
          <div style={{ background:'#0a0e1a', boxShadow:SHI, borderRadius:10, padding:'9px 13px', marginBottom:20, fontSize:13, color:'#8b92b8' }}>
            <strong style={{ color:'#dde4f0' }}>{investment.name}</strong>
            <span style={{ marginLeft:8, fontFamily:'monospace', fontSize:11 }}>{investment.ticker}</span>
          </div>

          {/* 포지션 선택 */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:22 }}>
            {([
              { role: 'CORE'      as AssetRole, icon:'🏛', label:'코어 자산 (Core)',      desc:'장기 보유 기반 자산 — ETF, 우량주, 인덱스' },
              { role: 'SATELLITE' as AssetRole, icon:'🛰', label:'새틀라이트 자산 (Satellite)', desc:'초과 수익 추구 위성 자산 — 테마주, 성장주, 개별종목' },
            ]).map(({ role, icon, label, desc }) => (
              <button
                key={role}
                onClick={() => setSelected(role)}
                style={{
                  display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
                  borderRadius:11, border:'none', cursor:'pointer', textAlign:'left',
                  background: selected === role ? '#0a0e1a' : 'transparent',
                  boxShadow:  selected === role ? SHO : SHI,
                  borderLeft: `3px solid ${selected === role
                    ? (role === 'CORE' ? '#34d399' : '#fbbf24')
                    : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color: selected === role ? '#dde4f0' : '#8a9aaa', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:11, color:'#9aa0b8', lineHeight:1.5 }}>{desc}</div>
                </div>
                <div style={{ marginLeft:'auto', flexShrink:0, paddingTop:2 }}>
                  <div style={{
                    width:16, height:16, borderRadius:'50%',
                    border: `2px solid ${selected === role ? (role === 'CORE' ? '#34d399' : '#fbbf24') : '#7a8fa3'}`,
                    background: selected === role ? (role === 'CORE' ? '#34d399' : '#fbbf24') : 'transparent',
                    transition:'all 0.15s',
                  }}/>
                </div>
              </button>
            ))}
          </div>

          {/* 버튼 */}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} disabled={loading}
              style={{ flex:1, padding:'11px 0', borderRadius:9, border:'none', cursor:'pointer',
                background:'#0a0e1a', boxShadow:SHI, color:'#9aa0b8', fontWeight:600, fontSize:14 }}>
              취소
            </button>
            <button onClick={() => onConfirm(selected)} disabled={loading || selected === investment.asset_role}
              style={{ flex:2, padding:'11px 0', borderRadius:9, border:'none',
                cursor:(loading || selected === investment.asset_role) ? 'not-allowed' : 'pointer',
                background: selected === 'CORE'
                  ? 'linear-gradient(135deg,#065f46,#34d399)'
                  : 'linear-gradient(135deg,#78350f,#fbbf24)',
                color:'#fff', fontWeight:700, fontSize:14,
                opacity:(loading || selected === investment.asset_role) ? 0.5 : 1,
              }}>
              {loading ? '저장 중…' : '변경 완료'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
