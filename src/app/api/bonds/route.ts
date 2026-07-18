// 📜 채권 축 API — 듀레이션 나침반(금리 방향×수익률곡선×크레딧) + 채권 ETF 현황 + 금리 ±1%p 손익 시뮬
//    금리 국면=macro-regime SSOT 재사용(제2원칙). ETF 가격=techChartData SSOT. 듀레이션=ETF 참조 상수(근사). 결정론.
import { NextResponse } from 'next/server'
import { getTechCandles } from '@/lib/techChartData'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export type DurBias = 'short' | 'mid' | 'long'
export type CreditBias = 'govt' | 'credit'
export interface BondEtf {
  key: string; name: string; ticker: string; market: 'US' | 'KR'
  category: 'short' | 'mid' | 'long' | 'ig' | 'hy' | 'kr'
  modDur: number            // 수정 듀레이션(근사·참조 상수)
  price: number | null
  ret1m: number | null; ret3m: number | null; ret1y: number | null
  pnlDown1: number          // 금리 −1%p 시 대략 손익(%)
  pnlUp1: number            // 금리 +1%p 시 대략 손익(%)
}
export interface BondsResult {
  asOf: string
  macro: { fedRate: number | null; rateDir: string; rateDirLabel: string; yieldCurve: number | null; hySpread: number | null; label: string }
  compass: {
    durationBias: DurBias; durationLabel: string
    creditBias: CreditBias; creditLabel: string
    curveNote: string; headline: string
  }
  etfs: BondEtf[]
}

// 채권 ETF + 잘 알려진 수정 듀레이션(근사·참조 상수 — FRED 폴백처럼 허용)
const ETFS: { key: string; name: string; ticker: string; market: 'US' | 'KR'; category: BondEtf['category']; modDur: number }[] = [
  { key: 'shy', name: '미국 단기국채(1-3년)', ticker: 'SHY', market: 'US', category: 'short', modDur: 1.9 },
  { key: 'ief', name: '미국 중기국채(7-10년)', ticker: 'IEF', market: 'US', category: 'mid', modDur: 7.4 },
  { key: 'tlt', name: '미국 장기국채(20년+)', ticker: 'TLT', market: 'US', category: 'long', modDur: 16.5 },
  { key: 'lqd', name: '미국 투자등급 회사채', ticker: 'LQD', market: 'US', category: 'ig', modDur: 8.4 },
  { key: 'hyg', name: '미국 하이일드 회사채', ticker: 'HYG', market: 'US', category: 'hy', modDur: 3.4 },
  { key: 'kgb', name: '한국 국고채 10년(KOSEF)', ticker: '148070', market: 'KR', category: 'kr', modDur: 8.0 },
]

function retAt(closes: number[], back: number): number | null {
  if (closes.length <= back) return null
  const now = closes[closes.length - 1], then = closes[closes.length - 1 - back]
  if (!(now > 0) || !(then > 0)) return null
  return Math.round(((now - then) / then) * 1000) / 10
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  const cacheKey = `bonds-v1:${kstDate()}`
  const cached = await getCache<BondsResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  // 금리 국면 SSOT
  let rateDir = 'hold', rateDirLabel = '동결', fedRate: number | null = null, yieldCurve: number | null = null, hySpread: number | null = null, label = ''
  try {
    const r = await fetch(`${base}/api/macro-regime`, { signal: AbortSignal.timeout(15_000) })
    if (r.ok) {
      const j: any = await r.json()
      rateDir = j.rateDir ?? 'hold'; rateDirLabel = j.rateDirLabel ?? '동결'
      fedRate = typeof j.fedRate === 'number' ? j.fedRate : null
      yieldCurve = typeof j.yieldCurve === 'number' ? j.yieldCurve : null
      hySpread = typeof j.hySpread === 'number' ? j.hySpread : null
      label = j.label ?? ''
    }
  } catch { /* graceful — 나침반은 폴백값으로 */ }

  // 채권 ETF 가격·수익률
  const etfs: BondEtf[] = await Promise.all(ETFS.map(async e => {
    const candles = await getTechCandles(e.ticker, e.market, 'D').catch(() => [])
    const closes = candles.map(c => c.close).filter(c => c > 0)
    const price = closes.length ? closes[closes.length - 1] : null
    return {
      key: e.key, name: e.name, ticker: e.ticker, market: e.market, category: e.category, modDur: e.modDur,
      price, ret1m: retAt(closes, 21), ret3m: retAt(closes, 63), ret1y: retAt(closes, 252),
      pnlDown1: Math.round(e.modDur * 10) / 10, pnlUp1: -Math.round(e.modDur * 10) / 10,
    }
  }))

  // 듀레이션 나침반(결정론)
  let durationBias: DurBias = 'mid', durationLabel = ''
  if (rateDir === 'cut') { durationBias = 'long'; durationLabel = '장기채 유리 — 금리 인하 시 듀레이션이 긴 채권(TLT·IEF)이 가장 크게 오른다. 인하 사이클엔 듀레이션 확대.' }
  else if (rateDir === 'hike') { durationBias = 'short'; durationLabel = '단기채 방어 — 금리 인상 시 긴 채권은 손실이 크다. 단기채(SHY)로 듀레이션 축소해 방어.' }
  else { durationBias = 'mid'; durationLabel = '중기채 균형 — 방향 확정 전엔 중기(IEF)로 이자(캐리)를 수취하며 대기. 인하 전환 신호를 감시.' }

  let creditBias: CreditBias = 'credit', creditLabel = ''
  if (hySpread != null && hySpread >= 4.0) { creditBias = 'govt'; creditLabel = `국채 선호 — 크레딧 스프레드 ${hySpread.toFixed(1)}%로 높아 회사채(특히 하이일드 HYG) 부도위험. 안전한 국채(TLT·IEF)로.` }
  else { creditBias = 'credit'; creditLabel = `크레딧 캐리 가능 — 스프레드 ${hySpread != null ? hySpread.toFixed(1) + '%로 ' : ''}낮아 투자등급 회사채(LQD)로 국채보다 높은 이자 수취 여지. 단 스프레드 급등 시 회피.` }

  let curveNote = ''
  if (yieldCurve != null && yieldCurve < 0) curveNote = `⚠️ 수익률곡선 역전(장단기 금리차 ${yieldCurve.toFixed(2)}%p) — 역사적 경기침체 선행 신호. 시장이 향후 금리 인하를 반영 중(장기채엔 우호적이나 경기 둔화 위험 동반).`
  else if (yieldCurve != null && yieldCurve < 0.3) curveNote = `수익률곡선 평탄(장단기차 ${yieldCurve.toFixed(2)}%p) — 경기 후반 신호, 금리차가 좁아 듀레이션 확대의 이자 이점이 작다.`
  else if (yieldCurve != null) curveNote = `수익률곡선 정상·우상향(장단기차 +${yieldCurve.toFixed(2)}%p) — 장기 금리가 단기보다 높아 듀레이션 보유의 이자(캐리)가 유리.`
  else curveNote = '수익률곡선 데이터 일시 미확인.'

  const durShort = durationBias === 'long' ? '장기채' : durationBias === 'short' ? '단기채' : '중기채'
  const headline = `🧭 금리 ${rateDirLabel} 국면 — ${durShort} 중심 · ${creditBias === 'govt' ? '국채 선호' : '크레딧 캐리 가능'}`

  const result: BondsResult = {
    asOf: new Date().toISOString(),
    macro: { fedRate, rateDir, rateDirLabel, yieldCurve, hySpread, label },
    compass: { durationBias, durationLabel, creditBias, creditLabel, curveNote, headline },
    etfs,
  }
  if (etfs.some(e => e.price != null)) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
