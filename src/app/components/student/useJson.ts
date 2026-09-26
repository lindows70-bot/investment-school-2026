'use client'
// 학생 화면 카드들이 쓰는 작은 JSON 불러오기 훅 — 로딩·성공·실패·로그인 필요를 구분하고, 늦게 온 옛 응답은 버린다
import { useCallback, useEffect, useState } from 'react'

export type JsonState = 'idle' | 'loading' | 'ok' | 'failed' | 'unauth'
export interface JsonResult<T> { state: JsonState; data: T | null; reload: () => void }

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
    fetch(url, {
      method, cache: 'no-store', signal: ctrl.signal,
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    })
      .then(async r => {
        if (ctrl.signal.aborted) return
        if (r.status === 401) { setData(null); setState('unauth'); return }
        if (!r.ok) { setData(null); setState('failed'); return }
        const j = await r.json().catch(() => undefined)
        if (ctrl.signal.aborted) return
        if (j === undefined) { setData(null); setState('failed'); return }
        setData(j as T); setState('ok')
      })
      .catch(() => { if (!ctrl.signal.aborted) { setData(null); setState('failed') } })
    return () => ctrl.abort()
  }, [url, enabled, method, body, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { state, data, reload }
}
