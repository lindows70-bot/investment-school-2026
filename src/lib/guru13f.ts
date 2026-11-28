// 🐳 추적 거장(guruFunds.FUNDS)의 SEC 13F 보유내역 로더 (공유) — shadow-13f(종목→거인)·guru-portfolio(거인→종목) 양쪽이 재사용.
//   Next.js 라우트 파일은 런타임 함수를 export할 수 없어(타입 검증) 로더를 lib으로 분리.
//   ⚠️ SEC는 Node https 모듈로(undici fetch 금지 — gzip 깨짐), 12h 캐시(콜드미스 1회만 수집).
//   ⚠️ 줄을 읽고 가르는 규칙(풋 · 콜 분리 · 금액 단위 판별 · 채권 제외 · 상위 줄만 저장)은 guru13fParse.ts — 2026-11-28 실측으로 생겼다.
import https from 'node:https'
import zlib from 'node:zlib'
import { getCache, setCache } from '@/lib/appCache'
// 거장 목록은 브라우저에서도 쓰도록 import 없는 lib 로 분리 — 기존 `import { FUNDS } from '@/lib/guru13f'` 는 그대로 동작
import { FUNDS } from '@/lib/guruFunds'
import { parseInfoTable, trimPair, isStaleReport, type Holding, type ParsedTable } from '@/lib/guru13fParse'
export { FUNDS }
export type { Holding }   // cusip=종목 고유번호(분기 불변) — 이름 드리프트에 안 흔들리는 매칭 키

// cur · prev = **주식 줄만**(옵션 · 채권 제외) — 기존 소비자(종목→거인 · 합의 종목 · 거인→종목)가 그대로 읽어도 풋이 보유로 섞이지 않는다.
//   total = 주식 줄 전체 금액(잘라 내기 전) · 비중의 분모. 옵션 금액은 기초자산 시가라 분모에 넣지 않는다.
export interface FundData {
  mgr: string; fund: string; cur: Holding[]; prev: Holding[]; total: number
  asOf: string                 // 신고일(filingDate) — '공시일 종가 대비' 계산의 기준
  reportDate: string           // 분기말(periodOfReport) — 이 보유가 어느 날의 사진인가
  filer: string                // EDGAR 법인명(자기 회사 주식 줄을 알아보는 데 쓴다)
  stale: boolean               // 최신 분기 13F-HR 을 내지 않았다 → '지금 보유'로 쓰지 않는다
  broad: boolean               // 수천 종목을 사고파는 운용사(guruFunds.broad) → 점수 · 합의 계산에서 뺀다
  lines: number                // 정보테이블 전체 줄(주식 + 옵션 + 채권)
  stockLines: number           // 주식 줄 전체 수
  stockKept: number            // 그중 저장한 줄(금액 상위)
  keptVal: number              // 저장한 주식 줄의 금액 합(total 대비 몇 %를 담았는지 밝히는 용도)
  opt: { cur: Holding[]; prev: Holding[]; lines: number; callVal: number; putVal: number }   // 옵션 줄(금액 상위) · 금액은 기초자산 시가
  bond: { lines: number; val: number }
}
/** 저장 상한 — 포인트72(주식 1,916줄) · 튜더(1,720줄)는 통째로, 시타델(8,631줄)만 잘린다. 옵션은 화면에 상위만 쓰므로 작게 */
export const STOCK_CAP = 2000
export const OPT_CAP = 200

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
// 완전성 검증: 닫는 루트태그가 있어야 '잘리지 않은 전체 응답'(SEC throttle 시 truncated 200 방어)
const isInfoTable = (t: string) => /<\/(?:\w+:)?informationTable>/i.test(t) || (/<\/(?:\w+:)?infoTable>/i.test(t) && /<(?:\w+:)?nameOfIssuer>/i.test(t))

async function fetchHoldings(cik: string, accDash: string): Promise<ParsedTable | null> {
  const dir = 'https://www.sec.gov/Archives/edgar/data/' + parseInt(cik, 10) + '/' + accDash.replace(/-/g, '')
  const idxRes = await secGet(dir + '/index.json', isJson)
  if (idxRes.status !== 200) return null
  let xmlName = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx: any = JSON.parse(idxRes.text)
    xmlName = (idx?.directory?.item ?? [])
      .map((i: { name: string }) => i.name)
      .find((n: string) => /\.xml$/i.test(n) && !/primary_doc/i.test(n)) ?? ''
  } catch { return null }
  if (!xmlName) return null
  const docRes = await secGet(dir + '/' + xmlName, isInfoTable)
  if (docRes.status !== 200) return null
  const parsed = parseInfoTable(docRes.text)   // 주식 · 옵션 · 채권으로 가르고 금액 단위를 맞춘다(guru13fParse)
  return parsed.lines > 0 ? parsed : null
}

// ── 펀드 보유내역 인메모리 캐시 (12h · 콜드미스 1회만 SEC 수집) ───────────────────
const FUND_CACHE: { data: FundData[]; expiresAt: number } = { data: [], expiresAt: 0 }
const FUND_TTL = 12 * 3600_000

const sumVal = (a: Holding[]) => a.reduce((s, h) => s + h.val, 0)
async function loadOneFund(f: typeof FUNDS[number]): Promise<FundData | null> {
  const subRes = await secGet(`https://data.sec.gov/submissions/CIK${f.cik}.json`, isJson)
  if (subRes.status !== 200) return null
  const accs: { acc: string; dt: string; report: string }[] = []
  let filer = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = JSON.parse(subRes.text)
    filer = String(sub?.name ?? '')
    const r = sub?.filings?.recent
    if (!r?.form) return null
    // 13F-HR 원본만(정정 13F-HR/A · 통지 13F-NT 제외) — 통지로 바뀐 법인은 마지막 HR 에서 멈추고, 그 사실은 stale 로 드러낸다
    for (let i = 0; i < r.form.length && accs.length < 2; i++)
      if (r.form[i] === '13F-HR') accs.push({ acc: r.accessionNumber[i], dt: r.filingDate[i], report: r.reportDate?.[i] || r.filingDate[i] })
  } catch { return null }
  if (!accs.length) return null
  const cur = await fetchHoldings(f.cik, accs[0].acc)
  if (!cur) return null
  const prev = accs[1] ? await fetchHoldings(f.cik, accs[1].acc) : null
  const stock = trimPair(cur.stock, prev?.stock ?? [], STOCK_CAP)
  const opt = trimPair(cur.opts, prev?.opts ?? [], OPT_CAP)
  return {
    mgr: f.mgr, fund: f.fund, cur: stock.cur, prev: stock.prev,
    total: sumVal(cur.stock),   // 자르기 전 주식 줄 전체 — 비중의 분모
    asOf: accs[0].dt, reportDate: accs[0].report, filer,
    stale: isStaleReport(accs[0].report, Date.now()), broad: f.broad === true,
    lines: cur.lines, stockLines: cur.stock.length, stockKept: stock.cur.length, keptVal: stock.keptVal,
    opt: { cur: opt.cur, prev: opt.prev, lines: cur.opts.length, callVal: sumVal(cur.opts.filter(h => h.pc === 'call')), putVal: sumVal(cur.opts.filter(h => h.pc === 'put')) },
    bond: { lines: cur.bondLines, val: cur.bondVal },
  }
}

// ── 🧮 다중분기 13F 이력 (추정 평단용) — 한 거인의 최근 N개 분기 보유내역을 분기말(reportDate)과 함께 ──
//    이걸로 "언제 몇 주 늘렸나"를 역산 → 그 분기 평균가로 매입가정 → 추정 평단. 온디맨드(선택 거인만)·12h 캐시.
export interface QuarterHoldings { asOf: string; holdings: Holding[] }   // asOf = 분기말(periodOfReport)
export async function loadFundQuarters(cik: string, n = 8): Promise<QuarterHoldings[]> {
  // 주식 줄만 담는다(옵션 · 채권의 수량은 주식 수가 아니다). 줄이 많은 법인은 **최신 분기 상위 종목의 줄만** 전 분기에 걸쳐 남긴다 —
  //   분기마다 따로 자르면 '그 분기엔 상위 밖'이 '0주'로 읽혀 평단이 틀어진다.
  const key = `guru-13f-history-v3:${cik}:${n}`   // v3(2026-11-28): 주식 줄만 · 금액 단위 판별 · 최신 분기 상위 종목만 · v2: cusip 포함
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
  let keep: Set<string> | null = null   // 최신 분기(accs[0])의 금액 상위 종목 — 줄이 상한을 넘을 때만 건다
  for (const a of accs) {   // 순차(SEC throttle 회피) — 캐시라 콜드 1회만. 최신 → 과거 순
    const p = await fetchHoldings(cik, a.acc)
    if (p && p.stock.length) {
      if (keep == null) keep = new Set(p.stock.length > STOCK_CAP ? trimPair(p.stock, [], STOCK_CAP).cur.map(h => h.cusip) : [])
      const k = keep
      out.push({ asOf: a.report, holdings: k.size ? p.stock.filter(h => k.has(h.cusip)) : p.stock })
    }
    await sleep(250)
  }
  out.sort((x, y) => x.asOf.localeCompare(y.asOf))   // 오래된→최신
  if (out.length) await setCache(key, out)
  return out
}

export const FUND_CACHE_KEY = 'shadow-13f-funds-v6'   // v6(2026-11-28): 코언(포인트72)을 분산형으로 — 묶음에 broad 가 저장돼 있어 옛 값이면 점수에 계속 센다 · v5(2026-11-28): cur·prev 가 주식 줄만 · 옵션(풋/콜) 분리 · 금액 단위 판별 · reportDate·stale·broad · 14명 · v4: cusip 파싱 추가 (export: 크론 헬스 모니터가 SSOT로 감시)
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
