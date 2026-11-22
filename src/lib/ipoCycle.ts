// 🚀 IPO 하이프 사이클의 종목 목록·상장 대기 목록·국면 판정식(순수 함수) — 라우트와 불변식(scripts/verify-ipo-cycle.mjs)이 같은 표를 본다
//
// 2026-11-14 검증에서 나온 결함을 고치며 라우트에서 분리했다:
//   ① 기준가가 '상장가'라는 이름표를 달고 있었지만 실제로는 상장 첫 주 종가였다(서클 $107.70 vs 첫날 종가 $83.23) → **상장 첫날 종가**로 바꾸고 이름표도 그렇게 쓴다
//   ② 고점·저점이 주봉 종가라 낙폭이 얕게 나왔다(스페이스X 화면 −24.8% vs 일봉 종가 −34.2%) → **일봉 종가**
//   ③ 인튜이티브머신 상장일이 1년 틀렸다(2024-02-09 → 실제 2023-02-14) · 스페이스X 4일(06-08 → 06-12) → 상장일은 야후 첫 거래일과 불변식으로 대조한다
//   ④ 목록이 손으로 고른 20종에 고정돼 2026년 대형 상장이 빠져 있었다 → 추가 + 상장 대기 목록(IPO_WATCH) 자동 감지

export type Phase = 'hype' | 'reality' | 'pain' | 'smart' | 'recovery' | 'uptrend'

export interface IpoStock {
  ticker: string; name: string; ipo: string
  months: number
  ipoPrice: number            // 기준가 = 상장 첫날 종가(ipoBarDate 의 종가). 공모가가 아니다
  ipoBarDate: string          // 기준가를 읽은 봉의 날짜 — 상장일(ipo)과 다르면 원천에 첫날 봉이 없다는 뜻(화면이 밝힌다)
  peak: number; trough: number; current: number   // 상장 이후 일봉 종가 기준(장중 고가·저가 아님)
  lastBar: string             // current 를 읽은 봉의 날짜
  ddFromPeak: number; upFromTrough: number; multiple: number   // multiple = 현재 / 첫날 종가
  phase: Phase; curveX: number                                  // 0~100 곡선상 위치
  spark: number[]                                               // 상장 후 종가(첫날 종가 = 100)
  auto?: boolean              // 상장 대기 목록에서 자동 감지된 종목(아직 IPO_UNIVERSE 에 정식 등록 전)
}
export interface IpoCycleResult { stocks: IpoStock[]; asOf: string; priceDate: string | null }

export interface IpoEntry { ticker: string; name: string; ipo: string; spac?: boolean }

/** 큐레이션 목록 — 상장일은 '그 티커로 거래가 시작된 날'(야후 첫 봉)이고 불변식이 매일 대조한다.
 *  spac: 스팩 합병 상장 — 야후 이력 앞에 스팩 시절이 붙어 있어 '첫 거래일' 대조 대신 '합병 뒤 첫 거래일에 봉이 있는가'만 본다.
 *  넣지 않는 것: 기존 상장사의 ADR 이중상장(SK하이닉스 ADR 2026-07-10 등) — 신규 상장주의 기대·현실 간극 서사가 아니다. */
export const IPO_UNIVERSE: IpoEntry[] = [
  { ticker: 'PLTR', name: '팔란티어', ipo: '2020-09-30' },
  { ticker: 'RDDT', name: '레딧', ipo: '2024-03-21' },
  { ticker: 'ARM', name: 'ARM', ipo: '2023-09-14' },
  { ticker: 'RBLX', name: '로블록스', ipo: '2021-03-10' },
  { ticker: 'COIN', name: '코인베이스', ipo: '2021-04-14' },
  { ticker: 'HOOD', name: '로빈후드', ipo: '2021-07-29' },
  { ticker: 'RIVN', name: '리비안', ipo: '2021-11-10' },
  { ticker: 'ABNB', name: '에어비앤비', ipo: '2020-12-10' },
  { ticker: 'SNOW', name: '스노우플레이크', ipo: '2020-09-16' },
  { ticker: 'DASH', name: '도어대시', ipo: '2020-12-09' },
  { ticker: 'RKLB', name: '로켓랩', ipo: '2021-08-25', spac: true },
  { ticker: 'ALAB', name: '아스테라랩스', ipo: '2024-03-20' },
  { ticker: 'TEM', name: '템퍼스AI', ipo: '2024-06-14' },
  { ticker: 'CART', name: '인스타카트', ipo: '2023-09-19' },
  { ticker: 'BIRK', name: '버켄스탁', ipo: '2023-10-11' },
  { ticker: 'LUNR', name: '인튜이티브머신', ipo: '2023-02-14', spac: true },   // 스팩(Inflection Point) 합병 2/13 완료 · LUNR 거래 2/14 시작(옛 값 2024-02-09 는 1년 틀렸다)
  { ticker: 'HIMS', name: '힘스앤허스', ipo: '2021-01-21', spac: true },
  { ticker: 'SPCX', name: '스페이스X', ipo: '2026-06-12' },   // 옛 값 06-08 → 야후 첫 봉 06-12. 같은 티커를 예전에 SPAC ETF 가 썼다 — 상장일부터 잘라 받아 섞이지 않는다
  { ticker: 'CRCL', name: '서클(Circle)', ipo: '2025-06-05' },
  { ticker: 'CRWV', name: '코어위브', ipo: '2025-03-28' },
  { ticker: 'FIG', name: '피그마', ipo: '2025-07-31' },
  { ticker: 'CBRS', name: '세레브라스', ipo: '2026-05-14' },
  { ticker: 'BSP', name: '벤딩스푼스', ipo: '2026-07-01' },
  { ticker: 'ANT', name: '앤스로픽', ipo: '2026-11-19' },   // 2026-11-22 상장 대기 감시가 잡아 정식 등록(사용자 상시 지시) · 나스닥 NMS · 야후 첫 봉 11-19(시 111.50 · 종 97.17)
]

/** 🔭 상장 대기 목록 — 아직 비상장인 대형사. 라우트가 12시간마다 야후 검색으로 '미국 거래소에 그 이름의 보통주가 새로 생겼는가'를 본다.
 *  생기면 그날부터 곡선에 자동으로 올라오고(auto: true), 불변식이 "정식 등록하라"고 알린다(사용자 지시 2026-11-14: 상장하면 바로 추가).
 *  오탐 가드: 종류 EQUITY · 미국 거래소 · 이름 정규식 일치 · 첫 거래일이 since 이후 — 지금 야후엔 이 이름들의 ETF·토큰·해외 ETP 만 있고 전부 걸러진다(실측). */
export interface IpoWatch { q: string; name: string; match: RegExp; since: string }
export const IPO_WATCH: IpoWatch[] = [
  { q: 'OpenAI', name: '오픈AI', match: /\bopenai\b/i, since: '2026-11-14' },
  { q: 'Stripe', name: '스트라이프', match: /^stripe\b/i, since: '2026-11-14' },
  { q: 'Databricks', name: '데이터브릭스', match: /\bdatabricks\b/i, since: '2026-11-14' },
]
/** 야후 검색의 거래소 코드 중 미국 본장(나스닥 3종·뉴욕·아멕스) */
export const US_EXCHANGES = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE'])

export const PHASE_BAND: Record<Phase, [number, number]> = { hype: [3, 15], reality: [17, 30], pain: [33, 50], smart: [53, 66], recovery: [69, 84], uptrend: [87, 98] }

/** 🕰️ 스마트머니 매집으로 분류하는 최소 상장 경과월(사용자 결정 2026-11-14).
 *  상장 5~6개월인 스페이스X·세레브라스가 '저점 대비 반등'만으로 매집에 놓여 "분할 매수 검토" 문구가 붙었다 — 교과서의 매집은 12~24개월이고
 *  9개월 전은 락업 해제·첫 실적을 지나는 자각 구간이다. 그 전의 반등은 매집이 아니라 자각으로 둔다 */
export const SMART_MIN_MONTHS = 9

/** 국면 판정 — 상장 경과월 + 주가 경로(고점 대비 낙폭·저점 대비 반등·첫날 종가 대비 배수).
 *  2026-11-14: 재는 잣대를 주봉→일봉·첫 주→첫날로 바꿨고, 임계값은 SMART_MIN_MONTHS 하나만 추가했다 */
export function judgeIpoPhase(mo: number, ipoP: number, peak: number, trough: number, cur: number): { phase: Phase; curveX: number } {
  const dd = (cur - peak) / peak            // 고점 대비(음수)
  const up = (cur - trough) / trough        // 저점 대비(양수)
  const mult = cur / ipoP                   // 첫날 종가 대비 배수(핵심 게이트)
  let phase: Phase
  // ⭐ 배수로 게이팅: '저점 대비 반등'만으로 recovery 오판 금지(리비안 0.12배인데 +45% 반등 = 여전히 폭락 → 매집)
  // ⚠️ 광기 = '갓 상장 + 아직 고점권'이다. 낙폭 허용을 −35%까지 주면 고점 대비 −31% 떨어진 종목이
  //    광기 꼭대기에 찍혀 카드의 숫자와 곡선 위치가 자기모순이 된다(SPCX 실사고).
  if (mo <= 5 && dd > -0.20) phase = 'hype'                          // 갓 상장(5개월 내)·고점권 유지 = 광기
  else if (mult >= 2.5 && dd > -0.45) phase = 'uptrend'              // 졸업: 첫날 종가 2.5배+ & 고점권 유지
  else if (dd >= -0.12) phase = 'uptrend'                            // 전고점 근처
  else if (mo <= 12 && dd <= -0.30 && up < 0.25) phase = 'reality'    // 락업/실적 붕괴 초입(1년 내)
  else if ((dd <= -0.50 || mult < 0.55) && up < 0.25) phase = 'pain'  // 깊은 낙폭·첫날 종가 절반↓·바닥권
  else if (mult >= 1.0 && up >= 0.25 && dd > -0.45) phase = 'recovery' // 첫날 종가 회복 + 반등 + 고점권 접근
  else if (up >= 0.15) phase = 'smart'                              // 바닥 탈출·아직 첫날 종가 이하(매집)
  else if (dd <= -0.20) phase = 'reality'
  else phase = 'smart'
  if (phase === 'smart' && mo < SMART_MIN_MONTHS) phase = 'reality'   // 상장 9개월 전의 반등은 매집이 아니다(위 상수 설명)
  const [a, b] = PHASE_BAND[phase]
  // 국면 내 세부 위치: pain=낙폭 깊이, recovery/smart=반등 크기, uptrend=배수
  let t = 0.5
  if (phase === 'pain') t = Math.min(1, Math.max(0, -dd - 0.45) / 0.4)
  else if (phase === 'smart' || phase === 'recovery') t = Math.min(1, up / 0.8)
  else if (phase === 'uptrend') t = Math.min(1, Math.max(0, mult - 1) / 6)
  else if (phase === 'reality') t = Math.min(1, Math.max(0, -dd - 0.18) / 0.3)
  else t = Math.min(1, mo / 4)
  return { phase, curveX: Math.round((a + (b - a) * t) * 10) / 10 }
}

export interface DailyBar { ts: number; c: number }
const dayOf = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10)

/** 일봉(상장일 이후) → 한 종목의 카드 값. 봉이 하나뿐인 상장 첫날도 만든다(상장하면 바로 올라오게).
 *  오염 가드: 상장 뒤 봉 수가 기대 거래일의 1.4배를 넘으면 옛 동명 티커 이력이 섞인 것 → null */
export function buildIpoStock(e: IpoEntry & { auto?: boolean }, rows: DailyBar[], nowSec: number): IpoStock | null {
  const ipoTs = Date.parse(e.ipo) / 1000
  const after = rows.filter(x => x.ts >= ipoTs && x.c > 0)
  if (after.length < 1) return null
  const tradingDays = Math.round(((nowSec - ipoTs) / 86400) * 5 / 7)
  if (tradingDays > 30 && after.length > tradingDays * 1.4) return null
  const c = after.map(x => x.c)
  const ipoP = c[0], peak = Math.max(...c), cur = c[c.length - 1]
  const trough = Math.min(...c.slice(c.indexOf(peak)))
  const mo = Math.round((nowSec - ipoTs) / (30.4 * 86400))
  const { phase, curveX } = judgeIpoPhase(mo, ipoP, peak, trough, cur)
  // 스파크: 첫날 종가 = 100, 최대 60포인트 + 마지막 값은 항상 포함
  const step = Math.max(1, Math.floor(c.length / 60))
  const spark = c.filter((_, i) => i % step === 0 || i === c.length - 1).map(v => Math.round(v / ipoP * 100))
  const r2 = (v: number) => Math.round(v * 100) / 100
  return {
    ticker: e.ticker, name: e.name, ipo: e.ipo, months: mo,
    ipoPrice: r2(ipoP), ipoBarDate: dayOf(after[0].ts), peak: r2(peak), trough: r2(trough), current: r2(cur), lastBar: dayOf(after[after.length - 1].ts),
    ddFromPeak: Math.round((cur - peak) / peak * 1000) / 10, upFromTrough: Math.round((cur - trough) / trough * 1000) / 10, multiple: r2(cur / ipoP),
    phase, curveX, spark, ...(e.auto ? { auto: true } : {}),
  }
}
