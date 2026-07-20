// 📄 종목 리서치 리포트 API — Anthropic 금융 에이전트式 3기능(섹터·어닝·액션)을 한 편으로 통합.
//    전부 기존 SSOT 재사용(research-verdict·getEarningsInsight·getAnalystSignal·sector-rotation) + Gemini 총평.
//    ⛔ 점수·판정은 research-verdict 그대로. 이 라우트는 합성·표현 레이어(새 판정기 0).
import { NextResponse } from 'next/server'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { getEarningsInsight } from '@/app/actions/getEarningsInsight'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { callGeminiJSON } from '@/lib/gemini'
import type { ResearchVerdict } from '@/app/api/research-verdict/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const SECTOR_KO: Record<string, string> = {
  'Technology': '기술', 'Financial Services': '금융', 'Healthcare': '헬스케어', 'Consumer Cyclical': '자유소비재',
  'Consumer Defensive': '필수소비재', 'Energy': '에너지', 'Industrials': '산업재', 'Basic Materials': '소재',
  'Communication Services': '커뮤니케이션', 'Utilities': '유틸리티', 'Real Estate': '부동산',
}
const ROT_LABEL: Record<string, string> = {
  leading: '🌱 주도(자금 유입)', improving: '❄️ 태동(회전 초입)', weakening: '🔥 과열(모멘텀 둔화)', lagging: '🍂 이탈(자금 유출)',
}

export interface ResearchReport {
  ticker: string; name: string; market: string; sector: string | null; sectorKo: string; generatedAt: string
  summary: string
  sectorSec: { phaseLabel: string; seasonFit: string; narrative: string }
  earnings: { growthStory: string; managementTone: string; guidance: string; sentiment: number; status: string; revision: string }
  action: { verdict: 'buy' | 'caution' | 'avoid'; score: number; oneLiner: string; pros: string[]; cons: string[]; timingLabel: string | null }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || '').trim()
  const market = (searchParams.get('market') || 'US').toUpperCase()
  const name = (searchParams.get('name') || ticker).trim()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  if (getAssetType(ticker, name, market) !== 'STOCK')
    return NextResponse.json({ unsupported: true, reason: '개별 주식 전용 리포트입니다(ETF·코인·원자재 제외).' }, { headers: { 'Cache-Control': 'no-store' } })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cacheKey = `research-report-v2:${ticker.toUpperCase()}:${market}:${kstDate()}`
  const cached = await getCache<ResearchReport>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 병렬 — 전부 기존 SSOT (섹터·로테이션·계절은 research-verdict가 이미 정확히 계산 → 재사용, 제2원칙)
  const [vfRaw, earn, analyst] = await Promise.all([
    fetch(`${base}/api/research-verdict?ticker=${encodeURIComponent(ticker)}&market=${market}`).then(r => r.json()).catch(() => null),
    getEarningsInsight({ ticker, name, market }).catch(() => null),
    getAnalystSignal({ ticker, name, market }).catch(() => null),
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

  // Gemini 총평 + 섹터 서술 — 넘겨준 데이터만 근거(환각 가드), 투자 단정 금지
  const rotPart = phase ? `(로테이션 ${phaseLabel})` : '(로테이션 국면 미집계)'
  const prompt =
    `너는 학생용 투자 교육 앱의 애널리스트다. 아래 [데이터]만 근거로 ${name}(${ticker}) 리서치 리포트의 ` +
    `① summary(총평, 한국어 2~3문장) ② sectorNarrative(섹터 서술, 한국어 1~2문장)를 써라. ` +
    `⛔ 데이터 밖 수치·사실·뉴스 창작 금지. 특히 로테이션이 '미집계'면 자금 유입/이탈 같은 국면을 지어내지 말고 계절 적합만 서술할 것. ` +
    `투자 단정 대신 '적합/신중/부적합'과 근거만. 종결어미는 마침표.\n` +
    `[데이터] 종합판정=${verdictKo}(${verdict.score}점) · 한줄결론="${verdict.oneLiner}" · ` +
    `섹터=${sectorKo}${rotPart} · 계절적합=${seasonFit} · ` +
    `어닝 낙관도=${earn?.sentimentScore ?? '—'}/100 · EPS 추정 리비전=${revision} · ` +
    `강점=${verdict.pros.slice(0, 3).join('/') || '—'} · 주의=${verdict.cons.slice(0, 3).join('/') || '—'}.`
  const g = await callGeminiJSON<{ summary: string; sectorNarrative: string }>(
    prompt,
    { type: 'OBJECT', properties: { summary: { type: 'STRING' }, sectorNarrative: { type: 'STRING' } }, required: ['summary', 'sectorNarrative'] },
    { temperature: 0.4 },
  )
  const summary = g.ok ? g.data.summary : `${name}은(는) 종합 ${verdictKo}(${verdict.score}점) — ${verdict.oneLiner}`
  const sectorNarrative = g.ok ? g.data.sectorNarrative : (phase ? `${sectorKo} 섹터는 현재 ${phaseLabel} 국면이며, 계절 적합도는 ${seasonFit}입니다.` : `${sectorKo} 섹터 · 로테이션 국면 미집계 · 계절 적합 ${seasonFit}.`)

  const report: ResearchReport = {
    ticker: ticker.toUpperCase(), name, market, sector, sectorKo, generatedAt: new Date().toISOString(),
    summary,
    sectorSec: { phaseLabel, seasonFit, narrative: sectorNarrative },
    earnings: {
      growthStory: earn?.growthStory ?? '', managementTone: earn?.managementTone ?? '', guidance: earn?.guidance ?? '',
      sentiment: earn?.sentimentScore ?? 0, status: earn?.status ?? 'no_data', revision,
    },
    action: { verdict: verdict.verdict, score: verdict.score, oneLiner: verdict.oneLiner, pros: verdict.pros, cons: verdict.cons, timingLabel: verdict.timing?.label ?? null },
  }
  await setCache(cacheKey, report)
  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
