/**
 * /api/fedwatch — CME FedWatch 금리 확률 프록시 v2
 *
 * ◆ 핵심 개선 (v1 → v2)
 *  기존 CME 동일월 공식은 회의일이 月 후반(day 25+)일 때 발산 문제 발생.
 *  → 해결: 【다음 달 선물】을 postMeetingRate로 직접 사용
 *    - 회의 다음 달은 전체 기간이 신규 금리를 반영 → 순수한 "회의 이후 기대 금리"
 *    - 공식 복잡성 제거, 月 회의일 위치와 무관하게 안정적
 *
 * ◆ 누적 경로 모델
 *  각 회의의 preRate = 이전 회의의 consensusRate (독립 모델 아닌 누적 경로)
 *  → 더 정확한 시장 컨센서스 경로 재현
 *
 * ★ 연간 1회 수동 업데이트 항목:
 *  FOMC_SCHEDULE (FRB 발표: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
 */

import { NextRequest, NextResponse } from 'next/server'

// ── FF Futures 월 코드 (CME 표준)
const MONTH_CODE: Record<number, string> = {
  1:'F', 2:'G', 3:'H', 4:'J', 5:'K', 6:'M',
  7:'N', 8:'Q', 9:'U', 10:'V', 11:'X', 12:'Z',
}
function futuresTicker(year: number, month: number): string {
  return `ZQ${MONTH_CODE[month]}${String(year).slice(2)}.CBT`
}
function nextMonthInfo(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

// ── FOMC 일정 (2026년 하반기 ~ 2027년 상반기)
interface FomcMeeting {
  label:      string
  month:      number
  year:       number
  date:       string
}

const FOMC_SCHEDULE: FomcMeeting[] = [
  { label: "Jun '26", month: 6,  year: 2026, date: '2026-06-17' },
  { label: "Jul '26", month: 7,  year: 2026, date: '2026-07-29' },
  { label: "Sep '26", month: 9,  year: 2026, date: '2026-09-16' },
  { label: "Oct '26", month: 10, year: 2026, date: '2026-10-28' },
  { label: "Dec '26", month: 12, year: 2026, date: '2026-12-09' },
  { label: "Jan '27", month: 1,  year: 2027, date: '2027-01-27' },
]

// ── Yahoo Finance v8 Chart API 가격 조회
async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestmentSchool/1.0)', 'Accept': 'application/json' },
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const price = (await res.json() as any)?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' && price > 0 ? price : null
  } catch {
    return null
  }
}

// ── 확률 분포 계산 (25bp 격자 선형 보간)
interface RateProb {
  rate:        number
  label:       string
  prob:        number
  isConsensus: boolean
}

function calcProbabilities(preRate: number, postRate: number): RateProb[] {
  const STEP    = 0.25
  const delta   = preRate - postRate               // 양수 = 인하, 음수 = 인상
  const floored = Math.floor(delta / STEP) * STEP  // delta를 25bp 단위 버림
  const frac    = (delta - floored) / STEP         // 0 ~ 1 (잉여 비율)

  const rate1 = parseFloat((preRate - floored).toFixed(3))         // 덜 인하 시나리오
  const rate2 = parseFloat((preRate - floored - STEP).toFixed(3))  // 더 인하 시나리오

  const probs: RateProb[] = [
    {
      rate: rate1,
      label: `${(rate1 - 0.125).toFixed(2)}~${(rate1 + 0.125).toFixed(2)}%`,
      prob: parseFloat(((1 - frac) * 100).toFixed(1)),
      isConsensus: false,
    },
  ]
  if (frac > 0.005) {
    probs.push({
      rate: rate2,
      label: `${(rate2 - 0.125).toFixed(2)}~${(rate2 + 0.125).toFixed(2)}%`,
      prob: parseFloat((frac * 100).toFixed(1)),
      isConsensus: false,
    })
  }

  // 최고 확률 = 컨센서스
  const maxProb = Math.max(...probs.map(p => p.prob))
  probs.forEach(p => { if (p.prob === maxProb) p.isConsensus = true })

  return probs.sort((a, b) => b.rate - a.rate)
}

// ── Response 타입
export interface FomcProbData {
  label:           string
  date:            string
  futuresTicker:   string        // 【다음달】 선물 티커 (postMeetingRate 계산 기준)
  futuresPrice:    number | null
  postMeetingRate: number | null // 100 - nextMonthPrice = 회의 이후 기대 금리
  probs:           RateProb[]
  consensusRate:   number | null
  consensusProb:   number | null
  dataAvailable:   boolean
}

// ────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const currentRateParam = url.searchParams.get('currentRate')
  const initPreRate = currentRateParam ? parseFloat(currentRateParam) : 3.375

  if (isNaN(initPreRate) || initPreRate <= 0) {
    return NextResponse.json({ error: 'Invalid currentRate' }, { status: 400 })
  }

  // 오늘 이후 회의만
  const today = new Date()
  const upcoming = FOMC_SCHEDULE.filter(m => new Date(m.date) > today)

  // ── 1단계: 모든 다음달 선물 가격 병렬 조회
  const tickerFetches = upcoming.map(m => {
    const nm = nextMonthInfo(m.year, m.month)
    return { meeting: m, nm, ticker: futuresTicker(nm.year, nm.month) }
  })

  const prices = await Promise.all(
    tickerFetches.map(async ({ ticker }) => fetchPrice(ticker))
  )

  // ── 2단계: 누적 경로 모델로 확률 계산
  // 이전 회의의 consensusRate가 다음 회의의 preRate
  let runningPreRate = initPreRate
  const results: FomcProbData[] = []

  tickerFetches.forEach(({ meeting, ticker }, i) => {
    const price = prices[i]

    if (price === null) {
      results.push({
        label: meeting.label, date: meeting.date,
        futuresTicker: ticker, futuresPrice: null,
        postMeetingRate: null, probs: [],
        consensusRate: null, consensusProb: null,
        dataAvailable: false,
      })
      // preRate 유지 (데이터 없으면 이전 값 그대로)
      return
    }

    // 다음달 선물 implied rate = 회의 이후 기대 금리 (순수 신호)
    const postMeetingRate = parseFloat((100 - price).toFixed(4))
    const probs           = calcProbabilities(runningPreRate, postMeetingRate)
    const consensus       = probs.find(p => p.isConsensus)

    results.push({
      label: meeting.label, date: meeting.date,
      futuresTicker: ticker, futuresPrice: price,
      postMeetingRate,
      probs,
      consensusRate: consensus?.rate ?? null,
      consensusProb: consensus?.prob ?? null,
      dataAvailable: true,
    })

    // 다음 회의의 preRate = 이번 회의의 consensus (누적 경로)
    if (consensus?.rate !== undefined) {
      runningPreRate = consensus.rate
    }
  })

  return NextResponse.json({
    asOf:     new Date().toISOString(),
    preRate:  initPreRate,
    meetings: results,
    note:     'postMeetingRate = 100 - next_month_futures_price (CME next-month approach)',
  })
}
