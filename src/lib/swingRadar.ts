// 🎯 스윙 레이더 — 유니버스를 훑어 오늘 자리가 온 종목만 추린다
// 판정은 전부 swingSetup(SSOT)이 하고 여기서는 수집·정렬·집계만 한다(신규 판정기 0).
//
// ⚠️ 국면 판정은 **종목별 50일선 방향**이다(백테스트와 같은 정의). 지수 국면(`indexRegime`)은
//    화면이 "왜 비었나"를 설명하기 위한 **안내용**이며 판정에 쓰지 않는다 — 섞으면 성적이 성적 구실을 못 한다.
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { getCache, setCache } from '@/lib/appCache'
import { SWING_HIST_KEY, shouldAppend, gradeSwing, type SwingHistEntry, type SwingGrade, type ScoredRow } from '@/lib/swingHistory'
import { getTechCandles } from '@/lib/techChartData'
import { flagOf } from '@/lib/marketFlag'
import { getUsdKrw } from '@/lib/fx'
import { readSwingSetup, readSwingRegime, SWING_TRACKS, positionSize, type SwingTrack, type SwingRegime } from '@/lib/swingSetup'

export interface SwingItem {
  ticker: string; name: string; market: 'KR' | 'US'; flag: string; sector: string | null
  track: SwingTrack; price: number
  stop: number; stopPct: number          // 손절 — 트랙별 구조선(아래 stopFor)
  targetPct: number                      // 참고 목표 — 실측 절사 edge + 같은 기간 baseline
  reasons: string[]
  regime: SwingRegime
  /** 📉 차트용 최근 60봉 OHLC — 증권사 차트처럼 캔들로 그린다(선 하나로는 하루의 싸움이 안 보인다) */
  candles: { o: number; h: number; l: number; c: number }[]
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
  /** 📋 이 기능이 추천한 것의 **실제 성적**(오늘부터 전향 적립·소급 없음) */
  grades: SwingGrade[]
  /** 최근 채점 내역 — 학생이 개별 건을 눈으로 확인할 수 있게(승률만 보여주면 못 믿는다) */
  recent: { date: string; ticker: string; name: string; flag: string; track: SwingTrack; retPct: number | null; stopHit: boolean }[]
  /** 🚨 진행 중인 추천이 손절선을 깼다 — 매매 브리핑이 크게 띄운다("손절선이 오면 손절한다"가 이 기법의 반쪽) */
  stopAlerts: { date: string; ticker: string; name: string; flag: string; market: 'KR' | 'US'; track: SwingTrack; entry: number; stop: number; last: number; lossPct: number }[]
}

/** 🛡️ 손절 — 트랙의 구조가 깨지는 자리(백테스트가 손절을 쓰진 않았으므로 **성적에 포함되지 않은 보호장치**다).
 *  회복 트랙: 되찾은 6개월선 아래 / 추세 트랙: 11일선 아래. 둘 다 "진입 근거가 사라진 자리"다.
 *  ⚠️ 폭에 상·하한을 둔다(2026-08-11 화면검증에서 둘 다 실제로 나왔다):
 *   · 하한 2.5% — 유한양행이 1.1%로 나왔다. 당일 회복 신호는 구조선이 바로 아래라 원래 좁은데,
 *     일간 노이즈(KR 일변동 ~2%)로도 뚫리는 손절선은 손절선이 아니다 → 구조선과 2.5% 중 **더 아래** 것.
 *   · 상한 8% — Twilio가 18%로 나왔다(급등해 11일선에서 멀어진 상태). 그렇게 이격된 자리는
 *     추격이므로 **자리 자체를 버린다**(문서들도 추격 금지가 공통이다). */
const STOP_MIN_PCT = 2.5, STOP_MAX_PCT = 8
function stopFor(track: SwingTrack, close: number[], i: number): number | null {
  const sma = (n: number) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += close[k]; return s / n }
  const line = track === 'reversion' ? sma(112) : sma(11)
  if (line == null || !(line > 0) || line >= close[i]) return null   // 이미 아래면 자리가 아니다
  const gapPct = (1 - line / close[i]) * 100
  if (gapPct > STOP_MAX_PCT) return null                             // 구조선에서 너무 멀다 = 추격 — 자리 아님
  return Math.min(line, close[i] * (1 - STOP_MIN_PCT / 100))         // 최소 2.5% 여유(노이즈 컷 방지)
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
          candles: D.slice(-60).map(d => ({
            o: Math.round(d.open * 100) / 100, h: Math.round(d.high * 100) / 100,
            l: Math.round(d.low * 100) / 100, c: Math.round(d.close * 100) / 100,
          })),
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

  // ── 📋 성적 적립·채점 ─────────────────────────────────────────────────────
  //   ⛔ 소급 금지 — 오늘부터 쌓는다. 과거를 소급하면 "지금 규칙으로 과거를 고른" 셈이라 성적이 부풀려진다.
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const dayDiff = (a: string, b: string) =>
    Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000)

  const hist = (await getCache<SwingHistEntry[]>(SWING_HIST_KEY, 400 * 86400_000)) ?? []
  const fresh: SwingHistEntry[] = []
  for (const it of items) {
    const e: SwingHistEntry = {
      date: today, ticker: it.ticker, name: it.name, market: it.market, track: it.track,
      entry: it.price, stop: it.stop, holdBars: SWING_TRACKS[it.track].holdBars,
    }
    if (shouldAppend([...hist, ...fresh], e, dayDiff)) fresh.push(e)
  }
  const allHist = [...hist, ...fresh].slice(-2000)
  if (fresh.length) await setCache(SWING_HIST_KEY, allHist)

  // 채점 — 추천일 이후 holdBars 거래일이 지난 건만. 미경과분은 pending 으로 정직하게 남는다.
  const scored: ScoredRow[] = []
  const recent: SwingRadar['recent'] = []
  const stopAlerts: SwingRadar['stopAlerts'] = []
  for (const e of allHist) {
    let retPct: number | null = null, stopHit = false
    try {
      const D = await getTechCandles(e.ticker, e.market, 'D')
      if (D && D.length) {
        const idx = D.findIndex(d => String(d.date ?? '').slice(0, 10) >= e.date)
        if (idx >= 0 && idx + e.holdBars < D.length) {
          const win = D.slice(idx, idx + e.holdBars + 1)
          retPct = Math.round((win[win.length - 1].close / e.entry - 1) * 1000) / 10
          stopHit = win.some(d => d.low <= e.stop)          // 보유 중 손절선을 건드렸나
        } else if (idx >= 0) {
          // 🚨 아직 보유 기간 안 — **종가**가 손절선 아래로 마감했으면 지금 경고한다
          //    (킴스 'Daily Close' 원칙: 장중 꼬리는 무시, 종가 이탈만 유효)
          const last = D[D.length - 1].close
          if (last < e.stop) {
            stopAlerts.push({
              date: e.date, ticker: e.ticker, name: e.name, flag: flagOf(e.market, e.ticker, null),
              market: e.market, track: e.track, entry: e.entry, stop: e.stop,
              last: Math.round(last * 100) / 100,
              lossPct: Math.round((last / e.entry - 1) * 1000) / 10,
            })
          }
        }
      }
    } catch { /* 개별 실패는 미채점(null)로 남는다 — 조용히 0으로 세지 않는다 */ }
    scored.push({ entry: e, retPct, stopHit })
    recent.push({ date: e.date, ticker: e.ticker, name: e.name, flag: flagOf(e.market, e.ticker, null), track: e.track, retPct, stopHit })
  }
  recent.reverse()

  const grades = [gradeSwing(scored, 'all'), gradeSwing(scored, 'reversion'), gradeSwing(scored, 'trend')]

  return {
    asOf: new Date().toISOString(), scanned, okCount, usdKrw,
    indexRegime: { KR: krIdx, US: usIdx }, items, tracks,
    grades, recent: recent.slice(0, 20), stopAlerts,
  }
}

export { SWING_TRACKS, positionSize }
