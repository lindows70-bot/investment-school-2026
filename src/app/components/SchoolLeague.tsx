'use client'

/**
 * SchoolLeague — 2026 투자학교 스쿨 리그 대시보드
 *
 * ◆ 구성
 *  1. 스쿨 실명 리더보드   — 주간/월간/누적 탭 랭킹 + "내 위치" 하이라이트
 *  2. 상위권 포트폴리오 엿보기 — Top 1·2 학생의 배분 비중 + 효자 종목 Top 3
 *  3. 우리 반 인기 보유 종목 — 가장 많이 보유한 종목 막대 차트
 *  4. 스쿨 평균 vs 나       — Core/Satellite 비중 비교
 *
 * ◆ 프라이버시 원칙
 *  - 실명 공개 (유대감·경쟁 효과 극대화)
 *  - 금액(₩)은 철저히 숨김, 수익률(%)·비중(%)만 공개
 */

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  Trophy, TrendingUp, TrendingDown, Users,
  Star, Flame, BarChart2, Award, ChevronUp, ChevronDown, Minus,
} from 'lucide-react'

// ── 디자인 토큰 ──────────────────────────────────────────────
const C = {
  bg:      '#020617',
  surface: '#0f172a',
  card:    '#1e293b',
  cardHi:  '#263348',
  border:  '#334155',
  textHi:  '#f1f5f9',
  textMid: '#94a3b8',
  textLow: '#64748b',
  // 대시보드와 통일된 Core / Satellite 색상
  core:    '#38bdf8',   // sky-400 — 리밸런싱 위젯과 동일
  sat:     '#fb923c',   // orange-400 — 리밸런싱 위젯과 동일
  green:   '#4ade80',
  red:     '#f87171',
  amber:   '#fbbf24',
  purple:  '#c084fc',
  gold:    '#f59e0b',
  silver:  '#94a3b8',
  bronze:  '#d97706',
}

// ── 더미 학생 데이터 ──────────────────────────────────────────
// ※ 실 서비스에서는 Supabase에서 집계된 수익률/비중 데이터를 불러옵니다.
// ※ 금액(₩)은 일절 포함하지 않습니다.
type Period = 'weekly' | 'monthly' | 'cumulative'

interface Student {
  id:          string
  name:        string
  avatarColor: string
  // 기간별 수익률 (%)
  ret: Record<Period, number>
  // Core / Satellite 비중 (%)
  core: number
  sat:  number
  // 상위권 효자 종목 Top 3
  topHoldings: string[]
  // 보유 종목 수
  holdingCount: number
  // 링치 주력 전략
  strategy: string
}

const STUDENTS: Student[] = [
  {
    id:          'lee-geun-haeng',
    name:        '이근행',
    avatarColor: '#38bdf8',
    ret:         { weekly: 4.1,  monthly: 11.2, cumulative: 31.5 },
    core:        68, sat: 32,
    topHoldings: ['한화에어로스페이스', '덕산하이메탈', 'PLUS K방산'],
    holdingCount: 25,
    strategy:    '방어 성장형',
  },
  {
    id:          'kim-sang-gyun',
    name:        '김상균',
    avatarColor: '#c084fc',
    ret:         { weekly: 3.2,  monthly: 8.7,  cumulative: 24.3 },
    core:        55, sat: 45,
    topHoldings: ['NVDA', 'PLTR', 'XRP'],
    holdingCount: 19,
    strategy:    '글로벌 성장형',
  },
  {
    id:          'you',
    name:        '유',
    avatarColor: '#4ade80',
    ret:         { weekly: 2.8,  monthly: 7.3,  cumulative: 18.9 },
    core:        40, sat: 60,
    topHoldings: ['ETH', 'TEM', '삼성생명'],
    holdingCount: 3,
    strategy:    '공격 성장형',
  },
  {
    id:          'lee-min-haeng',
    name:        '이민행',
    avatarColor: '#fb923c',
    ret:         { weekly: 1.9,  monthly: 5.8,  cumulative: 14.2 },
    core:        50, sat: 50,
    topHoldings: ['PLTR', 'BTC', 'PLUS K방산'],
    holdingCount: 3,
    strategy:    '균형 투자형',
  },
  {
    id:          'song-seung-gyu',
    name:        '송승규',
    avatarColor: '#f87171',
    ret:         { weekly: 1.1,  monthly: 3.2,  cumulative: 8.7 },
    core:        75, sat: 25,
    topHoldings: ['KODEX 200', 'TIGER S&P500', 'TIGER 나스닥100'],
    holdingCount: 0,
    strategy:    '패시브 인덱스형',
  },
  {
    id:          'kim-sun-a',
    name:        '김선아',
    avatarColor: '#fbbf24',
    ret:         { weekly: 0.7,  monthly: 2.1,  cumulative: 5.4 },
    core:        80, sat: 20,
    topHoldings: ['KODEX 200', '삼성생명', 'TIGER 미국나스닥100'],
    holdingCount: 0,
    strategy:    '보수 방어형',
  },
  {
    id:          'elena-yu',
    name:        'Elena YU',
    avatarColor: '#818cf8',
    ret:         { weekly: -0.3, monthly: 1.4,  cumulative: 3.2 },
    core:        70, sat: 30,
    topHoldings: ['TIGER S&P500', 'AAPL', 'MSFT'],
    holdingCount: 0,
    strategy:    '글로벌 ETF형',
  },
  {
    id:          'choi-il',
    name:        '최일',
    avatarColor: '#f59e0b',
    ret:         { weekly: 5.8,  monthly: 14.3, cumulative: 42.7 },
    core:        62, sat: 38,
    topHoldings: ['NVDA', '한화에어로스페이스', 'PLUS K방산'],
    holdingCount: 12,
    strategy:    '핵심 성장형',
  },
]

// ── 스쿨 인기 보유 종목 더미 데이터 ──────────────────────────
const TRENDING_STOCKS = [
  { ticker: 'NVDA',   name: 'NVIDIA',          count: 3, market: 'US', color: '#a3e635' },
  { ticker: 'PLTR',   name: 'Palantir',         count: 3, market: 'US', color: '#38bdf8' },
  { ticker: '449450', name: 'PLUS K방산',         count: 3, market: 'KR', color: '#60a5fa' },
  { ticker: '000660', name: 'SK하이닉스',          count: 2, market: 'KR', color: '#4ade80' },
  { ticker: 'BTC',    name: '비트코인',           count: 2, market: 'CRYPTO', color: '#f59e0b' },
  { ticker: '012450', name: '한화에어로스페이스',  count: 2, market: 'KR', color: '#fb923c' },
  { ticker: '0131V0', name: '1Q 미우주항공테크',  count: 2, market: 'KR', color: '#c084fc' },
  { ticker: '0117V0', name: 'TIGER K AI전력기기', count: 2, market: 'KR', color: '#f87171' },
]

// ── 기간별 정렬 헬퍼 ─────────────────────────────────────────
function getRanked(period: Period): (Student & { rank: number })[] {
  return [...STUDENTS]
    .sort((a, b) => b.ret[period] - a.ret[period])
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

// ── 순위 뱃지 ────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 18 }}>🥇</span>
  if (rank === 2) return <span style={{ fontSize: 18 }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize: 18 }}>🥉</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: '50%',
      background: C.surface, border: `1px solid ${C.border}`,
      fontSize: 11, fontWeight: 700, color: C.textLow,
    }}>{rank}</span>
  )
}

// ── 아바타 원 ────────────────────────────────────────────────
function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const char = name.slice(0, 1).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}22`, border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color,
    }}>
      {char}
    </div>
  )
}

// ── Core/Satellite 비중 인라인 바 ─────────────────────────────
function CoreSatBar({ core, sat, height = 8 }: { core: number; sat: number; height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, color: C.core, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
        {core}%
      </span>
      <div style={{
        flex: 1, display: 'flex', height, borderRadius: height / 2, overflow: 'hidden',
        background: C.surface,
      }}>
        <div style={{
          width: `${core}%`, background: `${C.core}cc`,
          transition: 'width 0.5s ease',
        }} />
        <div style={{
          flex: 1, background: `${C.sat}cc`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: 9, color: C.sat, fontWeight: 700, minWidth: 28 }}>
        {sat}%
      </span>
    </div>
  )
}

// ── 수익률 뱃지 ──────────────────────────────────────────────
function RetBadge({ ret }: { ret: number }) {
  const isUp   = ret > 0
  const isZero = ret === 0
  const color  = isZero ? C.textLow : isUp ? C.green : C.red
  const Icon   = isZero ? Minus : isUp ? ChevronUp : ChevronDown
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Icon size={13} color={color} strokeWidth={2.5} />
      <span style={{ fontSize: 13, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
        {ret > 0 ? '+' : ''}{ret.toFixed(1)}%
      </span>
    </div>
  )
}

// ── 섹션 헤더 ────────────────────────────────────────────────
function SectionHeader({
  icon, title, subtitle,
}: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: C.surface, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.textHi }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textLow, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

// ── 카드 컨테이너 ────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Tab 버튼 ─────────────────────────────────────────────────
function Tab({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8, border: 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background:    active ? C.amber      : 'transparent',
        color:         active ? '#020617'    : C.textLow,
        boxShadow:     active ? `0 2px 8px ${C.amber}44` : 'none',
        transition:    'all 0.18s',
      }}
    >
      {label}
    </button>
  )
}

// ── 커스텀 툴팁 ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.cardHi, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: C.textMid, marginBottom: 3 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {p.value}명 보유
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════
export default function SchoolLeague() {
  const [period, setPeriod] = useState<Period>('cumulative')
  const [myName, setMyName] = useState<string | null>(null)

  // ── 현재 로그인 사용자 이름 로드 ─────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data } = await sb
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (data?.full_name) setMyName(data.full_name)
        else setMyName(user.email?.split('@')[0] ?? null)
      } catch { /* 무시 */ }
    }
    load()
  }, [])

  // ── 기간별 랭킹 ──────────────────────────────────────────
  const ranked = useMemo(() => getRanked(period), [period])

  // 내 순위 (이름 일치로 탐색)
  const myRanked = ranked.find(s => s.name === myName || myName?.includes(s.name) || s.name.includes(myName ?? '__'))
  const myRank   = myRanked?.rank ?? null
  const total    = ranked.length

  // 스쿨 전체 평균 Core/Sat 비중
  const avgCore = Math.round(STUDENTS.reduce((s, st) => s + st.core, 0) / STUDENTS.length)
  const avgSat  = 100 - avgCore

  // 내 Core/Sat 비중 (이름 매칭)
  const myStudent = STUDENTS.find(s => s.name === myName || myName?.includes(s.name) || s.name.includes(myName ?? '__'))
  const myCore = myStudent?.core ?? avgCore
  const mySat  = myStudent?.sat  ?? avgSat

  // Top 1, Top 2 학생
  const top1 = ranked[0]
  const top2 = ranked[1]

  // 내 위치 문구
  const myPositionText = myRank && total > 0
    ? `📍 현재 ${myName ?? '내'} 순위는 ${total}명 중 ${myRank}위 (상위 ${Math.round((myRank / total) * 100)}%)`
    : null
  const gapToAbove = myRank && myRank > 1
    ? ranked[myRank - 2].ret[period] - (myRanked?.ret[period] ?? 0)
    : null

  // Top performer 도넛 차트 데이터
  const topPieData1 = [
    { name: 'Core',       value: top1?.core ?? 60, color: C.core },
    { name: 'Satellite',  value: top1?.sat  ?? 40, color: C.sat  },
  ]
  const topPieData2 = [
    { name: 'Core',       value: top2?.core ?? 60, color: C.core },
    { name: 'Satellite',  value: top2?.sat  ?? 40, color: C.sat  },
  ]

  // 스쿨 평균 vs 나 비교 바 차트 데이터
  const compData = [
    { label: 'Core',      avg: avgCore, me: myCore },
    { label: 'Satellite', avg: avgSat,  me: mySat  },
  ]

  return (
    <div
      style={{
        background:  C.bg,
        color:       C.textHi,
        fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight:   '100vh',
      }}
      className="p-4 md:p-6 space-y-5"
    >

      {/* ── 페이지 헤더 ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg,#f59e0b22,#fb923c22)',
            border: `1px solid ${C.amber}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={20} color={C.gold} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: C.textHi, margin: 0, letterSpacing: '-0.3px' }}>
              스쿨 리그
            </h1>
            <p style={{ fontSize: 12, color: C.textLow, margin: 0 }}>
              {total}명 학생 · 금액 비공개 · 수익률·비중만 공개
            </p>
          </div>
        </div>

        {/* 기간 탭 */}
        <div style={{
          display: 'flex', gap: 4,
          background: C.surface, borderRadius: 10, padding: 4,
          border: `1px solid ${C.border}`,
        }}>
          <Tab active={period === 'weekly'}      label="주간"  onClick={() => setPeriod('weekly')} />
          <Tab active={period === 'monthly'}     label="월간"  onClick={() => setPeriod('monthly')} />
          <Tab active={period === 'cumulative'}  label="누적"  onClick={() => setPeriod('cumulative')} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 1: 스쿨 실명 리더보드
      ════════════════════════════════════════════════════════ */}
      <Card>
        <SectionHeader
          icon={<BarChart2 size={16} color={C.gold} />}
          title="스쿨 리더보드"
          subtitle={`${period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '누적'} 수익률 기준 실명 랭킹`}
        />

        {/* 테이블 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 100px 160px',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 8,
          background: C.surface,
          marginBottom: 6,
        }}>
          {['순위', '이름', '수익률', 'Core / Satellite 비중'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.textLow, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* 랭킹 행 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ranked.map(s => {
            const isMe = s.name === myName || (myName !== null && (s.name.includes(myName) || myName.includes(s.name)))
            return (
              <div
                key={s.id}
                style={{
                  display:       'grid',
                  gridTemplateColumns: '40px 1fr 100px 160px',
                  gap:           8,
                  padding:       '10px 12px',
                  borderRadius:  8,
                  background:    isMe ? `${C.amber}12` : 'transparent',
                  border:        isMe ? `1px solid ${C.amber}35` : '1px solid transparent',
                  alignItems:    'center',
                  transition:    'background 0.2s',
                }}
              >
                {/* 순위 */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <RankBadge rank={s.rank} />
                </div>

                {/* 이름 + 전략 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={s.name} color={s.avatarColor} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: isMe ? C.amber : C.textHi,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {s.name}
                      {isMe && <span style={{ fontSize: 9, color: C.amber, marginLeft: 6, fontWeight: 800 }}>나</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.textLow }}>{s.strategy}</div>
                  </div>
                </div>

                {/* 수익률 */}
                <div>
                  <RetBadge ret={s.ret[period]} />
                </div>

                {/* Core/Sat 비중 바 */}
                <div style={{ padding: '0 4px' }}>
                  <CoreSatBar core={s.core} sat={s.sat} height={7} />
                </div>
              </div>
            )
          })}
        </div>

        {/* 내 위치 하이라이트 배너 */}
        {myPositionText && (
          <div style={{
            marginTop: 14,
            padding:   '10px 14px',
            borderRadius: 8,
            background: `${C.amber}10`,
            border:     `1px solid ${C.amber}30`,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap:   'wrap',
            gap:        6,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>
              {myPositionText}
            </span>
            {gapToAbove != null && (
              <span style={{ fontSize: 11, color: C.textMid }}>
                {myRank !== null && myRank > 1
                  ? `📈 ${ranked[myRank - 2].name} 님과 ${gapToAbove.toFixed(1)}%p 차이`
                  : '🏆 현재 1위!'}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: 상위권 포트폴리오 엿보기
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top 1 카드 */}
        {[top1, top2].map((s, idx) => s ? (
          <Card key={s.id}>
            <SectionHeader
              icon={idx === 0
                ? <span style={{ fontSize: 16 }}>🥇</span>
                : <span style={{ fontSize: 16 }}>🥈</span>}
              title={`${idx + 1}위 포트폴리오 엿보기`}
              subtitle="금액 비공개 · 비중·효자종목만 공개"
            />

            {/* 이름 + 수익률 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={s.name} color={s.avatarColor} size={38} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.textHi }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.textLow }}>{s.strategy}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <RetBadge ret={s.ret[period]} />
                <div style={{ fontSize: 10, color: C.textLow, marginTop: 2 }}>
                  {period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '누적'}
                </div>
              </div>
            </div>

            {/* 도넛 차트 + 범례 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <PieChart width={90} height={90}>
                  <Pie
                    data={idx === 0 ? topPieData1 : topPieData2}
                    cx={40} cy={40}
                    innerRadius={26} outerRadius={40}
                    dataKey="value"
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {(idx === 0 ? topPieData1 : topPieData2).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                {/* 중앙 텍스트 */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.core }}>{s.core}%</div>
                  <div style={{ fontSize: 9, color: C.textLow }}>Core</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: C.core, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMid }}>Core · 방어 자산</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.core, marginLeft: 'auto' }}>{s.core}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: C.sat, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMid }}>Satellite · 성장 자산</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.sat, marginLeft: 'auto' }}>{s.sat}%</span>
                </div>
              </div>
            </div>

            {/* 효자 종목 Top 3 */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.textLow,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: 8,
              }}>
                🔥 효자 종목 Top 3
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {s.topHoldings.map((ticker, i) => (
                  <span key={ticker} style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        4,
                    padding:    '3px 9px',
                    borderRadius: 6,
                    fontSize:   11, fontWeight: 700,
                    background: i === 0
                      ? `${C.gold}18`
                      : i === 1
                      ? `${C.silver}18`
                      : `${C.bronze}18`,
                    color: i === 0 ? C.gold : i === 1 ? C.silver : C.bronze,
                    border: `1px solid ${i === 0 ? C.gold : i === 1 ? C.silver : C.bronze}35`,
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {ticker}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ) : null)}
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 3 + 4: 2컬럼 레이아웃
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── SECTION 3: 우리 반 인기 보유 종목 ─────────────── */}
        <Card>
          <SectionHeader
            icon={<Flame size={16} color={C.red} />}
            title="우리 반 인기 종목"
            subtitle="스쿨 학생들이 가장 많이 보유한 종목"
          />

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={TRENDING_STOCKS}
              layout="vertical"
              margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 8]}
                tick={{ fill: C.textLow, fontSize: 10 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
                tickFormatter={v => `${v}명`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: C.textMid, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                name="보유 학생 수"
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                {TRENDING_STOCKS.map((entry, index) => (
                  <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* 상위 3개 텍스트 배지 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {TRENDING_STOCKS.slice(0, 3).map((s, i) => (
              <span key={s.ticker} style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        5,
                padding:    '4px 10px',
                borderRadius: 6,
                fontSize:   11, fontWeight: 700,
                background: `${s.color}15`,
                color:      s.color,
                border:     `1px solid ${s.color}30`,
              }}>
                {i === 0 ? '🔥' : i === 1 ? '⚡' : '✨'} {s.name} · {s.count}명
              </span>
            ))}
          </div>
        </Card>

        {/* ── SECTION 4: 스쿨 평균 vs 나 ────────────────────── */}
        <Card>
          <SectionHeader
            icon={<Users size={16} color={C.purple} />}
            title="스쿨 평균 vs 나"
            subtitle="Core / Satellite 비중 비교"
          />

          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={compData}
              margin={{ top: 4, right: 10, bottom: 0, left: -10 }}
              barGap={6}
              barCategoryGap={32}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: C.textMid, fontSize: 11, fontWeight: 700 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fill: C.textLow, fontSize: 10 }}
                axisLine={{ stroke: C.border }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${v}%`, String(name)]}
                labelFormatter={l => `${l} 비중`}
              />
              <Bar dataKey="avg" name="스쿨 평균" fill={C.textLow}   fillOpacity={0.6} radius={[4,4,0,0]} isAnimationActive={false} />
              <Bar dataKey="me"  name="내 비중"   fill={C.amber}      fillOpacity={0.85} radius={[4,4,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: C.textLow, opacity: 0.6 }} />
              <span style={{ fontSize: 11, color: C.textMid }}>스쿨 평균</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: C.amber }} />
              <span style={{ fontSize: 11, color: C.textMid }}>내 비중</span>
            </div>
          </div>

          {/* 진단 텍스트 */}
          <div style={{
            marginTop: 12,
            padding:   '10px 14px',
            borderRadius: 8,
            background: C.surface,
            border:     `1px solid ${C.border}`,
            fontSize:   12,
            color:      C.textMid,
            lineHeight: 1.6,
          }}>
            {myCore > avgCore + 5
              ? <><span style={{ color: C.core, fontWeight: 700 }}>코어 과잉</span> — 스쿨 평균보다 {myCore - avgCore}%p 방어적입니다. 성장 기회를 놓칠 수 있어요.</>
              : myCore < avgCore - 5
              ? <><span style={{ color: C.sat, fontWeight: 700 }}>새틀라이트 과잉</span> — 스쿨 평균보다 {avgCore - myCore}%p 공격적입니다. 변동성 관리를 점검하세요.</>
              : <><span style={{ color: C.green, fontWeight: 700 }}>균형 포트폴리오</span> — 스쿨 평균과 비슷한 Core/Satellite 비중을 유지 중입니다. 👍</>
            }
          </div>
        </Card>
      </div>

      {/* ── 하단 안내 ─────────────────────────────────────────── */}
      <div style={{
        padding:    '10px 16px',
        borderRadius: 10,
        background: C.surface,
        border:     `1px solid ${C.border}`,
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        fontSize:   11,
        color:      C.textLow,
      }}>
        <Star size={12} color={C.textLow} />
        데이터 기준: 현재 더미 데이터 (실 서비스에서는 실시간 Supabase 집계 연동 예정) ·
        금액(₩)은 비공개 · 수익률(%) · 비중(%)만 공개
      </div>
    </div>
  )
}
