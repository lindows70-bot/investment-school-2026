// 🎯 스윙 셋업 SSOT — 1~2주 단기 매매 판정(순수 함수·결정론)
//
// ⚠️ 이 파일이 지켜야 하는 것(백테스트가 정한 것이지 취향이 아니다 — `scripts/backtest-swing.mjs` 재현 가능):
//  ① **국면·시장이 트랙을 고른다.** 한 트랙을 아무 데나 쓰면 edge가 사라진다.
//     · 🅰️ 역매공파(평균회귀) — 하락장에서만. 상승장 절사 edge 0.30%p·승률 49.7%로 **baseline 이하**였다.
//     · 🅲 킴스(일목+TRIX)   — 상승장에서. 미국 5봉 절사 0.83%p·승률 64.0%.
//  ② **눌림목을 기다리는 형태는 넣지 않는다.** 세 번 재서 세 번 음수였다
//     (첫 눌림목 단독 −0.95%p / 급등 눌림목 KR −1.13%p·US −1.34%p).
//  ③ **물타기 유도 금지.** 손실 포지션에 추가 매수를 권하지 않는다(단테 문서의 "반토막에 70% 추가"는 채택하지 않았다).
//  ④ edge 는 **시장 대비**다. 절대수익 5~20%를 약속하지 않는다(⛔ 가짜 정밀).
//
// ⛔ 자동매매 없음 — 판정·표시까지. 세금·수수료·슬리피지 미반영(단기매매에서 이게 성적을 크게 깎는다).
import { calcTRIX, readSpanADir, type Ohlc } from '@/lib/techSignals'

export type SwingTrack = 'reversion' | 'trend' | 'spike'
export type SwingRegime = 'up' | 'down' | 'flat'

/** 🧢 하루 합산 추천 상한 — 하락장 바닥 급등은 몰려서 나오는 날이 있다(같은 장세에 여러 건 = 상관 노출).
 *  손절폭 좁은 순으로 3건만 내보낸다(2026-08-12 사용자 승인). */
export const SWING_DAILY_CAP = 3

/** 📊 백테스트 성적 — 화면이 표본·승률을 항상 병기할 수 있게 여기 하나로 둔다(숫자를 코드에 흩뿌리지 않는다).
 *  측정: KR40+US40 · 5년 일봉 · 실제 techSignals 컴파일 · 룩어헤드 없음 · baseline 대비 절사 초과분 · autopsy 4단. */
export const SWING_TRACKS: Record<SwingTrack, {
  key: SwingTrack; icon: string; label: string; source: string
  market: 'KR' | 'US'; regime: SwingRegime; holdBars: number; holdLabel: string
  edgePp: number; winRate: number; sample: number; note: string
  /** 📊 수익률 분포(실측) — "10% 이상 나야 의미 있다"는 기대에 화면이 사실로 답하기 위해.
   *  medPct=중위 수익률 · ge5Rate/ge10Rate=+5%/+10% 이상으로 끝난 비율(%) */
  medPct: number; ge5Rate: number; ge10Rate: number
}> = {
  reversion: {
    key: 'reversion', icon: '🌊', label: '눌린 값 회복', source: '역매공파(112/224 역배열 회복)',
    market: 'KR', regime: 'down', holdBars: 10, holdLabel: '2주',
    edgePp: 1.70, winRate: 62.4, sample: 173,
    medPct: 0.2, ge5Rate: 21, ge10Rate: 10,
    note: '많이 빠진 종목이 6개월 평균가를 되찾는 자리. **하락장에서만** 통했습니다(상승장 승률 49.7%).',
  },
  trend: {
    key: 'trend', icon: '🚀', label: '추세 올라타기', source: '일목 선행스팬1 + TRIX 영선',
    market: 'US', regime: 'up', holdBars: 5, holdLabel: '1주',
    edgePp: 0.83, winRate: 64.0, sample: 325,
    medPct: 1.1, ge5Rate: 19, ge10Rate: 7,
    note: '오르는 흐름에 힘이 실리는 순간. 미국 상승장에서 통했습니다(한국은 승률 50.2%로 우위 없음).',
  },
  spike: {
    key: 'spike', icon: '⚡', label: '바닥 급등 포착', source: '써티퍼센트(224 아래 장기 체류 → 급등 당일)',
    market: 'KR', regime: 'down', holdBars: 10, holdLabel: '2주',
    edgePp: 2.82, winRate: 61.9, sample: 134,
    medPct: 2.9, ge5Rate: 39, ge10Rate: 22,
    note: '1년선 아래 오래 눌려 있다가 거래량 실린 급등이 터진 날. **한국 하락장에서만** 통했습니다(미국은 역효과·기각). 저점에서 이미 30% 넘게 오른 자리는 추격이라 제외합니다.',
  },
}

/** 🏔️ 참고 — 백테스트 '보유 연장 실험'(5·10·15봉 중 최고 시점의 종가 수익 · 실측 2026-08-11, backtest-swing.mjs).
 *  전향 적립이 찰 때까지의 참고치다. **최적 시점 매도를 가정한 상한**이지 기대값이 아니다. */
export const SWING_BEST_REF = {
  reversion: { medBestPct: 3.5, ge10Rate: 18, sample: 73 },
  trend: { medBestPct: 3.2, ge10Rate: 19, sample: 325 },
  asOf: '2026-08-11',
} as const

const sma = (a: number[], n: number, i: number) => {
  if (i + 1 < n) return null
  let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]
  return s / n
}

/** 🌦️ 국면 — 50일선이 20봉 전 대비 어디로 가나(백테스트와 **같은 정의**여야 성적이 성적 구실을 한다) */
export function readSwingRegime(data: Ohlc[]): SwingRegime | null {
  const c = data.map(d => d.close)
  const i = c.length - 1
  const now = sma(c, 50, i), prev = sma(c, 50, i - 20)
  if (now == null || prev == null) return null
  return now > prev * 1.01 ? 'up' : now < prev * 0.99 ? 'down' : 'flat'
}

export interface SwingHit {
  track: SwingTrack
  price: number
  /** 진입 근거 — 학생 말로 */
  reasons: string[]
}

/** 🌊 트랙 A — 역매공파: 112/224 역배열 + 최근 20봉 내 이격도 ≤95 + 112일선 당일 회복.
 *  이평선 길이는 실측으로 골랐다 — 112/224 절사 +0.46%p vs 122/245 −0.03%p vs 60/200 −0.11%p. */
export function readReversionSetup(data: Ohlc[]): SwingHit | null {
  const c = data.map(d => d.close)
  const i = c.length - 1
  if (i < 250) return null
  const ma112 = sma(c, 112, i), ma224 = sma(c, 224, i), ma112p = sma(c, 112, i - 1)
  if (ma112 == null || ma224 == null || ma112p == null) return null
  if (!(ma224 > ma112)) return null                       // 역배열(장기 하락 누적)
  if (!(c[i] > ma112 && c[i - 1] <= ma112p)) return null   // 112일선 당일 회복
  let dispMin: number | null = null
  for (let k = Math.max(0, i - 20); k <= i; k++) {
    const m = sma(c, 20, k)
    if (m != null) { const d = (c[k] / m) * 100; if (dispMin == null || d < dispMin) dispMin = d }
  }
  if (dispMin == null || dispMin > 95) return null         // 최근에 과매도였던 적이 있어야 한다
  return {
    track: 'reversion', price: c[i],
    reasons: [
      '오랜 하락으로 1년 평균가가 6개월 평균가보다 위에 있습니다(바닥권 구조)',
      `최근 20일 안에 20일 평균보다 ${Math.round(100 - dispMin)}% 이상 싸진 적이 있습니다(과매도)`,
      '오늘 6개월 평균가를 되찾았습니다 — 6개월치 매물을 넘어섰다는 뜻',
    ],
  }
}

/** 🚀 트랙 C — 킴스: 선행스팬1 상승 + TRIX 영선 상향 돌파 + 강도 증가 + 11일선 위.
 *  ⚠️ 강도 증가 조건("어제보다 오늘 TRIX가 높다")을 빼면 안 된다 — 문서가 '강도 발산'이라 부른 것으로,
 *     가격은 돌파하는데 힘은 빠지는 자리를 걸러낸다. */
export function readTrendSetup(data: Ohlc[]): SwingHit | null {
  const c = data.map(d => d.close)
  const i = c.length - 1
  if (i < 60) return null
  const span = readSpanADir(data)
  // ⚠️ `dir`(표시용·flat 완충 있음)이 아니라 `rising`(순수 비교)으로 판정한다 — 백테스트와 같은 잣대여야 한다
  if (!span || !span.rising) return null                   // 선행스팬1 하락이면 매수 신호 전부 무시(하드 필터)
  const trix = calcTRIX(c)
  const t0 = trix[i], t1 = trix[i - 1]
  if (t0 == null || t1 == null) return null
  if (!(t0 > 0 && t1 <= 0)) return null                    // 영선 상향 돌파
  if (!(t0 > t1)) return null                              // 강도 증가
  const ma11 = sma(c, 11, i)
  if (ma11 == null || !(c[i] > ma11)) return null
  return {
    track: 'trend', price: c[i],
    reasons: [
      '일목 선행선이 위를 향합니다(앞으로의 길이 오르막)',
      '체결 강도(TRIX)가 오늘 플러스로 돌아섰고, 어제보다 더 강해졌습니다',
      '주가가 11일 평균 위에 있습니다(엔진과 차가 같은 방향)',
    ],
  }
}

/** ⚡ 트랙 D — 써티퍼센트 바닥 급등: 224선 아래 장기 체류(60봉 중 45봉+) + 당일 +5%↑ + 거래량 2배↑.
 *  "1년선 아래 있는 놈에 미리 들어가지 않는다 — 급등을 확인하고 들어간다"(영상 원칙).
 *  ⚠️ 백테스트(backtest-swing.mjs 트랙 D)와 **자구까지 같은 규칙**이어야 성적이 성적 구실을 한다. */
export function readSpikeSetup(data: Ohlc[]): SwingHit | null {
  const c = data.map(d => d.close)
  const i = c.length - 1
  if (i < 285) return null                                  // 224선 + 체류 창 60봉 확보
  if (sma(c, 224, i - 1) == null) return null
  let below = 0
  for (let k = i - 60; k < i; k++) {
    const m = sma(c, 224, k)
    if (m != null && c[k] < m) below++
  }
  if (below < 45) return null                               // 장기 체류(바닥 다지기)가 전제
  const chg = (c[i] / c[i - 1] - 1) * 100
  if (chg < 5) return null                                  // 급등 당일
  let v20 = 0
  for (let k = i - 20; k < i; k++) v20 += data[k].volume ?? 0
  v20 /= 20
  const vToday = data[i].volume ?? 0
  if (!(v20 > 0) || vToday < v20 * 2) return null           // 거래량이 실려야 '돈의 유입'이다
  // 🧢 추격 가드(2026-08-14) — 20봉 저가 대비 이미 +30% 넘게 오른 급등은 자리 자체를 버린다.
  //    runup >30% 구간이 KR 하락장 실측 7건·절사 −2.65%p·승률 43%(표본 얇음 — 방향 확인용)인 반면
  //    ≤30% 구간은 +2.67~+3.28%p 로 명확히 갈렸다(probe-runup-gate.mjs). 토니모리 +49% 진입 사례가 계기.
  //    ⚠️ backtest-swing.mjs 트랙 D와 자구까지 같은 규칙 — 가드 반영 후 성적으로 SWING_TRACKS 갱신됨.
  let min20 = Infinity
  for (let k = i - 19; k <= i; k++) { const l = data[k].low ?? c[k]; if (l < min20) min20 = l }
  const runup = (c[i] / min20 - 1) * 100
  if (runup > 30) return null
  return {
    track: 'spike', price: c[i],
    reasons: [
      `최근 석 달 중 대부분(60일 중 ${below}일)을 1년 평균가 아래에서 보냈습니다(바닥 다지기)`,
      `오늘 +${Math.round(chg * 10) / 10}% 급등 — 거래량이 평소의 ${Math.round(vToday / v20 * 10) / 10}배로 터졌습니다(돈이 들어온 흔적)`,
      `최근 20일 저점 대비 +${Math.round(runup)}% 자리 — 30%를 넘긴 추격 자리는 추천하지 않습니다`,
    ],
  }
}

/** 📉 거래량 천장 경고 — 대량 양봉 직후 **첫 눌림 음봉에 다시 대량**이 실리면 이후 2주가 평소보다 나빴다.
 *  출처: 거래량 다이버전스 영상(WiaBe7_VFz0) 4규칙 중 유일하게 양 시장·전 국면에서 살아남은 것
 *  (실측 2026-08-13, scripts/probe-volume-divergence.mjs — 나머지 3규칙은 무효 또는 KR에서 정반대).
 *  10봉 절사 edge KR −1.06%p(227건·40종·54개월)/US −0.56%p(79건), 상승 국면에서도 음수.
 *  ⚠️ 매도 '강요'가 아니라 경고다 — 승률 43~46%지 0%가 아니다. 백테스트와 같은 규칙: 대량=20일 평균 2배↑,
 *  양봉 급등 +2%↑, 눌림 봉은 급등봉 후 1~3봉 내 **첫** 음봉이어야 한다. */
export const VOL_CAUTION_REF = {
  kr: { edge10Pp: -1.06, winRate: 46.3, sample: 227 },
  us: { edge10Pp: -0.56, winRate: 45.6, sample: 79 },
  asOf: '2026-08-13',
} as const
export function readVolumeCaution(data: Ohlc[]): { burstChg: number; pullVolX: number } | null {
  const i = data.length - 1
  if (i < 25) return null
  const c = data.map(d => d.close), o = data.map(d => d.open), v = data.map(d => d.volume ?? 0)
  if (!(c[i] < o[i])) return null                           // 오늘이 눌림 음봉
  const v20i = sma(v, 20, i - 1)
  if (v20i == null || !(v20i > 0) || v[i] < v20i * 2) return null   // 눌림에도 대량(2배↑)
  for (let j = i - 1; j >= i - 3 && j >= 21; j--) {
    const v20j = sma(v, 20, j - 1)
    if (v20j == null || !(v20j > 0)) continue
    const chg = (c[j] / c[j - 1] - 1) * 100
    if (c[j] > o[j] && chg >= 2 && v[j] >= v20j * 2) {
      for (let k = j + 1; k < i; k++) if (c[k] < o[k]) return null  // 첫 눌림이어야 한다
      return { burstChg: Math.round(chg * 10) / 10, pullVolX: Math.round((v[i] / v20i) * 10) / 10 }
    }
  }
  return null
}

/** 🧭 지금 이 종목에 쓸 트랙이 있나 — **국면·시장이 맞을 때만** 판정한다.
 *  맞는 트랙이 없으면 null 이고, 화면은 "지금은 자리가 아닙니다"를 이유와 함께 말해야 한다. */
const READERS: Record<SwingTrack, (d: Ohlc[]) => SwingHit | null> = {
  reversion: readReversionSetup, trend: readTrendSetup, spike: readSpikeSetup,
}
export function readSwingSetup(data: Ohlc[], market: 'KR' | 'US'): SwingHit | null {
  const regime = readSwingRegime(data)
  if (!regime) return null
  for (const t of Object.values(SWING_TRACKS)) {
    if (t.market !== market || t.regime !== regime) continue
    const hit = READERS[t.key](data)
    if (hit) return hit
  }
  return null
}

/** 💰 포지션 크기 — **잃을 금액을 먼저 정하고 수량을 역산한다**(킴스 리스크 가이드라인).
 *  손절폭이 넓으면 자동으로 적게 산다. 이게 우리 exitPlan 에 없던 조각이다.
 *  ⚠️ 리스크 비율 기본 0.75%는 문서 값이며 **백테스트로 검증된 수치가 아니다**(구조적 안전장치일 뿐). */
export const SWING_RISK_PCT = 0.75
/** ⚠️ 리스크 상한만 지키면 **집중도**가 뚫린다(2026-08-11 화면검증): 유한양행 손절폭 1.1% → 79주 →
 *  자산의 68%가 한 종목에 들어가는 값이 나왔다. 잃을 금액은 0.75%가 맞지만 포지션 자체도 상한이 필요하다. */
export const SWING_MAX_POS_PCT = 20
export function positionSize(
  equity: number, entry: number, stop: number, riskPct = SWING_RISK_PCT,
): { qty: number; riskAmount: number; positionValue: number; stopPct: number; capped: boolean } | null {
  if (!(equity > 0) || !(entry > 0) || !(stop > 0) || stop >= entry) return null
  const riskAmount = equity * (riskPct / 100)
  const perShare = entry - stop
  let qty = Math.floor(riskAmount / perShare)
  const capQty = Math.floor(equity * (SWING_MAX_POS_PCT / 100) / entry)
  const capped = qty > capQty
  if (capped) qty = capQty                                  // 포지션 상한 20% — 손절폭이 좁아도 몰빵이 되지 않게
  if (qty < 1) return null                                  // 한 주도 못 사면 자리가 아니다
  return {
    qty,
    riskAmount: Math.round(capped ? qty * perShare : riskAmount),   // 상한에 걸리면 실제 리스크는 0.75%보다 작다
    positionValue: Math.round(qty * entry),
    stopPct: Math.round((perShare / entry) * 1000) / 10,
    capped,
  }
}
