// 🎯 종목 리서치 종합 매수 판정 — AI 리밸런싱의 4축(계절·가치·수급·모멘텀) + 리스크 플래그를 한 종목에 합성
//    "이 종목 매수해도 되나?"를 매수/신중/부적합으로 판별. 전부 기존 SSOT 엔진 재사용(제2원칙)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { classifyLynchMece } from '@/lib/lynchAnalysis'
import { getCurrentSeason } from '@/lib/currentSeason'
import { holdingFit, SEASON_META, type Quadrant, type Holding } from '@/lib/seasonNavigator'
import { getMoneyFlow } from '@/lib/moneyFlow'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface ResearchVerdict {
  ticker: string; name: string; market: 'KR' | 'US'
  verdict: 'buy' | 'caution' | 'avoid'   // ✅매수 적합 / ⚖️조건부·신중 / ⛔부적합
  score: number                          // 종합 매수 적합도 0~100
  axes: { season: number; value: number; supply: number; momentum: number }
  seasonLabel: string; seasonFit: 'favored' | 'neutral' | 'unfavored'
  fwdEpsDir: 'accel' | 'flat' | 'decline' | 'unknown'
  priceTrend: 'up' | 'side' | 'down' | 'unknown'
  peg: number | null; pegSuspect: boolean; dcfVerdict: string | null; flowStatus: string | null
  knife: boolean; zombie: boolean; hype: boolean; inventoryBuildup: boolean; invGapPct: number | null
  pros: string[]; cons: string[]
  oneLiner: string
  asOf: string
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ticker = (url.searchParams.get('ticker') || '').trim()
  const market = (url.searchParams.get('market') === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
  const name = url.searchParams.get('name') || ticker
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  if (getAssetType(ticker, name, market) !== 'STOCK')
    return NextResponse.json({ unsupported: true, reason: '개별 주식 전용 판정입니다(ETF·코인·원자재 제외).' }, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin
  const cacheKey = `research-verdict-v2:${ticker.toUpperCase()}:${market}:${kstDate()}`
  const cached = await getCache<ResearchVerdict>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const m = await buildSignalMetrics(ticker, market, name, base)
  if (!m) return NextResponse.json({ unsupported: true, reason: '재무 데이터를 가져오지 못했습니다.' }, { headers: { 'Cache-Control': 'no-store' } })

  // ── 병렬 보조 신호: 계절 · 역-DCF · 수급 ──
  const [season, dcf, flow] = await Promise.all([
    getCurrentSeason(base).catch(() => null),
    fetch(`${base}/api/reverse-dcf?ticker=${encodeURIComponent(ticker)}&market=${market}`, { signal: AbortSignal.timeout(10_000) })
      .then(r => r.ok ? r.json() : null).then(j => j?.verdict ?? null).catch(() => null),
    getMoneyFlow(ticker, market, name, base).then(f => f?.status ?? null).catch(() => null),
  ])

  const lynchCategory = classifyLynchMece(null, m.earningsGrowth, m.sector).cat
  const lc = lynchCategory === 'na' ? null : lynchCategory

  // ① 계절 적합 — 현재 매크로 국면에 이 종목이 유리/불리한가
  const quad: Quadrant = season ? (market === 'KR' ? season.krQuad : season.usQuad) : 'shoulder'
  const h: Holding = { ticker: '', weight: 0, lynchCategory: (lc as Holding['lynchCategory']) ?? null, sector: m.sector ?? undefined }
  const fit = season ? holdingFit(h, quad) : 0.5
  const seasonScore = clamp(fit * 100)
  const seasonFit: ResearchVerdict['seasonFit'] = fit >= 0.75 ? 'favored' : fit <= 0.5 ? 'unfavored' : 'neutral'
  const seasonLabel = season ? SEASON_META[quad].label : '국면 분석 보류'

  // ② 가치 — PEG(기저효과 가드) + 역-DCF 보정
  const pegSuspect = isPegBaseEffect(m.peg, m.earningsGrowth)
  let value = 50
  if (pegSuspect) value = 50   // 착시 저PEG는 중립(저평가 근거로 못 씀)
  else if (m.peg != null && m.peg > 0) value = m.peg <= 0.8 ? 90 : m.peg <= 1.2 ? 75 : m.peg <= 2.2 ? 55 : 30
  if (dcf === 'demanding') value -= 15          // 역-DCF 기대 과도
  else if (dcf === 'conservative') value += 10  // 시장 기대 보수적(저평가 여지)
  value = clamp(value)

  // ③ 수급 — 스마트머니
  const supply = flow === 'INFLOW' ? 80 : flow === 'NEGLECTED' ? 58 : flow === 'NEUTRAL' ? 55 : flow === 'CROWDED' ? 32 : 50

  // ④ 모멘텀 — Fwd EPS 방향 + 주가추세(SSOT)
  const momentum = m.momentumScore

  // 리스크 플래그
  const zombie = m.interestCoverage != null && m.interestCoverage < 1.5
  const hype = m.opMargin != null && m.opMargin < 0

  // 종합 점수(4축 가중 = 통합추천과 동일 철학) − 리스크 감점
  let score = seasonScore * 0.20 + value * 0.30 + supply * 0.20 + momentum * 0.30
  if (m.knife) score -= 20
  if (zombie) score -= 20
  if (m.inventoryBuildup) score -= 10
  if (hype) score -= 8
  score = clamp(score)

  // 판정 — 명백한 부적합(칼날·좀비) 우선, 그 외 점수·리스크 종합
  let verdict: ResearchVerdict['verdict']
  if (m.knife || zombie) verdict = 'avoid'
  else if (score >= 65 && m.fwdEpsDir !== 'decline' && !(dcf === 'demanding' && m.priceTrend !== 'up') && !m.inventoryBuildup && !hype) verdict = 'buy'
  else verdict = 'caution'

  // 근거(찬성/주의) 조립
  const pros: string[] = []
  const cons: string[] = []
  if (seasonFit === 'favored') pros.push(`🌦️ 현재 ${seasonLabel} 국면 우대 업종(계절 적합)`)
  else if (seasonFit === 'unfavored') cons.push(`🌦️ 현재 ${seasonLabel} 국면 비우대(계절 역풍)`)
  if (!pegSuspect && m.peg != null && m.peg > 0 && m.peg <= 0.8) pros.push(`💎 저PEG ${m.peg.toFixed(2)}(성장 대비 저평가)`)
  if (pegSuspect) cons.push(`⚠️ 저PEG ${m.peg?.toFixed(2)}는 기저효과 착시(저평가 근거 불가)`)
  if (m.peg != null && m.peg > 2.2) cons.push(`💲 고PEG ${m.peg.toFixed(2)}(성장 대비 고평가)`)
  if (dcf === 'conservative') pros.push('🔮 역-DCF: 시장 기대 보수적(저평가 여지)')
  else if (dcf === 'demanding') cons.push('🔮 역-DCF: 기대 과도(주가가 높은 성장 선반영)')
  if (flow === 'INFLOW') pros.push('💰 스마트머니 유입(외인·기관 매집)')
  else if (flow === 'CROWDED') cons.push('💰 수급 과열·이탈(매물 부담)')
  if (m.fwdEpsDir === 'accel') pros.push('📈 이익 가속(Fwd EPS 상향 — 상승 사이클)')
  else if (m.fwdEpsDir === 'decline') cons.push('📉 이익 역성장(Fwd EPS 하향 — 하강 사이클)')
  if (m.priceTrend === 'up') pros.push('🚀 주가 상승추세(50·200일선 정배열)')
  else if (m.priceTrend === 'down') cons.push('🔻 주가 하락추세(50·200일선 이탈)')
  if (m.knife) cons.push('🔪 떨어지는 칼날(급락 추세) — 추격 금물')
  if (m.inventoryBuildup) cons.push(`📦 재고 적체(재고가 매출보다 ${m.invGapPct}%p 빠름 — 경기순환 수요 둔화 선행)`)
  if (zombie) cons.push(`🧟 좀비 위험(이자보상배율 ${m.interestCoverage?.toFixed(1)}<1.5)`)
  if (hype) cons.push(`💭 영업적자(이익 실체 없음 — 내러티브 의존)`)
  if (m.roe != null && m.roe >= 20) pros.push(`🏰 고ROE ${Math.round(m.roe)}%(버핏 퀄리티)`)

  const oneLiner =
    verdict === 'avoid' ? `${m.knife ? '추세가 무너진' : '재무가 취약한'} 구간 — 지금은 매수보다 ${m.knife ? '바닥 확인' : '리스크 점검'}이 먼저.`
    : verdict === 'buy' ? `4축(계절·가치·수급·모멘텀)이 받쳐주고 결격 리스크가 없는 매수 적합 구간.`
    : `장점과 주의가 공존 — 아래 찬성/주의 근거를 보고 분할·관망으로 신중 접근.`

  const result: ResearchVerdict = {
    ticker, name, market, verdict, score,
    axes: { season: seasonScore, value, supply, momentum },
    seasonLabel, seasonFit, fwdEpsDir: m.fwdEpsDir, priceTrend: m.priceTrend,
    peg: m.peg, pegSuspect, dcfVerdict: dcf, flowStatus: flow,
    knife: m.knife, zombie, hype, inventoryBuildup: m.inventoryBuildup, invGapPct: m.invGapPct,
    pros, cons, oneLiner, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
