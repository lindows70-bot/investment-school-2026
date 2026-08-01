// 📉 커버드콜 X-Ray SSOT — 커버드콜 ETF의 '분배율 착시'를 본주 대비 총수익(TR) 갭으로 정량화
//   핵심: Yahoo adjclose = 배당 재투자 반영 총수익, close = 가격만 → 둘을 나누면 '분배 기여분'이 분리된다.
//   분배율 20%여도 본주 대비 TR이 −22%p이고 가격이 −8%면 그 분배는 상당 부분 원금에서 나온 것.
//   ⛔ 매수·매도 지시 아님(관측·교육 전용) · 추천 6축 점수 미반영.

/** 일별 캐시 키 — ⚠️ route 파일은 GET/dynamic/maxDuration 외 export 금지(Next 타입 검증 실패)라 lib에 둔다.
 *  ⚠️ 판정 로직이 바뀌면 **날짜 키만으로는 부족하다** — 같은 날 배포하면 옛 값이 그대로 서빙된다
 *  (2026-08-01 환율 정규화 배포 후 실제로 발생: 푸터 문구는 새 코드인데 수치는 옛 캐시였다).
 *  v2: 본주 원화 환산(needsFxAlign) 적용 */
export const CC_XRAY_KEY = (dateKst: string) => `covered-call-xray-v2:${dateKst}`

export type BenchKind = 'exact' | 'proxy'

export interface CcPair {
  ticker: string            // 커버드콜 ETF
  market: 'KR' | 'US'
  label: string             // 화면 표기명
  bench: string             // 본주(벤치마크) Yahoo 심볼
  benchLabel: string
  kind: BenchKind           // proxy = 정확한 기초지수 ETF가 없어 근사(화면에 표기)
  structure: string         // 옵션 매도 구조 — 같은 지수라도 결과를 가르는 요인
}

/** ⚠️ 전 종목 Yahoo 종목명으로 실측 검증(2026-08-01). **기초지수가 정확히 일치하는 본주가 있는 상품만** 넣는다.
 *  제외: 펀드of펀드(YMAG·YMAX·ULTY — 단일 본주 없음) · 498410 금융고배당TOP10(근사 벤치를 KODEX 은행으로
 *  잡으면 갭 −53%p, KODEX 200으로 잡으면 −195%p로 벤치 선택이 결론을 뒤집는다 = 비교 자체가 무의미).
 *  억지 근사 매핑은 정직한 비교가 아니라 그럴듯한 거짓말이 된다. */
export const CC_PAIRS: CcPair[] = [
  // ── 미국 지수 추종 국내 ETF ──
  { ticker: '482730', market: 'KR', label: 'TIGER 미국S&P500 +10% 프리미엄', bench: 'SPY', benchLabel: 'S&P500(SPY)', kind: 'exact', structure: '타겟 프리미엄(연 10%)' },
  { ticker: '458760', market: 'KR', label: 'TIGER 미국배당+7% 프리미엄', bench: 'SCHD', benchLabel: '미국배당다우존스(SCHD)', kind: 'exact', structure: '타겟 프리미엄(연 7%)' },
  { ticker: '486290', market: 'KR', label: 'TIGER 미국나스닥100 +15% 프리미엄', bench: 'QQQ', benchLabel: '나스닥100(QQQ)', kind: 'exact', structure: '타겟 프리미엄(연 15%)' },
  { ticker: '494300', market: 'KR', label: 'KODEX 미국나스닥100 데일리커버드콜', bench: 'QQQ', benchLabel: '나스닥100(QQQ)', kind: 'exact', structure: '데일리 OTM(매일 전량 매도)' },
  { ticker: '491620', market: 'KR', label: 'RISE 미국테크100 데일리고정커버드콜', bench: 'QQQ', benchLabel: '나스닥100(QQQ)', kind: 'exact', structure: '데일리 고정 프리미엄' },
  // ── 미국 상장 지수형 ──
  { ticker: 'JEPI', market: 'US', label: 'JPM 프리미엄 인컴(S&P)', bench: 'SPY', benchLabel: 'S&P500(SPY)', kind: 'exact', structure: 'ELN + 저변동 주식' },
  { ticker: 'JEPQ', market: 'US', label: 'JPM 나스닥 프리미엄 인컴', bench: 'QQQ', benchLabel: '나스닥100(QQQ)', kind: 'exact', structure: 'ELN + 나스닥 주식' },
  { ticker: 'QYLD', market: 'US', label: 'Global X 나스닥100 커버드콜(원조)', bench: 'QQQ', benchLabel: '나스닥100(QQQ)', kind: 'exact', structure: 'ATM 전량 매도(1세대)' },
  { ticker: 'XYLD', market: 'US', label: 'Global X S&P500 커버드콜', bench: 'SPY', benchLabel: 'S&P500(SPY)', kind: 'exact', structure: 'ATM 전량 매도(1세대)' },
  { ticker: 'RYLD', market: 'US', label: 'Global X 러셀2000 커버드콜', bench: 'IWM', benchLabel: '러셀2000(IWM)', kind: 'exact', structure: 'ATM 전량 매도(1세대)' },
  // ── 개별 종목 커버드콜(YieldMax·Roundhill) — 본주가 명확해 침식이 가장 선명 ──
  { ticker: 'MSTY', market: 'US', label: 'YieldMax MSTR 옵션인컴', bench: 'MSTR', benchLabel: 'Strategy(MSTR)', kind: 'exact', structure: '합성 롱 + 콜 매도' },
  { ticker: 'NVDY', market: 'US', label: 'YieldMax NVDA 옵션인컴', bench: 'NVDA', benchLabel: 'NVIDIA', kind: 'exact', structure: '합성 롱 + 콜 매도' },
  { ticker: 'TSLY', market: 'US', label: 'YieldMax TSLA 옵션인컴', bench: 'TSLA', benchLabel: 'Tesla', kind: 'exact', structure: '합성 롱 + 콜 매도' },
  { ticker: 'CONY', market: 'US', label: 'YieldMax COIN 옵션인컴', bench: 'COIN', benchLabel: 'Coinbase', kind: 'exact', structure: '합성 롱 + 콜 매도' },
  { ticker: 'PLTW', market: 'US', label: 'Roundhill PLTR 위클리페이', bench: 'PLTR', benchLabel: 'Palantir', kind: 'exact', structure: '위클리 콜 매도' },
]

export const yahooSymbol = (p: { ticker: string; market: 'KR' | 'US' }) =>
  p.market === 'KR' ? `${p.ticker}.KS` : p.ticker

/** 본주를 커버드콜과 같은 통화로 맞춰야 하는가 — KR 상장 ETF(원화) vs US 본주(달러)
 *  ⚠️ 안 맞추면 환율 상승분이 갭에 그대로 섞인다(2026-08-01 실측: 2년 환율 +2.7~7.3%p가
 *  갭에 얹혀 RISE +5.9%p·TIGER S&P500 +0.5%p처럼 '커버드콜이 본주를 이긴' 것처럼 보였다.
 *  통화를 맞추면 −4.5%p·−3.3%p로 뒤집힌다). 커버드콜이 구조상 본주를 크게 이기는 일은 없다. */
export const needsFxAlign = (p: CcPair) => p.market === 'KR' && !/^\d{6}$/.test(p.bench)

export interface Bar { date: string; close: number; adj: number }

export interface PeriodStat {
  months: number            // 창 길이(개월) — 999 = 전체(공통 최대)
  from: string
  to: string
  ccTr: number              // 커버드콜 총수익 %(배당 재투자)
  ccPrice: number           // 가격만 %(= NAV 변화 근사)
  distContrib: number       // 분배 기여분 %p(TR − 가격)
  benchTr: number
  trGap: number             // ccTr − benchTr (음수 = 본주보다 뒤처짐)
}

export type CcVerdict = 'tracking' | 'lagging' | 'far_behind' | 'both_down'

export interface CcXrayRow extends CcPair {
  periods: PeriodStat[]     // 1년·2년·전체
  primary: PeriodStat       // 판정 기준(2년 우선, 없으면 가장 긴 창)
  verdict: CcVerdict
  navErosion: boolean       // 판정 창에서 가격 하락 = 분배가 원금에서 나온 정황
  fxAligned: boolean        // 본주를 원화로 환산해 비교(환율 효과 제거)
}

/** 공통 거래일만 남긴다 — 상장일이 다르면 비교가 불공정(둘 다 존재하는 날짜로 정렬).
 *  fx가 주어지면 본주를 그 환율로 환산하고, 환율 결측일도 공통 구간에서 뺀다. */
export function alignBars(cc: Bar[], bench: Bar[], fx?: Bar[]): { cc: Bar[]; bench: Bar[] } {
  const bm = new Map(bench.map(b => [b.date, b]))
  const fm = fx ? new Map(fx.map(b => [b.date, b.close])) : null
  const outCc: Bar[] = [], outBench: Bar[] = []
  for (const c of cc) {
    const b = bm.get(c.date)
    if (!b || c.adj <= 0 || b.adj <= 0) continue
    if (fm) {
      const rate = fm.get(c.date)
      if (!rate || rate <= 0) continue
      outBench.push({ date: b.date, close: b.close * rate, adj: b.adj * rate })   // 본주를 원화로
    } else outBench.push(b)
    outCc.push(c)
  }
  return { cc: outCc, bench: outBench }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** 창(개월) 안에서 TR·가격·갭 계산. 표본이 20거래일 미만이면 null(정직 생략) */
export function periodStat(cc: Bar[], bench: Bar[], months: number): PeriodStat | null {
  if (!cc.length) return null
  let startIdx = 0
  if (months < 999) {
    const lastMs = Date.parse(cc[cc.length - 1].date)
    const cutoff = lastMs - months * 30.44 * 86_400_000
    startIdx = cc.findIndex(b => Date.parse(b.date) >= cutoff)
    if (startIdx < 0) return null
  }
  const n = cc.length - startIdx
  if (n < 20) return null
  const c0 = cc[startIdx], c1 = cc[cc.length - 1]
  const b0 = bench[startIdx], b1 = bench[bench.length - 1]
  const ccTr = (c1.adj / c0.adj - 1) * 100
  const ccPrice = (c1.close / c0.close - 1) * 100
  const benchTr = (b1.adj / b0.adj - 1) * 100
  return {
    months, from: c0.date, to: c1.date,
    ccTr: r1(ccTr), ccPrice: r1(ccPrice), distContrib: r1(ccTr - ccPrice),
    benchTr: r1(benchTr), trGap: r1(ccTr - benchTr),
  }
}

/** 갭 판정 — 임계 근거는 docs/covered-call-xray/context-notes.md
 *  ⚠️ 총수익이 마이너스면 갭과 무관하게 'both_down' — MSTY는 본주(MSTR)도 폭락해 갭이 −0.6%p뿐이지만
 *  총수익 −42.8%·가격 −91.6%다. 여기에 초록 '추종 양호'를 붙이면 배지가 숫자를 정면으로 뒤집는다. */
export function verdictOf(trGap: number, ccTr: number): CcVerdict {
  if (ccTr < 0) return 'both_down'
  if (trGap >= -2) return 'tracking'
  if (trGap >= -10) return 'lagging'
  return 'far_behind'
}

export function buildRow(pair: CcPair, ccBars: Bar[], benchBars: Bar[], fxBars?: Bar[]): CcXrayRow | null {
  const { cc, bench } = alignBars(ccBars, benchBars, needsFxAlign(pair) ? fxBars : undefined)
  if (cc.length < 20) return null
  const periods = [12, 24, 999].map(m => periodStat(cc, bench, m)).filter((p): p is PeriodStat => p != null)
  if (!periods.length) return null
  // 판정 기준 = 2년 창(있으면), 없으면 가장 긴 창 — 한 기간만 보면 결론이 뒤집힌다
  const primary = periods.find(p => p.months === 24) ?? periods[periods.length - 1]
  return {
    ...pair, periods, primary,
    verdict: verdictOf(primary.trGap, primary.ccTr),
    navErosion: primary.ccPrice < 0,
    fxAligned: needsFxAlign(pair),
  }
}
