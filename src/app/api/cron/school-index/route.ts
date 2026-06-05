/**
 * GET /api/cron/school-index — 🏫 투자학교 13F 인덱스 (School Insider Flow) · 1단계 Cron
 *
 * 매일 새벽 전체 학생 보유 종목을 '동일 가중' 인덱스로 집계해 두 스냅샷 테이블에 적재한다.
 *  · school_index_stock_snapshots  : 종목별 평균 비중·보유 학생수·전일 대비 변동
 *  · school_index_sector_snapshots : 섹터별 평균 비중
 *
 * 익명성: 2명 미만 보유 종목은 'ETC'로 합산(개인 식별 차단). 동일가중·전체자산기준 비중은 lib/schoolIndex.
 * 안정성: 가격조회·섹터조회·학생연산 전부 try/catch — 부분 실패해도 전체 적재 지속.
 * 보안: CRON_SECRET 설정 시 `Authorization: Bearer <secret>` 또는 `?secret=` 검증.
 *
 * ⚠️ 스냅샷 테이블이 없어도 집계는 돌고 적재만 graceful skip(무중단).
 */

import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAssetType } from '@/lib/assetClassifier'
import {
  aggregateSchoolIndex, getSector, kstDate,
  type Inv, type StockSnapshotRow, type SectorSnapshotRow,
} from '@/lib/schoolIndex'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(req: Request) {
  const t0 = Date.now()
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret)
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const db = admin()
  if (!db) return NextResponse.json({ ok: false, error: 'supabase admin 미설정' }, { status: 500 })

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const baseDate = kstDate()
  const summary = { baseDate, holdings: 0, registered: 0, uniqueTickers: 0, stockRows: 0, sectorRows: 0, stockWritten: 0, sectorWritten: 0, errors: 0, ms: 0 }

  try {
    // ── 전체 보유 종목 ──
    const { data: rows, error } = await db
      .from('investments')
      .select('user_id,ticker,name,market,currency,purchase_price,quantity')
      .limit(2000)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const invs = (rows ?? []) as Inv[]
    summary.holdings = invs.length

    // ── 고유 티커 ──
    const allTickers: { ticker: string; market: string }[] = []
    const stockTickers: { ticker: string; market: string }[] = []
    const seen = new Set<string>()
    for (const inv of invs) {
      const key = `${inv.market}:${inv.ticker}`
      if (seen.has(key) || !inv.ticker) continue
      seen.add(key)
      allTickers.push({ ticker: inv.ticker, market: inv.market ?? 'US' })
      if (getAssetType(inv.ticker, inv.name ?? '', inv.market ?? 'US') === 'STOCK')
        stockTickers.push({ ticker: inv.ticker, market: inv.market ?? 'US' })
    }
    summary.uniqueTickers = allTickers.length

    // ── 현재가 배치 조회 (전 자산 — 분모 계산용) ──
    const priceMap: Record<string, number> = {}
    for (let i = 0; i < allTickers.length; i += 30) {
      try {
        const res = await fetch(`${selfBase}/api/stock-price`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(allTickers.slice(i, i + 30)), signal: AbortSignal.timeout(15_000),
        })
        if (res.ok) {
          const data = await res.json() as { ticker: string; currentPrice: number }[]
          for (const d of data) if (d.currentPrice > 0) priceMap[d.ticker.toUpperCase()] = d.currentPrice
        }
      } catch { summary.errors++ }   // 가격 실패 → 매입가 폴백(graceful)
    }

    // ── GICS 섹터 조회 (주식만 · 동시성 5 · 7일 캐시) ──
    const sectorMap: Record<string, string> = {}
    for (let i = 0; i < stockTickers.length; i += 5) {
      const chunk = stockTickers.slice(i, i + 5)
      const rs = await Promise.all(chunk.map(t => getSector(t.ticker, t.market).catch(() => '기타')))
      chunk.forEach((t, j) => { sectorMap[t.ticker.toUpperCase()] = rs[j] })
    }

    // ── 직전 스냅샷(최근 prior base_date) → weight_change 기준 ──
    const prevStockWeight: Record<string, number> = {}
    try {
      const { data: prevDateRow } = await db
        .from('school_index_stock_snapshots')
        .select('base_date').lt('base_date', baseDate).order('base_date', { ascending: false }).limit(1).maybeSingle()
      if (prevDateRow?.base_date) {
        const { data: prevRows } = await db
          .from('school_index_stock_snapshots')
          .select('ticker,avg_weight').eq('base_date', prevDateRow.base_date)
        for (const r of prevRows ?? []) prevStockWeight[String(r.ticker).toUpperCase()] = Number(r.avg_weight) || 0
      }
    } catch { /* 테이블 없거나 직전 없음 → 변동 0 */ }

    // ── 집계 ──
    const { stockRows, sectorRows, registered } = aggregateSchoolIndex(invs, priceMap, sectorMap, prevStockWeight, baseDate)
    summary.registered = registered
    summary.stockRows = stockRows.length
    summary.sectorRows = sectorRows.length

    // ── 적재 (upsert · 복합 유니크) ──
    const writeStock = async (r: StockSnapshotRow) => {
      const { error: e } = await db.from('school_index_stock_snapshots').upsert(r, { onConflict: 'base_date,ticker' })
      if (!e) summary.stockWritten++
    }
    const writeSector = async (r: SectorSnapshotRow) => {
      const { error: e } = await db.from('school_index_sector_snapshots').upsert(r, { onConflict: 'base_date,gics_sector' })
      if (!e) summary.sectorWritten++
    }
    for (const r of stockRows) { try { await writeStock(r) } catch { summary.errors++ } }
    for (const r of sectorRows) { try { await writeSector(r) } catch { summary.errors++ } }

    // ── 자기정화: 같은 base_date에서 이번 집계에 빠진 묵은 행 삭제 ──
    // 보유 변화로 종목/섹터가 빠지면(예: 한 학생이 매도해 공동보유 1명↓→익명화) 스냅샷에서도 제거.
    try {
      const keepStock = new Set(stockRows.map(r => r.ticker))
      const { data: exS } = await db.from('school_index_stock_snapshots').select('ticker').eq('base_date', baseDate)
      const orphS = (exS ?? []).map(r => r.ticker as string).filter(t => !keepStock.has(t))
      if (orphS.length) await db.from('school_index_stock_snapshots').delete().eq('base_date', baseDate).in('ticker', orphS)

      const keepSec = new Set(sectorRows.map(r => r.gics_sector))
      const { data: exSec } = await db.from('school_index_sector_snapshots').select('gics_sector').eq('base_date', baseDate)
      const orphSec = (exSec ?? []).map(r => r.gics_sector as string).filter(s => !keepSec.has(s))
      if (orphSec.length) await db.from('school_index_sector_snapshots').delete().eq('base_date', baseDate).in('gics_sector', orphSec)
    } catch { summary.errors++ }

    summary.ms = Date.now() - t0
    // ?debug=1 → 집계 행 포함(익명 집계라 노출 무해 · 검증/프론트 연동용). summary 카운트와 키 충돌 피해 debug 하위로.
    const debug = new URL(req.url).searchParams.get('debug') === '1'
    return NextResponse.json({ ok: true, ...summary, ...(debug ? { debug: { stocks: stockRows, sectors: sectorRows } } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    summary.ms = Date.now() - t0
    console.warn('[cron:school-index]', (e as Error).message)
    return NextResponse.json({ ok: false, error: (e as Error).message, ...summary }, { status: 500 })
  }
}
