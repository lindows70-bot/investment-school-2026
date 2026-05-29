'use client'

/**
 * InflationChart v3 — 순수 렌더링 컴포넌트
 *
 * 데이터 페칭은 부모 MacroDashboard가 담당.
 * props로 data / loading / error / isMock / lastUpdated 를 수신.
 */

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { type InflationPoint } from '@/lib/fredApi'
import { FED_TARGET } from './macroData'

// ── 색상
const C = {
  headline: '#FF6B6B',   // 붉은색 — Headline PCE
  core:     '#FFC107',   // 골드/옐로우 — Core PCE (연준 최우선 지표)
  rate:     '#60a5fa',   // 파랑 점선 — EFFR
  target:   '#4ade80',   // 녹색 기준선 — Fed 목표 2%
  grid:     '#1e2140',
  card:     '#1a1d27',
  border:   '#2a2d3a',
  text:     '#94a3b8',
  textHi:   '#f1f5f9',
  textLow:  '#475569',
}

export interface InflationChartProps {
  data:        InflationPoint[]
  loading:     boolean
  error:       string | null
  isMock:      boolean
  lastUpdated: string | null
}

// ── 요약 배지 계산 (외부에서도 사용 가능하도록 export)
export function getInflationBadge(data: InflationPoint[]): {
  text: string; color: string; bg: string; border: string
} {
  const latest = data[data.length - 1]
  if (!latest) return { text: '데이터 없음', color: C.text, bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' }
  const spread = parseFloat((latest.fedRate - latest.corePCE).toFixed(2))
  if (spread > 1.0) return {
    text: `제약적 통화정책 유지 — 기준금리가 Core PCE를 +${spread}%p 상회`,
    color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.25)',
  }
  if (spread > 0) return {
    text: `완만한 긴축 구간 — 기준금리가 Core PCE를 +${spread}%p 소폭 상회`,
    color: '#fb923c', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.25)',
  }
  return {
    text: `완화 구간 진입 — 기준금리(${latest.fedRate}%)가 Core PCE(${latest.corePCE}%) 하회`,
    color: '#4ade80', bg: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.25)',
  }
}

// ── 로딩 스켈레톤
function Skeleton() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1e2535', animation: 'pulse 1.5s infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: 260, background: '#1e2535', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 24, width: 380, background: '#1e2535', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ height: 24, width: 60, background: '#1e2535', borderRadius: 4, marginBottom: 4, animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: 10, width: 60, background: '#141c28', borderRadius: 3, animation: 'pulse 1.5s infinite' }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{
        height: 260, background: 'rgba(30,37,53,0.5)', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 12, color: C.textLow }}>FRED API 데이터 수신 중…</div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Headline PCE · Core PCE · EFFR</div>
        </div>
      </div>
    </div>
  )
}

// ── 커스텀 툴팁
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p: InflationPoint | undefined = payload[0]?.payload
  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#64748b', marginBottom: 6, fontSize: 11, fontWeight: 700 }}>{label}</div>
      {payload.map((item: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ color: item.color, marginBottom: 3 }}>
          {item.name}: <strong style={{ fontFamily: 'monospace' }}>{item.value.toFixed(2)}%</strong>
        </div>
      ))}
      {p && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, fontSize: 10, color: C.textLow }}>
          실질 스프레드:{' '}
          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: p.fedRate - p.corePCE >= 0 ? '#f87171' : '#4ade80' }}>
            {p.fedRate - p.corePCE >= 0 ? '+' : ''}{(p.fedRate - p.corePCE).toFixed(2)}%p
          </span>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
export default function InflationChart({ data, loading, error, isMock, lastUpdated }: InflationChartProps) {
  if (loading) return <Skeleton />

  const badge  = getInflationBadge(data)
  const latest = data[data.length - 1]
  // data가 비어있을 때 Infinity/-Infinity 방지 — Mock/에러 상황 모두 안전하게 처리
  const allVals  = data.length > 0 ? data.flatMap(d => [d.headlinePCE, d.corePCE, d.fedRate]) : [2.0, 5.5]
  const pceVals  = data.length > 0 ? data.flatMap(d => [d.headlinePCE, d.corePCE])            : [2.0, 3.5]
  const yMax     = parseFloat((Math.max(...allVals) + 0.5).toFixed(1))
  const yMin     = parseFloat((Math.max(0, Math.min(...pceVals) - 0.3)).toFixed(1))

  // ★ 명시적 tick 배열 — 좌·우 양쪽 Y축에 동일하게 전달
  // Recharts 우측 Y축은 데이터가 바인딩되지 않으면 tick을 자동 계산하지 않으므로 반드시 명시 필요
  const tickStep  = (yMax - yMin) > 3 ? 1.0 : 0.5
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax + 0.001; v += tickStep) {
    yTicks.push(parseFloat(v.toFixed(1)))
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.textHi }}>인플레이션 & 금리 네비게이터</span>
            {isMock ? (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 700 }}>MOCK DATA</span>
            ) : (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontWeight: 700 }}>🟢 LIVE · FRED</span>
            )}
            {lastUpdated && !isMock && (
              <span style={{ fontSize: 9, color: '#334155' }}>업데이트: {lastUpdated}</span>
            )}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 7,
            background: badge.bg, border: `1px solid ${badge.border}`,
            fontSize: 11, color: badge.color, fontWeight: 600,
          }}>
            ⚡ {badge.text}
          </div>
        </div>

        {latest && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Headline PCE', val: latest.headlinePCE, color: C.headline },
              { label: 'Core PCE',     val: latest.corePCE,     color: C.core     },
              { label: '기준금리(EFFR)', val: latest.fedRate,   color: C.rate     },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: item.color, fontFamily: 'monospace', lineHeight: 1.1 }}>
                  {item.val.toFixed(2)}%
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginBottom: 10, padding: '6px 12px', borderRadius: 6,
          background: isMock ? 'rgba(251,191,36,0.07)' : 'rgba(248,113,113,0.07)',
          border: `1px solid ${isMock ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
          fontSize: 11, color: isMock ? '#fcd34d' : '#f87171',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isMock ? '⚠️' : '🔴'} {error}
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 20, right: 45, bottom: 20, left: 20 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: C.textLow, fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: C.border }}
            interval={Math.floor(data.length / 8)}
          />
          <YAxis
            yAxisId="left"
            domain={[yMin, yMax]}
            ticks={yTicks}
            tick={{ fill: C.textLow, fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `${Number(v).toFixed(1)}%`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[yMin, yMax]}
            ticks={yTicks}
            width={48}
            tick={{ fill: C.textLow, fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `${Number(v).toFixed(1)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.text, paddingTop: 8 }} iconType="plainline" />
          <ReferenceLine
            yAxisId="left"
            y={FED_TARGET} stroke={C.target} strokeDasharray="6 3"
            strokeWidth={1.5} strokeOpacity={0.75}
            label={{ value: 'Fed Target 2.0%', position: 'insideTopRight', fill: C.target, fontSize: 10, fontWeight: 700 }}
          />
          <Line yAxisId="left" type="monotone" dataKey="headlinePCE" name="Headline PCE"
            stroke={C.headline} strokeWidth={2.2} dot={false}
            activeDot={{ r: 5, fill: C.headline, stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line yAxisId="left" type="monotone" dataKey="corePCE" name="Core PCE"
            stroke={C.core} strokeWidth={2.2} dot={false}
            activeDot={{ r: 5, fill: C.core, stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line yAxisId="left" type="monotone" dataKey="fedRate" name="연방기금금리(EFFR)"
            stroke={C.rate} strokeWidth={2.5} dot={false} strokeDasharray="8 3"
            activeDot={{ r: 5, fill: C.rate, stroke: '#0f172a', strokeWidth: 2 }}
          />
          {/* ★ 우측 Y축 tick 강제 렌더링용 더미 Line
              Recharts는 데이터가 바인딩된 YAxis만 tick을 렌더링함
              stroke/dot 모두 투명 → 시각적으로 완전히 숨김 */}
          <Line
            yAxisId="right"
            dataKey="fedRate"
            stroke="transparent"
            dot={false}
            activeDot={false}
            legendType="none"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { color: C.headline, text: 'Headline PCE — 식품·에너지 포함 전체 물가, YoY %' },
          { color: C.core,     text: 'Core PCE — 연준 최우선 인플레이션 지표, YoY %' },
          { color: C.rate,     text: 'EFFR — 실효 연방기금금리 %' },
          { color: C.target,   text: '목표선(2.0%)' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 2, background: item.color, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: '#334155' }}>{item.text}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#1e293b' }}>
          {isMock ? '데이터: Mock' : '출처: FRED, St. Louis Fed'}
        </div>
      </div>
    </div>
  )
}
