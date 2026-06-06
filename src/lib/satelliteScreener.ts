// 위성(10배거) 100종목 풀 + 라이트 채점 — 크론이 미리 계산해 캐시, 리밸런싱은 캐시만 읽음
import { getCache, setCache } from '@/lib/appCache'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'

export const SAT_SCORE_KEY = 'satellite-scores-v1'   // 위성 100종목 점수 — 크론이 매일 적재

// 채점 결과(편입 비중 제외). 리밸런서 SatelliteCandidate = SatelliteScore & { allocWeight }
export interface SatelliteScore {
  ticker:       string
  name:         string
  market:       'US' | 'KR'
  marketCapUsd: number | null
  growthPct:    number | null
  peg:          number | null
  tenScore:     number
  reason:       string
}

// 중소형 10배거 잠재 풀(100종목) — 코어(대형주)와 별개. 큐레이션 후보 풀(제1원칙: 분석값은 실데이터)
export const SATELLITE_UNIVERSE: { ticker: string; market: 'US' | 'KR'; name: string }[] = [
  { ticker: 'IONQ', market: 'US', name: 'IonQ' },
  { ticker: 'RGTI', market: 'US', name: 'Rigetti' },
  { ticker: 'TEM',  market: 'US', name: 'Tempus AI' },
  { ticker: 'RKLB', market: 'US', name: 'Rocket Lab' },
  { ticker: 'ASTS', market: 'US', name: 'AST SpaceMobile' },
  { ticker: 'CRDO', market: 'US', name: 'Credo Tech' },
  { ticker: 'ALAB', market: 'US', name: 'Astera Labs' },
  { ticker: 'HIMS', market: 'US', name: 'Hims & Hers' },
  { ticker: 'OSCR', market: 'US', name: 'Oscar Health' },
  { ticker: 'NBIS', market: 'US', name: 'Nebius' },
  { ticker: '278470', market: 'KR', name: '에이피알' },
  { ticker: '277810', market: 'KR', name: '레인보우로보틱스' },
  { ticker: '058470', market: 'KR', name: '리노공업' },
  { ticker: '240810', market: 'KR', name: '원익IPS' },
  { ticker: '347860', market: 'KR', name: '알체라' },
  { ticker: '389020', market: 'KR', name: '레이저쎌' },
  { ticker: '281740', market: 'KR', name: '레이크머티리얼즈' },
  { ticker: '348370', market: 'KR', name: '엔켐' },
  // US 소형·고성장 (SW/클라우드·핀테크·우주·청정에너지·바이오·로보틱스)
  { ticker: 'SOFI', market: 'US', name: 'SoFi Technologies' },
  { ticker: 'AFRM', market: 'US', name: 'Affirm' },
  { ticker: 'DKNG', market: 'US', name: 'DraftKings' },
  { ticker: 'RBLX', market: 'US', name: 'Roblox' },
  { ticker: 'SMCI', market: 'US', name: 'Super Micro Computer' },
  { ticker: 'ARM',  market: 'US', name: 'Arm Holdings' },
  { ticker: 'CELH', market: 'US', name: 'Celsius Holdings' },
  { ticker: 'DUOL', market: 'US', name: 'Duolingo' },
  { ticker: 'ENPH', market: 'US', name: 'Enphase Energy' },
  { ticker: 'FSLR', market: 'US', name: 'First Solar' },
  { ticker: 'CRSP', market: 'US', name: 'CRISPR Therapeutics' },
  { ticker: 'OKLO', market: 'US', name: 'Oklo' },
  { ticker: '403870', market: 'KR', name: 'HPSP' },
  { ticker: '357780', market: 'KR', name: '솔브레인' },
  { ticker: '140860', market: 'KR', name: '파크시스템스' },
  { ticker: '095340', market: 'KR', name: 'ISC' },
  { ticker: '087010', market: 'KR', name: '펩트론' },
  { ticker: '137400', market: 'KR', name: '피엔티' },
  { ticker: 'PATH', market: 'US', name: 'UiPath' },
  { ticker: 'AI',   market: 'US', name: 'C3.ai' },
  { ticker: 'GTLB', market: 'US', name: 'GitLab' },
  { ticker: 'MDB',  market: 'US', name: 'MongoDB' },
  { ticker: 'NET',  market: 'US', name: 'Cloudflare' },
  { ticker: 'DDOG', market: 'US', name: 'Datadog' },
  { ticker: 'SNOW', market: 'US', name: 'Snowflake' },
  { ticker: 'ESTC', market: 'US', name: 'Elastic' },
  { ticker: 'CFLT', market: 'US', name: 'Confluent' },
  { ticker: 'S',    market: 'US', name: 'SentinelOne' },
  { ticker: 'ZS',   market: 'US', name: 'Zscaler' },
  { ticker: 'BILL', market: 'US', name: 'Bill Holdings' },
  { ticker: 'TOST', market: 'US', name: 'Toast' },
  { ticker: 'HOOD', market: 'US', name: 'Robinhood' },
  { ticker: 'UPST', market: 'US', name: 'Upstart' },
  { ticker: 'LMND', market: 'US', name: 'Lemonade' },
  { ticker: 'NU',   market: 'US', name: 'Nu Holdings' },
  { ticker: 'SE',   market: 'US', name: 'Sea Limited' },
  { ticker: 'GRAB', market: 'US', name: 'Grab Holdings' },
  { ticker: 'ROKU', market: 'US', name: 'Roku' },
  { ticker: 'MELI', market: 'US', name: 'MercadoLibre' },
  { ticker: 'OPEN', market: 'US', name: 'Opendoor' },
  { ticker: 'LUNR', market: 'US', name: 'Intuitive Machines' },
  { ticker: 'RDW',  market: 'US', name: 'Redwire' },
  { ticker: 'ACHR', market: 'US', name: 'Archer Aviation' },
  { ticker: 'JOBY', market: 'US', name: 'Joby Aviation' },
  { ticker: 'SMR',  market: 'US', name: 'NuScale Power' },
  { ticker: 'BE',   market: 'US', name: 'Bloom Energy' },
  { ticker: 'RUN',  market: 'US', name: 'Sunrun' },
  { ticker: 'QS',   market: 'US', name: 'QuantumScape' },
  { ticker: 'CHPT', market: 'US', name: 'ChargePoint' },
  { ticker: 'VKTX', market: 'US', name: 'Viking Therapeutics' },
  { ticker: 'NTLA', market: 'US', name: 'Intellia' },
  { ticker: 'BEAM', market: 'US', name: 'Beam Therapeutics' },
  { ticker: 'RXRX', market: 'US', name: 'Recursion' },
  { ticker: 'TMDX', market: 'US', name: 'TransMedics' },
  { ticker: 'AEVA', market: 'US', name: 'Aeva' },
  { ticker: 'SOUN', market: 'US', name: 'SoundHound AI' },
  { ticker: 'BBAI', market: 'US', name: 'BigBear.ai' },
  { ticker: 'PSTG', market: 'US', name: 'Pure Storage' },
  { ticker: '039030', market: 'KR', name: '이오테크닉스' },
  { ticker: '064760', market: 'KR', name: '티씨케이' },
  { ticker: '098460', market: 'KR', name: '고영' },
  { ticker: '222800', market: 'KR', name: '심텍' },
  { ticker: '348210', market: 'KR', name: '넥스틴' },
  { ticker: '095610', market: 'KR', name: '테스' },
  { ticker: '036930', market: 'KR', name: '주성엔지니어링' },
  { ticker: '178320', market: 'KR', name: '서진시스템' },
  { ticker: '086390', market: 'KR', name: '유니테스트' },
  { ticker: '067310', market: 'KR', name: '하나마이크론' },
  { ticker: '108320', market: 'KR', name: 'LX세미콘' },
  { ticker: '214150', market: 'KR', name: '클래시스' },
  { ticker: '145020', market: 'KR', name: '휴젤' },
  { ticker: '084370', market: 'KR', name: '유진테크' },
  { ticker: '322310', market: 'KR', name: '오로스테크놀로지' },
  { ticker: '137310', market: 'KR', name: '에스디바이오센서' },
  { ticker: '091700', market: 'KR', name: '파트론' },
  { ticker: '056190', market: 'KR', name: '에스에프에이' },
  { ticker: '263750', market: 'KR', name: '펄어비스' },
  { ticker: '112040', market: 'KR', name: '위메이드' },
  { ticker: '293490', market: 'KR', name: '카카오게임즈' },
  { ticker: '035900', market: 'KR', name: 'JYP Ent.' },
  { ticker: '122870', market: 'KR', name: '와이지엔터테인먼트' },
  { ticker: '041510', market: 'KR', name: '에스엠' },
]

// 풀 일부를 라이브 채점(배치6). 크론(전체)·콜드폴백(소수) 공용
async function scoreSatellitePool(pool: typeof SATELLITE_UNIVERSE, base: string): Promise<SatelliteScore[]> {
  const scored: SatelliteScore[] = []
  for (let i = 0; i < pool.length; i += 6) {
    const batch = pool.slice(i, i + 6)
    const rs = await Promise.all(batch.map(async s => {
      try {
        const m = await buildSignalMetrics(s.ticker, s.market, s.name, base)
        if (!m) return null
        let mcUsd = m.marketCap
        if (mcUsd != null && s.market === 'KR') mcUsd = mcUsd / 1350
        const growthPct = m.revenueGrowth != null ? Math.round(m.revenueGrowth * 1000) / 10 : null
        const icr = m.interestCoverage
        const zombie = icr != null && icr < 1.5
        // 라이트 점수: 시총룸(40) + 성장(35) + 저PEG(25), 좀비면 강한 감점
        let sc = 0
        if (mcUsd != null) sc += mcUsd < 10e9 ? 40 : mcUsd < 50e9 ? 22 : 0
        if (growthPct != null) sc += growthPct >= 30 ? 35 : growthPct >= 18 ? 18 : 0
        if (m.peg != null && m.peg > 0) sc += m.peg < 0.5 ? 25 : m.peg < 1.0 ? 14 : 0
        if (zombie) sc = Math.min(sc, 30)   // 좀비는 위성에서도 강등(파산 위험)
        const reason = [
          mcUsd != null ? `시총 $${(mcUsd / 1e9).toFixed(1)}B` : null,
          growthPct != null ? `매출성장 ${growthPct.toFixed(0)}%` : null,
          m.peg != null && m.peg > 0 ? `PEG ${m.peg.toFixed(2)}` : null,
          zombie ? '⚠️좀비위험' : null,
        ].filter(Boolean).join(' · ')
        return { ticker: s.ticker, name: s.name, market: s.market, marketCapUsd: mcUsd, growthPct, peg: m.peg, tenScore: sc, reason }
      } catch { return null }
    }))
    for (const r of rs) if (r) scored.push(r)
  }
  return scored
}

// 크론용: 전체 100종목 채점 → 점수순 정렬 (cron/satellite-scores가 SAT_SCORE_KEY에 적재)
export async function computeSatelliteScores(base: string): Promise<SatelliteScore[]> {
  const scored = await scoreSatellitePool(SATELLITE_UNIVERSE, base)
  return scored.sort((a, b) => b.tenScore - a.tenScore)
}

// 리밸런싱 요청: 캐시 우선(라이브 fetch 0). 콜드(크론 전)면 상위 30만 라이브 채점해 타임아웃 방지
export async function screenSatellite(base: string, heldSet: Set<string>, maxPick: number): Promise<SatelliteScore[]> {
  let scored = await getCache<SatelliteScore[]>(SAT_SCORE_KEY, 36 * 3600_000)
  if (!scored || scored.length === 0) {
    scored = (await scoreSatellitePool(SATELLITE_UNIVERSE.slice(0, 30), base)).sort((a, b) => b.tenScore - a.tenScore)
    if (scored.length) await setCache(SAT_SCORE_KEY, scored)
  }
  return scored.filter(s => !heldSet.has(s.ticker.toUpperCase())).slice(0, maxPick)
}
