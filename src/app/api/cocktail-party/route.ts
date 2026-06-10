/**
 * GET /api/cocktail-party
 *
 * 🍸 시장 칵테일 파티 지수 (피터 린치 인간지표)
 *
 * ── 데이터 소스 (하이브리드, 우선순위) ──
 *  ① CNN Fear & Greed Index (메인) — 7개 지표 종합(모멘텀·강도·폭·풋콜·VIX·정크본드·안전자산)
 *     production.dataviz.cnn.io/index/fearandgreed/graphdata (완전 브라우저 헤더 필수, 418 봇차단 회피)
 *     → 점수 + 등급 + 전일/1주/1달 추세 제공
 *  ② VIX + S&P500 자체계산 (폴백) — CNN 차단 시 Yahoo Finance 기반
 *
 * Cron·DB 불필요 — 실시간 fetch + 1시간 캐시
 */

import { NextResponse } from 'next/server'

export interface CocktailPartyResult {
  partyScore:  number              // 0~100 (높을수록 탐욕/파티 과열)
  source:      'cnn' | 'calculated' | 'fallback'
  rating:      string | null       // CNN 등급 (extreme fear/fear/neutral/greed/extreme greed)
  // CNN 추세 (있을 때)
  prevClose:   number | null
  prev1Week:   number | null
  prev1Month:  number | null
  // 보조 지표 (항상 표시)
  vix:         number | null
  vixGreed:    number
  vixHistory:  { date: string; vix: number }[]   // VIX 1년 주간 추이 (미니 차트용)
  sp500:       number | null
  momentum:    number
  status:      { level: string; label: string; emoji: string; advice: string; lynchQuote: string }
  asOf:        string
}

const CACHE: { data: CocktailPartyResult | null; expiresAt: number } = { data: null, expiresAt: 0 }
const CACHE_TTL = 3_600_000   // 1시간

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// ── CNN Fear & Greed (완전 브라우저 헤더로 봇차단 회피) ───────────────────────
const CNN_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://edition.cnn.com',
  'Referer': 'https://edition.cnn.com/',
}

interface CnnData {
  score:      number
  rating:     string
  prevClose:  number | null
  prev1Week:  number | null
  prev1Month: number | null
}

async function fetchCnnFearGreed(): Promise<CnnData | null> {
  try {
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      { headers: CNN_H, next: { revalidate: 1800 } as RequestInit['next'] }
    )
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await res.json()
    const fng = d?.fear_and_greed
    if (!fng || typeof fng.score !== 'number') return null
    const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null
    return {
      score:      Math.round(fng.score),
      rating:     String(fng.rating ?? ''),
      prevClose:  num(fng.previous_close),
      prev1Week:  num(fng.previous_1_week),
      prev1Month: num(fng.previous_1_month),
    }
  } catch { return null }
}

// ── Yahoo Finance (VIX·S&P500 — 폴백 + 보조표시) ─────────────────────────────
const YF_H: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
}
async function fetchYahooMeta(symbol: string) {
  for (const host of ['query1', 'query2']) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
        { headers: YF_H, next: { revalidate: 1800 } as RequestInit['next'] }
      )
      if (!res.ok) continue
      const meta = (await res.json())?.chart?.result?.[0]?.meta
      if (meta) return meta
    } catch { /* next host */ }
  }
  return null
}

// VIX 1년 주간 추이 (미니 트렌드 차트용)
async function fetchVixHistory(): Promise<{ date: string; vix: number }[]> {
  for (const host of ['query1', 'query2']) {
    try {
      const res = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1y&interval=1wk`,
        { headers: YF_H, next: { revalidate: 3600 } as RequestInit['next'] }
      )
      if (!res.ok) continue
      const r = (await res.json())?.chart?.result?.[0]
      const ts: number[] = r?.timestamp ?? []
      const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? []
      const out = ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        vix:  closes[i],
      })).filter((p): p is { date: string; vix: number } => typeof p.vix === 'number' && isFinite(p.vix))
      if (out.length) return out
    } catch { /* next host */ }
  }
  return []
}

// ── 파티 지수 → 5단계 (린치 칵테일 파티 비유) ────────────────────────────────
function getStatus(score: number): CocktailPartyResult['status'] {
  if (score < 25) return {
    level: 'extreme_fear', emoji: '🍷', label: '파티가 텅 비었다 (극도의 공포)',
    advice: '아무도 주식 이야기를 하지 않습니다. 공포에 질린 시장 — 역발상 투자자에게는 절호의 매수 기회입니다.',
    lynchQuote: '"칵테일 파티에서 아무도 주식을 묻지 않을 때가 바닥이다." — 피터 린치',
  }
  if (score < 45) return {
    level: 'fear', emoji: '🥂', label: '파티가 한산하다 (공포)',
    advice: '주식은 위험하다는 분위기가 지배적입니다. 좋은 기업을 싸게 줍줍할 수 있는 구간입니다.',
    lynchQuote: '"사람들이 주식을 두려워할 때, 훌륭한 기업이 가장 싸진다." — 피터 린치',
  }
  if (score < 56) return {
    level: 'neutral', emoji: '🍸', label: '파티가 적당하다 (중립)',
    advice: '시장 분위기가 평범합니다. 과열도 공포도 아닌 균형 구간 — 본인의 투자 원칙을 묵묵히 지키세요.',
    lynchQuote: '"시장을 예측하려 하지 말고, 좋은 기업을 찾는 데 집중하라." — 피터 린치',
  }
  if (score < 76) return {
    level: 'greed', emoji: '🎉', label: '파티가 시끌벅적하다 (탐욕)',
    advice: '주변에서 수익률 자랑이 들리기 시작합니다. 들뜨지 말고 포트폴리오의 과열 종목을 점검할 때입니다.',
    lynchQuote: '"모두가 낙관적일 때가 가장 위험하다." — 피터 린치',
  }
  return {
    level: 'extreme_greed', emoji: '🚨', label: '파티 절정! 슬슬 나갈 때 (극도의 탐욕)',
    advice: '택시기사도, 옆자리 동료도 주식 전문가입니다. 모두가 탐욕에 빠졌을 때 — 수익을 확정하고 파티장을 빠져나오세요.',
    lynchQuote: '"택시 기사가 주식을 추천하면, 그때가 팔 때다." — 피터 린치',
  }
}

export async function GET() {
  if (CACHE.data && Date.now() < CACHE.expiresAt) {
    return NextResponse.json(CACHE.data, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    // CNN(메인) + VIX·S&P(폴백 겸 보조) + VIX 1년 추이 동시 조회
    const [cnn, vixMeta, spMeta, vixHistory] = await Promise.all([
      fetchCnnFearGreed(),
      fetchYahooMeta('^VIX'),
      fetchYahooMeta('^GSPC'),
      fetchVixHistory(),
    ])

    const vix = typeof vixMeta?.regularMarketPrice === 'number' ? vixMeta.regularMarketPrice : null
    const sp  = typeof spMeta?.regularMarketPrice === 'number' ? spMeta.regularMarketPrice : null
    const lo  = typeof spMeta?.fiftyTwoWeekLow === 'number' ? spMeta.fiftyTwoWeekLow : null
    const hi  = typeof spMeta?.fiftyTwoWeekHigh === 'number' ? spMeta.fiftyTwoWeekHigh : null

    const vixGreed = vix != null ? clamp(100 - (vix - 11) * (100 / 24), 0, 100) : 50
    const momentum = (sp != null && lo != null && hi != null && hi > lo)
      ? clamp(((sp - lo) / (hi - lo)) * 100, 0, 100) : 50

    // ★ CNN F&G 우선 (7지표 종합), 실패 시 VIX+모멘텀 자체계산
    const calculated = Math.round(vixGreed * 0.5 + momentum * 0.5)
    const partyScore = cnn ? cnn.score : calculated

    const result: CocktailPartyResult = {
      partyScore,
      source:     cnn ? 'cnn' : 'calculated',
      rating:     cnn?.rating ?? null,
      prevClose:  cnn?.prevClose ?? null,
      prev1Week:  cnn?.prev1Week ?? null,
      prev1Month: cnn?.prev1Month ?? null,
      vix, vixGreed: Math.round(vixGreed), vixHistory,
      sp500: sp, momentum: Math.round(momentum),
      status: getStatus(partyScore),
      asOf: new Date().toISOString(),
    }

    CACHE.data = result
    CACHE.expiresAt = Date.now() + CACHE_TTL
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })

  } catch (e) {
    if (CACHE.data) return NextResponse.json({ ...CACHE.data, source: 'fallback' as const })
    const neutral: CocktailPartyResult = {
      partyScore: 50, source: 'fallback', rating: null,
      prevClose: null, prev1Week: null, prev1Month: null,
      vix: null, vixGreed: 50, vixHistory: [], sp500: null, momentum: 50,
      status: getStatus(50), asOf: new Date().toISOString(),
    }
    console.warn('[cocktail-party]', (e as Error).message)
    return NextResponse.json(neutral)
  }
}
