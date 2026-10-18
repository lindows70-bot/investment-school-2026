'use client'
// 학생 화면 카드들이 쓰는 작은 JSON 불러오기 훅 — 로딩·성공·실패·로그인 필요를 구분하고, 늦게 온 옛 응답은 버린다
import { useCallback, useEffect, useState } from 'react'

export type JsonState = 'idle' | 'loading' | 'ok' | 'failed' | 'unauth'
export interface JsonResult<T> { state: JsonState; data: T | null; reload: () => void }

/** 같은 GET 을 여러 카드가 동시에 부르면 요청을 하나로 합친다(진행 중인 동안만 — 결과를 오래 들고 있지 않는다).
 *  2026-10-18 전수 점검: 홈 첫 로드가 환율·시세를 각각 두 번 불렀다(페이지 + 내 자산 훅). 다시 불러오기(reload)는 tick 이 바뀌어 새 키라 합쳐지지 않는다 */
type Shared = { status: number; ok: boolean; json: unknown }
const inflight = new Map<string, Promise<Shared>>()
export function fetchShared(key: string, url: string): Promise<Shared> {
  const hit = inflight.get(key)
  if (hit) return hit
  const p = fetch(url, { method: 'GET', cache: 'no-store' })
    .then(async r => ({ status: r.status, ok: r.ok, json: r.ok ? await r.json().catch(() => undefined) : undefined }))
    .finally(() => { inflight.delete(key) })
  inflight.set(key, p)
  return p
}

/** url 이 null 이거나 enabled=false 면 부르지 않는다(idle). body 는 JSON 으로 보낸다. 응답 모양 검사는 쓰는 쪽이 한다 */
export function useJson<T>(url: string | null, opts?: { method?: 'GET' | 'POST'; body?: unknown; enabled?: boolean }): JsonResult<T> {
  const enabled = opts?.enabled ?? true
  const method = opts?.method ?? 'GET'
  const body = opts?.body === undefined ? undefined : JSON.stringify(opts.body)   // 문자열로 비교해 매 렌더 새 객체여도 다시 부르지 않는다
  const active = url != null && enabled
  const [state, setState] = useState<JsonState>(active ? 'loading' : 'idle')
  const [data, setData] = useState<T | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (url == null || !enabled) { setState('idle'); setData(null); return }
    const ctrl = new AbortController()
    setState('loading')
    const run: Promise<Shared> = method === 'GET' && body === undefined
      ? fetchShared(`${url}#${tick}`, url)   // 몸통 없는 GET 만 합친다 — tick 을 키에 넣어 '다시'는 늘 새 요청
      : fetch(url, {
          method, cache: 'no-store', signal: ctrl.signal,
          ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
        }).then(async r => ({ status: r.status, ok: r.ok, json: r.ok ? await r.json().catch(() => undefined) : undefined }))
    run
      .then(r => {
        if (ctrl.signal.aborted) return
        if (r.status === 401) { setData(null); setState('unauth'); return }
        if (!r.ok) { setData(null); setState('failed'); return }
        if (r.json === undefined) { setData(null); setState('failed'); return }
        setData(r.json as T); setState('ok')
      })
      .catch(() => { if (!ctrl.signal.aborted) { setData(null); setState('failed') } })
    return () => ctrl.abort()
  }, [url, enabled, method, body, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { state, data, reload }
}
