// 🎯 스윙 레이더 — 유니버스를 훑어 오늘 자리가 온 종목만 추린다
// 판정은 전부 swingSetup(SSOT)이 하고 여기서는 수집·정렬·집계만 한다(신규 판정기 0).
//
// ⚠️ 국면 판정은 **종목별 50일선 방향**이다(백테스트와 같은 정의). 지수 국면(`indexRegime`)은
//    화면이 "왜 비었나"를 설명하기 위한 **안내용**이며 판정에 쓰지 않는다 — 섞으면 성적이 성적 구실을 못 한다.
import { createClient } from '@supabase/supabase-js'
import { UNIVERSE_KEY, type ScreenedStock } from '@/lib/macroPhaseScreener'
import { getAssetType } from '@/lib/assetClassifier'
import { getCache, setCache } from '@/lib/appCache'
import { SWING_HIST_KEY, shouldAppend, gradeSwing, type SwingHistEntry, type SwingGrade, type ScoredRow } from '@/lib/swingHistory'
import { getTechCandles, dropIncompleteBar } from '@/lib/techChartData'
import { flagOf } from '@/lib/marketFlag'
import { getUsdKrw } from '@/lib/fx'
import { readSwingSetup, readSwingRegime, readVolumeCaution, SWING_TRACKS, SWING_DAILY_CAP, positionSize, type SwingTrack, type SwingRegime } from '@/lib/swingSetup'
import { loadRotationBySector, SECTOR_TO_ROT, type RotQuadShared } from '@/lib/rotationShared'

export interface SwingItem {
  ticker: string; name: string; market: 'KR' | 'US'; flag: string; sector: string | null
  track: SwingTrack; price: number
  /** 🕯️ 신호가 난 **완성 봉**의 날짜 — price 는 이 봉의 종가다(장중가 아님). 성적 적립의 진입일도 이 날짜 */
  signalDate: string
  stop: number; stopPct: number          // 손절 — 트랙별 구조선(아래 stopFor)
  targetPct: number                      // 참고 목표 — 실측 절사 edge + 같은 기간 baseline
  reasons: string[]
  regime: SwingRegime
  /** 🧭 이 종목 섹터의 로테이션 상태 — 교차 백테스트(2026-08-19) 근거: 유입(score>0) vs 이탈이
   *  14/14 칸에서 일관 우위(절사 +0.5~1%p/2주, A트랙 최대). 로테이션 캐시 콜드·섹터 미매핑이면 null(fail-open) */
  rot: { score: number; quad: RotQuadShared; inflow: boolean } | null
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
  /** 🕯️ 판정에 쓴 마지막 완성 봉 날짜(시장별) — 화면이 "어느 종가로 판정했나"를 말할 수 있게. 못 구하면 null */
  barDate: { KR: string | null; US: string | null }
  items: SwingItem[]
  /** 🧢 하루 상한(3건)에 걸려 잘린 신호 수 — 숨기면 "오늘 3건뿐"이 거짓말이 된다 */
  cappedOut: number
  /** 🌍 거래소 접미사 해외 상장(DHL.DE·2628.HK 등) — 미국 트랙은 미국 40종 검증이라 스캔에서 뺀 수 */
  skippedForeign: number
  /** 트랙별로 지금 켜졌는지 + 왜 — 화면이 빈 목록을 설명할 수 있게 */
  tracks: { key: SwingTrack; on: boolean; why: string }[]
  /** 📋 이 기능이 추천한 것의 **실제 성적**(오늘부터 전향 적립·소급 없음) */
  grades: SwingGrade[]
  /** 최근 채점 내역 — 학생이 개별 건을 눈으로 확인할 수 있게(승률만 보여주면 못 믿는다) */
  /** retPct = **규칙 준수**(손절선 이탈 시 그 가격에 종료) · retHoldPct = 손절 무시하고 끝까지 보유(참고) */
  recent: { date: string; ticker: string; name: string; flag: string; track: SwingTrack; retPct: number | null; retHoldPct: number | null; stopHit: boolean }[]
  /** 🚨 진행 중인 추천이 손절선을 깼다 — 매매 브리핑이 크게 띄운다("손절선이 오면 손절한다"가 이 기법의 반쪽) */
  stopAlerts: { date: string; ticker: string; name: string; flag: string; market: 'KR' | 'US'; track: SwingTrack; entry: number; stop: number; last: number; lossPct: number }[]
  /** 📉 거래량 천장 경고 — 진행 중 추천에서 '대량 양봉 → 첫 눌림도 대량' 패턴(readVolumeCaution SSOT).
   *  실측(2026-08-13)에서 이후 2주가 baseline보다 KR −1.06%p/US −0.56%p 나빴다 — 손절선과 별개의 조기 경고. */
  volCautions: { date: string; ticker: string; name: string; flag: string; market: 'KR' | 'US'; track: SwingTrack; entry: number; last: number; retPct: number; burstChg: number; pullVolX: number }[]
  /** 🔬 보유 기간 실험 — 같은 추천을 1주·2주·3주·1달 구간에서 **모두** 채점한다.
   *  "수익률이 어디까지 가나"는 백테스트 고정 구간이 아니라 이 적립이 답한다(사용자 요청 2026-08-11). */
  horizons: { bars: number; label: string; n: number; avgPct: number | null; medPct: number | null; winRate: number | null; ge5Rate: number | null; ge10Rate: number | null }[]
  /** 🏔️ 보유 중 최고 도달치(고가 기준·최대 20봉) — "최고점이 어디까지 갔고 며칠째였나" */
  peak: { n: number; avgPct: number | null; medPct: number | null; ge5Rate: number | null; ge10Rate: number | null; avgBar: number | null }
}

/** 🛡️ 손절 — 트랙의 구조가 깨지는 자리(백테스트가 손절을 쓰진 않았으므로 **성적에 포함되지 않은 보호장치**다).
 *  회복 트랙: 되찾은 6개월선 아래 / 추세 트랙: 11일선 아래. 둘 다 "진입 근거가 사라진 자리"다.
 *  ⚠️ 폭에 상·하한을 둔다(2026-08-11 화면검증에서 둘 다 실제로 나왔다):
 *   · 하한 2.5% — 유한양행이 1.1%로 나왔다. 당일 회복 신호는 구조선이 바로 아래라 원래 좁은데,
 *     일간 노이즈(KR 일변동 ~2%)로도 뚫리는 손절선은 손절선이 아니다 → 구조선과 2.5% 중 **더 아래** 것.
 *   · 상한 8% — Twilio가 18%로 나왔다(급등해 11일선에서 멀어진 상태). 그렇게 이격된 자리는
 *     추격이므로 **자리 자체를 버린다**(문서들도 추격 금지가 공통이다). */
const STOP_MIN_PCT = 2.5, STOP_MAX_PCT = 8
function stopFor(track: SwingTrack, D: { close: number; low: number }[], i: number): number | null {
  const close = (k: number) => D[k].close
  const sma = (n: number) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += close(k); return s / n }
  // ⚡ spike 는 급등봉(당일) 저가 — "급등의 시작점이 무너지면 그 급등은 가짜였다"(밥그릇 기준봉 저가와 같은 논리)
  const line = track === 'reversion' ? sma(112) : track === 'trend' ? sma(11) : D[i].low
  if (line == null || !(line > 0) || line >= close(i)) return null   // 이미 아래면 자리가 아니다
  const gapPct = (1 - line / close(i)) * 100
  if (gapPct > STOP_MAX_PCT) return null                             // 구조선에서 너무 멀다 = 추격 — 자리 아님
  return Math.min(line, close(i) * (1 - STOP_MIN_PCT / 100))         // 최소 2.5% 여유(노이즈 컷 방지)
}

/** 지수 국면 — fetch 경로(market)는 야후라 'US' 지만, 완성 봉 판정(session)은 그 지수의 거래소 기준이어야 한다(^KS11 = KR) */
async function regimeOfIndex(symbol: string, market: 'KR' | 'US', session: 'KR' | 'US'): Promise<SwingRegime | null> {
  try {
    const d = dropIncompleteBar(await getTechCandles(symbol, market, 'D'), session)
    return d && d.length >= 80 ? readSwingRegime(d) : null
  } catch { return null }
}

/** 👥 전 학생 보유 개별주식 — 유니버스는 큐레이션 정적 리스트라 보유 종목이 자동 포함되지 않는다.
 *  "'상위 N' 선정은 모집단의 구멍을 그대로 물려받는다 — 학생 보유 종목은 항상 포함"(CLAUDE.md·SPCX 실사고,
 *  스윙 반영은 2026-08-14 사용자 요청). ETF·코인·원자재는 제외(스윙 트랙은 개별주 백테스트다). 실패는 빈 배열(graceful). */
async function studentHoldings(): Promise<{ ticker: string; name: string; market: string }[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return []
    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (u, o) => fetch(u as RequestInfo, { ...o, cache: 'no-store' }) },
    })
    const { data } = await db.from('investments').select('ticker,name,market')
    const seen = new Set<string>()
    return (data ?? [])
      .filter(r => r.ticker && !seen.has(r.ticker) && (seen.add(r.ticker), true))
      .filter(r => getAssetType(r.ticker, r.name ?? '', r.market ?? undefined) === 'STOCK')
      .map(r => ({ ticker: String(r.ticker), name: String(r.name ?? r.ticker), market: String(r.market ?? 'US') }))
  } catch { return [] }
}

export async function buildSwingRadar(base: string): Promise<SwingRadar | { error: string; note: string }> {
  const uni = (await getCache<ScreenedStock[]>(UNIVERSE_KEY, 8 * 24 * 3600_000)) ?? []
  if (!uni.length) return { error: 'universe_cold', note: '유니버스 캐시가 비었습니다. 주간 스크리너 크론 이후 다시 시도하세요.' }
  // 👥 학생 보유 종목을 스캔 목록에 병합(유니버스에 없는 것만 추가 — 중복 스캔 방지)
  const held = await studentHoldings()
  const uniTickers = new Set(uni.map(s => s.ticker))
  const extra = held.filter(h => !uniTickers.has(h.ticker))
    .map(h => ({ ticker: h.ticker, name: h.name, market: h.market, sector: null } as unknown as ScreenedStock))

  const [krIdx, usIdx, usdKrw, rotMap] = await Promise.all([
    regimeOfIndex('^KS11', 'US', 'KR'), regimeOfIndex('^GSPC', 'US', 'US'), getUsdKrw(base),
    loadRotationBySector(),   // 🧭 섹터 로테이션(읽기만·콜드면 null) — 배지·우선순위용
  ])
  /** 종목 섹터(Yahoo GICS) → 오늘의 로테이션 상태. 못 구하면 null — 배지 생략·순위 중립(fail-open) */
  const rotOf = (sector: string | null): SwingItem['rot'] => {
    const key = sector ? SECTOR_TO_ROT[sector] : undefined
    const r = key ? rotMap?.get(key) : undefined
    return r ? { score: Math.round(r.score * 10) / 10, quad: r.q, inflow: r.score > 0 } : null
  }

  const items: SwingItem[] = []
  let scanned = 0, okCount = 0
  const barDate: SwingRadar['barDate'] = { KR: null, US: null }
  // 🌍 미국 트랙은 **미국 40종**으로만 검증됐다. market 'US' 는 '한국 아님'이라 독일(DHL.DE)·홍콩·일본 상장이 섞여
  //    들어왔다(2026-09-11 검토 — 학생 보유 병합 DHL.DE 가 추세 트랙에 적립됨). 거래소 접미사가 붙은 해외 상장은 뺀다.
  //    검증 안 된 모집단에 성적을 매기면 그 성적이 무엇의 성적인지 알 수 없다. 뺀 수는 화면에 밝힌다.
  const isForeignListing = (s: { ticker: string; market: string }) => s.market !== 'KR' && /\.[A-Z]{1,2}$/.test(s.ticker)
  const all = [...uni, ...extra]
  const skippedForeign = all.filter(isForeignListing).length
  const q = all.filter(s => !isForeignListing(s))
  const CONC = 10
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const s = q.shift(); if (!s) break
      scanned++
      try {
        const market: 'KR' | 'US' = s.market === 'KR' ? 'KR' : 'US'
        // 🕯️ 완성 봉만 — 진행 중인 오늘 봉은 버린다(장중가 판정 금지 · 백테스트와 같은 잣대)
        const D = dropIncompleteBar(await getTechCandles(s.ticker, s.market, 'D'), market)
        if (!D || D.length < 260) continue        // 224일선 + 여유. 신규 상장은 정직 생략
        okCount++
        const lastDate = String(D[D.length - 1].date).slice(0, 10)
        if (!barDate[market] || lastDate > barDate[market]!) barDate[market] = lastDate
        const hit = readSwingSetup(D, market)
        if (!hit) continue
        const i = D.length - 1
        const stop = stopFor(hit.track, D, i)
        if (stop == null) continue                // 손절선을 못 세우면 내보내지 않는다(⛔ 손절 없는 진입 금지)
        const t = SWING_TRACKS[hit.track]
        const rot = rotOf(s.sector ?? null)
        // ⚠️ 이탈 섹터 경고 — 교차 백테스트에서 이탈(score<0) 신호는 절사 −0.6~−1.9%p 로 일관 열위였고
        //    특히 회복(A) 트랙이 가장 크게 갈렸다(유입 +0.28 vs 이탈 −1.93, 15봉 절사). 숨기지 않고 이유에 싣는다.
        const reasons = rot && !rot.inflow
          ? [...hit.reasons, `⚠️ 이 섹터는 지금 자금 이탈 중(로테이션 ${rot.score}) — 같은 신호도 유입 섹터보다 성적이 나빴습니다${hit.track === 'reversion' ? '(회복 신호는 특히)' : ''}`]
          : hit.reasons
        items.push({
          ticker: s.ticker, name: s.name, market, flag: flagOf(s.market, s.ticker, null),
          sector: s.sector ?? null, track: hit.track, price: hit.price, signalDate: lastDate,
          stop: Math.round(stop * 100) / 100,
          stopPct: Math.round((1 - stop / hit.price) * 1000) / 10,
          targetPct: t.edgePp,
          rot,
          reasons, regime: readSwingRegime(D) ?? 'flat',
          candles: D.slice(-60).map(d => ({
            o: Math.round(d.open * 100) / 100, h: Math.round(d.high * 100) / 100,
            l: Math.round(d.low * 100) / 100, c: Math.round(d.close * 100) / 100,
          })),
        })
      } catch { /* 개별 실패 무시 — 부분실패는 아래 okCount 가드가 잡는다 */ }
    }
  }))

  // 손절폭이 좁은 순(같은 리스크로 더 많이 살 수 있는 자리).
  // 🧭 1차 키는 '이탈 섹터 여부' — 하루 상한 3건에서 잘릴 때 이탈(score<0) 섹터가 먼저 잘리게 한다
  //    (교차 백테스트 14/14 일관 우위 근거·2026-08-19). 유입과 미확인(null)은 동급(fail-open — 정보 없음을 벌점화하지 않는다).
  const outRank = (x: SwingItem) => (x.rot && !x.rot.inflow ? 1 : 0)
  items.sort((a, b) => outRank(a) - outRank(b) || a.stopPct - b.stopPct)

  // 🧢 하루 합산 상한 — 하락장 바닥 급등은 몰려서 나오는 날이 있다. 같은 장세에 여러 건을 다 담으면
  //    분산이 아니라 같은 베팅의 반복이다. 잘린 건수는 숨기지 않고 화면에 밝힌다.
  //    ⚠️ 트랙 '켜짐' 판정은 **자르기 전** 목록으로 — 한 트랙 신호가 전부 잘리면 신호등이 "조건을 채운 종목이
  //    없다"고 거짓말했다(2026-09-11 검토). 잘린 트랙은 '자리 있음(상한에 걸려 미표시)'이 사실이다.
  const hadTrack = new Set(items.map(i => i.track))
  const cappedOut = Math.max(0, items.length - SWING_DAILY_CAP)
  if (cappedOut > 0) items.splice(SWING_DAILY_CAP)

  const tracks = (Object.values(SWING_TRACKS)).map(t => {
    const idx = t.market === 'KR' ? krIdx : usIdx
    const on = hadTrack.has(t.key)
    const why = on
      ? items.some(i => i.track === t.key)
        ? `${t.market} ${t.regime === 'down' ? '하락' : '상승'} 국면 종목에서 자리가 나왔습니다`
        : `자리가 나왔지만 하루 상한(${SWING_DAILY_CAP}건)에 걸려 오늘 목록에는 빠졌습니다`
      : idx == null
        ? '지수 국면을 확인하지 못했습니다'
        : idx !== t.regime
          ? `지금 ${t.market} 지수는 ${idx === 'up' ? '상승' : idx === 'down' ? '하락' : '중립'} 국면입니다 — 이 기법은 ${t.regime === 'down' ? '하락' : '상승'} 국면에서만 우위가 있었습니다`
          : '국면은 맞지만 판정 기준일 종가로 조건을 채운 종목이 없습니다'   // '오늘'이라 쓰면 전날 봉으로 판정한 아침엔 거짓(Codex 리뷰)
    return { key: t.key, on, why }
  })

  // ── 📋 성적 적립·채점 ─────────────────────────────────────────────────────
  //   ⛔ 소급 금지 — 오늘부터 쌓는다. 과거를 소급하면 "지금 규칙으로 과거를 고른" 셈이라 성적이 부풀려진다.
  //   🕯️ 진입일 = **신호 봉 날짜**(만든 날짜가 아니다) · 진입가 = 그 봉 종가. 전에는 만든 시각의 장중가를 적어
  //      학생이 재현할 수 없는 가격으로 채점했다(2026-09-11 실측 — dropIncompleteBar 주석 참조).
  const dayDiff = (a: string, b: string) =>
    Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000)

  const hist = (await getCache<SwingHistEntry[]>(SWING_HIST_KEY, 400 * 86400_000)) ?? []
  const fresh: SwingHistEntry[] = []
  for (const it of items) {
    const e: SwingHistEntry = {
      date: it.signalDate, ticker: it.ticker, name: it.name, market: it.market, track: it.track,
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
  const volCautions: SwingRadar['volCautions'] = []
  // 🔬 보유 기간 실험 — 1주(5)·2주(10)·3주(15)·1달(20) 을 전부 채점(구간별 독립 표본)
  const HORIZONS = [
    { bars: 5, label: '1주' }, { bars: 10, label: '2주' }, { bars: 15, label: '3주' }, { bars: 20, label: '1달' },
  ]
  const horizonRets: Record<number, number[]> = { 5: [], 10: [], 15: [], 20: [] }
  const peaks: { pct: number; bar: number }[] = []
  for (const e of allHist) {
    let retPct: number | null = null, retHoldPct: number | null = null, stopHit = false
    try {
      // 🕯️ 채점·손절 경보도 완성 봉만 — '종가 이탈'이라 써놓고 장중가로 경보하면 그 원칙이 거짓이 된다
      const D = dropIncompleteBar(await getTechCandles(e.ticker, e.market, 'D'), e.market)
      if (D && D.length) {
        const idx = D.findIndex(d => String(d.date ?? '').slice(0, 10) >= e.date)
        if (idx >= 0) {
          const elapsed = D.length - 1 - idx
          for (const h of HORIZONS) {
            if (elapsed >= h.bars) horizonRets[h.bars].push((D[idx + h.bars].close / e.entry - 1) * 100)
          }
          // 🏔️ 최고 도달치 — 고가 기준, 진입 다음 봉부터 최대 20봉. 5봉은 지나야 '고점'이라 부를 수 있다
          if (elapsed >= 5) {
            let best = -Infinity, bestBar = 0
            for (let k = 1; k <= Math.min(elapsed, 20); k++) {
              const p = (D[idx + k].high / e.entry - 1) * 100
              if (p > best) { best = p; bestBar = k }
            }
            if (isFinite(best)) peaks.push({ pct: best, bar: bestBar })
          }
        }
        if (idx >= 0 && idx + e.holdBars < D.length) {
          const win = D.slice(idx, idx + e.holdBars + 1)
          // 🛡️ **규칙 준수** 채점(2026-08-15) — 손절선을 깬 날 그 가격에 나왔다고 본다.
          //    전에는 손절을 **무시하고** 보유 기간 끝 종가로만 채점했다. 앱은 "손절선을 못 세우면
          //    추천조차 안 한다"고 해놓고 성적은 규칙을 안 지킨 시나리오로 매긴 셈이라, 학생이 규칙대로
          //    따랐을 때 실제로 얻는 성적과 화면 숫자가 서로 다른 것을 재고 있었다.
          //    ⚠️ k>0 인 이유: 진입은 **종가** 기준이라 진입 당일 저가는 이미 지나간 값이다.
          //    ⚠️ 체결가는 **min(손절선, 그날 시가)** — 갭 하락으로 손절선을 건너뛰고 열리면 역지정가는
          //    시가 근처에서 체결된다. 손절선 가격을 그대로 쓰면 성적이 체계적으로 부풀려진다
          //    (2026-08-13 위메이드 실측: 손절선 18,300 인데 시가 17,160 → −3.7% 가 아니라 −9.7%. 6%p 과대).
          const hitBar = win.findIndex((d, k) => k > 0 && d.low <= e.stop)
          stopHit = hitBar > 0
          const gapOpen = stopHit ? win[hitBar].open : 0
          const exit = stopHit ? (gapOpen > 0 ? Math.min(e.stop, gapOpen) : e.stop) : win[win.length - 1].close
          retPct = Math.round((exit / e.entry - 1) * 1000) / 10
          // 참고값 — 손절을 안 지키고 끝까지 들고 갔을 때. 둘의 차이가 곧 '손절이 지켜준 폭'이다
          retHoldPct = Math.round((win[win.length - 1].close / e.entry - 1) * 1000) / 10
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
          } else {
            // 📉 손절선은 안 깼지만 거래량 천장 패턴이 떴다 — 조기 경고(강요 아님, readVolumeCaution SSOT)
            const vc = readVolumeCaution(D)
            if (vc) {
              volCautions.push({
                date: e.date, ticker: e.ticker, name: e.name, flag: flagOf(e.market, e.ticker, null),
                market: e.market, track: e.track, entry: e.entry,
                last: Math.round(last * 100) / 100,
                retPct: Math.round((last / e.entry - 1) * 1000) / 10,
                burstChg: vc.burstChg, pullVolX: vc.pullVolX,
              })
            }
          }
        }
      }
    } catch { /* 개별 실패는 미채점(null)로 남는다 — 조용히 0으로 세지 않는다 */ }
    scored.push({ entry: e, retPct, stopHit })
    recent.push({ date: e.date, ticker: e.ticker, name: e.name, flag: flagOf(e.market, e.ticker, null), track: e.track, retPct, retHoldPct, stopHit })
  }
  recent.reverse()

  const grades = [gradeSwing(scored, 'all'), gradeSwing(scored, 'reversion'), gradeSwing(scored, 'trend'), gradeSwing(scored, 'spike')]

  const r1 = (n: number) => Math.round(n * 10) / 10
  const stat = (a: number[]) => {
    if (!a.length) return { n: 0, avgPct: null, medPct: null, winRate: null, ge5Rate: null, ge10Rate: null }
    const s = [...a].sort((x, y) => x - y)
    const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
    return {
      n: a.length,
      avgPct: r1(a.reduce((x, y) => x + y, 0) / a.length),
      medPct: r1(mid),
      winRate: Math.round(a.filter(x => x > 0).length / a.length * 100),
      ge5Rate: Math.round(a.filter(x => x >= 5).length / a.length * 100),
      ge10Rate: Math.round(a.filter(x => x >= 10).length / a.length * 100),
    }
  }
  const horizons = HORIZONS.map(h => ({ bars: h.bars, label: h.label, ...stat(horizonRets[h.bars]) }))
  const pk = stat(peaks.map(p => p.pct))
  const peak = {
    n: pk.n, avgPct: pk.avgPct, medPct: pk.medPct, ge5Rate: pk.ge5Rate, ge10Rate: pk.ge10Rate,
    avgBar: peaks.length ? Math.round(peaks.reduce((s, p) => s + p.bar, 0) / peaks.length) : null,
  }

  return {
    asOf: new Date().toISOString(), scanned, okCount, usdKrw,
    indexRegime: { KR: krIdx, US: usIdx }, barDate, items, cappedOut, skippedForeign, tracks,
    grades, recent: recent.slice(0, 20), stopAlerts, volCautions, horizons, peak,
  }
}

export { SWING_TRACKS, positionSize }
