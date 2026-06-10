'use server'

/**
 * 🎧 Jarvis 노이즈 캔슬러 (Wall St. Noise Canceller) — 서버 액션 (비밀병기 7단계)
 *
 * 피터 린치: 목표가·등급은 소음, 실적(earnings)은 신호.
 *  → "승률 좋은 애널리스트만 듣자"(데이터 불가) 대신,
 *    목표가 소음을 끄고 '실적 추정치 리비전'이라는 진짜 신호만 증폭한다.
 *
 * 3개 신호 (Yahoo quoteSummary, 무료)
 *  ① 목표가 분산(노이즈 미터)  = (고가−저가)/평균. 클수록 "시장도 모른다 → 무시"
 *  ② EPS 추정치 리비전(핵심)   = 최근 30일 상향 vs 하향 애널리스트 수
 *  ③ 컨센서스 표류             = recommendationTrend 0m vs −3m 분포 변화
 *
 * Lazy Caching: in-memory 6h (추정치는 전환이 느림) · Zero Input · US 위주
 */

interface RecTrend { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }

export interface AnalystSignal {
  ticker: string
  verdict: 'signal' | 'noise' | 'trap' | 'neutral'
  source:   'yahoo' | 'naver' | null   // yahoo=US(전체신호) / naver=KR(컨센서스 축소판)
  currency: 'USD' | 'KRW'
  // KR(naver) 전용 — 리포트 활동
  reportCount: number | null
  brokers:     string[]
  // 목표가 노이즈
  current:    number | null
  targetMean: number | null
  targetHigh: number | null
  targetLow:  number | null
  dispersion: number | null     // %
  upside:     number | null      // % (현재가 대비 평균목표가)
  analysts:   number | null
  // EPS 리비전 (진짜 신호)
  revUp30:    number | null
  revDown30:  number | null
  revisionSignal: 'up' | 'down' | 'mixed' | null
  growth:     number | null      // 추정 성장률 %
  // 컨센서스 표류
  bullNow:    number | null      // (SB+B) 비율 % (현재)
  bull3mAgo:  number | null
  drift:      'improving' | 'worsening' | 'stable' | null
  recMean:    number | null      // 1=Strong Buy ~ 5=Sell
  lynchComment: string
  cached:  boolean
  status:  'ok' | 'unsupported' | 'none' | 'error'
  message?: string
  asOf:    string
}

// ── in-memory 캐시 (6h) ───────────────────────────────────────────────────────
const CACHE = new Map<string, { data: AnalystSignal; expiresAt: number }>()
const CACHE_TTL = 6 * 3600_000

const pct = (n: number) => Math.round(n * 10) / 10

function bullRatio(t?: RecTrend): number | null {
  if (!t) return null
  const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell
  if (total <= 0) return null
  return Math.round((t.strongBuy + t.buy) / total * 100)
}

// ── 린치 코멘트 (결정론적) ───────────────────────────────────────────────────
function buildComment(s: Omit<AnalystSignal, 'lynchComment' | 'cached' | 'status' | 'asOf'>): string {
  const up = s.revUp30 ?? 0, down = s.revDown30 ?? 0
  const disp = s.dispersion != null ? `${Math.round(s.dispersion)}%` : '—'
  switch (s.verdict) {
    case 'signal':
      return `월가가 조용히 한 방향으로 정렬되고 있어. 최근 30일 ${up}명이 EPS 전망을 올렸고 내린 건 ${down}명뿐이야. ` +
             `목표가 헤드라인이 아니라 바로 이 '실적 상향'이 진짜 신호야 — 린치가 늘 말한 "follow the earnings".`
    case 'noise':
      return `목표가가 $${s.targetLow ?? '?'}~$${s.targetHigh ?? '?'}로 ${disp}나 벌어져 있어. 애널리스트들끼리도 모른다는 뜻이지. ` +
             `이런 종목은 목표가 뉴스 한 줄에 흔들리지 말고, 네가 분석한 펀더멘탈을 믿어.`
    case 'trap':
      return `조심해. 목표가는 현재가보다 ${s.upside != null ? `+${Math.round(s.upside)}%` : ''} 높아 낙관적으로 보이지만, ` +
             `최근 30일 ${down}명이 오히려 EPS 전망을 깎았어(올린 건 ${up}명). 겉은 매수, 속은 후퇴 — 전형적인 함정이야.`
    default:
      return `특별히 정렬된 신호도, 심한 노이즈도 없어. 컨센서스는 무난하니 목표가보다 회사의 실제 실적 추세를 직접 챙기는 게 나아.`
  }
}

// ══ 한국 애널리스트 컨센서스 (네이버, 축소판) ═════════════════════════════════
// KR은 목표가 분산·EPS 리비전을 무료로 못 구함(PDF·미제공) → 컨센서스(목표가·의견)+리포트 활동으로 축소
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function naverJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' } })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

function krComment(upside: number | null, reportCount: number, verdict: AnalystSignal['verdict']): string {
  const up = upside != null ? `${upside >= 0 ? '+' : ''}${upside}%` : '—'
  if (verdict === 'signal')
    return `최근 증권사 리포트의 목표가 평균이 현재가보다 ${up} 높고 투자의견도 매수 우위야. 다만 린치의 충고 — 목표가는 자주 틀려. 이 낙관을 회사의 실제 실적이 뒷받침하는지 네가 직접 확인해.`
  if (verdict === 'noise')
    return `목표가 평균이 현재가에 거의 붙어있어(상승여력 ${up}). 애널리스트들이 이미 다 반영했다는 뜻 — 목표가만 보고 추격하는 건 위험해. 실적 모멘텀이 더 남았는지가 관건이야.`
  return `증권사 컨센서스는 상승여력 ${up} 수준으로 무난해(리포트 ${reportCount}건). 목표가·등급에 휘둘리지 말고, 회사가 실제로 돈을 더 잘 벌고 있는지(실적)를 직접 챙기는 게 린치식이야.`
}

async function krAnalyst(ticker: string, asOf: string): Promise<AnalystSignal> {
  const stock6 = ticker.replace(/\D/g, '').padStart(6, '0').slice(-6)
  const blank = {
    targetHigh: null, targetLow: null, dispersion: null, analysts: null,
    revUp30: null, revDown30: null, revisionSignal: null, growth: null,
    bullNow: null, bull3mAgo: null, drift: null,
  }
  const empty = (status: AnalystSignal['status'], message?: string): AnalystSignal => ({
    ticker, asOf, verdict: 'neutral', source: 'naver', currency: 'KRW', reportCount: null, brokers: [],
    current: null, targetMean: null, upside: null, recMean: null, ...blank,
    lynchComment: '', cached: false, status, message,
  })

  const intg = await naverJson(`https://m.stock.naver.com/api/stock/${stock6}/integration`)
  const c = intg?.consensusInfo
  const targetMean = c?.priceTargetMean ? parseInt(String(c.priceTargetMean).replace(/[^0-9]/g, ''), 10) : null
  if (!targetMean) return empty('none', '국내 애널리스트 커버리지가 거의 없는 종목입니다.')

  const recMean = c?.recommMean ? parseFloat(c.recommMean) : null   // KR: 높을수록 매수(1~5)
  let current: number | null = null
  const poll = await naverJson(`https://polling.finance.naver.com/api/realtime/domestic/stock/${stock6}`)
  const cp = poll?.datas?.[0]?.closePrice
  if (cp) current = parseInt(String(cp).replace(/[^0-9]/g, ''), 10) || null
  const upside = (current && targetMean) ? pct((targetMean - current) / current * 100) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const researches = (intg?.researches ?? []) as any[]
  const reportCount = researches.length
  const brokers = Array.from(new Set(researches.map(r => String(r.bnm || '')).filter(Boolean))).slice(0, 5)

  // 판정 (KR: 분산·리비전 없음 → 상승여력 + 투자의견 기반)
  let verdict: AnalystSignal['verdict'] = 'neutral'
  if (upside != null && upside >= 15 && (recMean ?? 0) >= 3.8) verdict = 'signal'
  else if (upside != null && upside < 3) verdict = 'noise'   // 목표가 거의 소진

  return {
    ticker, asOf, verdict, source: 'naver', currency: 'KRW', reportCount, brokers,
    current, targetMean, upside, recMean, ...blank,
    lynchComment: krComment(upside, reportCount, verdict),
    cached: false, status: 'ok',
  }
}

export async function getAnalystSignal(input: { ticker: string; name?: string; market: string }): Promise<AnalystSignal> {
  const ticker = input.ticker.trim().toUpperCase()
  const base = { ticker, asOf: new Date().toISOString() }
  const empty = (status: AnalystSignal['status'], message?: string, src: AnalystSignal['source'] = 'yahoo', cur: AnalystSignal['currency'] = 'USD'): AnalystSignal => ({
    ...base, verdict: 'neutral', source: src, currency: cur, reportCount: null, brokers: [],
    current: null, targetMean: null, targetHigh: null, targetLow: null, dispersion: null, upside: null, analysts: null,
    revUp30: null, revDown30: null, revisionSignal: null, growth: null,
    bullNow: null, bull3mAgo: null, drift: null, recMean: null,
    lynchComment: '', cached: false, status, message,
  })

  // ★ 개별 주식만 — ETF·코인·원자재 차단 (백스톱)
  const { getAssetType } = await import('@/lib/assetClassifier')
  if (getAssetType(ticker, input.name ?? '', input.market) !== 'STOCK') {
    return empty('unsupported', '개별 주식만 지원합니다 (ETF·코인·원자재 제외).')
  }

  // 캐시 (US·KR 공통)
  const hit = CACHE.get(ticker)
  if (hit && Date.now() < hit.expiresAt) return { ...hit.data, cached: true }

  // ★ 한국 종목 → 네이버 컨센서스(축소판: 목표가·투자의견·리포트 활동)
  if (input.market === 'KR') {
    const kr = await krAnalyst(ticker, base.asOf)
    if (kr.status === 'ok' || kr.status === 'none') CACHE.set(ticker, { data: kr, expiresAt: Date.now() + CACHE_TTL })
    return kr
  }
  if (input.market && input.market !== 'US') {
    return empty('unsupported', '애널리스트 분석은 미국·한국 상장 종목만 지원합니다.')
  }

  try {
    const { default: YahooFinance } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = await yf.quoteSummary(ticker, { modules: ['financialData', 'recommendationTrend', 'earningsTrend'] })

    const fd = s?.financialData ?? {}
    const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null
    const current    = num(fd.currentPrice)
    const targetMean = num(fd.targetMeanPrice)
    const targetHigh = num(fd.targetHighPrice)
    const targetLow  = num(fd.targetLowPrice)
    const analysts   = num(fd.numberOfAnalystOpinions)
    const recMean    = num(fd.recommendationMean)

    // 데이터 거의 없음 → none
    if (targetMean == null && analysts == null) {
      const none = empty('none', '이 종목은 애널리스트 커버리지가 거의 없습니다.')
      CACHE.set(ticker, { data: none, expiresAt: Date.now() + CACHE_TTL })
      return none
    }

    const dispersion = (targetHigh != null && targetLow != null && targetMean)
      ? pct((targetHigh - targetLow) / targetMean * 100) : null
    const upside = (current && targetMean) ? pct((targetMean - current) / current * 100) : null

    // ② EPS 리비전 (올해 0y)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const et = (s?.earningsTrend?.trend ?? []) as any[]
    const yr = et.find(t => t.period === '0y') ?? et.find(t => t.period === '+1y')
    const rev = yr?.epsRevisions ?? {}
    const revUp30   = num(rev.upLast30days)
    const revDown30 = num(rev.downLast30days)
    const growth    = yr?.growth != null && isFinite(yr.growth) ? pct(yr.growth * 100) : null

    let revisionSignal: AnalystSignal['revisionSignal'] = null
    if (revUp30 != null && revDown30 != null) {
      if (revUp30 >= revDown30 * 2 && revUp30 >= 3) revisionSignal = 'up'
      else if (revDown30 >= revUp30 * 2 && revDown30 >= 3) revisionSignal = 'down'
      else revisionSignal = 'mixed'
    }

    // ③ 컨센서스 표류
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = (s?.recommendationTrend?.trend ?? []) as RecTrend[]
    const bullNow   = bullRatio(rt.find(t => t.period === '0m') ?? rt[0])
    const bull3mAgo = bullRatio(rt.find(t => t.period === '-3m') ?? rt[rt.length - 1])
    let drift: AnalystSignal['drift'] = null
    if (bullNow != null && bull3mAgo != null) {
      drift = bullNow - bull3mAgo > 3 ? 'improving' : bull3mAgo - bullNow > 3 ? 'worsening' : 'stable'
    }

    // 종합 판정 (EPS 리비전=진짜 신호 우선, 분산은 노이즈 미터로 별도 표시)
    let verdict: AnalystSignal['verdict'] = 'neutral'
    if (revisionSignal === 'down' && (upside ?? 0) > 5) verdict = 'trap'      // 목표가 낙관 + 실적전망 하향 = 함정
    else if (revisionSignal === 'up') verdict = 'signal'                      // 실적전망 상향 = 진짜 신호
    else if ((dispersion ?? 0) >= 80) verdict = 'noise'                      // 신호 없음 + 의견 제각각 = 순수 노이즈

    const core = {
      ...base, verdict, source: 'yahoo' as const, currency: 'USD' as const, reportCount: null, brokers: [] as string[],
      current, targetMean, targetHigh, targetLow, dispersion, upside, analysts,
      revUp30, revDown30, revisionSignal, growth,
      bullNow, bull3mAgo, drift, recMean,
    }
    const result: AnalystSignal = { ...core, lynchComment: buildComment(core), cached: false, status: 'ok' }
    CACHE.set(ticker, { data: result, expiresAt: Date.now() + CACHE_TTL })
    return result

  } catch (e) {
    console.warn('[analyst-signal]', (e as Error).message)
    return empty('error', '애널리스트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}
