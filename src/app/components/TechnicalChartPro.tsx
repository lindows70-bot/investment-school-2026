'use client'
// 증권사식 기술적 분석 차트 — 한국식 캔들(양봉 빨강/음봉 파랑) + EMA(112·224) + 일목균형표 구름대(26봉 선행) + 거래량
// + 모멘텀 서브패널(MACD·RSI·스토캐스틱·CCI 탭 선택) + 십자선·툴팁
import { useState, useMemo, useRef, useCallback } from 'react'
import type { TechCandle } from '@/app/api/tech-chart/route'
import { calcMACD, calcRSI, calcStoch, calcCCI, calcMFI, calcADX, calcATR, detectLiquidity, raschkeSequenceMarks, computePOC, computeTTMSqueeze, computeAnchoredVWAP, computeSuperTrend } from '@/lib/techSignals'

/* ── 팔레트 (네이비/틸/골드) ── */
const C = {
  bg: '#0B1120', panel: '#0F172A', grid: '#1E293B', gridSoft: '#162136', axis: '#334155',
  text: '#E2E8F0', textLow: '#7C8BA1',
  up: '#F0475B', down: '#3B82F6',                    // 한국식: 양봉 빨강 / 음봉 파랑
  ema112: '#FBBF24', ema224: '#F97316',
  cloudUp: 'rgba(34,197,94,0.38)', cloudDown: 'rgba(240,71,91,0.34)',   // 어두운 배경에서 또렷하게(0.16→0.38)
  spanA: '#22C55E', spanB: '#F0475B', gold: '#E9C46A',
  future: 'rgba(148,163,184,0.05)',
}

const avgArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

function niceStep(range: number, ticks: number) {
  const raw = range / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const mult = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return mult * mag
}

// 일목균형표 선행스팬 투영 봉수 — 구름이 있으면(52봉+) 26봉 정투영, 신규상장(52봉 미만·구름 없음)은
// 빈 여백만 커지므로 소폭으로 축소(캔들이 화면을 꽉 채우게)
const forwardBars = (n: number) => n >= 52 ? 26 : Math.min(6, Math.max(2, Math.round(n * 0.15)))

// 🔎 분석 렌즈 — 목적별로 관련 지표만 묶어서 ON, 나머지는 OFF(클러터 해소). 한 번에 하나의 관점으로 집중
type SubInd = 'MACD' | 'RSI' | 'STOCH' | 'CCI' | 'MFI' | 'ADX' | 'SQUEEZE' | null
interface LensCfg { ema: boolean; cloud: boolean; vol: boolean; liq: boolean; rk: boolean; poc: boolean; vwap: boolean; st: boolean; ind: SubInd }
const LENSES: { key: string; label: string; color: string; desc: string; cfg: LensCfg }[] = [
  { key: 'core', label: '⭐ 핵심', color: '#d4af37', desc: '추세 뼈대(EMA·구름)+매물대+MACD', cfg: { ema: true, cloud: true, vol: true, liq: false, rk: false, poc: true, vwap: false, st: false, ind: 'MACD' } },
  { key: 'trend', label: '📈 추세·타점', color: '#34d399', desc: 'EMA·구름·SuperTrend·라쉬케·MACD', cfg: { ema: true, cloud: true, vol: false, liq: false, rk: true, poc: false, vwap: false, st: true, ind: 'MACD' } },
  { key: 'supply', label: '💰 매물·평단', color: '#38bdf8', desc: '매물대·기관평단(VWAP)·유동성·MFI', cfg: { ema: false, cloud: false, vol: true, liq: true, rk: false, poc: true, vwap: true, st: false, ind: 'MFI' } },
  { key: 'vol', label: '🔥 변동성 돌파', color: '#f59e0b', desc: 'TTM 스퀴즈·VWAP·SuperTrend(신규 3종)', cfg: { ema: false, cloud: false, vol: true, liq: false, rk: false, poc: false, vwap: true, st: true, ind: 'SQUEEZE' } },
  { key: 'momentum', label: '⚡ 모멘텀', color: '#f0abfc', desc: 'EMA·라쉬케·RSI(에너지·진입)', cfg: { ema: true, cloud: false, vol: false, liq: false, rk: true, poc: false, vwap: false, st: false, ind: 'RSI' } },
  { key: 'all', label: '🔬 전체', color: '#94a3b8', desc: '모든 지표(고급)', cfg: { ema: true, cloud: true, vol: true, liq: true, rk: true, poc: true, vwap: true, st: true, ind: 'MACD' } },
]

interface DispBar {
  idx: number; isFuture: boolean; date: string | null
  open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null
  ema112: number | null; ema224: number | null; senkouA: number | null; senkouB: number | null
}

function buildSeries(data: TechCandle[]): { disp: DispBar[]; N: number; L: number } {
  const N = data.length
  const close = data.map(d => d.close)

  // 지수이동평균(EMA): 첫 값은 SMA 시드 후 재귀
  const ema = (period: number): (number | null)[] => {
    const k = 2 / (period + 1)
    const out: (number | null)[] = new Array(N).fill(null)
    if (N < period) return out
    let prev = avgArr(close.slice(0, period))
    out[period - 1] = prev
    for (let i = period; i < N; i++) { prev = close[i] * k + prev * (1 - k); out[i] = prev }
    return out
  }
  const e112 = ema(112), e224 = ema(224)

  // 최근 p봉의 (최고+최저)/2
  const hl = (p: number, i: number): number | null => {
    if (i < p - 1) return null
    let hi = -Infinity, lo = Infinity
    for (let k = i - p + 1; k <= i; k++) { if (data[k].high > hi) hi = data[k].high; if (data[k].low < lo) lo = data[k].low }
    return (hi + lo) / 2
  }
  // 선행스팬1 = (전환9+기준26)/2, 선행스팬2 = 52봉 중간값 — 화면엔 구름대만 표시
  const spanAbase = data.map((_, i) => { const t = hl(9, i), k = hl(26, i); return t != null && k != null ? (t + k) / 2 : null })
  const spanBbase = data.map((_, i) => hl(52, i))

  const FWD = forwardBars(N)
  const L = N + FWD
  const disp: DispBar[] = []
  for (let j = 0; j < L; j++) {
    const real = j < N ? data[j] : null
    const src = j - 26   // 선행스팬은 항상 26봉 미래 투영(정의) — src∈[0,N) 일 때만 구름값 존재
    disp.push({
      idx: j, isFuture: j >= N, date: real?.date ?? null,
      open: real?.open ?? null, high: real?.high ?? null, low: real?.low ?? null, close: real?.close ?? null,
      volume: real?.volume ?? null,
      ema112: j < N ? e112[j] : null, ema224: j < N ? e224[j] : null,
      senkouA: src >= 0 && src < N ? spanAbase[src] : null,
      senkouB: src >= 0 && src < N ? spanBbase[src] : null,
    })
  }
  return { disp, N, L }
}

export default function TechnicalChartPro({ data, market, avgPrice = null }: {
  data: TechCandle[]; market: 'KR' | 'US'; avgPrice?: number | null
}) {
  const [showEMA, setShowEMA] = useState(true)
  const [showCloud, setShowCloud] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [showLiq, setShowLiq] = useState(false)   // 💧 유동성 레벨 — 기본 OFF(화면 정리, 필요 시 토글)
  const [showRaschke, setShowRaschke] = useState(false)   // 🎼 라쉬케 연쇄 4단계 마커 — 기본 OFF(⭐핵심 렌즈에서 시작, '추세·타점'/'모멘텀' 렌즈로 켬)
  const [showPoc, setShowPoc] = useState(true)   // 📊 매물대 중심선(POC) + 가치영역
  const [showVwap, setShowVwap] = useState(false)   // ⚓ Anchored VWAP(기관 평균단가)
  const [showST, setShowST] = useState(false)   // 🛡️ SuperTrend(시각 트레일링 라인)
  const [ind, setInd] = useState<'MACD' | 'RSI' | 'STOCH' | 'CCI' | 'MFI' | 'ADX' | 'SQUEEZE' | null>('MACD')   // 모멘텀 서브패널(하나만 선택 — 화면 간결)
  const [hover, setHover] = useState<{ j: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // 통화 포맷: KR=정수 원 / US=소수 2자리 달러 (+0 정규화 — Y축 '-0.000' 음의 0 방지)
  const fmt = useCallback((raw: number | null | undefined) => {
    if (raw == null) return '-'
    const n = Object.is(raw, -0) || Math.abs(raw) < 1e-9 ? 0 : raw
    return market === 'KR' ? Math.round(n).toLocaleString()
      : n.toLocaleString(undefined, { minimumFractionDigits: Math.abs(n) < 10 ? 3 : 2, maximumFractionDigits: Math.abs(n) < 10 ? 3 : 2 })
  }, [market])
  const fmtVol = (v: number | null) => v == null ? '-' : v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(1)}만` : String(Math.round(v))

  const { disp, N, L } = useMemo(() => buildSeries(data), [data])

  // 🛡️ ATR 변동성 손절 참고선 = 현재가 − 2×ATR(14) — 종목 고유 변동폭 반영(신호 판독기와 동일 SSOT 계산)
  //    (pMin/pMax 도메인 계산보다 먼저 선언되어야 함)
  const atrStop = useMemo(() => {
    const atrArr = calcATR(data)
    const atr = atrArr[atrArr.length - 1], last = data[data.length - 1]?.close
    if (atr == null || last == null) return null
    const stop = last - 2 * atr
    return stop > 0 ? stop : null
  }, [data])

  /* ── 좌표계 ── */
  const W = 980
  const padL = 12, padR = 70, padT = 16
  const priceH = 356, volGap = 14
  const volH = showVolume ? 116 : 0
  const indH = ind ? 122 : 0                       // 모멘텀 서브패널 높이
  const plotW = W - padL - padR
  const priceTop = padT, priceBot = priceTop + priceH
  const volTop = priceBot + volGap, volBot = volTop + volH
  const indTop = volBot + (ind ? 14 : 0), indBot = indTop + indH
  const H = indBot + 30                            // 날짜축 여백 포함(패널 유무 따라 동적)

  const step = plotW / L
  const cw = Math.max(Math.min(step * 0.7, 13), 0.9)
  const xc = useCallback((j: number) => padL + step * (j + 0.5), [step])

  /* ── 가격 y도메인 ── */
  const { pMin, pMax } = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    const push = (v: number | null) => { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v } }
    disp.forEach(d => {
      push(d.high); push(d.low)
      if (showEMA) { push(d.ema112); push(d.ema224) }
      if (showCloud) { push(d.senkouA); push(d.senkouB) }
    })
    if (avgPrice != null) push(avgPrice)
    if (atrStop != null) push(atrStop)
    const pad = (hi - lo) * 0.06 || 1
    return { pMin: lo - pad, pMax: hi + pad }
  }, [disp, showEMA, showCloud, avgPrice, atrStop])

  const yP = useCallback((v: number) => priceTop + ((pMax - v) / (pMax - pMin)) * priceH, [pMax, pMin, priceTop])
  const volMax = useMemo(() => Math.max(...disp.map(d => d.volume || 0), 1), [disp])
  const yV = (v: number) => volBot - (v / volMax) * volH

  /* ── 💧 유동성 레벨·스윕(SSOT: detectLiquidity) — 표시 대상: 살아있는 레벨(최근 3개씩) + 최근 60봉 내 스윕 ── */
  const liq = useMemo(() => {
    const all = detectLiquidity(data)
    const alive = (t: 'low' | 'high') => all.filter(l => l.type === t && l.endIdx == null).slice(-3)
    const sweeps = all.filter(l => l.swept && l.endIdx != null && l.endIdx >= data.length - 60)
    return { levels: [...alive('low'), ...alive('high')], sweeps }
  }, [data])

  /* ── 🎼 라쉬케 연쇄 4단계 마커(SSOT: raschkeSequenceMarks) — 판독기 연쇄 진행바가 차트 어디서 일어났는지 봉 위치로 ── */
  const raschke = useMemo(() => raschkeSequenceMarks(data), [data])

  /* ── 📊 매물대 중심선(POC, SSOT: computePOC) — 최근 120봉 가격×거래량 최대 거래 가격대 + 가치영역(70%) ── */
  const poc = useMemo(() => computePOC(data), [data])

  /* ── 🔥 TTM Squeeze / ⚓ Anchored VWAP / 🛡️ SuperTrend (SSOT: techSignals) ── */
  const squeeze = useMemo(() => computeTTMSqueeze(data), [data])
  const avwap = useMemo(() => computeAnchoredVWAP(data), [data])
  const superT = useMemo(() => computeSuperTrend(data), [data])

  /* ── 모멘텀 지표(SSOT: lib/techSignals) — 실봉(N개)에만 값 존재 ── */
  const mom = useMemo(() => {
    const close = data.map(d => d.close)
    const { macd, signal, hist } = calcMACD(close)
    const rsi = calcRSI(close)
    const { k, d } = calcStoch(data)
    const cci = calcCCI(data)
    const mfi = calcMFI(data)
    const adx = calcADX(data)
    return { macd, signal, hist, rsi, k, d, cci, mfi, adx }
  }, [data])

  // 서브패널 y도메인: RSI·스토캐스틱·MFI=0~100 고정 / ADX=0~60 / MACD·CCI=데이터 기반 대칭
  const indDom = useMemo((): [number, number] => {
    if (ind === 'RSI' || ind === 'STOCH' || ind === 'MFI') return [0, 100]
    if (ind === 'ADX') return [0, 60]
    const arrs = ind === 'MACD' ? [mom.macd, mom.signal, mom.hist] : ind === 'SQUEEZE' ? [squeeze?.momArr ?? []] : [mom.cci]
    let m = ind === 'CCI' ? 150 : 0
    for (const a of arrs) for (const v of a) if (v != null && Math.abs(v) > m) m = Math.abs(v)
    return [-m * 1.08 || -1, m * 1.08 || 1]
  }, [ind, mom, squeeze])
  const yI = useCallback((v: number) => indTop + ((indDom[1] - v) / (indDom[1] - indDom[0])) * indH, [indDom, indTop, indH])

  // 지표 배열 → 폴리라인 path (실봉 인덱스만)
  const indPath = useCallback((arr: (number | null)[]) => {
    let d = '', pen = false
    for (let j = 0; j < N; j++) {
      const v = arr[j]
      if (v == null) { pen = false; continue }
      d += (pen ? ' L' : 'M') + xc(j).toFixed(1) + ',' + yI(v).toFixed(1)
      pen = true
    }
    return d
  }, [N, xc, yI])

  /* ── 선(폴리라인) path ── */
  const linePath = useCallback((key: 'ema112' | 'ema224' | 'senkouA' | 'senkouB') => {
    let d = '', pen = false
    for (const p of disp) {
      const v = p[key]
      if (v == null) { pen = false; continue }
      d += (pen ? ' L' : 'M') + xc(p.idx).toFixed(1) + ',' + yP(v).toFixed(1)
      pen = true
    }
    return d
  }, [disp, xc, yP])

  /* ── 구름대 폴리곤(교차점 보간) ── */
  const cloudPolys = useMemo(() => {
    if (!showCloud) return []
    const polys: { up: boolean; pts: string }[] = []
    for (let j = 0; j < L - 1; j++) {
      const a0 = disp[j].senkouA, b0 = disp[j].senkouB, a1 = disp[j + 1].senkouA, b1 = disp[j + 1].senkouB
      if (a0 == null || b0 == null || a1 == null || b1 == null) continue
      const x0 = xc(j), x1 = xc(j + 1)
      const ay0 = yP(a0), ay1 = yP(a1), by0 = yP(b0), by1 = yP(b1)
      const d0 = a0 - b0, d1 = a1 - b1
      if ((d0 >= 0 && d1 >= 0) || (d0 < 0 && d1 < 0)) {
        polys.push({ up: d0 >= 0, pts: `${x0},${ay0} ${x1},${ay1} ${x1},${by1} ${x0},${by0}` })
      } else {
        const t = d0 / (d0 - d1), xm = x0 + t * (x1 - x0), ym = ay0 + t * (ay1 - ay0)
        polys.push({ up: d0 >= 0, pts: `${x0},${ay0} ${xm},${ym} ${x0},${by0}` })
        polys.push({ up: d1 >= 0, pts: `${x1},${ay1} ${xm},${ym} ${x1},${by1}` })
      }
    }
    return polys
  }, [disp, showCloud, L, xc, yP])

  /* ── 축 눈금 ── */
  const priceTicks = useMemo(() => {
    const s = niceStep(pMax - pMin, 5)
    const t: number[] = []
    for (let v = Math.ceil(pMin / s) * s; v <= pMax; v += s) t.push(v)
    return t
  }, [pMin, pMax])

  const dateTicks = useMemo(() => {
    const t: { j: number; label: string }[] = []
    for (let k = 0; k < 6; k++) {
      const j = Math.round((k / 5) * (N - 1))
      t.push({ j, label: (disp[j]?.date ?? '').slice(2).replace(/-/g, '.') })
    }
    return t
  }, [disp, N])

  /* ── 마우스 → 봉 인덱스 ── */
  const onMove = (e: React.MouseEvent) => {
    const el = svgRef.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / (rect.width / W)
    let j = Math.round((mx - padL) / step - 0.5)
    j = Math.max(0, Math.min(N - 1, j))
    setHover({ j, px: e.clientX - rect.left, py: e.clientY - rect.top })
  }

  const H0 = hover ? disp[hover.j] : null
  const prevClose = hover && hover.j > 0 ? disp[hover.j - 1].close : null
  const chg = H0?.close != null && prevClose != null ? H0.close - prevClose : null
  const chgPct = chg != null && prevClose ? (chg / prevClose) * 100 : null

  // 현재 기술적 상태 요약(정배열·구름 위치)
  const last = disp[N - 1]
  const aligned = last?.ema112 != null && last?.ema224 != null ? (last.ema112 > last.ema224 ? 'up' : 'down') : null
  const cloudAt = disp[N - 1]   // 현재 봉 위치의 구름(=26봉 전 계산값이 투영됨)
  const abovCloud = last?.close != null && cloudAt?.senkouA != null && cloudAt?.senkouB != null
    ? last.close > Math.max(cloudAt.senkouA, cloudAt.senkouB) ? 'above' : last.close < Math.min(cloudAt.senkouA, cloudAt.senkouB) ? 'below' : 'in'
    : null

  // 🔎 렌즈 적용 — 관련 지표만 ON, 나머지 OFF / 현재 상태와 일치하는 렌즈 하이라이트
  const applyLens = (c: LensCfg) => {
    setShowEMA(c.ema); setShowCloud(c.cloud); setShowVolume(c.vol); setShowLiq(c.liq)
    setShowRaschke(c.rk); setShowPoc(c.poc); setShowVwap(c.vwap); setShowST(c.st); setInd(c.ind)
  }
  const curCfg: LensCfg = { ema: showEMA, cloud: showCloud, vol: showVolume, liq: showLiq, rk: showRaschke, poc: showPoc, vwap: showVwap, st: showST, ind }
  const activeLens = LENSES.find(l => (Object.keys(l.cfg) as (keyof LensCfg)[]).every(k => l.cfg[k] === curCfg[k]))?.key ?? null

  const toggle = (on: boolean, label: string, color: string, set: (f: (v: boolean) => boolean) => void) => (
    <button onClick={() => set(v => !v)} style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
      backgroundColor: on ? color : 'transparent', color: on ? C.bg : C.textLow, border: `1px solid ${on ? color : C.axis}`,
    }}>{label}</button>
  )

  if (!data.length) return <div style={{ color: C.textLow, fontSize: 12.5, padding: 20 }}>차트 데이터가 없습니다.</div>

  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 🔎 분석 렌즈 — 목적별 지표 묶음(하나 누르면 관련만 ON·나머지 OFF) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.textLow, marginRight: 2 }}>🔎 렌즈</span>
        {LENSES.map(l => {
          const on = activeLens === l.key
          return (
            <button key={l.key} onClick={() => applyLens(l.cfg)} title={l.desc} style={{
              padding: '4px 11px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all .15s',
              background: on ? l.color : `${l.color}18`, color: on ? C.bg : l.color, border: `1px solid ${on ? l.color : l.color + '55'}`,
              boxShadow: on ? `0 0 10px ${l.color}55` : 'none',
            }}>{l.label}</button>
          )
        })}
        <span style={{ fontSize: 9.5, color: '#7f93a8', marginLeft: 2 }}>{activeLens ? LENSES.find(l => l.key === activeLens)?.desc : '사용자 지정(세부 토글로 조정됨)'}</span>
      </div>
      {/* 세부 토글(개별 지표 미세 조정) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {toggle(showEMA, '지수이평선', C.ema224, setShowEMA)}
        {toggle(showCloud, '구름대', C.spanA, setShowCloud)}
        {toggle(showVolume, '거래량', C.gold, setShowVolume)}
        {toggle(showLiq, '💧유동성', '#2dd4bf', setShowLiq)}
        {toggle(showRaschke, '🎼라쉬케', '#f0abfc', setShowRaschke)}
        {poc && toggle(showPoc, '📊매물대', '#38bdf8', setShowPoc)}
        {avwap && toggle(showVwap, '⚓VWAP', '#f472b6', setShowVwap)}
        {superT && toggle(showST, '🛡️추세선', '#34d399', setShowST)}
        {/* 모멘텀 서브패널 탭(하나만) */}
        <span style={{ display: 'inline-flex', border: `1px solid ${C.axis}`, borderRadius: 7, overflow: 'hidden', marginLeft: 4 }}>
          {(['MACD', 'RSI', 'STOCH', 'CCI', 'MFI', 'ADX', 'SQUEEZE'] as const).map(t => (
            <button key={t} onClick={() => setInd(v => v === t ? null : t)} style={{
              padding: '4px 9px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: ind === t ? '#7c3aed' : 'transparent', color: ind === t ? '#fff' : C.textLow,
            }}>{t === 'STOCH' ? 'Stoch' : t === 'SQUEEZE' ? '🔥스퀴즈' : t}</button>
          ))}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          {aligned && <span style={{ fontSize: 10.5, fontWeight: 800, color: aligned === 'up' ? '#4ade80' : '#f87171', background: aligned === 'up' ? '#14532d44' : '#7f1d1d44', borderRadius: 5, padding: '2px 8px' }}>
            {aligned === 'up' ? '📈 EMA 정배열(112>224)' : '📉 EMA 역배열(112<224)'}</span>}
          {abovCloud && <span style={{ fontSize: 10.5, fontWeight: 800, color: abovCloud === 'above' ? '#4ade80' : abovCloud === 'below' ? '#f87171' : '#eab308', background: '#0F172A', border: `1px solid ${C.axis}`, borderRadius: 5, padding: '2px 8px' }}>
            {abovCloud === 'above' ? '☁️ 구름 위(강세·지지)' : abovCloud === 'below' ? '☁️ 구름 아래(약세·저항)' : '☁️ 구름 속(방향 탐색)'}</span>}
          {squeeze && (squeeze.on || squeeze.fired) && <span style={{ fontSize: 10.5, fontWeight: 800, color: squeeze.on ? '#f59e0b' : squeeze.fired === 'up' ? '#4ade80' : '#f87171', background: squeeze.on ? '#42200644' : squeeze.fired === 'up' ? '#14532d44' : '#7f1d1d44', border: `1px solid ${squeeze.on ? '#f59e0b55' : squeeze.fired === 'up' ? '#22c55e55' : '#ef444455'}`, borderRadius: 5, padding: '2px 8px' }}>
            {squeeze.on ? `🔥 스퀴즈 압축(${squeeze.barsOn}봉)` : squeeze.fired === 'up' ? '💥 스퀴즈 상방 분출' : '💥 스퀴즈 하방 분출'}</span>}
          {showVwap && avwap && <span style={{ fontSize: 10.5, fontWeight: 800, color: avwap.above ? '#4ade80' : '#f87171', background: '#831843aa', border: '1px solid #f472b655', borderRadius: 5, padding: '2px 8px' }}>
            ⚓ VWAP {avwap.above ? '위' : '아래'}({avwap.distPct}%)</span>}
        </span>
      </div>

      {/* 차트 */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: 'crosshair' }}>
          {/* 미래 투영 음영 + 가로 그리드 */}
          <rect x={xc(N) - step / 2} y={priceTop} width={plotW - (xc(N) - step / 2 - padL)} height={priceH} fill={C.future} />
          {priceTicks.map((v, i) => (
            <g key={'pt' + i}>
              <line x1={padL} x2={W - padR} y1={yP(v)} y2={yP(v)} stroke={C.gridSoft} strokeWidth={1} />
              <text x={W - padR + 6} y={yP(v) + 3.5} fontSize={10.5} fontWeight={700} fill={C.textLow}>{fmt(v)}</text>
            </g>
          ))}
          {/* 구름대 + 선행스팬 경계선(증권사식 — 구름 윤곽 또렷하게) */}
          {cloudPolys.map((p, i) => <polygon key={'cl' + i} points={p.pts} fill={p.up ? C.cloudUp : C.cloudDown} />)}
          {showCloud && (
            <g fill="none" opacity={0.75}>
              <path d={linePath('senkouA')} stroke={C.spanA} strokeWidth={1.1} />
              <path d={linePath('senkouB')} stroke={C.spanB} strokeWidth={1.1} />
            </g>
          )}
          {/* 오늘 경계선 */}
          <line x1={xc(N) - step / 2} x2={xc(N) - step / 2} y1={priceTop} y2={priceBot} stroke={C.axis} strokeWidth={1} strokeDasharray="3 3" />
          {/* 캔들 */}
          {disp.map(d => {
            if (d.close == null || d.open == null || d.high == null || d.low == null) return null
            const up = d.close >= d.open, col = up ? C.up : C.down, x = xc(d.idx)
            const yO = yP(d.open), yCl = yP(d.close)
            return (
              <g key={'c' + d.idx}>
                <line x1={x} x2={x} y1={yP(d.high)} y2={yP(d.low)} stroke={col} strokeWidth={1} />
                <rect x={x - cw / 2} y={Math.min(yO, yCl)} width={cw} height={Math.max(Math.abs(yO - yCl), 0.8)} fill={col} />
              </g>
            )
          })}
          {/* EMA */}
          {showEMA && (
            <g fill="none">
              <path d={linePath('ema112')} stroke={C.ema112} strokeWidth={1.6} />
              <path d={linePath('ema224')} stroke={C.ema224} strokeWidth={1.9} />
            </g>
          )}
          {/* 평단가 가이드선(실보유 시에만) */}
          {avgPrice != null && (
            <g>
              <line x1={padL} x2={W - padR} y1={yP(avgPrice)} y2={yP(avgPrice)} stroke={C.gold} strokeWidth={1.2} strokeDasharray="5 3" />
              <rect x={padL} y={yP(avgPrice) - 9} width={96} height={16} rx={3} fill={C.gold} />
              <text x={padL + 6} y={yP(avgPrice) + 2.5} fontSize={10} fontWeight={800} fill={C.bg}>평단 {fmt(avgPrice)}</text>
            </g>
          )}
          {/* 🛡️ ATR 변동성 손절 참고선(현재가 − 2×ATR) — 라벨은 Y축 영역(우측 여백)에만 표시해 차트를 가리지 않음 */}
          {atrStop != null && (
            <g>
              <line x1={padL} x2={W - padR} y1={yP(atrStop)} y2={yP(atrStop)} stroke="#a78bfa" strokeWidth={1.2} strokeDasharray="7 4" opacity={0.85} />
              <rect x={W - padR} y={yP(atrStop) - 8} width={padR} height={16} rx={2} fill="#a78bfa" />
              <text x={W - padR + 4} y={yP(atrStop) + 3} fontSize={9.5} fontWeight={800} fill={C.bg}>🛡{fmt(atrStop)}</text>
            </g>
          )}
          {/* 📊 매물대(볼륨 프로파일) — 차트 우측에 '세워놓은 거래량' 가로 막대(원본식). 최근 120봉 가격대별 거래량 히스토그램.
              막대 = 우측 끝에서 좌측으로 거래량 비례(최대 폭 MAXW). POC 구간=진한 하이라이트, 가치영역(70%)=중간, 밖=흐림 */}
          {showPoc && poc && (() => {
            const MAXW = 110                       // 최대 막대 폭(px)
            const xR = W - padR                    // 우측 앵커(가격축 직전)
            const y0 = yP(poc.poc)
            return (
              <g>
                {poc.profile.map((b, i) => {
                  if (b.frac <= 0.01) return null
                  const yT = yP(Math.min(b.hi, pMax)), yB = yP(Math.max(b.lo, pMin))
                  const h = Math.max(1, yB - yT - 0.6)   // 구간 간 미세 간격
                  const isPoc = b.lo <= poc.poc && poc.poc <= b.hi
                  const wpx = Math.max(2, b.frac * MAXW)
                  return (
                    <rect key={'vp' + i} x={xR - wpx} y={yT} width={wpx} height={h}
                      fill={isPoc ? '#38bdf8' : b.inVA ? '#38bdf8' : '#475569'}
                      opacity={isPoc ? 0.75 : b.inVA ? 0.35 : 0.18} />
                  )
                })}
                {/* POC 수평 점선 + 좌측 라벨. 평단 배너와 가까우면 라벨만 세로로 밀어냄(선은 실제 위치 유지) */}
                <line x1={padL} x2={xR} y1={y0} y2={y0} stroke="#38bdf8" strokeWidth={1.2} strokeDasharray="8 4" opacity={0.8} />
                {(() => {
                  let ly = y0
                  if (avgPrice != null) {
                    const ya = yP(avgPrice)
                    if (Math.abs(ya - y0) < 17) ly = y0 <= ya ? ya - 17 : ya + 17   // 평단 위면 위로, 아래면 아래로
                  }
                  return (<>
                    {ly !== y0 && <line x1={padL + 4} x2={padL + 4} y1={y0} y2={ly} stroke="#38bdf8" strokeWidth={0.8} opacity={0.5} />}
                    <rect x={padL} y={ly - 9} width={128} height={16} rx={3} fill="#0c4a6e" stroke="#38bdf8" strokeWidth={0.8} />
                    <text x={padL + 5} y={ly + 3} fontSize={9.5} fontWeight={800} fill="#7dd3fc">📊 매물대 {fmt(poc.poc)}</text>
                  </>)
                })()}
              </g>
            )
          })()}

          {/* 🛡️ SuperTrend — 시각 트레일링 라인(방향 전환 시 끊어 그림·상승=초록 지지/하락=빨강 저항) */}
          {showST && superT && (() => {
            const segs: { d: string; up: boolean }[] = []
            let cur = '', pen = false, upSeg = true
            for (let j = 0; j < N; j++) {
              const v = superT.line[j], dr = superT.dir[j]
              if (v == null || dr == null) { if (cur) { segs.push({ d: cur, up: upSeg }); cur = '' } pen = false; continue }
              const up = dr === 1
              if (pen && up !== upSeg) { segs.push({ d: cur, up: upSeg }); cur = ''; pen = false }
              cur += (pen ? ' L' : 'M') + xc(j).toFixed(1) + ',' + yP(v).toFixed(1); pen = true; upSeg = up
            }
            if (cur) segs.push({ d: cur, up: upSeg })
            return <g fill="none">{segs.map((s, i) => <path key={'st' + i} d={s.d} stroke={s.up ? '#34d399' : '#f87171'} strokeWidth={1.8} opacity={0.9} />)}</g>
          })()}

          {/* ⚓ Anchored VWAP — 직전 스윙 저점 앵커 기관 평균단가(핑크 실선) + 앵커 마커 */}
          {showVwap && avwap && (() => {
            let d = '', pen = false
            for (let j = 0; j < N; j++) { const v = avwap.line[j]; if (v == null) { pen = false; continue } d += (pen ? ' L' : 'M') + xc(j).toFixed(1) + ',' + yP(v).toFixed(1); pen = true }
            const yv = yP(avwap.vwap)
            return (
              <g>
                <path d={d} fill="none" stroke="#f472b6" strokeWidth={1.7} opacity={0.9} />
                <circle cx={xc(avwap.anchorIdx)} cy={yP(data[avwap.anchorIdx].low)} r={3.5} fill="#f472b6" stroke={C.bg} strokeWidth={1} />
                <text x={xc(avwap.anchorIdx)} y={yP(data[avwap.anchorIdx].low) + 13} fontSize={8} fontWeight={800} fill="#f472b6" textAnchor="middle">⚓</text>
                <rect x={W - padR - 96} y={yv - 8} width={96} height={15} rx={2} fill="#831843" stroke="#f472b6" strokeWidth={0.7} />
                <text x={W - padR - 92} y={yv + 3} fontSize={9} fontWeight={800} fill="#fbcfe8">⚓VWAP {fmt(avwap.vwap)}</text>
              </g>
            )
          })()}

          {/* 💧 유동성 레벨(살아있는 전 고점·저점) + 스윕 마커 — 점수·추천 미반영, 차트 전용.
              라벨 declutter: 비슷한 가격대 레벨이 겹치면 선은 다 긋되 텍스트는 Y축 12px 내 근접 시 생략(평단·ATR 라벨과도 충돌 회피) */}
          {showLiq && (() => {
            const usedY: number[] = []
            if (avgPrice != null) usedY.push(yP(avgPrice))
            if (atrStop != null) usedY.push(yP(atrStop))
            const canLabel = (y: number) => {
              if (usedY.some(u => Math.abs(u - y) < 12)) return false
              usedY.push(y); return true
            }
            return (<>
              {liq.levels.map((lv, i) => {
                const y = yP(lv.price)
                const label = canLabel(y)
                return (
                  <g key={'lq' + i} opacity={0.9}>
                    <line x1={xc(lv.idx)} x2={xc(N - 1)} y1={y} y2={y}
                      stroke={lv.type === 'low' ? '#2dd4bf' : '#fb923c'} strokeWidth={1} strokeDasharray="2 4" />
                    {label && (
                      <text x={Math.min(xc(lv.idx) + 4, W - padR - 78)} y={y + (lv.type === 'low' ? 11 : -4)}
                        fontSize={9} fontWeight={800} fill={lv.type === 'low' ? '#2dd4bf' : '#fb923c'}>
                        {lv.type === 'low' ? '유동성(전저점)' : '유동성(전고점)'}
                      </text>
                    )}
                  </g>
                )
              })}
              {liq.sweeps.map((sw, i) => {
                const y = yP(sw.price)
                const label = canLabel(y + (sw.type === 'low' ? 22 : -14))   // 스윕 텍스트 위치 기준으로 충돌 검사
                return (
                  <g key={'sw' + i}>
                    <line x1={xc(sw.idx)} x2={xc(sw.endIdx!)} y1={y} y2={y}
                      stroke={sw.type === 'low' ? '#2dd4bf' : '#fb923c'} strokeWidth={1} strokeDasharray="2 4" opacity={0.45} />
                    <text x={xc(sw.endIdx!)} y={y + (sw.type === 'low' ? 16 : -8)} fontSize={12} textAnchor="middle">💧</text>
                    {label && (
                      <text x={xc(sw.endIdx!)} y={y + (sw.type === 'low' ? 27 : -19)} fontSize={8.5} fontWeight={800}
                        textAnchor="middle" fill={sw.type === 'low' ? '#2dd4bf' : '#fb923c'}>
                        스윕{sw.volBoost ? '·거래량↑' : ''}
                      </text>
                    )}
                  </g>
                )
              })}
            </>)
          })()}

          {/* 🎼 라쉬케 연쇄 4단계 마커 — CCI 신호탄 → RSI50 돌파 → MACD 영선 돌파 → 첫 눌림목(최적 타점).
              500봉이라 봉 간격 ~2px → 며칠 차 마커가 가로로 붙음 → 봉 아래 '세로 사다리'로 분리. 텍스트는 현재 단계(📍)만(범례가 ①②③④ 설명) */}
          {showRaschke && raschke && (() => {
            const marks = [
              { idx: raschke.cci, n: 1, s: 1, label: 'CCI 신호탄', color: '#eab308' },
              { idx: raschke.rsi50, n: 2, s: 2, label: 'RSI50 돌파', color: '#22d3ee' },
              { idx: raschke.macdZero, n: 3, s: 3, label: 'MACD 영선 돌파', color: '#4ade80' },
              { idx: raschke.pullback, n: 4, s: 4, label: '첫 눌림목(최적 타점)', color: '#f0abfc' },
            ].filter((m): m is { idx: number; n: number; s: number; label: string; color: string } => m.idx != null && m.idx >= 0 && m.idx < N)
            // 실제 위치 충돌 감지 — 겹칠 때만 아래로 밀어냄(블라인드 사다리가 가격 상승 구간서 수렴하는 결함 방지)
            const placed: { x: number; y: number }[] = []
            const laid = marks.map(m => {
              const x = xc(m.idx), yLow = yP(data[m.idx].low)
              const here = raschke.stage === m.s
              const r = here ? 8.5 : 6
              let y = yLow + 16
              let g = 0
              while (placed.some(p => Math.abs(p.x - x) < 16 && Math.abs(p.y - y) < 15) && g++ < 8) y += 14
              placed.push({ x, y })
              return { ...m, x, y, r, yLow, here }
            })
            return (<>
              {laid.map(m => (
                <g key={'rk' + m.n}>
                  <line x1={m.x} x2={m.x} y1={m.yLow + 2} y2={m.y - m.r} stroke={m.color} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
                  {m.here && <circle cx={m.x} cy={m.y} r={m.r + 3} fill="none" stroke={m.color} strokeWidth={1.5} opacity={0.5} />}
                  <circle cx={m.x} cy={m.y} r={m.r} fill={m.color} stroke="#0F172A" strokeWidth={1.5} />
                  <text x={m.x} y={m.y + 3.2} fontSize={m.here ? 10.5 : 8.5} fontWeight={900} textAnchor="middle" fill="#0F172A">{m.n}</text>
                  {m.here && (() => {
                    const leftSide = m.x > W - padR - 100   // 우측 끝이면 라벨을 왼쪽으로
                    return (
                      <text x={leftSide ? m.x - m.r - 4 : m.x + m.r + 4} y={m.y + 3.2} fontSize={9} fontWeight={800}
                        fill={m.color} textAnchor={leftSide ? 'end' : 'start'}>📍{m.label}</text>
                    )
                  })()}
                </g>
              ))}
            </>)
          })()}

          {/* 거래량 */}
          {showVolume && disp.map(d => {
            if (d.volume == null || d.close == null || d.open == null) return null
            return <rect key={'v' + d.idx} x={xc(d.idx) - cw / 2} y={yV(d.volume)} width={cw} height={volBot - yV(d.volume)}
              fill={d.close >= d.open ? C.up : C.down} opacity={0.55} />
          })}
          {showVolume && <text x={padL + 2} y={volTop + 11} fontSize={10} fontWeight={700} fill={C.textLow}>거래량</text>}

          {/* 모멘텀 서브패널 */}
          {ind && (() => {
            const refLine = (v: number, label: string, col = C.axis) => (
              <g key={'rl' + v}>
                <line x1={padL} x2={W - padR} y1={yI(v)} y2={yI(v)} stroke={col} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
                <text x={W - padR + 6} y={yI(v) + 3.5} fontSize={9.5} fontWeight={700} fill={C.textLow}>{label}</text>
              </g>
            )
            return (
              <g>
                <line x1={padL} x2={W - padR} y1={indTop - 7} y2={indTop - 7} stroke={C.grid} strokeWidth={1} />
                <text x={padL + 2} y={indTop + 11} fontSize={10} fontWeight={700} fill="#a78bfa">
                  {ind === 'MACD' ? 'MACD (12·26·9)' : ind === 'RSI' ? 'RSI (14)' : ind === 'STOCH' ? '스토캐스틱 (14·3)' : ind === 'CCI' ? 'CCI (20)' : ind === 'MFI' ? 'MFI (14) — 거래량 가중 수급' : ind === 'SQUEEZE' ? '🔥 TTM Squeeze (BB20 ⊂ KC1.5) — 빨강점=압축·초록점=해제·막대=모멘텀' : 'ADX (14) — 추세 강도'}
                </text>
                {ind === 'MACD' && (<>
                  {/* 라쉬케: 영선(0)이 추세 전환의 진짜 기준선 — 영선 아래 골든크로스→영선 돌파가 확정 신호 */}
                  {refLine(0, '0 영선', '#f0abfc')}
                  {mom.hist.map((h, j) => h == null ? null : (
                    <rect key={'h' + j} x={xc(j) - cw / 2} y={Math.min(yI(0), yI(h))} width={cw} height={Math.max(Math.abs(yI(h) - yI(0)), 0.5)}
                      fill={h >= 0 ? C.up : C.down} opacity={0.45} />
                  ))}
                  <path d={indPath(mom.macd)} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
                  <path d={indPath(mom.signal)} fill="none" stroke="#f97316" strokeWidth={1.4} />
                </>)}
                {ind === 'RSI' && (<>
                  <rect x={padL} y={yI(100)} width={plotW} height={yI(70) - yI(100)} fill={C.up} opacity={0.07} />
                  <rect x={padL} y={yI(30)} width={plotW} height={yI(0) - yI(30)} fill={C.down} opacity={0.07} />
                  {/* 라쉬케: 50선 돌파 = 매수세 장악(30/70보다 중요) */}
                  {refLine(70, '70', C.up)}{refLine(50, '50 라쉬케선', '#f0abfc')}{refLine(30, '30', C.down)}
                  <path d={indPath(mom.rsi)} fill="none" stroke="#a78bfa" strokeWidth={1.6} />
                </>)}
                {ind === 'STOCH' && (<>
                  <rect x={padL} y={yI(100)} width={plotW} height={yI(80) - yI(100)} fill={C.up} opacity={0.07} />
                  <rect x={padL} y={yI(20)} width={plotW} height={yI(0) - yI(20)} fill={C.down} opacity={0.07} />
                  {refLine(80, '80', C.up)}{refLine(20, '20', C.down)}
                  <path d={indPath(mom.k)} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
                  <path d={indPath(mom.d)} fill="none" stroke="#f97316" strokeWidth={1.4} />
                </>)}
                {ind === 'CCI' && (<>
                  {refLine(100, '+100', C.up)}{refLine(0, '0')}{refLine(-100, '-100', C.down)}
                  <path d={indPath(mom.cci)} fill="none" stroke="#a78bfa" strokeWidth={1.6} />
                </>)}
                {ind === 'MFI' && (<>
                  <rect x={padL} y={yI(100)} width={plotW} height={yI(80) - yI(100)} fill={C.up} opacity={0.07} />
                  <rect x={padL} y={yI(20)} width={plotW} height={yI(0) - yI(20)} fill={C.down} opacity={0.07} />
                  {refLine(80, '80 과열', C.up)}{refLine(20, '20 소외', C.down)}
                  <path d={indPath(mom.mfi)} fill="none" stroke="#34d399" strokeWidth={1.6} />
                </>)}
                {ind === 'ADX' && (<>
                  <rect x={padL} y={yI(20)} width={plotW} height={yI(0) - yI(20)} fill="#94a3b8" opacity={0.08} />
                  {refLine(25, '25 추세장', C.up)}{refLine(20, '20 박스권', '#94a3b8')}
                  <path d={indPath(mom.adx)} fill="none" stroke="#38bdf8" strokeWidth={1.6} />
                </>)}
                {ind === 'SQUEEZE' && squeeze && (<>
                  {refLine(0, '0')}
                  {/* 모멘텀 히스토그램 — 4색(양수 가속=진초록/양수 둔화=연초록 / 음수 가속=진빨강/음수 둔화=연빨강) */}
                  {squeeze.momArr.map((v, j) => {
                    if (v == null) return null
                    const pv = squeeze.momArr[j - 1] ?? 0
                    const up = v >= 0, rising = Math.abs(v) >= Math.abs(pv)
                    const col = up ? (rising ? '#059669' : '#6ee7b7') : (rising ? '#dc2626' : '#fca5a5')
                    const y0 = yI(0), yv = yI(v)
                    return <rect key={'sq' + j} x={xc(j) - cw / 2} y={Math.min(y0, yv)} width={cw} height={Math.max(1, Math.abs(yv - y0))} fill={col} />
                  })}
                  {/* 스퀴즈 점 — 영선 위 도트(ON=빨강 압축 / OFF=초록 해제) */}
                  {squeeze.onArr.map((o, j) => o == null ? null : (
                    <circle key={'sd' + j} cx={xc(j)} cy={yI(0)} r={1.9} fill={o ? '#ef4444' : '#22c55e'} />
                  ))}
                </>)}
              </g>
            )
          })()}

          {/* 날짜축 */}
          {dateTicks.map((t, i) => (
            <text key={'dt' + i} x={xc(t.j)} y={H - 8} fontSize={10} fontWeight={600} fill={C.textLow}
              textAnchor={i === 0 ? 'start' : i === 5 ? 'end' : 'middle'}>{t.label}</text>
          ))}
          {/* 십자선 */}
          {H0?.close != null && hover && (
            <g pointerEvents="none">
              <line x1={xc(hover.j)} x2={xc(hover.j)} y1={priceTop} y2={ind ? indBot : showVolume ? volBot : priceBot} stroke={C.axis} strokeWidth={1} strokeDasharray="2 3" />
              <line x1={padL} x2={W - padR} y1={yP(H0.close)} y2={yP(H0.close)} stroke={C.axis} strokeWidth={1} strokeDasharray="2 3" />
              <rect x={W - padR} y={yP(H0.close) - 8} width={padR} height={16} rx={2} fill={C.axis} />
              <text x={W - padR + 5} y={yP(H0.close) + 3} fontSize={10} fontWeight={800} fill={C.text}>{fmt(H0.close)}</text>
            </g>
          )}
        </svg>

        {/* 툴팁 */}
        {H0?.close != null && hover && (
          <div style={{
            position: 'absolute', zIndex: 10, borderRadius: 8, padding: 10, fontSize: 11, pointerEvents: 'none',
            backgroundColor: C.panel, border: `1px solid ${C.axis}`, boxShadow: '0 8px 24px rgba(0,0,0,.45)',
            left: Math.min(hover.px + 14, 700), top: Math.max(hover.py - 10, 8), minWidth: 176,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: C.textLow }}>{H0.date}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 2 }}>
              <span style={{ color: C.textLow }}>시가</span><span style={{ textAlign: 'right', fontWeight: 700, color: C.text }}>{fmt(H0.open)}</span>
              <span style={{ color: C.textLow }}>고가</span><span style={{ textAlign: 'right', fontWeight: 700, color: C.up }}>{fmt(H0.high)}</span>
              <span style={{ color: C.textLow }}>저가</span><span style={{ textAlign: 'right', fontWeight: 700, color: C.down }}>{fmt(H0.low)}</span>
              <span style={{ color: C.textLow }}>종가</span><span style={{ textAlign: 'right', fontWeight: 900, color: (H0.close ?? 0) >= (H0.open ?? 0) ? C.up : C.down }}>{fmt(H0.close)}</span>
              {chg != null && chgPct != null && (<>
                <span style={{ color: C.textLow }}>전봉대비</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: chg >= 0 ? C.up : C.down }}>{chg >= 0 ? '▲' : '▼'} {fmt(Math.abs(chg))} ({chgPct.toFixed(2)}%)</span>
              </>)}
              <span style={{ color: C.textLow }}>거래량</span><span style={{ textAlign: 'right', fontWeight: 700, color: C.text }}>{fmtVol(H0.volume)}</span>
            </div>
            {showEMA && H0.ema112 != null && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.grid}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.ema112 }}>EMA112 {fmt(H0.ema112)}</span>
                <span style={{ color: C.ema224 }}>EMA224 {fmt(H0.ema224)}</span>
              </div>
            )}
            {ind && hover && (() => {
              const j = hover.j, f1 = (v: number | null | undefined) => v == null ? '-' : v.toFixed(ind === 'MACD' ? 2 : 1)
              return (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.grid}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  {ind === 'MACD' && <><span style={{ color: '#22d3ee' }}>MACD {f1(mom.macd[j])}</span><span style={{ color: '#f97316' }}>Signal {f1(mom.signal[j])}</span></>}
                  {ind === 'RSI' && <span style={{ color: '#a78bfa' }}>RSI {f1(mom.rsi[j])}</span>}
                  {ind === 'STOCH' && <><span style={{ color: '#22d3ee' }}>%K {f1(mom.k[j])}</span><span style={{ color: '#f97316' }}>%D {f1(mom.d[j])}</span></>}
                  {ind === 'CCI' && <span style={{ color: '#a78bfa' }}>CCI {f1(mom.cci[j])}</span>}
                  {ind === 'MFI' && <span style={{ color: '#34d399' }}>MFI {f1(mom.mfi[j])}</span>}
                  {ind === 'ADX' && <span style={{ color: '#38bdf8' }}>ADX {f1(mom.adx[j])}</span>}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 11, fontWeight: 600, padding: '0 4px' }}>
        {showEMA && (<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px solid ${C.ema112}` }} /><span style={{ color: C.textLow }}>EMA112(반년 추세)</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px solid ${C.ema224}` }} /><span style={{ color: C.textLow }}>EMA224(1년 추세)</span></span>
        </>)}
        {showCloud && (<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, background: C.cloudUp, border: `1px solid ${C.spanA}` }} /><span style={{ color: C.textLow }}>양운(선행A≥B·지지)</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, background: C.cloudDown, border: `1px solid ${C.spanB}` }} /><span style={{ color: C.textLow }}>음운(선행A&lt;B·저항)</span></span>
        </>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px dashed ${C.gold}` }} /><span style={{ color: C.textLow }}>평단가(보유 시)</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px dashed #a78bfa` }} /><span style={{ color: C.textLow }}>🛡 ATR 손절 참고선(현재가−2×ATR)</span></span>
        {showLiq && (<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px dotted #2dd4bf` }} /><span style={{ color: C.textLow }}>유동성(전저점 — 손절 대기 구간)</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: `2px dotted #fb923c` }} /><span style={{ color: C.textLow }}>유동성(전고점 — 익절·돌파주문 대기)</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: C.textLow }}>💧 스윕(꼬리로 털고 종가 회복)</span></span>
        </>)}
        {showRaschke && raschke && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textLow }}>
            <span style={{ color: '#f0abfc', fontWeight: 800 }}>🎼 라쉬케 연쇄</span>
            <b style={{ color: '#eab308' }}>①CCI</b>→<b style={{ color: '#22d3ee' }}>②RSI50</b>→<b style={{ color: '#4ade80' }}>③영선</b>→<b style={{ color: '#f0abfc' }}>④첫눌림목</b>
            <span>(📍=현재 단계, 봉 아래 번호핀)</span>
          </span>
        )}
        {showPoc && poc && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '2px dashed #38bdf8' }} />
            <span style={{ color: C.textLow }}>📊 매물대 — 우측 가로 막대=가격대별 거래량(진한 파랑=POC·중간=가치영역 70%·흐림=밖), 점선=매물대 중심선</span>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: poc.above ? '#4ade80' : '#fb923c', background: poc.above ? '#14532d33' : '#7c2d1233', border: `1px solid ${poc.above ? '#22c55e55' : '#fb923c55'}`, borderRadius: 5, padding: '1px 6px' }}>
              현재 매물대 {poc.above ? '위(+' : '아래('}{poc.distPct}%) — {poc.above ? '수익권 다수·지지 기대' : '손실권 다수·저항 주의'}
            </span>
          </span>
        )}
        {showVwap && avwap && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '2px solid #f472b6' }} />
            <span style={{ color: C.textLow }}>⚓ Anchored VWAP — 직전 스윙 저점(⚓) 이후 기관 평균단가(위=매집 우위/아래=저항)</span>
          </span>
        )}
        {showST && superT && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, borderTop: '2px solid #34d399' }} />
            <span style={{ color: C.textLow }}>🛡️ SuperTrend — 시각 트레일링 라인(초록=지지/빨강=저항). 이 선 깨질 때까지 홀드 훈련용(알림 없음)</span>
          </span>
        )}
      </div>

      {/* 교육 해설 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10, fontSize: 11 }}>
        <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, color: C.gold, marginBottom: 4 }}>📊 지수이동평균선(EMA) 읽는 법</div>
          <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
            EMA는 최근 가격에 가중치를 크게 둬 단순평균보다 추세 반응이 빠릅니다. 112·224는 각각 약 반년·1년의 중장기 추세선으로,
            <b style={{ color: C.text }}> 112 &gt; 224 정배열</b>이면 상승 우위, 역배열이면 하락 우위 구간입니다.
          </p>
        </div>
        <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, color: C.spanA, marginBottom: 4 }}>☁️ 일목균형표 구름대</div>
          <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
            선행스팬1·2 사이를 채운 띠입니다. 주가가 <b style={{ color: C.text }}>구름대 위</b>면 강세(지지), <b style={{ color: C.text }}>아래</b>면 약세(저항)이며
            구름이 두꺼울수록 지지·저항이 견고합니다. 구름은 26봉 앞에 그려져 미래 지지대를 예고하고, 양운→음운 전환은 추세 약화 신호입니다.
          </p>
        </div>
        {showLiq && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, color: '#2dd4bf', marginBottom: 4 }}>💧 유동성 레벨·스윕 읽는 법</div>
            <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
              <b style={{ color: '#2dd4bf' }}>전저점(틸 점선)</b> 아래엔 보유자들의 손절 주문이, <b style={{ color: '#fb923c' }}>전고점(주황 점선)</b> 위엔 익절·추격매수 주문이
              몰려 있습니다 — 이 &lsquo;주문 뭉치&rsquo;가 유동성입니다. 큰손은 물량을 싸게 모으려고 전저점을 일부러 살짝 깨서 개미 손절을 받아낸 뒤 올립니다.
              <b style={{ color: C.text }}> 💧스윕 = 꼬리로 레벨을 뚫었는데 종가는 회복</b> — 전형적인 &lsquo;개미 털기&rsquo; 흔적입니다(여정 ③).
              반대로 <b style={{ color: C.text }}>종가까지 깨면 스윕이 아니라 진짜 이탈</b>이니 구분하세요. 스윕 단독은 매수 신호가 아니며 구름·추세와 함께 봐야 합니다.
            </p>
          </div>
        )}
        {showPoc && poc && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>📊 매물대 중심선(POC) 읽는 법</div>
            <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
              최근 120봉에서 <b style={{ color: '#38bdf8' }}>가장 많은 거래가 일어난 가격대</b>입니다(거래량 가중 — 시간 가중인 일목 구름과 상호보완).
              가격이 <b style={{ color: '#4ade80' }}>POC 위</b>면 그 물량을 산 대다수가 수익권이라 눌림 시 <b style={{ color: C.text }}>지지</b>로,
              <b style={{ color: '#fb923c' }}> POC 아래</b>면 대다수가 손실권(본전 매도 대기)이라 반등 시 <b style={{ color: C.text }}>저항</b>으로 작용하기 쉽습니다.
              차트 우측의 가로 막대는 가격대별 거래량(세워놓은 거래량)이며, 막대가 긴 구간일수록 매물이 두껍습니다 — 진한 파랑=매물대 중심(POC), 중간 톤=가치영역(거래 70%, 매물 소화 구간). 단독 매매 신호가 아니라 구름·신호등과 함께 보세요.
            </p>
          </div>
        )}
        {ind === 'SQUEEZE' && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>🔥 TTM Squeeze 읽는 법 — 변동성 응축→폭발</div>
            <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
              시장은 <b style={{ color: C.text }}>80% 횡보 + 20% 추세</b>를 반복합니다. 볼린저밴드가 켈트너 채널 안으로 쏙 들어가면(<b style={{ color: '#ef4444' }}>빨강 점</b>) = 변동성이 극도로 눌린 <b style={{ color: '#f59e0b' }}>화약고 응축(스퀴즈 ON)</b> — 지루함에 팔지 말고 <b style={{ color: C.text }}>방향 분출을 대기</b>하세요. 밴드가 채널 밖으로 튀면(<b style={{ color: '#22c55e' }}>초록 점</b>) = 폭발(Fired). 아래 <b style={{ color: '#8b5cf6' }}>막대(모멘텀)</b>가 위(초록)면 상방, 아래(빨강)면 하방 분출 에너지입니다. 압축이 길수록 분출이 큽니다. 방향 확정은 신호등·라쉬케와 함께.
            </p>
          </div>
        )}
        {showVwap && avwap && (
          <div style={{ backgroundColor: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 4 }}>⚓ Anchored VWAP 읽는 법 — 기관 평균단가</div>
            <p style={{ lineHeight: 1.6, color: C.textLow, margin: 0 }}>
              직전 <b style={{ color: '#f472b6' }}>주요 스윙 저점(⚓)</b> 이후의 <b style={{ color: C.text }}>거래량가중 평균단가</b> = 그 바닥 이후 매수한 모두의 평균 매입가입니다.
              현재가가 <b style={{ color: '#4ade80' }}>VWAP 위</b>면 대다수가 수익권 = <b style={{ color: C.text }}>매집 우위·지지</b>, <b style={{ color: '#fb923c' }}>아래</b>면 손실권 = <b style={{ color: C.text }}>본전 매도 압력·저항</b>. 매물대(POC)가 &lsquo;가격대별 매물&rsquo;이라면 VWAP는 &lsquo;특정 사건 이후 시간 흐름의 평균단가&rsquo;라 상호보완입니다. 이탈/회복이 실전 매수·매도의 관문.
            </p>
          </div>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, padding: '0 4px' }}>
        ⚠️ 기술적 지표는 보조 도구입니다 — 이 앱의 가치판단(밸류·수급·계절·거시)과 함께 보세요. 예측이 아닌 현재 추세 위치이며, 교육용·투자 추천 아님.
      </div>
    </div>
  )
}
