'use client'
// 학생 홈 공포·탐욕 카드 — 탭 [코인 | 미국 주식]. 구간 이름은 원천이 준 분류를 번역만 한다(우리가 임계값을 새로 정하지 않는다)
//   1년 전·최근 1년 최고/최저는 시장 화면과 같은 응답(overview — 홈 page 가 한 번 불러 나눠 준다)·같은 함수(fngYearSummary)로 — 두 화면이 같은 값
import { useState } from 'react'
import { TK, FS, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import type { CryptoFng, CryptoFngYear } from '@/lib/cryptoFng'
import type { CnnFngYear } from '@/lib/cnnFng'
import { viewOf, fngYearSummary, fngYearLine, type OverviewResp } from '@/lib/marketScreen'
import { FngHero, FngVal } from '@/app/components/student/market/FngGauge'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, FailRow, noteStyle } from './homeUi'
import { Segment } from '@/app/components/student/ui'

type Tab = 'coin' | 'us'
interface CnnResp { partyScore?: unknown; prevClose?: unknown; prev1Week?: unknown; prev1Month?: unknown; rating?: unknown; source?: unknown }

// alternative.me value_classification · CNN rating 공통 5단계(대소문자 무시)
const CLASS_KO: Record<string, string> = { 'extreme fear': '극단 공포', fear: '공포', neutral: '중립', greed: '탐욕', 'extreme greed': '극단 탐욕' }
const classKo = (c: unknown) => typeof c === 'string' ? CLASS_KO[c.trim().toLowerCase()] ?? null : null
const num = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null

/** past 의 pending = 아직 불러오는 칸('…') — 도착했을 때 칸이 새로 생겨 줄이 밀리지 않게 자리를 먼저 잡는다 */
function Gauge({ value, cls, past, source, year }: { value: number; cls: string | null; past: { label: string; v: number | null; pending?: boolean }[]; source: string; year: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      {/* 반원 게이지 — 색은 값 위치로 연속(칸 경계 없음 — 두 원천의 구간 경계가 달라 우리 임계값이 된다) */}
      <FngHero value={value} cls={cls} />
      {/* 한 칸 60px 밑으로 줄지 않고 다음 줄로(좁은 두 칸 배치에서 4칸 넘침 방지) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: SP.sm }}>
        {past.map(p => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
            <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>{p.label}</span>
            <span style={{ fontSize: p.v == null ? FS.tiny : FS.body, fontWeight: 700, color: p.v == null ? TK.sub : TK.slate200 }}>{p.pending ? '…' : p.v == null ? '없음' : Math.round(p.v)}</span>
          </div>
        ))}
      </div>
      {/* 1년 줄 자리 — 불러오는 중·결과·못 가져옴이 같은 자리에 온다 */}
      <div style={{ minHeight: 20 }}>{year}</div>
      <span style={{ fontSize: FS.micro, color: TK.sub }}>{source}</span>
    </div>
  )
}

/** overview = 홈 page 가 카드가 보일 때 부르는 요약(1년 값). 못 가져오면 1년 줄만 '못 가져옴' */
export default function FearGreed({ overview }: { overview: JsonResult<OverviewResp> }) {
  const [tab, setTab] = useState<Tab>('coin')
  const [usOpened, setUsOpened] = useState(false)   // 미국 탭은 처음 누를 때 부른다(열어 본 뒤엔 그대로 둔다)
  const coin = useJson<{ fng?: CryptoFng | null; failed?: boolean }>('/api/coin-fng')
  const us = useJson<CnnResp>('/api/cocktail-party', { enabled: usOpened })

  const pick = (t: Tab) => { setTab(t); if (t === 'us') setUsOpened(true) }

  // ── 1년(1년 전 칸 + 최고·최저 한 줄) ──
  const yv = tab === 'us'
    ? viewOf<OverviewResp, CnnFngYear>(overview, d => d.fng.cnn)
    : viewOf<OverviewResp, CryptoFngYear>(overview, d => d.fng.crypto)
  const yearAgo = yv.kind === 'ok' ? [{ label: '1년 전', v: (yv.data as CnnFngYear | CryptoFngYear).yearAgo }]
    : yv.kind === 'loading' ? [{ label: '1년 전', v: null, pending: true }] : []
  const yearNode = (now: number) => {
    if (yv.kind === 'loading') return <span style={noteStyle()}>1년 기록을 불러오는 중…</span>
    if (yv.kind === 'failed') return <FailRow text="1년 기록(1년 전·최고·최저)을 못 가져왔어요." onRetry={overview.reload} retryLabel="공포·탐욕 1년 기록 다시 불러오기" />
    const y = yv.data as CnnFngYear | CryptoFngYear
    const s = fngYearSummary(now, { yearHigh: y.yearHigh, yearLow: y.yearLow, range: y.range })
    if (!s) return <span style={noteStyle(TK.slate300)}>최근 1년 최고·최저 기록이 없어요.</span>
    // fngYearLine(검증된 문장 SSOT)과 같은 문장 — 최고·최저 값만 같은 색 척도로 칠하고, 읽어 주는 문장은 그 함수 값 그대로
    return (
      <span aria-label={fngYearLine(s)} style={noteStyle(TK.slate300)}>
        {s.rangeText ?? '기록 기간'}
        {s.high && <> 최고 <FngVal v={s.high.v} />({s.high.when})</>}
        {s.high && s.low && ' ·'}
        {s.low && <> 최저 <FngVal v={s.low.v} />({s.low.when})</>}
      </span>
    )
  }

  let body: React.ReactNode
  if (tab === 'coin') {
    const f = coin.data?.fng
    if (coin.state === 'loading' || coin.state === 'idle') body = <span style={noteStyle()}>코인 공포·탐욕 지수를 불러오는 중…</span>
    else if (coin.state !== 'ok' || !f || num(f.now) == null) body = <FailRow text="코인 공포·탐욕 지수를 못 가져왔어요." onRetry={coin.reload} retryLabel="코인 공포·탐욕 지수 다시 불러오기" />
    else body = (
      <Gauge value={f.now as number} cls={classKo(f.cls)}
        past={[{ label: '어제', v: num(f.yesterday) }, { label: '1주 전', v: num(f.weekAgo) }, { label: '1달 전', v: num(f.monthAgo) }, ...yearAgo]}
        year={yearNode(Math.round(f.now as number))}
        source={`출처: alternative.me${f.date ? ` · ${f.date}` : ''}`} />
    )
  } else {
    const d = us.data
    if (us.state === 'loading' || us.state === 'idle') body = <span style={noteStyle()}>미국 주식 공포·탐욕 지수를 불러오는 중…</span>
    else if (us.state !== 'ok' || !d) body = <FailRow text="미국 주식 공포·탐욕 지수를 못 가져왔어요." onRetry={us.reload} retryLabel="미국 주식 공포·탐욕 지수 다시 불러오기" />
    // CNN 이 아니면(자체 계산·폴백 50) 숫자를 보이지 않는다 — 같은 이름으로 다른 지수를 보이게 된다
    else if (d.source !== 'cnn' || num(d.partyScore) == null) body = <FailRow text="CNN 지수를 못 가져왔어요." onRetry={us.reload} retryLabel="미국 주식 공포·탐욕 지수 다시 불러오기" />
    else body = (
      <Gauge value={d.partyScore as number} cls={classKo(d.rating)}
        past={[{ label: '전 거래일', v: num(d.prevClose) }, { label: '1주 전', v: num(d.prev1Week) }, { label: '1달 전', v: num(d.prev1Month) }, ...yearAgo]}
        year={yearNode(Math.round(d.partyScore as number))}
        source="출처: CNN Fear & Greed" />
    )
  }

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="공포·탐욕 지수" />
      {/* 리디자인(2026-10-10): 카드 안 상자(bg3) → 공용 Segment(시장 화면과 같은 모양) */}
      <Segment label="공포·탐욕 지수 종류" options={[{ key: 'coin', label: '코인' }, { key: 'us', label: '미국 주식' }]} value={tab} onChange={pick} />
      <div aria-live="polite">{body}</div>
    </section>
  )
}
