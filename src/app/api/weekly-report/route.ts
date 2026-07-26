/**
 * GET /api/weekly-report[?userId=]
 * 📄 학생별 주간 리포트 — 공통 시장 섹션(전원 공유·1회 계산) + 개인 포트폴리오 섹션(로그인 학생)
 *
 * 설계(docs/weekly-student-report/plan.md):
 *  - 클라우드 코워크 스킬(build_v4/portfolio.py) 파이프라인을 앱 단독으로 이식 — 분석은 전부 앱 SSOT 재사용(제2원칙)
 *  - 주간 기준(SSOT): 직전 금요일 종가 대비(휴장 시 그 이전 최근 거래일) — 티커별 07/16~07/17 혼재 문제를 단일 함수로 통일
 *  - 리스크 5종 게이지: 반도체 40/60(ETF 투시 포함)·상위3 55/70·환노출 50/75·코인 5/10(앱 코인랩 가드와 정합)·현금
 *  - 현금·매입환율은 DB에 없음 → '미등록·근사치' 정직 표기(잰 척 금지)
 *  - ?userId= 는 teacher 역할만 허용(학생은 본인 것만)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCache, setCache, holdingsFingerprint } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { fetchMacroData, detectMacroPhase } from '@/lib/macroPhaseScreener'
import { computeCountryVol } from '@/lib/countryVol'
import { getEntryTimings } from '@/lib/entryTiming'
import { getTechCandles } from '@/lib/techChartData'
import { getSector } from '@/lib/schoolIndex'
import { callGeminiJSON } from '@/lib/gemini'
import { SECTOR_ETF, SECTOR_LIST } from '@/lib/sectorConfigs'
import { getEtfComposition } from '@/lib/etfLookThrough'
import { GICS_SECTOR_META } from '@/lib/gicsSectorMeta'
import type { ScreenedStock } from '@/lib/macroPhaseScreener'
import type { MarketCatalystResult } from '@/app/api/market-catalyst/route'
import type { EventCalendarResult, CalEvent } from '@/app/api/event-calendar/route'
import type { MarketInvestorResult } from '@/app/api/market-investor-trend/route'
import type { ReWeeklyApi } from '@/app/api/re-weekly/route'

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const r1 = (n: number) => Math.round(n * 10) / 10

// ── 주간 앵커(SSOT) — 직전 금요일 종가 대비. 최신 봉이 금요일이면 그 전 금요일 ──
type Px = { date: string; close: number }
function weeklyFrom(candles: Px[]): { weekPct: number | null; anchorDate: string | null; last: number | null } {
  if (!candles || candles.length < 6) return { weekPct: null, anchorDate: null, last: candles?.length ? candles[candles.length - 1].close : null }
  const last = candles[candles.length - 1]
  const d = new Date(last.date + 'T00:00:00Z')
  // 주말 봉(크립토는 토·일에도 거래) → 방금 끝난 금요일 주간으로 귀속(안 하면 앵커가 어제 금요일이 돼 '주간'이 1일 변동이 됨)
  while (d.getUTCDay() === 6 || d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1)
  do { d.setUTCDate(d.getUTCDate() - 1) } while (d.getUTCDay() !== 5)   // 직전 금요일(<기준일)
  const anchorIso = d.toISOString().slice(0, 10)
  let base: Px | null = null
  for (let i = candles.length - 1; i >= 0; i--) { if (candles[i].date <= anchorIso) { base = candles[i]; break } }
  if (!base || base.close <= 0) return { weekPct: null, anchorDate: null, last: last.close }
  return { weekPct: r1((last.close / base.close - 1) * 100), anchorDate: base.date, last: last.close }
}

// 야후 일봉(지수·FX·크립토 심볼용 — getTechCandles는 개별 종목 전용)
async function yChart(sym: string, days = 45): Promise<Px[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: YF } = await import('yahoo-finance2') as any
    const yf = new YF({ suppressNotices: ['yahooSurvey'] })
    const r = await yf.chart(sym, { period1: new Date(Date.now() - days * 864e5), interval: '1d' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (r?.quotes ?? []).filter((q: any) => typeof q?.close === 'number' && isFinite(q.close))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({ date: new Date(q.date).toISOString().slice(0, 10), close: q.close }))
  } catch { return [] }
}

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface WrIndex {
  key: string; label: string; flag: string; close: number | null; weekPct: number | null; anchorDate: string | null
  spark: number[]            // 최근 ~12거래일 종가(KPI 스파크라인·상대추이 차트용)
  isYield?: boolean          // 미10Y — close=수익률%, weekPct=bp 변화
}
export interface WrAi {
  headline: string; sub: string
  bullets: { tag: string; text: string }[]       // ✦ 핵심 요약 5(자산군 태그)
  issue: { k: string; text: string }[]           // ⑤ 이슈 구조 분석 — 촉매 → 증폭 → 자금 흐름
  strategy: { title: string; text: string }[]    // 자산배분 실전 전략 5
  checkpoints: { k: string; text: string }[]     // 다음 주 체크포인트
  source: 'gemini' | 'fallback'
}
export interface WrCommon {
  weekOf: string; weekRange: string; anchorNote: string
  indices: WrIndex[]
  macro: { label: string; icon: string; description: string; fedRate: number; cpiYoY: number; rateDir: string; nextFomc: string | null } | null
  vol: { flag: string; label: string; verdict: string; vol20: number; pctile: number; big3: number }[]
  catalyst: { mood: string | null; items: { title: string; note: string }[] } | null
  krFlow: { lastDate: string; day: { foreign: number; institution: number; personal: number }; w5: { foreign: number; institution: number; personal: number } } | null   // 억원
  realestate: { name: string; w1: number | null; w4: number | null }[] | null   // 부동산원 주간 매매지수(서울·수도권·전국)
  reRank: { name: string; w1: number }[] | null        // 주간 상승·하락 상위 지역(원본 리포트의 '지역 강세' 대응)
  reRent: { name: string; conv: number; spread: number }[] | null   // 전월세 전환율 상위(전세→월세 축)
  bigCaps: { ticker: string; name: string; close: number | null; weekPct: number | null }[] | null   // ① 대형주 표
  ai: WrAi | null
}
export interface WrHolding {
  ticker: string; name: string; market: string; assetType: string; cls: string
  qty: number; costKrw: number; valueKrw: number | null; weight: number
  pnlPct: number | null; weekPct: number | null; weekContrib: number | null   // %p (비중×주간)
  sector: string | null
  signal: 'SELL' | 'BUY' | 'HOLD' | null; signalTitle: string | null
  timing: 'green' | 'yellow' | 'red' | null
}
export interface WrRisk { key: string; label: string; value: number | null; unit: string; level: 'ok' | 'warn' | 'bad' | 'unknown'; note: string }
export interface WrMe {
  userId: string; name: string; hasPortfolio: boolean
  kpi: { totalKrw: number; costKrw: number; pnlPct: number | null; weekPct: number | null; count: number; liveCoverage: number }
  byClass: { cls: string; weight: number }[]
  holdings: WrHolding[]
  sectorImpact: { sector: string; weight: number; weekPct: number | null; contrib: number | null }[]
  risks: WrRisk[]
  krExtreme: boolean          // 🌪️ 코스피 극단 변동 국면에서 KR 보유가 있는가
  calendar: CalEvent[] | null // 본인 조회일 때만(교사 대리 조회 시 null — 캘린더 API가 세션 기준이라)
  calendarNote: string | null
}
export interface WeeklyReportResult {
  common: WrCommon
  me: WrMe
  students?: { id: string; name: string }[]   // teacher 전용 로스터
  isTeacherView: boolean
  asOf: string
}

// ── 공통 시장 섹션(전원 공유·6h 캐시) ─────────────────────────────────────────
//    클라우드 리포트(build_v4) 커버리지 이식: KPI 8종 + 매크로 스냅샷(닛케이·은·WTI·미10Y) + 코인 4종
const INDICES: { key: string; label: string; flag: string; sym: string; yield?: boolean }[] = [
  { key: 'kospi',  label: '코스피',      flag: '🇰🇷', sym: '^KS11' },
  { key: 'kosdaq', label: '코스닥',      flag: '🇰🇷', sym: '^KQ11' },
  { key: 'sp500',  label: 'S&P 500',    flag: '🇺🇸', sym: '^GSPC' },
  { key: 'nasdaq', label: '나스닥',      flag: '🇺🇸', sym: '^IXIC' },
  { key: 'dow',    label: '다우',        flag: '🇺🇸', sym: '^DJI' },
  { key: 'usdkrw', label: '원/달러',     flag: '💱', sym: 'KRW=X' },
  { key: 'btc',    label: '비트코인($)',  flag: '🪙', sym: 'BTC-USD' },
  { key: 'gold',   label: '금 ($/oz)',   flag: '🥇', sym: 'GC=F' },
  { key: 'wti',    label: 'WTI 유가($)', flag: '🛢️', sym: 'CL=F' },
  { key: 'silver', label: '은 ($/oz)',   flag: '🥈', sym: 'SI=F' },
  { key: 'us10y',  label: '미 10Y(%)',   flag: '📜', sym: '^TNX', yield: true },
  { key: 'nikkei', label: '닛케이 225',  flag: '🇯🇵', sym: '^N225' },
  { key: 'eth',    label: '이더리움($)',  flag: '🔷', sym: 'ETH-USD' },
  { key: 'xrp',    label: '리플($)',     flag: '🪙', sym: 'XRP-USD' },
  { key: 'sol',    label: '솔라나($)',    flag: '🪙', sym: 'SOL-USD' },
]

const AI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' }, sub: { type: 'STRING' },
    bullets: { type: 'ARRAY', items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['tag', 'text'] } },
    issue: { type: 'ARRAY', items: { type: 'OBJECT', properties: { k: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['k', 'text'] } },
    strategy: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['title', 'text'] } },
    checkpoints: { type: 'ARRAY', items: { type: 'OBJECT', properties: { k: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['k', 'text'] } },
  },
  required: ['headline', 'sub', 'bullets', 'issue', 'strategy', 'checkpoints'],
}

async function buildCommon(base: string): Promise<WrCommon> {
  const key = `weekly-report-common-v10:${kstDate()}`   // v5: 미10Y 스케일 자동판별(÷10 버그)·앵커 요일 표기·수급 최근일 주입·프롬프트 구체성 강화
  const cached = await getCache<WrCommon>(key, 6 * 3600_000)
  if (cached) return cached

  const indices: WrIndex[] = []
  for (let i = 0; i < INDICES.length; i += 4) {
    const batch = INDICES.slice(i, i + 4)
    const res = await Promise.all(batch.map(async m => {
      const px = await yChart(m.sym)
      const w = weeklyFrom(px)
      // ⚠️ ^TNX 스케일: 과거엔 수익률×10(47.0)이었으나 2026-07-26 원천 실측은 4.679 = 퍼센트 그대로.
      //    무조건 ÷10 하면 4.68%가 0.47%로 표시된다(실제 발생 버그). 미 10년물이 20%를 넘는 일은
      //    사실상 없으므로 값으로 스케일을 판별해 양방향 10배 오류를 원천 차단한다.
      const ys = (v: number | null | undefined) => (m.yield && v != null && v > 20 ? 10 : 1)
      const spark = px.slice(-12).map(p => Math.round(p.close / ys(p.close) * 100) / 100)
      const close = w.last != null ? Math.round(w.last / ys(w.last) * 100) / 100 : null
      const baseRaw = w.anchorDate ? px.find(p => p.date === w.anchorDate)?.close ?? null : null
      const weekPct = m.yield
        ? (close != null && baseRaw != null ? r1((close - baseRaw / ys(baseRaw)) * 100) : null)   // bp
        : w.weekPct
      return { key: m.key, label: m.label, flag: m.flag, close, weekPct, anchorDate: w.anchorDate, spark, isYield: m.yield }
    }))
    indices.push(...res)
  }
  const ix = (k: string) => indices.find(i => i.key === k)

  let macro: WrCommon['macro'] = null
  try {
    const md = await fetchMacroData(base)
    const ph = detectMacroPhase(md)
    macro = { label: ph.label, icon: ph.icon, description: ph.description, fedRate: md.fedRate, cpiYoY: md.cpiYoY, rateDir: md.rateDir, nextFomc: md.nextFomc ?? null }
  } catch { /* graceful */ }

  let vol: WrCommon['vol'] = []
  try {
    const cv = await computeCountryVol()
    if (cv) vol = cv.items.map(i => ({ flag: i.flag, label: i.label, verdict: i.verdict, vol20: i.vol20, pctile: i.pctile, big3: i.big3 }))
  } catch { /* graceful */ }

  // 이슈(마켓 카탈리스트) — 캐시 읽기만(콜드면 생략, 무거운 재계산 촉발 금지)
  let catalyst: WrCommon['catalyst'] = null
  try {
    const mc = await getCache<MarketCatalystResult>(`market-catalyst-v3:${kstDate()}`, 24 * 3600_000)
    if (mc) catalyst = { mood: mc.marketMood ?? null, items: (mc.catalysts ?? []).slice(0, 3).map(c => ({ title: String((c as { title?: string }).title ?? ''), note: String((c as { why?: string; note?: string }).why ?? (c as { note?: string }).note ?? '') })) }
  } catch { /* graceful */ }

  // 🇰🇷 코스피 투자자별 수급 — 수급 레이더 SSOT 재사용(공개 라우트 self-fetch·6h 캐시)
  let krFlow: WrCommon['krFlow'] = null
  try {
    const r = await fetch(`${base}/api/market-investor-trend?market=KOSPI`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
    if (r.ok) {
      const j = await r.json() as MarketInvestorResult
      const rows = [...(j.rows ?? [])].sort((a, b) => b.date.localeCompare(a.date))
      if (rows.length >= 5) {
        const w5 = rows.slice(0, 5)
        const sum = (f: 'foreign' | 'institution' | 'personal') => Math.round(w5.reduce((s, x) => s + (x[f] ?? 0), 0))
        krFlow = { lastDate: rows[0].date, day: { foreign: Math.round(rows[0].foreign), institution: Math.round(rows[0].institution), personal: Math.round(rows[0].personal) }, w5: { foreign: sum('foreign'), institution: sum('institution'), personal: sum('personal') } }
      }
    }
  } catch { /* graceful */ }

  // 🏠 부동산원 주간 매매지수 — 부동산 주간 펄스 SSOT 재사용(공개 라우트 self-fetch·캐시)
  let realestate: WrCommon['realestate'] = null
  let reRank: WrCommon['reRank'] = null
  let reRent: WrCommon['reRent'] = null
  try {
    const r = await fetch(`${base}/api/re-weekly`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
    if (r.ok) {
      const j = await r.json() as ReWeeklyApi
      const pick = ['서울', '수도권', '전국']
      const rs = (j.regions ?? []).filter(x => pick.includes(x.name)).map(x => ({ name: x.name, w1: x.w1, w4: x.w4 }))
      if (rs.length > 0) realestate = pick.map(n => rs.find(x => x.name === n)).filter((x): x is NonNullable<typeof x> => !!x)
      // 지역 랭킹 — 원본 리포트의 '자치구 강세'에 대응(부동산원 주간 지수는 시도 단위까지 제공)
      const rk = (j.regions ?? []).filter(x => typeof x.w1 === 'number' && !['전국', '수도권', '지방권'].includes(x.name))
        .map(x => ({ name: x.name, w1: x.w1 as number })).sort((a, b) => b.w1 - a.w1)
      if (rk.length >= 4) reRank = [...rk.slice(0, 4), ...rk.slice(-2)]
    }
  } catch { /* graceful */ }

  // 🏠 전월세 전환율 — 원본의 '전세 → 월세 전환' 축(월간 SSOT 재사용)
  try {
    const r = await fetch(`${base}/api/re-rent`, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
    if (r.ok) {
      const j = await r.json() as { regions?: { name: string; conv: number; spread: number }[] }
      const rs = (j.regions ?? []).filter(x => typeof x.conv === 'number').sort((a, b) => b.conv - a.conv)
      if (rs.length >= 3) reRent = [...rs.slice(0, 3), ...rs.slice(-1)]
    }
  } catch { /* graceful */ }

  // 📊 대형주 — 원본 ① 섹션의 '대형주·수급' 표(코스피 시총 1·2위)
  let bigCaps: WrCommon['bigCaps'] = null
  try {
    const caps = [{ ticker: '005930', name: '삼성전자' }, { ticker: '000660', name: 'SK하이닉스' }]
    const got = await Promise.all(caps.map(async c => {
      try {
        const cd = (await getTechCandles(c.ticker, 'KR', 'D')).map(x => ({ date: x.date, close: x.close }))
        const w = weeklyFrom(cd)
        return { ...c, close: w.last, weekPct: w.weekPct }
      } catch { return { ...c, close: null, weekPct: null } }
    }))
    if (got.some(g => g.close != null)) bigCaps = got
  } catch { /* graceful */ }

  // 주 범위(월~금) 표기
  const anchor = ix('kospi')?.anchorDate ?? ix('sp500')?.anchorDate ?? null
  const lastD = new Date(kstDate() + 'T00:00:00Z')
  while (lastD.getUTCDay() !== 5) lastD.setUTCDate(lastD.getUTCDate() - 1)   // 직전(포함) 금요일
  const monD = new Date(lastD); monD.setUTCDate(monD.getUTCDate() - 4)
  const mmdd = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  const weekRange = `${mmdd(monD)}–${mmdd(lastD)}`

  // ✍️ AI 서사(헤드라인·핵심 요약·전략·체크포인트) — 숫자는 전부 우리가 주입(창작 금지 가드), 실패 시 결정론 폴백
  const kospi = ix('kospi'), kosdaq = ix('kosdaq'), nasdaq = ix('nasdaq'), sp = ix('sp500'), btc = ix('btc'), eth = ix('eth'), gold = ix('gold'), wti = ix('wti'), fx = ix('usdkrw'), us10 = ix('us10y')
  const seoulRe = realestate?.find(x => x.name === '서울')
  const extremeStr = vol.filter(v => v.verdict === 'extreme').map(v => v.label).join('·')
  const p = (v: number | null | undefined) => v == null ? '미집계' : `${v > 0 ? '+' : ''}${v}%`
  const jo = (v: number) => `${v > 0 ? '+' : ''}${(v / 1e4).toFixed(2)}조원`   // 억원 원자료 → 조 단위(AI가 '23037억원'으로 쓰던 것 방지)
  const facts = [
    `주간(${weekRange}): 코스피 ${kospi?.close}(${p(kospi?.weekPct)}) 코스닥 ${p(kosdaq?.weekPct)} S&P500 ${p(sp?.weekPct)} 나스닥 ${p(nasdaq?.weekPct)}`,
    `BTC ${p(btc?.weekPct)} ETH ${p(eth?.weekPct)} 금 ${p(gold?.weekPct)} WTI ${wti?.close}$(${p(wti?.weekPct)}) 원/달러 ${fx?.close}(${p(fx?.weekPct)}) 미10Y ${us10?.close}%(${us10?.weekPct != null ? `${us10.weekPct > 0 ? '+' : ''}${Math.round(us10.weekPct)}bp` : '미집계'})`,
    // ⚠️ 최근일까지 줘야 한다 — 5일 누적만 주면 '금요일 외국인 −3.27조 대량 매도' 같은 주간 최대 사건을 AI가 볼 수 없다
    krFlow ? `코스피 수급: 최근일(${krFlow.lastDate}) 외국인 ${jo(krFlow.day.foreign)}·기관 ${jo(krFlow.day.institution)}·개인 ${jo(krFlow.day.personal)} / 최근 5거래일 누적 외국인 ${jo(krFlow.w5.foreign)}·기관 ${jo(krFlow.w5.institution)}·개인 ${jo(krFlow.w5.personal)}` : '수급 미집계',
    seoulRe ? `서울 아파트 주간 ${p(seoulRe.w1)}(부동산원)` : '부동산 미집계',
    macro ? `매크로: ${macro.label}·기준금리 ${macro.fedRate}%·CPI ${macro.cpiYoY}%·다음 FOMC ${macro.nextFomc ?? '미정'}` : '',
    extremeStr ? `변동성 극단 시장: ${vol.filter(v => v.verdict === 'extreme').map(v => `${v.label} 20일 변동성 ${v.vol20}%(자국 5년 백분위 ${v.pctile}%)`).join(', ')}` : '',
    catalyst?.items?.length ? `이슈: ${catalyst.items.map(i => i.title).join(' / ')}` : '',
    // ⚠️ 국면만 주고 대응 원칙을 안 주면 모델이 '손절폭을 좁힌다'처럼 방향을 뒤집는다(실제 발생).
    //    화면 극단 변동 배너와 같은 문구를 원칙으로 함께 주입한다.
    extremeStr ? '[대응 원칙] 극단 변동 국면에서는 손절이 갭에 뚫릴 수 있으므로 손절폭을 좁히지 말고 넓게 잡는다. 신규 진입은 수량을 줄이고 분할로 나눈다.' : '',
  ].filter(Boolean).join('\n')

  const fbStrategy: { title: string; text: string }[] = [
    { title: '현금·헤지', text: extremeStr ? `${extremeStr} 변동성이 자국 5년 기준 최상단이라, 레버리지를 줄이고 현금 비중을 확보해 두는 편이 안전합니다.` : `금 ${p(gold?.weekPct)} 흐름을 참고해 현금·안전자산 비중을 점검합니다.` },
    { title: '주식', text: `코스피 ${p(kospi?.weekPct)}·나스닥 ${p(nasdaq?.weekPct)} 구간입니다. 신규 진입은 계산 수량의 절반 이하로 나누고 손절선을 먼저 정한 뒤 접근합니다.` },
    { title: '암호화폐', text: `비트코인 ${p(btc?.weekPct)} 구간이며, 포트폴리오의 5% 이하 원칙을 유지하고 레버리지는 청산 위험을 감안해 피합니다.` },
    { title: '부동산', text: seoulRe ? `서울 아파트가 주간 ${p(seoulRe.w1)}입니다. 정책·대출 규제 변화가 주간 지수보다 먼저 움직이므로 그쪽을 확인합니다.` : '정책·대출 규제 변화를 먼저 확인합니다.' },
    { title: '매크로', text: macro ? `${macro.label} 국면이고 기준금리 ${macro.fedRate}%·CPI ${macro.cpiYoY}%입니다. 다음 FOMC(${macro.nextFomc ?? '일정 확인'}) 전까지 포지션 확대는 신중하게 판단합니다.` : `미 10년물 ${us10?.close ?? '—'}% 방향을 확인한 뒤 비중을 정합니다.` },
  ]

  // ⛔ 잘못된 조언 차단(확률에 맡길 수 없는 것) — 극단 변동 국면에서 '손절폭을 좁힌다'는
  //    정상 등락에도 털려 나가는 위험한 조언이다. 프롬프트로 막아도 모델이 뒤집은 전력이 있어
  //    항목 단위로 검사해 해당 항목만 결정론 폴백 문장으로 교체한다(나머지 좋은 문장은 살린다).
  const BAD_ADVICE = /손절\s*(폭|선)?\s*(을|를)?\s*(좁|축소|줄)/
  //    + 수치가 하나도 없는 항목도 교체한다 — '변동성이 큰 장세에서 현금 비중을 유지'처럼
  //      데이터를 인용하지 않은 문장은 리포트의 값어치가 없다(프롬프트로 요구해도 빠지는 항목이 있다).
  const sanitize = (list: { title: string; text: string }[] | undefined) =>
    (list ?? []).map(it => (BAD_ADVICE.test(it.text) || !/\d/.test(it.text))
      ? { ...it, text: fbStrategy.find(f => f.title === it.title)?.text ?? it.text }
      : it)

  let ai: WrAi | null = null
  try {
    const g = await callGeminiJSON<Omit<WrAi, 'source'>>(
      `너는 2026 투자학교의 주간 자산 리포트 편집자다. 아래 [실측 데이터]만 사용해 한국어로 작성하라.

⛔ 절대 규칙(어기면 실패)
- 데이터에 없는 숫자·사건·기업명을 창작하지 마라. 모든 수치는 데이터 그대로.
- 문장은 전부 '~합니다/~입니다' 존댓말. 명령형('점검하라'·'주시하라')과 평서체('하락했다')는 금지.
- 큰 금액은 조 단위로 쓴다. '3조 2700억원'처럼 조와 억을 섞지 말고 '3.27조원'으로 쓴다(리포트의 표와 표기를 맞춰야 한다).
- 변동성이 극단인 국면에서 '손절폭을 좁힌다'고 쓰지 마라. 정상 등락에도 털려 나간다 — 넓히고 수량을 줄이는 것이 원칙이다.

✍️ 작성 원칙(가장 중요 — 이게 리포트의 값어치다)
- 모든 문장에 데이터의 실제 수치를 최소 하나 인용한다. 수치 없는 일반론은 실패다.
  나쁨: "변동성이 큰 장세에서 자산 방어 수단을 점검하라."
  좋음: "코스피 20일 변동성이 73%로 자국 5년 기준 최상단이라, 신규 진입은 분할로 나누고 손절폭은 갭을 감안해 넓히는 편이 안전합니다."
- strategy와 checkpoints는 '조건(수치) → 행동(구체적 수단)' 두 부분을 모두 갖춘다.
  ⛔ 행동부가 추상 명사로 끝나면 실패다. 아래는 전부 실패한 문장이다.
     "위험 관리를 철저히 점검합니다" / "지수 방어력을 확인합니다" / "가격 흐름을 주시합니다" / "비중 기준을 점검합니다"
     — 조건은 있는데 '무엇을 어떻게'가 없다.
  ✓ 행동부에는 실제로 만질 수 있는 수단을 적는다: 진입 수량·분할 횟수·손절폭·비중 유지/축소·대기 여부·확인할 지표.
     좋음: "코스피 20일 변동성이 73%로 자국 5년 최상단이라, 신규 진입 수량을 평소의 절반 이하로 나누고 손절폭을 갭까지 감안해 잡을지 점검합니다."
     좋음: "미 10년물이 4.7% 위에 머무는 동안에는 고평가 성장주 비중을 늘리지 않는 쪽으로 판단하고, 금리가 내려오면 다시 확인합니다."
  ⛔ 단, 행동부에 [실측 데이터]에 없는 수치를 지어내지 마라(예: 임의의 현금 비중 %·목표가).
     수치가 없으면 '절반 이하·분할·유지·축소·대기' 같은 방식으로 표현한다.
- 수급은 최근일과 5거래일 누적의 방향이 다르면 반드시 둘 다 언급한다(하루 대량 매매가 그 주의 핵심 사건일 수 있다).
- 같은 지표를 여러 항목에서 반복하지 마라. 항목마다 다른 데이터를 쓴다.

1) headline: 이번 주를 규정하는 제목(15자 이내). 데이터에서 가장 큰 변화 한 가지를 잡는다.
2) sub: 헤드라인을 뒷받침하는 2문장. 지수·수급·원자재 중 서로 다른 축을 엮어 자금 흐름을 설명한다.
3) bullets: 자산군별 핵심 요약 5개 — tag는 [주식/원자재/암호화폐/부동산/수급] 각 1개, text는 수치 포함 1문장.
4) issue: 이번 주 시장을 '왜 이렇게 움직였나'로 구조 분해한 3개 — k는 [촉매/증폭/자금 흐름] 순.
   촉매 = 이번 주 변화를 일으킨 방아쇠. **[실측 데이터] 중 절대값이 가장 큰 등락을 낸 지표를 우선 고르고,
          headline이 지목한 사건과 반드시 같은 것을 가리켜야 한다**(헤드라인은 유가인데 촉매는 실적 일정, 같은 어긋남 금지) / 증폭 = 그 충격을 키운 요인(변동성·수급·이슈)
   / 자금 흐름 = 결과적으로 돈이 어디서 어디로 갔는지(위험자산 ↔ 안전자산).
   각 1~2문장, 수치를 포함하고 셋이 하나의 인과로 이어져야 한다.

5) strategy: 자산배분 실전 전략 5개 — title은 [현금·헤지/주식/암호화폐/부동산/매크로] 순. 각 1~2문장, 수치와 조건을 반드시 포함한다.
   ⛔ 매수·매도·비중 확대를 권하는 문장은 쓰지 마라. '소량 매수를 검토합니다'처럼 '검토'를 붙여 우회하는 것도 금지다.
      무엇을 확인하고 어떤 기준으로 판단할지만 쓴다.
   ⛔ 암호화폐 항목은 '포트폴리오 5% 이하 유지'가 이 앱의 공통 원칙이다. 비중 확대를 시사하는 표현을 쓰지 마라.
   ✓ 화법은 '~을 확인합니다 / ~인지 점검합니다 / ~은 신중하게 판단합니다'.
      '분할 접근을 유의합니다'처럼 목적어와 서술어가 어울리지 않는 문장은 쓰지 마라.
   ✓ 각 title이 다룰 범위(벗어나지 마라):
      현금·헤지 = 현금 비중·환헤지·안전자산 / 주식 = 지수·진입 방식·손절폭 / 암호화폐 = 코인 비중(5% 이하)
      부동산 = 주택 가격·정책·대출 / 매크로 = 금리·물가·FOMC가 자산 비중(채권 듀레이션·성장주 등)에 주는 영향
   ⛔ 매크로·주식 항목에서 개인 대출 이야기를 하지 마라(부동산 항목과 중복된다).
6) checkpoints: 다음 주 체크포인트 5개 — k는 [통화정책/주식/원자재·코인/부동산/환율·금리].
   각 항목에 확인할 구체적 수치나 날짜를 넣는다.

[실측 데이터]
${facts}`, AI_SCHEMA, { temperature: 0.4 })
    if (g.ok && g.data && g.data.headline && (g.data.bullets?.length ?? 0) >= 3) ai = { ...g.data, strategy: sanitize(g.data.strategy), source: 'gemini' }
  } catch { /* 폴백 */ }
  if (!ai) {
    // 결정론 폴백 — 실측 숫자만 조립
    ai = {
      source: 'fallback',
      headline: `코스피 주간 ${p(kospi?.weekPct)}${extremeStr ? ' · 변동성 극단' : ''}`,
      sub: `주간(${weekRange}) 코스피 ${p(kospi?.weekPct)}·나스닥 ${p(nasdaq?.weekPct)}. ${extremeStr ? `${extremeStr} 변동성이 자국 역사 극단 구간입니다.` : '지표별 상세는 아래 섹션을 확인하세요.'}`,
      issue: [
        { k: '촉매', text: `WTI ${wti?.close ?? '—'}$(${p(wti?.weekPct)})·미10Y ${us10?.close ?? '—'}% 등 매크로 변수가 이번 주 방아쇠였습니다.` },
        { k: '증폭', text: extremeStr ? `${extremeStr} 변동성이 자국 5년 기준 극단 구간이라 같은 충격에도 낙폭이 커졌습니다.` : `코스피 ${p(kospi?.weekPct)}·나스닥 ${p(nasdaq?.weekPct)}로 지수 변동이 이어졌습니다.` },
        { k: '자금 흐름', text: krFlow ? `코스피에서 최근일 외국인 ${jo(krFlow.day.foreign)}·개인 ${jo(krFlow.day.personal)}로 매매 주체가 갈렸고, 금은 ${p(gold?.weekPct)}였습니다.` : `금 ${p(gold?.weekPct)}·비트코인 ${p(btc?.weekPct)}로 위험·안전자산이 갈렸습니다.` },
      ],
      bullets: [
        { tag: '주식', text: `코스피 ${p(kospi?.weekPct)}·코스닥 ${p(kosdaq?.weekPct)}·S&P500 ${p(sp?.weekPct)}·나스닥 ${p(nasdaq?.weekPct)}.` },
        { tag: '원자재', text: `금 ${p(gold?.weekPct)}·WTI ${wti?.close ?? '—'}$(${p(wti?.weekPct)}).` },
        { tag: '암호화폐', text: `비트코인 ${p(btc?.weekPct)}·이더리움 ${p(eth?.weekPct)}.` },
        { tag: '부동산', text: seoulRe ? `서울 아파트 주간 ${p(seoulRe.w1)}(부동산원 주간 매매지수).` : '부동산 주간 지표 미집계.' },
        { tag: '수급', text: krFlow ? `코스피 최근일(${krFlow.lastDate.slice(5)}) 외국인 ${jo(krFlow.day.foreign)}·개인 ${jo(krFlow.day.personal)}, 최근 5거래일 누적 외국인 ${jo(krFlow.w5.foreign)}·기관 ${jo(krFlow.w5.institution)}입니다.` : '수급 미집계.' },
      ],
      strategy: fbStrategy,
      checkpoints: [
        { k: '통화정책', text: macro?.nextFomc ? `다음 FOMC ${macro.nextFomc} — 금리 시그널 확인` : 'FOMC 일정 확인' },
        { k: '주식', text: `코스피 ${kospi?.close ?? '—'} 지지 여부 · 실적 시즌 가이던스` },
        { k: '원자재·코인', text: `WTI ${wti?.close ?? '—'}$ 방향 · 비트코인 ${btc?.close ? Math.round(btc.close / 1000) + 'K$' : '—'} 지지` },
        { k: '부동산', text: '정부 정책·대출 규제 발표 여부' },
        { k: '환율·금리', text: `원/달러 ${fx?.close ?? '—'} · 미 10Y ${us10?.close ?? '—'}% 방향` },
      ],
    }
  }

  const out: WrCommon = {
    weekOf: kstDate(), weekRange,
    // ⚠️ 앵커가 실제 금요일인지 확인 후 표기 — 금요일 휴장이면 그 이전 거래일이 앵커가 되므로
    //    무조건 '직전 금요일(날짜)'로 쓰면 목요일 날짜에 금요일 라벨이 붙는다(실제 발생).
    anchorNote: anchor
      ? (new Date(`${anchor}T00:00:00Z`).getUTCDay() === 5
        ? `주간 = 직전 금요일(${anchor}) 종가 대비`
        : `주간 = 직전 금요일 기준 · 휴장으로 ${anchor} 종가 대비`)
      : '주간 = 직전 금요일 종가 대비(휴장 시 그 이전 거래일)',
    indices, macro, vol, catalyst, krFlow, realestate, reRank, reRent, bigCaps, ai,
  }
  if (indices.filter(i => i.weekPct != null).length >= 7) await setCache(key, out)   // 과반 실패 시 박제 금지
  return out
}

// ── 개인 섹션 ─────────────────────────────────────────────────────────────────
interface InvRow { ticker: string; name: string | null; market: string | null; purchase_price: number | null; quantity: number | null; currency: string | null }

// 자산군(클라우드 portfolio.py cls 대응 — 앱 SSOT getAssetType로 판정)
function clsOf(assetType: string, market: string): string {
  if (assetType === 'CRYPTO') return '암호화폐'
  if (assetType === 'COMMODITY') return '원자재'
  return market === 'KR' ? '국내 주식·ETF' : '해외 주식·ETF'
}

// 반도체 집중도 — 업종(industry) 기준 + 폴백 티커(클라우드 하드코딩 3종 확장)
// 반도체 판별 폴백 — Yahoo가 industry를 안 주는 KR 종목 + ETF 구성종목(영문명에 semiconductor가 없는 AVGO·MU류) 대응
const SEMI_FALLBACK = new Set([
  '005930', '000660', 'NVDA', 'MU', 'TSM', 'AMD', 'AVGO', 'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC',
  'INTC', 'ADI', 'NXPI', 'MRVL', 'ASML', 'MCHP', 'ON', 'ARM', 'SNDK', 'TER', 'ENTG', 'SWKS', 'MPWR',
  '240810', '042700', '036930', '039030', '403870', '058470', '000990', '005290',   // 원익IPS·한미반도체·주성엔지·이오테크닉스·HPSP·리노공업·DB하이텍·동진쎄미켐
])

// 🔬 테마·섹터 ETF 역맵(SECTOR_ETF SSOT — win-lose 학교 보드와 동일 체인): 티커 → 섹터 라벨. 미등록 ETF는 '광역 ETF(분산)'
const ETF_SECTOR_REV: Map<string, string> = (() => {
  const m = new Map<string, string>()
  const labelOf = (k: string) => SECTOR_LIST.find(s => s.key === k.split(':')[0])?.label ?? null
  for (const [k, v] of Object.entries(SECTOR_ETF)) {
    const lbl = labelOf(k)
    if (!lbl) continue
    if (v.us?.t) m.set(v.us.t.toUpperCase(), `${lbl} ETF`)
    if (v.kr?.t) m.set(v.kr.t.toUpperCase(), `${lbl} ETF`)
  }
  return m
})()

async function buildMe(uid: string, name: string, selfCalendar: boolean, cookie: string, base: string): Promise<WrMe> {
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: raw } = await admin.from('investments').select('ticker,name,market,purchase_price,quantity,currency').eq('user_id', uid)
  const rows = (raw ?? []) as InvRow[]

  // 같은 티커 다중 행(분할매수) 병합
  const merged = new Map<string, { ticker: string; name: string; market: string; currency: string; qty: number; cost: number }>()
  for (const r of rows) {
    const mkt = r.market === 'KR' ? 'KR' : (r.market ?? 'US')
    const k = `${r.ticker.toUpperCase()}:${mkt}`
    const qty = Number(r.quantity) || 0
    const cost = (Number(r.purchase_price) || 0) * qty
    const prev = merged.get(k)
    if (prev) { prev.qty += qty; prev.cost += cost }
    else merged.set(k, { ticker: r.ticker, name: r.name ?? r.ticker, market: mkt, currency: r.currency ?? (mkt === 'KR' ? 'KRW' : 'USD'), qty, cost })
  }
  const hs = Array.from(merged.values())
  if (hs.length === 0) {
    return { userId: uid, name, hasPortfolio: false, kpi: { totalKrw: 0, costKrw: 0, pnlPct: null, weekPct: null, count: 0, liveCoverage: 0 }, byClass: [], holdings: [], sectorImpact: [], risks: [], krExtreme: false, calendar: null, calendarNote: '포트폴리오를 등록하면 개인 분석이 시작됩니다.' }
  }

  // 환율(₩ 환산)
  let usdKrw = 1400
  try { const ex = await fetch(`${base}/api/exchange-rate`, { signal: AbortSignal.timeout(8_000), cache: 'no-store' }); if (ex.ok) { const j = await ex.json(); if (typeof j.rate === 'number' && j.rate > 500) usdKrw = j.rate } } catch { /* 폴백 */ }

  // 현재가 배치(앱 가격 SSOT /api/stock-price — KR·US·CRYPTO 전부 처리, 40개 청크)
  const priceMap = new Map<string, { price: number; krw: boolean }>()
  for (let i = 0; i < hs.length; i += 40) {
    const chunk = hs.slice(i, i + 40)
    try {
      const pr = await fetch(`${base}/api/stock-price`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chunk.map(h => ({ ticker: h.ticker, market: h.market }))), signal: AbortSignal.timeout(30_000), cache: 'no-store' })
      if (pr.ok) {
        const arr = await pr.json() as Array<{ ticker: string; currentPrice: number; currency: string }>
        for (const d of arr) priceMap.set(String(d.ticker).toUpperCase(), { price: Number(d.currentPrice) || 0, krw: d.currency === 'KRW' })
      }
    } catch { /* graceful — 해당 청크는 원가 폴백 */ }
  }

  // 유니버스 캐시(섹터·업종 조인 — 추가 fetch 0)
  const uni = (await getCache<ScreenedStock[]>('macro-screened-universe:v10', 8 * 24 * 3600_000)) ?? []
  const uniMap = new Map(uni.map(s => [s.ticker.toUpperCase(), s]))

  // 주간 수익률(주식·ETF=getTechCandles 캐시 / 크립토=야후 -USD 근사) — 동시성 4
  const weekMap = new Map<string, number | null>()
  const sectorMap = new Map<string, string | null>()
  for (let i = 0; i < hs.length; i += 4) {
    const batch = hs.slice(i, i + 4)
    await Promise.all(batch.map(async h => {
      const at = getAssetType(h.ticker, h.name, h.market)
      const key = h.ticker.toUpperCase()
      try {
        let candles: Px[] = []
        if (at === 'CRYPTO') candles = await yChart(`${key.replace(/-USD$/, '')}-USD`)
        else candles = (await getTechCandles(h.ticker, h.market as 'KR' | 'US', 'D')).map(c => ({ date: c.date, close: c.close }))
        weekMap.set(key, weeklyFrom(candles).weekPct)
      } catch { weekMap.set(key, null) }
      // 섹터: 크립토 고정 → ETF는 SECTOR_ETF 역맵(테마) 아니면 광역 ETF → 개별주는 유니버스 → getSector(7일 캐시)
      if (at === 'CRYPTO') sectorMap.set(key, '암호화폐')
      else if (at === 'ETF' || at === 'COMMODITY') sectorMap.set(key, ETF_SECTOR_REV.get(key) ?? (at === 'COMMODITY' ? '원자재' : '광역 ETF(분산)'))
      else {
        const u = uniMap.get(key)
        if (u?.sector && u.sector !== '—') sectorMap.set(key, u.sector)
        else { try { const s = await getSector(h.ticker, h.market); sectorMap.set(key, s && s !== '기타' ? s : null) } catch { sectorMap.set(key, null) } }
      }
    }))
  }

  // 매도/매수 신호(user_daily_briefings 최신 base_date — Jarvis 크론 적재분 = 앱 화면과 동일)
  const sigMap = new Map<string, { signal: 'SELL' | 'BUY' | 'HOLD'; title: string | null }>()
  try {
    const { data: sig } = await admin.from('user_daily_briefings').select('ticker,signal_type,briefing_title,base_date').eq('user_id', uid).order('base_date', { ascending: false }).limit(80)
    const latest = sig?.[0]?.base_date
    for (const s of sig ?? []) if (s.base_date === latest) sigMap.set(String(s.ticker).toUpperCase(), { signal: s.signal_type as 'SELL' | 'BUY' | 'HOLD', title: s.briefing_title ?? null })
  } catch { /* graceful */ }

  // 타점 신호등(캐시 재사용)
  const stockHs = hs.filter(h => { const at = getAssetType(h.ticker, h.name, h.market); return at === 'STOCK' || at === 'ETF' })
  let timingMap = new Map<string, { light?: 'green' | 'yellow' | 'red' } | null>()
  try {
    const tm = await getEntryTimings(stockHs.map(h => ({ ticker: h.ticker, market: h.market as 'KR' | 'US' })), 4)
    timingMap = tm as unknown as Map<string, { light?: 'green' | 'yellow' | 'red' } | null>
  } catch { /* graceful */ }

  // 조립
  let total = 0, cost = 0, live = 0
  const items = hs.map(h => {
    const key = h.ticker.toUpperCase()
    const at = getAssetType(h.ticker, h.name, h.market)
    const pm = priceMap.get(key)
    let valueKrw: number | null = null
    if (pm && pm.price > 0) { valueKrw = pm.price * h.qty * (pm.krw ? 1 : usdKrw); live++ }
    const costKrw = h.cost * (h.currency === 'USD' ? usdKrw : 1)   // ⚠️ 매입환율 미보유 → 현재 환율 근사(정직 표기)
    total += valueKrw ?? costKrw; cost += costKrw
    return { h, at, key, valueKrw, costKrw }
  })
  const totalSafe = total || 1

  const holdings: WrHolding[] = items.map(({ h, at, key, valueKrw, costKrw }) => {
    const weight = r1(((valueKrw ?? costKrw) / totalSafe) * 100)
    const weekPct = weekMap.get(key) ?? null
    const sig = sigMap.get(key)
    const t = timingMap.get(`${h.ticker}:${h.market}`)
    return {
      ticker: h.ticker, name: h.name, market: h.market, assetType: at, cls: clsOf(at, h.market),
      qty: h.qty, costKrw: Math.round(costKrw), valueKrw: valueKrw != null ? Math.round(valueKrw) : null, weight,
      pnlPct: valueKrw != null && costKrw > 0 ? r1((valueKrw / costKrw - 1) * 100) : null,
      weekPct, weekContrib: weekPct != null ? r1(weight * weekPct / 100 * 10) / 10 : null,
      sector: sectorMap.get(key) ?? null,
      signal: sig?.signal ?? null, signalTitle: sig?.title ?? null,
      timing: t?.light ?? null,
    }
  }).sort((a, b) => b.weight - a.weight)

  // 자산군 분해
  const byClsMap = new Map<string, number>()
  for (const h of holdings) byClsMap.set(h.cls, (byClsMap.get(h.cls) ?? 0) + h.weight)
  const byClass = Array.from(byClsMap.entries()).map(([cls, weight]) => ({ cls, weight: r1(weight) })).sort((a, b) => b.weight - a.weight)

  // 섹터 기여(⭐ 시장→내 계좌 연결)
  // ⚠️ GICS 원문(Technology·Energy)과 ETF 테마 한글 라벨(광역 ETF(분산)…)이 섞이면 한 표에 한·영이 혼재한다.
  //    GICS_SECTOR_META(SSOT)로 영문만 한글화하고 이미 한글인 라벨은 그대로 둔다.
  const secKo = (s: string) => GICS_SECTOR_META[s]?.ko ?? s
  const secAgg = new Map<string, { weight: number; contrib: number; known: boolean }>()
  for (const h of holdings) {
    const sec = secKo(h.sector ?? '미분류')
    const cur = secAgg.get(sec) ?? { weight: 0, contrib: 0, known: false }
    cur.weight += h.weight
    if (h.weekContrib != null) { cur.contrib += h.weekContrib; cur.known = true }
    secAgg.set(sec, cur)
  }
  const sectorImpact = Array.from(secAgg.entries())
    .map(([sector, v]) => ({ sector, weight: r1(v.weight), weekPct: v.known && v.weight > 0 ? r1(v.contrib / v.weight * 100) : null, contrib: v.known ? r1(v.contrib) : null }))
    .sort((a, b) => (a.contrib ?? 0) - (b.contrib ?? 0))

  // 🔬 반도체 집중도 — ETF 투시(look-through) 포함.
  //    직접 보유만 세면 코어 ETF 안의 반도체를 통째로 놓친다(실측: TIGER 200 내 삼성전자 32.8%+SK하이닉스 27.5%=60.2%).
  //    X-Ray SSOT(getEtfComposition·7일 캐시) 재사용 — 추가 수집 부담 작음.
  //    ⚠️ 구성은 상위 종목만 제공되므로 결과는 '하한값'(최소 이만큼)이다. 커버리지를 함께 표기해 잰 척하지 않는다.
  const isSemi = (ticker?: string | null, name?: string | null) => {
    const t = String(ticker ?? '').toUpperCase().replace(/\.(KS|KQ)$/, '')
    if (t && SEMI_FALLBACK.has(t)) return true
    if (t && /semiconductor/i.test(String(uniMap.get(t)?.industry ?? ''))) return true
    return /반도체|semiconduct/i.test(String(name ?? ''))
  }
  const semiDirect = r1(holdings.filter(h => isSemi(h.ticker, h.name)).reduce((s, h) => s + h.weight, 0))
  let semiEtf = 0, etfCov = 0
  try {
    const etfs = holdings.filter(h => h.assetType === 'ETF' && h.weight > 0)
    for (let i = 0; i < etfs.length; i += 4) {
      const comps = await Promise.all(etfs.slice(i, i + 4).map(async h =>
        ({ h, c: await getEtfComposition(h.ticker, h.market).catch(() => null) })))
      for (const { h, c } of comps) {
        if (!c || !c.isEquityEtf || c.isLeveraged) continue   // 채권·원자재·레버리지(스왑 구조)는 분해 부적합
        const inner = c.topHoldings.reduce((s, x) => s + (x.weight ?? 0), 0)
        const semiIn = c.topHoldings.filter(x => isSemi(x.ticker, x.name)).reduce((s, x) => s + (x.weight ?? 0), 0)
        semiEtf += h.weight * semiIn / 100
        etfCov += h.weight * inner / 100
      }
    }
  } catch { /* graceful — 분해 실패 시 직접 보유분만 */ }
  const semiW = r1(semiDirect + semiEtf)
  const semiNote = semiEtf >= 0.05
    ? `직접 ${semiDirect}% + ETF 투시 ${r1(semiEtf)}%p — ETF 구성 상위 종목만 분해(포트 ${r1(etfCov)}% 커버)라 실제는 이보다 클 수 있습니다`
    : '직접 보유 기준(업종+대표 반도체 티커) — 보유 ETF의 구성 종목이 제공되지 않았습니다'
  const top3W = r1(holdings.slice(0, 3).reduce((s, h) => s + h.weight, 0))
  const fxW = r1(items.filter(({ h, at }) => h.currency === 'USD' && at !== 'CRYPTO').reduce((s, { valueKrw, costKrw }) => s + ((valueKrw ?? costKrw) / totalSafe) * 100, 0))
  const cryptoW = r1(holdings.filter(h => h.assetType === 'CRYPTO').reduce((s, h) => s + h.weight, 0))
  const lv = (v: number, mid: number, hi: number): WrRisk['level'] => v >= hi ? 'bad' : v >= mid ? 'warn' : 'ok'
  const risks: WrRisk[] = [
    { key: 'semi', label: '반도체 집중도(ETF 투시)', value: semiW, unit: '%', level: lv(semiW, 40, 60), note: semiNote },
    { key: 'top3', label: '상위 3종목 집중도', value: top3W, unit: '%', level: lv(top3W, 55, 70), note: '평가액 비중 상위 3종목 합' },
    { key: 'fx', label: '환노출(달러 자산)', value: fxW, unit: '%', level: lv(fxW, 50, 75), note: '통화 USD 자산 비중(코인 제외)' },
    // ⚠️ 임계는 앱 자체 가드(코인 랩 '≤5% 권장')와 일치시킨다 — 클라우드 원본의 20/35를 쓰면
    //    '권장 상한 5%'라 써놓고 11.8%를 '적정'으로 판정하는 자기모순이 된다(제2원칙).
    { key: 'crypto', label: '암호화폐 비중', value: cryptoW, unit: '%', level: lv(cryptoW, 5, 10), note: '권장 상한 5% — 잃어도 되는 돈만(10% 초과는 위험)' },
    { key: 'cash', label: '현금 비중', value: null, unit: '%', level: 'unknown', note: '앱에 현금 미등록 — 증권사 예수금·CMA는 직접 확인' },
  ]

  // 🌪️ 코스피 극단 변동 + KR 보유
  let krExtreme = false
  try { const cv = await computeCountryVol(); krExtreme = cv?.byOrigin?.KR?.verdict === 'extreme' && holdings.some(h => h.market === 'KR') } catch { /* graceful */ }

  // 개인 캘린더(본인 조회일 때만 — event-calendar가 세션 기준이라 교사 대리 조회 시 잘못된 데이터가 됨)
  let calendar: CalEvent[] | null = null
  let calendarNote: string | null = null
  if (selfCalendar) {
    try {
      const r = await fetch(`${base}/api/event-calendar`, { headers: { cookie }, signal: AbortSignal.timeout(30_000), cache: 'no-store' })
      if (r.ok) { const j = await r.json() as EventCalendarResult; calendar = (j.events ?? []).filter(e => e.dDay >= 0 && e.dDay <= 14) }
    } catch { calendarNote = '캘린더 로딩 실패 — 자산 관리 탭에서 확인' }
  } else calendarNote = '어닝·배당 캘린더는 본인 로그인 화면에서만 제공됩니다.'

  const weekPct = holdings.some(h => h.weekContrib != null) ? r1(holdings.reduce((s, h) => s + (h.weekContrib ?? 0), 0)) : null
  return {
    userId: uid, name, hasPortfolio: true,
    kpi: { totalKrw: Math.round(total), costKrw: Math.round(cost), pnlPct: cost > 0 ? r1((total / cost - 1) * 100) : null, weekPct, count: holdings.length, liveCoverage: Math.round(live / hs.length * 100) },
    byClass, holdings, sectorImpact, risks, krExtreme, calendar, calendarNote,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

  // teacher 역할 확인 + ?userId= 대리 조회(teacher만)
  const { data: myProfile } = await admin.from('profiles').select('role,full_name,email').eq('id', user.id).single()
  const isTeacher = myProfile?.role === 'teacher'
  const reqUserId = new URL(req.url).searchParams.get('userId')
  const targetId = (isTeacher && reqUserId) ? reqUserId : user.id
  const selfView = targetId === user.id

  let targetName = myProfile?.full_name || myProfile?.email || '학생'
  if (!selfView) {
    const { data: tp } = await admin.from('profiles').select('full_name,email').eq('id', targetId).single()
    targetName = tp?.full_name || tp?.email || '학생'
  }

  // 캐시(개인 6h·보유 지문 무효화)
  const fp = await holdingsFingerprint(targetId)
  const meKey = `weekly-report-me-v5:${targetId}:${kstDate()}:${fp}:${selfView ? 's' : 't'}`   // v4: 코인 임계 5/10(앱 가드 정합) + 반도체 집중도 ETF 투시(look-through) 포함
  let me = await getCache<WrMe>(meKey, 6 * 3600_000)
  const common = await buildCommon(base)
  if (!me) {
    me = await buildMe(targetId, targetName, selfView, cookie, base)
    if (me.hasPortfolio && me.kpi.liveCoverage >= 50) await setCache(meKey, me)   // 가격 과반 실패 시 박제 금지
  }

  // teacher 로스터(보유 있는 학생 우선 정렬)
  let students: { id: string; name: string }[] | undefined
  if (isTeacher) {
    const { data: ps } = await admin.from('profiles').select('id,full_name,email')
    const { data: inv } = await admin.from('investments').select('user_id')
    const has = new Set((inv ?? []).map(r => r.user_id))
    students = (ps ?? []).map(p => ({ id: p.id, name: (p.full_name || p.email || '') as string, own: has.has(p.id) }))
      .sort((a, b) => Number((b as { own?: boolean }).own) - Number((a as { own?: boolean }).own))
      .map(({ id, name }) => ({ id, name }))
  }

  const result: WeeklyReportResult = { common, me, students, isTeacherView: !selfView, asOf: new Date().toISOString() }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
