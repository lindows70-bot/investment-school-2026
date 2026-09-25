'use client'
// 학생 내 자산 — 총자산·오늘·원금·불어난 돈 → 히트맵 → 투자 구성 → 오늘의 투자 체크 → 종목 목록 (+ 기록)
import Link from 'next/link'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useMyPortfolio, type FailReason } from '@/app/components/student/useMyPortfolio'
import Heatmap from '@/app/components/student/Heatmap'
import { rebalanceCheck } from '@/lib/portfolioSummary'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const signWon = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ko-KR')}원`
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}%`
// 한국식 — 오름 빨강 ·내림 파랑 · 보합(±0.05% 안)과 값 없음은 회색
const upDown = (n: number | null) => n == null || Math.abs(n) < 0.05 ? TK.sub : n > 0 ? TK.red400 : TK.blue400
const card = { background: TK.card, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: SP.lg } as const
const reloadBtn = { alignSelf: 'flex-start', height: 40, padding: `0 ${SP.lg}px`, borderRadius: RAD.sm, border: `1px solid ${TK.line1}`, background: 'transparent', color: TK.slate200, fontSize: FS.tiny, cursor: 'pointer' } as const

// 실패 이유마다 다른 문장 — 무엇을 못 했는지 사실만 말한다
const FAIL_TEXT: Record<FailReason | 'unknown', { title: string; detail: string }> = {
  fx: { title: '환율을 못 가져와서 달러 종목을 원화로 바꿀 수 없어요.', detail: '짐작한 환율로 계산하지 않아요. 환율 서버가 다시 응답하면 보여 드려요.' },
  db: { title: '내 종목 목록을 불러오지 못했어요.', detail: '기록은 그대로 있어요. 서버가 잠시 응답하지 않았을 수 있어요.' },
  other: { title: '내 자산을 불러오지 못했어요.', detail: '시세나 환율 서버가 잠시 응답하지 않았을 수 있어요.' },
  unknown: { title: '내 자산을 불러오지 못했어요.', detail: '시세나 환율 서버가 잠시 응답하지 않았을 수 있어요.' },
}

export default function StudentAssets() {
  const { state, summary, targetCorePct, pricesFailed, failReason, reload } = useMyPortfolio()
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
        <span style={{ fontSize: FS.body, color: TK.sub }}>총자산</span>
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
