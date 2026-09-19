// 🇺🇸 내부자 매수 시장 스캐너 SSOT — SEC 일별 인덱스로 미국 전체 Form 4 를 훑어 30일 장내매수를 모으고(scanDay),
//    보고서의 3필터(질·클러스터·컨버전스)로 걸러 화면 하나로 만든다(buildInsiderMarket). 설계: docs/us-smart-money/plan.md
//    ⛔ 모집단은 앱 유니버스가 아니라 **시장 전체** — "상위 N 은 모집단의 구멍을 물려받는다"(SPCX 사고).
//    ⛔ 임계값($100K·시총 0.1%·2인·52주 저가 +15%)은 보고서 값이지 우리 백테스트 검증치가 아니다 — 화면에 그렇게 적는다.
//    저장: 새 테이블 없이 app_cache 일별 문서(insider-day-v1:{YYYYMMDD}) — 처리한 accession 집합이 곧 커서라 재실행이 멱등.
import { getCache, setCache } from '@/lib/appCache'
import { fetchForm4Index, fetchSubmissionXml, parseForm4Xml, accessionOf } from '@/lib/secForm4'
import { revisionSignalOf } from '@/lib/analystShared'
import { sectorMeta } from '@/lib/gicsSectorMeta'
import { WINDOW_DAYS, LIMITS, type InsiderMarket, type InsiderMarketItem } from '@/lib/insiderMarketShared'
export { WINDOW_DAYS, LIMITS, type InsiderMarket, type InsiderMarketItem }

export const INSIDER_DAY_KEY = (day: string) => `insider-day-v1:${day}`          // day = YYYYMMDD (미국 동부 기준 제출일)
export const INSIDER_MARKET_KEY = (kst: string) => `insider-market-v1:${kst}`
export const INSIDER_SCAN_MARK = (kst: string) => `insider-scan-run-v1:${kst}`

export interface DayBuyRow {
  acc: string; form: string; ticker: string; issuer: string; cik: string
  owner: string; role: string; date: string; shares: number; value: number; unpriced: boolean
}
export interface DayDoc {
  day: string; total: number; done: string[]; buys: DayBuyRow[]
  complete: boolean; noIndex?: boolean; errors: number; updatedAt: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
/** 미국 동부 날짜(YYYYMMDD). 보수적으로 UTC−5 — EDT 땐 한 시간 늦게 '어제'가 된다(안전 쪽). */
export function etDay(offsetDays = 0): string {
  return new Date(Date.now() - 5 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10).replace(/-/g, '')
}

/** 하루치 스캔 — 예산(건수) 안에서 아직 안 본 제출만 받아 장내매수를 문서에 쌓는다. 실패한 건은 done 에 안 넣어 다음 실행이 다시 본다. */
export async function scanDay(day: string, budget: number, deadlineMs: number): Promise<{ day: string; processed: number; remaining: number; buys: number; complete: boolean; errors: number }> {
  const key = INSIDER_DAY_KEY(day)
  const doc: DayDoc = (await getCache<DayDoc>(key, 400 * 86400_000)) ?? { day, total: 0, done: [], buys: [], complete: false, errors: 0, updatedAt: '' }
  if (doc.complete) return { day, processed: 0, remaining: 0, buys: doc.buys.length, complete: true, errors: 0 }

  const idx = await fetchForm4Index(day)
  if (idx.status !== 200) {
    // 인덱스가 없는 날 = 주말·휴일(또는 아직 안 나온 오늘). 이틀 넘게 지난 날이면 휴일로 확정한다.
    if (day < etDay(2)) { doc.complete = true; doc.noIndex = true; doc.updatedAt = new Date().toISOString(); await setCache(key, doc) }
    return { day, processed: 0, remaining: 0, buys: doc.buys.length, complete: doc.complete, errors: 0 }
  }
  // 인덱스는 같은 제출을 제출자(발행사·내부자)마다 한 줄씩 나열한다(실측: 30줄 = 26건) → accession 으로 중복 제거
  const uniq = new Map<string, typeof idx.rows[number]>()
  for (const r of idx.rows) { const a = accessionOf(r.file); if (!uniq.has(a)) uniq.set(a, r) }
  const rowsU = Array.from(uniq.values())
  doc.total = rowsU.length
  const done = new Set(doc.done)
  const pending = rowsU.filter(r => !done.has(accessionOf(r.file)))
  const batch = pending.slice(0, budget)
  let errors = 0
  const CONC = 6
  for (let i = 0; i < batch.length; i += CONC) {
    if (Date.now() > deadlineMs) break
    const t = Date.now()
    const rs = await Promise.all(batch.slice(i, i + CONC).map(async r => {
      try {
        const { status, xml } = await fetchSubmissionXml(r.file)
        if (status === 404) return { r, ok: true as const, buy: null }   // SEC 에 없는 제출(철회·경로 오류) — 처리한 것으로 두어 그날이 영원히 미완료가 되지 않게
        if (!xml) return { r, ok: false as const }
        return { r, ok: true as const, buy: parseForm4Xml(xml) }
      } catch { return { r, ok: false as const } }
    }))
    for (const x of rs) {
      if (!x.ok) { errors++; continue }
      const acc = accessionOf(x.r.file)
      done.add(acc)
      if (x.buy && !doc.buys.some(b => b.acc === acc)) {
        doc.buys.push({ acc, form: x.r.form, ticker: x.buy.ticker, issuer: x.buy.issuer || x.r.company, cik: x.r.cik,
          owner: x.buy.owner, role: x.buy.role, date: x.buy.date || x.r.date, shares: x.buy.shares, value: x.buy.value, unpriced: x.buy.unpriced })
      }
    }
    // SEC 한도 10건/s 아래로 — 한 묶음(6건)에 최소 0.8초
    const el = Date.now() - t
    if (el < 800) await sleep(800 - el)
  }
  doc.done = Array.from(done)
  doc.errors = errors
  const remaining = rowsU.length - doc.done.length
  // 완성 = 전부 처리했고, 그날이 하루 넘게 지나 인덱스가 더 안 자란다
  doc.complete = remaining <= 0 && day < etDay(1)
  doc.updatedAt = new Date().toISOString()
  await setCache(key, doc)
  return { day, processed: batch.length - errors, remaining: Math.max(0, remaining), buys: doc.buys.length, complete: doc.complete, errors }
}

/** 최근 WINDOW_DAYS 중 미완료인 날을 최신순으로 예산·마감 안에서 처리(오늘·어제는 늘 다시 본다 — 인덱스가 자란다) */
export async function scanRecent(totalBudget: number, maxMs: number): Promise<{ runs: Awaited<ReturnType<typeof scanDay>>[]; budgetLeft: number }> {
  const deadline = Date.now() + maxMs
  const runs: Awaited<ReturnType<typeof scanDay>>[] = []
  let budget = totalBudget
  for (let off = 0; off <= WINDOW_DAYS && budget > 0 && Date.now() < deadline; off++) {
    const day = etDay(off)
    const existing = await getCache<DayDoc>(INSIDER_DAY_KEY(day), 400 * 86400_000)
    if (existing?.complete) continue
    const r = await scanDay(day, budget, deadline)
    runs.push(r)
    budget -= r.processed + r.errors
  }
  return { runs, budgetLeft: budget }
}

// ── 집계·필터·보강 (타입은 insiderMarketShared) ──────────────────────────────
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

export async function buildInsiderMarket(): Promise<InsiderMarket> {
  const docs: DayDoc[] = []
  for (let off = 0; off < WINDOW_DAYS; off++) {
    const d = await getCache<DayDoc>(INSIDER_DAY_KEY(etDay(off)), 400 * 86400_000)
    if (d) docs.push(d)
  }
  const daysComplete = docs.filter(d => d.complete && !d.noIndex).length
  const daysPartial = docs.filter(d => !d.complete && d.done.length > 0).length
  const from = iso(etDay(WINDOW_DAYS - 1))
  // 창은 **거래일** 기준 — 제출은 이번 달인데 매수는 넉 달 전인 늑장 공시(실측: 09-18 제출·05-20 매수)가 "이번 달 매수"로 섞이지 않게
  const rows0 = docs.flatMap(d => d.buys).filter(b => b.ticker && b.ticker !== 'NONE' && /^[A-Z.\-]{1,6}$/.test(b.ticker) && b.date >= from)
  // 같은 사람·같은 날·같은 주식수는 한 건 — 재제출·정정(4/A)이 다른 accession 으로 두 번 잡힌다(실측 GPUS 09-03 2,148,691주 $406K 가 09-08·09-09 두 번)
  const dupKey = new Set<string>()
  const rows = rows0.filter(b => { const k = `${b.ticker}|${b.owner.toUpperCase()}|${b.date}|${b.shares}`; if (dupKey.has(k)) return false; dupKey.add(k); return true })
  const isHolder10 = (r: DayBuyRow) => r.role === '10% 주주' || /\b(FUND|L\.?P\.?|LLC|CAPITAL|HOLDINGS|PARTNERS|MANAGEMENT|TRUST)\b/i.test(r.owner)

  // 종목별 합산 — 같은 내부자의 여러 제출은 한 사람으로 센다(클러스터는 '서로 다른 사람' 수)
  const byT = new Map<string, DayBuyRow[]>()
  for (const r of rows) { const a = byT.get(r.ticker) ?? []; a.push(r); byT.set(r.ticker, a) }
  type Agg = { ticker: string; issuer: string; buyers: Set<string>; holders10: number; value: number; pricedShares: number; shares: number; unpriced: boolean; roles: Set<string>; rows: DayBuyRow[] }
  const aggs: Agg[] = []
  for (const [ticker, rs] of Array.from(byT.entries())) {
    const a: Agg = { ticker, issuer: rs[0].issuer, buyers: new Set(), holders10: 0, value: 0, pricedShares: 0, shares: 0, unpriced: false, roles: new Set(), rows: rs }
    // '함께 샀다'는 **경영진·이사가 자기 돈을 유의미하게** 넣은 사람 수 — 1인당 $10K 미만(우리사주·소액 정기매수)은 세지 않고,
    //   10% 주주·펀드(같은 운용사의 펀드 둘이 '2명'이 되던 실측 XBP)는 세지 않는다(금액엔 넣고 화면에 따로 표시).
    //   실측: TSM 이 30명·합계 $12만으로 1위에 올랐다(직원 소액 매수) — 보고서가 말하는 클러스터가 아니다.
    const perOwner = new Map<string, { v: number; unpriced: boolean; holder: boolean }>()
    for (const r of rs) {
      const k = r.owner.toUpperCase(); const o = perOwner.get(k) ?? { v: 0, unpriced: false, holder: isHolder10(r) }
      o.v += r.unpriced ? 0 : r.value; o.unpriced ||= r.unpriced; perOwner.set(k, o)
      a.roles.add(r.role); a.shares += r.shares
      if (r.unpriced) a.unpriced = true
      else { a.value += r.value; a.pricedShares += r.shares }
    }
    for (const [k, o] of Array.from(perOwner.entries())) {
      if (o.holder) { a.holders10++; continue }
      if (o.v >= LIMITS.minPerBuyer || o.unpriced) a.buyers.add(k)
    }
    aggs.push(a)
  }
  // 1차 거름(시총 없이 알 수 있는 것) — 금액 $100K↑ 또는 2인↑. 그 밖은 시총 비율로도 못 살리는 규모라 보강 비용을 쓰지 않는다
  const pre = aggs.filter(a => a.value >= LIMITS.minValue || a.buyers.size >= LIMITS.cluster)
    .sort((x, y) => y.buyers.size - x.buyers.size || y.value - x.value)
  const CAP = 120                                   // 보강(Yahoo) 상한 — 30일이면 1차 통과가 수백 곳이라 인원·금액 상위만. 화면에 '상위 N곳만' 을 밝힌다
  const cands = pre.slice(0, CAP)

  // 보강 — Yahoo quoteSummary 한 번에 시총·현재가·52주 저가·섹터·EPS 리비전·트레일링 EPS
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  type Enr = { price: number | null; mcap: number | null; low52: number | null; sector: string | null; up: number | null; down: number | null; eps: number | null }
  const enrich = async (t: string): Promise<Enr> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = await yf.quoteSummary(t, { modules: ['price', 'summaryDetail', 'assetProfile', 'earningsTrend', 'defaultKeyStatistics'] })
      const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yr = ((s?.earningsTrend?.trend ?? []) as any[]).find(x => x.period === '0y')
      return { price: num(s?.price?.regularMarketPrice), mcap: num(s?.price?.marketCap), low52: num(s?.summaryDetail?.fiftyTwoWeekLow),
        sector: s?.assetProfile?.sector ?? null, up: num(yr?.epsRevisions?.upLast30days), down: num(yr?.epsRevisions?.downLast30days), eps: num(s?.defaultKeyStatistics?.trailingEps) }
    } catch { return { price: null, mcap: null, low52: null, sector: null, up: null, down: null, eps: null } }
  }
  const enr = new Map<string, Enr>()
  for (let i = 0; i < cands.length; i += 4) {
    const b = cands.slice(i, i + 4)
    const rs = await Promise.all(b.map(a => enrich(a.ticker)))
    b.forEach((a, k) => enr.set(a.ticker, rs[k]))
  }

  const items: InsiderMarketItem[] = []
  for (const a of cands) {
    const e = enr.get(a.ticker)!
    const mcapPct = e.mcap ? a.value / e.mcap * 100 : null
    const quality = a.value >= LIMITS.minValue || (mcapPct != null && mcapPct >= LIMITS.minMcapPct)
    const cluster = a.buyers.size >= LIMITS.cluster
    if (!quality && !cluster) continue
    const avgPx = a.pricedShares > 0 ? a.value / a.pricedShares : null
    const gap = avgPx && e.price ? (e.price / avgPx - 1) * 100 : null
    // 단가 기준이 다른 공시(ADR 인데 원주·현지통화 단가로 적힘 — 실측 TSM +470%)는 금액도 못 믿는다 → 목록에서 뺀다
    if (gap != null && (gap > LIMITS.maxGapPct || gap < -70)) continue
    const dates = a.rows.map(r => r.date).filter(Boolean).sort()
    const meta = sectorMeta(e.sector)
    items.push({
      ticker: a.ticker, issuer: a.issuer, sector: e.sector, sectorKo: meta?.ko ?? null,
      buyers: a.buyers.size, roles: Array.from(a.roles).slice(0, 4), value: Math.round(a.value), shares: a.shares, unpriced: a.unpriced,
      firstDate: dates[0] ?? '', lastDate: dates[dates.length - 1] ?? '',
      avgPx: avgPx != null ? Math.round(avgPx * 100) / 100 : null, price: e.price,
      gapPct: gap != null ? Math.round(gap * 10) / 10 : null,
      mcap: e.mcap, mcapPct: mcapPct != null ? Math.round(mcapPct * 1000) / 1000 : null,
      cluster, nearLow: !!(e.price && e.low52 && e.price <= e.low52 * (1 + LIMITS.nearLowPct / 100)),
      revision: revisionSignalOf(e.up, e.down), loss: e.eps != null && e.eps < 0,
      holders10: a.holders10,
      // 사람별로 합쳐서(같은 사람이 세 줄로 나오던 실측 GPUS) 금액 순 상위 6명
      buys: Array.from(a.rows.reduce((m, r) => {
        const k = r.owner.toUpperCase(); const o = m.get(k) ?? { owner: r.owner, role: r.role, date: r.date, value: 0, unpriced: false, n: 0 }
        o.value += r.unpriced ? 0 : r.value; o.unpriced ||= r.unpriced; o.n++; if (r.date > o.date) o.date = r.date; m.set(k, o); return m
      }, new Map<string, { owner: string; role: string; date: string; value: number; unpriced: boolean; n: number }>()).values())
        .sort((x, y) => y.value - x.value).slice(0, 6).map(o => ({ owner: o.owner, role: o.role, date: o.date, value: Math.round(o.value), unpriced: o.unpriced, n: o.n })),
    })
  }
  // 순위: 클러스터 인원 → 시총 대비 비중 → 금액
  items.sort((x, y) => y.buyers - x.buyers || (y.mcapPct ?? 0) - (x.mcapPct ?? 0) || y.value - x.value)

  const sc = new Map<string, number>()
  for (const it of items) if (it.sector) sc.set(it.sector, (sc.get(it.sector) ?? 0) + 1)
  const sectors = Array.from(sc.entries()).sort((a, b) => b[1] - a[1]).map(([sector, count]) => { const m = sectorMeta(sector); return { sector, ko: m?.ko ?? sector, icon: m?.icon ?? '📦', count } })

  const clusters = items.filter(i => i.cluster).length
  const near = items.filter(i => i.nearLow).length
  const partial = daysComplete < 15
  const capped = pre.length > CAP
  const summary = items.length === 0
    ? '조건을 채운 종목이 없습니다'
    : `지난 ${WINDOW_DAYS}일 조건 통과 ${pre.length}곳${capped ? `(인원·금액 상위 ${items.length}곳만 표시)` : ''} · 그중 2인 이상 함께 산 곳 ${clusters}곳` +
      (sectors[0] ? ` · 가장 몰린 섹터 ${sectors[0].icon} ${sectors[0].ko}(${sectors[0].count}곳)` : '') +
      ` · ${near}곳은 52주 저가 근처`
  return {
    asOf: new Date().toISOString(),
    window: { from, to: iso(etDay(0)), daysComplete, daysPartial, rawBuys: rows.length, candidates: pre.length },
    items, sectors, summary, partial,
  }
}
