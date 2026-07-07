// 🧭 섹터 로테이션 시계 — 17개 섹터(GICS 11 + 테마 6)를 상대강도×모멘텀 4사분면에 배치.
//    새 판정기 0(제1·2원칙): 기존 /api/sector(computeSector) 결과의 섹터 평균수익률만 집계 → 섹터 탭과 동일값.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { scoreSubFlow, type SubQ } from '@/lib/subFlow'
import { etfFor, SECTORS } from '@/lib/sectorConfigs'
import { getEntryTimings, type EntryTiming } from '@/lib/entryTiming'
import { computeSector, type SectorResult } from '@/lib/sectorEngine'

// /api/sector와 동일한 캐시 키 — in-process 호출이 HTTP 라우트와 캐시를 공유(제2원칙)
const fpTk = (tickers: string[]) => { let h = 0; for (const c of tickers.join(',')) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36) }
async function loadSector(key: string): Promise<SectorResult | null> {
  const cfg = SECTORS[key]; if (!cfg) return null
  const ck = `sector-v3:${key}:${cfg.stocks.length}:${fpTk(cfg.stocks.map(s => s.ticker))}:${kstDate()}`
  const cached = await getCache<SectorResult>(ck, 6 * 3600_000)
  if (cached) return cached
  try {
    const result = await computeSector(cfg)
    const anchorOk = result.stocks.find(s => s.ticker === cfg.anchor)?.spark?.length
    if (anchorOk && anchorOk > 10) await setCache(ck, result)
    return result
  } catch { return null }
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 17개 섹터: GICS 11 + 테마 6
const GICS = ['energy', 'materials', 'industrials', 'discretionary', 'staples', 'healthcare', 'financials', 'infotech', 'communication', 'utilities', 'realestate']
const THEME = ['quantum', 'ai-semi', 'power', 'phys-ai', 'ai-bio', 'defense']

export type Quadrant = 'leading' | 'weakening' | 'lagging' | 'improving'
export interface RotationItem {
  key: string; label: string; emoji: string; group: 'gics' | 'theme'
  ret1w: number | null; ret1m: number | null; ret1y: number | null
  rs: number; mom: number        // X 상대강도, Y 모멘텀(peer 대비)
  quadrant: Quadrant; score: number   // 자금쏠림 점수 = 0.6·rs + 0.4·mom
  count: number                  // 집계 종목 수
}
// 🎯 소섹터 통합 추천 — 17섹터 전 소섹터 중 매수 적격/매도 신호를 한 랭킹으로
//    랭킹 점수 = 섹터 쏠림점수(17섹터 평균 대비) + 소섹터 쏠림점수(섹터 내 평균 대비) = 이중 자금 쏠림(동일 단위 %p)
export interface SubPick {
  sectorKey: string; sectorLabel: string; sectorEmoji: string
  subKey: string; subLabel: string; subEmoji: string
  q: SubQ                                  // 소섹터 국면(주도/과열/이탈/태동)
  ret1w: number | null; ret1m: number | null; ret1y: number | null
  total: number                            // 랭킹 점수(섹터+소섹터 쏠림 합)
  profit: boolean                          // 매도 시: 1년>0=익절 / ≤0=비중축소
  etfUs?: string; etfUsName?: string; etfKr?: string   // 대표 ETF(미국 티커·한국 종목명)
  etfKrT?: string                          // 한국 ETF 티커(타점 계산용)
  etfTiming?: EntryTiming | null           // 🚦 대표 ETF 타점 신호등(US 우선, 없으면 KR) — 수급+타점 이중 확인
}
// 🔥 52주 신고가 종목 × 소섹터 국면 — "최고가는 다 같은 최고가가 아니다"(주도=섹터 강세·신뢰 / 태동=약한 무리 속 대장·품질 / 과열=모멘텀 식음·추격주의)
export interface HighStock {
  ticker: string; name: string; market: string
  sectorKey: string; sectorLabel: string; sectorEmoji: string
  subLabel: string; subEmoji: string; q: SubQ   // 소섹터 국면
  hi52: number                                  // 52주 최고가 대비 위치(100=신고가)
  ret1w: number | null; ret1y: number | null
}
export interface RotationResult {
  items: RotationItem[]
  inflow: RotationItem[]; outflow: RotationItem[]   // 🔥유입 Top / ❄️이탈 Top
  buys: SubPick[]; sells: SubPick[]                 // 🎯 소섹터 매수 랭킹 / ⚠️ 매도·익절 신호
  highs: HighStock[]                               // 🔥 52주 신고가 × 소섹터 국면
  mean1w: number; mean1m: number
  used: number; asOf: string
}

const QUAD = (rs: number, mom: number): Quadrant =>
  rs > 0 && mom > 0 ? 'leading' : rs > 0 ? 'weakening' : mom > 0 ? 'improving' : 'lagging'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const avg = (arr: (number | null | undefined)[]): number | null => {
  const v = arr.filter((x): x is number => typeof x === 'number' && isFinite(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

export async function GET(req: Request) {
  void req
  const cacheKey = `sector-rotation-v9:${kstDate()}`   // v9: 🚦 매수 랭킹 대표 ETF 타점 신호등(etfTiming)
  const cached = await getCache<RotationResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const all = [...GICS.map(k => ['gics', k] as const), ...THEME.map(k => ['theme', k] as const)]
  const raw = await Promise.all(all.map(async ([group, key]) => {
    try {
      const d = await loadSector(key)   // ⭐ in-process 호출(HTTP self-fetch 제거) — hi52 등 최신 필드 보장
      if (!d) return null
      const stocks = Array.isArray(d.stocks) ? d.stocks : []
      if (!stocks.length) return null
      // 섹터 평균수익률(동일가중). 1y는 신규상장(weeks<52) 제외로 왜곡 방지
      const ret1w = avg(stocks.map(s => s.ret1w))
      const ret1m = avg(stocks.map(s => s.ret1m))
      const ret1y = avg(stocks.filter(s => (s.weeks ?? 0) >= 52).map(s => s.ret1y))
      const subsectors = Array.isArray(d.subsectors) ? d.subsectors : []
      return { group, key, label: String(d.label ?? key).replace(/ 인텔리전스| 테마 인텔리전스$/, ''), emoji: String(d.emoji ?? '📊'), ret1w, ret1m, ret1y, count: stocks.length, subsectors, stocks }
    } catch { return null }
  }))
  const secs = raw.filter((x): x is NonNullable<typeof x> => x != null && x.ret1m != null && x.ret1w != null)
  if (secs.length < 6)
    return NextResponse.json({ error: '섹터 데이터 부족 — 잠시 후 재시도(섹터 탭 방문 시 캐시 워밍)' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const mean1m = secs.reduce((s, x) => s + (x.ret1m as number), 0) / secs.length
  const mean1w = secs.reduce((s, x) => s + (x.ret1w as number), 0) / secs.length

  const items: RotationItem[] = secs.map(x => {
    const rs = Math.round(((x.ret1m as number) - mean1m) * 10) / 10   // 상대강도(1M)
    const mom = Math.round(((x.ret1w as number) - mean1w) * 10) / 10   // 모멘텀(1W peer 대비)
    const score = Math.round((0.6 * rs + 0.4 * mom) * 10) / 10
    return {
      key: x.key, label: x.label, emoji: x.emoji, group: x.group,
      ret1w: x.ret1w != null ? Math.round(x.ret1w * 10) / 10 : null,
      ret1m: x.ret1m != null ? Math.round(x.ret1m * 10) / 10 : null,
      ret1y: x.ret1y != null ? Math.round(x.ret1y * 10) / 10 : null,
      rs, mom, quadrant: QUAD(rs, mom), score, count: x.count,
    }
  }).sort((a, b) => b.score - a.score)

  // 🎯 소섹터 통합 랭킹 — 각 섹터의 소섹터를 드릴다운 카드와 동일 SSOT(scoreSubFlow)로 판정 후 전체 합산 랭킹
  const secScoreByKey = Object.fromEntries(items.map(i => [i.key, i.score]))
  const buys: SubPick[] = [], sells: SubPick[] = [], highs: HighStock[] = []
  const HI_NEAR = 98   // 52주 최고가의 98%+ = '신고가 근접/갱신'(주봉 기준)
  for (const x of secs) {
    const sf = scoreSubFlow(x.subsectors)
    const it = items.find(i => i.key === x.key); if (!it) continue
    // 🔥 52주 신고가 종목 스캔 — 각 종목의 소섹터 국면(sf)을 결합
    const subMetaByKey = Object.fromEntries(x.subsectors.map(s => [s.key, s]))
    for (const st of x.stocks) {
      if (typeof st.hi52 !== 'number' || st.hi52 < HI_NEAR) continue
      if ((st.weeks ?? 0) < 20) continue   // 신규상장(주봉 부족)은 '신고가' 의미 약함 → 제외
      const o = sf[st.sub]; const sm = subMetaByKey[st.sub]
      if (!o || !sm) continue
      highs.push({
        ticker: String(st.ticker), name: String(st.name ?? st.ticker), market: String(st.market ?? ''),
        sectorKey: x.key, sectorLabel: it.label.replace(/\s*\(.*\)/, ''), sectorEmoji: it.emoji,
        subLabel: String(sm.label ?? st.sub), subEmoji: String(sm.emoji ?? ''), q: o.q,
        hi52: Math.round(st.hi52 * 10) / 10,
        ret1w: st.ret1w != null ? Math.round(st.ret1w * 10) / 10 : null,
        ret1y: st.ret1y != null ? Math.round(st.ret1y * 10) / 10 : null,
      })
    }
    for (const s of x.subsectors) {
      const o = sf[s.key]; if (!o) continue
      if (!o.buy && !o.sell) continue
      const e = etfFor(x.key, s.key)
      const pick: SubPick = {
        sectorKey: x.key, sectorLabel: it.label.replace(/\s*\(.*\)/, ''), sectorEmoji: it.emoji,
        subKey: s.key, subLabel: String(s.label ?? s.key), subEmoji: String(s.emoji ?? ''),
        q: o.q,
        ret1w: s.ret1w != null ? Math.round(s.ret1w * 10) / 10 : null,
        ret1m: s.ret1m != null ? Math.round(s.ret1m * 10) / 10 : null,
        ret1y: s.ret1y != null ? Math.round(s.ret1y * 10) / 10 : null,
        total: Math.round(((secScoreByKey[x.key] ?? 0) + o.score) * 10) / 10,
        profit: o.profit,
        etfUs: e?.us?.t, etfUsName: e?.us?.name, etfKr: e?.kr?.name, etfKrT: e?.kr?.t,
      }
      if (o.buy) buys.push(pick); else sells.push(pick)
    }
  }
  buys.sort((a, b) => b.total - a.total)
  sells.sort((a, b) => a.total - b.total)   // 매도는 자금 이탈이 심한(점수 낮은) 순
  // 신고가는 소섹터 국면 신뢰도 순(주도>태동>과열>이탈), 같은 국면이면 최고가 근접도 순
  const HQ: Record<SubQ, number> = { leading: 0, improving: 1, weakening: 2, lagging: 3 }
  highs.sort((a, b) => HQ[a.q] - HQ[b.q] || b.hi52 - a.hi52)
  // ⭐ 국면 대조가 항상 보이게 — 주도(신뢰)는 10개로 캡, 과열/태동/이탈(교육적 '주의' 케이스)은 전부 포함
  const hByQ = (q: SubQ) => highs.filter(h => h.q === q)
  const highsFinal = [...hByQ('leading').slice(0, 10), ...hByQ('improving'), ...hByQ('weakening'), ...hByQ('lagging')].slice(0, 18)

  // 🚦 매수 랭킹 대표 ETF 타점 신호등 — "돈이 몰리고(수급) + ETF가 구름 위(타점)" 이중 확인. US ETF 우선, 없으면 KR
  const buysTop = buys.slice(0, 10)
  try {
    const etfReq = new Map<string, { ticker: string; market: 'KR' | 'US' }>()
    for (const b of buysTop) {
      if (b.etfUs) etfReq.set(`${b.etfUs}:US`, { ticker: b.etfUs, market: 'US' })
      else if (b.etfKrT) etfReq.set(`${b.etfKrT}:KR`, { ticker: b.etfKrT, market: 'KR' })
    }
    const tmap = await getEntryTimings(Array.from(etfReq.values()), 4)
    for (const b of buysTop) b.etfTiming = b.etfUs ? (tmap.get(`${b.etfUs}:US`) ?? null) : b.etfKrT ? (tmap.get(`${b.etfKrT}:KR`) ?? null) : null
  } catch { /* graceful */ }

  const result: RotationResult = {
    items,
    inflow: items.filter(i => i.score > 0).slice(0, 3),
    outflow: [...items].filter(i => i.score < 0).sort((a, b) => a.score - b.score).slice(0, 3),
    buys: buysTop, sells: sells.slice(0, 10),
    highs: highsFinal,
    mean1w: Math.round(mean1w * 10) / 10, mean1m: Math.round(mean1m * 10) / 10,
    used: secs.length, asOf: new Date().toISOString(),
  }
  if (secs.length >= 12) await setCache(cacheKey, result)   // 과반 이상 성공 시에만 캐시(부분실패 박제 방지)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
