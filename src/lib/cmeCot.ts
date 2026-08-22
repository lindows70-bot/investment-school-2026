// 🏛️ CME 비트코인 선물 기관 포지셔닝 SSOT — CFTC 주간 COT(Traders in Financial Futures).
//   우리 앱은 그동안 **글로벌 무기한 선물(바이낸스 등) 펀딩비·OI** 만 봤다 = 개인·글로벌 트레이더의 온도.
//   여기서 보는 건 **미국 규제권 안의 기관**(헤지펀드·자산운용사·딜러)이 어느 쪽에 서 있는가다. 축이 다르다.
//
//   ⚠️ 가장 중요한 해석 주의 — 레버리지드 펀드(헤지펀드)의 대규모 숏은 대부분 **베이시스 트레이드**다.
//      현물 ETF를 사고 CME 선물을 파는 무위험 차익거래의 '한 다리'이지 하락 베팅이 아니다.
//      이걸 방향성으로 읽으면 정반대 결론이 나온다(2026-08-22 영상 검증에서 실제로 그런 주장을 반증).
//   ⚠️ 지연 — 화요일 마감 → 금요일 공표. 3~4일 후행이라 실시간 신호가 아니다.
//   근거·판정표: docs/cme-cot/context-notes.md

const CFTC = 'https://publicreporting.cftc.gov/resource/gpe5-46if.json'
/** 계약명을 정확히 지정해야 한다 — BITCOIN 으로 like 검색하면 MICRO·CBOE·Coinbase Nano 7종이 섞이고,
 *  계약 크기가 달라(5 BTC vs 0.1 BTC) 계약수를 합치면 잘못된 합이 된다. */
const CONTRACT = 'BITCOIN - CHICAGO MERCANTILE EXCHANGE'

/** 방향 판정 창(주) — 주간 데이터라 1주 변동은 노이즈. 8주 ≈ 2개월. */
export const COT_WINDOW_W = 8

/** 캐시 키 SSOT — 라우트 파일은 임의 export 를 허용하지 않으므로(Next.js 타입 제약) 키는 lib 에 둔다. */
export const CME_COT_KEY = (dateKey: string) => `cme-cot-v1:${dateKey}`

export type CotTrend = 'more_long' | 'more_short' | 'flat'

export interface CotGroup {
  key: 'lev' | 'asset' | 'dealer'
  label: string
  /** 이 주체가 누구인지 — 학생용 한 줄 */
  who: string
  long: number
  short: number
  net: number
  /** 전체 미결제약정 대비 숏 비중(%) */
  shortPctOi: number | null
  /** 최근 8주 평균 vs 직전 8주 평균 */
  netRecent: number
  netPrior: number
  trend: CotTrend
  /** 부호가 실제로 바뀌었을 때만 true — 숏이 줄어든 것을 '롱 전환'이라 쓰면 오독이다 */
  flipped: boolean
}

export interface CmeCotResult {
  asOf: string
  /** COT 기준일(화요일 마감) */
  reportDate: string
  /** 기준일로부터 며칠 지났나 — 후행성을 화면에 밝히기 위함 */
  staleDays: number
  openInterest: number
  groups: CotGroup[]
  headline: string
  /** 학생용 해석 — 결정론 */
  reading: string
  /** 16주 시계열(차트) */
  series: { date: string; lev: number; asset: number; dealer: number; oi: number }[]
  caveats: string[]
}

const n = (v: unknown) => Number(v ?? 0)
const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0

export async function buildCmeCot(): Promise<CmeCotResult | null> {
  let rows: Record<string, unknown>[]
  try {
    const url = `${CFTC}?market_and_exchange_names=${encodeURIComponent(CONTRACT)}`
      + `&$order=report_date_as_yyyy_mm_dd DESC&$limit=40`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!r.ok) return null
    rows = await r.json()
  } catch { return null }
  if (!Array.isArray(rows) || rows.length < COT_WINDOW_W * 2) return null   // 부분실패면 섹션을 접는다

  // 오래된 → 최신 순
  const asc = rows.slice().sort((a, b) => String(a.report_date_as_yyyy_mm_dd) < String(b.report_date_as_yyyy_mm_dd) ? -1 : 1)
  const last = asc[asc.length - 1]
  const reportDate = String(last.report_date_as_yyyy_mm_dd ?? '').slice(0, 10)
  if (!reportDate) return null

  const netOf = (x: Record<string, unknown>, k: CotGroup['key']) =>
    k === 'lev' ? n(x.lev_money_positions_long) - n(x.lev_money_positions_short)
    : k === 'asset' ? n(x.asset_mgr_positions_long) - n(x.asset_mgr_positions_short)
    : n(x.dealer_positions_long_all) - n(x.dealer_positions_short_all)

  const META: { key: CotGroup['key']; label: string; who: string; longF: string; shortF: string; pctShortF: string }[] = [
    { key: 'lev', label: '헤지펀드', who: '레버리지드 펀드 — 빠르게 사고파는 투기적 자금. 다만 이 중 상당수는 차익거래용이다',
      longF: 'lev_money_positions_long', shortF: 'lev_money_positions_short', pctShortF: 'pct_of_oi_lev_money_short' },
    { key: 'asset', label: '자산운용사', who: '연기금·펀드 등 오래 들고 가는 돈. 방향성 판단이 가장 잘 드러나는 주체',
      longF: 'asset_mgr_positions_long', shortF: 'asset_mgr_positions_short', pctShortF: 'pct_of_oi_asset_mgr_short' },
    { key: 'dealer', label: '딜러·중개', who: '증권사·마켓메이커. 고객 주문을 받아주는 쪽이라 방향성보다 재고 성격이 강하다',
      longF: 'dealer_positions_long_all', shortF: 'dealer_positions_short_all', pctShortF: 'pct_of_oi_dealer_short_all' },
  ]

  const recentRows = asc.slice(-COT_WINDOW_W)
  const priorRows = asc.slice(-COT_WINDOW_W * 2, -COT_WINDOW_W)

  const groups: CotGroup[] = META.map(m => {
    const long = n(last[m.longF]), short = n(last[m.shortF])
    const net = long - short
    const netRecent = avg(recentRows.map(x => netOf(x, m.key)))
    const netPrior = avg(priorRows.map(x => netOf(x, m.key)))
    const diff = netRecent - netPrior
    // 변화가 미미하면 방향을 주장하지 않는다 — 직전 평균의 10% 또는 500계약 중 큰 쪽을 문턱으로
    const thr = Math.max(500, Math.abs(netPrior) * 0.1)
    const trend: CotTrend = diff > thr ? 'more_long' : diff < -thr ? 'more_short' : 'flat'
    const pv = last[m.pctShortF]
    return {
      key: m.key, label: m.label, who: m.who, long, short, net,
      shortPctOi: pv != null && isFinite(Number(pv)) ? Number(pv) : null,
      netRecent, netPrior, trend,
      // ⛔ 부호가 실제로 바뀔 때만 '전환' — 숏이 줄어든 것을 '롱 전환'이라 쓰면 오독이다
      flipped: (netPrior < 0 && netRecent > 0) || (netPrior > 0 && netRecent < 0),
    }
  })

  const lev = groups.find(g => g.key === 'lev')!
  const asset = groups.find(g => g.key === 'asset')!
  const staleDays = Math.round((Date.now() - new Date(reportDate + 'T00:00:00Z').getTime()) / 864e5)

  const dirWord = (g: CotGroup) => g.net > 0 ? '롱 우위' : g.net < 0 ? '숏 우위' : '중립'
  const headline = `🏛️ CME 기관 — 헤지펀드 ${dirWord(lev)} · 자산운용사 ${dirWord(asset)} (${reportDate} 기준)`

  // 해석 — 베이시스 트레이드 구분을 반드시 포함한다
  const parts: string[] = []
  if (lev.net < 0) {
    parts.push(`헤지펀드는 순 ${Math.abs(lev.net).toLocaleString()}계약 숏입니다. `
      + `다만 이 숏의 상당 부분은 **현물 ETF를 사고 선물을 파는 차익거래**의 한쪽 다리라서, `
      + `"기관이 하락에 걸었다"로 읽으면 안 됩니다.`)
  } else {
    parts.push(`헤지펀드가 순 ${lev.net.toLocaleString()}계약 롱입니다 — 차익거래용 숏이 걷힌 드문 상태입니다.`)
  }
  parts.push(asset.net > 0
    ? `방향성이 가장 잘 드러나는 자산운용사는 순 ${asset.net.toLocaleString()}계약 롱으로, 상승 쪽에 서 있습니다.`
    : `자산운용사마저 순 ${Math.abs(asset.net).toLocaleString()}계약 숏입니다 — 드문 신호입니다.`)
  const trendWord = (g: CotGroup) => g.trend === 'more_long' ? '롱 쪽으로 이동' : g.trend === 'more_short' ? '숏 쪽으로 이동' : '거의 변화 없음'
  parts.push(`최근 ${COT_WINDOW_W}주 평균을 직전 ${COT_WINDOW_W}주와 비교하면 헤지펀드는 ${trendWord(lev)}, 자산운용사는 ${trendWord(asset)}했습니다`
    + `${groups.some(g => g.flipped) ? ' — 부호가 실제로 뒤집힌 주체가 있습니다.' : ' (부호가 뒤집힌 주체는 없습니다).'}`)

  const series = asc.slice(-16).map(x => ({
    date: String(x.report_date_as_yyyy_mm_dd).slice(0, 10),
    lev: netOf(x, 'lev'), asset: netOf(x, 'asset'), dealer: netOf(x, 'dealer'),
    oi: n(x.open_interest_all),
  }))

  return {
    asOf: new Date().toISOString(),
    reportDate, staleDays,
    openInterest: n(last.open_interest_all),
    groups, headline, reading: parts.join(' '),
    series,
    caveats: [
      `CFTC 주간 보고서는 **화요일 장 마감 기준**이고 금요일에 공표됩니다 — 지금 보시는 값은 ${staleDays}일 전 상태이며 실시간 신호가 아닙니다.`,
      '헤지펀드의 숏 대부분은 **현물 ETF 매수 + 선물 매도**로 이자를 먹는 차익거래입니다. 숏 규모가 크다고 해서 기관이 하락에 베팅한다는 뜻이 아닙니다.',
      '이 표는 CME(미국 규제 거래소) 안의 기관만 봅니다. 바이낸스 등 글로벌 무기한 선물의 개인 레버리지는 위의 펀딩비·OI 레이더가 따로 봅니다 — 두 축은 서로 다른 사람들입니다.',
      '⛔ 매수·매도 지시가 아닙니다. 코인은 학생 권장 상한 5%를 지키세요.',
    ],
  }
}
