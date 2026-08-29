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
  detectElephantBar, detectLiquidity, calcRSI, calcCCI,
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
  /** 🔁 더 큰 창에서 다시 잰 값(2026-08-28 · 5년 · 200종 · 종목분할 hold-out).
   *  ⚠️ edge20 을 **대체하지 않는다** — 어느 쪽이 진실이 아니라 **다른 창을 재고 있다**.
   *  창을 바꾸면 부호까지 뒤집히는 셋업이 있어서(눌림목 −0.95 → +0.68) 그 사실 자체를 화면에 남긴다. */
  recheck?: string
  note?: string         // 한계·주의
}

/** 📊 2026-07-30 통일 재측정(84종목·8,110평가봉·워크포워드·룩어헤드 없음·stride 2).
 *  ⭐ **edge20 = 상하위 10% 이상치 제거 후 초과수익(절사 edge)** — 평균 edge는 소수 대박에 속는다는 게
 *  눌림목 재검증의 교훈이라, 14종 전부를 같은 엄격 기준으로 다시 쟀다(표기 형평). winRate·sample은 원시값.
 *  이 표본은 2년 중 최근 하락장을 포함한다 — 옛 수치(상승장 우세 표본)와 다른 값은 국면 차이다.
 *  음수도 정직하게 남긴다(학습 자료). 원측정(2026-07-26·12,594봉)은 git 이력에 보존. */
export const SCREEN_SETUPS: SetupMeta[] = [
  { key: 'wedgeFalling', icon: '🔻', label: '하락 쐐기', edge20: 1.82, winRate: 59.3, sample: 980,
    desc: '고점·저점이 함께 낮아지며 수렴 = 상방 분출 후보',
    note: '⭐ 재측정 1위 — 절사 +1.82·중위 +1.74·승률 +7.3pp 로 세 지표가 모두 견고합니다(하락장 포함 표본에서 오히려 강함).' },
  { key: 'elephantBull', icon: '🐘', label: '엘리펀트 바(불)', edge20: 2.77, winRate: 52.7, sample: 150,
    desc: '평균 변동폭을 압도하는 큰 양봉 = 매수 의지 노출',
    note: '절사 edge는 최고(+2.77)지만 중위는 0 근처 — 평균을 끌어올리는 대박 꼬리형입니다. 후행 확인봉이라 추격 주의.' },
  { key: 'prime', icon: '🏅', label: '정예 타점', edge20: 1.33, winRate: 50.2, sample: 203,
    recheck: '🔁 안 본 120종에서 재검정(2026-08-28) — +0.54 로 기준(+1.0) 미달. 눌림목 갈래는 +1.16 로 살아남았지만 다이버전스 갈래가 −1.01 로 무너져 합계가 내려갔습니다.',
    desc: '상승 추세가 살아있는 상태에서 눌림·반전이 끝난 자리(합류 조합)',
    note: '⭐ 상승 추세 국면 전용 — 하락장 포함 재측정에서 절사 +1.33 으로 살아남았으나 중위는 −0.4 로 눌렸습니다(원측정 승률 60.7%는 상승장 표본). 국면을 함께 보세요.' },
  { key: 'fibGolden', icon: '📐', label: '골든 되돌림', edge20: 1.12, winRate: 55.0, sample: 989,
    desc: '직전 상승분의 38~62% 되돌린 구간(건강한 눌림 영역)',
    note: '중위 +0.7·승률 +3.1pp 동반 — 재측정에서도 견고.' },
  { key: 'timeFilled', icon: '⏳', label: '기간 조정 충족', edge20: 1.04, winRate: 56.3, sample: 3166,
    desc: '상승에 걸린 기간만큼 조정 기간을 채움(기간대칭)',
    note: '대표본(3,166)에서 중위 +1.0·승률 +4.4pp — 상태형 신호 중 가장 견고.' },
  { key: 'squeezeFired', icon: '🔥', label: '스퀴즈 상방 분출', edge20: 1.01, winRate: 50.0, sample: 122,
    desc: '압축이 풀리며 위로 터진 순간',
    note: '절사는 양수인데 중위 −0.3·승률 50% — 평균 주도형(혼조). 단독 추격보다 확인 후.' },
  { key: 'greenState', icon: '🟢', label: '상승 추세 유지', edge20: 0.87, winRate: 52.2, sample: 3026,
    desc: '정배열+구름 위 유지 = 추세를 존중하며 따라가는 구간(상태 필터)' },
  { key: 'squeezeOn', icon: '🔥', label: '스퀴즈 압축 중', edge20: 0.85, winRate: 54.6, sample: 1755,
    desc: '변동성이 눌려 에너지가 쌓이는 구간(방향은 분출 때 결정)' },
  { key: 'accum', icon: '🥷', label: '매집 흔적 봉', edge20: 0.33, winRate: 53.2, sample: 94,
    desc: '음봉인데 아래꼬리로 회복 + 대량거래 = 쏟아진 매물을 받아먹은 흔적',
    note: '재측정 우위 미미(+0.33) · 무료 일봉엔 진짜 체결 구분이 없어 범위 내 종가 위치로 근사합니다.' },
  { key: 'zeroBreak', icon: '🎼', label: '라쉬케 영선 돌파', edge20: 0.09, winRate: 51.4, sample: 1355,
    desc: 'MACD가 0선을 넘어 추세가 확정된 지점',
    note: '⚠️ 하락장 포함 재측정에서 우위 소멸(절사 +0.1) — 원측정 +1.45 는 상승장 표본이었습니다. 국면 의존이 큽니다.' },
  { key: 'pullback', icon: '🎼', label: '첫 눌림목', edge20: -0.95, winRate: 47.2, sample: 375,
    desc: '추세 확립 후 첫 되돌림 = 라쉬케가 꼽는 안전한 진입 자리',
    // ⚠️ 재검증 이력(2026-07-29·54종목): 평균 +1.39 였으나 절사 −0.45. 통일 재측정(07-30)에선 −0.95 로 더 나쁨.
    //    '조정 시 거래량 마름' 조건을 붙여도 개선 없음(−0.46·표본만 58% 감소). 거래량 터진 눌림목이 오히려 승률 우위(교과서와 반대).
    note: '⚠️ 단독으로는 재측정에서 마이너스(−0.95)입니다 — 🏅 정예 타점(정배열+구름 위와 겹칠 때)만 우위가 남습니다. 단독 신호로 쓰지 마세요.',
    recheck: '🔁 더 큰 창(5년·200종)에선 +0.68 로 부호가 뒤집혔습니다 — 이 숫자는 측정 기간에 크게 좌우됩니다.' },
  { key: 'greenTurn', icon: '🚦', label: '신호등 green 전환', edge20: -0.36, winRate: 48.4, sample: 161,
    desc: '오늘 정배열+구름 위로 전환 = 구조적 상승 추세 진입',
    note: '⚠️ 재측정 음수 — 전환 당일 추격은 우위가 없습니다. 전환 후 첫 눌림을 기다리는 편이 낫습니다.' },
  { key: 'bullDiv', icon: '🔼', label: '상승 다이버전스', edge20: -0.9, winRate: 49.3, sample: 477,
    desc: '가격은 저점을 낮췄는데 RSI는 저점을 높임 = 하락 에너지 소진(바닥 반전 후보)',
    note: '⚠️ 하락장 포함 재측정에서 역효과(절사 −0.9) — 단독으론 떨어지는 칼날을 잡습니다. 구조 게이트(정배열+구름)와 합류한 정예 타점만 생존.',
    recheck: '🔁 더 큰 창(5년·200종)에선 +0.25. 다만 게이트와 합쳐도 안 본 종목에선 −1.01 로 무너졌습니다(2026-08-28 hold-out) — 이 갈래는 특히 불안정합니다.' },
  { key: 'cciCross100', icon: '📐', label: 'CCI +100 돌파', edge20: -0.24, winRate: 50.8, sample: 6009,
    desc: '평균(이평선)에서 위로 크게 벌어져 상승에 속도가 붙은 자리',
    recheck: '🔁 자기상관 보정(겹치는 20봉을 한 에피소드로 접음) 후 n=3,083 · edge −0.00 · **−0.02σ**',
    note: '⚠️ 이 앱에서 **가장 확실하게 아무것도 아닌 신호**입니다(2026-08-29 측정 · 5년 · 100종 · 최다점유 2%). '
        + '겹침을 걷어내면 edge 가 정확히 0이고 승률 50.8%는 baseline 52.1%보다 오히려 낮습니다. '
        + '하향이탈(매도 쪽)도 edge −0.46 · 접은 뒤 −0.87σ 로 마찬가지입니다. '
        + '📐 CCI 는 "가격이 이평선에서 얼마나 벌어졌나"를 재는 자(같은 길이면 CCI 영선 = 그 이평선)이니 '
        + '**상태를 읽는 용도로만 쓰고 진입 신호로 쓰지 마세요.** '
        + '참고: 유튜브식 2단 확인(+100 돌파 → CCI 고점 → 재돌파)까지 재봤지만 −0.42σ 로 더 나빴고, '
        + '이평선 이탈 청산까지 태우면 −8.4σ 였습니다 — 일봉에선 진입가가 이평선 위 **중위 +12%** 라 손절이 그만큼 멉니다.' },
  { key: 'liqSweep', icon: '💧', label: '유동성 스윕', edge20: -1.42, winRate: 47.5, sample: 177,
    desc: '전저점을 꼬리로 찔러 손절을 털고 종가는 회복(개미 털기 흔적)',
    note: '⚠️ 재측정 역효과(절사 −1.42·승률 −4.5pp) — 관찰 라벨로만 쓰고 매수 신호로 쓰지 마세요.' },
]
export const SETUP_MAP: Record<string, SetupMeta> = Object.fromEntries(SCREEN_SETUPS.map(s => [s.key, s]))

/** 🔑 기술 검색기 캐시 키 — **상수로 묶는다.**
 *  v1→v2 를 writer(api/tech-screener)만 올렸다가 reader(cronHealth)가 옛 키를 읽는 걸 커밋 훅이 잡았다.
 *  여기 한 곳만 고치면 둘 다 따라온다(HONEYCOMB_KEY 와 같은 처방).
 *  v2: SetupMeta.recheck(더 큰 창 재측정) 추가 — 응답에 SCREEN_SETUPS 가 실려 캐시된다.
 *  v3: cciCross100 셋업 신규 등재(음수 반증) — 목록·판정이 함께 바뀐다. */
export const TECH_SCREENER_KEY = (dateKey: string) => `tech-screener-v3:${dateKey}`

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
  // 📐 CCI +100 상향돌파(오늘) — SignalReader 가 이걸 '매수 이벤트'로 띄우고 있었는데 **측정된 적이 없었다**.
  //    2026-08-29 재보니 접은 뒤 −0.02σ(사실상 0). 지우지 않고 성적을 붙여 노출한다(음수도 학습 자료).
  const cciArr = calcCCI(ohlc)
  const cciN = cciArr[cciArr.length - 1], cciP = cciArr[cciArr.length - 2]
  if (cciP != null && cciN != null && cciP <= 100 && cciN > 100) setups.push('cciCross100')

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
