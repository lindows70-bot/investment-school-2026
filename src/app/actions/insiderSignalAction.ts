'use server'
// 브라우저(종목 상세 InsiderReceipt)용 입구 — 로그인·종목 형식·하루 한도를 검사한 뒤 서버 전용 getInsiderSignal 을 부른다(2026-10-05 보안 점검)
import { getInsiderSignal, type InsiderSignal } from '@/app/actions/getInsiderSignal'
import { getAuthedUserId } from '@/lib/cronAuth'
import { cleanTicker, cleanName } from '@/lib/tickerGuard'
import { takeHeavyQuota } from '@/lib/heavyQuota'

/** 거절이면 null — 화면(InsiderReceipt)은 null 이면 카드를 그리지 않는다 */
export async function getInsiderSignalForUser(input: { ticker: string; market: string; name?: string }): Promise<InsiderSignal | null> {
  const uid = await getAuthedUserId()
  if (!uid) return null
  const ticker = cleanTicker(input?.ticker)
  if (!ticker) return null
  if (!(await takeHeavyQuota(uid))) return null
  return getInsiderSignal({ ticker, market: String(input?.market ?? 'US'), name: input?.name ? cleanName(input.name, ticker) : undefined })
}
