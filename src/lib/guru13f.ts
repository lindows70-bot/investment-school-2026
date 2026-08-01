// 🐳 전설적 투자자 9인의 SEC 13F 보유내역 로더 (공유) — shadow-13f(종목→거인)·guru-portfolio(거인→종목) 양쪽이 재사용.
//   Next.js 라우트 파일은 런타임 함수를 export할 수 없어(타입 검증) 로더를 lib으로 분리.
//   ⚠️ SEC는 Node https 모듈로(undici fetch 금지 — gzip 깨짐), 13F value는 달러 원금(2023+), 12h 캐시(콜드미스 1회만 수집).
import https from 'node:https'
import zlib from 'node:zlib'
import { getCache, setCache } from '@/lib/appCache'

// ── 추적 대상: 전설적 투자자 9인 (CIK 검증 완료) ──────────────────────────────────
export const FUNDS: { cik: string; mgr: string; fund: string }[] = [
  { cik: '0001067983', mgr: '워런 버핏',      fund: '버크셔 해서웨이' },
  { cik: '0001336528', mgr: '빌 애크먼',      fund: '퍼싱스퀘어' },
  { cik: '0001536411', mgr: '스탠리 드러켄밀러', fund: '듀케인 패밀리오피스' },
  { cik: '0001350694', mgr: '레이 달리오',     fund: '브리지워터' },
  { cik: '0001166559', mgr: '빌 게이츠',       fund: '게이츠 재단' },
  { cik: '0001061165', mgr: '스티브 맨델',     fund: '론파인 캐피털' },
  { cik: '0001709323', mgr: '리 루',          fund: '히말라야 캐피털' },
  { cik: '0001603466', mgr: '스티브 코언',     fund: '포인트72' },
  { cik: '0001656456', mgr: '데이비드 테퍼',   fund: '아팔루사' },
]

export interface Holding { name: string; cusip: string; sh: number; val: number }   // cusip=종목 고유번호(분기 불변) — 이름 드리프트에 안 흔들리는 매칭 키
export interface FundData { mgr: string; fund: string; cur: Holding[]; prev: Holding[]; total: number; asOf: string }

// ── SEC 전용 HTTP GET (Node https — undici fetch 금지) ──────────────────────────
const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'
function rawGet(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': SEC_UA } },
      r => {
        const chunks: Buffer[] = []
        r.on('data', d => chunks.push(d as Buffer))
        r.on('end', () => {
          let b = Buffer.concat(chunks)
          if (b.slice(0, 2).toString('hex') === '1f8b') { try { b = zlib.gunzipSync(b) } catch { /* keep */ } }
          resolve({ status: r.statusCode ?? 0, text: b.toString('utf8') })
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('SEC timeout')))
  })
}
// SEC 과다요청 시 200에 '손상된 본문'을 주기도 함 → valid()로 무결성 검사 후 재시도
async function secGet(url: string, valid?: (t: string) => boolean): Promise<{ status: number; text: string }> {
  let last = { status: 0, text: '' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await rawGet(url)
      if (last.status === 200 && (!valid || valid(last.text))) return last
    } catch { /* 재시도 */ }
    await new Promise(r => setTimeout(r, 700 * (attempt + 1)))
  }
  return last
}
const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── 13F 정보테이블 파싱 ───────────────────────────────────────────────────────
// ⚠️ 네임스페이스 허용: 버핏·게이츠 등은 <infoTable>로 제출하지만 브리지워터(달리오)·히말라야(리루)는
//    <ns1:infoTable>·<ns1:nameOfIssuer>처럼 접두사를 붙임 → (?:\w+:)? 로 둘 다 매칭(안 그러면 0개 파싱=거인 누락).
const pick = (b: string, t: string) => { const m = b.match(new RegExp('<(?:\\w+:)?' + t + '>([^<]*)</(?:\\w+:)?' + t + '>', 'i')); return m ? m[1].trim() : '' }
// 완전성 검증: 닫는 루트태그가 있어야 '잘리지 않은 전체 응답'(SEC throttle 시 truncated 200 방어)
const isInfoTable = (t: string) => /<\/(?:\w+:)?informationTable>/i.test(t) || (/<\/(?:\w+:)?infoTable>/i.test(t) && /<(?:\w+:)?nameOfIssuer>/i.test(t))

async function fetchHoldings(cik: string, accDash: string): Promise<Holding[]> {
  const dir = 'https://www.sec.gov/Archives/edgar/data/' + parseInt(cik, 10) + '/' + accDash.replace(/-/g, '')
  const idxRes = await secGet(dir + '/index.json', isJson)
  if (idxRes.status !== 200) return []
  let xmlName = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx: any = JSON.parse(idxRes.text)
    xmlName = (idx?.directory?.item ?? [])
      .map((i: { name: string }) => i.name)
      .find((n: string) => /\.xml$/i.test(n) && !/primary_doc/i.test(n)) ?? ''
  } catch { return [] }
  if (!xmlName) return []
  const docRes = await secGet(dir + '/' + xmlName, isInfoTable)
  if (docRes.status !== 200) return []
  // 발행사명 HTML 엔티티 디코드(S&amp;P → S&P, AT&amp;T → AT&T 등)
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#3?9;|&apos;/g, "'")
  return docRes.text.split(/<(?:\w+:)?infoTable>/i).slice(1)
    .map(b => ({
      name:  decode(pick(b, 'nameOfIssuer')),
      cusip: pick(b, 'cusip').toUpperCase(),
      sh:    parseInt(pick(b, 'sshPrnamt').replace(/[^0-9]/g, ''), 10) || 0,
      val:   parseInt(pick(b, 'value').replace(/[^0-9]/g, ''), 10) || 0,
    }))
    .filter(h => h.name && h.sh > 0)
}

// ── 펀드 보유내역 인메모리 캐시 (12h · 콜드미스 1회만 SEC 수집) ───────────────────
const FUND_CACHE: { data: FundData[]; expiresAt: number } = { data: [], expiresAt: 0 }
const FUND_TTL = 12 * 3600_000

async function loadOneFund(f: typeof FUNDS[number]): Promise<FundData | null> {
  const subRes = await secGet(`https://data.sec.gov/submissions/CIK${f.cik}.json`, isJson)
  if (subRes.status !== 200) return null
  const accs: { acc: string; dt: string }[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = JSON.parse(subRes.text)
    const r = sub?.filings?.recent
    if (!r?.form) return null
    for (let i = 0; i < r.form.length && accs.length < 2; i++)
      if (r.form[i] === '13F-HR') accs.push({ acc: r.accessionNumber[i], dt: r.filingDate[i] })
  } catch { return null }
  if (!accs.length) return null
  const cur = await fetchHoldings(f.cik, accs[0].acc)
  if (!cur.length) return null
  const prev = accs[1] ? await fetchHoldings(f.cik, accs[1].acc) : []
  const total = cur.reduce((s, h) => s + h.val, 0)
  return { mgr: f.mgr, fund: f.fund, cur, prev, total, asOf: accs[0].dt }
}

// ── 🧮 다중분기 13F 이력 (추정 평단용) — 한 거인의 최근 N개 분기 보유내역을 분기말(reportDate)과 함께 ──
//    이걸로 "언제 몇 주 늘렸나"를 역산 → 그 분기 평균가로 매입가정 → 추정 평단. 온디맨드(선택 거인만)·12h 캐시.
export interface QuarterHoldings { asOf: string; holdings: Holding[] }   // asOf = 분기말(periodOfReport)
export async function loadFundQuarters(cik: string, n = 8): Promise<QuarterHoldings[]> {
  const key = `guru-13f-history-v2:${cik}:${n}`   // v2: cusip 포함
  const hit = await getCache<QuarterHoldings[]>(key, 12 * 3600_000)
  if (hit && hit.length) return hit
  const subRes = await secGet(`https://data.sec.gov/submissions/CIK${cik}.json`, isJson)
  if (subRes.status !== 200) return []
  const accs: { acc: string; report: string }[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = JSON.parse(subRes.text)
    const r = sub?.filings?.recent
    if (!r?.form) return []
    for (let i = 0; i < r.form.length && accs.length < n; i++)
      if (r.form[i] === '13F-HR') accs.push({ acc: r.accessionNumber[i], report: r.reportDate?.[i] || r.filingDate[i] })
  } catch { return [] }
  if (!accs.length) return []
  const out: QuarterHoldings[] = []
  for (const a of accs) {   // 순차(SEC throttle 회피) — 캐시라 콜드 1회만
    const h = await fetchHoldings(cik, a.acc)
    if (h.length) out.push({ asOf: a.report, holdings: h })
    await sleep(250)
  }
  out.sort((x, y) => x.asOf.localeCompare(y.asOf))   // 오래된→최신
  if (out.length) await setCache(key, out)
  return out
}

export const FUND_CACHE_KEY = 'shadow-13f-funds-v4'   // v4: cusip 파싱 추가 (export: 크론 헬스 모니터가 SSOT로 감시)
export async function loadFunds(): Promise<FundData[]> {
  // L1 인메모리
  if (FUND_CACHE.data.length && Date.now() < FUND_CACHE.expiresAt) return FUND_CACHE.data
  // L2 DB (다른 인스턴스/크론이 채워둔 펀드 보유내역 재사용 → 12s SEC 크롤 생략)
  const dbHit = await getCache<FundData[]>(FUND_CACHE_KEY, FUND_TTL)
  if (dbHit && dbHit.length) {
    FUND_CACHE.data = dbHit; FUND_CACHE.expiresAt = Date.now() + FUND_TTL
    return dbHit
  }
  const out: FundData[] = []
  // 3개씩 병렬 (SEC 10req/s 정책 + throttle 회피)
  for (let i = 0; i < FUNDS.length; i += 3) {
    const chunk = FUNDS.slice(i, i + 3)
    const rs = await Promise.all(chunk.map(loadOneFund))
    for (const r of rs) if (r) out.push(r)
    if (i + 3 < FUNDS.length) await sleep(400)
  }
  if (out.length) {
    FUND_CACHE.data = out; FUND_CACHE.expiresAt = Date.now() + FUND_TTL
    await setCache(FUND_CACHE_KEY, out)   // L2 DB 저장 (전 인스턴스 공유)
  }
  return out
}
