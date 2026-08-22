// 🪙 비트코인 현물 ETF — ① 순유입/유출(Farside 무료·최근 일별) ② 누적 거래량(Yahoo 전체 이력, TheBlock 재현)
// Zero Cost·무키: Yahoo Finance(거래량) + Farside Investors 공개 테이블(flow). 24h 캐시.
import { NextResponse } from 'next/server'
import https from 'node:https'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Farside는 Cloudflare가 undici fetch(TLS 지문)를 403 차단 → node:https로 우회(SEC EDGAR 교훈과 동일)
function httpGet(url: string, timeoutMs = 12_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } }, res => {
      if ((res.statusCode ?? 0) >= 400) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')) })
  })
}

const kstDate = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
// 미국 현물 비트코인 ETF (2024-01 출범) — 누적 거래량 합산용
const SPOT_ETFS = ['IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC']

export interface BtcEtfResult {
  cumVolume: { date: string; cum: number }[]   // 누적 거래대금($) — 전체 이력
  latestCumVol: number
  flow: { date: string; net: number; price: number | null }[]   // 최근 일별 순유입/유출($M) + BTC가격
  flowCumulative: number | null                 // 출범 이후 누적 순유입($M, Farside Total)
  flowWindowDays: number
  /** 🏷️ 발행사 티커 순서(Farside 헤더에서 파싱 — 발행사 추가·폐지를 코드 수정 없이 따라간다) */
  issuers: string[]
  /** 최근 10영업일 발행사별 순유입($M) — v 는 issuers 와 같은 순서. 합계 검산을 통과한 행만 들어온다 */
  issuerRecent: { date: string; v: number[] }[]
  /** 발행사별 출범 이후 누적($M) */
  issuerTotals: number[]
  asOf: string
}

interface YfDaily { date: string; volUsd: number }
async function yfVolume(ticker: string): Promise<YfDaily[]> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000),
    })
    if (!r.ok) return []
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    if (!res) return []
    const ts: number[] = res.timestamp ?? []
    const q = res.indicators?.quote?.[0] ?? {}
    const vol: (number | null)[] = q.volume ?? [], cls: (number | null)[] = q.close ?? []
    const out: YfDaily[] = []
    for (let i = 0; i < ts.length; i++) {
      if (vol[i] && cls[i]) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), volUsd: (vol[i] as number) * (cls[i] as number) })
    }
    return out
  } catch { return [] }
}

async function btcPriceDaily(): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=5y&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok) return m
    const res = (await r.json())?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? []
    const cls: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
    for (let i = 0; i < ts.length; i++) if (cls[i]) m.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), cls[i] as number)
  } catch { /* graceful */ }
  return m
}

// Farside 무료 테이블 — 최근 일별 순유입/유출($M) + 출범 이후 누적(Total 행)
const parseFlowNum = (s: string): number | null => {
  const t = s.trim()
  if (t === '-' || t === '') return 0
  const neg = /^\(.*\)$/.test(t)
  const n = parseFloat(t.replace(/[(),]/g, ''))
  return isFinite(n) ? (neg ? -n : n) : null
}
/** 🏷️ 발행사별 컬럼 — Farside 헤더 순서(Date 다음부터 Total 직전까지). 하드코딩이 아니라 **파싱 결과**를 쓴다.
 *  Phase 0 실측(2026-08-21): 헤더 = Date|IBIT|FBTC|BITB|ARKB|BTCO|EZBC|BRRR|HODL|BTCW|MSBT|GBTC|BTC(+Total),
 *  일별 행 671개 전부 13셀로 안정 · 앞 12개 합 = 마지막 셀(Total) 검산 통과 → 컬럼 매핑이 맞다는 증거. */
async function farsideFlow(): Promise<{
  flow: { date: string; net: number }[]; cumulative: number | null
  issuers: string[]; byIssuer: { date: string; v: number[] }[]
}> {
  try {
    // /btc/(최근 2주 요약)가 아니라 all-data 페이지(2024 출범~현재 전체 624일)
    const html = await httpGet('https://farside.co.uk/bitcoin-etf-flow-all-data/')
    const flow: { date: string; net: number }[] = []
    const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    // 각 일별 행: 날짜 + 행 내 마지막 숫자 셀(=Total 순유입)
    // 헤더에서 발행사 티커 추출(Date 제외) — 발행사가 추가·폐지돼도 코드 수정 없이 따라간다
    const heads = Array.from(html.matchAll(/<th[^>]*>([\s\S]{0,60}?)<\/th>/g))
      .map(h => h[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, '').trim()).filter(Boolean)
    const issuers = heads.filter(h => /^[A-Z]{3,5}$/.test(h))   // Date·Total 등 비티커 제외
    const byIssuer: { date: string; v: number[] }[] = []

    const rows = Array.from(html.matchAll(/(\d{1,2})\s+(\w{3})\s+(\d{4})([\s\S]*?)<\/tr>/g))
    for (const m of rows) {
      const mon = MON[m[2]]; if (!mon) continue
      const date = `${m[3]}-${mon}-${m[1].padStart(2, '0')}`
      const cells = Array.from(m[4].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => c[1])
      if (!cells.length) continue
      const net = parseFlowNum(cells[cells.length - 1])
      if (net != null) flow.push({ date, net })
      // 발행사별 — **셀 수가 기대와 다르면 그 행은 버린다**(컬럼이 밀린 채 표시되면 조용한 거짓말이 된다)
      if (issuers.length > 0 && cells.length === issuers.length + 1) {
        // ⚠️ 2026-08-22 실사고: Farside 는 아직 집계 안 된 날을 **대시(-)** 로 준다. 그걸 0 으로 파싱해
        //    표에 "유입 0" 처럼 띄웠다(8/21 원천엔 실제 +307.5 가 있었는데 앱은 전부 0). '없음'과
        //    '아직 안 나옴'은 다른 사실이다 → **전 셀이 대시인 행은 아예 싣지 않는다**(다음 갱신에 채워진다).
        const allDash = cells.slice(0, issuers.length).every(c => c.trim() === '-')
        if (!allDash) {
          const v = cells.slice(0, issuers.length).map(c => parseFlowNum(c) ?? 0)
          const sum = v.reduce((a, b) => a + b, 0)
          if (net == null || Math.abs(sum - net) <= Math.max(0.6, Math.abs(net) * 0.01)) byIssuer.push({ date, v })
        }
      }
    }
    // 출범 이후 누적(Total 요약행의 마지막 셀)
    let cumulative: number | null = null
    const totalRow = html.match(/>\s*Total\s*<([\s\S]*?)<\/tr>/)
    if (totalRow) {
      const cells = Array.from(totalRow[1].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => c[1])
      if (cells.length) cumulative = parseFlowNum(cells[cells.length - 1])
    }
    return { flow, cumulative, issuers, byIssuer }
  } catch { return { flow: [], cumulative: null, issuers: [], byIssuer: [] } }
}

export async function GET() {
  // v5: 🏷️ 발행사별 분해(issuers·issuerRecent·issuerTotals) — 스키마 확장이라 키를 올린다(옛 응답이면 새 필드가 undefined)
  const cacheKey = `btc-etf-v6:${kstDate()}`   // v6: 미집계(전 셀 대시) 행 제외 · v5: 발행사별 · v4: flow 전체 이력
  // ⚠️ 24h → 3h(2026-08-22): Farside 는 그날 행을 몇 시간 뒤에 채운다. 24h 캐시면 '아직 비어 있는 상태'가
  //    하루 종일 얼어붙어, 실제로 +307.5 가 들어온 날이 화면엔 계속 0 으로 남았다.
  const cached = await getCache<BtcEtfResult>(cacheKey, 3 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  // ② 누적 거래량 — ETF별 Yahoo 순차(버스트 429 회피), 날짜별 거래대금 합산 → 누적
  const byDate = new Map<string, number>()
  for (const t of SPOT_ETFS) {
    const series = await yfVolume(t)
    for (const d of series) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.volUsd)
  }
  // 현물 BTC ETF 출범(2024-01-11)부터 — GBTC는 그 전 폐쇄형 신탁이라 제외(TheBlock '현물 ETF' 정의와 정합)
  const dates = Array.from(byDate.keys()).filter(d => d >= '2024-01-10').sort()
  let run = 0
  const cumAll = dates.map(date => { run += byDate.get(date)!; return { date, cum: run } })
  // 차트용 다운샘플(~160포인트)
  const step = Math.max(1, Math.ceil(cumAll.length / 160))
  const cumVolume = cumAll.filter((_, i) => i % step === 0 || i === cumAll.length - 1)
  const latestCumVol = cumAll.length ? cumAll[cumAll.length - 1].cum : 0

  // ① 순유입/유출 — Farside 전체 이력(2024~현재) + BTC가격
  const [{ flow, cumulative, issuers, byIssuer }, priceMap] = await Promise.all([farsideFlow(), btcPriceDaily()])
  const flowSorted = flow.filter(f => f.date >= '2024-01-10').sort((a, b) => a.date.localeCompare(b.date))
  const flowOut = flowSorted.map(f => ({ date: f.date, net: f.net, price: priceMap.get(f.date) ?? null }))
  // 출범 이후 누적 순유입 = 전체 일별 합(전체 이력이라 직접 합산이 Total행 스크랩보다 견고). 폴백 Total행.
  const flowCum = flowSorted.length ? Math.round(flowSorted.reduce((s, f) => s + f.net, 0) * 10) / 10 : cumulative

  // 🏷️ 발행사별 최근 10영업일 + 발행사별 출범 이후 누적($M) — 스크린샷(코인글래스)의 표와 같은 구조
  const issRows = byIssuer.filter(r => r.date >= '2024-01-10').sort((a, b) => a.date.localeCompare(b.date))
  const issuerTotals = issuers.map((_, i) => Math.round(issRows.reduce((s, r) => s + (r.v[i] ?? 0), 0) * 10) / 10)
  const issuerRecent = issRows.slice(-10).reverse().map(r => ({ date: r.date, v: r.v.map(x => Math.round(x * 10) / 10) }))

  const result: BtcEtfResult = {
    cumVolume, latestCumVol,
    flow: flowOut, flowCumulative: flowCum, flowWindowDays: flowOut.length,
    issuers, issuerRecent, issuerTotals,
    asOf: new Date().toISOString(),
  }
  // 핵심 데이터(누적 거래량) 있을 때만 캐시(부분실패 박제 방지)
  if (cumVolume.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
