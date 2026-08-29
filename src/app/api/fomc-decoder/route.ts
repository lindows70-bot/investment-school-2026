// 🏛️ 연준 디코더 — **직전 연준 이벤트**(FOMC 정례회의 / 잭슨홀 기조연설 / 의회 증언)를 실제 뉴스로 가져와
//  "무엇을 결정했고 / 의장은 뭐라 했고 / 그래서 유동성은 어디로" 를 해석. 화면은 앱 설정대로 '워시 의장' 프레이밍.
// Zero Cost: Google News RSS(무인증) + Gemini 구조화 해석. 환각 가드(헤드라인 근거만) · 6h 캐시.
//
// ⚠️ 2026-08-29 교정 — 앵커를 FOMC 회의로만 잡던 시절, **뉴스 창(when:14d)과 앵커가 서로 몰라서**
//    31일 전 회의(Jul '26)에 어젯밤 잭슨홀 연설 헤드라인이 붙었다. 화면은 잭슨홀 발언
//    ("We have work to do" · "stubborn inflation may require rate hikes")을 **7/29 FOMC 기자회견
//    발언으로 라벨링**했다. 이제 앵커가 이벤트 종류까지 고르고, 뉴스 쿼리·프롬프트가 그 앵커를 따른다.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'
import { FED_EVENTS, EVENT_QUERIES, HAS_RATE_DECISION, VENUE_KO, newsWindowDays, MUST_MATCH, MIN_MATCHES, type FedEvent, type FedEventKind } from '@/lib/fedEvents'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export type Stance = 'hawkish' | 'neutral' | 'dovish'

/** 의장 발언 핵심 + 해석. `src` = 이 발언의 **근거 헤드라인**(매체명 포함 원문).
 *  ⚠️ 근거를 못 대는 발언은 응답에서 버린다 — "규칙을 더 쓰지 말고 원문 값을 주라"(실적 리포트 금액 오독 교훈).
 *  실사고: 헤드라인이 `advocates for 'quieter' central bank` 뿐인데 화면이
 *  "시장과 소통하겠습니다 → 정책 불확실성을 낮추겠다는 의지"로 나갔다(소통·불확실성 근거 0건 · 뜻은 정반대). */
export interface FomcQuote { quote: string; meaning: string; src?: string }
export type GapKind = 'aligned' | 'partial' | 'diverge'
export interface MarketGap {
  rateDir: 'cut' | 'hold' | 'hike'
  rateDirLabel: string       // 인하/동결/인상
  agreement: GapKind         // 의장 기조 vs 시장(FF선물) 일치도
  text: string               // 한 줄 해석
}
export interface FomcDecoderResult {
  meetingLabel: string       // "Jun '26" / "잭슨홀 '26" (결정론 — FOMC_SCHEDULE ∪ FED_EVENTS)
  meetingDate: string        // 2026-06-17
  eventKind: FedEventKind    // 🆕 이 해석이 어느 자리의 것인가 — 회의/연설/증언
  eventTitle: string         // 🆕 "잭슨홀 심포지엄 · 의장 기조연설" (fomc 면 "FOMC 정례회의")
  daysSince: number          // 이벤트 후 경과일
  isRecent: boolean          // 최근 14일 내 = '따끈한' 모드
  nextDate: string | null    // 다음 FOMC 회의일(연설이 앵커여도 '다음 회의'는 FOMC 기준)
  decision: string           // 금리 동결/인하/인상 + 레벨 — ⚠️ 연설·증언엔 결정이 없다(문구로 명시)
  stance: Stance             // 매파/중립/비둘기
  stanceText: string         // 기조 한 줄
  chairRemarks: FomcQuote[]  // 의장(워시) 발언 핵심 2~3
  macroDirection: string     // 그래서 유동성·금리 경로
  assetImplication: { asset: string; view: string }[]   // 자산별 시사점
  marketGap: MarketGap | null   // 🆚 의장 기조 vs 시장(FF선물) 기대 — macro-regime rateDir SSOT 재사용
  asOf: string
}

// 의장 기조(AI stance) ↔ 시장(FF선물 rateDir) 비교 — 정량 SSOT(rateDir)는 그대로 두고 디코더에서 대조만
function buildMarketGap(stance: Stance, rateDir: 'cut' | 'hold' | 'hike'): MarketGap {
  const stanceDir = stance === 'hawkish' ? 'up' : stance === 'dovish' ? 'down' : 'flat'
  const mktDir = rateDir === 'hike' ? 'up' : rateDir === 'cut' ? 'down' : 'flat'
  const rateDirLabel = rateDir === 'hike' ? '인상' : rateDir === 'cut' ? '인하' : '동결'
  const stanceKo = stance === 'hawkish' ? '매파' : stance === 'dovish' ? '비둘기' : '중립'
  let agreement: GapKind, text: string
  if (stanceDir === mktDir) {
    agreement = 'aligned'
    text = stanceDir === 'up'
      ? `워시 의장(매파)과 시장(FF선물·인상)이 같은 방향 — 고금리 장기화 컨센서스가 확고합니다. 섣부른 인하 기대는 위험합니다.`
      : stanceDir === 'down'
      ? `의장(비둘기)과 시장(인하)이 같은 방향 — 완화 사이클 컨센서스로, 위험자산에 우호적입니다.`
      : `의장(중립)과 시장(동결)이 일치 — 당분간 금리 동결 국면입니다.`
  } else if (stanceDir === 'flat' || mktDir === 'flat') {
    agreement = 'partial'
    text = `의장은 ${stanceKo} 신호인데 시장(FF선물)은 ${rateDirLabel} 반영 중 — 시장이 연준 기조를 ${mktDir === 'flat' ? '아직 다 따라가지 않고 관망' : (stanceDir === 'flat' ? '앞질러 베팅' : '다르게 해석')}합니다.`
  } else {
    agreement = 'diverge'
    text = `⚠️ 의장은 ${stanceKo}인데 시장(FF선물)은 ${rateDirLabel} 베팅 — 정반대입니다. 연준이 양보하거나 시장이 항복하거나, 한쪽이 곧 꺾입니다(변동성 주의).`
  }
  return { rateDir, rateDirLabel, agreement, text }
}

async function googleNews(query: string, take: number, lang: 'ko' | 'en'): Promise<string[]> {
  try {
    const loc = lang === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=ko&gl=KR&ceid=KR:ko'
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    return Array.from(xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)).map(m => m[1].trim()).filter(t => t && !/Google 뉴스/i.test(t)).slice(1, 1 + take)
  } catch { return [] }
}

// 오늘(KST) 기준 **직전 연준 이벤트** + 다음 FOMC — FOMC_SCHEDULE ∪ FED_EVENTS 에서 결정론적으로.
// 회의든 연설이든 '더 최근에 일어난 것'이 앵커다(그래야 뉴스 창과 이름표가 어긋나지 않는다).
const fomcAsEvents = (): FedEvent[] =>
  FOMC_SCHEDULE.map(m => ({ kind: 'fomc', label: m.label, date: m.date, title: 'FOMC 정례회의' }))

const daysBetween = (today: string, date: string) => Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86400_000)

function anchorEvent() {
  const today = kstDate()
  const all = [...fomcAsEvents(), ...FED_EVENTS].sort((a, b) => a.date.localeCompare(b.date))
  const past = all.filter(e => e.date <= today)
  const latest = past.length ? past[past.length - 1] : all[0]
  const next = FOMC_SCHEDULE.filter(m => m.date > today)[0] ?? null   // '다음 회의'는 언제나 FOMC 기준
  return { latest, next, daysSince: daysBetween(today, latest.date) }
}

/** 앵커를 FOMC 회의로 되돌린다 — 비FOMC 이벤트 기사가 말라 그 자리의 해석이라 말할 수 없을 때. */
function fallbackToFomc() {
  const today = kstDate()
  const past = fomcAsEvents().filter(e => e.date <= today)
  const latest = past.length ? past[past.length - 1] : fomcAsEvents()[0]
  return { latest, daysSince: daysBetween(today, latest.date) }
}

/** 한 이벤트에 대한 헤드라인 수집 — 창은 앵커 경과일에서 역산한다(상수 금지). */
async function collectHeadlines(kind: FedEventKind, daysSince: number): Promise<string[]> {
  const win = newsWindowDays(daysSince)
  const groups = await Promise.all(EVENT_QUERIES[kind].map(([q, lang, take]) => googleNews(`${q} when:${win}d`, take, lang)))
  return Array.from(new Set(groups.flat())).slice(0, 30)   // 쿼리 축이 늘어 26 이면 뒤쪽 그룹이 잘린다
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    decision: { type: 'STRING' },
    stance: { type: 'STRING', enum: ['hawkish', 'neutral', 'dovish'] },
    stanceText: { type: 'STRING' },
    chairRemarks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { quote: { type: 'STRING' }, meaning: { type: 'STRING' }, srcIdx: { type: 'INTEGER' } }, required: ['quote', 'meaning', 'srcIdx'] } },
    macroDirection: { type: 'STRING' },
    assetImplication: { type: 'ARRAY', items: { type: 'OBJECT', properties: { asset: { type: 'STRING' }, view: { type: 'STRING' } }, required: ['asset', 'view'] } },
  },
  required: ['decision', 'stance', 'stanceText', 'chairRemarks', 'macroDirection', 'assetImplication'],
}

export async function GET(req: Request) {
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const anchor = anchorEvent()
  let { latest, daysSince } = anchor
  const next = anchor.next
  const cacheKey = `fomc-decoder-v6:${latest.date}:${kstDate()}`   // v6: 소통·가이던스 축 쿼리 추가(헤드라인 집합이 바뀐다)
  const cached = await getCache<FomcDecoderResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 실제 뉴스 — **앵커 종류에 맞는 쿼리 + 앵커에서 역산한 창**으로 판다
  let headlines = await collectHeadlines(latest.kind, daysSince)

  // 🛡️ 관련성 가드 — 비FOMC 이벤트인데 그 이벤트를 다룬 기사가 말랐다면(시간이 지나 기사가 끊긴 경우)
  //    남은 기사를 그 자리의 발언이라 부르지 말고 **직전 FOMC 회의로 앵커를 되돌린다**.
  //    이걸 안 하면 9월 초에 "잭슨홀 기조연설" 이름표로 무관한 최근 기사가 해석된다(같은 버그의 재발).
  const mm = MUST_MATCH[latest.kind]
  if (mm && headlines.filter(h => mm.test(h)).length < MIN_MATCHES) {
    const fb = fallbackToFomc()
    latest = fb.latest; daysSince = fb.daysSince
    headlines = await collectHeadlines('fomc', daysSince)
  }
  if (headlines.length === 0) return NextResponse.json({ error: 'no_news' }, { status: 200 })

  const isRecent = daysSince >= 0 && daysSince <= 14
  const kind = latest.kind
  const venue = VENUE_KO[kind]
  const hasDecision = HAS_RATE_DECISION[kind]

  const prompt = `너는 투자학교의 AI 연준 분석관이다. 아래 실제 뉴스 헤드라인을 근거로, **${latest.title}(${latest.label}, ${latest.date})** 에서 나온 내용을 학생용으로 해석하라.

[헤드라인]
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

[규칙 — 절대 엄수]
- 헤드라인에 실제로 있는 내용만 사용하라. 없는 수치·발언·표결·점도표 숫자를 지어내지 마라(불확실하면 일반적 표현으로).
- ⛔ 이 해석의 대상은 **${latest.title}(${latest.date})** 이다. 헤드라인 중 **다른 자리**(예: 지난 FOMC 회의, 다른 인사의 발언)의 내용을 이 자리의 것처럼 옮겨 쓰지 마라.
${hasDecision
  ? `- decision: 기준금리 결정(동결/인하/인상)과 레벨을 헤드라인 근거로 한 줄(한국어). 근거 약하면 "헤드라인상 명확한 금리 변경 신호 없음(동결 추정)".`
  : `- ⚠️ **이 자리에서는 기준금리를 결정하지 않는다**(${venue}이다). decision 에는 금리 결정을 지어내지 말고, "금리 결정이 없는 ${venue} — " 로 시작해 **연설의 핵심 메시지**를 한 줄로 써라(한국어).`}
- stance: 'hawkish'(매파·긴축 지속) / 'neutral'(중립) / 'dovish'(비둘기·완화) 중 하나. stanceText: 기조 한 줄.
- chairRemarks: 의장이 **${venue}에서** 한 발언 핵심 2~3개. 각 {quote, meaning, **srcIdx**}.
  · **srcIdx = 그 발언의 근거가 된 위 헤드라인 번호(1~${headlines.length})를 반드시 붙여라.** 번호를 댈 수 없으면 그 발언을 아예 쓰지 마라(3개를 채우려고 지어내지 마라 — 2개여도 된다).
  · quote 는 **srcIdx 헤드라인에 실제로 적힌 내용만** 한국어로 옮긴 것이어야 한다. 그 헤드라인에 없는 낱말·주장(예: '소통', '불확실성 축소', 숫자)을 덧붙이지 마라.
  · meaning 은 "이게 시장엔 무슨 뜻인지" 1줄. **quote 가 말하지 않은 방향으로 뜻을 확장하지 마라.**
  · 3개는 **서로 다른 논점**이어야 한다(같은 말을 바꿔 쓴 것 금지).
  · ⭐ 이 앱에서 연준 의장은 '워시(Warsh) 의장'이다 — 발언 주체를 '워시 의장'으로 표기하되 내용은 반드시 실제 헤드라인 근거로만.
- macroDirection: "그래서 유동성은 풀리나 조이나, 금리 경로는" 관점 1~2줄(한국어).
- assetImplication: ⭐ **정확히 4개를 이 순서 그대로** — asset 은 '주식' → '채권' → '달러' → '코인'. 축을 바꾸거나 빼지 마라(호출마다 축이 달라지면 학생이 어제와 오늘을 비교할 수 없다). 각 view 는 한 줄. 헤드라인에 그 자산 언급이 없으면 금리 경로에서 따라오는 일반적 함의를 쓰되 단정하지 마라.
- 학생 교육 톤, 전부 한국어. 법률·전문용어 최소화.`

  type AiOut = Omit<FomcDecoderResult, 'meetingLabel' | 'meetingDate' | 'eventKind' | 'eventTitle' | 'daysSince' | 'isRecent' | 'nextDate' | 'marketGap' | 'asOf' | 'chairRemarks'>
    & { chairRemarks?: { quote?: string; meaning?: string; srcIdx?: number }[] }
  const g = await callGeminiJSON<AiOut>(prompt, SCHEMA, { temperature: 0.3 })
  if (!g.ok || !g.data) return NextResponse.json({ error: 'ai_failed' }, { status: 200 })

  // 🛡️ 근거 검증 — srcIdx 가 실제 헤드라인을 가리키지 않으면 그 발언을 **버린다**(3개를 채우려 지어낸 것).
  //    통과한 발언에는 근거 헤드라인을 실어 화면이 출처를 보여주게 한다(학생이 직접 대조할 수 있어야 한다).
  const remarks: FomcQuote[] = (g.data.chairRemarks ?? [])
    .map((r): FomcQuote | null => {
      const i = Number(r?.srcIdx)
      const src = Number.isInteger(i) && i >= 1 && i <= headlines.length ? headlines[i - 1] : null
      return r?.quote && r?.meaning && src ? { quote: r.quote, meaning: r.meaning, src } : null
    })
    .filter((r): r is FomcQuote => r !== null)
    .slice(0, 3)
  const droppedRemarks = (g.data.chairRemarks ?? []).length - remarks.length
  if (droppedRemarks > 0) console.warn(`[fomc-decoder] 근거 없는 발언 ${droppedRemarks}건 제외(${latest.label})`)

  // 🆚 시장(FF선물) 금리 방향 — macro-regime SSOT(rateDir) 재사용해 의장 기조와 대조
  let marketGap: MarketGap | null = null
  try {
    const rr = await fetch(`${selfBase}/api/macro-regime`, { signal: AbortSignal.timeout(10_000) })
    if (rr.ok) {
      const rj = await rr.json() as { rateDir?: 'cut' | 'hold' | 'hike' }
      if (rj.rateDir) marketGap = buildMarketGap(g.data.stance ?? 'neutral', rj.rateDir)
    }
  } catch { /* graceful — 갭 미표시 */ }

  const result: FomcDecoderResult = {
    meetingLabel: latest.label,
    meetingDate: latest.date,
    eventKind: kind,
    eventTitle: latest.title,
    daysSince,
    isRecent,
    nextDate: next?.date ?? null,
    decision: g.data.decision ?? '',
    stance: g.data.stance ?? 'neutral',
    stanceText: g.data.stanceText ?? '',
    chairRemarks: remarks,
    macroDirection: g.data.macroDirection ?? '',
    assetImplication: (g.data.assetImplication ?? []).slice(0, 4),
    marketGap,
    asOf: new Date().toISOString(),
  }
  if (result.chairRemarks.length > 0 || result.decision) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
