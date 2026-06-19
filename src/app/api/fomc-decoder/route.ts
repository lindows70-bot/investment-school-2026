// 🏛️ FOMC 디코더 — 직전 연준 회의(성명서·점도표·금리결정 + 의장 기자회견)를 실제 뉴스로 가져와
//  "무엇을 결정했고 / 의장은 뭐라 했고 / 그래서 유동성은 어디로" 를 해석. 화면은 앱 설정대로 '워시 의장' 프레이밍.
// Zero Cost: Google News RSS(무인증) + Gemini 구조화 해석. 환각 가드(헤드라인 근거만) · 6h 캐시.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { FOMC_SCHEDULE } from '@/lib/fomcSchedule'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export type Stance = 'hawkish' | 'neutral' | 'dovish'

export interface FomcQuote { quote: string; meaning: string }   // 의장 발언 핵심 + 해석
export type GapKind = 'aligned' | 'partial' | 'diverge'
export interface MarketGap {
  rateDir: 'cut' | 'hold' | 'hike'
  rateDirLabel: string       // 인하/동결/인상
  agreement: GapKind         // 의장 기조 vs 시장(FF선물) 일치도
  text: string               // 한 줄 해석
}
export interface FomcDecoderResult {
  meetingLabel: string       // "Jun '26" (결정론 — FOMC_SCHEDULE)
  meetingDate: string        // 2026-06-17
  daysSince: number          // 회의 후 경과일(음수면 예정 회의까지 D-)
  isRecent: boolean          // 최근 14일 내 회의 = '방금 회의' 모드
  nextDate: string | null    // 다음 회의일
  decision: string           // 금리 동결/인하/인상 + 레벨(AI, 헤드라인 근거)
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

// 오늘(KST) 기준 직전 회의 + 다음 회의 — FOMC_SCHEDULE에서 결정론적으로
function anchorMeeting() {
  const today = kstDate()
  const past = FOMC_SCHEDULE.filter(m => m.date <= today)
  const future = FOMC_SCHEDULE.filter(m => m.date > today)
  const latest = past.length ? past[past.length - 1] : FOMC_SCHEDULE[0]
  const next = future.length ? future[0] : null
  const daysSince = Math.round((new Date(today).getTime() - new Date(latest.date).getTime()) / 86400_000)
  return { latest, next, daysSince }
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    decision: { type: 'STRING' },
    stance: { type: 'STRING', enum: ['hawkish', 'neutral', 'dovish'] },
    stanceText: { type: 'STRING' },
    chairRemarks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { quote: { type: 'STRING' }, meaning: { type: 'STRING' } }, required: ['quote', 'meaning'] } },
    macroDirection: { type: 'STRING' },
    assetImplication: { type: 'ARRAY', items: { type: 'OBJECT', properties: { asset: { type: 'STRING' }, view: { type: 'STRING' } }, required: ['asset', 'view'] } },
  },
  required: ['decision', 'stance', 'stanceText', 'chairRemarks', 'macroDirection', 'assetImplication'],
}

export async function GET(req: Request) {
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const { latest, next, daysSince } = anchorMeeting()
  const isRecent = daysSince >= 0 && daysSince <= 14
  const cacheKey = `fomc-decoder-v2:${latest.date}:${kstDate()}`   // v2: 의장 기조 vs 시장(FF선물) 갭 추가
  const cached = await getCache<FomcDecoderResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 실제 뉴스: ① 성명서·점도표·금리결정(사실 백본) ② 의장 기자회견 발언(해석 레이어)
  const [enStmt, enChair, enDots, koFomc] = await Promise.all([
    googleNews('FOMC statement rate decision when:14d', 8, 'en'),
    googleNews('Federal Reserve Chair press conference remarks when:14d', 7, 'en'),
    googleNews('Fed dot plot projections rate path when:21d', 5, 'en'),
    googleNews('FOMC 연준 기준금리 결정 기자회견 when:14d', 7, 'ko'),
  ])
  const headlines = Array.from(new Set([...enStmt, ...enChair, ...enDots, ...koFomc])).slice(0, 26)
  if (headlines.length === 0) return NextResponse.json({ error: 'no_news' }, { status: 200 })

  const prompt = `너는 투자학교의 AI 연준 분석관이다. 아래 실제 뉴스 헤드라인을 근거로, 가장 최근 FOMC 회의(${latest.label}, ${latest.date})의 결정과 의장 발언을 학생용으로 해석하라.

[헤드라인]
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

[규칙 — 절대 엄수]
- 헤드라인에 실제로 있는 내용만 사용하라. 없는 수치·발언·표결·점도표 숫자를 지어내지 마라(불확실하면 일반적 표현으로).
- decision: 기준금리 결정(동결/인하/인상)과 레벨을 헤드라인 근거로 한 줄(한국어). 근거 약하면 "헤드라인상 명확한 금리 변경 신호 없음(동결 추정)".
- stance: 'hawkish'(매파·긴축 지속) / 'neutral'(중립) / 'dovish'(비둘기·완화) 중 하나. stanceText: 기조 한 줄.
- chairRemarks: 의장 기자회견 발언 핵심 2~3개. 각 {quote: 발언 요지(한국어, 헤드라인 근거·창작 금지), meaning: "이게 시장엔 무슨 뜻인지" 1줄}. ⭐ 이 앱에서 연준 의장은 '워시(Warsh) 의장'이다 — 발언 주체를 '워시 의장'으로 표기하되 내용은 반드시 실제 헤드라인 근거로만.
- macroDirection: "그래서 유동성은 풀리나 조이나, 금리 경로는" 관점 1~2줄(한국어).
- assetImplication: 자산별 시사점 3~4개. 각 {asset: '주식'|'채권'|'달러'|'코인' 등, view: 한 줄}.
- 학생 교육 톤, 전부 한국어. 법률·전문용어 최소화.`

  const g = await callGeminiJSON<Omit<FomcDecoderResult, 'meetingLabel' | 'meetingDate' | 'daysSince' | 'isRecent' | 'nextDate' | 'marketGap' | 'asOf'>>(prompt, SCHEMA, { temperature: 0.3 })
  if (!g.ok || !g.data) return NextResponse.json({ error: 'ai_failed' }, { status: 200 })

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
    daysSince,
    isRecent,
    nextDate: next?.date ?? null,
    decision: g.data.decision ?? '',
    stance: g.data.stance ?? 'neutral',
    stanceText: g.data.stanceText ?? '',
    chairRemarks: (g.data.chairRemarks ?? []).slice(0, 3),
    macroDirection: g.data.macroDirection ?? '',
    assetImplication: (g.data.assetImplication ?? []).slice(0, 4),
    marketGap,
    asOf: new Date().toISOString(),
  }
  if (result.chairRemarks.length > 0 || result.decision) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
