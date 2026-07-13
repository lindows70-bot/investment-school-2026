// 스마트머니 수급 레이더 SSOT — KR 외국인/기관/개인 직접 + US 프록시(MFI·내부자·13F) (Zero Cost·Lazy Cache)
import { getCache, setCache } from '@/lib/appCache'
import { getInsiderSignal } from '@/app/actions/getInsiderSignal'
import type { ShadowResult } from '@/app/api/shadow-13f/route'

export type FlowStatus = 'INFLOW' | 'CROWDED' | 'NEGLECTED' | 'NEUTRAL' | 'UNSUPPORTED'

// US 프록시 수급 — MFI(자금흐름지수) + 내부자 매수 + 13F 거인 보유
export interface UsFlow {
  mfi:            number | null   // Money Flow Index 0~100
  mfiZone:        'oversold' | 'overbought' | 'neutral'
  mfiTrend:       'rising' | 'falling' | 'flat'
  insiderBuyers:  number          // 최근 90일 장내매수 내부자 수
  insiderCluster: boolean         // 2명+ 동시 매수
  giantHolders:   number          // 13F 전설 거인 보유 수(청산 제외)
  giantTrend:     'add' | 'cut' | 'mixed' | 'none'
  giantKnown:     boolean         // 13F 조회 성공 여부(false=집계중, '미보유'와 구분)
  // 🆕 전체 기관 보유(Yahoo 13F 집계 — 9인 거장보다 넓은 스마트머니, 분기·45일 지연)
  instPct:        number | null   // 기관 보유 비중 %
  instCount:      number | null   // 보유 기관 수
  instTrend:      'accum' | 'distrib' | 'mixed' | 'flat' | null  // Top 기관 분기 순증감
  instAdders:     number          // Top 기관 중 지분 확대 수
  instCutters:    number          // Top 기관 중 지분 축소 수
  insiderNetPct:  number | null   // 내부자 순매매 성향(6개월, +=순매수)
}

export interface FlowActor {
  net5:  number   // 최근 5일 누적 순매수 수량(주)
  net20: number   // 20일
  net60: number   // 60일
  amt20: number   // 20일 추정 순매수 대금(₩) = Σ 일별 수량×종가
  dir:   'BUY' | 'SELL' | 'FLAT'   // 20일 방향
}

export interface MoneyFlowResult {
  ticker:           string
  name:             string
  market:           'KR' | 'US'
  status:           FlowStatus
  foreign:          FlowActor | null
  organ:            FlowActor | null
  individual:       FlowActor | null
  foreignHoldRatio: number | null   // 외국인 보유율 %
  us:               UsFlow | null   // US 프록시(미국 종목만)
  nearHigh:         boolean         // 60일 고점 근처(과열 판정용)
  badges:           string[]        // 👥쌍끌이 매수 · 🚨개미 독박 · 🏛️기관 소외주
  lynchComment:     string
  actionGuide:      string
  asOf:             string
  note?:            string
}

const NAVER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const num = (s: unknown): number => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0

export interface TrendRow { bizdate: string; foreignerPureBuyQuant: string; foreignerHoldRatio: string; organPureBuyQuant: string; individualPureBuyQuant: string; closePrice: string; compareToPreviousClosePrice?: string; [key: string]: string | undefined }
export const trendNum = num   // 시장 수급 랭킹(marketFlowKr)에서 재사용

// KR 일별 수급 추이(최대 60거래일) — m.stock.naver.com (JSON)
// pages>1이면 bizdate 커서로 과거 60일씩 이어받음(pageSize는 네이버가 60 상한). 기본 1페이지=기존 동작 불변
export async function fetchKrTrend(code6: string, pages = 1): Promise<TrendRow[]> {
  const out: TrendRow[] = []
  let cursor = ''
  for (let p = 0; p < pages; p++) {
    const url = `https://m.stock.naver.com/api/stock/${code6}/trend?pageSize=60${cursor ? `&bizdate=${cursor}` : ''}`
    let rows: TrendRow[] = []
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': NAVER_UA, Referer: 'https://m.stock.naver.com/' },
        signal: AbortSignal.timeout(12_000),
      })
      if (!r.ok) break
      const j = await r.json()
      if (!Array.isArray(j)) break
      rows = j as TrendRow[]
    } catch { break }
    if (rows.length === 0) break
    out.push(...rows)
    if (rows.length < 60) break
    cursor = rows[rows.length - 1].bizdate   // 이 페이지 최저일 → 다음 페이지는 그 이전(중복 없음)
  }
  const seen = new Set<string>()
  return out.filter(r => (seen.has(r.bizdate) ? false : (seen.add(r.bizdate), true)))
}

function actorOf(rows: TrendRow[], key: 'foreignerPureBuyQuant' | 'organPureBuyQuant' | 'individualPureBuyQuant'): FlowActor {
  const cum = (n: number) => rows.slice(0, n).reduce((s, r) => s + num(r[key]), 0)
  const net20 = cum(20)
  // 추정 대금 = 20일 순매수 수량 × 평균종가 (부호가 순매수 수량과 항상 일치하도록)
  const closes20 = rows.slice(0, 20).map(r => num(r.closePrice)).filter(c => c > 0)
  const avgClose = closes20.length ? closes20.reduce((a, b) => a + b, 0) / closes20.length : 0
  const amt20 = net20 * avgClose
  // 방향: 20일 순매수가 거래대금 대비 의미있는 수준일 때만 BUY/SELL
  const dir: FlowActor['dir'] = Math.abs(net20) < 1 ? 'FLAT' : net20 > 0 ? 'BUY' : 'SELL'
  return { net5: cum(5), net20, net60: cum(60), amt20, dir }
}

function judgeKr(f: FlowActor, o: FlowActor, ind: FlowActor, foreignHold: number | null, nearHigh: boolean): {
  status: FlowStatus; badges: string[]; lynchComment: string; actionGuide: string
} {
  const badges: string[] = []
  const dualBuy = f.net20 > 0 && o.net20 > 0
  const dualSell = f.net20 < 0 && o.net20 < 0
  const majorsNet = f.net20 + o.net20
  // 한 주체 단독이라도 메이저(외인+기관) 합산 순매수 + 개인 순매도 = 메이저가 개인 물량을 받아내는 유입 구조(외국인 단독 압도 매수 포착)
  const soloMajorBuy = !dualBuy && majorsNet > 0 && ind.net20 < 0 && (f.net20 > 0 || o.net20 > 0)
  // 개미 독박 = 스마트머니(외인+기관) 합산 순매도를 개인이 받아냄 = 하락 압력(수급은 개미와 반대로 해석). 고점 무관
  const antBag  = ind.net20 > 0 && majorsNet < 0
  const neglected = foreignHold != null && foreignHold < 12
  if (dualBuy) badges.push('👥 쌍끌이 매수')
  else if (soloMajorBuy) badges.push(f.net20 >= o.net20 ? '🌍 외국인 매집' : '🏛️ 기관 매집')
  if (dualSell && antBag) badges.push('📉 외인·기관 동반 매도')
  if (antBag) badges.push('🚨 개미 독박')
  if (neglected) badges.push('🏛️ 기관 소외주')

  // 우선순위: 위험(과열) → 유입 → 소외 → 중립
  if (antBag) {
    // 스마트머니(외인+기관) 합산 순매도를 개인이 받아냄 = 분산(distribution)·하락 압력. 고점 부근이면 더 강함
    const leadSell = f.net20 <= o.net20 ? '외국인' : '기관'
    const who = dualSell
      ? '외국인과 기관이 동반 순매도로 물량을 줄이고, 그 물량을 개인이 받아내고 있습니다.'
      : `${leadSell}이 대량 순매도로 이탈하고 개인이 받아내는 중입니다(반대편 메이저는 일부 매수).`
    return {
      status: 'CROWDED', badges,
      lynchComment: (nearHigh ? '주가는 고점 부근인데 ' : '') + who + ' 수급은 개미와 반대로 봅니다 — 스마트머니 이탈은 하락 압력이 쌓이는 신호입니다.',
      actionGuide: nearHigh
        ? '고점 부근 + 메이저 이탈이라 추격 매수는 특히 위험합니다. 보유 중이면 분할 축소·손절선 점검, 신규 진입은 외인·기관 순매수 전환 확인 후.'
        : '메이저 수급이 순매수로 돌아설 때까지 신규 매수·추격은 자제하세요. 좋은 실적도 스마트머니가 빠지면 단기 변동성이 큽니다.',
    }
  }
  if (dualBuy && ind.net20 < 0) {
    return {
      status: 'INFLOW', badges,
      lynchComment: '최근 20일 외국인과 기관이 개인의 물량을 받아내며 동반 매집 중입니다. 수급의 신뢰도가 높은 구간입니다.',
      actionGuide: '펀더멘탈(PEG·이익)이 받쳐준다면 분할 매수 관점에서 참고하세요. 다만 수급은 연료일 뿐, 방향은 실적이 결정합니다.',
    }
  }
  if (soloMajorBuy) {
    const leader = f.net20 >= o.net20 ? '외국인' : '기관'
    return {
      status: 'INFLOW', badges,
      lynchComment: `최근 20일 ${leader}이 다른 매도 물량(반대편 메이저·개인)을 홀로 받아내며 순매집 중입니다(외인+기관 합산 순매수 우위). 한 주체의 강한 확신이 담긴 수급입니다.`,
      actionGuide: `펀더멘탈(PEG·이익)이 받쳐준다면 참고하세요. 단 ${leader} 한 주체가 주도라 그 주체가 돌아서면 되돌림이 빠를 수 있어, 쌍끌이(동반 매집)보다 신뢰도는 한 단계 낮게 봅니다.`,
    }
  }
  if (neglected) {
    return {
      status: 'NEGLECTED', badges,
      lynchComment: `외국인 보유율이 ${foreignHold?.toFixed(1)}%로 낮아 아직 메이저의 손길이 덜 닿은 종목입니다. 린치가 좋아한 "기관이 발견하지 못한 진주" 후보입니다.`,
      actionGuide: '펀더멘탈이 우수(저PEG·이익 성장)하다면, 향후 기관·외국인 유입 시 탄력이 기대됩니다. 수급이 돌아서는 시점을 함께 관찰하세요.',
    }
  }
  return {
    status: 'NEUTRAL', badges,
    lynchComment: '뚜렷한 메이저 수급 쏠림은 보이지 않습니다. 수급보다 펀더멘탈 신호를 중심으로 판단할 구간입니다.',
    actionGuide: '수급은 중립입니다. PEG·이익 추세 등 본질 지표를 우선 보세요.',
  }
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// ── US 프록시 ────────────────────────────────────────────────────────────────
// Yahoo 일봉(3개월)에서 MFI(14) 계산 + 60일 고점 근접 여부
async function computeUsMfi(ticker: string): Promise<{ mfi: number | null; trend: UsFlow['mfiTrend']; nearHigh: boolean }> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?range=3mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return { mfi: null, trend: 'flat', nearHigh: false }
    const j = await r.json()
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]
    if (!q) return { mfi: null, trend: 'flat', nearHigh: false }
    // null 끼인 봉 제거(인덱스 정렬 유지)
    const bars: { h: number; l: number; c: number; v: number }[] = []
    for (let i = 0; i < (q.close?.length ?? 0); i++) {
      const h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i]
      if (h != null && l != null && c != null && v != null) bars.push({ h, l, c, v })
    }
    if (bars.length < 16) return { mfi: null, trend: 'flat', nearHigh: false }
    const tp = bars.map(b => (b.h + b.l + b.c) / 3)
    const rmf = bars.map((b, i) => tp[i] * b.v)
    const period = 14
    const series: number[] = []
    for (let i = period; i < tp.length; i++) {
      let pos = 0, neg = 0
      for (let k = i - period + 1; k <= i; k++) {
        if (tp[k] > tp[k - 1]) pos += rmf[k]
        else if (tp[k] < tp[k - 1]) neg += rmf[k]
      }
      series.push(neg === 0 ? 100 : 100 - 100 / (1 + pos / neg))
    }
    const last = series[series.length - 1] ?? null
    const prev = series[series.length - 2] ?? last
    const trend: UsFlow['mfiTrend'] = last == null || prev == null ? 'flat' : last > prev + 2 ? 'rising' : last < prev - 2 ? 'falling' : 'flat'
    const closes = bars.map(b => b.c)
    const nearHigh = closes[closes.length - 1] >= Math.max(...closes) * 0.95
    return { mfi: last == null ? null : Math.round(last), trend, nearHigh }
  } catch { return { mfi: null, trend: 'flat', nearHigh: false } }
}

// 기존 13F(shadow-13f) 재사용 — best-effort. ok=false면 '집계중'(미보유와 구분, 콜드 타임아웃 오판 방지)
async function fetch13F(ticker: string, name: string, selfBase?: string): Promise<{ holders: number; trend: UsFlow['giantTrend']; ok: boolean }> {
  if (!selfBase) return { holders: 0, trend: 'none', ok: false }
  try {
    const r = await fetch(`${selfBase}/api/shadow-13f?ticker=${encodeURIComponent(ticker)}&market=US&name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(16_000) })
    if (!r.ok) return { holders: 0, trend: 'none', ok: false }
    const j = (await r.json()) as ShadowResult
    if (j.status !== 'ok' && j.status !== 'none') return { holders: 0, trend: 'none', ok: false }
    const owning = (j.holders ?? []).filter(h => h.action !== 'exit')
    const adders = owning.filter(h => h.action === 'add' || h.action === 'new').length
    const cutters = (j.holders ?? []).filter(h => h.action === 'trim' || h.action === 'exit').length
    const trend: UsFlow['giantTrend'] = adders > 0 && cutters > 0 ? 'mixed' : adders > 0 ? 'add' : cutters > 0 ? 'cut' : 'none'
    return { holders: owning.length, trend, ok: true }   // status ok/none = 정상 조회(none=정말 미보유)
  } catch { return { holders: 0, trend: 'none', ok: false } }
}

// 🆕 전체 기관 보유(Yahoo quoteSummary — 무료·무키). 13F 집계라 분기·45일 지연이지만 9인 거장보다 넓은 스마트머니
type InstFlow = Pick<UsFlow, 'instPct' | 'instCount' | 'instTrend' | 'instAdders' | 'instCutters' | 'insiderNetPct'>
async function fetchUsInstitutional(ticker: string): Promise<InstFlow> {
  const empty: InstFlow = { instPct: null, instCount: null, instTrend: null, instAdders: 0, instCutters: 0, insiderNetPct: null }
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const q = await yf.quoteSummary(ticker.toUpperCase(), { modules: ['majorHoldersBreakdown', 'institutionOwnership', 'netSharePurchaseActivity'] })
    const raw = (v: unknown): number | null => typeof v === 'number' ? v : (v && typeof (v as { raw?: number }).raw === 'number' ? (v as { raw: number }).raw : null)
    const mh = q?.majorHoldersBreakdown ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = q?.institutionOwnership?.ownershipList ?? []
    const ns = q?.netSharePurchaseActivity ?? {}
    const ip = raw(mh.institutionsPercentHeld)
    const instPct = ip == null ? null : Math.round(ip * 1000) / 10
    const instCount = raw(mh.institutionsCount)
    // Top 기관 분기 지분 증감 — 신규편입/청산 아티팩트(|Δ|≥50%)·미세 패시브 드리프트(<3%) 제외한 '의미있는' 변동만.
    // 마진 3 이상일 때만 방향 인정(패시브 인덱스펀드가 대부분이라 웬만하면 혼조 = 과신호 방지)
    let adders = 0, cutters = 0, counted = 0
    for (const h of list) {
      const pc = raw(h?.pctChange)
      if (pc == null || Math.abs(pc) >= 0.5) continue
      counted++
      if (pc > 0.03) adders++
      else if (pc < -0.03) cutters++
    }
    const instTrend: UsFlow['instTrend'] = counted < 3 ? null
      : adders - cutters >= 3 ? 'accum' : cutters - adders >= 3 ? 'distrib' : 'mixed'
    const inp = raw(ns.netPercentInsiderShares)
    const insiderNetPct = inp == null ? null : Math.round(inp * 1000) / 10
    return { instPct, instCount: instCount == null ? null : Math.round(instCount), instTrend, instAdders: adders, instCutters: cutters, insiderNetPct }
  } catch { return empty }
}

function judgeUs(us: UsFlow, nearHigh: boolean): { status: FlowStatus; badges: string[]; lynchComment: string; actionGuide: string } {
  const badges: string[] = []
  if (us.insiderCluster) badges.push('🔥 내부자 클러스터')
  else if (us.insiderBuyers > 0) badges.push('🕵️ 내부자 매수')
  // 🆕 전체 기관 보유·분기 순증감(9인 거장보다 넓은 스마트머니)
  if (us.instPct != null) badges.push(`🏛️ 기관 ${us.instPct}% 보유`)
  if (us.instTrend === 'accum') badges.push(`📈 기관 순매집(분기 ${us.instAdders}↑)`)
  else if (us.instTrend === 'distrib') badges.push(`📉 기관 순감소(분기 ${us.instCutters}↓)`)
  if (us.giantHolders > 0) badges.push(`🐳 거인 ${us.giantHolders}인 보유`)
  if (us.mfi != null && us.mfi < 20) badges.push('⚡ 자금흐름 과매도')
  if (us.mfi != null && us.mfi > 80) badges.push('🌡️ 자금흐름 과매수')

  const insiderBuy = us.insiderBuyers > 0
  const notHot = us.mfi != null && us.mfi < 70
  const instAccum = us.instTrend === 'accum'
  const instDistrib = us.instTrend === 'distrib'
  // 🟢 유입: (내부자 매수 또는 기관 분기 순매집) + 자금흐름이 과열(>70) 아님
  if ((insiderBuy || instAccum) && notHot) {
    const parts: string[] = []
    if (insiderBuy) parts.push(`내부자 ${us.insiderBuyers}명이 장내매수${us.insiderCluster ? '(클러스터)' : ''}`)
    if (instAccum) parts.push(`Top 기관 ${us.instAdders}곳이 분기 지분 확대(기관 보유 ${us.instPct ?? '—'}%)`)
    return {
      status: 'INFLOW', badges,
      lynchComment: `${parts.join(', ')}했고, 자금흐름(MFI ${us.mfi})도 과열 구간이 아닙니다. 스마트머니가 들어오는 자리입니다.${us.insiderNetPct != null && us.insiderNetPct > 10 ? ` (내부자 6개월 지분도 순증 — 단 그랜트·행사 포함이라 장내매수와는 구분).` : ''}`,
      actionGuide: '펀더멘탈이 받쳐준다면 분할 매수 관점에서 참고하세요. 기관·내부자 수급은 강하나, 방향은 결국 실적이 결정합니다.',
    }
  }
  // 🔴 과열/분산: 신고가+MFI 과매수, 또는 기관이 분기 순감소로 물량 축소
  if ((nearHigh && us.mfi != null && us.mfi > 80) || (instDistrib && nearHigh)) {
    return {
      status: 'CROWDED', badges,
      lynchComment: instDistrib
        ? `주가는 고점 부근인데 Top 기관 ${us.instCutters}곳이 분기 지분을 줄였습니다(기관 보유 ${us.instPct ?? '—'}%). 스마트머니가 발을 빼는 신호일 수 있습니다.`
        : `주가는 고점 부근이고 자금흐름지수(MFI ${us.mfi})가 과매수권입니다. 단기 과열로 변동성이 커질 수 있는 구간입니다.`,
      actionGuide: '추격 매수보다 자금흐름·기관 동향이 식는지 관망하세요. 좋은 기업도 과열 구간 진입은 손실 회피에 불리합니다.',
    }
  }
  // US 소외 판정은 제거 — 추적 거인 9인뿐이라 0이 흔하고 매칭 미스 가능(거짓 '소외주' 방지)
  const instNote = us.instTrend === 'accum' ? ' 다만 Top 기관은 분기 순매집 중입니다.'
    : us.instTrend === 'distrib' ? ' Top 기관은 분기 지분을 소폭 줄였습니다.' : ''
  return {
    status: 'NEUTRAL', badges,
    lynchComment: `뚜렷한 스마트머니 신호는 약합니다(MFI ${us.mfi ?? '—'}, 내부자 매수 ${us.insiderBuyers}명${us.instPct != null ? `, 기관 보유 ${us.instPct}%` : ''}).${instNote} 수급보다 펀더멘탈 중심으로 판단할 구간입니다.`,
    actionGuide: '수급 프록시는 중립입니다. PEG·이익 추세 등 본질 지표를 우선 보세요.',
  }
}

async function getUsFlow(ticker: string, name: string, base: MoneyFlowResult, selfBase?: string): Promise<MoneyFlowResult> {
  const cacheKey = `money-flow-v7:${ticker.toUpperCase()}:US:${kstDate()}`
  const cached = await getCache<MoneyFlowResult>(cacheKey, 24 * 3600_000)
  if (cached) return cached
  try {
    const [mfiRes, insider, f13, inst] = await Promise.all([
      computeUsMfi(ticker),
      getInsiderSignal({ ticker, market: 'US', name }).catch(() => null),
      fetch13F(ticker, name, selfBase),
      fetchUsInstitutional(ticker),
    ])
    if (mfiRes.mfi == null && !insider?.hasBuys && f13.holders === 0 && inst.instPct == null) {
      return { ...base, status: 'UNSUPPORTED', note: '미국 수급 프록시 데이터를 불러오지 못했습니다.' }
    }
    const us: UsFlow = {
      mfi: mfiRes.mfi,
      mfiZone: mfiRes.mfi == null ? 'neutral' : mfiRes.mfi < 20 ? 'oversold' : mfiRes.mfi > 80 ? 'overbought' : 'neutral',
      mfiTrend: mfiRes.trend,
      insiderBuyers: insider?.buyerCount ?? 0,
      insiderCluster: insider?.cluster ?? false,
      giantHolders: f13.holders,
      giantTrend: f13.trend,
      giantKnown: f13.ok,
      ...inst,
    }
    const j = judgeUs(us, mfiRes.nearHigh)
    const result: MoneyFlowResult = { ...base, us, nearHigh: mfiRes.nearHigh, asOf: new Date().toISOString(), ...j }
    await setCache(cacheKey, result)
    return result
  } catch {
    return { ...base, status: 'UNSUPPORTED', note: '미국 수급 프록시 데이터를 불러오지 못했습니다.' }
  }
}

// 메인: 종목 수급 분석. KR=외인/기관/개인 직접 / US=MFI+내부자+13F 프록시
export async function getMoneyFlow(ticker: string, market: 'KR' | 'US', name: string, selfBase?: string): Promise<MoneyFlowResult> {
  const base: MoneyFlowResult = {
    ticker, name, market, status: 'NEUTRAL', foreign: null, organ: null, individual: null,
    foreignHoldRatio: null, us: null, nearHigh: false, badges: [], lynchComment: '', actionGuide: '', asOf: new Date().toISOString(),
  }
  if (market === 'US') return getUsFlow(ticker, name, base, selfBase)

  const code6 = (ticker.match(/\d{6}/)?.[0]) ?? ''
  if (!code6) return { ...base, status: 'UNSUPPORTED', note: '종목 코드를 확인할 수 없습니다.' }

  const cacheKey = `money-flow-v7:${code6}:KR:${kstDate()}`   // v7: 외인+기관 이탈+개미독박=하락신호(CROWDED, 고점 무관)
  const cached = await getCache<MoneyFlowResult>(cacheKey, 24 * 3600_000)
  if (cached) return cached

  try {
    const rows = await fetchKrTrend(code6)
    if (rows.length < 5) return { ...base, status: 'UNSUPPORTED', note: '수급 데이터를 불러오지 못했습니다.' }
    const foreign = actorOf(rows, 'foreignerPureBuyQuant')
    const organ = actorOf(rows, 'organPureBuyQuant')
    const individual = actorOf(rows, 'individualPureBuyQuant')
    const foreignHoldRatio = num(rows[0].foreignerHoldRatio) || null
    const closes = rows.map(r => num(r.closePrice)).filter(c => c > 0)
    const nearHigh = closes.length > 0 && closes[0] >= Math.max(...closes) * 0.95
    const j = judgeKr(foreign, organ, individual, foreignHoldRatio, nearHigh)
    const result: MoneyFlowResult = { ...base, foreign, organ, individual, foreignHoldRatio, nearHigh, asOf: new Date().toISOString(), ...j }
    await setCache(cacheKey, result)
    return result
  } catch {
    return { ...base, status: 'UNSUPPORTED', note: '수급 데이터를 불러오지 못했습니다.' }
  }
}
