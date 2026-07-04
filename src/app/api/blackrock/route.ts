// 🏛️ 블랙록(BlackRock) 포트폴리오 트래커 — SEC 13F-HR 실데이터(CIK 0002012383, 세계 1위 운용사).
// ⚠️ 대부분 iShares 인덱스 보유분 = 시장 시총가중 복제 → '무엇을 샀나'보다 '분기별 무엇을 늘리고 줄였나'가 인사이트.
// 국민연금(nps-portfolio)·shadow-13f와 동일 SEC 파싱 인프라(Node https·닫는태그 무결성 검증) 재사용.
import { NextResponse } from 'next/server'
import https from 'https'
import zlib from 'zlib'
import { getCache, setCache } from '@/lib/appCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const BLK_CIK = '0002012383'   // BlackRock, Inc. (BLK) — 실측으로 현재 본체 확정(구 법인 종료·통합)

export interface BlkHolding { name: string; ticker: string | null; sector: string; value: number; pct: number }
export interface BlkMove { name: string; ticker: string | null; value: number; deltaPct: number | null; kind: 'new' | 'exited' }
export interface BlkSector { sector: string; value: number; pct: number }
export interface BlackRockResult {
  period: string; prevPeriod: string
  totalValue: number; holdingCount: number
  top: BlkHolding[]
  added: { name: string; ticker: string | null; deltaValue: number; deltaPct: number }[]
  reduced: { name: string; ticker: string | null; deltaValue: number; deltaPct: number }[]
  newBuys: BlkMove[]; exited: BlkMove[]
  sectors: BlkSector[]
  asOf: string
}

// ── SEC HTTP (undici fetch 금지 — gzip 깨짐) ──
const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'
function rawGet(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': SEC_UA } }, r => {
      const chunks: Buffer[] = []
      r.on('data', d => chunks.push(d as Buffer))
      r.on('end', () => {
        let b = Buffer.concat(chunks)
        if (b.slice(0, 2).toString('hex') === '1f8b') { try { b = zlib.gunzipSync(b) } catch { /* keep */ } }
        resolve({ status: r.statusCode ?? 0, text: b.toString('utf8') })
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('SEC timeout')))
  })
}
async function secGet(url: string, valid?: (t: string) => boolean): Promise<{ status: number; text: string }> {
  let last = { status: 0, text: '' }
  for (let a = 0; a < 3; a++) {
    try { last = await rawGet(url); if (last.status === 200 && (!valid || valid(last.text))) return last } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 800 * (a + 1)))
  }
  return last
}
const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
const isInfoTable = (t: string) => /<\/informationTable>/i.test(t) || (/<\/infoTable>/i.test(t) && /<nameOfIssuer>/i.test(t))
const pick = (b: string, t: string) => { const m = b.match(new RegExp('<' + t + '>([^<]*)</' + t + '>', 'i')); return m ? m[1].trim() : '' }

// 발행사명 정규화(합산 키) — 접미사·구두점 제거
const norm = (s: string) => s.toUpperCase().replace(/&AMP;/g, '&').replace(/[.,/()'-]/g, ' ')
  .replace(/\b(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|HOLDINGS?|GROUP|THE|CLASS|CL|COM|NEW|DEL|LLC|SA|LP|NV|AG)\b/g, '')
  .replace(/\s+/g, ' ').trim()

// 발행사 → 티커·GICS 섹터·한글 (상위 노출 메가캡 큐레이션, 미매핑은 발행사명·기타)
const MEGA: { m: string; ticker: string; sector: string }[] = [
  { m: 'NVIDIA', ticker: 'NVDA', sector: 'IT' }, { m: 'APPLE', ticker: 'AAPL', sector: 'IT' },
  { m: 'MICROSOFT', ticker: 'MSFT', sector: 'IT' }, { m: 'ALPHABET', ticker: 'GOOGL', sector: '커뮤니케이션' },
  { m: 'AMAZON', ticker: 'AMZN', sector: '자유소비재' }, { m: 'BROADCOM', ticker: 'AVGO', sector: 'IT' },
  { m: 'META PLATFORMS', ticker: 'META', sector: '커뮤니케이션' }, { m: 'TESLA', ticker: 'TSLA', sector: '자유소비재' },
  { m: 'JPMORGAN', ticker: 'JPM', sector: '금융' }, { m: 'ELI LILLY', ticker: 'LLY', sector: '헬스케어' },
  { m: 'BERKSHIRE', ticker: 'BRK.B', sector: '금융' }, { m: 'EXXON', ticker: 'XOM', sector: '에너지' },
  { m: 'UNITEDHEALTH', ticker: 'UNH', sector: '헬스케어' }, { m: 'VISA', ticker: 'V', sector: '금융' },
  { m: 'MASTERCARD', ticker: 'MA', sector: '금융' }, { m: 'JOHNSON & JOHNSON', ticker: 'JNJ', sector: '헬스케어' },
  { m: 'PROCTER', ticker: 'PG', sector: '필수소비재' }, { m: 'COSTCO', ticker: 'COST', sector: '필수소비재' },
  { m: 'HOME DEPOT', ticker: 'HD', sector: '자유소비재' }, { m: 'BANK OF AMERICA', ticker: 'BAC', sector: '금융' },
  { m: 'NETFLIX', ticker: 'NFLX', sector: '커뮤니케이션' }, { m: 'ORACLE', ticker: 'ORCL', sector: 'IT' },
  { m: 'ADVANCED MICRO', ticker: 'AMD', sector: 'IT' }, { m: 'SALESFORCE', ticker: 'CRM', sector: 'IT' },
  { m: 'CHEVRON', ticker: 'CVX', sector: '에너지' }, { m: 'COCA COLA', ticker: 'KO', sector: '필수소비재' },
  { m: 'WALMART', ticker: 'WMT', sector: '필수소비재' }, { m: 'ABBVIE', ticker: 'ABBV', sector: '헬스케어' },
  { m: 'MERCK', ticker: 'MRK', sector: '헬스케어' }, { m: 'QUALCOMM', ticker: 'QCOM', sector: 'IT' },
  { m: 'PALANTIR', ticker: 'PLTR', sector: 'IT' }, { m: 'WELLS FARGO', ticker: 'WFC', sector: '금융' },
  { m: 'GENERAL ELECTRIC', ticker: 'GE', sector: '산업재' }, { m: 'CATERPILLAR', ticker: 'CAT', sector: '산업재' },
  { m: 'PEPSICO', ticker: 'PEP', sector: '필수소비재' }, { m: 'LINDE', ticker: 'LIN', sector: '소재' },
  { m: 'ACCENTURE', ticker: 'ACN', sector: 'IT' }, { m: 'MCDONALD', ticker: 'MCD', sector: '자유소비재' },
  { m: 'INTEL', ticker: 'INTC', sector: 'IT' }, { m: 'CISCO', ticker: 'CSCO', sector: 'IT' },
  { m: 'IBM', ticker: 'IBM', sector: 'IT' }, { m: 'GOLDMAN SACHS', ticker: 'GS', sector: '금융' },
  { m: 'MORGAN STANLEY', ticker: 'MS', sector: '금융' }, { m: 'AMERICAN EXPRESS', ticker: 'AXP', sector: '금융' },
  { m: 'THERMO FISHER', ticker: 'TMO', sector: '헬스케어' }, { m: 'ABBOTT', ticker: 'ABT', sector: '헬스케어' },
  { m: 'DANAHER', ticker: 'DHR', sector: '헬스케어' }, { m: 'TEXAS INSTRUMENTS', ticker: 'TXN', sector: 'IT' },
  { m: 'PHILIP MORRIS', ticker: 'PM', sector: '필수소비재' }, { m: 'BOEING', ticker: 'BA', sector: '산업재' },
]
function enrich(name: string): { ticker: string | null; sector: string; isEtf: boolean } {
  const up = name.toUpperCase()
  if (/ISHARES|ETF|TRUST/.test(up) && !/BERKSHIRE/.test(up)) return { ticker: null, sector: 'ETF(자체)', isEtf: true }
  const hit = MEGA.find(x => up.includes(x.m))
  return hit ? { ticker: hit.ticker, sector: hit.sector, isEtf: false } : { ticker: null, sector: '기타', isEtf: false }
}

// 13F 두 분기 accession 조회
async function latestTwo(): Promise<{ acc: string; period: string }[]> {
  const r = await secGet('https://data.sec.gov/submissions/CIK' + BLK_CIK + '.json', isJson)
  if (r.status !== 200) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = JSON.parse(r.text)
  const rec = d.filings.recent
  const out: { acc: string; period: string }[] = []
  for (let i = 0; i < rec.form.length && out.length < 2; i++) {
    if (String(rec.form[i]).startsWith('13F-HR')) out.push({ acc: rec.accessionNumber[i], period: rec.reportDate[i] })
  }
  return out
}

// 한 분기 보유내역 → 발행사 정규화 합산 Map<key,{name,sh,val}>
async function fetchQuarter(acc: string): Promise<Map<string, { name: string; sh: number; val: number }>> {
  const dir = 'https://www.sec.gov/Archives/edgar/data/' + parseInt(BLK_CIK, 10) + '/' + acc.replace(/-/g, '')
  const idxRes = await secGet(dir + '/index.json', isJson)
  const agg = new Map<string, { name: string; sh: number; val: number }>()
  if (idxRes.status !== 200) return agg
  let xmlName = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx: any = JSON.parse(idxRes.text)
    xmlName = (idx?.directory?.item ?? []).map((i: { name: string }) => i.name).find((n: string) => /\.xml$/i.test(n) && !/primary_doc/i.test(n)) ?? ''
  } catch { return agg }
  if (!xmlName) return agg
  const doc = await secGet(dir + '/' + xmlName, isInfoTable)
  if (doc.status !== 200) return agg
  for (const b of doc.text.split(/<infoTable>/i).slice(1)) {
    const name = pick(b, 'nameOfIssuer'); if (!name) continue
    const sh = parseInt(pick(b, 'sshPrnamt').replace(/[^0-9]/g, ''), 10) || 0
    const val = parseInt(pick(b, 'value').replace(/[^0-9]/g, ''), 10) || 0
    if (sh <= 0) continue
    const key = norm(name)
    const cur = agg.get(key) ?? { name, sh: 0, val: 0 }
    cur.sh += sh; cur.val += val; agg.set(key, cur)
  }
  return agg
}

export async function GET() {
  const cacheKey = 'blackrock-13f-v1'
  const cached = await getCache<BlackRockResult>(cacheKey, 30 * 24 * 3600_000)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } })

  const qs = await latestTwo()
  if (qs.length < 1) return NextResponse.json({ error: 'SEC 13F 조회 실패' }, { status: 502 })
  const cur = await fetchQuarter(qs[0].acc)
  if (cur.size < 100) return NextResponse.json({ error: '보유내역 파싱 실패' }, { status: 502 })
  const prev: Map<string, { name: string; sh: number; val: number }> = qs.length > 1 ? await fetchQuarter(qs[1].acc) : new Map()

  const curVals = Array.from(cur.values())
  const total = curVals.reduce((s, h) => s + h.val, 0)
  const all = curVals.slice().sort((a, b) => b.val - a.val)

  // ① Top 보유
  const top: BlkHolding[] = all.slice(0, 20).map(h => {
    const e = enrich(h.name)
    return { name: h.name, ticker: e.ticker, sector: e.sector, value: h.val, pct: Math.round(h.val / total * 10000) / 100 }
  })

  // ② QoQ 무브 — 주식수 델타(가치 큰 순). 인덱스 리밸런싱 영향 포함(캐비엇)
  const added: BlackRockResult['added'] = [], reduced: BlackRockResult['reduced'] = []
  const newBuys: BlkMove[] = [], exited: BlkMove[] = []
  if (prev.size > 100) {
    for (const [k, h] of Array.from(cur.entries())) {
      const p = prev.get(k)
      const e = enrich(h.name)
      if (!p) { if (h.val > 3e8) newBuys.push({ name: h.name, ticker: e.ticker, value: h.val, deltaPct: null, kind: 'new' }); continue }
      if (p.sh === 0) continue
      const dSh = (h.sh - p.sh) / p.sh
      const dVal = h.val - p.val
      if (dSh >= 0.03 && dVal > 2e8) added.push({ name: h.name, ticker: e.ticker, deltaValue: dVal, deltaPct: Math.round(dSh * 1000) / 10 })
      else if (dSh <= -0.03 && dVal < -2e8) reduced.push({ name: h.name, ticker: e.ticker, deltaValue: dVal, deltaPct: Math.round(dSh * 1000) / 10 })
    }
    for (const [k, p] of Array.from(prev.entries())) if (!cur.has(k) && p.val > 3e8) { const e = enrich(p.name); exited.push({ name: p.name, ticker: e.ticker, value: p.val, deltaPct: null, kind: 'exited' }) }
  }
  added.sort((a, b) => b.deltaValue - a.deltaValue)
  reduced.sort((a, b) => a.deltaValue - b.deltaValue)
  newBuys.sort((a, b) => b.value - a.value)
  exited.sort((a, b) => b.value - a.value)

  // ③ 섹터 집중도(상위 100 종목 기준 — 나머지는 롱테일)
  const secAgg = new Map<string, number>()
  for (const h of all.slice(0, 100)) { const e = enrich(h.name); secAgg.set(e.sector, (secAgg.get(e.sector) ?? 0) + h.val) }
  const secTot = Array.from(secAgg.values()).reduce((s, v) => s + v, 0)
  const sectors: BlkSector[] = Array.from(secAgg.entries()).map(([sector, value]) => ({ sector, value, pct: Math.round(value / secTot * 1000) / 10 })).sort((a, b) => b.value - a.value)

  const result: BlackRockResult = {
    period: qs[0].period, prevPeriod: qs[1]?.period ?? '',
    totalValue: total, holdingCount: cur.size,
    top, added: added.slice(0, 8), reduced: reduced.slice(0, 8), newBuys: newBuys.slice(0, 6), exited: exited.slice(0, 6),
    sectors, asOf: new Date().toISOString(),
  }
  await setCache(cacheKey, result)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
