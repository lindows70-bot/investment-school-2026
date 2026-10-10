'use client'
// 학생 '내 종목 뉴스' 전체 — 내 개별 주식마다 최근 헤드라인(최대 5개)과 기사 링크(새 창). 홈 '내 종목 뉴스' 카드의 '더 보기'가 온다(5단계: 분석 화면 대신 간편 안에서)
//   원천 = /api/news-catalyst 의 links(제목+주소). ETF·코인은 뉴스를 모으지 않는다. 주소 없는 제목은 글자만(지어내지 않음)
import Link from 'next/link'
import { TK, FS, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { card, FailRow, noteStyle } from '@/app/components/student/home/homeUi'

interface Catalyst { ticker?: unknown; name?: unknown; market?: unknown; headlines?: unknown; links?: unknown }
interface Line { title: string; url: string | null }
const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u)
const MAX_LINES = 5

const back = <Link href="/s" style={{ display: 'inline-flex', alignItems: 'center', height: 44, color: TK.slate300, fontSize: FS.body, textDecoration: 'none' }}>‹ 홈</Link>

export default function StudentNews() {
  const news = useJson<{ catalysts?: Catalyst[] }>('/api/news-catalyst')
  const list = news.state === 'ok' && Array.isArray(news.data?.catalysts)
    ? news.data.catalysts.map(c => {
        const ticker = typeof c?.ticker === 'string' ? c.ticker : ''
        const name = typeof c?.name === 'string' && c.name ? c.name : ticker
        const market = typeof c?.market === 'string' ? c.market : 'US'
        const lines: Line[] = (Array.isArray(c?.links) && (c.links as unknown[]).length > 0
          ? (c.links as { title?: unknown; url?: unknown }[]).filter(l => typeof l?.title === 'string' && l.title.trim() !== '').map(l => ({ title: (l.title as string).trim(), url: isHttp(l.url) ? l.url : null }))
          : Array.isArray(c?.headlines) ? (c.headlines as unknown[]).filter((h): h is string => typeof h === 'string' && h.trim() !== '').map(h => ({ title: h, url: null })) : []
        ).slice(0, MAX_LINES)
        return { ticker, name, market, lines }
      }).filter(c => c.name)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SP.lg, maxWidth: 720 }}>
      {back}
      <header style={{ display: 'flex', flexDirection: 'column', gap: SP.xs }}>
        <h1 style={{ margin: 0, fontSize: FS.h2, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: TK.slate100 }}>내 종목 뉴스</h1>
        <p style={{ margin: 0, fontSize: FS.tiny, color: TK.sub, wordBreak: 'keep-all' }}>내가 가진 개별 주식의 최근 기사 제목이에요. 제목을 누르면 기사가 새 창으로 열려요.</p>
      </header>
      {(news.state === 'idle' || news.state === 'loading') && <div style={card}><span style={noteStyle()}>내 종목 뉴스를 모으는 중… 조금 걸려요.</span></div>}
      {news.state === 'unauth' && <div style={card}><span style={noteStyle()}>로그인하면 내 종목 뉴스가 보여요.</span></div>}
      {(news.state === 'failed' || (news.state === 'ok' && list == null)) && <div style={card}><FailRow text="뉴스를 못 가져왔어요." onRetry={news.reload} retryLabel="내 종목 뉴스 다시 불러오기" /></div>}
      {list != null && list.length === 0 && <div style={card}><span style={noteStyle()}>모인 뉴스가 없어요. ETF·코인은 뉴스를 모으지 않아요 — 개별 주식을 기록하면 여기에 보여요.</span></div>}
      {list != null && list.map(c => (
        <section key={c.ticker || c.name} aria-label={`${c.name} 뉴스`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.xs }}>
          <Link href={`/s/stock/${encodeURIComponent(c.ticker)}?m=${encodeURIComponent(c.market)}&n=${encodeURIComponent(c.name)}`}
            style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.body, fontWeight: 700, color: TK.blue400, textDecoration: 'none', minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span><span aria-hidden style={{ color: TK.sub, marginLeft: SP.xs }}>›</span>
          </Link>
          {c.lines.length === 0 && <span style={noteStyle()}>모인 제목이 없어요.</span>}
          {c.lines.map((h, i) => h.url
            ? <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', minHeight: 44, borderTop: `1px solid ${TK.border}`, fontSize: FS.body, color: TK.slate200, lineHeight: 1.5, overflowWrap: 'anywhere', textDecoration: 'none' }}>{h.title}<span aria-hidden style={{ color: TK.sub, marginLeft: SP.xs, flexShrink: 0 }}>›</span></a>
            : <span key={i} style={{ display: 'flex', alignItems: 'center', minHeight: 44, borderTop: `1px solid ${TK.border}`, fontSize: FS.body, color: TK.slate200, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{h.title}</span>)}
        </section>
      ))}
      {list != null && list.length > 0 && <span style={noteStyle()}>제목만 모았어요(시각 미확인) · 자세한 해석은 하지 않아요 — 기사를 직접 읽어 보세요.</span>}
    </div>
  )
}
