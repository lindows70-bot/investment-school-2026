'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
type Market   = 'US' | 'KR' | 'CRYPTO'
type LynchKey = 'slow_grower' | 'stalwart' | 'fast_grower' | 'cyclical' | 'turnaround' | 'asset_play' | 'na'
type SortCol  = 'email' | 'joined' | 'count' | 'invested'

interface Investment {
  id:             string
  user_id:        string
  ticker:         string
  name:           string
  market:         Market
  currency:       'USD' | 'KRW'
  purchase_price: number
  quantity:       number
  purchase_date:  string
  lynch_category: LynchKey | null
  created_at:     string
}

interface Profile {
  id:         string
  email:      string
  full_name:  string | null
  role:       string
  created_at: string
}

interface StudentRow extends Profile {
  investments:  Investment[]
  totalKrw:     number
  count:        number
}

// ─── Config ───────────────────────────────────────────────────────────────────
const USD_KRW = 1_350

const LYNCH_META: Record<string, { label: string; color: string }> = {
  slow_grower: { label: '완만한 성장주', color: '#9ca3af' },
  stalwart:    { label: '대형 우량주',   color: '#60a5fa' },
  fast_grower: { label: '빠른 성장주',   color: '#34d399' },
  cyclical:    { label: '경기 순환주',   color: '#fb923c' },
  turnaround:  { label: '회생 기업주',   color: '#f87171' },
  asset_play:  { label: '자산 보유주',   color: '#c084fc' },
  na:          { label: 'N/A',           color: '#4b5563' },
}

const MARKET_COLOR: Record<Market, string> = {
  US: '#34d399', KR: '#60a5fa', CRYPTO: '#fb923c',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n: number) => Math.round(n).toLocaleString('ko-KR')
const fmtKrw = (n: number) =>
  n >= 100_000_000 ? `₩${(n/100_000_000).toLocaleString('ko-KR', { minimumFractionDigits:1, maximumFractionDigits:1 })}억` :
  n >= 10_000      ? `₩${Math.round(n/10_000).toLocaleString('ko-KR')}만` :
  `₩${fmt(n)}`

function toKrw(inv: Investment) {
  return inv.purchase_price * inv.quantity * (inv.currency === 'USD' ? USD_KRW : 1)
}

// ─── Student detail modal ─────────────────────────────────────────────────────
function StudentModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  const invs = student.investments

  // ── 실시간 환율 (localStorage 캐시 → 없으면 1,350 기본값) ──
  const [usdKrw, setUsdKrw] = useState(1_350)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [priceMap, setPriceMap] = useState<Record<string, any>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)

  useEffect(() => {
    try {
      const cached = localStorage.getItem('usd_krw_rate')
      if (cached) {
        const { rate } = JSON.parse(cached) as { rate: number }
        if (rate > 0) setUsdKrw(Math.round(rate))
      }
    } catch { /* 기본값 유지 */ }
  }, [])

  // ── 현재가 실시간 조회 (배치: 8개씩 순차 처리 → Naver rate limit 방지) ──
  useEffect(() => {
    if (!invs.length) return
    setLoadingPrices(true)
    ;(async () => {
      const BATCH = 8
      const accumulated: Record<string, number> = {}
      for (let i = 0; i < invs.length; i += BATCH) {
        const slice = invs.slice(i, i + BATCH)
        try {
          const res = await fetch('/api/stock-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slice.map(s => ({ ticker: s.ticker, market: s.market }))),
          })
          if (res.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: any[] = await res.json()
            results.forEach(r => { if (r?.currentPrice) accumulated[r.ticker.toUpperCase()] = r.currentPrice })
            // 배치마다 즉시 화면 반영
            setPriceMap({ ...accumulated })
          }
        } catch { /* 배치 실패 시 다음 배치 진행 */ }
        // 배치 간 300ms 대기 (Naver API 과부하 방지)
        if (i + BATCH < invs.length) await new Promise(r => setTimeout(r, 300))
      }
      setLoadingPrices(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])

  // ── 계산 헬퍼 ──
  const getCurr = (inv: Investment): number | null =>
    priceMap[inv.ticker.toUpperCase()] ?? null

  const toKrwRate = (inv: Investment, price?: number) =>
    (price ?? inv.purchase_price) * inv.quantity * (inv.currency === 'USD' ? usdKrw : 1)

  // ── 집계 ──
  const totalCost  = invs.reduce((s, i) => s + toKrwRate(i), 0)
  const pricedInvs = invs.filter(i => getCurr(i) !== null)
  const totalCurr  = pricedInvs.reduce((s, i) => s + toKrwRate(i, getCurr(i)!), 0)
  const costPriced = pricedInvs.reduce((s, i) => s + toKrwRate(i), 0)
  const totalPnL   = totalCurr - costPriced
  const totalRet   = costPriced > 0 ? (totalPnL / costPriced) * 100 : null

  // Lynch 분류 파이 데이터
  const lynchCounts = invs.reduce<Record<string, number>>((acc, inv) => {
    const k = inv.lynch_category ?? 'na'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(lynchCounts).map(([k, v]) => ({
    name: LYNCH_META[k]?.label ?? k,
    value: v,
    color: LYNCH_META[k]?.color ?? '#4b5563',
  }))

  // 마켓 구성
  const mkDist = invs.reduce<Record<string, number>>((acc, i) => {
    acc[i.market] = (acc[i.market] ?? 0) + 1; return acc
  }, {})

  const totalInvested = totalCost

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#1b1e2e', boxShadow: '0 24px 64px rgba(0,0,0,0.8), 10px 10px 28px #0b0d1a, -6px -6px 18px #2b2f46', border: 'none', borderRadius: 18, width: '100%', maxWidth: 920, maxHeight: '90vh', overflowY: 'auto', animation: 'slideUp 0.2s ease-out' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #252840' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {(student.full_name ?? student.email)[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{student.full_name ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{student.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: '#1b1e2e', boxShadow: '3px 3px 8px #0e1020, -2px -2px 6px #282c44', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* 요약 — 실시간 환율·수익률 반영 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
            {/* 보유 종목 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>보유 종목</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9' }}>{invs.length}개</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                분류완료 {invs.filter(i => i.lynch_category && i.lynch_category !== 'na').length}/{invs.length}
              </div>
            </div>
            {/* 총 투자원가 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3d 10px #282c44', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>총 투자원가</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtKrw(totalInvested)}</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>USD×₩{usdKrw.toLocaleString('ko-KR')} 실시간</div>
            </div>
            {/* 총 평가손익 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${totalPnL >= 0 ? '#ef4444' : '#3b82f6'}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {loadingPrices ? '평가손익 조회 중...' : '총 평가손익'}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: totalPnL >= 0 ? '#ef4444' : '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
                {loadingPrices ? '—' : `${totalPnL >= 0 ? '+' : ''}${fmtKrw(Math.round(totalPnL))}`}
              </div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>현재가 기준 평가</div>
            </div>
            {/* 총 수익률 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${(totalRet ?? 0) >= 0 ? '#ef4444' : '#3b82f6'}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>총 수익률</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: (totalRet ?? 0) >= 0 ? '#ef4444' : '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
                {loadingPrices ? '—' : totalRet != null ? `${totalRet >= 0 ? '+' : ''}${totalRet.toFixed(2)}%` : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                {pricedInvs.length < invs.length && !loadingPrices ? `${pricedInvs.length}/${invs.length}개 현재가 로드` : '현재가 기준'}
              </div>
            </div>
          </div>

          {/* 차트 + 마켓 구성 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {/* 린치 분류 도넛 차트 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', border: 'none', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>피터 린치 분류</div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={2}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent"/>)}
                      </Pie>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        return <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#f1f5f9' }}>{payload[0].name}: {payload[0].value}개</div>
                      }}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
                    {pieData.map(e => (
                      <span key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, display: 'inline-block', flexShrink: 0 }}/>
                        {e.name} {e.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: '#334155', padding: '20px 0' }}>종목 없음</div>}
            </div>

            {/* 마켓 구성 */}
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', border: 'none', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>시장 구성</div>
              {Object.entries(mkDist).map(([m, cnt]) => {
                const pct = invs.length > 0 ? (cnt / invs.length) * 100 : 0
                return (
                  <div key={m} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: MARKET_COLOR[m as Market] ?? '#64748b', fontWeight: 600 }}>{m}</span>
                      <span style={{ color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{cnt}개 ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 4, background: '#13162a', boxShadow: 'inset 3px 3px 7px #0e1020, inset -2px -2px 5px #282c44', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: MARKET_COLOR[m as Market] ?? '#475569', borderRadius: 99 }}/>
                    </div>
                  </div>
                )
              })}
              {invs.length === 0 && <div style={{ fontSize: 12, color: '#334155' }}>종목 없음</div>}
            </div>
          </div>

          {/* 종목 목록 */}
          {invs.length > 0 && (
            <div style={{ background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', border: 'none', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #252840', fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
                보유 종목 ({invs.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#141728' }}>
                      {['종목명','티커','시장','매수가','현재가','수익률','수량','투자금액','분류'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invs.map((inv, i) => {
                      const cost     = toKrwRate(inv)
                      const cat      = inv.lynch_category
                      const curPrice = getCurr(inv)
                      const ret      = curPrice != null
                        ? ((curPrice - inv.purchase_price) / inv.purchase_price) * 100
                        : null
                      const retColor = ret == null ? '#475569' : ret >= 0 ? '#ef4444' : '#3b82f6'
                      return (
                        <tr key={inv.id} style={{ borderTop: '1px solid #1e1e1e', background: i % 2 === 0 ? 'transparent' : '#111' }}>
                          <td style={{ padding: '9px 12px', color: '#f1f5f9', fontWeight: 500, whiteSpace: 'nowrap', minWidth: 120 }}>{inv.name}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace' }}>{inv.ticker}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: MARKET_COLOR[inv.market], border: `1px solid ${MARKET_COLOR[inv.market]}44`, borderRadius: 4, padding: '1px 5px' }}>{inv.market}</span>
                          </td>
                          {/* 매수가 */}
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.currency === 'KRW' ? `₩${fmt(inv.purchase_price)}` : `$${inv.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </td>
                          {/* 현재가 */}
                          <td style={{ padding: '9px 12px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                            {loadingPrices ? <span style={{ color: '#374151' }}>…</span>
                              : curPrice != null
                              ? (inv.currency === 'KRW' ? `₩${fmt(curPrice)}` : `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                              : <span style={{ color: '#374151' }}>—</span>}
                          </td>
                          {/* 수익률 */}
                          <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {ret != null
                              ? <span style={{ color: retColor }}>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</span>
                              : <span style={{ color: '#374151' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{inv.quantity.toLocaleString()}</td>
                          <td style={{ padding: '9px 12px', color: '#cbd5e1', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtKrw(cost)}</td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            {cat && cat !== 'na' && LYNCH_META[cat]
                              ? <span style={{ fontSize: 10, color: LYNCH_META[cat].color, background: `${LYNCH_META[cat].color}18`, border: `1px solid ${LYNCH_META[cat].color}40`, borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap', display: 'inline-block' }}>{LYNCH_META[cat].label}</span>
                              : cat === 'na' ? <span style={{ fontSize: 10, color: '#4b5563' }}>N/A</span>
                              : <span style={{ fontSize: 10, color: '#334155' }}>미분류</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()

  const [loading,         setLoading]         = useState(true)
  const [authErr,         setAuthErr]         = useState<string | null>(null)
  const [students,        setStudents]        = useState<StudentRow[]>([])
  const [selected,        setSelected]        = useState<StudentRow | null>(null)
  const [search,          setSearch]          = useState('')
  const [sortCol,         setSortCol]         = useState<SortCol>('invested')
  const [sortAsc,         setSortAsc]         = useState(false)
  const [copied,          setCopied]          = useState(false)
  const [batchRunning,    setBatchRunning]    = useState(false)
  const [batchResult,     setBatchResult]     = useState<{ updated: number; skipped: number; total: number } | null>(null)
  const [deletingId,      setDeletingId]      = useState<string | null>(null)
  const [resetPwEmail,    setResetPwEmail]    = useState<string | null>(null)   // 비밀번호 재설정 중인 이메일
  const [resetPwResult,   setResetPwResult]   = useState<string>('')

  // 배포 URL 감지: env 우선 → 배포 환경(non-localhost) → localhost 경고
  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const isLocalhost = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1')
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||   // .env.local 에 직접 지정한 경우
    (isLocalhost ? '' : rawOrigin)        // 배포 환경이면 자동 감지
  const loginUrl = appUrl ? `${appUrl}/login` : ''

  const copyLoginUrl = () => {
    if (!loginUrl) return
    navigator.clipboard.writeText(loginUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      const supabase = createClient()

      // auth 확인
      const { data: { session } } = await supabase.auth.getSession()
      let userId = session?.user?.id
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id
      }
      if (!userId) { router.push('/login'); return }

      // role 확인 — teacher만 허용
      const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', userId).single()

      if (myProfile?.role !== 'teacher') {
        setAuthErr('이 페이지는 선생님 계정만 접근할 수 있습니다.')
        return
      }

      // ── 3단계 학생 조회 전략 ──────────────────────────────────────────
      // 전략 1: role='student' 직접 필터 (role 컬럼이 올바르게 설정된 경우)
      // 전략 2: 전체 profiles 조회 후 teacher 제외 (role=null 또는 미설정)
      // 전략 3: investments 역추적 (RLS로 profiles 직접 접근 불가 시 대비)
      const [profilesByRoleRes, allProfilesRes, invRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: true }),
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        supabase.from('investments').select('*').order('created_at', { ascending: false }),
      ])

      const allInv = invRes.data ?? []

      // --- 전략 1: role='student' 결과 ---
      let profiles: Profile[] = (profilesByRoleRes.data ?? [])
      console.log('[Admin] 전략1 role=student 결과:', profiles.length, '에러:', profilesByRoleRes.error?.message)

      // --- 전략 2: 전체 조회, teacher 제외 ---
      if (profiles.length === 0) {
        const allP = (allProfilesRes.data ?? []).filter(
          (p: Profile) => p.id !== userId && p.role !== 'teacher'
        )
        console.log('[Admin] 전략2 전체조회(teacher제외) 결과:', allP.length, '에러:', allProfilesRes.error?.message)
        if (allP.length > 0) profiles = allP
      }

      // --- 전략 3: investments 역추적 (RLS로 위 두 전략이 모두 0인 경우) ---
      if (profiles.length === 0 && allInv.length > 0) {
        // teacher는 investments 전체 조회 가능 → unique user_id 추출
        const uniqueIds = Array.from(
          new Set(allInv.map((i: { user_id: string }) => i.user_id).filter((id: string) => id !== userId))
        )
        console.log('[Admin] 전략3 investments 역추적 — 유니크 유저:', uniqueIds.length)
        if (uniqueIds.length > 0) {
          const { data: invProfiles, error: ipErr } = await supabase
            .from('profiles')
            .select('*')
            .in('id', uniqueIds)
          console.log('[Admin] 전략3 profiles in(ids) 결과:', invProfiles?.length, '에러:', ipErr?.message)
          if (invProfiles && invProfiles.length > 0) {
            profiles = invProfiles.filter((p: Profile) => p.role !== 'teacher')
          } else {
            // profiles 접근 불가 시 investments의 user_id만으로 임시 row 생성
            console.warn('[Admin] profiles 접근 불가 — investments 기반 임시 표시')
            const tempProfiles: Profile[] = uniqueIds.map((id: unknown) => ({
              id:         String(id),
              email:      `(user ${String(id).slice(0, 8)}...)`,
              full_name:  null,
              role:       'student',
              created_at: '',
            }))
            profiles = tempProfiles
          }
        }
      }

      console.log('[Admin] 최종 학생 수:', profiles.length)

      const invList = allInv
      const rows: StudentRow[] = profiles.map((p: Profile) => {
        const invs = invList.filter((i: { user_id: string }) => i.user_id === p.id)
        const totalKrw = invs.reduce((s: number, i: Investment) => s + toKrw(i), 0)
        return { ...p, investments: invs, totalKrw, count: invs.length }
      })

      setStudents(rows)

    } catch (err) {
      console.error('[Admin] fetchData 예외:', (err as Error).message)
      setStudents([])
    } finally {
      // 성공·실패·예외 모두 로딩 해제
      setLoading(false)
    }
  }, [router])

  // 5초 타임아웃
  useEffect(() => {
    if (!loading) return
    const tid = setTimeout(() => {
      console.warn('[Admin] 로딩 타임아웃 — 강제 해제')
      setLoading(false)
    }, 5000)
    return () => clearTimeout(tid)
  }, [loading])

  useEffect(() => { fetchData() }, [fetchData])

  // ── 학생 계정 삭제 ────────────────────────────────────────────────────────────
  const handleDeleteStudent = async (s: StudentRow) => {
    const confirmed = window.confirm(
      `⚠️ 학생 계정을 삭제하시겠습니까?\n\n` +
      `이름: ${s.full_name}\n` +
      `이메일: ${s.email}\n` +
      `보유 종목: ${s.count}개\n\n` +
      `삭제하면 해당 학생의 모든 데이터(종목, 거래기록 등)가\n` +
      `영구적으로 삭제됩니다. 되돌릴 수 없습니다.`
    )
    if (!confirmed) return

    setDeletingId(s.id)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: s.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`삭제 실패: ${data.error}`)
        return
      }
      // 목록에서 즉시 제거
      setStudents(prev => prev.filter(st => st.id !== s.id))
      if (data.warning) {
        alert(`삭제 완료 (주의: ${data.warning})`)
      }
    } catch (e) {
      alert(`삭제 중 오류: ${(e as Error).message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // ── 임시 비밀번호 발급 (Supabase Admin API로 직접 설정) ─────────────────────
  const [tempPwModal, setTempPwModal] = useState<{ id: string; email: string; name: string } | null>(null)
  const [issuedTempPw, setIssuedTempPw] = useState<string>('')

  const handleIssueTempPassword = async (s: StudentRow) => {
    setResetPwEmail(s.id)
    setResetPwResult('')
    setIssuedTempPw('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/admin/set-temp-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: s.id, email: s.email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResetPwResult(`❌ 실패: ${data.error}`)
      } else {
        setIssuedTempPw(data.tempPassword)
        setTempPwModal({ id: s.id, email: s.email, name: s.full_name ?? s.email })
        setResetPwResult(`✅ ${s.email} 임시 비번 발급 완료`)
      }
    } catch (e) {
      setResetPwResult(`❌ 오류: ${(e as Error).message}`)
    } finally {
      setResetPwEmail(null)
    }
  }

  // ── 기존 이메일 링크 방식 (폴백용으로 유지)
  const handleSendPasswordReset = async (email: string) => {
    setResetPwEmail(email)
    setResetPwResult('')
    try {
      const sb = createClient()
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?type=recovery`,
      })
      if (error) {
        setResetPwResult(`❌ 발송 실패: ${error.message}`)
      } else {
        setResetPwResult(`✅ ${email} 로 재설정 링크를 발송했습니다.`)
      }
    } catch (e) {
      setResetPwResult(`❌ 오류: ${(e as Error).message}`)
    } finally {
      setResetPwEmail(null)
    }
  }

  // ── 정렬 + 검색 ────────────────────────────────────────────
  const displayed = students
    .filter(s => {
      const q = search.toLowerCase()
      return !q || s.email.toLowerCase().includes(q) || (s.full_name ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let d = 0
      if (sortCol === 'email')    d = a.email.localeCompare(b.email)
      if (sortCol === 'joined')   d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortCol === 'count')    d = a.count    - b.count
      if (sortCol === 'invested') d = a.totalKrw - b.totalKrw
      return sortAsc ? d : -d
    })

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  // ── 요약 통계 — students는 이미 role='student' 만 포함됨 ──────
  const totalStudents  = students.length
  const totalHoldings  = students.reduce((s, r) => s + r.count, 0)
  const totalInvested  = students.reduce((s, r) => s + r.totalKrw, 0)
  const lynchDone      = students
    .flatMap(s => s.investments)
    .filter(i => i.lynch_category && i.lynch_category !== 'na').length

  // ── 공통 스타일 ─────────────────────────────────────────────
  const thStyle = (col: SortCol): React.CSSProperties => ({
    padding: '10px 14px', textAlign: 'left',
    fontSize: 10, fontWeight: 600, color: sortCol === col ? '#60a5fa' : '#475569',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  })
  const sortArrow = (col: SortCol) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        * { box-sizing: border-box }
        ::-webkit-scrollbar { width: 5px; height: 5px }
        ::-webkit-scrollbar-track { background: #0a0a0a }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px }
        input::placeholder { color: #334155 }
        tr.hoverable:hover td { background: rgba(30,30,30,0.8) !important }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#13151f', color: '#f1f5f9', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

        {/* 사이드바 레이아웃이 헤더를 제공합니다 */}

        {/* ── Auth error ── */}
        {authErr && (
          <div style={{ maxWidth: 1280, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>접근 권한 없음</div>
              <div style={{ fontSize: 14, color: '#64748b' }}>{authErr}</div>
              <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 20px', borderRadius: 8, background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                대시보드로 이동
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && !authErr && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        )}

        {/* ── Main ── */}
        {!loading && !authErr && (
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 60px', animation: 'fadeIn 0.25s ease-out' }}>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>관리자 대시보드</h1>
                <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>전체 학생 포트폴리오 현황</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* 피터린치 일괄분류 버튼 */}
                <button
                  disabled={batchRunning}
                  onClick={async () => {
                    if (!confirm('모든 학생의 미분류 종목을 피터린치 AI로 자동 분류합니다.\n시간이 걸릴 수 있습니다. 계속할까요?')) return
                    setBatchRunning(true); setBatchResult(null)
                    try {
                      const res = await fetch('/api/lynch-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                      if (res.ok) {
                        const r = await res.json()
                        setBatchResult(r)
                        await fetchData()
                      } else {
                        const e = await res.json()
                        alert(`오류: ${e.error ?? '알 수 없는 오류'}`)
                      }
                    } catch { alert('네트워크 오류') }
                    finally { setBatchRunning(false) }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: batchRunning ? '#1b1e2e' : '#14532d22', boxShadow: '4px 4px 10px #0e1020, -2px -2px 7px #282c44', border: `1px solid ${batchRunning ? '#374151' : '#16a34a55'}`, color: batchRunning ? '#64748b' : '#4ade80', fontSize: 13, cursor: batchRunning ? 'not-allowed' : 'pointer' }}>
                  {batchRunning ? '⏳ 분류 중…' : '🤖 피터린치 일괄분류'}
                </button>
                {batchResult && (
                  <span style={{ fontSize: 12, color: '#4ade80', alignSelf: 'center', background: '#14532d33', padding: '4px 10px', borderRadius: 6 }}>
                    ✅ {batchResult.updated}개 분류 완료 (건너뜀 {batchResult.skipped})
                  </span>
                )}
                {/* 비밀번호 재설정 결과 */}
                {resetPwResult && (
                  <span style={{
                    fontSize: 12, alignSelf: 'center', padding: '4px 10px', borderRadius: 6,
                    color: resetPwResult.startsWith('✅') ? '#4ade80' : '#f87171',
                    background: resetPwResult.startsWith('✅') ? '#14532d33' : '#7f1d1d33',
                  }}>
                    {resetPwResult}
                  </span>
                )}
                <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: '#1b1e2e', boxShadow: '4px 4px 10px #0e1020, -2px -2px 7px #282c44', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
                  새로고침
                </button>
              </div>
            </div>

            {/* ── 요약 카드 4개 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
              {[
                { label: '전체 학생 수',    value: `${totalStudents}명`,           accent: '#f1f5f9' },
                { label: '전체 보유 종목',   value: `${totalHoldings}개`,           accent: '#60a5fa' },
                { label: '총 투자금액',      value: fmtKrw(totalInvested),         accent: '#34d399', note: 'USD×1,350 환산 포함' },
                { label: '린치 분류 완료',   value: `${lynchDone}개`,              accent: '#fb923c' },
              ].map(({ label, value, accent, note }) => (
                <div key={label} style={{ background: '#1b1e2e', boxShadow: '7px 7px 18px #0e1020, -4px -4px 12px #282c44', border: 'none', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.4px' }}>{value}</div>
                  {note && <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>{note}</div>}
                </div>
              ))}
            </div>

            {/* ── 검색 ── */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', flexGrow: 1, maxWidth: 280 }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="이름 / 이메일 검색"
                  style={{ width: '100%', padding: '8px 12px 8px 28px', background: '#1b1e2e', boxShadow: 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44', border: 'none', borderRadius: 8, color: '#dde4f0', fontSize: 13, outline: 'none' }}
                  onFocus={e  => { e.currentTarget.style.boxShadow = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44, 0 0 0 1px #6366f155' }}
                  onBlur={e   => { e.currentTarget.style.boxShadow = 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44' }}
                />
              </div>
              <span style={{ fontSize: 12, color: '#334155', marginLeft: 'auto' }}>{displayed.length}명 표시</span>
            </div>

            {/* ── 학생 테이블 ── */}
            <div style={{ background: '#1b1e2e', boxShadow: '7px 7px 18px #0e1020, -4px -4px 12px #282c44', border: 'none', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#141728', borderBottom: '1px solid #252840' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>학생</th>
                      <th style={thStyle('joined')} onClick={() => toggleSort('joined')}>가입일{sortArrow('joined')}</th>
                      <th style={thStyle('count')}  onClick={() => toggleSort('count')}>종목 수{sortArrow('count')}</th>
                      <th style={thStyle('invested')} onClick={() => toggleSort('invested')}>투자금액{sortArrow('invested')}</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>시장 구성</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>린치 분류율</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center' }}>
                        {search ? (
                          <span style={{ color: '#334155', fontSize: 14 }}>검색 결과가 없습니다</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 32 }}>🎓</span>
                            <span style={{ color: '#475569', fontSize: 15, fontWeight: 600 }}>학생이 표시되지 않습니다</span>
                            {/* RLS 차단 안내 — DB에 학생이 있는데 0명으로 보이는 경우 */}
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '14px 18px', maxWidth: 540, textAlign: 'left' as const, marginTop: 4 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>
                                🔒 Supabase RLS 정책으로 학생 데이터가 차단되고 있을 수 있습니다
                              </div>
                              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginBottom: 10 }}>
                                DB에 학생이 있는데도 0명으로 표시된다면, Supabase SQL Editor에서 아래를 실행하세요:
                              </div>
                              <pre style={{
                                background: '#0d0f1a', borderRadius: 7, padding: '10px 12px',
                                fontSize: 10, color: '#34d399', overflowX: 'auto',
                                margin: 0, lineHeight: 1.6,
                                userSelect: 'all' as const,
                              }}>{`CREATE OR REPLACE FUNCTION public.current_user_is_teacher()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

CREATE POLICY "teacher_reads_all_profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.current_user_is_teacher()
);`}</pre>
                            </div>
                            <span style={{ color: '#334155', fontSize: 13 }}>또는 학생들에게 아래 가입 링크를 공유해 주세요</span>
                            {/* 가입 링크 + 복사 버튼 */}
                            {loginUrl ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, background: '#1b1e2e', boxShadow: '5px 5px 14px #0e1020, -3px -3px 10px #282c44', borderRadius: 10, padding: '10px 14px' }}>
                                <code style={{ fontSize: 12, color: '#60a5fa', userSelect: 'all' as const, wordBreak: 'break-all' as const }}>
                                  {loginUrl}
                                </code>
                                <button
                                  onClick={copyLoginUrl}
                                  style={{
                                    padding: '5px 12px', borderRadius: 7, border: 'none',
                                    background: copied ? '#065f46' : '#1e3a5f',
                                    color: copied ? '#34d399' : '#60a5fa',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    whiteSpace: 'nowrap' as const, transition: 'all 0.2s', flexShrink: 0,
                                  }}
                                >
                                  {copied ? '✓ 복사됨' : '🔗 복사'}
                                </button>
                              </div>
                            ) : (
                              /* localhost 개발 환경 — 배포 URL 미설정 안내 */
                              <div style={{ marginTop: 8, background: '#1b1e2e', boxShadow: 'inset 4px 4px 10px #0e1020, inset -3px -3px 8px #282c44', borderRadius: 10, padding: '12px 16px', maxWidth: 480, textAlign: 'left' as const }}>
                                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>⚠️ 로컬 개발 환경</div>
                                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
                                  배포 후 Vercel URL이 자동으로 표시됩니다.<br/>
                                  지금 바로 설정하려면 <code style={{ color: '#60a5fa', background: '#13162a', padding: '1px 5px', borderRadius: 4 }}>.env.local</code> 에 추가하세요:
                                </div>
                                <div style={{ marginTop: 8, background: '#13162a', borderRadius: 7, padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#34d399' }}>
                                  NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td></tr>
                    ) : displayed.map((s, idx) => {
                      const lynchPct = s.count > 0
                        ? Math.round((s.investments.filter(i => i.lynch_category && i.lynch_category !== 'na').length / s.count) * 100)
                        : 0
                      const mkDist = s.investments.reduce<Record<string, number>>((acc, i) => { acc[i.market] = (acc[i.market] ?? 0) + 1; return acc }, {})
                      const pctColor = lynchPct >= 80 ? '#34d399' : lynchPct >= 50 ? '#fb923c' : '#f87171'

                      return (
                        <tr key={s.id} className="hoverable" style={{ borderTop: '1px solid #1e2140', background: idx % 2 === 0 ? 'transparent' : 'rgba(20,23,40,0.5)' }}>
                          {/* 학생 */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#5b21b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {(s.full_name ?? s.email)[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {s.full_name ?? '—'}
                                  {s.role === 'teacher' && <span style={{ fontSize: 9, color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)', borderRadius: 4, padding: '1px 5px' }}>TEACHER</span>}
                                </div>
                                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{s.email}</div>
                              </div>
                            </div>
                          </td>
                          {/* 가입일 */}
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {new Date(s.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                          </td>
                          {/* 종목 수 */}
                          <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                            {s.count}<span style={{ fontSize: 11, color: '#475569', marginLeft: 3 }}>개</span>
                          </td>
                          {/* 투자금액 */}
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {s.totalKrw > 0 ? fmtKrw(s.totalKrw) : '—'}
                          </td>
                          {/* 시장 구성 */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(Object.entries(mkDist) as [Market, number][]).map(([m, cnt]) => (
                                <span key={m} style={{ fontSize: 10, fontWeight: 700, color: MARKET_COLOR[m], border: `1px solid ${MARKET_COLOR[m]}44`, borderRadius: 4, padding: '1px 5px' }}>{m} {cnt}</span>
                              ))}
                              {s.count === 0 && <span style={{ fontSize: 11, color: '#334155' }}>—</span>}
                            </div>
                          </td>
                          {/* 린치 분류율 */}
                          <td style={{ padding: '12px 14px' }}>
                            {s.count > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 52, height: 4, background: '#1e1e1e', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${lynchPct}%`, background: pctColor, borderRadius: 99 }}/>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: pctColor, fontVariantNumeric: 'tabular-nums' }}>{lynchPct}%</span>
                              </div>
                            ) : <span style={{ fontSize: 12, color: '#334155' }}>—</span>}
                          </td>
                          {/* 상세 / 삭제 버튼 */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                              {/* 상세보기 */}
                              <button
                                onClick={() => setSelected(s)}
                                style={{ padding: '5px 12px', borderRadius: 7, background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#94a3b8', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
                              >
                                상세보기
                              </button>
                              {/* ★ 임시 비밀번호 직접 발급 (권장) */}
                              <button
                                onClick={() => handleIssueTempPassword(s)}
                                disabled={resetPwEmail === s.id}
                                title={`${s.full_name} 임시 비밀번호 발급`}
                                style={{
                                  padding: '5px 10px', borderRadius: 7,
                                  border: '1px solid rgba(251,191,36,0.4)',
                                  background: resetPwEmail === s.id ? '#1e1e1e' : 'rgba(251,191,36,0.08)',
                                  color: resetPwEmail === s.id ? '#4b5563' : '#fbbf24',
                                  cursor: resetPwEmail === s.id ? 'not-allowed' : 'pointer',
                                  fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { if (!resetPwEmail) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.18)' }}
                                onMouseLeave={e => { if (!resetPwEmail) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.08)' }}
                              >
                                🔑 임시 비번 발급
                              </button>
                              {/* 이메일 링크 방식 (보조) */}
                              <button
                                onClick={() => handleSendPasswordReset(s.email)}
                                disabled={resetPwEmail === s.email}
                                title={`${s.full_name} 비밀번호 재설정 링크 발송`}
                                style={{
                                  padding: '5px 10px', borderRadius: 7,
                                  border: '1px solid #1e3a5f',
                                  background: resetPwEmail === s.email ? '#1e1e1e' : '#0c1e30',
                                  color: resetPwEmail === s.email ? '#4b5563' : '#60a5fa',
                                  cursor: resetPwEmail === s.email ? 'not-allowed' : 'pointer',
                                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { if (!resetPwEmail) (e.currentTarget as HTMLButtonElement).style.background = '#1e3a5f' }}
                                onMouseLeave={e => { if (!resetPwEmail) (e.currentTarget as HTMLButtonElement).style.background = '#0c1e30' }}
                              >
                                🔑 비번 재설정
                              </button>
                              {/* 삭제 */}
                              <button
                                onClick={() => handleDeleteStudent(s)}
                                disabled={deletingId === s.id}
                                title={`${s.full_name} 계정 삭제`}
                                style={{
                                  width: 28, height: 28, borderRadius: 7, border: '1px solid #3f1515',
                                  background: deletingId === s.id ? '#1e1e1e' : '#2d0a0a',
                                  color: deletingId === s.id ? '#4b5563' : '#f87171',
                                  cursor: deletingId === s.id ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0, transition: 'all 0.15s', fontSize: 13,
                                }}
                                onMouseEnter={e => { if (deletingId !== s.id) (e.currentTarget as HTMLButtonElement).style.background = '#7f1d1d' }}
                                onMouseLeave={e => { if (deletingId !== s.id) (e.currentTarget as HTMLButtonElement).style.background = '#2d0a0a' }}
                              >
                                {deletingId === s.id ? '⏳' : '🗑'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 14 }}>
              행을 클릭하거나 상세보기 버튼으로 개별 포트폴리오를 조회합니다
            </p>
          </div>
        )}
      </div>

      {/* ── 학생 상세 모달 ── */}
      {selected && <StudentModal student={selected} onClose={() => setSelected(null)}/>}

      {/* ★ 임시 비밀번호 발급 결과 모달 */}
      {tempPwModal && issuedTempPw && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#0f1117', border: '1px solid rgba(251,191,36,0.4)',
            borderRadius: 16, padding: '32px 28px', maxWidth: 440, width: '100%',
            boxShadow: '0 0 40px rgba(251,191,36,0.15)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>임시 비밀번호 발급 완료</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{tempPwModal.name} ({tempPwModal.email})</div>
            </div>
            <div style={{ padding: '16px 20px', borderRadius: 10, marginBottom: 20, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>임시 비밀번호</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: '#fbbf24', letterSpacing: '0.1em' }}>{issuedTempPw}</div>
              <button onClick={() => { navigator.clipboard.writeText(issuedTempPw) }} style={{ marginTop: 10, padding: '4px 12px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: 11, cursor: 'pointer' }}>📋 복사</button>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>
              <strong style={{ color: '#60a5fa' }}>학생 안내 방법:</strong><br />
              1 위 임시 비번을 학생에게 카톡/문자로 전달<br />
              2 학생이 임시 비번으로 로그인<br />
              3 대시보드 상단 안내 배너에서 새 비밀번호로 즉시 변경
            </div>
            <button onClick={() => { setTempPwModal(null); setIssuedTempPw('') }} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>확인 (닫기)</button>
          </div>
        </div>
      )}
    </>
  )
}
