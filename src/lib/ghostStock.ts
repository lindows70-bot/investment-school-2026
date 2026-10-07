// 유령 종목(커버리지·내부자·기관 3축) 계산과 미보유 발굴 캐시 — 라우트(/api/lynch/ghost-stock)와 매일 워밍 크론이 함께 쓴다
//   2026-10-07: 라우트 파일 안에만 있어 크론이 재사용할 수 없었다(라우트는 임의 export 금지) — 내용은 옮기기만 했다.
import { getCache, setCache }         from '@/lib/appCache'
import { SAT_SCORE_KEY, type SatelliteScore } from '@/lib/satelliteScreener'
import { getInsiderSignal }           from '@/app/actions/getInsiderSignal'
import { getAnalystSignal }           from '@/app/actions/getAnalystSignal'

// ── 타입 정의 ────────────────────────────────────────────────
export interface GhostCacheRow {
  ticker:                  string
  company_name:            string
  lynch_type:              string
  market:                  string
  analyst_count:           number
  analyst_change:          number
  inst_ownership:          number
  insider_buy_count:       number
  insider_sell_count:      number
  insider_buy_amt:         string
  insider_sell_amt:        string
  last_activity:           string
  last_activity_days:      number
  ghost_score:             number
  ghost_grade:             string
  lynch_verdict:           string
  analyst_comment:         string
  insider_comment:         string
  updated_at:              string
}

// ── 유령 스코어 계산 (0~100) ─────────────────────────────────
function calcGhostScore(
  analystCount:  number,
  insiderBuys:   number,
  insiderSells:  number,
  instOwnership: number | null,   // null = 데이터 없음(KR) → 중립 배점
): number {
  // 기관 커버리지 (40pt): 낮을수록 고득점
  const coverScore =
    analystCount <= 3  ? 40 :
    analystCount <= 7  ? 35 :
    analystCount <= 15 ? 22 :
    analystCount <= 25 ? 12 : 4

  // 내부자 순매수 (40pt)
  const net = insiderBuys - insiderSells
  const insiderScore =
    net >= 4  ? 40 :
    net >= 2  ? 30 :
    net >= 1  ? 20 :
    net === 0 ? 10 : 0

  // 기관 보유 비중 (20pt): 낮을수록 대규모 유입 여지 — 미확인(KR)은 중립 7pt
  const instScore =
    instOwnership == null ? 7 :
    instOwnership < 25 ? 20 :
    instOwnership < 50 ? 14 :
    instOwnership < 75 ? 7  : 2

  return Math.min(100, coverScore + insiderScore + instScore)
}

// ── 유령 등급 계산 ────────────────────────────────────────────
function calcGhostGrade(
  analystCount: number,
  insiderBuys:  number,
  insiderSells: number,
): string {
  const net = insiderBuys - insiderSells
  if (analystCount <= 5  && net > 0)  return 'diamond'
  if (analystCount <= 10 && net >= 0) return 'pearl'
  if (analystCount <= 20)             return 'radar'
  if (analystCount <= 35)             return 'hotspot'
  return 'crowded'
}

// ── 린치 버딕트 자동 생성 ─────────────────────────────────────
//    ⚠️ 2026-08-01 재작성: ① 진주 등급은 내부자 0건도 가능한데 옛 문구가 "내부자 매수 신호가 잡힙니다·선점하세요"라고
//    거짓+매수 권유(원익IPS 화면검증 발견) ② KR은 '건(리포트)'인데 '명' 단위 ③ net 3 '강한 매수' 배지와 "소규모 매수" 톤 충돌.
//    원칙: 사실만 서술 · 매수 지시 금지(조사 권유까지만).
function generateLynchVerdict(
  grade:        string,
  ticker:       string,
  analystCount: number,
  insiderNet:   number,
  isKr:         boolean,
): string {
  const cov = isKr ? `리포트 ${analystCount}건` : `애널리스트 ${analystCount}명`
  const insiderTone =
    insiderNet >= 2 ? '서로 다른 내부자가 자기 돈으로 사고 있습니다(고확신 신호)'
    : insiderNet >= 1 ? '내부자 소규모 매수가 있습니다'
    : '내부자 매수는 아직 없습니다'
  if (grade === 'diamond') {
    return `"시장의 사각지대(${cov})인데 ${insiderTone}. 린치가 평생 찾던 조합입니다 — 단, 여기서부터가 시작입니다. 재무·이익을 직접 조사하세요."`
  }
  if (grade === 'pearl') {
    return insiderNet > 0
      ? `"소형 커버리지(${cov})에 내부자 매수까지 — 린치식 초기 발굴 신호입니다. 소문이 아니라 숫자(이익·재무)로 직접 확인할 가치가 있습니다."`
      : `"소형 커버리지(${cov}) — 시장이 아직 주목하지 않는 구간입니다. 내부자 매수는 아직 없으니 '발굴 후보'로 관찰하며 이익·재무부터 직접 조사하세요."`
  }
  if (grade === 'radar') {
    return `"중간 커버리지(${cov}) 구간입니다. ${insiderNet >= 2 ? '내부자 클러스터 매수가 붙어 주목할 만하지만' : insiderNet > 0 ? '내부자 소규모 매수가 있지만' : '내부자 동향은 중립이라'} 소외 프리미엄은 크지 않습니다 — 판단은 펀더멘탈로."`
  }
  if (grade === 'hotspot') {
    return `"${cov}이 주목하는 인기 종목입니다. 린치가 좋아하는 소외 구간과는 거리가 있습니다 — 나쁜 회사라는 뜻이 아니라, '남보다 먼저'의 이점이 없다는 뜻입니다."`
  }
  return `"${ticker}는 월가의 총아입니다. ${cov}이 샅샅이 들여다보니 개인의 정보 이점은 없습니다 — 품질 판단은 종합 매수 판정(6축)의 몫입니다."`
}

// ══════════════════════════════════════════════════════════════
// 기관 커버리지 이원화 아키텍처
//   KR 주식 → 네이버 컨센서스 크롤링 + 한국 대형주 정확값 테이블
//   US 주식 → FMP / Yahoo Finance numberOfAnalystOpinions
// ══════════════════════════════════════════════════════════════

/** 티커가 한국 주식인지 판별 (6자리 숫자 or .KS/.KQ 접미사) */
function isKoreanTicker(ticker: string): boolean {
  return /^\d{6}$/.test(ticker) || /\.(KS|KQ)$/i.test(ticker)
}

// ────────────────────────────────────────────────────────────
// 커버리지 — 실데이터 SSOT (2026-07-30: 하드코딩 테이블·숫자합 추정 전량 제거)
//   US: Yahoo financialData.numberOfAnalystOpinions + heldPercentInstitutions
//   KR: getAnalystSignal 네이버 리포트 건수(최근 3개월) — 텐배거 언더커버리지와 동일 관례
//   실패 시 throw → Promise.allSettled가 그 종목을 정직 생략(가짜 행 금지)
// ────────────────────────────────────────────────────────────
async function fetchAnalystCoverage(
  ticker: string,
  market: string,
): Promise<{ count: number; change: number; instOwnership: number | null }> {
  const isKr = market === 'KR' || isKoreanTicker(ticker)

  if (isKr) {
    const code = ticker.replace(/\.(KS|KQ)$/i, '')
    const sig  = await getAnalystSignal({ ticker: code, market: 'KR' })
    // reportCount 0 = 최근 3개월 리포트 없음(진짜 소외) — 실데이터. null만 실패로 간주
    if (typeof sig?.reportCount !== 'number') throw new Error(`KR coverage unavailable: ${ticker}`)
    // KR 기관 보유율은 무료 소스 부재 → null(중립 배점·코멘트 생략)
    return { count: sig.reportCount, change: 0, instOwnership: null }
  }

  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  const qs = await yf.quoteSummary(ticker, { modules: ['financialData', 'defaultKeyStatistics'] })
  const n    = qs?.financialData?.numberOfAnalystOpinions
  const held = qs?.defaultKeyStatistics?.heldPercentInstitutions
  if (typeof n !== 'number') throw new Error(`US coverage unavailable: ${ticker}`)
  return {
    count:         n,
    change:        0,   // 전분기 대비 증감은 무료 시계열 부재 — 0(무표시)로 정직 처리
    instOwnership: typeof held === 'number' ? Math.round(held * 100) : null,
  }
}

// ────────────────────────────────────────────────────────────
// 내부자 거래 — getInsiderSignal SSOT (US=SEC EDGAR Form4 코드 P / KR=DART 장내매수)
//   ⚠️ 장내매수만 추적(매도·보상성 지급 미포함) — sellCount는 0 고정, 코멘트에 명시
// ────────────────────────────────────────────────────────────
async function fetchInsiderTrading(
  ticker: string,
  market: string,
): Promise<{
  buyCount:         number
  sellCount:        number
  buyAmt:           string
  sellAmt:          string
  lastActivity:     string
  lastActivityDays: number
  cluster:          boolean
}> {
  const sig = await getInsiderSignal({ ticker, market })

  if (sig.status === 'error') {
    return {
      buyCount: 0, sellCount: 0, buyAmt: '—', sellAmt: '—',
      lastActivity: '내부자 데이터 일시 미확인', lastActivityDays: 0, cluster: false,
    }
  }

  const buys     = sig.buys ?? []
  const buyCount = buys.length
  const fmtAmt = (v: number) =>
    sig.currency === 'KRW'
      ? (v >= 1e8 ? `₩${(v / 1e8).toFixed(1)}억` : `₩${Math.round(v / 1e4).toLocaleString()}만`)
      : `$${(v / 1e6).toFixed(1)}M`

  let lastActivity = '최근 90일 임원 장내매수 없음'
  let lastDays = 0
  if (buyCount > 0) {
    const dates  = buys.map(b => b.date).filter(Boolean).sort()
    const latest = dates[dates.length - 1]
    lastDays = Math.max(0, Math.round((Date.now() - new Date(latest).getTime()) / 86400000))
    lastActivity = `임원 ${sig.buyerCount}명 장내매수 ${buyCount}건${sig.cluster ? ' (클러스터·고확신)' : ''}`
  }

  return {
    buyCount,
    sellCount: 0,                                          // 매도 미추적(장내매수 전용 SSOT)
    buyAmt:    buyCount > 0 ? fmtAmt(sig.totalValue) : (sig.currency === 'KRW' ? '₩0' : '$0'),
    sellAmt:   '—',
    lastActivity,
    lastActivityDays: lastDays,
    cluster: sig.cluster,
  }
}

// ── 단일 종목 Ghost 데이터 빌드 (API 호출 + 계산) ───────────
export async function buildGhostRecord(
  ticker:    string,
  name:      string,
  market:    string,
  lynchType: string,
): Promise<Omit<GhostCacheRow, 'updated_at'>> {
  const [coverage, insider] = await Promise.all([
    fetchAnalystCoverage(ticker, market),
    fetchInsiderTrading(ticker, market),
  ])

  const score = calcGhostScore(
    coverage.count, insider.buyCount, insider.sellCount, coverage.instOwnership,
  )
  const grade = calcGhostGrade(coverage.count, insider.buyCount, insider.sellCount)
  const net   = insider.buyCount - insider.sellCount

  const isKr = market === 'KR' || isKoreanTicker(ticker)
  const unit = isKr ? '건의 증권사 리포트(최근 3개월)' : '명의 애널리스트'
  const instTail = coverage.instOwnership != null ? ` 기관 비중 ${coverage.instOwnership.toFixed(0)}%.` : ''
  const analystComment =
    coverage.count <= 5
      ? `${coverage.count}${unit} — 시장의 사각지대.${instTail || ' 기관 유입 전 초기 구간일 수 있습니다.'}`
      : coverage.count <= 10
        ? `${coverage.count}${unit} — 아직 발굴 초기 단계.${instTail}`
        : `${coverage.count}${unit} — 이미 시장의 레이더 안에 있습니다.${instTail}`

  const insiderComment =
    net > 0
      ? `최근 90일 공시 기준 임원 장내매수 ${insider.buyCount}건(${insider.buyAmt})${insider.cluster ? ' — 서로 다른 내부자 2명 이상 매수(고확신)' : ''}. ※ 장내매수만 집계(매도·보상성 지급 미포함).`
      : `최근 90일 임원 장내매수 공시 없음(EDGAR·DART 기준). ※ 매도는 미추적.`

  return {
    ticker,
    company_name:       name,
    lynch_type:         lynchType || '미분류',
    market,
    analyst_count:      coverage.count,
    analyst_change:     coverage.change,
    inst_ownership:     coverage.instOwnership ?? -1,   // -1 = 미확인(KR) — 패널이 '—' 처리
    insider_buy_count:  insider.buyCount,
    insider_sell_count: insider.sellCount,
    insider_buy_amt:    insider.buyAmt,
    insider_sell_amt:   insider.sellAmt,
    last_activity:      insider.lastActivity,
    last_activity_days: insider.lastActivityDays,
    ghost_score:        score,
    ghost_grade:        grade,
    lynch_verdict:      generateLynchVerdict(grade, ticker, coverage.count, net, isKr),
    analyst_comment:    analystComment,
    insider_comment:    insiderComment,
  }
}

// ── 🔍 미보유 유령 발굴 — 위성 풀(중소형 100종·매일 크론 채점) 상위에서 유령 3축 스캔 ──────────
//    린치 유령 철학("기관이 발견하기 전에")의 발굴판 — 보유 점검만으론 반쪽(2026-08-01 사용자 지적).
//    유니버스 기반이라 **전 학생 공유 일일 캐시**(개인 데이터 없음). 서빙 시 각자 보유분만 제외.
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

/** 매일 워밍 크론(/api/cron/ghost-warm) 실행 마커 — 크론 상태판이 이 일자 키로 실행 여부를 본다 */
export const GHOST_WARM_MARK = (d: string) => `ghost-warm-run-v1:${d}`

// ── 보유 종목 행 캐시 — app_cache 종목별(날짜 없는 키 + 오늘(KST)만) ──────────
//   2026-10-07: 예전엔 `ghost_stock_cache` 테이블에 읽고 썼는데 **그 테이블이 DB 에 없었다**(오류를 안 봐서 매번 조용히 MISS →
//   열 때마다 전 종목을 새로 계산). 다른 종목별 캐시와 같은 app_cache 로 옮긴다(테이블 추가 없이 · 정리 규칙 PER_TICKER).
const GHOST_ROW_KEY = (ticker: string) => `ghost-row-v1:${ticker.toUpperCase()}`

export async function readGhostRows(tickers: string[]): Promise<Map<string, GhostCacheRow>> {
  const out = new Map<string, GhostCacheRow>()
  const rows = await Promise.all(tickers.map(t => getCache<GhostCacheRow>(GHOST_ROW_KEY(t), 24 * 3600_000, { sameKstDay: true }).catch(() => null)))
  rows.forEach((r, i) => { if (r) out.set(tickers[i].toUpperCase(), r) })
  return out
}

export async function saveGhostRows(rows: Omit<GhostCacheRow, 'updated_at'>[]): Promise<GhostCacheRow[]> {
  const at = new Date().toISOString()
  const full = rows.map(r => ({ ...r, updated_at: at }))
  await Promise.all(full.map(r => setCache(GHOST_ROW_KEY(r.ticker), r)))
  return full
}

export async function buildDiscovery(): Promise<Omit<GhostCacheRow, 'updated_at'>[]> {
  const key = `ghost-discovery-v1:${kstDate()}`
  const cached = await getCache<Omit<GhostCacheRow, 'updated_at'>[]>(key, 24 * 3600_000)
  if (cached?.length) return cached

  const sat = (await getCache<SatelliteScore[]>(SAT_SCORE_KEY, 2 * 24 * 3600_000)) ?? []
  if (!sat.length) return []   // 위성 크론 콜드 — 정직하게 빈 목록(가짜 후보 금지)
  const cands = sat.filter(x => !x.knife).sort((a, b) => b.tenScore - a.tenScore).slice(0, 24)

  const out: Omit<GhostCacheRow, 'updated_at'>[] = []
  const q = [...cands]
  async function worker() {
    while (q.length) {
      const c = q.shift(); if (!c) break
      try { out.push(await buildGhostRecord(c.ticker.toUpperCase(), c.name, c.market, '')) }
      catch { /* 커버리지 미확인 종목은 정직 생략(가짜 행 금지) */ }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  out.sort((a, b) => b.ghost_score - a.ghost_score)
  const top = out.slice(0, 12)
  if (top.length >= 5) await setCache(key, top)   // 과반 실패 박제 금지
  return top
}
