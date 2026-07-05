// 🕰️ 하워드 막스 마켓 사이클 시계추 — 심리·밸류·레버리지·신용 4축을 하나의 '탐욕↔공포' 시계추로 종합.
//    새 판정기 0개(제1·2원칙): 기존 cocktail-party·crisis-radar·leverage-radar·macro-weather 재사용.
//    막스 원칙: "사이클은 알아도 타이밍은 모른다" → 예측 아님, 현재 '위치'만. 정성 구간(zone) 우선.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

const clamp = (n: number, lo = 0, hi = 100) => Math.round(Math.max(lo, Math.min(hi, n)))   // 정수 반올림(표시 깔끔)
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface MarksAxis {
  key: 'sentiment' | 'valuation' | 'leverage' | 'credit'
  label: string; icon: string
  temp: number | null            // 0~100 탐욕 온도(100=극단 낙관/과열, 0=극단 비관/공포). null=데이터 실패
  detail: string                 // 현재값 한 줄
  source: string                 // 소스 라벨
}
export type Zone = 'euphoria' | 'optimism' | 'balance' | 'pessimism' | 'panic'
export interface MarksCycleResult {
  temp: number                   // 종합 탐욕 온도 0~100(가중, 실패축 제외 후 재정규화)
  pendulum: number               // 시계추 위치 −100(공포)~+100(탐욕) = (temp−50)×2
  zone: Zone
  zoneLabel: string; stance: string; stanceIcon: string; stanceMsg: string
  secondLevel: { first: string; second: string }   // 2차적 사고 대비
  opportunity: { level: 'strong' | 'fear' | 'forced' | 'none'; label: string; msg: string }   // 🩸 강제 매도자 역발상 매수 창
  axes: MarksAxis[]
  usedAxes: number; asOf: string
}

const W: Record<MarksAxis['key'], number> = { sentiment: 0.30, valuation: 0.30, leverage: 0.20, credit: 0.20 }

function zoneOf(temp: number): { zone: Zone; label: string; stance: string; icon: string; msg: string } {
  if (temp >= 75) return { zone: 'euphoria', label: '극단적 낙관(과열)', stance: '방어', icon: '🛡️', msg: '잃지 않는 것이 이기는 것 — 현금 비중↑·추격매수 금지·안전마진 확보. 남들이 탐욕일 때 두려워하라.' }
  if (temp >= 58) return { zone: 'optimism', label: '낙관', stance: '신중', icon: '⚠️', msg: '남들의 낙관이 이미 가격에 다 반영됐는지 2차적으로 의심 — 분할·관망으로 신중 접근.' }
  if (temp >= 42) return { zone: 'balance', label: '균형(중립)', stance: '중립', icon: '⚖️', msg: '사이클 대부분은 극단이 아니다 — 매크로보다 개별 종목 펀더멘탈·안전마진 우선.' }
  if (temp >= 25) return { zone: 'pessimism', label: '비관', stance: '관심', icon: '👀', msg: '공포가 기회를 만든다 — 안전마진 넓은 우량주를 관찰. 단 한꺼번에 사지 말고 분할.' }
  return { zone: 'panic', label: '극단적 비관(공포)', stance: '공격', icon: '⚔️', msg: '남들이 팔 때 산다 — 안전마진 최대 구간. 단 🔪떨어지는 칼날은 피하고 thesis 멀쩡한 것만.' }
}

function secondLevelOf(zone: Zone): { first: string; second: string } {
  switch (zone) {
    case 'euphoria': return { first: '"시장이 좋다 — 계속 오를 것이다."', second: '"모두가 아는 그 낙관이 이미 가격에 다 반영돼, 작은 실망에도 크게 무너질 취약한 상태 아닌가?"' }
    case 'optimism': return { first: '"실적도 좋고 분위기도 좋다."', second: '"좋은 건 누구나 안다 — 그 기대치를 실제 이익이 넘어설 수 있나? 이미 비싸진 않나?"' }
    case 'balance': return { first: '"딱히 살 것도 팔 것도 없다."', second: '"극단이 아닐 때가 오히려 개별 종목의 가격-가치 괴리를 냉정히 볼 기회 — 안전마진이 있는가?"' }
    case 'pessimism': return { first: '"무섭다 — 지금은 관망해야 한다."', second: '"남들의 공포로 좋은 기업이 싸졌다면, 변동성(견뎌야 할 것)과 영구손실(피해야 할 것)을 구분했는가?"' }
    case 'panic': return { first: '"다들 판다 — 나도 팔아야 하나?"', second: '"떨어질 때 투매하면 손실을 확정한다 — thesis가 멀쩡하다면 지금이 안전마진 최대 구간 아닌가?"' }
  }
}

async function pull(base: string, path: string): Promise<{ ok: boolean } & Record<string, unknown> | null> {
  try {
    const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cacheKey = `marks-cycle-v3:${kstDate()}`   // v3: 강제 매도자 역발상 매수 창(opportunity)
  const cached = await getCache<MarksCycleResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const [cocktail, crisis, lev, weather] = await Promise.all([
    pull(base, '/api/cocktail-party'),
    pull(base, '/api/crisis-radar'),
    pull(base, '/api/leverage-radar'),
    pull(base, '/api/macro-weather'),
  ])

  const axes: MarksAxis[] = []

  // ① 심리 — CNN 공포탐욕 지수(partyScore 0~100, 높을수록 탐욕)
  const fng = typeof cocktail?.partyScore === 'number' ? cocktail.partyScore as number : null
  axes.push({ key: 'sentiment', label: '심리(공포·탐욕)', icon: '🎭', temp: fng != null ? clamp(fng) : null,
    detail: fng != null ? `CNN 공포탐욕 ${fng}${(cocktail?.rating ? ` (${cocktail.rating})` : '')}` : '데이터 없음', source: 'CNN Fear & Greed' })

  // ② 밸류 — crisis-radar 4대 버블 지표. (danger×2 + caution)/(n×2)×100 → 고평가=탐욕
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cm: any[] = Array.isArray(crisis?.metrics) ? crisis!.metrics as any[] : []
  let valTemp: number | null = null
  if (cm.length) {
    const danger = cm.filter(m => m.signal === 'danger').length
    const caution = cm.filter(m => m.signal === 'caution').length
    valTemp = clamp(((danger * 2 + caution) / (cm.length * 2)) * 100)
  }
  axes.push({ key: 'valuation', label: '밸류에이션(버블)', icon: '📊', temp: valTemp,
    detail: valTemp != null ? `버블 지표 위험 ${crisis?.dangerCount ?? 0}/${cm.length} (CAPE·버핏·선행PER·위험프리미엄)` : '데이터 없음', source: 'Crisis Radar' })

  // ③ 레버리지 — 빚투 비율 역사 백분위(높을수록 빚투 누적=탐욕)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cur: any = lev?.current ?? null
  const levTemp = typeof cur?.ratioPercentile === 'number' ? clamp(cur.ratioPercentile) : null
  axes.push({ key: 'leverage', label: '레버리지(빚투)', icon: '💳', temp: levTemp,
    detail: levTemp != null ? `신용/예탁금 비율 역사 백분위 ${Math.round(cur.ratioPercentile)}%` : '데이터 없음', source: '개인 빚투 레이더(KR)' })

  // ④ 신용 — 하이일드 스프레드(낮을수록 안일=탐욕). hy≤2.5→100, hy≥8→0
  const hy = typeof weather?.hySpread === 'number' ? weather.hySpread as number : null
  const creTemp = hy != null ? clamp(((8 - hy) / 5.5) * 100) : null
  axes.push({ key: 'credit', label: '신용 스프레드', icon: '🏦', temp: creTemp,
    detail: hy != null ? `하이일드 스프레드 ${hy.toFixed(2)}% (낮을수록 위험 안일)` : '데이터 없음', source: 'FRED HY 스프레드' })

  const used = axes.filter(a => a.temp != null)
  if (used.length < 2)
    return NextResponse.json({ error: '축 데이터 부족(2개 미만) — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const wSum = used.reduce((s, a) => s + W[a.key], 0)
  const temp = Math.round(used.reduce((s, a) => s + (a.temp as number) * W[a.key], 0) / wSum)
  const z = zoneOf(temp)

  // 🩸 강제 매도자 역발상 매수 창(막스 4번째 기둥: 남들이 팔 수밖에 없을 때 안전마진이 생긴다)
  //    시장 공포(온도<42) + 강제 청산 스파이크(반대매매 비중 역사 상단) 조합. 단 칼날 제외는 개별 종목단에서.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forcedPct = typeof (lev as any)?.misu?.current?.forcedPctPercentile === 'number' ? (lev as any).misu.current.forcedPctPercentile as number : null
  const fear = temp < 42
  const forced = forcedPct != null && forcedPct >= 60
  const opportunity: MarksCycleResult['opportunity'] =
    fear && forced ? { level: 'strong', label: '🩸 강한 역발상 매수 창', msg: '시장 공포 + 강제 청산(반대매매) 동시 — 남들이 팔 수밖에 없을 때 안전마진이 최대. 단 🔪떨어지는 칼날은 제외하고 thesis 멀쩡한 우량주만 분할 매수.' }
    : fear ? { level: 'fear', label: '🌊 공포 확산 — 안전마진 관찰', msg: '심리가 공포로 기울었다 — 우량주가 싸지는지 알파헌터·수급 소외주로 관찰(추격 금지·분할).' }
    : forced ? { level: 'forced', label: '⚠️ 강제청산(반대매매) 스파이크', msg: `반대매매 비중이 역사 상단(백분위 ${Math.round(forcedPct as number)}%) — 빚투 청산에 낙폭과대된 우량주 선별 기회(칼날 주의).` }
    : { level: 'none', label: '기회 창 닫힘', msg: '현재는 극단적 저가매수(강제 매도자) 신호가 약함 — 개별 종목 안전마진 우선.' }

  const result: MarksCycleResult = {
    temp, pendulum: (temp - 50) * 2, zone: z.zone, zoneLabel: z.label,
    stance: z.stance, stanceIcon: z.icon, stanceMsg: z.msg,
    secondLevel: secondLevelOf(z.zone), opportunity, axes, usedAxes: used.length, asOf: new Date().toISOString(),
  }
  // 과반(2+) 성공 시에만 캐시(부분실패 박제 방지)
  if (used.length >= 2) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
