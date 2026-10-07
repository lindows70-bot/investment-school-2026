/**
 * GET /api/lynch/ghost-stock
 *
 * ◆ 데이터 파이프라인 (하루 1회 캐싱 전략)
 *
 *  1) Supabase Auth → 로그인 학생 식별
 *  2) investments 테이블 → 보유 종목 ticker 리스트 조회
 *  3) ghost_stock_cache → 오늘 날짜 캐시 확인
 *     ├─ 캐시 HIT  → 즉시 반환 (외부 API 호출 없음)
 *     └─ 캐시 MISS → 외부 API 호출 → Ghost Score 계산 → Upsert → 반환
 *
 * ◆ 데이터 소스 (2026-07-30 실데이터 전환 — 스터브·가상 연산 전량 제거)
 *  - 커버리지: US=Yahoo numberOfAnalystOpinions / KR=네이버 리포트 건수(getAnalystSignal SSOT)
 *  - 내부자:   getInsiderSignal SSOT (US=SEC EDGAR Form4 장내매수 / KR=DART) — 장내매수만 추적
 *  - 기관 보유: US=Yahoo heldPercentInstitutions / KR=무료 소스 부재 → 중립 처리(정직)
 */

// 빌드 시 정적 생성 금지 — 무거운 외부 fetch가 빌드 타임아웃을 내고(2026-08-01 실측: SEC·Yahoo 지연으로 빌드 실패) 데이터가 빌드 시점에 박제된다
export const dynamic = 'force-dynamic'
export const maxDuration = 120   // 🔍 미보유 발굴 콜드 스캔(24종 × 커버리지+내부자) 여유

import { NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import { getAssetClassification }     from '@/lib/assetClassifier'
import { buildGhostRecord, buildDiscovery, type GhostCacheRow } from '@/lib/ghostStock'   // 계산·발굴은 lib(매일 워밍 크론과 공유 · 2026-10-07)

// ── GET 핸들러 ────────────────────────────────────────────────
export async function GET() {
  const cookieStore = await cookies()

  // ── 1. 인증 클라이언트 — 로그인 학생 식별 ──────────────────
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll:  (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 🔍 발굴 스캔은 보유 분석과 독립 — 먼저 발사하고 응답 직전에 회수(워터폴 방지)
  const discoveryP = buildDiscovery().catch(() => [] as Omit<GhostCacheRow, 'updated_at'>[])

  // ── 2. 서비스 롤 클라이언트 — 캐시 읽기/쓰기 ──────────────
  const { createClient: createSbAdmin } = await import('@supabase/supabase-js')
  const sbAdmin = createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 3. 학생 보유 종목 조회 ──────────────────────────────────
  const { data: holdings, error: holdingsErr } = await sbAdmin
    .from('investments')
    .select('ticker, name, market, lynch_category')
    .eq('user_id', user.id)

  if (holdingsErr) {
    return NextResponse.json({ error: holdingsErr.message }, { status: 500 })
  }
  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ records: [], source: 'empty' })
  }

  // ── 3-b. 자산 유형 분류 — 비주식은 Ghost 분석에서 제외 ─────
  // ETF·암호화폐·원자재는 기업 경영진·애널리스트 개념이 없으므로
  // ghost_stock_cache에 저장하지 않고 'excluded' 목록으로 분리 반환
  const equityHoldings = holdings.filter(h => {
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
    return clf.isAnalyzable   // STOCK만 true
  })
  const excludedHoldings = holdings.filter(h => {
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
    return !clf.isAnalyzable
  }).map(h => {
    const clf = getAssetClassification(h.ticker, h.name, h.market ?? 'US')
    return {
      ticker:       h.ticker.toUpperCase(),
      name:         h.name,
      assetType:    clf.assetType,
      badgeIcon:    clf.badgeIcon,
      badgeLabel:   clf.badgeLabel,
      lynchGuidance: clf.lynchGuidance,
    }
  })

  const tickers = equityHoldings.map(h => h.ticker.toUpperCase())

  if (tickers.length === 0) {
    return NextResponse.json({
      records:  [],
      excluded: excludedHoldings,
      source:   'empty',
    })
  }

  // ── 4. 캐시 확인 (오늘 날짜 기준) ─────────────────────────
  const todayISO = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'

  const { data: cachedRows } = await sbAdmin
    .from('ghost_stock_cache')
    .select('*')
    .in('ticker', tickers)

  // 캐시 HIT = updated_at이 오늘 날짜인 행
  const hitMap   = new Map<string, GhostCacheRow>()
  const missTickerSet = new Set<string>(tickers)

  for (const row of (cachedRows ?? [])) {
    const rowDate = (row.updated_at as string).slice(0, 10)
    if (rowDate === todayISO) {
      hitMap.set(row.ticker, row as GhostCacheRow)
      missTickerSet.delete(row.ticker)
    }
  }

  // ── 5. 캐시 MISS → 외부 API 호출 후 Upsert ────────────────
  const newRows: Omit<GhostCacheRow, 'updated_at'>[] = []

  if (missTickerSet.size > 0) {
    const missList = equityHoldings.filter(h => missTickerSet.has(h.ticker.toUpperCase()))

    const built = await Promise.allSettled(
      missList.map(h =>
        buildGhostRecord(
          h.ticker.toUpperCase(),
          h.name,
          h.market ?? 'US',
          h.lynch_category ?? '',
        )
      )
    )

    for (const result of built) {
      if (result.status === 'fulfilled') {
        newRows.push(result.value)
      }
    }

    if (newRows.length > 0) {
      // Upsert: ticker PK 기준, updated_at 자동 갱신
      await sbAdmin
        .from('ghost_stock_cache')
        .upsert(
          newRows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
          { onConflict: 'ticker' }
        )
    }
  }

  // ── 6. 최종 레코드 조합 (캐시 HIT + 신규 MISS) ────────────
  const allRecords: GhostCacheRow[] = [
    ...Array.from(hitMap.values()),
    ...newRows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
  ]

  // 포트폴리오 순서 기반 정렬 (ghost_score 내림차순)
  allRecords.sort((a, b) => b.ghost_score - a.ghost_score)

  const hitCount  = hitMap.size
  const missCount = newRows.length

  const heldSet = new Set(holdings.map(h => String(h.ticker).toUpperCase()))
  const discovery = (await discoveryP).filter(d => !heldSet.has(d.ticker.toUpperCase()))

  return NextResponse.json({
    records:  allRecords,
    discovery,                    // 🔍 미보유 유령 발굴(위성 풀 상위 · 전 학생 공유 캐시 · 내 보유 제외)
    excluded: excludedHoldings,   // 비주식 자산 목록 (ETF·CRYPTO·COMMODITY)
    source:   hitCount > 0 && missCount === 0 ? 'cache' : 'partial',
    meta: {
      totalHoldings:   holdings.length,
      equityCount:     equityHoldings.length,
      excludedCount:   excludedHoldings.length,
      cacheHit:        hitCount,
      cacheMiss:       missCount,
      updatedAt:       new Date().toISOString(),
    },
  })
}
