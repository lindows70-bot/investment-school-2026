// 코인 공포·탐욕(지금·어제·1주 전·1달 전)을 돌려주는 공개 라우트 — 개인 데이터 없음, 성공만 1시간 메모리 캐시
import { NextResponse } from 'next/server'
import { fetchCryptoFng, type CryptoFng } from '@/lib/cryptoFng'

export const dynamic = 'force-dynamic'

const TTL = 3600_000
let memo: { at: number; fng: CryptoFng } | null = null

export async function GET() {
  if (memo && Date.now() - memo.at < TTL) {
    return NextResponse.json({ fng: memo.fng, failed: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const fng = await fetchCryptoFng()
  if (fng) memo = { at: Date.now(), fng }   // 실패는 캐시하지 않는다 — 다음 요청이 스스로 낫는다
  return NextResponse.json({ fng, failed: fng == null }, { headers: { 'Cache-Control': 'no-store' } })
}
