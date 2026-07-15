'use client'

/**
 * LynchLineChart (Phase 3) — 실시간 린치 라인 터미널
 *
 * Phase 2 AI 엔진이 판정한 카테고리별 멀티플을 적용하여
 * 주가와 본질 가치(EPS × Multiple)의 괴리율을 6종목 전수 추적합니다.
 */

import { useState } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Target, Info, AlertTriangle } from 'lucide-react'
import { TK } from '@/lib/theme'

// ── 타입
interface HistoryPoint { date: string; price: number; lynch: number }
export interface StockData {
  name:     string
  category: string
  multiple: number
  isKrw:    boolean
  history:  HistoryPoint[]
}

// ⚠️  DEMO/개발 전용 폴백 데이터
// ✅  제1원칙: 특정 종목 의존. 실제 운영 시 이 상수를 사용하는 컴포넌트에
//    Supabase investments + DART/FMP EPS 데이터를 주입해야 합니다.
//    UniversalLynchLineTerminal / LynchLineTerminal 이 외부 props 를 받도록 설계되어 있습니다.
export const STOCK_DATA: Record<string, StockData> = {
  'NVDA': {
    name: 'NVIDIA', category: '고성장주', multiple: 25, isKrw: false,
    history: [
      { date: '24-Q4', price:  95,   lynch:  90    },
      { date: '25-Q1', price: 110,   lynch: 105    },
      { date: '25-Q2', price: 125,   lynch: 120    },
      { date: '25-Q3', price: 130,   lynch: 135    },
      { date: '25-Q4', price: 140,   lynch: 148    },
      { date: '26-Q1', price: 135,   lynch: 152.4  }, // −11.2% 저평가
    ],
  },
  'TEM': {
    name: 'Tempus AI', category: '턴어라운드주', multiple: 30, isKrw: false,
    history: [
      { date: '24-Q4', price:  22, lynch:  15   },
      { date: '25-Q1', price:  28, lynch:  18   },
      { date: '25-Q2', price:  35, lynch:  24   },
      { date: '25-Q3', price:  42, lynch:  32   },
      { date: '25-Q4', price:  48, lynch:  45   },
      { date: '26-Q1', price:  41, lynch:  52.5 }, // −21.9% 저평가
    ],
  },
  'ETN': {
    name: 'Eaton', category: '대형우량주', multiple: 15, isKrw: false,
    history: [
      { date: '24-Q4', price: 240, lynch: 220 },
      { date: '25-Q1', price: 265, lynch: 235 },
      { date: '25-Q2', price: 280, lynch: 250 },
      { date: '25-Q3', price: 295, lynch: 265 },
      { date: '25-Q4', price: 310, lynch: 275 },
      { date: '26-Q1', price: 320, lynch: 285 }, // +12.3% 과열
    ],
  },
  'GEV': {
    name: 'GE Vernova', category: '대형우량주', multiple: 15, isKrw: false,
    history: [
      { date: '24-Q4', price: 130, lynch: 125   },
      { date: '25-Q1', price: 145, lynch: 140   },
      { date: '25-Q2', price: 152, lynch: 150   },
      { date: '25-Q3', price: 160, lynch: 162   },
      { date: '25-Q4', price: 165, lynch: 170   },
      { date: '26-Q1', price: 170, lynch: 178.5 }, // −4.8% 소폭 저평가
    ],
  },
  '000660': {
    name: 'SK하이닉스', category: '경기순환주', multiple: 12, isKrw: true,
    history: [
      { date: '24-Q4', price: 160000, lynch: 140000 },
      { date: '25-Q1', price: 180000, lynch: 155000 },
      { date: '25-Q2', price: 210000, lynch: 190000 },
      { date: '25-Q3', price: 195000, lynch: 215000 },
      { date: '25-Q4', price: 220000, lynch: 205000 },
      { date: '26-Q1', price: 233000, lynch: 221000 }, // +5.4% 적정
    ],
  },
  '189300': {
    name: '인텔리안테크', category: '고성장주', multiple: 20, isKrw: true,
    history: [
      { date: '24-Q4', price: 65000, lynch:  58000 },
      { date: '25-Q1', price: 72000, lynch:  64000 },
      { date: '25-Q2', price: 69000, lynch:  71000 },
      { date: '25-Q3', price: 75000, lynch:  78000 },
      { date: '25-Q4', price: 81000, lynch:  85000 },
      { date: '26-Q1', price: 78000, lynch:  92000 }, // −15.2% 저평가
    ],
  },
}

// ── 카테고리별 색상 배지
const CATEGORY_COLOR: Record<string, string> = {
  '고성장주':    `text-[${TK.neonLime}] bg-[${TK.neonLime}]/10 border-[${TK.neonLime}]/30`,
  '턴어라운드주': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  '대형우량주':  'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  '경기순환주':  'text-blue-400 bg-blue-400/10 border-blue-400/30',
}

// ── 커스텀 툴팁
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, isKrw }: any) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) =>
    isKrw
      ? `₩${Math.round(v).toLocaleString('ko-KR')}`
      : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div style={{
      background: '#000', border: '1px solid #333', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, minWidth: 180,
    }}>
      <div style={{ color: TK.sub2, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload
        .filter((p: { name: string }) => p.name !== '__mirror__')
        .map((p: { name: string; value: number; color: string }, i: number) => (
          <div key={i} style={{ color: p.color, marginBottom: 2, fontWeight: 700 }}>
            {p.name}: {fmt(p.value)}
          </div>
        ))
      }
    </div>
  )
}

export default function LynchLineChart() {
  const [selectedTicker, setSelectedTicker] = useState<string>('NVDA')
  const stock  = STOCK_DATA[selectedTicker]
  const latest = stock.history[stock.history.length - 1]

  // ★ gap을 숫자로 계산 (문자열 비교 버그 방지)
  const gapNum = ((latest.price - latest.lynch) / latest.lynch) * 100
  const gapStr = gapNum.toFixed(1)
  const isUnder = gapNum < 0
  const absGap  = Math.abs(gapNum).toFixed(1)

  const fmtPrice = (v: number) =>
    stock.isKrw
      ? `₩${Math.round(v).toLocaleString('ko-KR')}`
      : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Y축 domain + ticks 계산
  const allVals = stock.history.flatMap(d => [d.price, d.lynch])
  const yMin    = Math.floor(Math.min(...allVals) * 0.92)
  const yMax    = Math.ceil(Math.max(...allVals)  * 1.06)
  const step    = (yMax - yMin) / 4
  const yTicks  = [0, 1, 2, 3, 4].map(i => Math.round(yMin + step * i))

  return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-100 font-sans">

      {/* ── 헤더 + 종목 셀렉터 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 text-[${TK.neonLime}]`} />
            <h3 className="text-xl font-bold tracking-tight">
              실시간 린치 라인 터미널{' '}
              <span className={`text-[${TK.neonLime}]`}>Phase 3</span>
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Phase 2 AI 엔진이 판정한 기질별 멀티플을 적용하여 본질 가치 괴리율을 추적합니다.
          </p>
        </div>

        {/* 6종목 탭 */}
        <div className="flex flex-wrap bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1">
          {Object.entries(STOCK_DATA).map(([ticker, s]) => (
            <button key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTicker === ticker
                  ? `bg-[${TK.neonLime}] text-black`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI 카드 4개 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* 린치 카테고리 */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">린치 카테고리 기질</div>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
            CATEGORY_COLOR[stock.category] ?? 'text-zinc-300 bg-zinc-800 border-zinc-700'
          }`}>
            {stock.category}
          </span>
        </div>
        {/* 현재 주가 */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">현재 주가</div>
          <div className="text-2xl font-mono font-bold text-blue-400">
            {fmtPrice(latest.price)}
          </div>
        </div>
        {/* 린치 적정 가치 */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">
            린치 적정 가치 (배수 {stock.multiple}×)
          </div>
          <div className={`text-2xl font-mono font-bold text-[${TK.neonLime}]`}>
            {fmtPrice(latest.lynch)}
          </div>
        </div>
        {/* 괴리율 */}
        <div className={`p-4 border rounded-xl flex flex-col justify-center ${
          isUnder ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
        }`}>
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">가치 괴리율</div>
          <div className={`text-2xl font-mono font-bold ${isUnder ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUnder ? `−${absGap}` : `+${absGap}`}%{' '}
            <span className="text-base">{isUnder ? '저평가' : '과열'}</span>
          </div>
        </div>
      </div>

      {/* ── 린치 라인 차트 */}
      <div className="w-full h-[360px] bg-zinc-950/50 p-4 rounded-xl border border-zinc-900 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={stock.history}
            margin={{ top: 15, right: stock.isKrw ? 70 : 55, left: stock.isKrw ? 10 : 4, bottom: 5 }}
          >
            <defs>
              <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TK.blue500} stopOpacity={0.25} />
                <stop offset="95%" stopColor={TK.blue500} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="date"
              stroke="#444" fontSize={11} tickLine={false} axisLine={false} />

            {/* 좌측 Y축 */}
            <YAxis yAxisId="left"
              domain={[yMin, yMax]} ticks={yTicks}
              stroke="#444" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={stock.isKrw ? 72 : 48}
            />
            {/* 우측 Y축 (mirror) */}
            <YAxis yAxisId="right"
              orientation="right"
              domain={[yMin, yMax]} ticks={yTicks}
              stroke="#444" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={stock.isKrw ? 72 : 48}
            />

            <Tooltip content={(p) => <ChartTooltip {...p} isKrw={stock.isKrw} />} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />

            {/* 0원 기준선 (KRW) */}
            {stock.isKrw && (
              <ReferenceLine yAxisId="left" y={0} stroke="#333" strokeDasharray="4 2" />
            )}

            {/* 린치 라인 (본질 가치) */}
            <Line yAxisId="left"
              name="Lynch Line (Fair Value)"
              type="monotone" dataKey="lynch"
              stroke={TK.neonLime} strokeWidth={3}
              dot={{ r: 4, fill: TK.neonLime, stroke: '#000', strokeWidth: 1.5 }}
              activeDot={{ r: 6, stroke: TK.neonLime, strokeWidth: 2 }}
            />
            {/* 주가 + 그라디언트 영역 */}
            <Area yAxisId="left"
              name="Stock Price"
              type="monotone" dataKey="price"
              stroke={TK.blue500} strokeWidth={3}
              fill="url(#gradPrice)" fillOpacity={1}
              dot={{ r: 3, fill: TK.blue500, stroke: '#000', strokeWidth: 1 }}
            />

            {/* ★ 우측 Y축 tick 강제 렌더링 더미 (투명) */}
            <Line yAxisId="right"
              dataKey="lynch"
              stroke="transparent"
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
              name="__mirror__"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── 인사이트 패널 */}
      <div className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="p-2 bg-zinc-800 rounded-lg flex-shrink-0 self-start">
          {isUnder
            ? <Info className={`w-5 h-5 text-[${TK.neonLime}]`} />
            : <AlertTriangle className="w-5 h-5 text-rose-400" />
          }
        </div>
        <div className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-zinc-100 font-bold block mb-1">터미널 엔진 분석 결과:</span>
          <span className="text-white">{stock.name}</span>은{' '}
          <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
            CATEGORY_COLOR[stock.category] ?? 'text-zinc-300'
          }`}>
            {stock.category}
          </span>
          으로 분류되며, 적용 멀티플 <span className="text-zinc-100 font-bold">{stock.multiple}배</span> 기준
          린치 라인 대비{' '}
          <span className={`font-bold ${isUnder ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUnder ? `${absGap}% 저평가` : `${absGap}% 과열`}
          </span>
          {' '}수준에서 거래되고 있습니다.
          {isUnder
            ? ' 본질 가치 대비 충분한 안전마진이 확보된 구간입니다. 분할 매수 전략이 유효합니다.'
            : ' 이익 성장을 선반영한 오버슈팅 구간입니다. Phase 1 금리 인상 시나리오 발생 시 멀티플 수축 리스크에 유의하십시오.'
          }
          {gapStr === '0.0' && ' 현재 주가가 본질 가치와 정확히 일치하는 적정 구간입니다.'}
        </div>
      </div>
    </div>
  )
}
