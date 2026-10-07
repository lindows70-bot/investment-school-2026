'use server'
// 브라우저(종목 상세 InsiderReceipt)용 입구 — 로그인·종목 형식·하루 한도를 검사한 뒤 서버 전용 getInsiderSignal 을 부른다(2026-10-05 보안 점검)
import { getInsiderSignal, type InsiderSignal } from '@/app/actions/getInsiderSignal'
import { getAuthedUserId } from '@/lib/cronAuth'
import { cleanTicker, cleanName, cleanMarket } from '@/lib/tickerGuard'
import { takeHeavyQuota } from '@/lib/heavyQuota'

/** 거절이면 null — 화면(InsiderReceipt)은 null 이면 카드를 그리지 않는다 */
export async function getInsiderSignalForUser(input: { ticker: string; market: string; name?: string }): Promise<InsiderSignal | null> {
  const uid = await getAuthedUserId()
  if (!uid) return null
  const ticker = cleanTicker(input?.ticker)
  if (!ticker) return null
  const mk = String(input?.market ?? 'US').trim().toUpperCase()
  const market = mk === 'CRYPTO' ? 'CRYPTO' : cleanMarket(mk)   // US·KR·CRYPTO 만(코인은 안쪽에서 '주식 아님'으로 끝난다)
  if (!market) return null
  if (!(await takeHeavyQuota(uid))) return null
  return getInsiderSignal({ ticker, market, name: input?.name ? cleanName(input.name, ticker) : undefined })
}
