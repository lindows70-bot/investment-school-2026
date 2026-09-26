// 시장 탭 응답 캐시 — app_cache(날짜 없는 키, 부르는 순간의 장 시간으로 정한 TTL) + 부분 실패 결과는 30초만 메모리에(저장하지 않는다)
//   ⛔ 부분 실패한 결과를 app_cache 에 저장하지 않는다 — 한 번의 타임아웃이 TTL 내내 빈 카드가 된다(통합추천 실사고).
import { getCache, setCache } from './appCache'
import { collectFailed } from './marketBoardShared'

export type BoardMeta = { builtAt: string; failed: string[]; cache: 'hit' | 'memory' | 'miss' }
const memo = new Map<string, { at: number; body: unknown }>()
const PARTIAL_MEMO_MS = 30_000

export async function boardCached<T extends object>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T & BoardMeta> {
  const m = memo.get(key)
  if (m && Date.now() - m.at < Math.min(PARTIAL_MEMO_MS, ttlMs)) return { ...(m.body as T & BoardMeta), cache: 'memory' }
  const hit = await getCache<T & BoardMeta>(key, ttlMs)
  if (hit) return { ...hit, cache: 'hit' }
  const body = await build()
  const failed = collectFailed(body)
  const out: T & BoardMeta = { ...body, builtAt: new Date().toISOString(), failed, cache: 'miss' }
  if (failed.length === 0) { memo.delete(key); await setCache(key, out) }
  else memo.set(key, { at: Date.now(), body: out })
  return out
}
