// 📈 OECD 경기선행지수(CLI) 수집 SSOT — 계절 판정의 '성장축' 원천 하나뿐
//
// ⚠️ 왜 합쳤나(2026-08-24): 똑같은 `fetchCli` 가 **3파일에 복제**돼 있었다
//    (regionSeason · portfolio-flow · season-navigator). 셋이 같은 캐시 키 `oecd-cli-*-v1` 을 공유하는데
//    킬스위치용으로 필드를 하나 늘리려면 키를 올려야 했고, 그러면 **writer 한 곳만 고쳐도 reader 둘이 조용히 죽는다**
//    (CLAUDE.md 캐시 항목의 최다 재발 함정 — 어제 벌집순환에서 같은 구조를 만났다).
//    키를 상수로 묶고 수집도 여기 하나로 모은다.
//
// ⛔ 이 fetch 를 다른 파일에 다시 쓰지 마라. 성장축이 화면마다 갈린다.
import { getCache, setCache } from '@/lib/appCache'

/** FRED OECD CLI 시리즈 ID — 지역별(실측 확인) */
export const OECD_CLI_SERIES = {
  US: 'USALOLITOAASTSAM', KR: 'KORLOLITOAASTSAM',
  DE: 'DEULOLITOAASTSAM', FR: 'FRALOLITOAASTSAM', IT: 'ITALOLITOAASTSAM', GB: 'GBRLOLITOAASTSAM',
  JP: 'JPNLOLITOAASTSAM', CN: 'CHNLOLITOAASTSAM',
} as const
export type CliRegion = keyof typeof OECD_CLI_SERIES

// v2: cliNextPrev(다음 발표의 비교 기준)·month(기준월) 추가 — 필드가 늘면 키를 올린다
export const OECD_CLI_KEY = (region: CliRegion) => `oecd-cli-${region.toLowerCase()}-v2`

export interface CliPoint {
  /** 최신 레벨(100 = 추세) */
  cli: number
  /** 3개월 전 레벨 — 성장 모멘텀 비교 기준(판정식이 쓰는 값) */
  cliPrev: number
  /** 🔌 **다음 발표에서** cliPrev 가 될 값. 성장축이 뒤집히는 임계선이라 킬스위치가 쓴다.
   *  (이번 달 비교 기준이 3개월 전이면, 다음 달 비교 기준은 2개월 전 값이다) */
  cliNextPrev: number
  /** 최신 관측 기준월 'YYYY-MM' — 발표 지연을 화면이 밝히기 위해 */
  month: string
}

/** 지역 CLI 최신 4개 관측 → 레벨·모멘텀·다음 임계선. 12h 공유 캐시(호출부가 늘어도 비용 0) */
export async function fetchCli(region: CliRegion): Promise<CliPoint | null> {
  const key = OECD_CLI_KEY(region)
  const cached = await getCache<CliPoint>(key, 12 * 3600_000)
  if (cached) return cached
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return null
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${OECD_CLI_SERIES[region]}`
      + `&api_key=${apiKey}&file_type=json&sort_order=desc&limit=4`
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    const obs = (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ d: String(o.date), v: parseFloat(o.value) }))
      .filter((o: { v: number }) => isFinite(o.v))
    if (obs.length < 4) return null   // 4개 미만이면 3개월 모멘텀을 만들 수 없다 — 추정하지 않는다
    const out: CliPoint = {
      cli: obs[0].v, cliPrev: obs[3].v, cliNextPrev: obs[2].v,
      month: String(obs[0].d).slice(0, 7),
    }
    await setCache(key, out)
    return out
  } catch { return null }
}
