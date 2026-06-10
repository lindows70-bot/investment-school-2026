'use client'

/**
 * LeverageRiskSimulator — 레버리지 위험성 교육 시뮬레이터
 *
 * 핵심 교육 목표:
 *   1. 자본시장연구원 통계: 일반 ETF +25% vs 고배율 레버리지 -33%
 *   2. 횡보장의 덫: 음의 복리(변동성 잠식) 수식 직접 체험
 *   3. 피터 린치 원칙 기반 위험 감내도 자가 진단
 */

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts'

// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#0a0e1a',
  card:    '#111827',
  card2:   '#0f1623',
  border:  '#1e293b',
  gold:    '#f59e0b',
  goldDim: 'rgba(245,158,11,0.10)',
  red:     '#ef4444',
  redDim:  'rgba(239,68,68,0.08)',
  green:   '#22c55e',
  greenDim:'rgba(34,197,94,0.08)',
  blue:    '#60a5fa',
  text:    '#f1f5f9',
  textSub: '#94a3b8',
  textLow: '#8599ae',
}

// ── 툴팁 ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <div style={{ color: C.textSub, marginBottom: 4 }}>{label}일차</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} style={{ color: p.color, fontFamily: 'monospace' }}>
          {p.name}: {p.value.toFixed(2)}%
        </div>
      ))}
    </div>
  )
}

// ── 슬라이더 ─────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, unit, onChange, color = C.gold }: {
  label: string; value: number; min: number; max: number; step: number
  unit: string; onChange: (v: number) => void; color?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 900, color, fontFamily: 'monospace' }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '100%', height: 6, appearance: 'none',
            background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, #1e293b ${((value - min) / (max - min)) * 100}%, #1e293b 100%)`,
            borderRadius: 3, cursor: 'pointer', outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textLow }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  )
}

// ── 시장 시나리오 타입 ────────────────────────────────────────────────────────
type ScenarioType = 'sideways' | 'bull' | 'bear'

const SCENARIOS: { id: ScenarioType; icon: string; label: string; desc: string; color: string }[] = [
  { id: 'sideways', icon: '↔', label: '횡보장의 덫', desc: '+X%와 -X% 교대 반복',    color: '#f59e0b' },
  { id: 'bull',     icon: '↑',  label: '일방적 폭등장', desc: '매일 +X%씩 연속 상승', color: '#22c55e' },
  { id: 'bear',     icon: '↓',  label: '일방적 폭락장', desc: '매일 -X%씩 연속 하락', color: '#ef4444' },
]

// ── 핵심 시뮬레이션 수식 ─────────────────────────────────────────────────────
//
// 횡보장: +X%, -X% 교대 → 1배: (1-x²)^n / 2배: (1-4x²)^n / 3배: (1-9x²)^n
// 폭등장: +X% 연속        → 레버리지가 유리 (1배 < 2배 < 3배)
// 폭락장: -X% 연속        → 고배율일수록 훨씬 빠른 자산 파괴
//
function simulate(dailyPct: number, days: number, scenario: ScenarioType) {
  const x = dailyPct / 100
  const data: { day: number; base: number; lev2: number; lev3: number }[] = []

  let base = 100, lev2 = 100, lev3 = 100

  for (let d = 1; d <= days; d++) {
    // 시나리오별 방향 결정
    let dir: number
    if (scenario === 'sideways') {
      dir = d % 2 === 1 ? 1 : -1  // 홀수=상승, 짝수=하락
    } else if (scenario === 'bull') {
      dir = 1   // 항상 상승
    } else {
      dir = -1  // 항상 하락
    }

    base = base * (1 + dir * x)
    lev2 = Math.max(0.01, lev2 * (1 + dir * 2 * x))  // 0 이하 방지
    lev3 = Math.max(0.01, lev3 * (1 + dir * 3 * x))

    // 데이터 포인트: 횡보장은 2일 단위, 나머지는 매일 기록
    const shouldRecord = scenario === 'sideways'
      ? (d % 2 === 0 || d === days)
      : true

    if (shouldRecord) {
      data.push({
        day:  d,
        base: parseFloat((base - 100).toFixed(2)),
        lev2: parseFloat((lev2 - 100).toFixed(2)),
        lev3: parseFloat((lev3 - 100).toFixed(2)),
      })
    }
  }
  return { data, final: { base, lev2, lev3 } }
}

// ── 위험 감내도 진단 문항 ─────────────────────────────────────────────────────
const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    scenario: '시나리오 1',
    question: '내가 매수한 반도체 3배 레버리지 ETF가\n최고점 대비 -60% 폭락했다. 나는?',
    note: '※ 실제 SOXL(반도체 3x) 2022년 고점 대비 낙폭 -91.8%',
    options: [
      {
        text: '💳 적금 깨고 카드값 밀리더라도 영끌해서 물을 탄다\n"이번엔 다시 오를 것 같다"',
        type: 'danger' as const,
        result: { icon: '🔴', label: '투기적 성향 — 극위험', color: C.red,
          desc: '감당할 수 없는 돈으로 하는 투자는 "투기"입니다. 추가 손실 시 심리적 공황 상태에 빠져 최악의 타이밍에 매도하게 됩니다.' },
      },
      {
        text: '📋 미리 정한 원칙대로\n감당 가능한 범위 안에서 분할 매수 또는 손절 프로세스를 가동한다',
        type: 'safe' as const,
        result: { icon: '🟢', label: '이성적 투자자', color: C.green,
          desc: '피터 린치는 "주가가 반토막 나도 흔들리지 않을 확신이 없다면 그 주식을 사서는 안 된다"고 말했습니다. 원칙 있는 매매가 장기 수익의 핵심입니다.' },
      },
    ],
  },
  {
    id: 'q2',
    scenario: '시나리오 2',
    question: '"이 종목은 반드시 3배 오른다"는\n유튜브 영상을 보고 전 재산을 투자하려 한다. 나는?',
    note: '※ 단일 정보 소스에 의존한 집중 투자의 위험',
    options: [
      {
        text: '🚀 지금 당장 전 재산을 넣는다\n"이런 기회는 다시 없다"',
        type: 'danger' as const,
        result: { icon: '🔴', label: '충동적 투자 — 고위험', color: C.red,
          desc: '"반드시 오른다"는 확신 자체가 위험 신호입니다. 피터 린치는 "주식시장에서 확실한 것은 아무것도 없다"고 경고했습니다.' },
      },
      {
        text: '🔍 직접 재무제표와 산업 분석을 한 뒤\n분산 투자 원칙 내에서 결정한다',
        type: 'safe' as const,
        result: { icon: '🟢', label: '분석형 투자자', color: C.green,
          desc: '좋은 투자자는 타인의 확신이 아닌 본인의 분석을 믿습니다. 포트폴리오 다각화와 자체 분석이 장기 생존의 비결입니다.' },
      },
    ],
  },
]

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function LeverageRiskSimulator() {
  // 시뮬레이터 상태
  const [dailyPct,  setDailyPct]  = useState(5)                          // 일일 변동폭 %
  const [days,      setDays]      = useState(20)                          // 반복 일수
  const [scenario,  setScenario]  = useState<ScenarioType>('sideways')   // 시장 시나리오
  const [quizAnswers, setQuizAnswers] = useState<Record<string, 'danger' | 'safe' | null>>({
    q1: null, q2: null,
  })

  // 시뮬레이션 연산
  const sim = useMemo(() => simulate(dailyPct, days, scenario), [dailyPct, days, scenario])

  // 횡보장 전용: 1사이클 수식 카드 (교육용)
  const oneCycle = useMemo(() => {
    const x = dailyPct / 100
    return {
      base: parseFloat(((1 + x) * (1 - x) * 100).toFixed(4)),
      lev2: parseFloat(((1 + 2*x) * (1 - 2*x) * 100).toFixed(4)),
      lev3: parseFloat(((1 + 3*x) * (1 - 3*x) * 100).toFixed(4)),
    }
  }, [dailyPct])

  // 위험도 판정
  const riskProfile = useMemo(() => {
    const answers = Object.values(quizAnswers)
    const answered = answers.filter(a => a !== null).length
    const dangerous = answers.filter(a => a === 'danger').length
    if (answered === 0) return null
    if (dangerous >= 2) return { level: 'extreme', label: '🔴 투기적 성향 — 즉시 점검 필요', color: C.red }
    if (dangerous === 1) return { level: 'moderate', label: '🟡 혼합형 — 원칙 재정립 권장', color: C.gold }
    return { level: 'safe', label: '🟢 이성적 투자자 — 올바른 방향', color: C.green }
  }, [quizAnswers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20,
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px', borderRadius: 14,
        background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 100%)',
        border: '1px solid rgba(239,68,68,0.3)',
        boxShadow: '0 0 40px rgba(239,68,68,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>
            레버리지 위험성 시뮬레이터
          </span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(239,68,68,0.12)', color: C.red, fontWeight: 700 }}>
            투자 vs 투기
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
          음의 복리(변동성 잠식) 효과를 직접 체험하고, 나의 위험 감내도를 진단해보세요.
        </div>
      </div>

      {/* ── SECTION 1: 자본시장연구원 통계 카드 ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* 일반 ETF */}
        <div style={{
          padding: '18px 20px', borderRadius: 12,
          background: C.greenDim, border: `1px solid rgba(34,197,94,0.25)`,
        }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>
            자본시장연구원 통계 · 해외주식 일반 ETF
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.green, fontFamily: 'monospace', marginBottom: 4 }}>
            +25%
          </div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
            🟢 꾸준히 분산·장기 보유한<br />
            일반 ETF 투자자 평균 수익률
          </div>
        </div>

        {/* 고배율 레버리지 */}
        <div style={{
          padding: '18px 20px', borderRadius: 12,
          background: C.redDim, border: `1px solid rgba(239,68,68,0.3)`,
        }}>
          <div style={{ fontSize: 10, color: C.textLow, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>
            자본시장연구원 통계 · 고배율 레버리지 ETF
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.red, fontFamily: 'monospace', marginBottom: 4 }}>
            -33%
          </div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>
            🔴 시장 타이밍을 노린<br />
            고배율 레버리지 투자자 평균 수익률
          </div>
        </div>
      </div>

      {/* 린치 경고 */}
      <div style={{
        padding: '12px 18px', borderRadius: 10,
        background: C.goldDim, border: `1px solid rgba(245,158,11,0.3)`,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: C.gold, lineHeight: 1.7, fontWeight: 500 }}>
          <strong>&ldquo;시장의 타이밍을 맞추려는 3배 레버리지는 결국 음의 복리로 수렴합니다.&rdquo;</strong>
          <span style={{ color: C.textSub, fontWeight: 400 }}>
            {' '}— 횡보하는 시장에서 레버리지는 방향이 맞아도 손실이 납니다.
          </span>
        </div>
      </div>

      {/* ── SECTION 2: 인터랙티브 레버리지 시뮬레이터 ────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.gold, marginBottom: 2 }}>
            📊 레버리지 배수별 복리 시뮬레이터
          </div>
          <div style={{ fontSize: 11, color: C.textSub }}>
            시장 조건을 선택하고 변동폭·기간을 조정하여 레버리지의 실제 위력을 확인하세요
          </div>
        </div>

        {/* ── 시나리오 선택 토글 ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '5px',
          background: C.card2, borderRadius: 10, border: `1px solid ${C.border}`,
          marginBottom: 20,
        }}>
          {SCENARIOS.map(sc => {
            const isActive = scenario === sc.id
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenario(sc.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  transition: 'all 0.18s',
                  background: isActive ? `${sc.color}18` : 'transparent',
                  outline: isActive ? `1.5px solid ${sc.color}55` : 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? sc.color : C.textLow }}>
                  {sc.icon} {sc.label}
                </span>
                <span style={{ fontSize: 9, color: isActive ? `${sc.color}cc` : C.textLow }}>
                  {sc.desc}
                </span>
                {isActive && (
                  <div style={{
                    width: '50%', height: 2, borderRadius: 999, marginTop: 2,
                    background: `linear-gradient(90deg, transparent, ${sc.color}, transparent)`,
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── 슬라이더 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Slider
            label="일일 변동폭"
            value={dailyPct} min={1} max={15} step={0.5}
            unit="%" color={C.gold} onChange={setDailyPct}
          />
          <Slider
            label={scenario === 'sideways' ? '반복 일수 (짝수 기준)' : '경과 일수'}
            value={days} min={4} max={60} step={scenario === 'sideways' ? 2 : 1}
            unit="일" color={C.blue} onChange={setDays}
          />
        </div>

        {/* ── 횡보장 전용 수식 원리 카드 ── */}
        {scenario === 'sideways' && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20,
          }}>
            {[
              { label: '1배 (기초자산)', formula: `(1+${(dailyPct/100).toFixed(2)})(1-${(dailyPct/100).toFixed(2)})`, result: oneCycle.base, color: C.blue },
              { label: '2배 레버리지',  formula: `(1+${(dailyPct*2/100).toFixed(2)})(1-${(dailyPct*2/100).toFixed(2)})`, result: oneCycle.lev2, color: C.gold },
              { label: '3배 레버리지',  formula: `(1+${(dailyPct*3/100).toFixed(2)})(1-${(dailyPct*3/100).toFixed(2)})`, result: oneCycle.lev3, color: C.red },
            ].map(item => {
              const loss = parseFloat((100 - item.result).toFixed(4))
              return (
                <div key={item.label} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: C.card2, border: `1px solid ${C.border}`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: C.textLow, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 9, color: C.textLow, fontFamily: 'monospace', marginBottom: 6 }}>
                    {item.formula}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                    {item.result.toFixed(4)}
                  </div>
                  <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>
                    ↓ 1사이클 -{loss.toFixed(4)}%
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 2단 레이아웃: 좌측 차트 | 우측 테이블 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>

          {/* 좌측: 라인차트 */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, marginBottom: 8 }}>
              📈 누적 수익률 추이
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sim.data} margin={{ top: 5, right: 14, bottom: 18, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="day" tick={{ fill: C.textLow, fontSize: 9 }}
                    label={{ value: '경과 일수', position: 'insideBottom', offset: -10, fill: C.textLow, fontSize: 9 }}
                  />
                  <YAxis
                    tick={{ fill: C.textLow, fontSize: 9 }} unit="%"
                    label={{ value: '수익률(%)', angle: -90, position: 'insideLeft', offset: 14, fill: C.textLow, fontSize: 9 }}
                    width={48}
                  />
                  <Tooltip content={<DarkTip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
                    formatter={(val) => <span style={{ color: C.textSub }}>{val}</span>}
                  />
                  <ReferenceLine y={0} stroke={C.border} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="base" name="1배 (기초자산)" stroke={C.blue}
                    strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="lev2" name="2배 레버리지" stroke={C.gold}
                    strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="lev3" name="3배 레버리지" stroke={C.red}
                    strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 시나리오별 교육 메시지 */}
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: (() => {
                if (scenario === 'sideways') return C.goldDim
                if (scenario === 'bull') return C.greenDim
                return C.redDim
              })(),
              border: `1px solid ${scenario === 'sideways' ? 'rgba(245,158,11,0.25)' : scenario === 'bull' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              fontSize: 11, lineHeight: 1.7,
              color: scenario === 'sideways' ? C.gold : scenario === 'bull' ? C.green : C.red,
            }}>
              {scenario === 'sideways' && (
                <>🚨 <strong>횡보장의 덫:</strong> 방향 예측이 맞아도 레버리지는 손실! 배수가 높을수록 음의 복리 속도가 기하급수적으로 증가합니다.</>
              )}
              {scenario === 'bull' && (
                <>✅ <strong>상승장 레버리지 효과:</strong> 방향이 맞으면 레버리지 배수만큼 수익이 증폭됩니다. 단, 상승장은 언제 끝날지 아무도 모릅니다.</>
              )}
              {scenario === 'bear' && (
                <>💀 <strong>폭락장 레버리지 공포:</strong> 3배 레버리지는 3배 빠른 자산 파괴를 의미합니다. SOXL 2022년: -91.8% 낙폭이 현실이었습니다.</>
              )}
            </div>
          </div>

          {/* 우측: 최종 결과 테이블 + 시각적 게이지 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>
              📋 {days}일 후 최종 결과
            </div>

            {[
              { label: '1배 (기초자산)', val: sim.final.base, color: C.blue },
              { label: '2배 레버리지',  val: sim.final.lev2, color: C.gold },
              { label: '3배 레버리지',  val: sim.final.lev3, color: C.red },
            ].map(item => {
              const ret      = item.val - 100
              const maxAbsRet = Math.max(
                Math.abs(sim.final.base - 100),
                Math.abs(sim.final.lev2 - 100),
                Math.abs(sim.final.lev3 - 100),
                1
              )
              // 게이지: ret 기준 비율 (0~100%)
              const gaugePct = Math.min(100, (Math.abs(ret) / maxAbsRet) * 100)
              const isPos    = ret >= 0

              return (
                <div key={item.label} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: C.card2, border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: C.textLow }}>{item.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: isPos ? C.green : C.red, fontFamily: 'monospace' }}>
                      {isPos ? '+' : ''}{ret.toFixed(2)}%
                    </span>
                  </div>
                  {/* 잔존가치 */}
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.color, fontFamily: 'monospace', marginBottom: 8 }}>
                    ₩{item.val.toFixed(2)}
                  </div>
                  {/* 시각적 게이지 바 */}
                  <div style={{ height: 6, borderRadius: 999, background: '#1e293b', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${gaugePct}%`,
                      background: isPos
                        ? `linear-gradient(90deg, ${item.color}88, ${item.color})`
                        : `linear-gradient(90deg, ${C.red}88, ${C.red})`,
                      transition: 'width 0.5s ease',
                      boxShadow: `0 0 6px ${isPos ? item.color : C.red}66`,
                    }} />
                  </div>
                </div>
              )
            })}

            {/* 3배 vs 1배 손익 배율 강조 */}
            {(() => {
              const base3 = sim.final.base - 100
              const lev3  = sim.final.lev3 - 100
              if (Math.abs(base3) < 0.01) return null
              const ratio = parseFloat((Math.abs(lev3) / Math.abs(base3)).toFixed(1))
              const isBad = (scenario === 'sideways') || (scenario === 'bear')
              return (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: isBad ? C.redDim : C.greenDim,
                  border: `1px solid ${isBad ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  fontSize: 11, textAlign: 'center',
                }}>
                  <div style={{ color: isBad ? C.red : C.green, fontWeight: 800 }}>
                    3배 레버리지 영향도
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: isBad ? C.red : C.green, fontFamily: 'monospace', margin: '4px 0' }}>
                    {ratio}배
                  </div>
                  <div style={{ color: C.textSub, fontSize: 10 }}>
                    {isBad ? '1배 대비 손실 배율' : '1배 대비 수익 배율'}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: 위험 감내도 진단 ─────────────────────────────────────── */}
      <div style={{ padding: '20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: C.text, marginBottom: 4 }}>
          🧠 피터 린치 원칙 기반 — 나의 위험 감내도 진단
        </div>
        <div style={{ fontSize: 11, color: C.textSub, marginBottom: 20 }}>
          투자자인가, 투기꾼인가? 솔직하게 선택해보세요.
        </div>

        {QUIZ_QUESTIONS.map((q) => {
          const answer = quizAnswers[q.id]
          return (
            <div key={q.id} style={{ marginBottom: 20 }}>
              {/* 시나리오 헤더 */}
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '14px 16px', borderRadius: '10px 10px 0 0',
                background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.2)`,
                borderBottom: 'none',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>📌</span>
                <div>
                  <div style={{ fontSize: 10, color: C.gold, fontWeight: 800, marginBottom: 4, letterSpacing: '0.06em' }}>
                    {q.scenario}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {q.question}
                  </div>
                  <div style={{ fontSize: 10, color: C.textLow, marginTop: 4 }}>{q.note}</div>
                </div>
              </div>

              {/* 선택지 */}
              <div style={{
                border: `1px solid rgba(245,158,11,0.2)`,
                borderRadius: '0 0 10px 10px', overflow: 'hidden',
              }}>
                {q.options.map((opt, idx) => {
                  const isSelected = answer === opt.type
                  const borderColor = opt.type === 'danger'
                    ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'
                  const bgColor = isSelected
                    ? (opt.type === 'danger' ? C.redDim : C.greenDim)
                    : 'transparent'

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt.type }))}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '14px 16px',
                        background: isSelected ? bgColor : C.card2,
                        border: 'none', borderTop: `1px solid ${C.border}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                        outline: isSelected ? `2px solid ${borderColor}` : 'none',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = C.card }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = C.card2 }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          border: `2px solid ${isSelected ? (opt.type === 'danger' ? C.red : C.green) : C.border}`,
                          background: isSelected ? (opt.type === 'danger' ? C.red : C.green) : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <span style={{ fontSize: 10, color: '#fff' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 12, color: isSelected ? C.text : C.textSub, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                          {opt.text}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* 선택 후 결과 */}
              {answer && (() => {
                const selected = q.options.find(o => o.type === answer)!.result
                return (
                  <div style={{
                    marginTop: 10, padding: '12px 16px', borderRadius: 10,
                    background: answer === 'danger' ? C.redDim : C.greenDim,
                    border: `1px solid ${answer === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    animation: 'fadeIn 0.3s ease',
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{selected.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: selected.color, marginBottom: 5 }}>
                        {selected.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.7 }}>
                        {selected.desc}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}

        {/* 종합 판정 */}
        {riskProfile && (
          <div style={{
            marginTop: 8, padding: '18px 20px', borderRadius: 12,
            background: riskProfile.level === 'safe' ? C.greenDim
              : riskProfile.level === 'extreme' ? C.redDim : C.goldDim,
            border: `1px solid ${riskProfile.color}44`,
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: riskProfile.color, marginBottom: 10 }}>
              📊 종합 위험 감내도 판정: {riskProfile.label}
            </div>
            {riskProfile.level === 'extreme' && (
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
                <strong style={{ color: C.red }}>⚠ 즉시 점검이 필요합니다.</strong>
                {' '}피터 린치는 &ldquo;주식으로 잃어서는 안 되는 돈을 투자에 넣는 것&rdquo;을 가장 위험한 행동으로 꼽았습니다.
                레버리지 상품을 완전히 이해하기 전까지는 절대 투자하지 않는 것을 권장합니다.
              </div>
            )}
            {riskProfile.level === 'moderate' && (
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
                일부 투기적 성향이 감지됩니다. <strong style={{ color: C.gold }}>투자 원칙서를 작성</strong>하고,
                모든 투자 결정 전 &ldquo;이 돈을 잃어도 내 생활에 지장이 없는가?&rdquo;를 먼저 자문해보세요.
              </div>
            )}
            {riskProfile.level === 'safe' && (
              <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>
                👏 훌륭합니다. 감정이 아닌 원칙으로 투자하는 자세가 장기적으로 시장을 이깁니다.
                피터 린치의 말처럼, <strong style={{ color: C.green }}>&ldquo;최고의 투자자는 가장 인내심 있는 투자자&rdquo;</strong>입니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 하단 교육 요약 ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px', borderRadius: 12,
        background: C.card2, border: `1px solid ${C.border}`,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12,
        fontSize: 11, color: C.textLow, lineHeight: 1.7,
      }}>
        <div>
          <span style={{ color: C.gold, fontWeight: 700 }}>📌 변동성 잠식이란?</span><br />
          횡보 시장에서 레버리지는 방향이 맞아도 손실이 납니다.
          배수가 높을수록 같은 등락률에서 더 빠르게 자산이 줄어듭니다.
        </div>
        <div>
          <span style={{ color: C.red, fontWeight: 700 }}>🔴 레버리지 = 시간의 적</span><br />
          장기 보유할수록 일일 리셋 구조로 인해 원래 자산 대비
          수익률이 구조적으로 하락합니다. 단기 전술 도구입니다.
        </div>
        <div>
          <span style={{ color: C.green, fontWeight: 700 }}>🟢 피터 린치의 해법</span><br />
          &ldquo;10배 주식은 레버리지가 아닌 훌륭한 기업 발굴에서 나온다.&rdquo;
          인내와 분산 투자가 복리의 마법을 만듭니다.
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px;
          border-radius: 50%; background: #f59e0b;
          border: 2px solid #0a0e1a; cursor: pointer;
          box-shadow: 0 0 6px rgba(245,158,11,0.5);
        }
        input[type=range]::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: #f59e0b; border: 2px solid #0a0e1a; cursor: pointer;
        }
      `}</style>
    </div>
  )
}
