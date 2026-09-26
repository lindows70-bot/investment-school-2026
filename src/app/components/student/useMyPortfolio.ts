'use client'
// 학생 화면 공용 — 내 보유·시세·환율을 불러와 portfolioSummary 로 요약한다(로딩·실패·빈 보유를 구분)
//   합계 원칙은 자산 관리 화면(assets/page.tsx)과 같다: created_at 내림차순 → dedupeHoldings → 요약.
//   (지난 캐시 시세도 선생님 화면처럼 쓴다.) 다른 경우는 시세가 아예 없는 종목 하나 — 선생님 화면은 0원(별도 추적 중인 결함),
//   여기선 매수가로 평가하고 '시세 못 가져옴'으로 밝힌다.
//   개인 데이터라 공유 캐시를 쓰지 않는다 — 브라우저 Supabase(RLS) + 기존 시세·환율 엔드포인트만 쓴다.
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { summarizePortfolio, dedupeHoldings, type HoldingInput, type PriceInput, type PortfolioSummary } from '@/lib/portfolioSummary'
import { acceptFx } from '@/lib/fxAccept'

export type LoadState = 'loading' | 'ready' | 'failed' | 'unauth'
/** db = 보유 조회 실패 · fx = 달러 보유가 있는데 환율을 못 받음 · other = 그 밖의 예외 */
export type FailReason = 'db' | 'fx' | 'other'
/** 보유 한 줄 + 매수일 — 자산 성장 차트(/api/monthly-pnl)가 로트를 만들 때 쓴다. 요약(portfolioSummary)은 매수일을 모른다 */
export type MyHolding = HoldingInput & { purchase_date: string | null }
export interface MyPortfolio {
  state: LoadState
  failReason: FailReason | null
  holdings: MyHolding[]
  summary: PortfolioSummary | null
  usdKrw: number | null
  targetCorePct: number | null
  /** 보유는 있는데 시세 조회 자체가 실패 — 요약은 매수가로 계산돼 있으니 화면이 '시세를 못 가져왔어요'를 말해야 한다 */
  pricesFailed: boolean
  reload: () => void
}

export function useMyPortfolio(): MyPortfolio {
  const [state, setState] = useState<LoadState>('loading')
  const [failReason, setFailReason] = useState<FailReason | null>(null)
  const [holdings, setHoldings] = useState<MyHolding[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [usdKrw, setUsdKrw] = useState<number | null>(null)
  const [targetCorePct, setTarget] = useState<number | null>(null)
  const [pricesFailed, setPricesFailed] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    // 실패는 한 곳에서 확정한다 — 옛 요약이 남아 '실패'와 함께 보이지 않도록 summary 도 비운다
    const fail = (reason: FailReason, hs: MyHolding[] = []) => {
      if (cancelled) return
      setHoldings(hs); setSummary(null); setUsdKrw(null); setTarget(null); setPricesFailed(false); setFailReason(reason); setState('failed')
    }
    ;(async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        if (!cancelled) { setHoldings([]); setSummary(null); setPricesFailed(false); setFailReason(null); setState('unauth') }
        return
      }
      const [{ data, error }, fxRes, cfg] = await Promise.all([
        sb.from('investments').select('id,ticker,name,market,currency,purchase_price,quantity,purchase_date,asset_role')
          .eq('user_id', user.id).order('created_at', { ascending: false }),
        fetch('/api/exchange-rate', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        // 선생님 권장 코어 비중(싱글턴 행) — 못 읽어도 실패로 보지 않는다(투자 체크만 빠진다)
        sb.from('strategy_configs').select('core_pct').limit(1).maybeSingle(),
      ])
      if (error) { fail('db'); return }
      const hs = dedupeHoldings((data ?? []) as MyHolding[])
      // 환율 라우트는 모든 원천이 죽으면 고정 상수(source 'stale-constant')를 준다 — 지금 환율이 아니므로 못 받은 것으로 본다(acceptFx)
      const fx: number | null = acceptFx(fxRes)

      let priceMap: Record<string, PriceInput> = {}
      let pricesOk = true
      if (hs.length) {
        pricesOk = false
        const pr = await fetch('/api/stock-price', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hs.map(h => ({ ticker: h.ticker, market: h.market }))),
        }).catch(() => null)
        if (pr?.ok) {
          const list: unknown = await pr.json().catch(() => null)
          if (Array.isArray(list)) {
            pricesOk = true
            const entries: [string, PriceInput][] = []
            list.forEach((p: { ticker?: unknown; source?: unknown } & Omit<PriceInput, 'source'>) => {
              if (!p || typeof p.ticker !== 'string') return
              // source 는 지난 시세(캐시) 판정에 쓰이므로 문자열일 때만 넘긴다
              entries.push([p.ticker.toUpperCase(), {
                currentPrice: p.currentPrice, change: p.change, changePct: p.changePct, error: p.error,
                source: typeof p.source === 'string' ? p.source : undefined,
              }])
            })
            priceMap = Object.fromEntries(entries)
          }
        }
      }
      if (cancelled) return

      // 환율을 못 받으면 달러 종목이 원화로 틀리게 계산된다 → 달러 보유가 있으면 실패로 밝힌다(추정 환율 금지)
      if (hs.some(h => h.currency === 'USD') && fx == null) { fail('fx', hs); return }

      let s: PortfolioSummary
      try { s = summarizePortfolio(hs, priceMap, fx ?? 1) } catch { fail('other', hs); return }

      const core = cfg.error ? null : cfg.data?.core_pct
      setHoldings(hs); setUsdKrw(fx)
      setTarget(typeof core === 'number' && core > 0 ? core : null)
      setPricesFailed(!pricesOk)
      setSummary(s); setFailReason(null); setState('ready')
    })().catch(() => fail('other'))
    return () => { cancelled = true }
  }, [tick])

  const reload = useCallback(() => { setState('loading'); setTick(t => t + 1) }, [])
  return { state, failReason, holdings, summary, usdKrw, targetCorePct, pricesFailed, reload }
}
