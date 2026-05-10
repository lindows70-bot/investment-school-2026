'use client'

import { useState } from 'react'
import type { Candle } from './CandleChart'

type TimeFrame = '1D' | '1W' | '1M' | '1Y'

interface Props {
  data:       Candle[]
  currency:   string
  timeframe:  TimeFrame
  prevClose?: number
  height?:    number   // 기본값 300
}

const N   = '#1b1e2e'

export default function FullCandleChart({ data, currency, timeframe, prevClose, height: heightProp = 300 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data?.length) return (
    <div style={{ height: heightProp, display:'flex', alignItems:'center', justifyContent:'center', color:'#454868', fontSize:13 }}>
      캔들 데이터 없음
    </div>
  )

  // ── SVG 레이아웃 ──────────────────────────────────────────
  const W    = 760    // viewBox 너비 (100% 비율 유지)
  const H    = heightProp
  const padL = 6
  const padR = 66     // Y축 라벨 (우측)
  const padT = 22
  const padB = 26     // X축 라벨 (하단)
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  // ── 가격 범위 ─────────────────────────────────────────────
  const prices = data.flatMap(d => [d.high, d.low])
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const range  = maxP - minP || minP * 0.02 || 1
  const vPad   = range * 0.12
  const yMin   = minP - vPad
  const yMax   = maxP + vPad
  const yRange = yMax - yMin

  // ── 좌표 변환 ─────────────────────────────────────────────
  const n    = data.length
  const step = plotW / n
  // 캔들 너비: 캔들 수에 따라 자연스럽게 조절
  // 30개 이하 → 넓게, 30~80개 → 중간, 80개+ → 좁게
  const cw   = n <= 30 ? Math.min(step * 0.7, 12)
             : n <= 80 ? Math.max(1.5, step * 0.65)
             : Math.max(1, step * 0.6)
  const toX  = (i: number) => padL + i * step + step / 2
  const toY  = (p: number) => padT + ((yMax - p) / yRange) * plotH

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
    if (timeframe === '1D') return d.toLocaleTimeString('ko-KR',{ hour:'2-digit', minute:'2-digit', hour12:false })
    if (timeframe === '1Y') return `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}`
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
  const maxIdx    = data.reduce((mi, c, i) => c.high > data[mi].high ? i : mi, 0)
  const minIdx    = data.reduce((mi, c, i) => c.low  < data[mi].low  ? i : mi, 0)
  const lastCandle = data[n - 1]
  const lastColor  = lastCandle.close >= lastCandle.open ? '#ef4444' : '#3b82f6'

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

        {/* ── 전일 종가 기준선 (점선) ── */}
        {prevClose != null && prevClose > 0 && (
          <>
            <line
              x1={padL} y1={toY(prevClose)}
              x2={W - padR} y2={toY(prevClose)}
              stroke={lastCandle.close >= prevClose ? '#f87171' : '#60a5fa'}
              strokeWidth={0.9} strokeDasharray="5 4" strokeOpacity={0.55}
            />
            {/* 전일종가 작은 태그 */}
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
              {/* 호버 배경 */}
              {hovered && (
                <rect
                  x={x - step / 2} y={padT}
                  width={step} height={plotH}
                  fill="rgba(255,255,255,0.035)" rx={2}
                />
              )}
              {/* 수직 호버 라인 */}
              {hovered && (
                <line x1={x} y1={padT} x2={x} y2={padT + plotH}
                  stroke={color} strokeWidth={0.7} strokeDasharray="3 3" strokeOpacity={0.4}/>
              )}
              {/* 위꼬리 */}
              <line x1={x} y1={toY(c.high)} x2={x} y2={bodyT}
                stroke={color} strokeWidth={1.2}/>
              {/* 몸통: 상승=채움, 하락=외곽선 (한국 스타일) */}
              <rect
                x={x - cw / 2} y={bodyT}
                width={cw} height={bodyH}
                fill={isUp ? color : 'transparent'}
                stroke={color} strokeWidth={1.2}
                rx={0.5}
              />
              {/* 아래꼬리 */}
              <line x1={x} y1={bodyB} x2={x} y2={toY(c.low)}
                stroke={color} strokeWidth={1.2}/>
            </g>
          )
        })}

        {/* ── 고가 마커 🟡 — 차트 내부에 작은 점+라벨 ── */}
        {(() => {
          const hx = toX(maxIdx), hy = toY(data[maxIdx].high)
          const lbl = `▲ ${fmtY(data[maxIdx].high)}`
          // 라벨 위치: 오른쪽 공간 있으면 오른쪽, 없으면 왼쪽
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

        {/* ── 저가 마커 🟣 ── */}
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

        {/* ── 현재가 글로우 점 + 배경 태그 (Y축과 겹치지 않게) ── */}
        {(() => {
          const cy    = toY(lastCandle.close)
          const label = fmtY(lastCandle.close)
          const tagW  = Math.max(44, label.length * 5.8 + 10)
          const tagH  = 15
          const tagX  = W - padR + 1
          return (
            <g>
              {/* 글로우 점 */}
              <circle cx={toX(n - 1)} cy={cy} r={5}
                fill={lastColor} stroke={N} strokeWidth={2}
                style={{ filter:`drop-shadow(0 0 6px ${lastColor})` }}/>
              {/* 현재가 컬러 태그 */}
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

        {/* ── Y축 라벨 (우측) — 현재가·전일종가 근처 숨김 ── */}
        {yTicks.map((t, i) => {
          const ty = toY(t)
          // 현재가 태그와 15px 이내면 숨김 (겹침 방지)
          if (Math.abs(ty - toY(lastCandle.close)) < 14) return null
          // 전일종가 근처도 숨김
          if (prevClose != null && Math.abs(ty - toY(prevClose)) < 10) return null
          return (
            <text key={i} x={W - padR + 4} y={ty + 3.5}
              fill="#3d4155" fontSize={9.5}>{fmtY(t)}</text>
          )
        })}

        {/* ── X축 라인 ── */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB}
          stroke="#252840" strokeWidth={1}/>

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
          const tipW = 126
          const tipH = 88
          const tipX = cx + step + tipW > W - padR ? cx - tipW - 4 : cx + 4
          const tipY = Math.max(padT, Math.min(H - padB - tipH - 4, toY(c.high) - tipH / 2))
          const diff = prevClose ? c.close - prevClose : 0
          const pct  = prevClose && prevClose > 0 ? (diff / prevClose) * 100 : 0
          return (
            <g style={{ pointerEvents:'none' }}>
              <rect x={tipX} y={tipY} width={tipW} height={tipH}
                fill="#141728"
                stroke={isUp ? '#ef4444' : '#3b82f6'}
                strokeWidth={0.8} rx={9} opacity={0.97}/>
              <text x={tipX + 8} y={tipY + 13} fill="#6b7280" fontSize={8.5}>{fmtDate(c.date)}</text>
              {([['시가',c.open],['고가',c.high],['저가',c.low],['종가',c.close]] as [string,number][])
                .map(([lbl,val], i) => (
                  <text key={i} x={tipX + 8} y={tipY + 27 + i * 14}
                    fill={lbl === '종가' ? (isUp ? '#f87171' : '#60a5fa') : '#9ca3af'}
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
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
