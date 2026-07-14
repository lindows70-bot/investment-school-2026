/**
 * GET /api/macro-ai-picks
 *
 * 🌐 거시경제 AI 매수 추천 터미널 — 메인 파이프라인
 *
 * 4단계:
 *   1) FRED 매크로 데이터 수집 (24h 캐시)
 *   2) 매크로 국면 자동 판별
 *   3) 퀀트 1차 스크리닝 (US7 + KR5 = 12종목)
 *   4) Gemini LLM 최종 추천 리포트 생성
 *
 * 캐싱: 주간 Lazy Cache (7일 TTL)
 *   - Stale-while-revalidate: 갱신 실패 시 기존 데이터 유지 + isStale:true (제미나이 보강 ④)
 *   - 매크로 국면 변화 감지 시 즉시 무효화
 *
 * 인증 불필요 — 교육용 공개 추천 리포트
 * Weekly Cron: 0 19 * * 1 (월 04:00 KST)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300   // 유니버스 ~220종 확장 대응(스크리너 워밍 여유)

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { fetchMacroData, detectMacroPhase, runScreener, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { callGeminiJSON } from '@/lib/gemini'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface AiRecommendation {
  ticker:           string
  name:             string
  market:           'US' | 'KR'
  lynchCategory:    string
  peg:              number | null
  opMargin:         number | null
  price:            number | null
  currency:         'USD' | 'KRW'
  flags:            string[]
  macroFitReason:   string   // LLM 생성: 매크로 궁합
  fundamentalReason:string   // LLM 생성: 펀더멘탈 분석
  riskFactor:       string   // LLM 생성: 리스크 요인
  aiScore:          number   // 0~100 (LLM이 판단한 매력도)
}
export interface MacroAiResult {
  macroData:        { fedRate: number; cpiYoY: number; yieldCurve: number; hySpread: number }
  phase:            { phase: string; label: string; color: string; icon: string; description: string }
  macroSummary:     string   // LLM 한 줄 요약
  recommendations:  AiRecommendation[]
  screenedCount:    number
  generatedAt:      string
  isStale:          boolean  // stale-while-revalidate 플래그
  nextRefreshAt:    string
}

const CACHE_KEY = 'macro-ai-picks:weekly:v3'   // v2: 유니버스 50→100 확장
const PHASE_KEY = 'macro-ai-picks:phase'
const CACHE_TTL = 7 * 24 * 3600_000   // 7일

const LYNCH_KR: Record<string, string> = {
  fast_grower: '고성장주', stalwart: '대형우량주', cyclical: '경기순환주',
  turnaround: '회생기업주', asset_play: '자산주', slow_grower: '저성장주',
}

function buildPrompt(macroData: ReturnType<typeof fetchMacroData> extends Promise<infer T> ? T : never, phaseResult: ReturnType<typeof detectMacroPhase>, stocks: ScreenedStock[]): string {
  const usd = stocks.filter(s => s.market === 'US')
  const krw = stocks.filter(s => s.market === 'KR')
  const formatStock = (s: ScreenedStock) =>
    `- ${s.ticker}(${s.name}): 린치분류=${LYNCH_KR[s.lynchCategory]||s.lynchCategory}, PEG=${s.peg?.toFixed(2)||'N/A'}, 영업마진=${s.opMargin?.toFixed(1)||'N/A'}%, FCF=${s.fcfPositive?'흑자':'적자'}, 통화=${s.currency}${s.flags.length ? `, ⚠️플래그=[${s.flags.join('|')}]` : ''}`

  return `너는 '2026 투자학교'의 수석 거시경제·밸류에이션 자산배분 전략가다.
아래 [현재 매크로 상황]과 [1차 스크리닝된 종목 리스트]를 종합 분석하여, 지금 국면에서 가장 매수하기 적합한 종목 **8~10개**를 선정하고 피터 린치·워런 버핏 철학에 기반한 이유를 설명하라.
(미국 종목 5~6개, 한국 종목 3~4개 균형 있게 선정할 것)

[현재 매크로 상황]
- 미국 기준금리: ${macroData.fedRate}% (${phaseResult.phase === 'rate_cut_early' ? '인하 진행 중' : '동결/고점'})
- CPI 전년 대비: ${macroData.cpiYoY}%
- 장단기 금리차(10Y-2Y): ${macroData.yieldCurve}%p (${macroData.yieldCurve > 0 ? '정상화' : '역전'})
- 하이일드 스프레드: ${macroData.hySpread}% (${macroData.hySpread < 3 ? 'risk-on' : 'risk-off'})
- 국면 판정: ${phaseResult.label} — ${phaseResult.description}

[퀀트 1차 스크리닝 결과 (US ${usd.length}개 + KR ${krw.length}개)]
[미국 종목]
${usd.map(formatStock).join('\n')}
[한국 종목]
${krw.map(formatStock).join('\n')}

[중요 지침]
1. ⚠️플래그가 있는 종목도 탈락시키지 말고, 해당 리스크를 riskFactor에 반드시 언급하라 (분할매수·관망 등 구체적 전략 포함).
2. 한국 종목 추천 시 환율(원/달러) 변동 리스크를 고려하라.
3. macroFitReason은 '이 국면(${phaseResult.label})에서 이 기업의 비즈니스 모델이 왜 유리한가'를 구체적으로 설명하라.
4. aiScore(0~100)는 현재 국면에서의 매수 매력도 점수다.
5. 반드시 아래 JSON 구조로만 답하라 (여는 말·마크다운 금지).

{
  "macroSummary": "현재 매크로 국면 한 줄 요약 (20자 내외)",
  "recommendations": [
    {
      "ticker": "종목코드",
      "macroFitReason": "매크로 궁합 이유 (2~3문장)",
      "fundamentalReason": "펀더멘탈 분석 (PEG·마진·FCF 연계, 2~3문장)",
      "riskFactor": "주요 리스크 및 진입 전략 (1~2문장)",
      "aiScore": 정수(0~100)
    }
  ]
}`
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const reqUrl = new URL(req.url)
  const { searchParams } = reqUrl
  const forceRefresh = searchParams.get('refresh') === '1'
  const now = new Date().toISOString()
  const selfBase = process.env.NEXT_PUBLIC_APP_URL || reqUrl.origin

  // ── Stale-while-revalidate (제미나이 보강 ④) ──────────────────────────────
  const cached = await getCache<MacroAiResult>(CACHE_KEY, CACHE_TTL)

  // 매크로 데이터는 항상 최신으로 수집 (24h 자체 캐시). selfBase로 FedWatch 방향 그라운딩
  const macroData = await fetchMacroData(selfBase)
  const phaseResult = detectMacroPhase(macroData)

  // 국면 변화 감지 (이전 국면과 다르면 강제 갱신)
  const prevPhase = await getCache<string>(PHASE_KEY, CACHE_TTL)
  const phaseChanged = prevPhase !== null && prevPhase !== phaseResult.phase

  if (cached && !forceRefresh && !phaseChanged) {
    return NextResponse.json({ ...cached, macroData, phase: phaseResult, isStale: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // 기존 캐시가 있으면 stale 상태로 먼저 반환 (가동률 보장)
  if (cached && !forceRefresh) {
    // 백그라운드에서 갱신 — 이번 요청은 stale 데이터로 응답
    refreshInBackground(macroData, phaseResult).catch(() => {})
    return NextResponse.json({ ...cached, macroData, phase: phaseResult, isStale: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // ── 신규 생성 (캐시 없거나 forceRefresh) ─────────────────────────────────
  try {
    const result = await generatePicks(macroData, phaseResult, now)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[macro-ai-picks]', (e as Error).message?.slice(0, 80))
    // 에러 시 기존 캐시 반환 (stale)
    if (cached) return NextResponse.json({ ...cached, macroData, phase: phaseResult, isStale: true })
    return NextResponse.json({ error: 'AI 추천 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}

async function refreshInBackground(macroData: Awaited<ReturnType<typeof fetchMacroData>>, phaseResult: ReturnType<typeof detectMacroPhase>) {
  try { await generatePicks(macroData, phaseResult, new Date().toISOString()) } catch { /* 실패 무시 */ }
}

async function generatePicks(
  macroData: Awaited<ReturnType<typeof fetchMacroData>>,
  phaseResult: ReturnType<typeof detectMacroPhase>,
  now: string
): Promise<MacroAiResult> {
  // 1차 퀀트 스크리닝
  const { us, kr, all } = await runScreener(phaseResult.phase as Parameters<typeof runScreener>[0])
  const allScreened = [...us, ...kr]
  // ★ 슬라이스 전 전체 채점 유니버스(섹터 무관 100종)를 공유 캐시에 적재 → 4계절 '계절 매수 후보'가 섹터 필터로 재사용(추가 스크리닝 0)
  await setCache('macro-screened-universe:v7', all)

  // Gemini 호출
  const prompt = buildPrompt(macroData, phaseResult, allScreened)
  const geminiRes = await callGeminiJSON<{
    macroSummary: string
    recommendations: Array<{ ticker: string; macroFitReason: string; fundamentalReason: string; riskFactor: string; aiScore: number }>
  }>(prompt, {
    type: 'OBJECT',
    properties: {
      macroSummary: { type: 'STRING' },
      recommendations: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ticker:           { type: 'STRING' },
            macroFitReason:   { type: 'STRING' },
            fundamentalReason:{ type: 'STRING' },
            riskFactor:       { type: 'STRING' },
            aiScore:          { type: 'INTEGER' },
          },
          required: ['ticker', 'macroFitReason', 'fundamentalReason', 'riskFactor', 'aiScore'],
        },
      },
    },
    required: ['macroSummary', 'recommendations'],
  }, { temperature: 0.6 })

  if (!geminiRes.ok) throw new Error(`Gemini: ${geminiRes.reason}`)

  // 스크리닝 데이터와 LLM 결과 병합
  const stockMap = new Map(allScreened.map(s => [s.ticker, s]))
  const recommendations: AiRecommendation[] = (geminiRes.data.recommendations ?? []).map(r => {
    const s = stockMap.get(r.ticker)
    return {
      ticker:            r.ticker,
      name:              s?.name ?? r.ticker,
      market:            s?.market ?? 'US',
      lynchCategory:     s?.lynchCategory ?? 'stalwart',
      peg:               s?.peg ?? null,
      opMargin:          s?.opMargin ?? null,
      price:             s?.price ?? null,
      currency:          s?.currency ?? 'USD',
      flags:             s?.flags ?? [],
      macroFitReason:    r.macroFitReason,
      fundamentalReason: r.fundamentalReason,
      riskFactor:        r.riskFactor,
      aiScore:           Math.max(0, Math.min(100, r.aiScore || 70)),
    }
  }).sort((a, b) => b.aiScore - a.aiScore)

  const nextRefreshAt = new Date(Date.now() + CACHE_TTL).toISOString()
  const result: MacroAiResult = {
    macroData, phase: phaseResult,
    macroSummary:    geminiRes.data.macroSummary || phaseResult.description,
    recommendations, screenedCount: allScreened.length,
    generatedAt: now, isStale: false, nextRefreshAt,
  }

  await setCache(CACHE_KEY, result)
  await setCache(PHASE_KEY, phaseResult.phase)
  return result
}
