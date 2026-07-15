'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import BuffettAnalysisPanel from '@/app/components/BuffettAnalysisPanel'
// SSOT: 자산 유형 분류 (STOCK / ETF / CRYPTO / COMMODITY)
import { getAssetType } from '@/lib/assetClassifier'
import { TK } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market   = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower'|'stalwart'|'fast_grower'|'cyclical'|'turnaround'|'asset_play'|'na'

interface Investment {
  id: string; ticker: string; name: string
  market: Market; currency: 'USD'|'KRW'
  purchase_price: number; quantity: number
  purchase_date: string; lynch_category: LynchKey|null
}

interface LivePrice { currentPrice: number }

interface Fundamentals {
  pe:             number | 'N/A' | null
  peg:            number | 'N/A' | null
  earningsGrowth: number | null
  sector:         string | null
  isEtf:          boolean
  // DCF 자동 분석용 (워렌 버핏 패널)
  marketCap?:         number | null
  freeCashflow?:      number | null
  sharesOutstanding?: number | null
  totalDebt?:         number | null
  totalCash?:         number | null
  returnOnEquity?:    number | null
  grossMargins?:      number | null
}

const USD_KRW = 1_350

const LYNCH_META: Record<string,{ label:string; color:string; moat:string; buffett:number }> = {
  slow_grower: { label:'저성장주', color:TK.sub9, moat:'배당형 해자',   buffett:65 },
  stalwart:    { label:'대형 우량주',   color:TK.blue400, moat:'브랜드 해자',   buffett:82 },
  fast_grower: { label:'빠른 성장주',   color:TK.emerald400, moat:'성장 해자',     buffett:70 },
  cyclical:    { label:'경기 순환주',   color:TK.orange400, moat:'해자 약함',     buffett:40 },
  turnaround:  { label:'회생 기업주',   color:TK.red400, moat:'회복 중',       buffett:35 },
  asset_play:  { label:'자산 보유주',   color:TK.purple400, moat:'자산 해자',     buffett:75 },
  na:          { label:'N/A',           color:TK.sub7, moat:'해당 없음',     buffett:0  },
}

const fmtKrw = (n: number) =>
  n >= 1e8 ? `₩${(n/1e8).toLocaleString('ko-KR', { minimumFractionDigits:1, maximumFractionDigits:1 })}억`
  : n >= 1e4 ? `₩${Math.round(n/1e4).toLocaleString('ko-KR')}만`
  : `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n>=0?'+':''}${n.toFixed(1)}%`

// ─── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, color, icon, label, sub }: {
  active: boolean; onClick: ()=>void; color: string; icon: string; label: string; sub: string
}) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'16px 20px', borderRadius:12, border:'none',
      background: active ? `${color}18` : 'transparent',
      boxShadow: active ? `7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}` : `inset 4px 4px 10px ${TK.bg2}, inset -3px -3px 8px ${TK.line2}`,
      cursor:'pointer', transition:'all 0.2s', textAlign:'left' as const,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{icon}</div>
        <span style={{ fontSize:15, fontWeight:700, color: active ? color : TK.sub9 }}>{label}</span>
      </div>
      <p style={{ fontSize:12, color:TK.sub7, margin:0, lineHeight:1.5 }}>{sub}</p>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function AnalysisContent() {
  const router     = useRouter()
  const searchParams = useSearchParams()
  // URL ?tab= 을 단일 진실 소스로 사용 — 사이드바·탭 버튼 모두 동기화됨
  const tab = (searchParams.get('tab') as 'lynch' | 'buffett') ?? 'lynch'
  const setTab = (t: 'lynch' | 'buffett') => {
    router.push(`/analysis?tab=${t}`, { scroll: false })
  }
  const [investments,  setInvestments]  = useState<Investment[]>([])
  const [priceMap,     setPriceMap]     = useState<Record<string,LivePrice>>({})
  const [fundMap,      setFundMap]      = useState<Record<string,Fundamentals>>({})
  const [fundLoading,  setFundLoading]  = useState(false)
  const [loading,      setLoading]      = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data:{ session } } = await sb.auth.getSession()
      const uid = session?.user?.id ?? (await sb.auth.getUser()).data.user?.id
      if (!uid) { router.push('/login'); return }
      const { data } = await sb.from('investments')
        .select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,lynch_category')
        .eq('user_id', uid)
      const invs = data ?? []
      setInvestments(invs)
      if (invs.length) {
        // 현재가 조회
        const res = await fetch('/api/stock-price',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(invs.map(i=>({ticker:i.ticker,market:i.market}))) })
        if (res.ok) {
          const results: ({ticker:string}&LivePrice)[] = await res.json()
          const m: Record<string,LivePrice> = {}; results.forEach(r=>{ m[r.ticker.toUpperCase()]=r })
          setPriceMap(m)
        }
        // 재무 데이터 조회 (stock-info: PE, PEG, EPS성장률)
        setFundLoading(true)
        const fundMap: Record<string,Fundamentals> = {}
        await Promise.allSettled(
          invs.map(async inv => {
            try {
              const r = await fetch(`/api/stock-info?ticker=${encodeURIComponent(inv.ticker)}&market=${inv.market}`)
              if (!r.ok) return
              const d = await r.json()
              fundMap[inv.ticker.toUpperCase()] = {
                pe:             d.fundamentals?.pe ?? null,
                peg:            d.fundamentals?.peg ?? null,
                earningsGrowth: d.fundamentals?.earningsGrowth ?? null,
                sector:         d.fundamentals?.sector ?? null,
                isEtf:          d.fundamentals?.isEtf ?? false,
                // DCF 자동 분석 데이터
                marketCap:         d.fundamentals?.marketCap ?? null,
                freeCashflow:      d.fundamentals?.freeCashflow ?? null,
                sharesOutstanding: d.fundamentals?.sharesOutstanding ?? null,
                totalDebt:         d.fundamentals?.totalDebt ?? null,
                totalCash:         d.fundamentals?.totalCash ?? null,
                returnOnEquity:    d.fundamentals?.returnOnEquity ?? null,
                grossMargins:      d.fundamentals?.grossMargins ?? null,
              }
            } catch { /* 실패 무시 */ }
          })
        )
        setFundMap(fundMap)
        setFundLoading(false)
      }
    } finally { setLoading(false) }
  }, [router])

  useEffect(()=>{ fetchData() },[fetchData])

  const live = (inv: Investment) => priceMap[inv.ticker.toUpperCase()] ?? null
  const toKrw = (inv: Investment, price?: number) => (price??inv.purchase_price)*inv.quantity*(inv.currency==='USD'?USD_KRW:1)
  const getRet = (inv: Investment) => { const lv=live(inv); return lv ? ((lv.currentPrice-inv.purchase_price)/inv.purchase_price)*100 : null }

  // ── 피터린치 데이터 ─────────────────────────────────────────────
  const lynchGroups = useMemo(()=>{
    const totalKrw = investments.reduce((s,i)=>s+toKrw(i),0) || 1
    const counts: Record<string,{invs:Investment[];invested:number}> = {}
    investments.forEach(i=>{
      const k=i.lynch_category??'na'; if(!counts[k]) counts[k]={invs:[],invested:0}
      counts[k].invs.push(i); counts[k].invested+=toKrw(i)
    })
    return Object.entries(counts).map(([k,{invs,invested}])=>({
      key:k, ...LYNCH_META[k], count:invs.length, invested,
      pct:((invested/totalKrw)*100).toFixed(1), tickers:invs.map(i=>i.name||i.ticker).join(', ')
    })).sort((a,b)=>b.invested-a.invested)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[investments])

  const lynchPieData = lynchGroups.map(g=>({ name:g.label, value:g.count, color:g.color }))

  // ── ETF 판별 함수 (pegAnalysis 보다 먼저 선언 필수) ──────────────
  // ⚠️ 정확한 ETF 브랜드명만(바 'KB'는 KB금융·KB손해보험 은행을, 'NH'는 NH투자증권을, '파워'는 파워로직스를,
  //    'MASTER'는 Mastercard를 ETF로 오분류함) → KBSTAR·HANARO 등 풀 브랜드명 + KR 시장 한정으로 오매칭 차단.
  //    1차 방어는 getAssetType(SSOT)이고, 이건 SSOT가 놓친 KR ETF만 잡는 보조 휴리스틱.
  const ETF_BRANDS_LIST = [
    'TIGER','KODEX','ACE','PLUS','KBSTAR','HANARO','ARIRANG','RISE','SOL','WON',
    '1Q','SMART','히어로즈','KOSEF','TIMEFOLIO','마이티',
  ]
  const isEtf = (inv: Investment) =>
    (inv.market === 'KR' && ETF_BRANDS_LIST.some(b => inv.name.toUpperCase().includes(b))) ||
    (fundMap[inv.ticker.toUpperCase()]?.isEtf === true)

  // ── PEG 분석 데이터 ─────────────────────────────────────────────
  const totalKrw = investments.reduce((s,i)=>toKrw(i)+s,0) || 1

  const pegAnalysis = useMemo(()=>{
    return investments
      .filter(inv => inv.market !== 'CRYPTO')  // 크립토 제외
      .map(inv => {
        const fund = fundMap[inv.ticker.toUpperCase()]
        const cat  = inv.lynch_category ?? 'na'
        const weight = ((toKrw(inv) / totalKrw) * 100)

        // PEG 값 결정
        let pegVal: number | null = null
        if (fund?.peg && typeof fund.peg === 'number' && fund.peg > 0) {
          pegVal = fund.peg
        }

        // EPS 성장률 (소수 → %)
        const epsGrowth = fund?.earningsGrowth
          ? fund.earningsGrowth * 100
          : null

        // PE
        const pe = fund?.pe && typeof fund.pe === 'number' ? fund.pe : null

        // PEG 구간 판정
        const pegZone =
          pegVal === null     ? 'unknown' :
          pegVal <= 1         ? 'undervalued' :
          pegVal <= 2         ? 'fair'         : 'overvalued'

        // 피터린치식 판단
        const lynchJudge = (() => {
          // ETF는 인덱스 펀드로, 일반 주식 'na'는 분류 미지정으로 별도 처리
          if (isEtf(inv)) return { label:'인덱스 펀드', color:TK.sub, icon:'📊' }
          if (cat === 'na') return { label:'분류 미지정', color:TK.sub7, icon:'❓' }
          if (cat === 'cyclical')   return { label:'경기 사이클 주의', color:TK.orange400, icon:'🔄' }
          if (cat === 'turnaround') return { label:'회생 여부 모니터링', color:TK.red400, icon:'⚠️' }
          if (pegVal === null) {
            if (cat === 'fast_grower') return { label:'성장률 확인 필요', color:TK.amber500, icon:'🔍' }
            return { label:'재무 데이터 확인 필요', color:TK.sub7, icon:'❓' }
          }
          if (pegVal <= 0.5) return { label:'강력 매수 구간', color:TK.emerald500, icon:'🚀' }
          if (pegVal <= 1)   return { label:'성장 대비 저평가', color:TK.emerald400, icon:'✅' }
          if (pegVal <= 2)   return { label:'적정 가격 수준', color:TK.blue400, icon:'👍' }
          return { label:'성장 대비 고평가', color:TK.red400, icon:'⚠️' }
        })()

        return { inv, pegVal, pegZone, pe, epsGrowth, cat, weight, lynchJudge }
      })
      .sort((a,b) => {
        // PEG 있는 것 먼저, 낮은 순
        if (a.pegVal !== null && b.pegVal !== null) return a.pegVal - b.pegVal
        if (a.pegVal !== null) return -1
        if (b.pegVal !== null) return 1
        return 0
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments, fundMap, priceMap])

  const pegCounts = {
    undervalued: pegAnalysis.filter(p=>p.pegZone==='undervalued').length,
    fair:        pegAnalysis.filter(p=>p.pegZone==='fair').length,
    overvalued:  pegAnalysis.filter(p=>p.pegZone==='overvalued').length,
    unknown:     pegAnalysis.filter(p=>p.pegZone==='unknown').length,
  }

  // ── 워렌버핏 레이더 데이터 ──────────────────────────────────────
  // ★ 버핏 가치분석은 개별 주식만 평가 — ETF·코인·원자재는 전체 스코어에서 제외
  const buffettRadar = useMemo(()=>{
    if (!investments.length) return []
    // 개별 주식만 필터링 (SSOT)
    const stockInvs = investments.filter(i => getAssetType(i.ticker, i.name, i.market) === 'STOCK')
    if (!stockInvs.length) return []
    const pricedInvs = stockInvs.filter(i=>live(i))

    // 수익성: 평균 수익률 → 0~100 스케일
    const avgRet = pricedInvs.length
      ? pricedInvs.reduce((s,i)=>s+(getRet(i)??0),0)/pricedInvs.length : 0
    const profitScore = Math.min(100, Math.max(0, 50 + avgRet*0.8))

    // 안정성: 손실 종목 비율 반전
    const losers = pricedInvs.filter(i=>(getRet(i)??0)<0).length
    const stabilityScore = pricedInvs.length ? (1-losers/pricedInvs.length)*100 : 50

    // 해자 강도: 버핏 선호 분류 비중 (stalwart, asset_play 높은 점수)
    const moatScore = stockInvs.length
      ? stockInvs.reduce((s,i)=>s+(LYNCH_META[i.lynch_category??'na']?.buffett??0),0)/stockInvs.length : 50

    // 분산 투자: 시장·분류 다양성 (개별 주식 기준)
    const markets = new Set(stockInvs.map(i=>i.market)).size
    const categories = new Set(stockInvs.map(i=>i.lynch_category)).size
    const divScore = Math.min(100, (markets*20 + categories*12))

    // 지속성 — 3가지 지표를 합산해 신규 투자자도 의미있는 점수를 받도록 개선
    //  ① 보유 기간 (최대 50점): 30일=10점, 90일=20점, 180일=35점, 1년=50점
    const avgDays = stockInvs.reduce((s,i)=>{
      const d = Math.floor((Date.now()-new Date(i.purchase_date).getTime())/86400000)
      return s+d
    },0)/Math.max(stockInvs.length,1)
    const holdPart = Math.min(50, avgDays / 7.3)

    //  ② 수익 종목 비율 (최대 30점): 이익 나는 종목이 많을수록 ↑
    const profitableRatio = pricedInvs.length > 0
      ? pricedInvs.filter(i=>(getRet(i)??0)>=0).length / pricedInvs.length
      : 0.5
    const profitablePart = profitableRatio * 30

    //  ③ 포트폴리오 구성 완성도 (최대 20점): 종목 수, 시장 다양성
    const completePart = Math.min(20, stockInvs.length * 3 + markets * 2)

    const holdScore = holdPart + profitablePart + completePart

    return [
      { subject:'수익성 (ROE)',   score: Math.round(profitScore),   fullMark:100 },
      { subject:'안정성 (Debt)',  score: Math.round(stabilityScore), fullMark:100 },
      { subject:'지속성',         score: Math.round(holdScore),      fullMark:100 },
      { subject:'현금흐름',       score: Math.round(moatScore),      fullMark:100 },
      { subject:'경영진 신뢰',    score: Math.round(divScore),       fullMark:100 },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[investments, priceMap])

  const totalBuffettScore = buffettRadar.length
    ? Math.round(buffettRadar.reduce((s,d)=>s+d.score,0)/buffettRadar.length) : 0

  // 버핏 점수 등급
  const buffettGrade = totalBuffettScore >= 80 ? { label:'탁월한 포트폴리오', color:TK.emerald500, emoji:'🏆' }
    : totalBuffettScore >= 65 ? { label:'양호한 포트폴리오',   color:TK.blue400, emoji:'✅' }
    : totalBuffettScore >= 50 ? { label:'개선 필요',           color:TK.orange400, emoji:'⚠️' }
    : { label:'리밸런싱 권장',                                  color:TK.red400, emoji:'🔴' }

  // ETF 인덱스 유형 판별 (이름 기반) → 버핏 추천도 점수
  const etfScore = (inv: Investment): { score:number; type:string; note:string } => {
    const n = inv.name.toUpperCase()
    if (n.includes('S&P') || n.includes('SP500') || n.includes('S&P500'))
      return { score:78, type:'미국 S&P500 지수', note:'버핏이 직접 추천한 인덱스 펀드' }
    if (n.includes('나스닥') || n.includes('NASDAQ') || n.includes('QQQ'))
      return { score:74, type:'미국 나스닥 지수', note:'성장 기술주 분산 투자' }
    if (n.includes('KOSPI') || n.includes('200') || n.includes('코스피'))
      return { score:68, type:'한국 코스피200', note:'국내 우량주 분산 인덱스' }
    if (n.includes('배당') || n.includes('DIVIDEND'))
      return { score:72, type:'배당 인덱스', note:'꾸준한 배당 중시 전략' }
    if (n.includes('방산') || n.includes('반도체') || n.includes('바이오'))
      return { score:60, type:'테마 섹터 ETF', note:'섹터 집중으로 변동성 있음' }
    return { score:65, type:'분산 인덱스 ETF', note:'버핏 권장: 저비용 인덱스 펀드' }
  }

  // 종목별 버핏 점수
  // ★ SSOT getAssetType으로 4-way 분류 — PSLV(은) 등 원자재가 'stock'으로 새는 버그 수정
  const stockBuffettScores = useMemo(()=>{
    return investments.map(inv=>{
      const ret  = getRet(inv) ?? 0
      const cat  = inv.lynch_category ?? 'na'
      // SSOT 기준 자산 유형 (자체 isEtf보다 우선)
      const at   = getAssetType(inv.ticker, inv.name, inv.market)

      // ① 암호화폐 → 분석 불가
      if (at === 'CRYPTO') return {
        ...inv, score:0, ret, cat,
        assetType: 'crypto' as const,
        safeMargin: null, moat:'분석 불가',
      }

      // ② 원자재 → 분석 불가 (FCF·이익률 부재)
      if (at === 'COMMODITY') return {
        ...inv, score:0, ret, cat,
        assetType: 'commodity' as const,
        safeMargin: null, moat:'분석 불가',
      }

      // ③ ETF → 인덱스 펀드 전용 스코어 (SSOT ETF 또는 자체 isEtf 폴백)
      if (at === 'ETF' || isEtf(inv)) {
        const { score:baseEtf, type, note } = etfScore(inv)
        const retAdj = Math.min(10, Math.max(-10, ret*0.15))
        return {
          ...inv, score: Math.round(Math.min(100, Math.max(0, baseEtf + retAdj))),
          ret, cat, assetType: 'etf' as const,
          safeMargin: null, moat: type, etfNote: note,
        }
      }

      // ④ 일반 주식 → 린치 카테고리 + 수익률 기반
      const base   = LYNCH_META[cat]?.buffett ?? 50
      const retAdj = Math.min(20, Math.max(-20, ret*0.2))
      return {
        ...inv, score: Math.round(Math.min(100, Math.max(0, base + retAdj))),
        ret, cat, assetType: 'stock' as const,
        safeMargin: ret < 0 ? Math.abs(ret).toFixed(1) : null,
        moat: LYNCH_META[cat]?.moat,
      }
    }).sort((a,b) => {
      // 비주식(crypto·commodity·etf)은 뒤로, 개별 주식은 점수 내림차순
      const aStock = a.assetType === 'stock'
      const bStock = b.assetType === 'stock'
      if (aStock && !bStock) return -1
      if (!aStock && bStock) return 1
      return b.score - a.score
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[investments, priceMap, fundMap])

  // ── 버핏 탭 전용: 개별 주식만 필터링 ──────────────────────────────────────
  // 격리 원칙: 이 변수는 버핏 탭 UI에서만 사용 → 피터린치 탭 데이터 오염 없음
  // stockBuffettScores 원본은 건드리지 않고, 새 변수로 완전 격리
  const buffettStocksOnly = stockBuffettScores.filter(inv => inv.assetType === 'stock')

  // 추천 리밸런싱
  const RECOMMENDED: Record<string,number> = { fast_grower:30, stalwart:30, cyclical:15, slow_grower:10, turnaround:10, asset_play:5 }
  const rebalance = Object.entries(RECOMMENDED).map(([k,rec])=>{
    const cur = parseFloat(lynchGroups.find(g=>g.key===k)?.pct??'0')
    return { key:k, ...LYNCH_META[k], current:cur, recommended:rec, diff:parseFloat((cur-rec).toFixed(1)) }
  }).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff))

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', paddingTop:60 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TK.sub6} strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const C = { bg:TK.bg8, border:TK.line4, card:TK.bg8, text:TK.sub12, sub:TK.sub, muted:TK.sub10 }
  const SHO = `7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}`
  const SHI = `inset 4px 4px 10px ${TK.bg2}, inset -3px -3px 8px ${TK.line2}`
  const th = { padding:'9px 14px', textAlign:'left' as const, fontSize:10, fontWeight:600, color:C.sub, textTransform:'uppercase' as const, letterSpacing:'0.07em', whiteSpace:'nowrap' as const }
  const td = { padding:'10px 14px', borderTop:`1px solid ${C.border}` }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── 헤더 ── */}
      <div style={{ background:TK.bg8, borderRadius:16, padding:'24px 28px', border:'none', boxShadow:'10px 10px 28px #0b0d1a, -6px -6px 18px #2b2f46' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:8 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${TK.amber500}22,${TK.emerald500}22)`, border:`1px solid ${TK.sub6}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📈</div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0, letterSpacing:'-0.5px' }}>투자 전략 분석</h1>
            <p style={{ fontSize:13, color:C.sub, margin:0, marginTop:3 }}>전설적인 투자자들의 철학으로 포트폴리오를 진단합니다.</p>
          </div>
        </div>

        {/* 탭 선택 — PC: 2열 / 모바일: 1열 (analysis-tab-grid CSS 클래스로 제어) */}
        <div className="analysis-tab-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
          <Tab active={tab==='lynch'} onClick={()=>setTab('lynch')}
            color={TK.amber500} icon="⚡" label="피터린치 분석"
            sub="성장주 발굴의 대가 피터린치의 PEG 비율 분석 시스템을 경험하세요."/>
          <Tab active={tab==='buffett'} onClick={()=>setTab('buffett')}
            color={TK.emerald500} icon="🛡️" label="워렌버핏 분석"
            sub="가치투자의 거장 워렌버핏의 경제적 해자 및 내재 가치 진단 시스템입니다."/>
        </div>
      </div>

      {/* ══ 피터 린치 탭 ══════════════════════════════════════════════════ */}
      {tab === 'lynch' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeIn 0.25s ease-out' }}>

          {/* 분류 현황 */}
          <div style={{ display:'grid', gridTemplateColumns:'5fr 3fr', gap:16 }}>
            {/* 테이블 */}
            <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16 }}>⚡</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:TK.amber500 }}>피터린치 6대 분류 현황</div>
                  <div style={{ fontSize:11, color:C.sub }}>투자금액 기준 비중 및 종목 분석</div>
                </div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{ width:'130px' }}/>  {/* 분류 */}
                  <col style={{ width:'100px' }}/>  {/* 특징 */}
                  <col style={{ width:'56px'  }}/>  {/* 종목수 */}
                  <col style={{ width:'90px'  }}/>  {/* 투자금액 */}
                  <col style={{ width:'52px'  }}/>  {/* 비중 */}
                  <col style={{ width:'72px'  }}/>  {/* 바 */}
                  <col/>                            {/* 종목 — 나머지 전부 */}
                </colgroup>
                <thead><tr style={{ background:'#141728' }}>
                  {['분류','특징','종목','투자금액','비중','비중 바','보유 종목'].map(h=>(
                    <th key={h} style={{ ...th, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lynchGroups.length===0 ? (
                    <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:C.muted, padding:'32px 0' }}>종목을 추가하면 분석이 시작됩니다.</td></tr>
                  ) : lynchGroups.map(g=>(
                    <tr key={g.key}>
                      {/* 분류 배지 — nowrap으로 줄바꿈 방지 */}
                      <td style={{ ...td, whiteSpace:'nowrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, color:g.color, background:`${g.color}18`, border:`1px solid ${g.color}40`, whiteSpace:'nowrap' }}>
                          {g.label}
                        </span>
                      </td>
                      <td style={{ ...td, color:C.sub, fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.moat}</td>
                      <td style={{ ...td, color:C.text, fontWeight:700, textAlign:'center' }}>{g.count}</td>
                      <td style={{ ...td, color:TK.slate300, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{fmtKrw(g.invested)}</td>
                      <td style={{ ...td, color:g.color, fontWeight:700, textAlign:'right', whiteSpace:'nowrap' }}>{g.pct}%</td>
                      <td style={{ ...td }}>
                        <div style={{ height:5, background:TK.bg0, boxShadow: SHI, borderRadius:99, overflow:'hidden', minWidth:48 }}>
                          <div style={{ height:'100%', width:`${Math.min(parseFloat(g.pct),100)}%`, background:g.color, borderRadius:99 }}/>
                        </div>
                      </td>
                      {/* 종목명 — 이름 태그 형식으로 표시 */}
                      <td style={{ ...td, paddingTop:8, paddingBottom:8 }}>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {(g.tickers || '—').split(', ').map((name, i) => (
                            name === '—' ? (
                              <span key={i} style={{ color:C.muted, fontSize:11 }}>—</span>
                            ) : (
                              <span key={i} style={{ display:'inline-block', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:500, color:g.color, background:`${g.color}12`, border:`1px solid ${g.color}30`, whiteSpace:'nowrap' }}>
                                {name.length > 16 ? name.slice(0,15)+'…' : name}
                              </span>
                            )
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 도넛 */}
            <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:TK.amber500, marginBottom:4 }}>분류별 비중</div>
              <div style={{ fontSize:11, color:C.sub, marginBottom:12 }}>보유 종목 수 기준</div>
              {lynchPieData.length===0 ? (
                <div style={{ height:160,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:13 }}>데이터 없음</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={lynchPieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {lynchPieData.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}
                      </Pie>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip content={({active,payload}:any)=>{ if(!active||!payload?.length) return null; return <div style={{background:TK.gray800,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:12,color:C.text}}>{payload[0].name}: {payload[0].value}개</div> }}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:4 }}>
                    {lynchPieData.map(d=>(
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ width:8,height:8,borderRadius:'50%',background:d.color,flexShrink:0 }}/>
                        <span style={{ fontSize:11, color:C.sub, flex:1 }}>{d.name}</span>
                        <span style={{ fontSize:11, color:d.color, fontWeight:600 }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 리밸런싱 */}
          <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:TK.amber500 }}>🔄 피터린치식 포트폴리오 리밸런싱 제안</div>
              <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>현재 비중 vs 린치 권장 비중 비교</div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#141728' }}>
                  {['분류','현재 비중','권장 비중','차이','제안'].map(h=><th key={h} style={th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rebalance.map(r=>{
                    const over=r.diff>5, under=r.diff<-5
                    const color=over?TK.red400:under?TK.blue400:TK.emerald400
                    const msg=over?`${Math.abs(r.diff)}%p 축소 고려`:under?`${Math.abs(r.diff)}%p 확대 고려`:'적정 비중'
                    return (
                      <tr key={r.key}>
                        <td style={td}><span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:600,color:r.color,background:`${r.color}18`,border:`1px solid ${r.color}35` }}>{r.label}</span></td>
                        <td style={{ ...td }}>
                          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                            <div style={{ width:48,height:4,background:TK.bg0, boxShadow: SHI,borderRadius:99,overflow:'hidden' }}>
                              <div style={{ height:'100%',width:`${Math.min(r.current,100)}%`,background:r.color,borderRadius:99 }}/>
                            </div>
                            <span style={{ fontSize:12, color:C.text, fontVariantNumeric:'tabular-nums' }}>{r.current.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ ...td, color:C.sub, fontVariantNumeric:'tabular-nums' }}>{r.recommended}%</td>
                        <td style={{ ...td, color, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{r.diff>=0?'+':''}{r.diff}%p</td>
                        <td style={{ ...td }}><span style={{ fontSize:11,fontWeight:600,color }}>{msg}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'10px 18px', fontSize:11, color:C.muted, borderTop:`1px solid ${C.border}` }}>
              * 피터린치 권장 비중은 일반적인 성장주 포트폴리오 기준이며, 개인 투자 성향에 따라 조정하세요.
            </div>
          </div>

          {/* ── PEG 분석 섹션 ── */}
          <div style={{ background:'linear-gradient(135deg,#1a0a00 0%,#1f1200 50%,#1a1500 100%)', border:'none', boxShadow:`7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}`, borderRadius:14, padding:'20px 24px' }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:22 }}>📐</span>
                  <div>
                    <div style={{ fontSize:17, fontWeight:800, color:TK.amber500, letterSpacing:'-0.3px' }}>PEG 비율 분석</div>
                    <div style={{ fontSize:11, color:TK.amber800, marginTop:2 }}>Price/Earnings to Growth — 피터린치가 가장 중시한 밸류에이션 지표</div>
                  </div>
                </div>
                {/* 피터 린치 명언 */}
                <div style={{ padding:'8px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, maxWidth:480 }}>
                  <div style={{ fontSize:10, color:TK.amber500, fontWeight:700, letterSpacing:'0.08em', marginBottom:3 }}>💬 PETER LYNCH</div>
                  <div style={{ fontSize:12, color:'#fde68a', fontStyle:'italic', lineHeight:1.6 }}>
                    &quot;The P/E ratio of any company that&apos;s fairly priced will equal its growth rate. If the PEG is less than 1, you may have found a bargain.&quot;
                  </div>
                  <div style={{ fontSize:10, color:TK.amber800, marginTop:4 }}>PEG = PER ÷ EPS 성장률(%) · PEG &lt; 1이면 성장 대비 저평가된 보물주!</div>
                </div>
              </div>

              {/* PEG 스코어보드 */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, flexShrink:0 }}>
                {[
                  { label:'저평가', sub:'PEG ≤ 1', count:pegCounts.undervalued, color:TK.emerald500, emoji:'🟢' },
                  { label:'적정',   sub:'1 < PEG ≤ 2', count:pegCounts.fair,   color:TK.blue400, emoji:'🔵' },
                  { label:'고평가', sub:'PEG > 2', count:pegCounts.overvalued, color:TK.red400, emoji:'🔴' },
                  { label:'미확인', sub:'데이터 없음', count:pegCounts.unknown, color:TK.sub7, emoji:'⬜' },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(0,0,0,0.3)', border:`1px solid ${s.color}33`, borderRadius:10, padding:'10px 14px', textAlign:'center' as const }}>
                    <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.count}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:s.color, marginTop:2 }}>{s.label}</div>
                    <div style={{ fontSize:9, color:TK.sub, marginTop:1 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PEG 수평 바 차트 */}
            {fundLoading ? (
              <div style={{ padding:'24px 0', textAlign:'center', color:TK.sub, fontSize:13 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite', verticalAlign:'middle', marginRight:8 }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                재무 데이터 조회 중... (PER·PEG·EPS 성장률)
              </div>
            ) : pegAnalysis.filter(p=>p.pegVal!==null).length > 0 ? (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:TK.amber800, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  <span>📊 PEG 분포</span>
                  <span style={{ borderLeft:`1px solid ${TK.sub6}`, paddingLeft:8 }}>낮을수록 성장 대비 가격 부담이 낮습니다</span>
                  {/* 기준선 범례 */}
                  <div style={{ marginLeft:'auto', display:'flex', gap:12 }}>
                    {[[TK.emerald500,'≤ 1 저평가'],[TK.blue400,'≤ 2 적정'],[TK.red400,'> 2 고평가']].map(([c,l])=>(
                      <span key={l} style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,color:c }}>
                        <span style={{ width:8,height:8,borderRadius:'50%',background:c,display:'inline-block' }}/>{l}
                      </span>
                    ))}
                  </div>
                </div>
                {/* ── PEG 기준선 헤더 (한 번만 표시) ── */}
                <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:4 }}>
                  <div style={{ width:120, flexShrink:0 }}/>
                  <div style={{ flex:1, position:'relative', height:16 }}>
                    {/* PEG=1 라벨 */}
                    <div style={{ position:'absolute', left:`${(1/3)*100}%`, transform:'translateX(-50%)',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.5)',
                        background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)',
                        padding:'1px 6px', borderRadius:4, whiteSpace:'nowrap' }}>PEG = 1</span>
                      <div style={{ width:1, height:6, background:'rgba(255,255,255,0.3)' }}/>
                    </div>
                    {/* PEG=2 라벨 */}
                    <div style={{ position:'absolute', left:`${(2/3)*100}%`, transform:'translateX(-50%)',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.72)',
                        background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)',
                        padding:'1px 6px', borderRadius:4, whiteSpace:'nowrap' }}>PEG = 2</span>
                      <div style={{ width:1, height:6, background:'rgba(255,255,255,0.2)' }}/>
                    </div>
                  </div>
                  <div style={{ width:50, flexShrink:0 }}/>
                  <div style={{ width:100, flexShrink:0 }}/>
                </div>

                {pegAnalysis.filter(p=>p.pegVal!==null).slice(0,8).map(p=>{
                  const peg = p.pegVal!
                  const barW = Math.min(100, (peg/3)*100)
                  const barColor = peg<=1?TK.emerald500:peg<=2?TK.blue400:TK.red400
                  return (
                    <div key={p.inv.id} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                      <div style={{ width:120, flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:TK.slate100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.inv.name}</div>
                        <div style={{ fontSize:9, color:TK.sub7, fontFamily:'monospace' }}>{p.inv.ticker}</div>
                      </div>
                      <div style={{ flex:1, position:'relative' }}>
                        <div style={{ height:16, background:'rgba(0,0,0,0.3)', borderRadius:99, overflow:'visible', position:'relative' }}>
                          <div style={{ height:'100%', width:`${barW}%`, background:barColor, borderRadius:99, transition:'width 0.8s ease' }}/>
                          {/* 기준선 PEG=1 (라벨 없음 — 상단 헤더에 표시) */}
                          <div style={{ position:'absolute', left:`${(1/3)*100}%`, top:-3, bottom:-3, width:1.5, background:'rgba(255,255,255,0.25)', borderRadius:1 }}/>
                          {/* 기준선 PEG=2 (라벨 없음 — 상단 헤더에 표시) */}
                          <div style={{ position:'absolute', left:`${(2/3)*100}%`, top:-3, bottom:-3, width:1.5, background:'rgba(255,255,255,0.15)', borderRadius:1 }}/>
                        </div>
                      </div>
                      <div style={{ width:50, textAlign:'right', flexShrink:0 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:barColor, fontVariantNumeric:'tabular-nums' }}>{peg.toFixed(2)}</span>
                      </div>
                      <div style={{ width:100, flexShrink:0 }}>
                        <span style={{ fontSize:10, color:p.lynchJudge.color }}>{p.lynchJudge.icon} {p.lynchJudge.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding:'16px 0 8px', fontSize:12, color:TK.amber800, textAlign:'center' as const }}>
                {fundLoading ? '' : '미국 주식의 PEG 데이터는 Yahoo Finance에서 실시간 조회됩니다. 잠시 후 새로고침 해보세요.'}
              </div>
            )}

            {/* 종목별 상세 분석 테이블 */}
            <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(245,158,11,0.15)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'rgba(0,0,0,0.3)', borderBottom:'1px solid rgba(245,158,11,0.15)' }}>
                    {['종목','비중','PER','EPS 성장률','PEG','6대 분류','피터린치식 판단'].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left' as const, fontSize:9, fontWeight:700, color:TK.amber800, textTransform:'uppercase' as const, letterSpacing:'0.07em', whiteSpace:'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pegAnalysis.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding:'24px 0', textAlign:'center', color:TK.sub7, fontSize:13 }}>종목을 추가하면 분석이 시작됩니다.</td></tr>
                  ) : pegAnalysis.map((p,i)=>{
                    const hasData = p.pe !== null || p.pegVal !== null
                    const borderTop = i>0 ? '1px solid rgba(245,158,11,0.08)' : 'none'
                    return (
                      <tr key={p.inv.id} style={{ borderTop, background:i%2===0?'transparent':'rgba(0,0,0,0.15)' }}>
                        <td style={{ padding:'9px 12px' }}>
                          <div style={{ fontWeight:600, color:TK.slate100, fontSize:12 }}>{p.inv.name}</div>
                          <div style={{ fontSize:9, color:TK.sub7, fontFamily:'monospace', marginTop:1 }}>{p.inv.ticker}</div>
                        </td>
                        <td style={{ padding:'9px 12px', color:TK.amber800, fontVariantNumeric:'tabular-nums' }}>{p.weight.toFixed(1)}%</td>
                        <td style={{ padding:'9px 12px', color: p.pe !== null ? '#fde68a' : TK.sub7, fontVariantNumeric:'tabular-nums', fontWeight: p.pe !== null ? 600 : 400 }}>
                          {p.pe !== null ? p.pe.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding:'9px 12px', fontVariantNumeric:'tabular-nums' }}>
                          {p.epsGrowth !== null
                            ? <span style={{ color: p.epsGrowth>=20?TK.emerald500:p.epsGrowth>=10?TK.blue400:p.epsGrowth>=0?'#fde68a':TK.red400, fontWeight:700 }}>{p.epsGrowth>=0?'+':''}{p.epsGrowth.toFixed(1)}%</span>
                            : <span style={{ color:TK.sub7 }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.pegVal !== null ? (
                            <span style={{ fontSize:13, fontWeight:900, color: p.pegVal<=1?TK.emerald500:p.pegVal<=2?TK.blue400:TK.red400, fontVariantNumeric:'tabular-nums' }}>
                              {p.pegVal.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color:TK.sub7, fontSize:11 }}>{hasData ? '계산불가' : '—'}</span>
                          )}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          {p.cat && p.cat !== 'na' && LYNCH_META[p.cat]
                            ? <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, color:LYNCH_META[p.cat].color, background:`${LYNCH_META[p.cat].color}18`, border:`1px solid ${LYNCH_META[p.cat].color}35` }}>{LYNCH_META[p.cat].label}</span>
                            : <span style={{ color:TK.sub7, fontSize:10 }}>—</span>}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:600, color:p.lynchJudge.color }}>
                            {p.lynchJudge.icon} {p.lynchJudge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* PEG 해석 기준 (하단) */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginTop:16 }}>
              {[
                { range:'PEG ≤ 0.5', label:'강력 매수 구간', desc:'성장 대비 매우 저평가', color:TK.emerald500 },
                { range:'0.5 < PEG ≤ 1', label:'매수 고려 구간', desc:'성장 대비 저평가', color:TK.emerald400 },
                { range:'1 < PEG ≤ 2', label:'적정 또는 관찰', desc:'합리적 가격 수준', color:TK.blue400 },
                { range:'PEG > 2', label:'고평가 주의', desc:'성장 대비 비싼 구간', color:TK.red400 },
              ].map(({range,label,desc,color})=>(
                <div key={range} style={{ padding:'10px 12px', background:'rgba(0,0,0,0.2)', border:`1px solid ${color}22`, borderRadius:8 }}>
                  <div style={{ fontSize:12, fontWeight:800, color, marginBottom:3 }}>{range}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:TK.slate100, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:10, color:TK.sub }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:10, color:TK.sub, textAlign:'center' as const }}>
              * PEG = PER ÷ EPS연간성장률(%)  ·  단순 참고용이며 투자 결정의 전부가 아닙니다. 피터린치도 &quot;PEG는 출발점일 뿐&quot;이라고 강조했습니다.
            </div>
          </div>
        </div>
      )}

      {/* ══ 워렌버핏 탭 ════════════════════════════════════════════════════ */}
      {tab === 'buffett' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeIn 0.25s ease-out' }}>

          {/* 상단 스코어 배너 */}
          <div style={{ background:'linear-gradient(135deg,#052e16 0%,#064e3b 50%,#065f46 100%)', borderRadius:14, padding:'22px 28px', border:'none', boxShadow:`7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}`, display:'grid', gridTemplateColumns:'1fr auto', gap:16, alignItems:'center' }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:TK.emerald300, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>WARREN BUFFETT SCORE</div>
              <div style={{ fontSize:13, color:'#a7f3d0', marginBottom:12 }}>포트폴리오의 경제적 해자와 내재 가치를 종합 진단합니다.</div>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ fontSize:11, color:TK.emerald300 }}>⚖️ 개별 주식 <strong style={{ color:TK.slate100 }}>{buffettStocksOnly.length}개</strong> 분석</div>
                <div style={{ fontSize:11, color:TK.emerald300 }}>📊 레이더 5개 항목 평가</div>
                {stockBuffettScores.length > buffettStocksOnly.length && (
                  <div style={{ fontSize:10, color:TK.emerald400, opacity:0.7 }}>
                    (ETF·코인·원자재 {stockBuffettScores.length - buffettStocksOnly.length}개 제외)
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:64, fontWeight:900, color: buffettGrade.color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{totalBuffettScore}</div>
              <div style={{ fontSize:11, color:TK.emerald300, marginTop:4 }}>/ 100 PTS</div>
              <div style={{ marginTop:8, padding:'4px 12px', borderRadius:99, background:`${buffettGrade.color}22`, border:`1px solid ${buffettGrade.color}44`, fontSize:12, fontWeight:700, color:buffettGrade.color }}>
                {buffettGrade.emoji} {buffettGrade.label}
              </div>
            </div>
          </div>

          {/* 레이더 + 버핏 원칙 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* 레이더 차트 */}
            <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:TK.emerald500, marginBottom:4 }}>포트폴리오 펀더멘탈 스코어</div>
              <div style={{ fontSize:11, color:C.sub, marginBottom:12 }}>5가지 핵심 지표 종합 평가</div>
              {buffettRadar.length===0 ? (
                <div style={{ height:220,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:13 }}>종목을 추가해주세요</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={buffettRadar}>
                    <PolarGrid stroke={TK.gray800} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill:TK.sub, fontSize:11 }} />
                    <Radar name="점수" dataKey="score" stroke={TK.emerald500} fill={TK.emerald500} fillOpacity={0.25} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              )}
              {/* 점수 바 */}
              <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:8 }}>
                {buffettRadar.map(d=>(
                  <div key={d.subject} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:10, color:C.sub, width:90, flexShrink:0 }}>{d.subject}</span>
                    <div style={{ flex:1, height:4, background:TK.bg0, boxShadow: SHI, borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${d.score}%`, background:d.score>=70?TK.emerald500:d.score>=50?TK.amber500:TK.red400, borderRadius:99, transition:'width 1s ease' }}/>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:d.score>=70?TK.emerald500:d.score>=50?TK.amber500:TK.red400, width:28, textAlign:'right', flexShrink:0 }}>{d.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 버핏 원칙 카드 */}
            <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:TK.emerald500, marginBottom:4 }}>🛡️ 워렌버핏의 투자 원칙</div>
              <div style={{ fontSize:11, color:C.sub, marginBottom:14 }}>버핏이 강조하는 핵심 원칙과 포트폴리오 대조</div>
              {[
                { rule:'Rule #1',   title:'절대 돈을 잃지 마라',         check: totalBuffettScore>=60, desc:'손실 종목 비율 최소화' },
                { rule:'Rule #2',   title:'Rule #1을 잊지 마라',         check: totalBuffettScore>=60, desc:'리스크 관리 최우선' },
                { rule:'해자',      title:'경제적 해자가 있는 기업',       check: investments.some(i=>['stalwart','asset_play'].includes(i.lynch_category??'')), desc:'브랜드·규모·기술 우위' },
                { rule:'장기 보유', title:'10년 이상 보유할 주식만',       check: investments.length > 0, desc:'단기 변동에 흔들리지 않기' },
                { rule:'이해 가능', title:'이해하는 사업에만 투자',        check: investments.filter(i=>i.market!=='CRYPTO').length > investments.filter(i=>i.market==='CRYPTO').length, desc:'CRYPTO 비중 점검' },
                { rule:'적정 가격', title:'좋은 기업을 공정한 가격에',     check: investments.some(i=>(getRet(i)??0) < 0), desc:'안전마진 확보 여부' },
              ].map(({rule,title,check,desc})=>(
                <div key={rule} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 0', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:check?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    {check ? '✅' : '⚠️'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:9, color:TK.emerald500, background:'rgba(16,185,129,0.15)', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>{rule}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{title}</span>
                    </div>
                    <div style={{ fontSize:10, color:C.sub, marginTop:2 }}>{desc}</div>
                  </div>
                </div>
              ))}

              {/* 버핏 명언 */}
              <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(16,185,129,0.06)', borderRadius:10, border:'1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:TK.emerald500, letterSpacing:'0.08em', marginBottom:5 }}>💬 BUFFETT&apos;S INSIGHT</div>
                <div style={{ fontSize:12, color:'#a7f3d0', fontStyle:'italic', lineHeight:1.6 }}>
                  &quot;Rule No.1: Never lose money.<br/>Rule No.2: Never forget Rule No.1.&quot;
                </div>
              </div>
            </div>
          </div>

          {/* 종목별 버핏 점수 — 개별 주식 전용 */}
          <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:15 }}>📋</span>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:TK.emerald500 }}>종목별 가치투자 적합도</span>
                    {/* 개별 주식 전용 배지 */}
                    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, fontWeight:800,
                      background:'rgba(16,185,129,0.12)', color:TK.emerald500, border:'1px solid rgba(16,185,129,0.3)' }}>
                      개별 주식 전용
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:C.sub }}>경제적 해자 · 안전마진 · 버핏 스코어 분석</div>
                </div>
              </div>
              {/* 제외 자산 안내 */}
              {stockBuffettScores.length > buffettStocksOnly.length && (
                <div style={{ fontSize:10, color:TK.sub6, padding:'4px 10px', borderRadius:6,
                  background:'rgba(55,65,81,0.3)', border:`1px solid ${TK.sub6}` }}>
                  ETF·코인·원자재 {stockBuffettScores.length - buffettStocksOnly.length}개 제외
                </div>
              )}
            </div>

            {/* Empty State — 주식이 0개일 때 */}
            {buffettStocksOnly.length === 0 ? (
              <div style={{ padding:'40px 24px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:32 }}>🏰</div>
                <div style={{ fontSize:14, fontWeight:700, color:TK.slate100 }}>
                  가치투자 분석이 가능한 개별 주식 종목이 없습니다.
                </div>
                <div style={{ fontSize:12, color:C.sub, lineHeight:1.7, maxWidth:380 }}>
                  자산관리 탭에서 개별 주식을 추가하면 버핏 스코어 분석이 시작됩니다.<br/>
                  <span style={{ fontSize:10, color:TK.sub6 }}>
                    ※ ETF·암호화폐·원자재는 현금흐름이 없어 DCF 분석 대상에서 제외됩니다.
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12, padding:16 }}>
                {/* 개별 주식 카드만 렌더링 (buffettStocksOnly = assetType === 'stock'만 포함) */}
                {buffettStocksOnly.map(inv=>{
                  const color = inv.score>=75?TK.emerald500:inv.score>=55?TK.blue400:inv.score>=40?TK.orange400:TK.red400
                  const recommend = inv.score>=75?'매수 적합':inv.score>=55?'보유 유지':inv.score>=40?'모니터링':'리밸런싱'
                  return (
                    <div key={inv.id} style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:10, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{inv.name}</div>
                          <div style={{ fontSize:10, color:C.sub, fontFamily:'monospace', marginTop:2 }}>{inv.ticker}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:24, fontWeight:900, color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{inv.score}</div>
                          <div style={{ fontSize:9, color:C.sub }}>/ 100</div>
                        </div>
                      </div>
                      <div style={{ height:5, background:TK.bg0, boxShadow: SHI, borderRadius:99, overflow:'hidden', marginBottom:10 }}>
                        <div style={{ height:'100%', width:`${inv.score}%`, background:color, borderRadius:99 }}/>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                          <span style={{ color:C.sub }}>경제적 해자</span>
                          <span style={{ color:C.text, fontWeight:600 }}>{inv.moat}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                          <span style={{ color:C.sub }}>현재 수익률</span>
                          <span style={{ color:inv.ret>=0?TK.red500:TK.blue500, fontWeight:700 }}>{fmtPct(inv.ret)}</span>
                        </div>
                        {inv.safeMargin && (
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                            <span style={{ color:TK.emerald500 }}>안전마진 기회</span>
                            <span style={{ color:TK.emerald500, fontWeight:700 }}>-{inv.safeMargin}% 할인</span>
                          </div>
                        )}
                        <div style={{ marginTop:4, padding:'5px 10px', borderRadius:7, background:`${color}18`, border:`1px solid ${color}33`, textAlign:'center', fontSize:11, fontWeight:700, color }}>
                          {recommend}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 안전마진 바 차트 */}
          {/* 버핏 스코어 막대 차트 — 개별 주식만 표시 (buffettStocksOnly 사용) */}
          {buffettStocksOnly.filter(i=>live(i)).length > 0 && (
            <div style={{ background:TK.bg8, boxShadow: SHO, border:'none', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:TK.emerald500 }}>📊 종목별 버핏 스코어 비교</span>
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, fontWeight:800,
                  background:'rgba(16,185,129,0.12)', color:TK.emerald500, border:'1px solid rgba(16,185,129,0.3)' }}>
                  개별 주식 전용
                </span>
              </div>
              <div style={{ fontSize:11, color:C.sub, marginBottom:12 }}>75점 이상 → 매수 적합 구간</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={buffettStocksOnly
                    .filter(i => live(i))
                    .slice(0,10)
                    .map(i => ({ ...i, shortName: i.name.length > 8 ? i.name.slice(0,7)+'…' : i.name }))}
                  margin={{ top:10, right:10, bottom:0, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TK.gray800} vertical={false}/>
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill:TK.sub, fontSize:10 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis domain={[0,100]} tick={{ fill:TK.sub, fontSize:10 }} axisLine={false} tickLine={false}/>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip content={({active,payload}:any)=>{ if(!active||!payload?.length) return null; const d=payload[0].payload; return <div style={{background:TK.gray800,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:C.text}}><strong>{d.name}</strong><br/>버핏 점수: {d.score}점<br/>{d.moat}</div> }}/>
                  <Bar dataKey="score" radius={[4,4,0,0]} maxBarSize={40}>
                    {buffettStocksOnly.filter(i=>live(i)).slice(0,10).map((entry,i)=>(
                      <Cell key={i} fill={entry.score>=75?TK.emerald500:entry.score>=55?TK.blue400:entry.score>=40?TK.orange400:TK.red400} fillOpacity={0.85}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:16, marginTop:8, justifyContent:'center', flexWrap:'wrap' }}>
                {[[TK.emerald500,'75+ 매수적합'],[TK.blue400,'55-74 보유유지'],[TK.orange400,'40-54 모니터링'],[TK.red400,'~39 리밸런싱']].map(([c,l])=>(
                  <span key={l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.sub }}>
                    <span style={{ width:10,height:10,borderRadius:2,background:c,display:'inline-block' }}/>{l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── 포트폴리오 연동 DCF 내재가치 분석기 ── */}
          <BuffettAnalysisPanel
            investments={investments}
            priceMap={priceMap}
            fundMap={fundMap}
          />

        </div>
      )}
    </div>
  )
}

// useSearchParams는 Suspense 경계 안에서 사용해야 함
export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', justifyContent:'center', paddingTop:80 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TK.sub6} strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  )
}
