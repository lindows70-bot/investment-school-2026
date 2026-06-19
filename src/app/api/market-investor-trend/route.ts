// 코스피/코스닥 투자자별 매매동향 — 네이버 일별 투자자 순매수(개인·외국인·기관 세부)를 타임라인으로
// Zero Cost: finance.naver.com 레거시 투자자 테이블(무인증·EUC-KR) 파싱 · 단위 억원 · 6h 캐시
import { NextResponse } from 'next/server'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface InvestorRow {
  date: string          // YYYY-MM-DD
  personal: number      // 개인 순매수(억원, +매수/−매도)
  foreign: number       // 외국인
  institution: number   // 기관계
  finInvest: number     // 금융투자
  insurance: number     // 보험
  trust: number         // 투신
  bank: number          // 은행
  otherFin: number      // 기타금융
  pension: number       // 연기금등
  otherCorp: number     // 기타법인
}
export interface MarketInvestorResult {
  market: 'KOSPI' | 'KOSDAQ'
  rows: InvestorRow[]           // 최신 → 과거
  foreignCumSeries: { date: string; cum: number }[]   // 외국인 누적 순매수(과거→최신, 타임라인 차트용)
  cum: { personal: number; foreign: number; institution: number }   // 기간 누적
  asOf: string
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const yyyymmdd = () => kstDate().replace(/-/g, '')
const NUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// 네이버 원자료 단위는 백만원 → 억원으로 환산(÷100)해 앱 전체와 단위 통일
const toEok = (s: string): number => {
  const v = parseFloat(s.replace(/,/g, '').replace(/[−–]/g, '-'))
  return isFinite(v) ? Math.round(v / 100 * 10) / 10 : 0
}

// 한 페이지(약 10거래일) 파싱 — bizdate가 페이지의 '최신일'을 지정
async function fetchPage(sosok: '01' | '02', bizdate: string): Promise<InvestorRow[]> {
  const url = `https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=${bizdate}&sosok=${sosok}`
  const r = await fetch(url, { headers: { 'User-Agent': NUA, Referer: 'https://finance.naver.com/sise/' }, signal: AbortSignal.timeout(12_000) })
  if (!r.ok) return []
  const html = new TextDecoder('euc-kr').decode(await r.arrayBuffer())
  const rows: InvestorRow[] = []
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [])
      .map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim())
    if (cells.length < 11 || !/^\d{2}\.\d{2}\.\d{2}$/.test(cells[0])) continue
    const [d, personal, foreign, institution, finInvest, insurance, trust, bank, otherFin, pension, otherCorp] = cells
    rows.push({
      date: `20${d.replace(/\./g, '-')}`,
      personal: toEok(personal), foreign: toEok(foreign), institution: toEok(institution),
      finInvest: toEok(finInvest), insurance: toEok(insurance), trust: toEok(trust),
      bank: toEok(bank), otherFin: toEok(otherFin), pension: toEok(pension), otherCorp: toEok(otherCorp),
    })
  }
  return rows
}

// 여러 페이지 체이닝 — 각 페이지의 가장 오래된 날짜 직전을 다음 bizdate로(중복 제거)
async function fetchMarket(sosok: '01' | '02', pages: number): Promise<InvestorRow[]> {
  const all: InvestorRow[] = []
  const seen = new Set<string>()
  let bizdate = yyyymmdd()
  for (let p = 0; p < pages; p++) {
    const page = await fetchPage(sosok, bizdate)
    if (page.length === 0) break
    for (const row of page) { if (!seen.has(row.date)) { seen.add(row.date); all.push(row) } }
    const oldest = page[page.length - 1].date   // YYYY-MM-DD
    const prev = new Date(new Date(oldest).getTime() - 86400_000).toISOString().slice(0, 10)
    bizdate = prev.replace(/-/g, '')
  }
  return all.sort((a, b) => b.date.localeCompare(a.date))   // 최신 → 과거
}

export async function GET(req: Request) {
  const market = new URL(req.url).searchParams.get('market') === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI'
  const cacheKey = `mkt-investor-v2:${market}:${kstDate()}`   // v2: 70거래일(3개월 집계)
  const cached = await getCache<MarketInvestorResult>(cacheKey, 6 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const rows = await fetchMarket(market === 'KOSDAQ' ? '02' : '01', 7)   // 약 70거래일(3개월 집계 커버)
  if (rows.length === 0) return NextResponse.json({ error: 'no_data' }, { status: 200 })

  // 외국인 누적 추세(과거→최신) — 타임라인 차트
  const chrono = [...rows].reverse()
  let acc = 0
  const foreignCumSeries = chrono.map(r => { acc += r.foreign; return { date: r.date, cum: Math.round(acc) } })

  const cum = {
    personal: Math.round(rows.reduce((s, r) => s + r.personal, 0)),
    foreign: Math.round(rows.reduce((s, r) => s + r.foreign, 0)),
    institution: Math.round(rows.reduce((s, r) => s + r.institution, 0)),
  }

  const result: MarketInvestorResult = { market, rows, foreignCumSeries, cum, asOf: new Date().toISOString() }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
