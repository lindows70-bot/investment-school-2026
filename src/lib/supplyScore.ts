// 💰 수급 축 점수 SSOT — 통합추천과 종합판정이 **같은 척도**로 수급을 채점한다(제2원칙)
//
// ⚠️ 왜 만들었나(2026-08-09 실측): 어제 축 5개(가치·퀄리티·모멘텀·주도섹터·계절)를 유니버스 SSOT 로
//    통일했는데도 삼성E&A 총점이 통합추천 89 vs 종합판정 85 로 갈렸다. 남은 원인이 **수급 축 하나**였다:
//      통합추천 96 (외인·기관 5일 순매수 + 개인 이탈을 연속 점수로 채점)
//      종합판정 80 (getMoneyFlow 의 4단계 상태를 INFLOW→80 처럼 계단으로 환산)
//    같은 이름의 축이 아예 다른 공식이었다. 축 값은 유니버스에 있어서 통일할 수 있었지만
//    수급은 **유니버스에 없어서**(시장 수급은 종목 스크리닝 산출물이 아니다) 각자 계산하고 있었다.
//
// 해결: 채점 함수를 여기로 옮기고 두 라우트가 **같은 함수**를 호출한다.
//    ⛔ "통합추천과 동일" 이라고 주석으로 약속하지 않는다 — 어제 그 주석이 붙은 채로 값이 갈렸다.
//       같은 함수를 import 해야 실제로 동일해진다.
import { getCache } from '@/lib/appCache'
import { MARKET_FLOW_KR_KEY, type MarketFlowEntry, type MarketFlowKrResult } from '@/lib/marketFlowKr'
import { getMoneyFlow } from '@/lib/moneyFlow'

type Flow = Awaited<ReturnType<typeof getMoneyFlow>>
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const code6 = (t: string) => t.replace(/\D/g, '')

/** 🇰🇷 KR 수급 점수(0~100) — 외인/기관 5일 + 쌍끌이 + 개인 이탈(메이저가 받는 구조).
 *  marketFlowKr POOL(큐레이션 시장 랭킹 ~113종) 엔트리를 쓰는 정규 경로. */
export function krSupply(e: MarketFlowEntry): number {
  let s = 30
  s += Math.min(e.dualStreak * 12, 36)
  s += e.foreign.d5 > 0 ? 15 : e.foreign.d5 < 0 ? -12 : 0
  s += e.organ.d5 > 0 ? 15 : e.organ.d5 < 0 ? -12 : 0
  s += (e.individual?.d1 ?? 0) < 0 ? 12 : 0
  return clamp(s)
}

/** 🇰🇷 KR 수급 폴백 점수(0~100) — POOL 밖 종목을 getMoneyFlow(네이버 실수급)로 채점. krSupply 와 동일 척도.
 *  ⚠️ 쌍끌이 연속일수(dualStreak)는 per-ticker 트렌드엔 없어, 외인·기관 5일 동반 순매수에
 *     고정 보너스(+24 ≈ 2일 쌍끌이)로 근사한다. */
export function krSupplyFromFlow(mf: Flow): number {
  const f5 = mf.foreign?.net5 ?? 0, o5 = mf.organ?.net5 ?? 0, i5 = mf.individual?.net5 ?? 0
  let s = 30
  if (f5 > 0 && o5 > 0) s += 24
  s += f5 > 0 ? 15 : f5 < 0 ? -12 : 0
  s += o5 > 0 ? 15 : o5 < 0 ? -12 : 0
  s += i5 < 0 ? 12 : 0
  return clamp(s)
}

/** 🌍 US(해외) 수급 점수(0~100, **프록시**) — MFI 과매도·상승 + 내부자 + 13F 거인.
 *  ⚠️ 해외는 투자자별 순매수 공시가 없어 대리 지표다. 그래서 6축 가중치에서 해외 수급은 0%다
 *     (axisWeights.W_GLOBAL) — 점수엔 안 들어가고 배지·설명으로만 쓴다. */
export function usSupply(mf: Flow): number {
  let s = 40
  const u = mf.us
  if (u?.mfi != null) {
    if (u.mfi < 30) s += 22
    else if (u.mfi < 50) s += 12
    else if (u.mfi <= 70) s += 4
    else if (u.mfi > 80) s -= 15
    if (u.mfiTrend === 'rising') s += 10
  }
  if (u?.insiderCluster) s += 20
  else if ((u?.insiderBuyers ?? 0) > 0) s += 10
  if (u?.giantTrend === 'add') s += 14
  else if ((u?.giantHolders ?? 0) > 0) s += 6
  return clamp(s)
}

export interface SupplyScore {
  score: number        // 0~100 (미집계는 50 = 중립)
  known: boolean       // 실측 데이터로 채점했는가 — false 면 '수급 미집계'로 표기해야 한다(중립 50을 실측처럼 보이지 않게)
  proxy: boolean       // 🌍 해외 프록시 여부
  flow: Flow | null    // 호출부가 배지·상태(INFLOW 등)에 재사용
}

/** 💰 단건 수급 채점 — 통합추천의 배치 경로와 **같은 우선순위**를 따른다:
 *    🇰🇷 marketFlowKr POOL(최근 5일 캐시 폴백) → 없으면 getMoneyFlow 실수급 폴백
 *    🌍 getMoneyFlow 프록시
 *  ⚠️ 통합추천과 달리 라이브 computeMarketFlowKr 은 부르지 않는다 — 단건 요청이 시장 전체
 *     스크랩을 촉발하면 안 된다(캐시가 비면 조용히 per-ticker 폴백으로 간다). */
export async function getSupplyScoreOne(ticker: string, market: 'KR' | 'US', name: string, base: string): Promise<SupplyScore> {
  const MISS: SupplyScore = { score: 50, known: false, proxy: market !== 'KR', flow: null }
  try {
    if (market === 'KR') {
      // POOL 우선 — 크론이 장마감 후에만 워밍하므로 최근 5일 캐시를 훑는다(통합추천과 동일)
      let mf: MarketFlowKrResult | null = null
      for (let d = 0; d < 5 && !mf; d++) {
        const dt = new Date(Date.now() + 9 * 3600_000 - d * 86_400_000).toISOString().slice(0, 10)
        mf = await getCache<MarketFlowKrResult>(MARKET_FLOW_KR_KEY(dt), 6 * 24 * 3600_000)
      }
      const e = (mf?.entries ?? []).find(x => x.ticker === code6(ticker))
      if (e) return { score: krSupply(e), known: true, proxy: false, flow: null }
      const flow = await getMoneyFlow(ticker, market, name, base).catch(() => null)
      if (!flow || flow.status === 'UNSUPPORTED') return { ...MISS, flow }
      return { score: krSupplyFromFlow(flow), known: true, proxy: false, flow }
    }
    const flow = await getMoneyFlow(ticker, market, name, base).catch(() => null)
    if (!flow || flow.status === 'UNSUPPORTED') return { ...MISS, flow }
    return { score: usSupply(flow), known: true, proxy: true, flow }
  } catch { return MISS }
}
