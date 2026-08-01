// 🇰🇷 한국 실적 카드 서빙 — 크론이 적재한 DART 잠정실적을 읽기만.
import { NextRequest, NextResponse } from 'next/server'
import { getCache } from '@/lib/appCache'
import { KR_EARN_INDEX_KEY, KR_EARN_KEY, type KrEarningsDoc, type KrIndexRow } from '@/lib/krEarnings'

export const dynamic = 'force-dynamic'

interface IndexPayload { rows: KrIndexRow[]; targets: number; updatedAt: string }

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get('ticker') || '').trim()

  if (ticker) {
    const doc = await getCache<KrEarningsDoc>(KR_EARN_KEY(ticker), 150 * 86_400_000)
    if (!doc) return NextResponse.json({ ok: false, reason: 'not_collected', ticker })
    return NextResponse.json({ ok: true, doc })
  }

  const idx = await getCache<IndexPayload>(KR_EARN_INDEX_KEY, 7 * 86_400_000)
  if (!idx?.rows?.length) return NextResponse.json({ ok: false, reason: 'pending', rows: [] })
  return NextResponse.json({ ok: true, ...idx })
}
