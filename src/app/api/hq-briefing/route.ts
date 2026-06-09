// 🎖️ AI 본부장 종합 브리핑 — 진단(계절 정합) + 매수(통합 3축)를 하나의 처방으로 연결
// season-navigator(진단·매도신호) + unified-reco(매수)의 캐시된 결과를 합쳐 Gemini가 한 편의 운용 지시로 작성
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface HqBriefing {
  briefing: string
  seasonLabel: string
  alignmentScore: number
  trim: { name: string; weight: number; fit: number; market: string }[]
  buys: { name: string; sector: string; market: string; combined: number; seasonScore: number; fundScore: number; supplyScore: number }[]
  model: string | null
}

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `hq-briefing-v2:${user.id}:${kstDate()}:${fp}`
  const cached = await getCache<HqBriefing>(cacheKey, 12 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // 진단 + 매수 — 두 엔드포인트의 캐시된 결과 합성(쿠키 전달로 인증 유지)
  const cookie = req.headers.get('cookie') ?? ''
  const fetchAuthed = async <T>(path: string) => {
    try {
      const r = await fetch(`${base}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
      if (!r.ok) return null; const j = await r.json(); return j.error ? null : j as T
    } catch { return null }
  }
  const [season, unified] = await Promise.all([
    fetchAuthed<SeasonNavResult>('/api/season-navigator'),
    fetchAuthed<UnifiedRecoResult>('/api/unified-reco'),
  ])

  const seasonLabel = season?.marketSeasons?.us.label ?? season?.label ?? '—'
  const alignmentScore = season?.alignmentScore ?? 0
  const trim = (season?.perHolding ?? []).filter(h => h.fit < 0.5).sort((a, b) => b.weight - a.weight).slice(0, 4)
    .map(h => ({ name: h.name, weight: h.weight, fit: Math.round(h.fit * 100), market: h.market }))
  const buys = (unified?.items ?? []).slice(0, 4)
    .map(b => ({ name: b.name, sector: b.sector, market: b.market, combined: b.combined, seasonScore: b.seasonScore, fundScore: b.fundScore, supplyScore: b.supplyScore }))

  // ── AI 본부장 브리핑(Gemini) ──
  const trimTxt = trim.length ? trim.map(t => `${t.name}(비중 ${t.weight}%·계절적합 ${t.fit})`).join(', ') : '없음(보유 종목 대부분 계절 적합)'
  const buyTxt = buys.map(b => `${b.name}(${b.sector}·통합 ${b.combined}: 계절${b.seasonScore}/가치${b.fundScore}/수급${b.supplyScore})`).join('\n')
  const prompt = `너는 '2026 투자학교'의 AI 포트폴리오 운용 본부장이다. 학생에게 지금 무엇을 줄이고 무엇을 사야 하는지 한 편의 운용 지시로 브리핑하라.

[현재 매크로 계절] ${seasonLabel}
[내 포트폴리오 계절 정합도] ${alignmentScore}/100
[계절 미스매치 보유 종목(비중 점검 후보)] ${trimTxt}
[통합 추천 상위 매수 후보(계절×가치×수급 3축)]
${buyTxt || '없음'}

[작성 규칙]
- 3~4문장, 한국어. ① 지금 국면과 내 포폴 정합 상태 ② 줄일 종목이 있으면 무엇을 왜(계절 부적합), 없으면 "구조는 양호" ③ (회수/신규) 자금이 생기면 통합 1~2위 종목을 왜 담을지(3축 근거 연결) ④ "분할로 신중히" 톤.
- ⛔ 자동매매·체결 지시 금지(제안까지). 단정적 수익 예측·가짜 숫자 금지. 손익 기준 매도는 "아래 ② 리밸런싱 패널을 함께 보라"고 안내.
- 교육용 코칭 톤. JSON {"briefing": "..."} 만 출력.`

  let briefing = ''
  let model: string | null = null
  const g = await callGeminiJSON<{ briefing: string }>(prompt, { type: 'OBJECT', properties: { briefing: { type: 'STRING' } }, required: ['briefing'] }, { temperature: 0.4 })
  if (g.ok && g.data?.briefing) { briefing = g.data.briefing; model = g.model }

  // 결정론적 폴백(Gemini 실패/데이터 부족 시에도 항상 유효)
  if (!briefing) {
    const top = buys[0]
    briefing = `현재 ${seasonLabel} 국면이며 내 포트폴리오의 계절 정합도는 ${alignmentScore}점입니다. ` +
      (trim.length ? `${trim[0].name} 등 ${trim.length}종이 이 계절에 덜 맞아 비중 점검이 필요합니다. ` : `보유 구조는 대체로 계절에 적합합니다. `) +
      (top ? `자금이 생기면 통합 1위 ${top.name}(${top.sector}·통합 ${top.combined}점: 계절 ${top.seasonScore}·가치 ${top.fundScore}·수급 ${top.supplyScore})을 분할로 신중히 편입을 검토하세요. ` : '') +
      `손익 기준 매도 진단은 아래 ② 리밸런싱 패널을 함께 확인하세요. ※ 교육용 시뮬레이션이며 자동 체결은 하지 않습니다.`
  }

  const result: HqBriefing = { briefing, seasonLabel, alignmentScore, trim, buys, model }
  // 매수 후보가 비었으면(통합추천 콜드/타임아웃) 캐시하지 않음 → 다음 로드에서 통합추천 워밍 후 재생성
  if (buys.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
