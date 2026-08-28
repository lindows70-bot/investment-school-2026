// 🔌 킬스위치 — "이 계절 판정을 언제 버려야 하나"를 화면이 **미리** 못박아 둔다
//
//   왜 만들었나(2026-08-24) — 앱은 "지금은 여름(인플레이션)"이라고 판정은 주는데
//   **그 판정이 무효가 되는 조건은 어디에도 없었다.** 그래서 학생은 시장이 흔들릴 때
//   볼 종이가 없고, 뉴스에 반응하게 된다.
//   `regime-tripwire` 와 다르다 — 그건 전환이 **일어난 뒤** 알리는 사후 감지고,
//   여기는 뒤집히는 조건을 **미리** 적어 두는 사전 약속이다.
//
// ⛔ 임계값을 지어내지 않는다. 전부 `lib/seasonNavigator` 의 판정식에서 역산한다 —
//    킬스위치가 판정과 다른 잣대를 쓰면 "켜졌는데 계절은 그대로"가 되어 스위치 자체가 거짓말이 된다.
// ⛔ 예측이 아니다. 방향을 맞히려는 게 아니라 **틀렸을 때 알아차리는 장치**다.
// ⛔ 순수 함수·의존성 0.
import { seasonOf, growthFromCli, inflationFromRegime, SEASON_META, type Quadrant } from '@/lib/seasonNavigator'

/** 물가축 임계 — `inflationFromRegime` 의 `cpiYoY > 3.0` 과 **같은 숫자여야 한다** */
export const CPI_HOT_PCT = 3.0

export interface KillSwitchInput {
  cli: number
  cliPrev: number
  /** 다음 발표에서 비교 기준이 될 CLI(= 성장축이 뒤집히는 임계선) */
  cliNextPrev: number
  cpiYoY: number
  rateDir: 'cut' | 'hold' | 'hike'
}

export interface KillSwitchRow {
  key: 'growth' | 'cpi' | 'rate'
  /** 무엇을 보나 */
  what: string
  /** 어디서 확인하나 — 학생이 직접 갈 수 있는 곳 */
  where: string
  /** 얼마나 자주 */
  cycle: string
  /** 지금 값(표시용 문자열) */
  now: string
  /** 켜지는 지점 */
  trip: string
  /** 임계까지 남은 거리(없으면 null — 예/아니오 스위치) */
  gap: string | null
  /** 이미 켜져 있나 */
  lit: boolean
}

export interface KillSwitchResult {
  /** 현재 판정(입력으로 재현한 것 — 화면 판정과 같아야 한다) */
  quadrant: Quadrant
  seasonKo: string
  rows: KillSwitchRow[]
  /** 성장 스위치가 켜지면 어느 계절이 되나 */
  ifGrowthFlips: { quadrant: Quadrant; seasonKo: string }
  /** 물가 스위치가 켜지면(두 조건 동시) 어느 계절이 되나 */
  ifInflationFlips: { quadrant: Quadrant; seasonKo: string }
  /** 둘 다 켜지면 */
  ifBothFlip: { quadrant: Quadrant; seasonKo: string }
  /** 🔴 물가축은 OR 게이트라 한쪽만 꺼져선 안 바뀐다 — 이 사실을 화면이 반드시 말해야 한다 */
  inflationGateNote: string
  /** 감시에서 **뺀** 것과 그 이유 — 고른 이유만 말하면 목록이 자의적으로 보인다 */
  excluded: { name: string; why: string }[]
}

const fmt = (n: number, d = 3) => n.toFixed(d)
/** 거리 표기는 크기만 쓴다 — 방향은 옆 문구('하락 시 켜짐')가 말하므로 부호를 겹쳐 쓰면 헷갈린다 */
const pp = (n: number) => `${Math.abs(n).toFixed(1)}%p`

export function killSwitch(inp: KillSwitchInput): KillSwitchResult {
  const g = growthFromCli(inp.cli, inp.cliPrev)
  const i = inflationFromRegime(inp.cpiYoY, inp.rateDir)
  const quadrant = seasonOf(g, i)

  // 축을 하나씩 뒤집었을 때의 계절 — 2×2 라 결과가 정확히 정해진다(개수를 세는 투표가 필요 없다).
  //   성장 뒤집기 = cliPrev 를 cli 반대편으로 두어 dir 을 반전시킨다(판정식을 그대로 태운다).
  const gFlip = growthFromCli(inp.cli, g.dir === 'up' ? inp.cli + 1 : inp.cli - 1)
  //   물가 뒤집기 = hot 의 두 조건을 **동시에** 끈다/켠다(OR 게이트라 한쪽만으론 안 바뀐다)
  const iFlip = i.hot
    ? inflationFromRegime(Math.min(inp.cpiYoY, CPI_HOT_PCT), 'hold')
    : inflationFromRegime(Math.max(inp.cpiYoY, CPI_HOT_PCT + 0.1), 'hike')
  const q = (qq: Quadrant) => ({ quadrant: qq, seasonKo: SEASON_META[qq].seasonKo })

  // ── 성장 스위치 — `growthUp` 은 결국 `cli >= cliPrev`. 다음 발표의 비교 기준은 cliNextPrev 다.
  const growthLit = g.dir === 'down'
  const growthGap = inp.cli - inp.cliNextPrev
  const rows: KillSwitchRow[] = [
    {
      key: 'growth',
      what: '미국 OECD 경기선행지수(CLI)',
      where: 'FRED — series USALOLITOAASTSAM',
      cycle: '월 1회(약 2개월 지연 발표)',
      now: `${fmt(inp.cli)} (3개월 전 ${fmt(inp.cliPrev)} 대비 ${growthGapSign(inp.cli - inp.cliPrev)})`,
      trip: `다음 발표가 ${fmt(inp.cliNextPrev)} 미만이면 성장축 하강`,
      // '거리'는 부호만 쓰면 방향이 헷갈린다 — 무엇이 얼마나 움직여야 켜지는지 말로 붙인다
      gap: growthGap >= 0 ? `${fmt(growthGap)} 하락 시 켜짐` : `이미 ${fmt(-growthGap)} 아래`,
      lit: growthLit,
    },
    {
      key: 'cpi',
      what: '소비자물가 상승률(CPI YoY)',
      where: '앱 매크로 대시보드 · FRED CPIAUCSL',
      cycle: '월 1회',
      now: `${inp.cpiYoY.toFixed(1)}%`,
      trip: `${CPI_HOT_PCT.toFixed(1)}% 이하로 내려오면 물가 압력 해제`,
      gap: inp.cpiYoY > CPI_HOT_PCT ? `${pp(inp.cpiYoY - CPI_HOT_PCT)} 하락 시 켜짐` : `이미 ${pp(CPI_HOT_PCT - inp.cpiYoY)} 아래`,
      lit: inp.cpiYoY <= CPI_HOT_PCT,
    },
    {
      key: 'rate',
      what: '기준금리 방향',
      where: '앱 FedWatch(CME 선물)',
      cycle: 'FOMC 때마다',
      now: RATE_KO[inp.rateDir],
      trip: '인상 기조가 끝나면(동결·인하) 물가 압력 해제',
      gap: null,
      lit: inp.rateDir !== 'hike',
    },
  ]

  return {
    quadrant, seasonKo: SEASON_META[quadrant].seasonKo,
    rows,
    ifGrowthFlips: q(seasonOf(gFlip, i)),
    ifInflationFlips: q(seasonOf(g, iFlip)),
    ifBothFlip: q(seasonOf(gFlip, iFlip)),
    inflationGateNote: inflationGateNote(inp),
    excluded: [
      { name: 'VIX(공포지수)·환율·유가', why: '계절 판정식에 들어가지 않습니다. 흔들려도 계절은 바뀌지 않아 감시 항목이 아니라 걱정거리가 됩니다.' },
      { name: '외국인 순매수', why: '수급은 종목 점수에 쓰지만 계절 판정에는 안 씁니다. 여기 넣으면 "켜졌는데 계절은 그대로"가 됩니다.' },
      { name: '장단기 금리차 역전', why: '판정식엔 없습니다 — 이미 같은 화면 위쪽에서 별도 조기경보로 따로 보여주고 있습니다.' },
    ],
  }
}

const RATE_KO: Record<'cut' | 'hold' | 'hike', string> = { cut: '인하', hold: '동결', hike: '인상' }
const growthGapSign = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(3)}`

/** 🔴 물가축은 `cpiYoY > 3.0 || rateDir === 'hike'` — **OR** 이라 한쪽만 꺼져선 안 뒤집힌다.
 *  "CPI 3% 아래로 오면 봄"이라고 읽히면 거짓말이 되므로 지금 몇 겹이 잠겨 있는지 문장으로 말한다. */
function inflationGateNote(inp: KillSwitchInput): string {
  const cpiHot = inp.cpiYoY > CPI_HOT_PCT
  const rateHot = inp.rateDir === 'hike'
  if (cpiHot && rateHot)
    return `물가 압력은 **두 겹으로 잠겨** 있습니다 — CPI ${inp.cpiYoY.toFixed(1)}%(기준 ${CPI_HOT_PCT.toFixed(1)}% 초과)와 금리 인상 기조가 **둘 다** 켜져 있습니다.`
      + ` 그래서 **CPI가 ${CPI_HOT_PCT.toFixed(1)}% 아래로 내려오는 것만으로는 계절이 바뀌지 않습니다** — 금리 인상 기조가 함께 끝나야 합니다.`
  if (cpiHot)
    return `물가 압력을 켜고 있는 건 **CPI ${inp.cpiYoY.toFixed(1)}%** 하나입니다(금리는 ${RATE_KO[inp.rateDir]}). CPI가 ${CPI_HOT_PCT.toFixed(1)}% 이하로 내려오면 물가축이 뒤집힙니다.`
  if (rateHot)
    return `물가 압력을 켜고 있는 건 **금리 인상 기조** 하나입니다(CPI는 이미 ${inp.cpiYoY.toFixed(1)}%로 기준 아래). 인상이 멈추면 물가축이 뒤집힙니다.`
  return `물가 압력은 지금 꺼져 있습니다 — CPI ${inp.cpiYoY.toFixed(1)}%(기준 ${CPI_HOT_PCT.toFixed(1)}% 이하)이고 금리도 ${RATE_KO[inp.rateDir]}입니다.`
    + ` 둘 중 **하나만 켜져도** 물가축은 다시 뒤집힙니다.`
}
