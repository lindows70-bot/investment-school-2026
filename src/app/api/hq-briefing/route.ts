// 🎖️ AI 본부장 종합 브리핑 — 진단(계절 정합) + 매수(통합 3축)를 하나의 처방으로 연결
// season-navigator(진단·매도신호) + unified-reco(매수)의 캐시된 결과를 합쳐 Gemini가 한 편의 운용 지시로 작성
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'
import type { RebalanceResult } from '@/app/api/ai-rebalance/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface HqBriefing {
  briefing: string
  seasonLabel: string
  alignmentScore: number
  trim: { name: string; weight: number; fit: number; market: string }[]
  sells: { name: string; market: string; action: string; pnlPct: number | null; releaseWeight: number; reason: string }[]
  sellBudget: number
  buys: { name: string; sector: string; market: string; combined: number; seasonScore: number; fundScore: number; supplyScore: number }[]
  model: string | null
}

const ACTION_KO: Record<string, string> = { CUT_LOSS: '손절', TAKE_PROFIT: '익절' }

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `hq-briefing-v4:${user.id}:${kstDate()}:${fp}`   // v4: 정합성에 ETF 반영(season v8) 연동
  const cached = await getCache<HqBriefing>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 진단 + 매도(손익) + 매수 — 세 엔드포인트의 인증 결과 합성(쿠키 전달)
  const cookie = req.headers.get('cookie') ?? ''
  const fetchAuthed = async <T>(path: string, ms = 20_000) => {
    try {
      const r = await fetch(`${base}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(ms), cache: 'no-store' })
      if (!r.ok) return null; const j = await r.json(); return j.error ? null : j as T
    } catch { return null }
  }
  const [season, unified, rebal] = await Promise.all([
    fetchAuthed<SeasonNavResult>('/api/season-navigator'),
    fetchAuthed<UnifiedRecoResult>('/api/unified-reco'),
    fetchAuthed<RebalanceResult>('/api/ai-rebalance', 35_000),   // 손익 기준 매도(4분면) — 무거우니 타임아웃 길게
  ])

  const seasonLabel = season?.marketSeasons?.us.label ?? season?.label ?? '—'
  const alignmentScore = season?.alignmentScore ?? 0
  const trim = (season?.perHolding ?? []).filter(h => h.fit < 0.5).sort((a, b) => b.weight - a.weight).slice(0, 4)
    .map(h => ({ name: h.name, weight: h.weight, fit: Math.round(h.fit * 100), market: h.market }))
  // ★ 손익 기준 매도 신호 — ai-rebalance의 손절(CUT_LOSS)·익절(TAKE_PROFIT)
  const sells = (rebal?.holdings ?? [])
    .filter(h => h.action === 'CUT_LOSS' || h.action === 'TAKE_PROFIT')
    .sort((a, b) => b.releaseWeight - a.releaseWeight).slice(0, 4)
    .map(h => ({ name: h.name, market: h.market, action: h.action, pnlPct: h.pnlPct, releaseWeight: h.releaseWeight, reason: h.sellReasons?.[0] ?? '' }))
  const sellBudget = rebal?.sellBudget ?? 0
  const buys = (unified?.items ?? []).slice(0, 4)
    .map(b => ({ name: b.name, sector: b.sector, market: b.market, combined: b.combined, seasonScore: b.seasonScore, fundScore: b.fundScore, supplyScore: b.supplyScore }))

  // ── AI 본부장 브리핑(Gemini) ──
  const sellTxt = sells.length
    ? sells.map(s => `${s.name}(${ACTION_KO[s.action] ?? s.action}·손익 ${s.pnlPct != null ? (s.pnlPct > 0 ? '+' : '') + s.pnlPct + '%' : '—'}·회수 ${s.releaseWeight}%${s.reason ? `·${s.reason}` : ''})`).join(', ')
    : '손익 기준 매도 신호 없음'
  const trimTxt = trim.length ? trim.map(t => `${t.name}(계절적합 ${t.fit})`).join(', ') : '없음(보유 종목 대부분 계절 적합)'
  const buyTxt = buys.map(b => `${b.name}(${b.sector}·통합 ${b.combined}: 계절${b.seasonScore}/가치${b.fundScore}/수급${b.supplyScore})`).join('\n')
  const prompt = `너는 '2026 투자학교'의 AI 포트폴리오 운용 본부장이다. 학생에게 지금 무엇을 팔고 무엇을 사야 하는지 한 편의 운용 지시로 브리핑하라.

[현재 매크로 계절] ${seasonLabel}
[내 포트폴리오 계절 정합도] ${alignmentScore}/100
[손익 기준 매도 신호(손절/익절)] ${sellTxt}
[총 회수 가능 비중] ${sellBudget}%
[계절 미스매치 보유 종목(참고)] ${trimTxt}
[통합 추천 상위 매수 후보(계절×가치×수급 3축)]
${buyTxt || '없음'}

[작성 규칙]
- 3~4문장, 한국어. ① 지금 국면과 내 포폴 정합 상태 ② 손익 기준 매도 신호가 있으면 무엇을 왜(손절=손실+thesis붕괴 / 익절=수익+고평가), 없으면 "급히 팔 종목은 없음" ③ 매도/회수 자금(${sellBudget}%)으로 통합 1~2위 종목을 왜 담을지(3축 근거 + 매도↔매수 연결) ④ "분할로 신중히" 톤.
- ⛔ 자동매매·체결 지시 금지(제안까지). 단정적 수익 예측·가짜 숫자 금지. 손실 깊은 종목 저점매도 강요 금지(thesis 멀쩡하면 보유).
- 교육용 코칭 톤. JSON {"briefing": "..."} 만 출력.`

  let briefing = ''
  let model: string | null = null
  const g = await callGeminiJSON<{ briefing: string }>(prompt, { type: 'OBJECT', properties: { briefing: { type: 'STRING' } }, required: ['briefing'] }, { temperature: 0.4 })
  if (g.ok && g.data?.briefing) { briefing = g.data.briefing; model = g.model }

  // 결정론적 폴백(Gemini 실패/데이터 부족 시에도 항상 유효)
  if (!briefing) {
    const top = buys[0], s0 = sells[0]
    briefing = `현재 ${seasonLabel} 국면이며 내 포트폴리오의 계절 정합도는 ${alignmentScore}점입니다. ` +
      (s0 ? `${s0.name}은(는) ${ACTION_KO[s0.action] ?? ''} 신호(손익 ${s0.pnlPct ?? '—'}%${s0.reason ? `·${s0.reason}` : ''})로 비중 ${s0.releaseWeight}% 회수를 검토하세요. ` : `급히 팔아야 할 손익 신호는 없습니다. `) +
      (top ? `회수/신규 자금으로 통합 1위 ${top.name}(${top.sector}·통합 ${top.combined}점: 계절 ${top.seasonScore}·가치 ${top.fundScore}·수급 ${top.supplyScore})을 분할로 신중히 편입을 검토하세요. ` : '') +
      `자세한 매도 진단은 아래 ② 리밸런싱 패널을 함께 확인하세요. ※ 교육용 시뮬레이션이며 자동 체결은 하지 않습니다.`
  }

  const result: HqBriefing = { briefing, seasonLabel, alignmentScore, trim, sells, sellBudget, buys, model }
  // 매수 후보가 비었으면(통합추천 콜드/타임아웃) 캐시하지 않음 → 다음 로드에서 통합추천 워밍 후 재생성
  if (buys.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
