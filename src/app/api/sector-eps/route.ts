// 섹터 대장주 Fwd EPS 리비전 — 섹터가 '실적 뒷받침 상승'인지 '테마 펌핑'인지 교차검증(getAnalystSignal 재사용)
import { NextResponse } from 'next/server'
import { SECTORS } from '@/lib/sectorConfigs'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GICS(Yahoo 표기) → 🏛️GICS 섹터 config 키
const GICS_TO_KEY: Record<string, string> = {
  'Energy': 'energy', 'Basic Materials': 'materials', 'Industrials': 'industrials',
  'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Healthcare': 'healthcare',
  'Financial Services': 'financials', 'Technology': 'infotech', 'Communication Services': 'communication',
  'Utilities': 'utilities', 'Real Estate': 'realestate',
}

export interface SectorEpsResult {
  leaders: { ticker: string; name: string; dir: 'up' | 'down' | 'mixed' | 'na'; up30: number | null; down30: number | null; note?: string }[]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const gics = (searchParams.get('gics') ?? '').trim()
  const market = (searchParams.get('market') ?? 'US').toUpperCase() === 'KR' ? 'KR' : 'US'
  const key = GICS_TO_KEY[gics]
  const cfg = key ? SECTORS[key] : null
  if (!cfg) return NextResponse.json({ leaders: [] } as SectorEpsResult)

  // 해당 시장의 대장주 — overlayTickers(대표주) 우선, 최대 3
  const inMarket = cfg.stocks.filter(s => s.market === market)
  const overlay = new Set(cfg.overlayTickers)
  const picked = [...inMarket.filter(s => overlay.has(s.ticker)), ...inMarket.filter(s => !overlay.has(s.ticker))].slice(0, 3)

  const leaders = await Promise.all(picked.map(async s => {
    try {
      const sig = await getAnalystSignal({ ticker: s.ticker, name: s.name, market: s.market })
      let dir = (sig.revisionSignal ?? 'na') as 'up' | 'down' | 'mixed' | 'na'
      let up30 = sig.revUp30 ?? null, down30 = sig.revDown30 ?? null
      // ▲0/▼0(리비전 카운트 없음)은 '혼조'가 아니라 '데이터 없음' — MSFT처럼 Yahoo가 카운트를 안 주는 경우
      if ((up30 ?? 0) === 0 && (down30 ?? 0) === 0) { dir = 'na'; up30 = null; down30 = null }
      return {
        ticker: s.ticker, name: s.name, dir, up30, down30,
        note: market === 'KR' && dir === 'na' ? '국내는 EPS 리비전 무료 데이터 없음(컨센서스만)' : undefined,
      }
    } catch {
      return { ticker: s.ticker, name: s.name, dir: 'na' as const, up30: null, down30: null }
    }
  }))

  return NextResponse.json({ leaders } as SectorEpsResult, { headers: { 'Cache-Control': 'no-store' } })
}
