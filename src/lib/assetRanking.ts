// 🏆 전세계 자산 시가총액 순위 SSOT — "비트코인이 어디쯤 서 있나"를 절대 크기로 보여준다.
//   ⚠️ 값은 전부 실시간 계산이다(제1원칙) — 시총 숫자를 표에 박지 않는다.
//      주식 = Yahoo quoteSummary marketCap · 코인 = 가격 × 유통량 · 금·은 = 가격 × 지상 재고
//   ⚠️ 금·은의 '지상 재고'만 정적 참조다. 이건 시장 데이터가 아니라 채굴 누적량 추정치이고
//      연 1~2% 씩만 늘어 API 가 따로 없다. 출처와 기준연도를 화면에 반드시 밝힌다.

/** 지상 재고(톤) — 정적 참조. 출처: World Gold Council / The Silver Institute 연차 추정.
 *  ⛔ 이 둘은 '가격'이 아니라 '수량'이라 하드코딩이 허용되는 참조 데이터다(FRED 폴백과 같은 성격). */
export const BULLION_STOCK = {
  gold: { tonnes: 216_265, label: '금', source: 'World Gold Council 지상 재고 추정', asOfYear: 2024 },
  silver: { tonnes: 1_800_000, label: '은', source: 'The Silver Institute 지상 재고 추정', asOfYear: 2024 },
}
const TROY_OZ_PER_TONNE = 32_150.7

/** 캐시 키 SSOT — 라우트는 임의 export 를 허용하지 않으므로 lib 에 둔다 */
export const ASSET_RANK_KEY = (hourKey: string) => `asset-rank-v1:${hourKey}`

export interface RankedAsset {
  key: string
  name: string
  kind: 'metal' | 'crypto' | 'stock'
  /** 시가총액(USD) */
  cap: number
  /** 단가(주가·온스당·코인당) */
  price: number | null
  /** 비트코인 대비 배수 — 학생이 "몇 배 크냐"를 바로 읽게 */
  vsBtc: number | null
  note: string
}

export interface AssetRankingResult {
  asOf: string
  assets: RankedAsset[]
  btcCap: number | null
  btcRank: number | null
  /** 비트코인이 금의 몇 %인가 */
  btcVsGoldPct: number | null
  notes: string[]
}

const UA = { 'User-Agent': 'Mozilla/5.0' }

async function yahooPrice(sym: string): Promise<number | null> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`,
      { headers: UA, signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return null
    const m = (await r.json())?.chart?.result?.[0]?.meta
    const p = m?.regularMarketPrice
    return typeof p === 'number' && p > 0 ? p : null
  } catch { return null }
}

/** 주식 시총 — chart meta 에는 marketCap 이 없다(실측 확인). quoteSummary 를 써야 한다. */
async function stockCap(sym: string): Promise<{ cap: number | null; price: number | null }> {
  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
    const q = await yf.quoteSummary(sym, { modules: ['price'] })
    const pr = q?.price ?? {}
    const raw = (v: unknown) => v != null && typeof v === 'object' && 'raw' in (v as object) ? (v as { raw: number }).raw : v
    const cap = Number(raw(pr.marketCap))
    const price = Number(raw(pr.regularMarketPrice))
    return { cap: isFinite(cap) && cap > 0 ? cap : null, price: isFinite(price) && price > 0 ? price : null }
  } catch { return { cap: null, price: null } }
}

async function btcSupply(): Promise<number | null> {
  try {
    const r = await fetch('https://blockchain.info/q/totalbc', { headers: UA, signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return null
    const v = Number(await r.text()) / 1e8
    // 상식 검산 — 비트코인 유통량은 2,100만을 넘을 수 없다
    return isFinite(v) && v > 10e6 && v <= 21e6 ? v : null
  } catch { return null }
}

/** 비교 대상 — 스크린샷의 순위표를 재현하되, 목록은 고정하고 **값은 전부 실시간**으로 받는다 */
const STOCKS: { sym: string; name: string }[] = [
  { sym: 'NVDA', name: '엔비디아' },
  { sym: 'MSFT', name: '마이크로소프트' },
  { sym: 'AAPL', name: '애플' },
  { sym: 'AMZN', name: '아마존' },
  { sym: 'GOOGL', name: '알파벳(구글)' },
  { sym: 'META', name: '메타' },
  { sym: '2222.SR', name: '사우디 아람코' },
]

export async function buildAssetRanking(): Promise<AssetRankingResult | null> {
  const [gold, silver, btcPrice, supply, ...caps] = await Promise.all([
    yahooPrice('GC=F'), yahooPrice('SI=F'), yahooPrice('BTC-USD'), btcSupply(),
    ...STOCKS.map(s => stockCap(s.sym)),
  ])
  const assets: RankedAsset[] = []

  const bullion = (p: number | null, k: keyof typeof BULLION_STOCK) => {
    if (p == null) return
    const meta = BULLION_STOCK[k]
    assets.push({
      key: k, name: meta.label, kind: 'metal',
      cap: p * meta.tonnes * TROY_OZ_PER_TONNE, price: p,
      vsBtc: null,
      note: `온스당 $${Math.round(p).toLocaleString()} × 지상 재고 ${meta.tonnes.toLocaleString()}톤 (${meta.source}, ${meta.asOfYear})`,
    })
  }
  bullion(gold, 'gold')
  bullion(silver, 'silver')

  let btcCap: number | null = null
  if (btcPrice != null && supply != null) {
    btcCap = btcPrice * supply
    assets.push({
      key: 'btc', name: '비트코인', kind: 'crypto', cap: btcCap, price: btcPrice, vsBtc: 1,
      note: `$${Math.round(btcPrice).toLocaleString()} × 유통량 ${Math.round(supply).toLocaleString()} BTC`,
    })
  }

  caps.forEach((c, i) => {
    if (c.cap == null) return
    assets.push({
      key: STOCKS[i].sym, name: STOCKS[i].name, kind: 'stock', cap: c.cap, price: c.price, vsBtc: null,
      note: c.price != null ? `주가 $${c.price.toFixed(2)} 기준 시가총액` : '시가총액',
    })
  })

  if (assets.length < 5) return null   // 부분실패면 섹션을 접는다(반쪽 순위표는 오히려 오해를 만든다)
  assets.sort((a, b) => b.cap - a.cap)
  for (const a of assets) a.vsBtc = btcCap ? Math.round((a.cap / btcCap) * 100) / 100 : null

  const btcRank = btcCap ? assets.findIndex(a => a.key === 'btc') + 1 : null
  const goldCap = assets.find(a => a.key === 'gold')?.cap ?? null

  return {
    asOf: new Date().toISOString(),
    assets, btcCap, btcRank,
    btcVsGoldPct: btcCap && goldCap ? Math.round((btcCap / goldCap) * 1000) / 10 : null,
    notes: [
      '주식 시가총액과 코인·금속 가격은 **조회 시점의 실시간 값**입니다 — 순위는 매일 바뀝니다.',
      `금·은은 **가격 × 지상 재고**로 계산합니다. 재고량(금 ${BULLION_STOCK.gold.tonnes.toLocaleString()}톤·은 ${BULLION_STOCK.silver.tonnes.toLocaleString()}톤)은 시장 데이터가 아니라 ${BULLION_STOCK.gold.asOfYear}년 기준 업계 추정치라, 기관마다 조금씩 다릅니다.`,
      '금은 수천 년간 쌓인 재고 전체를 세고, 주식은 상장 주식만 셉니다 — **같은 잣대가 아닙니다.** 크기 감각을 잡는 용도로만 보세요.',
      '⛔ 순위가 높다고 좋은 자산이 아닙니다. 매수 권유가 아니며, 코인은 학생 권장 상한 5%를 지키세요.',
    ],
  }
}
