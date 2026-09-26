// '요즘 강한 분야' — 섹터 로테이션 캐시를 **읽기만** 해서 쏠림점수 상위 N 섹터(국면·1주·1달·종목 수·계산일·대표 종목)를 뽑는 서버 lib
//   ⚠️ 가격 수익률 계산이다(자금 흐름 데이터가 아니다) — 그래서 이름이 '돈이 몰리는'이 아니라 '요즘 강한 분야'.
//   ⛔ WHAT/WHEN: 로테이션의 buys·etfTiming(매수 랭킹·타점)은 옮기지 않는다. 캐시가 비면 자체 계산하지 않고 '못 가져옴'.
import { getCache } from './appCache'
import { SECTOR_ROTATION_KEY, type RotQuadShared } from './rotationShared'
import { sectorCacheKey } from './sectorConfigs'
import { flagOf } from './marketFlag'
import { addDaysYmd, kstYmd } from './marketBoardShared'

/** 로테이션 캐시에서 읽는 필드만(RotationResult 의 부분집합) */
export interface RotItemLite {
  key: string; label: string; emoji: string; group: 'gics' | 'theme'
  ret1w: number | null; ret1m: number | null
  quadrant: RotQuadShared; score: number; count: number
}
export interface SectorStockLite { ticker: string; name: string; market: string; ret1w: number | null }

export interface StrongRep { ticker: string; name: string; market: string; flag: string; ret1w: number }
export interface StrongSector {
  key: string; label: string; emoji: string; group: 'gics' | 'theme'
  quadrant: RotQuadShared; score: number
  ret1w: number | null; ret1m: number | null; count: number
  reps: StrongRep[] | null   // null = 대표 종목 모름(repsReason) · [] = 1주 수익률 있는 종목 없음
  repsReason: string | null
}

/** 쏠림점수(score) 내림차순 상위 n */
export function pickStrongSectors(items: RotItemLite[], n: number): RotItemLite[] {
  return items.filter(i => Number.isFinite(i.score)).sort((a, b) => b.score - a.score).slice(0, n)
}

/** 섹터 멤버 중 1주 수익률 상위 k(국기는 flagOf SSOT) */
export function pickReps(stocks: SectorStockLite[], k: number): StrongRep[] {
  return stocks
    .filter((s): s is SectorStockLite & { ret1w: number } => typeof s.ret1w === 'number' && Number.isFinite(s.ret1w))
    .sort((a, b) => b.ret1w - a.ret1w)
    .slice(0, k)
    .map(s => ({ ticker: s.ticker, name: s.name, market: s.market, flag: flagOf(s.market, s.ticker), ret1w: Math.round(s.ret1w * 10) / 10 }))
}

/** 섹터 종목 캐시 → 대표 종목. 대표 종목의 1주 수익률이 섹터 1주 수익률과 다른 날 계산이면 한 카드 안에서 기준일이 어긋난다 —
 *  섹터 종목 계산일(asOf 의 KST 날짜)이 로테이션 계산일과 같을 때만 쓴다 */
export function repsFor(sec: { stocks?: SectorStockLite[]; asOf?: string } | null, calcDate: string, k: number): { reps: StrongRep[] | null; repsReason: string | null } {
  if (!sec?.stocks) return { reps: null, repsReason: '섹터 종목 계산 결과가 없음' }
  const secDay = typeof sec.asOf === 'string' && Number.isFinite(Date.parse(sec.asOf)) ? kstYmd(Date.parse(sec.asOf)) : null
  if (secDay !== calcDate) return { reps: null, repsReason: `섹터 종목 계산일(${secDay ?? '모름'})이 로테이션 계산일(${calcDate})과 다름` }
  return { reps: pickReps(sec.stocks, k), repsReason: null }
}

export interface StrongSectorsResult {
  calcDate: string        // 읽은 로테이션 캐시의 날짜(KST) — 오늘 것이 없으면 어제·그제
  asOf: string | null     // 로테이션 결과의 asOf
  mean1w: number | null; mean1m: number | null   // 비교 기준(17섹터 평균)
  total: number           // 로테이션 섹터 수(모수)
  items: StrongSector[]
}

/** 오늘·어제·그제(KST) 순으로 로테이션 캐시를 찾는다(3일 — 다른 reader 들과 같은 창). 못 찾으면 null */
export async function loadStrongSectors(n = 5, repsPerSector = 2): Promise<StrongSectorsResult | null> {
  const today = kstYmd(Date.now())
  for (let i = 0; i < 3; i++) {
    const d = addDaysYmd(today, -i)
    const rot = await getCache<{ items?: RotItemLite[]; asOf?: string; mean1w?: number; mean1m?: number }>(SECTOR_ROTATION_KEY(d), 3 * 24 * 3600_000)
      .catch(() => null)
    if (!rot?.items?.length) continue
    const top = pickStrongSectors(rot.items, n)
    const items = await Promise.all(top.map(async (it): Promise<StrongSector> => {
      const ck = sectorCacheKey(it.key)
      // 24h — sector-v3 정리 규칙(keepDays 3)보다 짧게(정리 원칙 ②)
      const sec = ck ? await getCache<{ stocks?: SectorStockLite[]; asOf?: string }>(ck, 24 * 3600_000).catch(() => null) : null
      const base = {
        key: it.key, label: it.label, emoji: it.emoji, group: it.group,
        quadrant: it.quadrant, score: it.score, ret1w: it.ret1w, ret1m: it.ret1m, count: it.count,
      }
      return { ...base, ...repsFor(sec, d, repsPerSector) }
    }))
    return {
      calcDate: d, asOf: typeof rot.asOf === 'string' ? rot.asOf : null,
      mean1w: typeof rot.mean1w === 'number' ? rot.mean1w : null,
      mean1m: typeof rot.mean1m === 'number' ? rot.mean1m : null,
      total: rot.items.length, items,
    }
  }
  return null
}
