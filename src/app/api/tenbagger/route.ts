// 🚀 피터 린치 10배거 검증기 — 학생이 입력한 종목을 린치의 '10루타 7대 기준'으로 실시간 채점
// 고정 유니버스 없음(제1원칙) — 아무 종목이나 입력 → 실데이터로 검증. 기존 엔진 전부 재사용.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { getAssetType } from '@/lib/assetClassifier'
import { buildSignalMetrics } from '@/lib/jarvisBriefing'
import { getAnalystSignal } from '@/app/actions/getAnalystSignal'
import { getInsiderSignal } from '@/app/actions/getInsiderSignal'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export type CriterionStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'UNKNOWN'
export interface Criterion {
  key:    string
  label:  string
  status: CriterionStatus
  detail: string     // 실제 값 근거
  weight: number     // 점수 가중치
}
export interface TenbaggerResult {
  ticker:      string
  name:        string
  market:      string
  score:       number          // 0~100 린치 10배거 기준 충족도
  isCandidate: boolean         // 🚀 뱃지 (점수 높고 시총 작음)
  criteria:    Criterion[]
  verdict:     string          // 린치식 한 줄 종합
  marketCapUsd: number | null
  cachedAt:    string
}

const USD_KRW = 1350

// stock-info에서 종목명(특히 KR 한글명)과 PEG SSOT만 — 숫자는 buildSignalMetrics가 SSOT
async function fetchStockMeta(ticker: string, market: string, base: string): Promise<{ name: string | null; peg: number | null; opMargin: number | null } | null> {
  try {
    const code = ticker.replace(/\.(KS|KQ)$/i, '')
    const r = await fetch(`${base}/api/stock-info?ticker=${encodeURIComponent(code)}&market=${market}`, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return null
    const j = await r.json()
    const f = j?.fundamentals ?? {}
    const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null)
    return { name: typeof j?.name === 'string' ? j.name : null, peg: n(f.peg), opMargin: n(f.operatingMargins) }
  } catch { return null }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawTicker = (searchParams.get('ticker') || '').trim().toUpperCase()
  let market = (searchParams.get('market') || '').toUpperCase()
  if (!rawTicker) return NextResponse.json({ error: '종목 코드를 입력하세요' }, { status: 400 })

  // 시장 자동 추론(6자리 숫자/.KS/.KQ → KR)
  const code = rawTicker.replace(/\.(KS|KQ)$/i, '')
  if (!market) market = /^\d{6}$/.test(code) ? 'KR' : 'US'

  if (getAssetType(code, '', market) !== 'STOCK')
    return NextResponse.json({ error: '개별 주식만 검증할 수 있습니다 (ETF·코인·원자재 제외)' }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cacheKey = `tenbagger-v4:${code}:${market}`
  const cached = await getCache<TenbaggerResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ── 실데이터 병렬 수집 (숫자는 buildSignalMetrics SSOT, 이름은 stock-info) ──
  const [meta, metrics, analyst, insider] = await Promise.all([
    fetchStockMeta(code, market, base),
    buildSignalMetrics(code, market, '', base).catch(() => null),
    getAnalystSignal({ ticker: code, market }).catch(() => null),
    getInsiderSignal({ ticker: code, market }).catch(() => null),
  ])

  if (!metrics && !meta) return NextResponse.json({ error: '종목 데이터를 불러오지 못했습니다. 코드를 확인하세요.' }, { status: 404 })

  const name = meta?.name || metrics?.name || code

  // 시총(USD 환산) — buildSignalMetrics SSOT. KR 시총은 KRW이므로 항상 환산
  let mcUsd = metrics?.marketCap ?? null
  if (mcUsd != null && market === 'KR') mcUsd = mcUsd / USD_KRW
  // 성장률(%) — 매출성장(Yahoo 소수) 우선: 적자 하이퍼그로스(IONQ 755%) 정확 포착. 없으면 PEG 역산 생략
  const revG = metrics?.revenueGrowth ?? null
  const growthPct = revG != null ? revG * 100 : null
  const peg = metrics?.peg ?? meta?.peg ?? null
  const opMargin = metrics?.opMargin ?? meta?.opMargin ?? null
  const fcf = metrics?.fcf ?? null
  const icr = metrics?.interestCoverage ?? null

  const criteria: Criterion[] = []

  // ① 시총 룸 (작을수록 10배 공간) — 가중 30
  criteria.push((() => {
    if (mcUsd == null) return mk('mcap', '🏠 시총 룸(작은 회사)', 'UNKNOWN', '시총 자료 없음', 30)
    const b = mcUsd / 1e9   // $B
    if (b < 10) return mk('mcap', '🏠 시총 룸(작은 회사)', 'PASS', `시총 $${b.toFixed(1)}B — 10배 갈 공간 충분(린치 선호 중소형)`, 30)
    if (b < 50) return mk('mcap', '🏠 시총 룸(작은 회사)', 'PARTIAL', `시총 $${b.toFixed(0)}B — 중형, 3~5배 여지`, 30)
    return mk('mcap', '🏠 시총 룸(작은 회사)', 'FAIL', `시총 $${b.toFixed(0)}B — 대형주라 10배는 사실상 불가(린치: "큰 회사는 큰 움직임 없다")`, 30)
  })())

  // ② 고성장 (fast grower) — 가중 25
  criteria.push((() => {
    if (growthPct == null) return mk('growth', '📈 고성장(이익·매출)', 'UNKNOWN', '성장률 자료 없음', 25)
    if (growthPct >= 30) return mk('growth', '📈 고성장(이익·매출)', 'PASS', `성장률 ${growthPct.toFixed(0)}% — 린치의 '빠른 성장주' 핵심`, 25)
    if (growthPct >= 18) return mk('growth', '📈 고성장(이익·매출)', 'PARTIAL', `성장률 ${growthPct.toFixed(0)}% — 양호하나 텐배거엔 다소 부족`, 25)
    return mk('growth', '📈 고성장(이익·매출)', 'FAIL', `성장률 ${growthPct.toFixed(0)}% — 10배거 동력으론 약함`, 25)
  })())

  // ③ 저PEG (성장 대비 저평가) — ⭐저PEG가 '성장' 덕인지 '경기순환 이익정점(시클리컬 함정)' 탓인지 구분
  criteria.push((() => {
    if (peg == null || peg <= 0) return mk('peg', '💎 저PEG(성장 대비 저평가)', 'UNKNOWN', opMargin != null && opMargin < 0 ? '영업적자라 PEG 산출 불가(매출 성장으로 대체 판단)' : 'PEG 자료 없음', 20)
    const lowGrowth = growthPct != null && growthPct < 18
    // 저PEG인데 매출성장이 약하면 = 진짜 저평가가 아니라 경기순환 이익 정점일 가능성(시클리컬 함정)
    if (peg < 1.0 && lowGrowth)
      return mk('peg', '💎 저PEG(성장 대비 저평가)', 'PARTIAL', `PEG ${peg.toFixed(2)}는 낮지만 매출성장 ${growthPct!.toFixed(0)}%로 약함 — 저PER이 성장이 아니라 일시적 이익(경기순환 정점 등) 때문일 수 있어 진짜 저평가가 아닐 수 있음`, 20)
    if (peg < 0.5) return mk('peg', '💎 저PEG(성장 대비 저평가)', 'PASS', `PEG ${peg.toFixed(2)} — 진흙 속 진주(성장 폭발하는데 시장이 소외)`, 20)
    if (peg < 1.0) return mk('peg', '💎 저PEG(성장 대비 저평가)', 'PARTIAL', `PEG ${peg.toFixed(2)} — 합리적이나 초저평가는 아님`, 20)
    return mk('peg', '💎 저PEG(성장 대비 저평가)', 'FAIL', `PEG ${peg.toFixed(2)} — 성장 프리미엄 이미 반영됨`, 20)
  })())

  // ④ 언더커버리지 (월가가 아직 모름 = 진주) — 가중 10
  //    KR=네이버 리포트 수, US=Yahoo 애널리스트 수(getAnalystSignal US는 reportCount 미제공이라 오판 방지)
  criteria.push((() => {
    const cov = market === 'KR' ? (analyst?.reportCount ?? null) : (metrics?.analystCount ?? null)
    if (cov == null) return mk('coverage', '🔍 언더커버리지(아직 안 알려짐)', 'UNKNOWN', '커버리지 자료 없음', 10)
    if (cov <= 3) return mk('coverage', '🔍 언더커버리지(아직 안 알려짐)', 'PASS', `애널/리포트 ${cov}건 — 월가가 아직 주목 안 함(린치: 기관 들어오기 전 매수)`, 10)
    if (cov <= 8) return mk('coverage', '🔍 언더커버리지(아직 안 알려짐)', 'PARTIAL', `커버리지 ${cov}건 — 어느 정도 알려짐`, 10)
    return mk('coverage', '🔍 언더커버리지(아직 안 알려짐)', 'FAIL', `커버리지 ${cov}건 — 이미 월가가 다 아는 종목`, 10)
  })())

  // ⑤ 내부자 매수 (경영진의 확신) — 가중 8
  criteria.push((() => {
    if (!insider) return mk('insider', '🕵️ 내부자 매수(경영진 확신)', 'UNKNOWN', '내부자 자료 없음', 8)
    if (insider.cluster) return mk('insider', '🕵️ 내부자 매수(경영진 확신)', 'PASS', `내부자 ${insider.buyerCount}명 장내매수(클러스터) — 강한 확신 신호`, 8)
    if (insider.hasBuys) return mk('insider', '🕵️ 내부자 매수(경영진 확신)', 'PARTIAL', '내부자 장내매수 포착', 8)
    return mk('insider', '🕵️ 내부자 매수(경영진 확신)', 'FAIL', '최근 내부자 장내매수 없음', 8)
  })())

  // ⑥ 재무 생존력 (빚으로 안 죽음 — 10배 갈 때까지 버티기) — 가중 7
  criteria.push((() => {
    const zombie = icr != null && icr < 1.5
    const opLoss = opMargin != null && opMargin < -15
    const fcfBurn = fcf != null && fcf < 0
    if (icr == null && opMargin == null) return mk('survival', '🛡️ 재무 생존력', 'UNKNOWN', '재무 자료 없음', 7)
    if (zombie) return mk('survival', '🛡️ 재무 생존력', 'FAIL', `이자보상배율 ${icr}배 — 이자도 못 갚는 좀비 위험(10배 전에 파산 가능)`, 7)
    if (opLoss && fcfBurn) return mk('survival', '🛡️ 재무 생존력', 'PARTIAL', `영업적자+현금소진 — 고위험(흑자 전환·현금 런웨이 확인 필수)`, 7)
    return mk('survival', '🛡️ 재무 생존력', 'PASS', icr != null ? `이자보상배율 ${icr}배 — 건전` : '영업흑자·현금흐름 양호', 7)
  })())

  // ── 점수 = 가중 충족도 ──
  const wsum = criteria.reduce((s, c) => s + c.weight, 0)
  const earned = criteria.reduce((s, c) => s + c.weight * (c.status === 'PASS' ? 1 : c.status === 'PARTIAL' ? 0.5 : 0), 0)
  let score = Math.round((earned / wsum) * 100)

  // ⭐ 10배거 '실격 조건' 점수 상한 — 다른 항목이 좋아도 이 둘은 본질적으로 텐배거 불가
  const mcapFail = criteria.find(c => c.key === 'mcap')?.status === 'FAIL'   // 대형주 → 10배 수학적 불가
  const zombie = icr != null && icr < 1.5                                     // 좀비 → 10배 전 파산 위험
  if (mcapFail) score = Math.min(score, 35)
  else if (zombie) score = Math.min(score, 49)

  // 🚀 후보 뱃지: 점수 ≥ 60 AND 시총 작음(<$30B) AND 좀비 아님
  const isCandidate = score >= 60 && mcUsd != null && mcUsd < 30e9 && !zombie

  const verdict = buildVerdict(name, score, isCandidate, mcUsd, criteria)

  const result: TenbaggerResult = {
    ticker: code, name, market, score, isCandidate, criteria, verdict,
    marketCapUsd: mcUsd, cachedAt: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}

function mk(key: string, label: string, status: CriterionStatus, detail: string, weight: number): Criterion {
  return { key, label, status, detail, weight }
}

function buildVerdict(name: string, score: number, isCandidate: boolean, mcUsd: number | null, criteria: Criterion[]): string {
  const big = criteria.find(c => c.key === 'mcap')?.status === 'FAIL'
  if (big) return `${name}는 이미 대형주라 10배(텐배거)는 현실적으로 어렵습니다. 린치는 "코끼리는 날지 못한다"고 했죠 — 큰 회사는 안정적 보유엔 좋지만 10루타 후보는 아닙니다.`
  if (isCandidate) return `${name}는 린치의 10배거 기준을 ${score}점으로 상당히 충족하는 '진흙 속 진주 후보'입니다. ⚠️ 단, 텐배거는 희귀하고 고위험이라 대부분 실패합니다 — 위성(공격) 자산으로 소액·분산 편입하고, 성장 스토리가 실제로 실현되는지 분기마다 확인하세요.`
  if (score >= 45) return `${name}는 일부 린치 기준을 충족(${score}점)하나 텐배거로 단정하긴 부족합니다. 약한 항목이 개선되는지 지켜보세요.`
  return `${name}는 린치의 10배거 기준 충족도가 낮습니다(${score}점). 텐배거 후보로 보긴 어렵습니다.`
}
