// 한국은행 ECOS 오픈API 공용 fetcher — 부동산·거시 시계열(서버 전용, ECOS_API_KEY)
// 항목코드는 2026-07-11 StatisticItemList 실측으로 확정(docs/real-estate/context-notes.md)

export interface EcosRow { time: string; value: number; item: string }

/** 통계 시계열 조회 — cycle: M(월)/Q/A/W, item 코드는 실측 확정값 사용 */
export async function ecosSeries(statCode: string, cycle: string, start: string, end: string, itemCode: string, limit = 1000): Promise<EcosRow[]> {
  const key = process.env.ECOS_API_KEY
  if (!key) return []
  try {
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/${limit}/${statCode}/${cycle}/${start}/${end}/${itemCode}`
    // ⚠️ no-store 필수 — endYm이 같은 달이면 URL이 동일해 Next Data Cache가 옛 응답을 박제(새 달 발행이 조용히 미반영)
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
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
