// 🎯 종목 리서치 종합 매수 판정 — 통합추천의 6축(가치·퀄리티·모멘텀·주도섹터·수급·계절) + 리스크 플래그를 한 종목에 합성
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
import { getEntryTiming, type EntryTiming } from '@/lib/entryTiming'
import type { RotationResult, Quadrant as RotQuad } from '@/app/api/sector-rotation/route'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface ResearchVerdict {
  ticker: string; name: string; market: 'KR' | 'US'
  verdict: 'buy' | 'caution' | 'avoid'   // ✅매수 적합 / ⚖️조건부·신중 / ⛔부적합
  score: number                          // 종합 매수 적합도 0~100
  sector: string | null; rotationQuad: RotQuad | null   // GICS 섹터(영문) + 로테이션 국면 — 리서치 리포트 재사용(제2원칙)
  axes: { season: number; value: number; quality: number; momentum: number; rotation: number; supply: number }
  seasonLabel: string; seasonFit: 'favored' | 'neutral' | 'unfavored'
  fwdEpsDir: 'accel' | 'flat' | 'decline' | 'unknown'
  priceTrend: 'up' | 'side' | 'down' | 'unknown'
  peg: number | null; pegSuspect: boolean; dcfVerdict: string | null; flowStatus: string | null
  roic: number | null; roe: number | null; roeInflated: boolean   // ⚙️ 자본효율(ROIC=투하자본이익률) + ROE 부풀림 경고
  knife: boolean; zombie: boolean; hype: boolean; inventoryBuildup: boolean; invGapPct: number | null
  choppy: boolean; adx: number | null   // ⬛ 관망(횡보·ADX<20, 구조 미확립 시) — 가짜 돌파 잦은 구간
  timing: EntryTiming | null             // 🚦 타점 신호등+🎼라쉬케+📊매물·평단(AI 리밸런싱과 동일 SSOT) — 기술 타이밍 표시
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
  const cacheKey = `research-verdict-v9:${ticker.toUpperCase()}:${market}:${kstDate()}`   // v9: sector·rotationQuad 노출(리서치 리포트 재사용) / v8: 6축
  const cached = await getCache<ResearchVerdict>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ── 전 신호 동시 발사(async-api-routes: start early, await late) — 보조 신호·로테이션 캐시는 m과 무관하므로
  //    buildSignalMetrics(콜드 2~5s)를 기다리지 않고 같이 출발 → 콜드 응답시간 = max(신호들)로 단축(합이 아님)
  const mP = buildSignalMetrics(ticker, market, name, base)
  const signalsP = Promise.all([
    getCurrentSeason(base).catch(() => null),
    fetch(`${base}/api/reverse-dcf?ticker=${encodeURIComponent(ticker)}&market=${market}`, { signal: AbortSignal.timeout(10_000) })
      .then(r => r.ok ? r.json() : null).then(j => j?.verdict ?? null).catch(() => null),
    getMoneyFlow(ticker, market, name, base).then(f => f?.status ?? null).catch(() => null),
    getEntryTiming(ticker, market).catch(() => null),
  ])
  // 주도섹터 로테이션 캐시 — 최근 3일치를 병렬로 읽고 최신 우선 채택(기존 순차 루프와 동일 결과)
  const rotP = (async (): Promise<Map<string, { q: RotQuad; score: number }> | null> => {
    const dates = [0, 1, 2].map(dd => new Date(Date.now() + 9 * 3600_000 - dd * 86_400_000).toISOString().slice(0, 10))
    const rots = await Promise.all(dates.map(dt => getCache<RotationResult>(`sector-rotation-v11:${dt}`, 3 * 24 * 3600_000).catch(() => null)))
    const rot = rots.find(r => r?.items?.length)
    return rot?.items?.length ? new Map(rot.items.map(i => [i.key, { q: i.quadrant, score: i.score }])) : null
  })()

  const m = await mP
  if (!m) return NextResponse.json({ unsupported: true, reason: '재무 데이터를 가져오지 못했습니다.' }, { headers: { 'Cache-Control': 'no-store' } })
  const [season, dcf, flow, timing] = await signalsP
  // ⬛ 관망(횡보) — ADX<20 추세 없음 + 신호등 미확립(green=구조적 상승은 제외, 자기모순 차단). 영상 '회색 지대'
  const choppy = !!(timing?.supply?.choppy && timing.light !== 'green')
  const adx = timing?.supply?.adx ?? null

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

  // ⑤ 퀄리티 — 영업이익률 + 자본효율(ROIC 우선·빚 반영, roeInflated 상쇄) + 이익질(FCF). 추가 fetch 0(SignalMetrics 재사용)
  const marginScore = m.opMargin == null ? 0.4 : m.opMargin >= 25 ? 1.0 : m.opMargin >= 15 ? 0.8 : m.opMargin >= 8 ? 0.6 : m.opMargin >= 0 ? 0.35 : 0.1
  const eff = m.roic ?? m.roe
  let effScore = eff == null ? 0.4 : eff >= 20 ? 1.0 : eff >= 15 ? 0.8 : eff >= 10 ? 0.6 : eff >= 5 ? 0.35 : eff > 0 ? 0.2 : 0
  if (m.roeInflated) effScore = Math.min(effScore, 0.4)   // 빚으로 부풀린 ROE 상쇄(진짜 자본효율만)
  const cashScore = m.fcf == null ? 0.5 : m.fcfNegative ? 0.3 : 1.0
  const quality = clamp((marginScore * 0.40 + effScore * 0.40 + cashScore * 0.20) * 100)

  // ⑥ 주도섹터 — 섹터 로테이션 RRG 쏠림(unified-reco와 동일 SSOT·캐시 읽기만). 콜드/미매핑이면 중립 50
  //    (조회는 위 rotP에서 이미 병렬 발사 — 여기선 결과만 수거)
  const rotBySector = await rotP
  const SECTOR_TO_ROT: Record<string, string> = {
    'Technology': 'infotech', 'Financial Services': 'financials', 'Healthcare': 'healthcare',
    'Consumer Cyclical': 'discretionary', 'Consumer Defensive': 'staples', 'Energy': 'energy',
    'Industrials': 'industrials', 'Basic Materials': 'materials', 'Communication Services': 'communication',
    'Utilities': 'utilities', 'Real Estate': 'realestate',
  }
  const rotEntry = m.sector && rotBySector ? (rotBySector.get(SECTOR_TO_ROT[m.sector] ?? '') ?? null) : null
  const rotation = rotEntry ? clamp((rotEntry.score + 12) / 24 * 100) : 50
  const rotQuad: RotQuad | null = rotEntry?.q ?? null

  // 리스크 플래그
  const zombie = m.interestCoverage != null && m.interestCoverage < 1.5
  const hype = m.opMargin != null && m.opMargin < 0

  // 종합 점수(6축 가중 = 통합추천과 동일: 가치25·퀄리티20·모멘텀20·주도섹터10·수급10·계절15) − 리스크 감점
  let score = value * 0.25 + quality * 0.20 + momentum * 0.20 + rotation * 0.10 + supply * 0.10 + seasonScore * 0.15
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
  // ⚠️ 미국은 외국인/기관/개인 일별 구분이 없음(한국거래소만 공시) → US는 '기관·내부자', KR만 '외인·기관'
  if (flow === 'INFLOW') pros.push(market === 'KR' ? '💰 스마트머니 유입(외인·기관 매집)' : '💰 스마트머니 유입(기관·내부자 매집)')
  else if (flow === 'CROWDED') cons.push(market === 'KR' ? '💰 수급 과열·이탈(외인·기관 매도, 매물 부담)' : '💰 수급 과열(기관 순감소·MFI 과매수, 매물 부담)')
  if (m.fwdEpsDir === 'accel') pros.push('📈 이익 가속(Fwd EPS 상향 — 상승 사이클)')
  else if (m.fwdEpsDir === 'decline') cons.push('📉 이익 역성장(Fwd EPS 하향 — 하강 사이클)')
  if (m.priceTrend === 'up') pros.push('🚀 주가 상승추세(50·200일선 정배열)')
  else if (m.priceTrend === 'down') cons.push('🔻 주가 하락추세(50·200일선 이탈)')
  if (m.knife) cons.push('🔪 떨어지는 칼날(급락 추세) — 추격 금물')
  if (m.inventoryBuildup) cons.push(`📦 재고 적체(재고가 매출보다 ${m.invGapPct}%p 빠름 — 경기순환 수요 둔화 선행)`)
  if (zombie) cons.push(`🧟 좀비 위험(이자보상배율 ${m.interestCoverage?.toFixed(1)}<1.5)`)
  if (hype) cons.push(`💭 영업적자(이익 실체 없음 — 내러티브 의존)`)
  // ⚙️ 자본효율 — ROIC(투하자본이익률) 우선(빚까지 반영한 진짜 효율). 없으면 ROE 폴백
  if (m.roic != null && m.roic >= 15) pros.push(`⚙️ 고ROIC ${Math.round(m.roic)}%(투하자본 효율 우수 — 복리 기계)`)
  else if (m.roic == null && m.roe != null && m.roe >= 20) pros.push(`🏰 고ROE ${Math.round(m.roe)}%(버핏 퀄리티)`)
  if (m.roeInflated) cons.push(`⚙️ ROE ${Math.round(m.roe ?? 0)}%는 부채로 부풀린 효율(진짜 ROIC ${Math.round(m.roic ?? 0)}% — 자기자본만의 착시)`)
  // 🧭 주도섹터 — 지금 돈이 도는 섹터인가(RRG 국면)
  if (rotQuad === 'leading') pros.push('🧭 주도 섹터(지금 돈이 도는 섹터·자금 유입)')
  else if (rotQuad === 'improving') pros.push('🧭 태동 섹터(자금 회전 초입)')
  else if (rotQuad === 'weakening') cons.push('🧭 과열 섹터(모멘텀 둔화 — 추격 주의)')
  else if (rotQuad === 'lagging') cons.push('🧭 이탈 섹터(자금 유출 국면)')
  // (관망/ADX·신호등·라쉬케·매물평단은 아래 🚦 기술 타이밍 배지로 표시 — 근거 중복 방지)

  const oneLiner =
    verdict === 'avoid' ? `${m.knife ? '추세가 무너진' : '재무가 취약한'} 구간 — 지금은 매수보다 ${m.knife ? '바닥 확인' : '리스크 점검'}이 먼저.`
    : verdict === 'buy' ? (choppy
        ? `펀더멘탈(가치·퀄리티·모멘텀·주도섹터·수급·계절 6축)은 매수 적합이나, 추세 강도가 약함(ADX ${adx}) — 돌파 신호도 가짜일 수 있어 방향 확정 후 진입 권장(WHAT은 좋음, WHEN은 확인).`
        : `6축(가치·퀄리티·모멘텀·주도섹터·수급·계절)이 받쳐주고 결격 리스크가 없는 매수 적합 구간.`)
    : `장점과 주의가 공존 — 아래 찬성/주의 근거를 보고 분할·관망으로 신중 접근.`

  const result: ResearchVerdict = {
    ticker, name, market, verdict, score,
    sector: m.sector ?? null, rotationQuad: rotQuad,
    axes: { season: seasonScore, value, quality, momentum, rotation, supply },
    seasonLabel, seasonFit, fwdEpsDir: m.fwdEpsDir, priceTrend: m.priceTrend,
    peg: m.peg, pegSuspect, dcfVerdict: dcf, flowStatus: flow,
    roic: m.roic, roe: m.roe, roeInflated: m.roeInflated,
    knife: m.knife, zombie, hype, inventoryBuildup: m.inventoryBuildup, invGapPct: m.invGapPct,
    choppy, adx, timing: timing ?? null,
    pros, cons, oneLiner, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
