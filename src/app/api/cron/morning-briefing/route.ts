/**
 * GET /api/cron/morning-briefing  — 🤖 Jarvis 모닝 포트폴리오 처방전 (1단계 · Cron)
 *
 * 매일 새벽 Vercel Cron이 호출. 전체 학생의 보유 종목을 순회하며 정량 룰로 SELL/BUY 시그널을
 * 판정하고, 발동 종목에 한해 Gemini로 'Jarvis' 브리핑을 생성해 user_daily_briefings에 적재한다.
 *
 * 효율: 같은 종목을 여러 학생이 보유 → 종목 단위로 지표·내부자·브리핑을 1회만 계산(디듀프 + app_cache).
 * 안정: 모든 단계 try/catch — 한 종목/한 학생이 실패해도 전체 배치는 계속 진행.
 *
 * 보안: CRON_SECRET 설정 시 `Authorization: Bearer <secret>` 또는 `?secret=` 일치해야 실행.
 *
 * ⚠️ DB 테이블(user_daily_briefings)이 없어도 배치는 돌고, 적재만 graceful skip(무중단).
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import {
  buildSignalMetrics, recentInsiderAccumulation, evaluateSignal,
  getRecommendations, generateBriefing, kstDate,
  type SignalMetrics, type SignalDecision, type Recommendation, type BriefingText,
} from '@/lib/jarvisBriefing'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const MAX_HOLDINGS = 400   // 배치 안전 상한

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface Holding { user_id: string; ticker: string; name: string | null; market: string | null; lynch_category: string | null }

export async function GET(req: Request) {
  const t0 = Date.now()
  // ── 보안: CRON_SECRET 검증(설정된 경우) ──
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const auth = req.headers.get('authorization') || ''
    const ok = auth === `Bearer ${secret}` || url.searchParams.get('secret') === secret
    if (!ok) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const db = admin()
  if (!db) return NextResponse.json({ ok: false, error: 'supabase admin 미설정' }, { status: 500 })

  const baseDate = kstDate()
  const summary = { baseDate, users: 0, holdings: 0, stocks: 0, uniqueTickers: 0, sell: 0, buy: 0, hold: 0, written: 0, skipped: 0, errors: 0, ms: 0 }

  try {
    // ── 전체 보유 종목 로드 ──
    const { data: rows, error } = await db
      .from('investments')
      .select('user_id,ticker,name,market,lynch_category')
      .limit(MAX_HOLDINGS)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const holdings = (rows ?? []) as Holding[]
    summary.holdings = holdings.length
    summary.users = new Set(holdings.map(h => h.user_id)).size

    // 개별주식만 (ETF·코인·원자재 제외)
    const stocks = holdings.filter(h => getAssetType(h.ticker, h.name ?? '', h.market ?? 'US') === 'STOCK')
    summary.stocks = stocks.length

    // ── 종목 디듀프: 지표 1회 수집 ──
    const keyOf = (h: Holding) => `${h.ticker.toUpperCase()}|${h.market ?? 'US'}`
    const uniq = new Map<string, Holding>()
    for (const h of stocks) if (!uniq.has(keyOf(h))) uniq.set(keyOf(h), h)
    summary.uniqueTickers = uniq.size

    const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin   // stock-info(PEG SSOT) 호출용
    // 병렬(동시성 6) — stock-info가 느려(~20s) 순차로는 타임아웃, 병렬로 300s 내 완료
    const metricsByKey = new Map<string, SignalMetrics | null>()
    const uniqArr = Array.from(uniq)
    for (let i = 0; i < uniqArr.length; i += 6) {
      const batch = uniqArr.slice(i, i + 6)
      const rs = await Promise.all(batch.map(async ([k, h]) => {
        try { return [k, await buildSignalMetrics(h.ticker, h.market ?? 'US', h.name ?? '', selfBase)] as const }
        catch { summary.errors++; return [k, null] as const }
      }))
      for (const [k, m] of rs) metricsByKey.set(k, m)
    }

    // ── 내부자 매집: SELL 자동발동이 아닌 종목만(비용 절감) ──
    const insiderByKey = new Map<string, boolean>()
    for (const [k, h] of Array.from(uniq)) {
      const m = metricsByKey.get(k) ?? null
      if (!m) { insiderByKey.set(k, false); continue }
      const autoSell = (m.peg != null && m.peg > 2.2) || m.opMargin2qDown || m.fcfNegative
      if (autoSell) { insiderByKey.set(k, false); continue }
      try { insiderByKey.set(k, await recentInsiderAccumulation(h.ticker, h.market ?? 'US', h.name ?? '')) }
      catch { insiderByKey.set(k, false) }
    }

    // ── 종목별 캐시(런 내 + app_cache): 대안·브리핑은 (종목,시그널) 1회만 ──
    const recsByKey = new Map<string, Recommendation[]>()
    const briefByKey = new Map<string, BriefingText>()

    const recsFor = async (h: Holding, targetPeg: number | null): Promise<Recommendation[]> => {
      const k = keyOf(h)
      if (recsByKey.has(k)) return recsByKey.get(k)!
      const r = await getRecommendations(h.ticker, h.name ?? '', h.market ?? 'US', targetPeg).catch(() => [])
      recsByKey.set(k, r); return r
    }
    const briefFor = async (h: Holding, decision: SignalDecision, m: SignalMetrics, recs: Recommendation[]): Promise<BriefingText> => {
      const bk = `${keyOf(h)}|${decision.type}`
      if (briefByKey.has(bk)) return briefByKey.get(bk)!
      // v6: PEG SSOT canon-fund 직접 읽기로 변경 — selfBase 의존성 제거
      const cacheKey = `jarvis-brief-v6:${m.ticker}:${m.market}:${decision.type}:${baseDate}`
      const cached = await getCache<BriefingText>(cacheKey, 20 * 3600_000)
      const b = cached ?? await generateBriefing(decision, m, recs)
      if (!cached) await setCache(cacheKey, b)
      briefByKey.set(bk, b); return b
    }

    // ── 당일 스냅샷 초기화: 재실행/룰변경으로 더 이상 발동 안 하는 옛 행(예: SELL→HOLD)이 잔존하지 않도록
    //    오늘(base_date) 행을 먼저 비우고 새로 적재(idempotent). ─────────────────────────────
    try { await db.from('user_daily_briefings').delete().eq('base_date', baseDate) } catch { /* 테이블 없음 등 무시 */ }

    // ── 학생별 보유 종목 순회 → 시그널 판정 → 적재 ──
    for (const h of stocks) {
      try {
        const m = metricsByKey.get(keyOf(h)) ?? null
        if (!m) { summary.skipped++; continue }
        const decision = evaluateSignal(m, h.lynch_category, insiderByKey.get(keyOf(h)) ?? false)
        if (decision.type === 'HOLD') { summary.hold++; continue }
        if (decision.type === 'SELL') summary.sell++; else summary.buy++

        const recs = decision.type === 'SELL' ? await recsFor(h, m.peg) : []
        const brief = await briefFor(h, decision, m, recs)

        const { error: upErr } = await db.from('user_daily_briefings').upsert({
          user_id: h.user_id, base_date: baseDate, signal_type: decision.type,
          ticker: m.ticker, stock_name: m.name,
          briefing_title: brief.title, briefing_content: brief.content,
          recommendations: recs.length ? recs : null,
        }, { onConflict: 'user_id,base_date,ticker' })
        if (upErr) summary.skipped++   // 테이블 미존재 등 → graceful skip
        else summary.written++
      } catch { summary.errors++ }
    }

    summary.ms = Date.now() - t0
    return NextResponse.json({ ok: true, ...summary }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    summary.ms = Date.now() - t0
    console.warn('[cron:morning-briefing]', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message, ...summary }, { status: 500 })
  }
}
