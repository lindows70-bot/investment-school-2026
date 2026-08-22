// 📉 금리 인하 사이클 역사 SSOT — "경기가 좋을 때 인하하면 어떻게 됐나"를 데이터로 답한다.
//   ⚠️ Phase 0 실측에서 **분류 축을 바꿨다**: 침체 시작 여부로 가르면 1975·1992가 '보험성'으로,
//      2019가 '위기성'으로 오분류된다(코로나라는 외생 충격을 규칙이 잡아버린다).
//      → 인하 **시점의 경기 상태**(실업률 수준 + 12개월 추세)로 가르고, 침체 동반 여부는 '결과'로 따로 적는다.
//      원인과 결과를 한 축에 섞으면 판정이 오염된다. 근거: docs/bonds-upgrade/context-notes.md

const FRED = 'https://api.stlouisfed.org/fred/series/observations'

async function fredSeries(series: string, startISO: string): Promise<{ date: string; v: number }[]> {
  const key = process.env.FRED_API_KEY
  if (!key) return []
  try {
    const r = await fetch(`${FRED}?series_id=${series}&api_key=${key}&file_type=json&observation_start=${startISO}`,
      { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return (j.observations ?? [])
      .map((o: { date: string; value: string }) => ({ date: o.date, v: parseFloat(o.value) }))
      .filter((x: { v: number }) => isFinite(x.v))
  } catch { return [] }
}

/** 야후 월봉 — ⚠️ range=max 는 심볼에 따라 조용히 다운샘플된다(^GSPC 501개월→168건 실측).
 *  period1 을 명시하고 **반환 개수로 검증**한다. */
async function yahooMonthly(sym: string, fromISO: string): Promise<{ date: string; c: number }[]> {
  try {
    const p1 = Math.floor(new Date(fromISO).getTime() / 1000)
    const p2 = Math.floor(Date.now() / 1000)
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${p1}&period2=${p2}&interval=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!r.ok) return []
    const q = (await r.json())?.chart?.result?.[0]
    if (!q?.timestamp) return []
    const out: { date: string; c: number }[] = []
    for (let i = 0; i < q.timestamp.length; i++) {
      const c = q.indicators?.quote?.[0]?.close?.[i]
      if (typeof c === 'number' && c > 0) out.push({ date: new Date(q.timestamp[i] * 1000).toISOString().slice(0, 10), c })
    }
    // 해상도 검증 — 기대 개월수의 90% 미만이면 다운샘플된 것이므로 버린다(틀린 값은 없는 값보다 나쁘다)
    if (out.length >= 2) {
      const months = (new Date(out[out.length - 1].date).getTime() - new Date(out[0].date).getTime()) / 864e5 / 30.44
      if (out.length < months * 0.9) return []
    }
    return out
  } catch { return [] }
}

export type CutKind = 'insurance' | 'crisis'

export interface CutCycle {
  /** 인하 사이클 시작월(YYYY-MM-DD) */
  start: string
  fedRate: number
  unrate: number | null
  /** 인하 시점의 실업률 12개월 변화(%p) — 판정 축 */
  unrateChg12: number | null
  inRecessionAtStart: boolean
  kind: CutKind
  kindNote: string
  /** 결과(원인과 분리) — 인하 후 12개월 내 침체가 시작됐나 */
  recessionWithin12m: string | null
  /** 인하 시작 후 S&P500 성과(%) — 1985년 이후만(^GSPC 이력 한계) */
  spx6m: number | null
  spx12m: number | null
  spx24m: number | null
  /** 인하 시작 후 10년물 금리 변화(%p) — 채권 쪽 결과 */
  dgs10Chg12: number | null
}

export interface CutCycleResult {
  cycles: CutCycle[]
  /** 유형별 평균 — ⛔ 표본수를 항상 병기한다 */
  summary: {
    kind: CutKind
    label: string
    n: number
    nWithSpx: number
    avgSpx12: number | null
    medSpx12: number | null
    winRate12: number | null
    avgDgs10Chg12: number | null
    recessionRate: number | null
    /** 표본 부족으로 통계를 내지 않았을 때의 사유(빈칸을 '데이터 없음'으로 오해하지 않도록) */
    suppressed: string | null
  }[]
  /** 현재 사이클(있으면) */
  current: CutCycle | null
  note: string
}

const med = (a: number[]) => {
  if (!a.length) return null
  const s = a.slice().sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round(((s[s.length / 2 - 1] + s[s.length / 2]) / 2) * 10) / 10
}
const avg = (a: number[]) => a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : null

/** 실업률 12개월 변화 임계 — Sahm 룰(0.5%p)과 같은 잣대를 쓴다(잣대를 새로 만들지 않는다) */
export const UNRATE_STRESS_PP = 0.5

export async function buildCutCycles(): Promise<CutCycleResult | null> {
  const [ff, rec, un, dgs10, spx] = await Promise.all([
    fredSeries('FEDFUNDS', '1954-07-01'),
    fredSeries('USREC', '1954-07-01'),
    fredSeries('UNRATE', '1953-01-01'),
    fredSeries('DGS10', '1962-01-01'),
    yahooMonthly('^GSPC', '1980-01-01'),
  ])
  if (ff.length < 200 || un.length < 200) return null

  const recAt = (d: string) => rec.find(r => r.date === d)?.v ?? null
  const unIdx = new Map(un.map((o, i) => [o.date, i]))

  // 인하 사이클 시작 = 3개월 누적 −0.5%p 이상 하락한 첫 달(직전 18개월 내 다른 시작이 없을 때)
  const starts: { date: string; v: number }[] = []
  for (let i = 3; i < ff.length; i++) {
    if (ff[i].v - ff[i - 3].v > -0.5) continue
    const prev = starts[starts.length - 1]
    if (prev && (new Date(ff[i].date).getTime() - new Date(prev.date).getTime()) / 864e5 < 540) continue
    starts.push(ff[i])
  }

  const monthsAfter = (arr: { date: string; c: number }[], from: string, m: number): number | null => {
    const t0 = arr.find(x => x.date >= from)
    if (!t0) return null
    const target = new Date(new Date(from).getTime() + m * 30.44 * 864e5).toISOString().slice(0, 10)
    const t1 = arr.filter(x => x.date <= target).pop()
    if (!t1 || t1.date <= t0.date) return null
    return Math.round(((t1.c / t0.c - 1) * 100) * 10) / 10
  }

  const cycles: CutCycle[] = starts.map(s => {
    const i = unIdx.get(s.date)
    const u0 = i != null ? un[i].v : null
    const u12 = i != null && i >= 12 ? un[i - 12].v : null
    const du = u0 != null && u12 != null ? Math.round((u0 - u12) * 10) / 10 : null
    const inRec = recAt(s.date) === 1

    // ⛔ 판정은 '인하 시점의 경기 상태'만 본다 — 뒤에 무슨 일이 있었는지(침체)는 결과이지 원인이 아니다
    const kind: CutKind = (inRec || (du != null && du >= UNRATE_STRESS_PP)) ? 'crisis' : 'insurance'
    const kindNote = kind === 'insurance'
      ? `인하 시점에 침체가 아니었고 실업률도 12개월간 ${du != null ? (du >= 0 ? '+' : '') + du.toFixed(1) + '%p' : '안정'} — 경기가 버티는 가운데 미리 낮춘 '보험성' 인하`
      : inRec
        ? '이미 침체 한가운데서 내린 인하 — 경기 방어가 목적'
        : `실업률이 12개월간 ${du != null ? '+' + du.toFixed(1) : ''}%p 올라 이미 나빠지는 중이었던 인하`

    const t0 = new Date(s.date).getTime()
    const near = rec.find((r, k) => k > 0 && r.v === 1 && rec[k - 1].v === 0
      && (new Date(r.date).getTime() - t0) / 864e5 > 0 && (new Date(r.date).getTime() - t0) / 864e5 <= 400)

    const d10a = dgs10.find(x => x.date >= s.date)
    const tgt = new Date(t0 + 12 * 30.44 * 864e5).toISOString().slice(0, 10)
    const d10b = dgs10.filter(x => x.date <= tgt).pop()

    return {
      start: s.date, fedRate: s.v, unrate: u0, unrateChg12: du, inRecessionAtStart: inRec,
      kind, kindNote,
      recessionWithin12m: near?.date ?? null,
      spx6m: monthsAfter(spx, s.date, 6), spx12m: monthsAfter(spx, s.date, 12), spx24m: monthsAfter(spx, s.date, 24),
      dgs10Chg12: d10a && d10b && d10b.date > d10a.date ? Math.round((d10b.v - d10a.v) * 100) / 100 : null,
    }
  })

  // ⛔ 선별 편향 방어 — 위기성 인하는 대부분 1985년 이전이라 주가 표본이 2건뿐이다.
  //    그대로 평균내면 "위기성 인하가 보험성보다 주가가 좋다(승률 100%)"는 **정반대 결론**이 나온다.
  //    표본 5건 미만이면 통계를 내지 않는다(표본 10건 미만은 통계가 아니라 일화 — ⛔가짜 정밀 금지).
  const MIN_STAT_N = 5
  const summary = (['insurance', 'crisis'] as CutKind[]).map(kind => {
    const g = cycles.filter(c => c.kind === kind)
    const withSpx = g.filter(c => c.spx12m != null)
    const s12 = withSpx.map(c => c.spx12m!)
    const enough = s12.length >= MIN_STAT_N
    const d10 = g.map(c => c.dgs10Chg12).filter((v): v is number => v != null)
    return {
      kind,
      label: kind === 'insurance' ? '🟢 보험성 인하 (경기가 버틸 때)' : '🔴 위기성 인하 (이미 나빠질 때)',
      n: g.length, nWithSpx: withSpx.length,
      avgSpx12: enough ? avg(s12) : null,
      medSpx12: enough ? med(s12) : null,
      winRate12: enough ? Math.round((s12.filter(v => v > 0).length / s12.length) * 100) : null,
      avgDgs10Chg12: d10.length >= MIN_STAT_N ? avg(d10) : null,
      recessionRate: g.length >= MIN_STAT_N ? Math.round((g.filter(c => c.recessionWithin12m != null).length / g.length) * 100) : null,
      /** 통계를 못 낸 이유 — 빈칸을 '데이터 없음'으로 오해하지 않도록 */
      suppressed: !enough ? `주가 표본 ${s12.length}건뿐이라 평균·승률을 내지 않았습니다(${kind === 'crisis' ? '위기성 인하는 대부분 1985년 이전이라 S&P500 이력이 없습니다' : '표본 부족'}).` : null,
    }
  })

  return {
    cycles,
    summary,
    current: cycles.length ? cycles[cycles.length - 1] : null,
    note: `연준 실효금리(FEDFUNDS) 3개월 누적 −0.5%p 이상 하락을 인하 사이클 시작으로 봤습니다(1954년~). 주가 성과는 S&P500 이력상 ${spx[0]?.date.slice(0, 4) ?? '—'}년 이후 사이클만 계산됩니다.`,
  }
}
