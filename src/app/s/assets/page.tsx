'use client'
// 학생 내 자산 — 총자산·오늘·원금·불어난 돈 → 히트맵 → 지난 흐름 → 투자 구성 → 오늘의 투자 체크 → 이달 배당락 예정 → 종목 목록 (+ 기록)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio, type FailReason } from '@/app/components/student/useMyPortfolio'
import Heatmap from '@/app/components/student/Heatmap'
import GrowthChart from '@/app/components/student/GrowthChart'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { FailRow, noteStyle, useKstToday } from '@/app/components/student/home/homeUi'
import { rebalanceCheck } from '@/lib/portfolioSummary'
import { won, signWon, pct, upDown } from '@/lib/studentFormat'

const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg } as const
const reloadBtn = { alignSelf: 'flex-start', height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer' } as const

// 실패 이유마다 다른 문장 — 무엇을 못 했는지 사실만 말한다
const FAIL_TEXT: Record<FailReason | 'unknown', { title: string; detail: string }> = {
  fx: { title: '환율을 못 가져와서 달러 종목을 원화로 바꿀 수 없어요.', detail: '짐작한 환율로 계산하지 않아요. 환율 서버가 다시 응답하면 보여 드려요.' },
  db: { title: '내 종목 목록을 불러오지 못했어요.', detail: '기록은 그대로 있어요. 서버가 잠시 응답하지 않았을 수 있어요.' },
  other: { title: '내 자산을 불러오지 못했어요.', detail: '시세나 환율 서버가 잠시 응답하지 않았을 수 있어요.' },
  unknown: { title: '내 자산을 불러오지 못했어요.', detail: '시세나 환율 서버가 잠시 응답하지 않았을 수 있어요.' },
}

interface CalendarMonthly { monthly?: { month?: unknown; krw?: unknown }[]; scanned?: unknown }

/** 이달 배당락 예정 한 줄 — event-calendar 는 콜드 20초대라 보일 때 부른다.
 *  monthly 는 작년 배당 이력(Yahoo — 날짜는 **배당락일**, 입금일 아님)을 1년 뒤로 옮긴 추정이고, 이번 달은 '오늘부터 남은 것'만 담긴다.
 *  작년 기록을 못 찾은 종목(Yahoo 가 못 읽는 KR ETF 등)은 0 으로 빠지므로 0 을 '배당 없음'이라 단정하지 않는다. scanned = 배당 대상(주식·ETF) 종목 수.
 *  이번 달은 마운트 뒤에 정한다(렌더 중 new Date() 는 하이드레이션을 깨뜨린다) */
function MonthDividend() {
  const [ref, seen] = useInView<HTMLDivElement>()
  const cal = useJson<CalendarMonthly>('/api/event-calendar', { enabled: seen })
  const today = useKstToday()
  const month = today?.slice(0, 7) ?? null

  let body: React.ReactNode
  let linked = false
  if (!seen || month == null || cal.state === 'idle' || cal.state === 'loading') {
    body = <span style={noteStyle()}>이달 배당 일정을 불러오는 중…</span>
  } else if (cal.state === 'unauth') {
    body = <span style={noteStyle()}>로그인하면 이달 배당 일정이 보여요.</span>
  } else {
    const hit = cal.state === 'ok' && Array.isArray(cal.data?.monthly)
      ? cal.data.monthly.find(m => m?.month === month && typeof m.krw === 'number' && Number.isFinite(m.krw))
      : undefined
    if (!hit) {
      // 응답이 없거나 이번 달 칸이 없으면 '없음'이 아니라 '못 가져옴'
      body = <FailRow text="배당 일정 못 가져왔어요." onRetry={cal.reload} retryLabel="이달 배당 일정 다시 불러오기" />
    } else {
      linked = true
      const krw = hit.krw as number
      const scanned = cal.data?.scanned
      body = krw > 0
        ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
            <span style={{ fontSize: FS.body, color: TK.slate200 }}>이달 배당락 예정 <b style={{ color: TK.slate100 }}>{won(krw)}</b> <span style={{ fontSize: FS.tiny, color: TK.sub }}>· 작년 기준 추정</span></span>
            <span style={{ fontSize: FS.tiny, color: TK.sub }}>이날까지 가지고 있으면 받을 몫이고, 입금은 보통 몇 주~몇 달 뒤예요 (작년 기록을 못 찾은 종목은 빠져요)</span>
          </span>
        )
        : scanned === 0
          ? <span style={{ fontSize: FS.body, color: TK.slate200 }}>배당 받을 종목이 없어요</span>
          : <span style={{ fontSize: FS.body, color: TK.slate200 }}>이달 배당락 예정 0원 <span style={{ fontSize: FS.tiny, color: TK.sub }}>· 작년 기록 기준(기록을 못 찾은 종목은 빠져요)</span></span>
    }
  }
  // 실패 줄엔 '다시' 버튼이 있어 링크로 감싸지 않는다(링크 안 버튼은 잘못된 HTML)
  return (
    <div ref={ref}>
      {linked
        ? <Link href="/assets" style={{ ...card, display: 'flex', alignItems: 'center', gap: SP.sm, minHeight: 44, color: TK.slate200, textDecoration: 'none' }}>
            <div style={{ flexGrow: 1, minWidth: 0 }}>{body}</div>
            <span aria-hidden style={{ fontSize: FS.lg, color: TK.sub, flexShrink: 0 }}>›</span>
          </Link>
        : <div style={card}>{body}</div>}
    </div>
  )
}

export default function StudentAssets() {
  const { state, holdings, summary, usdKrw, targetCorePct, pricesFailed, failReason, reload } = useMyPortfolio()
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
      <h1 style={{ margin: 0, fontSize: FS.xl, fontWeight: 800, color: TK.slate100 }}>내 자산</h1>
      <Link href="/s/record" aria-label="매매 기록하기" style={{ display: 'flex', alignItems: 'center', gap: SP.xs, height: 40, flexShrink: 0, whiteSpace: 'nowrap', padding: `0 ${SP.lg}px`, borderRadius: RAD.pill, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>＋ 기록</Link>
    </div>
  )
  if (state === 'loading') return <div>{header}<p style={{ color: TK.sub, fontSize: FS.body }}>내 종목을 불러오는 중이에요…</p></div>
  if (state === 'unauth') return <div>{header}<p style={{ color: TK.sub, fontSize: FS.body }}>로그인하면 내 자산이 보여요.</p></div>
  if (state === 'failed' || !summary) {
    const t = FAIL_TEXT[failReason ?? 'unknown']
    return (
      <div>{header}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <span style={{ fontSize: FS.body, color: TK.slate100 }}>{t.title}</span>
          <span style={{ fontSize: FS.tiny, color: TK.sub }}>{t.detail}</span>
          <button type="button" onClick={reload} style={reloadBtn}>다시 불러오기</button>
        </div>
      </div>
    )
  }
  if (summary.rows.length === 0) return (
    <div>{header}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.slate100 }}>아직 기록한 종목이 없어요</span>
        <span style={{ fontSize: FS.tiny, color: TK.sub }}>증권사에서 산 종목을 한 번 적어 두면 여기서 매일 흐름을 볼 수 있어요.</span>
        <Link href="/s/record" style={{ alignSelf: 'flex-start', height: 44, display: 'flex', alignItems: 'center', padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, background: TK.blue600, color: TK.slate100, fontSize: FS.body, fontWeight: 700, textDecoration: 'none' }}>첫 종목 기록하기</Link>
      </div>
    </div>
  )

  const check = rebalanceCheck(summary.corePct, targetCorePct)
  // 시세가 하나도 없으면 오늘 등락·불어난 돈은 '0'이 아니라 '모름'이다
  const noToday = summary.allUnpriced || summary.todayPct == null
  const coreW = Math.max(0, Math.min(100, summary.corePct))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xl }}>
      {header}
      {pricesFailed && (
        <div style={{ ...card, border: `1px solid ${TK.amber400}`, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <span style={{ fontSize: FS.body, color: TK.slate100 }}>지금 시세를 못 가져왔어요 — 아래 금액은 매수가 기준이에요.</span>
          <button type="button" onClick={reload} style={reloadBtn}>다시 불러오기</button>
        </div>
      )}
      <section style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        {/* 선생님 자산 화면의 '총자산'은 예수금까지 더한 값이다 — 같은 말로 다른 숫자를 보이지 않게 보유 종목만이라고 쓴다 */}
        <span style={{ fontSize: FS.body, color: TK.sub }}>내 종목 평가금액</span>
        <span style={{ fontSize: FS.h1, fontWeight: 800, color: TK.slate100 }}>{won(summary.totalEvalKrw)}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: SP.sm }}>
          {noToday
            ? <span style={{ fontSize: FS.lg, fontWeight: 700, color: TK.sub }}>오늘 —</span>
            : <span style={{ fontSize: FS.lg, fontWeight: 700, color: upDown(summary.todayPct) }}>오늘 {signWon(summary.todayKrw)}{summary.todayPct != null ? ` (${pct(summary.todayPct)})` : ''}</span>}
          {summary.staleCount > 0 && <span style={{ fontSize: FS.micro, color: TK.amber400 }}>{summary.staleCount}종목은 지난 시세예요.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: SP.sm, paddingTop: SP.md, borderTop: `1px solid ${TK.border}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: FS.tiny, color: TK.sub }}>넣은 돈 (원금)</span><span style={{ fontSize: FS.body, color: TK.slate300 }}>{won(summary.totalCostKrw)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: FS.tiny, color: TK.sub }}>지금까지 불어난 돈</span>
            {summary.allUnpriced
              ? <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.sub }}>—</span>
              : <span style={{ fontSize: FS.body, fontWeight: 700, color: upDown(summary.pnlPct), whiteSpace: 'nowrap' }}>{signWon(summary.pnlKrw)}{summary.pnlPct != null ? ` (${pct(summary.pnlPct)})` : ''}</span>}
          </div>
        </div>
        {!pricesFailed && summary.unpricedCount > 0 && <span style={{ fontSize: FS.tiny, color: TK.amber400 }}>시세를 못 가져온 종목 {summary.unpricedCount}개는 매수가로 계산했어요.</span>}
      </section>

      <Heatmap rows={summary.rows} corePct={summary.corePct} />

      <GrowthChart holdings={holdings} rows={summary.rows} usdKrw={usdKrw} />

      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: SP.sm }}>
          <h2 style={{ margin: 0, fontSize: FS.body, fontWeight: 700, color: TK.slate100 }}>내 투자 구성</h2>
          {targetCorePct != null && <span style={{ fontSize: FS.tiny, color: TK.sub }}>목표 코어 {targetCorePct}% · 위성 {100 - targetCorePct}%</span>}
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: RAD.pill, overflow: 'hidden', gap: 2 }}>
          {coreW > 0 && <div style={{ width: `${coreW}%`, background: TK.sky400 }} />}
          {summary.satPct > 0 && <div style={{ flexGrow: 1, background: TK.orange400 }} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.tiny }}>
          <span style={{ color: TK.sky400, fontWeight: 700 }}>코어 {Math.round(summary.corePct)}%</span>
          <span style={{ color: TK.orange400, fontWeight: 700 }}>위성 {coreW > 0 && summary.satPct > 0 ? 100 - Math.round(summary.corePct) : Math.round(summary.satPct)}%</span>
        </div>
      </section>

      {check && (
        <section style={{ ...card, border: `1px solid ${TK.sky400}`, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
          <h2 style={{ margin: 0, fontSize: FS.tiny, fontWeight: 700, color: TK.sky400 }}>오늘의 투자 체크</h2>
          <span style={{ fontSize: FS.body, color: TK.slate100 }}>
            {check.kind === 'balanced' ? '코어·위성이 목표 비율 안에 있어요.' : check.kind === 'core-short' ? `코어가 목표보다 ${check.gapPp}%p 적어요.` : `위성이 목표보다 ${check.gapPp}%p 적어요.`}
          </span>
          {check.kind !== 'balanced' && <span style={{ fontSize: FS.tiny, color: TK.sub }}>새로 넣는 돈이 {check.kind === 'core-short' ? '코어' : '위성'} 종목으로 가면 팔지 않고도 목표에 가까워져요.</span>}
        </section>
      )}

      <MonthDividend />

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: 0, fontSize: FS.lg, fontWeight: 700, color: TK.slate100, paddingBottom: SP.sm }}>내 종목</h2>
        {/* summary.rows 는 portfolioSummary 가 이미 평가액 내림차순으로 정렬해 준다 */}
        {summary.rows.map(r => (
          <Link key={r.id} href={`/s/stock/${encodeURIComponent(r.ticker)}`} style={{ display: 'flex', alignItems: 'center', gap: SP.md, minHeight: 64, borderTop: `1px solid ${TK.border}`, color: TK.slate200, textDecoration: 'none' }}>
            <div aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: RAD.pill, background: TK.bg7, border: `1px solid ${TK.line1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.tiny, fontWeight: 700, color: TK.slate300 }}>{r.name.slice(0, 1)}</div>
            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: FS.body, color: TK.slate100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: SP.xs, fontSize: FS.tiny, color: TK.sub }}>
                <span style={{ padding: `0 ${SP.xs + 2}px`, borderRadius: RAD.pill, background: r.role === 'CORE' ? `${TK.sky400}24` : `${TK.orange400}24`, color: r.role === 'CORE' ? TK.sky400 : TK.orange400, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>{r.role === 'CORE' ? '코어' : '위성'}</span>
                {/* 지난 시세의 등락은 오늘 것이 아닐 수 있다 — '오늘'로 쓰지 않는다 */}
                {r.priced && r.changePct != null
                  ? <span>{r.stale ? '지난 시세' : '오늘'} <span style={{ color: upDown(r.changePct) }}>{pct(r.changePct)}</span></span>
                  : '지금 시세를 못 가져왔어요 · 매수가로 계산'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ fontSize: FS.body, color: TK.slate100 }}>{won(r.evalKrw)}</span>
              {r.priced && r.pnlPct != null && <span style={{ fontSize: FS.tiny, fontWeight: 700, color: upDown(r.pnlPct) }}>{pct(r.pnlPct)}</span>}
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
