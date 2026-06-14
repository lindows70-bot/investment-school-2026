'use client'

/**
 * BuffettAnalysisPanel — 포트폴리오 연동 워렌 버핏 가치분석 패널
 *
 * 제1원칙: 학생의 실제 포트폴리오 종목을 사용 (하드코딩 없음)
 *
 * 데이터 흐름:
 *   investments(Supabase) → 종목 선택 → stock-info API 재무 데이터
 *   → DCF 초기값 자동 바인딩 → 슬라이더 조정 → 실시간 내재가치 연산
 */

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getAssetType } from '@/lib/assetClassifier'
import { calcDCF, deriveDcfInputs } from '@/lib/buffettDcf'

// ── Props 타입 ────────────────────────────────────────────────────────────────
interface Investment {
  id: string; ticker: string; name: string
  market?: string; currency?: string
  purchase_price: number; quantity: number
  lynch_category?: string | null
}

interface Fundamentals {
  pe?:              number | 'N/A' | null
  peg?:             number | 'N/A' | null
  earningsGrowth?:  number | null
  freeCashflow?:    number | null   // 연간 FCF (원시 통화: KR=원, US=USD)
  sharesOutstanding?: number | null // 유통주식수 (주)
  totalDebt?:       number | null   // 총부채 (원시 통화)
  totalCash?:       number | null   // 현금성자산 (원시 통화)
  marketCap?:       number | null   // 시가총액 (원시 통화)
  returnOnEquity?:  number | null
  grossMargins?:    number | null
  debtToEquity?:    number | null
  sector?:          string | null
  isEtf?:           boolean
}

export interface BuffettAnalysisPanelProps {
  investments: Investment[]
  // priceMap: currentPrice만 보장 (fundamentals 없어도 동작)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  priceMap:    Record<string, { currentPrice: number; [key: string]: any }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fundMap?:    Record<string, any>
}

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0e1a',
  card:     '#111827',
  card2:    '#0d1420',
  card3:    '#141928',
  border:   '#1e293b',
  green:    '#10b981',
  greenDim: 'rgba(16,185,129,0.08)',
  gold:     '#f59e0b',
  goldDim:  'rgba(245,158,11,0.10)',
  red:      '#ef4444',
  redDim:   'rgba(239,68,68,0.08)',
  blue:     '#60a5fa',
  text:     '#f1f5f9',
  sub:      '#94a3b8',
  low:      '#8599ae',
}

// ── 툴팁 컴포넌트 ─────────────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  FCF:  '기업이 번 돈 중 공장 투자 등을 빼고 주주에게 진짜 남는 "순수 현금"입니다.',
  WACC: '내가 이 주식에 기대하는 최소한의 연간 목표 수익률이자 위험 비용입니다.',
  TGR:  '5년 이후 기업이 GDP 성장률 수준으로 영원히 성장한다고 가정하는 기초 체력입니다.',
  MOS:  '버핏이 가장 강조한 개념으로, 진짜 가치 대비 현재 주가가 얼마나 싼지 나타내는 보호막입니다.',
  TV:   '5년 이후 발생할 모든 미래 현금흐름을 하나의 숫자로 압축한 "영구가치"입니다.',
  PV:   '미래에 받을 돈을 오늘의 가치로 환산한 금액입니다. 할인율이 높을수록 작아집니다.',
}

function InfoTip({ id }: { id: keyof typeof TOOLTIPS }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontSize: 11, color: C.low, marginLeft: 4, userSelect: 'none' }}>ℹ️</span>
      {show && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          width: 220, padding: '8px 10px', borderRadius: 8, zIndex: 999,
          background: '#1e293b', border: `1px solid ${C.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontSize: 11, color: C.sub, lineHeight: 1.6, fontWeight: 400,
          whiteSpace: 'normal',
        }}>
          {TOOLTIPS[id]}
        </span>
      )}
    </span>
  )
}

// ── DCF 연산 엔진은 @/lib/buffettDcf 로 추출(SSOT — 모닝스타 등급과 공유) ──

// ── 반원형 안전마진 게이지 ────────────────────────────────────────────────────
function SafetyGauge({ margin }: { margin: number }) {
  const clamp  = Math.max(-60, Math.min(100, margin))
  const range  = 160   // -60 ~ +100
  const deg    = ((clamp + 60) / range) * 180
  const rad    = (deg - 90) * (Math.PI / 180)
  const cx = 90, cy = 90, r = 68
  const nx = cx + r * 0.72 * Math.cos(rad)
  const ny = cy + r * 0.72 * Math.sin(rad)
  const color  = margin >= 30 ? C.green : margin >= 0 ? C.gold : C.red
  const perimeter = Math.PI * r

  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  // 각 구간 dash 계산
  const deg0  = ((60 / 160) * 180)   // 0% 위치 (60/160 * 180 = 67.5°)
  const deg30 = ((90 / 160) * 180)   // 30% 위치 (90/160 * 180 = 101.25°)

  const d0  = (deg0  / 180) * perimeter
  const d30 = (deg30 / 180) * perimeter
  const dNow = (Math.max(0, deg) / 180) * perimeter

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="180" height="106" viewBox="0 0 180 106" style={{ overflow: 'visible' }}>
        {/* 배경 */}
        <path d={arc} fill="none" stroke="#1e293b" strokeWidth={16} strokeLinecap="round" />
        {/* 구간별 색상 */}
        <path d={arc} fill="none" stroke={C.red}   strokeWidth={16} strokeOpacity={0.2} strokeLinecap="round"
          strokeDasharray={`${d0} ${perimeter}`} strokeDashoffset={0} />
        <path d={arc} fill="none" stroke={C.gold}  strokeWidth={16} strokeOpacity={0.2} strokeLinecap="round"
          strokeDasharray={`${d30 - d0} ${perimeter}`} strokeDashoffset={-d0} />
        <path d={arc} fill="none" stroke={C.green} strokeWidth={16} strokeOpacity={0.2} strokeLinecap="round"
          strokeDasharray={`${perimeter - d30} ${perimeter}`} strokeDashoffset={-d30} />
        {/* 현재 위치 채움 */}
        {margin > -60 && (
          <path d={arc} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round"
            strokeDasharray={`${dNow} ${perimeter}`} strokeDashoffset={0}
            style={{ filter: `drop-shadow(0 0 3px ${color})`, transition: 'stroke-dasharray 0.4s ease' }}
          />
        )}
        {/* 바늘 */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round"
          style={{ transition: 'all 0.4s ease' }} />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        {/* 눈금 */}
        <text x={cx - r - 4} y={cy + 16} fontSize={8} fill={C.low} textAnchor="middle">-60%</text>
        <text x={cx}          y={cy - 6}  fontSize={7} fill={C.gold} textAnchor="middle">0%</text>
        <text x={cx + r + 4} y={cy + 16} fontSize={8} fill={C.low} textAnchor="middle">+100%</text>
      </svg>
      <div style={{ marginTop: -10 }}>
        <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1,
          transition: 'color 0.3s' }}>
          {margin > -900 ? `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%` : 'N/A'}
        </div>
        <div style={{ fontSize: 10, color: C.sub, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          안전마진 (Margin of Safety) <InfoTip id="MOS" />
        </div>
      </div>
    </div>
  )
}

// ── 거장들의 인사이트 카드 ────────────────────────────────────────────────────
/**
 * 선택 종목의 특성(lynch_category, earningsGrowth, 안전마진)을 분석하여
 * 피터 린치 vs 워렌 버핏의 시각 차이를 교육적으로 설명하는 동적 카드
 *
 * 렌더링 조건 (OR):
 *   1. lynch_category === 'cyclical'  → 경기순환주 전용 카드
 *   2. earningsGrowth > 30% AND safetyMargin < 10%  → 고성장 + 버핏 보수 평가 괴리
 *   3. earningsGrowth < 0 AND safetyMargin < -20%   → 적자 전환 + 고평가 경고
 *   4. lynch_category === 'turnaround'               → 회생주 특수 카드
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InsightCard({ selected, fund, safetyMargin, g }: {
  selected: { name: string; lynch_category?: string | null } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fund: Record<string, any>
  safetyMargin: number
  g: number
}) {
  if (!selected) return null

  const cat = selected.lynch_category ?? 'na'
  const eg  = (() => {
    const raw = fund.earningsGrowth
    if (raw == null || !isFinite(raw)) return null
    return Math.abs(raw) < 5 ? raw * 100 : raw
  })()

  // ── 조건 판정 ─────────────────────────────────────────────────────────────
  const isCyclical  = cat === 'cyclical'
  const isTurnaround = cat === 'turnaround'
  const isGrowthVsValue = (eg != null && eg > 30) && safetyMargin < 10  // 고성장이지만 버핏은 보수적
  const isLossHighVal   = (eg != null && eg < 0)  && safetyMargin < -20 // 적자인데 고평가
  // 시장 프리미엄 고평가: DCF로 크게 비싸지만 위 케이스에 안 걸리는 우량주 (Eaton 등)
  const isPremiumOver   = safetyMargin < -50 && safetyMargin > -900
    && !isCyclical && !isTurnaround && !isGrowthVsValue && !isLossHighVal

  // 조건 중 하나도 해당 없으면 카드 렌더링 안 함
  if (!isCyclical && !isTurnaround && !isGrowthVsValue && !isLossHighVal && !isPremiumOver) return null

  // ── 카드 내용 결정 ────────────────────────────────────────────────────────
  const cards: {
    icon: string
    title: string
    body: string
    lynch: string
    buffett: string
    takeaway: string
    color: string
    borderColor: string
    bg: string
  }[] = []

  if (isCyclical) cards.push({
    icon: '🔄',
    title: '투자학교 학습 포인트: 왜 피터 린치와 워렌 버핏의 평가가 다를까요?',
    body: `${selected.name}은 설비투자(CAPEX) 지출이 많고 업황에 따라 이익 변동이 큰 '사이클 종목'입니다. 반도체·철강·조선처럼 호황기에 이익이 폭발하지만 불황기에는 대규모 적자로 전환하는 특성을 가집니다.`,
    lynch: '피터 린치는 현재의 폭발적인 이익 성장세(PEG)를 높게 평가합니다. 사이클 저점에서 매수해 고점에 매도하는 전략이 핵심이며, PBR이 역사적 바닥에 있을 때가 진짜 기회입니다.',
    buffett: '워렌 버핏의 DCF 모델은 매년 들어가는 막대한 설비 투자 비용과 과거 불황기 적자 기록을 5개년 평균에 반영하여 내재가치를 보수적으로 계산합니다. 버핏이 반도체 주식을 잘 사지 않는 이유입니다.',
    takeaway: '두 거장의 시각을 비교하며 본인의 투자 기간(단기 사이클 vs 장기 복리)을 명확히 설정해 보세요.',
    color: '#f59e0b',
    borderColor: 'rgba(245,158,11,0.35)',
    bg: 'rgba(245,158,11,0.06)',
  })

  if (isTurnaround) cards.push({
    icon: '🔥',
    title: '투자학교 학습 포인트: 회생주에서 DCF가 어려운 이유',
    body: `${selected.name}은 과거 적자나 위기를 겪고 회복 중인 '회생주'입니다. 미래 현금흐름 예측이 가장 어려운 유형으로, DCF 모델의 한계가 가장 크게 드러납니다.`,
    lynch: '피터 린치는 회생주에서 가장 큰 수익을 냈습니다. "망하지 않을 것"이라는 확신과 흑자전환 시점 포착이 핵심 — 부채비율과 이자보상배율을 먼저 확인하세요.',
    buffett: 'DCF 모델은 안정적인 현금흐름을 전제합니다. 회생주는 FCF가 음수이거나 불안정하므로, 슬라이더의 성장률을 매우 보수적으로 설정해야 신뢰할 수 있는 내재가치가 나옵니다.',
    takeaway: '린치 분석 탭에서 부채비율·이자보상배율·흑자전환 배지를 먼저 확인한 뒤 DCF를 보조 지표로 활용하세요.',
    color: '#fb923c',
    borderColor: 'rgba(251,146,60,0.35)',
    bg: 'rgba(251,146,60,0.06)',
  })

  if (isGrowthVsValue && !isCyclical && !isTurnaround) {
    // 성장률 케이스 3분기:
    //   abnormal(80%+): 적자→흑자 전환 기저효과
    //   clamped(g < eg ≤ 80): 실제 성장률이 DCF 적용 상한(35%)보다 높음 → 보수 적용 명시
    //   normal(eg ≤ g): 일반
    const abnormal = eg != null && eg > 80
    const clamped  = eg != null && !abnormal && eg > g
    cards.push({
      icon: '⚡',
      title: '투자학교 학습 포인트: 고성장주에서 DCF가 보수적으로 나오는 이유',
      body: abnormal
        ? `${selected.name}은 EPS 성장률이 ${eg!.toFixed(0)}%로 폭등했습니다. 이는 흑자전환 또는 낮은 작년 실적 기준에 의한 기저효과로, 영원히 지속될 수 없는 일시적 수치입니다. 따라서 DCF는 안정적 분석을 위해 보수적 성장률(${g}%)을 적용하며, 그 결과 안전마진이 ${safetyMargin.toFixed(1)}%로 나타납니다. 이것은 모순이 아닙니다.`
        : clamped
        ? `${selected.name}의 실제 EPS 성장률은 ${eg!.toFixed(0)}%로 매우 높지만, DCF는 과도한 낙관을 막기 위해 성장률 상한 ${g}%를 적용합니다(영원히 ${eg!.toFixed(0)}% 성장은 불가능하기 때문). 이 보수적 가정 탓에 내재가치가 낮게 잡혀 안전마진이 ${safetyMargin.toFixed(1)}%로 나타납니다. 모순이 아니라 "DCF의 보수성" 때문입니다.`
        : `${selected.name}은 EPS 성장률이 ${eg != null ? eg.toFixed(0) : g}%로 매우 높지만, DCF 안전마진은 ${safetyMargin.toFixed(1)}%로 낮습니다. 이것은 모순이 아닙니다.`,
      lynch: abnormal
        ? `피터 린치는 이익이 급증하는 기업을 PEG(성장 대비 PER)로 평가합니다. 폭발적 성장 직후엔 PER이 일시적으로 매우 높게 보이지만, 이익이 정상 궤도에 오르면 빠르게 낮아집니다. 분기 실적의 지속성을 확인하세요.`
        : `피터 린치는 성장률(${eg != null ? eg.toFixed(0) : g}%) 대비 PER을 보는 PEG 지표로 평가합니다. 실제 고성장이 지속된다면 현재 PER이 정당화되어 매수 신호일 수 있습니다.`,
      buffett: clamped
        ? `버핏의 DCF는 "영원히 지속 불가능한 고성장"을 신뢰하지 않습니다. 그래서 ${eg!.toFixed(0)}% 같은 폭발적 성장도 보수적으로 깎아 평가합니다. 핵심 질문은 "10년 후에도 이 경쟁 우위가 유지되는가?"입니다.`
        : `버핏의 DCF는 현재 FCF 기준으로 미래를 계산합니다. 현재 FCF가 낮은 고성장·흑자전환 초기 기업은 DCF로 저평가 신호가 잘 나오지 않습니다. 버핏이 말한 "10년 후에도 경쟁 우위가 유지되는가?"를 먼저 답하세요.`,
      takeaway: '성장주·회생주는 DCF보다 PEG + 경제적 해자(MOAT) 체크리스트를 우선 적용하는 것이 더 정확합니다.',
      color: '#60a5fa',
      borderColor: 'rgba(96,165,250,0.35)',
      bg: 'rgba(96,165,250,0.06)',
    })
  }

  if (isLossHighVal && !isCyclical && !isTurnaround) cards.push({
    icon: '⚠️',
    title: '투자학교 경고: 적자 기업 DCF 해석 주의',
    body: `${selected.name}은 현재 이익 성장률이 마이너스이며, DCF 분석에서도 고평가(안전마진 ${safetyMargin.toFixed(1)}%)로 나타납니다.`,
    lynch: '린치는 "주가가 반토막 나도 흔들리지 않을 확신이 없다면 사지 마라"고 경고했습니다. 적자 기업은 흑자전환 시점이 핵심 — 턴어라운드 스토리가 설득력 있는지 확인하세요.',
    buffett: '버핏은 이익을 내지 못하는 기업에는 거의 투자하지 않습니다. 현재 FCF가 음수라면 DCF 슬라이더의 FCF₀를 미래 예상치로 조정해야 의미 있는 분석이 가능합니다.',
    takeaway: '적자 기업은 린치 밸류에이션 탭의 "회생주" 프레임워크를 먼저 적용하세요.',
    color: '#f87171',
    borderColor: 'rgba(248,113,113,0.35)',
    bg: 'rgba(248,113,113,0.06)',
  })

  if (isPremiumOver) cards.push({
    icon: '💎',
    title: '투자학교 학습 포인트: DCF로 고평가? "시장 프리미엄"의 의미',
    body: `${selected.name}의 DCF 내재가치가 현재 주가보다 크게 낮게(안전마진 ${safetyMargin.toFixed(0)}%) 나왔습니다. 이는 계산 오류가 아니라, 시장이 이 기업의 미래 성장·안정성에 높은 프리미엄을 부여하고 있다는 뜻입니다. (전력인프라·AI·헬스케어 등 메가트렌드 수혜주에서 흔합니다)`,
    lynch: '피터 린치도 "훌륭한 우량 기업은 항상 비싸 보인다"고 했습니다. 시장이 미래 가치를 미리 반영하여 PER이 높게 형성되므로, 성장의 지속 가능성을 확인하는 것이 핵심입니다.',
    buffett: '버핏의 DCF는 현재 FCF와 보수적 성장률만 반영하는 "안전 하한선"입니다. 시장의 성장 기대를 담지 못하므로, 좋은 기업이라도 DCF로는 비싸게 나옵니다. 버핏은 이런 주식을 워치리스트에 담고 적정가를 기다립니다.',
    takeaway: 'DCF 고평가 = 즉시 매도가 아닙니다. 경제적 해자가 튼튼하면 주가 조정 시 분할 매수를 고려하세요.',
    color: '#c084fc',
    borderColor: 'rgba(192,132,252,0.35)',
    bg: 'rgba(192,132,252,0.06)',
  })

  if (cards.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cards.map((card, idx) => (
        <div key={idx} style={{
          borderRadius: 14,
          background: card.bg,
          border: `1px solid ${card.borderColor}`,
          overflow: 'hidden',
          boxShadow: `0 0 24px ${card.bg}`,
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${card.borderColor}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: card.color, lineHeight: 1.4 }}>
                💡 {card.title}
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 배경 설명 */}
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              {card.body}
            </div>

            {/* 린치 vs 버핏 2단 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* 피터 린치 */}
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>📈</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>피터 린치의 시각</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                  {card.lynch}
                </div>
              </div>

              {/* 워렌 버핏 */}
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>🛡️</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>워렌 버핏의 시각</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
                  {card.buffett}
                </div>
              </div>
            </div>

            {/* 핵심 takeaway */}
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: `${card.color}12`, border: `1px solid ${card.borderColor}`,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🎯</span>
              <div style={{ fontSize: 11, fontWeight: 700, color: card.color, lineHeight: 1.6 }}>
                {card.takeaway}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function BuffettAnalysisPanel({
  investments, priceMap, fundMap = {},
}: BuffettAnalysisPanelProps) {

  // ── 개별 주식 전용 필터링 — 3중 방어막 ─────────────────────────────────────
  //
  // 1차: getAssetType() SSOT — 시장코드·티커·종목명 기반 분류
  // 2차: fundMap[key]?.isEtf — stock-info API가 ETF로 판정한 경우
  // 3차: 명시적 키워드 블랙리스트 — 종목명/티커에 ETF·CRYPTO·COMMODITY 키워드
  //
  // 이렇게 3중으로 방어해야 SSOT가 놓친 엣지케이스(이름이 짧거나 DB에 티커만 저장된 경우)를 커버
  const stocks = useMemo(() => {
    const seen = new Map<string, Investment>()

    // 명시적 제외 키워드 (종목명 대문자 포함 여부)
    const EXCLUDE_NAME_KW = [
      'ETF', 'INDEX', 'FUND', 'TRUST', '인덱스', '지수',
      'BITCOIN', 'ETHEREUM', 'CRYPTO', '코인',
      'GOLD', 'SILVER', 'OIL', '원자재', 'COMMODITY',
      'SPROTT', 'PHYSICAL', 'FUTURES',
    ]
    // 명시적 제외 티커 패턴 (시작 문자 기반)
    const CRYPTO_PREFIX = ['BTC','ETH','XRP','SOL','DOGE','ADA']

    investments.forEach(inv => {
      const key    = inv.ticker.toUpperCase()
      const nameU  = (inv.name ?? '').toUpperCase()
      const mktU   = (inv.market ?? 'US').toUpperCase()

      // ─ 1차: SSOT 분류 ─
      const assetType = getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US')
      if (assetType !== 'STOCK') return

      // ─ 2차: fundMap isEtf 플래그 ─
      if (fundMap[key]?.isEtf === true) return

      // ─ 3차: 시장 코드 명시 제외 ─
      if (mktU === 'CRYPTO') return

      // ─ 4차: 종목명 키워드 블랙리스트 ─
      if (EXCLUDE_NAME_KW.some(kw => nameU.includes(kw))) return

      // ─ 5차: 암호화폐 티커 패턴 ─
      if (CRYPTO_PREFIX.some(prefix => key.startsWith(prefix) && key.length <= 6)) return

      if (!seen.has(key)) seen.set(key, inv)
    })
    return Array.from(seen.values())
  }, [investments, fundMap])

  // 전체 대비 제외된 종목 수 (안내 문구용)
  const excludedCount = investments.length - stocks.length

  const [selectedTicker, setSelectedTicker] = useState('')
  const [showCalc,       setShowCalc]       = useState(false)  // 아코디언

  // 선택 종목
  const selected = useMemo(() => {
    const key = selectedTicker || stocks[0]?.ticker
    return stocks.find(s => s.ticker === key) ?? stocks[0] ?? null
  }, [stocks, selectedTicker])

  // 재무 데이터 수집
  const fund = useMemo((): Fundamentals => {
    if (!selected) return {}
    const key = selected.ticker.toUpperCase()
    const f1 = fundMap[key] ?? {}
    const f2 = (priceMap[key]?.fundamentals ?? {}) as Fundamentals
    return { ...f2, ...f1 }  // fundMap 우선
  }, [selected, fundMap, priceMap])

  const currentPrice = useMemo(() => {
    if (!selected) return 0
    return priceMap[selected.ticker.toUpperCase()]?.currentPrice ?? selected.purchase_price
  }, [selected, priceMap])

  // ── 자동 DCF 입력값 산출 (원시 통화 기준, 슬라이더 없이 100% 자동) ──────────
  // 우선순위: Yahoo 실데이터 → 추정 → 카테고리 기본값
  const auto = useMemo(() => deriveDcfInputs(fund, {
    market: selected?.market, currency: selected?.currency,
    lynchCategory: selected?.lynch_category, currentPrice,
  }), [fund, selected, currentPrice])

  // 표시용 변수 (기존 UI 변수명 호환 유지)
  const g = auto.g, r = auto.r

  // ── DCF 연산 (자동, 원시 통화) ─────────────────────────────────────────────
  const result = useMemo(() =>
    calcDCF(auto.fcf0 ?? 0, auto.g, auto.r, auto.gp, auto.netDebt, auto.shares ?? 0, currentPrice),
    [auto, currentPrice]
  )

  // ── 통화별 금액 포맷 (원시 통화값 입력) ────────────────────────────────────
  const fmtMoney = (raw: number) => {
    if (!isFinite(raw)) return '—'
    const a = Math.abs(raw), sign = raw < 0 ? '-' : ''
    if (auto.isKr) {
      if (a >= 1e12) return `${sign}₩${(a/1e12).toFixed(1)}조`
      if (a >= 1e8)  return `${sign}₩${(a/1e8).toFixed(0)}억`
      return `${sign}₩${Math.round(a).toLocaleString('ko-KR')}`
    }
    if (a >= 1e9) return `${sign}$${(a/1e9).toFixed(1)}B`
    if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(0)}M`
    return `${sign}$${Math.round(a).toLocaleString('en-US')}`
  }
  const fmtSharePrice = (raw: number) =>
    !isFinite(raw) || raw <= 0 ? '—'
    : auto.isKr ? `₩${Math.round(raw).toLocaleString('ko-KR')}`
    : `$${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ── DCF 분석 가능 여부 + 불가 이유 구분 ────────────────────────────────────
  // 어떤 종목이 들어와도 안전하게 처리: NaN/Infinity/극단값 + 적자 방어 포함
  //
  // ★ 핵심 기준은 '순이익 적자(ROE < 0)'입니다 (FCF 음수 ≠ 적자).
  //   흑자 기업이 일시적으로 FCF가 음수(보험사·대규모 CapEx)인 경우는 정상 분석(추정),
  //   순이익 자체가 적자(파두 -89%, PLUG -128%)면 DCF 부적합 → 분석불가.
  const netIncomeLoss = fund.returnOnEquity != null && isFinite(fund.returnOnEquity) && fund.returnOnEquity < 0
  const dcfUnavailable =
    !auto.ok
    || !isFinite(auto.fcf0 ?? 0) || (auto.fcf0 ?? 0) <= 0
    || !isFinite(result.intrinsicPerShare) || result.intrinsicPerShare <= 0
    || !isFinite(result.safetyMargin) || result.safetyMargin <= -900
    || netIncomeLoss    // 순이익 적자 (ROE < 0) — DCF 부적합

  // 불가 이유: 'loss'(적자) vs 'nodata'(데이터 부족) — 메시지·대안을 다르게 안내
  const dcfReason: 'loss' | 'nodata' = (() => {
    const roeNeg = fund.returnOnEquity != null && isFinite(fund.returnOnEquity) && fund.returnOnEquity < 0
    const fcfNeg = fund.freeCashflow   != null && isFinite(fund.freeCashflow)   && fund.freeCashflow < 0
    // 적자 신호(음수 ROE/FCF)가 있으면 'loss', 단순히 데이터가 없으면 'nodata'
    return (roeNeg || fcfNeg) ? 'loss' : 'nodata'
  })()

  // 안전마진 등급
  const smGrade = dcfUnavailable
    ? {
        label: dcfReason === 'loss'
          ? '⚪ DCF 분석 불가 — 적자 기업'
          : '⚪ DCF 분석 불가 — 재무 데이터 부족',
        color: C.sub, bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.35)',
      }
    : result.safetyMargin >= 30
    ? { label: '🟢 탁월한 가격 — 즉시 매수권', color: C.green, bg: C.greenDim, border: 'rgba(16,185,129,0.3)' }
    : result.safetyMargin >= 0
      ? { label: '🟡 적정 가격 — 신중 검토', color: C.gold, bg: C.goldDim, border: 'rgba(245,158,11,0.3)' }
      : { label: '🔴 고평가 — 매수 신중', color: C.red, bg: C.redDim, border: 'rgba(239,68,68,0.3)' }

  // 차트 데이터
  // 차트 단위 정규화: KR=억원, US=백만달러
  const chartUnit  = auto.isKr ? 1e8 : 1e6
  const chartLabel = auto.isKr ? '억원' : 'M$'
  const chartData = useMemo(() =>
    result.rows.map(row => ({
      year: `${row.year}년`,
      fcf: parseFloat((row.fcf / chartUnit).toFixed(1)),
      pv:  parseFloat((row.pv  / chartUnit).toFixed(1)),
    })),
    [result, chartUnit]
  )

  // ── 경제적 해자 5개 항목 100% 자동 판정 (수동 입력 완전 제거) ──────────────
  // 실데이터 우선 → 없으면 린치 카테고리·섹터 기반 reasonable 추정
  const LYNCH_KR: Record<string, string> = {
    fast_grower: '고성장주', stalwart: '대형우량주', slow_grower: '저성장주',
    cyclical: '경기순환주', turnaround: '회생주', asset_play: '자산주', na: '미분류',
  }
  const moatAuto = useMemo(() => {
    const cat    = selected?.lynch_category ?? 'na'
    const sector = (fund.sector ?? '').toLowerCase()

    // ① ROE — 실데이터 우선, 없으면 카테고리 추정
    const roeReal = (fund.returnOnEquity != null && isFinite(fund.returnOnEquity))
      ? (Math.abs(fund.returnOnEquity) < 2 ? fund.returnOnEquity * 100 : fund.returnOnEquity)
      : null
    const catRoe: Record<string, number> = {
      fast_grower: 19, stalwart: 17, slow_grower: 13, cyclical: 11, turnaround: 9, asset_play: 10, na: 12,
    }
    const roeVal = roeReal ?? (catRoe[cat] ?? 12)

    // ② 매출총이익률 — 실데이터 우선, 없으면 섹터 추정
    const gmReal = (fund.grossMargins != null && isFinite(fund.grossMargins))
      ? (Math.abs(fund.grossMargins) < 2 ? fund.grossMargins * 100 : fund.grossMargins)
      : null
    const secGm = (() => {
      if (/(tech|반도체|소프트|it서비스|전자)/.test(sector)) return 48
      if (/(health|bio|제약|바이오|헬스)/.test(sector))      return 55
      if (/(communic|통신|미디어|방송|엔터)/.test(sector))   return 45
      if (/(financ|금융|은행|보험|증권)/.test(sector))       return 52
      if (/(consumer|소비|음식|식품)/.test(sector))          return 38
      if (/(industri|산업|방산|조선|기계|건설)/.test(sector)) return 28
      if (/(energy|에너지|material|소재|화학|철강)/.test(sector)) return 25
      return 33
    })()
    const gmVal = gmReal ?? secGm

    // ③ 재무 안전성 — 순부채 ≤ 0(순현금) 또는 시총 대비 부채 적정
    //    대형 우량주는 부채를 보유하는 게 정상 → 시총의 40% 미만이면 안전
    //    (Eaton처럼 순부채 $21B여도 시총 $155B 대비 13%면 매우 건전)
    const mcForDebt = (typeof fund.marketCap === 'number' && fund.marketCap > 0) ? fund.marketCap : null
    const debtPass =
      auto.netDebt <= 0
      || (mcForDebt != null && auto.netDebt < mcForDebt * 0.4)
      || (auto.fcf0 != null && auto.fcf0 > 0 && auto.netDebt < auto.fcf0 * 8)

    // ④ 브랜드/특허/네트워크 해자
    //    안정적·성장 카테고리 OR 높은 ROE(18%+)는 경쟁우위의 실증적 증거
    //    (SK하이닉스 HBM처럼 경기순환주여도 ROE가 높으면 명백한 기술 해자)
    const brandPass = ['stalwart', 'slow_grower', 'fast_grower'].includes(cat) || roeVal >= 18

    // ⑤ 소비자 고착성
    //    섹터 매칭 OR 고마진(45%+, 가격결정력 = 고착성의 증거) OR 안정 카테고리
    const stickyPass =
      /(tech|반도체|소프트|health|bio|제약|communic|통신|financ|금융|consumer|소비)/.test(sector)
      || gmVal >= 45
      || ['stalwart', 'fast_grower'].includes(cat)

    const items = [
      { key: 'roe',    icon: '📈', label: 'ROE > 15%',          pass: roeVal > 15, actual: `${roeVal.toFixed(1)}%`,  src: roeReal != null ? 'real' : 'est', desc: '자기자본이익률 — 돈 버는 효율' },
      { key: 'gm',     icon: '💰', label: '매출총이익률 > 40%',  pass: gmVal > 40,  actual: `${gmVal.toFixed(0)}%`,   src: gmReal != null ? 'real' : 'est',  desc: '가격을 올려도 팔리는 힘' },
      { key: 'debt',   icon: '🏦', label: '재무 안전성 (저부채)', pass: debtPass,
        actual: auto.netDebt <= 0 ? '순현금 보유' : (mcForDebt != null ? `부채 ${(auto.netDebt / mcForDebt * 100).toFixed(0)}% (시총比)` : '부채 적정'),
        src: 'real', desc: '위기를 버텨낼 재무 체력' },
      { key: 'brand',  icon: '⭐', label: '브랜드·특허 해자',     pass: brandPass,
        actual: ['stalwart','slow_grower','fast_grower'].includes(cat) ? (LYNCH_KR[cat] ?? '미분류') : (roeVal >= 18 ? `고ROE ${roeVal.toFixed(0)}%` : (LYNCH_KR[cat] ?? '미분류')),
        src: 'auto', desc: '경쟁자가 못 따라오는 장벽' },
      { key: 'sticky', icon: '🔄', label: '소비자 고착성',        pass: stickyPass,
        actual: fund.sector ?? (gmVal >= 45 ? `고마진 ${gmVal.toFixed(0)}%` : '업종 정보 없음'),
        src: 'auto', desc: '한번 쓰면 바꾸기 어려움' },
    ]
    const score = items.filter(i => i.pass).length
    return { items, score, roeVal, gmVal, roeReal: roeReal != null, gmReal: gmReal != null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, fund, auto])

  const moatScore = moatAuto.score
  // 상단 요약 바 표시용
  const roeOk = moatAuto.roeVal > 15
  const gmOk  = moatAuto.gmVal > 40
  const roe디스플 = `${moatAuto.roeVal.toFixed(1)}%${moatAuto.roeReal ? '' : '*'}`
  const gm디스플  = `${moatAuto.gmVal.toFixed(0)}%${moatAuto.gmReal ? '' : '*'}`

  // 빈 포트폴리오
  if (stocks.length === 0) return (
    <div style={{
      padding: '48px 24px', borderRadius: 14, textAlign: 'center',
      background: C.card, border: `1px dashed ${C.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{ fontSize: 36 }}>🏰</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
        DCF 분석 가능한 개별 주식이 없습니다
      </div>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7, maxWidth: 440 }}>
        {investments.length > 0
          ? `현재 포트폴리오 ${investments.length}개 종목 중 ETF·코인·원자재만 보유 중입니다.\n자산관리 탭에서 개별 주식을 추가하면 버핏 DCF 분석이 시작됩니다.`
          : '자산관리 탭에서 개별 주식을 추가하면 버핏 DCF 분석이 시작됩니다.'
        }
      </div>
      {/* 필터링 안내 */}
      <div style={{
        padding: '10px 16px', borderRadius: 8, maxWidth: 460,
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
        fontSize: 11, color: C.low, lineHeight: 1.7, textAlign: 'left',
      }}>
        ※ 워렌 버핏의 가치창출 및 DCF 분석 철학에 따라, 현금흐름이 발생하지 않는
        <strong style={{ color: C.sub }}> ETF, 원자재, 암호화폐</strong> 자산은 분석 대상에서 제외됩니다.
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 + 종목 선택 ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px', borderRadius: 14,
        background: 'linear-gradient(135deg, #052e16 0%, #064e3b 60%, #065f46 100%)',
        border: '1px solid rgba(16,185,129,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>DCF 내재가치 분석기</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(16,185,129,0.15)', color: C.green, fontWeight: 700 }}>
              Warren Buffett Method
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#a7f3d0', lineHeight: 1.6 }}>
            성장률↑ → 내재가치↑ &nbsp;|&nbsp; 할인율↑ → 내재가치↓ &nbsp;—&nbsp;
            슬라이더를 조정하며 <strong style={{ color: '#6ee7b7' }}>가치평가의 수학적 원리</strong>를 체험하세요
          </div>
        </div>

        {/* 종목 선택 드롭다운 + 안내 문구 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.low, whiteSpace: 'nowrap' }}>분석 종목</span>
            <select
              value={selectedTicker || (stocks[0]?.ticker ?? '')}
              onChange={e => setSelectedTicker(e.target.value)}
              style={{
                padding: '8px 32px 8px 12px', borderRadius: 8,
                background: '#0d2818', border: '1px solid rgba(16,185,129,0.3)',
                color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none',
                minWidth: 180,
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
              }}
            >
              {stocks.map(s => (
                <option key={s.ticker} value={s.ticker}>
                  {(s.name ?? s.ticker).length > 18 ? (s.name ?? s.ticker).slice(0, 17) + '…' : (s.name ?? s.ticker)} ({s.ticker})
                </option>
              ))}
            </select>
          </div>

          {/* 필터링 안내 문구 */}
          <div style={{
            fontSize: 9, color: C.low, lineHeight: 1.5, maxWidth: 280, textAlign: 'right',
          }}>
            {excludedCount > 0 && (
              <span style={{ color: '#7a8fa3', marginRight: 4 }}>
                ({excludedCount}개 ETF·코인·원자재 제외됨)
              </span>
            )}
            ※ 워렌 버핏의 현금흐름(DCF) 분석 철학에 따라, 개별 주식 종목만 분석이 가능합니다. (ETF/원자재/암호화폐 제외)
          </div>
        </div>
      </div>

      {/* ── 선택 종목 요약 바 ────────────────────────────────────────────── */}
      {selected && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          padding: '12px 16px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.text }}>{selected.name}</div>
            <div style={{ fontSize: 10, color: C.low, fontFamily: 'monospace' }}>
              {selected.ticker} · {selected.market}
              {fund.sector && <span style={{ marginLeft: 6, color: C.sub }}>{fund.sector}</span>}
            </div>
          </div>
          {[
            { label: '현재 주가', val: fmtSharePrice(currentPrice), color: C.blue },
            { label: 'ROE', val: roe디스플, color: roeOk ? C.green : C.sub },
            { label: '매출총이익률', val: gm디스플, color: gmOk ? C.green : C.sub },
            { label: 'FCF', val: fmtMoney(auto.fcf0 ?? 0), color: C.gold },
          ].map(item => (
            <div key={item.label} style={{
              padding: '7px 12px', borderRadius: 8, textAlign: 'center',
              background: C.card2, border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 9, color: C.low, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 2단 메인 레이아웃 ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ════ 좌측: 미래 현금흐름 시뮬레이터 ════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 자동 분석 입력값 카드 (읽기 전용 — 실데이터 자동 바인딩) */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.green }}>
                🤖 자동 분석된 미래 현금흐름 가정
              </div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 800,
                background: 'rgba(16,185,129,0.12)', color: C.green, border: '1px solid rgba(16,185,129,0.3)' }}>
                AUTO
              </span>
            </div>

            {!auto.ok && (
              <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                background: C.redDim, border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: C.red, lineHeight: 1.6 }}>
                ⚠ 이 종목은 잉여현금흐름·유통주식수 데이터가 부족하여 자동 분석 정확도가 낮을 수 있습니다.
              </div>
            )}

            {/* 읽기 전용 메트릭 행들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {([
                { label: '향후 5개년 FCF 성장률', tip: 'FCF' as const, val: `${auto.g}%`, src: auto.gSrc, color: C.green },
                { label: '할인율 (WACC / 요구수익률)', tip: 'WACC' as const, val: `${auto.r}%`, src: 'auto' as const, color: C.blue },
                { label: '잉여현금흐름 (FCF₀)', tip: 'FCF' as const, val: fmtMoney(auto.fcf0 ?? 0), src: auto.fcfSrc, color: C.gold },
                { label: '유통주식수', tip: null, val: auto.shares ? (auto.isKr ? `${(auto.shares/1e8).toFixed(2)}억 주` : `${(auto.shares/1e6).toFixed(0)}백만 주`) : '—', src: auto.sharesSrc, color: C.sub },
                { label: '순부채 (총부채 − 현금)', tip: null, val: fmtMoney(auto.netDebt), src: auto.netDebtSrc, color: auto.netDebt > 0 ? C.red : C.green },
              ]).map(item => {
                const srcBadge = item.src === 'real' ? { t: '실데이터', c: C.green }
                  : item.src === 'est' ? { t: '자동추정', c: C.gold }
                  : item.src === 'auto' ? { t: '자동설정', c: C.blue }
                  : { t: '없음', c: C.low }
                return (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, background: C.card2, marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>{item.label}</span>
                      {item.tip && <InfoTip id={item.tip} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                        color: srcBadge.c, background: `${srcBadge.c}18` }}>
                        {srcBadge.t}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: item.color, fontFamily: 'monospace', minWidth: 70, textAlign: 'right' }}>
                        {item.val}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 영구 성장률 고정 표시 */}
            <div style={{
              marginTop: 6, padding: '10px 12px', borderRadius: 8,
              background: C.card2, border: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: C.sub }}>
                영구 성장률 (Terminal Growth Rate) <InfoTip id="TGR" />
              </div>
              <span style={{ color: C.green, fontWeight: 700, fontFamily: 'monospace' }}>{auto.gp}% 고정</span>
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: C.low, lineHeight: 1.6 }}>
              ℹ️ Yahoo Finance 실시간 재무데이터를 자동 수집하여 분석합니다. 슬라이더 조작 없이 종목만 선택하세요.
            </div>
          </div>

          {/* 아코디언: 수학적 연산 과정 */}
          <div style={{ borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowCalc(v => !v)}
              style={{
                width: '100%', padding: '13px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>
                📐 수학적 연산 과정 보기 (1~5년차 FCF + PV)
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.low} strokeWidth="2" strokeLinecap="round"
                style={{ transform: showCalc ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCalc && (
              <div style={{ padding: '0 18px 16px' }}>
                {/* 테이블 헤더 */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr', gap: 4,
                  padding: '7px 10px', borderRadius: 6, background: C.card2,
                  fontSize: 9, fontWeight: 700, color: C.low, letterSpacing: '0.07em', marginBottom: 4,
                }}>
                  <span>연도</span>
                  <span style={{ textAlign: 'right' }}>추정 FCF <InfoTip id="FCF" /></span>
                  <span style={{ textAlign: 'right' }}>할인 계수</span>
                  <span style={{ textAlign: 'right' }}>PV <InfoTip id="PV" /></span>
                  <span style={{ textAlign: 'right' }}>누적 PV</span>
                </div>

                {result.rows.map((row, i) => (
                  <div key={row.year} style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr', gap: 4,
                    padding: '7px 10px', borderRadius: 5, fontSize: 11,
                    background: i % 2 === 0 ? 'transparent' : C.card2,
                  }}>
                    <span style={{ color: C.low, fontFamily: 'monospace' }}>Y{row.year}</span>
                    <span style={{ textAlign: 'right', color: C.blue, fontFamily: 'monospace', fontWeight: 700 }}>
                      {fmtMoney(row.fcf)}
                    </span>
                    <span style={{ textAlign: 'right', color: C.low, fontFamily: 'monospace' }}>
                      {`÷${Math.pow(1 + r / 100, row.year).toFixed(2)}`}
                    </span>
                    <span style={{ textAlign: 'right', color: C.gold, fontFamily: 'monospace' }}>
                      {fmtMoney(row.pv)}
                    </span>
                    <span style={{ textAlign: 'right', color: C.sub, fontFamily: 'monospace' }}>
                      {fmtMoney(row.cumPv)}
                    </span>
                  </div>
                ))}

                {/* TV 행 */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr', gap: 4,
                  padding: '8px 10px', borderRadius: 6,
                  background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.15)`,
                  marginTop: 4, fontSize: 11,
                }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>TV</span>
                  <span style={{ textAlign: 'right', color: C.green, fontFamily: 'monospace' }}>
                    {fmtMoney(result.terminalValue)}
                  </span>
                  <span style={{ textAlign: 'right', color: C.low, fontSize: 9 }}>
                    FCF₅×(1+gp)/(r-gp)
                  </span>
                  <span style={{ textAlign: 'right', color: C.green, fontFamily: 'monospace', fontWeight: 700 }}>
                    {fmtMoney(result.tvPV)}
                  </span>
                  <span style={{ textAlign: 'right', color: C.low, fontSize: 9 }}>
                    TV÷(1+r)⁵
                  </span>
                </div>

                {/* 합계 */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8,
                  padding: '10px', background: C.card2, borderRadius: 8, fontSize: 11,
                }}>
                  {[
                    { label: '5년 PV 합', val: fmtMoney(result.pvSum), color: C.blue },
                    { label: '+ TV PV',   val: fmtMoney(result.tvPV),  color: C.green },
                    { label: '= 기업가치', val: fmtMoney(result.enterpriseValue), color: C.text },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.low, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: item.color }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FCF vs PV 막대차트 */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 10 }}>
              📊 추정 FCF vs 할인 현재가치(PV) 비교
            </div>
            {dcfUnavailable ? (
              <div style={{
                height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, textAlign: 'center',
              }}>
                <div style={{ fontSize: 26 }}>📉</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>
                  {dcfReason === 'loss' ? '현금흐름이 적자라 차트를 표시할 수 없습니다' : '재무 데이터 부족으로 차트를 표시할 수 없습니다'}
                </div>
                <div style={{ fontSize: 10, color: C.low, lineHeight: 1.6, maxWidth: 320 }}>
                  {dcfReason === 'loss'
                    ? <>{selected?.name}은 잉여현금흐름(FCF)이 적자입니다.<br />적자 성장기업은 DCF 대신 매출 성장률·P/S 기반 분석이 적합합니다.</>
                    : <>{selected?.name}의 핵심 재무 데이터를 가져오지 못했습니다.<br />경제적 해자와 PEG로 분석을 보완하세요.</>}
                </div>
              </div>
            ) : (
            <div style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: C.low, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.low, fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 10000 ? `${(v/10000).toFixed(0)}만` : `${v.toFixed(0)}`} width={44} />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                        <div style={{ color: C.sub, marginBottom: 4 }}>{label}</div>
                        {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                          <div key={i} style={{ color: p.color, fontFamily: 'monospace' }}>
                            {p.name}: {p.value.toLocaleString()}{chartLabel}
                          </div>
                        ))}
                      </div>
                    )
                  }} />
                  <Bar dataKey="fcf" name="추정 FCF" radius={[3,3,0,0]} maxBarSize={24}>
                    {chartData.map((_, i) => <Cell key={i} fill={C.blue} fillOpacity={0.7} />)}
                  </Bar>
                  <Bar dataKey="pv" name="PV (할인후)" radius={[3,3,0,0]} maxBarSize={24}>
                    {chartData.map((_, i) => <Cell key={i} fill={C.gold} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
            {!dcfUnavailable && (
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 4, fontSize: 9, color: C.low }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 10, height: 8, borderRadius: 2, background: C.blue, display: 'inline-block' }} /> 추정 FCF
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 10, height: 8, borderRadius: 2, background: C.gold, display: 'inline-block' }} /> PV (할인후)
              </span>
            </div>
            )}
          </div>
        </div>

        {/* ════ 우측: 버핏 최종 판독 런웨이 ═══════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 안전마진 게이지 카드 */}
          <div style={{
            padding: '20px 18px', borderRadius: 12, background: C.card,
            border: `1px solid ${smGrade.border}`,
            boxShadow: `0 0 24px ${smGrade.bg}`,
          }}>
            <div style={{ fontSize: 11, color: C.low, letterSpacing: '0.08em', fontWeight: 700, marginBottom: 14 }}>
              버핏의 최종 판독 런웨이
            </div>

            {/* 반원형 게이지 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <SafetyGauge margin={result.safetyMargin} />
            </div>

            {/* 등급 배지 */}
            <div style={{
              padding: '10px', borderRadius: 10, textAlign: 'center',
              background: smGrade.bg, border: `1px solid ${smGrade.border}`,
              fontSize: 13, fontWeight: 900, color: smGrade.color, marginBottom: 14,
              transition: 'all 0.3s',
            }}>
              {smGrade.label}
            </div>

            {/* 가격 비교 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '📍 현재 주가', val: fmtSharePrice(currentPrice), color: C.sub },
                {
                  label: '🎯 DCF 내재가치/주',
                  val: result.intrinsicPerShare > 0 ? fmtSharePrice(result.intrinsicPerShare) : 'N/A',
                  color: smGrade.color,
                },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '10px 12px', borderRadius: 8, textAlign: 'center',
                  background: C.card2, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 9, color: C.low, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>

            {/* 가치 분해 요약 */}
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: C.card2, border: `1px solid ${C.border}`, fontSize: 11 }}>
              {[
                { label: '5개년 PV 합계', val: fmtMoney(result.pvSum), color: C.blue },
                { label: <span>Terminal Value PV <InfoTip id="TV" /></span>, val: fmtMoney(result.tvPV), color: C.green },
                { label: '(−) 순부채', val: `${auto.netDebt >= 0 ? '-' : '+'}${fmtMoney(Math.abs(auto.netDebt))}`, color: auto.netDebt > 0 ? C.red : C.green },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                  paddingBottom: i < 2 ? 5 : 0, borderBottom: i < 2 ? `1px solid ${C.border}44` : 'none',
                  marginBottom: i < 2 ? 5 : 0, color: C.sub }}>
                  <span>{item.label}</span>
                  <span style={{ color: item.color, fontFamily: 'monospace', fontWeight: 700 }}>{item.val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6,
                borderTop: `1px solid ${C.border}`, color: C.text }}>
                <span style={{ fontWeight: 700 }}>주주가치 (Equity Value)</span>
                <span style={{ color: smGrade.color, fontFamily: 'monospace', fontWeight: 900 }}>
                  {fmtMoney(result.equityValue)}
                </span>
              </div>
            </div>

            {/* TV(영구가치) 의존도 경고 — 75% 초과 시 */}
            {result.enterpriseValue > 0 && (result.tvPV / result.enterpriseValue) > 0.75 && (
              <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
                fontSize: 10, color: C.gold, lineHeight: 1.6,
              }}>
                ⚠️ 내재가치의 <strong>{((result.tvPV / result.enterpriseValue) * 100).toFixed(0)}%</strong>가 5년 후 &lsquo;영구가치(Terminal Value)&rsquo;에서 나옵니다.
                고성장 가정이 낙관적이면 내재가치가 과대평가될 수 있으니, <strong style={{ color: C.gold }}>성장의 지속 가능성</strong>을 반드시 확인하세요.
              </div>
            )}
          </div>

          {/* 경제적 해자 검증 카드 — 100% 자동 판정 */}
          <div style={{ padding: '16px 18px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: C.green }}>🏰 경제적 해자(Economic Moat) 검증</span>
                  <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 20, fontWeight: 800,
                    background: 'rgba(16,185,129,0.12)', color: C.green, border: '1px solid rgba(16,185,129,0.3)' }}>
                    AUTO
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.low, marginTop: 1 }}>재무·업종 데이터로 자동 판정 (입력 불필요)</div>
              </div>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: moatScore >= 4 ? C.greenDim : moatScore >= 2 ? C.goldDim : C.redDim,
                border: `2px solid ${moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900,
                color: moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red,
              }}>
                {moatScore}/5
              </div>
            </div>

            {/* 자동 판정 5개 항목 */}
            {moatAuto.items.map(item => {
              const srcBadge = item.src === 'real' ? { t: '실데이터', c: C.green }
                : item.src === 'est' ? { t: '업종추정', c: C.gold }
                : { t: '자동판정', c: C.blue }
              return (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8, marginBottom: 6,
                  background: item.pass ? C.greenDim : C.redDim,
                  border: `1px solid ${item.pass ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    background: item.pass ? C.green : C.red,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#fff', fontWeight: 900,
                  }}>
                    {item.pass ? '✓' : '✗'}
                  </div>
                  <span style={{ fontSize: 12 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.pass ? C.green : C.sub }}>
                      {item.label}{' '}
                      <span style={{ color: item.pass ? C.green : C.red, fontFamily: 'monospace', fontSize: 10 }}>
                        ({item.actual.length > 12 ? item.actual.slice(0, 11) + '…' : item.actual})
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: C.low }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, fontWeight: 700,
                    color: srcBadge.c, background: `${srcBadge.c}18`, whiteSpace: 'nowrap' }}>
                    {srcBadge.t}
                  </span>
                </div>
              )
            })}

            {/* 추정 데이터 안내 */}
            {moatAuto.items.some(i => i.src === 'est') && (
              <div style={{ fontSize: 9, color: C.low, marginBottom: 8, lineHeight: 1.5 }}>
                ℹ️ &lsquo;업종추정&rsquo;은 해당 종목의 실시간 재무공시가 부족할 때 같은 업종·분류의 평균값으로 자동 추정한 참고치입니다.
              </div>
            )}

            {/* 해자 종합 판정 */}
            <div style={{
              marginTop: 6, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
              background: moatScore >= 4 ? C.greenDim : moatScore >= 2 ? C.goldDim : C.redDim,
              border: `1px solid ${moatScore >= 4 ? 'rgba(16,185,129,0.3)' : moatScore >= 2 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontSize: 12, fontWeight: 800,
              color: moatScore >= 4 ? C.green : moatScore >= 2 ? C.gold : C.red,
            }}>
              {moatScore >= 4 ? '🏆 탁월한 해자 — 버핏 투자 적격!'
               : moatScore >= 3 ? '🟡 양호한 해자 — 지속 관찰'
               : moatScore >= 2 ? '⚠️ 약한 해자 — 경쟁 위협 주의'
               : '🔴 해자 불명확 — 투자 신중'}
            </div>
          </div>

          {/* ── DCF 분석 불가 전용 진단 (적자 vs 데이터 부족 구분) ── */}
          {dcfUnavailable && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>⚪</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: C.sub }}>
                  {dcfReason === 'loss' ? '적자 기업 — DCF 분석이 불가능합니다' : '재무 데이터가 부족해 DCF 분석이 제한됩니다'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>
                {dcfReason === 'loss' ? (
                  <>
                    <strong style={{ color: C.text }}>{selected?.name}</strong>은 현재 <strong style={{ color: C.red }}>이익·현금흐름이 적자</strong>입니다.
                    DCF(현금흐름할인법)는 미래에 벌어들일 &lsquo;현금&rsquo;을 할인하는 방식이라, 현금흐름이 없는 기업에는 적용할 수 없습니다.
                    <br /><br />
                    💡 이런 <strong style={{ color: C.gold }}>적자 성장기업</strong>은 DCF 대신 <strong style={{ color: C.gold }}>린치 밸류에이션 탭의 &lsquo;회생주/혁신성장&rsquo; 프레임워크(매출 성장률·P/S·흑자전환 시점)</strong>로 분석하세요.
                  </>
                ) : (
                  <>
                    <strong style={{ color: C.text }}>{selected?.name}</strong>은 <strong style={{ color: C.gold }}>잉여현금흐름·시가총액 등 핵심 재무 데이터를 데이터 소스(Yahoo)에서 가져오지 못했습니다</strong>.
                    신규 상장주이거나 거래량이 적은 소형주일 때 발생합니다.
                    <br /><br />
                    💡 DCF 정밀 분석은 어렵지만, 아래 <strong style={{ color: C.gold }}>경제적 해자(ROE·마진·업종)</strong>와 <strong style={{ color: C.gold }}>피터린치 분석 탭의 PEG</strong>로 충분히 판단할 수 있습니다.
                  </>
                )}
              </div>
              {/* 기업 품질만 표시 */}
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: C.low, marginBottom: 2 }}>참고: 기업 품질 (경제적 해자)</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: moatScore >= 3 ? C.green : C.red }}>
                  {moatScore}/5 {moatScore >= 3 ? '양호' : '약함'} <span style={{ fontSize: 9, color: C.low }}>(가격 평가는 데이터 확보 후 가능)</span>
                </div>
              </div>
            </div>
          )}

          {/* ── 버핏 통합 진단: 품질(해자) × 가격(안전마진) 2축 결합 ── */}
          {!dcfUnavailable && (() => {
            const goodMoat  = moatScore >= 3            // 기업 품질 양호
            const cheap     = result.safetyMargin >= 0  // 가격 저평가
            const diag = goodMoat && cheap
              ? { icon: '🏆', title: '훌륭한 기업을 합리적 가격에', color: C.green, bg: C.greenDim, border: 'rgba(16,185,129,0.3)',
                  body: '경제적 해자가 튼튼하고 현재 주가도 내재가치보다 쌉니다. 버핏이 가장 선호하는 "좋은 기업 + 좋은 가격" 조합입니다.' }
              : goodMoat && !cheap
              ? { icon: '👀', title: '훌륭한 기업, 하지만 지금은 비쌈', color: C.gold, bg: C.goldDim, border: 'rgba(245,158,11,0.3)',
                  body: '기업의 질(해자)은 우수하지만 현재 주가가 내재가치보다 비쌉니다. 워치리스트에 담아두고 주가 조정 시 매수를 고려하세요. — "좋은 기업이라도 비싸면 사지 않는다"' }
              : !goodMoat && cheap
              ? { icon: '⚠️', title: '싸지만 품질 주의 (밸류 트랩 경계)', color: C.gold, bg: C.goldDim, border: 'rgba(245,158,11,0.3)',
                  body: '가격은 싸 보이지만 경제적 해자가 약합니다. 싼 데는 이유가 있을 수 있으니(밸류 트랩) 사업의 지속성을 먼저 확인하세요.' }
              : { icon: '🚫', title: '품질·가격 모두 부적합', color: C.red, bg: C.redDim, border: 'rgba(239,68,68,0.3)',
                  body: '해자도 약하고 가격도 비쌉니다. 버핏 기준에서는 투자를 보류하는 것이 안전합니다.' }
            return (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: diag.bg, border: `1px solid ${diag.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{diag.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: diag.color }}>{diag.title}</span>
                </div>
                {/* 2축 요약 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.low, marginBottom: 2 }}>① 기업 품질 (해자)</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: goodMoat ? C.green : C.red }}>
                      {moatScore}/5 {goodMoat ? '양호' : '약함'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: C.low, fontSize: 14 }}>×</div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.low, marginBottom: 2 }}>② 현재 가격 (안전마진)</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: cheap ? C.green : C.red }}>
                      {result.safetyMargin > -900 ? `${result.safetyMargin >= 0 ? '+' : ''}${result.safetyMargin.toFixed(0)}%` : 'N/A'} {cheap ? '저평가' : '고평가'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.7 }}>{diag.body}</div>
                <div style={{ marginTop: 8, fontSize: 9, color: C.low, lineHeight: 1.5 }}>
                  💡 경제적 해자(기업의 질)와 안전마진(가격)은 <strong style={{ color: C.sub }}>서로 다른 축</strong>입니다. 둘 다 충족될 때가 최고의 매수 기회입니다.
                </div>
              </div>
            )
          })()}

          {/* 버핏 명언 */}
          <div style={{
            padding: '12px 14px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`,
            fontSize: 11, color: C.sub, lineHeight: 1.7,
          }}>
            <div style={{ color: C.green, fontWeight: 700, marginBottom: 5 }}>💬 버핏의 가르침</div>
            <div>&ldquo;훌륭한 기업을 적정한 가격에 사는 것이 적정한 기업을 훌륭한 가격에 사는 것보다 훨씬 낫다.&rdquo;</div>
            <div style={{ marginTop: 5 }}>
              &ldquo;안전마진은 마치 다리를 건설할 때 10톤을 버텨야 하면 15톤 용량으로 짓는 것과 같다.&rdquo;
            </div>
          </div>
        </div>
      </div>

      {/* ── 거장들의 인사이트 카드 (동적) ─────────────────────────────────── */}
      <InsightCard selected={selected} fund={fund} safetyMargin={result.safetyMargin} g={g} />

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance:none; width:14px; height:14px; border-radius:50%;
          background:#10b981; border:2px solid #0a0e1a; cursor:pointer;
          box-shadow:0 0 4px rgba(16,185,129,0.5);
        }
        input[type=range]::-moz-range-thumb {
          width:14px; height:14px; border-radius:50%;
          background:#10b981; border:2px solid #0a0e1a; cursor:pointer;
        }
      `}</style>
    </div>
  )
}
