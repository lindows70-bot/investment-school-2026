'use client'
// 학생 홈 공포·탐욕 카드 — 탭 [코인 | 미국 주식]. 구간 이름은 원천이 준 분류를 번역만 한다(우리가 임계값을 새로 정하지 않는다)
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import type { CryptoFng } from '@/lib/cryptoFng'
import { card, CardHead, FailRow, noteStyle } from './homeUi'

type Tab = 'coin' | 'us'
interface CnnResp { partyScore?: unknown; prevClose?: unknown; prev1Week?: unknown; prev1Month?: unknown; rating?: unknown; source?: unknown }

// alternative.me value_classification · CNN rating 공통 5단계(대소문자 무시)
const CLASS_KO: Record<string, string> = { 'extreme fear': '극단 공포', fear: '공포', neutral: '중립', greed: '탐욕', 'extreme greed': '극단 탐욕' }
const classKo = (c: unknown) => typeof c === 'string' ? CLASS_KO[c.trim().toLowerCase()] ?? null : null
const num = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null

function Gauge({ value, cls, past, source }: { value: number; cls: string | null; past: { label: string; v: number | null }[]; source: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm }}>
        <span style={{ fontSize: FS.h2, fontWeight: 800, color: TK.slate100 }}>{Math.round(value)}</span>
        {cls && <span style={{ fontSize: FS.body, fontWeight: 700, color: TK.slate200 }}>{cls}</span>}
      </div>
      {/* 0~100 막대 + 지금 위치. 색 구간은 두지 않는다 — 두 원천의 구간 경계가 달라 우리 임계값이 된다 */}
      <div role="img" aria-label={`0부터 100 사이에서 ${Math.round(value)}`} style={{ position: 'relative', height: 8, borderRadius: RAD.pill, background: TK.line1 }}>
        <div style={{ position: 'absolute', top: -4, left: `calc(${v}% - 2px)`, width: 4, height: 16, borderRadius: RAD.xs, background: TK.slate100 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub }}>
        <span>0 극단 공포</span><span>100 극단 탐욕</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: SP.sm }}>
        {past.map(p => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, minWidth: 0 }}>
            <span style={{ fontSize: FS.micro, color: TK.sub, whiteSpace: 'nowrap' }}>{p.label}</span>
            <span style={{ fontSize: FS.body, fontWeight: 700, color: p.v == null ? TK.sub : TK.slate200 }}>{p.v == null ? '—' : Math.round(p.v)}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: FS.micro, color: TK.sub }}>{source}</span>
    </div>
  )
}

export default function FearGreed() {
  const [tab, setTab] = useState<Tab>('coin')
  const [usOpened, setUsOpened] = useState(false)   // 미국 탭은 처음 누를 때 부른다(열어 본 뒤엔 그대로 둔다)
  const coin = useJson<{ fng?: CryptoFng | null; failed?: boolean }>('/api/coin-fng')
  const us = useJson<CnnResp>('/api/cocktail-party', { enabled: usOpened })

  const pick = (t: Tab) => { setTab(t); if (t === 'us') setUsOpened(true) }
  const tabBtn = (on: boolean) => ({ height: 44, flex: 1, borderRadius: RAD.sm, border: 'none', background: on ? TK.bg7 : 'transparent', color: on ? TK.slate100 : TK.sub, fontSize: FS.tiny, fontWeight: on ? 700 : 500, cursor: 'pointer' })

  let body: React.ReactNode
  if (tab === 'coin') {
    const f = coin.data?.fng
    if (coin.state === 'loading' || coin.state === 'idle') body = <span style={noteStyle()}>코인 공포·탐욕 지수를 불러오는 중…</span>
    else if (coin.state !== 'ok' || !f || num(f.now) == null) body = <FailRow text="코인 공포·탐욕 지수를 못 가져왔어요." onRetry={coin.reload} retryLabel="코인 공포·탐욕 지수 다시 불러오기" />
    else body = (
      <Gauge value={f.now as number} cls={classKo(f.cls)}
        past={[{ label: '어제', v: num(f.yesterday) }, { label: '1주 전', v: num(f.weekAgo) }, { label: '1달 전', v: num(f.monthAgo) }]}
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
        past={[{ label: '전 거래일', v: num(d.prevClose) }, { label: '1주 전', v: num(d.prev1Week) }, { label: '1달 전', v: num(d.prev1Month) }]}
        source="출처: CNN Fear & Greed" />
    )
  }

  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="공포·탐욕 지수" />
      <div role="group" aria-label="공포·탐욕 지수 종류" style={{ display: 'flex', gap: SP.xs, padding: SP.xs, borderRadius: RAD.md, background: TK.bg3 }}>
        <button type="button" aria-pressed={tab === 'coin'} onClick={() => pick('coin')} style={tabBtn(tab === 'coin')}>코인</button>
        <button type="button" aria-pressed={tab === 'us'} onClick={() => pick('us')} style={tabBtn(tab === 'us')}>미국 주식</button>
      </div>
      <div aria-live="polite">{body}</div>
    </section>
  )
}
