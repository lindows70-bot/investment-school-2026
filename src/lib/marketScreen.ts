// 학생 시장 화면(/s/market)의 순수 규칙 — 원천 조각 상태·기준 시각 문구·몇 시간 전·순매매 배지·시장 합치기·등락 수 설명·업종 막대·걸러낸 개수 문구·분야 국면 말
//   화면(tsx)은 그리기만 하고, 판정·정렬·문구는 여기서 만든다 → scripts/verify-market-screen.mjs 가 실제 이 파일을 컴파일해 검증한다.
//   ⚠️ 서버 lib 에서는 **타입만** 가져온다(브라우저 번들에 서버 코드가 끌려오지 않게).
import type { Part } from './marketBoardShared'
import { pct, fxWon } from './studentFormat'
import { acceptFx } from './fxAccept'
import { TK } from './theme'
import type { KrIndexQuote, IntradayPoint, InvestorTotals, UpDownCount, KrMover, MoverList, KrIndustry, KrNews, KrIndexCode, KrMarket, KrMoverKind } from './krMarketBoard'
import type { FlowTopRow, FlowBoardSide, FlowWho } from './foreignOrgFlow'
import type { UsEtfIntraday, UsMover, UsMoverKind } from './usMarketBoard'
import type { CoinBoard } from './upbitMarket'
import type { CnnFngYear } from './cnnFng'
import type { CryptoFngYear } from './cryptoFng'
import type { FxTrend } from './fxTrend'
import type { StrongSectorsResult } from './strongSectors'
import type { RotQuadShared } from './rotationShared'

// ── 응답 모양(/api/market-board/*) — 화면이 쓰는 필드만 ─────────────────────
export interface KrBoardResp {
  indices: Part<KrIndexQuote[]>
  charts: Record<KrIndexCode, Part<IntradayPoint[]>>
  investorsAndBreadth: Record<KrMarket, Part<{ investors: InvestorTotals | null; upDown: UpDownCount | null }>>
  movers: Record<KrMarket, Record<KrMoverKind, Part<MoverList<KrMover>>>>
  industry: Part<{ items: KrIndustry[]; marketStatus: string | null; total: number | null }>
  news: Part<KrNews[]>
}
export interface FlowBoardResp {
  basis?: string
  individual?: { available: boolean; note: string; poolSize?: number | null; dataDate?: string | null }
  trends?: Part<{ checked: number }>
  markets: Record<KrMarket, Partial<Record<FlowWho, Part<{ bizdate: string | null } & FlowBoardSide>>>>
}
export interface UsBoardResp {
  etfs: { SPY: Part<UsEtfIntraday>; QQQ: Part<UsEtfIntraday> }
  movers: Record<UsMoverKind, Part<MoverList<UsMover>>>
  rules?: { minCapUsd?: number; newListingDays?: number }
}
export interface CoinBoardResp { board: Part<CoinBoard> }
export interface OverviewResp {
  fng: { cnn: Part<CnnFngYear>; crypto: Part<CryptoFngYear> }
  fx: Part<FxTrend>
  strongSectors: Part<StrongSectorsResult>
}

// ── 원천 조각 → 화면 상태 ───────────────────────────────────────────────────
/** 카드 하나가 보는 상태 — 불러오는 중 / 못 가져옴(요청 실패 또는 그 원천만 ok:false) / 받음 */
export type View<T> = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; data: T; asOf: string | null }

/** useJson 결과(state·data)에서 원천 조각 하나를 골라 상태로. pick 이 던지거나(모양이 다름) 조각이 ok:true 가 아니면 못 가져옴.
 *  '다시'로 다시 부르는 동안(state loading 인데 이전 data 가 남아 있음) 이전에 받은 조각은 그대로 보인다 —
 *  한 카드의 '다시'가 같은 응답을 쓰는 다른 카드까지 깜빡이게 하지 않게. 이전에 못 가져온 조각만 '불러오는 중'이 된다 */
export function viewOf<R, T>(res: { state: string; data: R | null }, pick: (d: R) => unknown): View<T> {
  const okOf = (): View<T> | null => {
    if (res.data == null) return null
    let p: unknown
    try { p = pick(res.data) } catch { return null }
    const o = p as { ok?: unknown; data?: unknown; asOf?: unknown } | null | undefined
    if (!o || o.ok !== true || o.data == null) return null
    return { kind: 'ok', data: o.data as T, asOf: typeof o.asOf === 'string' ? o.asOf : null }
  }
  if (res.state === 'idle') return { kind: 'loading' }
  if (res.state === 'loading') return okOf() ?? { kind: 'loading' }
  if (res.state !== 'ok') return { kind: 'failed' }
  return okOf() ?? { kind: 'failed' }
}

// ── 날짜·시각 문구 ──────────────────────────────────────────────────────────
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → '9/23(수)'. 못 읽으면 null */
export function mdDow(ymd: string): string | null {
  const m = YMD_RE.exec(ymd)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  return `${mo}/${d}(${DOW[dow]})`
}
/** 'YYYY-MM-DD' → '2025.11.20' (연간 고저 날짜처럼 해를 넘길 수 있는 날짜) */
export function ymdDot(ymd: string): string | null {
  const m = YMD_RE.exec(ymd)
  return m ? `${m[1]}.${Number(m[2])}.${Number(m[3])}` : null
}

/** 한국 시각 날짜·시:분 */
export function kstParts(ms: number): { ymd: string; hm: string } {
  const s = new Date(ms + 9 * 3600_000).toISOString()
  return { ymd: s.slice(0, 10), hm: s.slice(11, 16) }
}
/** 뉴욕 날짜(미국 장 마감일은 미국 날짜로 적는다 — 9/25 마감은 한국 시각으로 9/26 새벽이다) */
export function nyYmd(ms: number): string | null {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
    return YMD_RE.test(p) ? p : null
  } catch { return null }
}

/** 원천 기준 시각 → 화면 문구.
 *  장중(status OPEN) = 'HH:mm 기준'(한국 시각) · 마감(CLOSE/CLOSED) = '9/23(수) 장 마감' · 모름 = '9/23(수) HH:mm 기준'.
 *  zone 'NY' 는 마감일을 미국 날짜로 적고 장중 시각엔 '한국 시각'을 붙인다. iso 가 날짜만('YYYY-MM-DD')이면 날짜만. 못 읽으면 null(지어내지 않는다) */
export function asOfLabel(iso: string | null | undefined, status: string | null | undefined, zone: 'KST' | 'NY' = 'KST'): string | null {
  if (!iso) return null
  const st = status === 'OPEN' ? 'open' : status === 'CLOSE' || status === 'CLOSED' ? 'closed' : 'unknown'
  if (YMD_RE.test(iso)) {
    const d = mdDow(iso)
    return d ? (st === 'closed' ? `${d} 장 마감` : `${d} 기준`) : null
  }
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const k = kstParts(t)
  if (st === 'open') return zone === 'NY' ? `한국 시각 ${k.hm} 기준` : `${k.hm} 기준`
  if (st === 'closed') {
    const day = zone === 'NY' ? nyYmd(t) : k.ymd
    const d = day ? mdDow(day) : null
    if (!d) return null
    return zone === 'NY' ? `미국 ${d} 장 마감` : `${d} 장 마감`
  }
  const d = mdDow(k.ymd)
  return d ? `${d} ${k.hm} 기준` : null
}

/** 기기 시계가 이만큼까지 느려도 '방금'으로 본다. 이보다 더 미래 시각이면 틀린 값이라 표시하지 않는다(null) */
export const AGO_FUTURE_SLACK_MS = 5 * 60_000
/** 뉴스 시각 → '방금'·'N분 전'·'N시간 전'·'9/23(수)'. nowMs 는 **마운트 뒤** 값만 넘긴다(렌더 중 new Date() 금지). 못 읽거나 5분 넘게 미래면 null */
export function agoText(iso: string | null | undefined, nowMs: number): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const diff = nowMs - t
  if (diff < -AGO_FUTURE_SLACK_MS) return null
  if (diff < 60_000) return '방금'   // 기기 시계가 몇 분 느린 경우도 '방금'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 24 * 3600_000) return `${Math.floor(diff / 3600_000)}시간 전`
  return mdDow(kstParts(t).ymd)
}

// ── 내 종목 겹침(브라우저에서만) ───────────────────────────────────────────
/** 보유·목록을 같은 키로 — 시장 + 티커(대문자·공백 제거). 기록하기 화면의 보유 판정과 같은 정규화 */
export const holdingKey = (market: string, ticker: string) => `${market}:${ticker.trim().toUpperCase()}`

// ── 주체별 순매매 ───────────────────────────────────────────────────────────
export type FlowSide = 'buy' | 'sell'
export type FlowBadgeKey = 'mine' | 'streak' | 'together' | 'contrarian' | 'etf' | 'limit'
export interface FlowBadge { key: FlowBadgeKey; text: string }

/** 연속일 배지는 2일째부터 — 1일째는 '그날 처음'이라 따로 말할 게 없다 */
export const STREAK_MIN = 2

/** 한 줄의 배지. 며칠째는 **그 목록의 주체**(외국인이면 외국인 연속일)·**그 목록의 방향**과 같을 때만, 모르면(null) 생략.
 *  함께 = 외국인·기관이 그날 같은 방향(목록 방향과 같을 때만). 개인 목록에선 반대로 — 외국인·기관이 둘 다 개인과 반대 방향이면 그 사실.
 *  주가와 반대 = 산 날 내림·판 날 오름 */
export function flowBadges(
  row: Pick<FlowTopRow, 'foreignStreak' | 'organStreak' | 'together' | 'contrarian' | 'etf' | 'priceLimitBreak'> & { individualStreak?: FlowTopRow['individualStreak'] },
  side: FlowSide, investor: FlowWho, mine: boolean,
): FlowBadge[] {
  const out: FlowBadge[] = []
  if (mine) out.push({ key: 'mine', text: '내 종목' })
  const s = investor === 'FOREIGNER' ? row.foreignStreak : investor === 'ORGANIZATION' ? row.organStreak : row.individualStreak ?? null
  if (s && Math.abs(s.n) >= STREAK_MIN && (side === 'buy' ? s.n > 0 : s.n < 0)) {
    out.push({ key: 'streak', text: `${Math.abs(s.n)}일째${s.capped ? ' 이상' : ''}` })
  }
  if (investor === 'INDIVIDUAL') {
    if (row.together && row.together !== side) out.push({ key: 'together', text: side === 'buy' ? '외국인·기관은 팔았어요' : '외국인·기관은 샀어요' })
  } else if (row.together === side) out.push({ key: 'together', text: side === 'buy' ? '함께 샀어요' : '함께 팔았어요' })
  if (row.contrarian === true) out.push({ key: 'contrarian', text: '주가와 반대' })
  if (row.etf) out.push({ key: 'etf', text: 'ETF' })
  if (row.priceLimitBreak) out.push({ key: 'limit', text: '±30% 넘음' })
  return out
}

/** 코스피·코스닥 Top n 을 금액 크기로 합친다. 두 시장 각각의 Top n 을 합쳐 다시 n 개를 고르면 **합친 시장의 정확한 Top n** 이다
 *  (합친 Top n 에 드는 종목은 반드시 자기 시장 Top n 안에 있다). 한 시장을 못 가져오면 missing 에 넣고 남은 시장만으로 — 화면이 그 사실을 적는다 */
export function mergeFlowTop<R extends { netEok: number }>(parts: { market: KrMarket; rows: R[] | null }[], n: number): { rows: (R & { market: KrMarket })[]; missing: KrMarket[] } {
  const missing = parts.filter(p => p.rows == null).map(p => p.market)
  const all = parts.flatMap(p => (p.rows ?? []).map(r => ({ ...r, market: p.market })))
  all.sort((a, b) => Math.abs(b.netEok) - Math.abs(a.netEok))
  return { rows: all.slice(0, n), missing }
}

// ── 등락 종목 수 ────────────────────────────────────────────────────────────
/** 개수는 크기를 담지 못한다 — 지수 등락과 종목 수 방향이 어긋나면 그 사실을 한 줄로. 맞으면(또는 모르면) null.
 *  상승·하락 수만 비교한다(원천이 상한을 상승에 포함하는지 밝히지 않아 더하지 않는다) */
export function breadthNote(ud: Pick<UpDownCount, 'rise' | 'fall'> | null, indexPct: number | null): string | null {
  if (!ud || ud.rise == null || ud.fall == null || indexPct == null) return null
  if (indexPct >= 0.05 && ud.fall > ud.rise) return '지수는 올랐지만 내린 종목이 더 많아요 — 지수는 시가총액이 큰 회사 영향을 더 받아요.'
  if (indexPct <= -0.05 && ud.rise > ud.fall) return '지수는 내렸지만 오른 종목이 더 많아요 — 지수는 시가총액이 큰 회사 영향을 더 받아요.'
  return null
}

// ── 특징종목 걸러낸 사실 ─────────────────────────────────────────────────────
/** 국내: 가격제한폭(±30%) 밖이라 뺀 주식 수 → 문구. 0 이면 null */
export function krMoverFilterNote(filtered: Record<string, number> | null | undefined): string | null {
  const n = filtered?.priceLimitBreak ?? 0
  return n > 0 ? `하루 ±30%를 넘은 ${n}종목(상장 첫날·거래 재개·정리매매)은 뺐어요.` : null
}

/** 미국: 뺀 이유별 개수 → 문구. 빼 낸 게 없어도 규칙은 적는다(3억 달러 = 300,000,000) */
export function usMoverFilterNote(
  filtered: Record<string, number> | null | undefined, scanned: number | null | undefined,
  minCapUsd: number, newDays: number,
): string {
  const cap = `시가총액 ${minCapUsd / 1e8}억 달러 미만`
  const fresh = `상장 ${newDays}일 이내`
  const f = filtered ?? {}
  const parts: string[] = []
  if ((f.smallCap ?? 0) > 0) parts.push(`${cap} ${f.smallCap}`)
  if ((f.newListing ?? 0) > 0) parts.push(`${fresh} ${f.newListing}`)
  if ((f.rightsUnits ?? 0) > 0) parts.push(`권리·유닛 ${f.rightsUnits}`)
  const pre = scanned ? `순위 ${scanned}위 안에서 ` : ''
  return parts.length ? `${pre}${parts.join(' · ')}종목은 뺐어요.` : `${cap}·${fresh}는 빼고 보여줘요.`
}

// ── 특징종목 ETF·ETN ────────────────────────────────────────────────────────
/** 국내 특징종목에서 ETF·ETN 을 뺄지 — 기본은 주식만(레버리지 ETN 이 상승률 상위를 채운다: 2026-09 실측 코스피 상승 Top5 중 3개).
 *  removed = 받은 목록 안에서 뺀 개수(원천 전체 순위가 아니라 받은 상위 N개 기준) */
export function filterEtp<T extends { etp: 'ETF' | 'ETN' | null }>(items: T[], includeEtp: boolean): { items: T[]; removed: number } {
  if (includeEtp) return { items: items.slice(), removed: 0 }
  const kept = items.filter(i => i.etp == null)
  return { items: kept, removed: items.length - kept.length }
}

// ── 업종 ───────────────────────────────────────────────────────────────────
/** 보합 경계 — studentFormat.pct·upDown 과 같은 ±0.05% */
export const FLAT_PCT = 0.05
/** 등락률 순 상위 n(오른 순 = 오른 업종만 큰 값부터, 내린 순 = 내린 업종만 작은 값부터).
 *  등락률 없는·보합(|x|<0.05 — 화면에서 '0.0%' 회색)·±30% 의심 업종은 순위에서 뺀다 —
 *  모두 오른 날 '많이 내린 업종'에 +0.3% 업종이 뜨지 않게(없으면 빈 목록 → 화면이 '그날 내린 업종이 없어요'),
 *  상장 첫날 한 종목 탓인 +162% 업종이 1위가 되지 않게(의심 업종은 suspectIndustries 로 따로 보인다) */
export function topIndustries(items: KrIndustry[], dir: 'up' | 'down', n: number): KrIndustry[] {
  const withPct = items.filter((i): i is KrIndustry & { changePct: number } =>
    !i.limitBreakSuspect && typeof i.changePct === 'number' && Number.isFinite(i.changePct)
    && (dir === 'up' ? i.changePct >= FLAT_PCT : i.changePct <= -FLAT_PCT))
  withPct.sort((a, b) => (dir === 'up' ? b.changePct - a.changePct : a.changePct - b.changePct))
  return withPct.slice(0, n)
}

/** ±30% 넘는 종목이 섞여 순위에서 뺀 업종(그 방향만 — 오른 순엔 오른 의심 업종). 등락이 큰 순 */
export function suspectIndustries(items: KrIndustry[], dir: 'up' | 'down'): KrIndustry[] {
  return items
    .filter((i): i is KrIndustry & { changePct: number } => i.limitBreakSuspect && typeof i.changePct === 'number' && (dir === 'up' ? i.changePct > 0 : i.changePct < 0))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
}
/** 뺀 업종 한 조각 — '가정용품 +162.3%(12종목 중 오른 4·내린 5)'. 종목 수를 모르면 괄호를 줄인다 */
export function suspectIndustryText(g: Pick<KrIndustry, 'name' | 'changePct' | 'count' | 'rise' | 'fall'>): string {
  const p = g.changePct == null ? '' : ` ${pct(g.changePct)}`
  const inner = [g.rise != null ? `오른 ${g.rise}` : null, g.fall != null ? `내린 ${g.fall}` : null].filter(Boolean).join('·')
  const paren = g.count != null ? `(${g.count}종목${inner ? ` 중 ${inner}` : ''})` : inner ? `(${inner})` : ''
  return `${g.name}${p}${paren}`
}

/** 막대 폭(%) — 보이는 업종 중 가장 크게 움직인 것(±30% 넘는 의심 업종 제외)을 100 으로. 의심 업종은 100(넘침),
 *  움직였으면 최소 2(안 보이는 막대 방지), 0% 는 0 */
export function industryBars(items: Pick<KrIndustry, 'changePct' | 'limitBreakSuspect'>[]): number[] {
  const max = Math.max(0, ...items.filter(i => !i.limitBreakSuspect && i.changePct != null).map(i => Math.abs(i.changePct as number)))
  return items.map(i => {
    if (i.changePct == null) return 0
    if (i.limitBreakSuspect) return 100
    const a = Math.abs(i.changePct)
    if (a === 0 || max === 0) return 0
    return Math.max(2, Math.min(100, Math.round(a / max * 100)))
  })
}

// ── 요즘 강한 분야 ──────────────────────────────────────────────────────────
/** 섹터 로테이션 국면을 학생 말로 — 강하다·약하다 = 다른 분야 평균과 견준 1달 흐름, 더 강해지는·식는 = 최근 1주 흐름.
 *  (로테이션 화면의 '주도·과열·태동·이탈'은 '자금 유입'을 함께 말해 쓰지 않는다 — 주가 계산이지 돈 흐름이 아니다) */
export const QUAD_TEXT: Record<RotQuadShared, string> = {
  leading: '강하고 더 강해지는 중',
  weakening: '강했지만 식는 중',
  improving: '약했지만 살아나는 중',
  lagging: '약하고 더 약해지는 중',
}

// ── 공포·탐욕 1년 ───────────────────────────────────────────────────────────
/** 기록 기간 이름 — 1년치면 '1년', 아니면 '2025.11.20~2026.9.26'(원천 기록이 1년에 못 미칠 때 '연간'이라 부르지 않는다) */
export function fngRangeName(range: { from: string; to: string; fullYear: boolean } | null | undefined): string | null {
  if (!range) return null
  if (range.fullYear) return '1년'
  const a = ymdDot(range.from), b = ymdDot(range.to)
  return a && b ? `${a}~${b}` : null
}

/** 연간 고저에 '지금' 값을 반영 — 1년 요약(30분 캐시)보다 지금 값(다른 요청)이 새것일 수 있다.
 *  지금 값이 최고를 넘으면(또는 같으면) 최고 = 지금(date null), 최저도 같게. 둘 다 없으면 null */
export function fngExtremes(
  now: number | null,
  high: { v: number; date: string } | null, low: { v: number; date: string } | null,
): { high: { v: number; date: string | null } | null; low: { v: number; date: string | null } | null } {
  let h: { v: number; date: string | null } | null = high
  let l: { v: number; date: string | null } | null = low
  if (now != null) {
    if (h && now >= h.v) h = { v: now, date: null }
    if (l && now <= l.v) l = { v: now, date: null }
  }
  return { high: h, low: l }
}

/** 순매매 각주의 범위 — 실제로 목록에 들어간 시장만. 합침인데 한 시장을 못 가져왔으면 그 사실을 범위에 적는다 */
export function flowScopeText(shown: KrMarket[], missing: KrMarket[]): string {
  const NAME: Record<KrMarket, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
  const got = shown.filter(m => !missing.includes(m))
  if (got.length >= 2) return '코스피·코스닥을 합친'
  if (got.length === 1) return shown.length >= 2 ? `${NAME[got[0]]}만 본(${missing.map(m => NAME[m]).join('·')} 못 가져옴)` : NAME[got[0]]
  return ''
}

// ── 홈 요약 ─────────────────────────────────────────────────────────────────
/** 미니 선(스파크라인)에 쓸 점 — 값이 있는 점만 시간순으로 max 개 이하. 2점 미만이거나 **모든 값이 같으면 null**
 *  (업비트 차트가 실패하면 stock-price 가 지금 가격으로 가짜 평평선을 채운다 — 평평한 선은 '움직임 없음'이 아니라 '못 가져옴') */
export function sparkSeries(points: unknown, max = 80): { t: number; v: number }[] | null {
  if (!Array.isArray(points)) return null
  const pts = (points as { t?: unknown; v?: unknown }[])
    .filter((p): p is { t: number; v: number } => !!p && typeof p.t === 'number' && Number.isFinite(p.t) && typeof p.v === 'number' && Number.isFinite(p.v))
    .map(p => ({ t: p.t, v: p.v }))
    .sort((a, b) => a.t - b.t)
  if (pts.length < 2) return null
  if (pts.every(p => p.v === pts[0].v)) return null
  if (pts.length <= max) return pts
  const step = Math.ceil(pts.length / (max - 1))
  const out: { t: number; v: number }[] = []
  for (let i = 0; i < pts.length - 1; i += step) out.push(pts[i])
  out.push(pts[pts.length - 1])   // 지금 값은 반드시 남긴다
  return out
}

/** 공포·탐욕 1년 요약 — 시장 화면(FearGreedYear)과 홈(FearGreed)이 **같은 값·같은 날짜·같은 기간 이름**을 쓰게 한 곳에서 만든다(제2원칙).
 *  now = 지금 값(홈 카드와 같은 원천 우선) · y = overview 의 cnn/crypto 1년 요약. 고저가 없으면 null */
export function fngYearSummary(
  now: number | null,
  y: { yearHigh: { v: number; date: string } | null; yearLow: { v: number; date: string } | null; range: { from: string; to: string; fullYear: boolean } | null },
): { fullYear: boolean; rangeText: string | null; high: { v: number; when: string } | null; low: { v: number; when: string } | null } | null {
  const ext = fngExtremes(now, y.yearHigh, y.yearLow)
  if (!ext.high && !ext.low) return null
  const name = fngRangeName(y.range)
  const when = (d: string | null) => (d ? ymdDot(d) ?? d : '지금')
  return {
    fullYear: name === '1년',
    rangeText: name == null ? null : name === '1년' ? '최근 1년' : `기록 기간(${name})`,
    high: ext.high ? { v: ext.high.v, when: when(ext.high.date) } : null,
    low: ext.low ? { v: ext.low.v, when: when(ext.low.date) } : null,
  }
}

/** 홈 한 줄 — '최근 1년 최고 71(2026.5.1) · 최저 5(2025.11.20)'. 기록이 1년에 못 미치면 '기록 기간(…) 최고 …',
 *  기간 자체를 모르면(range null) '기록 기간 최고 …' — 기간 이름 없이 '최고'만 두면 전체 역사의 최고로 읽힌다 */
export function fngYearLine(s: NonNullable<ReturnType<typeof fngYearSummary>>): string {
  const parts = [s.high ? `최고 ${s.high.v}(${s.high.when})` : null, s.low ? `최저 ${s.low.v}(${s.low.when})` : null].filter(Boolean).join(' · ')
  return `${s.rangeText ?? '기록 기간'} ${parts}`
}

/** 하나은행 환율 카드 한 줄 — 카드가 보여 주는 값(shownV)과 앱 환율(/api/exchange-rate: 한눈 시황·내 자산이 쓰는 값)이 **다를 때만** 이유를 말한다.
 *  앱 환율도 하나은행이 1순위라 보통은 같다. 다른 경우는 둘뿐 — ①하나은행을 못 받아 앱이 다른 원천·마지막 성공값으로 떨어짐
 *  ②같은 하나은행이지만 다른 시각의 고시(하루에도 여러 번 바뀌고, 카드는 확정된 날 값을 크게 보인다). 앱 환율을 못 받았으면 null(그 화면이 스스로 밝힌다) */
export function fxBasisNote(app: unknown, shownV: number): string | null {
  const rate = acceptFx(app)
  if (rate == null || Math.abs(rate - shownV) < 0.005) return null
  return (app as { source?: unknown }).source === 'hana'
    ? `한눈 시황·내 자산은 같은 하나은행 고시의 다른 시각 값(${fxWon(rate)})으로 계산해요 — 고시는 하루에도 여러 번 바뀌어요.`
    : `지금은 하나은행 고시를 새로 못 받아 한눈 시황·내 자산은 다른 환율(${fxWon(rate)})로 계산 중이에요 — 조금 다를 수 있어요.`
}

// ── 공포·탐욕 색 ────────────────────────────────────────────────────────────
/** 0(극단 공포) 빨강 → 25 주황 → 50 노랑 → 75 연두 → 100(극단 탐욕) 초록. 값 위치로 **연속** 보간한다 —
 *  CNN·alternative.me 의 구간 경계가 서로 달라(예: CNN 공포 25~45) 칸을 나누면 우리 임계값이 되므로 경계를 긋지 않는다.
 *  ⚠️ 이 색은 가격 등락(한국식 빨강=상승)과 무관한 공포·탐욕 전용 척도다. */
const FNG_STOPS = [TK.red500, TK.orange400, TK.yellow500, TK.lime400, TK.green500]
const rgbOf = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
export function fngColor(v: number): string {
  const x = (Math.max(0, Math.min(100, Number.isFinite(v) ? v : 50)) / 100) * (FNG_STOPS.length - 1)
  const i = Math.min(FNG_STOPS.length - 2, Math.floor(x))
  const t = x - i
  const a = rgbOf(FNG_STOPS[i]), b = rgbOf(FNG_STOPS[i + 1])
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * t)).join(', ')})`
}

// ── 투자자별 합 ──────────────────────────────────────────────────────────────
/** 개인·외국인·기관·기타법인 넷의 합 한 줄 — 0 이면 '누가 판 만큼 누가 샀다', 기타법인을 못 받았으면 그 사실. 셋 중 하나라도 없으면 null */
export function investorSumNote(inv: { personal: number | null; foreign: number | null; institutional: number | null; otherCorp: number | null } | null | undefined): string | null {
  if (!inv || inv.personal == null || inv.foreign == null || inv.institutional == null) return null
  if (inv.otherCorp == null) return '기타법인 값을 못 받아 셋만 더하면 0이 안 돼요.'
  const sum = inv.personal + inv.foreign + inv.institutional + inv.otherCorp
  return Math.abs(sum) <= 1 ? '넷을 더하면 0이에요 — 누가 판 만큼 누가 샀다는 뜻이에요.' : `넷을 더하면 ${sum > 0 ? '+' : '−'}${Math.abs(sum).toLocaleString('ko-KR')}억 — 원천 값 그대로예요.`
}

// ── 차트 눈금 ────────────────────────────────────────────────────────────────
/** 보기 좋은 세로 눈금 — lo~hi 안에 1·2·2.5·5×10^k 간격으로 n 개 안팎(네이버·증권 앱처럼 7,011 대신 7,020 같은 둥근 값) */
export function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || n < 2) return []
  const raw = (hi - lo) / (n - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  // 간격 = raw 를 넘지 않는 가장 큰 둥근 값 → lo~hi 안에 n-1 ~ 2n 개(위로 올리면 7,017~7,137 에 선이 2개뿐이었다)
  const step = [5, 2.5, 2, 1].map(m => m * mag).find(s => s <= raw) ?? mag
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step)
  return out
}
/** 장중 가로 눈금 — 첫 점 뒤 첫 정각부터 stepH 시간마다(국내 9·11·13·15시). 한국 시각은 UTC+9 정시라 UTC 정각과 같다 */
export function hourTicks(t0: number, t1: number, stepH = 2): number[] {
  const H = 3_600_000
  const out: number[] = []
  if (!(t1 > t0)) return out
  for (let t = Math.ceil(t0 / H) * H; t <= t1; t += stepH * H) out.push(t)
  return out
}
/** 날짜 가로 눈금 — 45일 이하면 안쪽 4곳을 'M.D' 로, 그보다 길면 매달 1일을 'N월' 로(7개 넘으면 두 달마다) */
export function dayTicks(t0: number, t1: number): { ticks: number[]; fmt: (t: number) => string } {
  const md = (t: number) => { const [, m, d] = kstParts(t).ymd.split('-'); return `${Number(m)}.${Number(d)}` }
  if (!(t1 > t0)) return { ticks: [], fmt: md }
  if (t1 - t0 <= 45 * 86_400_000) return { ticks: [1, 3, 5, 7].map(k => Math.round(t0 + ((t1 - t0) * k) / 8)), fmt: md }
  const months: number[] = []
  const [y0, m0] = kstParts(t0).ymd.split('-').map(Number)
  for (let y = y0, m = m0 + 1; ; m++) {
    if (m > 12) { m = 1; y++ }
    const t = Date.parse(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+09:00`)
    if (t > t1) break
    months.push(t)
  }
  const ticks = months.length > 6 ? months.filter((_, i) => i % 2 === 0) : months
  return { ticks, fmt: t => `${Number(kstParts(t).ymd.slice(5, 7))}월` }
}
