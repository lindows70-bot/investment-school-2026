// 🔥 오늘 시장의 눈 — 마켓 카탈리스트 API. ①메가 뉴스(시장 전체 판도, Gemini ≤3건) ②수급 블랙홀(US 트렌딩 거래량 폭증 + KR 수급 상위) ③자비스 한줄 처방(린치/버핏 페르소나)
// Zero Cost: Google News RSS(무인증) + Yahoo trending/quote + market-flow-kr 캐시 재사용 · 3h 캐시(아침 갱신) · 수급 수치는 전부 정량 계산(LLM은 뉴스 요약만)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import type { MarketFlowKrResult } from '@/lib/marketFlowKr'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface MarketMover {
  ticker: string
  name: string
  market: 'US' | 'KR'
  changePct: number | null     // 당일 등락 %
  volRatio: number | null      // 거래량 ÷ 3개월 평균(US) — 2배↑면 수급 블랙홀
  note: string                 // 'KR 외인+기관 쌍끌이 3일' 등 정량 근거
}
export interface MarketCatalyst {
  title: string                // 한국어 헤드라인 요약
  why: string                  // 시장 수급에 어떤 쏠림을 만드는지
  tickers: string[]            // 관련 종목/밸류체인
  jarvisTip: string            // 린치/버핏 관점 한줄 처방(뇌동매수 방지)
}
export interface MarketCatalystResult {
  catalysts: MarketCatalyst[]  // ≤3건 — 오늘 시장의 눈
  movers: MarketMover[]        // 수급 블랙홀 레이더(정량)
  marketMood: string | null    // 시장 분위기 한 줄
  asOf: string
}

// ── Google News RSS(무료·무인증) — 시장 전반 헤드라인 ─────────────────────────
async function googleNews(query: string, take = 8): Promise<string[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const xml = await r.text()
    const titles = Array.from(xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g))
      .map(m => m[1].trim()).filter(t => t && !/Google 뉴스/i.test(t))
    return titles.slice(1, 1 + take)   // 첫 항목은 피드 제목
  } catch { return [] }
}

// ── US 수급 블랙홀 — Yahoo 트렌딩 + 거래량 비율(정량) ─────────────────────────
async function usMovers(): Promise<MarketMover[]> {
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const tr = await yf.trendingSymbols('US', { count: 12 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const symbols: string[] = (tr?.quotes ?? []).map((q: any) => q.symbol)
      .filter((s: string) => /^[A-Z.]{1,6}$/.test(s))   // 지수·선물·암호화폐 심볼 제외
      .slice(0, 10)
    if (symbols.length === 0) return []
    const quotes = await yf.quote(symbols)
    const arr = Array.isArray(quotes) ? quotes : [quotes]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.map((q: any) => {
      const vol = q.regularMarketVolume, avg = q.averageDailyVolume3Month
      const volRatio = vol && avg && avg > 0 ? Math.round((vol / avg) * 10) / 10 : null
      const changePct = typeof q.regularMarketChangePercent === 'number' ? Math.round(q.regularMarketChangePercent * 10) / 10 : null
      return {
        ticker: q.symbol as string, name: (q.shortName ?? q.symbol) as string, market: 'US' as const,
        changePct, volRatio,
        note: volRatio != null && volRatio >= 2 ? `거래량 평소 ${volRatio}배 폭증` : '트렌딩 상위',
      }
    }).filter((m: MarketMover) => (m.volRatio != null && m.volRatio >= 1.5) || (m.changePct != null && Math.abs(m.changePct) >= 3))
      .sort((a: MarketMover, b: MarketMover) => (b.volRatio ?? 0) - (a.volRatio ?? 0))
      .slice(0, 5)
  } catch { return [] }
}

// ── KR 수급 블랙홀 — market-flow-kr 캐시 재사용(추가 fetch 0) ──────────────────
async function krMovers(): Promise<MarketMover[]> {
  let mf: MarketFlowKrResult | null = null
  for (let d = 0; d < 5 && !mf; d++) {
    const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
    mf = await getCache<MarketFlowKrResult>(`market-flow-kr-v5:${dt}`, 6 * 24 * 3600_000)
  }
  if (!mf) return []
  return (mf.entries ?? [])
    .filter(e => e.dualStreak >= 2)
    .sort((a, b) => b.dualStreak - a.dualStreak)
    .slice(0, 3)
    .map(e => ({
      ticker: e.ticker, name: e.name, market: 'KR' as const,
      changePct: null, volRatio: null,
      note: `외인+기관 쌍끌이 ${e.dualStreak}일 연속`,
    }))
}

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    catalysts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title:     { type: 'STRING' },
          why:       { type: 'STRING' },
          tickers:   { type: 'ARRAY', items: { type: 'STRING' } },
          jarvisTip: { type: 'STRING' },
        },
        required: ['title', 'why', 'tickers', 'jarvisTip'],
      },
    },
    marketMood: { type: 'STRING' },
  },
  required: ['catalysts', 'marketMood'],
}

export async function GET() {
  const cacheKey = `market-catalyst-v2:${kstDate()}`   // v2: KR 종목은 한글 종목명 표기
  const cached = await getCache<MarketCatalystResult>(cacheKey, 3 * 3600_000)   // 3h — 아침/오후 갱신
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 정량 수급 + ② 시장 헤드라인 일괄 수집
  const [us, kr, hUs, hKr, hBig] = await Promise.all([
    usMovers(), krMovers(),
    googleNews('미국 증시 특징주 급등'),
    googleNews('코스피 코스닥 특징주'),
    googleNews('IPO 상장 OR 인수합병 OR FOMC 발표', 6),
  ])
  const movers = [...us, ...kr]
  const headlines = Array.from(new Set([...hBig, ...hUs, ...hKr])).slice(0, 22)

  // ③ Gemini — 메가 카탈리스트 ≤3건 + 자비스 페르소나 처방(실패 시 movers만으로 graceful)
  let catalysts: MarketCatalyst[] = []
  let marketMood: string | null = null
  if (headlines.length > 0) {
    const moverText = movers.map(m => `- ${m.name}(${m.ticker}/${m.market}): ${m.note}${m.changePct != null ? `, 등락 ${m.changePct}%` : ''}`).join('\n')
    const prompt = `너는 투자학교의 AI 멘토 '자비스'다. 아래 오늘의 실제 뉴스 헤드라인과 정량 수급 데이터를 보고, 오늘 시장의 돈과 눈이 쏠릴 '메가 카탈리스트'를 최대 3건만 골라라.

[오늘 헤드라인]
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

[정량 수급(실측)]
${moverText || '(없음)'}

[규칙 — 절대 엄수]
- 헤드라인에 실제로 있는 사건만 사용. 헤드라인에 없는 사건·수치·날짜를 지어내지 마라.
- catalysts: 시장 전체 유동성을 움직일 큰 사건 순. title=한국어 한줄 요약, why=어느 섹터/밸류체인으로 수급 쏠림이 생기는지 1~2문장, tickers=관련 종목(헤드라인·수급 데이터에 근거한 것만, 최대 4개). 표기: 미국 종목은 티커(NVDA), 한국 종목은 6자리 코드가 아니라 반드시 한글 종목명(삼성전자·SK하이닉스)으로.
- jarvisTip: 피터 린치/워런 버핏 관점 한줄 처방. 뇌동매수 경계가 기본 톤 — 급등 뉴스면 "경기순환주 고점 촉매인지 진단 탭 함정 레이더 확인", 대형 IPO면 "축제 첫날 추격보다 밸류체인의 이익 실체 확인" 식으로.
- 사소한 종목 뉴스·반복 시황은 제외. 진짜 메가급이 1건뿐이면 1건만.
- marketMood: 오늘 시장 분위기 한 줄(헤드라인 근거).
- 전부 한국어.`
    const g = await callGeminiJSON<{ catalysts: MarketCatalyst[]; marketMood: string }>(prompt, GEMINI_SCHEMA, { temperature: 0.4 })
    if (g.ok && g.data) {
      catalysts = (g.data.catalysts ?? []).slice(0, 3)
      marketMood = g.data.marketMood ?? null
    }
  }

  const result: MarketCatalystResult = { catalysts, movers, marketMood, asOf: new Date().toISOString() }
  if (catalysts.length > 0 || movers.length > 0) await setCache(cacheKey, result)   // 빈 결과 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
