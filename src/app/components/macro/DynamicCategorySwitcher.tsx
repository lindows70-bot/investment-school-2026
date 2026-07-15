'use client'

/**
 * DynamicCategorySwitcher — 피터 린치 동적 카테고리 스위처 Phase 2
 *
 * 실시간 재무 DNA(EPS 성장률·부채비율·매크로 상관계수 등)를 분석하여
 * 피터 린치 6대 카테고리를 자동 판정합니다.
 */

import { useMemo } from 'react'
import {
  RefreshCw, TrendingUp, Anchor, Activity,
  LifeBuoy, Zap, AlertCircle,
} from 'lucide-react'
import { TK } from '@/lib/theme'

// ── 재무 입력 타입
export interface StockFundamental {
  ticker:            string
  name:              string
  epsGrowth:         number   // 연간 EPS 성장률 (%)
  revenueGrowth:     number   // 매출 성장률 (%)
  debtRatio:         number   // 부채비율 (%)
  divYield:          number   // 배당수익률 (%)
  netCashRatio:      number   // 순현금/시총 비율 (%)
  correlation:       number   // 매크로 지수 상관계수 (0~1)
  // ★ DB에 저장된 실제 린치 카테고리 (영문 key) — 있으면 알고리즘보다 우선
  dbLynchCategory?:  string | null
}

// ── 카테고리 정의
interface LynchCategory {
  id:    string
  name:  string
  icon:  React.ElementType
  color: string   // Tailwind text 색상 클래스
  bg:    string   // Tailwind bg 색상 클래스 (purge-safe 명시)
  desc:  string
}

// ── Supabase DB 영문 키 → LynchCategory 매핑 (DB 우선 사용 테이블)
// DB에 저장된 값이 있으면 알고리즘 대신 이 값을 최우선으로 사용합니다.
const DB_CATEGORY_MAP: Record<string, LynchCategory> = {
  fast_grower:  { id: 'fast',      name: '고성장주',    icon: Zap,       color: `text-[${TK.neonLime}]`, bg: `bg-[${TK.neonLime}]`,     desc: '연 20% 이상의 이익 성장을 구가하는 공격적 확장기' },
  stalwart:     { id: 'stalwart',  name: '대형우량주',  icon: Anchor,    color: 'text-emerald-400', bg: 'bg-emerald-400',   desc: '안정적인 시장 점유율과 꾸준한 이익 성장' },
  slow_grower:  { id: 'slow',      name: '저성장주',    icon: TrendingUp, color: 'text-zinc-400',  bg: 'bg-zinc-400',      desc: '성장은 정체되었으나 높은 배당 수익률 제공' },
  cyclical:     { id: 'cyclical',  name: '경기순환주',  icon: RefreshCw, color: 'text-blue-400',   bg: 'bg-blue-400',      desc: '산업 사이클과 매크로 지표에 수익이 연동됨' },
  turnaround:   { id: 'turnaround',name: '턴어라운드주',icon: LifeBuoy,  color: 'text-orange-400', bg: 'bg-orange-400',    desc: '위기를 극복하고 이익이 폭발적으로 회복 중' },
  asset_play:   { id: 'asset',     name: '자산주',      icon: Activity,  color: 'text-purple-400', bg: 'bg-purple-400',    desc: '장부가치 대비 저평가된 숨겨진 자산 보유' },
  na:           { id: 'slow',      name: '저성장주',    icon: TrendingUp, color: 'text-zinc-400',  bg: 'bg-zinc-400',      desc: '성장은 정체되었으나 높은 배당 수익률 제공' },
}

// ── 피터 린치 카테고리 판정 엔진 (DB 값 없을 때만 실행)
function classifyLynch(stock: StockFundamental): LynchCategory {
  const { epsGrowth, revenueGrowth, debtRatio, netCashRatio, correlation } = stock

  // 1. 턴어라운드: EPS 폭발 회복 or 고부채+이익전환
  if (epsGrowth > 100 || (debtRatio > 200 && epsGrowth > 20)) return {
    id: 'turnaround', name: '턴어라운드주', icon: LifeBuoy,
    color: 'text-orange-400', bg: 'bg-orange-400',
    desc: '위기를 극복하고 이익이 폭발적으로 회복 중',
  }
  // 2. 경기순환주: 매크로 상관계수 우선 체크 (고성장 수치와 중복될 수 있어 앞으로 이동)
  //    예: SK하이닉스(반도체) — revenueGrowth 25%지만 correlation 0.85 → 경기순환주가 맞음
  if (correlation >= 0.7) return {
    id: 'cyclical', name: '경기순환주', icon: RefreshCw,
    color: 'text-blue-400', bg: 'bg-blue-400',
    desc: '산업 사이클과 매크로 지표에 수익이 연동됨',
  }
  // 3. 고성장주: 경기순환 해당 없을 때만
  if (epsGrowth >= 20 || revenueGrowth >= 25) return {
    id: 'fast', name: '고성장주', icon: Zap,
    color: `text-[${TK.neonLime}]`, bg: `bg-[${TK.neonLime}]`,
    desc: '연 20% 이상의 이익 성장을 구가하는 공격적 확장기',
  }
  if (epsGrowth >= 10 && epsGrowth < 20) return {
    id: 'stalwart', name: '대형우량주', icon: Anchor,
    color: 'text-emerald-400', bg: 'bg-emerald-400',
    desc: '안정적인 시장 점유율과 꾸준한 이익 성장',
  }
  if (netCashRatio >= 30) return {
    id: 'asset', name: '자산주', icon: Activity,
    color: 'text-purple-400', bg: 'bg-purple-400',
    desc: '장부가치 대비 저평가된 숨겨진 자산 보유',
  }
  return {
    id: 'slow', name: '저성장주', icon: TrendingUp,
    color: 'text-zinc-400', bg: 'bg-zinc-400',
    desc: '성장은 정체되었으나 높은 배당 수익률 제공',
  }
}

// ✅ 제1원칙: DEFAULT_DATA 하드코딩 완전 제거
// 데이터가 없으면 빈 상태 UI를 표시합니다 (아래 Empty State 참조)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _REMOVED_DEFAULT_DATA: never[] = [ // 삭제 표시 — 실제 배열 없음
]

interface Props {
  stocksFundamentalData?: StockFundamental[]
}

export default function DynamicCategorySwitcher({ stocksFundamentalData }: Props) {
  const analysisData = useMemo(() => {
    // ✅ 데이터 없으면 빈 배열 — 하드코딩 폴백 없음
    if (!stocksFundamentalData || stocksFundamentalData.length === 0) return []
    return stocksFundamentalData.map(stock => {
      // ★ DB 저장값(Supabase lynch_category) 우선 사용 — 알고리즘 추정보다 정확
      if (stock.dbLynchCategory) {
        const dbCat = DB_CATEGORY_MAP[stock.dbLynchCategory]
        if (dbCat) return { ...stock, category: dbCat }
      }
      // DB 값 없으면 알고리즘 분류
      return { ...stock, category: classifyLynch(stock) }
    })
  }, [stocksFundamentalData])

  // 데이터 없을 때 Empty State
  if (analysisData.length === 0) return (
    <div className="w-full p-8 bg-black border border-zinc-800 rounded-xl text-center text-zinc-500">
      <div className="text-sm mb-1">재무 분석 데이터를 연동해 주세요.</div>
      <div className="text-xs text-zinc-600">
        stocksFundamentalData prop 으로 EPS 성장률·부채비율·상관계수를 주입하면<br />
        피터 린치 6대 카테고리 자동 판정이 시작됩니다.
      </div>
    </div>
  )

  // 코칭 텍스트용 집계
  const fastGrowers  = analysisData.filter(s => s.category.id === 'fast').map(s => s.name)
  const cyclicals    = analysisData.filter(s => s.category.id === 'cyclical').map(s => s.name)
  const turnarounds  = analysisData.filter(s => s.category.id === 'turnaround').map(s => s.name)

  return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-100">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 text-[${TK.neonLime}]`} />
            동적 카테고리 스위처{' '}
            <span className={`text-[${TK.neonLime}]`}>Phase 2</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            실시간 재무 DNA 분석을 통해 피터 린치의 6대 카테고리를 자동 판정합니다.
          </p>
        </div>
        <div className={`px-3 py-1 bg-[${TK.neonLime}]/10 border border-[${TK.neonLime}]/30 rounded-full text-[10px] text-[${TK.neonLime}] font-bold uppercase tracking-widest`}>
          Live AI Analysis
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analysisData.map(stock => {
          const cat = stock.category
          const IconComp = cat.icon
          const barWidth = Math.min(Math.max(stock.epsGrowth, 0), 100)
          const showGrowthSlowdown =
            stock.ticker === 'NVDA' && stock.epsGrowth < 30

          return (
            <div
              key={stock.ticker}
              className={`group p-5 bg-zinc-950 border border-zinc-900 rounded-2xl hover:border-[${TK.neonLime}]/50 transition-all duration-300`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 bg-zinc-900 rounded-xl group-hover:bg-[${TK.neonLime}]/10 transition-colors`}>
                  <IconComp className={`w-6 h-6 ${cat.color}`} />
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{stock.name}</div>
                  <div className="text-xs text-zinc-500 font-mono">{stock.ticker}</div>
                </div>
              </div>

              {/* 재무 지표 */}
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">EPS 성장률</span>
                  <span className={stock.epsGrowth > 20 ? `text-[${TK.neonLime}]` : 'text-zinc-300'}>
                    {stock.epsGrowth}%
                  </span>
                </div>
                {/* ★ bg 클래스 명시적 지정 (purge-safe) */}
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.bg}`}
                    style={{ width: `${barWidth}%`, opacity: 0.75 }}
                  />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">부채비율: {stock.debtRatio}%</span>
                  <span className="text-zinc-500">상관계수: {stock.correlation.toFixed(2)}</span>
                </div>
              </div>

              {/* 카테고리 판정 결과 */}
              <div className="pt-4 border-t border-zinc-900">
                <div className={`text-sm font-bold ${cat.color} mb-1 flex items-center gap-1`}>
                  <IconComp className="w-4 h-4" />
                  {cat.name}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{cat.desc}</p>
              </div>

              {/* 성격 변화 경보 (NVDA 성장 둔화) */}
              {showGrowthSlowdown && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="text-[10px] text-amber-500 font-medium">
                    성장 둔화 포착: 우량주 전환 준비
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* AI 코칭 요약 */}
      <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
        <h4 className={`text-xs font-bold text-[${TK.neonLime}] mb-2 flex items-center gap-2`}>
          <Activity className="w-4 h-4" />
          투자학교 AI 엔진의 현재 코칭
        </h4>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          엔진 분석 결과: 현재 포트폴리오는{' '}
          {fastGrowers.length > 0 && (
            <>
              <span className="text-zinc-100 font-bold">고성장주({fastGrowers.join(', ')})</span>
              에 대한 집중도가 높으며,{' '}
            </>
          )}
          {cyclicals.length > 0 && (
            <>
              <span className="text-zinc-100 font-bold">경기순환주({cyclicals.join(', ')})</span>
              가 사이클 상단을 통과 중입니다.{' '}
            </>
          )}
          {turnarounds.length > 0 && (
            <>
              <span className="text-zinc-100 font-bold">턴어라운드주({turnarounds.join(', ')})</span>
              의 실적 회복 추이를 지속 모니터링하십시오.{' '}
            </>
          )}
          매크로 스트레스 테스트(Phase 1) 결과와 결합 시, 금리 인상 시나리오에서
          고성장주의 카테고리 이탈 가능성을 집중 모니터링하십시오.
        </p>
      </div>
    </div>
  )
}
