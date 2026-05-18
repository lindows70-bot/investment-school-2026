'use client'

/**
 * /valuation — 최일 가치분석 터미널
 *
 * ─── 데이터 흐름 ────────────────────────────────────────────────────────────
 *  [1] 분석 시작 → 상태 초기화 → /api/financials fetch
 *  [2] success === true 확인 → setRawData(data)
 *  [3] useEffect [rawData]: financials 객체 → eps/oi/rev 배열 매핑
 *  [4] useMemo 연쇄: cagrData → analysis → simData → scoreData
 *
 * ─── 단위 ───────────────────────────────────────────────────────────────────
 *  KR: 영업이익·매출 = 억원 (백엔드 반환값 그대로 state 저장)
 *      적정주가 계산: oi_억원 × 1e8 ÷ shares = 원/주
 *  US: 영업이익·매출 = M USD
 *      적정주가 계산: oi_M_USD × 1e6 ÷ shares = $/주
 *
 * ─── 오류 처리 ──────────────────────────────────────────────────────────────
 *  success === false → error State → 붉은 에러 카드 표시
 *  [3단]~[7단] 전 섹션은 rawData.success === true 일 때만 렌더링
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend, ReferenceLine, ReferenceDot,
} from 'recharts'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const T = {
  bg:  '#0f1117', card:'#1a1d27', bd:  '#2a2d3a',
  up:  '#ef4444', dn:  '#3b82f6', grn: '#34d399',
  gld: '#fbbf24', mut: '#6b7280', txt: '#f1f5f9',
  sub: '#94a3b8', est: '#4b5563',
} as const

function cs(extra: React.CSSProperties = {}): React.CSSProperties {
  return { background: T.card, border: `1px solid ${T.bd}`, borderRadius: 12, ...extra }
}

// ── API 응답 타입 ─────────────────────────────────────────────────────────────
interface FinYear { eps: number; operatingProfit: number; revenue: number }
interface FinApiResponse {
  success: boolean
  error: string | null
  ticker: string
  companyName: string
  currency: 'USD' | 'KRW'
  unit: string
  currentPrice: number
  marketCap: number
  shares: number
  currentPER: number
  yearKeys: string[]
  financials: Record<string, FinYear>
}
interface InvItem {
  id: string; ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO'
}

// ── CAGR 계산 ─────────────────────────────────────────────────────────────────
function calcCagr(s: number | null, e: number | null, yrs: number): number | null {
  if (!s || !e || s <= 0 || e <= 0 || yrs <= 0) return null
  const c = (Math.pow(e / s, 1 / yrs) - 1) * 100
  return isFinite(c) ? parseFloat(c.toFixed(2)) : null
}

// ── PEG 등급 ─────────────────────────────────────────────────────────────────
function pegRating(peg: number | null) {
  if (peg == null || !isFinite(peg) || peg <= 0)
    return { label: '계산불가',          color: T.mut,     emoji: '⚪' }
  if (peg < 1.0) return { label: '저평가 (강력 매수)', color: T.grn,     emoji: '🟢' }
  if (peg < 1.5) return { label: '적정 수준',          color: T.gld,     emoji: '🟡' }
  if (peg < 2.0) return { label: '약간 고평가',         color: '#fb923c', emoji: '🟠' }
  return           { label: '고평가',                  color: T.up,      emoji: '🔴' }
}

// ── 통화 포맷 ─────────────────────────────────────────────────────────────────
function fmtP(v: number, cur: 'USD' | 'KRW'): string {
  if (cur === 'KRW') return `₩${Math.round(v).toLocaleString('ko-KR')}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────
function Sk({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: `linear-gradient(90deg, ${T.bd} 25%, #363a4a 50%, ${T.bd} 75%)`,
      backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite',
    }} />
  )
}

// ── 편집 가능 셀 ──────────────────────────────────────────────────────────────
interface CellProps { value: number; isEst: boolean; onChange: (v: number) => void; loading?: boolean }
function Cell({ value, isEst, onChange, loading }: CellProps) {
  const [focused, setFocused] = useState(false)
  if (loading) return <Sk h={22} w={64} r={4} />
  return (
    <input
      type="number"
      value={value === 0 ? '' : value}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => { const n = parseFloat(e.target.value); onChange(isFinite(n) ? n : 0) }}
      placeholder="—"
      style={{
        width: '100%', minWidth: 58, background: focused ? '#0f1117' : 'transparent',
        border: focused ? `1px solid ${isEst ? T.gld : T.grn}` : 'none',
        borderRadius: 4, outline: 'none', textAlign: 'right',
        color: isEst ? '#9ca3af' : T.txt, fontSize: 12, padding: '3px 6px',
        fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
      }}
    />
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ════════════════════════════════════════════════════════════════════════════════
export default function ValuationPage() {

  // ── 상태 ─────────────────────────────────────────────────────────────────
  const [ticker,      setTicker]      = useState('')
  const [market,      setMarket]      = useState<'US' | 'KR'>('US')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [investments, setInvestments] = useState<InvItem[]>([])

  // [핵심] API 원본 응답 — 변화 시 useEffect 가 배열 매핑 트리거
  const [rawData,  setRawData]  = useState<FinApiResponse | null>(null)

  // 8개년 편집 가능 재무 배열
  const [yearKeys, setYearKeys] = useState<string[]>([])
  const [eps,      setEps]      = useState<number[]>([])
  const [oi,       setOi]       = useState<number[]>([])
  const [rev,      setRev]      = useState<number[]>([])

  // PER 사용자 조정
  const [perInput, setPerInput] = useState('')

  // 20년 시뮬 로그 스케일 토글
  const [logScale, setLogScale] = useState(false)

  // ── Supabase 보유 종목 로드 ───────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data } = await sb.from('investments').select('id,ticker,name,market').eq('user_id', user.id)
        setInvestments(((data ?? []) as InvItem[]).filter(i => i.market !== 'CRYPTO'))
      } catch { /* 보유 종목 없어도 기능에 지장 없음 */ }
    })()
  }, [])

  // ── [도미노 트리거] rawData 변화 → 8개년 배열 매핑 ───────────────────────
  // success === true + financials 존재 확인 후 배열 세팅 → CAGR/PEG useMemo 연쇄 트리거
  useEffect(() => {
    if (!rawData)          return
    if (!rawData.success)  return
    if (!rawData.financials || Object.keys(rawData.financials).length === 0) return
    if (!rawData.yearKeys  || rawData.yearKeys.length === 0) return

    const keys = rawData.yearKeys
    setYearKeys(keys)
    setEps(keys.map(y => rawData.financials[y]?.eps             ?? 0))
    setOi( keys.map(y => rawData.financials[y]?.operatingProfit ?? 0))
    setRev(keys.map(y => rawData.financials[y]?.revenue         ?? 0))
    setPerInput(rawData.currentPER > 0 ? rawData.currentPER.toFixed(1) : '25')
  }, [rawData])

  // ── 분석 시작 ─────────────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    const t = ticker.trim()
    if (!t) return

    // 이전 결과 전부 초기화
    setLoading(true)
    setError(null)
    setRawData(null)
    setYearKeys([])
    setEps([])
    setOi([])
    setRev([])
    setPerInput('')

    try {
      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 28_000)

      const res = await fetch(
        `/api/financials?ticker=${encodeURIComponent(t)}&market=${market}`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      if (!res.ok) {
        setError(`서버 오류 (HTTP ${res.status}). 잠시 후 다시 시도해 주세요.`)
        return
      }

      let data: FinApiResponse
      try { data = await res.json() } catch {
        setError('서버 응답이 올바른 JSON 형식이 아닙니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      // success === false → 에러 카드, rawData 업데이트 없음
      if (!data.success) {
        setError(
          data.error ??
          '해당 종목의 실시간 재무 데이터를 가져오는 데 실패했습니다. 티커를 다시 확인해 주세요.'
        )
        return
      }

      // success === true 확인 → rawData 업데이트 → useEffect 도미노 시작
      setRawData(data)

    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setError('⏱ 응답 시간 초과 (28초). 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.')
      } else {
        setError(`네트워크 오류: ${(e as Error).message}`)
      }
    } finally {
      setLoading(false)
    }
  }, [ticker, market])

  // ── CAGR 자동 계산 ────────────────────────────────────────────────────────
  const cagrData = useMemo(() => {
    if (!rawData?.success || !rawData.financials) return null
    if (eps.length === 0) return null

    // 확정('E' 아님) / 추정('E') 인덱스 구분
    const isActual = (idx: number) => !yearKeys[idx]?.endsWith('E')

    // 확정 실적 중 양수인 첫/마지막 {val, idx}
    const firstActualInfo = (arr: number[]): { val: number; idx: number } | null => {
      for (let i = 0; i < arr.length; i++) if (isActual(i) && arr[i] > 0) return { val: arr[i], idx: i }
      return null
    }
    const lastActualInfo = (arr: number[]): { val: number; idx: number } | null => {
      for (let i = arr.length - 1; i >= 0; i--) if (isActual(i) && arr[i] > 0) return { val: arr[i], idx: i }
      return null
    }
    // 추정 포함 마지막 양수
    const lastAnyInfo = (arr: number[]): { val: number; idx: number } | null => {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] > 0) return { val: arr[i], idx: i }
      return null
    }

    // ── 장기 CAGR: 확정 실적 첫해 → 확정 실적 마지막해 (추정치 제외) ──────────
    // 이유: 극단적 컨센서스 추정치가 끝점이 되면 CAGR이 왜곡됨
    const epsActFirst = firstActualInfo(eps)
    const epsActLast  = lastActualInfo(eps)
    const oiActFirst  = firstActualInfo(oi)
    const oiActLast   = lastActualInfo(oi)
    const revActFirst = firstActualInfo(rev)
    const revActLast  = lastActualInfo(rev)

    const longEpsYrs = epsActFirst && epsActLast ? Math.max(1, epsActLast.idx - epsActFirst.idx) : 1
    const longOiYrs  = oiActFirst  && oiActLast  ? Math.max(1, oiActLast.idx  - oiActFirst.idx)  : 1
    const longRevYrs = revActFirst && revActLast  ? Math.max(1, revActLast.idx - revActFirst.idx) : 1

    // ── 단기 CAGR: 인덱스 4(5번째)의 확정값 → 추정 포함 마지막 양수 ─────────
    // 이유: 단기 추정치(컨센서스)는 애널리스트 전망으로 의미 있음
    const epsShortStart = eps[4] > 0 && isActual(4)
      ? { val: eps[4], idx: 4 } : firstActualInfo(eps)
    const oiShortStart  = oi[4]  > 0 && isActual(4) ? { val: oi[4],  idx: 4 } : firstActualInfo(oi)
    const revShortStart = rev[4] > 0 && isActual(4) ? { val: rev[4], idx: 4 } : firstActualInfo(rev)

    // 단기 종료점: 추정치(E) 포함 마지막 양수
    const epsShortEnd = lastAnyInfo(eps)
    const oiShortEnd  = lastAnyInfo(oi)
    const revShortEnd = lastAnyInfo(rev)

    // ── 단기 CAGR 보정: 추정치가 없을 때 최근 2개 확정 연도로 폴백 ─────────────
    // 삼성전자처럼 E 컬럼이 필터링되어 모두 0일 경우,
    // lastAnyInfo == lastActualInfo → shortYrs = 0 → CAGR = 0% (잘못됨)
    // → 이때는 전기(lastActual 바로 앞) 확정 연도 → 당기(lastActual) 성장률 사용
    const hasFutureEps  = epsShortEnd  && epsActLast  && epsShortEnd.idx  > epsActLast.idx
    const hasFutureOi   = oiShortEnd   && oiActLast   && oiShortEnd.idx   > oiActLast.idx
    const hasFutureRev  = revShortEnd  && revActLast  && revShortEnd.idx  > revActLast.idx

    // 추정치가 없을 때 → 전기 확정 연도 찾기
    const prevActEps = !hasFutureEps && epsActLast
      ? ((): { val: number; idx: number } | null => {
          for (let i = epsActLast.idx - 1; i >= 0; i--)
            if (isActual(i) && eps[i] > 0) return { val: eps[i], idx: i }
          return null
        })() : null
    const prevActOi  = !hasFutureOi  && oiActLast
      ? ((): { val: number; idx: number } | null => {
          for (let i = oiActLast.idx - 1; i >= 0; i--)
            if (isActual(i) && oi[i] > 0) return { val: oi[i], idx: i }
          return null
        })() : null
    const prevActRev = !hasFutureRev && revActLast
      ? ((): { val: number; idx: number } | null => {
          for (let i = revActLast.idx - 1; i >= 0; i--)
            if (isActual(i) && rev[i] > 0) return { val: rev[i], idx: i }
          return null
        })() : null

    // 단기 CAGR 계산값 결정
    const shortEpsVal = hasFutureEps
      ? { s: epsShortStart, e: epsShortEnd }
      : prevActEps
        ? { s: prevActEps,   e: epsActLast }
        : { s: epsShortStart, e: epsShortEnd }
    const shortOiVal  = hasFutureOi
      ? { s: oiShortStart,  e: oiShortEnd }
      : prevActOi
        ? { s: prevActOi,    e: oiActLast }
        : { s: oiShortStart,  e: oiShortEnd }
    const shortRevVal = hasFutureRev
      ? { s: revShortStart, e: revShortEnd }
      : prevActRev
        ? { s: prevActRev,   e: revActLast }
        : { s: revShortStart, e: revShortEnd }

    const shortEpsYrs = shortEpsVal.s && shortEpsVal.e
      ? Math.max(1, shortEpsVal.e.idx - shortEpsVal.s.idx) : 1
    const shortOiYrs  = shortOiVal.s  && shortOiVal.e
      ? Math.max(1, shortOiVal.e.idx  - shortOiVal.s.idx)  : 1
    const shortRevYrs = shortRevVal.s && shortRevVal.e
      ? Math.max(1, shortRevVal.e.idx - shortRevVal.s.idx) : 1

    return {
      long: {
        eps: calcCagr(epsActFirst?.val ?? null, epsActLast?.val ?? null, longEpsYrs),
        oi:  calcCagr(oiActFirst?.val  ?? null, oiActLast?.val  ?? null, longOiYrs),
        rev: calcCagr(revActFirst?.val ?? null, revActLast?.val ?? null, longRevYrs),
        yrs: longEpsYrs,
      },
      short: {
        eps: calcCagr(shortEpsVal.s?.val ?? null, shortEpsVal.e?.val ?? null, shortEpsYrs),
        oi:  calcCagr(shortOiVal.s?.val  ?? null, shortOiVal.e?.val  ?? null, shortOiYrs),
        rev: calcCagr(shortRevVal.s?.val ?? null, shortRevVal.e?.val ?? null, shortRevYrs),
        yrs: shortEpsYrs,
      },
    }
  }, [rawData, yearKeys, eps, oi, rev])

  // ── PEG + 적정주가 자동 계산 ──────────────────────────────────────────────
  const analysis = useMemo(() => {
    // 방어: rawData 성공 상태 + cagrData + eps 배열 존재 시에만 계산
    if (!rawData?.success || !rawData.financials) return null
    if (!cagrData) return null
    if (eps.length === 0) return null

    const cur    = rawData.currency
    const shares = rawData.shares > 0 ? rawData.shares : 1

    const perMktRaw = parseFloat(perInput)
    const perMkt    =
      isFinite(perMktRaw) && perMktRaw > 0 ? perMktRaw :
      rawData.currentPER > 0               ? rawData.currentPER :
      25

    // fwdEps: 적정주가 계산용 EPS
    //
    // 원칙: "E(추정)" 컬럼 중 확정값 대비 3배 이내인 첫 번째 값 사용
    //   → 합리적 추정치는 사용 (NVDA 2026E 4.9 = 1.67x ✓, AAPL 2026E 8.74 = 1.17x ✓)
    //   → 극단 추정치는 제외 (삼성 2026E 42,216 = 6.43x → 확정값 6,564으로 대체)
    //
    // 각 종목 결과:
    //   NVDA   : fwdEps = 4.90  (2026E FMP실적 1.67x → 사용)
    //   AAPL   : fwdEps = 8.74  (2026E Yahoo 1.17x  → 사용)
    //   GOOGL  : fwdEps = 14.22 (2026E Yahoo 1.32x  → 사용)
    //   삼성전자: fwdEps = 6,564 (2026E 6.43x 초과 → 확정값)
    const confirmedEps = yearKeys
      .map((y, i) => (!y.endsWith('E') && eps[i] > 0 ? eps[i] : 0))
      .filter(v => v > 0)
      .at(-1) ?? 0

    const FWD_MAX_MULT = 3   // 확정값 대비 3배 초과 추정치는 극단값으로 처리
    const reasonableEstEps = yearKeys
      .map((y, i) => (y.endsWith('E') && eps[i] > 0 ? eps[i] : 0))
      .find(v => v > 0 && (confirmedEps <= 0 || v / confirmedEps <= FWD_MAX_MULT)) ?? 0

    const fwdEps = reasonableEstEps > 0 ? reasonableEstEps : confirmedEps
    const latOI  = [...oi].reverse().find(v  => v > 0) ?? 0
    const latRev = [...rev].reverse().find(v => v > 0) ?? 0

    // 주당 가치 환산:
    //   KR: state = 억원 → × 1e8 = 원 → ÷ shares = 원/주
    //   US: state = M USD → × 1e6 = $ → ÷ shares = $/주
    const multiplier  = cur === 'KRW' ? 1e8 : 1e6
    const perShareOI  = latOI  > 0 ? (latOI  * multiplier) / shares : 0
    const perShareRev = latRev > 0 ? (latRev * multiplier) / shares : 0

    // ── PEG 계산용 EPS 성장률 결정 ───────────────────────────────────────────
    // 우선순위:
    //   1) 장기 CAGR > 0  → 일반적인 성장주 (NVDA, AAPL 등)
    //   2) 장기 CAGR ≤ 0  → 경기순환주(삼성 등) 사이클 저점 회복 중
    //      → 실적 배열에서 최저점(trough) → 최근 확정 연도 CAGR(회복률) 사용
    //      예) 삼성: EPS 2023 trough(2,131) → 2025(6,564) → 회복 CAGR 75.5%
    //   3) 단기 CAGR > 0  → 장기·회복 모두 없을 때 마지막 대안
    let cagrEps: number | null = cagrData.long.eps

    if (!(cagrEps && cagrEps > 0)) {
      // 회복 CAGR 계산: 확정 실적 중 최솟값 → 최근 확정값
      const actualEpsArr = yearKeys
        .map((y, i) => (!y.endsWith('E') && eps[i] > 0) ? { val: eps[i], idx: i } : null)
        .filter(Boolean) as { val: number; idx: number }[]

      if (actualEpsArr.length >= 2) {
        const minAct  = actualEpsArr.reduce((a, b) => b.val < a.val ? b : a)
        const lastAct = actualEpsArr[actualEpsArr.length - 1]
        // 최저점이 최근 연도보다 앞에 있고 최근값이 더 클 때만 유효
        if (minAct.idx < lastAct.idx && lastAct.val > minAct.val) {
          const recoveryCagr = calcCagr(minAct.val, lastAct.val, lastAct.idx - minAct.idx)
          if (recoveryCagr && recoveryCagr > 0) cagrEps = recoveryCagr
        }
      }
      // 여전히 없으면 단기 CAGR 사용
      if (!(cagrEps && cagrEps > 0) && cagrData.short.eps && cagrData.short.eps > 0) {
        cagrEps = cagrData.short.eps
      }
    }

    const mkScenario = (per: number, scenLabel: string) => {
      const peg    = cagrEps && cagrEps > 0 ? +(per / cagrEps).toFixed(2) : null
      const rating = pegRating(peg)
      return { scenLabel, per, peg, ratingLabel: rating.label, color: rating.color, emoji: rating.emoji }
    }

    const fvEPS = fwdEps > 0 ? fwdEps * perMkt : 0
    const fvOI  = perShareOI  > 0 ? perShareOI  * perMkt : 0
    const fvRev = perShareRev > 0 ? perShareRev * 2       : 0

    const validFVs = [fvEPS, fvOI, fvRev].filter(v => v > 0)
    const avgFV    = validFVs.length > 0
      ? validFVs.reduce((a, b) => a + b, 0) / validFVs.length : 0
    const upside   =
      rawData.currentPrice > 0 && avgFV > 0
        ? (avgFV / rawData.currentPrice - 1) * 100 : 0

    return {
      cur, perMkt, cagrEps, fwdEps,
      fvEPS, fvOI, fvRev, avgFV, upside,
      scenarios: [
        mkScenario(15,     '보수적 (PER 15)'),
        mkScenario(25,     '적정  (PER 25)'),
        mkScenario(50,     '성장주 (PER 50)'),
        mkScenario(perMkt, `시장 PER (${perMkt.toFixed(1)})`),
      ],
    }
  }, [rawData, cagrData, eps, oi, rev, perInput])

  // ── 20년 EPS 시뮬레이션 ───────────────────────────────────────────────────
  const simData = useMemo(() => {
    if (!rawData?.success || !rawData.financials) return []
    if (!cagrData) return []
    if (eps.length === 0) return []

    // 시뮬레이션 기준: 마지막 '확정' 실적 연도의 EPS (추정치 제외)
    const actualBase = yearKeys
      .map((y, i) => (!y.endsWith('E') && eps[i] > 0 ? eps[i] : 0))
      .filter(v => v > 0)
      .at(-1) ?? 0
    const base = actualBase > 0 ? actualBase : ([...eps].reverse().find(v => v > 0) ?? 0)
    if (base === 0) return []

    // 시뮬레이션 성장률은 최대 60% 캡 (과거 단기 급등이 20년 복리로 이어지면 수조단위가 됨)
    // 실제 계산된 CAGR은 [4단] CAGR 테이블에 표시하고, 차트는 의미 있는 범위로 제한
    const SIM_MAX = 60
    const gL = Math.min(cagrData.long.eps  ?? 10, SIM_MAX)
    const gS = Math.min(cagrData.short.eps ?? 15, SIM_MAX)
    const gA = Math.min(analysis?.cagrEps  ?? gL,  SIM_MAX)

    return Array.from({ length: 21 }, (_, y) => ({
      year:     y,
      보수적:   +(base * Math.pow(1.08,          y)).toFixed(4),
      단기CAGR: +(base * Math.pow(1 + gS / 100, y)).toFixed(4),
      장기CAGR: +(base * Math.pow(1 + gL / 100, y)).toFixed(4),
      애널추정:  +(base * Math.pow(1 + gA / 100, y)).toFixed(4),
    }))
  }, [rawData, eps, cagrData, analysis])

  // ── 텐배거 도달 좌표 — 단일 소스 (헤더 텍스트 + 차트 마커 동시 사용) ────
  //
  // ★ 핵심 설계 원칙:
  //   헤더 텍스트의 "N년 후"와 차트 ReferenceDot의 "N년" 은
  //   반드시 이 useMemo 의 같은 .year 필드에서 가져와야 한다.
  //   절대로 tenBaggerYrs 같은 별도 계산식을 만들지 않는다.
  //
  // ★ 계산 방식:
  //   simData 는 시각화 목적으로 최대 60% 캡이 걸려 있어서,
  //   simData 를 순회하면 실제 CAGR 과 다른 연도가 나온다 (버그 원인).
  //   → 실제(무제한) CAGR 성장률로 직접 복리 계산하여 10배 돌파 연도를 구한다.
  //
  // ★ 차트 마커 y 좌표:
  //   마커는 '10배 기준선(target)' 위에 정확히 올린다.
  //   (라인이 capped 되어 있어도 기준선 위 동일 y 에 놓으면 의미가 명확하다)
  //
  // ★ 검증 예시 (SK하이닉스, 장기 CAGR 116.9%):
  //   base=58,955 / target=589,550 / 2.169^3=10.2 → year=3
  //   헤더 "장기 CAGR 기준 약 3년 후" & 마커 "⭐ 장기 10배 (3년)" → 동일 ✓
  const tenBaggerPoints = useMemo(() => {
    if (!simData.length || !cagrData) return null
    const base = simData[0]?.보수적 ?? 0
    if (base <= 0) return null
    const target = base * 10   // 10배 목표 EPS (PER 불변 가정 시 주가 10배)

    // 실제(무제한) CAGR 을 직접 사용 — simData 캡(60%)과 무관하게 정확한 연도 산출
    const gLong  = cagrData.long.eps  ?? 0   // 장기 CAGR (무제한)
    const gShort = cagrData.short.eps ?? 0   // 단기 CAGR (무제한)

    /**
     * 복리 성장으로 처음 target 을 돌파하는 연도를 구한다.
     * @param ratePercent  연간 성장률 (%) — 소수가 아닌 퍼센트 숫자 그대로
     * @returns { year: number, value: number } | null
     *   year  = 1부터 20 사이의 정수 (X축 "N년 차" 과 동일)
     *   value = target (기준선에 마커를 정확히 올리기 위해 target 고정)
     */
    const findCrossYear = (ratePercent: number): { year: number; value: number } | null => {
      if (ratePercent <= 0) return null   // 음수·0 성장률은 10배 도달 불가
      for (let y = 1; y <= 20; y++) {
        const val = base * Math.pow(1 + ratePercent / 100, y)
        if (val >= target) return { year: y, value: target }
      }
      return null   // 20년 내 미도달
    }

    // 보수적 (+8% 고정)
    const conservCross = findCrossYear(8)

    return {
      target,
      보수적:   conservCross,
      단기CAGR: findCrossYear(gShort),
      장기CAGR: findCrossYear(gLong),
    }
  }, [simData, cagrData])

  // tenBaggerYrs 는 더 이상 사용하지 않는다.
  // 헤더 텍스트는 tenBaggerPoints.장기CAGR?.year 를 직접 참조한다.

  // ── 종합 점수 ─────────────────────────────────────────────────────────────
  const scoreData = useMemo(() => {
    if (!rawData?.success || !analysis || !cagrData) return null

    let pts = 0
    const reasons: string[] = []

    // ── PEG 항목 (40점) ────────────────────────────────────────────────────
    const peg = analysis.scenarios[3].peg
    if (peg != null) {
      if      (peg < 1.0) { pts += 40; reasons.push(`PEG ${peg}로 저평가 (+40점)`) }
      else if (peg < 1.5) { pts += 30; reasons.push(`PEG ${peg}로 적정 수준 (+30점)`) }
      else if (peg < 2.0) { pts += 15; reasons.push(`PEG ${peg}로 약간 고평가 (+15점)`) }
      else                             reasons.push(`PEG ${peg}로 고평가 (0점)`)
    }

    // ── 상승여력 항목 (30점) ───────────────────────────────────────────────
    const up = analysis.upside
    if      (up > 30) { pts += 30; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (+30점)`) }
    else if (up > 10) { pts += 20; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 상승여력 (+20점)`) }
    else if (up >  0) { pts += 10; reasons.push(`적정주가 대비 +${up.toFixed(0)}% 소폭 여력 (+10점)`) }
    else                           reasons.push(`적정주가 대비 ${up.toFixed(0)}% 하락 (0점)`)

    // ── 성장 안정성 항목 (30점) ────────────────────────────────────────────
    const ls = cagrData.long.eps, ss = cagrData.short.eps
    if (ls != null && ss != null) {
      if      (ss >= ls && ss > 0) { pts += 30; reasons.push('단기 성장률 > 장기 (성장 가속) (+30점)') }
      else if (ss > 0)             { pts += 15; reasons.push('성장 중이나 속도 둔화 (+15점)') }
      else                                       reasons.push('단기 성장 둔화 (0점)')
    }

    // ── 밸류에이션 오버 패널티 (가치투자 원칙) ────────────────────────────
    // 현재가가 평균 적정주가보다 높을 경우: -10점 패널티
    const isOvervalued        = analysis.avgFV > 0 && up < 0
    const isSignificantlyOver = analysis.avgFV > 0 && up < -5   // 5% 이상 고평가

    if (isOvervalued) {
      pts = Math.max(0, pts - 10)
      reasons.push(
        `현재가가 평균 적정주가 대비 ${Math.abs(up).toFixed(1)}% 높음 → 밸류에이션 패널티 (-10점)`
      )
    }

    // ── 기본 판정 ─────────────────────────────────────────────────────────
    const rawVerdict =
      pts >= 80 ? { text: '강력 매수 (Buy)',   bg: '#052e16', color: T.grn } :
      pts >= 60 ? { text: '매수 (Accumulate)', bg: '#0c1a3a', color: T.dn  } :
      pts >= 40 ? { text: '보유 (Hold)',        bg: '#2d1c00', color: T.gld } :
                  { text: '매수 보류 (Watch)',  bg: '#2d0a0a', color: T.up  }

    // ── 자동 하향 조정: 5% 이상 고평가면 '매수' 계열 → '보유' 상한 캡 ───
    // 이유: 아무리 CAGR이 높아도 현재가가 적정가보다 5%+ 비싸면
    //       가치투자 원칙상 적극 매수보다 보유·관망이 적합
    // ※ '매수 보류(Watch)' 텍스트에도 '매수'가 포함되어 오탐 방지:
    //    영문 판정 키워드 (Buy, Accumulate) 로만 비교
    const isBuyVerdict =
      rawVerdict.text.includes('(Buy)') || rawVerdict.text.includes('(Accumulate)')
    const verdict = (isSignificantlyOver && isBuyVerdict)
      ? { text: '보유 (Hold)', bg: '#2d1c00', color: T.gld }
      : rawVerdict

    // ── 안내 라벨 트리거 플래그 ───────────────────────────────────────────
    // "주가 > 적정가인데도 매수 계열 점수" → 학생에게 설명 필요
    const showOvervaluedNote = isOvervalued && isBuyVerdict

    return { pts, reasons, verdict, isOvervalued, isSignificantlyOver, showOvervaluedNote, upside: up }
  }, [rawData, analysis, cagrData])

  // ── 셀 업데이트 헬퍼 ──────────────────────────────────────────────────────
  const updCell = (
    arr: number[],
    setArr: React.Dispatch<React.SetStateAction<number[]>>,
    idx: number, val: number
  ) => { const next = [...arr]; next[idx] = val; setArr(next) }

  const hasData = Boolean(rawData?.success && yearKeys.length > 0)

  // ── 사이클/턴어라운드 경고 조건 ───────────────────────────────────────────
  // 단기 CAGR과 장기 CAGR 차이가 20%p 이상 벌어지거나,
  // 장기 CAGR이 음수이면서 단기가 양수인 경우 (경기순환주 전형적 패턴)
  const cyclicalWarning = useMemo(() => {
    if (!cagrData) return false
    const longEps  = cagrData.long.eps  ?? 0
    const shortEps = cagrData.short.eps ?? 0
    const diff     = Math.abs(shortEps - longEps)
    // 단기-장기 차이 20%p 초과, 또는 장기 음수+단기 양수
    return diff >= 20 || (longEps < 0 && shortEps > 0)
  }, [cagrData])

  // ════════════════════════════════════════════════════════════════════════════
  //  렌더
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.txt,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '28px 24px 80px',
    }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
      `}</style>

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.gld, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          📊 CHOIIL VALUE ANALYSIS
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          최일 가치분석 터미널
        </h1>
        <p style={{ fontSize: 13, color: T.mut, margin: 0 }}>
          실시간 재무 데이터 기반 · CAGR 성장률 · PEG 분석 · 적정주가 산출 · 20년 미래 시뮬레이션
        </p>
      </div>

      {/* ═══ [1단] 종목 입력 ═══════════════════════════════════════════════ */}
      <div style={cs({ padding: '20px 24px', marginBottom: 16 })}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          <div style={{ flex: 2, minWidth: 240 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.mut, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              종목 선택 / 티커 직접 입력
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {investments.length > 0 && (
                <select
                  onChange={e => {
                    const inv = investments.find(i => i.id === e.target.value)
                    if (inv) { setTicker(inv.ticker); setMarket(inv.market === 'KR' ? 'KR' : 'US') }
                  }}
                  style={{ background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 8, color: T.sub, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}
                >
                  <option value="">보유 종목 선택</option>
                  {investments.map(i => <option key={i.id} value={i.id}>{i.name} ({i.ticker})</option>)}
                </select>
              )}
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && startAnalysis()}
                placeholder="NVDA · AAPL · 005930 …"
                style={{ flex: 1, background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 8, color: T.txt, padding: '9px 14px', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.mut, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>시장</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['US', 'KR'] as const).map(m => (
                <button key={m} onClick={() => setMarket(m)} style={{
                  padding: '9px 22px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${market === m ? T.gld : T.bd}`,
                  background: market === m ? `${T.gld}18` : 'transparent',
                  color: market === m ? T.gld : T.mut, fontWeight: 700, fontSize: 13,
                }}>{m}</button>
              ))}
            </div>
          </div>

          <button
            onClick={startAnalysis} disabled={loading || !ticker.trim()}
            style={{
              padding: '10px 32px', borderRadius: 8, border: 'none', alignSelf: 'flex-end',
              background: loading ? T.card : `linear-gradient(135deg, #1e40af, ${T.dn})`,
              color: T.txt, fontWeight: 800, fontSize: 14,
              cursor: loading || !ticker.trim() ? 'not-allowed' : 'pointer',
              opacity: !ticker.trim() ? 0.5 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? '⏳ 조회 중…' : '🔍 분석 시작'}
          </button>
        </div>
      </div>

      {/* ═══ 에러 카드 ═════════════════════════════════════════════════════ */}
      {error && (
        <div style={{ marginBottom: 16, padding: '20px 24px', borderRadius: 12, background: '#1a0505', border: `1px solid ${T.up}66`, boxShadow: `0 0 20px ${T.up}22` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 34, lineHeight: 1, flexShrink: 0 }}>🚫</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: T.up, marginBottom: 8 }}>데이터 로드 실패</div>
              <div style={{ fontSize: 14, color: '#fca5a5', lineHeight: 1.7, marginBottom: 12, fontWeight: 500 }}>{error}</div>
              <div style={{ padding: '10px 14px', background: `${T.up}08`, border: `1px solid ${T.up}33`, borderRadius: 8, fontSize: 12, color: T.mut, lineHeight: 1.9 }}>
                💡 <strong style={{ color: T.sub }}>해결 방법</strong><br />
                · 미국 주식: 영문 대문자 티커 정확 입력 (예: NVDA, AAPL, MSFT)<br />
                · 한국 주식: 시장을 <strong style={{ color: T.gld }}>KR</strong>로 선택, 6자리 숫자 코드 입력 (예: 005930, 000660)<br />
                · API 일시 차단 상태일 수 있습니다. 30초~1분 후 재시도해 주세요
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 로딩 스켈레톤 ═════════════════════════════════════════════════ */}
      {loading && (
        <div style={{ marginBottom: 16 }}>
          <div style={cs({ padding: '14px 24px', marginBottom: 12, display: 'flex', gap: 28, flexWrap: 'wrap' })}>
            <div><Sk h={20} w={180} r={4} /><div style={{ marginTop: 6 }}><Sk h={12} w={110} r={3} /></div></div>
            {[90,70,80,100].map((w,i) => <div key={i}><Sk h={12} w={50} r={3}/><div style={{marginTop:6}}><Sk h={18} w={w} r={4}/></div></div>)}
          </div>
          <div style={cs({ padding: '20px 24px' })}>
            <Sk h={14} w={200} r={4} />
            <div style={{ marginTop: 16 }}>
              {[0,1,2].map(ri => (
                <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <Sk h={24} w={80} r={4}/>
                  {Array(8).fill(0).map((_,ci) => <Sk key={ci} h={24} w={64} r={4}/>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ [2단] 종목 기본 정보 ══════════════════════════════════════════ */}
      {hasData && rawData && (
        <div style={cs({ padding: '14px 24px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' })}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900 }}>{rawData.companyName}</div>
            <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>{rawData.ticker} · {rawData.currency} · {rawData.unit}</div>
          </div>
          {[
            { label: '현재가',    val: rawData.currentPrice > 0 ? fmtP(rawData.currentPrice, rawData.currency) : '—' },
            { label: 'PER',       val: rawData.currentPER > 0   ? `${rawData.currentPER.toFixed(1)}배` : '—' },
            { label: '발행주식수', val: rawData.shares > 0        ? `${(rawData.shares/1e6).toFixed(0)}M주` : '—' },
            { label: '시가총액',  val: rawData.marketCap > 0
              ? rawData.currency === 'KRW'
                ? `₩${(rawData.marketCap/1e12).toFixed(1)}조`
                : `$${(rawData.marketCap/1e9).toFixed(0)}B`
              : '—' },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: T.mut, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.gld }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ [3단] 8개년 재무 테이블 ══════════════════════════════════════ */}
      {hasData && yearKeys.length > 0 && (
        <div style={cs({ padding: '20px 24px', marginBottom: 16, overflowX: 'auto' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              📋 8개년 재무 데이터
              <span style={{ fontSize: 11, color: T.mut, marginLeft: 8 }}>({rawData?.unit})</span>
            </div>
            <div style={{ fontSize: 11, color: T.est }}>회색 열 = 추정치(E) &nbsp;·&nbsp; 셀 클릭으로 수동 수정 가능</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#252836' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: T.sub, fontWeight: 700, fontSize: 11, width: 90 }}>항목</th>
                {yearKeys.map(y => (
                  <th key={y} style={{
                    padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11,
                    color: y.endsWith('E') ? T.est : T.sub,
                    background: y.endsWith('E') ? 'rgba(75,85,99,0.18)' : 'transparent',
                  }}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'EPS',    data: eps, setData: setEps, color: T.grn },
                { label: '영업이익', data: oi,  setData: setOi,  color: T.dn  },
                { label: '매출액',  data: rev, setData: setRev,  color: T.gld },
              ].map(({ label, data, setData, color }, ri) => (
                <tr key={label} style={{ borderTop: `1px solid ${T.bd}`, background: ri%2 ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                  <td style={{ padding: '7px 14px', fontWeight: 700, color, fontSize: 12 }}>{label}</td>
                  {yearKeys.map((y, ci) => (
                    <td key={y} style={{ padding: '4px 4px', textAlign: 'right', background: y.endsWith('E') ? 'rgba(75,85,99,0.08)' : 'transparent' }}>
                      <Cell value={data[ci] ?? 0} isEst={y.endsWith('E')} onChange={v => updCell(data, setData, ci, v)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ [4단] CAGR 성장률 ════════════════════════════════════════════ */}
      {hasData && cagrData && (
        <div style={cs({ padding: '20px 24px', marginBottom: 16 })}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📈 CAGR 성장률 자동 계산</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.bd}` }}>
            {['항목',
              `장기 ${cagrData.long.yrs ?? ''}년 CAGR`,
              `단기 ${cagrData.short.yrs ?? ''}년 CAGR`,
            ].map(h => (
              <div key={h} style={{ background: '#252836', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: T.sub }}>{h}</div>
            ))}
            {[
              { label: 'EPS',    long: cagrData.long.eps, short: cagrData.short.eps, color: T.grn },
              { label: '영업이익', long: cagrData.long.oi,  short: cagrData.short.oi,  color: T.dn  },
              { label: '매출액',  long: cagrData.long.rev, short: cagrData.short.rev, color: T.gld },
            ].flatMap(({ label, long: l, short: s, color }) => [
              <div key={`${label}-lbl`} style={{ padding: '12px 16px', fontWeight: 700, color, borderTop: `1px solid ${T.bd}`, fontSize: 13 }}>{label}</div>,
              <div key={`${label}-long`} style={{ padding: '12px 16px', fontWeight: 800, fontSize: 18, borderTop: `1px solid ${T.bd}`, color: l != null ? T.txt : T.mut }}>
                {l != null ? `${l > 0 ? '+' : ''}${l.toFixed(1)}%` : '—'}
              </div>,
              <div key={`${label}-short`} style={{ padding: '12px 16px', fontWeight: 800, fontSize: 18, borderTop: `1px solid ${T.bd}`, color: s!=null&&l!=null?(s>=l?T.grn:'#fb923c'):T.mut }}>
                {s != null ? `${s > 0 ? '+' : ''}${s.toFixed(1)}%` : '—'}
              </div>,
            ])}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cagrData.short.eps != null && cagrData.long.eps != null && (() => {
              const isAccel = cagrData.short.eps >= cagrData.long.eps
              return (
                <div style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, background: isAccel ? `${T.grn}15` : `#fb923c15`, border: `1px solid ${isAccel ? T.grn : '#fb923c'}44`, color: isAccel ? T.grn : '#fb923c' }}>
                  {isAccel ? '✅ EPS 성장 가속 (단기 > 장기)' : '⚠️ EPS 성장 둔화 (단기 < 장기)'}
                </div>
              )
            })()}
            {cagrData.long.eps != null && cagrData.long.oi != null && cagrData.long.eps > cagrData.long.oi && (
              <div style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, background: `${T.grn}15`, border: `1px solid ${T.grn}44`, color: T.grn }}>
                ✅ EPS성장률 {'>'} 영업이익성장률 → 수익성 개선
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ [5단] PEG 분석 + 적정주가 ═══════════════════════════════════ */}
      {hasData && analysis && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>🎯 PEG 분석</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.mut }}>시장 PER 조정:</span>
              <input type="number" value={perInput} onChange={e => setPerInput(e.target.value)}
                style={{ width: 70, background: '#0f1117', border: `1px solid ${T.bd}`, borderRadius: 6, color: T.txt, padding: '4px 8px', fontSize: 13, textAlign: 'center', outline: 'none' }}/>
              <span style={{ fontSize: 12, color: T.mut }}>배</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
            {analysis.scenarios.map((s, i) => (
              <div key={i} style={cs({ padding: '18px 20px', borderTop: `3px solid ${s.color}` })}>
                <div style={{ fontSize: 11, color: T.mut, marginBottom: 8 }}>{s.scenLabel}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  {[
                    { lab: 'PER',    val: s.per, col: T.txt },
                    { lab: '성장률', val: analysis.cagrEps != null ? `${analysis.cagrEps.toFixed(1)}%` : '—', col: T.grn },
                    { lab: 'PEG',   val: s.peg ?? '—', col: s.color },
                  ].map(({ lab, val, col }) => (
                    <div key={lab} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: T.mut, marginBottom: 2 }}>{lab}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: col }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '6px 10px', background: `${s.color}18`, borderRadius: 6, fontSize: 12, color: s.color, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
                  {s.emoji} {s.ratingLabel}
                </div>
                {analysis.fwdEps > 0 && (
                  <div style={{ fontSize: 11, color: T.sub, textAlign: 'right' }}>
                    적정주가: <strong style={{ color: T.txt }}>{fmtP(analysis.fwdEps * s.per, analysis.cur)}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={cs({ padding: '20px 24px' })}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>💰 적정주가 산출 (시장 PER 기준)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 16 }}>
              {([
                { label: 'EPS 기반',           val: analysis.fvEPS > 0 ? analysis.fvEPS : null, note: `fwd EPS × PER ${analysis.perMkt.toFixed(1)}`, hl: false },
                { label: '영업이익 기반',        val: analysis.fvOI  > 0 ? analysis.fvOI  : null, note: '(영업이익 ÷ 주식수) × PER',                   hl: false },
                { label: '매출 기반 (PSR × 2)', val: analysis.fvRev > 0 ? analysis.fvRev : null, note: '(매출 ÷ 주식수) × 2',                          hl: false },
                { label: '평균 적정주가',        val: analysis.avgFV > 0 ? analysis.avgFV : null, note: '3가지 평균',                                   hl: true  },
              ] as const).map(({ label, val, note, hl }) => (
                <div key={label} style={cs({ padding: '14px 16px', border: hl ? `1px solid ${T.gld}55` : `1px solid ${T.bd}` })}>
                  <div style={{ fontSize: 10, color: T.mut, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: hl ? 20 : 16, fontWeight: 900, color: hl ? T.gld : T.txt }}>{val != null ? fmtP(val, analysis.cur) : '—'}</div>
                  <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{note}</div>
                </div>
              ))}
            </div>
            {rawData && analysis.avgFV > 0 && rawData.currentPrice > 0 && (() => {
              const cp = rawData.currentPrice, fv = analysis.avgFV
              const mn = Math.min(cp,fv)*0.8, mx = Math.max(cp,fv)*1.2
              const pCP = Math.max(0,Math.min(100,((cp-mn)/(mx-mn))*100))
              const pFV = Math.max(0,Math.min(100,((fv-mn)/(mx-mn))*100))
              return (
                <>
                  <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>현재 {fmtP(cp, analysis.cur)}</span><span>vs</span>
                    <span style={{ color: T.gld }}>적정 {fmtP(fv, analysis.cur)}</span>
                    <span style={{ color: analysis.upside >= 0 ? T.grn : T.up, fontWeight: 700 }}>
                      {analysis.upside >= 0 ? '▲' : '▼'} {Math.abs(analysis.upside).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 12, background: '#2a2d3a', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position:'absolute', left:`${Math.min(pCP,pFV)}%`, width:`${Math.abs(pFV-pCP)}%`, height:'100%', background: analysis.upside>=0 ? `linear-gradient(90deg,${T.dn},${T.grn})` : `linear-gradient(90deg,${T.up},#fb923c)` }}/>
                    <div style={{ position:'absolute', left:`${pCP}%`, width:3, height:'100%', background:T.txt, transform:'translateX(-50%)' }}/>
                    <div style={{ position:'absolute', left:`${pFV}%`, width:3, height:'100%', background:T.gld, transform:'translateX(-50%)' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:T.mut }}>
                    <span>■ 현재가</span><span style={{ color: T.gld }}>■ 적정가</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ═══ [6단] 20년 EPS 시뮬레이션 ═══════════════════════════════════ */}
      {hasData && simData.length > 0 && (
        <div style={cs({ padding: '20px 24px', marginBottom: 16 })}>
          {/* 헤더 + 로그 스케일 토글 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔭 20년 미래 EPS 시뮬레이션</div>
              {/* ★ 헤더 텍스트 — tenBaggerPoints 에서 직접 참조 (차트 마커와 동일 소스) */}
              {(tenBaggerPoints?.장기CAGR || tenBaggerPoints?.단기CAGR) && (
                <div style={{ fontSize: 12, color: T.gld, lineHeight: 1.7 }}>
                  ⭐ 텐배거(10배) 도달 예상
                  {tenBaggerPoints.장기CAGR && (
                    <span> &nbsp;·&nbsp; 장기 CAGR 기준 약 <strong>{tenBaggerPoints.장기CAGR.year}년</strong> 후</span>
                  )}
                  {tenBaggerPoints.단기CAGR &&
                   tenBaggerPoints.단기CAGR.year !== tenBaggerPoints.장기CAGR?.year && (
                    <span> &nbsp;·&nbsp; 단기 CAGR 기준 약 <strong>{tenBaggerPoints.단기CAGR.year}년</strong> 후</span>
                  )}
                </div>
              )}
            </div>
            {/* 로그 스케일 토글 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.mut }}>로그 스케일</span>
              <button
                onClick={() => setLogScale(prev => !prev)}
                style={{
                  position: 'relative', width: 40, height: 22, borderRadius: 11, border: 'none',
                  background: logScale ? T.dn : T.bd,
                  cursor: 'pointer', transition: 'background 0.2s',
                  flexShrink: 0,
                }}
                title={logScale ? '선형 스케일로 전환' : '로그 스케일로 전환 (저성장 라인 가시성 개선)'}
              >
                <span style={{
                  position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                  background: T.txt, transition: 'left 0.2s',
                  left: logScale ? 21 : 3,
                }}/>
              </button>
            </div>
          </div>

          {/* 로그 스케일 안내 */}
          {logScale && (
            <div style={{ marginBottom: 10, padding: '6px 12px', background: `${T.dn}15`, border: `1px solid ${T.dn}33`, borderRadius: 6, fontSize: 11, color: T.sub }}>
              📐 로그 스케일 ON — Y축이 배수 단위로 표시됩니다. 저성장 라인도 명확하게 비교할 수 있습니다.
            </div>
          )}

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={simData} margin={{ top:36, right:20, bottom:0, left:10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.bd} vertical={false}/>
              <XAxis dataKey="year" tick={{ fill:T.mut, fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}년`}/>
              <YAxis
                scale={logScale ? 'log' : 'auto'}
                domain={logScale ? ['auto', 'auto'] : undefined}
                tick={{ fill:T.mut, fontSize:10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) =>
                  logScale
                    ? (v >= 1e8 ? `${(v/1e8).toFixed(0)}억` : v >= 1e4 ? `${(v/1e4).toFixed(0)}만` : String(Math.round(v)))
                    : String(Math.round(v))
                }
              />
              <RTooltip
                contentStyle={{ background:T.card, border:`1px solid ${T.bd}`, borderRadius:8, fontSize:12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [(v as number).toFixed(2), '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }}/>

              {/* ── 10배 기준선 (선형 스케일에서만) ── */}
              {!logScale && tenBaggerPoints && (
                <ReferenceLine
                  y={tenBaggerPoints.target}
                  stroke={T.gld} strokeDasharray="5 3" strokeOpacity={0.6}
                  label={{ value: '◀ 10배 기준선', position: 'insideRight', fill: T.gld, fontSize: 10 }}
                />
              )}

              {/* ── 시나리오 라인 ── */}
              <Line type="monotone" dataKey="보수적"   stroke="#6b7280" strokeWidth={1.5} dot={false}/>
              <Line type="monotone" dataKey="단기CAGR" stroke={T.dn}    strokeWidth={2}   dot={false}/>
              <Line type="monotone" dataKey="장기CAGR" stroke={T.grn}   strokeWidth={2.5} dot={false}/>
              <Line type="monotone" dataKey="애널추정"  stroke={T.up}    strokeWidth={2}   dot={false} strokeDasharray="5 3"/>

              {/* ── 10배거 도달 마커 (말풍선 라벨) ── */}
              {tenBaggerPoints?.단기CAGR && (() => {
                const { year, value } = tenBaggerPoints.단기CAGR
                return (
                  <ReferenceDot x={year} y={value} r={7} fill={T.dn} stroke={T.txt} strokeWidth={2}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={{ content: (props: any) => {
                      const cx = props.viewBox?.cx ?? 0
                      const cy = props.viewBox?.cy ?? 0
                      const txt = `⭐ 단기 10배 (${year}년)`
                      const w = txt.length * 6.2 + 14
                      return (
                        <g>
                          <rect x={cx - w/2} y={cy - 34} width={w} height={20} rx={4} fill={T.card} stroke={T.dn} strokeWidth={1.5}/>
                          <text x={cx} y={cy - 20} textAnchor="middle" fill={T.dn} fontSize={10} fontWeight={700}>{txt}</text>
                          <polygon points={`${cx-5},${cy-14} ${cx+5},${cy-14} ${cx},${cy-7}`} fill={T.dn}/>
                        </g>
                      )
                    }}}
                  />
                )
              })()}

              {tenBaggerPoints?.장기CAGR && (() => {
                const { year, value } = tenBaggerPoints.장기CAGR
                return (
                  <ReferenceDot x={year} y={value} r={7} fill={T.grn} stroke={T.txt} strokeWidth={2}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={{ content: (props: any) => {
                      const cx = props.viewBox?.cx ?? 0
                      const cy = props.viewBox?.cy ?? 0
                      const txt = `⭐ 장기 10배 (${year}년)`
                      const w = txt.length * 6.2 + 14
                      return (
                        <g>
                          <rect x={cx - w/2} y={cy - 34} width={w} height={20} rx={4} fill={T.card} stroke={T.grn} strokeWidth={1.5}/>
                          <text x={cx} y={cy - 20} textAnchor="middle" fill={T.grn} fontSize={10} fontWeight={700}>{txt}</text>
                          <polygon points={`${cx-5},${cy-14} ${cx+5},${cy-14} ${cx},${cy-7}`} fill={T.grn}/>
                        </g>
                      )
                    }}}
                  />
                )
              })()}

              {tenBaggerPoints?.보수적 && (() => {
                const { year, value } = tenBaggerPoints.보수적
                return (
                  <ReferenceDot x={year} y={value} r={6} fill="#6b7280" stroke={T.txt} strokeWidth={2}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={{ content: (props: any) => {
                      const cx = props.viewBox?.cx ?? 0
                      const cy = props.viewBox?.cy ?? 0
                      const txt = `⭐ 보수적 10배 (${year}년)`
                      const w = txt.length * 6.2 + 14
                      return (
                        <g>
                          <rect x={cx - w/2} y={cy - 34} width={w} height={20} rx={4} fill={T.card} stroke="#6b7280" strokeWidth={1.5}/>
                          <text x={cx} y={cy - 20} textAnchor="middle" fill="#9ca3af" fontSize={10} fontWeight={700}>{txt}</text>
                          <polygon points={`${cx-5},${cy-14} ${cx+5},${cy-14} ${cx},${cy-7}`} fill="#6b7280"/>
                        </g>
                      )
                    }}}
                  />
                )
              })()}
            </LineChart>
          </ResponsiveContainer>

          {/* ── 20년 내 미도달 시나리오 안내 ── */}
          {tenBaggerPoints && (() => {
            const unmet: string[] = []
            if (!tenBaggerPoints.보수적)   unmet.push('보수적 (+8%)')
            if (!tenBaggerPoints.장기CAGR) unmet.push(`장기 CAGR (${cagrData?.long.eps?.toFixed(1) ?? '?'}%)`)
            if (!tenBaggerPoints.단기CAGR) unmet.push(`단기 CAGR (${cagrData?.short.eps?.toFixed(1) ?? '?'}%)`)
            if (unmet.length === 0) return null
            return (
              <div style={{ marginTop: 10, padding: '8px 14px', background: `${T.mut}15`, border: `1px solid ${T.bd}`, borderRadius: 8, fontSize: 11, color: T.mut }}>
                📊 <strong style={{ color: T.sub }}>20년 내 10배 도달 불가 시나리오</strong>:{' '}
                {unmet.join(' / ')} — 장기적 복리 성장이 더 필요합니다.
              </div>
            )
          })()}
        </div>
      )}

      {/* ═══ [7단] 종합 판단 ═══════════════════════════════════════════════ */}
      {hasData && scoreData && (
        <div style={cs({ padding: '24px 28px' })}>

          {/* ── 사이클/턴어라운드 경고 배지 ─────────────────────────────────── */}
          {cyclicalWarning && (
            <div style={{
              marginBottom: 20, padding: '14px 18px', borderRadius: 10,
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.4)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.gld, marginBottom: 6 }}>
                    경기민감주 / 턴어라운드 주의
                  </div>
                  <div style={{ fontSize: 12, color: '#d1b56b', lineHeight: 1.8 }}>
                    본 기업은 <strong style={{ color: T.gld }}>경기변동성이 큰 사이클 기업</strong>(또는 일시적 실적 턴어라운드 기업)일 가능성이 높습니다.<br />
                    단기 CAGR과 장기 CAGR의 차이가 극단적으로 벌어져 있어,{' '}
                    <strong style={{ color: T.gld }}>단기 CAGR 기반 20년 복리 추정은 과도한 착시를 유발</strong>할 수 있습니다.<br />
                    <strong>장기 CAGR</strong>과 <strong>보수적 시나리오</strong>를 중심으로 판독하시고,{' '}
                    로그 스케일 차트를 활용해 저성장 라인을 함께 확인하십시오.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🏆 종합 판단</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ textAlign: 'center', minWidth: 110 }}>
              <div style={{ width:100, height:100, borderRadius:'50%', background:scoreData.verdict.bg, border:`3px solid ${scoreData.verdict.color}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                <div style={{ fontSize:30, fontWeight:900, color:scoreData.verdict.color, lineHeight:1 }}>{scoreData.pts}</div>
                <div style={{ fontSize:10, color:scoreData.verdict.color, opacity:0.7 }}>/ 100</div>
              </div>
              <div style={{ height:8, background:'#2a2d3a', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${scoreData.pts}%`, height:'100%', background:`linear-gradient(90deg,${T.up},${T.gld},${T.grn})`, backgroundSize:'200% 100%', backgroundPosition:`${100-scoreData.pts}% 0`, transition:'width 1s ease' }}/>
              </div>
            </div>
            <div>
              {/* ── 판정 제목 + 자동 하향 배지 ─────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize:22, fontWeight:900, color:scoreData.verdict.color }}>{scoreData.verdict.text}</div>
                {/* 5% 이상 고평가 → 자동 하향 배지 */}
                {scoreData.isSignificantlyOver && (
                  <div style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: `${T.gld}20`, border: `1px solid ${T.gld}66`, color: T.gld,
                  }}>
                    ⬇ 등급 하향 조정됨 (고평가 5%+)
                  </div>
                )}
              </div>

              {/* ── 투자 안내 라벨: 주가 > 적정가인데도 매수 성향 점수일 때 ── */}
              {scoreData.showOvervaluedNote && (
                <div style={{
                  marginBottom: 14, padding: '12px 14px', borderRadius: 8,
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
                }}>
                  <div style={{ fontSize: 12, color: '#93c5fd', lineHeight: 1.8 }}>
                    <strong style={{ color: T.dn }}>💡 알림: 성장주 관점의 고평가 종목</strong><br />
                    현재 주가가 계산된 평균 적정주가를{' '}
                    <strong style={{ color: T.up }}>{Math.abs(scoreData.upside).toFixed(1)}% 상회</strong>하여
                    밸류에이션 매력은 낮습니다. 다만 높은 CAGR 및 낮은 PEG 지표가 종합 점수를 견인했습니다.{' '}
                    <strong style={{ color: T.dn }}>성장주(Growth) 관점의 접근</strong>이 유효하며,
                    가치투자(Value) 관점에서는 주가 조정 시 분할 매수를 권장합니다.
                  </div>
                </div>
              )}

              {scoreData.reasons.map((r,i) => (
                <div key={i} style={{ fontSize:13, color:T.sub, display:'flex', gap:8, marginBottom:6 }}>
                  <span style={{ color:T.gld, flexShrink:0 }}>·</span>{r}
                </div>
              ))}
              <div style={{ marginTop:14, padding:'12px 16px', background:`${scoreData.verdict.color}10`, border:`1px solid ${scoreData.verdict.color}33`, borderRadius:8, fontSize:13, color:T.sub, lineHeight:1.8 }}>
                {rawData?.companyName}의 장기 EPS CAGR은{' '}
                {cagrData?.long.eps != null
                  ? <strong style={{ color:T.grn }}>{cagrData.long.eps.toFixed(1)}%</strong>
                  : '산출 불가'}
                {analysis?.avgFV != null && analysis.avgFV > 0 && (
                  <>, 평균 적정주가{' '}<strong style={{ color:T.gld }}>{fmtP(analysis.avgFV, analysis.cur)}</strong></>
                )}.{' '}
                총점 <strong style={{ color:scoreData.verdict.color }}>{scoreData.pts}점</strong>으로{' '}
                <strong style={{ color:scoreData.verdict.color }}>{scoreData.verdict.text}</strong>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 초기 빈 화면 ════════════════════════════════════════════════ */}
      {!loading && !error && !hasData && (
        <div style={{ textAlign:'center', padding:'80px 20px', color:T.mut }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📊</div>
          <div style={{ fontSize:17, fontWeight:700, color:T.sub, marginBottom:10 }}>종목 티커를 입력하고 분석을 시작하세요</div>
          <div style={{ fontSize:13, lineHeight:2.2, color:T.mut }}>
            미국 주식: NVDA · AAPL · MSFT · AMZN · TSLA · GOOGL<br/>
            한국 주식: 005930 (삼성전자) · 000660 (SK하이닉스) · 035420 (NAVER) · 005380 (현대차)
          </div>
          <div style={{ marginTop:20, fontSize:12, color:T.est, lineHeight:1.7 }}>
            실시간 Yahoo Finance / 네이버 증권 연동 · 하드코딩 없음 · 모든 종목 범용 지원
          </div>
        </div>
      )}
    </div>
  )
}
