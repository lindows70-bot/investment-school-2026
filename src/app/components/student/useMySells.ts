'use client'
// 학생 내 자산 — 본인 매도 기록과 매도일 환율 캔들을 읽는다(스쿨 리그와 같은 함수 studentTotalReturn 에 넣을 입력)
//   리그 API(8~20초)는 부르지 않는다. 개인 데이터라 공유 캐시에 넣지 않는다 — 브라우저 Supabase(RLS) + 공개 환율 캔들만 쓴다.
//   ⚠️ 선생님 계정은 RLS 상 전원 거래가 보이므로 user_id 로 반드시 거른다(GrowthChart 와 같은 이유).
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SellTx } from '@/lib/realizedPnl'
import type { TechCandle } from '@/lib/techChartData'

type SellsRes =
  | { state: 'idle' } | { state: 'loading' } | { state: 'failed' }
  | { state: 'ok'; sells: SellTx[]; fxCandles: TechCandle[] }
export type MySells = SellsRes & { reload: () => void }

const PAGE = 1000   // Supabase select 기본 상한 — 페이지로 끝까지 읽는다
const SELL_COLS = 'ticker,name,market,currency,realized_pnl,transaction_date,price,quantity'   // 리그 라우트와 같은 열

/** enabled 가 true 일 때만 읽는다(보유 요약이 준비되고 시세가 살아 있을 때) */
export function useMySells(enabled: boolean): MySells {
  const [res, setRes] = useState<SellsRes>({ state: 'idle' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) { setRes({ state: 'idle' }); return }
    let cancelled = false
    setRes({ state: 'loading' })
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('unauth')
      const sells: SellTx[] = []
      for (let from = 0; ;) {
        const { data, error } = await sb.from('transactions').select(SELL_COLS).eq('user_id', user.id).eq('type', 'sell')
          .order('transaction_date', { ascending: true }).order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        const page = (data ?? []) as SellTx[]
        if (page.length === 0) break
        for (const r of page) sells.push(r)
        from += page.length
      }
      // 달러로 판 기록이 있을 때만 매도일 환율이 필요하다 — 리그와 같은 원천(getTechCandles 'KRW=X' 일봉)
      let fxCandles: TechCandle[] = []
      if (sells.some(s => s.currency === 'USD')) {
        const r = await fetch('/api/tech-chart?ticker=KRW%3DX&market=US&tf=D', { cache: 'no-store' })
        const j: unknown = r.ok ? await r.json() : null
        const c = (j as { candles?: unknown } | null)?.candles
        // 환율 이력 없이 세면 전부 지금 환율로 바뀐다 — 조용히 넘기지 않고 '못 가져옴'으로 둔다
        if (!Array.isArray(c) || c.length === 0) throw new Error('fx candles')
        fxCandles = c as TechCandle[]
      }
      if (!cancelled) setRes({ state: 'ok', sells, fxCandles })
    })().catch(() => { if (!cancelled) setRes({ state: 'failed' }) })
    return () => { cancelled = true }
  }, [enabled, tick])

  const reload = useCallback(() => setTick(t => t + 1), [])
  return { ...res, reload }
}
