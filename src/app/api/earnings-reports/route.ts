// 📑 실적 리포트 서빙 — 크론이 적재한 원문·요약을 읽기만(수집·요약은 /api/cron/earnings-reports).
//   ?ticker=NVDA 면 종목 상세(원문 첨부 전문 포함), 없으면 목록 인덱스.
import { NextRequest, NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'
import { ER_INDEX_KEY, ER_DOC_KEY, type EarningsReportDoc, type ErIndexRow } from '@/lib/earningsReport'

export const dynamic = 'force-dynamic'

interface IndexPayload { rows: ErIndexRow[]; targets: number; updatedAt: string }

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get('ticker') || '').trim().toUpperCase()

  if (ticker) {
    const doc = await getCache<EarningsReportDoc>(ER_DOC_KEY(ticker), 120 * 86_400_000)
    if (!doc) return NextResponse.json({ ok: false, reason: 'not_collected', ticker })
    return NextResponse.json({ ok: true, doc })
  }

  const idx = await getCache<IndexPayload>(ER_INDEX_KEY, 7 * 86_400_000)
  if (!idx?.rows?.length) return NextResponse.json({ ok: false, reason: 'pending', rows: [] })
  return NextResponse.json({ ok: true, ...idx })
}
