/**
 * GET /api/nps-portfolio
 *
 * 🏛️ 국민연금 자산현황 대시보드 (거인의 장바구니)
 *
 * 대한민국 최대 큰손 '국민연금공단(NPS)'의 자산을 한 화면에:
 *  ① 자산배분 개요   — 주식/채권/대체 자산군 비중 (전체 기금)
 *  ② 🇰🇷 국내주식 Top — DART 대량보유(5%룰) 종목·지분율·공시後 주가
 *  ③ 🇺🇸 해외주식 Top — NPS의 SEC 13F-HR(미국 의무공시) 보유종목·평가액
 *
 * ── 데이터 가용성(검증) ──
 *  · 국내주식 = DART majorstock(5%룰) — 개별 종목·지분율 공시 ✅
 *  · 해외주식 = SEC 13F-HR (NPS CIK 0001608046, 분기 의무공시) — 562종목 $131.7B ✅
 *  · 채권·대체투자 = 개별 종목 의무공시 제도 없음 → '자산군 비중(집계)'만 표시 ⚠️
 *
 * ⚠️ 정직성: '공시後 주가'는 NPS 실제 수익률 아님(매입단가 미공개). 자산배분 비중은 공시 기준 참고치.
 *
 * 설계: 국내 크롤(대형주~70) ∥ 해외 13F 동시 수집, 24h 인메모리 캐시(force-dynamic).
 */

import { NextResponse } from 'next/server'
import https from 'node:https'
import zlib from 'node:zlib'
import { getCorpCode, dartJson } from '@/lib/dart'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface NpsAsset { name: string; pct: number }
export interface NpsDomStock {
  ticker: string; name: string; stakePct: number; stakeChg: number | null
  shares: number; value: number; disclDate: string; sinceDisclPct: number | null
}
export interface NpsOvsStock { name: string; value: number; weight: number }
export interface NpsDashboardResult {
  status:      'ok' | 'error'
  allocation:  NpsAsset[]
  domestic:    NpsDomStock[]
  overseas:    NpsOvsStock[]
  domTotalValue: number     // KRW (추적 종목 합)
  domCount:    number
  ovsTotalValue: number     // USD (NPS 미국 13F 총액)
  ovsCount:    number
  ovsAsOf:     string       // 13F 기준일
  scanned:     number
  asOf:        string
  message?:    string
}

// ── 자산배분 (국민연금 공시 기준 참고치 — 채권·대체는 개별종목 비공개라 집계만) ──────
const ALLOCATION: NpsAsset[] = [
  { name: '해외주식', pct: 34 },
  { name: '국내채권', pct: 28 },
  { name: '대체투자', pct: 16 },
  { name: '국내주식', pct: 14 },
  { name: '해외채권', pct: 8 },
]

// ════ 국내주식 (DART majorstock) ════════════════════════════════════════════════
const UNIVERSE: string[] = [
  '005930', '000660', '373220', '207940', '005380', '000270', '068270', '035420', '035720', '005490',
  '105560', '055550', '086790', '316140', '006400', '051910', '012330', '028260', '033780', '096770',
  '329180', '010140', '012450', '015760', '017670', '030200', '003550', '011200', '009150', '032830',
  '000810', '018260', '010130', '011170', '051900', '090430', '161390', '271560', '097950', '139480',
  '023530', '086280', '000720', '047040', '010950', '078930', '011070', '066570', '034730', '003490',
  '009540', '010620', '042660', '064350', '052690', '267260', '006800', '016360', '071050', '029780',
  '138040', '024110', '251270', '036570', '259960', '352820', '128940', '021240', '001040', '011780',
]

function httpText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } },
      r => { const c: Buffer[] = []; r.on('data', d => c.push(d as Buffer)); r.on('end', () => resolve(Buffer.concat(c).toString('utf8'))) })
    req.on('error', reject)
    req.setTimeout(10000, () => req.destroy(new Error('timeout')))
  })
}
async function priceSince(code: string, disclYmd: string): Promise<{ now: number; at: number } | null> {
  try {
    const xml = await httpText(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=700&requestType=0`)
    const re = /data="([^"]+)"/g; let m: RegExpExecArray | null; const rows: { d: string; c: number }[] = []
    while ((m = re.exec(xml)) !== null) { const p = m[1].split('|'); if (p.length < 5) continue; const c = parseFloat(p[4]); if (c > 0) rows.push({ d: p[0], c }) }
    if (!rows.length) return null
    return { now: rows[rows.length - 1].c, at: (rows.find(r => r.d >= disclYmd) ?? rows[0]).c }
  } catch { return null }
}
async function oneDomestic(ticker: string): Promise<NpsDomStock | null> {
  const corp = await getCorpCode(ticker)
  if (!corp) return null
  const j = await dartJson(`majorstock.json?crtfc_key=${process.env.DART_API_KEY}&corp_code=${corp}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = j?.status === '000' && Array.isArray(j.list) ? j.list : []
  const nps = list.filter(r => /국민연금/.test(String(r.repror || ''))).sort((a, b) => String(b.rcept_dt).localeCompare(String(a.rcept_dt)))
  if (!nps.length) return null
  const r = nps[0]
  const stakePct = parseFloat(String(r.stkrt).replace(/[^0-9.]/g, '')) || 0
  const shares = parseInt(String(r.stkqy).replace(/[^0-9]/g, ''), 10) || 0
  const chgRaw = parseFloat(String(r.stkrt_irds).replace(/[^0-9.\-]/g, ''))
  if (stakePct <= 0 || shares <= 0) return null
  const disclDate = String(r.rcept_dt || '')
  const px = await priceSince(ticker, disclDate.replace(/-/g, ''))
  return {
    ticker, name: String(r.corp_name || ticker), stakePct,
    stakeChg: isFinite(chgRaw) ? chgRaw : null, shares,
    value: px ? shares * px.now : 0, disclDate,
    sinceDisclPct: px && px.at > 0 ? Math.round(((px.now - px.at) / px.at) * 1000) / 10 : null,
  }
}
async function buildDomestic(): Promise<NpsDomStock[]> {
  const out: NpsDomStock[] = []
  for (let i = 0; i < UNIVERSE.length; i += 5) {
    const rs = await Promise.all(UNIVERSE.slice(i, i + 5).map(t => oneDomestic(t).catch(() => null)))
    for (const r of rs) if (r) out.push(r)
  }
  out.sort((a, b) => b.value - a.value || b.stakePct - a.stakePct)
  return out
}

// ════ 해외주식 (NPS SEC 13F-HR) ═════════════════════════════════════════════════
const NPS_CIK = '0001608046'   // National Pension Service (검증: SEC EDGAR)
const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'
function secRaw(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': SEC_UA } },
      r => { const c: Buffer[] = []; r.on('data', d => c.push(d as Buffer)); r.on('end', () => { let b = Buffer.concat(c); if (b.slice(0, 2).toString('hex') === '1f8b') { try { b = zlib.gunzipSync(b) } catch { /* keep */ } } resolve({ status: r.statusCode ?? 0, text: b.toString('utf8') }) }) })
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('SEC timeout')))
  })
}
async function secGet(url: string, valid?: (t: string) => boolean): Promise<{ status: number; text: string }> {
  let last = { status: 0, text: '' }
  for (let i = 0; i < 3; i++) {
    try { last = await secRaw(url); if (last.status === 200 && (!valid || valid(last.text))) return last } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 700 * (i + 1)))
  }
  return last
}
const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
const isComplete = (t: string) => /<\/informationTable>/i.test(t)
const spick = (b: string, t: string) => { const m = b.match(new RegExp('<' + t + '>([^<]*)</' + t + '>', 'i')); return m ? m[1].trim() : '' }
// 발행사명 정규화(중복 합산용: Alphabet CL A/C 등)
const ovsNorm = (s: string) => s.toUpperCase().replace(/[.,&'()]/g, ' ').replace(/\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|THE|COM|CL|CLASS|NEW|DEL|ADR|HOLDINGS?)\b/g, ' ').replace(/\s+/g, ' ').trim()

async function buildOverseas(): Promise<{ top: NpsOvsStock[]; total: number; count: number; asOf: string }> {
  const empty = { top: [], total: 0, count: 0, asOf: '' }
  const subRes = await secGet(`https://data.sec.gov/submissions/CIK${NPS_CIK}.json`, isJson)
  if (subRes.status !== 200) return empty
  let acc = '', asOf = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = JSON.parse(subRes.text); const f = sub?.filings?.recent
    for (let i = 0; i < f.form.length; i++) if (f.form[i] === '13F-HR') { acc = f.accessionNumber[i]; asOf = f.filingDate[i]; break }
  } catch { return empty }
  if (!acc) return empty
  const dir = `https://www.sec.gov/Archives/edgar/data/${parseInt(NPS_CIK, 10)}/${acc.replace(/-/g, '')}`
  const idxRes = await secGet(dir + '/index.json', isJson)
  if (idxRes.status !== 200) return empty
  let xmlName = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { const idx: any = JSON.parse(idxRes.text); xmlName = (idx?.directory?.item ?? []).map((i: { name: string }) => i.name).find((n: string) => /\.xml$/i.test(n) && !/primary_doc/i.test(n)) ?? '' } catch { return empty }
  if (!xmlName) return empty
  const docRes = await secGet(dir + '/' + xmlName, isComplete)
  if (docRes.status !== 200) return empty
  // 발행사명 합산
  const agg = new Map<string, { name: string; value: number }>()
  let total = 0; let count = 0
  for (const b of docRes.text.split(/<infoTable>/i).slice(1)) {
    const name = spick(b, 'nameOfIssuer'); const v = parseInt(spick(b, 'value').replace(/[^0-9]/g, ''), 10) || 0
    const sh = parseInt(spick(b, 'sshPrnamt').replace(/[^0-9]/g, ''), 10) || 0
    if (!name || sh <= 0 || v <= 0) continue
    count++; total += v
    const k = ovsNorm(name)
    const cur = agg.get(k); if (cur) cur.value += v; else agg.set(k, { name, value: v })
  }
  const top = Array.from(agg.values()).sort((a, b) => b.value - a.value).slice(0, 10)
    .map(h => ({ name: h.name, value: h.value, weight: total > 0 ? Math.round((h.value / total) * 1000) / 10 : 0 }))
  return { top, total, count, asOf }
}

// ── 캐시: L1 인메모리(빠름) → L2 DB(전 인스턴스 공유·콜드스타트 생존) → 크롤 ─────────
const CACHE: { data: NpsDashboardResult | null; exp: number } = { data: null, exp: 0 }
const TTL = 24 * 3600_000
const CACHE_KEY = 'nps-portfolio'

export async function GET() {
  // L1 인메모리
  if (CACHE.data && Date.now() < CACHE.exp) return NextResponse.json(CACHE.data, { headers: { 'Cache-Control': 'no-store' } })
  // L2 DB (다른 인스턴스/크론이 채워둔 결과 재사용 → 학생이 콜드 크롤 안 맞음)
  const dbHit = await getCache<NpsDashboardResult>(CACHE_KEY, TTL)
  if (dbHit && dbHit.status === 'ok') {
    CACHE.data = dbHit; CACHE.exp = Date.now() + TTL
    return NextResponse.json(dbHit, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const [domestic, ovs] = await Promise.all([buildDomestic(), buildOverseas().catch(() => ({ top: [], total: 0, count: 0, asOf: '' }))])
    if (!domestic.length && !ovs.top.length) {
      return NextResponse.json({ status: 'error', allocation: ALLOCATION, domestic: [], overseas: [], domTotalValue: 0, domCount: 0, ovsTotalValue: 0, ovsCount: 0, ovsAsOf: '', scanned: UNIVERSE.length, asOf: new Date().toISOString(), message: '국민연금 보유 데이터를 불러오지 못했습니다.' } as NpsDashboardResult)
    }
    const result: NpsDashboardResult = {
      status: 'ok', allocation: ALLOCATION,
      domestic: domestic.slice(0, 10),
      overseas: ovs.top,
      domTotalValue: domestic.reduce((s, h) => s + h.value, 0),
      domCount: domestic.length,
      ovsTotalValue: ovs.total, ovsCount: ovs.count, ovsAsOf: ovs.asOf,
      scanned: UNIVERSE.length, asOf: new Date().toISOString(),
    }
    CACHE.data = result; CACHE.exp = Date.now() + TTL
    await setCache(CACHE_KEY, result)   // L2 DB 저장 (전 인스턴스 공유)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[nps-portfolio]', (e as Error).message)
    return NextResponse.json({ status: 'error', allocation: ALLOCATION, domestic: [], overseas: [], domTotalValue: 0, domCount: 0, ovsTotalValue: 0, ovsCount: 0, ovsAsOf: '', scanned: UNIVERSE.length, asOf: new Date().toISOString(), message: '국민연금 자산현황 수집 중 오류가 발생했습니다.' } as NpsDashboardResult)
  }
}
