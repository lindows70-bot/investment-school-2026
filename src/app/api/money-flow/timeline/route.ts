// 종목별 투자자(외국인/기관/개인) 일별 매매동향 타임라인 — 검증된 fetchKrTrend 재사용(추가 비용 0)
import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { fetchKrTrend, trendNum as num } from '@/lib/moneyFlow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface TimelineRow {
  date:       string   // YYYY-MM-DD
  close:      number
  changePct:  number | null
  foreign:    number   // 순매수 대금(억원)
  organ:      number
  individual: number
}
export interface TimelineResult {
  ticker: string
  name:   string
  days:   number
  rows:   TimelineRow[]
  cum:    { foreign: number; organ: number; individual: number }   // 누적(억원)
}

const eok = (q: number, close: number) => Math.round((q * close) / 1e8 * 10) / 10
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim()
  const name = (sp.get('name') ?? '').trim()
  const code = ticker.match(/\d{6}/)?.[0] ?? ''
  if (!code) return NextResponse.json({ error: 'KR ticker required' }, { status: 400 })
  if (getAssetType(ticker, name, 'KR') !== 'STOCK') return NextResponse.json({ error: '개별 주식 전용' }, { status: 400 })

  const days = Math.min(260, Math.max(5, parseInt(sp.get('days') ?? '20', 10) || 20))
  const cacheKey = `mf-timeline-v1:${code}:${days}:${kstDate()}`
  const cached = await getCache<TimelineResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const raw = await fetchKrTrend(code, Math.ceil(days / 60))
    if (raw.length < 2) return NextResponse.json({ error: '데이터 없음' }, { status: 404 })
    const slice = raw.slice(0, days)
    const rows: TimelineRow[] = slice.map((r, i) => {
      const close = num(r.closePrice)
      const prev = slice[i + 1] ? num(slice[i + 1].closePrice) : 0
      return {
        date: `${r.bizdate.slice(0, 4)}-${r.bizdate.slice(4, 6)}-${r.bizdate.slice(6, 8)}`,
        close,
        changePct: prev > 0 ? Math.round(((close - prev) / prev) * 1000) / 10 : null,
        foreign: eok(num(r.foreignerPureBuyQuant), close),
        organ: eok(num(r.organPureBuyQuant), close),
        individual: eok(num(r.individualPureBuyQuant), close),
      }
    })
    const cum = {
      foreign: Math.round(rows.reduce((s, x) => s + x.foreign, 0) * 10) / 10,
      organ: Math.round(rows.reduce((s, x) => s + x.organ, 0) * 10) / 10,
      individual: Math.round(rows.reduce((s, x) => s + x.individual, 0) * 10) / 10,
    }
    const result: TimelineResult = { ticker: code, name: name || code, days: rows.length, rows, cum }
    await setCache(cacheKey, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '타임라인 조회 실패' }, { status: 500 })
  }
}
