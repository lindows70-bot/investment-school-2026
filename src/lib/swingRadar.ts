// 🎯 스윙 레이더 — 유니버스를 훑어 오늘 자리가 온 종목만 추린다
// 판정은 전부 swingSetup(SSOT)이 하고 여기서는 수집·정렬·집계만 한다(신규 판정기 0).
//
// ⚠️ 국면 판정은 **종목별 50일선 방향**이다(백테스트와 같은 정의). 지수 국면(`indexRegime`)은
//    화면이 "왜 비었나"를 설명하기 위한 **안내용**이며 판정에 쓰지 않는다 — 섞으면 성적이 성적 구실을 못 한다.
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { getCache } from '@/lib/appCache'
import { getTechCandles } from '@/lib/techChartData'
import { flagOf } from '@/lib/marketFlag'
import { getUsdKrw } from '@/lib/fx'
import { readSwingSetup, readSwingRegime, SWING_TRACKS, positionSize, type SwingTrack, type SwingRegime } from '@/lib/swingSetup'

export interface SwingItem {
  ticker: string; name: string; market: 'KR' | 'US'; flag: string; sector: string | null
  track: SwingTrack; price: number
  stop: number; stopPct: number          // 손절 — 트랙별 구조선(아래 STOP_RULE)
  targetPct: number                      // 참고 목표 — 실측 절사 edge + 같은 기간 baseline
  reasons: string[]
  regime: SwingRegime
}
export interface SwingRadar {
  asOf: string
  scanned: number; okCount: number
  /** 💱 포지션 계산은 **종목 통화 기준**이어야 한다 — 원화 투자금을 달러 주가로 나누면
   *  1천만원으로 172만 달러를 사라는 값이 나온다(2026-08-11 화면검증에서 실제로 나왔다). */
  usdKrw: number
  indexRegime: { KR: SwingRegime | null; US: SwingRegime | null }
  items: SwingItem[]
  /** 트랙별로 지금 켜졌는지 + 왜 — 화면이 빈 목록을 설명할 수 있게 */
  tracks: { key: SwingTrack; on: boolean; why: string }[]
}

/** 🛡️ 손절 — 트랙의 구조가 깨지는 자리(백테스트가 손절을 쓰진 않았으므로 **성적에 포함되지 않은 보호장치**다).
 *  회복 트랙: 되찾은 6개월선 아래 / 추세 트랙: 11일선 아래. 둘 다 "진입 근거가 사라진 자리"다. */
function stopFor(track: SwingTrack, close: number[], i: number): number | null {
  const sma = (n: number) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += close[k]; return s / n }
  const line = track === 'reversion' ? sma(112) : sma(11)
  if (line == null || !(line > 0) || line >= close[i]) return null   // 이미 아래면 자리가 아니다
  return line
}

async function regimeOfIndex(symbol: string, market: 'KR' | 'US'): Promise<SwingRegime | null> {
  try {
    const d = await getTechCandles(symbol, market, 'D')
    return d && d.length >= 80 ? readSwingRegime(d) : null
  } catch { return null }
}

export async function buildSwingRadar(base: string): Promise<SwingRadar | { error: string; note: string }> {
  const uni = (await getCache<ScreenedStock[]>(UNIVERSE_KEY, 8 * 24 * 3600_000)) ?? []
  if (!uni.length) return { error: 'universe_cold', note: '유니버스 캐시가 비었습니다. 주간 스크리너 크론 이후 다시 시도하세요.' }

  const [krIdx, usIdx, usdKrw] = await Promise.all([
    regimeOfIndex('^KS11', 'US'), regimeOfIndex('^GSPC', 'US'), getUsdKrw(base),
  ])

  const items: SwingItem[] = []
  let scanned = 0, okCount = 0
  const q = [...uni]
  const CONC = 10
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const s = q.shift(); if (!s) break
      scanned++
      try {
        const D = await getTechCandles(s.ticker, s.market, 'D')
        if (!D || D.length < 260) continue        // 224일선 + 여유. 신규 상장은 정직 생략
        okCount++
        const market: 'KR' | 'US' = s.market === 'KR' ? 'KR' : 'US'
        const hit = readSwingSetup(D, market)
        if (!hit) continue
        const close = D.map(d => d.close)
        const i = close.length - 1
        const stop = stopFor(hit.track, close, i)
        if (stop == null) continue                // 손절선을 못 세우면 내보내지 않는다(⛔ 손절 없는 진입 금지)
        const t = SWING_TRACKS[hit.track]
        items.push({
          ticker: s.ticker, name: s.name, market, flag: flagOf(s.market, s.ticker, null),
          sector: s.sector ?? null, track: hit.track, price: hit.price,
          stop: Math.round(stop * 100) / 100,
          stopPct: Math.round((1 - stop / hit.price) * 1000) / 10,
          targetPct: t.edgePp,
          reasons: hit.reasons, regime: readSwingRegime(D) ?? 'flat',
        })
      } catch { /* 개별 실패 무시 — 부분실패는 아래 okCount 가드가 잡는다 */ }
    }
  }))

  // 손절폭이 좁은 순(같은 리스크로 더 많이 살 수 있는 자리) → 표본 큰 트랙 우선
  items.sort((a, b) => a.stopPct - b.stopPct)

  const tracks = (Object.values(SWING_TRACKS)).map(t => {
    const idx = t.market === 'KR' ? krIdx : usIdx
    const on = items.some(i => i.track === t.key)
    const why = on
      ? `${t.market} ${t.regime === 'down' ? '하락' : '상승'} 국면 종목에서 자리가 나왔습니다`
      : idx == null
        ? '지수 국면을 확인하지 못했습니다'
        : idx !== t.regime
          ? `지금 ${t.market} 지수는 ${idx === 'up' ? '상승' : idx === 'down' ? '하락' : '중립'} 국면입니다 — 이 기법은 ${t.regime === 'down' ? '하락' : '상승'} 국면에서만 우위가 있었습니다`
          : '국면은 맞지만 오늘 조건을 채운 종목이 없습니다'
    return { key: t.key, on, why }
  })

  return { asOf: new Date().toISOString(), scanned, okCount, usdKrw, indexRegime: { KR: krIdx, US: usIdx }, items, tracks }
}

export { SWING_TRACKS, positionSize }
