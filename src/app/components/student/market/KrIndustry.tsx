'use client'
// 시장 화면 업종 — 오른 순/내린 순 상위 5 + 더 보기(10), 막대 = 등락률 크기, 오른·내린 종목 수 병기. 원천 = /api/market-board/kr 의 industry(네이버)
//   업종 등락이 ±30%를 넘으면(limitBreakSuspect) 그 업종 안에 상장 첫날 같은 종목이 섞인 것 — 막대는 끝까지, 이유를 한 줄로.
import { useState } from 'react'
import { TK, FS, RAD, SP } from '@/lib/theme'
import { pct, upDown } from '@/lib/studentFormat'
import { viewOf, topIndustries, industryBars, type KrBoardResp } from '@/lib/marketScreen'
import type { KrIndustry as Industry } from '@/lib/krMarketBoard'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { ChipRow, MoreToggle, Pending } from './marketUi'

type Dir = 'up' | 'down'
const SHOW = 5, MAX = 10

export default function KrIndustry({ kr }: { kr: JsonResult<KrBoardResp> }) {
  const [dir, setDir] = useState<Dir>('up')
  const [open, setOpen] = useState(false)
  const view = viewOf<KrBoardResp, { items: Industry[]; marketStatus: string | null; total: number | null }>(kr, d => d.industry)
  const ranked = view.kind === 'ok' ? topIndustries(view.data.items, dir, MAX) : []
  const shown = ranked.slice(0, open ? MAX : SHOW)
  const bars = industryBars(shown)
  const total = view.kind === 'ok' ? view.data.total ?? view.data.items.length : null

  return (
    <section aria-label="업종" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="업종별로 보면" />
      <ChipRow label="순서" value={dir} onChange={d => { setDir(d); setOpen(false) }} options={[{ key: 'up', label: '많이 오른 업종' }, { key: 'down', label: '많이 내린 업종' }]} />
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column' }}>
        <Pending view={view} loading="업종을 불러오는 중…" fail="업종을 못 가져왔어요." onRetry={kr.reload} retryLabel="업종 다시 불러오기" />
        {view.kind === 'ok' && (shown.length === 0
          ? <span style={noteStyle()}>{view.data.items.length === 0 ? '네이버 업종 목록이 비어 있어요.' : dir === 'up' ? '오늘 오른 업종이 없어요.' : '오늘 내린 업종이 없어요.'}</span>
          : shown.map((g, i) => (
            <div key={g.no} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: `${SP.sm}px 0`, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm, minWidth: 0 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: FS.body, fontWeight: 600, color: TK.slate100 }}>{g.name}</span>
                <span style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 700, color: upDown(g.changePct) }}>{g.changePct == null ? '—' : pct(g.changePct)}</span>
              </div>
              <div aria-hidden style={{ height: 6, borderRadius: RAD.pill, background: TK.line1, overflow: 'hidden' }}>
                <div style={{ width: `${bars[i]}%`, height: '100%', background: upDown(g.changePct) }} />
              </div>
              <span style={noteStyle()}>
                {[g.rise != null ? `오른 종목 ${g.rise}` : null, g.fall != null ? `내린 종목 ${g.fall}` : null, g.count != null ? `전체 ${g.count}` : null].filter(Boolean).join(' · ')}
              </span>
              {g.limitBreakSuspect && <span style={noteStyle(TK.amber400)}>하루 ±30%를 넘은 종목(상장 첫날 등)이 섞여 크게 움직였어요 — 종목 수를 함께 보세요.</span>}
            </div>
          )))}
      </div>
      {view.kind === 'ok' && <MoreToggle open={open} total={ranked.length} shown={SHOW} onToggle={() => setOpen(o => !o)} />}
      {view.kind === 'ok' && (
        <span style={noteStyle()}>
          {total != null ? `업종 ${total}개 중 ${dir === 'up' ? '많이 오른' : '많이 내린'} 순` : `${dir === 'up' ? '많이 오른' : '많이 내린'} 순`} · 업종 등락은 시가총액이 큰 회사가 더 크게 반영돼요 · 네이버(기준 시각 표시 없음)
        </span>
      )}
    </section>
  )
}
