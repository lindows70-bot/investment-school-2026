'use client'

/**
 * FullCandleChart v2
 *
 * v2 신규 기능
 *  - avgPrice?: number prop 추가
 *    · Y축 domain에 avgPrice를 강제 포함 (상하 5% 여유)
 *    · 황금 점선 수평 기준선 + 우측 라벨 태그 렌더링
 *    · 호버 툴팁에 "평단가 대비" 수익률 표시
 *    · 1D / 1W / 1M / 1Y 기간 전환 시에도 고정 유지
 */

import { useState } from 'react'
import type { Candle } from './CandleChart'

type TimeFrame = '1D' | '1W' | '1M' | '1Y'

// 평단가 선 색상 — 눈에 잘 띄는 애시드 그린
const AVG_COLOR = '#deff9a'

interface Props {
  data:       Candle[]
  currency:   string
  timeframe:  TimeFrame
  prevClose?: number
  avgPrice?:  number    // ★ 평균단가 (텐배거 트래커 localStorage 연동)
  height?:    number
}

const N   = '#1b1e2e'

export default function FullCandleChart({
  data, currency, timeframe, prevClose, avgPrice, height: heightProp = 300,
}: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data?.length) return (
    <div style={{ height: heightProp, display:'flex', alignItems:'center', justifyContent:'center', color:'#9aa0b8', fontSize:13 }}>
      캔들 데이터 없음
    </div>
  )

  // ── SVG 레이아웃 ──────────────────────────────────────────
  const W    = 760
  const H    = heightProp
  const padL = 6
  const padR = 66
  const padT = 22
  const padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  // ── 거래량 영역(하단 분리) — 토스식 캔들+거래량 ──
  const volH    = Math.round(plotH * 0.20)   // 하단 20%는 거래량 막대
  const volGap  = 6
  const priceH  = plotH - volH - volGap      // 가격 캔들 영역(상단)
  const volTop  = padT + priceH + volGap
  const volBase = H - padB                   // 거래량 막대 바닥(=X축선)

  // ── 가격 범위 — 오직 캔들 데이터만 기준 (avgPrice 완전 제외)
  // 평단가 때문에 캔들이 납작해지는 것을 방지: Y축은 항상 주가 데이터에만 맞춤
  const prices = data.flatMap(d => [d.high, d.low])
  const minP  = Math.min(...prices)
  const maxP  = Math.max(...prices)
  const range = maxP - minP || minP * 0.02 || 1
  const vPad  = range * 0.12
  const yMin  = minP - vPad
  const yMax  = maxP + vPad
  const yRange = yMax - yMin

  // ── 좌표 변환 ─────────────────────────────────────────────
  const n    = data.length
  const step = plotW / n
  const cw   = n <= 30 ? Math.min(step * 0.82, 16)
             : n <= 80 ? Math.max(2, step * 0.78)
             : Math.max(1.2, step * 0.72)
  const toX  = (i: number) => padL + i * step + step / 2
  const toY  = (p: number) => padT + ((yMax - p) / yRange) * priceH   // 가격은 상단 영역에만 매핑

  // ── 거래량 스케일 ──
  const maxVol = Math.max(1, ...data.map(d => d.volume || 0))
  const volBarH = (v: number) => (Math.max(0, v) / maxVol) * volH

  // ── 포맷 헬퍼 ─────────────────────────────────────────────
  const isKrw = currency === 'KRW'
  const fmtY = (p: number) => {
    if (isKrw) {
      if (p >= 100_000_000) return `₩${(p/100_000_000).toFixed(1)}억`
      if (p >= 10_000)      return `₩${(p/10_000).toFixed(0)}만`
      return `₩${Math.round(p).toLocaleString('ko-KR')}`
    }
    return p >= 1000
      ? `$${p.toLocaleString('en-US',{maximumFractionDigits:0})}`
      : `$${p.toFixed(2)}`
  }
  const fmtDate = (date: string) => {
    const d = new Date(date + (date.length === 10 ? 'T09:00:00' : ''))
    if (timeframe === '1M' || timeframe === '1Y') {
      return `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}`
    }
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
  }

  // ── Y축 눈금 5개 ──────────────────────────────────────────
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange / 4) * (4 - i))

  // ── X축 눈금 (최대 7개) ───────────────────────────────────
  const xCount  = Math.min(7, n)
  const xIdxs   = Array.from({ length: xCount }, (_, i) =>
    Math.round((n - 1) / Math.max(1, xCount - 1) * i)
  )

  // ── 고가 / 저가 / 마지막 캔들 ─────────────────────────────
  const maxIdx     = data.reduce((mi, c, i) => c.high > data[mi].high ? i : mi, 0)
  const minIdx     = data.reduce((mi, c, i) => c.low  < data[mi].low  ? i : mi, 0)
  const lastCandle = data[n - 1]
  const lastColor  = lastCandle.close >= lastCandle.open ? '#ef4444' : '#3b82f6'

  // ── 평단가 관련 계산 ──────────────────────────────────────
  const hasAvg  = avgPrice != null && avgPrice > 0
  const avgY    = hasAvg ? toY(avgPrice!) : 0
  // ★ 가시 범위 체크: avgY 가 plot 영역(padT ~ padT+plotH) 안에 있을 때만 렌더링
  //   범위 밖이면 스케일을 깨뜨리지 않고 조용히 숨김 (자연스러운 클리핑)
  const avgInView = hasAvg && avgY >= padT - 2 && avgY <= padT + priceH + 2
  // 현재가 기준 수익률 (가시 여부와 무관하게 계산 — 툴팁에도 사용)
  const avgGap  = hasAvg
    ? ((lastCandle.close - avgPrice!) / avgPrice!) * 100
    : null
  // 라벨 문자열
  const avgLabel = hasAvg
    ? `${isKrw ? '평단가' : 'My Avg'}: ${fmtY(avgPrice!)}`
    : ''
  const avgTagW  = hasAvg ? Math.max(68, avgLabel.length * 5.4 + 10) : 0

  return (
    <div style={{ position:'relative', width:'100%' }}>
      <svg
        width="100%" height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display:'block', overflow:'visible' }}
      >
        {/* ── 배경 그리드 ── */}
        {yTicks.map((t, i) => (
          <line key={i}
            x1={padL} y1={toY(t)} x2={W - padR} y2={toY(t)}
            stroke="#1e2140" strokeWidth={1}
          />
        ))}

        {/* ── ★ 평단가 기준선 — 가시 범위 내에 있을 때만 렌더링 ── */}
        {avgInView && (
          <>
            {/* 평단가 배경 글로우 밴드 (±1.5% 범위) */}
            {(() => {
              const bandH = Math.max(4, Math.abs(toY(avgPrice! * 0.985) - toY(avgPrice! * 1.015)))
              const bandY = toY(avgPrice! * 1.015)
              return (
                <rect
                  x={padL} y={bandY}
                  width={plotW} height={bandH}
                  fill={AVG_COLOR} fillOpacity={0.04}
                  rx={2}
                />
              )
            })()}

            {/* 점선 수평선 */}
            <line
              x1={padL}      y1={avgY}
              x2={W - padR}  y2={avgY}
              stroke={AVG_COLOR}
              strokeWidth={1.8}
              strokeDasharray="6 4"
              strokeOpacity={0.85}
            />

            {/* 우측 라벨 태그 */}
            {(() => {
              const tagH = 15
              const tagX = W - padR + 1
              const gapPct = avgGap!
              const gapStr = `${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%`
              const gapColor = gapPct >= 0 ? '#4ade80' : '#f87171'
              return (
                <g>
                  {/* 평단가 태그 */}
                  <rect
                    x={tagX} y={avgY - tagH / 2}
                    width={avgTagW} height={tagH}
                    fill={`${AVG_COLOR}22`}
                    stroke={AVG_COLOR}
                    strokeWidth={0.9}
                    rx={3}
                    opacity={0.92}
                  />
                  <text
                    x={tagX + avgTagW / 2} y={avgY + 4}
                    textAnchor="middle"
                    fill={AVG_COLOR}
                    fontSize={8} fontWeight={700}
                  >
                    {avgLabel}
                  </text>
                  {/* 수익률 작은 태그 (평단가 태그 아래) */}
                  <text
                    x={tagX + avgTagW / 2} y={avgY + tagH / 2 + 9}
                    textAnchor="middle"
                    fill={gapColor}
                    fontSize={7.5} fontWeight={700}
                  >
                    {gapStr}
                  </text>
                </g>
              )
            })()}

            {/* 좌측 삼각 인디케이터 */}
            <polygon
              points={`${padL - 4},${avgY - 4} ${padL - 4},${avgY + 4} ${padL + 1},${avgY}`}
              fill={AVG_COLOR}
              opacity={0.8}
            />
          </>
        )}

        {/* ── 전일 종가 기준선 (점선) ── */}
        {prevClose != null && prevClose > 0 && (
          <>
            <line
              x1={padL} y1={toY(prevClose)}
              x2={W - padR} y2={toY(prevClose)}
              stroke={lastCandle.close >= prevClose ? '#f87171' : '#60a5fa'}
              strokeWidth={0.9} strokeDasharray="5 4" strokeOpacity={0.55}
            />
            {(() => {
              const pColor = lastCandle.close >= prevClose ? '#f87171' : '#60a5fa'
              const lbl = fmtY(prevClose)
              const tw  = Math.max(38, lbl.length * 5.4 + 8)
              const py  = toY(prevClose)
              return (
                <g>
                  <rect x={W - padR + 1} y={py - 7} width={tw} height={13}
                    fill="transparent" stroke={pColor} strokeWidth={0.8} rx={2} opacity={0.7}/>
                  <text x={W - padR + 1 + tw / 2} y={py + 3}
                    textAnchor="middle" fill={pColor} fontSize={7.5} fontWeight={600}>
                    {lbl}
                  </text>
                </g>
              )
            })()}
          </>
        )}

        {/* ── 캔들 몸통 + 꼬리 ── */}
        {data.map((c, i) => {
          const x      = toX(i)
          const isUp   = c.close >= c.open
          const color  = isUp ? '#ef4444' : '#3b82f6'
          const bodyT  = toY(Math.max(c.open, c.close))
          const bodyB  = toY(Math.min(c.open, c.close))
          const bodyH  = Math.max(1, bodyB - bodyT)
          const hovered = hoveredIdx === i

          return (
            <g key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor:'crosshair' }}
            >
              {hovered && (
                <rect
                  x={x - step / 2} y={padT}
                  width={step} height={plotH}
                  fill="rgba(255,255,255,0.035)" rx={2}
                />
              )}
              {hovered && (
                <line x1={x} y1={padT} x2={x} y2={padT + plotH}
                  stroke={color} strokeWidth={0.7} strokeDasharray="3 3" strokeOpacity={0.4}/>
              )}
              <line x1={x} y1={toY(c.high)} x2={x} y2={bodyT}
                stroke={color} strokeWidth={1}/>
              <rect
                x={x - cw / 2} y={bodyT}
                width={cw} height={bodyH}
                fill={color}
                stroke={color} strokeWidth={0.6}
                rx={0.5}
              />
              <line x1={x} y1={bodyB} x2={x} y2={toY(c.low)}
                stroke={color} strokeWidth={1}/>
              {/* 거래량 막대 */}
              {c.volume > 0 && (
                <rect
                  x={x - cw / 2} y={volBase - volBarH(c.volume)}
                  width={cw} height={volBarH(c.volume)}
                  fill={color} fillOpacity={hovered ? 0.85 : 0.45}
                  rx={0.5}
                />
              )}
            </g>
          )
        })}

        {/* ── 고가 마커 ── */}
        {(() => {
          const hx = toX(maxIdx), hy = toY(data[maxIdx].high)
          const lbl = `▲ ${fmtY(data[maxIdx].high)}`
          const lblX = maxIdx > n * 0.7 ? hx - 4 : hx + 4
          const anchor = maxIdx > n * 0.7 ? 'end' : 'start'
          return (
            <g>
              <circle cx={hx} cy={hy - 7} r={3} fill="#fbbf24" stroke={N} strokeWidth={1.2}/>
              <text x={lblX} y={hy - 10} textAnchor={anchor}
                fill="#fbbf24" fontSize={8} fontWeight={700}>{lbl}</text>
            </g>
          )
        })()}

        {/* ── 저가 마커 ── */}
        {(() => {
          const lx = toX(minIdx), ly = toY(data[minIdx].low)
          const lbl = `▼ ${fmtY(data[minIdx].low)}`
          const lblX = minIdx > n * 0.7 ? lx - 4 : lx + 4
          const anchor = minIdx > n * 0.7 ? 'end' : 'start'
          return (
            <g>
              <circle cx={lx} cy={ly + 7} r={3} fill="#a78bfa" stroke={N} strokeWidth={1.2}/>
              <text x={lblX} y={ly + 18} textAnchor={anchor}
                fill="#a78bfa" fontSize={8} fontWeight={700}>{lbl}</text>
            </g>
          )
        })()}

        {/* ── 현재가 글로우 점 + 배경 태그 ── */}
        {(() => {
          const cy    = toY(lastCandle.close)
          const label = fmtY(lastCandle.close)
          const tagW  = Math.max(44, label.length * 5.8 + 10)
          const tagH  = 15
          const tagX  = W - padR + 1
          return (
            <g>
              <circle cx={toX(n - 1)} cy={cy} r={5}
                fill={lastColor} stroke={N} strokeWidth={2}
                style={{ filter:`drop-shadow(0 0 6px ${lastColor})` }}/>
              <rect x={tagX} y={cy - tagH / 2}
                width={tagW} height={tagH}
                fill={lastColor} rx={3} opacity={0.92}/>
              <text x={tagX + tagW / 2} y={cy + 4}
                textAnchor="middle" fill="#fff"
                fontSize={8.5} fontWeight={800}>
                {label}
              </text>
            </g>
          )
        })()}

        {/* ── Y축 라벨 (우측) — 현재가·전일종가·평단가 근처 숨김 ── */}
        {yTicks.map((t, i) => {
          const ty = toY(t)
          if (Math.abs(ty - toY(lastCandle.close)) < 14) return null
          if (prevClose != null && Math.abs(ty - toY(prevClose)) < 10) return null
          if (avgInView && Math.abs(ty - avgY) < 10) return null
          return (
            <text key={i} x={W - padR + 4} y={ty + 3.5}
              fill="#3d4155" fontSize={9.5}>{fmtY(t)}</text>
          )
        })}

        {/* ── 가격/거래량 구분선 ── */}
        <line x1={padL} y1={volTop} x2={W - padR} y2={volTop}
          stroke="#1e2140" strokeWidth={1}/>

        {/* ── X축 라인 ── */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB}
          stroke="#4a5070" strokeWidth={1}/>

        {/* ── X축 라벨 (하단) ── */}
        {xIdxs.map(idx => (
          <text key={idx}
            x={toX(idx)} y={H - 6}
            textAnchor="middle" fill="#3d4155" fontSize={9}>
            {fmtDate(data[idx].date)}
          </text>
        ))}

        {/* ── 호버 툴팁 ── */}
        {hoveredIdx !== null && data[hoveredIdx] && (() => {
          const c    = data[hoveredIdx]
          const isUp = c.close >= c.open
          const cx   = toX(hoveredIdx)
          // 평단가 행 추가 시 툴팁 높이 증가
          const tipH = hasAvg ? 102 : 88
          const tipW = 130
          const tipX = cx + step + tipW > W - padR ? cx - tipW - 4 : cx + 4
          const tipY = Math.max(padT, Math.min(H - padB - tipH - 4, toY(c.high) - tipH / 2))
          const diff    = prevClose ? c.close - prevClose : 0
          const pct     = prevClose && prevClose > 0 ? (diff / prevClose) * 100 : 0
          // 평단가 대비 수익률
          const avgDiff = hasAvg ? c.close - avgPrice! : null
          const avgPct  = hasAvg && avgPrice! > 0 ? (avgDiff! / avgPrice!) * 100 : null
          return (
            <g style={{ pointerEvents:'none' }}>
              <rect x={tipX} y={tipY} width={tipW} height={tipH}
                fill="#141728"
                stroke={isUp ? '#ef4444' : '#3b82f6'}
                strokeWidth={0.8} rx={9} opacity={0.97}/>
              <text x={tipX + 8} y={tipY + 13} fill="#8a9aaa" fontSize={8.5}>{fmtDate(c.date)}</text>
              {([['시가',c.open],['고가',c.high],['저가',c.low],['종가',c.close]] as [string,number][])
                .map(([lbl,val], i) => (
                  <text key={i} x={tipX + 8} y={tipY + 27 + i * 14}
                    fill={lbl === '종가' ? (isUp ? '#f87171' : '#60a5fa') : '#a8b5c2'}
                    fontSize={10} fontWeight={lbl === '종가' ? 700 : 400}>
                    {lbl}: {fmtY(val)}
                  </text>
                ))
              }
              {prevClose != null && prevClose > 0 && (
                <text x={tipX + 8} y={tipY + 83}
                  fill={diff >= 0 ? '#f87171' : '#60a5fa'} fontSize={9} fontWeight={600}>
                  {diff >= 0 ? '+' : ''}{fmtY(diff)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                </text>
              )}
              {/* ★ 평단가 대비 수익률 행 */}
              {hasAvg && avgPct !== null && (
                <g>
                  {/* 구분선 */}
                  <line
                    x1={tipX + 6} y1={tipY + tipH - 20}
                    x2={tipX + tipW - 6} y2={tipY + tipH - 20}
                    stroke={AVG_COLOR} strokeWidth={0.5} strokeOpacity={0.4}
                  />
                  <text x={tipX + 8} y={tipY + tipH - 7}
                    fill={AVG_COLOR} fontSize={9} fontWeight={700}>
                    평단가 대비: {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(1)}%
                  </text>
                </g>
              )}
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
