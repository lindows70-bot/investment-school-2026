// 📐 축 점수 SSOT — 같은 종목이면 어느 화면에서든 같은 6축 점수를 쓴다(제2원칙)
//
// ⚠️ 왜 만들었나(2026-08-09 실사고): 통합추천은 삼성E&A 를 **87점 1위**로 보여주는데 리서치
//    종합 판정은 **69점 '주의'** 였다. 원인은 가중치가 아니라 **축 값 자체를 두 곳이 따로 계산**한 것:
//      📈 모멘텀 91 vs 50(=모름 폴백) · 🌦️ 계절 100 vs 60 · 🏰 퀄리티 70 vs 60 · 💎 가치 95 vs 100
//    어제 만든 연결(추천 → 🎯 종합 판정 칩)을 타고 온 학생이 **정반대 인상**을 받는 구조였다.
//
// 해결: **유니버스 캐시에 있는 종목이면 그 축을 그대로 쓴다.**
//   통합추천에 나오는 종목은 반드시 유니버스에 있으므로, 두 화면이 동시에 보여줄 수 있는
//   모든 종목에서 값이 일치한다. 유니버스 밖 종목(학생 임의 검색·보유 65%)은 비교 대상이
//   애초에 없으므로 호출부의 자체 계산으로 폴백한다 — 그 사실을 `source` 로 정직하게 알린다.
//
// ⛔ 여기서 축을 '계산'하지 않는다. 스크리너(macroPhaseScreener)가 만든 값을 **읽어 옮길 뿐**이다.
//    계산이 두 곳에 있으면 그게 바로 이 사고의 원인이었다.
import { getCache } from '@/lib/appCache'
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'

export interface AxisSnapshot {
  source: 'universe'          // 유니버스 히트(통합추천과 동일 값 보장)
  value: number               // 0~100 (스크리너 0~1 × 100 — unified-reco 의 fundOf 와 동일 규약)
  quality: number             // 0~100
  momentum: number            // 0~100 (스크리너가 이미 0~100)
  lynchCategory: string | null // 🌦️ 계절 축 재계산용(holdingFit 입력) — 분류가 다르면 계절이 갈린다
  sector: string | null       // 🧭 주도섹터 축 매핑용
  knife: boolean
}

const code6 = (t: string) => t.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '')
const keyOf = (market: string, ticker: string) =>
  `${market === 'KR' ? 'KR' : 'US'}:${market === 'KR' ? code6(ticker) : ticker.toUpperCase()}`

/** 유니버스에서 이 종목의 축 점수를 가져온다. 없으면 null(호출부가 자체 계산으로 폴백).
 *  ⚠️ 캐시 읽기만 — 재계산을 촉발하지 않는다(콜드면 조용히 null). */
export async function getAxisSnapshot(ticker: string, market: 'KR' | 'US'): Promise<AxisSnapshot | null> {
  try {
    const screened = await getCache<ScreenedStock[]>(UNIVERSE_KEY, 8 * 24 * 3600_000)
    if (!screened?.length) return null
    const want = keyOf(market, ticker)
    const s = screened.find(x => keyOf(x.market, x.ticker) === want)
    if (!s) return null
    // 스케일 통일 — 스크리너는 value/quality 를 0~1 로, momentum 을 0~100 으로 낸다.
    // (이 불일치를 모르고 원본끼리 비교했다가 "모멘텀이 100배 크다"는 오판을 한 적이 있다 — 2026-08-08)
    const to100 = (v: number | null | undefined, fallback: number) =>
      typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v * 100))) : fallback
    return {
      source: 'universe',
      value: to100(s.valueScore ?? s.score, 50),
      quality: to100(s.qualityScore, 50),
      momentum: typeof s.momentumScore === 'number' && isFinite(s.momentumScore)
        ? Math.max(0, Math.min(100, Math.round(s.momentumScore))) : 50,
      lynchCategory: s.lynchCategory ?? null,
      sector: s.sector ?? null,
      knife: s.knife ?? false,
    }
  } catch { return null }
}
