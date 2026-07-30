// 🐎 신고가 레이더 — '달리는 말에 올라타라'를 데이터로 판정하는 조합 lib (신규 판정기 0)
//
// Phase 0 백테스트(docs/hi52-radar/context-notes.md, 84종목·2년·워크포워드·비중복)가 준 결론:
//   · 갓 신고가(≥98%) 추격 = 나쁘다 — 60봉 절사 edge −1.75 · 중위 −4.1 · 승률 −6.8pp(고가 기준 공식)
//   · 신고가 아래로 물러난 상승추세 자리(눌림)가 낫다 — 단 그 edge의 정체는 '신고가 근처'가 아니라
//     **건강한 추세**였다(200일선 위 baseline 대비 소멸). 그래서 판정은 이미 검증된 기존 SSOT
//     (신호등 green 구조 + 정예 타점/첫 눌림목 — 절사 +1.8)가 하고, hi52는 **모집 필터·위치 라벨**만 한다.
// ⛔ hi52 기반 신규 점수·판정기를 만들지 않는다(WHAT/WHEN 분리 + 백테스트 기각).
import { getCache } from './appCache'
import { getTechCandles } from './techChartData'
import { timingFromCandles } from './entryTiming'
import type { ScreenedStock } from './macroPhaseScreener'
import { SECTOR_TO_ROT, loadRotationBySector, type RotQuadShared } from './rotationShared'

export interface Hi52Item {
  ticker: string; name: string; market: 'US' | 'KR'
  sector: string | null; industry: string | null
  price: number | null
  hi52: number                      // 52주 최고가(고가 기준) 대비 현재 위치 % — techScreener와 동일 공식
  spark: number[]                   // 최근 40봉 종가(미니차트)
  quant: number                     // 유니버스 퀀트 점수 ×100(기존 SSOT — macro-ai-picks·4계절과 동일 값)
  value: number; quality: number; momentum: number   // 통합추천 소축(0~100) — 참고 칩
  peg: number | null
  light: 'green' | 'yellow' | 'red' | null
  lightLabel: string                // 신호등 라벨(🟢 진입 적기 등 — entryTiming SSOT 그대로)
  trigger: 'prime' | 'pullback' | null   // 🎼 검증 트리거(정예 타점·첫 눌림목)
  rotQuad: RotQuadShared | null     // 🧭 소속 섹터 로테이션 국면
  reasons: string[]                 // ⏳ 추격 주의 그룹의 사유 칩
  flags: string[]                   // 유니버스 경고 플래그(상위 2)
  atrStop: number | null
}

export interface Hi52Radar {
  asOf: string
  scanned: number; okCount: number
  ride: Hi52Item[]                  // 🎯 지금 올라탈 자리 — green 구조 + 검증 트리거 + 깨끗
  wait: Hi52Item[]                  // 🐎 달리는 중 — 구조 유지, 눌림·트리거 대기
  caution: Hi52Item[]               // ⏳ 추격 주의 — 갓 돌파·과대이격·에너지 소진·급락
  momCrash: boolean                 // ⚠️ 모멘텀 크래시 국면(승패 해부실 실측 재사용) — 캐비엇 전용
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 모집·경계는 앱 기존 관례 재사용(새 숫자 발명 금지 — 가짜 정밀 금지):
//   75 = posLabel '중상단' 경계(QuantBuilder ChaseBadge) · 98 = 로테이션 신고가 스캐너 HI_NEAR
const POOL_MIN = 75, FRESH_HIGH = 98

export async function buildHi52Radar(): Promise<Hi52Radar | { error: string; note: string }> {
  const uni = (await getCache<ScreenedStock[]>('macro-screened-universe:v10', 8 * 24 * 3600_000)) ?? []
  if (uni.length === 0) return { error: 'universe_cold', note: '유니버스 캐시가 비었습니다. 주간 스크리너 크론 이후 다시 시도하세요.' }

  const rotBySector = await loadRotationBySector()
  // ⚠️ 모멘텀 크래시 국면 — unified-reco와 동일한 win-lose 캐시 읽기(승패 해부실 실측)
  let momCrash = false
  try {
    for (let i = 0; i < 2; i++) {
      const dt = new Date(Date.now() + 9 * 3600_000 - i * 86400_000).toISOString().slice(0, 10)
      const wl = await getCache<{ momCrash?: boolean }>(`win-lose-v8:${dt}`, 2 * 24 * 3600_000)
      if (wl) { momCrash = !!wl.momCrash; break }
    }
  } catch { /* graceful */ }

  const ride: Hi52Item[] = [], wait: Hi52Item[] = [], caution: Hi52Item[] = []
  let scanned = 0, okCount = 0
  const q = [...uni]
  const CONC = 10
  async function worker() {
    while (q.length) {
      const s = q.shift(); if (!s) break
      try {
        const D = await getTechCandles(s.ticker, s.market, 'D')
        if (!D || D.length < 260) continue          // 52주(252봉) 미만 신규상장은 '신고가' 의미 약함 → 정직 생략
        okCount++
        const N = D.length, last = D[N - 1]
        // hi52 — techScreener evaluateSetups와 동일 공식(직전 252봉 고가 최대 대비, SSOT)
        const win52 = D.slice(Math.max(0, N - 252))
        let hi = 0; for (const c of win52) { const h = c.high ?? c.close; if (h > hi) hi = h }
        if (hi <= 0) continue
        const hi52 = Math.round(last.close / hi * 1000) / 10
        if (hi52 < POOL_MIN) continue               // 모집 밖(달리는 말 아님)
        scanned++

        const t = timingFromCandles(D)
        if (!t) continue
        const rk = t.raschke, sp = t.supply
        const trigger: Hi52Item['trigger'] = t.prime ? 'prime' : (rk?.pullback ? 'pullback' : null)
        const rotKey = s.sector ? SECTOR_TO_ROT[s.sector] : undefined
        const rotQuad = (rotKey ? rotBySector?.get(rotKey)?.q : null) ?? null

        // ⏳ 추격 주의 사유 — 백테스트·기존 가드에서 온 것만(발명 금지)
        const reasons: string[] = []
        if (hi52 >= FRESH_HIGH) reasons.push(`갓 돌파(${hi52}%) — 표본에서 3개월 중위 −4.1%·승률 −6.8pp`)
        if (sp?.overExtended && sp.vwapDistPct != null) reasons.push(`기관평단 +${sp.vwapDistPct}% 과대이격`)
        if (rk?.bearDiv) reasons.push('하락 다이버전스(에너지 소진)')
        if (sp?.sharpDrop && sp.dropFromHigh != null) reasons.push(`급락 ${sp.dropFromHigh}%`)
        if (s.knife) reasons.push('🔪 떨어지는 칼날')

        const item: Hi52Item = {
          ticker: s.ticker, name: s.name ?? s.ticker, market: s.market,
          sector: s.sector ?? null, industry: s.industry ?? null,
          price: last.close, hi52,
          spark: D.slice(-40).map(c => Math.round(c.close * 100) / 100),
          quant: Math.min(100, Math.round((s.score ?? 0) * 100)),   // 원시 score는 lynch 가중이 1을 넘어 107도 나온다 — 표시축은 100 캡(4계절 매수후보 표기 관례)
          value: Math.round((s.valueScore ?? 0) * 100), quality: Math.round((s.qualityScore ?? 0) * 100),
          momentum: Math.round(s.momentumScore ?? 0),
          peg: s.peg ?? null,
          light: t.light, lightLabel: t.label,
          trigger, rotQuad, reasons,
          flags: (s.flags ?? []).slice(0, 2),
          atrStop: t.atrStop,
        }
        // 그룹 판정 — ⏳ 사유가 하나라도 있으면 최우선(경고가 권유에 덮이지 않게), 그다음 트리거, 나머지는 대기
        if (reasons.length) caution.push(item)
        else if (t.light === 'green' && trigger) ride.push(item)
        else wait.push(item)
      } catch { /* 종목 하나 실패로 전체를 멈추지 않는다 */ }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))

  const byQuant = (a: Hi52Item, b: Hi52Item) => b.quant - a.quant
  ride.sort(byQuant); wait.sort(byQuant); caution.sort(byQuant)
  return { asOf: kstDate(), scanned, okCount, ride, wait, caution, momCrash }
}
