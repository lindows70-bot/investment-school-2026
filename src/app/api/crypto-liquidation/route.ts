// 💥 비트코인 롱/숏 청산 + 포지션 균형 API (2026-08-21 사용자 요청 — 코인글래스 스크린샷 참고)
//
// ⚠️ Phase 0 실측 판정(2026-08-21) — 무료로 구할 수 있는 것과 없는 것이 명확히 갈렸다:
//   ❌ 코인글래스 청산 이력  : v2·v4 모두 "API key missing"(유료 플랜) → 스크린샷의 90일 차트는 무료 불가
//   ❌ 바이낸스 allForceOrders: 404(공개 종료) · ❌ 바이바이트 청산: 404
//   ❌ 업비트                : 마켓 841종 전부 현물(BTC/KRW/USDT 접두사만) — 파생 심볼 0, 청산 라우트 404
//                             (한국 규제상 코인 파생 부재 — 청산 데이터 원천 자체가 없다)
//   ✅ OKX 청산 주문         : 무인증 200 · posSide 로 롱/숏 구분 · **단 최근 24시간뿐**(before 페이지네이션
//                             12회 시도해도 0.9일에서 멈춤 — 1,878건 전부 같은 창)
//   ✅ 바이낸스 롱숏 계정비율 : 무인증 200 · 30일 상한(limit=90 요청해도 31건)
//   → 결론: "24시간 청산(OKX)" + "30일 롱/숏 균형(바이낸스)" 두 층으로 정직하게 구성한다.
//
// ⚠️ 계약 스케일은 하드코딩하지 않는다 — instruments API 의 ctVal/ctValCcy 를 런타임에 읽어 환산한다
//    (인버스 BTC-USD-SWAP=100 USD/계약 · 리니어 BTC-USDT-SWAP=0.01 BTC/계약. 규약은 바뀔 수 있다).
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

export interface LiqBucket { t: number; hour: string; longUsd: number; shortUsd: number }
export interface LsPoint { d: string; longPct: number; shortPct: number; ratio: number }
export interface CryptoLiqApi {
  /** 최근 24시간 시간대별 청산(OKX BTC 무기한 2종 합산) */
  buckets: LiqBucket[]
  totalLongUsd: number; totalShortUsd: number; count: number
  rangeFrom: string | null; rangeTo: string | null
  /** 30일 롱/숏 계정 비율(바이낸스) — 없으면 null(그 층만 생략) */
  longShort: LsPoint[] | null
  /** 데이터 출처·한계를 화면이 그대로 쓰도록 서버가 문장으로 준다(가짜 정밀 방지) */
  sourceNote: string
  limitNote: string
  asOf: string
}

const j = async (url: string) => {
  const r = await fetch(url, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export async function GET() {
  const key = 'crypto-liq-v1'
  const cached = await getCache<CryptoLiqApi>(key, 15 * 60_000)   // 15분 — 청산은 빠르게 변한다
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ① 계약 스펙(ctVal) — 스케일 하드코딩 금지
  const spec = new Map<string, { ctVal: number; ccy: string }>()
  try {
    const inst = await j('https://www.okx.com/api/v5/public/instruments?instType=SWAP')
    for (const r of inst?.data ?? []) {
      if (/^BTC-(USD|USDT)-SWAP$/.test(r.instId)) spec.set(r.instId, { ctVal: Number(r.ctVal), ccy: String(r.ctValCcy) })
    }
  } catch { /* 스펙 실패 시 아래에서 해당 심볼을 건너뛴다(추정 환산 금지) */ }

  // ② 청산 주문 — 인버스·리니어 둘 다(리니어 쪽이 물량이 훨씬 크다)
  const rows: { ts: number; usd: number; long: boolean }[] = []
  await Promise.all(['BTC-USD', 'BTC-USDT'].map(async uly => {
    try {
      const d = await j(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled&limit=100`)
      const blk = d?.data?.[0]
      const sp = spec.get(String(blk?.instId ?? ''))
      if (!blk || !sp || !(sp.ctVal > 0)) return   // 스펙을 모르면 환산하지 않는다(틀린 금액 > 없는 금액)
      for (const x of blk.details ?? []) {
        const sz = Number(x.sz), px = Number(x.bkPx), ts = Number(x.ts)
        if (!(sz > 0) || !isFinite(ts)) continue
        // 인버스(ctValCcy=USD): 계약수 × ctVal(USD) / 리니어(ctValCcy=BTC): 계약수 × ctVal(BTC) × 청산가
        const usd = sp.ccy === 'USD' ? sz * sp.ctVal : sz * sp.ctVal * px
        if (!(usd > 0)) continue
        rows.push({ ts, usd, long: x.posSide === 'long' })
      }
    } catch { /* 한쪽 실패해도 나머지로 표시 */ }
  }))

  // ③ 시간대별 버킷(1시간) — 스크린샷의 막대차트 구조
  const byHour = new Map<number, { l: number; s: number }>()
  for (const r of rows) {
    const h = Math.floor(r.ts / 3600_000) * 3600_000
    const cur = byHour.get(h) ?? { l: 0, s: 0 }
    if (r.long) cur.l += r.usd; else cur.s += r.usd
    byHour.set(h, cur)
  }
  const buckets: LiqBucket[] = Array.from(byHour.entries()).sort((a, b) => a[0] - b[0]).map(([t, v]) => ({
    t, hour: new Date(t + 9 * 3600_000).toISOString().slice(11, 13) + '시',   // KST 표기
    longUsd: Math.round(v.l), shortUsd: Math.round(v.s),
  }))
  const ts = rows.map(r => r.ts).sort((a, b) => a - b)
  const kst = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ')

  // ④ 30일 롱/숏 계정 비율(바이낸스) — 실패하면 그 층만 생략(fail-open)
  let longShort: LsPoint[] | null = null
  try {
    const ls = await j('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1d&limit=30')
    if (Array.isArray(ls) && ls.length) {
      longShort = ls.map((x: { timestamp: number; longAccount: string; shortAccount: string; longShortRatio: string }) => ({
        d: new Date(Number(x.timestamp) + 9 * 3600_000).toISOString().slice(5, 10),
        longPct: Math.round(Number(x.longAccount) * 1000) / 10,
        shortPct: Math.round(Number(x.shortAccount) * 1000) / 10,
        ratio: Math.round(Number(x.longShortRatio) * 100) / 100,
      })).filter(p => isFinite(p.longPct) && p.longPct > 0)
    }
  } catch { /* 지역 차단·장애 시 청산 층만 표시 */ }

  const out: CryptoLiqApi = {
    buckets,
    totalLongUsd: Math.round(rows.filter(r => r.long).reduce((s, r) => s + r.usd, 0)),
    totalShortUsd: Math.round(rows.filter(r => !r.long).reduce((s, r) => s + r.usd, 0)),
    count: rows.length,
    rangeFrom: ts.length ? kst(ts[0]) : null,
    rangeTo: ts.length ? kst(ts[ts.length - 1]) : null,
    longShort,
    sourceNote: 'OKX 무기한(BTC-USD·BTC-USDT) 실제 청산 체결 + 바이낸스 롱/숏 계정 비율',
    limitNote: '전 거래소 합산이 아니라 OKX 한 곳 기준이라 코인글래스 총액보다 작습니다 · 청산 이력은 무료로 최근 24시간까지만 조회됩니다(90일 이력은 유료 전용) · 업비트는 현물만 있어 청산 데이터가 없습니다',
    asOf: new Date().toISOString(),
  }
  if (rows.length > 0) await setCache(key, out)   // 빈 결과 박제 금지
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
