// 🌟 단일 종목 투자 프로필 SSOT — 해자·공정가치(스타등급)·상대 PSR을 한 카드로(종목 리서치 상단 캡스톤)
// 신규 계산 0: 전부 기존 엔진 재사용(stock-info·buffettDcf·morningstarRating·getMoatBreach·getSectorPeers·lynch-classify)
// ⚠️ 별점은 포트폴리오 모닝스타와 동일 공식·동일 카테고리(lynch-classify DB우선)를 써야 같은 종목 별점이 화면마다 일치(제2원칙)
import { calcDCF, deriveDcfInputs } from '@/lib/buffettDcf'
import { computeStarRating, type StarResult } from '@/lib/morningstarRating'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { getMoatBreach } from '@/app/actions/getMoatBreach'
import { getSectorPeers } from '@/app/actions/getSectorPeers'

export interface StockProfile extends StarResult {
  ticker: string; name: string; market: 'KR' | 'US'; currency: 'USD' | 'KRW'
  fairValue: number | null
  currentPrice: number | null
  dcfOk: boolean
  peg: number | null            // 린치 PEG(성장 대비 가격) — 별점(절대 공정가치)과의 관점 차이 설명용
  psr: number | null            // 이 종목 P/S
  psrMedian: number | null      // 동종 피어 PSR 중앙값(상대 비교 기준)
  sectorLabel: string | null    // 업종(피어 비교 라벨)
  peerCount: number             // 비교에 쓰인 동종 피어 수
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
const norm = (eg: number | null) => eg == null ? null : (Math.abs(eg) < 5 ? eg : eg / 100)

export async function buildStockProfile(ticker: string, market: 'KR' | 'US', base: string): Promise<StockProfile | null> {
  const mkt = market
  const [si, sp, cls, moat, peers, sm] = await Promise.all([
    fetch(`${base}/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${mkt}`, { signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${base}/api/stock-price?ticker=${encodeURIComponent(ticker)}&market=${mkt}`, { signal: AbortSignal.timeout(20_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${base}/api/lynch-classify?ticker=${encodeURIComponent(ticker)}&market=${mkt}`, { signal: AbortSignal.timeout(15_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    getMoatBreach({ ticker, name: ticker, market: mkt }).catch(() => null),
    getSectorPeers({ ticker, market: mkt }).catch(() => null),
    buildSignalMetrics(ticker, mkt, ticker, base).catch(() => null),   // ⚙️ ROIC(자본배분 판정 — morningstar-rating과 동일 SSOT)
  ])
  if (!si) return null

  const fund = si.fundamentals ?? {}
  const name = si.name ?? ticker
  const currency: 'USD' | 'KRW' = mkt === 'KR' ? 'KRW' : 'USD'
  const currentPrice = num(sp?.currentPrice)
  const category = (cls?.category && cls.category !== 'na') ? String(cls.category) : 'na'

  // 공정가치(DCF) — buffettDcf SSOT(버핏 패널과 동일 계산)
  let fairValue: number | null = null, pFv: number | null = null, dcfOk = false
  if (currentPrice && currentPrice > 0) {
    const inp = deriveDcfInputs(fund, { market: mkt, currency, lynchCategory: category, currentPrice })
    if (inp.ok && inp.fcf0 && inp.shares) {
      const dcf = calcDCF(inp.fcf0, inp.g, inp.r, inp.gp, inp.netDebt, inp.shares, currentPrice)
      if (dcf.intrinsicPerShare > 0) { fairValue = dcf.intrinsicPerShare; pFv = currentPrice / fairValue; dcfOk = true }
    }
  }

  const moatWidth = moat?.moatWidth ?? 'none'
  const moatVerdict = moat?.verdict ?? 'early'
  const opMargin = num(fund.operatingMargins)
  const roe = num(fund.returnOnEquity) ?? (typeof moat?.roe === 'number' ? moat.roe / 100 : null)
  // 🏦 금융주는 예금이 '부채'로 잡혀 순부채 무의미 → null(자본배분 ROE만). 좀비·해자와 동일 가드
  const netDebtPos = moat?.isFinancial ? null : ((fund.totalDebt != null && fund.totalCash != null) ? (fund.totalDebt - fund.totalCash) > 0 : null)
  const peg = num(fund.peg)
  const growth = norm(num(fund.earningsGrowth))

  const star = computeStarRating({ pFv, moatWidth, moatVerdict, opMargin, roe, roic: sm?.roic ?? null, roeInflated: sm?.roeInflated ?? false, netDebtPos, category, growth, peg, isFinancial: !!moat?.isFinancial })

  // 상대 PSR — 섹터피어 X-Ray SSOT(동종 중앙값) 재사용
  const targetPsr = num(fund.psr) ?? (peers?.peers?.find((p: { isTarget: boolean; psr: number | null }) => p.isTarget)?.psr ?? null)
  const psrMedian = num(peers?.psrMedian)
  const sectorLabel = peers?.targetIndustry ?? null
  const peerCount = (peers?.peers?.length ?? 1) - 1

  return {
    ...star, ticker: ticker.toUpperCase(), name, market: mkt, currency,
    fairValue: fairValue != null ? +fairValue.toFixed(2) : null,
    currentPrice, dcfOk, peg: peg != null ? +peg.toFixed(2) : null,
    psr: targetPsr != null ? +targetPsr.toFixed(2) : null,
    psrMedian: psrMedian != null ? +psrMedian.toFixed(2) : null,
    sectorLabel, peerCount: Math.max(0, peerCount),
  }
}
