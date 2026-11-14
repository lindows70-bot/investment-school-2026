// 학생 화면 가격 차트의 자료 고르기(순수 함수) — 내 자산 '내 종목 차트'와 시장·코인 화면 '코인 차트'가 같은 규칙으로 /api/stock-price 응답에서 선을 뽑는다
//
// 2026-11-14 Phase 0(프로덕션 응답 실측): 시세 응답 한 번에 차트 자료가 이미 다 들어 있다 — 새 원천·새 API 없이 만든다.
//   KR·US  charts['1D']=일봉 60(약 3개월) · ['1W']=주봉 60(약 14개월) · ['1M']=월봉 60(5년)
//   코인   charts['1D']=시간봉 24 · ['1W']=일봉 7 · ['1M']=일봉 30  /  ohlcCharts['1M']=일봉 90(3달) · ['1Y']=주봉 52(1년)
// ⚠️ charts 의 키 이름은 기간이 아니다(시장마다 뜻이 다르다) — 화면의 기간 이름은 여기서 정하고, 실제 간격은 spanLabel 로 자료에서 읽어 함께 밝힌다.

export interface Pt { t: number; v: number }
export type ChartMarket = 'KR' | 'US' | 'CRYPTO'
/** 시세 응답 한 줄에서 차트에 쓰는 부분 */
export interface ChartSource { charts?: Record<string, unknown> | null; ohlcCharts?: Record<string, unknown> | null }

export type HoldRange = '3M' | '1Y' | '5Y'
export const HOLD_RANGES: { key: HoldRange; label: string }[] = [{ key: '3M', label: '3개월' }, { key: '1Y', label: '1년' }, { key: '5Y', label: '5년' }]
export type CoinRange = '1D' | '1W' | '1M' | '3M' | '1Y'
export const COIN_RANGES: { key: CoinRange; label: string }[] = [{ key: '1D', label: '하루' }, { key: '1W', label: '1주' }, { key: '1M', label: '1달' }, { key: '3M', label: '3달' }, { key: '1Y', label: '1년' }]

const DAY = 86_400_000
const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** 선 자료 정리 — 유효한 점만, 시간순. dropFlat: 전부 같은 값이면 버린다(업비트 조회 실패 시 API 가 현재가 직선을 채워 보낸다 — 가격 흐름이 아니다).
 *  KR·US 는 그런 가짜 직선이 없고 거래정지 종목은 실제로 평평할 수 있어 dropFlat 을 켜지 않는다 */
export function cleanLine(raw: unknown, dropFlat: boolean): Pt[] {
  if (!Array.isArray(raw)) return []
  const pts = raw.filter((p): p is Pt => !!p && fin((p as Pt).t) && fin((p as Pt).v) && (p as Pt).v > 0).map(p => ({ t: p.t, v: p.v })).sort((a, b) => a.t - b.t)
  if (pts.length < 2) return []
  return dropFlat && pts.every(p => p.v === pts[0].v) ? [] : pts
}

/** 캔들({date:'YYYY-MM-DD', close}) → 선. 날짜는 한국 자정으로 놓는다.
 *  barDays > 1(주봉 7) 이면 봉의 끝날로 옮기고, 마지막 봉은 아직 진행 중이므로 nowMs 를 넘지 않게 자른다 — 주 시작일(월요일)에 '지금 가격'이 찍히지 않게 */
export function ohlcToLine(raw: unknown, barDays = 1, nowMs?: number): Pt[] {
  if (!Array.isArray(raw)) return []
  const pts: Pt[] = []
  for (const c of raw as { date?: unknown; close?: unknown }[]) {
    if (!c || typeof c.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !fin(c.close) || c.close <= 0) continue
    let t = Date.parse(`${c.date}T00:00:00+09:00`) + (barDays - 1) * DAY
    if (fin(nowMs) && t > nowMs) t = nowMs
    pts.push({ t, v: c.close })
  }
  pts.sort((a, b) => a.t - b.t)
  return pts.length < 2 || pts.every(p => p.v === pts[0].v) ? [] : pts
}

/** 보유 종목 차트 — 고른 기간의 선과, 요청한 기간을 다 못 채울 때의 한마디(note).
 *  1년: 주식은 주봉 60 중 최근 53점(52주) · 코인은 주봉 52. 5년: 주식 월봉 60 · 코인은 자료가 1년까지라 1년을 보여 주고 그렇다고 말한다 */
export function holdingSeries(market: ChartMarket, src: ChartSource | null | undefined, range: HoldRange, nowMs?: number): { pts: Pt[]; note: string | null } {
  const charts = src?.charts ?? {}, ohlc = src?.ohlcCharts ?? {}
  if (market === 'CRYPTO') {
    if (range === '3M') return { pts: ohlcToLine(ohlc['1M'], 1, nowMs), note: null }
    return { pts: ohlcToLine(ohlc['1Y'], 7, nowMs), note: range === '5Y' ? '코인은 최근 1년까지 보여요' : null }
  }
  if (range === '3M') return { pts: cleanLine(charts['1D'], false), note: null }
  if (range === '1Y') return { pts: cleanLine(charts['1W'], false).slice(-53), note: null }
  return { pts: cleanLine(charts['1M'], false), note: null }
}

/** 코인 차트 — 하루(시간봉 24)·1주(일봉 7)·1달(일봉 30)은 선 자료, 3달(일봉 90)·1년(주봉 52)은 캔들 종가 */
export function coinSeries(src: ChartSource | null | undefined, range: CoinRange, nowMs?: number): Pt[] {
  const charts = src?.charts ?? {}, ohlc = src?.ohlcCharts ?? {}
  if (range === '3M') return ohlcToLine(ohlc['1M'], 1, nowMs)
  if (range === '1Y') return ohlcToLine(ohlc['1Y'], 7, nowMs)
  return cleanLine(charts[range], true)
}

/** 이 기간 등락(%) — 첫 점 대비 마지막 점. 점이 둘 미만이면 null(0% 로 꾸미지 않는다) */
export function periodChangePct(pts: Pt[]): number | null {
  if (pts.length < 2 || !(pts[0].v > 0)) return null
  return (pts[pts.length - 1].v / pts[0].v - 1) * 100
}

/** 자료의 실제 간격을 말로 — 끝−시작 + 봉 하나(중앙값). 일봉 7개는 6일이 아니라 7일 치다 */
export function spanLabel(pts: Pt[]): string {
  if (pts.length < 2) return ''
  const steps = pts.slice(1).map((p, i) => p.t - pts[i].t).sort((a, b) => a - b)
  const step = steps.length ? steps[Math.floor(steps.length / 2)] : 0
  const d = (pts[pts.length - 1].t - pts[0].t + step) / DAY
  if (d < 1.5) return '최근 하루'
  if (d < 45) return `최근 ${Math.round(d)}일`
  if (d < 700) return `최근 ${Math.round(d / 30.44)}개월`
  return `최근 ${Math.round(d / 365.25)}년`
}

/** 하루 안쪽 자료인가(가로 눈금을 시각으로 쓸지 날짜로 쓸지) */
export const isIntraday = (pts: Pt[]) => pts.length >= 2 && pts[pts.length - 1].t - pts[0].t < 1.5 * DAY

/** 내 평균 매수가를 차트에 그어도 되는가 — 범위에서 너무 멀면 선 하나 때문에 가격 흐름이 납작해진다(종목 상세와 같은 규칙: 최저의 절반 ~ 최고의 두 배) */
export function avgInRange(avg: number | null | undefined, pts: Pt[]): boolean {
  if (!fin(avg) || avg <= 0 || pts.length < 2) return false
  const vs = pts.map(p => p.v)
  return avg >= Math.min(...vs) * 0.5 && avg <= Math.max(...vs) * 2
}

/** 기간 안 최고·최저 점(같은 값이면 먼저 나온 점). 최고 = 최저(평평)면 null */
export function highLow(pts: Pt[]): { hi: Pt; lo: Pt } | null {
  if (pts.length < 2) return null
  let hi = pts[0], lo = pts[0]
  for (const p of pts) { if (p.v > hi.v) hi = p; if (p.v < lo.v) lo = p }
  return hi.v === lo.v ? null : { hi, lo }
}
