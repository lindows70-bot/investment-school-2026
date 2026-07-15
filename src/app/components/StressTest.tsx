'use client'

/**
 * StressTest — 매크로 스트레스 테스트 룸
 *
 * ◆ 기능
 *  1. 유저의 실제 Core / Satellite 비중을 Supabase에서 읽어 기본값 적용
 *  2. 슬라이더로 비중을 자유 조정 + 방어형/균형형/성장형/공격형 프리셋
 *  3. 3대 역사적 위기 시나리오 선택 (2008·2020·2022)
 *  4. ₩1,000 기준 포트폴리오 가치 곡선 + MDD / 회복기간 / 최종수익률 배지
 *  5. 시나리오별 매크로 원인 분석 & 최일 선생님 원포인트 레슨 카드
 */

import { useState, useMemo, useEffect } from 'react'
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  Shield, TrendingDown, Clock, AlertTriangle,
  BookOpen, Zap, Activity,
} from 'lucide-react'
import { TK } from '@/lib/theme'

// ── 컬러 시스템 ───────────────────────────────────────────────
const C = {
  bg:      TK.slate950,
  surface: TK.slate900,
  card:    TK.border,
  cardHi:  '#263348',
  border:  TK.sub6,
  textHi:  TK.slate100,
  textMid: TK.slate400,
  textLow: TK.sub2,
  blue:    TK.sky400,
  cyan:    '#06b6d4',
  neon:    TK.lime400,
  orange:  TK.orange400,
  red:     TK.red400,
  amber:   TK.amber400,
  green:   TK.green400,
  purple:  TK.purple400,
}

// ── 시나리오 타입 ─────────────────────────────────────────────
type Scenario = '2008' | '2020' | '2022'

// ── Mock Data ─────────────────────────────────────────────────
// 각 인덱스 배열: 13개 포인트 (월 0 = 위기 시작, 월 12 = 1년 후)
// core      = 장기채·방어자산 지수 (1.0 = 시작)
// satellite = 성장주·테마자산 지수 (1.0 = 시작)
const SCENARIO_DATA: Record<Scenario, {
  months:    string[]
  core:      number[]
  satellite: number[]
}> = {
  // ── 2008 글로벌 금융위기 ────────────────────────────────────
  // 코어(장기채): 안전자산 수요 폭증 + 연준 금리 인하 → +15%
  // 새틀라이트(주식): 리먼 파산 → S&P 500 최대 -57% → 소폭 반등
  '2008': {
    months:    ['08.09','08.10','08.11','08.12','09.01','09.02','09.03','09.04','09.05','09.06','09.07','09.08','09.09'],
    core:      [1.00, 0.97, 1.01, 1.05, 1.07, 1.08, 1.09, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15],
    satellite: [1.00, 0.84, 0.68, 0.54, 0.48, 0.44, 0.41, 0.40, 0.43, 0.46, 0.50, 0.46, 0.42],
  },
  // ── 2020 코로나 팬데믹 ─────────────────────────────────────
  // 코어(채권): 초반 안전자산 상승 후 유동성 공급으로 약보합 → +7%
  // 새틀라이트(성장주): -35% 폭락 후 V자 반등 → +58% (나스닥 폭발)
  '2020': {
    months:    ['20.02','20.03','20.04','20.05','20.06','20.07','20.08','20.09','20.10','20.11','20.12','21.01','21.02'],
    core:      [1.00, 0.96, 0.91, 0.88, 0.92, 0.95, 0.97, 0.99, 1.01, 1.03, 1.05, 1.06, 1.07],
    satellite: [1.00, 0.87, 0.71, 0.65, 0.76, 0.90, 1.03, 1.16, 1.28, 1.40, 1.50, 1.55, 1.58],
  },
  // ── 2022 인플레이션 & 금리인상기 ───────────────────────────
  // 코어(채권): 40년만의 금리 급등 → 채권 가격 동반 하락 -22%
  // 새틀라이트(주식): 금리 상승 + 경기침체 우려 → 성장주 타격 -28%
  '2022': {
    months:    ['22.01','22.02','22.03','22.04','22.05','22.06','22.07','22.08','22.09','22.10','22.11','22.12','23.01'],
    core:      [1.00, 0.97, 0.94, 0.90, 0.87, 0.84, 0.82, 0.80, 0.79, 0.78, 0.78, 0.79, 0.78],
    satellite: [1.00, 0.95, 0.89, 0.83, 0.77, 0.73, 0.71, 0.74, 0.75, 0.73, 0.72, 0.73, 0.72],
  },
}

// ── 시나리오 메타 정보 ─────────────────────────────────────────
const SCENARIO_META: Record<Scenario, {
  label:    string
  period:   string
  subtitle: string
  color:    string
  icon:     string
  lesson: {
    macro:      string
    allocation: string
    quote:      string
  }
}> = {
  '2008': {
    label:    '2008 글로벌 금융위기',
    period:   '2008.09 ~ 2009.09',
    subtitle: '리먼 브라더스 파산 · 금융 시스템 붕괴',
    color:    C.red,
    icon:     '🏦',
    lesson: {
      macro:
        '과도한 레버리지와 부동산 파생상품(MBS·CDO)이 연쇄 폭발하며 글로벌 금융 시스템이 마비되었습니다. ' +
        '연준은 기준금리를 0%대까지 인하하고 전례 없는 양적완화(QE1)를 단행했습니다. ' +
        '경기↓↓↓ · 물가↓ · 금리↓↓ — 디플레이션+금융 붕괴 복합 위기.',
      allocation:
        '이 위기의 핵심 교훈은 자산 간 "비상관성(Non-Correlation)"입니다. 주식이 -50% 이상 폭락하는 동안 ' +
        '미국 장기채는 안전자산으로 오히려 상승했습니다. ' +
        'Core 비중이 높을수록 MDD가 절반 이하로 줄었고, 80% Core 포트폴리오는 1년 내 원금 회복이 가능했습니다. ' +
        '위기일수록 코어의 방어력이 전체 포트폴리오 생존을 결정합니다.',
      quote:
        '"위기 때 주식과 장기채는 반대 방향으로 움직인다. ' +
        'Core에 장기채를 담는 것, 그것이 포트폴리오의 보험이다."',
    },
  },
  '2020': {
    label:    '2020 코로나 팬데믹',
    period:   '2020.02 ~ 2021.02',
    subtitle: '역사상 가장 빠른 폭락, 역사상 가장 강한 V자 반등',
    color:    C.amber,
    icon:     '🦠',
    lesson: {
      macro:
        '코로나19라는 외생 충격으로 전세계 경제가 순식간에 멈췄습니다. ' +
        '주요국 중앙은행은 사상 최대 규모의 유동성(달러 무제한 공급, QE 무한정)을 쏟아부었고, ' +
        '이것이 자산 시장의 폭발적 반등을 이끌었습니다. ' +
        '경기↓↓↓ → 유동성 폭발 · 금리↓↓ — 공급 충격 + 유동성 홍수.',
      allocation:
        '이 위기는 "기다림의 미학"을 가르쳐 줍니다. 초반 Core·Satellite 모두 동반 하락했지만, ' +
        '유동성 공급 이후 성장주(Satellite)의 반등이 채권(Core)을 압도했습니다. ' +
        '패닉셀하지 않고 Satellite를 끝까지 지킨 포트폴리오가 결국 최고 성과를 냈습니다. ' +
        '이 시나리오에서는 Core 비중이 낮을수록 장기 수익이 더 높아집니다.',
      quote:
        '"위기는 누군가의 저가 매수 기회다. ' +
        'Satellite를 끝까지 지킨 자가 V자 반등의 과실을 온전히 가져갔다."',
    },
  },
  '2022': {
    label:    '2022 인플레이션 & 금리인상기',
    period:   '2022.01 ~ 2023.01',
    subtitle: '40년 만의 인플레이션 · 자산 배분의 역설',
    color:    C.purple,
    icon:     '📈',
    lesson: {
      macro:
        '코로나 이후 공급망 붕괴와 과잉 유동성이 만들어낸 40년 만의 인플레이션이 폭발했습니다. ' +
        '연준은 2022년 한 해에만 기준금리를 4.25%p 올리는 초강경 긴축으로 대응했습니다. ' +
        '경기 둔화 · 물가↑↑↑ · 금리↑↑↑ — 스태그플레이션 우려.',
      allocation:
        '이 시기는 역사상 가장 이례적인 국면이었습니다. 금리가 급등하자 채권(Core) 가격이 주식(Satellite)과 ' +
        '동시에 폭락했고, 전통적인 60/40 전략이 통하지 않았습니다. ' +
        'Core 비중이 높아도 MDD를 크게 줄이지 못했던 유일한 위기입니다. ' +
        '"이럴 때는 현금·원자재·인버스 ETF만이 살길"이라는 교훈을 남겼습니다.',
      quote:
        '"금리가 급등할 땐 현금과 인버스 외엔 안전지대가 없다. ' +
        '60/40 포트폴리오가 동시에 무너지는 건 역사상 매우 드문 일이다. 그래서 더 무섭다." — 최일',
    },
  },
}

// ── 유틸리티 함수 ─────────────────────────────────────────────

/** 최대 낙폭(MDD) 계산 — % 반환 */
function calcMDD(values: number[]): number {
  let peak = values[0]
  let mdd  = 0
  for (const v of values) {
    if (v > peak) peak = v
    const dd = (peak - v) / peak
    if (dd > mdd) mdd = dd
  }
  return mdd * 100
}

/** 원금(1000) 복구까지 걸린 개월 수 — null = 미회복 */
function calcRecovery(values: number[]): number | null {
  const start = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] >= start) return i
  }
  return null
}

/** Core 비중(%) → 포트폴리오 월별 시계열 생성 */
function buildSeries(scenario: Scenario, corePct: number) {
  const { months, core, satellite } = SCENARIO_DATA[scenario]
  const cw = corePct / 100
  const sw = 1 - cw
  return months.map((month, i) => ({
    month,
    value:     Math.round(1000 * (cw * core[i] + sw * satellite[i])),
    core:      Math.round(1000 * core[i]),
    satellite: Math.round(1000 * satellite[i]),
  }))
}

// ── Custom Tooltip ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const items = [
    { key: 'value',     label: '내 포트폴리오', color: C.cyan   },
    { key: 'core',      label: '코어 단독',      color: C.blue   },
    { key: 'satellite', label: '새틀라이트 단독', color: C.orange },
  ]
  return (
    <div style={{
      background: C.cardHi, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: C.textMid, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {items.map(it => {
        const p = payload.find((d: { dataKey: string }) => d.dataKey === it.key)
        if (!p) return null
        const diff = p.value - 1000
        return (
          <div key={it.key} style={{ color: it.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span>{it.label}</span>
            <span>
              ₩{p.value.toLocaleString()}
              <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>
                ({diff >= 0 ? '+' : ''}{diff.toLocaleString()})
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── 컴포넌트 배지 ─────────────────────────────────────────────
function MetricBadge({
  icon, label, value, subtext, color,
}: {
  icon:    React.ReactNode
  label:   string
  value:   string
  subtext: string
  color:   string
}) {
  return (
    <div className="rounded-xl p-4 border text-center"
      style={{ background: `${color}12`, borderColor: `${color}40` }}>
      <div className="flex items-center justify-center gap-1 mb-1">
        {icon}
        <span className="text-xs font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="text-3xl font-black tabular-nums leading-tight" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.textLow }}>{subtext}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════
export default function StressTest() {
  const [scenario,     setScenario]    = useState<Scenario>('2008')
  const [corePct,      setCorePct]     = useState(60)
  const [realCorePct,  setRealCorePct] = useState<number | null>(null)
  const [loadingUser,  setLoadingUser] = useState(true)

  // ── 실제 유저 Core 비중 로드 ─────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { setLoadingUser(false); return }
        const { data } = await sb
          .from('investments')
          .select('asset_role, purchase_price, quantity')
          .eq('user_id', session.user.id)
        if (!data || data.length === 0) { setLoadingUser(false); return }
        const total = data.reduce((s, i) =>
          s + (Number(i.purchase_price) || 0) * (Number(i.quantity) || 0), 0)
        const coreTotal = data
          .filter(i => (i.asset_role ?? 'CORE') === 'CORE')
          .reduce((s, i) =>
            s + (Number(i.purchase_price) || 0) * (Number(i.quantity) || 0), 0)
        const pct = total > 0 ? Math.round((coreTotal / total) * 100) : 60
        setRealCorePct(pct)
        setCorePct(pct)
      } catch { /* 무시 */ }
      finally { setLoadingUser(false) }
    }
    load()
  }, [])

  // ── 시계열 계산 ───────────────────────────────────────────────
  const series   = useMemo(() => buildSeries(scenario, corePct),    [scenario, corePct])
  const values   = useMemo(() => series.map(s => s.value),          [series])
  const mdd      = useMemo(() => calcMDD(values),                   [values])
  const recovery = useMemo(() => calcRecovery(values),              [values])
  const finalRet = useMemo(() =>
    ((values[values.length - 1] - 1000) / 1000) * 100, [values])
  const meta = SCENARIO_META[scenario]
  const satPct = 100 - corePct

  // ── 비중별 MDD 비교 (방어형/균형형/성장형/공격형) ─────────────
  const presets = [
    { label: '방어형',  core: 80, color: C.blue   },
    { label: '균형형',  core: 60, color: C.cyan   },
    { label: '성장형',  core: 40, color: C.neon   },
    { label: '공격형',  core: 20, color: C.orange },
  ]
  const presetMDDs = useMemo(() =>
    presets.map(p => ({
      ...p,
      mdd: calcMDD(buildSeries(scenario, p.core).map(s => s.value)),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [scenario])

  return (
    <div
      style={{
        background:  C.bg,
        color:       C.textHi,
        fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
      className="p-4 md:p-6 space-y-5"
    >
      {/* ── 헤더 ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: `${C.purple}22` }}>
          <Activity size={20} color={C.purple} />
        </div>
        <div>
          <h2 className="text-lg font-black" style={{ color: C.textHi }}>
            매크로 스트레스 테스트 룸
          </h2>
          <p className="text-xs" style={{ color: C.textLow }}>
            역사적 위기 시나리오에서 내 포트폴리오 비중이 어떻게 버티는지 시뮬레이션
          </p>
        </div>
      </div>

      {/* ── 시나리오 선택 카드 ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(SCENARIO_META) as Scenario[]).map(s => {
          const m       = SCENARIO_META[s]
          const isActive = s === scenario
          // 현재 Core% 기준 해당 시나리오 MDD 미리 보기
          const previewMDD = calcMDD(buildSeries(s, corePct).map(d => d.value))
          return (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className="rounded-xl p-4 border text-left transition-all hover:opacity-90"
              style={{
                background:   isActive ? `${m.color}18` : C.card,
                borderColor:  isActive ? m.color : C.border,
                borderWidth:  isActive ? 2 : 1,
                cursor:       'pointer',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{m.icon}</span>
                {isActive && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${m.color}30`, color: m.color }}>선택됨</span>
                )}
              </div>
              <div className="text-sm font-bold mb-0.5" style={{ color: isActive ? m.color : C.textHi }}>
                {m.label}
              </div>
              <div className="text-xs mb-1" style={{ color: C.textLow }}>{m.period}</div>
              <div className="text-xs mb-3" style={{ color: C.textMid }}>{m.subtitle}</div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: C.textLow }}>현재 비중 MDD</span>
                <span className="text-sm font-black tabular-nums" style={{ color: m.color }}>
                  -{previewMDD.toFixed(1)}%
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── 메인 레이아웃: 좌측 컨트롤 + 우측 차트 ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">

        {/* ── 좌측: 비중 슬라이더 패널 ─────────────────────── */}
        <div className="rounded-xl border p-5 space-y-5"
          style={{ background: C.card, borderColor: C.border }}>

          <div className="flex items-center gap-2">
            <Shield size={15} color={C.cyan} />
            <span className="text-sm font-bold" style={{ color: C.textHi }}>포트폴리오 비중 설정</span>
          </div>

          {/* 실제 유저 비중 배지 */}
          {!loadingUser && realCorePct !== null && (
            <div className="rounded-lg px-3 py-2 text-xs flex items-center justify-between"
              style={{ background: `${C.cyan}15`, color: C.cyan }}>
              <span>📌 내 실제 비중</span>
              <span className="font-bold">Core {realCorePct}% / Sat {100 - realCorePct}%</span>
            </div>
          )}

          {/* Core 슬라이더 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold" style={{ color: C.blue }}>🛡️ 코어 (Core)</span>
              <span className="text-xl font-black tabular-nums" style={{ color: C.blue }}>{corePct}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={corePct}
              onChange={e => setCorePct(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: C.blue }}
            />
            <div className="text-xs mt-1" style={{ color: C.textLow }}>
              장기채 · 우량 ETF · 배당주
            </div>
          </div>

          {/* Satellite 표시 바 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold" style={{ color: C.orange }}>🚀 새틀라이트 (Satellite)</span>
              <span className="text-xl font-black tabular-nums" style={{ color: C.orange }}>{satPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: C.border }}>
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${satPct}%`, background: C.orange }} />
            </div>
            <div className="text-xs mt-1" style={{ color: C.textLow }}>
              성장주 · 테마 ETF · 코인
            </div>
          </div>

          {/* 시각적 비중 바 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.textMid }}>비중 시각화</div>
            <div className="flex h-9 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-center text-xs font-bold transition-all duration-200"
                style={{
                  width:      `${corePct}%`,
                  background: `${C.blue}35`,
                  color:      C.blue,
                }}
              >
                {corePct >= 20 ? `${corePct}%` : ''}
              </div>
              <div
                className="flex items-center justify-center text-xs font-bold transition-all duration-200"
                style={{
                  width:      `${satPct}%`,
                  background: `${C.orange}35`,
                  color:      C.orange,
                }}
              >
                {satPct >= 20 ? `${satPct}%` : ''}
              </div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span style={{ color: C.blue }}>Core</span>
              <span style={{ color: C.orange }}>Satellite</span>
            </div>
          </div>

          {/* 프리셋 버튼 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.textMid }}>빠른 설정</div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setCorePct(p.core)}
                  className="rounded-lg py-2 text-xs font-semibold border transition-all"
                  style={{
                    background:  corePct === p.core ? `${p.color}22` : C.surface,
                    borderColor: corePct === p.core ? p.color : C.border,
                    color:       corePct === p.core ? p.color : C.textMid,
                    cursor:      'pointer',
                  }}
                >
                  {p.label}
                  <br />
                  <span className="font-normal opacity-70">{p.core}/{100 - p.core}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 비중별 MDD 비교 테이블 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.textMid }}>
              현재 시나리오 비중별 MDD
            </div>
            <div className="space-y-1.5">
              {presetMDDs.map(p => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="text-xs w-14 shrink-0" style={{ color: p.color }}>{p.label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: C.border }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(p.mdd, 70) / 70 * 100}%`, background: p.color }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-12 text-right"
                    style={{ color: p.color }}>-{p.mdd.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측: 지표 배지 + 차트 ──────────────────────── */}
        <div className="space-y-4">

          {/* 핵심 지표 배지 3개 */}
          <div className="grid grid-cols-3 gap-3">
            <MetricBadge
              icon={<TrendingDown size={14} color={C.red} />}
              label="최대 낙폭 (MDD)"
              value={`-${mdd.toFixed(1)}%`}
              subtext="최저점까지 하락폭"
              color={C.red}
            />
            <MetricBadge
              icon={<Clock size={14} color={C.amber} />}
              label="원금 회복"
              value={recovery === null ? '미회복' : `${recovery}개월`}
              subtext={recovery === null ? '기간 내 미달성' : '₩1,000 복귀 시점'}
              color={C.amber}
            />
            <MetricBadge
              icon={<Zap size={14} color={finalRet >= 0 ? C.green : C.red} />}
              label="12개월 수익률"
              value={`${finalRet >= 0 ? '+' : ''}${finalRet.toFixed(1)}%`}
              subtext="시뮬레이션 최종 수익"
              color={finalRet >= 0 ? C.green : C.red}
            />
          </div>

          {/* 차트 */}
          <div className="rounded-xl border p-4"
            style={{ background: C.card, borderColor: C.border }}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-sm font-bold" style={{ color: C.textHi }}>
                  포트폴리오 가치 변화 (시작 ₩1,000 기준)
                </div>
                <div className="text-xs" style={{ color: C.textLow }}>
                  Core {corePct}% / Satellite {satPct}% 조합
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span style={{ color: C.cyan }}>━ 내 포트폴리오</span>
                <span style={{ color: C.blue }}>╌ 코어 단독</span>
                <span style={{ color: C.orange }}>╌ 새틀라이트 단독</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={series} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.cyan} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: C.textLow, fontSize: 10 }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={v => `₩${v}`}
                  tick={{ fill: C.textLow, fontSize: 10 }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} />

                {/* 원금 기준선 */}
                <ReferenceLine
                  y={1000}
                  stroke={C.textLow}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: '₩1,000 원금',
                    position: 'insideTopRight',
                    fill: C.textLow,
                    fontSize: 9,
                  }}
                />

                {/* 코어 단독 (파랑 점선) */}
                <Line
                  type="monotone"
                  dataKey="core"
                  stroke={C.blue}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name="코어 단독"
                  isAnimationActive={false}
                />

                {/* 새틀라이트 단독 (오렌지 점선) */}
                <Line
                  type="monotone"
                  dataKey="satellite"
                  stroke={C.orange}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name="새틀라이트 단독"
                  isAnimationActive={false}
                />

                {/* 내 포트폴리오 (시안 굵은 실선 + 그라데이션 면) */}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={C.cyan}
                  strokeWidth={2.5}
                  fill="url(#gradPortfolio)"
                  dot={false}
                  name="내 포트폴리오"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 원포인트 레슨 카드 ─────────────────────────────── */}
      <div className="rounded-xl border p-5"
        style={{ background: C.card, borderColor: C.border }}>

        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} color={meta.color} />
          <span className="text-sm font-black" style={{ color: meta.color }}>
            {meta.icon} {meta.label} — 최일 선생님의 원포인트 레슨
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 매크로 원인 */}
          <div className="rounded-xl p-4" style={{ background: C.surface }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} color={C.amber} />
              <span className="text-xs font-bold" style={{ color: C.amber }}>
                매크로 원인 분석
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.textMid }}>
              {meta.lesson.macro}
            </p>
          </div>

          {/* 자산 배분 교훈 */}
          <div className="rounded-xl p-4" style={{ background: C.surface }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={13} color={C.neon} />
              <span className="text-xs font-bold" style={{ color: C.neon }}>
                자산 배분의 교훈
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.textMid }}>
              {meta.lesson.allocation}
            </p>
          </div>
        </div>

        {/* 최일 선생님 명언 */}
        <div
          className="rounded-xl p-4 border-l-4"
          style={{ background: `${meta.color}10`, borderLeftColor: meta.color }}
        >
          <p className="text-sm font-semibold italic leading-relaxed"
            style={{ color: meta.color }}>
            💬 &nbsp;{meta.lesson.quote}
          </p>
        </div>
      </div>
    </div>
  )
}
