// 한국은행 ECOS 오픈API 공용 fetcher — 부동산·거시 시계열(서버 전용, ECOS_API_KEY)
// 항목코드는 2026-07-11 StatisticItemList 실측으로 확정(docs/real-estate/context-notes.md)

export interface EcosRow { time: string; value: number; item: string }

/** 통계 시계열 조회 — cycle: M(월)/Q/A/W, item 코드는 실측 확정값 사용 */
export async function ecosSeries(statCode: string, cycle: string, start: string, end: string, itemCode: string, limit = 1000): Promise<EcosRow[]> {
  const key = process.env.ECOS_API_KEY
  if (!key) return []
  try {
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/${limit}/${statCode}/${cycle}/${start}/${end}/${itemCode}`
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return []
    const j = await r.json()
    const rows = j?.StatisticSearch?.row ?? []
    return rows
      .map((x: { TIME: string; DATA_VALUE: string; ITEM_NAME1?: string }) => ({
        time: String(x.TIME), value: parseFloat(x.DATA_VALUE), item: String(x.ITEM_NAME1 ?? ''),
      }))
      .filter((x: EcosRow) => isFinite(x.value))
  } catch { return [] }
}
