'use client'

/**
 * /valuation — 최일 가치분석
 * 실시간 재무 데이터 → CAGR → PEG → 적정주가 → 20년 시뮬 → 종합점수
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const T = {
  bg:   '#0f1117',
  card: '#1a1d27',
  bd:   '#2a2d3a',
  up:   '#ef4444',
  dn:   '#3b82f6',
  grn:  '#34d399',
  gld:  '#fbbf24',
  mut:  '#6b7280',
  txt:  '#f1f5f9',
  sub:  '#94a3b8',
  est:  '#4b5563',   // 추정치 컬럼 색상
} as const

const C = (extra: React.CSSProperties = {}): React.CSSProperties =>
  ({ background: T.card, border: `0.5px solid ${T.bd}`, borderRadius: 12, ...extra })

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface FinData {
  ticker: string; name: string; currency: 'USD' | 'KRW'
  currentPrice: number; marketCap: number; shares: number
  currentPER: number | null; forwardEPS: number | null
  years: string[]
  eps: (number | null)[]; oi: (number | null)[]; rev: (number | null)[]
  unit: string; error?: string | null
}
interface Investment {
  id: string; ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO'
}

// ── CAGR 계산 ─────────────────────────────────────────────────────────────────
function cagr(start: number | null | undefined, end: number | null | undefined, yrs: number): number | null {
  if (!start || !end || start <= 0 || end <= 0 || yrs <= 0) return null
  const c = (Math.pow(end / start, 1 / yrs) - 1) * 100
  return isFinite(c) ? parseFloat(c.toFixed(2)) : null
}

// ── PEG 평가 ──────────────────────────────────────────────────────────────────
function pegRating(peg: number | null) {
  if (peg == null || !isFinite(peg)) return { label: '계산불가', color: T.mut, emoji: '⚪' }
  if (peg <  1.0) return { label: '저평가 (강력 매수)', color: T.grn, emoji: '🟢' }
  if (peg <  1.5) return { label: '적정 수준',          color: T.gld, emoji: '🟡' }
  if (peg <  2.0) return { label: '약간 고평가',         color: '#fb923c', emoji: '🟠' }
  return { label: '고평가',                              color: T.up,  emoji: '🔴' }
}

// ── 포맷 ─────────────────────────────────────────────────────────────────────
const fmt$ = (n: number, cur: string) =>
  cur === 'KRW' ? `₩${Math.round(n).toLocaleString('ko-KR')}` : `$${n.toFixed(2)}`

// ── Skeleton 컴포넌트 ──────────────────────────────────────────────────────────
function Sk({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: `linear-gradient(90deg, ${T.bd} 25%, #363a4a 50%, ${T.bd} 75%)`,
      backgroundSize: '400% 100%',
      animation: 'sk 1.4s ease infinite',
    }}/>
  )
}

// ── 테이블 셀 입력 ─────────────────────────────────────────────────────────────
interface CellProps {
  value: number | null
  isEst: boolean
  onChange: (v: number | null) => void
  loading?: boolean
}
function Cell({ value, isEst, onChange, loading }: CellProps) {
  const [focus, setFocus] = useState(false)
  if (loading) return <Sk h={22} w={60} r={4}/>
  return (
    <input
      type="number"
      value={value ?? ''}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={e => {
        const n = parseFloat(e.target.value)
        onChange(isFinite(n) ? n : null)
      }}
      placeholder="—"
      style={{
        width: '100%', minWidth: 58,
        background: focus ? '#0f1117' : 'transparent',
        border: focus ? `1px solid ${isEst ? T.gld : T.grn}` : 'none',
        borderRadius: 4, outline: 'none',
        textAlign: 'right', color: isEst ? '#9ca3af' : T.txt,
        fontSize: 12, padding: '3px 6px',
        fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
      }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ValuationPage() {
  // ── 상태 ──────────────────────────────────────────────────────────────────
  const [investments, setInvestments] = useState<Investment[]>([])
  const [ticker,  setTicker]  = useState('')
  const [market,  setMarket]  = useState<'US' | 'KR'>('US')
  const [loading, setLoading] = useState(false)
  const [fin,     setFin]     = useState<FinData | null>(null)
  const [apiErr,  setApiErr]  = useState<string | null>(null)

  // 편집 가능 데이터 (8개년)
  const [eps,  setEps]  = useState<(number | null)[]>(Array(8).fill(null))
  const [oi,   setOi]   = useState<(number | null)[]>(Array(8).fill(null))
  const [rev,  setRev]  = useState<(number | null)[]>(Array(8).fill(null))
  const [years, setYears] = useState<string[]>([])

  // PER 입력 (사용자 커스텀)
  const [perInput, setPerInput] = useState('')

  // ── 보유 종목 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data } = await sb.from('investments')
          .select('id,ticker,name,market').eq('user_id', user.id)
        setInvestments(
          ((data ?? []) as Investment[]).filter(i => i.market !== 'CRYPTO')
        )
      } catch { /* 무시 */ }
    })()
  }, [])

  // ── 분석 시작 ─────────────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setApiErr(null)
    setFin(null)

    // 스켈레톤 표시를 위한 임시 빈 구조
    const cy   = new Date().getFullYear()
    const base = cy - 4
    const defYears = Array.from({ length: 8 }, (_, i) => {
      const y = base + i; return y >= cy ? `${String(y).slice(2)}(E)` : String(y)
    })
    setYears(defYears)
    setEps(Array(8).fill(null))
    setOi(Array(8).fill(null))
    setRev(Array(8).fill(null))

    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 25000)

      const res = await fetch(
        `/api/financials?ticker=${encodeURIComponent(ticker.trim())}&market=${market}`,
        { signal: controller.signal }
      )
      clearTimeout(tid)

      const data: FinData & { error?: string | null } = await res.json()

      if (data.error) {
        setApiErr(`⚠️ ${data.error}  (아래 표에 직접 입력 가능)`)
      }

      // 안전 배열 추출 (길이 보장)
      const safeArr = (a: unknown): (number | null)[] => {
        if (!Array.isArray(a)) return Array(8).fill(null)
        return Array.from({ length: 8 }, (_, i) => {
          const v = a[i]; return (typeof v === 'number' && isFinite(v)) ? v : null
        })
      }

      const safeFin: FinData = {
        ticker:       data.ticker ?? ticker.trim().toUpperCase(),
        name:         data.name   ?? ticker.trim().toUpperCase(),
        currency:     data.currency === 'KRW' ? 'KRW' : 'USD',
        currentPrice: isFinite(Number(data.currentPrice)) ? Number(data.currentPrice) : 0,
        marketCap:    isFinite(Number(data.marketCap))    ? Number(data.marketCap)    : 0,
        shares:       isFinite(Number(data.shares))       ? Number(data.shares)       : 0,
        currentPER:   typeof data.currentPER === 'number' && isFinite(data.currentPER) ? data.currentPER : null,
        forwardEPS:   typeof data.forwardEPS  === 'number' && isFinite(data.forwardEPS)  ? data.forwardEPS  : null,
        years:        Array.isArray(data.years) && data.years.length === 8 ? data.years : defYears,
        eps:          safeArr(data.eps),
        oi:           safeArr(data.oi),
        rev:          safeArr(data.rev),
        unit:         data.unit ?? (market === 'KR' ? '억원' : 'B USD'),
      }

      setFin(safeFin)
      setYears(safeFin.years)
      setEps([...safeFin.eps])
      setOi([...safeFin.oi])
      setRev([...safeFin.rev])
      setPerInput(safeFin.currentPER != null ? safeFin.currentPER.toFixed(1) : '')

    } catch (e) {
      const msg = (e as Error).name === 'AbortError'
        ? '⏱ 조회 시간 초과 (25초). 아래 표에 수동 입력하세요.'
        : `⚠️ ${(e as Error).message}  (아래 표에 수동 입력 가능)`
      setApiErr(msg)
    } finally {
      setLoading(false)
    }
  }, [ticker, market])

  // ── CAGR 자동 계산 (useMemo — eps/oi/rev 변경 시 즉시 재계산) ──────────────
  const cagrData = useMemo(() => {
    const safe = (a: (number | null)[]) => {
      const r = [...a]; while (r.length < 8) r.push(null); return r
    }
    const e = safe(eps), o = safe(oi), r = safe(rev)

    // 양수인 첫 값 (적자기업 대비)
    const pos = (a: (number | null)[], from = 0) => {
      for (let i = from; i < a.length; i++) if ((a[i] ?? 0) > 0) return a[i]
      return null
    }

    return {
      long: {
        eps: cagr(pos(e), e[7], 7),
        oi:  cagr(pos(o), o[7], 7),
        rev: cagr(pos(r), r[7], 7),
      },
      short: {
        eps: cagr(e[4] ?? pos(e, 3), e[7], 3),
        oi:  cagr(o[4] ?? pos(o, 3), o[7], 3),
        rev: cagr(r[4] ?? pos(r, 3), r[7], 3),
      },
    }
  }, [eps, oi, rev])

  // ── PEG & 적정주가 자동 계산 ──────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!fin && eps.every(v => v == null)) return null

    const cagrEps   = cagrData.long.eps
    const perMktRaw = parseFloat(perInput)
    const perMkt    = isFinite(perMktRaw) && perMktRaw > 0
      ? perMktRaw : (fin?.currentPER ?? 25)

    const mkScenario = (per: number, scenLabel: string) => {
      const pegVal = cagrEps && cagrEps > 0 ? +(per / cagrEps).toFixed(2) : null
      const rating = pegRating(pegVal)
      return { scenLabel, per, peg: pegVal, ratingLabel: rating.label, color: rating.color, emoji: rating.emoji }
    }

    // Forward EPS: 마지막 추정치 or forwardEPS
    const fwdEps  = eps.filter(v => v != null && v > 0).at(-1) ?? fin?.forwardEPS ?? 0
    const latOI   = oi.filter(v  => v != null && isFinite(v!)).at(-1) ?? 0
    const latRev  = rev.filter(v => v != null && isFinite(v!)).at(-1) ?? 0
    const shares  = fin?.shares ?? 1e7
    const cur     = fin?.currency ?? 'USD'
    const unit    = fin?.unit ?? 'B USD'

    // 단위 변환: 주당 기업가치
    // US B USD → 달러/주, KR 억원 → 원/주
    const perShareOI  = cur === 'KRW' ? (latOI  * 1e8) / shares : (latOI  * 1e9) / shares
    const perShareRev = cur === 'KRW' ? (latRev * 1e8) / shares : (latRev * 1e9) / shares

    const fvEPS = fwdEps * perMkt
    const fvOI  = perShareOI  > 0 ? perShareOI  * perMkt : 0
    const fvRev = perShareRev > 0 ? perShareRev * 2       : 0   // PSR 2배

    const valid = [fvEPS, fvOI, fvRev].filter(v => isFinite(v) && v > 0)
    const avgFV = valid.length ? valid.reduce((a, b) => a + b) / valid.length : 0
    const upside = fin?.currentPrice && avgFV > 0
      ? (avgFV / fin.currentPrice - 1) * 100 : 0

    return {
      scenarios: [
        mkScenario(15,     '보수적 (PER 15)'),
        mkScenario(25,     '적정  (PER 25)'),
        mkScenario(50,     '성장주 (PER 50)'),
        mkScenario(perMkt, `시장 PER (${perMkt.toFixed(1)})`),
      ],
      fvEPS, fvOI, fvRev, avgFV, upside,
      fwdEps, cagrEps, perMkt, unit, cur,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, cagrData, perInput, eps, oi, rev])

  // ── 종합 점수 자동 계산 ────────────────────────────────────────────────────
  const scoreData = useMemo(() => {
    if (!analysis) return null
    let pts = 0
    const reasons: string[] = []

    // PEG (40점)
    const peg = analysis.scenarios[3].peg
    if (peg != null) {
      if      (peg < 1.0) { pts += 40; reasons.push(`PEG ${peg}로 저평가 (40점)`) }
      else if (peg < 1.5) { pts += 30; reasons.push(`PEG ${peg}로 적정 (30점)`) }
      else if (peg < 2.0) { pts += 15; reasons.push(`PEG ${peg}로 약간 고평가 (15점)`) }
      else                  reasons.push(`PEG ${peg}로 고평가 (0점)`)
    }

    // 상승여력 (30점)
    const up = analysis.upside
    if      (up > 30) { pts += 30; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (30점)`) }
    else if (up > 10) { pts += 20; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (20점)`) }
    else if (up >  0) { pts += 10; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 소폭 여력 (10점)`) }
    else                reasons.push(`적정주가 대비 ${up.toFixed(0)}% 하락 (0점)`)

    // 성장 안정성 (30점)
    const ls = cagrData.long.eps, ss = cagrData.short.eps
    if (ls != null && ss != null) {
      if      (ss >= ls)  { pts += 30; reasons.push('단기 성장률 > 장기 (가속화) (30점)') }
      else if (ss > 0)    { pts += 15; reasons.push('성장 중이나 속도 둔화 (15점)') }
      else                  reasons.push('단기 성장 둔화 (0점)')
    }

    const verdict =
      pts >= 80 ? { text: '강력 매수 (Buy)',    bg: '#052e16', color: T.grn } :
      pts >= 60 ? { text: '매수 (Accumulate)',  bg: '#0c1a3a', color: T.dn  } :
      pts >= 40 ? { text: '보유 (Hold)',         bg: '#2d1c00', color: T.gld } :
                  { text: '매수 보류 (Watch)',   bg: '#2d0a0a', color: T.up  }

    return { pts, reasons, verdict }
  }, [analysis, cagrData])

  // ── 20년 시뮬 데이터 ───────────────────────────────────────────────────────
  const simData = useMemo(() => {
    const base = eps.filter(v => v != null && v > 0).at(-1) ?? 1
    const gL = cagrData.long.eps  ?? 15
    const gS = cagrData.short.eps ?? 20
    const gA = analysis?.cagrEps  ?? 18
    return Array.from({ length: 21 }, (_, y) => ({
      year: y,
      보수적: +(base * Math.pow(1.10, y)).toFixed(2),
      단기CAGR: +(base * Math.pow(1 + gS / 100, y)).toFixed(2),
      장기CAGR: +(base * Math.pow(1 + gL / 100, y)).toFixed(2),
      애널추정: +(base * Math.pow(1 + gA / 100, y)).toFixed(2),
      텐배거:  +(base * 10).toFixed(2),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eps, cagrData, analysis])

  const tenBagger = useMemo(() => {
    const g = cagrData.long.eps
    if (!g || g <= 0) return null
    return Math.ceil(Math.log(10) / Math.log(1 + g / 100))
  }, [cagrData])

  // ── 셀 업데이트 헬퍼 ───────────────────────────────────────────────────────
  const updCell = (
    arr: (number | null)[],
    setArr: React.Dispatch<React.SetStateAction<(number | null)[]>>,
    idx: number, val: number | null
  ) => { const next = [...arr]; next[idx] = val; setArr(next) }

  // ── 보여줄 연도 ────────────────────────────────────────────────────────────
  const displayYears = years.length === 8 ? years : (() => {
    const cy = new Date().getFullYear(), base = cy - 4
    return Array.from({ length: 8 }, (_, i) => {
      const y = base + i; return y >= cy ? `${String(y).slice(2)}(E)` : String(y)
    })
  })()

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.txt, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', padding: '28px 24px 60px' }}>
      <style>{`
        @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        input[type=number] { -moz-appearance:textfield }
      `}</style>

      {/* ═════ 헤더 ═════ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.gld, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          📊 CHOIIL VALUE ANALYSIS
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.4px' }}>최일 가치분석</h1>
        <p style={{ fontSize: 13, color: T.mut, margin: 0 }}>
          CAGR 성장률 기반 PEG 분석 · 적정주가 산출 · 20년 미래 시뮬레이션
        </p>
      </div>

      {/* ═════ [1단] 종목 선택 ═════ */}
      <div style={C({ padding: '20px 24px', marginBottom: 16 })}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* 보유 종목 + 직접 입력 */}
          <div style={{ flex: 2, minWidth: 220 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.mut, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              종목 선택 / 티커 입력
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {investments.length > 0 && (
                <select onChange={e => {
                  const inv = investments.find(i => i.id === e.target.value)
                  if (inv) { setTicker(inv.ticker); setMarket(inv.market === 'KR' ? 'KR' : 'US') }
                }} style={{ background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 8, color: T.sub, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
                  <option value="">보유 종목</option>
                  {investments.map(i => <option key={i.id} value={i.id}>{i.name} ({i.ticker})</option>)}
                </select>
              )}
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && startAnalysis()}
                placeholder="NVDA, AAPL, 005930 …"
                style={{ flex: 1, background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 8, color: T.txt, padding: '9px 14px', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>
          {/* 시장 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.mut, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>시장</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['US', 'KR'] as const).map(m => (
                <button key={m} onClick={() => setMarket(m)} style={{
                  padding: '9px 20px', borderRadius: 8,
                  border: `1px solid ${market === m ? T.gld : T.bd}`,
                  background: market === m ? `${T.gld}18` : 'transparent',
                  color: market === m ? T.gld : T.mut, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>{m}</button>
              ))}
            </div>
          </div>
          {/* 분석 버튼 */}
          <button onClick={startAnalysis} disabled={loading || !ticker.trim()} style={{
            padding: '10px 32px', borderRadius: 8,
            background: loading ? T.card : `linear-gradient(135deg,#1e40af,${T.dn})`,
            color: T.txt, fontWeight: 800, fontSize: 14, border: 'none',
            cursor: loading || !ticker.trim() ? 'not-allowed' : 'pointer', alignSelf: 'flex-end',
          }}>
            {loading ? '⏳ 조회 중…' : '🔍 분석 시작'}
          </button>
        </div>

        {/* 에러 배너 */}
        {apiErr && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#2d1500', border: `1px solid ${T.gld}55`, borderRadius: 8, fontSize: 12, color: T.gld, lineHeight: 1.6 }}>
            {apiErr}
          </div>
        )}
      </div>

      {/* 종목 기본 정보 */}
      {(fin || loading) && (
        <div style={C({ padding: '14px 24px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' })}>
          {loading ? (
            <>
              <div><Sk h={18} w={160} r={4}/><Sk h={11} w={80} r={3} /></div>
              {[100,80,60,80].map((w,i) => <div key={i}><Sk h={11} w={40} r={3}/><Sk h={16} w={w} r={4}/></div>)}
            </>
          ) : fin ? (
            <>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{fin.name}</div>
                <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{fin.ticker} · {fin.currency} · {fin.unit}</div>
              </div>
              {[
                { label: '현재가',   val: fmt$(fin.currentPrice, fin.currency) },
                { label: 'PER',      val: fin.currentPER ? `${fin.currentPER.toFixed(1)}배` : '—' },
                { label: '발행주식', val: fin.shares > 0 ? `${(fin.shares / 1e6).toFixed(0)}M주` : '—' },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: T.mut, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.gld }}>{val}</div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* ═════ [2단] 재무 데이터 테이블 ═════ */}
      {(fin || loading || years.length > 0) && (
        <div style={C({ padding: '20px 24px', marginBottom: 16, overflowX: 'auto' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              📋 재무 데이터 <span style={{ fontSize: 11, color: T.mut }}>({fin?.unit ?? (market === 'KR' ? '억원' : 'B USD')})</span>
            </div>
            <div style={{ fontSize: 11, color: T.est }}>회색 = 추정치(E) · 셀 클릭으로 직접 수정 가능</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#2a2d3a' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: T.sub, fontWeight: 700, fontSize: 11, width: 100 }}>항목</th>
                {displayYears.map((y, i) => (
                  <th key={i} style={{ padding: '10px 8px', textAlign: 'right', color: y.includes('E') ? T.est : T.sub, fontWeight: 700, fontSize: 11 }}>
                    {loading ? <Sk h={12} w={40} r={3}/> : y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'EPS',    data: eps,  set: setEps,  color: T.grn },
                { label: '영업이익', data: oi,  set: setOi,   color: T.dn  },
                { label: '매출액',  data: rev,  set: setRev,  color: T.gld },
              ].map(({ label, data, set, color }, ri) => (
                <tr key={label} style={{ borderTop: `1px solid ${T.bd}`, background: ri % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '7px 14px', fontWeight: 700, color, fontSize: 12 }}>{label}</td>
                  {displayYears.map((y, ci) => (
                    <td key={ci} style={{ padding: '4px 4px', textAlign: 'right' }}>
                      <Cell
                        value={data[ci] ?? null}
                        isEst={y.includes('E')}
                        onChange={v => updCell(data, set, ci, v)}
                        loading={loading}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═════ [3단] CAGR 분석 ═════ */}
      {(fin || eps.some(v => v != null)) && (
        <div style={C({ padding: '20px 24px', marginBottom: 16 })}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📈 CAGR 성장률 자동 계산</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.bd}` }}>
            {['항목', '장기 7년 CAGR', '단기 3년 CAGR'].map(h => (
              <div key={h} style={{ background: '#2a2d3a', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: T.sub }}>{h}</div>
            ))}
            {[
              { label: 'EPS',    long: cagrData.long.eps, short: cagrData.short.eps, color: T.grn },
              { label: '영업이익', long: cagrData.long.oi,  short: cagrData.short.oi,  color: T.dn  },
              { label: '매출액',  long: cagrData.long.rev, short: cagrData.short.rev, color: T.gld },
            ].flatMap(({ label, long: l, short: s, color }) => [
              <div key={label} style={{ padding: '10px 16px', fontWeight: 700, color, borderTop: `1px solid ${T.bd}`, fontSize: 13 }}>{label}</div>,
              <div key={`${label}-l`} style={{ padding: '10px 16px', fontWeight: 800, borderTop: `1px solid ${T.bd}`, fontSize: 16, color: l != null ? T.txt : T.mut }}>
                {l != null ? `${l > 0 ? '+' : ''}${l.toFixed(1)}%` : '—'}
              </div>,
              <div key={`${label}-s`} style={{ padding: '10px 16px', fontWeight: 800, borderTop: `1px solid ${T.bd}`, fontSize: 16,
                color: s != null && l != null ? (s >= l ? T.grn : '#fb923c') : T.mut }}>
                {s != null ? `${s > 0 ? '+' : ''}${s.toFixed(1)}%` : '—'}
              </div>,
            ])}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              cagrData.short.eps != null && cagrData.long.eps != null
                ? cagrData.short.eps >= cagrData.long.eps
                  ? { text: '✅ EPS 성장 가속 (단기 > 장기)', c: T.grn }
                  : { text: '⚠️ EPS 성장 둔화 (단기 < 장기)', c: '#fb923c' }
                : null,
              cagrData.long.eps != null && cagrData.long.oi != null && cagrData.long.eps > cagrData.long.oi
                ? { text: '✅ EPS성장 > 영업이익성장 → 수익성 개선', c: T.grn } : null,
            ].filter(Boolean).map((item, i) => item && (
              <div key={i} style={{ padding: '5px 12px', background: `${item.c}15`, border: `1px solid ${item.c}44`, borderRadius: 6, fontSize: 12, color: item.c }}>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════ [4단] PEG 분석 + 적정주가 ═════ */}
      {analysis && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>🎯 PEG 분석</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: T.mut }}>시장 PER 조정:</span>
              <input type="number" value={perInput} onChange={e => setPerInput(e.target.value)}
                style={{ width: 68, background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 6, color: T.txt, padding: '4px 8px', fontSize: 13, textAlign: 'center', outline: 'none' }}/>
              <span style={{ fontSize: 12, color: T.mut }}>배</span>
            </div>
          </div>

          {/* 4개 시나리오 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
            {analysis.scenarios.map((s, i) => {
              const rCol  = s.color
              const rLabel = s.ratingLabel
              const emoji  = s.emoji
              return (
                <div key={i} style={C({ padding: '18px 20px', borderTop: `3px solid ${rCol}` })}>
                  <div style={{ fontSize: 11, color: T.mut, marginBottom: 8 }}>{s.scenLabel}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    {[
                      { lab: 'PER', val: s.per, col: T.txt },
                      { lab: '성장률', val: analysis.cagrEps ? `${analysis.cagrEps.toFixed(1)}%` : '—', col: T.grn },
                      { lab: 'PEG', val: s.peg ?? '—', col: rCol },
                    ].map(({ lab, val, col }) => (
                      <div key={lab} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: T.mut, marginBottom: 2 }}>{lab}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '6px 10px', background: `${rCol}18`, borderRadius: 6, fontSize: 12, color: rCol, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
                    {emoji} {rLabel}
                  </div>
                  {analysis.fwdEps > 0 && (
                    <div style={{ fontSize: 11, color: T.sub, textAlign: 'right' }}>
                      적정주가: <span style={{ color: T.txt, fontWeight: 700 }}>{fmt$(analysis.fwdEps * s.per, analysis.cur)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 적정주가 종합 */}
          <div style={C({ padding: '20px 24px' })}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>💰 적정주가 산출 (시장 PER 기준)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'EPS 기반',      val: analysis.fvEPS, note: `fwd EPS × PER ${analysis.perMkt.toFixed(1)}` },
                { label: '영업이익 기반',  val: analysis.fvOI  > 0 ? analysis.fvOI  : null, note: '(OI/주식수) × PER' },
                { label: '매출 기반(PSR×2)', val: analysis.fvRev > 0 ? analysis.fvRev : null, note: '(Rev/주식수) × 2' },
                { label: '평균 적정주가',  val: analysis.avgFV > 0 ? analysis.avgFV : null, note: '3가지 평균', hl: true },
              ].map(({ label, val, note, hl }) => (
                <div key={label} style={C({ padding: '14px 16px', border: hl ? `1px solid ${T.gld}44` : undefined })}>
                  <div style={{ fontSize: 10, color: T.mut, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: hl ? 20 : 16, fontWeight: 900, color: hl ? T.gld : T.txt }}>
                    {val ? fmt$(val, analysis.cur) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{note}</div>
                </div>
              ))}
            </div>
            {/* 게이지 */}
            {analysis.avgFV > 0 && fin?.currentPrice && fin.currentPrice > 0 && (
              <>
                <div style={{ fontSize: 11, color: T.mut, marginBottom: 6 }}>
                  현재 {fmt$(fin.currentPrice, analysis.cur)} vs 적정 {fmt$(analysis.avgFV, analysis.cur)}
                  <span style={{ marginLeft: 10, color: analysis.upside >= 0 ? T.grn : T.up, fontWeight: 700 }}>
                    {analysis.upside >= 0 ? '▲' : '▼'} {Math.abs(analysis.upside).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 12, background: '#2a2d3a', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  {(() => {
                    const mn = Math.min(fin.currentPrice, analysis.avgFV) * 0.8
                    const mx = Math.max(fin.currentPrice, analysis.avgFV) * 1.2
                    const pc = ((fin.currentPrice - mn) / (mx - mn)) * 100
                    const pf = ((analysis.avgFV     - mn) / (mx - mn)) * 100
                    return (
                      <>
                        <div style={{ position: 'absolute', left: 0, width: `${Math.min(pc, pf)}%`, height: '100%', background: `linear-gradient(90deg,${T.dn},${T.grn})` }}/>
                        <div style={{ position: 'absolute', left: `${pc}%`, width: 3, height: '100%', background: T.txt, transform: 'translateX(-50%)' }}/>
                        <div style={{ position: 'absolute', left: `${pf}%`, width: 3, height: '100%', background: T.gld, transform: 'translateX(-50%)' }}/>
                      </>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: T.mut }}>
                  <span>■ 현재가</span><span style={{ color: T.gld }}>■ 적정가</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═════ [5단] 20년 시뮬레이션 ═════ */}
      {simData.length > 0 && (analysis || eps.some(v => v != null)) && (
        <div style={C({ padding: '20px 24px', marginBottom: 16 })}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔭 20년 미래 EPS 시뮬레이션</div>
            {tenBagger && <div style={{ fontSize: 12, color: T.gld }}>⭐ 텐배거 도달 예상: 장기 CAGR 기준 약 {tenBagger}년 후</div>}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={simData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.bd} vertical={false}/>
              <XAxis dataKey="year" tick={{ fill: T.mut, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}년`}/>
              <YAxis tick={{ fill: T.mut, fontSize: 10 }} axisLine={false} tickLine={false}/>
              <RTooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.bd}`, borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${(v as number).toFixed(2)}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <ReferenceLine y={simData[0]?.텐배거} stroke={T.gld} strokeDasharray="4 2"
                label={{ value: '10배', fill: T.gld, fontSize: 10 }}/>
              <Line type="monotone" dataKey="보수적"  stroke="#6b7280"  strokeWidth={1.5} dot={false}/>
              <Line type="monotone" dataKey="단기CAGR" stroke={T.dn}     strokeWidth={2}   dot={false}/>
              <Line type="monotone" dataKey="장기CAGR" stroke={T.grn}    strokeWidth={2.5} dot={false}/>
              <Line type="monotone" dataKey="애널추정" stroke={T.up}     strokeWidth={2}   dot={false} strokeDasharray="5 3"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═════ [6단] 종합 판단 ═════ */}
      {scoreData && (
        <div style={C({ padding: '24px 28px' })}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🏆 종합 판단</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
            {/* 점수 원 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: scoreData.verdict.bg, border: `3px solid ${scoreData.verdict.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: scoreData.verdict.color }}>{scoreData.pts}</div>
                <div style={{ fontSize: 10, color: scoreData.verdict.color, opacity: 0.7 }}>/ 100</div>
              </div>
              <div style={{ height: 8, background: '#2a2d3a', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${scoreData.pts}%`, height: '100%', background: `linear-gradient(90deg,${T.up},${T.gld},${T.grn})`, backgroundSize: '200% 100%', backgroundPosition: `${100 - scoreData.pts}% 0` }}/>
              </div>
            </div>
            {/* 판단 */}
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: scoreData.verdict.color, marginBottom: 12 }}>
                {scoreData.verdict.text}
              </div>
              {scoreData.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: T.sub, display: 'flex', gap: 8, marginBottom: 5 }}>
                  <span style={{ color: T.gld, flexShrink: 0 }}>·</span>{r}
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 14px', background: `${scoreData.verdict.color}10`, border: `1px solid ${scoreData.verdict.color}33`, borderRadius: 8, fontSize: 13, color: T.sub, lineHeight: 1.7 }}>
                {scoreData.reasons.join('  /  ')}.{' '}
                총점 <strong style={{ color: scoreData.verdict.color }}>{scoreData.pts}점</strong>으로{' '}
                <strong style={{ color: scoreData.verdict.color }}>{scoreData.verdict.text}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 초기 빈 화면 */}
      {!fin && !loading && eps.every(v => v == null) && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: T.mut }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: T.sub }}>종목을 선택하고 분석을 시작하세요</div>
          <div style={{ fontSize: 13 }}>NVDA · AAPL · 005930 (삼성전자) 등 지원</div>
        </div>
      )}
    </div>
  )
}
