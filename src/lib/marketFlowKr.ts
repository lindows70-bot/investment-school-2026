// 🌐 국내 시장 수급 랭킹 — 주요 코스피 유니버스의 외국인/기관 순매수 상위 + 쌍끌이 연속매집
// 검증된 per-ticker trend(moneyFlow.fetchKrTrend) 재사용 · ETF는 큐레이션(STOCK)으로 원천차단 · Zero Cost
import { fetchKrTrend, trendNum as num } from '@/lib/moneyFlow'
import { getCanonicalFundamentals, isPegBaseEffect } from '@/lib/canonicalFundamentals'

export type Period = 'd1' | 'd5' | 'd20'

// 코스닥(KOSDAQ) 코드 집합 — 네이버 stockExchangeType.code 라이브 검증(2026-06-26) 후 고정(시장 분류는 정적 참조 데이터). 그 외 풀=코스피
const KOSDAQ_SET = new Set([
  '240810','357780','403870','058470','095340','039030','348210','222800','064760',
  '196170','145020','214150','247540','263750','293490','112040','277810','108860',
])
export const krMarketOf = (code6: string): 'KOSPI' | 'KOSDAQ' =>
  KOSDAQ_SET.has(code6.replace(/\D/g, '').slice(-6)) ? 'KOSDAQ' : 'KOSPI'

export interface MarketFlowEntry {
  ticker:    string
  name:      string
  sector:    string
  market:    'KOSPI' | 'KOSDAQ'   // 코스피/코스닥(외국인·기관 종목별 시장 필터용)
  close:     number
  changePct: number | null   // 당일 등락률 %
  foreign:   Record<Period, number>   // 외국인 누적 순매수 대금(₩) — 1/5/20일
  organ:     Record<Period, number>   // 기관 누적 순매수 대금(₩)
  individual?: Record<Period, number> // 개인 누적 순매수(음수=이탈 — 진주 발굴 개인이탈 조건용)
  dualStreak: number         // 외인+기관 동시 순매수 연속일수(0=오늘 미해당)
  peg:        number | null  // 저PEG 뱃지용(상위 종목만 채움)
  pegSuspect?: boolean       // ⚠️ 기저효과 의심(이익 붕괴 후 회복 G>100% → PEG 0 수렴 착시) — 저PEG 뱃지·추천 점수에서 제외
  closes:     number[]       // 최근 30일 일별 종가(오래된→최신) — 스파크라인 + MA10 추세속도용(추가 fetch 0)
  trendSpeed: number[]       // 🌡️ 추세속도(MA10 이격도 %, ±15 상한) 최근 5거래일(최신→과거) — 부호=방향·크기=강도·5일변화=가속/둔화
}

// 🌡️ 추세속도 = MA10 이격도(%), ±15%로 상한(급등주 baseline 이격 폭증 방지·원본 톤). closes(오래된→최신) 최근 days거래일을 최신→과거로 반환
const TS_CAP = 15
function computeTrendSpeed(closes: number[], ma = 10, days = 5): number[] {
  const n = closes.length
  if (n < ma + 1) return []
  const out: number[] = []
  for (let i = n - 1; i >= n - days && i >= ma - 1; i--) {
    const win = closes.slice(i - ma + 1, i + 1)
    const avg = win.reduce((s, v) => s + v, 0) / ma
    const v = avg > 0 ? Math.round(((closes[i] - avg) / avg) * 1000) / 10 : 0
    out.push(Math.max(-TS_CAP, Math.min(TS_CAP, v)))   // ±15 상한(이상치 saturation)
  }
  return out   // 최신 → 과거
}

export interface MarketFlowKrResult {
  entries:  MarketFlowEntry[]   // 전체 풀 — 클라이언트가 기간(1/5/20)·주체(외인/기관)별 랭킹
  asOf:     string              // 계산 시각(벽시계)
  dataDate: string              // 데이터 최신 거래일(YYYY-MM-DD) — 신선도 판정 SSOT(네이버 발행 지연 셀프힐용)
  poolSize: number
  recentDates: string[]         // 🌡️ 추세맵 컬럼용 최근 5거래일(YYYYMMDD, 최신→과거)
}

/** 신선도 프로브 — 대표 종목(삼성전자) 트렌드의 최신 거래일(YYYY-MM-DD). 캐시 셀프힐 판정용(1 fetch) */
export async function latestTradeDate(code6 = '005930'): Promise<string | null> {
  try {
    const rows = await fetchKrTrend(code6)
    const b = rows[0]?.bizdate
    return b && b.length >= 8 ? `${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6, 8)}` : null
  } catch { return null }
}

// 주요 코스피/코스닥 유니버스(개별주식만 — ETF·ETN 없음). 섹터 라벨 포함
const POOL: { t: string; n: string; s: string }[] = [
  { t:'005930', n:'삼성전자', s:'반도체' }, { t:'000660', n:'SK하이닉스', s:'반도체' },
  { t:'042700', n:'한미반도체', s:'반도체장비' }, { t:'240810', n:'원익IPS', s:'반도체장비' },
  { t:'357780', n:'솔브레인', s:'반도체소재' }, { t:'403870', n:'HPSP', s:'반도체장비' },
  { t:'039030', n:'이오테크닉스', s:'반도체장비' }, { t:'064760', n:'티씨케이', s:'반도체부품' },
  { t:'222800', n:'심텍', s:'PCB' }, { t:'058470', n:'리노공업', s:'반도체부품' },
  { t:'009150', n:'삼성전기', s:'IT부품' }, { t:'011070', n:'LG이노텍', s:'IT부품' },
  { t:'000990', n:'DB하이텍', s:'반도체' }, { t:'007660', n:'이수페타시스', s:'PCB' },
  { t:'095340', n:'ISC', s:'반도체부품' }, { t:'348210', n:'넥스틴', s:'반도체장비' },
  { t:'005380', n:'현대차', s:'자동차' }, { t:'000270', n:'기아', s:'자동차' },
  { t:'012330', n:'현대모비스', s:'자동차부품' }, { t:'161390', n:'한국타이어앤테크놀로지', s:'타이어' },
  { t:'207940', n:'삼성바이오로직스', s:'바이오' }, { t:'068270', n:'셀트리온', s:'바이오' },
  { t:'196170', n:'알테오젠', s:'바이오' }, { t:'145020', n:'휴젤', s:'바이오' },
  { t:'128940', n:'한미약품', s:'제약' }, { t:'000100', n:'유한양행', s:'제약' },
  { t:'326030', n:'SK바이오팜', s:'바이오' }, { t:'214150', n:'클래시스', s:'미용의료' },
  { t:'373220', n:'LG에너지솔루션', s:'2차전지' }, { t:'006400', n:'삼성SDI', s:'2차전지' },
  { t:'051910', n:'LG화학', s:'화학' }, { t:'003670', n:'포스코퓨처엠', s:'2차전지소재' },
  { t:'247540', n:'에코프로비엠', s:'2차전지소재' }, { t:'011170', n:'롯데케미칼', s:'화학' },
  { t:'105560', n:'KB금융', s:'금융/은행' }, { t:'055550', n:'신한지주', s:'금융/은행' },
  { t:'086790', n:'하나금융지주', s:'금융/은행' }, { t:'316140', n:'우리금융지주', s:'금융/은행' },
  { t:'000810', n:'삼성화재', s:'보험' }, { t:'032830', n:'삼성생명', s:'보험' },
  { t:'071050', n:'한국금융지주', s:'증권' }, { t:'138040', n:'메리츠금융지주', s:'금융' },
  { t:'006800', n:'미래에셋증권', s:'증권' }, { t:'005940', n:'NH투자증권', s:'증권' },
  { t:'035420', n:'NAVER', s:'인터넷' }, { t:'035720', n:'카카오', s:'인터넷' },
  { t:'259960', n:'크래프톤', s:'게임' }, { t:'036570', n:'엔씨소프트', s:'게임' },
  { t:'251270', n:'넷마블', s:'게임' }, { t:'263750', n:'펄어비스', s:'게임' },
  { t:'293490', n:'카카오게임즈', s:'게임' }, { t:'112040', n:'위메이드', s:'게임' },
  { t:'005490', n:'POSCO홀딩스', s:'철강' }, { t:'010130', n:'고려아연', s:'비철금속' },
  { t:'004020', n:'현대제철', s:'철강' },
  { t:'329180', n:'HD현대중공업', s:'조선' }, { t:'009540', n:'HD한국조선해양', s:'조선' },
  { t:'010140', n:'삼성중공업', s:'조선' }, { t:'042660', n:'한화오션', s:'조선' },
  { t:'012450', n:'한화에어로스페이스', s:'방산' }, { t:'064350', n:'현대로템', s:'방산' },
  { t:'047810', n:'한국항공우주', s:'방산' },
  { t:'015760', n:'한국전력', s:'전력' }, { t:'034020', n:'두산에너빌리티', s:'발전' },
  { t:'010120', n:'LS ELECTRIC', s:'전력기기' }, { t:'267260', n:'HD현대일렉트릭', s:'전력기기' },
  { t:'298040', n:'효성중공업', s:'전력기기' }, { t:'112610', n:'씨에스윈드', s:'풍력' },
  { t:'001440', n:'대한전선', s:'전선' }, { t:'009830', n:'한화솔루션', s:'태양광' },
  { t:'017670', n:'SK텔레콤', s:'통신' }, { t:'030200', n:'KT', s:'통신' },
  { t:'066570', n:'LG전자', s:'가전' }, { t:'034730', n:'SK', s:'지주사' },
  { t:'003550', n:'LG', s:'지주사' }, { t:'028260', n:'삼성물산', s:'지주/건설' },
  { t:'000150', n:'두산', s:'지주사' }, { t:'096770', n:'SK이노베이션', s:'정유' },
  { t:'010950', n:'S-Oil', s:'정유' }, { t:'033780', n:'KT&G', s:'담배' },
  { t:'097950', n:'CJ제일제당', s:'음식료' }, { t:'271560', n:'오리온', s:'음식료' },
  { t:'003230', n:'삼양식품', s:'음식료' }, { t:'004170', n:'신세계', s:'유통' },
  { t:'023530', n:'롯데쇼핑', s:'유통' }, { t:'282330', n:'BGF리테일', s:'유통' },
  { t:'161890', n:'한국콜마', s:'화장품' }, { t:'278470', n:'에이피알', s:'화장품' },
  { t:'277810', n:'레인보우로보틱스', s:'로봇' }, { t:'454910', n:'두산로보틱스', s:'로봇' },
  { t:'108860', n:'셀바스AI', s:'AI' },
  // ── 보강(2026-06): 검증 중 발견된 풀 누락 종목 ──
  { t:'005935', n:'삼성전자우', s:'반도체' }, { t:'402340', n:'SK스퀘어', s:'지주사' },
  { t:'007810', n:'코리아써키트', s:'PCB/반도체' }, { t:'336260', n:'두산퓨얼셀', s:'신재생에너지' },
  { t:'005387', n:'현대차2우B', s:'자동차' }, { t:'005385', n:'현대차우', s:'자동차' },
  { t:'051900', n:'LG생활건강', s:'화장품' }, { t:'090430', n:'아모레퍼시픽', s:'화장품' },
  { t:'010120', n:'LS ELECTRIC', s:'전력기기' }, { t:'267250', n:'HD현대', s:'지주사' },
  { t:'267270', n:'HD현대건설기계', s:'건설기계' }, { t:'042670', n:'HD현대인프라코어', s:'건설기계' },
  { t:'241560', n:'두산밥캣', s:'건설기계' }, { t:'241590', n:'화승엔터프라이즈', s:'신발' },
  { t:'001440', n:'대한전선', s:'전선' }, { t:'103140', n:'풍산', s:'비철금속' },
  { t:'010620', n:'HD현대미포', s:'조선' }, { t:'009830', n:'한화솔루션', s:'태양광' },
  { t:'047050', n:'포스코인터내셔널', s:'무역/에너지' }, { t:'011200', n:'HMM', s:'해운' },
  { t:'180640', n:'한진칼', s:'지주사' }, { t:'003490', n:'대한항공', s:'항공' },
  { t:'375500', n:'DL이앤씨', s:'건설' }, { t:'000720', n:'현대건설', s:'건설' },
  { t:'034220', n:'LG디스플레이', s:'디스플레이' }, { t:'066970', n:'엘앤에프', s:'2차전지소재' },
  { t:'137310', n:'에스디바이오센서', s:'진단' }, { t:'091990', n:'셀트리온헬스케어', s:'바이오' },
]

function entryOf(p: { t: string; n: string; s: string }, rows: { foreignerPureBuyQuant: string; organPureBuyQuant: string; individualPureBuyQuant: string; closePrice: string; compareToPreviousClosePrice?: string }[]): MarketFlowEntry | null {
  if (!rows.length) return null
  const close = num(rows[0].closePrice)
  if (close <= 0) return null
  // 누적 순매수 대금 = Σ(일별 순매수수량 × 그날 종가). 1/5/20일
  const cumAmt = (key: 'foreignerPureBuyQuant' | 'organPureBuyQuant' | 'individualPureBuyQuant', n: number) =>
    rows.slice(0, n).reduce((s, r) => s + num(r[key]) * num(r.closePrice), 0)
  // 쌍끌이 연속일수: 오늘부터 외인>0 AND 기관>0 연속
  let streak = 0
  for (const r of rows) { if (num(r.foreignerPureBuyQuant) > 0 && num(r.organPureBuyQuant) > 0) streak++; else break }
  const prevClose = rows[1] ? num(rows[1].closePrice) : 0
  const changePct = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 1000) / 10 : null
  const closes = rows.slice(0, 30).map(r => num(r.closePrice)).filter(c => c > 0).reverse()   // 오래된→최신(MA20 추세속도용 30개)
  return {
    ticker: p.t, name: p.n, sector: p.s, market: krMarketOf(p.t), close, changePct, dualStreak: streak, peg: null, closes,
    trendSpeed: computeTrendSpeed(closes),
    foreign:    { d1: cumAmt('foreignerPureBuyQuant', 1),    d5: cumAmt('foreignerPureBuyQuant', 5),    d20: cumAmt('foreignerPureBuyQuant', 20) },
    organ:      { d1: cumAmt('organPureBuyQuant', 1),        d5: cumAmt('organPureBuyQuant', 5),        d20: cumAmt('organPureBuyQuant', 20) },
    individual: { d1: cumAmt('individualPureBuyQuant', 1),   d5: cumAmt('individualPureBuyQuant', 5),   d20: cumAmt('individualPureBuyQuant', 20) },
  }
}

// 전체 풀 수집 (크론/콜드폴백). base=selfBase(PEG 조회용). 랭킹은 클라이언트가 기간별로 수행
export async function computeMarketFlowKr(base?: string): Promise<MarketFlowKrResult> {
  // 풀 중복 제거(보강 시 중복 티커 방지)
  const seen = new Set<string>()
  const pool = POOL.filter(p => (seen.has(p.t) ? false : (seen.add(p.t), true)))

  const entries: MarketFlowEntry[] = []
  let newestBiz = ''   // 풀 전체에서 가장 최신 거래일(YYYYMMDD) — dataDate 산출용
  let recentDates: string[] = []   // 🌡️ 추세맵 컬럼(최근 5거래일, 최신→과거) — 대표 종목에서 1회 캡처
  for (let i = 0; i < pool.length; i += 6) {
    const batch = pool.slice(i, i + 6)
    const rs = await Promise.all(batch.map(async p => {
      try { const rows = await fetchKrTrend(p.t); return { entry: entryOf(p, rows), biz: rows[0]?.bizdate ?? '', dates: rows.slice(0, 5).map(r => r.bizdate ?? '').filter(Boolean) } }
      catch { return { entry: null, biz: '', dates: [] as string[] } }
    }))
    for (const r of rs) if (r.entry) {
      entries.push(r.entry)
      // 🌡️ recentDates는 '가장 신선한' 종목 기준(per-stock 트렌드 신선도가 종목마다 달라 첫 종목이 묵으면 라벨이 묵는 버그 방지)
      if (r.biz > newestBiz) { newestBiz = r.biz; if (r.dates.length >= 5) recentDates = r.dates }
    }
  }
  const dataDate = newestBiz.length >= 8 ? `${newestBiz.slice(0, 4)}-${newestBiz.slice(4, 6)}-${newestBiz.slice(6, 8)}` : ''

  // 저PEG 뱃지 — 6개 랭킹(기간×주체) Top12 + 쌍끌이 union만 PEG 조회(과도한 fetch 방지)
  const union = new Map<string, MarketFlowEntry>()
  const periods: Period[] = ['d1', 'd5', 'd20']
  for (const pr of periods) {
    for (const e of [...entries].sort((a, b) => b.foreign[pr] - a.foreign[pr]).slice(0, 12)) union.set(e.ticker, e)
    for (const e of [...entries].sort((a, b) => b.organ[pr] - a.organ[pr]).slice(0, 12)) union.set(e.ticker, e)
  }
  for (const e of entries.filter(e => e.dualStreak >= 2)) union.set(e.ticker, e)
  await Promise.all(Array.from(union.values()).map(async e => {
    try {
      const cf = await getCanonicalFundamentals(e.ticker, 'KR', base)   // 동일 SSOT 캐시(canon-fund) 공유 — 추가 비용 0
      e.peg = cf.peg
      e.pegSuspect = isPegBaseEffect(cf.peg, cf.growth)
    } catch { /* graceful */ }
  }))

  return { entries, asOf: new Date().toISOString(), dataDate, poolSize: entries.length, recentDates }
}
