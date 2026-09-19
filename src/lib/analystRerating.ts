// 🇺🇸 애널리스트 리레이팅 스캐너 SSOT — "전문가들이 마음을 바꾼 회사는". 보고서의 TipRanks 별점·승률 필터는 유료라 쓸 수 없다(Phase 0).
//    대신 앱의 노이즈 캔슬러 원칙으로 거른다: **등급 상향이 여러 증권사에서 동시에** 나오고(30일 3곳↑) **EPS 추정치도 같이 올랐을 때만**
//    '진짜 리레이팅'. 추정치는 안 오르는데 등급만 오르면 '목표가 소음'으로 따로 표시한다(revisionSignalOf — 노이즈 캔슬러와 같은 규칙).
//    모집단은 주간 유니버스의 미국 종목(애널리스트 커버리지는 대·중형주에 몰려 있어 시장 전체 스캔과 차이가 작다) + 내부자 스캐너 통과 종목.
import { getCache } from '@/lib/appCache'
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { INSIDER_MARKET_KEY, type InsiderMarket } from '@/lib/insiderMarket'
import { revisionSignalOf, type RevisionSignal } from '@/lib/analystShared'
import { sectorMeta } from '@/lib/gicsSectorMeta'

export const ANALYST_RERATING_KEY = (kst: string) => `analyst-rerating-v1:${kst}`
export const RERATE_LIMITS = { minUpgrades: 3, minUpside: 15, days: 30 }   // 보고서 값(3인·15%) — 미검증

export interface ReratingItem {
  ticker: string; name: string; sector: string | null; sectorKo: string | null
  upgrades: number; downgrades: number; firms: string[]          // 최근 30일 등급 상향/하향 증권사 수·이름
  revUp: number | null; revDown: number | null; revision: RevisionSignal
  price: number | null; target: number | null; upsidePct: number | null; analysts: number | null
  verdict: 'rerating' | 'noise' | 'downgrade'                     // 진짜 리레이팅 / 목표가 소음 / 하향 경고
}
export interface AnalystRerating {
  asOf: string
  scanned: number; okCount: number
  items: ReratingItem[]
  sectors: { sector: string; ko: string; icon: string; count: number }[]
  answer: string
}

export async function buildAnalystRerating(): Promise<AnalystRerating | { error: string; note: string }> {
  const uni = (await getCache<ScreenedStock[]>(UNIVERSE_KEY, 8 * 24 * 3600_000)) ?? []
  if (!uni.length) return { error: 'universe_cold', note: '유니버스 캐시가 비었습니다. 주간 스크리너 크론 이후 다시 시도하세요.' }
  const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const insider = await getCache<InsiderMarket>(INSIDER_MARKET_KEY(kst), 24 * 3600_000)
  const seen = new Map<string, { ticker: string; name: string; sector: string | null }>()
  for (const s of uni) if (s.market === 'US' && !/\.[A-Z]{1,2}$/.test(s.ticker)) seen.set(s.ticker, { ticker: s.ticker, name: s.name, sector: s.sector })
  for (const it of insider?.items ?? []) if (!seen.has(it.ticker)) seen.set(it.ticker, { ticker: it.ticker, name: it.issuer, sector: it.sector })
  const list = Array.from(seen.values())

  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  const since = Date.now() - RERATE_LIMITS.days * 86400_000
  const num = (v: unknown) => typeof v === 'number' && isFinite(v) ? v : null
  const items: ReratingItem[] = []
  let ok = 0
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map(async s => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = await yf.quoteSummary(s.ticker, { modules: ['earningsTrend', 'upgradeDowngradeHistory', 'financialData'] })
        ok++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = ((q?.upgradeDowngradeHistory?.history ?? []) as any[]).filter(h => { const t = h.epochGradeDate instanceof Date ? h.epochGradeDate.getTime() : Number(h.epochGradeDate) * 1000; return t >= since })
        const upF = new Set<string>(), downF = new Set<string>()
        for (const h of hist) { if (h.action === 'up') upF.add(h.firm); else if (h.action === 'down') downF.add(h.firm) }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yr = ((q?.earningsTrend?.trend ?? []) as any[]).find(x => x.period === '0y')
        const revUp = num(yr?.epsRevisions?.upLast30days), revDown = num(yr?.epsRevisions?.downLast30days)
        const revision = revisionSignalOf(revUp, revDown)
        const fd = q?.financialData ?? {}
        const price = num(fd.currentPrice), target = num(fd.targetMeanPrice)
        const upsidePct = price && target ? Math.round((target / price - 1) * 1000) / 10 : null
        if (upF.size < RERATE_LIMITS.minUpgrades && downF.size < RERATE_LIMITS.minUpgrades) return
        const verdict: ReratingItem['verdict'] = downF.size >= RERATE_LIMITS.minUpgrades && downF.size > upF.size ? 'downgrade'
          : revision === 'up' && (upsidePct ?? 0) >= RERATE_LIMITS.minUpside ? 'rerating' : 'noise'
        const m = sectorMeta(s.sector)
        items.push({ ticker: s.ticker, name: s.name, sector: s.sector, sectorKo: m?.ko ?? null, upgrades: upF.size, downgrades: downF.size, firms: Array.from(verdict === 'downgrade' ? downF : upF).slice(0, 5),
          revUp, revDown, revision, price, target, upsidePct, analysts: num(fd.numberOfAnalystOpinions), verdict })
      } catch { /* 조회 실패 — 이 종목은 빠진다 */ }
    }))
  }
  const order = { rerating: 0, noise: 1, downgrade: 2 }
  items.sort((a, b) => order[a.verdict] - order[b.verdict] || b.upgrades - a.upgrades || (b.upsidePct ?? 0) - (a.upsidePct ?? 0))
  const sc = new Map<string, number>()
  for (const it of items) if (it.verdict === 'rerating' && it.sector) sc.set(it.sector, (sc.get(it.sector) ?? 0) + 1)
  const sectors = Array.from(sc.entries()).sort((a, b) => b[1] - a[1]).map(([sector, count]) => { const m = sectorMeta(sector); return { sector, ko: m?.ko ?? sector, icon: m?.icon ?? '📦', count } })
  const re = items.filter(i => i.verdict === 'rerating'), noise = items.filter(i => i.verdict === 'noise'), dn = items.filter(i => i.verdict === 'downgrade')
  const answer = items.length === 0
    ? `최근 ${RERATE_LIMITS.days}일 증권사 ${RERATE_LIMITS.minUpgrades}곳 이상이 한꺼번에 등급을 바꾼 종목이 없습니다`
    : `증권사 ${RERATE_LIMITS.minUpgrades}곳 이상이 등급을 올린 곳 ${re.length + noise.length}곳 — 실적 전망까지 같이 오른 '진짜' ${re.length}곳${sectors[0] ? `(${sectors[0].icon} ${sectors[0].ko} ${sectors[0].count})` : ''} · 목표가만 오른 소음 ${noise.length}곳 · 무더기 하향 ${dn.length}곳`
  return { asOf: new Date().toISOString(), scanned: list.length, okCount: ok, items, sectors, answer }
}
