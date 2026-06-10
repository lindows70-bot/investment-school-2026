// 🏛️ 연준 양대책무(Dual Mandate) 대시보드 — 고용 안정 4종+삼의 법칙 + 워시 의장의 절사평균 PCE
// Zero Cost(FRED 무료)·Lazy Caching(12h)·Zero Input·교육. 계절/macro-regime SSOT는 건드리지 않음(참고 맥락만)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const KEY = process.env.FRED_API_KEY
async function fred(series: string, limit = 14, units = ''): Promise<{ date: string; v: number }[]> {
  if (!KEY) return []
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${limit}${units}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((o: { v: number }) => isFinite(o.v))
  } catch { return [] }
}

export interface DualMandateResult {
  // 💼 고용
  payems: { latest: number; momK: number; date: string }        // 비농업 고용 + 전월대비(천명)
  unrate: { latest: number; date: string }                       // 실업률 %
  icsa: { latest: number; avg4w: number; rising: boolean; date: string; history: { date: string; v: number }[] }  // 주간 청구
  jobRatio: { ratio: number; jolts: number; unemploy: number; date: string }   // 구인배율 = 구인/실업자
  sahm: { value: number; gap: number; date: string }            // 삼의 법칙(0.5 임계까지 gap)
  laborStatus: 'hot' | 'balanced' | 'cooling'                   // 고용 신호등
  laborNote: string
  // 🎯 물가 — 워시의 절사평균
  trimmedPce: { latest: number; target: number; date: string }  // 달라스 절사평균 PCE(12M %)
  headlinePce: number                                            // 헤드라인 PCE YoY % (노이즈 비교)
  noiseGap: number                                               // 헤드라인 − 절사평균(%p)
  warshNote: string
  asOf: string
}

export async function GET() {
  const cacheKey = 'fed-dual-mandate-v1'
  const cached = await getCache<DualMandateResult>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [payems, unrate, icsa, jolts, unemploy, sahm, trim, headPce] = await Promise.all([
    fred('PAYEMS', 3), fred('UNRATE', 2), fred('ICSA', 26), fred('JTSJOL', 2),
    fred('UNEMPLOY', 2), fred('SAHMREALTIME', 2), fred('PCETRIM12M159SFRBDAL', 2), fred('PCEPI', 14, '&units=pc1'),
  ])

  const momK = payems.length >= 2 ? Math.round(payems[0].v - payems[1].v) : 0
  const icsaLatest = icsa[0]?.v ?? 0
  const avg4w = icsa.length >= 4 ? Math.round(icsa.slice(0, 4).reduce((s, x) => s + x.v, 0) / 4) : icsaLatest
  const prev4w = icsa.length >= 8 ? icsa.slice(4, 8).reduce((s, x) => s + x.v, 0) / 4 : avg4w
  const icsaRising = avg4w > prev4w
  const ratio = unemploy[0]?.v ? Math.round((jolts[0]?.v ?? 0) / unemploy[0].v * 100) / 100 : 0
  const sahmV = sahm[0]?.v ?? 0
  const trimV = trim[0]?.v ?? 0
  const headV = headPce[0]?.v != null ? Math.round(headPce[0].v * 100) / 100 : 0

  // 🚦 고용 신호등 — 냉각(침체경고) > 과열 > 균형
  let laborStatus: DualMandateResult['laborStatus'] = 'balanced'
  let laborNote = ''
  if (sahmV >= 0.5 || (avg4w >= 260_000 && icsaRising) || momK < 50) {
    laborStatus = 'cooling'
    laborNote = sahmV >= 0.5 ? '삼의 법칙 발동 — 침체 진입 신호. 연준 조기 인하 압박이 커집니다.'
      : '고용 둔화 조짐(청구건수 상승·고용증가 둔화) — 연준이 인하 카드를 만질 수 있는 환경.'
  } else if (ratio >= 1.5 && (unrate[0]?.v ?? 5) < 4.0) {
    laborStatus = 'hot'
    laborNote = '구인 과다·낮은 실업률 — 임금발 인플레 압력. 연준은 동결·긴축을 유지할 명분이 있습니다.'
  } else {
    laborNote = '고용이 과열도 냉각도 아닌 균형(연착륙) 구간 — 연준이 데이터를 보며 신중히 기다릴 환경입니다.'
  }

  const noiseGap = Math.round((headV - trimV) * 100) / 100
  const warshNote = trimV === 0 ? '자료 수집 중'
    : `워시 의장의 기조 물가(절사평균 PCE) ${trimV}%는 헤드라인 ${headV}%보다 ${noiseGap > 0 ? `${noiseGap}%p 낮습니다` : '높습니다'}. ` +
      (noiseGap >= 0.8 ? '헤드라인이 일시 충격으로 부풀어 있어, 워시 연준은 시장 기대보다 인하에 열려 있을 수 있습니다.'
        : trimV > 2.5 ? '기조 물가가 여전히 목표(2%)를 웃돌아 연준은 신중할 가능성이 높습니다.'
          : '기조 물가가 목표(2%)에 근접해 안정적입니다.')

  const result: DualMandateResult = {
    payems: { latest: payems[0]?.v ?? 0, momK, date: payems[0]?.date ?? '' },
    unrate: { latest: unrate[0]?.v ?? 0, date: unrate[0]?.date ?? '' },
    icsa: { latest: icsaLatest, avg4w, rising: icsaRising, date: icsa[0]?.date ?? '', history: icsa.slice(0, 16).reverse() },
    jobRatio: { ratio, jolts: jolts[0]?.v ?? 0, unemploy: unemploy[0]?.v ?? 0, date: jolts[0]?.date ?? '' },
    sahm: { value: sahmV, gap: Math.round((0.5 - sahmV) * 100) / 100, date: sahm[0]?.date ?? '' },
    laborStatus, laborNote,
    trimmedPce: { latest: trimV, target: 2.0, date: trim[0]?.date ?? '' },
    headlinePce: headV, noiseGap, warshNote,
    asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
