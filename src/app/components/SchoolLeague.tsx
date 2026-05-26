'use client'

/**
 * SchoolLeague — 2026 투자학교 스쿨 리그 대시보드 (실 DB 연동)
 *
 * ◆ 데이터 흐름
 *  useEffect → GET /api/school-league
 *    └─ Supabase service role → profiles + investments 전체 집계
 *    └─ /api/stock-price 배치 조회 → 실시간 수익률 계산
 *    └─ StudentPortfolio[] 반환
 *
 * ◆ 프라이버시 원칙
 *  - 실명 공개 (유대감·경쟁 효과 극대화)
 *  - 금액(₩) 완전 숨김 — 수익률(%)·비중(%)만 공개
 *  - 미등록 학생: 리더보드 최하단 배치 + "포트폴리오 준비 중" 표시
 */

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  Trophy, Users, Star, Flame, BarChart2,
  ChevronUp, ChevronDown, Minus, Loader2, AlertCircle,
} from 'lucide-react'
import type { TrendingStock, SchoolLeagueData } from '@/app/api/school-league/route'

// ── 디자인 토큰 ──────────────────────────────────────────────────
const C = {
  bg:      '#020617',
  surface: '#0f172a',
  card:    '#1e293b',
  cardHi:  '#263348',
  border:  '#334155',
  textHi:  '#f1f5f9',
  textMid: '#94a3b8',
  textLow: '#64748b',
  // 대시보드·리밸런싱 위젯과 통일
  core:    '#38bdf8',
  sat:     '#fb923c',
  green:   '#4ade80',
  red:     '#f87171',
  amber:   '#fbbf24',
  purple:  '#c084fc',
  gold:    '#f59e0b',
  silver:  '#94a3b8',
  bronze:  '#d97706',
}

// ── 순위 뱃지 ────────────────────────────────────────────────────
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
    }}>
      {rank}
    </span>
  )
}

// ── 아바타 원 ────────────────────────────────────────────────────
function Avatar({
  name, color, size = 32,
}: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${color}22`, border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color,
    }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

// ── Core/Satellite 비중 인라인 바 ─────────────────────────────────
function CoreSatBar({
  core, sat, height = 8,
}: { core: number; sat: number; height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, color: C.core, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
        {core}%
      </span>
      <div style={{
        flex: 1, display: 'flex', height, borderRadius: height / 2,
        overflow: 'hidden', background: C.surface,
      }}>
        <div style={{ width: `${core}%`, background: `${C.core}cc`, transition: 'width 0.5s ease' }} />
        <div style={{ flex: 1, background: `${C.sat}cc`, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 9, color: C.sat, fontWeight: 700, minWidth: 28 }}>
        {sat}%
      </span>
    </div>
  )
}

// ── 수익률 표시 ──────────────────────────────────────────────────
function RetDisplay({ ret }: { ret: number | null }) {
  if (ret === null) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
        background: `${C.textLow}18`, color: C.textLow,
        border: `1px solid ${C.textLow}30`,
      }}>
        포트폴리오 준비 중
      </span>
    )
  }
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

// ── 섹션 헤더 ────────────────────────────────────────────────────
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

// ── 카드 컨테이너 ────────────────────────────────────────────────
function Card({
  children, style = {},
}: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px', ...style,
    }}>
      {children}
    </div>
  )
}

// ── 탭 버튼 ──────────────────────────────────────────────────────
type Period = 'cumulative'

function Tab({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8, border: 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background:  active ? C.amber   : 'transparent',
        color:       active ? '#020617' : C.textLow,
        boxShadow:   active ? `0 2px 8px ${C.amber}44` : 'none',
        transition:  'all 0.18s',
      }}
    >
      {label}
    </button>
  )
}

// ── 로딩 스피너 ──────────────────────────────────────────────────
function LoadingSpinner({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '80px 0',
      color: C.textLow,
    }}>
      <Loader2 size={32} color={C.amber} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 14, color: C.textMid }}>{msg}</div>
      <div style={{ fontSize: 11, color: C.textLow }}>
        자산 분류 소급 검증 → 실시간 가격 집계 → 리더보드 산출
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── 에러 표시 ────────────────────────────────────────────────────
function ErrorView({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, padding: '60px 20px', color: C.red, textAlign: 'center',
    }}>
      <AlertCircle size={28} color={C.red} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>데이터 로드 실패</div>
      <div style={{ fontSize: 12, color: C.textMid }}>{msg}</div>
    </div>
  )
}

// ── 커스텀 툴팁 ──────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════════
export default function SchoolLeague() {
  // ── 상태 ───────────────────────────────────────────────────────
  const [data,          setData]          = useState<SchoolLeagueData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadingMsg,    setLoadingMsg]    = useState('스쿨 리그 데이터 집계 중…')
  const [error,         setError]         = useState<string | null>(null)
  const [myName,        setMyName]        = useState<string | null>(null)
  const [migratedCount, setMigratedCount] = useState<number>(0)
  const [targetCore,    setTargetCore]    = useState<number>(70)  // 내 목표 코어 비중 (strategy_configs)
  const [period]                          = useState<Period>('cumulative')

  // ── 현재 로그인 유저 이름 ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: p } = await sb.from('profiles').select('full_name, email').eq('id', user.id).single()
        setMyName(p?.full_name ?? p?.email?.split('@')[0] ?? null)
      } catch { /* 무시 */ }
    }
    load()
  }, [])

  // ── 내 목표 코어 비중 로드 (strategy_configs) ────────────────
  // 최일 선생님이 설정한 권장 비중 → 진단 기준으로 사용
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data } = await sb
          .from('strategy_configs')
          .select('core_pct')
          .limit(1)
          .single()
        if (data?.core_pct != null && data.core_pct > 0) setTargetCore(data.core_pct)
      } catch { /* 기본값 70% 유지 */ }
    }
    load()
  }, [])

  // ── 스쿨 리그 API 호출 (내부적으로 마이그레이션 실행 포함) ──────
  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true)
      setLoadingMsg('기존 자산 분류 데이터 검증 중…')
      setError(null)
      try {
        // school-league API가 내부적으로 asset_role 소급 정정 실행
        setLoadingMsg('전체 포트폴리오 실시간 집계 중…')
        const res = await fetch('/api/school-league', { cache: 'no-store' })
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`)
        const json: SchoolLeagueData = await res.json()
        setData(json)
        // 마이그레이션 결과 표시 (업데이트된 항목 수)
        if (json.migratedCount && json.migratedCount > 0) {
          setMigratedCount(json.migratedCount)
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [])

  // ── 파생 데이터 ────────────────────────────────────────────────
  const ranked = useMemo(() => {
    if (!data) return []
    const registered   = data.students.filter(s => s.isRegistered)
    const unregistered = data.students.filter(s => !s.isRegistered)
    // 등록자: 수익률 내림차순
    const sortedReg    = [...registered].sort((a, b) =>
      (b.totalReturn ?? -Infinity) - (a.totalReturn ?? -Infinity)
    ).map((s, i) => ({ ...s, rank: i + 1 }))
    // 미등록자: 순위 null
    const unranked     = unregistered.map(s => ({ ...s, rank: null as null }))
    return [...sortedReg, ...unranked]
  }, [data])

  // 등록자 4명만으로 평균 계산
  const registeredStudents = useMemo(
    () => data?.students.filter(s => s.isRegistered) ?? [],
    [data]
  )

  const avgCore = useMemo(() =>
    registeredStudents.length
      ? Math.round(registeredStudents.reduce((s, st) => s + st.coreRatio, 0) / registeredStudents.length)
      : 70,
    [registeredStudents]
  )
  const avgSat = 100 - avgCore

  // 내 정보
  const myStudent = useMemo(() =>
    data?.students.find(s =>
      myName !== null && (s.name === myName || s.name.includes(myName) || myName.includes(s.name))
    ) ?? null,
    [data, myName]
  )
  const myCore = myStudent?.coreRatio      ?? avgCore
  const mySat  = myStudent?.satelliteRatio ?? avgSat

  const myRanked = ranked.find(s =>
    myName !== null && (s.name === myName || s.name.includes(myName) || myName.includes(s.name))
  )
  const myRank   = myRanked?.rank ?? null
  const total    = ranked.length

  // Top 1, Top 2 (등록자 기준)
  const [top1, top2] = [ranked[0], ranked[1]]

  // 내 위치 텍스트
  const myPositionText = myRank && total > 0
    ? `📍 현재 ${myName ?? '내'} 순위는 종목 등록자 ${registeredStudents.length}명 중 ${myRank}위 (상위 ${Math.round((myRank / registeredStudents.length) * 100)}%)`
    : null

  const aboveMe = myRank && myRank > 1 ? ranked[myRank - 2] : null
  const gapToAbove = aboveMe
    ? ((aboveMe.totalReturn ?? 0) - (myRanked?.totalReturn ?? 0))
    : null

  // 스쿨 평균 vs 나 차트 데이터
  const compData = [
    { label: 'Core',      avg: avgCore, me: myCore },
    { label: 'Satellite', avg: avgSat,  me: mySat  },
  ]

  // ── 렌더링 ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.bg, minHeight: '60vh', fontFamily: '-apple-system,sans-serif' }}>
      <LoadingSpinner msg={loadingMsg} />
    </div>
  )
  if (error) return (
    <div style={{ background: C.bg, minHeight: '60vh', fontFamily: '-apple-system,sans-serif' }}>
      <ErrorView msg={error} />
    </div>
  )

  return (
    <div
      style={{
        background: C.bg, color: C.textHi,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight:  '100vh',
      }}
      className="p-4 md:p-6 space-y-5"
    >

      {/* ── 페이지 헤더 ─────────────────────────────────────── */}
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
              전체 {total}명 · 종목 등록 {registeredStudents.length}명 ·
              미등록 {total - registeredStudents.length}명 ·
              금액 비공개
            </p>
          </div>
        </div>

        {/* 기간 탭 (현재 누적만 지원) */}
        <div style={{
          display: 'flex', gap: 4,
          background: C.surface, borderRadius: 10, padding: 4,
          border: `1px solid ${C.border}`,
        }}>
          <Tab active={period === 'cumulative'} label="누적 수익률" onClick={() => {}} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1: 스쿨 실명 리더보드
      ══════════════════════════════════════════════════════════ */}
      <Card>
        <SectionHeader
          icon={<BarChart2 size={16} color={C.gold} />}
          title="스쿨 리더보드"
          subtitle={`누적 수익률 기준 실명 랭킹 · 미등록자 최하단 배치`}
        />

        {/* 테이블 헤더 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 130px 180px',
          gap: 8, padding: '6px 12px',
          borderRadius: 8, background: C.surface, marginBottom: 6,
        }}>
          {['순위', '이름', '수익률', 'Core / Satellite 비중'].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: C.textLow, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* 랭킹 행 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ranked.map((s, rowIdx) => {
            const isMe         = myName !== null && (s.name === myName || s.name.includes(myName) || myName.includes(s.name))
            const isUnregistered = !s.isRegistered

            return (
              <div
                key={s.userId}
                style={{
                  display:    'grid',
                  gridTemplateColumns: '44px 1fr 130px 180px',
                  gap:        8,
                  padding:    '10px 12px',
                  borderRadius: 8,
                  // 미등록자는 흐릿하게, 내 행은 강조
                  background: isMe
                    ? `${C.amber}12`
                    : isUnregistered
                    ? `${C.surface}80`
                    : 'transparent',
                  border: isMe
                    ? `1px solid ${C.amber}35`
                    : isUnregistered
                    ? `1px dashed ${C.border}`
                    : '1px solid transparent',
                  opacity:    isUnregistered ? 0.6 : 1,
                  alignItems: 'center',
                  // 미등록자와 등록자 사이 구분선
                  ...(rowIdx > 0 && ranked[rowIdx - 1].isRegistered && isUnregistered
                    ? { marginTop: 8, borderTop: `1px solid ${C.border}` }
                    : {}),
                }}
              >
                {/* 순위 */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {s.rank !== null
                    ? <RankBadge rank={s.rank} />
                    : <span style={{ fontSize: 11, color: C.textLow }}>—</span>}
                </div>

                {/* 이름 + 전략 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Avatar name={s.name} color={s.avatarColor} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: isMe ? C.amber : isUnregistered ? C.textLow : C.textHi,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {s.name}
                      {isMe && <span style={{ fontSize: 9, color: C.amber, marginLeft: 6, fontWeight: 800 }}>나</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.textLow }}>{s.userType}</div>
                  </div>
                </div>

                {/* 수익률 */}
                <div>
                  <RetDisplay ret={s.totalReturn} />
                </div>

                {/* Core/Sat 비중 */}
                <div style={{ padding: '0 4px' }}>
                  {s.isRegistered
                    ? <CoreSatBar core={s.coreRatio} sat={s.satelliteRatio} height={7} />
                    : (
                      <span style={{
                        fontSize: 10, color: C.textLow,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 5,
                        background: `${C.textLow}12`,
                        border: `1px dashed ${C.textLow}30`,
                      }}>
                        종목 미등록 — 자산관리에서 추가하세요 📋
                      </span>
                    )
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* 내 위치 배너 */}
        {myPositionText && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 8,
            background: `${C.amber}10`, border: `1px solid ${C.amber}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 6,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>
              {myPositionText}
            </span>
            {gapToAbove !== null && aboveMe && (
              <span style={{ fontSize: 11, color: C.textMid }}>
                {myRank === 1
                  ? '🏆 현재 1위!'
                  : `📈 ${aboveMe.name} 님과 ${Math.abs(gapToAbove).toFixed(1)}%p 차이`}
              </span>
            )}
          </div>
        )}

        {/* 미등록자 안내 */}
        {total - registeredStudents.length > 0 && (
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 8,
            background: `${C.textLow}08`, border: `1px dashed ${C.border}`,
            fontSize: 11, color: C.textLow,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>💡</span>
            <span>
              종목 미등록 {total - registeredStudents.length}명은 순위 산정에서 제외됩니다.
              자산 관리 메뉴에서 종목을 추가하면 리더보드에 합류할 수 있습니다!
            </span>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2: 상위권 포트폴리오 엿보기 (등록자 기준 Top 1·2)
      ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[top1, top2].map((s, idx) => {
          if (!s || !s.isRegistered) return (
            <Card key={idx}>
              <SectionHeader
                icon={<span style={{ fontSize: 16 }}>{idx === 0 ? '🥇' : '🥈'}</span>}
                title={`${idx + 1}위 포트폴리오 엿보기`}
              />
              <div style={{ textAlign: 'center', padding: '30px 0', color: C.textLow, fontSize: 13 }}>
                데이터 로딩 중…
              </div>
            </Card>
          )
          const pieData = [
            { name: 'Core',      value: s.coreRatio,      color: C.core },
            { name: 'Satellite', value: s.satelliteRatio, color: C.sat  },
          ]
          return (
            <Card key={s.userId}>
              <SectionHeader
                icon={<span style={{ fontSize: 16 }}>{idx === 0 ? '🥇' : '🥈'}</span>}
                title={`${idx + 1}위 포트폴리오 엿보기`}
                subtitle="금액 비공개 · 비중·효자종목만 공개"
              />

              {/* 이름 + 수익률 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={s.name} color={s.avatarColor} size={38} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: C.textHi }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.textLow }}>{s.userType} · {s.holdingCount}종목</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <RetDisplay ret={s.totalReturn} />
                  <div style={{ fontSize: 10, color: C.textLow, marginTop: 2 }}>누적 수익률</div>
                </div>
              </div>

              {/* 도넛 차트 + 범례 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PieChart width={90} height={90}>
                    <Pie
                      data={pieData}
                      cx={40} cy={40}
                      innerRadius={26} outerRadius={40}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    textAlign: 'center', pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.core }}>{s.coreRatio}%</div>
                    <div style={{ fontSize: 9, color: C.textLow }}>Core</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: C.core, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.textMid }}>Core · 방어 자산</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.core, marginLeft: 'auto' }}>
                      {s.coreRatio}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: C.sat, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.textMid }}>Satellite · 성장 자산</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.sat, marginLeft: 'auto' }}>
                      {s.satelliteRatio}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 효자 종목 Top 3 */}
              {s.topStocks.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: C.textLow,
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
                  }}>
                    🔥 주요 보유 종목 Top 3
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.topStocks.map((ticker, i) => (
                      <span key={ticker} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 6,
                        fontSize: 11, fontWeight: 700,
                        background: i === 0 ? `${C.gold}18`   : i === 1 ? `${C.silver}18`  : `${C.bronze}18`,
                        color:      i === 0 ? C.gold           : i === 1 ? C.silver          : C.bronze,
                        border:     i === 0 ? `1px solid ${C.gold}35`
                                  : i === 1 ? `1px solid ${C.silver}35`
                                  : `1px solid ${C.bronze}35`,
                      }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {ticker}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 + 4: 인기 종목 & 스쿨 평균 vs 나
      ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* SECTION 3: 인기 종목 (등록자 데이터만 집계) */}
        <Card>
          <SectionHeader
            icon={<Flame size={16} color={C.red} />}
            title="우리 반 인기 종목"
            subtitle={`종목 등록자 ${registeredStudents.length}명 기준 보유 종목 집계`}
          />

          {data && data.trendingStocks.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.trendingStocks}
                  layout="vertical"
                  margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, total]}
                    tick={{ fill: C.textLow, fontSize: 10 }}
                    axisLine={{ stroke: C.border }}
                    tickLine={false}
                    tickFormatter={v => `${v}명`}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
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
                    {data.trendingStocks.map((entry: TrendingStock, index: number) => (
                      <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {data.trendingStocks.slice(0, 3).map((s: TrendingStock, i: number) => (
                  <span key={s.ticker} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 6,
                    fontSize: 11, fontWeight: 700,
                    background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30`,
                  }}>
                    {i === 0 ? '🔥' : i === 1 ? '⚡' : '✨'} {s.name} · {s.count}명
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textLow, fontSize: 13 }}>
              종목 데이터가 없습니다
            </div>
          )}
        </Card>

        {/* SECTION 4: 스쿨 평균 vs 나 (등록자 평균 기준) */}
        <Card>
          <SectionHeader
            icon={<Users size={16} color={C.purple} />}
            title="스쿨 평균 vs 나"
            subtitle={`Core / Satellite 비중 비교 (등록자 ${registeredStudents.length}명 평균)`}
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
              <Bar dataKey="avg" name="스쿨 평균"  fill={C.textLow} fillOpacity={0.6}  radius={[4,4,0,0]} isAnimationActive={false} />
              <Bar dataKey="me"  name="내 비중"    fill={C.amber}   fillOpacity={0.85} radius={[4,4,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: C.textLow, opacity: 0.6 }} />
              <span style={{ fontSize: 11, color: C.textMid }}>스쿨 평균 (등록자만)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: C.amber }} />
              <span style={{ fontSize: 11, color: C.textMid }}>내 비중</span>
            </div>
          </div>

          {/* 자동 진단 — 스쿨 평균이 아닌 '내 전략 목표' 대비 진단 */}
          {(() => {
            if (!myStudent) {
              return (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: C.surface, border: `1px solid ${C.border}`,
                  fontSize: 12, color: C.textLow,
                }}>
                  로그인 후 내 포트폴리오와 비교해보세요.
                </div>
              )
            }

            // 목표 대비 차이 (양수 = 목표 초과, 음수 = 목표 미달)
            const diffFromTarget = myCore - targetCore
            const absDiff        = Math.abs(diffFromTarget)

            // Case 3: ±3%p 이내 → 전략 달성
            if (absDiff <= 3) {
              return (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 8,
                  background: `${C.green}0f`, border: `1px solid ${C.green}30`,
                  fontSize: 12, color: C.textMid, lineHeight: 1.7,
                }}>
                  <div style={{ fontWeight: 800, color: C.green, marginBottom: 3 }}>
                    🟢 전략적 균형 상태
                  </div>
                  설정하신 황금 비율 전략(Core {targetCore}% / Sat {100 - targetCore}%)에 맞춰
                  아주 모범적으로 포트폴리오를 유지하고 있습니다. 👍
                  <div style={{ fontSize: 10, color: C.textLow, marginTop: 4 }}>
                    스쿨 평균 Core {avgCore}% 대비 {myCore >= avgCore ? `+${myCore - avgCore}` : `${myCore - avgCore}`}%p
                  </div>
                </div>
              )
            }

            // Case 1: 목표보다 코어 부족 → Satellite 과잉
            if (diffFromTarget < 0) {
              const vsSchool = myCore - avgCore
              return (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 8,
                  background: `${C.sat}0f`, border: `1px solid ${C.sat}30`,
                  fontSize: 12, color: C.textMid, lineHeight: 1.7,
                }}>
                  <div style={{ fontWeight: 800, color: C.sat, marginBottom: 3 }}>
                    🟡 새틀라이트 과잉 (전략 대비)
                  </div>
                  내 목표({targetCore}%)보다 코어 자산이{' '}
                  <span style={{ color: C.sat, fontWeight: 700 }}>{absDiff.toFixed(1)}%p 부족</span>합니다.
                  다만, 스쿨 평균({avgCore}%) 대비로는{' '}
                  <span style={{ color: vsSchool >= 0 ? C.green : C.textMid, fontWeight: 700 }}>
                    {vsSchool >= 0 ? `+${vsSchool.toFixed(1)}` : vsSchool.toFixed(1)}%p
                  </span>{' '}
                  {vsSchool >= 0 ? '더 안정적으로 중심을 잡고 있습니다.' : '더 공격적인 상태입니다.'}
                </div>
              )
            }

            // Case 2: 목표보다 코어 초과 → Core 과잉
            return (
              <div style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 8,
                background: `${C.core}0f`, border: `1px solid ${C.core}30`,
                fontSize: 12, color: C.textMid, lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 800, color: C.core, marginBottom: 3 }}>
                  🔵 코어 과잉 (전략 대비)
                </div>
                내 목표({targetCore}%)보다 코어 자산이{' '}
                <span style={{ color: C.core, fontWeight: 700 }}>{absDiff.toFixed(1)}%p 초과</span>되었습니다.
                조금 더 공격적인 새틀라이트 자산 편입을 고려해 볼 수 있습니다.
                <div style={{ fontSize: 10, color: C.textLow, marginTop: 4 }}>
                  스쿨 평균 Core {avgCore}% 대비 +{(myCore - avgCore).toFixed(1)}%p
                </div>
              </div>
            )
          })()}
        </Card>
      </div>

      {/* ── 하단 메타 안내 ──────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', borderRadius: 10,
        background: C.surface, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: C.textLow, flexWrap: 'wrap',
      }}>
        <Star size={12} color={C.textLow} />
        <span>
          데이터 기준: 실시간 DB + 시세 · 금액(₩) 비공개 · 수익률(%)·비중(%)만 공개 ·
          미등록자는 통계 집계에서 제외 ·
          {data?.computedAt && ` 최종 집계: ${new Date(data.computedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
          {migratedCount > 0 && (
            <span style={{ color: C.green, marginLeft: 8, fontWeight: 700 }}>
              · ✅ 자산분류 {migratedCount}건 소급 정정 완료
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
