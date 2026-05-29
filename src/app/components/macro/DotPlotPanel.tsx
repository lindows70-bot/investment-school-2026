'use client'

/**
 * DotPlotPanel v3 — CME FedWatch 실시간 버블 차트
 *
 * ◆ 데이터 파이프라인
 *  1. MacroDashboard → inflationData (FRED FEDFUNDS 최신값) props 수신
 *  2. fetchFedWatchData(currentRate) → /api/fedwatch → Yahoo Finance FF Futures
 *  3. CME 공식 계산식 → FOMC별 확률 분포
 *  4. 버블 차트 (크기 = 확률) + 컨센서스 테이블 + 해석 텍스트
 *
 * ◆ 수동 업데이트 불필요 — 새로고침 시 항상 최신 채권 시장 컨센서스
 */

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ZAxis,
} from 'recharts'
import {
  fetchFedWatchData,
  type FomcProbData,
  type FedWatchResponse,
} from '@/lib/fedwatchApi'

interface DotPlotPanelProps {
  currentRate?: number   // FRED FEDFUNDS 최신값 (MacroDashboard에서 전달)
}

// ── 색상
const C = {
  card:     '#1a1d27',
  border:   '#2a2d3a',
  grid:     '#1e2140',
  text:     '#94a3b8',
  textHi:   '#f1f5f9',
  textLow:  '#475569',
  consensus: '#fbbf24',   // 컨센서스 — 골드
  bubble:    '#60a5fa',   // 일반 버블 — 파랑
  down:      '#34d399',
}

// ── Y축 가능 금리 범위 생성 (25bp 격자)
function buildYTicks(currentRate: number): number[] {
  const ticks: number[] = []
  for (let r = currentRate + 0.5; r >= currentRate - 1.25; r -= 0.25) {
    ticks.push(parseFloat(r.toFixed(3)))
  }
  return ticks.filter(t => t >= 1.5)
}

// ── ScatterChart용 데이터 변환
// x = meetingIndex (0,1,2...), y = rate midpoint, z = probability (버블 크기)
interface BubblePoint {
  x:           number
  y:           number
  z:           number    // probability (크기 비례)
  prob:        number    // 실제 확률 (툴팁용)
  label:       string    // rate label
  isConsensus: boolean
  meetingLabel: string
}

function buildBubbleData(meetings: FomcProbData[]): BubblePoint[] {
  const points: BubblePoint[] = []
  meetings.forEach((m, xIdx) => {
    m.probs.forEach(p => {
      points.push({
        x:            xIdx,
        y:            p.rate,
        z:            Math.max(4, p.prob * 1.8),  // 최소 크기 4, 비례 스케일
        prob:         p.prob,
        label:        p.label,
        isConsensus:  p.isConsensus,
        meetingLabel: m.label,
      })
    })
  })
  return points
}

// ── 커스텀 버블 렌더러 (isConsensus → 골드 글로우)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleShape(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  const r           = Math.sqrt(payload.z) * 2.2  // z → 반지름 변환
  const isConsensus = payload.isConsensus
  return (
    <g>
      {isConsensus && (
        <circle cx={cx} cy={cy} r={r + 6}
          fill="rgba(251,191,36,0.12)"
          stroke="rgba(251,191,36,0.35)"
          strokeWidth={1}
        />
      )}
      <circle
        cx={cx} cy={cy} r={r}
        fill={isConsensus ? C.consensus : C.bubble}
        stroke={isConsensus ? '#92400e' : '#1e3a5f'}
        strokeWidth={1.5}
        opacity={isConsensus ? 0.95 : 0.5 + payload.prob / 200}
        style={{ filter: isConsensus ? 'drop-shadow(0 0 5px rgba(251,191,36,0.7))' : undefined }}
      />
      {/* 확률 텍스트 (큰 버블에만) */}
      {payload.prob >= 25 && (
        <text
          x={cx} y={cy + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill={isConsensus ? '#1a1200' : '#fff'}
          fontSize={r > 10 ? 9 : 7.5} fontWeight={700}
        >
          {payload.prob.toFixed(0)}%
        </text>
      )}
    </g>
  )
}

// ── 커스텀 툴팁
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d: BubblePoint = payload[0]?.payload
  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${C.border}`,
      borderRadius: 9, padding: '9px 13px', fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: C.textLow, marginBottom: 4, fontSize: 10, fontWeight: 700 }}>
        {d.meetingLabel} FOMC
      </div>
      <div style={{ color: d.isConsensus ? C.consensus : C.bubble, fontWeight: 700, marginBottom: 2 }}>
        {d.label}
        {d.isConsensus && <span style={{ marginLeft: 6, fontSize: 10, color: C.consensus }}>★ 컨센서스</span>}
      </div>
      <div style={{ color: C.textLow, fontSize: 11 }}>
        시장 확률: <strong style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>{d.prob.toFixed(1)}%</strong>
      </div>
    </div>
  )
}

// ── 로딩 스켈레톤
function Skeleton() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: '#1e2535', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: 14, width: 280, background: '#1e2535', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ height: 260, background: 'rgba(30,37,53,0.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>📡</div>
            <div style={{ fontSize: 11, color: C.textLow }}>FF Futures 데이터 수신 중…</div>
          </div>
        </div>
        <div style={{ height: 260, background: 'rgba(30,37,53,0.5)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
export default function DotPlotPanel({ currentRate = 3.375 }: DotPlotPanelProps) {
  const [fwData,   setFwData]   = useState<FedWatchResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (!currentRate || currentRate <= 0) return
    let cancelled = false

    fetchFedWatchData(currentRate)
      .then(data => {
        if (cancelled) return
        setFwData(data)
        setLastUpdated(new Date().toLocaleString('ko-KR'))
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        setError(`FF Futures 데이터 로드 실패: ${(err as Error).message}`)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [currentRate])

  if (loading) return <Skeleton />

  const meetings       = fwData?.meetings ?? []
  const availableCount = meetings.filter(m => m.dataAvailable).length
  const bubbleData     = buildBubbleData(meetings)
  const yTicks         = buildYTicks(currentRate)

  // 컨센서스 경로 (각 회의의 최고 확률 금리)
  const consensusPath = meetings
    .filter(m => m.dataAvailable && m.consensusRate !== null)
    .map(m => ({ label: m.label, rate: m.consensusRate!, prob: m.consensusProb! }))

  // 금리 방향성 (인하/동결/인상)
  const lastConsensus = consensusPath[consensusPath.length - 1]
  const firstConsensus = consensusPath[0]
  const isPathDown = lastConsensus && firstConsensus
    ? lastConsensus.rate < currentRate - 0.001
    : false

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.textHi }}>
          CME FedWatch — 시장 금리 확률 전망
        </span>
        {availableCount > 0 ? (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontWeight: 700 }}>
            🟢 LIVE · FF Futures
          </span>
        ) : (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 700 }}>
            ⚠️ 데이터 수신 대기
          </span>
        )}
        {lastUpdated && (
          <span style={{ fontSize: 9, color: '#334155', marginLeft: 4 }}>업데이트: {lastUpdated}</span>
        )}
      </div>

      {/* 에러 배너 */}
      {error && (
        <div style={{ padding: '6px 12px', borderRadius: 6, marginBottom: 10, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔴 {error}
        </div>
      )}

      {/* 상황 배지 */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
        padding: '4px 10px', borderRadius: 6,
        background: isPathDown ? 'rgba(52,211,153,0.07)' : 'rgba(251,191,36,0.06)',
        border: `1px solid ${isPathDown ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.15)'}`,
        fontSize: 11, fontWeight: 600,
        color: isPathDown ? '#34d399' : '#fbbf24',
      }}>
        {isPathDown ? '📉 시장 컨센서스: 금리 인하 경로 유효' : '📊 시장 컨센서스: 동결 또는 인상 기대'}
        <span style={{ color: C.textLow, fontWeight: 400 }}>
          · 현재 기준금리 midpoint {currentRate.toFixed(3)}%
        </span>
      </div>

      {/* 2열 레이아웃: 버블 차트 | 컨센서스 테이블 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── 버블 ScatterChart */}
        <div>
          {/* 차트 제목 + 읽는 법 안내 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: '0.05em', marginBottom: 6 }}>
              FOMC별 기준금리 확률 분포 (채권 선물 시장 컨센서스)
            </div>
            {/* 📖 차트 읽는 법 박스 */}
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,45,65,1)',
              fontSize: 10, color: '#64748b', lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 3 }}>📖 차트 읽는 법</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>
                  <span style={{ color: C.consensus, fontWeight: 700 }}>● 황금 버블</span>
                  {' '}= 해당 FOMC에서 시장이 가장 유력하게 예상하는 금리 수준{' '}
                  <span style={{ color: '#475569' }}>(= 컨센서스)</span>
                </div>
                <div>
                  <span style={{ color: C.bubble, fontWeight: 700 }}>● 파란 버블</span>
                  {' '}= 가능하지만 확률이 낮은 대안 시나리오
                  <span style={{ color: '#475569' }}> · 버블이 클수록 해당 확률이 높음</span>
                </div>
                <div style={{ color: '#475569' }}>
                  📌 X축: 향후 FOMC 회의 날짜 · Y축: 예상 기준금리 수준(%)
                </div>
              </div>
            </div>
          </div>
          {availableCount === 0 ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textLow, fontSize: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>📭</div>
                <div>FF Futures 데이터를 가져올 수 없습니다.</div>
                <div style={{ fontSize: 10, marginTop: 4, color: '#334155' }}>Yahoo Finance 연결 상태를 확인하세요.</div>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 20, right: 16, bottom: 10, left: 8 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[-0.5, meetings.length - 0.5]}
                    ticks={meetings.map((_, i) => i)}
                    tickFormatter={(v: number) => meetings[v]?.label ?? ''}
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={{ stroke: C.border }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[
                      (dataMin: number) => dataMin - 0.25,
                      (dataMax: number) => dataMax + 0.35,
                    ]}
                    ticks={yTicks}
                    tickFormatter={(v: number) => `${Number(v).toFixed(2)}%`}
                    tick={{ fill: '#475569', fontSize: 9.5 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <ZAxis dataKey="z" range={[16, 900]} />
                  <Tooltip content={<BubbleTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} />

                  {/* 현재 기준금리 */}
                  <ReferenceLine
                    y={currentRate}
                    stroke="#60a5fa" strokeDasharray="5 3" strokeWidth={1.3} strokeOpacity={0.6}
                    label={{ value: `현재 ${currentRate.toFixed(2)}%`, position: 'insideTopRight', fill: '#60a5fa', fontSize: 9 }}
                  />
                  {/* 연준 목표 2% */}
                  <ReferenceLine
                    y={2.0}
                    stroke="#4ade80" strokeDasharray="5 3" strokeWidth={0.9} strokeOpacity={0.4}
                    label={{ value: '목표 2.0%', position: 'insideBottomRight', fill: '#4ade80', fontSize: 9 }}
                  />

                  {/* 컨센서스 Scatter (골드) */}
                  <Scatter
                    name="consensus"
                    data={bubbleData.filter(d => d.isConsensus)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => <BubbleShape {...props} />}
                    fill={C.consensus}
                  />
                  {/* 일반 Scatter (파랑) */}
                  <Scatter
                    name="other"
                    data={bubbleData.filter(d => !d.isConsensus)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => <BubbleShape {...props} />}
                    fill={C.bubble}
                  />
                </ScatterChart>
              </ResponsiveContainer>

              {/* 범례 + 해석 가이드 */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 범례 아이콘 */}
                <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.consensus, boxShadow: '0 0 6px rgba(251,191,36,0.7)', flexShrink: 0 }} />
                    <span style={{ color: C.consensus, fontWeight: 700 }}>★ 컨센서스 (최고 확률)</span>
                    <span style={{ color: '#334155' }}>— 시장이 가장 유력하게 보는 금리</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.bubble, opacity: 0.7, flexShrink: 0 }} />
                    <span style={{ color: C.textLow }}>기타 시나리오</span>
                    <span style={{ color: '#334155' }}>— 크기(면적)가 클수록 시장 베팅 확률 높음</span>
                  </div>
                </div>
                {/* 실전 해석 팁 */}
                <div style={{
                  padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)',
                  fontSize: 10, color: '#64748b', lineHeight: 1.6,
                }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>💡 실전 팁: </span>
                  황금 버블이 현재 기준금리(<span style={{ color: '#60a5fa' }}>{currentRate.toFixed(2)}%</span>) 아래로 이동하면
                  {' '}<span style={{ color: '#34d399' }}>금리 인하 기대</span>,
                  위로 이동하면 <span style={{ color: '#f87171' }}>인상 기대</span>를 의미합니다.
                  버블 안의 숫자(%)는 해당 금리가 실현될 확률입니다.
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 컨센서스 테이블 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '0.05em' }}>
            CME 시장 금리 전망 컨센서스
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['FOMC', '컨센서스 금리', '확률', '변동', 'Ticker'].map((h, i) => (
                    <th key={h} style={{
                      padding: '6px 8px',
                      textAlign: i === 0 ? 'left' : 'center',
                      color: '#475569', fontWeight: 700, fontSize: 10,
                      letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => {
                  // ★ 변동 기준:
                  //   i=0 → 현재 기준금리(currentRate)와 비교
                  //   i>0 → 직전 행(i-1)의 consensusRate와 비교 (연속 경로)
                  //   직전 행 데이터가 없으면 변동 표시 안 함
                  const prevRate: number | null =
                    i === 0
                      ? currentRate
                      : (meetings[i - 1].consensusRate ?? null)

                  const delta: number | null =
                    m.consensusRate !== null && prevRate !== null
                      ? parseFloat((m.consensusRate - prevRate).toFixed(4))
                      : null

                  // 25bp 단위로 몇 회 인하/인상인지 (반올림)
                  const moves: number | null =
                    delta !== null ? Math.round(delta / 0.25) : null
                  // moves > 0 = 인상, moves < 0 = 인하, 0 = 동결

                  return (
                    <tr key={m.label} style={{
                      borderBottom: `1px solid ${C.grid}`,
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    }}>
                      <td style={{ padding: '7px 8px', color: C.textHi, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {m.label}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {m.dataAvailable && m.consensusRate !== null ? (
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.consensus, fontSize: 12 }}>
                            {m.consensusRate.toFixed(2)}%
                          </span>
                        ) : (
                          <span style={{ color: '#334155', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {m.dataAvailable && m.consensusProb !== null ? (
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700, fontSize: 11,
                            color: m.consensusProb >= 70 ? '#34d399' : m.consensusProb >= 40 ? '#fbbf24' : '#f87171',
                          }}>
                            {m.consensusProb.toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: '#334155', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {moves !== null ? (
                          <span style={{
                            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                            color: moves < 0 ? '#34d399' : moves > 0 ? '#f87171' : '#64748b',
                          }}>
                            {moves < 0
                              ? `▼${Math.abs(moves)}회 인하`
                              : moves > 0
                              ? `▲${moves}회 인상`
                              : '동결'}
                          </span>
                        ) : (
                          <span style={{ color: '#334155' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#334155' }}>
                          {m.futuresTicker}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 해석 메모 — 100% 동적 데이터 기반 */}
          {availableCount > 0 && (() => {
            const last      = consensusPath[consensusPath.length - 1]
            const first     = consensusPath[0]
            const accentClr = isPathDown ? '#34d399' : '#fbbf24'
            // 현재 → 마지막 FOMC 총 변동 (bp)
            const totalDeltaBp = last
              ? Math.round((last.rate - currentRate) / 0.25) * 25
              : 0
            const totalCuts = -totalDeltaBp / 25
            const dirText = totalCuts > 0
              ? `총 ${totalCuts}회(${Math.abs(totalDeltaBp)}bp) 인하될`
              : totalCuts < 0
              ? `총 ${Math.abs(totalCuts)}회(${Math.abs(totalDeltaBp)}bp) 인상될`
              : '동결을 유지할'
            return (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: isPathDown ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
                border: `1px solid ${isPathDown ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)'}`,
                fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
              }}>
                <strong style={{ color: accentClr }}>📌 시장 해석:</strong>{' '}
                채권 선물 시장은 현재 기준금리(
                <strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{currentRate.toFixed(2)}%</strong>
                )가{' '}
                {last ? (
                  <>
                    <strong style={{ color: accentClr }}>{last.label}</strong>까지{' '}
                    <strong style={{ color: accentClr, fontFamily: 'monospace' }}>
                      {last.rate.toFixed(2)}%
                    </strong>
                    로 <strong style={{ color: accentClr }}>{dirText}</strong>{' '}
                    것을 컨센서스로 반영하고 있습니다.{' '}
                    {first && first.label !== last.label && (
                      <>
                        첫 변화는 <strong style={{ color: accentClr }}>{first.label}</strong>부터
                        ({first.rate.toFixed(2)}%) 시작될 것으로 예상됩니다.
                      </>
                    )}
                  </>
                ) : '...'}
                {' '}각 버블의 크기는 해당 금리 시나리오의 시장 확률을 나타냅니다.
                <div style={{ marginTop: 4, fontSize: 10, color: '#334155' }}>
                  출처: CME FF Futures (ZQ 시리즈) via Yahoo Finance · {lastUpdated ?? '업데이트 중'}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
