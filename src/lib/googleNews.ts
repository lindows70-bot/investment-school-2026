// 구글 뉴스 RSS 공용 fetcher — 라우트 5곳(crypto-regulation·fomc-decoder·market-catalyst·news-catalyst·re-policy)이 각자 조립하고 파서 4종으로 읽던 것을 하나로(2026-10-18 6차 점검).
//   두 곳은 <title> 전체를 훑어 피드 제목을 slice(1) 로 건너뛰고 링크를 못 달았다 — 여기선 <item> 단위로 제목·링크·날짜·매체를 함께 읽는다.
//   실패·비정상 응답은 빈 배열(호출부 관례). 링크는 http(s) 만(지어내지 않는다 — 아니면 null).
export interface GoogleNewsItem {
  title: string
  link: string | null      // http(s) 가 아니면 null
  date: string | null      // pubDate → 'YYYY-MM-DD'(UTC) · 못 읽으면 null
  source: string | null    // <source> 매체명
}

const UA = 'Mozilla/5.0 (compatible; InvestmentSchoolBot/1.0)'
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
const tag = (item: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(item)
  return m ? decode(m[1]).trim() : ''
}

export async function googleNewsItems(
  query: string,
  opts: { lang?: 'ko' | 'en'; take?: number; timeoutMs?: number } = {},
): Promise<GoogleNewsItem[]> {
  const { lang = 'ko', take = Number.POSITIVE_INFINITY, timeoutMs = 10_000 } = opts
  const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ko&gl=KR&ceid=KR:ko'
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`,
      { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    if (!r.ok) return []
    const xml = await r.text()
    const out: GoogleNewsItem[] = []
    for (const m of Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))) {
      const it = m[1]
      const title = tag(it, 'title')
      if (!title) continue
      const rawLink = tag(it, 'link')
      const dt = tag(it, 'pubDate') ? new Date(tag(it, 'pubDate')) : null
      out.push({
        title,
        link: /^https?:\/\//.test(rawLink) ? rawLink : null,
        date: dt && !isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : null,
        source: tag(it, 'source') || null,
      })
      if (out.length >= take) break
    }
    return out
  } catch { return [] }
}
