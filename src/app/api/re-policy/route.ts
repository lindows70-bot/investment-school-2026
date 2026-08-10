// 🏛️ 부동산 정책 레이더 API — 📜확정(법령 고시·훈령) + 📰예고(뉴스)를 **한 타임라인에**
//   왜 두 축인가: 뉴스는 빠르지만 "발표 예정"이 섞이고, 법령은 느리지만 이미 발령된 것만 있다.
//   섞으면 학생이 "발표됐다 = 시행됐다"로 오해한다 → 출처를 갈라 표기한다.
//   Zero Cost: 법령정보 API(무료·OC) + Google News RSS(무인증) · 6h 캐시 · 판정은 전부 결정론
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { collectAdmRules, getAdmRulePurpose, LAW_OC_IS_SAMPLE } from '@/lib/lawApi'
import {
  classifyChannel, classifyStance, summarize, climateOf, ymd, dedupKey,
  POLICY_ORG, POLITICS_NOISE, POLICY_NEWS,
  type PolicyItem, type ChannelSummary, type Stance,
} from '@/lib/rePolicy'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 법령 검색 키워드 — 부동산 정책의 집행 수단이 걸리는 말들(Phase 0 실측으로 선별)
const LAW_KW = ['주택공급', '분양가', '재건축', '재개발', '임대주택', '주택가격', '부동산', '청약']
// 뉴스 검색 키워드 — 정책 논의·발표 단계
const NEWS_KW = ['부동산 대책', '주택 공급 대책', 'LTV DSR 규제', '재건축 규제', '종부세 개편', '전세 대출 규제']

export interface RePolicyResult {
  asOf: string
  climate: { stance: Stance; tighten: number; ease: number; n: number }
  channels: ChannelSummary[]
  items: PolicyItem[]          // 최신순(확정+예고 혼합·source 로 구분)
  lawN: number; newsN: number
  politicsFiltered: number     // 🗑️ 정치 공방으로 제외한 기사 수 — 투명하게 표기
  offTopicFiltered: number     // 🗑️ 4대 경로에 안 걸려 제외한 수(행정 절차성 고시 등) — 조용히 버리지 않는다
  lawSample: boolean           // ⚠️ 샘플 OC 사용 중(발급 필요) — 조용히 샘플로 돌지 않게
  lawDown: boolean             // 법령 축이 전멸했나(뉴스만 표시 중임을 화면이 알 수 있게)
}

const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/** 📰 Google News RSS — market-catalyst·crypto-regulation 과 같은 무인증 경로 */
async function newsOf(query: string): Promise<{ title: string; date: string; link: string }[]> {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const xml = await r.text()
    return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(m => {
      const it = m[1]
      const t = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(it)?.[1] ?? ''
      const d = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(it)?.[1] ?? ''
      const l = /<link>([\s\S]*?)<\/link>/.exec(it)?.[1] ?? ''
      const dt = d ? new Date(d) : null
      return { title: dec(t.trim()), date: dt && !isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : '', link: l.trim() }
    }).filter(x => x.title && x.date)
  } catch { return [] }
}

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  // v3: 📌 확정 항목에 '무엇을 정하는 고시인지'(제1조 목적) 부착 — 제목만으론 알 수 없었다
  // v2: 축별 상한(법령이 뉴스에 밀려 사라지던 것) · 따옴표 정규화 중복 제거 · 정치 필터 보강
  const cacheKey = `re-policy-v5:${kstDate()}`   // v5: 목적이 "제1장 총칙"으로 나가던 것 교정(내용만 바뀌어도 키를 올린다) / v4: 접두 제거 폐기
  if (!refresh) {
    const cached = await getCache<RePolicyResult>(cacheKey, 6 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ── 📜 확정 축(법령 고시·훈령) ──
  const { rules } = await collectAdmRules(LAW_KW)
  const lawItems: PolicyItem[] = rules
    .filter(r => POLICY_ORG.test(r.org))          // 부처 필터 — 없으면 산업통상부·보훈부가 섞인다(실측)
    .filter(r => r.issued >= '20240101')          // 최근 것만(정책 레이더의 생명)
    .map(r => ({
      source: 'law' as const,
      title: r.name,
      channel: classifyChannel(r.name),
      stance: classifyStance(`${r.name} ${r.change}`),
      date: ymd(r.issued),
      meta: `${r.org} · ${r.kind} · ${r.change}`,
      link: r.link,
      effective: ymd(r.effective),
      lawId: r.id,
    }))

  // ── 📰 예고 축(뉴스) ──
  const seen = new Set<string>()
  let politicsFiltered = 0
  const newsItems: PolicyItem[] = []
  for (const q of NEWS_KW) {
    for (const n of await newsOf(q)) {
      const key = dedupKey(n.title)   // ⚠️ 유니코드 따옴표까지 정규화(라이브에서 중복 2건 발생)
      if (seen.has(key)) continue
      seen.add(key)
      if (POLITICS_NOISE.test(n.title)) { politicsFiltered++; continue }
      if (!POLICY_NEWS.test(n.title)) continue                        // 정책 기사만(시황·광고 제외)
      const media = /-\s*([^-]+)$/.exec(n.title)?.[1]?.trim() ?? ''
      newsItems.push({
        source: 'news', title: n.title.replace(/\s*-\s*[^-]+$/, ''),
        channel: classifyChannel(n.title), stance: classifyStance(n.title),
        date: n.date, meta: media, link: n.link,
      })
    }
  }

  // 4대 경로에 안 걸리면 정책 신호로 쓰지 않는다(부동산종합공부시스템 운영규정 같은 행정 절차성 고시).
  // ⚠️ 버린 건수는 응답에 남긴다 — 조용히 사라지면 "왜 이것밖에 없지?"에 화면이 답할 수 없다.
  const merged = [...lawItems, ...newsItems]
  const offTopicFiltered = merged.filter(i => i.channel === 'other').length
  const onTopic = merged.filter(i => i.channel !== 'other')
  // ⚠️ **축별로 상한을 따로 둔다.** 한 배열로 날짜 정렬 후 자르면 뉴스(매일 수십 건·오늘 날짜)가
  //    상위를 독식해 법령이 통째로 사라진다 — 라이브에서 실제로 확정 45건이 화면에서 0건이 됐다.
  //    이 기능의 핵심은 '확정 축'이라 그게 밀려나면 기능 자체가 무의미해진다.
  const byDate = (a: PolicyItem, b: PolicyItem) => b.date.localeCompare(a.date)
  const items = [
    ...onTopic.filter(i => i.source === 'law').sort(byDate).slice(0, 25),
    ...onTopic.filter(i => i.source === 'news').sort(byDate).slice(0, 35),
  ].sort(byDate)

  // 📌 확정 항목에 "무엇을 정하는 고시인지" 한 줄을 붙인다 — 제목만으론 알 수 없다.
  //    ⚠️ **화면에 나가는 것만** 조회한다(수집분 45건 전부 부르면 낭비). 개별 30일 캐시라 두 번째부터는 즉시.
  //    실패는 무시 — 목적이 없으면 제목만 보여준다(없는 걸 지어내지 않는다).
  const lawShown = items.filter(i => i.source === 'law' && i.lawId)
  for (let k = 0; k < lawShown.length; k += 5) {
    await Promise.all(lawShown.slice(k, k + 5).map(async i => {
      i.purpose = (await getAdmRulePurpose(i.lawId!).catch(() => null)) ?? undefined
    }))
  }

  const result: RePolicyResult = {
    asOf: new Date().toISOString(),
    climate: climateOf(items),
    channels: summarize(items),
    items,
    lawN: lawItems.length, newsN: newsItems.length,
    politicsFiltered, offTopicFiltered,
    lawSample: LAW_OC_IS_SAMPLE,
    lawDown: lawItems.length === 0,
  }
  // ⛔ 부분실패 박제 금지 — 한 축이라도 죽었으면 6시간 캐시하지 않는다(다음 요청이 스스로 낫는다)
  if (items.length > 0 && !result.lawDown) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
