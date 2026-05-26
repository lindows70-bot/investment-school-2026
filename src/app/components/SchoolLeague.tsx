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

  // ── 리밸런싱 시뮬레이터 상태 ─────────────────────────────────
  const [totalAssets,   setTotalAssets]   = useState<number>(0)     // 현재 총 자산 (투자금 기준 자동 로드)
  const [assetAutoLoaded, setAssetAutoLoaded] = useState(false)      // 자동 로드 여부
  const [additionalCash, setAdditionalCash] = useState<string>('')   // 이번 달 추가 투자금 (입력)
  const [cashUnit,       setCashUnit]     = useState<'원' | '만원'>('만원') // 입력 단위

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

  // ── 내 총 자산 자동 로드 (투자금 기준 — 현재가 불필요) ──────────
  // purchase_price × quantity × 환율 합산 → 총 투자 원금 계산
  useEffect(() => {
    const load = async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: invs } = await sb
          .from('investments')
          .select('purchase_price, quantity, currency')
          .eq('user_id', user.id)
        if (!invs?.length) return
        const USD_KRW = 1_350
        const total = invs.reduce((s, i) => {
          const rate = i.currency === 'USD' ? USD_KRW : 1
          return s + (Number(i.purchase_price) || 0) * (Number(i.quantity) || 0) * rate
        }, 0)
        setTotalAssets(Math.round(total))
        setAssetAutoLoaded(true)
      } catch { /* 수동 입력으로 대체 */ }
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

  // ── 리밸런싱 시뮬레이터 계산 (useMemo) ───────────────────────
  const rebalancePlan = useMemo(() => {
    if (totalAssets <= 0) return null

    // 추가 투자금 원화 환산
    const addCashNum = parseFloat(additionalCash.replace(/,/g, '')) || 0
    const addKrw     = cashUnit === '만원' ? addCashNum * 10_000 : addCashNum

    const newTotal    = totalAssets + addKrw
    const targetCoreRatio = targetCore / 100
    const targetSatRatio  = (100 - targetCore) / 100

    // 현재 금액
    const currentCoreAmt = totalAssets * (myCore / 100)
    const currentSatAmt  = totalAssets * (mySat  / 100)

    // 목표 금액 (새로운 총자산 기준)
    const targetCoreAmt  = newTotal * targetCoreRatio
    const targetSatAmt   = newTotal * targetSatRatio

    // 조정 필요액 (양수 = 매수, 음수 = 매도)
    const coreAdjust = targetCoreAmt - currentCoreAmt
    const satAdjust  = targetSatAmt  - currentSatAmt

    return {
      addKrw,
      newTotal,
      currentCoreAmt,
      currentSatAmt,
      targetCoreAmt,
      targetSatAmt,
      coreAdjust,
      satAdjust,
    }
  }, [totalAssets, additionalCash, cashUnit, myCore, mySat, targetCore])

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

      {/* ══════════════════════════════════════════════════════════
          SECTION 4-b: 스마트 리밸런싱 처방전 시뮬레이터
      ══════════════════════════════════════════════════════════ */}
      {myStudent && (
        <Card>
          <SectionHeader
            icon={<span style={{ fontSize: 16 }}>💊</span>}
            title="스마트 리밸런싱 처방전"
            subtitle={`목표 비율 (Core ${targetCore}% : Satellite ${100 - targetCore}%)을 맞추기 위한 최적 행동 지침`}
          />

          {/* ── 현재 자산 현황 요약 ────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16,
          }}>
            {[
              {
                label: '현재 총 자산',
                value: totalAssets > 0
                  ? `₩${(totalAssets / 10_000).toFixed(0)}만`
                  : '—',
                sub:   assetAutoLoaded ? '투자 원금 기준 자동 로드' : '아래에서 직접 입력하세요',
                color: C.amber,
              },
              {
                label: `코어 현재 (${myCore}%)`,
                value: totalAssets > 0
                  ? `₩${Math.round(totalAssets * myCore / 100 / 10_000)}만`
                  : `${myCore}%`,
                sub:   `목표 ${targetCore}% · 부족 ${Math.max(0, targetCore - myCore).toFixed(1)}%p`,
                color: C.core,
              },
              {
                label: `새틀라이트 현재 (${mySat}%)`,
                value: totalAssets > 0
                  ? `₩${Math.round(totalAssets * mySat / 100 / 10_000)}만`
                  : `${mySat}%`,
                sub:   `목표 ${100 - targetCore}% · 초과 ${Math.max(0, mySat - (100 - targetCore)).toFixed(1)}%p`,
                color: C.sat,
              },
            ].map(item => (
              <div key={item.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 9, color: C.textLow, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: item.color, fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: C.textLow }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* ── 총 자산 수동 입력 (자동 로드 실패 시) ─────────── */}
          {!assetAutoLoaded && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textMid, display: 'block', marginBottom: 6 }}>
                📊 현재 총 자산 (직접 입력)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="예: 1000"
                  onChange={e => setTotalAssets(Number(e.target.value) * 10_000)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.surface,
                    color: C.textHi, fontSize: 14, fontWeight: 600, outline: 'none',
                  }}
                />
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: C.textMid, paddingRight: 4 }}>
                  만원
                </span>
              </div>
            </div>
          )}

          {/* ── 추가 투자금 입력 ──────────────────────────────── */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMid, display: 'block', marginBottom: 6 }}>
              💰 이번 달 추가 투자 금액
              <span style={{ fontSize: 10, color: C.textLow, fontWeight: 400, marginLeft: 6 }}>
                (0이면 현재 자산 내 리밸런싱만 계산)
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                value={additionalCash}
                onChange={e => setAdditionalCash(e.target.value)}
                placeholder={cashUnit === '만원' ? '예: 100' : '예: 1000000'}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 8,
                  border: `1px solid ${C.amber}50`,
                  background: `${C.amber}08`,
                  color: C.textHi, fontSize: 15, fontWeight: 700,
                  outline: 'none', fontVariantNumeric: 'tabular-nums',
                }}
              />
              {/* 단위 토글 */}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['만원', '원'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setCashUnit(u)}
                    style={{
                      padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      background: cashUnit === u ? C.amber : C.surface,
                      color:      cashUnit === u ? '#020617' : C.textLow,
                    }}
                  >{u}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 행동 플랜 결과 카드 ──────────────────────────── */}
          {totalAssets > 0 && rebalancePlan ? (() => {
            const { addKrw, newTotal, coreAdjust, satAdjust,
                    targetCoreAmt, targetSatAmt } = rebalancePlan
            const fmtManw = (v: number) =>
              Math.abs(v) >= 10_000
                ? `₩${(Math.abs(v) / 10_000).toFixed(0)}만`
                : `₩${Math.abs(v).toLocaleString('ko-KR')}`

            // 추가 자금이 코어 부족분을 커버하는지
            const coreShortfall = Math.max(0, coreAdjust)  // 양수 = 코어 더 사야 함
            const satSellNeeded = Math.max(0, -satAdjust)  // 양수 = 새틀 팔아야 함

            // CASE B: 추가 자금이 있을 때
            if (addKrw > 0) {
              // 추가 자금으로 코어 부족분 먼저 채우고 나머지를 새틀에
              const coreFromCash = Math.min(addKrw, coreShortfall)
              const satFromCash  = addKrw - coreFromCash

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 요약 배너 */}
                  <div style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: `${C.green}0f`, border: `1px solid ${C.green}30`,
                    fontSize: 12, color: C.textMid, lineHeight: 1.6,
                  }}>
                    <span style={{ fontWeight: 800, color: C.green }}>💡 신규 자금 우선 배분 플랜</span>
                    {'  '}새로운 총 자산 {fmtManw(newTotal)} 기준으로
                    코어 목표 <span style={{ color: C.core, fontWeight: 700 }}>{fmtManw(targetCoreAmt)}</span>,
                    새틀 목표 <span style={{ color: C.sat, fontWeight: 700 }}>{fmtManw(targetSatAmt)}</span>
                  </div>

                  {/* 코어 행동 */}
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: `${C.core}0f`, border: `1px solid ${C.core}30`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.core, marginBottom: 6 }}>
                      🟢 코어 자산 매수
                    </div>
                    <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.7 }}>
                      추가 투자금 중{' '}
                      <span style={{ color: C.core, fontWeight: 800, fontSize: 14 }}>
                        {fmtManw(coreFromCash)}
                      </span>
                      을 코어 자산(S&P500 ETF, 국채 등)에 투입하세요.
                      {coreShortfall > addKrw && (
                        <span style={{ color: C.sat, display: 'block', marginTop: 4 }}>
                          ⚠️ 추가 자금만으로 부족 — 새틀라이트에서{' '}
                          <span style={{ fontWeight: 800 }}>{fmtManw(satSellNeeded - satFromCash)}</span>
                          {' '}추가 매도가 필요합니다.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 새틀 행동 */}
                  {satFromCash > 0 && (
                    <div style={{
                      padding: '14px 16px', borderRadius: 10,
                      background: `${C.sat}0f`, border: `1px solid ${C.sat}30`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.sat, marginBottom: 6 }}>
                        🟡 새틀라이트 자산 추가 투입
                      </div>
                      <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.7 }}>
                        나머지{' '}
                        <span style={{ color: C.sat, fontWeight: 800, fontSize: 14 }}>
                          {fmtManw(satFromCash)}
                        </span>
                        은 성장 전략(개별주, 테마 ETF 등) 새틀라이트 자산에 배분하세요.
                      </div>
                    </div>
                  )}
                </div>
              )
            }

            // CASE A: 추가 자금 없을 때 (보유 자산 내 리밸런싱)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 요약 배너 */}
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: `${C.amber}0f`, border: `1px solid ${C.amber}30`,
                  fontSize: 12, color: C.textMid, lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 800, color: C.amber }}>⚖️ 현재 자산 내 리밸런싱 플랜</span>
                  {'  '}추가 자금 없이 현 포트폴리오 내에서 비중을 조정합니다.
                </div>

                {/* 새틀 매도 */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: `${C.red}0f`, border: `1px solid ${C.red}30`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.red, marginBottom: 6 }}>
                    🔴 새틀라이트 자산 일부 매도 (수익 확정)
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.7 }}>
                    비중이 높은 새틀라이트 종목(개별주, 테마 ETF 등)을{' '}
                    <span style={{ color: C.red, fontWeight: 800, fontSize: 15 }}>
                      {fmtManw(satSellNeeded)}
                    </span>
                    {' '}분할 매도하여 예수금을 확보하세요.
                    <div style={{ fontSize: 10, color: C.textLow, marginTop: 4 }}>
                      💡 한 번에 전량 매도보다 2~3회 분할 매도를 권장합니다
                    </div>
                  </div>
                </div>

                {/* 코어 매수 */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: `${C.green}0f`, border: `1px solid ${C.green}30`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.green, marginBottom: 6 }}>
                    🟢 코어 자산 집중 매수
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.7 }}>
                    확보된 예수금으로 코어 자산(S&P500, KODEX200, 국채 ETF 등)을{' '}
                    <span style={{ color: C.green, fontWeight: 800, fontSize: 15 }}>
                      {fmtManw(coreShortfall)}
                    </span>
                    {' '}매수하여 포트폴리오 중심을 잡으세요.
                  </div>
                </div>
              </div>
            )
          })() : (
            <div style={{
              padding: '24px', textAlign: 'center',
              color: C.textLow, fontSize: 13, borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
            }}>
              {totalAssets <= 0
                ? '총 자산을 입력하면 맞춤형 리밸런싱 처방전을 확인할 수 있습니다 📋'
                : '추가 투자금을 입력하거나 그대로 두면 현재 자산 내 리밸런싱 플랜을 계산합니다'}
            </div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION 5: 피터 린치 6대 분류 자산 성향 분석
      ══════════════════════════════════════════════════════════ */}
      {data && (() => {
        // ── 피터 린치 6대 유형 메타 ─────────────────────────────
        const LYNCH_META: {
          key:   'fast_grower'|'stalwart'|'slow_grower'|'cyclical'|'asset_play'|'turnaround'
          label: string
          eng:   string
          color: string
          tip:   string   // 배너용 밸런스 조언
        }[] = [
          { key:'fast_grower', label:'고성장주',    eng:'Fast Growers',  color:'#a3e635',
            tip:'성장주 집중은 강한 수익을 가져오지만, 사이클 고점 판단이 핵심입니다. 대형우량주 혼합으로 변동성을 낮추세요.' },
          { key:'stalwart',    label:'대형우량주',  eng:'Stalwarts',     color:'#38bdf8',
            tip:'안정적인 선택입니다. 성장 모멘텀을 더하려면 고성장주 소량을 섞는 전략을 고려해 보세요.' },
          { key:'slow_grower', label:'저성장주',    eng:'Slow Growers',  color:'#94a3b8',
            tip:'저성장주 비중이 높은 것은 배당 수익에 집중 중이라는 의미입니다. 성장 기회를 위해 비중 조정을 검토하세요.' },
          { key:'cyclical',    label:'경기순환주',  eng:'Cyclicals',     color:'#fb923c',
            tip:'경기 사이클을 타는 종목이 많습니다. 경기 고점 신호(재고 증가·PER 하락)를 항상 주시하세요.' },
          { key:'asset_play',  label:'자산주',      eng:'Asset Plays',   color:'#c084fc',
            tip:'숨겨진 가치를 발굴하는 전략입니다. 촉매(부동산 매각·분사) 발생 시점을 모니터링하는 것이 포인트입니다.' },
          { key:'turnaround',  label:'턴어라운드주',eng:'Turnarounds',   color:'#f87171',
            tip:'회생주는 성공 시 폭발적 수익이지만 리스크도 큽니다. 구조조정 진행 상황과 흑자 전환 여부를 분기마다 체크하세요.' },
        ]

        const schoolAvg   = data.schoolLynchAvg
        const myDist      = myStudent?.lynchDistribution
        // 스쿨 평균에서 가장 높은 유형 찾기
        const dominant    = [...LYNCH_META].sort((a, b) => (schoolAvg[b.key] ?? 0) - (schoolAvg[a.key] ?? 0))[0]
        const dominantPct = schoolAvg[dominant.key] ?? 0

        // Lynch 데이터가 없는 경우(분류 0%) 스킵
        const hasData = LYNCH_META.some(m => (schoolAvg[m.key] ?? 0) > 0)

        return (
          <Card>
            <SectionHeader
              icon={<span style={{ fontSize: 16 }}>📊</span>}
              title="스쿨 자산 성향 분석 (피터 린치 6대 분류)"
              subtitle="우리 반 학생들이 보유한 새틀라이트 자산의 투자 성향 분포입니다"
            />

            {/* ── 교육 피드백 배너 ─────────────────────────────── */}
            {hasData && dominantPct > 0 && (
              <div style={{
                display:      'flex',
                alignItems:   'flex-start',
                gap:          10,
                padding:      '12px 14px',
                borderRadius: 10,
                marginBottom: 18,
                background:   `${dominant.color}12`,
                border:       `1px solid ${dominant.color}35`,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: dominant.color, marginBottom: 4 }}>
                    스쿨 투자 성향 진단: 현재 우리 반은{' '}
                    <span style={{ background: `${dominant.color}25`, padding: '1px 6px', borderRadius: 4 }}>
                      [{dominant.label}] 편중 ({dominantPct}%)
                    </span>{' '}
                    상태입니다.
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.65 }}>
                    {dominant.tip}
                  </div>
                </div>
              </div>
            )}

            {/* ── 6대 유형 비교 바 ─────────────────────────────── */}
            {!hasData ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.textLow, fontSize: 13 }}>
                린치 분류 데이터가 없습니다 — 자산 관리에서 종목 분류를 설정해 주세요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 컬럼 헤더 */}
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: '120px 1fr 1fr',
                  gap:                 12,
                  paddingBottom:       6,
                  borderBottom:        `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textLow, textTransform: 'uppercase', letterSpacing: '0.07em' }}>유형</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textLow, textTransform: 'uppercase', letterSpacing: '0.07em' }}>스쿨 평균</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.amber,   textTransform: 'uppercase', letterSpacing: '0.07em' }}>내 비중</div>
                </div>

                {LYNCH_META.map(m => {
                  const school = schoolAvg[m.key]  ?? 0
                  const me     = myDist?.[m.key]    ?? 0

                  return (
                    <div key={m.key} style={{
                      display:             'grid',
                      gridTemplateColumns: '120px 1fr 1fr',
                      gap:                 12,
                      alignItems:          'center',
                    }}>
                      {/* 유형 라벨 */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
                        <div style={{ fontSize: 9,  color: C.textLow }}>{m.eng}</div>
                      </div>

                      {/* 스쿨 평균 바 */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            flex:         1,
                            height:       8,
                            borderRadius: 4,
                            background:   C.surface,
                            overflow:     'hidden',
                          }}>
                            <div style={{
                              width:        `${school}%`,
                              height:       '100%',
                              borderRadius: 4,
                              background:   `${C.textLow}80`,
                              transition:   'width 0.6s ease',
                              minWidth:     school > 0 ? 4 : 0,
                            }} />
                          </div>
                          <span style={{
                            fontSize:        10,
                            fontWeight:      700,
                            color:           C.textLow,
                            minWidth:        30,
                            textAlign:       'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {school > 0 ? `${school}%` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* 내 비중 바 */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            flex:         1,
                            height:       8,
                            borderRadius: 4,
                            background:   C.surface,
                            overflow:     'hidden',
                          }}>
                            <div style={{
                              width:        `${me}%`,
                              height:       '100%',
                              borderRadius: 4,
                              background:   myStudent ? m.color : C.surface,
                              opacity:      0.85,
                              transition:   'width 0.6s ease',
                              minWidth:     me > 0 ? 4 : 0,
                            }} />
                          </div>
                          <span style={{
                            fontSize:        10,
                            fontWeight:      700,
                            color:           myStudent ? m.color : C.textLow,
                            minWidth:        30,
                            textAlign:       'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {!myStudent ? '—' : me > 0 ? `${me}%` : '—'}
                          </span>
                        </div>
                        {/* 스쿨 평균 대비 차이 표시 */}
                        {myStudent && me !== school && school > 0 && (
                          <div style={{ fontSize: 9, color: C.textLow, marginTop: 2, textAlign: 'right' }}>
                            {me > school
                              ? <span style={{ color: m.color }}>+{me - school}%p</span>
                              : <span style={{ color: C.textLow }}>-{school - me}%p</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* 범례 */}
                <div style={{
                  display:       'flex',
                  gap:           16,
                  paddingTop:    10,
                  borderTop:     `1px solid ${C.border}`,
                  justifyContent:'flex-end',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 8, borderRadius: 2, background: `${C.textLow}80` }} />
                    <span style={{ fontSize: 10, color: C.textMid }}>스쿨 평균</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 8, borderRadius: 2, background: C.amber }} />
                    <span style={{ fontSize: 10, color: C.textMid }}>내 비중</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textLow }}>
                    · Satellite 자산 내 {registeredStudents.length}명 평균 (lynch_category 분류 기준)
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })()}

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
