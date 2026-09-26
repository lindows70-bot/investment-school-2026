'use client'
// 시장 화면 '내 종목' 배지용 — 내 보유 종목 키(시장:티커)만 브라우저 Supabase(RLS·본인 user_id)로 읽는다. 서버·공유 캐시로는 보내지 않는다
//   useMyPortfolio 는 시세·환율까지 불러 무겁다(보유 전체 시세 POST) — 겹침 판정엔 티커만 필요해 같은 표(investments)·같은 조건(user_id)으로 티커만 읽는다.
//   선생님 계정은 RLS 상 학생 전원 보유가 보이므로 user_id 로 반드시 거른다.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { holdingKey } from '@/lib/marketScreen'

/** idle = 아직 안 부름 · unauth = 로그인 안 함(표시할 내 종목이 없다 — 실패 아님) · failed = 조회 실패(화면이 '못 불러왔어요'를 말한다) */
export type MyTickersState = 'idle' | 'loading' | 'ok' | 'unauth' | 'failed'

/** enabled 가 처음 true 가 될 때 한 번 읽는다. keys 는 ok 일 때만 — 그 밖엔 null(배지를 안 붙인다) */
export function useMyTickers(enabled: boolean): { keys: Set<string> | null; state: MyTickersState } {
  const [keys, setKeys] = useState<Set<string> | null>(null)
  const [state, setState] = useState<MyTickersState>('idle')
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState('loading')
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (cancelled) return
      if (!user) { setState('unauth'); return }
      const { data, error } = await sb.from('investments').select('ticker,market').eq('user_id', user.id)
      if (cancelled) return
      if (error) { setState('failed'); return }
      const rows = (data ?? []) as { ticker?: unknown; market?: unknown }[]
      setKeys(new Set(rows.filter(r => typeof r.ticker === 'string' && typeof r.market === 'string').map(r => holdingKey(r.market as string, r.ticker as string))))
      setState('ok')
    })().catch(() => { if (!cancelled) setState('failed') })
    return () => { cancelled = true }
  }, [enabled])
  return { keys, state }
}
