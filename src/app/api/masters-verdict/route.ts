// 🎩 거장 위원회 API — SSOT 수집 → 결정론 판정(mastersCommittee) → Gemini 는 토론 서술만
// 원본(AI Berkshire)의 "4인 독립 분석→교차 반박→의장 종합"을 1회 LLM 호출로 재현:
// 판정은 이미 코드가 끝냈고, LLM 은 그 결과를 페르소나 발언·반박·종합 문장으로 옮긴다(사실 창작 금지).
import { NextRequest, NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getMoatBreach } from '@/app/actions/getMoatBreach'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { calcDCF, deriveDcfInputs } from '@/lib/buffettDcf'
import { isPegBaseEffect } from '@/lib/canonicalFundamentals'
import { callGeminiJSON } from '@/lib/gemini'
import { computeCommittee, type CommitteeInput, type CommitteeResult } from '@/lib/mastersCommittee'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface CommitteeDebate {
  statements: { id: 'buffett' | 'munger' | 'duan' | 'lilu'; text: string }[]
  rebuttals: { from: string; to: string; text: string }[]   // 교차 반박(양비론 파괴 장치)
  chairman: string                                          // 의장 종합 — 결론 문장 포함
  mirror: string[]                                          // 거울 테스트: 회사를 5문장으로(판정 미반영·교육 장치)
}

export interface MastersVerdictResponse extends CommitteeResult {
  ticker: string; name: string; market: 'KR' | 'US'; currency: string
  currentPrice: number | null
  debate: CommitteeDebate | null   // Gemini 실패 시 null — 판정(결정론)은 그대로 유효
  asOf: string
}

const DEBATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    statements: {
      type: 'ARRAY', items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
        required: ['id', 'text'],
      },
    },
    rebuttals: {
      type: 'ARRAY', items: {
        type: 'OBJECT',
        properties: { from: { type: 'STRING' }, to: { type: 'STRING' }, text: { type: 'STRING' } },
        required: ['from', 'to', 'text'],
      },
    },
    chairman: { type: 'STRING' },
    mirror: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['statements', 'rebuttals', 'chairman', 'mirror'],
}

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get('ticker') || '').trim().toUpperCase()
  const market = (req.nextUrl.searchParams.get('market') === 'KR' ? 'KR' : 'US') as 'KR' | 'US'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  // 🪶 brief=1 — 판정만(Gemini 토론 생략). 통합추천·리밸런싱이 배지·가격구간을 붙일 때 쓴다.
  //    ⚠️ 판정 자체는 전체 모드와 **같은 computeCommittee** 다 — 화면마다 판정이 달라지면 제2원칙 위반.
  const brief = req.nextUrl.searchParams.get('brief') === '1'

  // 판정은 결정론이지만 가격 의존 체크(안전마진·어닝일드·52주 위치)가 있어 일 단위 캐시.
  // 캐시가 둘인 이유: full 은 토론까지 있어야 완전하고, brief 는 판정만으로 완전하다.
  // brief 결과를 full 키에 넣으면 위원회 탭이 "토론 실패"로 보이고, 그게 24h 박제된다.
  // v3: 🏦 금융주 가드(FCF·DCF·순부채 잣대 보류 — Schwab 내재가치 2.8배 실사고) / v2: 통화 단위 불일치 가드
  const fullKey  = `masters-committee-v3:${ticker}:${market}:${kstDate()}`
  const briefKey = `masters-brief-v3:${ticker}:${market}:${kstDate()}`
  const full = await getCache<MastersVerdictResponse>(fullKey, 24 * 3600_000)
  if (full) return NextResponse.json(full, { headers: { 'Cache-Control': 'no-store' } })   // 토론 포함 = 어느 모드든 충분
  if (brief) {
    const b = await getCache<MastersVerdictResponse>(briefKey, 24 * 3600_000)
    if (b) return NextResponse.json(b, { headers: { 'Cache-Control': 'no-store' } })
  }

  const selfBase = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  // ── ① SSOT 수집(병렬) — 새 계산 0, 전부 기존 원천 재사용(제2원칙) ──
  const [si, fcfJ, rdcfJ] = await Promise.all([
    fetch(`${selfBase}/api/stock-info?ticker=${encodeURIComponent(ticker)}&market=${market}`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${selfBase}/api/stock-fcf?ticker=${encodeURIComponent(ticker)}&market=${market}`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${selfBase}/api/reverse-dcf?ticker=${encodeURIComponent(ticker)}&market=${market}`, { cache: 'no-store', signal: AbortSignal.timeout(25_000) }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  const f = si?.fundamentals ?? {}
  const name: string = si?.name ?? ticker
  const currency: string = si?.currency ?? (market === 'KR' ? 'KRW' : 'USD')

  const [moat, sm, priceArr] = await Promise.all([
    getMoatBreach({ ticker, name, market }).catch(() => null),
    buildSignalMetrics(ticker, market, name, selfBase).catch(() => null),
    fetch(`${selfBase}/api/stock-price`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ticker, market }]), signal: AbortSignal.timeout(30_000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  const currentPrice: number | null = Array.isArray(priceArr) && priceArr[0]?.currentPrice > 0 ? priceArr[0].currentPrice : null

  // ── ② 파생값 — 전부 기존 SSOT 함수로 ──
  const growthPct = typeof f.earningsGrowth === 'number'
    ? (Math.abs(f.earningsGrowth) < 5 ? f.earningsGrowth * 100 : f.earningsGrowth) : null
  const peg = typeof f.peg === 'number' ? f.peg : null
  const pegBase = peg != null && growthPct != null ? isPegBaseEffect(peg, growthPct) : null

  // 🏦 금융주 여부 — stock-fcf SSOT 판정 재사용(예금·대출·보험 float 탓에 FCF·DCF·순부채 잣대 무의미)
  const isFinancial: boolean | null = typeof fcfJ?.isFinancial === 'boolean' ? fcfJ.isFinancial : null

  // 버핏 DCF — 흑자 FCF + 주식수 확보(ok)일 때만. 기저효과·금융주면 산정 보류(모닝스타 패널과 동일 원칙)
  let intrinsicPerShare: number | null = null
  if (currentPrice != null && pegBase !== true && isFinancial !== true) {
    try {
      const inp = deriveDcfInputs(f, { market, currency, lynchCategory: null, currentPrice })
      if (inp.ok && inp.fcf0 != null && inp.shares != null) {
        const dcf = calcDCF(inp.fcf0, inp.g, inp.r, inp.gp, inp.netDebt, inp.shares, currentPrice)
        if (dcf.intrinsicPerShare > 0) intrinsicPerShare = dcf.intrinsicPerShare
      }
    } catch { /* DCF 불가 — buyBand null 로 정직 표기 */ }
  }

  const input: CommitteeInput = {
    pe: typeof f.pe === 'number' && f.pe > 0 ? f.pe : null,
    peg, pbr: typeof f.pbr === 'number' && f.pbr > 0 ? f.pbr : null,
    eps: typeof f.eps === 'number' ? f.eps : null,
    forwardEps: typeof f.forwardEps === 'number' ? f.forwardEps : null,
    earningsGrowth: typeof f.earningsGrowth === 'number' ? f.earningsGrowth : null,
    roe: typeof f.returnOnEquity === 'number' ? f.returnOnEquity : null,
    grossMargin: typeof f.grossMargins === 'number' ? f.grossMargins : null,
    opMargin: typeof f.operatingMargins === 'number' ? f.operatingMargins : null,
    payoutRatio: typeof f.payoutRatio === 'number' ? f.payoutRatio : null,
    dividendYield: typeof f.dividendYield === 'number' ? f.dividendYield : null,
    freeCashflow: typeof f.freeCashflow === 'number' ? f.freeCashflow : null,
    totalDebt: typeof f.totalDebt === 'number' ? f.totalDebt : null,
    totalCash: typeof f.totalCash === 'number' ? f.totalCash : null,
    marketCap: typeof f.marketCap === 'number' && f.marketCap > 0 ? f.marketCap : null,
    high52w: typeof f.high52w === 'number' ? f.high52w : null,
    low52w: typeof f.low52w === 'number' ? f.low52w : null,
    currentPrice,
    fcfYieldPct: typeof fcfJ?.fcfYield === 'number' ? fcfJ.fcfYield : null,
    qualityGap: typeof fcfJ?.qualityGap === 'boolean' ? fcfJ.qualityGap : null,
    roic: typeof sm?.roic === 'number' ? sm.roic : null,
    roeInflated: typeof sm?.roeInflated === 'boolean' ? sm.roeInflated : null,
    moatWidth: moat?.moatWidth ?? null,
    rdcfVerdict: rdcfJ?.verdict ?? null,
    rdcfImplied: typeof rdcfJ?.impliedGrowth === 'number' ? rdcfJ.impliedGrowth : null,
    pegBaseEffect: pegBase,
    intrinsicPerShare,
    isFinancial,
  }

  // ── ③ 결정론 판정 ──
  const committee = computeCommittee(input)

  // ── ④ Gemini — 토론 '서술'만(판정·숫자 창작 금지) ──
  const factSheet = committee.masters.map(m =>
    `${m.name}(${m.id}) 판정=${m.verdict} | ` + m.checks.map(c => `${c.label}:${c.status}(${c.value})`).join(' · ')
  ).join('\n')
  const redlineTxt = committee.redlines.filter(r => r.hit).map(r => `${r.label}: ${r.detail}`).join('\n') || '없음'

  const prompt = `너는 가치투자 교육 앱의 "거장 위원회" 서기다. 아래는 ${name}(${ticker})에 대해 **코드가 이미 내린 결정론 판정**이다.
네 일은 판정을 바꾸는 게 아니라, 이 판정을 4인의 페르소나 발언·교차 반박·의장 종합으로 **옮겨 쓰는 것**이다.

[4인 판정 결과]
${factSheet}

[레드라인]
${redlineTxt}

[위원회 최종] ${committee.final === 'pass' ? '통과' : committee.final === 'fail' ? '불통과' : '회색지대'} — ${committee.finalReason}

⛔ 절대 규칙
- 위 판정표에 있는 사실·수치만 언급한다. 새 숫자·사실을 만들지 마라.
- 판정(통과/불통과/회색)을 뒤집거나 완화하지 마라. 양비론("둘 다 일리 있다") 금지 — 각자는 자기 결론을 분명히 말한다.
- statements: 4명 각자 2~3문장. id 는 buffett/munger/duan/lilu. 각자 자기 체크리스트 결과를 자기 철학의 언어로 말한다
  (버핏=해자·현금, 멍거=인버전·"망하는 길", 단요핑=본분·이익의 질, 리루=가격 대 가치).
- rebuttals: 2~3개. 판정이 갈린 지점에서만, 상대의 '판정표 근거'를 지목해 반박한다("네 PEG 통과는 기저효과를 못 봤다"처럼).
  4인 판정이 모두 같으면 반박 대신 서로의 근거를 보강하는 코멘트로 채운다.
- chairman: 3문장 — 다툼의 핵심, 최종 결론(위 최종 판정 그대로), 학생이 가져갈 한 가지.
- mirror: 이 회사가 무엇으로 돈을 버는지 **정확히 5문장** — 초등학생도 이해할 쉬운 한국어. 회사 일반 상식 수준만 쓰고
  구체적 수치는 넣지 마라(수치는 판정표 몫이다).
- 전부 한국어, '~다' 평서형. 거장 이름을 빌린 교육용 재현임을 잊지 마라(실존 인물 사칭 문체 금지 — 3인칭 아닌 1인칭은 허용).`

  const g = brief ? null : await callGeminiJSON<CommitteeDebate>(prompt, DEBATE_SCHEMA, { temperature: 0.6 })
  const debate: CommitteeDebate | null = g?.ok ? g.data : null

  const result: MastersVerdictResponse = {
    ...committee, ticker, name, market, currency, currentPrice, debate, asOf: new Date().toISOString(),
  }

  // ⚠️ 부분실패 박제 금지 — full 모드에서 Gemini 서술이 없으면 캐시하지 않는다(다음 요청이 재시도).
  //    brief 는 판정만으로 완전하므로 별도 키에 캐시한다(통합추천이 15종목을 매번 재계산하지 않게).
  if (debate) await setCache(fullKey, result)
  else if (brief) await setCache(briefKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
