// 🎖️ AI 본부장 종합 브리핑 — 진단(계절 정합) + 매수(통합 3축)를 하나의 처방으로 연결
// season-navigator(진단·매도신호) + unified-reco(매수)의 캐시된 결과를 합쳐 Gemini가 한 편의 운용 지시로 작성
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'
import type { UnifiedRecoResult } from '@/app/api/unified-reco/route'
import type { RebalanceResult } from '@/app/api/ai-rebalance/route'
import type { DualMandateResult } from '@/app/api/fed-dual-mandate/route'

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
  policyTilt: { tilt: 'dovish' | 'hawkish' | 'neutral'; label: string; note: string } | null   // 연준 기조(참고) — 계절 SSOT 불변
  model: string | null
}

const ACTION_KO: Record<string, string> = { CUT_LOSS: '손절', TAKE_PROFIT: '익절' }

export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const fp = await holdingsFingerprint(user.id)
  const cacheKey = `hq-briefing-v6:${user.id}:${kstDate()}:${fp}`   // v6: 연준 기조 라벨 상대화(rateDir 합류 — 완화 단정 금지)
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
  const [season, unified, rebal, fed, regime] = await Promise.all([
    fetchAuthed<SeasonNavResult>('/api/season-navigator'),
    fetchAuthed<UnifiedRecoResult>('/api/unified-reco'),
    fetchAuthed<RebalanceResult>('/api/ai-rebalance', 35_000),   // 손익 기준 매도(4분면) — 무거우니 타임아웃 길게
    fetchAuthed<DualMandateResult>('/api/fed-dual-mandate'),     // 연준 양대책무(고용+워시 절사평균) — 참고 맥락
    fetchAuthed<{ rateDir?: 'cut' | 'hold' | 'hike' }>('/api/macro-regime', 10_000),  // 시장 금리 방향(SSOT) — 기조 라벨 상대화용
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

  // ── 연준 정책 기조(참고 맥락) — 비둘기/매파 톤만 가미, 계절·국면 판정은 절대 불변 ──
  // ⚠️ 라벨 상대화(중요): 시장(FF선물·rateDir)이 동결/인상을 베팅 중인데 '완화 쪽'이라는 절대적 표현을 쓰면
  //    FedWatch 화면과 정면 모순으로 보임. '완화'는 rateDir=cut일 때만, 그 외엔 '시장 대비 비둘기 여지'로 표현.
  //    (절사평균이 목표 2.0% 위인 동안 절대적 완화 단정 금지)
  let policyTilt: HqBriefing['policyTilt'] = null
  if (fed) {
    const rateDir = regime?.rateDir ?? 'hold'
    const dovish = fed.noiseGap >= 0.8 || fed.laborStatus === 'cooling'   // 헤드라인 노이즈↑(기조<목표 근접) 또는 고용 둔화
    const hawkish = fed.laborStatus === 'hot' || (fed.trimmedPce.latest > 2.5 && fed.noiseGap < 0.8)  // 고용 과열 또는 기조물가 끈적
    const tilt = dovish && !hawkish ? 'dovish' : hawkish && !dovish ? 'hawkish' : 'neutral'
    const label = tilt === 'dovish'
      ? (rateDir === 'cut' && fed.trimmedPce.latest <= 2.0 ? '비둘기 우위(완화 쪽)' : '시장 대비 비둘기 여지')
      : tilt === 'hawkish' ? '매파 우위(긴축 유지)' : '중립(데이터 의존)'
    const mktTxt = rateDir === 'hike' ? '시장(FF선물)은 인상 쪽을 반영 중' : rateDir === 'cut' ? '시장은 인하를 반영 중' : '시장은 동결을 반영 중'
    const note = `고용 ${fed.laborStatus === 'hot' ? '과열' : fed.laborStatus === 'cooling' ? '둔화' : '균형(연착륙)'}, ` +
      `워시 기조물가(절사평균) ${fed.trimmedPce.latest}% vs 헤드라인 ${fed.headlinePce}%(노이즈 ${fed.noiseGap}%p) · ${mktTxt}` +
      (tilt === 'dovish'
        ? (rateDir === 'cut'
            ? ' → 헤드라인이 부풀어 연준이 시장 기대보다 인하에 더 적극적일 수 있음(성장·기술주에 우호적 가능성).'
            : ' → 기조물가가 시장의 긴축 베팅만큼 단단하지 않아, 연준이 시장 기대보다 덜 매파적일 수 있음(절대적 완화 신호 아님 — 금리 인하 단정 금지).')
        : tilt === 'hawkish' ? ' → 기조물가/고용이 단단해 고금리 장기화 가능성(가치·현금흐름주 상대 우위).'
          : ' → 어느 쪽도 단정 어려움, 분할·신중 접근.')
    policyTilt = { tilt, label, note }
  }

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
[연준 정책 기조(참고 맥락·계절판정 대체 아님)] ${policyTilt ? `${policyTilt.label} — ${policyTilt.note}` : '데이터 없음'}

[작성 규칙]
- 4~5문장, 한국어. ① 지금 국면과 내 포폴 정합 상태 ② 손익 기준 매도 신호가 있으면 무엇을 왜(손절=손실+thesis붕괴 / 익절=수익+고평가), 없으면 "급히 팔 종목은 없음" ③ 매도/회수 자금(${sellBudget}%)으로 통합 1~2위 종목을 왜 담을지(3축 근거 + 매도↔매수 연결) ④ 연준 기조 한 줄(예: "헤드라인 물가는 높지만 워시가 보는 기조물가는 ${policyTilt && fed ? fed.trimmedPce.latest + '%' : '낮은 수준'}이라 연준이 시장 기대보다 비둘기적일 수 있다")을 매수 톤 보조 근거로만 가볍게 언급 ⑤ "분할로 신중히" 톤.
- ⚠️ 연준 기조는 어디까지나 '참고'다. 계절/국면 판정(${seasonLabel})을 뒤집거나 매크로 결론을 바꾸지 마라. 금리 방향 힌트로 매수 종목 성격(성장주 vs 가치주) 코멘트에만 가볍게 쓰라.
- ⚠️ 비둘기 기조라도 '금리 인하 예상'·'완화 국면' 같은 절대적 표현 금지 — 시장은 동결/인상을 반영 중일 수 있다. 반드시 '시장 기대보다 덜 매파적일 수 있다' 같은 상대적 표현만 쓰라.
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
      (policyTilt ? `참고로 연준 기조는 ${policyTilt.label}입니다(${policyTilt.note}). ` : '') +
      `자세한 매도 진단은 아래 ② 리밸런싱 패널을 함께 확인하세요. ※ 교육용 시뮬레이션이며 자동 체결은 하지 않습니다.`
  }

  const result: HqBriefing = { briefing, seasonLabel, alignmentScore, trim, sells, sellBudget, buys, policyTilt, model }
  // 매수 후보가 비었으면(통합추천 콜드/타임아웃) 캐시하지 않음 → 다음 로드에서 통합추천 워밍 후 재생성
  if (buys.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
