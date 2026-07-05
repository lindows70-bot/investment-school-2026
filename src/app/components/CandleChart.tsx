'use client'

export interface Candle {
  date:   string
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
  ma?:    number | null   // 224일 이동평균(1D 일봉에만)
}

interface Props {
  data:    Candle[]
  width?:  number
  height?: number
}

export default function CandleChart({ data, width = 120, height = 60 }: Props) {
  if (!data?.length) return <span style={{ color:'#7a8fa3', fontSize:11 }}>—</span>

  // Price range with padding
  const prices = data.flatMap(d => [d.high, d.low])
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const range  = maxP - minP || minP * 0.02 || 1
  const pad    = range * 0.1
  const yMin   = minP - pad
  const yMax   = maxP + pad
  const yRange = yMax - yMin

  const n      = data.length
  const step   = width / n
  const cw     = Math.max(1.2, step * 0.55)  // candle body width

  const toY = (p: number) => ((yMax - p) / yRange) * (height - 2) + 1

  return (
    <svg
      width={width} height={height}
      style={{ display:'block', overflow:'visible' }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {data.map((c, i) => {
        const x     = i * step + step / 2
        const isUp  = c.close >= c.open
        // Korean style: up=red, down=blue
        const color = isUp ? '#ef4444' : '#3b82f6'

        const bodyTop = toY(Math.max(c.open, c.close))
        const bodyBot = toY(Math.min(c.open, c.close))
        const bodyH   = Math.max(0.8, bodyBot - bodyTop)

        return (
          <g key={i}>
            {/* Upper wick */}
            <line
              x1={x} y1={toY(c.high)}
              x2={x} y2={bodyTop}
              stroke={color} strokeWidth={0.8}
            />
            {/* Body: filled for up, outline for down */}
            <rect
              x={x - cw / 2} y={bodyTop}
              width={cw} height={bodyH}
              fill={isUp ? color : 'transparent'}
              stroke={color} strokeWidth={0.8}
            />
            {/* Lower wick */}
            <line
              x1={x} y1={bodyBot}
              x2={x} y2={toY(c.low)}
              stroke={color} strokeWidth={0.8}
            />
          </g>
        )
      })}
    </svg>
  )
}
