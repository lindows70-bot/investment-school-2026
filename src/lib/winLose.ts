// ⚔️ 승패 해부실 SSOT — "지금 장에서 오르는 종목 vs 떨어지는 종목은 뭐가 다른가"를 결정론으로 해부.
//   순수 함수만(클라·서버 공용) — 그룹 분할·7요인 격차 통계·'오늘의 교훈' 문장 자동 조립(AI 미사용·환각 0).
//   원칙: 관측이지 추천 아님(점수·추천 미반영) · 요인 정의는 기존 SSOT(priceTrend·fwdEpsDir·로테이션 quad) 재사용.

export type WLTrend = 'up' | 'side' | 'down' | 'unknown'
export type WLFwd = 'accel' | 'flat' | 'decline' | 'unknown'
export type WLQuad = 'leading' | 'weakening' | 'lagging' | 'improving'
export type WLPeriod = '1w' | '1m' | '3m'

export interface WLRow {
  ticker: string; name: string; market: 'US' | 'KR'
  ret1w: number | null; ret1m: number | null; ret3m: number | null
  pos52: number | null                    // 52주 위치 0~100 (100=신고가)
  trend: WLTrend                          // priceTrend SSOT(50·200일선 정렬)
  fwd: WLFwd                              // Fwd EPS 리비전 방향 SSOT
  peg: number | null
  opMargin: number | null                 // 영업이익률 %
  sector: string | null                   // Yahoo GICS
  rotQuad: WLQuad | null                  // 섹터 로테이션 국면(GICS 11만)
  rotScore: number | null                 // 섹터 자금쏠림 점수
  knife: boolean
  mom12: number | null                    // 🏃 12-1 모멘텀 % — 학술 표준(최근 1개월 제외 12개월 수익률, Jegadeesh-Titman) · 252봉 미만 null
  volAdj: number | null                   // ⚖️ 변동성 조정 모멘텀 — mom12 ÷ 연율화 변동성(샤프형 표준화)
}

// 🏫 우리 포트 승패 보드 행 — 학생 전체 보유(주식+ETF+코인) 합집합. 보유자·인원수는 절대 미포함(개인 식별 차단).
export interface WLSchoolRow {
  ticker: string; name: string; market: 'US' | 'KR' | 'CRYPTO'
  assetType: 'STOCK' | 'ETF' | 'CRYPTO' | 'COMMODITY'
  ret1w: number | null; ret1m: number | null; ret3m: number | null
  pos52: number | null; trend: WLTrend
  sub: { label: string; emoji: string; color: string; sector: string } | null   // 소섹터 라벨(테마 우선 → GICS → ETF 역매핑)
}

export interface WLApi {
  rows: WLRow[]; school: WLSchoolRow[]; asOf: string; total: number; rotJoined: number
  momCrash?: boolean   // ⚠️ 모멘텀 크래시 국면(Daniel-Moskowitz 2016) — 1개월 기준 패자의 12-1 모멘텀이 승자보다 뚜렷이 높음(낙폭과대 반등 장)
}

// 기간별 승/패 임계(%) — 짧은 기간일수록 좁게
export const WL_THRESH: Record<WLPeriod, number> = { '1w': 1.5, '1m': 3, '3m': 5 }
export const WL_PERIOD_LABEL: Record<WLPeriod, string> = { '1w': '최근 1주', '1m': '최근 1개월', '3m': '최근 3개월' }

export const retOf = (r: Pick<WLRow, 'ret1w' | 'ret1m' | 'ret3m'>, p: WLPeriod): number | null => (p === '1w' ? r.ret1w : p === '1m' ? r.ret1m : r.ret3m)

export function splitGroups(rows: WLRow[], p: WLPeriod): { win: WLRow[]; mid: WLRow[]; lose: WLRow[] } {
  const th = WL_THRESH[p]
  const win: WLRow[] = [], mid: WLRow[] = [], lose: WLRow[] = []
  for (const r of rows) {
    const v = retOf(r, p)
    if (v == null) continue
    if (v > th) win.push(r); else if (v < -th) lose.push(r); else mid.push(r)
  }
  const key = (r: WLRow) => retOf(r, p) ?? 0
  win.sort((a, b) => key(b) - key(a)); lose.sort((a, b) => key(a) - key(b))
  return { win, mid, lose }
}

// ── 7요인 격차 통계 ───────────────────────────────────────────────
export interface FactorStat {
  key: string; icon: string; label: string
  winDisp: string; loseDisp: string       // 표시 문자열
  winBar: number; loseBar: number         // 나비 바 폭 0~100
  gap: number                             // 분별력 0~100 (클수록 승패를 가름)
  betterSide: 'win' | 'lose' | 'none'     // 어느 쪽이 높은가(색상용)
  desc: string                            // 한 줄 설명
}

const avg = (arr: WLRow[], f: (r: WLRow) => number | null): number | null => {
  const v = arr.map(f).filter((x): x is number => x != null && isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const shareOf = (arr: WLRow[], pred: (r: WLRow) => boolean, known?: (r: WLRow) => boolean): number | null => {
  const base = known ? arr.filter(known) : arr
  return base.length ? (base.filter(pred).length / base.length) * 100 : null
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const f1 = (n: number | null, suffix = '') => (n == null ? '—' : `${n >= 0 && suffix === '%p' ? '+' : ''}${n.toFixed(1)}${suffix}`)

export function factorStats(win: WLRow[], lose: WLRow[]): FactorStat[] {
  const out: FactorStat[] = []
  const push = (key: string, icon: string, label: string, w: number | null, l: number | null,
    fmt: (n: number | null) => string, bar: (n: number | null) => number, gapOf: (d: number) => number, desc: string) => {
    const gap = w != null && l != null ? clamp(gapOf(Math.abs(w - l))) : 0
    out.push({
      key, icon, label, winDisp: fmt(w), loseDisp: fmt(l), winBar: bar(w), loseBar: bar(l), gap,
      betterSide: w == null || l == null || Math.abs(w - l) < 1e-6 ? 'none' : (w > l ? 'win' : 'lose'), desc,
    })
  }
  const pctFmt = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`)
  const pctBar = (n: number | null) => clamp(n ?? 0)

  // ① 추세 구조 — 정배열(상승추세) 비율. 기존 priceTrend SSOT
  push('trend', '📈', '상승추세(정배열) 비율',
    shareOf(win, r => r.trend === 'up', r => r.trend !== 'unknown'),
    shareOf(lose, r => r.trend === 'up', r => r.trend !== 'unknown'),
    pctFmt, pctBar, d => d, '주가>50일선>200일선 — 이미 건강한 추세에 있는 종목의 비율')
  // ② 52주 위치
  push('pos52', '🏔️', '52주 위치(100=신고가)',
    avg(win, r => r.pos52), avg(lose, r => r.pos52),
    n => (n == null ? '—' : `${Math.round(n)}`), pctBar, d => d, '52주 저점~고점 사이 현재가 위치 — 높을수록 신고가권')
  // ③ 시장 — 미국 비중
  push('market', '🌍', '미국 종목 비중',
    shareOf(win, r => r.market === 'US'), shareOf(lose, r => r.market === 'US'),
    pctFmt, pctBar, d => d, '미장 vs 국장 — 시장 자체가 갈랐는지(글로벌 분산 교육)')
  // ④ 수익성 — 영업이익률
  push('opMargin', '💰', '영업이익률(평균)',
    avg(win, r => r.opMargin), avg(lose, r => r.opMargin),
    n => f1(n) + '%', n => clamp(((n ?? 0) + 20) / 60 * 100), d => clamp(d * 2.5), '이익 실체 — 영업적자(스토리만) 종목은 변동성 장에서 취약')
  // ⑤ Fwd EPS 방향 — 상향 비율
  push('fwd', '📊', 'EPS 추정 상향 비율',
    shareOf(win, r => r.fwd === 'accel', r => r.fwd !== 'unknown'),
    shareOf(lose, r => r.fwd === 'accel', r => r.fwd !== 'unknown'),
    pctFmt, pctBar, d => d, '애널리스트가 이익 추정치를 올리는 중인 종목의 비율')
  // ⑥ 섹터 국면 — 주도+태동(자금 유입 쪽) 비율
  push('rot', '🧭', '주도·태동 섹터 비율',
    shareOf(win, r => r.rotQuad === 'leading' || r.rotQuad === 'improving', r => r.rotQuad != null),
    shareOf(lose, r => r.rotQuad === 'leading' || r.rotQuad === 'improving', r => r.rotQuad != null),
    pctFmt, pctBar, d => d, '섹터 로테이션 시계에서 자금이 유입되는 국면(주도·태동)에 속한 비율')
  // ⑦ 밸류 — PEG(3.5 캡 평균)
  push('peg', '💎', 'PEG(평균)',
    avg(win, r => (r.peg != null && r.peg > 0 && r.peg < 3.5 ? r.peg : null)),
    avg(lose, r => (r.peg != null && r.peg > 0 && r.peg < 3.5 ? r.peg : null)),
    n => (n == null ? '—' : n.toFixed(2)), n => clamp(((n ?? 0) / 3) * 100), d => clamp(d * 25), '싸다/비싸다(성장 대비) — 못 가르는 날이 많다는 것 자체가 교훈')
  // ⑧ 12-1 모멘텀 — 학술 표준(Jegadeesh-Titman: 최근 1개월 제외 12개월 수익률·단기 반전 회피). 역전(패자↑)이면 모멘텀 크래시 국면
  push('mom12', '🏃', '12-1 모멘텀(평균)',
    avg(win, r => r.mom12), avg(lose, r => r.mom12),
    n => f1(n) + '%', n => clamp(((n ?? 0) + 40) / 160 * 100), d => clamp(d * 0.8), '최근 1개월 뺀 12개월 수익률 — 승자가 이미 12개월 승자면 관성 장, 역전이면 낙폭과대 반등(크래시) 장')
  // ⑨ 변동성 조정 모멘텀 — 키움式 표준화(수익률÷연변동성). 조용히 오른 종목 vs 널뛰며 오른 종목 분별
  push('volAdj', '⚖️', '변동성 조정 모멘텀',
    avg(win, r => r.volAdj), avg(lose, r => r.volAdj),
    n => (n == null ? '—' : n.toFixed(2)), n => clamp(((n ?? 0) + 1) / 3 * 100), d => clamp(d * 35), '12-1 수익률 ÷ 연율화 변동성(샤프형) — 같은 상승도 안정 상승이 더 높은 점수')
  return out
}

// ── 오늘의 교훈(결정론 문장 조립) ─────────────────────────────────
export interface WLLesson { top: FactorStat[]; flat: FactorStat[]; text: string }
export function buildLesson(stats: FactorStat[], periodLabel: string): WLLesson {
  const sorted = [...stats].sort((a, b) => b.gap - a.gap)
  const top = sorted.filter(s => s.gap >= 15).slice(0, 3)
  const flat = sorted.filter(s => s.gap < 12)
  const circ = ['①', '②', '③']
  const topTxt = top.map((s, i) => `${circ[i]} ${s.label.replace(/\(.*\)/, '').trim()}(격차 ${Math.round(s.gap)})`).join(' ')
  // 조사 은/는 — 마지막 단어 받침 자동 판별(앱 josa 패턴)
  const eunNeun = (w: string) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? ((c - 0xac00) % 28 > 0 ? '은' : '는') : '은(는)' }
  const flatList = flat.map(s => s.label.replace(/\(.*\)/, '').trim())
  const flatTxt = flat.length ? ` 반면 ${flatList.join('·')}${eunNeun(flatList[flatList.length - 1])} 승패를 거의 가르지 못했습니다.` : ''
  const text = top.length
    ? `${periodLabel} 기준, 승패를 가른 건 ${topTxt}였습니다.${flatTxt}`
    : `${periodLabel} 기준, 뚜렷하게 승패를 가른 단일 요인이 없습니다 — 종목별 개별 재료 장세입니다.`
  return { top, flat, text }
}
