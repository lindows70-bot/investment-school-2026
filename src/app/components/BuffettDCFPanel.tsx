'use client'

/**
 * BuffettDCFPanel — 워렌 버핏 정밀 DCF 내재가치 계산기
 *
 * 핵심 원리:
 *   1. 5개년 FCF 할인 현재가치(PV) 합산
 *   2. Terminal Value (영구 성장 모델) → 현재 할인
 *   3. Equity Value = PV 합 + TV - 순부채
 *   4. 내재가치/주 = Equity Value / 유통주식수
 *   5. 안전마진 = (내재가치 - 현재가) / 내재가치 × 100
 */

import { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { TK } from '@/lib/theme'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const C = {
  bg:       TK.bg0,
  card:     TK.gray900,
  card2:    '#0d1420',
  card3:    '#141928',
  border:   TK.border,
  gold:     TK.amber500,
  goldDim:  'rgba(245,158,11,0.10)',
  green:    TK.emerald500,
  greenDim: 'rgba(16,185,129,0.08)',
  red:      TK.red500,
  redDim:   'rgba(239,68,68,0.08)',
  blue:     TK.blue400,
  text:     TK.slate100,
  textSub:  TK.slate400,
  textLow:  TK.sub3,
}

// ── 숫자 포맷 유틸 ────────────────────────────────────────────────────────────
const fmt억 = (n: number) => {
  if (Math.abs(n) >= 10000) return `₩${(n / 10000).toFixed(1)}조`
  if (Math.abs(n) >= 1000)  return `₩${(n / 1000).toFixed(1)}천억`
  return `₩${n.toFixed(1)}억`
}
const fmt원 = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}원`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

// ── DCF 핵심 연산 엔진 ────────────────────────────────────────────────────────
interface DCFInput {
  fcf0:       number   // 현재 FCF (억원)
  g:          number   // 5개년 성장률 (%)
  r:          number   // 할인율 (%)
  gp:         number   // 영구 성장률 (%)
  netDebt:    number   // 순부채 (억원, 음수 = 순현금)
  shares:     number   // 유통주식수 (만 주)
  curPrice:   number   // 현재 주가 (원)
}

interface YearRow {
  year:    number
  fcf:     number   // 추정 FCF (억원)
  pv:      number   // 할인된 PV (억원)
  cumPv:   number   // 누적 PV
}

interface DCFResult {
  rows:           YearRow[]
  pvSum:          number    // 5개년 PV 합
  terminalValue:  number    // 영구가치 (현재 할인 전)
  tvPV:           number    // 영구가치 현재가치
  enterpriseValue:number    // EV = pvSum + tvPV
  equityValue:    number    // EV - 순부채
  intrinsicPerShare: number // 주당 내재가치 (원)
  safetyMargin:   number    // 안전마진 (%)
}

function calcDCF(inp: DCFInput): DCFResult {
  const { fcf0, g, r, gp, netDebt, shares, curPrice } = inp
  const gR = g / 100
  const rR = r / 100
  const gpR = gp / 100

  const rows: YearRow[] = []
  let pvSum = 0
  let prevFcf = fcf0

  for (let yr = 1; yr <= 5; yr++) {
    const fcf  = prevFcf * (1 + gR)
    const pv   = fcf / Math.pow(1 + rR, yr)
    pvSum     += pv
    rows.push({ year: yr, fcf, pv, cumPv: pvSum })
    prevFcf = fcf
  }

  // Terminal Value: FCF5 × (1+gp) / (r - gp)
  const fcf5 = rows[4].fcf
  const terminalValue = rR > gpR
    ? (fcf5 * (1 + gpR)) / (rR - gpR)
    : fcf5 * 25  // r ≤ gp 엣지케이스 방어 (25배 캡)

  const tvPV = terminalValue / Math.pow(1 + rR, 5)

  const enterpriseValue  = pvSum + tvPV
  const equityValue      = enterpriseValue - netDebt
  // shares: 만 주 단위 → 원 단위 변환: equityValue(억원) / shares(만주) × 10000(억→원 환산)
  const intrinsicPerShare = shares > 0
    ? (equityValue * 1_0000_0000) / (shares * 10000)
    : 0

  const safetyMargin = intrinsicPerShare > 0
    ? ((intrinsicPerShare - curPrice) / intrinsicPerShare) * 100
    : -999

  return { rows, pvSum, terminalValue, tvPV, enterpriseValue, equityValue, intrinsicPerShare, safetyMargin }
}

// ── 입력 컴포넌트들 ───────────────────────────────────────────────────────────

function InputRow({
  label, value, min, max, step, unit, onChange, note, color = C.gold,
}: {
  label: string; value: number; min: number; max: number; step: number
  unit: string; onChange: (v: number) => void; note?: string; color?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>{label}</span>
          {note && <span style={{ fontSize: 9, color: C.textLow, marginLeft: 6 }}>{note}</span>}
        </div>
        <span style={{ fontSize: 15, fontWeight: 900, color, fontFamily: 'monospace' }}>
          {value.toLocaleString('ko-KR')}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 5, appearance: 'none', cursor: 'pointer',
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, ${TK.border} ${((value - min) / (max - min)) * 100}%, ${TK.border} 100%)`,
          borderRadius: 3, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.textLow }}>
        <span>{min.toLocaleString()}{unit}</span>
        <span>{max.toLocaleString()}{unit}</span>
      </div>
    </div>
  )
}

function NumberInput({
  label, value, onChange, unit, note,
}: {
  label: string; value: number; onChange: (v: number) => void; unit: string; note?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>{label}</span>
        {note && <span style={{ fontSize: 9, color: C.textLow }}>{note}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number" value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 7,
            background: C.card2, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontWeight: 700,
            fontFamily: 'monospace', outline: 'none',
          }}
        />
        <span style={{ fontSize: 11, color: C.textLow, whiteSpace: 'nowrap' }}>{unit}</span>
      </div>
    </div>
  )
}

// ── 반원형 안전마진 게이지 ────────────────────────────────────────────────────
function SafetyMarginGauge({ margin }: { margin: number }) {
  // 반원형 SVG 게이지: -50% ~ +100% 범위를 0~180도로 매핑
  const clamp   = Math.max(-50, Math.min(100, margin))
  const deg     = ((clamp + 50) / 150) * 180  // -50 → 0°, +100 → 180°
  const rad     = (deg - 90) * (Math.PI / 180)
  const cx      = 80, cy = 80, r = 60
  const needleX = cx + r * 0.75 * Math.cos(rad)
  const needleY = cy + r * 0.75 * Math.sin(rad)

  const color = margin >= 30 ? C.green : margin >= 0 ? C.gold : C.red

  // 반원 호 좌표
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  // 색상 구간별 호
  const green30Deg = ((80 / 150) * 180)   // +30%  위치 각도
  const zero0Deg   = ((50 / 150) * 180)   // 0%    위치 각도

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="160" height="92" viewBox="0 0 160 90" style={{ overflow: 'visible' }}>
        {/* 배경 호 */}
        <path d={arcPath} fill="none" stroke={TK.border} strokeWidth={14} strokeLinecap="round" />
        {/* 빨간 구간 (0% 미만) */}
        <path d={arcPath} fill="none" stroke={C.red} strokeWidth={14} strokeOpacity={0.3} strokeLinecap="round"
          strokeDasharray={`${(zero0Deg / 180) * (Math.PI * r)} ${Math.PI * r}`}
          strokeDashoffset={0}
        />
        {/* 노란 구간 (0~30%) */}
        <path d={arcPath} fill="none" stroke={C.gold} strokeWidth={14} strokeOpacity={0.3} strokeLinecap="round"
          strokeDasharray={`${((green30Deg - zero0Deg) / 180) * (Math.PI * r)} ${Math.PI * r}`}
          strokeDashoffset={-((zero0Deg / 180) * (Math.PI * r))}
        />
        {/* 초록 구간 (30%+) */}
        <path d={arcPath} fill="none" stroke={C.green} strokeWidth={14} strokeOpacity={0.3} strokeLinecap="round"
          strokeDasharray={`${((180 - green30Deg) / 180) * (Math.PI * r)} ${Math.PI * r}`}
          strokeDashoffset={-((green30Deg / 180) * (Math.PI * r))}
        />
        {/* 현재 위치 활성 호 */}
        {margin > -50 && (
          <path d={arcPath} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, deg) / 180) * (Math.PI * r)} ${Math.PI * r}`}
            strokeDashoffset={0}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
        {/* 바늘 */}
        <line
          x1={cx} y1={cy}
          x2={needleX} y2={needleY}
          stroke={color} strokeWidth={2.5} strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        {/* 0% 눈금 */}
        <text x={cx - r - 2} y={cy + 14} fontSize={8} fill={C.textLow} textAnchor="middle">-50%</text>
        <text x={cx + r + 2} y={cy + 14} fontSize={8} fill={C.textLow} textAnchor="middle">+100%</text>
        <text x={cx} y={cy - 4} fontSize={7} fill={C.gold} textAnchor="middle">0%</text>
      </svg>

      {/* 중앙 수치 */}
      <div style={{ marginTop: -8 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1 }}>
          {margin > -900 ? fmtPct(margin) : 'N/A'}
        </div>
        <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>안전마진</div>
      </div>
    </div>
  )
}

// ── 커스텀 툴팁 ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DCFTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ color: C.textSub, marginBottom: 4 }}>{label}년차</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ color: p.color, fontFamily: 'monospace' }}>
          {p.name}: {fmt억(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function BuffettDCFPanel() {

  // ── 입력 상태 (한국 중견기업 기본값 예시) ────────────────────────────────
  const [fcf0,     setFcf0]     = useState(1000)   // 현재 FCF 1000억원
  const [g,        setG]        = useState(10)     // 성장률 10%
  const [r,        setR]        = useState(10)     // 할인율 10%
  const [gp]                    = useState(2.5)    // 영구 성장률 2.5% (고정)
  const [netDebt,  setNetDebt]  = useState(2000)   // 순부채 2000억원
  const [shares,   setShares]   = useState(1000)   // 유통주식수 1000만 주
  const [curPrice, setCurPrice] = useState(50000)  // 현재 주가 5만원

  // ── 버핏 해자 체크리스트 ─────────────────────────────────────────────────
  const [moat, setMoat] = useState({
    roe15:   false,
    gm40:    false,
    debt2x:  false,
    moat:    false,
    brand:   false,
  })
  const moatScore = Object.values(moat).filter(Boolean).length

  // ── DCF 연산 ─────────────────────────────────────────────────────────────
  const result = useMemo(() =>
    calcDCF({ fcf0, g, r, gp, netDebt, shares, curPrice }),
    [fcf0, g, r, gp, netDebt, shares, curPrice]
  )

  // 안전마진 등급
  const smGrade = result.safetyMargin >= 30
    ? { label: '🟢 탁월한 가격 — 즉시 매수권', color: C.green, bg: C.greenDim, border: 'rgba(16,185,129,0.3)' }
    : result.safetyMargin >= 0
      ? { label: '🟡 적정 가격 — 매수 고려', color: C.gold, bg: C.goldDim, border: 'rgba(245,158,11,0.3)' }
      : { label: '🔴 고평가 — 매수 신중', color: C.red, bg: C.redDim, border: 'rgba(239,68,68,0.3)' }

  // 차트 데이터
  const chartData = useMemo(() =>
    result.rows.map(r => ({ year: `${r.year}년`, fcf: parseFloat(r.fcf.toFixed(1)), pv: parseFloat(r.pv.toFixed(1)) })),
    [result]
  )

  const handleMoat = useCallback((key: keyof typeof moat) => {
    setMoat(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const tvRatio = result.enterpriseValue > 0
    ? ((result.tvPV / result.enterpriseValue) * 100).toFixed(1)
    : '0'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px', borderRadius: 14,
        background: 'linear-gradient(135deg, #052e16 0%, #064e3b 60%, #065f46 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        boxShadow: '0 0 40px rgba(16,185,129,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>DCF 내재가치 계산기</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(16,185,129,0.15)', color: C.green, fontWeight: 700 }}>
            Warren Buffett Method
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#a7f3d0', lineHeight: 1.6 }}>
          실제 현금흐름(FCF)을 할인율로 나눈 뒤 합산하는 정통 가치평가 방식.
          <strong style={{ color: TK.emerald300 }}> 성장률↑ → 내재가치↑ / 할인율↑ → 내재가치↓</strong> 원리를 슬라이더로 직접 체험하세요.
        </div>
      </div>

      {/* ── 2단 레이아웃 ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ════ 좌측: 인풋 + FCF 테이블 ════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 입력 카드 */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: C.gold, marginBottom: 14 }}>
              📥 DCF 입력값 조정
            </div>

            {/* 슬라이더 4개 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              <InputRow label="향후 5개년 FCF 성장률" value={g} min={-5} max={40} step={1}
                unit="%" color={C.green} onChange={setG}
                note="높을수록 내재가치 상승" />
              <InputRow label="할인율 (요구수익률)" value={r} min={5} max={20} step={0.5}
                unit="%" color={C.blue} onChange={setR}
                note="높을수록 내재가치 하락" />
              <InputRow label="현재 잉여현금흐름 (FCF₀)" value={fcf0} min={100} max={10000} step={100}
                unit="억원" color={C.gold} onChange={setFcf0} />
              <InputRow label="현재 주가" value={curPrice} min={1000} max={1000000} step={1000}
                unit="원" color={C.textSub} onChange={setCurPrice} />
            </div>

            {/* 숫자 직접 입력 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumberInput label="순부채" value={netDebt} onChange={setNetDebt}
                unit="억원" note="총부채-현금 (음수=순현금)" />
              <NumberInput label="유통주식수" value={shares} onChange={setShares}
                unit="만 주" />
            </div>

            {/* 영구 성장률 안내 */}
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              background: C.card2, border: `1px solid ${C.border}`,
              fontSize: 11, color: C.textSub, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>영구 성장률 (Terminal Growth Rate)</span>
              <span style={{ color: C.green, fontWeight: 700, fontFamily: 'monospace' }}>{gp}%</span>
            </div>
          </div>

          {/* 5개년 FCF PV 테이블 */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: C.textSub, marginBottom: 12 }}>
              📋 연도별 추정 FCF & 할인 현재가치(PV)
            </div>

            {/* 테이블 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 4,
              padding: '6px 8px', borderRadius: 6, background: C.card2,
              fontSize: 9, fontWeight: 700, color: C.textLow, letterSpacing: '0.07em', marginBottom: 4,
            }}>
              <span>연도</span>
              <span style={{ textAlign: 'right' }}>추정 FCF</span>
              <span style={{ textAlign: 'right' }}>PV (할인후)</span>
              <span style={{ textAlign: 'right' }}>누적 PV</span>
            </div>

            {result.rows.map((row, i) => (
              <div key={row.year} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 4,
                padding: '7px 8px', borderRadius: 6,
                background: i % 2 === 0 ? 'transparent' : C.card2,
                borderBottom: i < 4 ? `1px solid ${C.border}44` : 'none',
                fontSize: 12,
              }}>
                <span style={{ color: C.textLow, fontFamily: 'monospace' }}>Y{row.year}</span>
                <span style={{ textAlign: 'right', color: C.blue, fontFamily: 'monospace', fontWeight: 700 }}>
                  {fmt억(row.fcf)}
                </span>
                <span style={{ textAlign: 'right', color: C.gold, fontFamily: 'monospace' }}>
                  {fmt억(row.pv)}
                </span>
                <span style={{ textAlign: 'right', color: C.textSub, fontFamily: 'monospace' }}>
                  {fmt억(row.cumPv)}
                </span>
              </div>
            ))}

            {/* TV 행 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: 4,
              padding: '8px 8px', borderRadius: 6,
              background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.15)`,
              marginTop: 4, fontSize: 12,
            }}>
              <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 700 }}>TV</span>
              <span style={{ textAlign: 'right', color: C.green, fontFamily: 'monospace' }}>
                {fmt억(result.terminalValue)}
              </span>
              <span style={{ textAlign: 'right', color: C.green, fontFamily: 'monospace', fontWeight: 700 }}>
                {fmt억(result.tvPV)}
              </span>
              <span style={{ textAlign: 'right', color: C.textLow, fontSize: 9 }}>
                ({tvRatio}%)
              </span>
            </div>

            {/* 합계 행 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
              padding: '10px 8px', marginTop: 6, borderTop: `1px solid ${C.border}`,
              fontSize: 12,
            }}>
              <div>
                <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>기업가치(EV) = 5년PV + TV</div>
                <span style={{ color: C.text, fontFamily: 'monospace', fontWeight: 900, fontSize: 14 }}>
                  {fmt억(result.enterpriseValue)}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.textLow, marginBottom: 2 }}>주주가치 = EV - 순부채</div>
                <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 900, fontSize: 14 }}>
                  {fmt억(result.equityValue)}
                </span>
              </div>
            </div>
          </div>

          {/* FCF 막대차트 */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 10 }}>
              📊 추정 FCF vs 할인 현재가치 (5개년)
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 10, bottom: 4, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={TK.border} vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: C.textLow, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textLow, fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}천억`} width={44} />
                  <Tooltip content={<DCFTip />} />
                  <ReferenceLine y={0} stroke={C.border} />
                  <Bar dataKey="fcf" name="추정 FCF" radius={[3,3,0,0]} maxBarSize={28}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={C.blue} fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Bar dataKey="pv" name="PV (할인후)" radius={[3,3,0,0]} maxBarSize={28}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={C.gold} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, fontSize: 10, color: C.textLow }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: C.blue, display: 'inline-block' }} /> 추정 FCF
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: C.gold, display: 'inline-block' }} /> PV (할인후)
              </span>
            </div>
          </div>
        </div>

        {/* ════ 우측: 안전마진 + 해자 체크리스트 ═══════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 내재가치 결과 카드 */}
          <div style={{ padding: '20px', borderRadius: 12, background: C.card, border: `1px solid ${smGrade.border}`,
            boxShadow: `0 0 20px ${smGrade.bg}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLow, letterSpacing: '0.08em', marginBottom: 14 }}>
              DCF 분석 결과
            </div>

            {/* 반원형 안전마진 게이지 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <SafetyMarginGauge margin={result.safetyMargin} />
            </div>

            {/* 등급 배지 */}
            <div style={{
              padding: '10px 14px', borderRadius: 10, textAlign: 'center',
              background: smGrade.bg, border: `1px solid ${smGrade.border}`,
              fontSize: 13, fontWeight: 900, color: smGrade.color, marginBottom: 14,
            }}>
              {smGrade.label}
            </div>

            {/* 가격 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '📍 현재 주가', val: fmt원(curPrice), color: C.textSub },
                { label: '🎯 내재가치/주', val: result.intrinsicPerShare > 0 ? fmt원(result.intrinsicPerShare) : 'N/A', color: smGrade.color },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px 12px', borderRadius: 8,
                  background: C.card2, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: C.textLow, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>

            {/* 가치 분해 */}
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: C.card2, border: `1px solid ${C.border}`, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: C.textSub }}>
                <span>5개년 PV 합계</span>
                <span style={{ color: C.blue, fontFamily: 'monospace', fontWeight: 700 }}>{fmt억(result.pvSum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: C.textSub }}>
                <span>Terminal Value PV</span>
                <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 700 }}>{fmt억(result.tvPV)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: C.textSub }}>
                <span>(-) 순부채</span>
                <span style={{ color: netDebt > 0 ? C.red : C.green, fontFamily: 'monospace', fontWeight: 700 }}>
                  {netDebt >= 0 ? '-' : '+'}{fmt억(Math.abs(netDebt))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6,
                borderTop: `1px solid ${C.border}`, color: C.text }}>
                <span style={{ fontWeight: 700 }}>주주가치 (Equity Value)</span>
                <span style={{ color: smGrade.color, fontFamily: 'monospace', fontWeight: 900 }}>
                  {fmt억(result.equityValue)}
                </span>
              </div>
            </div>
          </div>

          {/* 버핏 경제적 해자 체크리스트 */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: C.green }}>🏰 경제적 해자 체크리스트</div>
                <div style={{ fontSize: 10, color: C.textLow, marginTop: 2 }}>버핏의 투자 적격 기업 필터 5가지</div>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: moatScore >= 4 ? C.greenDim : moatScore >= 2 ? C.goldDim : C.redDim,
                border: `2px solid ${moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 900,
                color: moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red,
              }}>
                {moatScore}/5
              </div>
            </div>

            {[
              { key: 'roe15' as const,  icon: '📈', label: 'ROE > 15%',       desc: '자기자본이익률이 15% 이상' },
              { key: 'gm40' as const,   icon: '💰', label: '매출총이익률 > 40%', desc: '강력한 가격결정력 보유' },
              { key: 'debt2x' as const, icon: '🏦', label: '순부채/EBITDA < 2x', desc: '재무적 안전성 충분' },
              { key: 'moat' as const,   icon: '🏰', label: '경쟁 우위 (해자)',  desc: '특허·브랜드·네트워크 효과' },
              { key: 'brand' as const,  icon: '⭐', label: '소비자 독점력',     desc: '가격 인상해도 이탈 없음' },
            ].map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleMoat(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', borderRadius: 8,
                  background: moat[item.key] ? C.greenDim : 'transparent',
                  border: `1px solid ${moat[item.key] ? 'rgba(16,185,129,0.3)' : C.border}`,
                  cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  background: moat[item.key] ? C.green : 'transparent',
                  border: `1.5px solid ${moat[item.key] ? C.green : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {moat[item.key] && <span style={{ fontSize: 11, color: '#fff' }}>✓</span>}
                </div>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: moat[item.key] ? C.green : C.textSub }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 9, color: C.textLow }}>{item.desc}</div>
                </div>
              </button>
            ))}

            {/* 해자 종합 판정 */}
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: moatScore >= 4 ? C.greenDim : moatScore >= 2 ? C.goldDim : C.redDim,
              border: `1px solid ${moatScore >= 4 ? 'rgba(16,185,129,0.3)' : moatScore >= 2 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              textAlign: 'center', fontSize: 12, fontWeight: 800,
              color: moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red,
            }}>
              {moatScore >= 4 ? '🏆 탁월한 해자 — 버핏 투자 적격!'
               : moatScore >= 3 ? '🟡 양호한 해자 — 지속 모니터링'
               : moatScore >= 2 ? '⚠️ 약한 해자 — 경쟁 위협 주의'
               : '🔴 해자 불명확 — 투자 신중 고려'}
            </div>
          </div>

          {/* 버핏 명언 */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: C.card2, border: `1px solid ${C.border}`,
            fontSize: 11, color: C.textSub, lineHeight: 1.7,
          }}>
            <div style={{ color: C.green, fontWeight: 700, marginBottom: 6 }}>💬 버핏의 가르침</div>
            <div>
              &ldquo;오늘 편안하게 10년을 보유할 수 없다면, 10분도 보유하지 마라.&rdquo;
            </div>
            <div style={{ marginTop: 6 }}>
              &ldquo;안전마진은 투자의 핵심 개념이다. 훌륭한 기업을 적정 가격에 사는 것이 최고의 투자다.&rdquo;
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width:15px; height:15px;
          border-radius:50%; background:${TK.emerald500}; border:2px solid ${TK.bg0};
          cursor:pointer; box-shadow:0 0 5px rgba(16,185,129,0.5);
        }
        input[type=range]::-moz-range-thumb {
          width:15px; height:15px; border-radius:50%;
          background:${TK.emerald500}; border:2px solid ${TK.bg0}; cursor:pointer;
        }
        input[type=number]:focus { border-color:${TK.emerald500} !important; }
      `}</style>
    </div>
  )
}
