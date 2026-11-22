// 바닥 신호 5칸(순수 함수) — "지금이 바닥인가"를 위기 신호등과 따로 묻는다(2026-11-22 사용자 요청 · 영상 'Inside Wall Street' 2026-11-21 의 월가 10명 정리를 숫자로)
//   칸: ① 공포 ② 애플(가장 큰 주식이 빠졌나) ③ 시장 폭(50일선 위 종목 비율) ④ 이익 전망 하향 ⑤ 침체
//   ⚠️ ①은 '반등' 신호지 '바닥 확인' 신호가 아니다 — 영상의 결론("반등 신호는 켜졌지만 바닥 신호는 아직")을 화면이 같은 구조로 말하게 한다
//   선은 지어내지 않는다 — ②는 우리가 야후 일봉으로 다시 센 과거 바닥(2018년부터)의 최소·중간값, ③은 크린스키(BTIG)가 말한 40%·20%,
//   ①은 CNN 의 다섯 구간, ⑤는 삼의 법칙 정의. ④는 FactSet 선행 PER 로 거꾸로 구한 '예상이익'을 주마다 적립해 4주 전보다 줄었는지 본다
//   2026-11-22 재현: 2018년 이후 S&P 500 8%↑ 하락 8번 · 바닥 날 애플(52주 고점 대비) 최소 10.9% · 중간 22.1% · 최대 36.7% · 바닥까지 13~282일

export type BottomState = 'on' | 'half' | 'off' | 'none'
export type BottomKey = 'fear' | 'apple' | 'breadth' | 'eps' | 'recession'
export interface BottomRow { label: string; value: string; note?: string }
export interface BottomItem {
  key: BottomKey; name: string; state: BottomState; stateKo: string
  kind: '반등' | '바닥'          // 이 칸이 알려 주는 것
  line: string; rows: BottomRow[]; rule: string; source: string; date: string | null
}
export interface Episode { peak: string; bottom: string; ddPct: number; days: number; appleDdPct: number | null }
export interface Drawdown { peak: string; peakClose: number; last: string; lastClose: number; ddPct: number; days: number }
export interface BottomSignals {
  items: BottomItem[]
  bounceOn: boolean                      // 반등 신호(공포)가 켜졌나
  bottomOn: number; bottomHalf: number; bottomMeasured: number; bottomTotal: number
  headline: string                       // 한 줄 결론(데이터에서 뽑는다)
  now: Drawdown | null                   // 지금 S&P 500 고점 대비
  episodes: Episode[]                    // 과거 바닥(2018년부터)
}

export interface Close { date: string; c: number }
const DAY = 86_400_000
const r1 = (n: number) => Math.round(n * 10) / 10
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)

/** 하락 에피소드 — 고점에서 minDdPct% 넘게 빠졌다가 새 고점을 낸 구간(끝난 것만). 진행 중인 하락은 now 로 따로 */
export function drawdownEpisodes(spx: Close[], minDdPct = 8): { episodes: { peak: Close; bottom: Close }[]; now: { peak: Close; last: Close } | null } {
  const xs = spx.filter(x => Number.isFinite(x.c) && x.c > 0).sort((a, b) => a.date < b.date ? -1 : 1)
  const out: { peak: Close; bottom: Close }[] = []
  if (!xs.length) return { episodes: out, now: null }
  let peak = xs[0], bottom: Close | null = null
  for (const x of xs) {
    if (x.c >= peak.c) { if (bottom && (1 - bottom.c / peak.c) * 100 > minDdPct) out.push({ peak, bottom }); peak = x; bottom = null }
    else if (!bottom || x.c < bottom.c) bottom = x
  }
  return { episodes: out, now: { peak, last: xs[xs.length - 1] } }
}

/** 그날 애플의 52주(365일) 종가 고점 대비 하락률(%) — 자료가 없으면 null */
export function appleDrawdown(aapl: Close[], date: string): number | null {
  const at = aapl.find(a => a.date === date) ?? aapl.filter(a => a.date <= date).pop()
  if (!at) return null
  const win = aapl.filter(a => a.date <= at.date && ms(a.date) > ms(at.date) - 365 * DAY)
  const hi = Math.max(...win.map(a => a.c))
  return hi > 0 ? r1((1 - at.c / hi) * 100) : null
}

const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN }

export interface EpsPoint { date: string; eps: number }     // FactSet 기준일 · 거꾸로 구한 앞으로 1년 예상이익(S&P 500 지수 단위)
export interface BottomInput {
  mood: { source?: unknown; rating?: unknown; partyScore?: unknown; asOf?: unknown } | null
  vix: { last: { date: string; v: number }; higherPct: number; since: string; analog?: { n: number; episodes: number; lowerPct: number; median: number; band: number; horizon: number } | null } | null
  spx: Close[]; aapl: Close[]
  breadth: { pctAbove50?: unknown; n?: unknown; date?: unknown } | null
  epsHist: EpsPoint[]
  sahm: { v?: unknown; date?: unknown; triggered?: unknown } | null
  since: string                          // 과거 바닥을 셀 첫해(예 '2018-01-01')
}

const KO: Record<BottomState, string> = { on: '켜짐', half: '반쯤', off: '꺼짐', none: '못 잼' }
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function buildBottomSignals(inp: BottomInput): BottomSignals {
  const items: BottomItem[] = []

  // ── 과거 바닥(②·시간 줄이 함께 쓴다) ──
  const ep = drawdownEpisodes(inp.spx)
  const episodes: Episode[] = ep.episodes.filter(e => e.peak.date >= inp.since).map(e => ({
    peak: e.peak.date, bottom: e.bottom.date, ddPct: r1((1 - e.bottom.c / e.peak.c) * 100),
    days: Math.round((ms(e.bottom.date) - ms(e.peak.date)) / DAY), appleDdPct: appleDrawdown(inp.aapl, e.bottom.date),
  }))
  const now: Drawdown | null = ep.now && ep.now.last.date !== ep.now.peak.date
    ? { peak: ep.now.peak.date, peakClose: ep.now.peak.c, last: ep.now.last.date, lastClose: ep.now.last.c, ddPct: r1((1 - ep.now.last.c / ep.now.peak.c) * 100), days: Math.round((ms(ep.now.last.date) - ms(ep.now.peak.date)) / DAY) }
    : null

  // ① 공포 — CNN 다섯 구간 그대로(극단 공포 켜짐 · 공포 반쯤)
  {
    const rt = typeof inp.mood?.rating === 'string' ? inp.mood.rating.trim().toLowerCase() : ''
    const ok = inp.mood?.source === 'cnn' && isNum(inp.mood.partyScore) && ['extreme fear', 'fear', 'neutral', 'greed', 'extreme greed'].includes(rt)
    const state: BottomState = !ok ? 'none' : rt === 'extreme fear' ? 'on' : rt === 'fear' ? 'half' : 'off'
    const rows: BottomRow[] = ok ? [{ label: 'CNN 공포·탐욕 지수', value: `${Math.round(inp.mood!.partyScore as number)}`, note: rt === 'extreme fear' ? '극단 공포' : rt === 'fear' ? '공포' : '공포 아님' }] : []
    const v = inp.vix
    if (v) rows.push({ label: 'VIX', value: v.last.v.toFixed(2), note: `${v.last.date} · ${v.since.slice(0, 4)}년부터 이보다 높았던 날 ${v.higherPct}%` })
    const a = v?.analog
    if (a && a.n > 0) rows.push({ label: `VIX 가 지금과 비슷했던 날(±${a.band}) ${a.horizon}거래일 뒤`, value: `${a.lowerPct}%가 더 낮아짐`, note: `${a.n}일 · 그런데 이어진 날이 많아 서로 다른 일은 ${a.episodes}번뿐이에요 · 뒤 값의 가운데 ${a.median.toFixed(1)}` })
    items.push({
      key: 'fear', name: '공포', kind: '반등', state, stateKo: KO[state], rows,
      line: state === 'on' ? '겁이 꼭대기 근처예요 — 다들 이미 팔았다면 더 팔 사람이 줄어 반등이 나오기 쉬워요. 다만 이건 반등 신호지 바닥을 확인해 주는 신호는 아니에요.'
        : state === 'half' ? '겁이 커졌지만 극단까지는 아니에요.'
        : state === 'off' ? '겁에 질린 시장이 아니에요 — 투매로 바닥을 만드는 장면이 아니에요.' : '공포·탐욕 지수를 못 가져왔어요.',
      rule: 'CNN 공포·탐욕 지수의 다섯 구간 그대로 — 극단 공포 = 켜짐 · 공포 = 반쯤 · 그 밖 = 꺼짐. VIX 와 그 뒤 흐름은 함께 보여 주는 숫자예요.',
      source: 'CNN Fear & Greed · FRED VIXCLS', date: typeof inp.mood?.asOf === 'string' ? inp.mood.asOf.slice(0, 10) : null,
    })
  }

  // ② 애플 — 바닥 날 애플은 얼마나 빠져 있었나(과거에서 선을 뽑는다)
  {
    const past = episodes.map(e => e.appleDdPct).filter((x): x is number => x != null)
    const lastA = inp.aapl[inp.aapl.length - 1]
    const cur = lastA ? appleDrawdown(inp.aapl, lastA.date) : null
    const lo = past.length ? Math.min(...past) : NaN, mid = median(past)
    const ok = cur != null && past.length >= 3
    const state: BottomState = !ok ? 'none' : cur! >= mid ? 'on' : cur! >= lo ? 'half' : 'off'
    items.push({
      key: 'apple', name: '애플', kind: '바닥', state, stateKo: KO[state],
      rows: ok ? [
        { label: '애플 52주 고점 대비', value: `−${cur!.toFixed(1)}%`, note: `${lastA!.date} 종가` },
        { label: `과거 바닥 날의 애플(${past.length}번)`, value: `최소 −${lo.toFixed(1)}% · 가운데 −${mid.toFixed(1)}%`, note: `${inp.since.slice(0, 4)}년부터 S&P 500 이 8% 넘게 빠졌던 ${past.length}번${past.length < 10 ? ' · 10번이 안 돼 통계가 아니라 일화예요' : ''}` },
      ] : [],
      line: !ok ? '애플 주가를 못 가져왔어요.'
        : state === 'on' ? `애플이 고점에서 ${cur!.toFixed(1)}% 빠졌어요 — 과거 바닥 날의 가운데 값(${mid.toFixed(1)}%)만큼 내려왔어요.`
        : state === 'half' ? `애플이 고점에서 ${cur!.toFixed(1)}% 빠졌어요 — 과거 바닥 날 가장 덜 빠졌던 때(${lo.toFixed(1)}%)는 넘었지만 가운데 값(${mid.toFixed(1)}%)엔 못 미쳐요.`
        : `애플은 고점에서 ${cur!.toFixed(1)}%만 빠져 있어요 — 과거 바닥은 애플이 적어도 ${lo.toFixed(1)}% 빠진 뒤에 왔어요. 시장에서 가장 큰 주식이 버티는 동안은 최종 바닥이 나온 적이 없어요.`,
      rule: `과거 바닥 날 애플 하락폭의 가운데 값 이상 = 켜짐 · 가장 작았던 값 이상 = 반쯤 · 그 아래 = 꺼짐. 선은 우리가 야후 일봉으로 다시 센 ${inp.since.slice(0, 4)}년 이후 바닥에서 나와요(BTIG 크린스키가 말한 기준을 재현).`,
      source: '야후 파이낸스 일봉(AAPL · S&P 500)', date: lastA?.date ?? null,
    })
  }

  // ③ 시장 폭 — 50일선 위 종목 비율(크린스키: 오래가는 바닥은 40% 아래, 제대로라면 20% 아래)
  {
    const b = inp.breadth
    const p = isNum(b?.pctAbove50) ? b!.pctAbove50 as number : null
    const state: BottomState = p == null ? 'none' : p < 20 ? 'on' : p < 40 ? 'half' : 'off'
    items.push({
      key: 'breadth', name: '시장 폭', kind: '바닥', state, stateKo: KO[state],
      rows: p != null ? [{ label: '50일 평균선 위에 있는 미국 종목', value: `${p}%`, note: `앱이 보는 미국 종목 ${isNum(b?.n) ? `${b!.n}개` : ''}(S&P 500 그대로는 아니에요)${typeof b?.date === 'string' ? ` · ${b.date}` : ''}` }] : [],
      line: p == null ? '시장 폭을 못 가져왔어요.'
        : state === 'on' ? `50일 평균선 위 종목이 ${p}%뿐이에요 — 거의 모든 종목이 같이 빠졌어요. 오래가는 바닥이 나오던 자리예요.`
        : state === 'half' ? `50일 평균선 위 종목이 ${p}%예요 — 많이 빠졌지만 '제대로 된 바닥'(20% 아래)까진 아니에요.`
        : `50일 평균선 위 종목이 아직 ${p}%예요 — 몇몇 종목만 크게 빠졌고 시장 전체는 덜 빠졌어요.`,
      rule: '20% 아래 = 켜짐 · 40% 아래 = 반쯤 · 그 위 = 꺼짐(BTIG 크린스키가 말한 선 — "오래가는 바닥은 40% 아래, 제대로라면 20% 아래")',
      source: '앱 시장 폭(미국 종목 일봉)', date: typeof b?.date === 'string' ? b.date : null,
    })
  }

  // ④ 이익 전망 하향 — 처음 깎일 때가 신호(도슨: "깎일 걸 예상하고 사는 게 아니라 처음 깎일 때 산다")
  {
    const h = inp.epsHist.slice().sort((a, b) => a.date < b.date ? -1 : 1)
    const last = h[h.length - 1]
    const ago = last ? h.filter(x => ms(x.date) <= ms(last.date) - 25 * DAY).pop() : undefined
    const chg = last && ago ? r1((last.eps / ago.eps - 1) * 100) : null
    const state: BottomState = chg == null ? 'none' : chg < 0 ? 'on' : 'off'
    items.push({
      key: 'eps', name: '이익 전망', kind: '바닥', state, stateKo: chg == null ? '적립 중' : KO[state],
      rows: last ? [
        { label: '앞으로 1년 예상이익(지수 단위)', value: last.eps.toFixed(1), note: `${last.date} · S&P 500 ÷ FactSet 선행 PER` },
        ...(ago && chg != null ? [{ label: `4주 전(${ago.date})보다`, value: `${chg > 0 ? '+' : chg < 0 ? '−' : ''}${Math.abs(chg).toFixed(1)}%` }] : []),
      ] : [],
      line: chg == null ? `아직 비교할 주가 없어요 — ${h[0]?.date ?? '이번 주'}부터 주마다 적립하고 있어요(지금 ${h.length}주). 4주가 쌓이면 켜고 끌 수 있어요.`
        : state === 'on' ? `앞으로 1년 예상이익이 4주 전보다 ${Math.abs(chg).toFixed(1)}% 줄었어요 — 애널리스트들이 전망을 깎기 시작했어요. 과거엔 이때가 사는 때였다는 말이 있어요.`
        : `앞으로 1년 예상이익이 4주 전보다 ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% — 아직 전망을 깎지 않았어요.`,
      rule: '4주 전보다 줄었으면 켜짐 · 아니면 꺼짐. 예상이익은 S&P 500 지수를 FactSet 선행 PER 로 나눠 거꾸로 구한 값이에요(FactSet 이 직접 낸 숫자가 아니라 우리 계산).',
      source: 'FactSet 선행 PER(주간) · 야후 S&P 500 종가', date: last?.date ?? null,
    })
  }

  // ⑤ 침체 — 삼의 법칙(정의 그대로)
  {
    const s = inp.sahm
    const ok = isNum(s?.v) && typeof s?.triggered === 'boolean'
    const state: BottomState = !ok ? 'none' : s!.triggered ? 'on' : 'off'
    items.push({
      key: 'recession', name: '침체', kind: '바닥', state, stateKo: KO[state],
      rows: ok ? [{ label: '삼의 법칙 지표', value: `${(s!.v as number).toFixed(2)}%p`, note: `0.5%p 이상이면 켜짐 · ${typeof s!.date === 'string' ? s!.date.slice(0, 7) : ''}` }] : [],
      line: !ok ? '실업 지표를 못 가져왔어요.'
        : state === 'on' ? '실업률이 오르며 침체 신호가 켜졌어요 — 큰 바닥은 보통 침체와 함께 왔어요.'
        : '침체 신호는 꺼져 있어요 — 침체가 없으면 약세장이 아니라 조정에서 멈출 수 있다는 근거가 돼요(야데니의 말). 대신 투매로 만드는 큰 바닥 장면도 아니에요.',
      rule: '삼의 법칙(실업률 석 달 평균이 최근 1년 저점보다 0.5%p 넘게 오름)이 켜지면 켜짐. 개인 투자자의 투매는 앱이 아직 재지 못해요.',
      source: 'FRED SAHMREALTIME', date: ok && typeof s!.date === 'string' ? s!.date.slice(0, 7) : null,
    })
  }

  const bottoms = items.filter(i => i.kind === '바닥')
  const measured = bottoms.filter(i => i.state !== 'none')
  const on = measured.filter(i => i.state === 'on').length, half = measured.filter(i => i.state === 'half').length
  const bounceOn = items.find(i => i.key === 'fear')?.state === 'on'
  const headline = `${bounceOn ? '반등 신호(공포)는 켜졌고' : '반등 신호(공포)는 꺼져 있고'}, 바닥 신호는 ${measured.length}칸 중 ${on}칸 켜짐${half ? ` · ${half}칸 반쯤` : ''}이에요.`
    + (bounceOn && on === 0 ? ' 반등이 와도 바닥 확인이 아니라 첫 반등으로 읽어야 해요.' : '')
  return { items, bounceOn, bottomOn: on, bottomHalf: half, bottomMeasured: measured.length, bottomTotal: bottoms.length, headline, now, episodes }
}

