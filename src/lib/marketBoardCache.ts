// 시장 탭 응답 캐시 — 진행 중 빌드 공유(single-flight) + 인스턴스 메모리(최대 60초) + app_cache(날짜 없는 키, 장 시간으로 정한 TTL)
//   부분 실패 결과는 app_cache 에 **짧게(3분)** 저장하고 응답의 failed 표시는 그대로 싣는다.
//   ⛔ 부분 실패를 긴 TTL 로 저장하지 않는다 — 한 번의 타임아웃이 TTL 내내 빈 카드가 된다(통합추천 실사고).
//   왜 3분 저장인가: 저장을 아예 안 하면 원천 하나가 계속 죽어 있는 동안 **모든 요청이 전체 빌드**를 다시 돈다
//   (kr 은 원천 호출 20여 건). 3분이면 복구는 3분 안에 반영되고, 원천에 가는 부하는 3분에 한 번으로 묶인다.
import { getCache, setCache } from './appCache'
import { collectFailed } from './marketBoardShared'

export type BoardMeta = { builtAt: string; failed: string[]; cache: 'hit' | 'memory' | 'miss' }

const MEMO_MAX_MS = 60_000          // 성공 결과도 인스턴스 메모리에 최대 60초 — app_cache 쓰기 실패·DB 읽기 전용이어도 요청마다 빌드하지 않게
const PARTIAL_TTL_MS = 3 * 60_000   // 부분 실패 결과의 수명(메모리·app_cache 공통)
const PARTIAL_MEMO_MS = 30_000

const memo = new Map<string, { at: number; keepMs: number; body: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

const ageOf = (b: { builtAt?: unknown }) => {
  const t = typeof b.builtAt === 'string' ? Date.parse(b.builtAt) : NaN
  return Number.isFinite(t) ? Date.now() - t : Infinity
}

export async function boardCached<T extends object>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T & BoardMeta> {
  const m = memo.get(key)
  if (m && Date.now() - m.at < m.keepMs) return { ...(m.body as T & BoardMeta), cache: 'memory' }

  // 같은 인스턴스에서 동시에 온 요청은 한 번의 빌드를 기다린다(원천에 같은 호출이 겹쳐 가지 않게)
  const running = inflight.get(key) as Promise<T & BoardMeta> | undefined
  if (running) return running

  const p = (async (): Promise<T & BoardMeta> => {
    const hit = await getCache<T & BoardMeta>(key, ttlMs)
    // 부분 실패로 저장된 행은 3분까지만 쓴다(getCache 는 키의 TTL 로만 거르므로 여기서 한 번 더)
    if (hit && (!(hit.failed?.length) || ageOf(hit) < PARTIAL_TTL_MS)) {
      const partial = !!hit.failed?.length
      memo.set(key, { at: Date.now(), keepMs: Math.min(ttlMs, partial ? PARTIAL_MEMO_MS : MEMO_MAX_MS), body: hit })
      return { ...hit, cache: 'hit' }
    }
    const body = await build()
    const failed = collectFailed(body)
    const out: T & BoardMeta = { ...body, builtAt: new Date().toISOString(), failed, cache: 'miss' }
    const partial = failed.length > 0
    memo.set(key, { at: Date.now(), keepMs: Math.min(ttlMs, partial ? PARTIAL_MEMO_MS : MEMO_MAX_MS), body: out })
    await setCache(key, out)   // 부분 실패도 저장하되 읽을 때 3분 넘으면 버린다(위)
    return out
  })()
  inflight.set(key, p)
  try { return await p } finally { inflight.delete(key) }
}
