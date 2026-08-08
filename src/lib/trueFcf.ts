// 💵 진짜 FCF SSOT — Yahoo `financialData.freeCashflow` 를 버리고 현금흐름표에서 직접 계산(OCF − CapEx)
//
// ⚠️ 왜 만들었나(실측 2026-08-08): financialData.freeCashflow 는 정의 불명의 값이다.
//    · EQNR — OCF 23.1B 인데 FCF 29.4B(**OCF보다 큼** = CapEx 음수여야 가능한 불가능한 값)
//    · MSFT — 실제 67.0B 인데 16.5B(1/4) · NVDA 119.1B→46.3B · AAPL 136.7B→107.7B
//    같은 응답의 `operatingCashflow` 는 분기 4개 합산과 **완전히 일치**했고(23.1=23.1·182.9=182.9·
//    125.6=125.6·146.7=146.7), FTS 의 freeCashFlow 도 OCF+CapEx 검산을 정확히 통과했다.
//    → 신뢰할 수 없는 건 freeCashflow 필드 하나뿐. 현금흐름표에서 직접 계산한다.
//
// 이 값이 쓰이는 곳: 통합추천 💎가치 축(FCF수익률)·🛟방어 가중·버핏 현금 체크·DCF 입력.
// ⛔ 틀린 값 폴백 금지 — 계산 불가면 null(지표 보류). 틀린 가격은 없는 가격보다 나쁘다.
import { getCache, setCache } from '@/lib/appCache'

export interface TrueFcf {
  fcf: number | null            // 재무통화 기준(환산 전 — 호출부가 finCurrency 로 환산)
  ocf: number | null
  source: 'ttm' | 'annual' | 'none'   // ttm = 최근 4분기 합산 · annual = 최신 회계연도
  period: string | null
  /** 연간 FCF 시계열(오래된→최신, 환산 전 원값) — TTM 이 다년 현금창출력을 대표하는지 판별용.
   *  실측(2026-08-08): IPARK TTM +28.2% 인데 4년 합산은 적자(2022 −1.87조) — 한 해 수치가 '우수'로 둔갑 */
  annualFcf: { y: string; fcf: number }[]
}

const NONE: TrueFcf = { fcf: null, ocf: null, source: 'none', period: null, annualFcf: [] }
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

export type FcfNature = 'mirage' | 'volatile' | 'steady' | 'na'

export interface FcfNatureResult {
  kind: FcfNature
  /** 점수·배지 판정에 쓸 보수적 수익률(%) — mirage/volatile 은 다년 평균, steady 는 TTM */
  scoreYieldPct: number | null
  /** 학생 화면용 한 줄(표본수 병기). steady/na 는 null */
  note: string | null
}

/** 💵 TTM FCF수익률이 다년 현금창출력을 대표하는가 — 판정·문구 SSOT(스크리너·stock-fcf 공용).
 *  임계 근거(실측 15종): 안정군(MSFT·오리온·글로비스·DL이앤씨)은 평균/TTM ≥ 0.75, 문제군은 0.65↓ 또는 음수.
 *  nYears<3 이면 '합산 적자'를 말할 표본이 안 된다(가짜 정밀 금지) → 판정 보류(na). */
export function assessFcfNature(ttmYieldPct: number | null, avgYieldPct: number | null, nYears: number): FcfNatureResult {
  if (ttmYieldPct == null || avgYieldPct == null || nYears < 3) return { kind: 'na', scoreYieldPct: ttmYieldPct, note: null }
  if (avgYieldPct < 0 && ttmYieldPct > 0) {
    return { kind: 'mirage', scoreYieldPct: avgYieldPct,
      note: `최근 1년만 흑자 — 최근 ${nYears}년을 합치면 현금흐름 적자예요(연평균 ${avgYieldPct}%)` }
  }
  if (ttmYieldPct >= 5 && avgYieldPct >= 0 && avgYieldPct < ttmYieldPct * 0.7) {
    return { kind: 'volatile', scoreYieldPct: avgYieldPct,
      note: `${nYears}년 평균은 ${avgYieldPct}% — 올해 수치(${ttmYieldPct}%)가 유난히 좋은 해일 수 있어요` }
  }
  return { kind: 'steady', scoreYieldPct: ttmYieldPct, note: null }
}

/** 현금흐름표 기반 FCF. 최근 4분기 합산(TTM) 우선 · 분기가 모자라면 최신 연간.
 *  캐시 7일 — 분기 실적은 3개월에 한 번 바뀌므로 길게 잡아 전수 스캔의 호출 부담을 없앤다. */
export async function getTrueFcf(ticker: string, market: 'KR' | 'US'): Promise<TrueFcf> {
  // v2: annualFcf 시계열 추가(성격 판별용) — 필드가 늘었으므로 키 범프(옛 캐시는 annualFcf 가 undefined)
  const cacheKey = `true-fcf-v2:${ticker}:${market}`
  const cached = await getCache<TrueFcf>(cacheKey, 7 * 24 * 3600_000)
  if (cached) return cached
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const sym = market === 'KR' ? `${ticker.replace(/\D/g, '')}.KS` : ticker

    // 분기(TTM용) + 연간(성격 판별용) — 연간은 폴백이 아니라 상시 수집으로 승격(캐시 7일이라 호출 부담 동일 수준)
    const [q, a] = await Promise.all([
      yf.fundamentalsTimeSeries(sym, { period1: '2024-01-01', type: 'quarterly', module: 'cash-flow' }).catch(() => null),
      yf.fundamentalsTimeSeries(sym, { period1: '2021-01-01', type: 'annual', module: 'cash-flow' }).catch(() => null),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aa: any[] = Array.isArray(a) ? a : (a?.timeSeries ?? [])
    const years = aa
      .map(r => ({
        d: (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10),
        fcf: num(r.freeCashFlow), ocf: num(r.operatingCashFlow), capex: num(r.capitalExpenditure),
      }))
      .filter(x => x.ocf != null)
      .sort((a2, b2) => a2.d.localeCompare(b2.d))
    // 연간 FCF — FTS freeCashFlow 는 OCF+CapEx 검산을 통과한 값(fd.freeCashflow 와 달리 신뢰 가능)
    const annualFcf = years
      .map(y2 => ({ y: y2.d.slice(0, 4), fcf: y2.fcf ?? (y2.capex != null ? (y2.ocf as number) + y2.capex : null) }))
      .filter((x): x is { y: string; fcf: number } => x.fcf != null)

    // 분기 — 최근 4개 합산이 진짜 TTM. CapEx 는 음수로 오므로 그대로 더한다(실측 검산 완료).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qa: any[] = Array.isArray(q) ? q : (q?.timeSeries ?? [])
    const rows = qa
      .map(r => ({
        d: (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10),
        ocf: num(r.operatingCashFlow), capex: num(r.capitalExpenditure),
      }))
      .filter(x => x.ocf != null)
      .sort((a2, b2) => a2.d.localeCompare(b2.d))
    const last4 = rows.slice(-4)
    if (last4.length === 4 && last4.every(r => r.capex != null)) {
      const ocf = last4.reduce((acc, r) => acc + (r.ocf as number), 0)
      const capex = last4.reduce((acc, r) => acc + (r.capex as number), 0)
      const out: TrueFcf = { fcf: ocf + capex, ocf, source: 'ttm', period: `${last4[0].d}~${last4[3].d}`, annualFcf }
      await setCache(cacheKey, out)
      return out
    }

    // 폴백 — 최신 회계연도(분기 결측 종목: 일부 KR·신규 상장)
    const y = years[years.length - 1]
    if (y) {
      const fcf = y.fcf ?? (y.capex != null ? (y.ocf as number) + y.capex : null)
      const out: TrueFcf = { fcf, ocf: y.ocf, source: 'annual', period: y.d, annualFcf }
      await setCache(cacheKey, out)
      return out
    }
    return NONE
  } catch { return NONE }
}
