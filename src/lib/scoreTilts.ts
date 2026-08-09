// ⚙️💵 6축 밖 보정(틸트) SSOT — 통합추천과 종합판정이 **같은 보정**을 같은 순서로 적용한다
//
// ⚠️ 왜 만들었나(2026-08-09): 6축을 전부 SSOT 로 맞춘 뒤에도 삼성E&A 가 87(종합판정) vs 89(통합추천)
//    였다. 남은 2점이 여기 있었다 — 통합추천 본목록에만 붙는 자본효율·현금창출력 보정.
//    실측 재현: 6축 87 + fcfTilt 1.5 = 88.5 → 89. (참고 목록엔 이 보정이 없어 6축 그대로라
//    검증 표본에 따라 "일치"로 보였다 — 표본이 우연히 맞는 것과 로직이 같은 것은 다르다.)
//
// ⛔ 이 보정은 **6축이 아니다.** 축 점수(가치·퀄리티·…)를 오염시키지 않고 총점에만 얹는다 —
//    학생 화면에서도 축 막대와 분리해 "6축 87 → 🛟 +1.5 → 89"로 분해해 보여준다.
// ⛔ 순차 clamp 순서를 바꾸지 마라 — 반올림 때문에 결과가 갈린다(88.5 를 한 번에 더하느냐
//    나눠 더하느냐로 1점이 움직인다). applyTilts 가 통합추천의 원래 순서를 그대로 재현한다.
import { getCache } from '@/lib/appCache'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

export interface Tilt { label: string; pp: number }

export interface TiltInput {
  roic: number | null
  roeInflated: boolean
  qualityGap: boolean
  fcfNature: string | null      // 'steady' | 'volatile' | 'mirage' | 'na'
  fcfYield: number | null
  fcfAvgYield: number | null
  /** 💵 "버블·하락장엔 현금이 왕" 국면에서만 현금창출력을 가중한다 — isFcfDefensive() 로 구한다 */
  fcfDefensive: boolean
}

/** ⚙️💵 보정 목록(결정론·순수 함수). 빈 배열이면 6축 점수가 곧 최종 점수다. */
export function computeTilts(i: TiltInput): Tilt[] {
  const out: Tilt[] = []
  // ⚙️ 자본효율 — ROIC(빚까지 반영한 진짜 효율)는 가점, 부채로 부풀린 ROE 는 감점.
  //    ⚠️ 둘을 **하나의 값으로 합산**한다(통합추천 원본과 동일) — 나눠서 두 번 clamp 하면 반올림이 갈린다.
  const q = (i.roic != null && i.roic >= 20 ? 3 : i.roic != null && i.roic >= 15 ? 1.5 : 0) - (i.roeInflated ? 6 : 0)
  if (q !== 0) out.push({
    label: i.roeInflated
      ? '⚙️ 빚으로 부푼 자본효율(진짜 효율은 낮음)'
      : `⚙️ 자본을 잘 굴림(ROIC ${Math.round(i.roic ?? 0)}%)`,
    pp: q,
  })
  // 💵 현금창출력 — 과열·공포 국면에서만. mirage(다년 합산 적자)는 방어력이 아니라 취약점이라 감점.
  //    보수 수익률: 성격이 불안정하면(mirage·volatile) TTM 대신 다년 평균을 잣대로 쓴다.
  const guard = i.fcfNature === 'mirage' || i.fcfNature === 'volatile' ? i.fcfAvgYield : i.fcfYield
  const f = i.fcfDefensive
    ? (i.qualityGap || i.fcfNature === 'mirage' ? -5
      : guard != null && guard >= 5 ? 3 : guard != null && guard >= 3 ? 1.5 : guard != null && guard < 0 ? -2 : 0)
    : 0
  if (f !== 0) out.push({
    label: f > 0 ? '🛟 현금을 잘 버는 회사(지금 같은 국면에 강함)' : '⚠️ 장부 이익만큼 현금이 안 들어옴',
    pp: f,
  })
  return out
}

/** 보정을 **하나씩 순차로** 적용(통합추천 원본과 같은 clamp 시점). */
export function applyTilts(base: number, tilts: Tilt[]): number {
  return tilts.reduce((s, t) => clamp(s + t.pp), clamp(base))
}

/** 💵 막스 시계추 온도로 방어 국면 판정(과열≥65 또는 공포≤32). 캐시 읽기만 — 콜드면 off.
 *  ⚠️ 키는 marks-cycle 라우트의 writer 와 반드시 같아야 한다. 예전에 v3 를 읽고 있어
 *     2026-07-14(v3→v4) 이후 이 틸트가 조용히 죽어 있었다(Gemini 정합성 감사가 발견). */
export async function isFcfDefensive(): Promise<boolean> {
  const c = await getCache<{ temp: number }>(`marks-cycle-v4:${kstDate()}`, 12 * 3600_000).catch(() => null)
  const t = c?.temp
  return typeof t === 'number' && (t >= 65 || t <= 32)
}
