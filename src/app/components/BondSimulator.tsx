'use client'

/**
 * BondSimulator — 매크로 & 채권 시뮬레이터
 *
 * ◆ 구성
 *  1. 매크로 신호등   — 경기·물가 토글 + 금리 인하 기대감 신호
 *  2. 채권 가격 계산기 — 금리 슬라이더 + 만기별 현재가치(PV) 실시간 계산
 *  3. 볼록성 시각화   — Recharts 가격-금리 곡선 + 비대칭 손익 카드
 *  4. 핵심 요약 노트  — 듀레이션·볼록성 카드 + 퀴즈 토글
 *
 * ◆ 금융 수식
 *  채권 PV = Σ[C / (1+r)^t]  +  F / (1+r)^n
 *    C = 표면이자(쿠폰)  r = 유통금리  n = 만기  F = 원금(1000)
 */

import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  BookOpen, HelpCircle, ChevronDown, ChevronUp,
  Zap, BarChart2, Activity, DollarSign,
} from 'lucide-react'

// ── 디자인 토큰 (기존 macro-hub 팔레트 통일) ──────────────────────────────
const C = {
  bg:       '#020617',
  surface:  '#06101f',
  card:     '#0a1929',
  cardHi:   '#0d2137',
  border:   '#0f2a45',
  neon:     '#deff9a',
  blue:     '#38bdf8',
  cyan:     '#22d3ee',
  orange:   '#fb923c',
  red:      '#f87171',
  purple:   '#a78bfa',
  gold:     '#fbbf24',
  gray:     '#7f93a8',
  textHi:   '#f1f5f9',
  textMid:  '#94a3b8',
  textLow:  '#8599ae',
}

// ── 채권 현재가치(PV) 계산 ────────────────────────────────────────────────
// F=1000, coupon=3%, n=만기년수, r=유통금리(소수)
function bondPV(r: number, n: number, coupon = 0.03, face = 1000): number {
  if (r <= 0) r = 0.0001  // div-by-zero 방지
  let pv = 0
  const c = coupon * face
  for (let t = 1; t <= n; t++) {
    pv += c / Math.pow(1 + r, t)
  }
  pv += face / Math.pow(1 + r, n)
  return pv
}

// ── 만기별 설정 ──────────────────────────────────────────────────────────
const MATURITIES = [
  { label: '1년 단기채',   n: 1,  color: C.blue,   icon: '🔵' },
  { label: '3년 중기채',   n: 3,  color: C.cyan,   icon: '🟦' },
  { label: '10년 장기채',  n: 10, color: C.neon,   icon: '🟩' },
  { label: '30년 초장기채', n: 30, color: C.orange, icon: '🔶' },
]

const BASE_RATE = 0.03  // 표면금리 = 기준 유통금리

// ── 볼록성 차트 데이터 생성 (금리 0~10%, 0.25% 간격) ──────────────────
function buildConvexityData() {
  const data = []
  for (let r = 0.25; r <= 10; r += 0.25) {
    const rDec = r / 100
    data.push({
      rate: r,
      '1년':  +bondPV(rDec, 1).toFixed(2),
      '3년':  +bondPV(rDec, 3).toFixed(2),
      '10년': +bondPV(rDec, 10).toFixed(2),
      '30년': +bondPV(rDec, 30).toFixed(2),
    })
  }
  return data
}

const CONVEXITY_DATA = buildConvexityData()

// ── 퀴즈 데이터 ───────────────────────────────────────────────────────────
const QUIZZES = [
  {
    q: 'Q1. 금리가 1% 상승하면 30년 초장기채 가격은 어떻게 될까요?',
    options: ['A) 약 +14.7% 상승', 'B) 약 -14.7% 하락', 'C) 변화 없음', 'D) 약 -1% 하락'],
    answer: 1,
    explanation:
      '✅ 정답: B) 약 -14.7% 하락\n\n듀레이션이 길수록 금리 변화에 대한 가격 민감도가 높습니다. 30년 초장기채는 수십 번의 이자 흐름이 모두 금리 변화에 영향받아 단기채보다 훨씬 크게 하락합니다. 이것이 "장기채 투자 리스크"입니다.',
  },
  {
    q: 'Q2. 볼록성(Convexity)이란 무엇인가요?',
    options: [
      'A) 금리 상승 시 손실과 금리 하락 시 이익이 정확히 대칭적이라는 원리',
      'B) 금리 하락 시 가격 상승폭이 금리 상승 시 가격 하락폭보다 더 크다는 비대칭성',
      'C) 만기가 짧을수록 금리에 민감하다는 원리',
      'D) 표면금리가 높을수록 채권 가격이 안정된다는 원리',
    ],
    answer: 1,
    explanation:
      '✅ 정답: B) 비대칭성\n\n볼록성의 핵심은 비대칭입니다. 30년 초장기채 기준 금리 1% 상승 시 -14.7% 손실이지만, 금리 1% 하락 시 +19.9% 수익입니다. 투자자 입장에서는 "손실보다 이익이 더 크다"는 놀라운 특성이 있습니다. 금리 인하 사이클에서 장기채가 폭발적으로 수익을 내는 이유입니다.',
  },
  {
    q: 'Q3. 경기 둔화 + 물가 하락 국면에서 가장 유리한 자산은?',
    options: [
      'A) 단기 예금',
      'B) 주식(성장주)',
      'C) 장기 국채',
      'D) 원자재(금·원유)',
    ],
    answer: 2,
    explanation:
      '✅ 정답: C) 장기 국채\n\n경기 둔화 + 물가 하락은 중앙은행의 금리 인하 기대감을 높입니다. 금리 인하 → 채권 가격 상승. 특히 30년 초장기채는 볼록성 덕분에 폭발적인 가격 상승을 경험합니다. 최일 선생님의 핵심 전략이기도 합니다.',
  },
]

// ════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ════════════════════════════════════════════════════════════════
export default function BondSimulator() {
  // ── 1. 매크로 신호등 상태 ──────────────────────────────────────
  const [economy, setEconomy] = useState<'boom' | 'slowdown'>('boom')
  const [inflation, setInflation] = useState<'up' | 'down'>('up')

  // ── 2. 금리 슬라이더 ──────────────────────────────────────────
  const [rate, setRate] = useState(3.0)  // % 단위

  // ── 3. 퀴즈 상태 ──────────────────────────────────────────────
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([null, null, null])
  const [showAnswer, setShowAnswer] = useState<boolean[]>([false, false, false])
  const [selectedOptions, setSelectedOptions] = useState<(number | null)[]>([null, null, null])

  // ── 매크로 신호 계산 ──────────────────────────────────────────
  const macroSignal = economy === 'slowdown' && inflation === 'down'
  const macroSignalPartial = (economy === 'slowdown' && inflation === 'up') ||
                              (economy === 'boom'     && inflation === 'down')

  // ── 채권 가격 계산 ────────────────────────────────────────────
  const rDec = rate / 100
  const bondData = useMemo(() =>
    MATURITIES.map(m => {
      const base    = bondPV(BASE_RATE, m.n)  // 3% 기준가
      const current = bondPV(rDec, m.n)       // 현재 금리 기준가
      const chg     = ((current - base) / base) * 100
      return { ...m, base, current, chg }
    }), [rDec])

  // ── 볼록성 비교 (30년, ±1%) ──────────────────────────────────
  const base30    = bondPV(BASE_RATE, 30)
  const up30      = bondPV(BASE_RATE + 0.01, 30)
  const down30    = bondPV(BASE_RATE - 0.01, 30)
  const convUp    = ((up30   - base30) / base30) * 100   // 금리 +1% 시 가격 변화율
  const convDown  = ((down30 - base30) / base30) * 100   // 금리 -1% 시 가격 변화율

  // ── 퀴즈 핸들러 ──────────────────────────────────────────────
  const handleSelect = useCallback((qi: number, oi: number) => {
    setSelectedOptions(prev => { const n = [...prev]; n[qi] = oi; return n })
    setQuizAnswers(prev => { const n = [...prev]; n[qi] = oi; return n })
  }, [])

  const toggleAnswer = useCallback((qi: number) => {
    setShowAnswer(prev => { const n = [...prev]; n[qi] = !n[qi]; return n })
  }, [])

  // ── 현재 금리 점 — find 대신 정확한 가격 직접 계산 (항상 존재) ──
  const currentPrices = useMemo(() => {
    const rDec = rate / 100
    return {
      '1년':  bondPV(rDec, 1),
      '3년':  bondPV(rDec, 3),
      '10년': bondPV(rDec, 10),
      '30년': bondPV(rDec, 30),
    }
  }, [rate])

  // ── 공통 스타일 헬퍼 ─────────────────────────────────────────
  const card = (extra?: string) =>
    `rounded-xl border p-4 ${extra ?? ''}`
  const cardStyle = { background: C.card, borderColor: C.border }

  return (
    <div style={{ background: C.bg, color: C.textHi, minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}
      className="p-4 md:p-6 space-y-6">

      {/* ── 헤더 ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg" style={{ background: `${C.neon}18` }}>
          <Activity size={22} color={C.neon} />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight" style={{ color: C.textHi }}>
            매크로 & 채권 시뮬레이터
          </h1>
          <p className="text-xs mt-0.5" style={{ color: C.textLow }}>
            금리·경기·물가 연동 채권 가격 실시간 시뮬레이션 | 최일 투자학교
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          섹션 1 : 매크로 신호등
      ══════════════════════════════════════════════════════════ */}
      <div className={card()} style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} color={C.gold} />
          <span className="text-sm font-bold" style={{ color: C.textHi }}>매크로 신호등</span>
          <span className="text-xs ml-1" style={{ color: C.textLow }}>현재 경기·물가 국면을 선택하세요</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* 경기 토글 */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.textLow }}>
              📊 경기 상태
            </div>
            <div className="flex gap-2">
              {[
                { key: 'boom',     label: '호황 🚀', color: C.neon,   bg: `${C.neon}18`   },
                { key: 'slowdown', label: '둔화 📉', color: C.red,    bg: `${C.red}18`    },
              ].map(({ key, label, color, bg }) => (
                <button
                  key={key}
                  onClick={() => setEconomy(key as 'boom' | 'slowdown')}
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all duration-200 border"
                  style={{
                    background:   economy === key ? bg   : C.surface,
                    color:        economy === key ? color : C.textLow,
                    borderColor:  economy === key ? color : C.border,
                    transform:    economy === key ? 'scale(1.02)' : 'scale(1)',
                    boxShadow:    economy === key ? `0 0 12px ${color}44` : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 물가 토글 */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.textLow }}>
              🌡 물가 상태
            </div>
            <div className="flex gap-2">
              {[
                { key: 'up',   label: '상승 🔥', color: C.orange, bg: `${C.orange}18` },
                { key: 'down', label: '하락 ❄️', color: C.blue,   bg: `${C.blue}18`   },
              ].map(({ key, label, color, bg }) => (
                <button
                  key={key}
                  onClick={() => setInflation(key as 'up' | 'down')}
                  className="flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all duration-200 border"
                  style={{
                    background:  inflation === key ? bg   : C.surface,
                    color:       inflation === key ? color : C.textLow,
                    borderColor: inflation === key ? color : C.border,
                    transform:   inflation === key ? 'scale(1.02)' : 'scale(1)',
                    boxShadow:   inflation === key ? `0 0 12px ${color}44` : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 매크로 신호 배지 */}
        {macroSignal ? (
          <div className="rounded-xl p-4 border flex items-center gap-3 animate-pulse"
            style={{ background: `${C.neon}12`, borderColor: `${C.neon}55` }}>
            <CheckCircle2 size={22} color={C.neon} />
            <div>
              <div className="text-sm font-black" style={{ color: C.neon }}>
                🟢 금리 인하 기대감 상승 → 채권 매수 적기!
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.textMid }}>
                경기 둔화 + 물가 하락 = 중앙은행 금리 인하 압박 증가 · 장기채 가격 상승 기대
              </div>
            </div>
          </div>
        ) : macroSignalPartial ? (
          <div className="rounded-xl p-4 border flex items-center gap-3"
            style={{ background: `${C.gold}10`, borderColor: `${C.gold}44` }}>
            <AlertCircle size={22} color={C.gold} />
            <div>
              <div className="text-sm font-bold" style={{ color: C.gold }}>
                🟡 신호 혼조 — 관망 구간
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.textMid }}>
                경기·물가 중 하나만 충족. 금리 방향성 불확실 · 단기채 위주 포지션 권장
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-4 border flex items-center gap-3"
            style={{ background: `${C.red}10`, borderColor: `${C.red}44` }}>
            <AlertCircle size={22} color={C.red} />
            <div>
              <div className="text-sm font-bold" style={{ color: C.red }}>
                🔴 채권 매수 비적기 — 금리 상승 리스크
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.textMid }}>
                경기 호황 + 물가 상승 = 금리 인상 압박 · 채권 가격 하락 위험
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          섹션 2+3 : 채권 계산기  +  볼록성 차트 (좌우 분할)
      ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ─── 좌: 금리 슬라이더 + 채권 가격 ──────────────────── */}
        <div className={card()} style={cardStyle}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} color={C.blue} />
            <span className="text-sm font-bold" style={{ color: C.textHi }}>실시간 채권 가격 계산기</span>
          </div>

          {/* 금리 슬라이더 */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold" style={{ color: C.textLow }}>시장 유통금리</span>
              <span className="text-2xl font-black tabular-nums"
                style={{ color: rate > BASE_RATE * 100 ? C.red : rate < BASE_RATE * 100 ? C.neon : C.blue }}>
                {rate.toFixed(1)}%
                {rate > BASE_RATE * 100 && <span className="text-sm ml-1">↑ {(rate - 3).toFixed(1)}%p</span>}
                {rate < BASE_RATE * 100 && <span className="text-sm ml-1">↓ {(3 - rate).toFixed(1)}%p</span>}
                {rate === BASE_RATE * 100 && <span className="text-sm ml-1 font-normal" style={{ color: C.textLow }}>(기준)</span>}
              </span>
            </div>
            <input
              type="range"
              min={0} max={10} step={0.1}
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${C.neon} 0%, ${C.neon} ${rate * 10}%, ${C.border} ${rate * 10}%, ${C.border} 100%)`,
                accentColor: C.neon,
              }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: C.textLow }}>
              <span>0%</span><span>2.5%</span><span>5%</span><span>7.5%</span><span>10%</span>
            </div>
            <div className="text-xs text-center mt-1" style={{ color: C.textLow }}>
              ← 슬라이더를 움직이면 채권 가격이 실시간으로 변합니다
            </div>
          </div>

          {/* 설정 정보 */}
          <div className="flex gap-2 mb-4 text-xs flex-wrap">
            {[
              { label: '표면금리(쿠폰)', value: '3.00%' },
              { label: '원금(액면가)', value: '₩1,000' },
              { label: '기준 금리', value: '3.00%' },
            ].map(({ label, value }) => (
              <div key={label} className="px-2.5 py-1.5 rounded-lg border" style={{ background: C.surface, borderColor: C.border }}>
                <span style={{ color: C.textLow }}>{label}: </span>
                <span className="font-bold" style={{ color: C.textMid }}>{value}</span>
              </div>
            ))}
          </div>

          {/* 만기별 채권 가격 카드 */}
          <div className="space-y-2">
            {bondData.map(({ label, n, color, icon, base, current, chg }) => (
              <div key={n} className="rounded-lg p-3 border flex items-center gap-3"
                style={{ background: C.surface, borderColor: `${color}33` }}>
                <span className="text-lg">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color }}>{label}</div>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span className="text-lg font-black tabular-nums" style={{ color: C.textHi }}>
                      ₩{current.toFixed(2)}
                    </span>
                    <span className="text-xs" style={{ color: C.textLow }}>
                      기준가 ₩{base.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black tabular-nums flex items-center gap-0.5 justify-end`}
                    style={{ color: chg > 0 ? C.neon : chg < 0 ? C.red : C.textLow }}>
                    {chg > 0 ? <TrendingUp size={14} /> : chg < 0 ? <TrendingDown size={14} /> : null}
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.textLow }}>
                    {chg > 0 ? '가격 상승' : chg < 0 ? '가격 하락' : '변동 없음'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 핵심 인사이트 */}
          <div className="mt-4 rounded-lg p-3 border-l-4 text-xs"
            style={{ background: `${C.neon}08`, borderColor: C.neon, color: C.textMid }}>
            <span className="font-bold" style={{ color: C.neon }}>💡 핵심: </span>
            만기가 길수록 금리 변화에 대한 가격 변동폭이 <strong>기하급수적으로</strong> 커집니다.
            30년 초장기채는 1년 단기채보다 약 <strong>20~25배</strong> 더 민감합니다.
          </div>
        </div>

        {/* ─── 우: 볼록성 차트 ──────────────────────────────── */}
        <div className="space-y-4">

          {/* 가격-금리 곡선 */}
          <div className={card()} style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={16} color={C.purple} />
              <span className="text-sm font-bold" style={{ color: C.textHi }}>볼록성(Convexity) 가격 곡선</span>
            </div>
            <div className="text-xs mb-3" style={{ color: C.textLow }}>
              금리(X축)↑ → 채권 가격(Y축)↓, 곡선이 직선이 아닌 &apos;볼록한 곡선&apos;인 것이 핵심
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={CONVEXITY_DATA} margin={{ top: 24, right: 80, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis
                  dataKey="rate"
                  type="number"
                  domain={[0.25, 10]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fill: C.textLow, fontSize: 10 }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1900]}
                  tickFormatter={v => `₩${v}`}
                  tick={{ fill: C.textLow, fontSize: 10 }}
                  axisLine={{ stroke: C.border }}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                  labelFormatter={v => `금리 ${v}%`}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [`₩${(value as number).toFixed(1)}`, `${String(name)}만기`]}
                />

                {/* ① 쿠폰(표면금리 = 3%) 기준선 */}
                <ReferenceLine
                  x={3}
                  stroke={C.blue}
                  strokeDasharray="2 5"
                  strokeWidth={1}
                  label={{ value: '쿠폰 3%', position: 'insideTopLeft', fill: C.blue, fontSize: 9 }}
                />

                {/* ② 현재 유통금리 세로선 + 4개 가격 말풍선을 한 번에 렌더
                    ★ key 제거 → remount 없이 content 클로저만 업데이트
                    ★ XAxis type=number 덕분에 임의 소수점 x 위치도 정확히 렌더
                    viewBox = {x: linePixelX, y: plotTop, width:0, height: plotHeight}
                    → pixelY(p) = plotTop + plotH × (1 − p / Y_MAX) */}
                <ReferenceLine
                  x={rate}
                  stroke={C.cyan}
                  strokeDasharray="5 3"
                  strokeWidth={2}
                  label={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content: (props: any) => {
                      const lx: number      = props.viewBox?.x      ?? 0
                      const plotTop: number = props.viewBox?.y      ?? 24
                      const plotH: number   = props.viewBox?.height ?? 240
                      const Y_MAX           = 1900

                      const rateStr = `${rate.toFixed(1)}%`
                      const rateBW  = Math.max(44, rateStr.length * 8 + 12)

                      // ── 만기별 dot 픽셀 Y (currentPrices 직접 계산값 사용) ─
                      const items = MATURITIES.map(m => {
                        const dk   = m.label.split('년')[0] + '년'
                        const yVal = (currentPrices as Record<string, number>)[dk] ?? 0
                        const dotY = plotTop + plotH * (1 - yVal / Y_MAX)
                        return { m, yVal, dotY }
                      })

                      // dotY 오름차순 정렬 (위→아래)
                      items.sort((a, b) => a.dotY - b.dotY)

                      // 24px 최소 간격 스택
                      const MIN_GAP = 24
                      const stackY: number[] = []
                      for (let i = 0; i < items.length; i++) {
                        const nat = items[i].dotY
                        stackY.push(i === 0 ? nat : Math.max(nat, stackY[i - 1] + MIN_GAP))
                      }

                      const BW = 72, BH = 20
                      // lx > 680 → 차트 우측 끝에 가까우면 라벨을 왼쪽에 배치
                      const onLeft = lx > 680

                      return (
                        <g>
                          {/* 금리 뱃지 */}
                          <rect x={lx - rateBW / 2} y={plotTop - 22} width={rateBW} height={20} rx={5}
                            fill={C.cyan} opacity={0.93} />
                          <text x={lx} y={plotTop - 8} textAnchor="middle"
                            fill="#020617" fontSize={10} fontWeight={800}>{rateStr}</text>

                          {/* 가격 말풍선 + dot + 연결선 */}
                          {items.map((it, i) => {
                            const sy  = stackY[i]
                            const bx  = onLeft ? lx - BW - 10 : lx + 10
                            const cx1 = onLeft ? lx - 8 : lx + 8
                            const cx2 = onLeft ? bx + BW : bx

                            return (
                              <g key={it.m.label}>
                                {/* dot */}
                                <circle cx={lx} cy={it.dotY} r={it.m.n === 30 ? 7 : 5}
                                  fill={it.m.color} stroke="#020617" strokeWidth={2} />
                                {/* 연결선 */}
                                <line x1={cx1} y1={it.dotY} x2={cx2} y2={sy}
                                  stroke={it.m.color} strokeWidth={1}
                                  strokeDasharray="2 3" opacity={0.55} />
                                {/* 말풍선 */}
                                <rect x={bx} y={sy - BH / 2} width={BW} height={BH} rx={5}
                                  fill={C.card} stroke={it.m.color} strokeWidth={1.5} opacity={0.97} />
                                <text x={bx + BW / 2} y={sy}
                                  textAnchor="middle" dominantBaseline="middle"
                                  fill={it.m.color} fontSize={9} fontWeight={700}>
                                  {it.m.n}yr ₩{it.yVal.toFixed(0)}
                                </text>
                              </g>
                            )
                          })}
                        </g>
                      )
                    },
                  }}
                />

                {/* ③ 만기별 가격 곡선 */}
                {MATURITIES.map(m => (
                  <Line
                    key={m.label}
                    type="monotone"
                    dataKey={m.label.split('년')[0] + '년'}
                    stroke={m.color}
                    strokeWidth={m.n === 30 ? 3 : m.n === 10 ? 2 : 1.5}
                    dot={false}
                    activeDot={{ r: 5, stroke: C.bg, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* 범례 */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {MATURITIES.map(m => (
                <div key={m.label} className="flex items-center gap-1.5 text-xs">
                  <div className="w-4 h-0.5 rounded" style={{ background: m.color, height: m.n === 30 ? 3 : 2 }} />
                  <span style={{ color: C.textMid }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 볼록성 비교 카드 (30년 ±1%) */}
          <div className={card()} style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} color={C.orange} />
              <span className="text-sm font-bold" style={{ color: C.textHi }}>30년 초장기채 볼록성 분석</span>
            </div>
            <div className="text-xs mb-3" style={{ color: C.textLow }}>
              표면금리 3% 기준에서 시장금리가 ±1% 변동할 때
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* 금리 +1% (채권 가격 하락) */}
              <div className="rounded-xl p-4 border text-center"
                style={{ background: `${C.red}10`, borderColor: `${C.red}44` }}>
                <div className="text-xs font-bold mb-1" style={{ color: C.red }}>금리 3% → 4% (+1%p)</div>
                <div className="text-2xl font-black tabular-nums" style={{ color: C.red }}>
                  <TrendingDown className="inline mr-1" size={20} />
                  {convUp.toFixed(1)}%
                </div>
                <div className="text-xs mt-1" style={{ color: C.textLow }}>채권 가격 손실</div>
                <div className="text-xs mt-2 p-2 rounded-lg" style={{ background: C.surface, color: C.textMid }}>
                  ₩1,000 → ₩{up30.toFixed(0)}
                </div>
              </div>

              {/* 금리 -1% (채권 가격 상승) */}
              <div className="rounded-xl p-4 border text-center"
                style={{ background: `${C.neon}10`, borderColor: `${C.neon}44` }}>
                <div className="text-xs font-bold mb-1" style={{ color: C.neon }}>금리 3% → 2% (-1%p)</div>
                <div className="text-2xl font-black tabular-nums" style={{ color: C.neon }}>
                  <TrendingUp className="inline mr-1" size={20} />
                  +{convDown.toFixed(1)}%
                </div>
                <div className="text-xs mt-1" style={{ color: C.textLow }}>채권 가격 이익</div>
                <div className="text-xs mt-2 p-2 rounded-lg" style={{ background: C.surface, color: C.textMid }}>
                  ₩1,000 → ₩{down30.toFixed(0)}
                </div>
              </div>
            </div>

            {/* 비대칭 시각화 바 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold" style={{ color: C.textLow }}>손익 비대칭 비율</div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-14 text-right" style={{ color: C.red }}>손실{Math.abs(convUp).toFixed(1)}%</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden flex">
                  <div className="h-full rounded-l-full transition-all"
                    style={{ width: `${Math.abs(convUp) / Math.abs(convDown) * 100}%`, background: C.red }} />
                </div>
                <div className="flex-1 h-3 rounded-full overflow-hidden flex justify-end">
                  <div className="h-full rounded-r-full w-full"
                    style={{ background: C.neon }} />
                </div>
                <span className="text-xs w-14" style={{ color: C.neon }}>+{Math.abs(convDown).toFixed(1)}%이익</span>
              </div>
              <div className="text-xs text-center font-bold mt-1" style={{ color: C.gold }}>
                🎯 이익이 손실보다 {(Math.abs(convDown) / Math.abs(convUp)).toFixed(2)}배 크다! → 볼록성의 마법
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          섹션 4 : 핵심 요약 노트
      ══════════════════════════════════════════════════════════ */}
      <div className={card()} style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} color={C.cyan} />
          <span className="text-sm font-bold" style={{ color: C.textHi }}>최일 선생님의 채권 대전제 — 핵심 요약</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 카드 1: 듀레이션 */}
          <div className="rounded-xl p-4 border space-y-2"
            style={{ background: C.surface, borderColor: `${C.blue}44` }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${C.blue}20` }}>⏱</div>
              <span className="text-sm font-bold" style={{ color: C.blue }}>듀레이션(Duration)</span>
            </div>
            <ul className="space-y-1.5 text-xs" style={{ color: C.textMid }}>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.blue }}>▸</span>
                채권의 <strong style={{ color: C.textHi }}>금리 민감도</strong>를 측정하는 지표
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.blue }}>▸</span>
                만기가 길수록 듀레이션 ↑ → 금리 변화에 <strong style={{ color: C.textHi }}>더 크게 반응</strong>
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.blue }}>▸</span>
                30년채 듀레이션 ≈ 20년, 1년채 ≈ 0.97년
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.blue }}>▸</span>
                <strong style={{ color: C.textHi }}>금리 1% 변화 시 가격 변화율 ≈ -듀레이션%</strong>
              </li>
            </ul>
            <div className="rounded-lg p-2 text-xs" style={{ background: `${C.blue}12`, color: C.blue }}>
              📌 금리 인하 기대 시 → 듀레이션 긴 채권 매수
            </div>
          </div>

          {/* 카드 2: 볼록성 */}
          <div className="rounded-xl p-4 border space-y-2"
            style={{ background: C.surface, borderColor: `${C.neon}44` }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${C.neon}20` }}>∿</div>
              <span className="text-sm font-bold" style={{ color: C.neon }}>볼록성(Convexity)</span>
            </div>
            <ul className="space-y-1.5 text-xs" style={{ color: C.textMid }}>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.neon }}>▸</span>
                가격-금리 관계가 직선이 아닌 <strong style={{ color: C.textHi }}>볼록 곡선</strong>
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.neon }}>▸</span>
                <strong style={{ color: C.textHi }}>금리↓ 이익 &gt; 금리↑ 손실</strong> (비대칭)
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.neon }}>▸</span>
                30년채: 금리 -1% → +{Math.abs(convDown).toFixed(1)}%, 금리 +1% → {convUp.toFixed(1)}%
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.neon }}>▸</span>
                볼록성이 클수록 투자자에게 유리
              </li>
            </ul>
            <div className="rounded-lg p-2 text-xs" style={{ background: `${C.neon}12`, color: C.neon }}>
              📌 볼록성의 마법 = 비대칭 수익 구조
            </div>
          </div>

          {/* 카드 3: 매크로 전략 */}
          <div className="rounded-xl p-4 border space-y-2"
            style={{ background: C.surface, borderColor: `${C.gold}44` }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${C.gold}20` }}>🎯</div>
              <span className="text-sm font-bold" style={{ color: C.gold }}>최일 전략 프레임</span>
            </div>
            <ul className="space-y-1.5 text-xs" style={{ color: C.textMid }}>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.gold }}>▸</span>
                <strong style={{ color: C.textHi }}>경기둔화 + 물가하락</strong> = 금리인하 환경
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.gold }}>▸</span>
                금리인하 사이클 진입 전 <strong style={{ color: C.textHi }}>장기채 선취</strong>
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.gold }}>▸</span>
                30년 초장기채 = 주식 대체 성장자산
              </li>
              <li className="flex items-start gap-1.5">
                <span style={{ color: C.gold }}>▸</span>
                볼록성으로 인해 이익/손실 <strong style={{ color: C.textHi }}>비대칭 우위</strong>
              </li>
            </ul>
            <div className="rounded-lg p-2 text-xs" style={{ background: `${C.gold}12`, color: C.gold }}>
              📌 채권 = 매크로 퍼즐의 핵심 조각
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          섹션 5 : 오늘의 요약 퀴즈
      ══════════════════════════════════════════════════════════ */}
      <div className={card()} style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={16} color={C.purple} />
          <span className="text-sm font-bold" style={{ color: C.textHi }}>오늘의 요약 퀴즈</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${C.purple}20`, color: C.purple }}>
            {quizAnswers.filter((a, i) => a === QUIZZES[i].answer).length} / {QUIZZES.length} 정답
          </span>
        </div>

        <div className="space-y-5">
          {QUIZZES.map((quiz, qi) => {
            const selected = selectedOptions[qi]
            const answered = selected !== null
            const correct  = selected === quiz.answer
            const visible  = showAnswer[qi]

            return (
              <div key={qi} className="rounded-xl border p-4 space-y-3"
                style={{
                  background:  answered && correct ? `${C.neon}08`  : answered ? `${C.red}08` : C.surface,
                  borderColor: answered && correct ? `${C.neon}44`  : answered ? `${C.red}44` : C.border,
                }}>

                <div className="text-sm font-semibold" style={{ color: C.textHi }}>{quiz.q}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quiz.options.map((opt, oi) => {
                    const isSelected = selected === oi
                    const isCorrect  = oi === quiz.answer
                    const showCorrectHint = answered && isCorrect

                    return (
                      <button
                        key={oi}
                        onClick={() => !answered && handleSelect(qi, oi)}
                        disabled={answered}
                        className="text-left px-3 py-2.5 rounded-lg text-xs border transition-all font-medium"
                        style={{
                          background:  showCorrectHint && answered ? `${C.neon}18`
                            : isSelected && !isCorrect ? `${C.red}18`
                            : C.card,
                          borderColor: showCorrectHint && answered ? `${C.neon}77`
                            : isSelected && !isCorrect ? `${C.red}77`
                            : isSelected ? `${C.blue}77`
                            : C.border,
                          color:       showCorrectHint && answered ? C.neon
                            : isSelected && !isCorrect ? C.red
                            : C.textMid,
                          cursor:      answered ? 'default' : 'pointer',
                        }}
                      >
                        {showCorrectHint && answered ? '✅ ' : isSelected && !isCorrect ? '❌ ' : ''}{opt}
                      </button>
                    )
                  })}
                </div>

                {/* 정답 확인 버튼 */}
                <button
                  onClick={() => toggleAnswer(qi)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                  style={{
                    background:  `${C.purple}15`,
                    borderColor: `${C.purple}44`,
                    color:       C.purple,
                  }}
                >
                  {visible ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {visible ? '해설 닫기' : '정답 & 해설 보기'}
                </button>

                {/* 해설 토글 */}
                {visible && (
                  <div className="rounded-xl p-4 border text-xs whitespace-pre-line leading-relaxed"
                    style={{ background: `${C.purple}10`, borderColor: `${C.purple}33`, color: C.textMid }}>
                    {quiz.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 하단 푸터 */}
      <div className="text-center text-xs py-4 border-t" style={{ borderColor: C.border, color: C.textLow }}>
        📚 최일 투자학교 · 매크로 & 채권 시뮬레이터 · 교육용 시뮬레이션 (실제 투자 조언 아님)
      </div>
    </div>
  )
}
