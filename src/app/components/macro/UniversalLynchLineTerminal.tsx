'use client'

/**
 * UniversalLynchLineTerminal — 범용 린치 라인 터미널 Phase 3 (Universal)
 *
 * [제 1원칙 준수] 하드코딩 완전 제거 버전.
 * studentPortfolio 를 외부에서 주입받아 완전히 동적으로 렌더링.
 * - studentPortfolio 미제공 시: LynchLineChart.tsx의 STOCK_DATA 를 기본값으로 폴백
 * - 우측 Y축 더미 Line 바인딩으로 tick 강제 렌더링 (Recharts 한계 우회)
 * - gap 숫자 연산 (문자열 비교 버그 수정)
 */

import { useState, useMemo, useEffect } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Target, Info, AlertTriangle } from 'lucide-react'
import { STOCK_DATA, type StockData } from './LynchLineChart'
import { TK } from '@/lib/theme'

// ── 타입
export type StudentPortfolio = Record<string, StockData>

interface Props {
  studentPortfolio?: StudentPortfolio  // 미제공 시 STOCK_DATA 폴백
  /**
   * macroFactor: Phase 1 금리 충격이 린치 라인에 미치는 멀티플 보정 계수
   * 기본값 1.0 (영향 없음)
   * 금리 인상(rateShock > 0) → macroFactor < 1 → 린치 라인 하향 조정
   * 금리 인하(rateShock < 0) → macroFactor > 1 → 린치 라인 상향 조정
   * 공식: macroFactor = 1 + rateShock * (−0.3)
   */
  macroFactor?: number
}

// ── 카테고리 배지 색상
const CATEGORY_COLOR: Record<string, string> = {
  '고성장주':    `text-[${TK.neonLime}] bg-[${TK.neonLime}]/10 border-[${TK.neonLime}]/30`,
  '턴어라운드주': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  '대형우량주':  'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  '경기순환주':  'text-blue-400 bg-blue-400/10 border-blue-400/30',
}

// ── 커스텀 툴팁
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, currencySign }: any) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) => `${currencySign}${v.toLocaleString()}`
  return (
    <div style={{
      background: '#000', border: '1px solid #333', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, minWidth: 190,
    }}>
      <div style={{ color: TK.sub2, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload
        .filter((p: { name: string }) => p.name !== '__mirror__')
        .map((p: { name: string; value: number; color: string }, i: number) => (
          <div key={i} style={{ color: p.color, fontWeight: 700, marginBottom: 2 }}>
            {p.name}: {fmt(p.value)}
          </div>
        ))
      }
    </div>
  )
}

export default function UniversalLynchLineTerminal({ studentPortfolio, macroFactor = 1.0 }: Props) {
  // 폴백: 미제공 시 STOCK_DATA 사용
  const portfolio: StudentPortfolio = (
    studentPortfolio && Object.keys(studentPortfolio).length > 0
      ? studentPortfolio
      : STOCK_DATA
  )

  const tickers = useMemo(() => Object.keys(portfolio), [portfolio])
  const [selectedTicker, setSelectedTicker] = useState<string>(tickers[0] ?? '')

  // 포트폴리오 변경 시 유효한 티커로 동기화
  useEffect(() => {
    if (!portfolio[selectedTicker]) {
      setSelectedTicker(tickers[0] ?? '')
    }
  }, [portfolio, tickers, selectedTicker])

  const rawStock = portfolio[selectedTicker] ?? portfolio[tickers[0]]

  // ★ macroFactor 적용: 린치 라인(본질 가치)을 금리 충격 계수로 보정
  // 금리 인상(macroFactor < 1) → 적정 가치 하향, 금리 인하(> 1) → 상향
  const currentStock = useMemo(() => {
    if (!rawStock || macroFactor === 1.0) return rawStock
    return {
      ...rawStock,
      history: rawStock.history.map(pt => ({
        ...pt,
        lynch: parseFloat((pt.lynch * macroFactor).toFixed(2)),
      })),
    }
  }, [rawStock, macroFactor])

  // 평가 요약 계산
  const summary = useMemo(() => {
    if (!currentStock?.history?.length) return null
    const latest = currentStock.history[currentStock.history.length - 1]
    // 한국 시장 감지: 6자리 숫자 or .KS / .KQ 포함
    const isKrw = /^\d{6}$/.test(selectedTicker) ||
      /\.(KS|KQ)$/i.test(selectedTicker) ||
      currentStock.isKrw

    const gapNum   = ((latest.price - latest.lynch) / latest.lynch) * 100
    const isUnder  = gapNum < 0
    const gapStr   = gapNum.toFixed(1)
    const absGap   = Math.abs(gapNum).toFixed(1)
    const sign     = isKrw ? '₩' : '$'

    // Y축 동적 계산
    const allVals = currentStock.history.flatMap(d => [d.price, d.lynch])
    const yMin    = Math.floor(Math.min(...allVals) * 0.92)
    const yMax    = Math.ceil(Math.max(...allVals)  * 1.06)
    const step    = (yMax - yMin) / 4
    const yTicks  = [0, 1, 2, 3, 4].map(i => Math.round(yMin + step * i))

    return { latest, isKrw, gapNum, gapStr, isUnder, absGap, sign, yMin, yMax, yTicks }
  }, [currentStock, selectedTicker])

  // ── 빈 포트폴리오 Empty State
  if (tickers.length === 0) return (
    <div className="w-full p-8 bg-black border border-zinc-800 rounded-xl text-center text-zinc-500 font-sans">
      <AlertTriangle className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
      <p className="text-sm">로드된 학생 포트폴리오 데이터가 없습니다.</p>
      <p className="text-xs text-zinc-600 mt-1">상위 엔드포인트에서 데이터를 연동해 주세요.</p>
    </div>
  )

  // ── 히스토리 없는 종목 Error State
  if (!summary) return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-500 text-xs font-sans">
      선택한 종목의 시계열 히스토리 데이터가 부족합니다.
    </div>
  )

  const { latest, isKrw, gapStr, isUnder, absGap, sign, yTicks, yMin, yMax } = summary
  const badgeCls = CATEGORY_COLOR[currentStock.category ?? ''] ?? 'text-zinc-300 bg-zinc-800 border-zinc-700'

  return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-100 font-sans">

      {/* ── 헤더 + 동적 탭 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 text-[${TK.neonLime}]`} />
            <h3 className="text-xl font-bold tracking-tight">
              실시간 린치 라인 터미널{' '}
              <span className={`text-[${TK.neonLime}]`}>Phase 3 (Universal)</span>
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            학생별 포트폴리오 데이터를 주입받아 피터 린치 가치 평가 메트릭을 동적으로 출력합니다.
          </p>
        </div>

        {/* 주입된 데이터 기반 동적 탭 (하드코딩 없음) */}
        <div className="flex flex-wrap bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1">
          {tickers.map(ticker => (
            <button key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedTicker === ticker
                  ? `bg-[${TK.neonLime}] text-black`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {portfolio[ticker]?.name ?? ticker}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI 카드 4개 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">판정 카테고리</div>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${badgeCls}`}>
            {currentStock.category ?? '미분류'}
          </span>
        </div>
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">현재가 (Price)</div>
          <div className="text-2xl font-mono font-bold text-blue-400">
            {sign}{latest.price.toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">
            적정 가치 ({currentStock.multiple ?? 15}배)
          </div>
          <div className={`text-2xl font-mono font-bold text-[${TK.neonLime}]`}>
            {sign}{latest.lynch.toLocaleString()}
          </div>
        </div>
        <div className={`p-4 border rounded-xl flex flex-col justify-center ${
          isUnder ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
        }`}>
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">가치 괴리율</div>
          <div className={`text-2xl font-mono font-bold ${isUnder ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUnder ? `−${absGap}` : `+${absGap}`}%{' '}
            <span className="text-base">{isUnder ? '저평가' : '고평가'}</span>
          </div>
        </div>
      </div>

      {/* ── 차트 */}
      <div className="w-full h-[360px] bg-zinc-950/50 p-4 rounded-xl border border-zinc-900 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={currentStock.history}
            margin={{ top: 15, right: isKrw ? 72 : 52, left: isKrw ? 8 : 4, bottom: 5 }}
          >
            <defs>
              <linearGradient id="univGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TK.blue500} stopOpacity={0.25} />
                <stop offset="95%" stopColor={TK.blue500} stopOpacity={0}    />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="date"
              stroke="#444" fontSize={11} tickLine={false} axisLine={false} />

            {/* 좌측 Y축 */}
            <YAxis yAxisId="main"
              domain={[yMin, yMax]} ticks={yTicks}
              stroke="#444" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={isKrw ? 72 : 48}
            />
            {/* 우측 Y축 (mirror) */}
            <YAxis yAxisId="mirror"
              orientation="right"
              domain={[yMin, yMax]} ticks={yTicks}
              stroke="#444" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v.toLocaleString()}
              width={isKrw ? 72 : 48}
            />

            <Tooltip content={(p) => <ChartTooltip {...p} currencySign={sign} />} />
            <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />

            {/* 린치 라인 */}
            <Line yAxisId="main"
              name="Lynch Line (본질가치)"
              type="monotone" dataKey="lynch"
              stroke={TK.neonLime} strokeWidth={3}
              dot={{ r: 4, fill: TK.neonLime, stroke: '#000', strokeWidth: 1.5 }}
              activeDot={{ r: 6 }}
            />
            {/* 주가 + 영역 */}
            <Area yAxisId="main"
              name="Stock Price (현재가)"
              type="monotone" dataKey="price"
              stroke={TK.blue500} strokeWidth={3}
              fill="url(#univGrad)" fillOpacity={1}
              dot={{ r: 3, fill: TK.blue500, stroke: '#000', strokeWidth: 1 }}
            />

            {/* ★ 우측 Y축 tick 강제 렌더링 더미 */}
            <Line yAxisId="mirror"
              dataKey="lynch"
              stroke="transparent"
              dot={false} activeDot={false}
              legendType="none" isAnimationActive={false}
              name="__mirror__"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── 코칭 인사이트 */}
      <div className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="p-2 bg-zinc-800 rounded-lg flex-shrink-0 self-start">
          {isUnder
            ? <Info className={`w-5 h-5 text-[${TK.neonLime}]`} />
            : <AlertTriangle className="w-5 h-5 text-rose-400" />
          }
        </div>
        <div className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-zinc-100 font-bold block mb-1">터미널 연동 분석 가이드:</span>
          로드된 데이터셋 분석 결과,{' '}
          <span className="text-white font-medium">{currentStock.name ?? selectedTicker}</span> 종목은
          본질 가치선 대비{' '}
          <span className={`font-bold ${isUnder ? 'text-emerald-400' : 'text-rose-400'}`}>
            {absGap}% {isUnder ? '저평가 (안전마진 확보)' : '오버슈팅 (밸류에이션 리스크)'}
          </span>{' '}
          상태에 있습니다. 각 학생이 구성한 포트폴리오 가중치에 맞춰 리밸런싱 지표로 활용하도록
          지도해 주십시오.
          {gapStr === '0.0' && ' 현재 주가가 본질 가치와 정확히 일치하는 적정 구간입니다.'}
        </div>
      </div>
    </div>
  )
}
