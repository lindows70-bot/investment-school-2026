// 🌦️ 지역별 매크로 계절 SSOT — 같은 종목의 계절 축이 화면마다 달라지지 않게 한 곳에서 만든다
//
// ⚠️ 왜 만들었나(2026-08-09 실측): 하이네켄(🇳🇱 HEIA.AS)의 계절 축이
//    통합추천 80 vs 종합판정 55 로 갈렸다. 나머지 5축은 이미 SSOT 라 완전히 같았는데 이것만 남았다.
//    원인은 국면 자체였다 — 통합추천은 **origin 별 국면**(euQuad)을 쓰는데
//    종합판정은 `market === 'KR' ? krQuad : usQuad` 라 유럽·일본·중국 종목에 **미국 국면**을 씌웠다.
//    `market: 'US'` 는 '한국이 아님'이라는 뜻일 뿐이라는 기존 함정(marketFlag)이 계절 축에서 재발한 것이다.
//
// ⛔ 이 계산을 다른 파일에 복제하지 않는다. 통합추천도 여기서 가져다 쓴다 —
//    "통합추천과 동일"이라고 주석으로 약속했다가 값이 갈린 사고가 이미 두 번 있었다.
import { getCache, setCache } from '@/lib/appCache'
import { growthFromCli, inflationFromRegime, seasonOf, type Quadrant } from '@/lib/seasonNavigator'
import { fetchMacroData, EU_TICKER_SET, JP_TICKER_SET, CN_TICKER_SET } from '@/lib/macroPhaseScreener'
import { fetchCli, type CliPoint } from '@/lib/oecdCli'   // 📈 CLI 수집 SSOT(3파일 복제를 합침 — 2026-08-24)

export type Origin = 'US' | 'KR' | 'EU' | 'JP' | 'CN'

export interface RegionSeasons {
  quad: Record<Origin, Quadrant>
  cpiYoY: number
  rateDir: 'cut' | 'hold' | 'hike'
}

/** 🌍 종목의 '자산 국적' — 상장 시장(market)이 아니라 origin 으로 계절을 고른다.
 *  통합추천 items[].origin 과 **같은 판정**(EU→JP→CN 세트 순, 그다음 market). */
export function originOf(ticker: string, market: string): Origin {
  if (EU_TICKER_SET.has(ticker)) return 'EU'
  if (JP_TICKER_SET.has(ticker)) return 'JP'
  if (CN_TICKER_SET.has(ticker)) return 'CN'
  return market === 'KR' ? 'KR' : 'US'
}

/** 🇪🇺 유로존 HICP(소비자물가) YoY — 유럽 독자 물가축. 실패 시 글로벌(US) 물가로 폴백 */
async function fetchEuHicp(): Promise<number | null> {
  const c = await getCache<{ v: number }>('eu-hicp-yoy-v1', 24 * 3600_000)
  if (c) return c.v
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CP0000EZ19M086NEST&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=2&units=pc1`, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const j = await r.json()
    const o = (j.observations ?? []).map((x: { value: string }) => parseFloat(x.value)).filter((v: number) => !isNaN(v))
    if (!o.length) return null
    await setCache('eu-hicp-yoy-v1', { v: o[0] })
    return o[0]
  } catch { return null }
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** 🌦️ 5개 지역 계절을 한 번에 산출. CLI 캐시(12h)·HICP 캐시(24h)를 공유하므로 호출 비용은 사실상 0. */
export async function getRegionSeasons(base: string): Promise<RegionSeasons> {
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold'
  try {
    const md = await fetchMacroData(base)
    cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY
    rateDir = md.rateDir ?? 'hold'
  } catch { /* graceful */ }

  const [usCli, krCli, deCli, frCli, itCli, gbCli, jpCli, cnCli, euHicp] = await Promise.all([
    fetchCli('US'), fetchCli('KR'), fetchCli('DE'), fetchCli('FR'),
    fetchCli('IT'), fetchCli('GB'), fetchCli('JP'), fetchCli('CN'),
    fetchEuHicp(),
  ])
  const inf = inflationFromRegime(cpiYoY, rateDir)
  const US = seasonOf(growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100), inf)
  const KR = seasonOf(growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100), inf)
  // 🇪🇺 유로존 통합 CLI(EA19)는 2022 중단(stale)이라 대국(독·프·이·영) 신선 CLI 평균으로 성장축 +
  //    유로존 HICP 로 물가축. 2개국 이상 있을 때만 쓰고, 부족하면 US 국면으로 폴백한다.
  const euClis = [deCli, frCli, itCli, gbCli].filter((c): c is CliPoint => c != null)
  const EU = euClis.length >= 2
    ? seasonOf(growthFromCli(avg(euClis.map(c => c.cli)), avg(euClis.map(c => c.cliPrev))), euHicp != null ? inflationFromRegime(euHicp, rateDir) : inf)
    : US
  // 🇯🇵🇨🇳 각 OECD CLI(신선)로 성장축 + 글로벌 물가축(한국과 같은 방식 — 일본 CPI 미제공·중국 CPI stale)
  const JP = jpCli ? seasonOf(growthFromCli(jpCli.cli, jpCli.cliPrev), inf) : US
  const CN = cnCli ? seasonOf(growthFromCli(cnCli.cli, cnCli.cliPrev), inf) : US

  return { quad: { US, KR, EU, JP, CN }, cpiYoY, rateDir }
}
