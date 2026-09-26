// 스쿨 리그 학생별 상위 3종목 비중·구성(국가×자산 종류)을 평가액에서 계산하는 순수 함수 — 금액은 내보내지 않는다
//
// ◆ 입력 = 보유 행(평가액은 원화 환산 · 시세 없으면 매수원가로 대신한 값) · 출력 = 비중(%)만
// ◆ 국가 = flagOf(market, ticker) — origin 은 넘기지 않는다(investments 테이블에 origin 이 없다).
//   그래서 **상장 국가** 기준이다: TIGER 미국S&P500(담은 건 미국 기업 94.7%)은 '한국 상장 ETF' 로 센다.
//   라벨도 그래서 ETF 는 '○○ 상장 ETF' 다 — 담은 자산의 국적을 주장하지 않는다.
//   담은 자산의 실질 국가(ETF 투시)는 etfLookThrough 의 몫이고, 여기서 추정해 바꾸지 않는다.
// ◆ 자산 종류 = getAssetType(ticker, name, market) SSOT

import { getAssetType, type AssetType } from '@/lib/assetClassifier'
import { flagOf } from '@/lib/marketFlag'

export interface LeagueHoldingRow {
  ticker: string
  name:   string
  market: string | null
  /** 원화 환산 평가액(시세 없으면 매수원가) — 비중 계산에만 쓰고 밖으로 내보내지 않는다 */
  value:  number
  /** 현재가를 받았는가(false = 매수원가로 대신함) */
  priced: boolean
}

export type LeagueMarket = 'KR' | 'US' | 'CRYPTO'

export interface LeagueTopHolding {
  name:      string
  ticker:    string
  market:    LeagueMarket
  assetType: AssetType
  weightPct: number
  priced:    boolean
}

export interface LeagueMixSlice {
  key:       string
  label:     string
  weightPct: number
}

export interface LeagueMixResult {
  topHoldings: LeagueTopHolding[]
  otherPct:    number
  otherCount:  number
  mix:         LeagueMixSlice[]
  pricedAll:   boolean
}

const round1 = (v: number) => Math.round(v * 10) / 10

function normMarket(m: string | null): LeagueMarket {
  const u = (m ?? 'KR').toUpperCase()
  return u === 'US' || u === 'CRYPTO' ? u : 'KR'
}

/** 국가 × 자산 종류 → 묶음 키·라벨. 코인·원자재는 국가를 가르지 않는다. */
function mixBucket(ticker: string, name: string, market: LeagueMarket, assetType: AssetType): { key: string; label: string } {
  if (assetType === 'CRYPTO')    return { key: 'CRYPTO', label: '코인' }
  if (assetType === 'COMMODITY') return { key: 'COMMODITY', label: '원자재' }
  const flag    = flagOf(market, ticker)
  const country = flag === '🇰🇷' ? 'KR' : flag === '🇺🇸' ? 'US' : 'OTHER'
  const cLabel  = country === 'KR' ? '한국' : country === 'US' ? '미국' : '기타 국가'
  // ETF 는 '상장 시장'으로만 이름 붙인다 — '한국 ETF'라 쓰면 담은 자산이 한국 것처럼 읽힌다(상장 시장 ≠ 자산의 국적)
  const tLabel  = assetType === 'ETF' ? '상장 ETF' : '주식'
  return { key: `${country}_${assetType}`, label: `${cLabel} ${tLabel}` }
}

export function buildLeagueMix(rows: LeagueHoldingRow[]): LeagueMixResult {
  const pricedAll = rows.every(r => r.priced)

  // 1) 티커(대문자)로 합친다 — 분할매수로 같은 종목이 여러 행이면 한 종목이다
  const merged = new Map<string, { ticker: string; name: string; market: LeagueMarket; value: number; priced: boolean }>()
  for (const r of rows) {
    const key = (r.ticker ?? '').trim().toUpperCase()
    if (!key) continue
    const v = Number.isFinite(r.value) && r.value > 0 ? r.value : 0
    const cur = merged.get(key)
    if (cur) {
      cur.value += v
      cur.priced = cur.priced && r.priced
    } else {
      merged.set(key, { ticker: key, name: r.name || key, market: normMarket(r.market), value: v, priced: r.priced })
    }
  }

  // 평가액 0 인 종목은 비중이 없으므로 뺀다
  const holdings = Array.from(merged.values()).filter(h => h.value > 0)
  const total = holdings.reduce((s, h) => s + h.value, 0)
  if (!(total > 0)) return { topHoldings: [], otherPct: 0, otherCount: 0, mix: [], pricedAll }

  holdings.sort((a, b) => b.value - a.value)

  // 2) 상위 3 + 기타
  const withType = holdings.map(h => ({ ...h, assetType: getAssetType(h.ticker, h.name, h.market) }))
  const topHoldings: LeagueTopHolding[] = withType.slice(0, 3).map(h => ({
    name:      h.name,
    ticker:    h.ticker,
    market:    h.market,
    assetType: h.assetType,
    weightPct: round1(h.value / total * 100),
    priced:    h.priced,
  }))
  const otherCount = withType.length - topHoldings.length
  const topSum = topHoldings.reduce((s, h) => s + h.weightPct, 0)
  const otherPct = otherCount > 0 ? Math.max(0, round1(100 - topSum)) : 0

  // 3) 국가 × 자산 종류 묶음 — 포트폴리오 전체 기준, 상위 3
  const buckets = new Map<string, { label: string; value: number }>()
  for (const h of withType) {
    const b = mixBucket(h.ticker, h.name, h.market, h.assetType)
    const cur = buckets.get(b.key)
    if (cur) cur.value += h.value
    else buckets.set(b.key, { label: b.label, value: h.value })
  }
  const mix: LeagueMixSlice[] = Array.from(buckets.entries())
    .map(([key, b]) => ({ key, label: b.label, value: b.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(b => ({ key: b.key, label: b.label, weightPct: round1(b.value / total * 100) }))

  return { topHoldings, otherPct, otherCount, mix, pricedAll }
}
