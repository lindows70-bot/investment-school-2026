// 🧮 금리 3형제 SSOT — 미국채 10년 명목(DGS10) = TIPS 실질(DFII10) + 기대인플레 BEI(T10YIE) 분해·판정·문구
//   Phase 0 실측(2026-08-13): 세 계열 모두 일별·% 스케일, 항등식 오차 0.0000%p(250일 검사) —
//   T10YIE 자체가 DGS10−DFII10 로 정의되므로 셋의 관계는 통계적 상관이 아니라 **항등식(분해)**이다.
//   ⚠️ 임계값(주도 0.15%p·실질 2%/1%·BEI 1.8~2.5)은 역사 구간 서술 기준이지 백테스트 수치가 아니다(docs/real-yield).

export interface RealYieldPoint { date: string; n: number | null; r: number | null; b: number | null }
export interface RealYieldResult {
  nominal: { v: number; date: string }
  real: { v: number; date: string }
  bei: { v: number; date: string }
  /** 60거래일(약 3개월) 변화 분해 — Δ명목 = Δ실질 + ΔBEI */
  chg60: { nominal: number; real: number; bei: number }
  /** 무엇이 금리를 움직였나 — real/bei 주도, calm(변화 미미), mixed(반반) */
  driver: 'real' | 'bei' | 'mixed' | 'calm'
  driverNote: string
  /** 수준 읽기 — 학생 말로 */
  levelNotes: string[]
  /** 📐 실질 vs 기대인플레 위치 — 실질이 BEI를 넘어선 상태는 해석이 갈리는 신호라 양면을 병기한다
   *  (성장 기대가 밀어올렸다는 낙관론 vs 돈값이 긴축적이라는 부담론 — 2026-08 매크로 영상 검토에서 보강). */
  realVsBei: { above: boolean; gapPp: number; sinceDate: string | null } | null
  /** 2년 주별 시계열(차트용 다운샘플) */
  series: RealYieldPoint[]
}

const FRED = 'https://api.stlouisfed.org/fred/series/observations'
async function fredSeries(series: string, startISO: string): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(
      `${FRED}?series_id=${series}&api_key=${key}&file_type=json&observation_start=${startISO}`,
      { signal: AbortSignal.timeout(12_000), cache: 'no-store' },
    )
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) }))
      .filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}

const r2 = (n: number) => Math.round(n * 100) / 100

export async function buildRealYield(): Promise<RealYieldResult | null> {
  const start = new Date(Date.now() - 2.2 * 365 * 864e5).toISOString().slice(0, 10)
  const [nom, real, bei] = await Promise.all([
    fredSeries('DGS10', start), fredSeries('DFII10', start), fredSeries('T10YIE', start),
  ])
  if (nom.length < 100 || real.length < 100 || bei.length < 100) return null   // 부분실패면 섹션 자체를 접는다

  const chg = (a: { v: number }[], back: number) => a.length > back ? a[a.length - 1].v - a[a.length - 1 - back].v : 0
  const dN = r2(chg(nom, 60)), dR = r2(chg(real, 60)), dB = r2(chg(bei, 60))

  // 주도 판정 — 명목 변화가 유의(≥0.15%p)할 때, 방향이 같고 기여 55% 이상인 성분
  let driver: RealYieldResult['driver'] = 'calm'
  if (Math.abs(dN) >= 0.15) {
    const rShare = Math.abs(dR) / (Math.abs(dR) + Math.abs(dB) || 1)
    const rAligned = Math.sign(dR) === Math.sign(dN), bAligned = Math.sign(dB) === Math.sign(dN)
    if (rAligned && (rShare >= 0.55 || !bAligned)) driver = 'real'
    else if (bAligned && (rShare <= 0.45 || !rAligned)) driver = 'bei'
    else driver = 'mixed'
  }
  const up = dN > 0
  const driverNote =
    driver === 'calm' ? `최근 3개월 금리는 크게 움직이지 않았습니다(${dN >= 0 ? '+' : ''}${dN}%p).`
    : driver === 'real' ? (up
      ? `최근 금리 상승(+${dN}%p)은 **돈의 진짜 값(실질금리 ${dR >= 0 ? '+' : ''}${dR}%p)**이 끌었습니다 — 물가 걱정형 상승이 아닙니다. 해석은 둘로 갈립니다: 돈값이 비싸져 성장주·장기채에 부담이라는 읽기와, 기대인플레가 고정된 채 실질만 오르는 건 시장이 성장을 자신한다는 뜻(성장 프리미엄)이라는 읽기 — 어느 쪽인지는 기업 실적이 따라오는지로 판가름 납니다.`
      : `최근 금리 하락(${dN}%p)은 실질금리(${dR}%p)가 끌었습니다 — 돈값이 싸지는 것이라 성장주·장기채에 순풍입니다.`)
    : driver === 'bei' ? (up
      ? `최근 금리 상승(+${dN}%p)은 **물가 기대(BEI ${dB >= 0 ? '+' : ''}${dB}%p)**가 끌었습니다 — 인플레 걱정형 상승이라 실물자산·물가연동채가 상대적으로 유리합니다.`
      : `최근 금리 하락(${dN}%p)은 물가 기대(${dB}%p)가 끌었습니다 — 인플레 걱정이 줄고 있다는 뜻이지만, 과하면 수요 둔화 걱정으로 읽힙니다.`)
    : `최근 금리 변화(${dN >= 0 ? '+' : ''}${dN}%p)는 실질(${dR >= 0 ? '+' : ''}${dR}%p)과 물가 기대(${dB >= 0 ? '+' : ''}${dB}%p)가 함께 만들었습니다.`

  // 📐 실질 vs BEI — 같은 날짜끼리 비교(계열별 최신일이 달라 최신값끼리 섞으면 안 된다. 공식 줄과 같은 이유)
  const beiByDate = new Map(bei.map(x => [x.date, x.v]))
  let realVsBei: RealYieldResult['realVsBei'] = null
  {
    const aligned = real.filter(x => beiByDate.has(x.date))
    if (aligned.length >= 20) {
      const lastA = aligned[aligned.length - 1]
      const above = lastA.v > (beiByDate.get(lastA.date) as number)
      // 지금 상태(above/below)가 언제부터 이어졌나 — 뒤에서부터 상태가 바뀐 첫 지점
      let sinceDate: string | null = null
      for (let i = aligned.length - 1; i >= 0; i--) {
        const a = aligned[i]
        if ((a.v > (beiByDate.get(a.date) as number)) !== above) break
        sinceDate = a.date
      }
      // 창(2.2년) 전체가 같은 상태면 sinceDate는 "창 시작"일 뿐이라 시작일을 주장하지 않는다
      if (sinceDate === aligned[0].date) sinceDate = null
      realVsBei = { above, gapPp: r2(lastA.v - (beiByDate.get(lastA.date) as number)), sinceDate }
    }
  }

  const realV = real[real.length - 1].v, beiV = bei[bei.length - 1].v
  const levelNotes: string[] = []
  levelNotes.push(
    realV >= 2 ? `실질금리 ${realV}%는 **긴축적인 수준**입니다 — 2010년대 평균(약 0.5%)의 4배쯤 되는 돈값이라, 기업이 돈을 빌려 성장하기 부담스러운 환경입니다.`
    : realV >= 1 ? `실질금리 ${realV}%는 중간 수준입니다 — 2010년대(약 0.5%)보다는 높지만 극단적 긴축은 아닙니다.`
    : `실질금리 ${realV}%는 느슨한 수준입니다 — 돈값이 싸서 성장 자산에 우호적인 환경입니다.`,
  )
  levelNotes.push(
    beiV >= 1.8 && beiV <= 2.5 ? `기대인플레 ${beiV}%는 연준 목표(2%) 부근에 **잘 고정**되어 있습니다 — 시장이 물가를 신뢰하고 있다는 뜻입니다.`
    : beiV > 2.5 ? `기대인플레 ${beiV}%는 연준 목표(2%)에서 **위로 이탈**했습니다 — 물가 재점화 걱정이 가격에 실리는 중입니다.`
    : `기대인플레 ${beiV}%는 목표(2%) 아래입니다 — 물가보다 수요 둔화 걱정이 커지는 신호일 수 있습니다.`,
  )

  // 주 1점 다운샘플 — 세 계열을 명목 날짜 기준으로 정렬(금~월 결측은 직전값 유지 없이 null 그대로)
  const rMap = new Map(real.map(x => [x.date, x.v])), bMap = new Map(bei.map(x => [x.date, x.v]))
  const series: RealYieldPoint[] = []
  for (let i = 0; i < nom.length; i += 5) {
    const x = nom[i]
    series.push({ date: x.date, n: r2(x.v), r: rMap.has(x.date) ? r2(rMap.get(x.date)!) : null, b: bMap.has(x.date) ? r2(bMap.get(x.date)!) : null })
  }
  const lastPt = nom[nom.length - 1]
  if (series[series.length - 1]?.date !== lastPt.date) {
    series.push({ date: lastPt.date, n: r2(lastPt.v), r: rMap.has(lastPt.date) ? r2(rMap.get(lastPt.date)!) : null, b: bMap.has(lastPt.date) ? r2(bMap.get(lastPt.date)!) : null })
  }

  return {
    nominal: { v: r2(nom[nom.length - 1].v), date: nom[nom.length - 1].date },
    real: { v: r2(realV), date: real[real.length - 1].date },
    bei: { v: r2(beiV), date: bei[bei.length - 1].date },
    chg60: { nominal: dN, real: dR, bei: dB },
    driver, driverNote, levelNotes, realVsBei, series,
  }
}
