// 스마트머니 수급 레이더 — KR 외국인/기관/개인 일별 순매수 수집·린치식 판정 SSOT (Zero Cost·Lazy Cache)
import { getCache, setCache } from '@/lib/appCache'

export type FlowStatus = 'INFLOW' | 'CROWDED' | 'NEGLECTED' | 'NEUTRAL' | 'UNSUPPORTED'

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
  nearHigh:         boolean         // 60일 고점 근처(과열 판정용)
  badges:           string[]        // 👥쌍끌이 매수 · 🚨개미 독박 · 🏛️기관 소외주
  lynchComment:     string
  actionGuide:      string
  asOf:             string
  note?:            string
}

const NAVER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const num = (s: unknown): number => parseFloat(String(s ?? '').replace(/[,+%\s]/g, '')) || 0

interface TrendRow { bizdate: string; foreignerPureBuyQuant: string; foreignerHoldRatio: string; organPureBuyQuant: string; individualPureBuyQuant: string; closePrice: string }

// KR 일별 수급 추이(최대 60거래일) — m.stock.naver.com (JSON)
async function fetchKrTrend(code6: string): Promise<TrendRow[]> {
  const r = await fetch(`https://m.stock.naver.com/api/stock/${code6}/trend?pageSize=60`, {
    headers: { 'User-Agent': NAVER_UA, Referer: 'https://m.stock.naver.com/' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok) return []
  const j = await r.json()
  return Array.isArray(j) ? (j as TrendRow[]) : []
}

function actorOf(rows: TrendRow[], key: 'foreignerPureBuyQuant' | 'organPureBuyQuant' | 'individualPureBuyQuant'): FlowActor {
  const cum = (n: number) => rows.slice(0, n).reduce((s, r) => s + num(r[key]), 0)
  const amt20 = rows.slice(0, 20).reduce((s, r) => s + num(r[key]) * num(r.closePrice), 0)
  const net20 = cum(20)
  // 방향: 20일 순매수가 거래대금 대비 의미있는 수준일 때만 BUY/SELL
  const dir: FlowActor['dir'] = Math.abs(net20) < 1 ? 'FLAT' : net20 > 0 ? 'BUY' : 'SELL'
  return { net5: cum(5), net20, net60: cum(60), amt20, dir }
}

function judgeKr(f: FlowActor, o: FlowActor, ind: FlowActor, foreignHold: number | null, nearHigh: boolean): {
  status: FlowStatus; badges: string[]; lynchComment: string; actionGuide: string
} {
  const badges: string[] = []
  const dualBuy = f.net20 > 0 && o.net20 > 0
  const antBag  = ind.net20 > 0 && (f.net20 + o.net20) < 0
  const neglected = foreignHold != null && foreignHold < 12
  if (dualBuy) badges.push('👥 쌍끌이 매수')
  if (antBag) badges.push('🚨 개미 독박')
  if (neglected) badges.push('🏛️ 기관 소외주')

  // 우선순위: 위험(과열) → 유입 → 소외 → 중립
  if (nearHigh && antBag) {
    return {
      status: 'CROWDED', badges,
      lynchComment: '주가는 고점 부근인데 외국인·기관은 조용히 물량을 줄이고 개인만 추격 매수로 받아내는 구간입니다. 린치가 경고한 "군중 과열"의 전형입니다.',
      actionGuide: '메이저 수급이 돌아서는지 확인 전까지 추격 매수는 자제하고 관망하세요. 좋은 실적도 수급이 빠지면 단기 변동성이 큽니다.',
    }
  }
  if (dualBuy && ind.net20 < 0) {
    return {
      status: 'INFLOW', badges,
      lynchComment: '최근 20일 외국인과 기관이 개인의 물량을 받아내며 동반 매집 중입니다. 수급의 신뢰도가 높은 구간입니다.',
      actionGuide: '펀더멘탈(PEG·이익)이 받쳐준다면 분할 매수 관점에서 참고하세요. 다만 수급은 연료일 뿐, 방향은 실적이 결정합니다.',
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

// 메인: 종목 수급 분석. KR=3주체 직접 / US=2단계(준비중)
export async function getMoneyFlow(ticker: string, market: 'KR' | 'US', name: string): Promise<MoneyFlowResult> {
  const base: MoneyFlowResult = {
    ticker, name, market, status: 'NEUTRAL', foreign: null, organ: null, individual: null,
    foreignHoldRatio: null, nearHigh: false, badges: [], lynchComment: '', actionGuide: '', asOf: new Date().toISOString(),
  }
  if (market === 'US') {
    return { ...base, status: 'UNSUPPORTED', note: '미국 수급(MFI·내부자·13F 프록시)은 2단계에서 제공됩니다.' }
  }
  const code6 = (ticker.match(/\d{6}/)?.[0]) ?? ''
  if (!code6) return { ...base, status: 'UNSUPPORTED', note: '종목 코드를 확인할 수 없습니다.' }

  const cacheKey = `money-flow-v1:${code6}:KR:${kstDate()}`
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
