'use client'
// 증권사식 기술적 분석 차트 — 한국식 캔들(양봉 빨강/음봉 파랑) + EMA(112·224) + 일목균형표 구름대(26봉 선행) + 거래량
// + 모멘텀 서브패널(MACD·RSI·스토캐스틱·CCI 탭 선택) + 십자선·툴팁
import { useState, useMemo, useRef, useCallback } from 'react'
import type { TechCandle } from '@/app/api/tech-chart/route'
import { calcMACD, calcRSI, calcStoch, calcCCI, calcMFI, calcADX } from '@/lib/techSignals'

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
  const [ind, setInd] = useState<'MACD' | 'RSI' | 'STOCH' | 'CCI' | 'MFI' | 'ADX' | null>('MACD')   // 모멘텀 서브패널(하나만 선택 — 화면 간결)
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
    const pad = (hi - lo) * 0.06 || 1
    return { pMin: lo - pad, pMax: hi + pad }
  }, [disp, showEMA, showCloud, avgPrice])

  const yP = useCallback((v: number) => priceTop + ((pMax - v) / (pMax - pMin)) * priceH, [pMax, pMin, priceTop])
  const volMax = useMemo(() => Math.max(...disp.map(d => d.volume || 0), 1), [disp])
  const yV = (v: number) => volBot - (v / volMax) * volH

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
    const arrs = ind === 'MACD' ? [mom.macd, mom.signal, mom.hist] : [mom.cci]
    let m = ind === 'CCI' ? 150 : 0
    for (const a of arrs) for (const v of a) if (v != null && Math.abs(v) > m) m = Math.abs(v)
    return [-m * 1.08, m * 1.08]
  }, [ind, mom])
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

  const toggle = (on: boolean, label: string, color: string, set: (f: (v: boolean) => boolean) => void) => (
    <button onClick={() => set(v => !v)} style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
      backgroundColor: on ? color : 'transparent', color: on ? C.bg : C.textLow, border: `1px solid ${on ? color : C.axis}`,
    }}>{label}</button>
  )

  if (!data.length) return <div style={{ color: C.textLow, fontSize: 12.5, padding: 20 }}>차트 데이터가 없습니다.</div>

  return (
    <div style={{ backgroundColor: C.bg, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 툴바 + 상태 요약 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {toggle(showEMA, '지수이평선', C.ema224, setShowEMA)}
        {toggle(showCloud, '구름대', C.spanA, setShowCloud)}
        {toggle(showVolume, '거래량', C.gold, setShowVolume)}
        {/* 모멘텀 서브패널 탭(하나만) */}
        <span style={{ display: 'inline-flex', border: `1px solid ${C.axis}`, borderRadius: 7, overflow: 'hidden', marginLeft: 4 }}>
          {(['MACD', 'RSI', 'STOCH', 'CCI', 'MFI', 'ADX'] as const).map(t => (
            <button key={t} onClick={() => setInd(v => v === t ? null : t)} style={{
              padding: '4px 9px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: ind === t ? '#7c3aed' : 'transparent', color: ind === t ? '#fff' : C.textLow,
            }}>{t === 'STOCH' ? 'Stoch' : t}</button>
          ))}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          {aligned && <span style={{ fontSize: 10.5, fontWeight: 800, color: aligned === 'up' ? '#4ade80' : '#f87171', background: aligned === 'up' ? '#14532d44' : '#7f1d1d44', borderRadius: 5, padding: '2px 8px' }}>
            {aligned === 'up' ? '📈 EMA 정배열(112>224)' : '📉 EMA 역배열(112<224)'}</span>}
          {abovCloud && <span style={{ fontSize: 10.5, fontWeight: 800, color: abovCloud === 'above' ? '#4ade80' : abovCloud === 'below' ? '#f87171' : '#eab308', background: '#0F172A', border: `1px solid ${C.axis}`, borderRadius: 5, padding: '2px 8px' }}>
            {abovCloud === 'above' ? '☁️ 구름 위(강세·지지)' : abovCloud === 'below' ? '☁️ 구름 아래(약세·저항)' : '☁️ 구름 속(방향 탐색)'}</span>}
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
                  {ind === 'MACD' ? 'MACD (12·26·9)' : ind === 'RSI' ? 'RSI (14)' : ind === 'STOCH' ? '스토캐스틱 (14·3)' : ind === 'CCI' ? 'CCI (20)' : ind === 'MFI' ? 'MFI (14) — 거래량 가중 수급' : 'ADX (14) — 추세 강도'}
                </text>
                {ind === 'MACD' && (<>
                  {refLine(0, '0')}
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
                  {refLine(70, '70', C.up)}{refLine(50, '50')}{refLine(30, '30', C.down)}
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
      </div>
      <div style={{ fontSize: 10.5, color: C.textLow, padding: '0 4px' }}>
        ⚠️ 기술적 지표는 보조 도구입니다 — 이 앱의 가치판단(밸류·수급·계절·거시)과 함께 보세요. 예측이 아닌 현재 추세 위치이며, 교육용·투자 추천 아님.
      </div>
    </div>
  )
}
