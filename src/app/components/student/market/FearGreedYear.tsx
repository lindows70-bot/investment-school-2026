'use client'
// 시장 화면 공포·탐욕 — [미국 주식 | 코인] 지금·어제·1주·1달·1년 전 + 연간(또는 실제 기록 기간) 최고·최저(값·날짜)
//   어제·1주·1달은 홈 카드와 같은 원천(/api/cocktail-party·/api/coin-fng — 같은 값이 화면마다 다르지 않게), 1년 전·고저는 /api/market-board/overview.
//   구간 이름은 원천 분류를 번역만 한다(우리 임계값 없음). 미국은 CNN 값일 때만 숫자를 보인다(폴백 50 금지).
import { useEffect, useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { viewOf, fngRangeName, fngExtremes, ymdDot, mdDow, nyYmd, type OverviewResp } from '@/lib/marketScreen'
import type { CnnFngYear } from '@/lib/cnnFng'
import type { CryptoFng, CryptoFngYear } from '@/lib/cryptoFng'
import { useJson, type JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow } from './marketUi'

export type FngSide = 'us' | 'coin'
interface CnnResp { partyScore?: unknown; prevClose?: unknown; prev1Week?: unknown; prev1Month?: unknown; rating?: unknown; source?: unknown }

const CLASS_KO: Record<string, string> = { 'extreme fear': '극단 공포', fear: '공포', neutral: '중립', greed: '탐욕', 'extreme greed': '극단 탐욕' }
const classKo = (c: unknown) => (typeof c === 'string' ? CLASS_KO[c.trim().toLowerCase()] ?? null : null)
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

interface Short { now: number | null; cls: string | null; past: { label: string; v: number | null }[]; date: string | null }
interface Year { now: number; yearAgo: number | null; high: { v: number; date: string } | null; low: { v: number; date: string } | null; range: { from: string; to: string; fullYear: boolean } | null; date: string | null }

/** active = 카드가 화면에 들어왔다(그때 짧은 기간 값을 부른다) · defaultSide = 탭에 맞춘 처음 선택(사용자가 고르면 그걸 유지) */
export default function FearGreedYear({ overview, active, defaultSide }: { overview: JsonResult<OverviewResp>; active: boolean; defaultSide: FngSide }) {
  const [picked, setPicked] = useState<FngSide | null>(null)
  const side = picked ?? defaultSide
  const [wantUs, setWantUs] = useState(false)
  const [wantCoin, setWantCoin] = useState(false)
  useEffect(() => {
    if (!active) return
    if (side === 'us') setWantUs(true); else setWantCoin(true)   // 한 번 연 쪽은 그대로 둔다(다시 부르지 않음)
  }, [active, side])
  const cnn = useJson<CnnResp>('/api/cocktail-party', { enabled: wantUs })
  const coin = useJson<{ fng?: CryptoFng | null }>('/api/coin-fng', { enabled: wantCoin })

  // ── 짧은 기간(지금·어제·1주·1달) ──
  const shortRes = side === 'us' ? cnn : coin
  let short: Short | null = null
  if (side === 'us' && cnn.state === 'ok' && cnn.data?.source === 'cnn' && n(cnn.data.partyScore) != null) {
    const d = cnn.data
    short = { now: Math.round(n(d.partyScore) as number), cls: classKo(d.rating), date: null,
      past: [{ label: '전 거래일', v: n(d.prevClose) }, { label: '1주 전', v: n(d.prev1Week) }, { label: '1달 전', v: n(d.prev1Month) }] }
  } else if (side === 'coin' && coin.state === 'ok' && coin.data?.fng && n(coin.data.fng.now) != null) {
    const f = coin.data.fng
    short = { now: f.now, cls: classKo(f.cls), date: f.date,
      past: [{ label: '어제', v: n(f.yesterday) }, { label: '1주 전', v: n(f.weekAgo) }, { label: '1달 전', v: n(f.monthAgo) }] }
  }
  const shortLoading = shortRes.state === 'idle' || shortRes.state === 'loading'

  // ── 1년(1년 전·고저) ──
  const yv = side === 'us'
    ? viewOf<OverviewResp, CnnFngYear>(overview, d => d.fng.cnn)
    : viewOf<OverviewResp, CryptoFngYear>(overview, d => d.fng.crypto)
  let year: Year | null = null
  if (yv.kind === 'ok') {
    const y = yv.data as CnnFngYear | CryptoFngYear
    // 기준일 — 코인은 원천이 준 날짜(KST), CNN 은 원천 시각의 미국 날짜
    const cnnAsOf = side === 'us' ? Date.parse((y as CnnFngYear).asOf ?? '') : NaN
    const date = side === 'coin' ? (y as CryptoFngYear).date : Number.isFinite(cnnAsOf) ? nyYmd(cnnAsOf) : null
    year = { now: y.now, yearAgo: y.yearAgo, high: y.yearHigh, low: y.yearLow, range: y.range, date }
  }

  const now = short?.now ?? year?.now ?? null   // 지금 값: 홈 카드와 같은 원천 먼저, 못 받으면 1년 요약에 실린 같은 원천의 지금 값
  const cls = short?.cls ?? (side === 'us' && yv.kind === 'ok' ? classKo((yv.data as CnnFngYear).rating) : null)
  const ext = year ? fngExtremes(now, year.high, year.low) : null
  const rangeName = year ? fngRangeName(year.range) : null
  const bothLoading = shortLoading && yv.kind === 'loading'
  const date = short?.date ?? year?.date ?? null

  return (
    <section aria-label="공포·탐욕 지수" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="공포·탐욕 지수" />
      <ChipRow label="공포·탐욕 지수 종류" value={side} onChange={setPicked} options={[{ key: 'us', label: '미국 주식' }, { key: 'coin', label: '코인' }]} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
        {bothLoading && <span style={noteStyle()}>공포·탐욕 지수를 불러오는 중…</span>}
        {!bothLoading && now == null && !shortLoading && yv.kind !== 'loading' && (
          <FailRow text={`${side === 'us' ? '미국 주식(CNN)' : '코인'} 공포·탐욕 지수를 못 가져왔어요.`} onRetry={() => { shortRes.reload(); overview.reload() }} retryLabel="공포·탐욕 지수 다시 불러오기" />
        )}
        {now != null && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm }}>
              <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100 }}>{now}</span>
              {cls && <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate200 }}>{cls}</span>}
            </div>
            {/* 0~100 막대 + 지금 위치. 색 구간은 두지 않는다 — 두 원천의 구간 경계가 달라 우리 임계값이 된다 */}
            <div role="img" aria-label={`0부터 100 사이에서 ${now}`} style={{ position: 'relative', height: 8, borderRadius: RAD.pill, background: TK.line1 }}>
              <div style={{ position: 'absolute', top: -4, left: `calc(${Math.max(0, Math.min(100, now))}% - 2px)`, width: 4, height: 16, borderRadius: RAD.xs, background: TK.slate100 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub }}>
              <span>0 극단 공포</span><span>100 극단 탐욕</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: SP.sm }}>
              {[...(short?.past ?? [{ label: side === 'us' ? '전 거래일' : '어제', v: null }, { label: '1주 전', v: null }, { label: '1달 전', v: null }]),
                { label: '1년 전', v: year?.yearAgo ?? null }].map(p => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
                  <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>{p.label}</span>
                  <span style={{ fontSize: FS.body, fontWeight: 700, color: p.v == null ? TK.sub : TK.slate200 }}>{p.v == null ? '—' : Math.round(p.v)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {now != null && !short && !shortLoading && (
          <FailRow text="어제·1주·1달 전 값을 못 가져왔어요." onRetry={shortRes.reload} retryLabel="공포·탐욕 지난 값 다시 불러오기" />
        )}
        {now != null && yv.kind === 'loading' && <span style={noteStyle()}>1년 기록을 불러오는 중…</span>}
        {now != null && yv.kind === 'failed' && (
          <FailRow text="1년 기록(1년 전·최고·최저)을 못 가져왔어요." onRetry={overview.reload} retryLabel="공포·탐욕 1년 기록 다시 불러오기" />
        )}
        {ext && (ext.high || ext.low) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: SP.md, borderRadius: RAD.sm, background: TK.bg3 }}>
            {rangeName && <span style={noteStyle()}>{rangeName === '1년' ? '최근 1년(연간) 동안' : `기록이 있는 기간(${rangeName}) 동안 — 1년치가 안 돼요`}</span>}
            {ext.high && <span style={{ fontSize: FS.tiny, color: TK.slate200 }}>가장 높았을 때 <b>{ext.high.v}</b> · {ext.high.date ? ymdDot(ext.high.date) : '지금'}</span>}
            {ext.low && <span style={{ fontSize: FS.tiny, color: TK.slate200 }}>가장 낮았을 때 <b>{ext.low.v}</b> · {ext.low.date ? ymdDot(ext.low.date) : '지금'}</span>}
          </div>
        )}
        {now != null && (
          <span style={noteStyle()}>
            {[side === 'us' ? '출처: CNN Fear & Greed' : '출처: alternative.me', date ? `${side === 'us' ? '미국 ' : ''}${mdDow(date) ?? date} 기준` : null].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
    </section>
  )
}
