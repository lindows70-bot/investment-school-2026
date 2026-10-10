'use client'
// 학생 홈 '내 종목 뉴스' — 화면에 들어올 때 news-catalyst 를 불러 종목당 제목 2개·최대 3종목만. 언론사·시각은 원천이 버려서 없다
//   제목을 누르면 기사(links[].url)가 새 창으로 — 주소가 없는 제목(원천이 안 줌)은 글자만(2026-09-27 사용자 요청)
import { TK, FS, SP } from '@/lib/theme'
import { useJson } from '@/app/components/student/useJson'
import { useInView } from '@/app/components/student/useInView'
import { card, CardHead, FailRow, noteStyle } from './homeUi'

interface Catalyst { ticker?: unknown; name?: unknown; headlines?: unknown; links?: unknown }
interface Line { title: string; url: string | null }
const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u)
const MAX_STOCKS = 3
const MAX_HEADLINES = 2

export default function MyNews() {
  const [ref, seen] = useInView<HTMLElement>()
  const news = useJson<{ catalysts?: Catalyst[] }>('/api/news-catalyst', { enabled: seen })

  const list = news.state === 'ok' && Array.isArray(news.data?.catalysts)
    ? news.data.catalysts
        .map(c => ({
          ticker: typeof c?.ticker === 'string' ? c.ticker : '',
          name: typeof c?.name === 'string' && c.name ? c.name : typeof c?.ticker === 'string' ? c.ticker : '',
          // links(제목+주소)가 오면 그걸, 없으면 headlines(제목만) — 응답 필드가 빠져도 제목은 보인다
          headlines: (Array.isArray(c?.links) && (c.links as unknown[]).length > 0
            ? (c.links as { title?: unknown; url?: unknown }[]).filter(l => typeof l?.title === 'string' && l.title.trim() !== '').map(l => ({ title: (l.title as string).trim(), url: isHttp(l.url) ? l.url : null }))
            : Array.isArray(c?.headlines) ? (c.headlines as unknown[]).filter((h): h is string => typeof h === 'string' && h.trim() !== '').map(h => ({ title: h, url: null })) : []
          ).slice(0, MAX_HEADLINES) as Line[],
        }))
        .filter(c => c.name && c.headlines.length > 0)
        .slice(0, MAX_STOCKS)
    : null

  return (
    <section ref={ref} style={{ ...card, display: 'flex', flexDirection: 'column', gap: SP.sm }}>
      <CardHead title="내 종목 뉴스" href="/s/news" linkText="더 보기 ›" />
      {(news.state === 'idle' || news.state === 'loading') && <span style={noteStyle()}>내 종목 뉴스를 모으는 중… 조금 걸려요.</span>}
      {news.state === 'unauth' && <span style={noteStyle()}>로그인하면 내 종목 뉴스가 보여요.</span>}
      {(news.state === 'failed' || (news.state === 'ok' && list == null)) && <FailRow text="뉴스를 못 가져왔어요." onRetry={news.reload} retryLabel="내 종목 뉴스 다시 불러오기" />}
      {list != null && list.length === 0 && <span style={noteStyle()}>모인 뉴스 제목이 없어요. (ETF·코인은 뉴스를 모으지 않아요)</span>}
      {list != null && list.map(c => (
        <div key={c.ticker || c.name} style={{ display: 'flex', flexDirection: 'column', gap: SP.xs, paddingTop: SP.sm, borderTop: `1px solid ${TK.border}`, minWidth: 0 }}>
          <span style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          {c.headlines.map((h, i) => h.url
            ? <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', minHeight: 44, fontSize: FS.body, color: TK.slate200, lineHeight: 1.5, overflowWrap: 'anywhere', textDecoration: 'none' }}>{h.title}<span aria-hidden style={{ color: TK.sub, marginLeft: SP.xs, flexShrink: 0 }}>›</span></a>
            : <span key={i} style={{ fontSize: FS.body, color: TK.slate200, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{h.title}</span>)}
        </div>
      ))}
      {list != null && list.length > 0 && <span style={noteStyle()}>{list.some(c => c.headlines.some(h => h.url)) ? '제목을 누르면 기사가 새 창으로 열려요' : '제목만 모았어요'} · 자세한 해석은 분석 화면에서</span>}
    </section>
  )
}
