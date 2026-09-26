'use client'
// 학생 스쿨 리그 — 내 순위 · 계산 도움말 · 순위표(수익률만) · 친구 포트폴리오(1·2위, 비중만 — 금액 없음)
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client'
import { useJson } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { pct, upDown } from '@/lib/studentFormat'

// ── 응답 모양(/api/school-league StudentPortfolio 중 쓰는 필드만) — 밖에서 온 값이라 하나씩 검사해 옮긴다 ──
interface Holding { name: string; weightPct: number }
interface MixRow { key: string; label: string; weightPct: number }
interface Student {
  userId: string
  name: string
  avatarColor: string | null
  isRegistered: boolean
  totalReturn: number | null
  coreRatio: number | null
  satelliteRatio: number | null
  /** false = 서버가 보유 구성을 비워 보냄(1~3위와 나만 채운다). 필드가 없으면(옛 응답) true 로 본다 */
  detail: boolean
  topHoldings: Holding[]
  otherPct: number
  otherCount: number
  mix: MixRow[]
  /** 보여 준 묶음 밖 나머지 비중 — 옛 응답엔 없어 0 */
  mixOtherPct: number
  pricedAll: boolean
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const numOr = (n: unknown, d: number) => isNum(n) ? n : d
const weight = (n: number) => `${n.toFixed(1)}%`   // 비중은 부호 없이(등락률이 아니다)

function parseStudent(x: unknown): Student | null {
  const s = x as Record<string, unknown> | null
  if (!s || typeof s.userId !== 'string') return null
  const holdings = Array.isArray(s.topHoldings) ? s.topHoldings : []
  const mix = Array.isArray(s.mix) ? s.mix : []
  return {
    userId: s.userId,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '이름 없음',
    avatarColor: typeof s.avatarColor === 'string' ? s.avatarColor : null,
    isRegistered: s.isRegistered === true,
    totalReturn: isNum(s.totalReturn) ? s.totalReturn : null,
    coreRatio: isNum(s.coreRatio) ? s.coreRatio : null,
    satelliteRatio: isNum(s.satelliteRatio) ? s.satelliteRatio : null,
    detail: s.detail !== false,
    topHoldings: holdings.flatMap(h => {
      const o = h as Record<string, unknown> | null
      return o && typeof o.name === 'string' && isNum(o.weightPct) ? [{ name: o.name, weightPct: o.weightPct }] : []
    }),
    otherPct: numOr(s.otherPct, 0),
    otherCount: numOr(s.otherCount, 0),
    mix: mix.flatMap(m => {
      const o = m as Record<string, unknown> | null
      return o && typeof o.key === 'string' && typeof o.label === 'string' && isNum(o.weightPct) ? [{ key: o.key, label: o.label, weightPct: o.weightPct }] : []
    }),
    mixOtherPct: numOr(s.mixOtherPct, 0),
    pricedAll: s.pricedAll !== false,
  }
}

/** 로그인한 내 id — undefined = 아직 모름, null = 로그인 안 됨. 순위는 이름이 아니라 이 id 로 찾는다(동명이인) */
function useMyId() {
  const [id, setId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser()
      .then(({ data: { user } }) => { if (!cancelled) setId(user?.id ?? null) })
      .catch(() => { if (!cancelled) setId(null) })
    return () => { cancelled = true }
  }, [])
  return id
}

const linkBtn = { alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' } as const
const nowrap = { whiteSpace: 'nowrap' } as const
const ellipsis = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** 계산 도움말 — 사실은 전부 src/lib/realizedPnl.ts(totalReturnPct · 달러 종목 환율 처리 · 시세 결측 처리)에서 옮겼다 */
function HelpBox() {
  const li = { fontSize: FS.tiny, color: TK.slate300, lineHeight: 1.6 } as const
  return (
    <div id="league-help" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <span style={{ fontSize: FS.body, color: TK.slate100, lineHeight: 1.6 }}>
        누적 수익률 = (지금 가진 종목의 손익 + 이미 판 종목에서 확정된 손익) ÷ 지금까지 넣은 돈
      </span>
      <ul style={{ margin: 0, paddingLeft: SP.lg, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <li style={li}>돈을 언제 더 넣었는지는 따지지 않아요(최근에 큰돈을 넣으면 수익률이 낮게 보일 수 있어요).</li>
        <li style={li}>시세를 못 가져온 종목은 산 가격으로 계산해요.</li>
        <li style={li}>달러 종목은 원금과 평가를 같은 오늘 환율로 계산해서 환율 변화는 빠져요.</li>
      </ul>
    </div>
  )
}

function Avatar({ name, color }: { name: string; color: string | null }) {
  return (
    <span aria-hidden style={{ width: 32, height: 32, flexShrink: 0, borderRadius: RAD.pill, background: color ?? TK.slate600, color: TK.bg1, fontSize: FS.tiny, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from(name)[0] ?? '?'}
    </span>
  )
}

/** 내 순위 카드 */
function MyRank({ me, ranked, myId }: { me: Student | undefined; ranked: Student[]; myId: string }) {
  let body: React.ReactNode
  if (!me) {
    body = <span style={noteStyle()}>리그 명단에서 내 계정을 찾지 못했어요.</span>
  } else if (!me.isRegistered) {
    body = (
      <>
        <span style={{ fontSize: FS.body, color: TK.slate200 }}>종목을 기록하면 리그에 들어와요</span>
        <Link href="/s/record" style={linkBtn}>종목 기록하기</Link>
      </>
    )
  } else {
    const idx = ranked.findIndex(s => s.userId === myId)
    if (idx < 0) {
      body = <span style={noteStyle()}>내 수익률을 아직 계산하지 못했어요.</span>
    } else {
      const r = ranked[idx].totalReturn as number
      const gap = idx > 0 ? (ranked[idx - 1].totalReturn as number) - r : null
      body = (
        <>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: SP.md, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100, ...nowrap }}>{idx + 1}위 <span style={{ fontSize: FS.lg, color: TK.sub }}>/ {ranked.length}명</span></span>
            <span style={{ fontSize: FS.xl, fontWeight: 800, color: upDown(r), ...nowrap }}>{pct(r)}</span>
          </span>
          <span style={{ fontSize: FS.body, color: TK.slate200 }}>
            {gap == null ? '1위예요' : `${idx}위와 ${gap.toFixed(1)}%p 차이`}
          </span>
          <span style={noteStyle()}>판 종목에서 확정된 손익까지 더한 수익률이에요.</span>
        </>
      )
    }
  }
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <span style={{ fontSize: FS.tiny, color: TK.sub }}>내 순위</span>
      {body}
    </section>
  )
}

/** 순위표 — 등록했고 수익률이 계산된 학생만. 금액은 없다 */
function RankTable({ ranked, myId, unregistered, uncomputed }: { ranked: Student[]; myId: string; unregistered: number; uncomputed: number }) {
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
      <CardHead title="순위표" />
      {ranked.length === 0
        ? <span style={noteStyle()}>아직 순위에 오른 친구가 없어요.</span>
        : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            {ranked.map((s, i) => {
              const mine = s.userId === myId
              const r = s.totalReturn as number
              return (
                <li key={s.userId} aria-current={mine ? 'true' : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 44, padding: `${SP.xs}px ${SP.sm}px`, borderRadius: RAD.sm,
                  background: mine ? TK.bg10 : 'transparent', border: `1px solid ${mine ? TK.blue600 : 'transparent'}`,
                }}>
                  <span style={{ width: 36, flexShrink: 0, fontSize: FS.body, fontWeight: 800, color: TK.slate200, ...nowrap }}>{i + 1}위</span>
                  <Avatar name={s.name} color={s.avatarColor} />
                  <span style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: SP.xs, minWidth: 0 }}>
                    <span style={{ fontSize: FS.body, color: TK.slate100, ...ellipsis }}>{s.name}</span>
                    {mine && <span style={{ flexShrink: 0, fontSize: FS.tiny, fontWeight: 700, color: TK.blue300, padding: `0 ${SP.xs}px`, border: `1px solid ${TK.blue600}`, borderRadius: RAD.xs }}>나</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 700, color: upDown(r), ...nowrap }}>{pct(r)}</span>
                </li>
              )
            })}
          </ol>
        )}
      {unregistered > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ fontSize: FS.tiny, color: TK.slate300 }}>아직 종목을 안 넣은 친구 {unregistered}명</span>
          <span style={noteStyle()}>내 자산의 + 기록 버튼으로 한 종목만 넣어도 리그에 들어와요.</span>
        </div>
      )}
      {uncomputed > 0 && <span style={noteStyle()}>종목은 있지만 수익률을 계산하지 못한 친구 {uncomputed}명은 순위표에서 빠졌어요.</span>}
    </section>
  )
}

/** 친구 포트폴리오 한 장 — 종목 비중·구성 비중만(금액 없음) */
function FriendCard({ s, rank }: { s: Student; rank: number }) {
  const r = s.totalReturn as number
  const count = s.topHoldings.length + s.otherCount   // 티커별로 합친 종목 수(holdingCount 는 분할매수 행까지 센다)
  const chip = { display: 'inline-flex', alignItems: 'baseline', gap: SP.xs, maxWidth: '100%', padding: `${SP.xs}px ${SP.sm}px`, borderRadius: RAD.sm, background: TK.bg3, border: `1px solid ${TK.line1}`, fontSize: FS.tiny, color: TK.slate200 } as const
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
        <Avatar name={s.name} color={s.avatarColor} />
        <span style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate100, ...ellipsis }}>{s.name} · {rank}위</span>
          <span style={{ fontSize: FS.tiny, color: TK.sub, ...ellipsis }}>
            {count}종목{s.coreRatio != null && s.satelliteRatio != null ? ` · 코어 ${s.coreRatio}% : 위성 ${s.satelliteRatio}%` : ''}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: FS.lg, fontWeight: 800, color: upDown(r), ...nowrap }}>{pct(r)}</span>
      </div>

      {s.topHoldings.length === 0
        ? <span style={noteStyle()}>종목 비중을 계산하지 못했어요.</span>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.xs }}>
            {s.topHoldings.map((h, i) => (
              <span key={`${h.name}-${i}`} style={chip}>
                <span style={ellipsis}>{h.name}</span>
                <span style={{ ...nowrap, color: TK.slate100, fontWeight: 700 }}>{weight(h.weightPct)}</span>
              </span>
            ))}
            {s.otherCount > 0 && (
              <span style={{ ...chip, color: TK.sub }}>
                <span style={nowrap}>기타 {s.otherCount}종</span>
                <span style={nowrap}>{weight(s.otherPct)}</span>
              </span>
            )}
          </div>
        )}

      {s.mix.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}` }}>
          <span style={{ fontSize: FS.tiny, color: TK.slate300 }}>왜 수익률이 달랐을까 · 보유 구성으로 묶었어요</span>
          {s.mix.map(m => (
            <span key={m.key} style={{ display: 'flex', justifyContent: 'space-between', gap: SP.sm, fontSize: FS.body, color: TK.slate200 }}>
              <span style={ellipsis}>{m.label}</span>
              <span style={{ ...nowrap, fontWeight: 700 }}>{weight(m.weightPct)}</span>
            </span>
          ))}
          {s.mixOtherPct > 0 && (
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: SP.sm, fontSize: FS.body, color: TK.sub }}>
              <span>나머지</span>
              <span style={nowrap}>{weight(s.mixOtherPct)}</span>
            </span>
          )}
          <span style={noteStyle()}>ETF는 상장된 시장으로 묶었어요(담은 자산의 나라와 다를 수 있어요).</span>
        </div>
      )}
      {!s.pricedAll && <span style={noteStyle()}>시세를 못 가져온 종목은 산 가격으로 계산했어요.</span>}
    </section>
  )
}

export default function StudentLeague() {
  const myId = useMyId()
  const league = useJson<{ students?: unknown }>('/api/school-league')
  const [help, setHelp] = useState(false)

  let content: React.ReactNode
  if (myId === undefined || league.state === 'idle' || league.state === 'loading') {
    content = <div style={card}><span style={noteStyle()}>리그 순위를 불러오는 중… 조금 걸려요</span></div>
  } else if (myId === null || league.state === 'unauth') {
    content = (
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.body, color: TK.slate200 }}>로그인하면 리그 순위가 보여요.</span>
        <Link href="/login" style={linkBtn}>로그인</Link>
      </div>
    )
  } else if (league.state === 'failed' || !Array.isArray(league.data?.students)) {
    content = <div style={card}><FailRow text="리그 순위를 못 가져왔어요." onRetry={league.reload} retryLabel="리그 순위 다시 불러오기" /></div>
  } else {
    const students = league.data.students.map(parseStudent).filter((s): s is Student => s != null)
    // 순위 = 등록했고 수익률이 계산된 학생의 누적 수익률 내림차순. 같은 수익률은 응답 순서(가입 순)를 그대로 두고
    //  각자 다른 등수를 준다(Array.sort 는 안정 정렬) — 홈 리그 한 줄(LeagueLine)과 같은 규칙이라 두 화면 등수가 같다
    const ranked = students.filter(s => s.isRegistered && s.totalReturn != null)
      .sort((a, b) => (b.totalReturn as number) - (a.totalReturn as number))
    const me = students.find(s => s.userId === myId)
    const unregistered = students.filter(s => !s.isRegistered).length
    const uncomputed = students.filter(s => s.isRegistered && s.totalReturn == null).length
    // 친구 포트폴리오 = 나를 뺀 상위 2명(서버가 보유 구성을 채워 보낸 학생만 — 1~3위와 나만 채운다)
    const friends = ranked.map((s, i) => ({ s, rank: i + 1 }))
      .filter(({ s }) => s.userId !== myId && s.detail)
      .slice(0, 2)
    content = (
      <>
        <MyRank me={me} ranked={ranked} myId={myId} />
        <RankTable ranked={ranked} myId={myId} unregistered={unregistered} uncomputed={uncomputed} />
        <section style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>친구 포트폴리오</h2>
          <span style={noteStyle()}>상위 친구의 종목 비중이에요. 금액은 보이지 않아요.</span>
          {friends.length === 0
            ? <div style={card}><span style={noteStyle()}>보여 줄 친구 포트폴리오가 없어요.</span></div>
            : <div className="sl-two">{friends.map(f => <FriendCard key={f.s.userId} s={f.s} rank={f.rank} />)}</div>}
        </section>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg }}>
      {/* 폰이 기본, 769px↑ 만 덮어쓴다 — 기본값 + min-width 하나라 두 조건이 정확한 여집합이다 */}
      <style>{`
        .sl-two { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${SP.lg}px; align-items: start }
        @media (min-width: 769px) { .sl-two { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP.sm }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>스쿨 리그</h1>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>누적 수익률 순위 · 금액은 공개하지 않아요</span>
        </div>
        <button
          type="button" onClick={() => setHelp(h => !h)} aria-expanded={help} aria-controls="league-help" aria-label="누적 수익률 계산 방법"
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: RAD.pill, border: `1px solid ${TK.line1}`, background: help ? TK.bg10 : 'transparent', color: TK.slate200, fontSize: FS.body, fontWeight: 800, cursor: 'pointer' }}
        >?</button>
      </header>
      {help && <HelpBox />}
      {content}
    </div>
  )
}
