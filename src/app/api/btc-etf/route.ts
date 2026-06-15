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
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=3mo&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) })
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
async function farsideFlow(): Promise<{ flow: { date: string; net: number }[]; cumulative: number | null }> {
  try {
    const html = await httpGet('https://farside.co.uk/btc/')
    const flow: { date: string; net: number }[] = []
    const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    // 각 일별 행: 날짜 + 행 내 마지막 숫자 셀(=Total 순유입)
    const rows = Array.from(html.matchAll(/(\d{1,2})\s+(\w{3})\s+(\d{4})([\s\S]*?)<\/tr>/g))
    for (const m of rows) {
      const mon = MON[m[2]]; if (!mon) continue
      const date = `${m[3]}-${mon}-${m[1].padStart(2, '0')}`
      const cells = Array.from(m[4].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => c[1])
      if (!cells.length) continue
      const net = parseFlowNum(cells[cells.length - 1])
      if (net != null) flow.push({ date, net })
    }
    // 출범 이후 누적(Total 요약행의 마지막 셀)
    let cumulative: number | null = null
    const totalRow = html.match(/>\s*Total\s*<([\s\S]*?)<\/tr>/)
    if (totalRow) {
      const cells = Array.from(totalRow[1].matchAll(/>\s*(\(?-?[\d,]+\.?\d*\)?|-)\s*</g)).map(c => c[1])
      if (cells.length) cumulative = parseFlowNum(cells[cells.length - 1])
    }
    return { flow, cumulative }
  } catch { return { flow: [], cumulative: null } }
}

export async function GET() {
  const cacheKey = `btc-etf-v2:${kstDate()}`   // v2: Farside node:https 우회 + Yahoo range 5y
  const cached = await getCache<BtcEtfResult>(cacheKey, 24 * 3600_000)
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

  // ① 순유입/유출 — Farside(최근 일별) + BTC가격
  const [{ flow, cumulative }, priceMap] = await Promise.all([farsideFlow(), btcPriceDaily()])
  const flowSorted = flow.sort((a, b) => a.date.localeCompare(b.date))
  const flowOut = flowSorted.map(f => ({ date: f.date, net: f.net, price: priceMap.get(f.date) ?? null }))

  const result: BtcEtfResult = {
    cumVolume, latestCumVol,
    flow: flowOut, flowCumulative: cumulative, flowWindowDays: flowOut.length,
    asOf: new Date().toISOString(),
  }
  // 핵심 데이터(누적 거래량) 있을 때만 캐시(부분실패 박제 방지)
  if (cumVolume.length > 0) await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
