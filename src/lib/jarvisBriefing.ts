/**
 * src/lib/jarvisBriefing.ts — 🤖 Jarvis 모닝 포트폴리오 처방전 파이프라인 (1단계 · 백엔드)
 *
 * 매일 새벽 Cron이 전체 학생의 보유 종목을 순회하며:
 *  ① 지표 수집(Yahoo, 종목별 app_cache 12h)  ② 정량 룰 시그널 판정(SELL/BUY/HOLD)
 *  ③ 발동(SELL/BUY) 종목만 Gemini로 'Jarvis' 3문장 브리핑  ④ 동일업종 저평가 대안 매칭
 *
 * 모든 단계 graceful — 데이터 부재/API 실패 시 null·폴백으로 전체 파이프라인이 죽지 않음.
 * 하드코딩 금지 — 어떤 종목이 들어와도 동일 규칙으로 작동(assetClassifier로 개별주식만).
 *
 * 룰(요구사항):
 *  · SELL: PEG>2.2  또는  영업이익률 2분기 연속 하락  또는  FCF 적자
 *  · BUY : (우량/고성장주 & PEG<0.8)  또는  최근 30일 내부자·대주주 매집
 */

import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'
import { getCanonicalPeg } from '@/lib/canonicalFundamentals'
import { getInsiderSignal } from '@/app/actions/getInsiderSignal'
import { getSectorPeers } from '@/app/actions/getSectorPeers'

export type SignalType = 'SELL' | 'BUY' | 'HOLD'

export interface SignalMetrics {
  ticker:         string
  name:           string
  market:         string
  sector:         string | null
  industry:       string | null
  peg:            number | null
  opMargin:       number | null   // 현재 영업이익률 %
  opMargin2qDown: boolean         // 영업이익률 2분기 연속 하락
  fcf:            number | null
  fcfNegative:    boolean
  roe:            number | null   // %
  interestCoverage: number | null  // 이자보상배율(영업이익/이자비용) — <1=좀비(이자도 못 갚음). 무차입은 null
  marketCap:      number | null   // 시가총액(종목 통화 — US=USD, KR=KRW) — 10배거 시총 룸 판별
  revenueGrowth:  number | null   // 매출 성장률(Yahoo 소수, 0.36=36%) — 적자 하이퍼그로스 포착
  currency:       string | null
}
export interface SignalDecision { type: SignalType; reasons: string[] }
export interface Recommendation { ticker: string; name: string; reason: string; peg: number | null; opMargin: number | null }
export interface BriefingText { title: string; content: string }

// ── 유틸 ──────────────────────────────────────────────────────────────────────
export function kstDate(d = new Date()): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)  // Asia/Seoul 달력일
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const num = (v: any): number | null => { if (v == null) return null; const x = typeof v === 'object' && 'raw' in v ? v.raw : v; const f = typeof x === 'number' ? x : parseFloat(x); return isFinite(f) ? f : null }
const fmt = (v: number | null, s = '') => v != null ? `${Math.round(v * 100) / 100}${s}` : '자료없음'

async function getYF() {
  const { default: YahooFinance } = await import('yahoo-finance2')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
}

// ── ① 지표 수집 (종목별 12h app_cache — 여러 학생이 같은 종목 보유 시 1회만 수집) ──
export async function buildSignalMetrics(ticker: string, market: string, name: string, selfBase?: string): Promise<SignalMetrics | null> {
  const tk = ticker.trim().toUpperCase()
  // v4: PEG를 app_cache(canon-fund) 직접 읽기로 변경 — selfBase 의존성 제거
  //     selfBase가 undefined여도 canon-fund 캐시에서 SSOT PEG를 가져옴
  const cacheKey = `jarvis-metrics-v6:${tk}:${market}:${kstDate()}`   // v6: 시총·매출성장 추가
  const cached = await getCache<SignalMetrics>(cacheKey, 12 * 3600_000)
  if (cached) return cached

  try {
    const yf = await getYF()
    // KR은 .KS(코스피)→.KQ(코스닥) 폴백
    const code = tk.replace(/\D/g, '')
    const tries = market === 'KR' ? [`${code}.KS`, `${code}.KQ`] : [tk]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = null
    let sym = tries[0]
    for (const s of tries) {
      try {
        const r = await yf.quoteSummary(s, { modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'assetProfile', 'price'] })
        if (r) { q = r; sym = s; if (r?.assetProfile?.industry) break }
      } catch { /* 다음 심볼 */ }
    }
    if (!q) return null

    const fd = q.financialData ?? {}, ap = q.assetProfile ?? {}, pr = q.price ?? {}

    // ⭐ PEG SSOT — 제2원칙: 모든 화면에서 동일한 PEG
    // 1순위: app_cache의 canon-fund 키 직접 읽기 (selfBase 의존 없음 — 크론 포함 항상 작동)
    // 2순위: PER/성장률 직접 계산 (Yahoo 제공 시)
    // 3순위: 절대 Yahoo pegRatio 사용 금지 (KR에서 Naver PER과 달라 3.34 같은 오류 발생)
    const mkt = market === 'KR' ? 'KR' : 'US'
    const canonFund = await getCache<{ peg: number | null; pe: number | null }>(`canon-fund:${tk}:${mkt}`, 8 * 3600_000)
    let peg: number | null = canonFund?.peg ?? null
    if (peg == null) {
      // canon-fund 캐시 없으면 PER/성장률 직접 계산 (같은 공식)
      const pe = num(q.summaryDetail?.trailingPE)
      const g  = num(fd.earningsGrowth)
      if (pe != null && pe > 0 && g != null && g > 0)
        peg = Math.round((pe / (g * 100)) * 100) / 100
    }
    // selfBase 있으면 추가로 최신 SSOT 동기화 (비동기, 실패 무시)
    if (selfBase && peg == null) {
      const canonPeg = await getCanonicalPeg(tk, market, selfBase)
      if (canonPeg != null) peg = canonPeg
    }
    const opMargin = num(fd.operatingMargins) != null ? Math.round((fd.operatingMargins as number) * 1000) / 10 : null
    const fcf = num(fd.freeCashflow)
    const roe = num(fd.returnOnEquity) != null ? Math.round((fd.returnOnEquity as number) * 1000) / 10 : null

    // 분기 영업이익률 추세 → 2분기 연속 하락 + 이자보상배율(영업이익/이자비용) — 같은 FTS 응답 재사용(추가 fetch 0)
    let opMargin2qDown = false
    let interestCoverage: number | null = null
    try {
      const fts = await yf.fundamentalsTimeSeries(sym, { period1: '2021-01-01', type: 'quarterly', module: 'financials' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = Array.isArray(fts) ? fts : (fts?.timeSeries ?? [])
      const rows = arr
        .map(r => ({ t: (r.date instanceof Date ? r.date : new Date(r.date)).getTime(), oi: num(r.operatingIncome), rev: num(r.totalRevenue), intExp: num(r.interestExpense) }))
        .sort((a, b) => a.t - b.t)
      const margins = rows.filter(r => r.rev != null && (r.rev as number) > 0 && r.oi != null).map(r => (r.oi as number) / (r.rev as number))
      if (margins.length >= 3) {
        const [a, b, c] = margins.slice(-3)
        opMargin2qDown = a > b && b > c
      }
      // 이자보상배율: 최근 4개 분기 영업이익 합 ÷ 이자비용 합(연환산). 이자비용 ~0(무차입)이면 건전(null로 둠)
      const last4 = rows.slice(-4)
      const sumOi = last4.reduce((s, r) => s + (r.oi ?? 0), 0)
      const sumInt = last4.reduce((s, r) => s + Math.abs(r.intExp ?? 0), 0)
      if (sumInt > 0) interestCoverage = Math.round((sumOi / sumInt) * 10) / 10
    } catch { /* 추세/이자보상 없으면 기본값 */ }

    const marketCap = num(q.summaryDetail?.marketCap) ?? num(pr.marketCap)
    const revenueGrowth = num(fd.revenueGrowth)

    const m: SignalMetrics = {
      ticker: tk, name: name || String(pr.shortName || tk),
      market: market || 'US',
      sector: ap.sector ? String(ap.sector) : null,
      industry: ap.industry ? String(ap.industry) : null,
      peg, opMargin, opMargin2qDown,
      fcf, fcfNegative: fcf != null && fcf < 0,
      roe, interestCoverage, marketCap, revenueGrowth,
      currency: pr.currency ? String(pr.currency) : null,
    }
    await setCache(cacheKey, m)
    return m
  } catch { return null }
}

// ── 최근 30일 내부자·대주주 매집 (getInsiderSignal 재사용 · 종목별 캐시) ──────────
export async function recentInsiderAccumulation(ticker: string, market: string, name: string): Promise<boolean> {
  try {
    const sig = await getInsiderSignal({ ticker, market, name })
    if (sig.status !== 'ok' || !sig.hasBuys) return false
    const cutoff = Date.now() - 30 * 86400_000
    return sig.buys.some(b => { const t = new Date(b.date).getTime(); return isFinite(t) && t >= cutoff })
  } catch { return false }
}

// ── ② 정량 룰 시그널 판정 (순수 함수) ─────────────────────────────────────────
export function evaluateSignal(m: SignalMetrics, lynchCategory: string | null, insiderRecent: boolean): SignalDecision {
  // SELL — 리스크 우선
  const sell: string[] = []
  if (m.peg != null && m.peg > 2.2) sell.push(`PEG ${m.peg.toFixed(2)} — 성장 대비 고평가(기준 2.2 초과)`)
  if (m.opMargin2qDown) sell.push('영업이익률이 2분기 연속 하락 — 수익성 둔화 신호')
  if (m.fcfNegative) sell.push('잉여현금흐름(FCF) 적자 — 현금 창출력 악화')
  if (sell.length) return { type: 'SELL', reasons: sell }

  // BUY — 우량/고성장 저평가 또는 내부자 매집
  const buy: string[] = []
  const quality = lynchCategory === 'stalwart' || lynchCategory === 'fast_grower'
  if (quality && m.peg != null && m.peg > 0 && m.peg < 0.8) buy.push(`PEG ${m.peg.toFixed(2)} — 우량·고성장주가 저평가(기준 0.8 미만)`)
  if (insiderRecent) buy.push('최근 30일 내 내부자·대주주의 장내 매집 포착')
  if (buy.length) return { type: 'BUY', reasons: buy }

  return { type: 'HOLD', reasons: [] }
}

// ── ④ 동일업종 저평가 대안 매칭 (SELL 시) ──────────────────────────────────────
// ⭐ 엄격 조건: 대안은 '현재 진단 종목보다 PEG가 낮은(저평가)' 동일업종 피어만.
//    (버그 수정: 과거엔 타겟 PEG와 비교 안 해 더 비싼 피어가 추천됨 — ETN 3.02 < Parker 3.31)
export async function getRecommendations(ticker: string, name: string, market: string, targetPegIn: number | null = null): Promise<Recommendation[]> {
  try {
    const sp = await getSectorPeers({ ticker, name, market })
    if (sp.status !== 'ok') return []
    // ⭐ 타겟 PEG는 '브리핑이 표시하는 값(buildSignalMetrics)'을 우선 — 일관성. 없으면 getSectorPeers값.
    const targetPeg = targetPegIn ?? (sp.peers.find(p => p.isTarget)?.peg ?? null)
    if (targetPeg == null || targetPeg <= 0) return []   // 타겟 PEG 모르면 '더 싸다' 보장 불가 → 엄격히 추천 안 함
    // 현재 종목보다 '엄격히 싼'(저평가) 양수 PEG 피어만 통과
    const cheaper = (p: { peg: number | null; isTarget: boolean }) =>
      !p.isTarget && p.peg != null && p.peg > 0 && p.peg < targetPeg

    const recs: Recommendation[] = []
    const rival = sp.peers.find(p => p.ticker === sp.rivalTicker && cheaper(p))
    if (rival) recs.push({ ticker: rival.ticker, name: rival.name, reason: '동일 업종 · 더 낮은 PEG & 더 높은 영업이익률', peg: rival.peg, opMargin: rival.opMargin })
    sp.peers
      .filter(p => p.sameInd && p.ticker !== rival?.ticker && cheaper(p))
      .sort((a, b) => (a.peg as number) - (b.peg as number))
      .slice(0, 2)
      .forEach(p => recs.push({ ticker: p.ticker, name: p.name, reason: '동일 업종 저PEG 대안', peg: p.peg, opMargin: p.opMargin }))
    return recs.slice(0, 3)
  } catch { return [] }
}

// ── ③ Jarvis 브리핑 (Gemini + 결정론적 폴백) ───────────────────────────────────
export async function generateBriefing(decision: SignalDecision, m: SignalMetrics, recs: Recommendation[]): Promise<BriefingText> {
  const isSell = decision.type === 'SELL'

  // 폴백(결정론적) — Gemini 실패해도 항상 브리핑 생성
  const fallback = (): BriefingText => {
    const recTxt = recs.length ? ` 같은 업종에서는 ${recs.map(r => r.name).join('·')}이(가) 상대적으로 더 싸고 탄탄합니다.` : ''
    return {
      title: `${m.name} ${isSell ? '리스크 점검 필요' : '저평가 기회 포착'}`,
      content: `${isSell ? '매도를 검토할 신호입니다' : '매수 기회 신호입니다'}: ${decision.reasons.join(' · ')}.${recTxt} 단정하지 말고, 회사의 실제 실적이 이 신호를 뒷받침하는지 직접 확인하세요.`,
    }
  }

  const prompt = `너는 '투자학교'의 AI 투자비서 'Jarvis'다. 학생의 보유 종목에 대한 오늘 아침 포트폴리오 처방을 전한다.

[종목] ${m.name} (${m.ticker})
[시그널] ${isSell ? '매도 검토(SELL)' : '매수 기회(BUY)'}
[발동 근거]
${decision.reasons.map(r => `- ${r}`).join('\n')}
[핵심 지표] PEG ${fmt(m.peg)} · 영업이익률 ${fmt(m.opMargin, '%')} · FCF ${m.fcf != null ? (m.fcf < 0 ? '적자' : '흑자') : '자료없음'} · ROE ${fmt(m.roe, '%')}
${recs.length ? `[동일업종 대안] ${recs.map(r => `${r.name}(PEG ${fmt(r.peg)})`).join(', ')}` : ''}

[작성 규칙]
- 톤: 단호하고 신뢰감 있게, 노련한 투자비서처럼. 오그라드는 미사여구·과장·이모지 남발 금지.
- 위에 주어진 사실(지표·근거)에만 근거. 절대 지어내지 말 것. 데이터가 부족하면 그렇게 말할 것.
- 매수/매도를 단정·강권하지 말 것(교육용). "직접 점검하라/근거를 확인하라" 식의 코칭 어조.
- 한국어. content는 정확히 3문장.

아래 JSON으로만 답해(여는 말·마크다운 금지):
{ "title": "15자 내외 한 줄 제목", "content": "3문장 브리핑" }`

  const r = await callGeminiJSON<BriefingText>(prompt, {
    type: 'OBJECT',
    properties: { title: { type: 'STRING' }, content: { type: 'STRING' } },
    required: ['title', 'content'],
  }, { temperature: 0.5 })

  if (r.ok && r.data?.title && r.data?.content) {
    return { title: String(r.data.title).slice(0, 180), content: String(r.data.content).slice(0, 2000) }
  }
  return fallback()
}
