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
import MoneyFlowRadar from '@/app/components/MoneyFlowRadar'
import EventCalendarPanel from '@/app/components/EventCalendarPanel'
import ExitPlanBoard from '@/app/components/ExitPlanBoard'
import CashPositionCard from '@/app/components/CashPositionCard'
import FirmHandsCard from '@/app/components/FirmHandsCard'
import FxAttributionCard from '@/app/components/FxAttributionCard'
import StockActionChips from '@/app/components/StockActionChips'   // 🔗 종목 액션 SSOT(보유 → 근거·차트)
import { type Candle } from '@/app/components/CandleChart'
import { Verdict } from '@/app/components/ui/Screen'   // 🎯 화면의 답(페이지당 하나) — 공용 프리미티브
import { TK, FS } from '@/lib/theme'
import { USD_KRW_FALLBACK } from '@/lib/fx'   // 💱 환율 폴백 SSOT(화면마다 1,350·1,400 으로 갈리던 상수를 한 값으로)
import { acceptFx } from '@/lib/fxAccept'     // 환율 채택 SSOT — 고정 상수는 실제 환율로 쓰지 않는다
import { isPriced } from '@/lib/portfolioSummary'   // 시세 판정 SSOT — 학생 화면과 같은 규칙

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
const N   = TK.bg8
const SHO = `7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}`
const SHI = `inset 4px 4px 10px ${TK.bg2}, inset -3px -3px 8px ${TK.line2}`

// ─── Config ───────────────────────────────────────────────────────────────────
// ⚠️ 폴백 상수(USD_KRW_FALLBACK)는 fx.ts SSOT 에서 가져온다 — 실제 환산은 /api/exchange-rate 라이브 값(usdKrw state)을 쓴다.
//    (제1원칙: 하드코딩 1,350을 그대로 쓰면 실제 1,445 대비 7% 과소 표기 + 같은 화면의
//     현금 포지션 카드는 라이브 환율이라 두 수치가 어긋난다 = 제2원칙 위반)
const FRAMES: TimeFrame[] = ['1D','1W','1M','1Y']

const LYNCH_META: Record<string, { label: string; color: string }> = {
  slow_grower: { label: '저성장주', color: TK.sub9 },
  stalwart:    { label: '대형 우량주',   color: TK.blue400 },
  fast_grower: { label: '고성장주',   color: TK.emerald400 },
  cyclical:    { label: '경기 순환주',   color: TK.orange400 },
  turnaround:  { label: '회생 기업주',   color: TK.red400 },
  asset_play:  { label: '자산 보유주',   color: TK.purple400 },
  na:          { label: 'N/A',           color: TK.sub7 },
}
// CRYPTO 는 비트코인 공식 오렌지로 — orange400 은 경고 축이라 시장 식별색과 뜻이 겹친다
const MARKET_COLOR: Record<Market, string> = { US:TK.emerald400, KR:TK.blue400, CRYPTO:TK.btcOrange }
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
  const [usdKrw,        setUsdKrw]        = useState(USD_KRW_FALLBACK)   // 라이브 환율(현금 카드·리밸런싱과 동일 SSOT)
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
  // 🔗 딥링크 프리필 — 추천·리서치 화면의 '➕ 보유 등록' 칩이 `?add=TICKER&name=&market=` 로 보낸다.
  //    이게 없어서 학생이 추천에서 본 티커를 손으로 다시 타이핑해야 했다(연결 조직 2026-08-08).
  //    한 번만 적용하고 URL을 정리한다 — 남겨두면 새로고침·뒤로가기 때 모달이 계속 다시 열린다.
  const addPrefill = useRef<{ ticker: string; name: string; market: Market } | null>(null)
  const prefillDone = useRef(false)
  // ── 텐배거 트래커 평단가 (localStorage → FullCandleChart avgPrice prop 연동)
  const [tenbaggerPrices, setTenbaggerPrices] = useState<Record<string, number>>({})
  const abortRef = useRef<AbortController|null>(null)

  const getTf  = (ticker: string): TimeFrame => tfMap[ticker] ?? '1D'
  const setTf  = (ticker: string, tf: TimeFrame) => setTfMap(prev => ({ ...prev, [ticker]: tf }))

  // 📱 모바일에선 캔들차트·수급 섹션(카드당 약 1,000px)을 접어 둔다 — 375px 실측(2026-09-11) 보유 17종에
  //    화면 36.5장(29,694px)이었고 그중 절반이 이 섹션이었다. 접힌 동안은 렌더 자체를 안 하므로
  //    MoneyFlowRadar 의 fetch 도 열 때까지 안 나간다. 데스크톱은 그대로(isMobile=false).
  //    초기값 false 로 두고 마운트 뒤에 재야 서버 HTML 과 첫 렌더가 어긋나지 않는다.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobile(mq.matches)
    apply(); mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const [openCharts, setOpenCharts] = useState<Set<string>>(new Set())
  const toggleChart = (ticker: string) => setOpenCharts(prev => {
    const next = new Set(prev); if (next.has(ticker)) next.delete(ticker); else next.add(ticker); return next
  })

  useEffect(() => {
    if (!dbLoading) return
    const t = setTimeout(() => setDbLoading(false), 5000)
    return () => clearTimeout(t)
  }, [dbLoading])

  // 🔗 `?add=TICKER&name=&market=` 딥링크 → 등록 모달 자동 오픈(프리필). 마운트 후 1회만.
  //    ⚠️ 렌더 중 window 를 읽으면 하이드레이션이 깨진다(서버엔 URL이 없다) → useEffect 안에서만.
  useEffect(() => {
    if (prefillDone.current) return
    prefillDone.current = true
    const sp = new URLSearchParams(window.location.search)
    const t = (sp.get('add') ?? '').trim().toUpperCase()
    if (!t) return
    const m = sp.get('market')
    addPrefill.current = {
      ticker: t,
      name: (sp.get('name') ?? '').trim(),
      market: (m === 'KR' || m === 'CRYPTO' ? m : 'US') as Market,
    }
    setEditTarget(null)
    setModalOpen(true)
    // URL 정리 — 남겨두면 새로고침·뒤로가기마다 모달이 다시 열려 학생이 갇힌 느낌을 받는다
    window.history.replaceState({}, '', '/assets')
  }, [])

  // 💱 라이브 환율 — 폴백(SSOT 상수)은 조회 실패 시에만. 현금 포지션 카드와 같은 원천을 써야 화면 안에서 수치가 어긋나지 않는다.
  useEffect(() => {
    let alive = true
    fetch('/api/exchange-rate').then(r => r.ok ? r.json() : null)
      .then(j => { const r = acceptFx(j); if (alive && r != null) setUsdKrw(r) })   // 고정 상수(stale-constant)는 받지 않는다 — 폴백 유지
      .catch(() => { /* 폴백 유지 */ })
    return () => { alive = false }
  }, [])

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
  // 가격으로 쓸 수 있는 행만 — 조회 실패 행(currentPrice 0 + error)은 null 이라 합계가 매수가로 계산된다.
  //   getLive 는 PER·PEG 등 stock-info 재무용으로 그대로 둔다(가격이 실패해도 재무는 올 수 있다).
  const getPx     = (inv: Investment) => { const lv = getLive(inv); return isPriced(lv) ? lv : null }
  const getReturn = (inv: Investment) => { const lv=getPx(inv); if (!lv) return null; return ((lv.currentPrice-inv.purchase_price)/inv.purchase_price)*100 }

  const toKrwTotal = (inv: Investment) => inv.purchase_price*inv.quantity*(inv.currency==='USD'?usdKrw:1)
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
    const lv = getPx(inv)
    const price = lv ? lv.currentPrice : inv.purchase_price
    return price * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)
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

  // ── 🎯 이 화면의 답: "내 자산은 지금 총 얼마이고, 얼마를 벌었거나 잃었나" ──────────────
  //    구 요약 스트립은 **개수와 원금만** 보여줬다(보유 20개 · 총 투자금액 ₩3,302만 · 수익 8개 · 손실 12개).
  //    'CLAUDE.md 반복 함정: 개수는 크기를 담지 못한다' 가 정작 가장 자주 여는 화면에 그대로 있었다.
  //    ⚠️ 신규 계산 아님 — 위 evalKrw()·toKrwTotal() 을 그대로 합산한다(섹션 배지와 같은 잣대).
  const totalEvalKrw = investments.reduce((s, i) => s + evalKrw(i), 0)
  const totalPnlKrw  = totalEvalKrw - totalCostKrw
  const totalPnlPct  = totalCostKrw > 0 ? (totalPnlKrw / totalCostKrw) * 100 : null
  // ⚠️ evalKrw 는 현재가가 없으면 **매입가로 폴백**한다 → 그 종목은 손익 0 으로 잡힌다.
  //    시세가 하나도 안 왔을 때 이 값을 그대로 쓰면 헤드라인이 **"평가손익 ₩0 (0.0%)"** 라고
  //    단언한다(2026-09-04 화면검증에서 실제로 나왔다). 학생은 "본전이구나"로 읽는다 —
  //    '없음'과 '못 불러옴'을 같은 문구로 쓰지 마라는 이 앱의 반복 함정 그대로다.
  //    priceStatus 는 이미 idle/loading/done/error 4상태로 있었다('있는데 안 쓴 데이터').
  //    → 시세를 못 믿을 땐 **손익 숫자를 아예 그리지 않는다.** 배지로 상쇄하려 들지 않는다.
  const unpricedCount = investments.filter(i => !getPx(i)).length
  const pricedCount   = investments.length - unpricedCount
  const pnlTrustable  = priceStatus === 'done' && pricedCount > 0
  const pnlBlockedWhy =
    priceStatus === 'loading' || priceStatus === 'idle' ? '시세를 불러오는 중입니다'
    : priceStatus === 'error'                           ? '시세를 불러오지 못했습니다'
    : pricedCount === 0                                 ? '시세가 들어온 종목이 없습니다'
    : null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sortLabel: Record<SortOption, string> = {
    eval:   '평가금액 ↓',
    return: '수익률 ↓',
    name:   '종목명 순',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}input::placeholder{color:${TK.sub6}}select option{background:${TK.gray800}}`}</style>

      {/* 🎯 이 화면의 답 — 총 평가금액과 총 손익. 구 스트립(개수·원금)은 chips 로 내렸다. */}
      {!dbLoading && investments.length > 0 && (
        <Verdict
          eyebrow="💼 내 자산"
          headline={
            pnlTrustable ? (
              <>
                총 {fmtEval(totalEvalKrw)}
                <span style={{ color: TK.sub3 }}> · 평가손익 </span>
                {/* 등락·내 손익은 한국식 — 빨강=플러스, 파랑=마이너스 */}
                <span style={{ color: totalPnlKrw > 0 ? TK.red500 : totalPnlKrw < 0 ? TK.blue500 : TK.slate200, fontVariantNumeric: 'tabular-nums' }}>
                  {/* ⚠️ 부호는 한 글자로 통일 — toFixed() 는 하이픈(-)을 내고 금액은 마이너스기호(−)라
                      한 줄 안에서 '−₩283만 (-8.6%)' 처럼 두 종류가 섞였다(2026-09-04 화면검증). */}
                  {totalPnlKrw > 0 ? '+' : totalPnlKrw < 0 ? '−' : ''}{fmtEval(Math.abs(totalPnlKrw))}
                  {totalPnlPct != null && <> ({totalPnlPct > 0 ? '+' : totalPnlPct < 0 ? '−' : ''}{Math.abs(totalPnlPct).toFixed(1)}%)</>}
                </span>
              </>
            ) : (
              // 손익을 못 믿을 땐 **숫자를 그리지 않는다** — 0 을 보여주면 '본전'이라는 거짓말이 된다
              <>원금 {fmtEval(totalCostKrw)} · <span style={{ color: TK.sub3 }}>손익 집계 전</span></>
            )
          }
          sub={
            pnlTrustable
              ? <>원금 {fmtEval(totalCostKrw)}{hasUsd ? ' · USD는 현재 환율로 환산' : ''} · <b style={{ color: TK.slate300 }}>지금 보유분만</b>입니다 — 이미 판 종목의 실현 손익은 <a href="/history" style={{ color: TK.indigo400, textDecoration: 'none', fontWeight: 700 }}>투자 기록 →</a></>
              : <><b style={{ color: TK.amber400 }}>{pnlBlockedWhy}</b> — 현재가가 없으면 손익을 계산할 수 없어 <b style={{ color: TK.slate300 }}>매입가(원금)만</b> 보여드립니다{priceStatus === 'error' ? <> · 위 🔄 버튼으로 다시 시도해 보세요</> : null}</>
          }
          chips={[
            { label: '보유', value: `${investments.length}개`, color: TK.slate100 },
            { label: '수익', value: `${investments.filter(i=>getPx(i)&&getPx(i)!.currentPrice>i.purchase_price).length}개`, color: TK.red500 },
            { label: '손실', value: `${investments.filter(i=>getPx(i)&&getPx(i)!.currentPrice<i.purchase_price).length}개`, color: TK.blue500 },
          ]}
          footer={pnlTrustable && unpricedCount > 0
            ? <>⚠️ {unpricedCount}종은 현재가를 불러오지 못해 <b style={{ color: TK.amber400 }}>매입가로 계산</b>했습니다 — 그만큼 손익이 실제보다 작게 보입니다.</>
            : undefined}
        />
      )}

      {/* 🤲 단단한 손 점검 — 코스톨라니 3조건(돈·생각·인내)을 한자리에. 현금 카드 바로 위(돈 축의 상세가 아래에 이어짐) */}
      {!dbLoading && <FirmHandsCard />}

      {/* 💰 현금 포지션 — 예수금·CMA 등록 → 실제 현금 비중 vs 앱 기준 밴드 */}
      {!dbLoading && <CashPositionCard />}
      {!dbLoading && <FxAttributionCard />}

      {/* 📅 이벤트 캘린더 — 어닝 D-day·배당락·배당 현금흐름 */}
      {!dbLoading && investments.length > 0 && <EventCalendarPanel />}

      {/* 🚪 출구 플랜 — 보유 종목별 매도 계획(이익 보호선·최후 방어선·매도 압력) */}
      {!dbLoading && investments.length > 0 && <ExitPlanBoard />}

      {/* 컨트롤 */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <div style={{ position:'relative', flexGrow:1, minWidth:150, maxWidth:260 }}>
          <svg style={{ position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:TK.sub7,pointerEvents:'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="종목명 / 티커" style={{ width:'100%',padding:'7px 10px 7px 26px',background:N,boxShadow:SHI,border:'none',borderRadius:8,color:TK.slate100,fontSize:FS.tiny,outline:'none',boxSizing:'border-box' }} onFocus={e=>{e.currentTarget.style.boxShadow=`${SHI}, 0 0 0 1px ${TK.blue600}`}} onBlur={e=>{e.currentTarget.style.boxShadow=SHI}}/>
        </div>
        {(['all','US','KR','CRYPTO'] as const).map(m=>(
          <button key={m} onClick={()=>setFilterMarket(m)} style={{ padding:'6px 11px',borderRadius:99,fontSize:FS.tiny,fontWeight:600,cursor:'pointer',border:'none',transition:'all 0.12s', background:filterMarket===m?(m==='all'?'rgba(255,255,255,0.06)':`${MARKET_COLOR[m as Market]}18`):N, color:filterMarket===m?(m==='all'?TK.slate100:MARKET_COLOR[m as Market]):TK.sub7, boxShadow:filterMarket===m?SHI:SHO }}>
            {m==='all'?'전체':m}
          </button>
        ))}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)} style={{ padding:'7px 9px',background:N,boxShadow:SHI,border:'none',borderRadius:8,color:TK.sub7,fontSize:FS.tiny,outline:'none',cursor:'pointer' }}>
          <option value="return">수익률순</option>
          <option value="name">이름순</option>
          <option value="invested">투자금액순</option>
        </select>
        <button onClick={()=>fetchPrices(investments)} disabled={priceStatus==='loading'||!investments.length} style={{ padding:'7px 10px',background:N,boxShadow:SHO,border:'none',borderRadius:8,color:TK.sub7,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:FS.tiny,opacity:priceStatus==='loading'?0.5:1,transition:'color 0.15s,box-shadow 0.15s' }} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=TK.slate100;(e.currentTarget as HTMLButtonElement).style.boxShadow=`9px 9px 22px ${TK.bg2}, -5px -5px 15px ${TK.line2}`}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=TK.sub7;(e.currentTarget as HTMLButtonElement).style.boxShadow=SHO}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:priceStatus==='loading'?'spin 0.8s linear infinite':'none' }}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
          현재가
        </button>
        <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:5,padding:'8px 14px',background:`linear-gradient(135deg,${TK.blue600},${TK.blue700})`,border:'none',borderRadius:9,color:'#fff',fontSize:FS.body,fontWeight:600,cursor:'pointer',boxShadow:'0 0 20px rgba(37,99,235,0.3)',flexShrink:0 }}>
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
          <div style={{ fontSize:FS.h1 }}>💼</div>
          <div style={{ fontWeight:700,fontSize:FS.lg,color:TK.sub }}>포트폴리오가 비어있습니다</div>
          <div style={{ fontSize:FS.body,color:TK.sub6 }}>첫 번째 종목을 추가해 투자 현황을 추적하세요</div>
          <button onClick={()=>{setEditTarget(null);setModalOpen(true)}} style={{ padding:'10px 24px',background:`linear-gradient(135deg,${TK.blue600},${TK.blue700})`,border:'none',borderRadius:10,color:'#fff',fontSize:FS.body,fontWeight:600,cursor:'pointer' }}>+ 종목 추가하기</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center',padding:'48px 0',color:TK.sub6,fontSize:FS.body }}>검색 결과가 없습니다</div>
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
                  <span style={{ fontSize:FS.body, fontWeight:800, color:TK.sub12 }}>{flag} {label}</span>
                  <span style={{ fontSize:FS.tiny, color:TK.sub4 }}>({group.length}종목)</span>

                  {/* 요약 배지 */}
                  <span style={{ padding:'2px 10px', borderRadius:99, background:TK.bg0, boxShadow:SHI, fontSize:FS.tiny, fontWeight:600, color:TK.purple400 }}>
                    {fmtEval(summary.totalEval)}
                  </span>
                  {summary.avgRet !== null && (
                    <span style={{
                      padding:'2px 10px', borderRadius:99, background:TK.bg0, boxShadow:SHI,
                      fontSize:FS.tiny, fontWeight:700,
                      color: summary.avgRet >= 0 ? TK.red400 : TK.blue400,
                    }}>
                      {summary.avgRet >= 0 ? '+' : ''}{summary.avgRet.toFixed(2)}%
                    </span>
                  )}

                  {/* 정렬 드롭다운 */}
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortOption)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginLeft:'auto', padding:'4px 9px', background:N, boxShadow:SHI, border:'none', borderRadius:8, color:TK.sub9, fontSize:FS.tiny, outline:'none', cursor:'pointer' }}
                  >
                    <option value="eval">평가금액 높은 순</option>
                    <option value="return">수익률 높은 순</option>
                    <option value="name">종목명 순</option>
                  </select>
                </div>

                {/* 해당 섹션 종목 카드 목록 */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {group.map(inv => {
            const livePrice = getLive(inv)   // 재무(PER·PEG·배당)용
            const pricedLive = getPx(inv)    // 가격·손익용 — 조회 실패면 null(₩0·−100% 를 그리지 않는다)
            const isETF  = ETF_BRANDS.some(k => inv.name.toUpperCase().includes(k))
            const isNA   = inv.market === 'CRYPTO' || isETF
            const lynchMeta = inv.lynch_category && !isNA && inv.lynch_category !== 'na'
              ? LYNCH_META[inv.lynch_category] ?? null : null
            const isUp  = (pricedLive?.changePct ?? 0) >= 0
            const C     = isUp ? TK.red500 : TK.blue500
            const Cs    = isUp ? TK.red400 : TK.blue400
            const ret   = pricedLive ? ((pricedLive.currentPrice - inv.purchase_price) / inv.purchase_price) * 100 : 0
            const ohlc  = (priceMap[inv.ticker.toUpperCase()]?.ohlcCharts ?? {} as Record<TimeFrame, Candle[]>)[getTf(inv.ticker)] ?? []
            const prevClose = pricedLive ? pricedLive.currentPrice - pricedLive.change : undefined

            return (
              <div
                key={inv.id}
                onClick={() => openEditModal(inv)}
                className="m-wrap"
                style={{
                  background: N, boxShadow: SHO,
                  borderRadius: 14, overflow: 'hidden',
                  borderLeft: `3px solid ${C}`,
                  display: 'flex', alignItems: 'stretch',
                  marginBottom: 0, cursor: 'pointer',
                }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLDivElement; el.style.boxShadow=`9px 9px 22px ${TK.bg2}, -5px -5px 15px ${TK.line2}, 0 0 0 1px #6366f130` }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLDivElement; el.style.boxShadow=SHO }}
              >
                {/* ── Section 1: 종목 정보 (220px) ── */}
                <div className="m-full" style={{ width:220, flexShrink:0, padding:'14px 16px', display:'flex', flexDirection:'column', gap:5 }}>
                  {/* 종목명 + 배지 — ⚠️ 예전엔 이름과 배지가 **좌우로** 나뉘어 있었다(space-between).
                      배지 쪽이 flexShrink:0 이라 220px 칸에서 이름 몫이 **77px** 밖에 안 남았고,
                      "ALPHABET INC."(116px 필요)조차 잘렸다(2026-09-04 실측 16종). 글자 크기를
                      토큰으로 올리자 배지가 커져 더 심해졌다 — **내 이관이 만든 회귀**다.
                      → 이름을 **한 줄 전체 폭**(약 188px)으로 올리고 배지는 아래 줄로 내린다.
                      종목명은 이 화면의 핵심 식별자라 잘리면 안 된다. 배지는 짧은 라벨이라 micro. */}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:FS.body, fontWeight:800, color:TK.sub12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={inv.name}>{inv.name}</div>
                    <div style={{ fontSize:FS.tiny, color:TK.sub4, fontFamily:'monospace', marginTop:1 }}>{inv.ticker}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:FS.micro, fontWeight:700, color:MARKET_COLOR[inv.market], border:`1px solid ${MARKET_COLOR[inv.market]}44`, borderRadius:4, padding:'1px 5px' }}>{inv.market}</span>
                    {/* ★ 자산 포지션 배지 + 변경 버튼 */}
                    <button
                      onClick={e => { e.stopPropagation(); setRoleModal(inv) }}
                      title="자산 포지션 변경"
                      style={{
                        display:'flex', alignItems:'center', gap:3, padding:'1px 6px',
                        borderRadius:4, border:'none', cursor:'pointer', fontSize:FS.micro, fontWeight:700,
                        background: inv.asset_role === 'CORE' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                        color:      inv.asset_role === 'CORE' ? TK.emerald400 : TK.amber400,
                      }}
                    >
                      {inv.asset_role === 'CORE' ? '🏛 CORE' : '🛰 SATELLITE'}
                      <span style={{ opacity:0.6 }}>✎</span>
                    </button>
                  </div>

                  {/* 🔗 내 종목 → 근거·차트 — 보유 화면에서 리서치·차트로 가는 링크가 0건이었다(2026-08-08 조사).
                      "계속 들고 갈까"를 판단할 곳이 없으면 학생은 가격만 보고 결정하게 된다.
                      이미 보유 중이라 '보유 등록'·'관심'은 제외 — 축에 맞는 액션만 노출한다. */}
                  <div onClick={e => e.stopPropagation()}>
                    <StockActionChips ticker={inv.ticker} name={inv.name} market={inv.market} only={['research', 'chart']} compact />
                  </div>

                  {/* Lynch badge */}
                  {!isNA && lynchMeta && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:FS.tiny, fontWeight:500, color:lynchMeta.color, background:`${lynchMeta.color}15`, border:`1px solid ${lynchMeta.color}35`, alignSelf:'flex-start' }}>
                      {lynchMeta.label}
                    </span>
                  )}
                  {!isNA && !inv.lynch_category && !classifyDone.has(inv.id) && (
                    <span style={{ fontSize:FS.tiny, color:TK.sub6, alignSelf:'flex-start' }}>분류 중…</span>
                  )}
                  {isNA && <span style={{ fontSize:FS.tiny, color:TK.sub7, background:TK.gray800, padding:'2px 7px', borderRadius:4, border:`1px solid ${TK.sub6}`, alignSelf:'flex-start' }}>N/A</span>}

                  {/* Current price + change */}
                  {pricedLive && (
                    <div style={{ marginTop:2 }}>
                      <div style={{ fontSize:FS.lg, fontWeight:800, color:TK.sub12, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.3px' }}>
                        {inv.currency==='KRW' ? `₩${Math.round(pricedLive.currentPrice).toLocaleString('ko-KR')}` : `$${pricedLive.currentPrice.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
                      </div>
                      <div style={{ fontSize:FS.tiny, fontWeight:700, color:Cs }}>
                        {isUp ? '▲' : '▼'} {Math.abs(pricedLive.changePct).toFixed(2)}%
                        <span style={{ color:TK.sub4, marginLeft:5, fontWeight:400 }}>
                          {pricedLive.change >= 0 ? '+' : ''}{inv.currency==='KRW' ? `₩${Math.round(pricedLive.change).toLocaleString('ko-KR')}` : `$${pricedLive.change.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dividend row */}
                  {(() => {
                    const dy    = livePrice?.dividendYield ?? 0
                    const annDiv = livePrice?.annualDividend ?? null
                    const curPrice = pricedLive?.currentPrice ?? inv.purchase_price
                    const exRate   = inv.currency === 'USD' ? usdKrw : 1
                    // 연간 총 배당금 (원화)
                    const annualTotal = annDiv && annDiv > 0
                      ? annDiv * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)
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
                      <div style={{ background:TK.bg0, boxShadow:SHI, borderRadius:7, padding:'6px 9px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom: hasDividend ? 4 : 0 }}>
                          <span style={{ fontSize:FS.tiny }}>💰</span>
                          {hasDividend ? (
                            <span style={{ fontSize:FS.tiny, fontWeight:800, color:TK.emerald400 }}>
                              {(dy * 100).toFixed(2)}%
                            </span>
                          ) : (
                            <span style={{ fontSize:FS.tiny, color:TK.sub10 }}>배당 없음</span>
                          )}
                          {/* 주당 배당금 서브텍스트 */}
                          {annDiv && annDiv > 0 && (
                            <span style={{ fontSize:FS.tiny, color:'#4b5568', marginLeft:2 }}>
                              {inv.currency === 'USD' ? `$${annDiv.toFixed(2)}/주` : `₩${Math.round(annDiv).toLocaleString('ko-KR')}/주`}
                            </span>
                          )}
                        </div>
                        {/* 예상 총 배당금 (연/월) */}
                        {hasDividend && annualTotal > 0 && (
                          <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                            <span style={{ fontSize:FS.tiny, fontWeight:800, color:TK.sub12, fontVariantNumeric:'tabular-nums' }}>
                              {fmtSmall(annualTotal)}
                            </span>
                            <span style={{ fontSize:FS.tiny, color:TK.sub4 }}>연</span>
                            <span style={{ fontSize:FS.tiny, color:TK.emerald400, fontVariantNumeric:'tabular-nums' }}>
                              {fmtSmall(monthlyTotal)}
                            </span>
                            <span style={{ fontSize:FS.tiny, color:TK.sub4 }}>월</span>
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
                        background:`linear-gradient(135deg,#7f1d1d,${TK.red600})`, color:'#fff', fontSize:FS.tiny, fontWeight:700 }}>
                      + 추가매수
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openSellModal(inv) }}
                      style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer',
                        background:`linear-gradient(135deg,#1e3a8a,${TK.blue500})`, color:'#fff', fontSize:FS.tiny, fontWeight:700 }}>
                      - 추가매도
                    </button>
                  </div>
                  {/* ✏️ 잘못 기입했을 때 갈 곳 — 여기서 반대매매로 상쇄하면 없던 매도 기록과 실현손익이 남는다
                      (2026-08-23 사용자 신고: 매수 수량 오기입을 매도로 고치려다 거래 이력이 오염됨) */}
                  <a href="/history" onClick={e => e.stopPropagation()}
                    style={{ display:'block', marginTop:5, fontSize:FS.tiny, color:TK.sub3, textDecoration:'none', textAlign:'center' }}>
                    잘못 입력했나요? <span style={{ color:TK.blue400, fontWeight:700 }}>투자 기록에서 수정 ↗</span>
                  </a>
                </div>

                {/* ── Divider ── */}
                <div className="m-hide" style={{ width:1, background:TK.bg9, flexShrink:0, margin:'10px 0' }}/>

                {/* ── Section 2: 포트폴리오 + 재무 (280px) ── */}
                <div className="m-full" style={{ width:280, flexShrink:0, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Portfolio performance */}
                  <div>
                    <div style={{ fontSize:FS.tiny, fontWeight:800, color:TK.sub10, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>포트폴리오</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:8 }}>
                      {[
                        { label:'현재가',  val: pricedLive ? (inv.currency==='KRW' ? `₩${Math.round(pricedLive.currentPrice).toLocaleString('ko-KR')}` : `$${pricedLive.currentPrice.toFixed(2)}`) : '—', color:TK.sub12 },
                        { label:'매수가',  val: inv.currency==='KRW' ? `₩${Math.round(inv.purchase_price).toLocaleString('ko-KR')}` : `$${inv.purchase_price.toFixed(2)}`, color:TK.sub9 },
                        /* ★ 매수수량 — 자산관리 카드 중앙 영역에 추가 */
                        { label:'매수수량', val: `${inv.quantity.toLocaleString('ko-KR')}주`, color:TK.blue400 },
                        { label:'보유금액', val: pricedLive ? (inv.currency==='KRW' ? fmtKrwVal(pricedLive.currentPrice*inv.quantity) : `$${(pricedLive.currentPrice*inv.quantity).toFixed(0)}`) : fmtKrwVal(inv.purchase_price*inv.quantity*(inv.currency==='USD'?usdKrw:1)), color:TK.purple400 },
                        { label:'평가손익', val: pricedLive ? (inv.currency==='KRW' ? ((pricedLive.currentPrice-inv.purchase_price)*inv.quantity>=0?'+':'')+`₩${Math.round((pricedLive.currentPrice-inv.purchase_price)*inv.quantity).toLocaleString('ko-KR')}` : ((pricedLive.currentPrice-inv.purchase_price)*inv.quantity>=0?'+':'')+'$'+(Math.abs((pricedLive.currentPrice-inv.purchase_price)*inv.quantity)).toFixed(2)) : '—', color: pricedLive && pricedLive.currentPrice >= inv.purchase_price ? TK.red400 : TK.blue400 },
                        { label:'수익률',  val: pricedLive ? `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : '—', color: ret >= 0 ? TK.red400 : TK.blue400 },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ background:TK.bg0, boxShadow:SHI, borderRadius:7, padding:'6px 9px' }}>
                          <div style={{ fontSize:FS.tiny, color:TK.sub10, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:FS.tiny, fontWeight:700, color, fontVariantNumeric:'tabular-nums' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial metrics */}
                  <div>
                    <div style={{ fontSize:FS.tiny, fontWeight:800, color:TK.sub10, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>핵심 지표</div>
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
                            const price  = pricedLive?.currentPrice ?? inv.purchase_price
                            const exRate = inv.currency === 'USD' ? usdKrw : 1
                            const monthly = annDiv && annDiv > 0
                              ? annDiv * inv.quantity * exRate / 12
                              : dy > 0 ? price * inv.quantity * exRate * dy / 12 : 0
                            if (monthly <= 0) return '—'
                            const v = Math.round(monthly)
                            return v >= 10000 ? `₩${(v/10000).toFixed(1)}만` : `₩${v.toLocaleString('ko-KR')}`
                          })(),
                        },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background:TK.bg0, boxShadow:SHI, borderRadius:7, padding:'5px 8px' }}>
                          <div style={{ fontSize:FS.tiny, color:TK.sub10, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:FS.tiny, fontWeight:700, color:TK.sub9, fontVariantNumeric:'tabular-nums', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="m-hide" style={{ width:1, background:TK.bg9, flexShrink:0, margin:'10px 0' }}/>

                {/* 📱 모바일 전용 접기 버튼 — 차트·수급은 눌러야 열린다 */}
                {isMobile && (
                  <button type="button" onClick={e => { e.stopPropagation(); toggleChart(inv.ticker) }}
                    style={{
                      width:'100%', margin:'0 0 4px', padding:'10px 12px', border:'none', cursor:'pointer',
                      background: N, boxShadow: SHI, borderRadius: 10,
                      color: openCharts.has(inv.ticker) ? TK.amber400 : TK.sub4, fontSize: FS.tiny, fontWeight: 700, textAlign:'left',
                    }}>
                    {openCharts.has(inv.ticker) ? '▲ 차트·수급 접기' : '▼ 차트·수급 보기'}
                  </button>
                )}

                {/* ── Section 3: 캔들차트 (flex:1) — 모바일은 열었을 때만 렌더 ── */}
                {(!isMobile || openCharts.has(inv.ticker)) && (
                <div className="m-full" style={{ flex:1, minWidth:0, padding:'10px 12px 8px', display:'flex', flexDirection:'column' }}>
                  {/* Timeframe tabs */}
                  <div style={{ display:'flex', gap:5, marginBottom:6 }}>
                    {(FRAMES).map(t => (
                      <button key={t} onClick={e => { e.stopPropagation(); setTf(inv.ticker, t) }}
                        style={{
                          padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer',
                          fontSize:FS.tiny, fontWeight:700, transition:'all 0.15s',
                          background: getTf(inv.ticker) === t ? TK.amber400 : N,
                          boxShadow:  getTf(inv.ticker) === t ? '0 2px 8px rgba(251,191,36,0.3)' : SHI,
                          color:      getTf(inv.ticker) === t ? TK.bg8 : TK.sub4,
                        }}>{t}</button>
                    ))}
                    <span style={{ marginLeft:'auto', fontSize:FS.tiny, color:TK.sub10, alignSelf:'center' }}>
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
                      <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:TK.sub10, fontSize:FS.tiny }}>
                        {priceStatus === 'loading' ? '로딩 중…' : `${getTf(inv.ticker)} 차트 없음`}
                      </div>
                    )}
                  </div>
                  {!isNA && (
                    <div style={{ marginTop:10 }}>
                      <MoneyFlowRadar ticker={inv.ticker} name={inv.name} market={inv.market} />
                    </div>
                  )}
                </div>
                )}
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
          // 편집이면 그 종목, 딥링크(?add=)면 티커·시장만 채운 껍데기 — 수량·단가는 학생이 직접 입력한다(자동 채움 금지)
          initial={editTarget ?? (addPrefill.current
            ? ({ ticker: addPrefill.current.ticker, name: addPrefill.current.name, market: addPrefill.current.market } as Investment)
            : undefined)}
          onClose={()=>{setModalOpen(false);setEditTarget(null);addPrefill.current=null}}
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
  const N   = TK.bg8
  const SHO = `7px 7px 18px ${TK.bg2}, -4px -4px 12px ${TK.line2}`
  const SHI = `inset 4px 4px 10px ${TK.bg2}, inset -3px -3px 8px ${TK.line2}`

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
          style={{ background:N, boxShadow:`0 0 0 1px ${TK.line2}, 12px 12px 32px #0a0c18`,
            borderRadius:18, maxWidth:400, width:'calc(100% - 32px)', padding:'28px 24px 22px',
            animation:'roleSlideUp 0.2s ease-out', color:TK.sub12 }}
        >
          {/* 타이틀 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:FS.lg, fontWeight:800 }}>🏷 자산 포지션 변경</h3>
            <button onClick={onClose} style={{ background:'none', border:'none', color:TK.sub4, fontSize:FS.xl, cursor:'pointer' }}>×</button>
          </div>

          {/* 종목 정보 */}
          <div style={{ background:TK.bg0, boxShadow:SHI, borderRadius:10, padding:'9px 13px', marginBottom:20, fontSize:FS.body, color:TK.sub14 }}>
            <strong style={{ color:TK.sub12 }}>{investment.name}</strong>
            <span style={{ marginLeft:8, fontFamily:'monospace', fontSize:FS.tiny }}>{investment.ticker}</span>
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
                  background: selected === role ? TK.bg0 : 'transparent',
                  boxShadow:  selected === role ? SHO : SHI,
                  borderLeft: `3px solid ${selected === role
                    ? (role === 'CORE' ? TK.emerald400 : TK.amber400)
                    : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize:FS.xl, flexShrink:0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize:FS.body, fontWeight:700, color: selected === role ? TK.sub12 : TK.sub, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:FS.tiny, color:TK.sub4, lineHeight:1.5 }}>{desc}</div>
                </div>
                <div style={{ marginLeft:'auto', flexShrink:0, paddingTop:2 }}>
                  <div style={{
                    width:16, height:16, borderRadius:'50%',
                    border: `2px solid ${selected === role ? (role === 'CORE' ? TK.emerald400 : TK.amber400) : TK.sub6}`,
                    background: selected === role ? (role === 'CORE' ? TK.emerald400 : TK.amber400) : 'transparent',
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
                background:TK.bg0, boxShadow:SHI, color:TK.sub4, fontWeight:600, fontSize:FS.body }}>
              취소
            </button>
            <button onClick={() => onConfirm(selected)} disabled={loading || selected === investment.asset_role}
              style={{ flex:2, padding:'11px 0', borderRadius:9, border:'none',
                cursor:(loading || selected === investment.asset_role) ? 'not-allowed' : 'pointer',
                background: selected === 'CORE'
                  ? `linear-gradient(135deg,#065f46,${TK.emerald400})`
                  : `linear-gradient(135deg,#78350f,${TK.amber400})`,
                color:'#fff', fontWeight:700, fontSize:FS.body,
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
