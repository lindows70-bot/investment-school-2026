'use client'
// 시장 화면 주요 뉴스 5 — 원문 제목·언론사·몇 시간 전(마운트 뒤 계산) + 네이버 기사 링크(새 탭). 원천 = /api/market-board/kr 의 news(네이버 주요 뉴스, 재작성 없음)
import { TK, FS, SP } from '@/lib/theme'
import { viewOf, agoText, type KrBoardResp } from '@/lib/marketScreen'
import type { KrNews as News } from '@/lib/krMarketBoard'
import type { JsonResult } from '@/app/components/student/useJson'
import { card, CardHead, noteStyle } from '@/app/components/student/home/homeUi'
import { Pending, useNow } from './marketUi'

const N = 5

export default function KrNews({ kr }: { kr: JsonResult<KrBoardResp> }) {
  const now = useNow()
  const view = viewOf<KrBoardResp, News[]>(kr, d => d.news)
  const items = view.kind === 'ok' ? view.data.slice(0, N) : []
  return (
    <section aria-label="주요 뉴스" style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="주요 뉴스" />
      <Pending view={view} loading="뉴스를 불러오는 중…" fail="뉴스를 못 가져왔어요." onRetry={kr.reload} retryLabel="주요 뉴스 다시 불러오기" />
      {view.kind === 'ok' && (items.length === 0
        ? <span style={noteStyle()}>네이버 주요 뉴스 목록이 비어 있어요.</span>
        : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map(n => {
              const ago = now != null ? agoText(n.datetime, now) : null
              return (
                <a key={`${n.officeId}-${n.articleId}`} href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, padding: `${SP.sm}px 0`, borderTop: `1px solid ${TK.border}`, color: TK.slate200, textDecoration: 'none', minWidth: 0 }}>
                  <span style={{ fontSize: FS.body, color: TK.slate100, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{n.title}</span>
                  <span style={noteStyle()}>{[n.office, ago].filter(Boolean).join(' · ')}</span>
                </a>
              )
            })}
          </div>
        ))}
      {view.kind === 'ok' && <span style={noteStyle()}>네이버 증권 주요 뉴스 · 누르면 기사가 새 창으로 열려요</span>}
    </section>
  )
}
