// 🐳 거인의 포트폴리오 — 13F Shadow Tracker의 '역방향 뷰'.
//   기존 shadow-13f는 "이 종목을 누가 들고 있나"(종목→거인)였고, 이건 "이 거인이 뭘 들고 있나"(거인→전체 리스트).
//   동일한 loadFunds()·12h 캐시 재사용(추가 SEC 부하 0). 사용자 요청: 워런 버핏(버크셔) 보유 리스트를 앱에 노출.
//   ⚠️ 13F는 발행사명만 있고 티커/CUSIP은 없음(유료) → 종목명·주식수·평가액·포트비중·전분기 대비 증감만. 45일 지연 스냅샷.
//   ⚠️ 보유 목록·비중은 **주식 줄만**(2026-11-28) — 풋 · 콜은 따로 싣는다(options). 13F 의 옵션 금액은 옵션 값이 아니라 기초자산 주식의 시가라
//      비중에 섞으면 실제보다 훨씬 크게 잡히고, 풋(내리면 버는 계약)이 '보유 종목'으로 보인다(시타델 금액의 80% · 튜더 70% · 사이언 95%가 옵션 줄).
import { NextResponse } from 'next/server'
import { FUNDS, loadFunds, loadFundQuarters } from '@/lib/guru13f'
import { getTechCandles } from '@/lib/techChartData'
import { getCache, setCache } from '@/lib/appCache'
import { issuerToTicker } from '@/lib/guru13fTickers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface GuruPosition {
  name: string
  ticker: string | null               // 발행사명→티커 매핑(유명 대형주 커버). 못 찾으면 null
  shares: number
  value: number                       // USD 평가액(13F value — 천 달러로 적는 법인은 로더가 달러로 맞춘다)
  pctPort: number                     // 펀드 포트폴리오 내 비중 %
  action: 'new' | 'add' | 'hold' | 'trim'
  deltaPct: number | null             // 전분기 대비 주식수 증감 %
  retSinceFiling: number | null       // 13F 공시일 종가 대비 현재 종가 등락률(%) — 거인 실제수익률 아님
  estAvgPrice: number | null          // 🧮 추정 매입 평단 — 최근 N분기 매집분을 그 분기 평균가로 역산(사설 사이트와 동일 기법). 장기보유는 null
  estReturn: number | null            // 추정 평단 대비 현재 수익률(%) — 데이터 창(약 2년) 안에서 매집된 종목만
  longHeld: boolean                   // 데이터 창 이전부터 보유 → 추정 불가(애플·코카콜라 등)
  self: boolean                       // 발행사명 = 신고 법인명 — 자기 회사 주식 줄(퍼싱스퀘어 1위 줄이 이것)
}
/** 옵션 줄 — shares·value 는 **기초자산** 주식 수·시가(옵션에 실제로 낸 돈이 아니다) */
export interface GuruOption {
  name: string; ticker: string | null; pc: 'put' | 'call'
  shares: number; value: number
  action: 'new' | 'add' | 'hold' | 'trim'; deltaPct: number | null
}
export interface GuruPortfolioResult {
  status: 'ok' | 'error'
  funds: { cik: string; mgr: string; fund: string; available: boolean; broad: boolean; stale: boolean }[]   // 셀렉터용 목록(available=이번 캐시에 로드된 거인)
  cik: string
  mgr: string
  fund: string
  asOf: string                        // 신고일
  total: number                       // 주식 줄 신고 금액 합(USD) — 옵션 · 채권 제외
  count: number                       // 보유 종목 수(회사 단위로 합친 뒤)
  positions: GuruPosition[]           // 비중 큰 순(상위 N)
  reportDate: string                  // 분기말 — 이 보유가 어느 날의 사진인가
  stale: boolean                      // 최신 분기 신고가 없다(통지로 바꿨거나 신고를 그만둠) → '마지막 신고'로 읽어야 한다
  broad: boolean                      // 수천 종목을 사고파는 운용사 — 상위 보유가 확신이라는 뜻이 아니다
  lines: number                       // 13F 전체 줄(주식 + 옵션 + 채권)
  stockLines: number                  // 주식 줄 수(전체)
  keptPct: number | null              // 줄이 많아 금액 상위만 읽었을 때, 읽은 줄이 주식 금액의 몇 %인가(전부 읽었으면 null)
  options: GuruOption[]               // 기초자산 금액 큰 순(상위 N)
  optExits: { name: string; ticker: string | null; pc: 'put' | 'call'; shares: number }[]   // 전분기에 있었고 이번 분기 신고에 없는 옵션(금액 상위 범위 안)
  optLines: number; optCallVal: number; optPutVal: number
  bondLines: number; bondVal: number  // 채권 등(액면으로 적는 줄) — 목록에는 안 넣는다
  message?: string
}

const DEFAULT_CIK = '0001067983'   // 워런 버핏 · 버크셔 해서웨이
const OPT_TOP = 40
const EMPTY = { reportDate: '', stale: false, broad: false, lines: 0, stockLines: 0, keptPct: null, options: [], optExits: [], optLines: 0, optCallVal: 0, optPutVal: 0, bondLines: 0, bondVal: 0 }
const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export async function GET(req: Request) {
  const cik = (new URL(req.url).searchParams.get('cik') || DEFAULT_CIK).trim()
  const meta = FUNDS.find(f => f.cik === cik) ?? FUNDS.find(f => f.cik === DEFAULT_CIK)!

  // 조립 결과(수익률 포함) 6h 캐시 — 일봉 종가는 하루 1회만 바뀌므로 매 요청 가격조회 불필요
  const cacheKey = `guru-portfolio-v9:${meta.cik}`   // v9(2026-11-28): 크리도(CRDO) 티커 매핑 — 티커가 붙으면 '공시 후' 칸도 채워진다 · v8(2026-11-28): 코언을 분산형으로(추정 수익 생략 · 셀렉터 목록의 broad) · v7(2026-11-28): 주식 줄만 · 옵션(풋/콜) 따로 · reportDate·stale·broad·self · v6: Liberty Live 등 티커 병합 확장
  const cached = await getCache<GuruPortfolioResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const funds = await loadFunds()
    const byName = new Map(funds.map(f => [`${f.mgr}|${f.fund}`, f]))
    const fundList = FUNDS.map(f => { const l = byName.get(`${f.mgr}|${f.fund}`); return { cik: f.cik, mgr: f.mgr, fund: f.fund, available: !!l, broad: f.broad === true, stale: l?.stale === true } })
    const fd = funds.find(f => f.mgr === meta.mgr && f.fund === meta.fund)
    if (!fd) {
      return NextResponse.json({
        status: 'error', funds: fundList, cik: meta.cik, mgr: meta.mgr, fund: meta.fund,
        asOf: '', total: 0, count: 0, positions: [], ...EMPTY, message: '이 거인의 13F는 지금 불러오지 못했습니다(SEC 일시 지연) — 다른 거인을 선택하거나 잠시 후 다시 시도하세요.',
      } satisfies GuruPortfolioResult)
    }

    // 티커 우선 합산(회사 단위 — 알파벳 A/C·레나 A/B 등 주식클래스를 한 줄로 병합). 티커 없으면 CUSIP(이름 드리프트 방어). 전분기·타임라인 매칭도 같은 키.
    const keyOf = (name: string, cusip: string) => issuerToTicker(name) || cusip || name
    const prevByKey = new Map<string, number>()
    for (const h of fd.prev) { const k = keyOf(h.name, h.cusip); if (k) prevByKey.set(k, (prevByKey.get(k) ?? 0) + h.sh) }
    const curAgg = new Map<string, { name: string; ticker: string | null; sh: number; val: number }>()
    for (const h of fd.cur) {
      const k = keyOf(h.name, h.cusip)
      const a = curAgg.get(k) ?? { name: h.name, ticker: issuerToTicker(h.name), sh: 0, val: 0 }
      a.sh += h.sh; a.val += h.val; curAgg.set(k, a)
    }

    const positions: (GuruPosition & { key: string })[] = Array.from(curAgg.entries()).map(([key, a]) => {
      const prevSh = prevByKey.get(key) ?? 0
      let action: GuruPosition['action']; let deltaPct: number | null = null
      if (prevSh <= 0) { action = 'new' }
      else {
        deltaPct = Math.round(((a.sh - prevSh) / prevSh) * 1000) / 10
        action = deltaPct > 5 ? 'add' : deltaPct < -5 ? 'trim' : 'hold'
      }
      return {
        name: a.name, key, ticker: a.ticker, shares: a.sh, value: a.val,
        pctPort: fd.total > 0 ? Math.round((a.val / fd.total) * 1000) / 10 : 0,
        action, deltaPct, retSinceFiling: null, estAvgPrice: null, estReturn: null, longHeld: false,
        self: !!fd.filer && normName(a.name) === normName(fd.filer),
      }
    }).sort((x, y) => y.value - x.value)

    const top = positions.slice(0, 40)   // 상위 40 종목(대부분 이 안에서 포트 95%+)

    // 🧮 다중분기 이력 → 회사(키)별 분기 주식수 타임라인(추정 평단용). 주식클래스를 티커로 합산해 병합 뷰와 일관.
    //    수천 종목을 사고파는 운용사(broad)는 건너뛴다 — 분기말 사진 사이에 수없이 사고팔아 '매집 분기 평균가 = 평단'이라는 가정이 서지 않는다(가짜 정밀)
    const quarters = fd.broad ? [] : await loadFundQuarters(meta.cik, 8)
    const shTimeline = new Map<string, { asOf: string; sh: number }[]>()   // key → [{분기말, 주식수}] 오래된→최신
    if (quarters.length >= 2) {
      const keys = new Set(top.map(p => p.key))
      for (const q of quarters) {
        const byKey = new Map<string, number>()
        for (const h of q.holdings) { const k = keyOf(h.name, h.cusip); if (keys.has(k)) byKey.set(k, (byKey.get(k) ?? 0) + h.sh) }
        for (const ky of Array.from(keys)) {
          const arr = shTimeline.get(ky) ?? []
          arr.push({ asOf: q.asOf, sh: byKey.get(ky) ?? 0 })
          shTimeline.set(ky, arr)
        }
      }
    }

    // ⚠️ 공시일 이후 주가 수익률(거인의 실제 수익률 아님) — 티커 매핑된 것만, 캔들(캐시)로 공시일 종가→현재 종가
    const closeAtOrBefore = (candles: { date: string; close: number }[], date: string): number | null => {
      for (let i = candles.length - 1; i >= 0; i--) if (candles[i].date <= date) return candles[i].close
      return null
    }
    const avgClose = (candles: { date: string; close: number }[], from: string, to: string): number | null => {
      const win = candles.filter(c => c.date > from && c.date <= to && c.close > 0)
      return win.length ? win.reduce((s, c) => s + c.close, 0) / win.length : null
    }
    const queue = top.filter(p => p.ticker)
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (;;) {
        const p = queue.shift(); if (!p) break
        try {
          const c = await getTechCandles(p.ticker!, 'US', 'D')
          if (c.length) {
            const at = closeAtOrBefore(c, fd.asOf), now = c[c.length - 1].close
            if (at && at > 0 && now > 0) p.retSinceFiling = Math.round((now / at - 1) * 1000) / 10
            // 🧮 추정 평단: 데이터 창(oldest 분기) 이전부터 보유면 추정불가(longHeld), 아니면 매집분×분기평균가 가중평균
            const tl = shTimeline.get(p.key)
            if (tl && tl.length >= 2 && now > 0) {
              if (tl[0].sh > 0) { p.longHeld = true }
              else {
                let boughtSh = 0, boughtCost = 0
                for (let i = 1; i < tl.length; i++) {
                  const delta = tl[i].sh - tl[i - 1].sh
                  if (delta > 0) { const ap = avgClose(c, tl[i - 1].asOf, tl[i].asOf); if (ap && ap > 0) { boughtSh += delta; boughtCost += delta * ap } }
                }
                if (boughtSh > 0 && boughtCost > 0) {
                  const basis = boughtCost / boughtSh
                  p.estAvgPrice = Math.round(basis * 100) / 100
                  p.estReturn = Math.round((now / basis - 1) * 1000) / 10
                }
              }
            }
          }
        } catch { /* graceful — 해당 종목 수익률만 생략 */ }
      }
    }))

    // 옵션 줄 — 같은 회사의 풋과 콜은 따로 센다(키 = 회사 + 풋/콜). 전분기 대비는 기초자산 주식 수로
    const optKey = (h: { name: string; cusip: string; pc?: 'put' | 'call' }) => `${keyOf(h.name, h.cusip)}:${h.pc}`
    const optPrev = new Map<string, { name: string; pc: 'put' | 'call'; sh: number }>()
    for (const h of fd.opt.prev) { if (!h.pc) continue; const k = optKey(h); const a = optPrev.get(k) ?? { name: h.name, pc: h.pc, sh: 0 }; a.sh += h.sh; optPrev.set(k, a) }
    const optCur = new Map<string, { name: string; pc: 'put' | 'call'; sh: number; val: number }>()
    for (const h of fd.opt.cur) { if (!h.pc) continue; const k = optKey(h); const a = optCur.get(k) ?? { name: h.name, pc: h.pc, sh: 0, val: 0 }; a.sh += h.sh; a.val += h.val; optCur.set(k, a) }
    const options: GuruOption[] = Array.from(optCur.entries()).map(([k, a]) => {
      const prevSh = optPrev.get(k)?.sh ?? 0
      const deltaPct = prevSh > 0 ? Math.round(((a.sh - prevSh) / prevSh) * 1000) / 10 : null
      const action: GuruOption['action'] = deltaPct == null ? 'new' : deltaPct > 5 ? 'add' : deltaPct < -5 ? 'trim' : 'hold'
      return { name: a.name, ticker: issuerToTicker(a.name), pc: a.pc, shares: a.sh, value: a.val, action, deltaPct }
    }).sort((x, y) => y.value - x.value).slice(0, OPT_TOP)
    const optExits = Array.from(optPrev.entries()).filter(([k]) => !optCur.has(k))
      .map(([, a]) => ({ name: a.name, ticker: issuerToTicker(a.name), pc: a.pc, shares: a.sh })).sort((x, y) => y.shares - x.shares).slice(0, OPT_TOP)

    const result: GuruPortfolioResult = {
      status: 'ok', funds: fundList, cik: meta.cik, mgr: meta.mgr, fund: meta.fund,
      asOf: fd.asOf, total: fd.total, count: positions.length, positions: top,
      reportDate: fd.reportDate, stale: fd.stale, broad: fd.broad, lines: fd.lines, stockLines: fd.stockLines,
      keptPct: fd.stockKept < fd.stockLines && fd.total > 0 ? Math.round((fd.keptVal / fd.total) * 1000) / 10 : null,
      options, optExits, optLines: fd.opt.lines, optCallVal: fd.opt.callVal, optPutVal: fd.opt.putVal,
      bondLines: fd.bond.lines, bondVal: fd.bond.val,
    }
    await setCache(cacheKey, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({
      status: 'error', funds: FUNDS.map(f => ({ cik: f.cik, mgr: f.mgr, fund: f.fund, available: false, broad: f.broad === true, stale: false })),
      cik: meta.cik, mgr: meta.mgr, fund: meta.fund,
      asOf: '', total: 0, count: 0, positions: [], ...EMPTY, message: (e as Error).message,
    } satisfies GuruPortfolioResult)
  }
}
