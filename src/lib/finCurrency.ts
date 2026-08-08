// 재무통화(financialCurrency)가 거래통화와 다른 ADR의 현금흐름을 거래통화로 환산 — FCF/시총 부풀림 차단 SSOT
// 실측(2026-08-08): TSM TWD/USD 순진 계산 33.9%(실제 1.05%)·SONY JPY/USD 2432.6%(실제 15.4%)로 부풀었다.
// BA.L은 GBp(펜스) 표기지만 시총·재무가 GBP 본 통화 단위라 정규화만 필요(환산하면 오히려 100배 틀어짐).
// EQNR은 재무·거래 모두 USD — 높은 수익률(31.8%)이 통화 문제가 아니라 실제 데이터(일시 호황 현금)였다.
import { getCache, setCache } from '@/lib/appCache'

// GBp(펜스)·ZAc(센트) 등 소수 단위 표기는 본 통화로 정규화 — Yahoo 시총·재무는 본 통화 단위로 온다(BA.L 실측 4.5% 정상)
const normCur = (c: unknown): string | null => {
  if (typeof c !== 'string' || !c.trim()) return null
  const u = c.trim()
  if (u === 'GBp') return 'GBP'
  if (u === 'ZAc') return 'ZAR'
  return u.toUpperCase()
}

const memFx = new Map<string, { rate: number; at: number }>()   // 프로세스 메모 캐시 — 스크리너 663종이 같은 쌍을 반복 조회

/** finCur→trdCur 환율(예: TWD→USD 0.031). 실패 시 null — 틀린 값보다 없는 값. */
export async function fxRate(from: string, to: string): Promise<number | null> {
  const pair = `${from}${to}`
  const mem = memFx.get(pair)
  if (mem && Date.now() - mem.at < 12 * 3600_000) return mem.rate
  const cacheKey = `fx-rate-v1:${pair}`
  const cached = await getCache<number>(cacheKey, 12 * 3600_000)
  if (typeof cached === 'number' && cached > 0) { memFx.set(pair, { rate: cached, at: Date.now() }); return cached }
  try {
    const { default: YF } = await import('yahoo-finance2')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yf = new (YF as any)({ suppressNotices: ['yahooSurvey'] })
    const q = await yf.quote(`${pair}=X`)
    const r = typeof q?.regularMarketPrice === 'number' && q.regularMarketPrice > 0 ? q.regularMarketPrice : null
    if (r != null) { memFx.set(pair, { rate: r, at: Date.now() }); await setCache(cacheKey, r) }
    return r
  } catch { return null }
}

export interface CashflowFix {
  fcf: number | null; ocf: number | null
  converted: boolean          // 환산 수행됨(예: TWD→USD)
  fxFailed: boolean           // 통화 불일치인데 환율을 못 구함 → 부풀린 원값 대신 null 서빙
  finCur: string | null; trdCur: string | null
}

/** 재무통화 ≠ 거래통화면 FCF·OCF를 거래통화로 환산. 환율 실패 시 null(부풀린 값 서빙 금지). */
export async function normalizeCashflow(fcf: number | null, ocf: number | null, finCurRaw: unknown, trdCurRaw: unknown): Promise<CashflowFix> {
  const fin = normCur(finCurRaw), trd = normCur(trdCurRaw)
  if (!fin || !trd || fin === trd) return { fcf, ocf, converted: false, fxFailed: false, finCur: fin, trdCur: trd }
  const r = await fxRate(fin, trd)
  if (r == null) return { fcf: null, ocf: null, converted: false, fxFailed: true, finCur: fin, trdCur: trd }
  return { fcf: fcf != null ? fcf * r : null, ocf: ocf != null ? ocf * r : null, converted: true, fxFailed: false, finCur: fin, trdCur: trd }
}
