// 🌐 피델리티식 글로벌 비즈니스 사이클 — OECD CLI(FRED) 13개국 실데이터로 국면(Early/Mid/Late/Recession) 자동 판정.
// ⚠️ 피델리티 독점 배치를 베끼지 않음(제1원칙) — CLI 레벨(100 기준)×3개월 모멘텀으로 결정론 판정. 발표 시차 ~1개월 캐비엇.
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

export type CyclePhase = 'early' | 'mid' | 'late' | 'recession'
export interface CycleCountry {
  code: string; ko: string; flag: string
  cli: number; momentum: number
  phase: CyclePhase
  curveX: number            // 0~100 곡선상 위치
  spark: number[]           // CLI 최근 24개월
  asOfMonth: string         // 최신 관측월
}
export interface GlobalCycleResult {
  countries: CycleCountry[]
  phaseGuide: { phase: CyclePhase; ko: string; favored: string; note: string }[]
  asOf: string
}

// FRED OECD 경기선행지수(진폭조정) — 13개국 전부 실측 검증(2026-07, 최신 2026-05)
const COUNTRIES: { code: string; ko: string; flag: string; series: string }[] = [
  { code: 'US', ko: '미국', flag: '🇺🇸', series: 'USALOLITOAASTSAM' },
  { code: 'KR', ko: '한국', flag: '🇰🇷', series: 'KORLOLITOAASTSAM' },
  { code: 'CN', ko: '중국', flag: '🇨🇳', series: 'CHNLOLITOAASTSAM' },
  { code: 'JP', ko: '일본', flag: '🇯🇵', series: 'JPNLOLITOAASTSAM' },
  { code: 'DE', ko: '독일', flag: '🇩🇪', series: 'DEULOLITOAASTSAM' },
  { code: 'GB', ko: '영국', flag: '🇬🇧', series: 'GBRLOLITOAASTSAM' },
  { code: 'FR', ko: '프랑스', flag: '🇫🇷', series: 'FRALOLITOAASTSAM' },
  { code: 'IT', ko: '이탈리아', flag: '🇮🇹', series: 'ITALOLITOAASTSAM' },
  { code: 'CA', ko: '캐나다', flag: '🇨🇦', series: 'CANLOLITOAASTSAM' },
  { code: 'AU', ko: '호주', flag: '🇦🇺', series: 'AUSLOLITOAASTSAM' },
  { code: 'IN', ko: '인도', flag: '🇮🇳', series: 'INDLOLITOAASTSAM' },
  { code: 'BR', ko: '브라질', flag: '🇧🇷', series: 'BRALOLITOAASTSAM' },
  { code: 'MX', ko: '멕시코', flag: '🇲🇽', series: 'MEXLOLITOAASTSAM' },
]

// 국면별 유리 자산 — 피델리티 공개 방법론의 교과서 경향(상수 허용: 모닝스타 밴드와 같은 원리·교육용)
const PHASE_GUIDE: GlobalCycleResult['phaseGuide'] = [
  { phase: 'early', ko: '회복 (Early)', favored: '경기민감주·소형주·회사채·부동산', note: '바닥 반등 국면 — 신용 완화와 재고 재축적이 시작. 역사적으로 주식 수익률이 가장 높은 구간.' },
  { phase: 'mid', ko: '확장 (Mid)', favored: 'IT·커뮤니케이션 등 성장주 — 가장 긴 국면', note: '성장이 견고하고 이익이 뒷받침. 리스크 자산 우호적이나 밸류에이션 관리 필요.' },
  { phase: 'late', ko: '후기 (Late)', favored: '에너지·소재·필수소비재·인플레 헤지', note: '성장 감속 + 물가·금리 압력. 방어주와 실물자산이 상대적 강세인 경향.' },
  { phase: 'recession', ko: '수축 (Recession)', favored: '국채·현금·필수소비재·헬스케어', note: '이익 침체 국면 — 듀레이션(장기채)과 저변동 방어주가 역사적으로 상대 우위.' },
]

async function fredSeries(series: string): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${key}&file_type=json&observation_start=2023-06-01`, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) })).filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}

// 국면 판정: CLI 레벨(100 기준) × 3개월 모멘텀 2×2 (4계절 내비게이터 성장축과 동일 철학)
function judge(cli: number, momentum: number): { phase: CyclePhase; curveX: number } {
  const clamp = (t: number) => Math.max(0.06, Math.min(0.94, t))   // 구간 경계에 딱 붙지 않게
  if (cli < 100 && momentum > 0) return { phase: 'early', curveX: 0 + clamp((cli - 96) / 4) * 25 }          // 100에 가까울수록 회복 후반
  if (cli >= 100 && momentum > 0) return { phase: 'mid', curveX: 25 + clamp((cli - 100) / 3) * 25 }          // 100 위로 갈수록 확장 심화
  if (cli >= 100) return { phase: 'late', curveX: 50 + clamp(1 - (cli - 100) / 3) * 25 }                     // 100으로 내려올수록 후기 심화
  return { phase: 'recession', curveX: 75 + clamp((100 - cli) / 3) * 25 }                                    // 100 아래로 깊을수록 수축 심화
}

export async function GET() {
  const cacheKey = 'global-cycle-v1'
  const cached = await getCache<GlobalCycleResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const series = await Promise.all(COUNTRIES.map(c => fredSeries(c.series)))
  const countries: CycleCountry[] = []
  COUNTRIES.forEach((c, i) => {
    const s = series[i]
    if (s.length < 4) return   // 데이터 부족 국가는 정직하게 제외
    const cli = s[s.length - 1].v
    const momentum = cli - s[s.length - 4].v   // 3개월차
    const { phase, curveX } = judge(cli, momentum)
    countries.push({
      code: c.code, ko: c.ko, flag: c.flag,
      cli: Math.round(cli * 100) / 100, momentum: Math.round(momentum * 100) / 100,
      phase, curveX: Math.round(curveX * 10) / 10,
      spark: s.slice(-24).map(x => Math.round(x.v * 100) / 100),
      asOfMonth: s[s.length - 1].date.slice(0, 7),
    })
  })

  const result: GlobalCycleResult = { countries, phaseGuide: PHASE_GUIDE, asOf: new Date().toISOString() }
  if (countries.length >= 8) await setCache(cacheKey, result)   // 과반 실패 시 캐시 박제 금지
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
