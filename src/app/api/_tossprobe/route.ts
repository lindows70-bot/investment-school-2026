// ⚠️ 임시 검증용 프로브 — 토스 시세 연결 확인 후 삭제 예정(공용 시세만 반환, 개인정보 없음)
import { NextResponse } from 'next/server'
import { getTossKrPrice } from '@/lib/tossQuote'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasKey = !!process.env.TOSS_API_KEY && !!process.env.TOSS_SECRET_KEY
  const px = await getTossKrPrice('005930') // 삼성전자
  return NextResponse.json({ hasKey, samsungPrice: px })
}
