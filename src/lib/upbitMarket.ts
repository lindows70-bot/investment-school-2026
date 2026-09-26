// 업비트 원화 마켓 목록·시세 조회(인스턴스 메모리 캐시) — 종목 검색과 시장 탭 코인 특징종목이 같은 캐시를 쓴다
//   목록(market/all)은 6시간, 시세(ticker/all)는 60초 기억한다. 실패는 캐시하지 않는다(옛 목록이 있으면 그것을 돌려준다).
//   등락 기준: 업비트 signed_change_rate 는 전일 종가(UTC 0시 = KST 09:00) 대비다 — 한국 주식 '전일 대비'와 기준 시각이 다르다.
import { type Part, okPart, failPart, num } from './marketBoardShared'
import type { UpbitMarket } from './stockSearch'

export interface UpbitTicker {
  market: string
  trade_price: number
  signed_change_rate: number
  acc_trade_price_24h: number
  timestamp: number
}

let marketsCache: { at: number; list: UpbitMarket[] } | null = null
let tickersCache: { at: number; rows: UpbitTicker[] } | null = null

/** 원화·BTC·USDT 전 마켓 목록. 실패 시 옛 목록이 있으면 그것을, 없으면 null(= 조회 실패) */
export async function upbitMarkets(): Promise<UpbitMarket[] | null> {
  if (marketsCache && Date.now() - marketsCache.at < 6 * 3600_000) return marketsCache.list
  try {
    const r = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return marketsCache?.list ?? null
    const list = await r.json()
    if (!Array.isArray(list)) return marketsCache?.list ?? null
    marketsCache = { at: Date.now(), list: list as UpbitMarket[] }
    return marketsCache.list
  } catch {
    return marketsCache?.list ?? null
  }
}

/** 원화 마켓 전체 시세(60초 기억 — 성공한 응답만). 실패하면 null */
export async function upbitKrwTickers(): Promise<UpbitTicker[] | null> {
  if (tickersCache && Date.now() - tickersCache.at < 60_000) return tickersCache.rows
  try {
    const r = await fetch('https://api.upbit.com/v1/ticker/all?quote_currencies=KRW', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const data = await r.json()
    if (!Array.isArray(data)) return null
    const rows = (data as UpbitTicker[]).filter(d => typeof d?.market === 'string' && d.market.startsWith('KRW-'))
    tickersCache = { at: Date.now(), rows }
    return rows
  } catch {
    return null
  }
}

/** 심볼(KRW- 뗀 것) → 24시간 거래대금(원). 시세 조회 실패면 빈 표 — 검색 정렬만 약해진다 */
export async function upbitVolumes(): Promise<Record<string, number>> {
  const rows = await upbitKrwTickers()
  const volume: Record<string, number> = {}
  for (const d of rows ?? []) volume[d.market.slice(4)] = Number(d.acc_trade_price_24h) || 0
  return volume
}

// ── 코인 특징종목 ─────────────────────────────────────────────────────────
export interface CoinMover {
  symbol: string; name: string
  price: number | null
  changePct: number | null        // signed_change_rate × 100 (전일 09:00 KST 종가 대비)
  tradeValue24hEok: number | null // 24시간 거래대금(억원)
  asOf: string | null             // 원천 timestamp
}
export interface CoinBoard { up: CoinMover[]; down: CoinMover[]; tradeValue: CoinMover[]; scanned: number }

/** 시세 + 이름 → 상승·하락·거래대금 상위 limit */
export function buildCoinBoard(tickers: UpbitTicker[], markets: UpbitMarket[] | null, limit = 10): CoinBoard {
  const nameOf = new Map((markets ?? []).map(m => [m.market, m.korean_name]))
  const rows: CoinMover[] = tickers.map(t => {
    const rate = num(t.signed_change_rate)
    const tv = num(t.acc_trade_price_24h)
    const ts = num(t.timestamp)
    return {
      symbol: t.market.slice(4), name: nameOf.get(t.market) ?? t.market.slice(4),
      price: num(t.trade_price),
      changePct: rate != null ? Math.round(rate * 10000) / 100 : null,
      tradeValue24hEok: tv != null ? Math.round(tv / 1e8) : null,
      asOf: ts != null ? new Date(ts).toISOString() : null,
    }
  })
  const withRate = rows.filter(r => r.changePct != null)
  return {
    up: [...withRate].sort((a, b) => (b.changePct as number) - (a.changePct as number)).slice(0, limit),
    down: [...withRate].sort((a, b) => (a.changePct as number) - (b.changePct as number)).slice(0, limit),
    tradeValue: rows.filter(r => r.tradeValue24hEok != null).sort((a, b) => (b.tradeValue24hEok as number) - (a.tradeValue24hEok as number)).slice(0, limit),
    scanned: rows.length,
  }
}

const SRC = 'upbit ticker/all(KRW)'
export async function fetchCoinBoard(limit = 10): Promise<Part<CoinBoard>> {
  const [tickers, markets] = await Promise.all([upbitKrwTickers(), upbitMarkets()])
  if (!tickers || !tickers.length) return failPart('업비트 시세 조회 실패', SRC)
  const b = buildCoinBoard(tickers, markets, limit)
  const asOf = tickers.map(t => num(t.timestamp)).filter((x): x is number => x != null).sort((a, b) => b - a)[0]
  return okPart(b, asOf != null ? new Date(asOf).toISOString() : null, SRC)
}
