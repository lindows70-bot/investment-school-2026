// 🔮 역-DCF 기대치 투자 — "현재 주가가 정당화되려면 향후 N년 몇 % 성장이 필요한가"를 역산(Mauboussin)
//  기존 PEG·DCF가 '싸다/비싸다'면, 이건 '시장이 가격에 이미 심어둔 성장 기대'를 까발려 반증 가능한 베팅으로.
// Zero Cost: canonicalFundamentals(PE·성장률) 재사용. 종목 신호만(유저데이터 X). 닫힌형 수식(반복 없음).
import { NextResponse } from 'next/server'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// 교육용 가정(투명 공개) — 요구수익률 9%, 고성장 10년, 종착 PER 15배(시장 평균)
const R = 0.09, N = 10, TERM_PE = 15

export type DcfVerdict = 'demanding' | 'fair' | 'conservative' | 'unknown'
export interface ReverseDcfResult {
  ticker: string
  pe: number | null
  impliedGrowth: number | null   // 시장이 가격에 심은 연 EPS 성장 기대(%)
  actualGrowth: number | null    // 실제 최근/예상 성장(%)
  gap: number | null             // implied − actual (%p)
  verdict: DcfVerdict
  headline: string
  detail: string
  assumptions: { r: number; years: number; termPe: number }
  asOf: string
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const ticker = (sp.get('ticker') ?? '').trim()
  const market = (sp.get('market') === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

  const cf = await getCanonicalFundamentals(ticker, market, base).catch(() => null)
  const pe = cf?.pe ?? null
  const actualGrowth = cf?.growth != null ? Math.round(cf.growth * 1000) / 10 : null   // %

  // 닫힌형 역산: P = EPS₀·(1+g)^N·termPE/(1+r)^N  →  g = (PE/termPE · (1+r)^N)^(1/N) − 1
  //  "이 PER을 주고 r 수익을 내려면, 10년 뒤 PER 15배로 수렴한다 가정 시 필요한 연 EPS 성장률"
  let impliedGrowth: number | null = null
  if (pe != null && pe > 0) {
    const g = Math.pow((pe / TERM_PE) * Math.pow(1 + R, N), 1 / N) - 1
    impliedGrowth = Math.round(g * 1000) / 10
  }

  let verdict: DcfVerdict = 'unknown', headline = '', detail = ''
  const gap = impliedGrowth != null && actualGrowth != null ? Math.round((impliedGrowth - actualGrowth) * 10) / 10 : null

  // 가드 — ① 절대 난이도: 연 20%+ EPS 성장 10년 지속은 역사적으로 극소수(기대 자체가 과도)
  //        ② 기저효과: 실제 성장 60%↑는 작년 저점 회복 스파이크라 비교 기준으로 비신뢰(PEG 함정의 일반화)
  const HARD = 20, SPIKE = 60
  const baseEffect = actualGrowth != null && actualGrowth > SPIKE
  const actualReliable = actualGrowth != null && !baseEffect

  if (impliedGrowth == null) {
    headline = 'EPS(이익)가 없어 역-DCF 계산 불가'
    detail = '적자·이익 미상 종목은 PER 기반 역산이 어렵습니다. PSR·매출 성장으로 따로 봐야 합니다.'
  } else if (impliedGrowth > HARD) {
    // 내재 기대가 절대적으로 높음 — 실제가 무엇이든 '10년 지속'이 매우 어려움
    verdict = 'demanding'
    headline = `시장은 향후 10년 연 ${impliedGrowth}% EPS 성장을 가정 — 역사적으로 극소수만 달성`
    detail = baseEffect
      ? `실제 성장(${actualGrowth}%)은 작년 저점 회복 기저효과라 비교 기준으로 못 씁니다. 핵심은 ${impliedGrowth}%를 10년 지속할 수 있느냐인데, 이 수준은 대부분 기업이 못 버팁니다.`
      : `현 주가가 정당화되려면 연 ${impliedGrowth}% 성장이 10년 이어져야 합니다${actualGrowth != null ? `(실제 ${actualGrowth}%)` : ''}. 기대가 식으면 하락 위험이 큽니다.`
  } else if (baseEffect) {
    verdict = 'fair'
    headline = `시장 내재 기대 ${impliedGrowth}% — 실제 ${actualGrowth}%는 기저효과(비교 보류)`
    detail = `실제 성장률이 작년 저점 회복으로 비정상적으로 높아, 내재 기대(${impliedGrowth}%)와의 직접 비교는 무의미합니다. ${impliedGrowth}%가 정상화 이후에도 가능한지로 판단하세요.`
  } else if (actualGrowth == null) {
    verdict = 'unknown'
    headline = `시장은 향후 10년 연 ${impliedGrowth}% EPS 성장을 가정합니다`
    detail = `실제 성장률 데이터가 없어 합리성 판단은 보류합니다. 이 ${impliedGrowth}%가 달성 가능한지 스스로 점검하세요.`
  } else {
    // 실제 성장 신뢰 가능 + 내재 기대 ≤20% — 상대 비교
    const overshoot = impliedGrowth - actualGrowth
    if (actualGrowth <= 0) {
      verdict = impliedGrowth > 5 ? 'demanding' : 'fair'
      headline = `시장은 연 ${impliedGrowth}% 성장을 가정하나, 최근 이익은 ${actualGrowth}%로 역성장`
      detail = `현 주가는 이익 반등을 선반영했습니다. 반등이 ${impliedGrowth}%에 못 미치면 주가 정당성이 약해집니다(경기순환주면 저점 가능성도 함께 보세요).`
    } else if (overshoot > Math.max(actualGrowth * 0.5, 5)) {
      verdict = 'demanding'
      headline = `시장 기대 ${impliedGrowth}% ≫ 실제 ${actualGrowth}% — 기대가 과도(스토리 의존)`
      detail = `현 주가가 정당화되려면 실제(${actualGrowth}%)보다 높은 ${impliedGrowth}% 성장이 10년 지속돼야 합니다. 실제 수준으로 수렴하면 하락 위험.`
    } else if (overshoot < -3) {
      verdict = 'conservative'
      headline = `시장 기대 ${impliedGrowth}% < 실제 ${actualGrowth}% — 기대가 보수적(저평가 여지)`
      detail = `시장은 실제 성장(${actualGrowth}%)보다 낮은 ${impliedGrowth}%만 반영 중입니다. 성장이 유지되면 재평가 여지가 있습니다.`
    } else {
      verdict = 'fair'
      headline = `시장 기대 ${impliedGrowth}% ≈ 실제 ${actualGrowth}% — 합리적 구간`
      detail = `내재 성장 기대(${impliedGrowth}%)가 실제(${actualGrowth}%)와 비슷합니다. 가격이 펀더멘탈에 부합합니다.`
    }
  }

  const result: ReverseDcfResult = {
    ticker: ticker.toUpperCase(), pe, impliedGrowth, actualGrowth, gap, verdict, headline, detail,
    assumptions: { r: R, years: N, termPe: TERM_PE }, asOf: new Date().toISOString(),
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
