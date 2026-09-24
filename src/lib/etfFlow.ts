// 🇺🇸 미국 ETF 자금 흐름 SSOT — "돈이 어느 섹터로 가고 있나". 무료 자금유입 API 는 없다(Phase 0 실측 2026-09-19: Yahoo sharesOutstanding 은
//    ETF 에서 undefined, iShares CSV 는 HTML 로 막힘). 대신 Yahoo 가 ETF 의 **순자산(totalAssets)·NAV** 를 매일 주므로 스냅샷을 적립해
//    순유입을 역산한다:  flow(d) = AUM(d) − AUM(d−1) × NAV(d)/NAV(d−1)   (자산 변화에서 시장 등락분을 뺀 나머지 = 들어오거나 나간 돈)
//    가이던스 레이더의 '스냅샷 적립' 전략과 같다 — 첫 1주는 자금 흐름이 비어 있고 그 사실을 화면에 그대로 적는다(없으면 없다).
//    거래량 급증·1개월 등락은 캔들 SSOT 로 첫날부터 계산한다. ⛔ 새 판정 점수 없음 · 섹터 로테이션 시계(수익률 RRG)를 대체하지 않는다.
import { getCache, setCache } from '@/lib/appCache'
import { getTechCandles, dropIncompleteBar } from '@/lib/techChartData'

export const ETF_SNAP_KEY = (day: string) => `etf-snap-v1:${day}`          // day = YYYY-MM-DD (미국 동부)
export const ETF_FLOW_KEY = (kst: string) => `etf-flow-v3:${kst}`   // v3: sharesProbe 필드 추가(필드가 늘어도 올린다) · v2: 순자산 동결 구간 null
export const ETF_SNAP_MARK = (kst: string) => `etf-snap-run-v1:${kst}`

export type EtfGroup = 'index' | 'sector' | 'style' | 'geo' | 'theme' | 'bond' | 'lever'
export interface EtfDef { t: string; name: string; group: EtfGroup; tag?: string }
/** 유니버스 — 보고서의 축(섹터·스타일·지역·테마·레버리지 vs 지수형)을 대표 ETF 로. 정적 참조 목록(상품 코드)이라 하드코딩 허용 */
export const ETF_UNIVERSE: EtfDef[] = [
  { t: 'SPY', name: 'S&P 500', group: 'index' }, { t: 'QQQ', name: '나스닥 100', group: 'index' }, { t: 'DIA', name: '다우 30', group: 'index' }, { t: 'VTI', name: '미국 전체', group: 'index' },
  { t: 'XLK', name: 'IT/기술', group: 'sector' }, { t: 'XLV', name: '헬스케어', group: 'sector' }, { t: 'XLF', name: '금융', group: 'sector' }, { t: 'XLY', name: '자유소비재', group: 'sector' },
  { t: 'XLC', name: '커뮤니케이션', group: 'sector' }, { t: 'XLI', name: '산업재', group: 'sector' }, { t: 'XLP', name: '필수소비재', group: 'sector' }, { t: 'XLE', name: '에너지', group: 'sector' },
  { t: 'XLB', name: '소재', group: 'sector' }, { t: 'XLRE', name: '부동산', group: 'sector' }, { t: 'XLU', name: '유틸리티', group: 'sector' },
  { t: 'IWF', name: '대형 성장주', group: 'style', tag: 'growth' }, { t: 'IWD', name: '대형 가치주', group: 'style', tag: 'value' }, { t: 'IWM', name: '소형주', group: 'style', tag: 'small' }, { t: 'OEF', name: '초대형 100', group: 'style', tag: 'large' },
  { t: 'EFA', name: '선진국(미국 외)', group: 'geo' }, { t: 'EEM', name: '신흥국', group: 'geo' }, { t: 'EWJ', name: '일본', group: 'geo' }, { t: 'EWY', name: '한국', group: 'geo' }, { t: 'FXI', name: '중국 대형주', group: 'geo' }, { t: 'INDA', name: '인도', group: 'geo' },
  { t: 'SMH', name: '반도체', group: 'theme' }, { t: 'ARKK', name: '혁신 성장(ARK)', group: 'theme' }, { t: 'ICLN', name: '클린 에너지', group: 'theme' }, { t: 'XBI', name: '바이오', group: 'theme' }, { t: 'ITA', name: '방산', group: 'theme' }, { t: 'IBIT', name: '비트코인 현물', group: 'theme' }, { t: 'GLD', name: '금', group: 'theme' },
  { t: 'TLT', name: '장기 국채', group: 'bond' }, { t: 'HYG', name: '하이일드 회사채', group: 'bond' }, { t: 'LQD', name: '투자등급 회사채', group: 'bond' }, { t: 'BIL', name: '단기 국채(현금성)', group: 'bond' },
  { t: 'TQQQ', name: '나스닥 3배', group: 'lever' }, { t: 'SQQQ', name: '나스닥 −3배', group: 'lever' }, { t: 'SOXL', name: '반도체 3배', group: 'lever' }, { t: 'SPXS', name: 'S&P −3배', group: 'lever' },
]
export const GROUP_KO: Record<EtfGroup, string> = { index: '지수형(기관 장기자금)', sector: '섹터', style: '스타일', geo: '지역', theme: '테마', bond: '채권·현금', lever: '레버리지·인버스(단기 투기)' }

export interface EtfSnap {
  aum: number; nav: number; price: number | null
  /** 발행주수(`quote().sharesOutstanding`) — 2026-09-24 실측: SPY·GBTC 엔 오고 IBIT·FBTC 엔 없다. null = 야후가 안 줌 · 없음(undefined) = 그날 못 물어봄(옛 스냅샷·배치 실패).
   *  ⚠️ 아직 계산에 쓰지 않는다 — 매일 갱신되는지 며칠 적립해 `sharesProbe` 로 본 뒤 Δ주수×NAV 전환 여부를 결정한다(순자산 동결 사고 재발 방지). */
  shares?: number | null
}
export type EtfSnapDoc = { day: string; at: string; etfs: Record<string, EtfSnap> }

const etDay = (off = 0) => new Date(Date.now() - 5 * 3600_000 - off * 86400_000).toISOString().slice(0, 10)

/** 하루 1회 스냅샷 — Yahoo quoteSummary(summaryDetail.totalAssets·navPrice). 같은 날 두 번 돌면 덮어쓴다(멱등) */
export async function snapshotEtfs(): Promise<{ day: string; ok: number; fail: string[]; skipped?: 'weekend' }> {
  // 직전 거래일이 주말이면(일·월요일에 heal 로 불렸을 때) 저장하지 않는다 — 금요일 값이 두 번 들어가면 1주 순유입 창이 틀어진다
  const wd = new Date(`${etDay(1)}T12:00:00Z`).getUTCDay()
  if (wd === 0 || wd === 6) return { day: etDay(1), ok: 0, fail: [], skipped: 'weekend' }
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  // 크론은 화~토 10:20 UTC(미국 전날 장 마감 뒤) — 스냅샷은 **직전 거래일** 이름으로 저장한다(주말엔 안 돌아 중복 0 이 안 생긴다)
  const day = etDay(1)
  const doc: EtfSnapDoc = { day, at: new Date().toISOString(), etfs: {} }
  const fail: string[] = []
  for (let i = 0; i < ETF_UNIVERSE.length; i += 4) {
    await Promise.all(ETF_UNIVERSE.slice(i, i + 4).map(async e => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s: any = await yf.quoteSummary(e.t, { modules: ['summaryDetail', 'price'] })
        const aum = s?.summaryDetail?.totalAssets, nav = s?.summaryDetail?.navPrice
        if (typeof aum === 'number' && typeof nav === 'number' && aum > 0 && nav > 0) doc.etfs[e.t] = { aum, nav, price: typeof s?.price?.regularMarketPrice === 'number' ? s.price.regularMarketPrice : null }
        else fail.push(e.t)
      } catch { fail.push(e.t) }
    }))
  }
  // 발행주수 — quote() 는 배치 한 번(40심볼). 실패해도 스냅샷은 살린다(순자산·NAV 가 본체). 배치가 실패하면 shares 를 아예 안 적어 '못 물어봄'으로 남긴다
  try {
    const qs = await yf.quote(ETF_UNIVERSE.map(e => e.t))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byT = new Map<string, any>((Array.isArray(qs) ? qs : [qs]).map((q: any) => [q?.symbol, q]))
    for (const t of Object.keys(doc.etfs)) {
      const so = byT.get(t)?.sharesOutstanding
      doc.etfs[t].shares = typeof so === 'number' && so > 0 ? so : null
    }
  } catch { /* 발행주수만 비운다 */ }
  const ok = Object.keys(doc.etfs).length
  if (ok >= ETF_UNIVERSE.length * 0.8) await setCache(ETF_SNAP_KEY(day), doc)   // 부분실패 박제 금지
  return { day, ok, fail }
}

/** 발행주수 실측표 — "야후 발행주수가 매일 바뀌는가"에 답하기 위한 진단. 순유입 계산엔 쓰지 않는다. */
export interface EtfSharesProbe {
  askedDays: number                         // shares 를 물어본 스냅샷 날 수(옛 스냅샷은 필드가 없어 제외)
  items: { t: string; days: number; distinct: number; changed: number; first: number; last: number }[]   // 값이 온 종목만 · changed = 연속 스냅샷 사이 값이 바뀐 횟수
  none: string[]                            // 물어봤는데 야후가 한 번도 안 준 종목
  verdict: 'collecting' | 'daily' | 'stale'  // 표본 5일 미만 = collecting · 온 종목 절반 이상이 절반 이상 날에 바뀜 = daily · 아니면 stale
}
export function probeShares(snaps: EtfSnapDoc[]): EtfSharesProbe {
  const asked = snaps.filter(s => Object.values(s.etfs).some(e => e.shares !== undefined))
  const items: EtfSharesProbe['items'] = [], none: string[] = []
  for (const e of ETF_UNIVERSE) {
    const vals = asked.map(s => s.etfs[e.t]?.shares).filter((v): v is number => typeof v === 'number')
    if (!vals.length) { if (asked.some(s => s.etfs[e.t]?.shares === null)) none.push(e.t); continue }
    let changed = 0
    for (let i = 1; i < vals.length; i++) if (vals[i] !== vals[i - 1]) changed++
    items.push({ t: e.t, days: vals.length, distinct: new Set(vals).size, changed, first: vals[0], last: vals[vals.length - 1] })
  }
  const enough = items.filter(i => i.days >= 5)
  const daily = enough.filter(i => i.changed >= (i.days - 1) / 2)
  const verdict: EtfSharesProbe['verdict'] = asked.length < 5 || !enough.length ? 'collecting' : daily.length * 2 >= enough.length ? 'daily' : 'stale'
  return { askedDays: asked.length, items, none, verdict }
}

export interface EtfFlowItem {
  t: string; name: string; group: EtfGroup; groupKo: string
  aum: number                               // 최신 순자산(USD)
  flow1w: number | null; flow1m: number | null   // 역산 순유입(USD) — 스냅샷이 모자라거나 기간이 벌어지면 null
  flow1wRange: string | null; flow1mRange: string | null   // 실제로 잰 구간(MM-DD~MM-DD) — '1주'라는 라벨이 거짓이 되지 않게 함께 보여준다
  flow1wPct: number | null                  // 1주 순유입 / 순자산 %
  accel: boolean                            // 1주 일평균 유입이 1개월 일평균의 1.5배 이상(그리고 양수)
  ret1m: number | null; volX: number | null // 1개월 등락 % · 최근 5일 평균 거래량 / 20일 평균 배수
  divergence: 'inflow-down' | 'outflow-up' | null   // 돈은 들어오는데 값은 내림 / 돈은 나가는데 값은 오름
}
export interface EtfFlow {
  asOf: string
  daysCollected: number; firstDay: string | null; lastDay: string | null
  items: EtfFlowItem[]
  groups: { group: EtfGroup; ko: string; flow1w: number | null; flow1wOf: string | null; flow1m: number | null; flow1mOf: string | null; ret1m: number | null }[]
  answer: string
  usdKrw: number | null
  sharesProbe: EtfSharesProbe               // 발행주수 일별 갱신 실측(진단용 — 화면 순유입엔 미반영)
}

export async function buildEtfFlow(usdKrw: number | null): Promise<EtfFlow> {
  // 최근 45일치 스냅샷(거래일 기준 최대 ~31개)
  const snaps: EtfSnapDoc[] = []
  for (let off = 0; off < 45; off++) { const d = await getCache<EtfSnapDoc>(ETF_SNAP_KEY(etDay(off)), 400 * 86400_000); if (d) snaps.push(d) }
  snaps.sort((a, b) => a.day.localeCompare(b.day))
  // ⚠️ 기간은 **달력으로** 확인한다 — 스냅샷 개수로만 세면 하루 빠진 날에 '1주'가 조용히 2~3주가 된다
  //    (CLAUDE.md 인덱스 산술 함정 · CPI 13개월 차분 사고와 같은 모양). 허용 간격을 넘으면 값을 내지 않는다.
  const flowOver = (t: string, n: number): { v: number; from: string; to: string; span: number } | null => {
    const s = snaps.filter(x => x.etfs[t]).slice(-(n + 1))
    if (s.length < n + 1) return null
    const from = s[0].day, to = s[s.length - 1].day
    const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400_000)
    if (span > n * 1.6 + 4) return null      // n 거래일 ≈ n×1.4 달력일 + 여유. 구멍이 크면 기간을 속이느니 비운다
    let f = 0
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1].etfs[t], b = s[i].etfs[t]
      // ⛔ 2026-09-24 실측: Yahoo totalAssets 가 **여러 날 한 푼도 안 바뀐 채**(IBIT 61,435,101,184 · SPY 811,937,040,000 — 09-18·21·22·24 동일) NAV 만 움직였다.
      //    그대로 계산하면 'ΔAUM 0 − 시장 등락분' = 시장이 오른 만큼이 가짜 유출로 찍힌다(IBIT −3.7B). 순자산이 그대로인데 NAV 가 움직인 구간은 역산 불가 → null
      if (b.aum === a.aum && b.nav !== a.nav) return null
      f += b.aum - a.aum * (b.nav / a.nav)
    }
    return { v: f, from, to, span }
  }
  const items: EtfFlowItem[] = []
  for (const e of ETF_UNIVERSE) {
    const latest = [...snaps].reverse().find(x => x.etfs[e.t])?.etfs[e.t]
    let ret1m: number | null = null, volX: number | null = null
    try {
      const D = dropIncompleteBar(await getTechCandles(e.t, 'US', 'D'), 'US')
      if (D.length > 21) ret1m = Math.round((D[D.length - 1].close / D[D.length - 22].close - 1) * 1000) / 10
      if (D.length > 25) { const v = (k: number, n: number) => D.slice(D.length - k - n, D.length - k).reduce((s, x) => s + (x.volume ?? 0), 0) / n; const base = v(5, 20); volX = base > 0 ? Math.round(v(0, 5) / base * 100) / 100 : null }
    } catch { /* 캔들 실패 — 칸을 비운다 */ }
    if (!latest) continue
    const w = flowOver(e.t, 5), m = flowOver(e.t, 20)
    const flow1w = w?.v ?? null, flow1m = m?.v ?? null
    const accel = w != null && m != null && w.v > 0 && w.v / 5 >= (m.v / 20) * 1.5
    const divergence = flow1m != null && ret1m != null ? (flow1m > 0 && ret1m < -2 ? 'inflow-down' : flow1m < 0 && ret1m > 2 ? 'outflow-up' : null) : null
    items.push({ t: e.t, name: e.name, group: e.group, groupKo: GROUP_KO[e.group], aum: latest.aum, flow1w, flow1m,
      flow1wRange: w ? `${w.from.slice(5)}~${w.to.slice(5)}` : null, flow1mRange: m ? `${m.from.slice(5)}~${m.to.slice(5)}` : null,
      flow1wPct: flow1w != null ? Math.round(flow1w / latest.aum * 1000) / 10 : null, accel, ret1m, volX, divergence })
  }
  const groups = (Object.keys(GROUP_KO) as EtfGroup[]).map(g => {
    const xs = items.filter(i => i.group === g)
    // ⚠️ 그룹 합계는 **값이 있는 것만 더하고 몇 개인지 밝힌다** — 절반이 빠진 합계를 전체인 양 보여주면 그 자체가 거짓말이다
    const sum = (k: 'flow1w' | 'flow1m') => { const v = xs.filter(i => i[k] != null); return v.length ? { v: v.reduce((s, i) => s + (i[k] ?? 0), 0), n: v.length } : null }
    const rets = xs.map(i => i.ret1m).filter((v): v is number => v != null)
    const w = sum('flow1w'), m = sum('flow1m')
    return { group: g, ko: GROUP_KO[g], flow1w: w?.v ?? null, flow1wOf: w ? `${w.n}/${xs.length}` : null, flow1m: m?.v ?? null, flow1mOf: m ? `${m.n}/${xs.length}` : null,
      ret1m: rets.length ? Math.round(rets.reduce((s, v) => s + v, 0) / rets.length * 10) / 10 : null }
  })
  const days = snaps.length
  const haveW = items.some(i => i.flow1w != null)
  const sharesProbe = probeShares(snaps)
  let answer: string
  if (!haveW) {
    const top = [...items].filter(i => i.ret1m != null).sort((a, b) => (b.ret1m ?? 0) - (a.ret1m ?? 0))
    // ⚠️ "1주 뒤부터 보입니다"라고 약속하지 않는다 — 2026-09-24 실측으로 순자산 역산이 멈춰 있어(동결 구간 null) 그 약속은 거짓이 된다.
    //    지금 상태(비어 있음 · 왜 · 무엇을 재는 중)를 그대로 적는다
    const why = days >= 6 ? `순유입은 비어 있음(출처의 순자산이 여러 날 같은 값이라 역산을 멈춤 · 발행주수 방식 실측 ${sharesProbe.askedDays}일째)` : `순유입은 ${days}일째 모으는 중`
    answer = `${why} · 지금 볼 수 있는 건 값의 흐름 — 1개월 가장 오른 곳 ${top[0] ? `${top[0].name} ${top[0].ret1m! >= 0 ? '+' : ''}${top[0].ret1m}%` : '—'}, 가장 내린 곳 ${top[top.length - 1] ? `${top[top.length - 1].name} ${top[top.length - 1].ret1m}%` : '—'}`
  } else {
    const sec = items.filter(i => i.group === 'sector' && i.flow1w != null).sort((a, b) => (b.flow1w ?? 0) - (a.flow1w ?? 0))
    const acc = items.filter(i => i.accel)
    answer = `이번 주 돈이 가장 들어온 섹터 ${sec[0]?.name ?? '—'}, 가장 나간 섹터 ${sec[sec.length - 1]?.name ?? '—'}` + (acc.length ? ` · 유입이 빨라지는 곳 ${acc.slice(0, 3).map(a => a.name).join('·')}` : '')
  }
  return { asOf: new Date().toISOString(), daysCollected: days, firstDay: snaps[0]?.day ?? null, lastDay: snaps[snaps.length - 1]?.day ?? null, items, groups, answer, usdKrw, sharesProbe }
}
