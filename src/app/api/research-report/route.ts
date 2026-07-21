// 📄 종목 리서치 리포트 API — Anthropic 금융 에이전트式. 앱의 모든 SSOT를 동원한 풀 리포트.
//    섹터·경쟁사 대시보드 + 밸류에이션 + 1년 주가 + 어닝 + 향후 전망 + 액션. ⛔ 점수·판정은 SSOT 그대로(합성·표현 레이어).
import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { getEarningsInsight } from '@/app/actions/getEarningsInsight'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { getSectorPeers } from '@/app/actions/getSectorPeers'
import { getCanonicalFundamentals } from '@/lib/canonicalFundamentals'
import { getTechCandles } from '@/lib/techChartData'
import { callGeminiJSON } from '@/lib/gemini'
import type { ResearchVerdict } from '@/app/api/research-verdict/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const SECTOR_KO: Record<string, string> = {
  'Technology': '기술', 'Financial Services': '금융', 'Healthcare': '헬스케어', 'Consumer Cyclical': '자유소비재',
  'Consumer Defensive': '필수소비재', 'Energy': '에너지', 'Industrials': '산업재', 'Basic Materials': '소재',
  'Communication Services': '커뮤니케이션', 'Utilities': '유틸리티', 'Real Estate': '부동산',
}
const ROT_LABEL: Record<string, string> = {
  leading: '🌱 주도(자금 유입)', improving: '❄️ 태동(회전 초입)', weakening: '🔥 과열(모멘텀 둔화)', lagging: '🍂 이탈(자금 유출)',
}

export interface ReportPeer { ticker: string; name: string; peg: number | null; opMargin: number | null; mcapUsd: number | null; psr: number | null; isTarget: boolean }
export interface ResearchReport {
  ticker: string; name: string; market: string; sector: string | null; sectorKo: string; generatedAt: string
  summary: string; outlook: string
  sectorSec: { phaseLabel: string; seasonFit: string; narrative: string }
  peers: ReportPeer[]; peersComment: string
  valuation: { peg: number | null; pe: number | null; psr: number | null; roic: number | null; roe: number | null; dcfVerdict: string | null }
  earnings: { growthStory: string; managementTone: string; guidance: string; sentiment: number; status: string; revision: string }
  chart: { points: { d: string; c: number }[]; pct1y: number | null; pos52: number | null; low52: number | null; high52: number | null }
  action: { verdict: 'buy' | 'caution' | 'avoid'; score: number; oneLiner: string; pros: string[]; cons: string[]; timingLabel: string | null; flags: string[] }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || '').trim()
  const market = (searchParams.get('market') || 'US').toUpperCase()
  const mkt: 'KR' | 'US' = market === 'KR' ? 'KR' : 'US'
  const name = (searchParams.get('name') || ticker).trim()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  if (getAssetType(ticker, name, market) !== 'STOCK')
    return NextResponse.json({ unsupported: true, reason: '개별 주식 전용 리포트입니다(ETF·코인·원자재 제외).' }, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cacheKey = `research-report-v3:${ticker.toUpperCase()}:${market}:${kstDate()}`
  const cached = await getCache<ResearchReport>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 병렬 — 전부 기존 SSOT (섹터·로테이션·계절·밸류·타점=research-verdict / 경쟁사=피어 / 주가=캔들 / 어닝=Jarvis)
  const [vfRaw, earn, analyst, peersRes, candles, cf] = await Promise.all([
    fetch(`${base}/api/research-verdict?ticker=${encodeURIComponent(ticker)}&market=${market}`).then(r => r.json()).catch(() => null),
    getEarningsInsight({ ticker, name, market }).catch(() => null),
    getAnalystSignal({ ticker, name, market }).catch(() => null),
    getSectorPeers({ ticker, name, market }).catch(() => null),
    getTechCandles(ticker, mkt, 'W').catch(() => [] as { date: string; close: number }[]),
    getCanonicalFundamentals(ticker, market, base).catch(() => null),
  ])
  if (!vfRaw || vfRaw.unsupported || vfRaw.error)
    return NextResponse.json({ unsupported: true, reason: '판정 데이터를 가져오지 못했습니다(재무 데이터 부족).' }, { headers: { 'Cache-Control': 'no-store' } })
  const verdict = vfRaw as ResearchVerdict

  const sector = verdict.sector
  const sectorKo = sector ? (SECTOR_KO[sector] ?? sector) : '—'
  const phase = verdict.rotationQuad
  const phaseLabel = phase ? (ROT_LABEL[phase] ?? '미집계') : '미집계'
  const seasonFit = verdict.seasonFit === 'favored' ? '유리' : verdict.seasonFit === 'unfavored' ? '불리' : '중립'
  const revision = analyst
    ? (analyst.verdict === 'signal' ? '📈 추정 상향(팔로우)' : analyst.verdict === 'trap' ? '⚠️ 함정(하향인데 낙관)' : analyst.verdict === 'noise' ? '🔇 목표가 소진' : '〰️ 중립')
    : '데이터 없음'
  const verdictKo = verdict.verdict === 'buy' ? '매수 적합' : verdict.verdict === 'caution' ? '신중(조건부)' : '부적합'

  // 경쟁사 — 대상 포함 상위 6 (가성비순)
  const peers: ReportPeer[] = (peersRes?.peers ?? []).slice(0, 6).map(p => ({ ticker: p.ticker, name: p.name, peg: p.peg, opMargin: p.opMargin, mcapUsd: p.mcapUsd, psr: p.psr, isTarget: p.isTarget }))
  const peersComment = peersRes?.lynchComment || (peers.length ? '동종업계 상대 밸류 비교(PEG·영업이익률·체급).' : '동종업계 데이터가 제한적입니다.')

  // 1년 주가(주봉 ~54개) → 라인차트 포인트 + 52주 위치
  const wk = (candles ?? []).slice(-54)
  const closes = wk.map(c => c.close).filter(x => typeof x === 'number' && x > 0)
  const pct1y = closes.length >= 2 ? r1((closes[closes.length - 1] / closes[0] - 1) * 100) : null
  const low52 = closes.length ? Math.min(...closes) : null
  const high52 = closes.length ? Math.max(...closes) : null
  const pos52 = low52 != null && high52 != null && high52 > low52 ? Math.round((closes[closes.length - 1] - low52) / (high52 - low52) * 100) : null

  // 리스크 플래그(research-verdict)
  const flags: string[] = []
  if (verdict.knife) flags.push('🔪 떨어지는 칼날(급락+하락추세)')
  if (verdict.zombie) flags.push('🧟 좀비(이자보상<1.5)')
  if (verdict.hype) flags.push('💭 하이프(영업적자·스토리 프리미엄)')
  if (verdict.inventoryBuildup) flags.push('📦 재고 적체(사이클 고점 선행)')
  if (verdict.roeInflated) flags.push('⚙️ ROE 부풀림(부채발 가짜 효율)')
  if (verdict.pegSuspect) flags.push('⚠️ 저PEG 기저효과 의심')

  // Gemini — 총평 + 섹터 서술 + 향후 전망(현재 상황·체크포인트). 넘겨준 데이터만 근거(환각 가드)
  const rotPart = phase ? `로테이션 ${phaseLabel}` : '로테이션 국면 미집계'
  const peerLine = peers.filter(p => !p.isTarget).slice(0, 3).map(p => `${p.name}(PEG ${p.peg ?? '—'}·영업익 ${p.opMargin ?? '—'}%)`).join(', ') || '제한적'
  const prompt =
    `너는 학생용 투자 교육 앱의 애널리스트다. 아래 [데이터]만 근거로 ${name}(${ticker}) 리서치 리포트의 세 필드를 한국어로 써라.\n` +
    `① summary: 총평 2~3문장. ② sectorNarrative: 섹터 상황 1~2문장. ③ outlook: '현재 상황과 향후 전망' 3~4문장(무엇을 지켜봐야 하는지 체크포인트 포함).\n` +
    `⛔ 데이터 밖 수치·사실·뉴스 창작 절대 금지. 로테이션이 '미집계'면 자금 유입/이탈 국면을 지어내지 말 것. 투자 단정 대신 '적합/신중/부적합'과 근거·리스크만. 종결어미는 마침표.\n` +
    `[데이터] 종합판정=${verdictKo}(${verdict.score}점) · 한줄="${verdict.oneLiner}" · 섹터=${sectorKo}(${rotPart}) · 계절적합=${seasonFit} · ` +
    `밸류: PEG=${verdict.peg ?? '—'} PER=${cf?.pe ?? '—'} PSR=${cf?.psr ?? '—'} ROIC=${verdict.roic ?? '—'}% · ` +
    `1년 주가 ${pct1y ?? '—'}%(52주 위치 ${pos52 ?? '—'}%) · 어닝 낙관도=${earn?.sentimentScore ?? '—'}/100 · EPS 리비전=${revision} · ` +
    `경쟁사=${peerLine} · 리스크 플래그=${flags.join('/') || '없음'} · 강점=${verdict.pros.slice(0, 3).join('/') || '—'} · 주의=${verdict.cons.slice(0, 3).join('/') || '—'}.`
  const g = await callGeminiJSON<{ summary: string; sectorNarrative: string; outlook: string }>(
    prompt,
    { type: 'OBJECT', properties: { summary: { type: 'STRING' }, sectorNarrative: { type: 'STRING' }, outlook: { type: 'STRING' } }, required: ['summary', 'sectorNarrative', 'outlook'] },
    { temperature: 0.4 },
  )
  const summary = g.ok ? g.data.summary : `${name}은(는) 종합 ${verdictKo}(${verdict.score}점) — ${verdict.oneLiner}`
  const sectorNarrative = g.ok ? g.data.sectorNarrative : (phase ? `${sectorKo} 섹터는 현재 ${phaseLabel} 국면이며, 계절 적합도는 ${seasonFit}입니다.` : `${sectorKo} 섹터 · 로테이션 국면 미집계 · 계절 적합 ${seasonFit}.`)
  const outlook = g.ok ? g.data.outlook : `종합 판정 ${verdictKo}(${verdict.score}점). ${flags.length ? '리스크: ' + flags.join(', ') + '. ' : ''}향후 실적·밸류 흐름과 타점을 함께 지켜보세요.`

  const report: ResearchReport = {
    ticker: ticker.toUpperCase(), name, market, sector, sectorKo, generatedAt: new Date().toISOString(),
    summary, outlook,
    sectorSec: { phaseLabel, seasonFit, narrative: sectorNarrative },
    peers, peersComment,
    valuation: { peg: verdict.peg, pe: cf?.pe ?? null, psr: cf?.psr ?? null, roic: verdict.roic, roe: verdict.roe, dcfVerdict: verdict.dcfVerdict },
    earnings: {
      growthStory: earn?.growthStory ?? '', managementTone: earn?.managementTone ?? '', guidance: earn?.guidance ?? '',
      sentiment: earn?.sentimentScore ?? 0, status: earn?.status ?? 'no_data', revision,
    },
    chart: { points: wk.map(c => ({ d: c.date, c: c.close })), pct1y, pos52, low52, high52 },
    action: { verdict: verdict.verdict, score: verdict.score, oneLiner: verdict.oneLiner, pros: verdict.pros, cons: verdict.cons, timingLabel: verdict.timing?.label ?? null, flags },
  }
  await setCache(cacheKey, report)
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
