'use client'

/**
 * /valuation — 최일 가치분석
 * 6단계 성장주 분석 : 재무조회 → CAGR → PEG → 적정주가 → 20년 시뮬 → 종합판단
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

// ── Design tokens ──────────────────────────────────────────────────────────
const BG   = '#0f1117'
const CARD = '#1a1d27'
const BD   = '#2a2d3a'
const UP   = '#ef4444'
const DN   = '#3b82f6'
const GRN  = '#34d399'
const GLD  = '#fbbf24'
const MUT  = '#6b7280'
const TXT  = '#f1f5f9'
const SUB  = '#94a3b8'

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: CARD, border: `0.5px solid ${BD}`, borderRadius: 12, ...extra,
})
const label = (color = MUT): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', marginBottom: 6,
})

// ── Types ──────────────────────────────────────────────────────────────────
interface FinData {
  ticker: string; name: string; currency: 'USD' | 'KRW'
  currentPrice: number; marketCap: number; shares: number
  currentPER: number | null; forwardEPS: number | null
  years: string[]
  eps: (number | null)[]; oi: (number | null)[]; rev: (number | null)[]
  unit: string
}
interface Investment { id: string; ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO' }

// ── CAGR 계산 ──────────────────────────────────────────────────────────────
function calcCagrSafe(start: number | null, end: number | null, yrs: number): number | null {
  if (!start || !end || start <= 0 || end <= 0) return null
  return (Math.pow(end / start, 1 / yrs) - 1) * 100
}

// ── PEG 평가 ───────────────────────────────────────────────────────────────
function pegLabel(peg: number | null): { text: string; color: string; emoji: string } {
  if (peg == null) return { text: '계산불가', color: MUT, emoji: '⚪' }
  if (peg < 1.0) return { text: '저평가 (강력 매수)', color: GRN, emoji: '🟢' }
  if (peg < 1.5) return { text: '적정', color: GLD, emoji: '🟡' }
  if (peg < 2.0) return { text: '약간 고평가', color: '#fb923c', emoji: '🟠' }
  return { text: '고평가', color: UP, emoji: '🔴' }
}

// ── 숫자 포맷 ──────────────────────────────────────────────────────────────
const fmtB = (n: number | null, currency: string) => {
  if (n == null) return '—'
  if (currency === 'KRW') return n >= 1e8 ? `${(n / 1e8).toFixed(0)}조` : `${n.toFixed(0)}억원`
  return n >= 1e3 ? `$${(n / 1e3).toFixed(1)}B` : `$${n.toFixed(0)}M`
}
const fmtPrice = (n: number, currency: string) =>
  currency === 'KRW' ? `₩${Math.round(n).toLocaleString('ko-KR')}` : `$${n.toFixed(2)}`

// ──────────────────────────────────────────────────────────────────────────
export default function ValuationPage() {
  // ── 상태 ──
  const [investments, setInvestments] = useState<Investment[]>([])
  const [ticker,      setTicker]      = useState('')
  const [market,      setMarket]      = useState<'US' | 'KR'>('US')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [fin,         setFin]         = useState<FinData | null>(null)
  // 편집 가능 테이블
  const [editEps, setEditEps] = useState<(number | null)[]>([])
  const [editOi,  setEditOi]  = useState<(number | null)[]>([])
  const [editRev, setEditRev] = useState<(number | null)[]>([])
  // PEG 사용자 PER 입력
  const [customPER, setCustomPER] = useState<string>('')

  // ── 보유 종목 로드 ──
  useEffect(() => {
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('investments').select('id,ticker,name,market').eq('user_id', user.id)
      setInvestments((data ?? []).filter(i => i.market !== 'CRYPTO') as Investment[])
    })()
  }, [])

  // ── 기본 8년 연도 배열 생성 ──
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const makeDefaultYears = useCallback((_mkt?: 'US' | 'KR') => {
    const currentYear = new Date().getFullYear()
    const baseYear    = currentYear - 4
    return Array.from({ length: 8 }, (_, i) => {
      const y = baseYear + i
      return y >= currentYear ? `${String(y).slice(2)}(E)` : String(y)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 분석 시작 ──
  const startAnalysis = useCallback(async () => {
    if (!ticker.trim()) { setError('티커를 입력하세요'); return }
    setLoading(true); setError(null)

    // API 실패해도 빈 테이블을 먼저 표시 (사용자 직접 입력 가능)
    const emptyYears = makeDefaultYears(market)
    const emptyData: FinData = {
      ticker: ticker.trim().toUpperCase(),
      name:   ticker.trim().toUpperCase(),
      currency: market === 'KR' ? 'KRW' : 'USD',
      currentPrice: 0, marketCap: 0, shares: 0,
      currentPER: null, forwardEPS: null,
      years: emptyYears,
      eps:  Array(8).fill(null),
      oi:   Array(8).fill(null),
      rev:  Array(8).fill(null),
      unit: market === 'KR' ? '억원' : 'M USD',
    }

    try {
      const res = await fetch(
        `/api/financials?ticker=${encodeURIComponent(ticker.trim())}&market=${market}`,
        { signal: AbortSignal.timeout(20000) }   // 20초 타임아웃
      )

      // HTTP 에러도 JSON 파싱 시도 (API가 항상 JSON 반환)
      const data = await res.json().catch(() => emptyData)

      // API가 error 필드를 포함해도 데이터는 사용 (빈 구조라도 표시)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiError = (data as any).error as string | undefined | null
      if (apiError) {
        setError(`⚠️ ${apiError} — 아래 표에 수동으로 데이터를 입력하세요`)
      }

      // 안전한 배열 추출 (길이 보장)
      const safeArr = (arr: unknown): (number | null)[] => {
        if (!Array.isArray(arr)) return Array(8).fill(null)
        const result = arr.slice(0, 8).map(v =>
          (typeof v === 'number' && isFinite(v)) ? v : null
        )
        while (result.length < 8) result.push(null)
        return result
      }

      const safeData: FinData = {
        ticker:       String(data?.ticker       ?? emptyData.ticker),
        name:         String(data?.name         ?? emptyData.name),
        currency:     (data?.currency === 'KRW' ? 'KRW' : 'USD') as 'USD' | 'KRW',
        currentPrice: Number(data?.currentPrice ?? 0) || 0,
        marketCap:    Number(data?.marketCap    ?? 0) || 0,
        shares:       Number(data?.shares       ?? 0) || 0,
        currentPER:   typeof data?.currentPER === 'number' ? data.currentPER : null,
        forwardEPS:   typeof data?.forwardEPS   === 'number' ? data.forwardEPS : null,
        years:        Array.isArray(data?.years) && data.years.length === 8
                        ? data.years : emptyYears,
        eps:          safeArr(data?.eps),
        oi:           safeArr(data?.oi),
        rev:          safeArr(data?.rev),
        unit:         String(data?.unit ?? emptyData.unit),
      }

      setFin(safeData)
      setEditEps([...safeData.eps])
      setEditOi([...safeData.oi])
      setEditRev([...safeData.rev])
      setCustomPER(safeData.currentPER != null ? safeData.currentPER.toFixed(1) : '')

    } catch (e) {
      // 네트워크 오류 등: 빈 테이블만 표시하고 수동 입력 유도
      const msg = (e as Error).message?.includes('timeout')
        ? '⏱ 조회 시간 초과 — 아래 표에 수동으로 입력하세요'
        : `⚠️ 네트워크 오류 — 아래 표에 수동으로 입력하세요 (${(e as Error).message})`
      setError(msg)
      setFin(emptyData)
      setEditEps(Array(8).fill(null))
      setEditOi(Array(8).fill(null))
      setEditRev(Array(8).fill(null))
    } finally {
      setLoading(false)
    }
  }, [ticker, market, makeDefaultYears])

  // ── CAGR 계산 (적자/0/NaN 완전 방어) ──
  const cagr = useMemo(() => {
    if (!fin) return null

    // 배열 길이 보장 (혹시 8개 미만이면 null로 채움)
    const safe = (arr: (number | null)[]): (number | null)[] => {
      const r = [...arr]
      while (r.length < 8) r.push(null)
      return r
    }
    const eps = safe(editEps), oi = safe(editOi), rev = safe(editRev)

    // 양수 값만 찾는 헬퍼
    const firstPositive = (arr: (number | null)[], from: number) => {
      for (let i = from; i < arr.length; i++) {
        const v = arr[i]; if (v != null && v > 0) return v
      }
      return null
    }

    // 장기 7년: 첫 번째 양수 → idx7
    const e7 = calcCagrSafe(firstPositive(eps, 0), eps[7], 7)
    const o7 = calcCagrSafe(firstPositive(oi,  0), oi[7],  7)
    const r7 = calcCagrSafe(firstPositive(rev, 0), rev[7], 7)
    // 단기 3년: idx4(최신실적) → idx7
    const e3 = calcCagrSafe(eps[4] ?? firstPositive(eps, 3), eps[7], 3)
    const o3 = calcCagrSafe(oi[4]  ?? firstPositive(oi,  3), oi[7],  3)
    const r3 = calcCagrSafe(rev[4] ?? firstPositive(rev, 3), rev[7], 3)

    return { long: { eps: e7, oi: o7, rev: r7 }, short: { eps: e3, oi: o3, rev: r3 } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEps, editOi, editRev, fin])

  // ── PEG & 적정주가 (완전 방어) ──
  const analysis = useMemo(() => {
    if (!fin) return null

    const cagrEps   = cagr?.long?.eps ?? null
    const per15 = 15, per25 = 25, per50 = 50
    const perMarketRaw = parseFloat(customPER)
    const perMarket    = isFinite(perMarketRaw) && perMarketRaw > 0
      ? perMarketRaw : (fin.currentPER ?? 25)

    const mkPeg = (per: number) => ({
      per,
      peg: cagrEps != null && isFinite(cagrEps) && cagrEps > 0
        ? parseFloat((per / cagrEps).toFixed(2)) : null,
    })

    // Forward EPS: E컬럼 마지막 유효값, 없으면 API forwardEPS
    const fwdEps = editEps?.filter(v => v != null && isFinite(v!)).at(-1)
      ?? fin.forwardEPS
      ?? 0
    const latestOI  = editOi?.filter(v => v != null && isFinite(v!)).at(-1)  ?? 0
    const latestRev = editRev?.filter(v => v != null && isFinite(v!)).at(-1) ?? 0
    const shares    = fin.shares > 0 ? fin.shares : 1e7  // 기본 1000만주 fallback

    const fv = (eps: number, per: number) =>
      isFinite(eps) && isFinite(per) && eps > 0 ? eps * per : 0

    const fv15 = fv(fwdEps, per15)
    const fv25 = fv(fwdEps, per25)
    const fvM  = fv(fwdEps, perMarket)

    // OI 기반 (억원→원/주 또는 M USD→$/주)
    const perShareOI = fin.currency === 'KRW'
      ? (latestOI * 1e8) / shares
      : (latestOI * 1e6) / shares
    const fvOI = isFinite(perShareOI) && perShareOI > 0 ? perShareOI * perMarket : 0

    // Rev 기반 PSR × 2
    const perShareRev = fin.currency === 'KRW'
      ? (latestRev * 1e8) / shares
      : (latestRev * 1e6) / shares
    const fvPSR = isFinite(perShareRev) && perShareRev > 0 ? perShareRev * 2 : 0

    const validFVs = [fvM, fvOI, fvPSR].filter(v => isFinite(v) && v > 0)
    const avgFV    = validFVs.length
      ? validFVs.reduce((a, b) => a + b, 0) / validFVs.length : 0
    const upside   = fin.currentPrice > 0 && avgFV > 0
      ? (avgFV / fin.currentPrice - 1) * 100 : 0

    return {
      scenarios: [
        { label: '보수적 (PER 15)',               ...mkPeg(per15),     fv: fv15 },
        { label: '적정 (PER 25)',                  ...mkPeg(per25),     fv: fv25 },
        { label: '성장주 (PER 50)',                ...mkPeg(per50),     fv: fv(fwdEps, per50) },
        { label: `시장 PER (${perMarket.toFixed(1)})`, ...mkPeg(perMarket), fv: fvM },
      ],
      fvEPS: fvM, fvOI, fvPSR, avgFV, upside,
      fwdEps, cagrEps, perMarket,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, cagr, customPER, editEps, editOi, editRev])

  // ── 종합 점수 ──
  const score = useMemo(() => {
    if (!analysis || !cagr) return null
    let pts = 0; const reasons: string[] = []

    // PEG 40점
    const peg = analysis.scenarios[3].peg
    if (peg != null) {
      if (peg < 1.0) { pts += 40; reasons.push(`PEG ${peg.toFixed(2)}로 저평가 상태 (40점)`) }
      else if (peg < 1.5) { pts += 30; reasons.push(`PEG ${peg.toFixed(2)}로 적정 수준 (30점)`) }
      else if (peg < 2.0) { pts += 15; reasons.push(`PEG ${peg.toFixed(2)}로 약간 고평가 (15점)`) }
      else reasons.push(`PEG ${peg.toFixed(2)}로 고평가 (0점)`)
    }

    // 상승여력 30점
    const up = analysis.upside
    if (up > 30)       { pts += 30; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (30점)`) }
    else if (up > 10)  { pts += 20; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (20점)`) }
    else if (up > 0)   { pts += 10; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 소폭 상승여력 (10점)`) }
    else reasons.push(`적정주가 대비 ${up.toFixed(0)}% (0점)`)

    // 성장률 안정성 30점
    const ls = cagr.long.eps; const ss = cagr.short.eps
    if (ls != null && ss != null) {
      if (ss >= ls) { pts += 30; reasons.push('단기 성장률이 장기보다 높아 성장 가속 (30점)') }
      else if (ss > 0) { pts += 15; reasons.push('성장 중이나 속도 다소 둔화 (15점)') }
      else reasons.push('단기 성장 둔화 (0점)')
    }

    const verdict =
      pts >= 80 ? { text: '강력 매수 (Buy)',    color: GRN, bg: '#052e16' } :
      pts >= 60 ? { text: '매수 (Accumulate)',  color: DN,  bg: '#0c1a3a' } :
      pts >= 40 ? { text: '보유 (Hold)',         color: GLD, bg: '#2d1c00' } :
                  { text: '매수 보류 (Watch)',   color: UP,  bg: '#2d0a0a' }
    return { pts, reasons, verdict }
  }, [analysis, cagr])

  // ── 20년 시뮬레이션 데이터 ──
  const simData = useMemo(() => {
    if (!fin) return []
    const base = editEps.filter(v => v != null).at(-1) ?? 1
    const g10 = 10, gS = cagr?.short.eps ?? 15, gL = cagr?.long.eps ?? 20
    const gA = analysis?.cagrEps ?? 18
    return Array.from({ length: 21 }, (_, y) => ({
      year: y,
      conservative: parseFloat((base * Math.pow(1.1, y)).toFixed(2)),
      short:  parseFloat((base * Math.pow(1 + gS / 100, y)).toFixed(2)),
      long:   parseFloat((base * Math.pow(1 + gL / 100, y)).toFixed(2)),
      analyst: parseFloat((base * Math.pow(1 + gA / 100, y)).toFixed(2)),
      tenbagger: base * 10,
      conservative_g: g10, short_g: gS, long_g: gL, analyst_g: gA,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, cagr, analysis, editEps])

  // 텐배거 도달 연도
  const tenBaggerYears = useMemo(() => {
    if (!cagr?.long.eps || cagr.long.eps <= 0) return null
    return Math.ceil(Math.log(10) / Math.log(1 + cagr.long.eps / 100))
  }, [cagr])

  // ── 편집 셀 핸들러 ──
  const setCell = (arr: (number | null)[], setArr: React.Dispatch<React.SetStateAction<(number | null)[]>>, idx: number, val: string) => {
    const n = parseFloat(val.replace(/,/g, ''))
    const next = [...arr]; next[idx] = isFinite(n) ? n : null; setArr(next)
  }

  // ── 렌더 ──
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TXT, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', padding: '28px 24px 60px' }}>
      {/* ══ 페이지 헤더 ══ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: GLD, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          📊 CHOIIL VALUE ANALYSIS
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: TXT, margin: '0 0 8px', letterSpacing: '-0.4px' }}>
          최일 가치분석
        </h1>
        <p style={{ fontSize: 13, color: MUT, margin: 0 }}>
          성장률 기반 PEG 분석 · 적정주가 산출 · 20년 미래 시뮬레이션
        </p>
      </div>

      {/* ══ 단 1: 종목 선택 ══ */}
      <div style={{ ...card({ padding: '20px 24px', marginBottom: 16 }) }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* 보유 종목 드롭다운 + 직접 입력 */}
          <div style={{ flex: 2, minWidth: 200 }}>
            <div style={label(MUT)}>종목 선택 / 티커 입력</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {investments.length > 0 && (
                <select
                  onChange={e => {
                    const inv = investments.find(i => i.id === e.target.value)
                    if (inv) { setTicker(inv.ticker); setMarket(inv.market === 'KR' ? 'KR' : 'US') }
                  }}
                  style={{ background: '#0f1117', border: `1px solid ${BD}`, borderRadius: 8, color: SUB, padding: '9px 12px', fontSize: 13, cursor: 'pointer', minWidth: 120 }}>
                  <option value="">보유 종목</option>
                  {investments.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.ticker})</option>
                  ))}
                </select>
              )}
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && startAnalysis()}
                placeholder="NVDA, AAPL, 005930..."
                style={{ flex: 1, background: '#0f1117', border: `1px solid ${BD}`, borderRadius: 8, color: TXT, padding: '9px 14px', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>
          {/* 시장 */}
          <div style={{ minWidth: 100 }}>
            <div style={label(MUT)}>시장</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['US', 'KR'] as const).map(m => (
                <button key={m} onClick={() => setMarket(m)} style={{
                  padding: '9px 18px', borderRadius: 8, border: `1px solid ${market === m ? GLD : BD}`,
                  background: market === m ? `${GLD}18` : 'transparent',
                  color: market === m ? GLD : MUT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>{m}</button>
              ))}
            </div>
          </div>
          {/* 분석 버튼 */}
          <button
            onClick={startAnalysis}
            disabled={loading}
            style={{
              padding: '10px 28px', borderRadius: 8,
              background: loading ? '#1a1d27' : `linear-gradient(135deg, #1e40af, ${DN})`,
              color: TXT, fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none', alignSelf: 'flex-end',
            }}>
            {loading ? '⏳ 조회 중…' : '🔍 분석 시작'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#2d1500', border: `1px solid ${GLD}55`, borderRadius: 8, fontSize: 12, color: GLD, lineHeight: 1.6 }}>
            {error}
            {fin && <span style={{ marginLeft: 8, color: SUB }}>↓ 아래 표에 직접 입력하세요</span>}
          </div>
        )}
      </div>

      {/* 종목 기본 정보 */}
      {fin && (
        <div style={{ ...card({ padding: '16px 24px', marginBottom: 16, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }) }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: TXT }}>{fin.name}</div>
            <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{fin.ticker} · {fin.currency}</div>
          </div>
          {[
            { label: '현재가',   val: fmtPrice(fin.currentPrice, fin.currency) },
            { label: '시가총액', val: fmtB(fin.currency === 'KRW' ? fin.marketCap / 1e8 : fin.marketCap / 1e6, fin.currency) },
            { label: 'PER',      val: fin.currentPER ? `${fin.currentPER.toFixed(1)}배` : '—' },
            { label: '발행주식', val: fin.shares > 0 ? `${(fin.shares / 1e6).toFixed(1)}M주` : '—' },
          ].map(({ label: l, val }) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: MUT, marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: GLD }}>{val}</div>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#374151' }}>
            데이터: {fin.currency === 'KRW' ? 'Naver Finance' : 'Yahoo Finance'}
          </div>
        </div>
      )}

      {fin && (
        <>
          {/* ══ 단 2: 재무 데이터 테이블 ══ */}
          <div style={{ ...card({ padding: '20px 24px', marginBottom: 16, overflowX: 'auto' }) }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 4 }}>📋 재무 데이터 ({fin.unit})</div>
            <div style={{ fontSize: 11, color: MUT, marginBottom: 14 }}>셀 클릭 후 직접 편집 가능 · 회색 연도: 추정치(E)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#2a2d3a' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: SUB, fontWeight: 700, fontSize: 11, width: 110 }}>항목</th>
                  {fin.years.map((y, i) => (
                    <th key={i} style={{ padding: '10px 10px', textAlign: 'right', color: y.includes('E') ? '#6b7280' : SUB, fontWeight: 700, fontSize: 11 }}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'EPS',   data: editEps, set: setEditEps, color: GRN },
                  { label: '영업이익', data: editOi,  set: setEditOi,  color: DN  },
                  { label: '매출액', data: editRev, set: setEditRev, color: GLD },
                ].map(({ label: l, data, set, color }, ri) => (
                  <tr key={l} style={{ borderTop: `1px solid ${BD}`, background: ri % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 700, color, fontSize: 12 }}>{l}</td>
                    {data.map((v, ci) => (
                      <td key={ci} style={{ padding: '4px 4px', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={v ?? ''}
                          onChange={e => setCell(data, set, ci, e.target.value)}
                          style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            textAlign: 'right', color: fin.years?.[ci]?.includes('E') ? '#6b7280' : TXT,
                            fontSize: 12, padding: '4px 6px', fontFamily: 'monospace',
                          }}
                          placeholder="—"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══ 단 3: CAGR 분석 ══ */}
          {cagr && (
            <div style={{ ...card({ padding: '20px 24px', marginBottom: 16 }) }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 14 }}>📈 CAGR 성장률 분석</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 0, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BD}` }}>
                {/* 헤더 */}
                {['항목', '장기 7년 CAGR', '단기 3년 CAGR'].map(h => (
                  <div key={h} style={{ background: '#2a2d3a', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: SUB }}>{h}</div>
                ))}
                {/* 데이터 행 */}
                {[
                  { label: 'EPS',   long: cagr.long.eps, short: cagr.short.eps, color: GRN },
                  { label: '영업이익', long: cagr.long.oi,  short: cagr.short.oi,  color: DN  },
                  { label: '매출액', long: cagr.long.rev, short: cagr.short.rev, color: GLD },
                ].map(({ label: l, long, short, color }, i) => (
                  [
                    <div key={`lbl-${i}`} style={{ padding: '10px 16px', fontWeight: 700, color, borderTop: `1px solid ${BD}`, fontSize: 13 }}>{l}</div>,
                    <div key={`long-${i}`} style={{ padding: '10px 16px', fontWeight: 800, color: long != null ? TXT : MUT, borderTop: `1px solid ${BD}`, fontSize: 16 }}>
                      {long != null ? `${long.toFixed(1)}%` : '—'}
                    </div>,
                    <div key={`short-${i}`} style={{ padding: '10px 16px', fontWeight: 800, borderTop: `1px solid ${BD}`, fontSize: 16,
                      color: long != null && short != null ? (short >= long ? GRN : '#fb923c') : MUT }}>
                      {short != null ? `${short.toFixed(1)}%` : '—'}
                    </div>,
                  ]
                ))}
              </div>
              {/* 해석 */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  cagr.short.eps != null && cagr.long.eps != null
                    ? cagr.short.eps >= cagr.long.eps
                      ? { text: '✅ EPS 성장 가속화 (단기 > 장기)', color: GRN }
                      : { text: '⚠️ EPS 성장 둔화 (단기 < 장기)', color: '#fb923c' }
                    : null,
                  cagr.long.eps != null && cagr.long.oi != null && cagr.long.eps > cagr.long.oi
                    ? { text: '✅ EPS 성장 > 영업이익 성장 → 수익성 개선', color: GRN } : null,
                ].filter(Boolean).map((item, i) => item && (
                  <div key={i} style={{ padding: '6px 12px', background: `${item.color}15`, border: `1px solid ${item.color}44`, borderRadius: 6, fontSize: 12, color: item.color }}>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ 단 4: PEG 분석 + 적정주가 ══ */}
          {analysis && (
            <div style={{ marginBottom: 16 }}>
              {/* PER 입력 */}
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TXT }}>🎯 PEG 분석</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 12, color: MUT }}>시장 PER 조정:</span>
                  <input
                    type="number"
                    value={customPER}
                    onChange={e => setCustomPER(e.target.value)}
                    style={{ width: 70, background: '#0f1117', border: `1px solid ${BD}`, borderRadius: 6, color: TXT, padding: '4px 8px', fontSize: 13, textAlign: 'center' }}
                    placeholder={fin.currentPER?.toFixed(1) ?? '25'}
                  />
                  <span style={{ fontSize: 12, color: MUT }}>배</span>
                </div>
              </div>

              {/* 4개 시나리오 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
                {analysis.scenarios.map((s, i) => {
                  const { text, color, emoji } = pegLabel(s.peg)
                  return (
                    <div key={i} style={{ ...card({ padding: '18px 20px', borderTop: `3px solid ${color}` }) }}>
                      <div style={{ fontSize: 11, color: MUT, marginBottom: 8 }}>{s.label}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 10, color: MUT }}>PER</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: TXT }}>{s.per}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: MUT }}>성장률</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: GRN }}>{cagr?.long.eps?.toFixed(1) ?? '—'}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: MUT }}>PEG</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color }}>{s.peg?.toFixed(2) ?? '—'}</div>
                        </div>
                      </div>
                      <div style={{ padding: '6px 10px', background: `${color}15`, borderRadius: 6, fontSize: 12, color, fontWeight: 600, textAlign: 'center' }}>
                        {emoji} {text}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: SUB, textAlign: 'right' }}>
                        적정주가: <span style={{ color: TXT, fontWeight: 700 }}>{fmtPrice(s.fv, fin.currency)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 적정주가 종합 */}
              <div style={{ ...card({ padding: '20px 24px' }) }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 14 }}>💰 적정주가 산출 (시장 PER 기준)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'EPS 기반',   val: analysis.fvEPS,   note: `fwd EPS × PER` },
                    { label: '영업이익 기반', val: analysis.fvOI > 0 ? analysis.fvOI : null, note: '(OI/주식수) × PER' },
                    { label: '매출 기반 (PSR×2)', val: analysis.fvPSR > 0 ? analysis.fvPSR : null, note: '(Rev/주식수) × 2' },
                    { label: '평균 적정주가', val: analysis.avgFV, note: '3가지 평균', highlight: true },
                  ].map(({ label: l, val, note, highlight }) => (
                    <div key={l} style={{ ...card({ padding: '14px 16px', border: highlight ? `1px solid ${GLD}44` : undefined }) }}>
                      <div style={{ fontSize: 10, color: MUT, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: highlight ? 20 : 16, fontWeight: 900, color: highlight ? GLD : TXT }}>
                        {val ? fmtPrice(val, fin.currency) : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: '#374151', marginTop: 3 }}>{note}</div>
                    </div>
                  ))}
                </div>
                {/* 게이지 */}
                {analysis.avgFV > 0 && fin.currentPrice > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: MUT, marginBottom: 8 }}>
                      현재가 {fmtPrice(fin.currentPrice, fin.currency)} vs 평균 적정가 {fmtPrice(analysis.avgFV, fin.currency)}
                      <span style={{ marginLeft: 10, color: analysis.upside >= 0 ? GRN : UP, fontWeight: 700 }}>
                        {analysis.upside >= 0 ? '▲' : '▼'} {Math.abs(analysis.upside).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 12, background: '#2a2d3a', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      {/* 현재가 위치 */}
                      {(() => {
                        const min = Math.min(fin.currentPrice, analysis.avgFV) * 0.7
                        const max = Math.max(fin.currentPrice, analysis.avgFV) * 1.3
                        const pctCurrent = ((fin.currentPrice - min) / (max - min)) * 100
                        const pctFair    = ((analysis.avgFV - min) / (max - min)) * 100
                        return (
                          <>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(pctCurrent, pctFair)}%`, background: `linear-gradient(90deg, ${DN}, ${GRN})` }}/>
                            <div style={{ position: 'absolute', left: `${pctCurrent}%`, top: 0, width: 3, height: '100%', background: TXT, transform: 'translateX(-50%)' }}/>
                            <div style={{ position: 'absolute', left: `${pctFair}%`, top: 0, width: 3, height: '100%', background: GLD, transform: 'translateX(-50%)' }}/>
                          </>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: MUT }}>
                      <span>■ 현재가</span><span style={{ color: GLD }}>■ 적정가</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ 단 5: 20년 미래 시뮬레이션 ══ */}
          {simData.length > 0 && (
            <div style={{ ...card({ padding: '20px 24px', marginBottom: 16 }) }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 4 }}>🔭 20년 미래 시뮬레이션 (EPS 기준)</div>
                {tenBaggerYears && <div style={{ fontSize: 12, color: GLD }}>⭐ 텐배거(10배) 예상 도달: 장기 CAGR 기준 약 {tenBaggerYears}년 후</div>}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={simData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false}/>
                  <XAxis dataKey="year" tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}년`}/>
                  <YAxis tick={{ fill: MUT, fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: `1px solid ${BD}`, borderRadius: 8, fontSize: 12 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, name: any) => {
                      const labels: Record<string, string> = {
                        conservative: '보수적(10%)', short: `단기CAGR(${cagr?.short.eps?.toFixed(0)}%)`,
                        long: `장기CAGR(${cagr?.long.eps?.toFixed(0)}%)`, analyst: `애널(${analysis?.cagrEps?.toFixed(0)}%)`,
                      }
                      return [`${(v as number).toFixed(2)}`, labels[name as string] ?? (name as string)]
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }}
                    formatter={(v: string) => {
                      const m: Record<string, string> = { conservative: '보수적(10%)', short: '단기CAGR', long: '장기CAGR', analyst: '애널추정' }
                      return m[v] ?? v
                    }}
                  />
                  <ReferenceLine y={simData[0]?.tenbagger} stroke={GLD} strokeDasharray="4 2" label={{ value: '10배', fill: GLD, fontSize: 10 }}/>
                  <Line type="monotone" dataKey="conservative" stroke="#6b7280" strokeWidth={1.5} dot={false}/>
                  <Line type="monotone" dataKey="short"        stroke={DN}      strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="long"         stroke={GRN}     strokeWidth={2.5} dot={false}/>
                  <Line type="monotone" dataKey="analyst"      stroke={UP}      strokeWidth={2} dot={false} strokeDasharray="5 3"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ══ 단 6: 종합 판단 ══ */}
          {score && (
            <div style={{ ...card({ padding: '24px 28px' }) }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 16 }}>🏆 종합 판단</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
                {/* 점수 원형 */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', background: score.verdict.bg, border: `3px solid ${score.verdict.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: score.verdict.color }}>{score.pts}</div>
                    <div style={{ fontSize: 10, color: score.verdict.color, opacity: 0.7 }}>/ 100</div>
                  </div>
                  {/* 게이지 바 */}
                  <div style={{ width: 100, height: 8, background: '#2a2d3a', borderRadius: 4, overflow: 'hidden', margin: '0 auto' }}>
                    <div style={{ width: `${score.pts}%`, height: '100%', background: `linear-gradient(90deg, ${UP}, ${GLD}, ${GRN})`, backgroundSize: '200% 100%', backgroundPosition: `${100 - score.pts}% 0` }}/>
                  </div>
                </div>
                {/* 판단 + 근거 */}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: score.verdict.color, marginBottom: 12 }}>
                    {score.verdict.text}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {score.reasons.map((r, i) => (
                      <div key={i} style={{ fontSize: 13, color: SUB, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: GLD, flexShrink: 0 }}>·</span>{r}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, padding: '10px 14px', background: `${score.verdict.color}10`, border: `1px solid ${score.verdict.color}33`, borderRadius: 8, fontSize: 13, color: SUB, lineHeight: 1.7 }}>
                    {score.reasons.join(', ')}.{' '}
                    총점 <strong style={{ color: score.verdict.color }}>{score.pts}점</strong>으로 <strong style={{ color: score.verdict.color }}>{score.verdict.text}</strong> 의견.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 빈 상태 */}
      {!fin && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: MUT }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: SUB }}>종목을 선택하고 분석을 시작하세요</div>
          <div style={{ fontSize: 13 }}>NVDA, AAPL, 005930 등 US/KR 종목 모두 지원</div>
        </div>
      )}
    </div>
  )
}
