// 🌪️ 국가 변동성 — 클라이언트·서버 공용(순수 타입·상수·판정만). 외부 의존 0
//   ⚠️ 서버 전용 계산(yahoo-finance2·appCache)은 countryVol.ts에 분리 — 클라 컴포넌트가 그쪽에서 '값'을 import하면
//      fs 등 Node 모듈이 클라 번들에 딸려 들어가 빌드가 깨진다(flowShared.ts와 동일 패턴).

export type VolVerdict = 'extreme' | 'high' | 'normal' | 'calm'
/** 종목 origin(통합추천 UnifiedRecoItem.origin) → 대표 지수 매핑 키.
 *  ⚠️ CN_A는 종목 origin이 아니라 '본토 A주(.SS/.SZ) 전용 대표 지수' 슬롯 — volForStock이 티커로 분기해 사용 */
export type VolOrigin = 'US' | 'KR' | 'JP' | 'CN' | 'EU' | 'CN_A'

export interface CountryVolItem {
  key: string
  origin: VolOrigin | null   // 이 지수를 해당 국가 종목의 대표로 쓸지(배지용). null이면 패널 표시 전용
  label: string
  flag: string
  symbol: string
  vol20: number       // 20일 실현변동성(연율 %)
  vol60: number
  pctile: number      // 자국 5년 롤링 20일 변동성 분포에서의 백분위(0~100)
  drawdown: number    // 52주 고점 대비 %(음수)
  big2: number        // 최근 20거래일 중 |일간 등락| ≥2% 일수
  big3: number        // 〃 ≥3% 일수 — 사이드카·서킷브레이커급 급변동 프록시
  ret20: number       // 최근 20거래일 수익률 %
  verdict: VolVerdict
}

export interface CountryVolResult {
  items: CountryVolItem[]
  byOrigin: Record<string, CountryVolItem>   // 배지용 — origin(US/KR/JP/CN/EU) → 대표 지수
  implied: { symbol: string; label: string; value: number }[]   // VIX류 내재변동성(제공되는 시장만)
  asOf: string
}

/** 판정 — 자국 백분위가 1차 기준, 급변동일·절대변동성이 '극단' 승격 조건 */
export function volVerdict(pctile: number, big3: number, vol20: number): VolVerdict {
  if (pctile >= 90 && (big3 >= 5 || vol20 >= 40)) return 'extreme'
  if (pctile >= 75) return 'high'
  if (pctile >= 50) return 'normal'
  return 'calm'
}

/** 종목 하나에 적용할 대표 지수 — 중화권은 상장지가 갈리므로 티커로 분기(본토 .SS/.SZ=상해종합 / 그 외 CN=항셍).
 *  같은 'CN' origin이라도 마오타이·CATL(본토)과 텐센트·CNOOC(홍콩)은 실제 거래되는 시장의 변동성이 다르다. */
export function volForStock(ticker: string, origin: string, byOrigin?: Record<string, CountryVolItem> | null): CountryVolItem | null {
  if (!byOrigin) return null
  if (origin === 'CN' && /\.(SS|SZ)$/i.test(ticker)) return byOrigin.CN_A ?? byOrigin.CN ?? null
  return byOrigin[origin] ?? null
}

export const VOL_META: Record<VolVerdict, { icon: string; label: string; color: string; guide: string }> = {
  extreme: { icon: '🔴', label: '극단 변동(투자 주의)', color: '#f87171',
    guide: '지수 자체가 매일 급변동하는 이상 국면입니다. 개별 종목 손절(ATR)이 지수 갭에 그대로 뚫릴 수 있어 비중 축소·분할 진입이 필수입니다.' },
  high: { icon: '🟠', label: '변동성 높음', color: '#fb923c',
    guide: '자국 역사 대비 변동성이 높은 구간입니다. 진입은 나눠서, 손절 폭은 넉넉히 잡으세요.' },
  normal: { icon: '🟡', label: '보통', color: '#facc15',
    guide: '평균적인 변동성 구간입니다. 평소 원칙대로 운용하세요.' },
  calm: { icon: '🟢', label: '평온', color: '#4ade80',
    guide: '변동성이 낮은 안정 구간입니다. 다만 저변동은 방심을 부르니 손절 원칙은 유지하세요.' },
}
