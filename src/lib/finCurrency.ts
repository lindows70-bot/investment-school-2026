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
  /** 재무통화 값 → 거래통화 환산 계수. 같은 통화=1 · 환산=환율 · 실패=null(다른 재무값도 쓰면 안 된다는 신호).
   *  ⚠️ 이 계수는 financialData 출처 값(부채·현금)용이다 — 현금흐름표(FTS) 값은 통화가 다를 수 있어
   *     converted 판정과 별개다(두산밥캣: fd는 USD 표기인데 FTS는 KRW → FCF는 환산 생략, 부채는 환산). */
  rate: number | null
}

/** 재무통화 ≠ 거래통화면 FCF·OCF를 거래통화로 환산. 환율 실패 시 null(부풀린 값 서빙 금지).
 *
 *  ⚠️ 입력 fcf·ocf가 재무통화라고 단정하지 않는다 — Yahoo FTS 현금흐름표는 **상장지 공시 통화**를 따라서
 *  financialCurrency와 어긋날 수 있다(실측 2026-08-08: 두산밥캣 finCur=USD인데 FTS는 KRW — 환율을 또
 *  곱해 FCF수익률 18,310%가 통합추천 4위에 '우수' 배지로 올라갔다). 값 기반으로 원값의 통화를 판별한다.
 *  - refOcf: 같은 응답의 fd.operatingCashflow(재무통화 확정) — 비율 ≈1이면 재무통화, ≈환율이면 이미 거래통화
 *  - marketCap(거래통화): refOcf가 없으면 |FCF|/시총 상식 범위(≤60%)에 드는 쪽 채택. 둘 다 밖이면 null(보류) */
export async function normalizeCashflow(
  fcf: number | null, ocf: number | null, finCurRaw: unknown, trdCurRaw: unknown,
  opts?: { refOcf?: number | null; marketCap?: number | null },
): Promise<CashflowFix> {
  const fin = normCur(finCurRaw), trd = normCur(trdCurRaw)
  if (!fin || !trd || fin === trd) return { fcf, ocf, converted: false, fxFailed: false, finCur: fin, trdCur: trd, rate: 1 }
  const r = await fxRate(fin, trd)
  if (r == null) return { fcf: null, ocf: null, converted: false, fxFailed: true, finCur: fin, trdCur: trd, rate: null }
  const base = { converted: false, fxFailed: false, finCur: fin, trdCur: trd, rate: r }
  const conv = { fcf: fcf != null ? fcf * r : null, ocf: ocf != null ? ocf * r : null, ...base, converted: true }
  const keep = { fcf, ocf, ...base }

  // ① 교차 검산 — refOcf(재무통화 확정)와 입력 OCF의 비율로 원값 통화를 판별(연간 폴백 대비 0.4~2.5 허용)
  const refOcf = opts?.refOcf
  if (typeof refOcf === 'number' && isFinite(refOcf) && refOcf !== 0 && ocf != null && ocf !== 0) {
    const ratio = Math.abs(ocf / refOcf)
    if (ratio >= 0.4 && ratio <= 2.5) return conv                       // 원값이 재무통화 → 환산
    const ratioTrd = Math.abs(ocf / (refOcf * r))
    if (ratioTrd >= 0.4 && ratioTrd <= 2.5) return keep                 // 이미 거래통화 → 환산 생략
  }
  // ② 타당성 검사 — 환산 전/후 |FCF|/시총 중 상식 범위(≤60%)에 드는 쪽. 정상 기업에서 60%는 안 나온다.
  const mc = opts?.marketCap
  if (typeof mc === 'number' && isFinite(mc) && mc > 0 && fcf != null && fcf !== 0) {
    const yRaw = Math.abs(fcf) / mc, yConv = Math.abs(fcf * r) / mc
    const PLAUS = 0.6
    if (yConv <= PLAUS && yRaw > PLAUS) return conv
    if (yRaw <= PLAUS && yConv > PLAUS) return keep
    if (yRaw > PLAUS && yConv > PLAUS) return { fcf: null, ocf: null, ...base }   // 어느 쪽도 상식 밖 → 보류
  }
  return conv   // 판별 불가(양쪽 다 그럴듯 = 환율이 1 근처라 저위험) → 종전대로 환산
}
