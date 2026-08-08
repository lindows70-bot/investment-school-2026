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

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

interface LiteItem {
  ticker: string; name: string; market: string; combined: number
  timing: { light?: string | null; prime?: boolean | null } | null
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
  const items: LiteItem[] = (cacheRows?.[0]?.payload as { items?: LiteItem[] } | undefined)?.items ?? []
  if (!items.length) {
    await runMark({ skipped: 'no-unified-today' })
    return NextResponse.json({ date: today, skipped: 'no-unified-today' })
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
  await runMark({ itemsChecked: items.length, candidates: candidates.length, pass: pass.map(p => p.ticker), accrued: fresh.length })

  return NextResponse.json({
    date: today, itemsChecked: items.length, timingCandidates: candidates.length,
    corePass: pass.map(p => `${p.ticker}${p.prime ? '🏅' : ''}`), accrued: fresh.length, histTotal: hist.length + fresh.length,
  })
}
