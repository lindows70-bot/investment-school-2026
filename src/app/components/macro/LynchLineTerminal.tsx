'use client'

/**
 * LynchLineTerminal v3 — Absolute Sync
 *
 * ◆ 신규 기능
 *  - 다중 키 폴백으로 실시간 주가 추출
 *    currentPrice → price → close → tradePrice → history[-1].price
 *  - "현재" 노드 자동 추가: 히스토리 마지막 이후 실시간 포인트를 차트 끝에 삽입
 *  - JSON.stringify useMemo 의존성: 객체 참조가 동일해도 내부 값 변경 시 강제 재연산
 *
 * ◆ 버그 수정
 *  - gap > 0 문자열 비교 → gapNum(number) 분리
 *  - liveNode.price = ... 직접 변이 → 불변 spread 교체
 *  - 우측 Y축 더미 Line 바인딩 (Recharts tick 렌더링 강제)
 */

import { useState, useMemo, useEffect } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Target, AlertTriangle } from 'lucide-react'
import { TK } from '@/lib/theme'

// ── 타입
export interface LynchHistoryPoint {
  date:  string
  price: number
  eps:   number
}

export interface LynchStockData {
  name:          string
  category?:     string
  multiple?:     number
  // EPS 모드 정보 (API에서 전달)
  epsMode?:      string   // 'actual'|'forward'|'revenue'|'loss'
  badgeText?:    string
  badgeColor?:   string
  description?:  string
  forwardEps?:   number
  revenueGrowth?: number
  currentPs?:    number
  isKrw?:        boolean
  // 실시간 주가 — 다중 키 허용
  currentPrice?: number
  price?:        number
  close?:        number
  tradePrice?:   number
  // 실시간 EPS — 다중 키 허용
  eps?:          number
  currentEps?:   number
  history?:      LynchHistoryPoint[]
}

export type LynchTerminalData = Record<string, LynchStockData>

export interface LivePriceMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [ticker: string]: { currentPrice: number } & Record<string, any>
}

interface ChartPoint { date: string; price: number; lynch: number }

interface Props {
  lynchTerminalData?: LynchTerminalData
  // 하위 호환 aliases
  lynchBaseData?:     LynchTerminalData
  currentMarketData?: LynchTerminalData
  datasource?:        LynchTerminalData
  macroFactor?:       number
}

export default function LynchLineTerminal({
  lynchTerminalData,
  lynchBaseData,
  currentMarketData,
  datasource,
  macroFactor = 1.0,
}: Props) {
  const source: LynchTerminalData =
    lynchTerminalData ?? lynchBaseData ?? currentMarketData ?? datasource ?? {}

  const tickers = useMemo(() => Object.keys(source), [source])
  const [selectedTicker, setSelectedTicker] = useState<string>('')

  useEffect(() => {
    if (tickers.length > 0 && (!selectedTicker || !source[selectedTicker])) {
      setSelectedTicker(tickers[0])
    }
  }, [tickers, source, selectedTicker])

  const ctx = useMemo(() => {
    if (!selectedTicker || !source[selectedTicker]) return null

    const stock    = source[selectedTicker]
    const multiple = stock.multiple ?? 12

    // ★ 다중 키 폴백: 백엔드/상위 state 가 어떤 키를 쓰든 추출
    const trueLivePrice = Number(
      stock.currentPrice
      ?? stock.price
      ?? stock.close
      ?? stock.tradePrice
      ?? stock.history?.[stock.history.length - 1]?.price
      ?? 0
    )

    // ★ EPS 다중 키 폴백
    const currentEps = Number(
      stock.eps
      ?? stock.currentEps
      ?? stock.history?.[stock.history.length - 1]?.eps
      ?? 0
    )

    // 과거 히스토리 → 차트 포인트 변환
    const rawHistory = stock.history ?? []
    const baseData: ChartPoint[] = rawHistory.map(item => ({
      date:  item.date,
      price: Number(item.price),
      lynch: Math.round(Number(item.eps) * multiple * macroFactor),
    }))

    // ★ "현재" 노드 처리 (불변 방식)
    const hasLiveNode = baseData.some(d => d.date === '현재' || d.date === 'Live')
    let chartData: ChartPoint[]

    if (baseData.length === 0) {
      // 히스토리 자체가 없는 경우
      chartData = [{
        date:  '현재',
        price: trueLivePrice,
        lynch: Math.round(currentEps * multiple * macroFactor),
      }]
    } else if (!hasLiveNode) {
      // "현재" 노드가 없으면 끝에 추가 (spread — 불변)
      chartData = [
        ...baseData,
        {
          date:  '현재',
          price: trueLivePrice,
          lynch: Math.round(currentEps * multiple * macroFactor),
        },
      ]
    } else {
      // 이미 "현재" 노드가 있으면 마지막 항목을 spread 로 교체 (불변)
      chartData = [
        ...baseData.slice(0, -1),
        {
          ...baseData[baseData.length - 1],
          price: trueLivePrice,
          lynch: Math.round(currentEps * multiple * macroFactor),
        },
      ]
    }

    const latest      = chartData[chartData.length - 1]
    // 적자 기업(Lynch Line = 0): 괴리율 계산 자체가 무의미
    const isLossCompany = latest.lynch <= 0

    const gapNum  = isLossCompany ? null
      : ((trueLivePrice - latest.lynch) / latest.lynch) * 100
    const isUnder = gapNum !== null && gapNum < 0
    const absGap  = gapNum !== null ? Math.abs(gapNum).toFixed(1) : null
    const gapDisp = gapNum === null ? null
      : isUnder ? `−${absGap}` : `+${absGap}`

    const isKrw = stock.isKrw
      ?? /^\d{6}$/.test(selectedTicker)
      ?? /\.(KS|KQ)$/i.test(selectedTicker)
    const unit = isKrw ? '₩' : '$'

    // Y축 동적 ticks
    const allVals = chartData.flatMap(d => [d.price, d.lynch]).filter(v => v > 0)
    const yMin    = allVals.length ? Math.floor(Math.min(...allVals) * 0.92) : 0
    const yMax    = allVals.length ? Math.ceil(Math.max(...allVals)  * 1.06) : 100
    const step    = (yMax - yMin) / 4
    const yTicks  = [0,1,2,3,4].map(i => Math.round(yMin + step * i))

    return {
      name:           stock.name,
      category:       stock.category ?? '미분류',
      multiple,
      chartData,
      currentPrice:   trueLivePrice,
      intrinsicValue: latest.lynch,
      gapDisp, isUnder, absGap, unit, isKrw,
      yMin, yMax, yTicks,
      isLiveOverride:  trueLivePrice > 0,
      isLossCompany,
      // EPS 모드 정보 pass-through (stock에서 직접 참조)
      epsMode:       stock.epsMode,
      badgeText:     stock.badgeText,
      badgeColor:    stock.badgeColor,
      description:   stock.description,
      forwardEps:    stock.forwardEps ?? 0,
      revenueGrowth: stock.revenueGrowth ?? 0,
      currentPs:     stock.currentPs ?? 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    source,
    selectedTicker,
    macroFactor,
    // ★ JSON.stringify: 객체 참조가 동일해도 내부 주가/EPS 값이 바뀌면 강제 재연산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(source[selectedTicker]),
  ])

  if (tickers.length === 0 || !ctx) return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-center text-sm text-zinc-500 font-sans">
      <AlertTriangle className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
      금융 데이터를 동기화 중입니다…
    </div>
  )

  return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-100 font-sans">

      {/* ── 헤더 + 탭 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Target className={`w-4 h-4 text-[${TK.neonLime}]`} />
            <h3 className="text-base font-bold">
              실시간 린치 라인 터미널 <span className={`text-[${TK.neonLime}]`}>Phase 3</span>
            </h3>
            {/* EPS 모드 배지 (API 정보 우선, 없으면 라이브 여부) */}
            {ctx.badgeText ? (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ctx.badgeColor ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                {ctx.epsMode === 'forward'  && '🔄 '}
                {ctx.epsMode === 'revenue'  && '📈 '}
                {ctx.epsMode === 'loss'     && '⚠️ '}
                {ctx.epsMode === 'actual'   && '🔴 '}
                {ctx.badgeText}
              </span>
            ) : ctx.isLiveOverride ? (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-[${TK.neonLime}]/10 text-[${TK.neonLime}] border border-[${TK.neonLime}]/30`}>
                🔴 Absolute Sync
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            EPS × 기질 멀티플 실시간 연산 · &quot;현재&quot; 노드 자동 동기화
          </p>
        </div>

        <div className="flex flex-wrap bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1">
          {tickers.map(ticker => (
            <button key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                selectedTicker === ticker
                  ? `bg-[${TK.neonLime}] text-black`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {source[ticker]?.name ?? ticker}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg">
          <div className="text-[10px] text-zinc-500 font-bold mb-1">린치 기질 분류</div>
          <div className="text-sm font-bold text-zinc-300">{ctx.category}</div>
        </div>
        <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg">
          <div className="text-[10px] text-zinc-500 font-bold mb-1">실시간 현재가</div>
          <div className="text-xl font-mono font-bold text-blue-400">
            {ctx.unit}{ctx.currentPrice.toLocaleString()}
          </div>
        </div>
        <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg">
          <div className="text-[10px] text-zinc-500 font-bold mb-1">
            본질 가치 ({ctx.multiple}배
            {macroFactor !== 1.0 && (
              <span className={`ml-1 ${macroFactor < 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                ×{macroFactor.toFixed(2)}
              </span>
            )})
          </div>
          <div className={`text-xl font-mono font-bold text-[${TK.neonLime}]`}>
            {ctx.unit}{ctx.intrinsicValue.toLocaleString()}
          </div>
        </div>
        <div className={`p-3 border rounded-lg flex flex-col justify-center ${
          ctx.isLossCompany ? 'bg-zinc-800/30 border-zinc-700/30'
          : ctx.isUnder ? 'bg-emerald-500/5 border-emerald-500/10'
          : 'bg-rose-500/5 border-rose-500/10'
        }`}>
          <div className="text-[10px] text-zinc-500 font-bold mb-1">가치 괴리율</div>
          {ctx.isLossCompany ? (
            <div>
              <div className="text-sm font-bold text-amber-400">적자 구간</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                EPS 음수 → Lynch 적정가 계산 불가<br/>턴어라운드 진행 중
              </div>
            </div>
          ) : (
            <div className={`text-xl font-mono font-bold ${ctx.isUnder ? 'text-emerald-400' : 'text-rose-400'}`}>
              {ctx.gapDisp}%{' '}
              <span className="text-sm">{ctx.isUnder ? '저평가' : '고평가'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 차트 */}
      <div className="w-full h-80 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={ctx.chartData}
            margin={{ top: 10, right: ctx.isKrw ? 72 : 52, left: ctx.isKrw ? 6 : 4, bottom: 5 }}
          >
            <defs>
              <linearGradient id="absGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TK.blue500} stopOpacity={0.20} />
                <stop offset="95%" stopColor={TK.blue500} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="date"
              stroke="#444" fontSize={10} tickLine={false} axisLine={false} />

            <YAxis yAxisId="left"
              domain={[ctx.yMin, ctx.yMax]} ticks={ctx.yTicks}
              stroke="#444" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={ctx.isKrw ? 72 : 48}
            />
            <YAxis yAxisId="right"
              orientation="right"
              domain={[ctx.yMin, ctx.yMax]} ticks={ctx.yTicks}
              stroke="#444" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={ctx.isKrw ? 72 : 48}
            />

            <Tooltip
              contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: 6, fontSize: 11 }}
              itemStyle={{ fontWeight: 'bold' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${ctx.unit}${Number(value).toLocaleString()}`]}
            />
            <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />

            <Line yAxisId="left"
              name="Lynch Line (본질가치)"
              type="monotone" dataKey="lynch"
              stroke={TK.neonLime} strokeWidth={2.5}
              dot={{ r: 4, fill: TK.neonLime, stroke: '#000', strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
            <Area yAxisId="left"
              name="Stock Price (현재가)"
              type="monotone" dataKey="price"
              stroke={TK.blue500} strokeWidth={2.5}
              fill="url(#absGrad)" fillOpacity={1}
              dot={{ r: 2.5, fill: TK.blue500, stroke: '#000', strokeWidth: 1 }}
            />

            {/* ★ 우측 Y축 tick 강제 렌더링 더미 */}
            <Line yAxisId="right"
              dataKey="lynch"
              stroke="transparent"
              dot={false} activeDot={false}
              legendType="none" isAnimationActive={false}
              name="__mirror__"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── EPS 모드별 인사이트 패널 */}
      {ctx.description && (
        <div className={`flex gap-3 p-3.5 rounded-lg border ${
          ctx.epsMode === 'forward'  ? 'bg-amber-500/5 border-amber-500/20' :
          ctx.epsMode === 'revenue'  ? 'bg-blue-500/5 border-blue-500/20' :
          ctx.epsMode === 'loss'     ? 'bg-zinc-800/30 border-zinc-700/30' :
          `bg-[${TK.neonLime}]/5 border-[${TK.neonLime}]/15`
        }`}>
          <span className="text-base flex-shrink-0">
            {ctx.epsMode === 'forward' ? '🔄' :
             ctx.epsMode === 'revenue' ? '📈' :
             ctx.epsMode === 'loss'    ? '⚠️' : '📊'}
          </span>
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            <span className={`font-bold mr-1 ${
              ctx.epsMode === 'forward' ? 'text-amber-400' :
              ctx.epsMode === 'revenue' ? 'text-blue-400'  :
              ctx.epsMode === 'loss'    ? 'text-zinc-400'  : `text-[${TK.neonLime}]`
            }`}>[{ctx.badgeText ?? 'Lynch 분석'}]</span>
            {ctx.description}
            {/* revenue 모드: 핵심 지표 추가 */}
            {ctx.epsMode === 'revenue' && ctx.revenueGrowth && ctx.revenueGrowth > 0 && (
              <div className="mt-2 flex gap-4 flex-wrap">
                <span className="text-[10px] text-blue-400">
                  📊 매출 성장률: <strong>+{ctx.revenueGrowth.toFixed(0)}%</strong> YoY
                </span>
                {ctx.currentPs && ctx.currentPs > 0 && (
                  <span className="text-[10px] text-blue-400">
                    💰 현재 P/S: <strong>{ctx.currentPs.toFixed(1)}×</strong>
                  </span>
                )}
                <span className="text-[10px] text-zinc-500">
                  ※ 핵심 관찰: 매출 성장 둔화(꺾임) 여부 모니터링 필수
                </span>
              </div>
            )}
            {/* forward 모드: forwardEPS 명시 */}
            {ctx.epsMode === 'forward' && ctx.forwardEps && ctx.forwardEps > 0 && (
              <div className="mt-1 text-[10px] text-amber-400">
                📅 Forward EPS: {ctx.unit}{ctx.forwardEps.toFixed(ctx.isKrw ? 0 : 2)} · Lynch Line = {ctx.unit}{ctx.intrinsicValue.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 구형 적자 안내 (badgeText 없는 경우 폴백) */}
      {!ctx.description && ctx.isLossCompany && (
        <div className="flex gap-3 p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <span className="text-amber-400 text-base flex-shrink-0">⚠️</span>
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            <span className="text-amber-400 font-bold">{ctx.name ?? selectedTicker}</span>는 현재{' '}
            <span className="text-amber-400 font-bold">적자 구간(EPS &lt; 0)</span>으로
            Lynch 적정가치를 산출할 수 없습니다. 흑자 전환 시 자동 활성화됩니다.
          </div>
        </div>
      )}
    </div>
  )
}
