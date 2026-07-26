/**
 * GET /api/tech-screener[?refresh=1]
 * 🔎 기술적 종목 검색기 — 유니버스를 순회해 '지금 기술적 셋업이 성립한 종목'을 찾는다.
 *
 * 설계
 *  - 유니버스 = `macro-screened-universe`(통합추천·리밸런싱이 공유하는 SSOT). 섹터·업종·PEG·모멘텀 메타를 그대로 재사용
 *  - 판정 = `techScreener.evaluateSetups`(entryTiming·techSignals 재사용 — 신규 판정기 0)
 *  - 캔들 = `getTechCandles`(일별 캐시) → 크론이 하루 1회 워밍하면 학생 요청은 캐시 히트로 즉시.
 *    부수효과: 기술적 차트 화면도 같은 캐시를 쓰므로 유니버스 종목이 전부 빨라진다
 *  - 공개 라우트(개인정보 없음). 크론이 같은 경로를 호출하는 win-lose 패턴
 *
 * ⛔ 이건 WHEN(타이밍)만 본다 — 종목 선정(WHAT)은 학생이 펀더멘탈로 판단한다(화면이 동선 제공)
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles } from '@/lib/techChartData'
import { evaluateSetups, SCREEN_SETUPS, type ScreenHit, type SetupMeta } from '@/lib/techScreener'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface TechScreenerApi {
  asOf: string
  universe: number          // 유니버스 종목 수
  scanned: number           // 캔들 확보에 성공한 종목 수
  hits: ScreenHit[]
  setups: SetupMeta[]       // 필터 메타 + 백테스트 성적
  counts: Record<string, number>   // 셋업별 성립 종목 수
  note: string
}

export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  const key = `tech-screener-v1:${kstDate()}`
  if (!refresh) {
    const cached = await getCache<TechScreenerApi>(key, 12 * 3600_000)
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })
  }

  const uni = (await getCache<ScreenedStock[]>('macro-screened-universe:v10', 8 * 24 * 3600_000)) ?? []
  if (uni.length === 0) {
    return NextResponse.json({ error: 'universe_cold', note: '유니버스 캐시가 비었습니다. 주간 스크리너 크론(월 04:00 KST) 이후 다시 시도하세요.' }, { status: 200 })
  }

  const hits: ScreenHit[] = []
  let scanned = 0
  const CONC = 10
  const q = [...uni]
  async function worker() {
    while (q.length) {
      const s = q.shift(); if (!s) break
      try {
        const D = await getTechCandles(s.ticker, s.market, 'D')
        if (!D || D.length < 130) continue
        scanned++
        const ev = evaluateSetups(D)
        if (!ev) continue
        hits.push({
          ...ev,
          ticker: s.ticker, name: s.name ?? s.ticker, market: s.market,
          sector: s.sector ?? null, industry: s.industry ?? null,
          knife: !!s.knife, peg: s.peg ?? null, momentumScore: s.momentumScore ?? null,
        })
      } catch { /* 종목 하나 실패로 전체를 멈추지 않는다 */ }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))

  // 정렬: 정예 타점 우선 → 셋업 개수 → 모멘텀
  const rank = (h: ScreenHit) => (h.setups.includes('prime') ? 1000 : 0) + h.setups.length * 10 + (h.momentumScore ?? 0) / 100
  hits.sort((a, b) => rank(b) - rank(a))

  const counts: Record<string, number> = {}
  for (const s of SCREEN_SETUPS) counts[s.key] = hits.filter(h => h.setups.includes(s.key)).length

  const out: TechScreenerApi = {
    asOf: new Date().toISOString(), universe: uni.length, scanned, hits,
    setups: SCREEN_SETUPS, counts,
    note: '기술적 타이밍(WHEN)만 판정합니다. 종목 선정은 펀더멘탈로 직접 판단하세요.',
  }
  // 스캔 성공률이 과반 미만이면 캐시 박제 금지(외부 소스 장애 시 빈 결과가 하루 고정되는 것 방지)
  if (scanned >= uni.length * 0.5) await setCache(key, out)
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
