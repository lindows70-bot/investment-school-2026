// ⭐ 핵심 추천 전향적 적립 크론 — 오늘 서빙된 통합추천에서 3중 통과(⭐) 종목을 뽑아 이력 스토어에 쌓는다.
//   왜: ⭐는 클라이언트에서만 계산되고 적립이 없어, UI가 약속한 "성적표가 매일 자동 채점"이 불가능했다
//   (소급 검증은 역인과로 무효 — 전향적 적립만이 이 조합의 승률을 말할 수 있다). 채점은 signal-report 가 한다.
//   원천: app_cache 의 오늘자 unified-reco 캐시(아무 사용자 것이나 — 추천 목록은 유니버스 파생이라 사용자 무관.
//   개인화 필드는 suggestWon 뿐이고 여기선 안 쓴다). 오늘 아무도 안 열었으면 정직하게 skip(없는 날은 없다고 남긴다).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCache, setCache } from '@/lib/appCache'
import { UNIFIED_RECO_V } from '@/lib/recoCacheVersion'
import { CORE_HIST_KEY, isCorePick, type CoreHistEntry } from '@/lib/coreReco'
import { AXIS_HIST_KEY, type AxisHistEntry } from '@/lib/axisHistory'   // 📐 축별 성적 전향적 적립

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

interface LiteItem {
  ticker: string; name: string; market: string; combined: number
  timing: { light?: string | null; prime?: boolean | null } | null
  // 📐 축별 성적 적립용(축 스냅샷) — 이 크론이 이미 오늘자 통합추천을 읽으므로 추가 비용 0
  valueScore?: number; qualityScore?: number; momentumScore?: number
  rotationScore?: number; supplyScore?: number; seasonScore?: number
}

export async function GET(req: Request) {
  const today = kstDate()
  const origin = new URL(req.url).origin

  // 크론 헬스 아티팩트 — 적립 0건인 날도 '실행됨'은 남긴다(조용한 실패와 조용한 무신호를 구분)
  const runMark = (extra: Record<string, unknown>) =>
    setCache(`core-reco-run-v1:${today}`, { at: new Date().toISOString(), ...extra })

  // ① 오늘자 unified-reco 캐시 아무거나 — 키 형식 unified-reco-vNN:{userId}:{date}:{fp}
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) } })
  const { data: cacheRows } = await admin.from('app_cache')
    .select('key, payload')
    .like('key', `unified-reco-${UNIFIED_RECO_V}:%:${today}:%`)
    .order('updated_at', { ascending: false })
    .limit(1)
  const payload = cacheRows?.[0]?.payload as { items?: LiteItem[]; reference?: LiteItem[] } | undefined
  const items: LiteItem[] = payload?.items ?? []
  if (!items.length) {
    await runMark({ skipped: 'no-unified-today' })
    return NextResponse.json({ date: today, skipped: 'no-unified-today' })
  }

  // ①-b 📐 축별 성적 적립 — 본목록 + 지역 참고를 함께 쌓는다.
  //   ⚠️ 본목록만 쌓으면 전부 고득점이라 "그 축이 높을수록 좋았나"를 물을 **대조군이 없다**.
  //   소급이 역인과로 막혀 있어(2026-08-09 가중치 검토·ROE 백테스트) 전향적 적립만이 유일한 길이다.
  const axisOf = (it: LiteItem, slot: 'pick' | 'ref'): AxisHistEntry | null => {
    const a = {
      value: it.valueScore, quality: it.qualityScore, momentum: it.momentumScore,
      rotation: it.rotationScore, supply: it.supplyScore, season: it.seasonScore,
    }
    // 축이 하나라도 없으면 버린다 — 결측을 50으로 채우면 '모름'이 '보통'으로 둔갑해 채점이 오염된다
    if (Object.values(a).some(v => typeof v !== 'number')) return null
    return {
      date: today, ticker: it.ticker, name: it.name, market: it.market === 'KR' ? 'KR' : 'US', slot,
      axes: a as AxisHistEntry['axes'], combined: it.combined,
    }
  }
  const axisRows = [
    ...items.map(it => axisOf(it, 'pick')),
    ...(payload?.reference ?? []).map(it => axisOf(it, 'ref')),
  ].filter((x): x is AxisHistEntry => x != null)
  let axisAccrued = 0
  if (axisRows.length) {
    const ah = (await getCache<AxisHistEntry[]>(AXIS_HIST_KEY, 400 * 86_400_000)) ?? []
    const seenAx = new Set(ah.filter(h => h.date === today).map(h => `${h.slot}:${h.ticker}`))
    const freshAx = axisRows.filter(r => !seenAx.has(`${r.slot}:${r.ticker}`))
    if (freshAx.length) await setCache(AXIS_HIST_KEY, [...ah, ...freshAx].slice(-6000))   // 하루 ~35건 × 약 170일
    axisAccrued = freshAx.length
  }

  // ② 타이밍 관문 통과 후보만 위원회 판정(brief) 조회 — masters-verdict 는 24h 캐시라 부담 낮음
  const candidates = items.filter(it => it.timing && (it.timing.light === 'green' || !!it.timing.prime))
  const pass: CoreHistEntry[] = []
  for (const it of candidates) {
    try {
      const mkt = it.market === 'KR' ? 'KR' : 'US'
      const r = await fetch(`${origin}/api/masters-verdict?ticker=${encodeURIComponent(it.ticker)}&market=${mkt}&brief=1`,
        { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
      const v = r.ok ? await r.json() : null
      if (isCorePick(it.timing, v)) {
        pass.push({ date: today, ticker: it.ticker, name: it.name, market: mkt, combined: it.combined, prime: !!it.timing?.prime })
      }
    } catch { /* 판정 결측 = 통과 아님(결측≠통과) */ }
  }

  // ③ 적립 — 같은 날 재실행 중복 방지 + 상한 1,000건(FIFO)
  const hist = (await getCache<CoreHistEntry[]>(CORE_HIST_KEY, 400 * 86_400_000)) ?? []
  const seen = new Set(hist.filter(h => h.date === today).map(h => h.ticker))
  const fresh = pass.filter(p => !seen.has(p.ticker))
  if (fresh.length) await setCache(CORE_HIST_KEY, [...hist, ...fresh].slice(-1000))
  await runMark({ itemsChecked: items.length, candidates: candidates.length, pass: pass.map(p => p.ticker), accrued: fresh.length, axisAccrued })

  return NextResponse.json({
    date: today, itemsChecked: items.length, timingCandidates: candidates.length,
    corePass: pass.map(p => `${p.ticker}${p.prime ? '🏅' : ''}`), accrued: fresh.length, histTotal: hist.length + fresh.length,
    axisAccrued,
  })
}
