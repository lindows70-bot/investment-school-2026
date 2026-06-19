// 현재 매크로 계절(US·KR 4계절) 공용 산출 — 통합추천·내종목수급·의사결정 스냅샷이 같은 SSOT 사용
import { getCache, setCache } from '@/lib/appCache'
import { growthFromCli, inflationFromRegime, seasonOf, type Quadrant } from '@/lib/seasonNavigator'
import { fetchMacroData } from '@/lib/macroPhaseScreener'

export interface CurrentSeason {
  usQuad: Quadrant
  krQuad: Quadrant
  cpiYoY: number
  rateDir: 'cut' | 'hold' | 'hike'
}

async function fetchCli(sid: string, key: string): Promise<{ cli: number; cliPrev: number } | null> {
  const c = await getCache<{ cli: number; cliPrev: number }>(key, 12 * 3600_000)
  if (c) return c
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${sid}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=4`, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const j = await r.json(); const o = (j.observations ?? []).map((x: { value: string }) => parseFloat(x.value)).filter((v: number) => !isNaN(v))
    if (o.length < 4) return null
    const out = { cli: o[0], cliPrev: o[3] }; await setCache(key, out); return out
  } catch { return null }
}

export async function getCurrentSeason(base: string): Promise<CurrentSeason> {
  let cpiYoY = 2.5, rateDir: 'cut' | 'hold' | 'hike' = 'hold'
  try { const md = await fetchMacroData(base); cpiYoY = typeof md.cpiYoY === 'number' ? md.cpiYoY : cpiYoY; rateDir = md.rateDir ?? 'hold' } catch { /* graceful */ }
  const [usCli, krCli] = await Promise.all([fetchCli('USALOLITOAASTSAM', 'oecd-cli-us-v1'), fetchCli('KORLOLITOAASTSAM', 'oecd-cli-kr-v1')])
  const inf = inflationFromRegime(cpiYoY, rateDir)
  return {
    usQuad: seasonOf(growthFromCli(usCli?.cli ?? 100, usCli?.cliPrev ?? 100), inf),
    krQuad: seasonOf(growthFromCli(krCli?.cli ?? 100, krCli?.cliPrev ?? 100), inf),
    cpiYoY, rateDir,
  }
}
