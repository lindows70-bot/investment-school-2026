// 🔎 기술적 종목 검색기 SSOT — 증권사 검색기처럼 '지금 기술적 조건이 성립한 종목'을 찾는다.
//    ⭐ 차별점: 각 필터에 **자체 백테스트 성적(edge·승률·표본)**을 붙인다. 증권사 검색기는 '골든크로스 종목'만
//       뱉지만, 우리는 "그 필터가 과거에 얼마나 맞았는지"를 같이 보여줘 학생이 신호를 맹신하지 않게 한다.
//
//    ⛔ 원칙: 이건 WHEN(타이밍)만 본다. 종목 선정(WHAT)은 학생이 펀더멘탈로 직접 판단한다
//       — 검색 결과에서 종합 매수 판정·리서치로 넘어가는 동선을 UI가 제공한다.
//    ⚠️ 백테스트 수치의 한계: 2년 표본(상승장 우세)·거래비용 미반영·31기법 중 선택이라 과최적화 여지.
//       국면 의존이 큰 셋업(정예 타점)은 note에 명시한다.
import { timingFromCandles } from '@/lib/entryTiming'
import type { TechCandle } from '@/lib/techChartData'
import {
  readFibRetracement, readTimeCorrection, readWedge, detectStealthBars,
  detectElephantBar, detectLiquidity, calcRSI,
} from '@/lib/techSignals'

/** 셋업 메타 — 라벨·설명·백테스트 성적. API와 UI가 같은 정의를 쓴다(제2원칙) */
export interface SetupMeta {
  key: string
  icon: string
  label: string
  desc: string          // 학생용 한 줄 설명
  edge20: number | null // 20봉 초과수익(%p, baseline 대비). null=미측정
  winRate: number | null// 20봉 승률 %
  sample: number | null // 백테스트 표본 건수
  note?: string         // 한계·주의
}

/** 2026-07-26 자체 백테스트(60~120종목·12,594봉·워크포워드·룩어헤드 없음) 결과.
 *  edge20 = baseline(전 봉 평균 20봉 전방수익률) 대비 초과분. 음수도 정직하게 남긴다(학습 자료). */
export const SCREEN_SETUPS: SetupMeta[] = [
  { key: 'prime', icon: '🏅', label: '정예 타점', edge20: 2.15, winRate: 60.7, sample: 323,
    desc: '상승 추세가 살아있는 상태에서 눌림·반전이 끝난 자리(백테스트 1위 조합)',
    note: '⭐ 상승 추세 국면 전용 — 재검증 결과 중립장 −0.7%p·하락장 사실상 미발생. 국면을 함께 보세요.' },
  { key: 'bullDiv', icon: '🔼', label: '상승 다이버전스', edge20: 1.93, winRate: 51.6, sample: 758,
    desc: '가격은 저점을 낮췄는데 RSI는 저점을 높임 = 하락 에너지 소진(바닥 반전 후보)' },
  { key: 'elephantBull', icon: '🐘', label: '엘리펀트 바(불)', edge20: 1.89, winRate: 52.2, sample: 182,
    desc: '평균 변동폭을 압도하는 큰 양봉 = 매수 의지 노출',
    note: '10봉 기준 초과수익은 +0.13에 불과 — 20봉으로 봐야 의미가 있었습니다(후행 확인봉).' },
  { key: 'zeroBreak', icon: '🎼', label: '라쉬케 영선 돌파', edge20: 1.45, winRate: 50.4, sample: 2075,
    desc: 'MACD가 0선을 넘어 추세가 확정된 지점' },
  { key: 'pullback', icon: '🎼', label: '첫 눌림목', edge20: 1.41, winRate: 51.9, sample: 567,
    desc: '추세 확립 후 첫 되돌림 = 라쉬케가 꼽는 안전한 진입 자리' },
  { key: 'fibGolden', icon: '📐', label: '골든 되돌림', edge20: 1.18, winRate: 51.7, sample: 1629,
    desc: '직전 상승분의 38~62% 되돌린 구간(건강한 눌림 영역)' },
  { key: 'accum', icon: '🥷', label: '매집 흔적 봉', edge20: 1.06, winRate: 49.1, sample: 110,
    desc: '음봉인데 아래꼬리로 회복 + 대량거래 = 쏟아진 매물을 받아먹은 흔적',
    note: '무료 일봉엔 진짜 체결 구분이 없어 범위 내 종가 위치로 근사합니다.' },
  { key: 'greenTurn', icon: '🚦', label: '신호등 green 전환', edge20: 0.86, winRate: 52.3, sample: 241,
    desc: '오늘 정배열+구름 위로 전환 = 구조적 상승 추세 진입' },
  { key: 'wedgeFalling', icon: '🔻', label: '하락 쐐기', edge20: 0.83, winRate: 53.1, sample: 1728,
    desc: '고점·저점이 함께 낮아지며 수렴 = 상방 분출 후보' },
  { key: 'squeezeOn', icon: '🔥', label: '스퀴즈 압축 중', edge20: 0.77, winRate: 51.8, sample: 2823,
    desc: '변동성이 눌려 에너지가 쌓이는 구간(방향은 분출 때 결정)' },
  { key: 'timeFilled', icon: '⏳', label: '기간 조정 충족', edge20: 0.75, winRate: 53.4, sample: 4959,
    desc: '상승에 걸린 기간만큼 조정 기간을 채움(기간대칭)' },
  { key: 'liqSweep', icon: '💧', label: '유동성 스윕', edge20: 0.55, winRate: 50.5, sample: 285,
    desc: '전저점을 꼬리로 찔러 손절을 털고 종가는 회복(개미 털기 흔적)' },
  { key: 'squeezeFired', icon: '🔥', label: '스퀴즈 상방 분출', edge20: 0.52, winRate: 51.8, sample: 170,
    desc: '압축이 풀리며 위로 터진 순간' },
  { key: 'greenState', icon: '🟢', label: '상승 추세 유지', edge20: 0.91, winRate: 51.7, sample: 4731,
    desc: '정배열+구름 위 유지 = 추세를 존중하며 따라가는 구간(상태 필터)' },
]
export const SETUP_MAP: Record<string, SetupMeta> = Object.fromEntries(SCREEN_SETUPS.map(s => [s.key, s]))

export interface ScreenHit {
  ticker: string; name: string; market: 'US' | 'KR'
  sector: string | null; industry: string | null
  setups: string[]                       // 성립한 셋업 key
  light: 'green' | 'yellow' | 'red' | null
  price: number | null
  rsi: number | null; adx: number | null
  hi52: number | null                    // 52주 최고가 대비 현재 위치 %(100=신고가)
  ret1w: number | null; ret1m: number | null
  atrStop: number | null                 // 🛡️ ATR 손절 참고선
  primeTrigger: 'divergence' | 'pullback' | null
  choppy: boolean                        // ⬛ 추세 강도 약함(가짜 돌파 주의)
  knife: boolean                         // 🔪 떨어지는 칼날(유니버스 메타)
  peg: number | null; momentumScore: number | null   // 펀더멘탈 맛보기(정성분석 진입점)
}

/** 봉 배열 하나로 모든 셋업을 판정. timingFromCandles가 신호등·정예타점·라쉬케·수급을 한 번에 주므로
 *  중복 계산 없이 재사용하고, 나머지(피보·기간·쐐기·매집·엘리펀트·스윕)만 추가로 읽는다. */
export function evaluateSetups(D: TechCandle[]): Omit<ScreenHit, 'ticker' | 'name' | 'market' | 'sector' | 'industry' | 'knife' | 'peg' | 'momentumScore'> | null {
  if (!D || D.length < 130) return null      // 구름+EMA112 최소 요건 미달 → 정직 생략
  const t = timingFromCandles(D)
  if (!t) return null
  const setups: string[] = []
  const rk = t.raschke

  if (t.prime) setups.push('prime')
  if (rk?.bullDiv) setups.push('bullDiv')
  if (rk?.stage === 3) setups.push('zeroBreak')
  if (rk?.stage === 4 && rk.pullback) setups.push('pullback')
  if (t.light === 'green') setups.push('greenState')
  // 오늘 green 전환 — 직전 봉으로 다시 판정(같은 함수 재사용이라 정의가 어긋날 수 없다)
  if (t.light === 'green' && D.length > 131) {
    const prev = timingFromCandles(D.slice(0, -1))
    if (prev && prev.light !== 'green') setups.push('greenTurn')
  }
  if (t.supply?.squeezeOn) setups.push('squeezeOn')
  if (t.supply?.squeezeFired === 'up') setups.push('squeezeFired')

  const ohlc = D.map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }))
  if (readFibRetracement(ohlc)?.zone === 'golden') setups.push('fibGolden')
  if (readTimeCorrection(ohlc)?.phase === 'filled') setups.push('timeFilled')
  if (readWedge(ohlc)?.type === 'falling') setups.push('wedgeFalling')
  const st = detectStealthBars(ohlc); if (st?.type === 'accum' && st.barsAgo === 0) setups.push('accum')
  const el = detectElephantBar(ohlc); if (el?.type === 'bull' && el.barsAgo === 0) setups.push('elephantBull')
  const liq = detectLiquidity(ohlc)
  if (liq.some(l => l.type === 'low' && l.swept && l.endIdx === ohlc.length - 1)) setups.push('liqSweep')

  if (!setups.length) return null

  const N = D.length, last = D[N - 1]
  const rsiArr = calcRSI(D.map(c => c.close))
  const win52 = D.slice(Math.max(0, N - 252))
  const hi = Math.max(...win52.map(c => c.high))
  const r = (i: number) => { const b = D[N - 1 - i]; return b && b.close > 0 ? Math.round((last.close / b.close - 1) * 1000) / 10 : null }
  return {
    setups,
    light: t.light,
    price: last.close,
    rsi: rsiArr[rsiArr.length - 1] != null ? Math.round(rsiArr[rsiArr.length - 1]! * 10) / 10 : null,
    adx: t.supply?.adx ?? null,
    hi52: hi > 0 ? Math.round(last.close / hi * 1000) / 10 : null,
    ret1w: r(5), ret1m: r(20),
    atrStop: t.atrStop,
    primeTrigger: t.prime?.trigger ?? null,
    choppy: !!t.supply?.choppy,
  }
}
