// 🐝 벌집순환모형 API — 지역별 아파트 '가격(3개월 변화) × 거래량(전년동기비)' 6국면 자동 판정(부동산판 로테이션 시계)
// 데이터: R-ONE (월)매매가격지수_아파트 + (월)행정구역별 아파트매매거래현황. ⚠️ 두 테이블 CLS 코드가 달라 별도 맵(lib/rone 실측).
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'
import { roneSeries, RONE_PRICE_TBL, RONE_PRICE_CLS, RONE_VOL_TBL, RONE_VOL_CLS, RONE_VOL_ITM } from '@/lib/rone'

export type HcPhase = 1 | 2 | 3 | 4 | 5 | 6
export interface HcRegion {
  name: string
  priceIdx: number | null        // 최신 지수
  priceChg3m: number | null      // 3개월 지수 변화율 %
  volYoY: number | null          // 최근 3개월 거래량 합 전년동기비 %
  vol3m: number | null           // 최근 3개월 거래량 합(호)
  phase: HcPhase; phaseName: string
  trail: { ym: string; p: number; v: number }[]   // 최근 24개월 궤적(가격3m%·거래량YoY%)
  asOf: string
}
export interface HcPhaseChange { name: string; from: string; to: string; date: string }
export interface HoneycombResult { regions: HcRegion[]; phaseCount: Record<HcPhase, number>; phaseChanges?: HcPhaseChange[]; asOf: string }

// 벌집 6국면(고전 모형) — 가격 방향(3m, ±0.3% 밴드) × 거래량 방향(YoY 부호)
// ⚠️ route 파일은 GET 등 지정 export만 허용 — 상수는 export 금지(fomcSchedule 교훈)
const HC_PHASES: Record<HcPhase, string> = {
  1: '회복기', 2: '호황기(상승)', 3: '침체 진입', 4: '침체기', 5: '불황기', 6: '회복 진입',
}
function judge(p: number, v: number): HcPhase {
  const pd = p > 0.3 ? 'up' : p < -0.3 ? 'down' : 'flat'
  const vd = v >= 0 ? 'up' : 'down'
  if (pd === 'up') return vd === 'up' ? 2 : 3
  if (pd === 'down') return vd === 'up' ? 6 : 5
  return vd === 'up' ? 1 : 4
}

const ymNow = () => { const d = new Date(Date.now() + 9 * 3600_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

export async function GET() {
  const cacheKey = 're-honeycomb-v3'   // v3: vol3m·asOf 표시 창을 판정 창(nowM)으로 통일(미발행 달 0 혼입 과소 표기 수정) — reader: re-apt(국면 연동)
  const cached = await getCache<HoneycombResult>(cacheKey, 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const END = ymNow()
  const names = Object.keys(RONE_PRICE_CLS).filter(n => RONE_VOL_CLS[n] != null)   // 두 테이블 공통 지역(전국+17시도)
  // 가격 4년(3m 변화 궤적용) · 거래량 5년(YoY 계산용) — 지역별 2콜, 동시성 4
  const regions: HcRegion[] = []
  const queue = [...names]
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const name = queue.shift()
      if (!name) break
      const [price, vol] = await Promise.all([
        roneSeries(RONE_PRICE_TBL, RONE_PRICE_CLS[name], '202201', END),
        roneSeries(RONE_VOL_TBL, RONE_VOL_CLS[name], '202101', END, RONE_VOL_ITM),   // 동(호)수만(면적 행 오염 차단)
      ])
      if (price.length < 6 || vol.length < 15) continue
      const pMap = new Map(price.map(x => [x.time, x.value]))
      const vMap = new Map(vol.map(x => [x.time, x.value]))
      const ymAdd = (ym: string, k: number) => { const y = +ym.slice(0, 4), m = +ym.slice(4) + k; const yy = y + Math.floor((m - 1) / 12); const mm = ((m - 1) % 12 + 12) % 12 + 1; return `${yy}${String(mm).padStart(2, '0')}` }
      const metric = (ym: string): { p: number; v: number } | null => {
        const p0 = pMap.get(ym), p3 = pMap.get(ymAdd(ym, -3))
        if (p0 == null || p3 == null || p3 === 0) return null
        let cur = 0, prev = 0, ok = true
        for (let k = 0; k < 3; k++) {
          const c = vMap.get(ymAdd(ym, -k)), q = vMap.get(ymAdd(ym, -12 - k))
          if (c == null || q == null) { ok = false; break }
          cur += c; prev += q
        }
        if (!ok || prev === 0) return null
        return { p: Math.round((p0 / p3 - 1) * 1000) / 10, v: Math.round((cur / prev - 1) * 1000) / 10 }
      }
      // 궤적: 최신월부터 과거 24개월
      const lastYm = price[price.length - 1].time
      const trail: { ym: string; p: number; v: number }[] = []
      for (let k = 23; k >= 0; k--) {
        const ym = ymAdd(lastYm, -k)
        const m = metric(ym)
        if (m) trail.push({ ym: `${ym.slice(0, 4)}-${ym.slice(4)}`, ...m })
      }
      const nowM = trail.length ? trail[trail.length - 1] : null
      if (!nowM) continue
      // ⚠️ 표시 창 = 판정 창(nowM 기준월) — 가격 최신월(lastYm) 기준으로 합하면 거래량 미발행 달이 0으로 섞여 과소 표기(16,467호 사건)
      const nowYmRaw = nowM.ym.replace('-', '')
      const vol3m = [0, 1, 2].reduce((s, k) => s + (vMap.get(ymAdd(nowYmRaw, -k)) ?? 0), 0)
      const phase = judge(nowM.p, nowM.v)
      regions.push({
        name, priceIdx: Math.round(price[price.length - 1].value * 100) / 100,
        priceChg3m: nowM.p, volYoY: nowM.v, vol3m: vol3m || null,
        phase, phaseName: HC_PHASES[phase], trail,
        asOf: nowM.ym,   // 판정 기준월(가격·거래 둘 다 있는 최신월) — 가격만 최신인 달을 '기준'으로 표기하던 불일치 수정
      })
    }
  }))
  if (regions.length < 8)
    return NextResponse.json({ error: 'R-ONE 수집 부족 — 잠시 후 재시도' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  const order = Object.keys(RONE_PRICE_CLS)
  regions.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  const phaseCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<HcPhase, number>
  for (const r of regions) if (r.name !== '전국') phaseCount[r.phase]++

  // 🔔 국면 전환 감지 — 직전 스냅과 diff(타점 워처 패턴). 전환은 7일간 배너 유지
  let phaseChanges: HcPhaseChange[] | undefined
  try {
    const kstDate = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const prev = await getCache<{ phases: Record<string, string> }>('re-phase-latest', 90 * 86400_000)
    if (prev?.phases) {
      const diffs = regions
        .filter(r => prev.phases[r.name] && prev.phases[r.name] !== r.phaseName)
        .map(r => ({ name: r.name, from: prev.phases[r.name], to: r.phaseName, date: kstDate }))
      if (diffs.length) await setCache('re-phase-changes', { changes: diffs })
    }
    const nowPhases: Record<string, string> = {}
    for (const r of regions) nowPhases[r.name] = r.phaseName
    await setCache('re-phase-latest', { phases: nowPhases })
    const recent = await getCache<{ changes: HcPhaseChange[] }>('re-phase-changes', 7 * 86400_000)
    if (recent?.changes?.length) phaseChanges = recent.changes
  } catch { /* graceful */ }

  const result: HoneycombResult = { regions, phaseCount, phaseChanges, asOf: new Date().toISOString() }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
