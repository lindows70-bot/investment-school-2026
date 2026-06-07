// 🌐 국내 시장 수급 랭킹 — 주요 코스피 유니버스의 외국인/기관 순매수 상위 + 쌍끌이 연속매집
// 검증된 per-ticker trend(moneyFlow.fetchKrTrend) 재사용 · ETF는 큐레이션(STOCK)으로 원천차단 · Zero Cost
import { fetchKrTrend, trendNum as num } from '@/lib/moneyFlow'
import { getCanonicalPeg } from '@/lib/canonicalFundamentals'

export interface MarketFlowEntry {
  ticker:    string
  name:      string
  sector:    string
  close:     number
  changePct: number | null   // 당일 등락률 %
  foreignAmt: number         // 외국인 순매수 대금(₩, 당일=수량×종가)
  organAmt:   number         // 기관 순매수 대금(₩)
  dualStreak: number         // 외인+기관 동시 순매수 연속일수(0=오늘 미해당)
  peg:        number | null  // 저PEG 뱃지용(상위 종목만 채움)
}

export interface MarketFlowKrResult {
  foreignTop: MarketFlowEntry[]   // 외국인 순매수 Top
  organTop:   MarketFlowEntry[]   // 기관 순매수 Top
  dualBuy:    MarketFlowEntry[]   // 쌍끌이 연속매집(streak≥2)
  asOf:       string
  poolSize:   number
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
  { t:'108860', n:'셀바스AI', s:'AI' }, { t:'042660', n:'한화오션', s:'조선' },
]

function entryOf(p: { t: string; n: string; s: string }, rows: { foreignerPureBuyQuant: string; organPureBuyQuant: string; closePrice: string; compareToPreviousClosePrice?: string }[]): MarketFlowEntry | null {
  if (!rows.length) return null
  const close = num(rows[0].closePrice)
  if (close <= 0) return null
  const fQ = num(rows[0].foreignerPureBuyQuant), oQ = num(rows[0].organPureBuyQuant)
  // 쌍끌이 연속일수: 오늘부터 외인>0 AND 기관>0 연속
  let streak = 0
  for (const r of rows) { if (num(r.foreignerPureBuyQuant) > 0 && num(r.organPureBuyQuant) > 0) streak++; else break }
  const prevClose = rows[1] ? num(rows[1].closePrice) : 0
  const changePct = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 1000) / 10 : null
  return { ticker: p.t, name: p.n, sector: p.s, close, changePct, foreignAmt: fQ * close, organAmt: oQ * close, dualStreak: streak, peg: null }
}

// 전체 풀 수집·랭킹 (크론/콜드폴백). base=selfBase(PEG 조회용)
export async function computeMarketFlowKr(base?: string): Promise<MarketFlowKrResult> {
  const entries: MarketFlowEntry[] = []
  for (let i = 0; i < POOL.length; i += 6) {
    const batch = POOL.slice(i, i + 6)
    const rs = await Promise.all(batch.map(async p => {
      try { return entryOf(p, await fetchKrTrend(p.t)) } catch { return null }
    }))
    for (const r of rs) if (r) entries.push(r)
  }
  const foreignTop = [...entries].sort((a, b) => b.foreignAmt - a.foreignAmt).filter(e => e.foreignAmt > 0).slice(0, 12)
  const organTop = [...entries].sort((a, b) => b.organAmt - a.organAmt).filter(e => e.organAmt > 0).slice(0, 12)
  const dualBuy = [...entries].filter(e => e.dualStreak >= 2).sort((a, b) => b.dualStreak - a.dualStreak || (b.foreignAmt + b.organAmt) - (a.foreignAmt + a.organAmt)).slice(0, 12)

  // 저PEG 뱃지 — 표시되는 상위 종목 union만(과도한 fetch 방지)
  const shown = new Map<string, MarketFlowEntry>()
  for (const e of [...foreignTop, ...organTop, ...dualBuy]) shown.set(e.ticker, e)
  await Promise.all(Array.from(shown.values()).map(async e => {
    try { e.peg = await getCanonicalPeg(e.ticker, 'KR', base) } catch { /* graceful */ }
  }))

  return { foreignTop, organTop, dualBuy, asOf: new Date().toISOString(), poolSize: entries.length }
}
