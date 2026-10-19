// 🇺🇸 ETF 자금 흐름 API — 스냅샷 역산 순유입 + 캔들 SSOT 거래량·등락. 6h 캐시 · refresh=1(크론 10:30 UTC)
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { buildEtfFlow, ETF_FLOW_KEY, type EtfFlow } from '@/lib/etfFlow'
import { fetchUsdKrw } from '@/lib/fx'
import { canForceRefresh } from '@/lib/cronAuth'   // ?refresh=1 은 크론·선생님만(2026-10-05 보안 점검)
import { kstDate } from '@/lib/kst'   // 🕒 한국 달력일 SSOT(2026-10-19 — 파일마다 복제돼 있던 한 줄을 모았다)

export const dynamic = 'force-dynamic'
export const maxDuration = 120


export async function GET(req: Request) {
  const url = new URL(req.url)
  const refresh = (url.searchParams.get('refresh') === '1' && await canForceRefresh(req))
  const key = ETF_FLOW_KEY(kstDate())
  if (!refresh) { const c = await getCache<EtfFlow>(key, 6 * 3600_000); if (c) return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } }) }
  // ⛔ 자기 호출 base 는 NEXT_PUBLIC_APP_URL — 크론은 로그인 보호된 배포 고유 주소로 들어와 url.origin 환율 호출이 로그인 HTML 을 받는다(live=false → 저장 안 함).
  //    2026-10-19 실측: 크론 상태판(etfFlow 모니터 신설)이 잡았다 — app_cache 에 etf-flow-v4 행이 크론 시각엔 열흘간 0건, 사람 방문 시각(일요일 18:38)엔 있음. 다른 fetchUsdKrw 호출자 27곳은 전부 base/selfBase 였고 이 라우트만 origin 이었다
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin
  const { rate: usdKrw, live: fxLive } = await fetchUsdKrw(base)
  const out = await buildEtfFlow(usdKrw)
  // 원화 환산(순유입 ○억원)이 고정 환율이면 박제하지 않는다 — 다음 요청이 실제 환율로 다시 만든다
  const cached = out.items.length >= 30 && fxLive
  if (cached) await setCache(key, out)
  // cached·fxLive 는 이번 응답에만(저장본 out 에는 없음 — 캐시 스키마 불변). 크론 로그에서 '돌았지만 저장 안 함'을 가른다
  return NextResponse.json({ ...out, cached, fxLive }, { headers: { 'Cache-Control': 'no-store' } })
}
