'use client'
// 시장 화면 '내 종목' 배지용 — 내 보유 종목 키(시장:티커)만 브라우저 Supabase(RLS·본인 user_id)로 읽는다. 서버·공유 캐시로는 보내지 않는다
//   useMyPortfolio 는 시세·환율까지 불러 무겁다(보유 전체 시세 POST) — 겹침 판정엔 티커만 필요해 같은 표(investments)·같은 조건(user_id)으로 티커만 읽는다.
//   선생님 계정은 RLS 상 학생 전원 보유가 보이므로 user_id 로 반드시 거른다.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { holdingKey } from '@/lib/marketScreen'

/** enabled 가 처음 true 가 될 때 한 번 읽는다. 모름(불러오는 중·로그인 안 함·실패) = null — 그땐 배지를 안 붙인다 */
export function useMyTickers(enabled: boolean): Set<string> | null {
  const [keys, setKeys] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data, error } = await sb.from('investments').select('ticker,market').eq('user_id', user.id)
      if (error || cancelled) return
      const rows = (data ?? []) as { ticker?: unknown; market?: unknown }[]
      setKeys(new Set(rows.filter(r => typeof r.ticker === 'string' && typeof r.market === 'string').map(r => holdingKey(r.market as string, r.ticker as string))))
    })().catch(() => { /* 모름 — 배지만 안 붙는다 */ })
    return () => { cancelled = true }
  }, [enabled])
  return keys
}
