/**
 * src/lib/macroPhaseScreener.ts
 * 🌐 매크로 국면 판별 + 퀀트 1차 스크리닝 라이브러리
 *
 * 파이프라인:
 *   FRED(금리·CPI·장단기금리차) + HY 스프레드
 *     → 6개 매크로 국면 자동 판별
 *     → 피터 린치 6대 종목 × 매크로 국면 가중치 매트릭스 적용
 *     → US 15 + KR 10 유니버스 → PEG·FCF·영업마진 스크린
 *     → US 상위 7 + KR 상위 5 = 12종목 최종 전달
 *
 * 모든 PEG는 app_cache(canon-fund:*) SSOT 재활용 (제2원칙 준수)
 * 고평가·해자 시그널 → '탈락' 아닌 플래그로 LLM에 전달 (제미나이 보강 ③)
 */

import { getCache, setCache } from '@/lib/appCache'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type MacroPhase =
  | 'stagflation'      // 고물가 + 저성장
  | 'recession_risk'   // 장단기 역전 + 위기 신호
  | 'peak_rate'        // 금리 고점 연착륙
  | 'rate_cut_early'   // 금리 인하 초입 (현재 국면)
  | 'easy_money'       // 저금리 유동성 장세
  | 'neutral'          // 중립

export type LynchCategory = 'fast_grower' | 'stalwart' | 'cyclical' | 'turnaround' | 'asset_play' | 'slow_grower'

export interface MacroData {
  fedRate:    number      // 기준금리 % (e.g. 3.75)
  cpiYoY:     number      // CPI 전년대비 % (e.g. 3.95)
  yieldCurve: number      // 10Y-2Y %p (양수=정상, 음수=역전)
  hySpread:   number      // HY 스프레드 % (낮을수록 risk-on)
}

export interface MacroPhaseResult {
  phase:      MacroPhase
  label:      string
  color:      string
  icon:       string
  description: string
}

export interface ScreenedStock {
  ticker:       string
  name:         string
  market:       'US' | 'KR'
  sector:       string | null
  lynchCategory: LynchCategory
  peg:          number | null
  opMargin:     number | null   // 영업이익률 %
  fcfPositive:  boolean
  price:        number | null
  currency:     'USD' | 'KRW'
  score:        number          // 퀀트 최종 점수 (높을수록 선호)
  flags:        string[]        // 경고 플래그 (탈락 아님, LLM 컨텍스트)
}

// ── 스크리닝 유니버스 ──────────────────────────────────────────────────────────
// US 15 + KR 10 = 25개 → 퀀트 스코어링 → 상위 US 7 + KR 5 = 12개
const US_UNIVERSE: { ticker: string; lynch: LynchCategory; name: string }[] = [
  { ticker:'NVDA', lynch:'fast_grower', name:'NVIDIA' },
  { ticker:'MSFT', lynch:'stalwart',   name:'Microsoft' },
  { ticker:'AAPL', lynch:'stalwart',   name:'Apple' },
  { ticker:'GOOGL',lynch:'fast_grower',name:'Alphabet' },
  { ticker:'AMZN', lynch:'fast_grower',name:'Amazon' },
  { ticker:'META', lynch:'fast_grower',name:'Meta' },
  { ticker:'V',    lynch:'stalwart',   name:'Visa' },
  { ticker:'MA',   lynch:'stalwart',   name:'Mastercard' },
  { ticker:'JPM',  lynch:'cyclical',   name:'JPMorgan' },
  { ticker:'JNJ',  lynch:'stalwart',   name:'Johnson & Johnson' },
  { ticker:'KO',   lynch:'slow_grower',name:'Coca-Cola' },
  { ticker:'PLTR', lynch:'fast_grower',name:'Palantir' },
  { ticker:'ETN',  lynch:'cyclical',   name:'Eaton' },
  { ticker:'GEV',  lynch:'fast_grower',name:'GE Vernova' },
  { ticker:'ASML', lynch:'fast_grower',name:'ASML' },
  // ── 코어 풀 확장(2026-06) — 섹터 다변화(헬스케어·필수소비재·산업재·에너지·금융) ──
  { ticker:'LLY',  lynch:'fast_grower',name:'Eli Lilly' },
  { ticker:'UNH',  lynch:'stalwart',   name:'UnitedHealth' },
  { ticker:'ABBV', lynch:'stalwart',   name:'AbbVie' },
  { ticker:'COST', lynch:'stalwart',   name:'Costco' },
  { ticker:'PG',   lynch:'slow_grower',name:'Procter & Gamble' },
  { ticker:'WMT',  lynch:'stalwart',   name:'Walmart' },
  { ticker:'HD',   lynch:'stalwart',   name:'Home Depot' },
  { ticker:'CAT',  lynch:'cyclical',   name:'Caterpillar' },
  { ticker:'XOM',  lynch:'cyclical',   name:'Exxon Mobil' },
  { ticker:'CVX',  lynch:'cyclical',   name:'Chevron' },
  { ticker:'BAC',  lynch:'cyclical',   name:'Bank of America' },
  { ticker:'AVGO', lynch:'fast_grower',name:'Broadcom' },
  { ticker:'CRM',  lynch:'fast_grower',name:'Salesforce' },
  { ticker:'NOW',  lynch:'fast_grower',name:'ServiceNow' },
  { ticker:'AMD',  lynch:'fast_grower',name:'AMD' },
]
const KR_UNIVERSE: { ticker: string; lynch: LynchCategory; name: string }[] = [
  { ticker:'005930',lynch:'stalwart',   name:'삼성전자' },
  { ticker:'000660',lynch:'cyclical',   name:'SK하이닉스' },
  { ticker:'035420',lynch:'fast_grower',name:'NAVER' },
  { ticker:'207940',lynch:'fast_grower',name:'삼성바이오로직스' },
  { ticker:'005380',lynch:'cyclical',   name:'현대차' },
  { ticker:'000270',lynch:'cyclical',   name:'기아' },
  { ticker:'035720',lynch:'fast_grower',name:'카카오' },
  { ticker:'068270',lynch:'fast_grower',name:'셀트리온' },
  { ticker:'033780',lynch:'slow_grower',name:'KT&G' },
  { ticker:'005490',lynch:'cyclical',   name:'POSCO홀딩스' },
  // ── 코어 풀 확장(2026-06) — 금융·바이오·방산·2차전지·인터넷 ──
  { ticker:'105560',lynch:'cyclical',   name:'KB금융' },
  { ticker:'055550',lynch:'cyclical',   name:'신한지주' },
  { ticker:'012450',lynch:'fast_grower',name:'한화에어로스페이스' },
  { ticker:'373220',lynch:'fast_grower',name:'LG에너지솔루션' },
  { ticker:'006400',lynch:'cyclical',   name:'삼성SDI' },
  { ticker:'051910',lynch:'cyclical',   name:'LG화학' },
  { ticker:'003670',lynch:'cyclical',   name:'포스코퓨처엠' },
  { ticker:'009540',lynch:'cyclical',   name:'HD한국조선해양' },
  { ticker:'042700',lynch:'cyclical',   name:'한미반도체' },
  { ticker:'196170',lynch:'fast_grower',name:'알테오젠' },
]

// ── 매크로 국면 × 피터 린치 가중치 매트릭스 (제미나이 보강 ①) ─────────────────
// 값이 높을수록 해당 국면에서 해당 분류에 가점
const LYNCH_MACRO_WEIGHTS: Record<MacroPhase, Record<LynchCategory, number>> = {
  stagflation:    { fast_grower:0.6, stalwart:1.3, cyclical:0.7, turnaround:0.5, asset_play:1.4, slow_grower:1.0 },
  recession_risk: { fast_grower:0.7, stalwart:1.4, cyclical:0.5, turnaround:0.4, asset_play:1.2, slow_grower:1.1 },
  peak_rate:      { fast_grower:1.0, stalwart:1.2, cyclical:0.9, turnaround:0.8, asset_play:1.1, slow_grower:1.0 },
  rate_cut_early: { fast_grower:1.3, stalwart:1.1, cyclical:1.1, turnaround:1.0, asset_play:0.9, slow_grower:0.8 },
  easy_money:     { fast_grower:1.5, stalwart:1.0, cyclical:1.2, turnaround:1.2, asset_play:0.8, slow_grower:0.7 },
  neutral:        { fast_grower:1.0, stalwart:1.0, cyclical:1.0, turnaround:1.0, asset_play:1.0, slow_grower:1.0 },
}

// ── 매크로 국면 판별 알고리즘 ─────────────────────────────────────────────────
export function detectMacroPhase(d: MacroData): MacroPhaseResult {
  const { fedRate, cpiYoY, yieldCurve, hySpread } = d
  // 1) 스태그플레이션: 고물가 + HY 스프레드 급등
  if (cpiYoY > 5 && hySpread > 5)
    return { phase:'stagflation', label:'스태그플레이션 우려', color:'#f87171', icon:'🔥', description:'고물가·저성장 복합 위기 — 현금 흐름 우량주·실물 자산주 선호' }
  // 2) 경기침체 위험: 장단기 금리 깊게 역전
  if (yieldCurve < -0.4)
    return { phase:'recession_risk', label:'경기침체 위험 신호', color:'#f87171', icon:'⚠️', description:'장단기 금리 역전 — 방어적 대형 우량주·배당주 선호' }
  // 3) 스태그플레이션 전조: 높은 물가
  if (cpiYoY > 4.5)
    return { phase:'stagflation', label:'인플레 압박 국면', color:'#fb923c', icon:'📈', description:'물가 압박 지속 — 가격 결정력 보유 기업(해자 넓은 대형주) 선호' }
  // 4) 금리 고점 연착륙: 고금리·물가 안정 기조
  if (fedRate > 4 && cpiYoY < 4)
    return { phase:'peak_rate', label:'금리 고점 연착륙', color:'#f59e0b', icon:'🏔️', description:'고금리 안정화 — 이자 수익 수혜 금융주·FCF 우량주 선호' }
  // 5) 금리 인하 초입: 현재 국면
  if (fedRate <= 4.5 && fedRate > 2 && cpiYoY < 5 && yieldCurve >= 0)
    return { phase:'rate_cut_early', label:'금리 인하 초입', color:'#4ade80', icon:'✂️', description:'인하 사이클 시작 — 성장주·기술주 리레이팅 기대, 선별적 접근' }
  // 6) 저금리 유동성
  if (fedRate <= 2)
    return { phase:'easy_money', label:'유동성 장세', color:'#22d3ee', icon:'💧', description:'저금리 풍부한 유동성 — 성장주·혁신 기업 강세 국면' }
  return { phase:'neutral', label:'중립 국면', color:'#94a3b8', icon:'⚖️', description:'특별한 매크로 방향성 없음 — 펀더멘탈 기반 종목 선별' }
}

// ── FRED 데이터 수집 (24h 캐시) ──────────────────────────────────────────────
const FRED_KEY = process.env.FRED_API_KEY
async function fredLatest(series: string, count = 14): Promise<{ date: string; v: number }[]> {
  if (!FRED_KEY) return []
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${count}`
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j?.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((o: { v: number }) => isFinite(o.v))
  } catch { return [] }
}

export async function fetchMacroData(): Promise<MacroData> {
  const cacheKey = 'macro-phase-data'
  const cached = await getCache<MacroData>(cacheKey, 24 * 3600_000)
  if (cached) return cached

  const [fedArr, cpiArr, yc2Arr, yc10Arr, hyArr] = await Promise.all([
    fredLatest('DFEDTARU', 3),
    fredLatest('CPIAUCSL', 14),
    fredLatest('DGS2', 3),
    fredLatest('GS10', 3),
    fredLatest('BAMLH0A0HYM2', 3),
  ])
  const fedRate = fedArr[0]?.v ?? 4.5
  const cpiYoY = cpiArr.length >= 13
    ? Math.round(((cpiArr[0].v - cpiArr[12].v) / cpiArr[12].v) * 1000) / 10
    : 4.0
  const yieldCurve = (yc10Arr[0]?.v != null && yc2Arr[0]?.v != null)
    ? Math.round((yc10Arr[0].v - yc2Arr[0].v) * 100) / 100
    : 0.4
  const hySpread = hyArr[0]?.v ?? 3.0
  const data: MacroData = { fedRate, cpiYoY, yieldCurve, hySpread }
  await setCache(cacheKey, data)
  return data
}

// ── 퀀트 스크리닝 ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function numf(v: any): number | null { if (v == null) return null; const n = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof n === 'number' ? n : parseFloat(n); return isFinite(f) ? f : null }

async function screenOne(
  ticker: string, market: 'US' | 'KR', lynch: LynchCategory, name: string, phase: MacroPhase
): Promise<ScreenedStock | null> {
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker
    const q = await yf.quoteSummary(sym, { modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price'] })
    const ks = q?.defaultKeyStatistics ?? {}, fd = q?.financialData ?? {}, sd = q?.summaryDetail ?? {}, pr = q?.price ?? {}
    const peg = numf(ks.pegRatio)
    const opMargin = numf(fd.operatingMargins) != null ? Math.round((fd.operatingMargins as number) * 1000) / 10 : null
    const fcf = numf(fd.freeCashflow)
    const fcfPositive = fcf != null ? fcf > 0 : true   // 모를 때 긍정 가정
    const price = numf(pr.regularMarketPrice) ?? numf(sd.regularMarketPrice)
    const currency = market === 'KR' ? 'KRW' as const : 'USD' as const
    const sector = String(q?.price?.sector || '—')

    // 최소 품질 필터 (탈락): 영업이익 -20% 이하만 제거
    if (opMargin != null && opMargin < -20) return null

    // 플래그 (탈락 아닌 정보 — LLM에 전달)
    const flags: string[] = []
    if (peg != null && peg > 2.0) flags.push(`고평가 주의(PEG ${peg.toFixed(1)})`)
    if (!fcfPositive) flags.push('FCF 적자')
    if (opMargin != null && opMargin < 0) flags.push('영업손실')
    if (peg != null && peg > 3.0) flags.push('밸류에이션 부담 과중')

    // 퀀트 점수 계산
    const lynchW = LYNCH_MACRO_WEIGHTS[phase][lynch]
    const pegScore = peg != null && peg > 0 ? Math.max(0, 1.5 - peg * 0.3) : 0.5  // PEG 낮을수록 ↑
    const marginScore = opMargin != null ? Math.min(1, Math.max(0, opMargin / 40)) : 0.3
    const fcfScore = fcfPositive ? 1.0 : 0.3
    const score = Math.round((lynchW * 0.35 + pegScore * 0.35 + marginScore * 0.2 + fcfScore * 0.1) * 1000) / 1000

    return { ticker, name, market, sector, lynchCategory: lynch, peg, opMargin, fcfPositive, price, currency, score, flags }
  } catch { return null }
}

export async function runScreener(phase: MacroPhase): Promise<{ us: ScreenedStock[]; kr: ScreenedStock[] }> {
  const all: ScreenedStock[] = []
  // 동시성 4 — Yahoo 스로틀 방지
  const universe = [
    ...US_UNIVERSE.map(s => ({ ...s, market: 'US' as const })),
    ...KR_UNIVERSE.map(s => ({ ...s, market: 'KR' as const })),
  ]
  for (let i = 0; i < universe.length; i += 4) {
    const batch = universe.slice(i, i + 4)
    const results = await Promise.all(batch.map(s => screenOne(s.ticker, s.market, s.lynch, s.name, phase).catch(() => null)))
    for (const r of results) if (r) all.push(r)
  }
  // 쿼터 확장(US 10 + KR 7 = 17) — 사용자 보유 종목 제외 후 5개 신규 확보에 충분한 버퍼
  const us = all.filter(s => s.market === 'US').sort((a, b) => b.score - a.score).slice(0, 10)
  const kr = all.filter(s => s.market === 'KR').sort((a, b) => b.score - a.score).slice(0, 7)
  return { us, kr }
}
