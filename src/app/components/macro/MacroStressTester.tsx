'use client'

import { useState, useMemo } from 'react'
import { Sliders, AlertTriangle, ShieldCheck, Shield } from 'lucide-react'

// ✅ 제1원칙: STOCK_META 하드코딩 완전 제거
// beta/PEG/category는 props로 주입받거나 아래 범용 기본값을 사용합니다.

// 범용 기본값 (종목 특성을 모를 때 보수적 추정)
const DEFAULT_META = { basePEG: 1.0, beta: 1.0, category: '미분류', type: '—' }

export interface StressPortfolioItem {
  ticker:       string
  name?:        string        // 종목명 (있으면 표시)
  avgPrice:     number
  currentPrice: number
  // 아래 필드는 선택적 — 제공 시 더 정밀한 스트레스 계산
  beta?:        number
  basePEG?:     number
  category?:    string
}

interface Props {
  portfolioData: StressPortfolioItem[]
}

export default function MacroStressTester({ portfolioData }: Props) {
  const [rateShock, setRateShock] = useState(0)

  const results = useMemo(() => {
    if (portfolioData.length === 0) return []

    return portfolioData
      .map(item => {
        // ✅ 종목별 메타: props에 있으면 사용, 없으면 범용 기본값
        const basePEG  = item.basePEG  ?? DEFAULT_META.basePEG
        const beta     = item.beta     ?? DEFAULT_META.beta
        const category = item.category ?? DEFAULT_META.category

        // 금리 충격 반영 PEG: 인상 시 베타가 높을수록 PEG 악화
        const adjustedPEG = parseFloat((basePEG * (1 + rateShock * beta)).toFixed(2))
        const roi         = ((item.currentPrice - item.avgPrice) / item.avgPrice) * 100

        let riskLevel = '안전'
        let riskColor = 'text-emerald-400 bg-emerald-500/10'

        if (category === '고성장주' || category === '턴어라운드주') {
          // 성장주·턴어라운드: 금리 인상 + 고PEG에 매우 취약
          if (adjustedPEG >= 1.6 || (rateShock > 0 && beta > 1.3)) {
            riskLevel = '위험 고조'
            riskColor = 'text-rose-400 bg-rose-500/10'
          } else if (adjustedPEG >= 1.1) {
            riskLevel = '민감도 보통'
            riskColor = 'text-amber-400 bg-amber-500/10'
          }
        } else if (category === '대형우량주' || category === '경기순환주') {
          // 우량주·인프라: 원래 PEG가 높을 수 있어 잣대 완화 (금리 방어력 인정)
          if (adjustedPEG >= 1.9 || (rateShock > 0 && beta > 1.5)) {
            riskLevel = '위험 고조'
            riskColor = 'text-rose-400 bg-rose-500/10'
          } else if (adjustedPEG >= 1.4 || rateShock > 0) {
            riskLevel = '매크로 버팀목'
            riskColor = 'text-blue-400 bg-blue-500/10'
          }
        }

        return { ...item, basePEG, beta, category, adjustedPEG, roi: roi.toFixed(2), riskLevel, riskColor }
      })
  }, [portfolioData, rateShock])

  return (
    <div className="w-full p-6 bg-black border border-zinc-800 rounded-xl text-zinc-100 font-sans">

      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#deff9a]" />
            <h3 className="text-xl font-bold tracking-tight">
              매크로 스트레스 테스터{' '}
              <span className="text-[#deff9a]">Phase 1</span>
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            CME FedWatch 시나리오별 금리 변동이 포트폴리오 밸류에이션에 미치는 가상의 충격을 측정합니다.
          </p>
        </div>

        {/* 시나리오 퀵 버튼 */}
        <div className="flex items-center gap-2">
          {[
            { label: '피벗 (-50bp)',        val: -0.5, cls: 'text-emerald-400 hover:border-emerald-500/50' },
            { label: '시장 컨센서스',        val:  0,   cls: 'text-zinc-300 hover:border-zinc-600'         },
            { label: '금리 인상 (+50bp)',    val:  0.5, cls: 'text-rose-400 hover:border-rose-500/50'     },
          ].map(s => (
            <button key={s.val}
              onClick={() => setRateShock(s.val)}
              className={`px-3 py-1.5 text-xs font-medium bg-zinc-900 border border-zinc-800 rounded-lg transition-all ${s.cls}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 슬라이더 */}
      <div className="mb-8 p-5 bg-zinc-950 border border-zinc-900 rounded-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-zinc-300">
            가상 연준 금리 충격 시나리오 (Fed Funds Rate Shock)
          </span>
          <span className={`text-lg font-bold ${
            rateShock > 0 ? 'text-rose-400' : rateShock < 0 ? 'text-emerald-400' : 'text-[#deff9a]'
          }`}>
            {rateShock > 0
              ? `+${rateShock.toFixed(2)}%p 인상`
              : rateShock < 0
              ? `${rateShock.toFixed(2)}%p 인하`
              : '0.00%p (동결/컨센서스)'}
          </span>
        </div>
        <input
          type="range" min="-1.00" max="1.00" step="0.25"
          value={rateShock}
          onChange={e => setRateShock(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#deff9a]"
        />
        <div className="flex justify-between text-[11px] text-zinc-500 mt-2 px-1">
          <span>-1.00%p (강한 피벗)</span>
          <span>-0.50%p</span>
          <span>기준점</span>
          <span>+0.50%p</span>
          <span>+1.00%p (통화 긴축 쇽)</span>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400">
              <th className="pb-3 font-medium">종목 (티커)</th>
              <th className="pb-3 font-medium">린치 카테고리</th>
              <th className="pb-3 font-medium text-right">민감도 (Beta)</th>
              <th className="pb-3 font-medium text-right">기본 PEG</th>
              <th className="pb-3 font-medium text-right text-[#deff9a]">시나리오 PEG</th>
              <th className="pb-3 font-medium text-center">매크로 위험도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 text-sm">
            {results.map(stock => (
              <tr key={stock.ticker} className="hover:bg-zinc-950/50 transition-colors">
                <td className="py-3.5 font-semibold">
                  <div className="flex flex-col">
                    <span>{stock.name ?? stock.ticker}</span>
                    <span className="text-xs text-zinc-500 font-mono font-normal">{stock.ticker}</span>
                  </div>
                </td>
                <td className="py-3.5">
                  <span className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">
                    {stock.category}
                  </span>
                </td>
                <td className="py-3.5 text-right font-mono text-zinc-300">
                  {stock.beta.toFixed(2)}
                </td>
                <td className="py-3.5 text-right font-mono text-zinc-400">
                  {stock.basePEG.toFixed(2)}
                </td>
                <td className={`py-3.5 text-right font-mono font-bold ${
                  stock.adjustedPEG > stock.basePEG ? 'text-rose-400'
                  : stock.adjustedPEG < stock.basePEG ? 'text-emerald-400'
                  : 'text-zinc-100'
                }`}>
                  {stock.adjustedPEG.toFixed(2)}
                </td>
                <td className="py-3.5 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stock.riskColor}`}>
                    {stock.riskLevel === '위험 고조'    && <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />}
                    {stock.riskLevel === '안전'         && <ShieldCheck   className="w-3 h-3 inline mr-1 mb-0.5" />}
                    {stock.riskLevel === '매크로 버팀목' && <Shield        className="w-3 h-3 inline mr-1 mb-0.5" />}
                    {stock.riskLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 코칭 인사이트 */}
      <div className="mt-6 p-4 bg-[#deff9a]/5 border border-[#deff9a]/20 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 text-[#deff9a] shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <span className="font-semibold text-zinc-100">투자학교 핵심 코칭 가이드:</span>{' '}
          금리 시뮬레이터를 올릴 때{' '}
          <span className="text-[#deff9a] font-semibold">Tempus AI</span>와{' '}
          <span className="text-[#deff9a] font-semibold">NVIDIA</span>의 시나리오 PEG 변동폭이 가장 큰
          이유를 학생들이 캐치하게 하십시오. 미래 현금흐름의 할인 계수(Beta)가 높은 고성장·턴어라운드
          섹터일수록 매크로 금리 상방 압력에 밸류에이션 훼손 리스크가 직관적으로 노출됨을 보여주는
          지표입니다.
        </div>
      </div>
    </div>
  )
}
