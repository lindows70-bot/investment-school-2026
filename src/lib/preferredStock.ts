// 🏛️ 우선주(Preferred Stock) 판정 SSOT — 보통주 배당 잣대를 우선주에 대지 않기 위한 순수 로직(의존성 0)
//   Phase 0 실측(2026-08-22 · 표본 28종)에서 확정한 규칙만 담는다 → docs/preferred-stock/context-notes.md
//   ⛔ 티커 하드코딩 금지(제1원칙) — 야후 응답 필드에서만 판정한다.

export interface PreferredInfo {
  /** 고정 쿠폰(연 %) — 종목명 원문에서 파싱. 변동금리형은 null */
  couponPct: number | null
  /** 변동금리형(발행사가 이율을 조정) — STRC 형 */
  isVariableRate: boolean
  /** 발행사명(longName) — 우선주의 신용 위험은 전적으로 여기에 달려 있다 */
  issuerName: string | null
  /** 시리즈 표기 — ⚠️ 야후 shortName 은 32자에서 절단된다(STRF/STRD 가 같은 문자열) */
  seriesLabel: string | null
  /** 액면 추정 = 연배당금 ÷ 쿠폰율 (야후가 액면가를 주지 않아 원문에서 파생) */
  parEstimate: number | null
  /** 현재가의 액면 대비 괴리(%) — 음수면 할인. 시장이 발행사 신용을 어떻게 보는지의 대리지표 */
  parGapPct: number | null
}

/** 이름 정규화 — 구두점·공백·대소문자를 지운다("Annaly Capital Management, Inc." ↔ "…Inc 6" 대조용) */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** 우선주 키워드 — ⚠️ shortName 32자 절단으로 놓치는 경우가 있어 marketCap 조건과 OR 로 묶는다 */
const KEYWORD = /(\d(?:\.\d+)?\s*%)|preferred|\bpfd\b|depositary|deposit|\bseries\s+[a-z]\b|non-?cum|cumulative|perpetual|variable\s*rate|floating/i

/** 한국 우선주 — 코드 끝자리가 0이 아니고(005935·051915) 이름에 (1P)/(2P) 또는 '우'/'우B' */
const KR_NAME = /\(\d?p\)/i

export interface PreferredInput {
  ticker: string
  market: string
  shortName: string | null
  longName: string | null
  quoteType: string | null
  marketCap: number | null
  annualDividend: number | null
  price: number | null
}

/**
 * 우선주면 PreferredInfo, 아니면 null.
 * Phase 0 표본에서 우선주 7/7 적중 · 보통주 10/10·ETF 4/4·KR 보통주 2/2 오탐 0.
 */
export function analyzePreferred(inp: PreferredInput): PreferredInfo | null {
  const short = (inp.shortName ?? '').trim()
  const long = (inp.longName ?? '').trim()
  const isKr = (inp.market || '').toUpperCase() === 'KR'

  let isPreferred: boolean
  if (isKr) {
    const code = inp.ticker.replace(/\D/g, '')
    isPreferred = /^\d{6}$/.test(code) && !code.endsWith('0') && (KR_NAME.test(short) || /우\s*B?$/.test(short))
  } else {
    // quoteType 은 우선주·보통주 둘 다 EQUITY 라 단독으론 못 가른다(ETF 배제 용도).
    // marketCap 은 우선주 7/7 null · 보통주 10/10 값 있음 — 실측상 가장 강한 신호.
    if ((inp.quoteType ?? '').toUpperCase() !== 'EQUITY' || inp.marketCap != null) return null
    // longName 은 보통주와 동일하므로("Strategy Inc") shortName 이 그보다 길게 확장됐는지를 본다.
    const extendsIssuer = long.length > 0 && norm(short).length > norm(long).length && norm(short).startsWith(norm(long))
    isPreferred = KEYWORD.test(short) || extendsIssuer
  }
  if (!isPreferred) return null

  const isVariableRate = /variable\s*rate|floating|\bfloat\b/i.test(short)
  const m = short.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/)
  const rawCoupon = m ? parseFloat(m[1]) : NaN
  const couponPct = !isVariableRate && isFinite(rawCoupon) && rawCoupon >= 0.5 && rawCoupon <= 30 ? rawCoupon : null

  // 액면 추정 — 하드코딩이 아니라 원문 파생. 파싱 오독을 막기 위해 상식 범위 밖은 버린다.
  let parEstimate: number | null = null
  if (couponPct != null && inp.annualDividend != null && inp.annualDividend > 0) {
    const p = inp.annualDividend / (couponPct / 100)
    if (isFinite(p) && p >= 1 && p <= 5000) parEstimate = Math.round(p * 100) / 100
  }
  const parGapPct = parEstimate != null && inp.price != null && inp.price > 0
    ? Math.round((inp.price / parEstimate - 1) * 1000) / 10
    : null

  // 시리즈 표기 — 발행사명을 걷어낸 뒤쪽. 걷어내서 아무것도 안 남으면 '없는 것'이 아니라 '못 읽은 것'이라 null.
  let seriesLabel: string | null = null
  if (long && short.toLowerCase().startsWith(long.toLowerCase())) {
    const rest = short.slice(long.length).replace(/^[\s\-–—·,]+/, '').trim()
    seriesLabel = rest.length >= 2 ? rest : null
  } else if (short && short !== long) {
    seriesLabel = short
  }

  return { couponPct, isVariableRate, issuerName: long || null, seriesLabel, parEstimate, parGapPct }
}

/**
 * 우선주 경보 판정 — 우선주라고 전부 경보를 달면 6% 은행 우선주까지 함정이 되어 경보가 무의미해진다.
 * 배당률 ≥8% · 액면 대비 ≤−10% 할인 · 변동금리 중 하나라도 걸릴 때만.
 */
export function preferredTrapReasons(info: PreferredInfo, dividendYield: number | null): string[] {
  const out: string[] = []
  const issuer = info.issuerName ?? '발행사'
  out.push(`우선주 — 배당 재원은 ${issuer}의 현금흐름·자금조달이며, 회사가 어려워지면 배당이 먼저 멈춥니다`)
  if (info.isVariableRate) out.push('변동금리형 — 발행사가 이율을 조정할 수 있어 지금 배당률이 유지된다는 보장이 없습니다')
  if (info.parGapPct != null && info.parGapPct <= -10) {
    out.push(`액면 추정 대비 ${info.parGapPct.toFixed(1)}% 할인 — 시장이 발행사 신용을 의심하고 있다는 신호입니다`)
  }
  if (dividendYield != null && dividendYield >= 0.08) {
    out.push(`배당률 ${(dividendYield * 100).toFixed(1)}% — 쿠폰이 높아서가 아니라 가격이 눌려 올라간 부분이 있는지 확인하세요`)
  }
  return out
}

export function isPreferredTrap(info: PreferredInfo, dividendYield: number | null): boolean {
  return (dividendYield != null && dividendYield >= 0.08)
    || (info.parGapPct != null && info.parGapPct <= -10)
    || info.isVariableRate
}
