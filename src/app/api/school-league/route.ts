/**
 * GET /api/school-league
 *
 * 스쿨 리그 집계 API
 *  - Supabase service role로 전체 학생의 투자 데이터를 집계
 *  - 가격 데이터는 batch POST /api/stock-price 로 조회
 *  - 금액(₩)은 응답에 포함하지 않음 — 수익률(%)·비중(%)만 반환
 *
 * 반환 타입: StudentPortfolio[]
 */
export const dynamic    = 'force-dynamic'
export const revalidate = 0

import { NextResponse }                    from 'next/server'
import { createClient as createAdmin }     from '@supabase/supabase-js'
import { classifyAsset }                   from '@/lib/classifyAsset'

// ── 서비스 롤 클라이언트 (전체 사용자 데이터 조회) ──────────────
function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── 타입 정의 ────────────────────────────────────────────────────
export interface StudentPortfolio {
  userId:         string
  name:           string           // 실명
  avatarColor:    string           // 아바타 색상 (결정론적 생성)
  userType:       string           // 투자 성향 (Core 비중 기반)
  isRegistered:   boolean          // 종목 등록 여부
  totalReturn:    number | null    // 전체 수익률 % (미등록 시 null)
  coreRatio:      number           // 코어 비중 %
  satelliteRatio: number           // 새틀라이트 비중 %
  topStocks:      string[]         // 효자 종목 Top 3 (이름 기준)
  holdingCount:   number           // 보유 종목 수
}

// ── 인기 종목 집계 타입 ──────────────────────────────────────────
export interface TrendingStock {
  ticker:  string
  name:    string
  market:  string
  count:   number           // 보유 학생 수
  color:   string
}

export interface SchoolLeagueData {
  students:       StudentPortfolio[]
  trendingStocks: TrendingStock[]
  computedAt:     string
  migratedCount:  number   // 이번 요청에서 소급 정정된 asset_role 개수
}

// ── 아바타 색상 팔레트 (결정론적 할당) ──────────────────────────
const AVATAR_COLORS = [
  '#38bdf8', '#c084fc', '#4ade80', '#fb923c',
  '#f87171', '#fbbf24', '#818cf8', '#34d399',
]
function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

// ── Core 비중 → 투자 성향 라벨 ──────────────────────────────────
function userTypeFromCore(core: number): string {
  if (core >= 75) return '보수 방어형'
  if (core >= 60) return '방어 성장형'
  if (core >= 50) return '균형 투자형'
  if (core >= 35) return '공격 성장형'
  return '초공격 성장형'
}

// ── 종목 색상 팔레트 ─────────────────────────────────────────────
const TICKER_COLORS = [
  '#a3e635','#38bdf8','#60a5fa','#4ade80','#f59e0b',
  '#fb923c','#c084fc','#f87171','#818cf8','#34d399',
]

// ── 인라인 마이그레이션 헬퍼 ─────────────────────────────────────
// school-league 집계 전 asset_role 소급 정정 (불일치 항목만 업데이트)
async function migrateAssetRoles(
  sb: ReturnType<typeof adminClient>,
  investments: { id: string; ticker: string | null; name: string | null; market: string | null; asset_role: string | null }[]
): Promise<{ updated: number }> {
  const toUpdate: { id: string; asset_role: 'CORE' | 'SATELLITE' }[] = []

  for (const inv of investments) {
    const market     = (inv.market ?? 'KR') as 'US' | 'KR' | 'CRYPTO'
    const classified = classifyAsset(inv.ticker ?? '', inv.name ?? '', market)
    if (inv.asset_role !== classified) {
      toUpdate.push({ id: inv.id, asset_role: classified })
    }
  }

  if (toUpdate.length === 0) return { updated: 0 }

  // ★ update().eq() 방식 — upsert는 NOT NULL 컬럼을 덮어써 데이터 손상 위험
  const results = await Promise.allSettled(
    toUpdate.map(({ id, asset_role }) =>
      sb.from('investments').update({ asset_role }).eq('id', id)
    )
  )
  const updated = results.filter(r => r.status === 'fulfilled' && !(r as PromiseFulfilledResult<{error:unknown}>).value.error).length

  console.log(`[school-league] asset_role 소급 정정: ${updated}/${toUpdate.length}개 업데이트`)
  return { updated }
}

// ── Route Handler ────────────────────────────────────────────────
export async function GET() {
  try {
    const sb = adminClient()

    // ── 1. 전체 프로필 조회 ──────────────────────────────────────
    const { data: profiles, error: profileErr } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .order('created_at', { ascending: true })

    if (profileErr) throw profileErr
    if (!profiles?.length) {
      return NextResponse.json({ students: [], trendingStocks: [], computedAt: new Date().toISOString() })
    }

    // ── 2. 전체 투자 데이터 조회 ─────────────────────────────────
    const { data: allInvestments, error: invErr } = await sb
      .from('investments')
      .select('id, user_id, ticker, name, market, currency, purchase_price, quantity, asset_role')

    if (invErr) throw invErr
    let investments = allInvestments ?? []

    // ── 2-b. asset_role 소급 정정 (classifyAsset 기준 불일치 항목 업데이트) ──
    // 집계 전 DB를 먼저 정정하고, 정정된 값으로 stats 계산
    let migratedCount = 0
    ;({ updated: migratedCount } = await migrateAssetRoles(sb, investments))
    if (migratedCount > 0) {
      // 업데이트가 발생했으면 최신 데이터 다시 조회
      const { data: refreshed } = await sb
        .from('investments')
        .select('id, user_id, ticker, name, market, currency, purchase_price, quantity, asset_role')
      if (refreshed) investments = refreshed
    }

    // user_id별 투자 목록 그룹핑
    const invByUser: Record<string, typeof investments> = {}
    for (const inv of investments) {
      if (!invByUser[inv.user_id]) invByUser[inv.user_id] = []
      invByUser[inv.user_id].push(inv)
    }

    // ── 3. 고유 티커 목록 수집 → 현재가 배치 조회 ────────────────
    const uniqueTickers: { ticker: string; market: string }[] = []
    const seen = new Set<string>()
    for (const inv of investments) {
      const key = `${inv.market}:${inv.ticker}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueTickers.push({ ticker: inv.ticker, market: inv.market })
      }
    }

    // stock-price API 배치 호출 (최대 50개)
    const priceMap: Record<string, number> = {}    // ticker → currentPrice
    const usdKrw   = 1_350

    if (uniqueTickers.length > 0) {
      try {
        const BATCH = 30
        for (let i = 0; i < uniqueTickers.length; i += BATCH) {
          const slice = uniqueTickers.slice(i, i + BATCH)
          const base  = process.env.NEXT_PUBLIC_APP_URL
                     || process.env.VERCEL_URL
                       ? `https://${process.env.VERCEL_URL}`
                       : 'http://localhost:3000'
          const res = await fetch(`${base}/api/stock-price`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(slice),
            signal:  AbortSignal.timeout(12_000),   // 12초 타임아웃
          })
          if (res.ok) {
            const data = await res.json() as { ticker: string; currentPrice: number }[]
            for (const d of data) {
              if (d.currentPrice > 0) priceMap[d.ticker.toUpperCase()] = d.currentPrice
            }
          }
        }
      } catch {
        // 가격 조회 실패 → 수익률 null 처리로 graceful degradation
      }
    }

    // ── 4. 학생별 지표 계산 ──────────────────────────────────────
    const students: StudentPortfolio[] = profiles.map((profile, idx) => {
      const userInvs   = invByUser[profile.id] ?? []
      const isRegistered = userInvs.length > 0
      const displayName  = profile.full_name ?? profile.email?.split('@')[0] ?? '알 수 없음'

      if (!isRegistered) {
        return {
          userId:         profile.id,
          name:           displayName,
          avatarColor:    avatarColor(idx),
          userType:       '미등록',
          isRegistered:   false,
          totalReturn:    null,
          coreRatio:      0,
          satelliteRatio: 0,
          topStocks:      [],
          holdingCount:   0,
        }
      }

      // 환율 적용 투자금액 계산
      let totalCost    = 0
      let totalCurrent = 0
      let coreVal      = 0
      let satVal       = 0

      const holdingValues: { name: string; value: number }[] = []

      for (const inv of userInvs) {
        const rate    = inv.currency === 'USD' ? usdKrw : 1
        const cost    = (inv.purchase_price ?? 0) * (inv.quantity ?? 0) * rate
        const price   = priceMap[inv.ticker?.toUpperCase() ?? '']
        const current = price ? price * (inv.quantity ?? 0) * rate : cost  // 가격 없으면 cost 유지

        totalCost    += cost
        totalCurrent += current

        // Core / Satellite 비중 계산
        // 1순위: DB에 저장된 asset_role, 없으면 classifyAsset 자동 판별
        const market = (inv.market ?? 'KR') as 'US' | 'KR' | 'CRYPTO'
        const role = inv.asset_role ??
          classifyAsset(inv.ticker ?? '', inv.name ?? '', market)
        if (role === 'CORE')      coreVal += current
        else                      satVal  += current

        holdingValues.push({ name: inv.name ?? inv.ticker, value: current })
      }

      const totalVal     = coreVal + satVal
      const coreRatio    = totalVal > 0 ? Math.round((coreVal    / totalVal) * 100) : 50
      const satRatio     = 100 - coreRatio
      const totalReturn  = totalCost > 0
        ? parseFloat(((totalCurrent - totalCost) / totalCost * 100).toFixed(1))
        : null

      // 효자 종목 Top 3 (평가금액 기준 내림차순)
      const topStocks = holdingValues
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map(h => h.name)

      return {
        userId:         profile.id,
        name:           displayName,
        avatarColor:    avatarColor(idx),
        userType:       userTypeFromCore(coreRatio),
        isRegistered:   true,
        totalReturn,
        coreRatio,
        satelliteRatio: satRatio,
        topStocks,
        holdingCount:   userInvs.length,
      }
    })

    // ── 5. 인기 종목 집계 (등록 학생 기준) ───────────────────────
    const tickerCount: Record<string, { name: string; market: string; count: number }> = {}
    for (const inv of investments) {
      const profile = profiles.find(p => p.id === inv.user_id)
      if (!profile) continue
      const userInvs = invByUser[inv.user_id] ?? []
      if (userInvs.length === 0) continue   // 미등록 사용자 제외

      const key = inv.ticker?.toUpperCase() ?? ''
      if (!tickerCount[key]) {
        tickerCount[key] = { name: inv.name ?? key, market: inv.market ?? 'KR', count: 0 }
      }
      tickerCount[key].count += 1
    }

    const trendingStocks: TrendingStock[] = Object.entries(tickerCount)
      .filter(([, v]) => v.count >= 1)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 8)
      .map(([ticker, v], i) => ({
        ticker,
        name:   v.name,
        market: v.market,
        count:  v.count,
        color:  TICKER_COLORS[i % TICKER_COLORS.length],
      }))

    const result: SchoolLeagueData = {
      students,
      trendingStocks,
      computedAt:    new Date().toISOString(),
      migratedCount,
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })

  } catch (err) {
    console.error('[school-league]', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
