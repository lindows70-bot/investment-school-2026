// 🏛️ SEC EDGAR 공용 유틸 SSOT — HTTP(UA·gzip·재시도) · Form 4 XML 파서 · 일별 인덱스 파서
//    2026-09-19 getInsiderSignal.ts(종목별 CEO의 장바구니)에서 추출. 시장 전체 스캐너(insiderMarket)와 **같은 파서**를 쓴다 —
//    Form 4 파서가 둘이면 "장내매수" 정의가 언젠가 갈린다(제2원칙).
//    ⚠️ undici fetch 금지: Accept-Encoding 을 자동 부착해 SEC gzip 본문의 태그가 깨진다(파싱 0건 사고). Node https 로 받는다.
import https from 'node:https'
import zlib from 'node:zlib'

// SEC는 연락처가 포함된 User-Agent를 요구 (봇 정책)
export const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'

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
          if (b.slice(0, 2).toString('hex') === '1f8b') { try { b = zlib.gunzipSync(b) } catch { /* keep raw */ } }
          resolve({ status: r.statusCode ?? 0, text: b.toString('utf8') })
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('SEC timeout')))
  })
}

/** SEC GET + 재시도. 과다요청 시 200 에 손상된 본문을 주기도 해서 `valid` 로 무결성을 보고 백오프한다. */
export async function secGet(url: string, valid?: (t: string) => boolean): Promise<{ status: number; text: string }> {
  let last = { status: 0, text: '' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await rawGet(url)
      if (last.status === 200 && (!valid || valid(last.text))) return last
    } catch { /* 네트워크 오류 → 재시도 */ }
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
  }
  return last
}
export const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
export const isForm4 = (t: string) => /<rptOwnerName>[\s\S]*?<\/rptOwnerName>/i.test(t)

// ── Form 4 XML 파서 ───────────────────────────────────────────────────────────
const unescapeXml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
export function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? unescapeXml(m[1].replace(/<[^>]+>/g, '').trim()) : ''   // 'CEO &amp; President' 같은 엔티티(실측)
}
export function pickVal(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>[\\s\\S]*?<value>([\\s\\S]*?)</value>`, 'i'))
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
}
export function roleLabel(xml: string): string {
  const title = pick(xml, 'officerTitle')
  if (title) return title
  if (/<isOfficer>\s*(1|true)\s*<\/isOfficer>/i.test(xml)) return '임원'
  if (/<isDirector>\s*(1|true)\s*<\/isDirector>/i.test(xml)) return '이사'
  if (/<isTenPercentOwner>\s*(1|true)\s*<\/isTenPercentOwner>/i.test(xml)) return '10% 주주'
  return '내부자'
}

export interface Form4Buy {
  owner: string           // 내부자 이름
  role: string            // 직책
  issuer: string          // 발행사명
  ticker: string          // <issuerTradingSymbol> (없으면 '')
  date: string            // 첫 거래일 (YYYY-MM-DD)
  shares: number          // 장내매수 주식수 합
  value: number           // 단가가 있는 거래의 금액 합(USD)
  unpriced: boolean       // 단가가 각주로 넘어가 빈 거래가 있었나 — 금액이 실제보다 작다는 뜻(0 으로 넣지 않는다)
}

/** 장내매수(코드 P·취득 A)만 집계. 없으면 null. ⚠️ 단가 없는 거래는 shares 에는 넣고 value 에는 안 넣는다(unpriced=true). */
export function parseForm4Xml(xml: string): Form4Buy | null {
  const owner = pick(xml, 'rptOwnerName')
  if (!owner) return null
  let shares = 0, value = 0, date = '', unpriced = false
  for (const b of xml.split('<nonDerivativeTransaction>').slice(1)) {
    const code = pick(b, 'transactionCode')
    const ad = pickVal(b, 'transactionAcquiredDisposedCode')
    if (code !== 'P' || ad !== 'A') continue               // ★ 장내매수(취득)만
    const sh = parseFloat(pickVal(b, 'transactionShares') || '0')
    if (!isFinite(sh) || sh <= 0) continue
    const pxRaw = pickVal(b, 'transactionPricePerShare')
    const px = parseFloat(pxRaw)
    shares += sh
    if (pxRaw && isFinite(px) && px > 0) value += sh * px
    else unpriced = true
    const td = pickVal(b, 'transactionDate')
    if (td && !date) date = td
  }
  if (shares <= 0) return null
  return { owner, role: roleLabel(xml), issuer: pick(xml, 'issuerName'), ticker: pick(xml, 'issuerTradingSymbol').toUpperCase(), date, shares, value, unpriced }
}

// ── 일별 인덱스 ───────────────────────────────────────────────────────────────
export interface DailyIndexRow { form: string; company: string; cik: string; date: string; file: string }

/** `form.YYYYMMDD.idx` 의 Form 4·4/A 행. 없는 날(주말·휴일·아직 안 나온 날)은 status 404 → 빈 배열. */
export async function fetchForm4Index(day: string): Promise<{ status: number; rows: DailyIndexRow[] }> {
  const q = 'QTR' + Math.ceil(+day.slice(4, 6) / 3)
  const res = await secGet(`https://www.sec.gov/Archives/edgar/daily-index/${day.slice(0, 4)}/${q}/form.${day}.idx`, t => /Form Type/i.test(t))
  if (res.status !== 200) return { status: res.status, rows: [] }
  const rows: DailyIndexRow[] = []
  for (const line of res.text.split('\n')) {
    const m = line.match(/^(4|4\/A)\s+(.*?)\s+(\d+)\s+(\d{8})\s+(edgar\/data\/\S+)\s*$/)
    // ⚠️ 공백 2개로 쪼개면 회사명 안의 이중 공백("HERENCIA ROBERTO  R")에서 열이 밀린다(실측 3건 404) — 꼬리(CIK·날짜·경로)를 정규식으로 잡는다
    if (!m) continue
    rows.push({ form: m[1], company: m[2].trim(), cik: m[3], date: m[4], file: m[5] })
  }
  return { status: 200, rows }
}

/** 제출 원문(.txt) 한 건 → 그 안의 Form 4 XML. 원문엔 XML 이 통째로 들어 있어 별도 문서 경로가 필요 없다. */
export async function fetchSubmissionXml(file: string): Promise<{ status: number; xml: string | null }> {
  const res = await secGet(`https://www.sec.gov/Archives/${file}`, isForm4)
  if (res.status !== 200) return { status: res.status, xml: null }
  return { status: 200, xml: res.text.match(/<XML>([\s\S]*?)<\/XML>/i)?.[1] ?? res.text }
}

/** accession 번호(0001234567-26-000123) — 파일 경로 마지막 조각 */
export const accessionOf = (file: string) => file.split('/').pop()!.replace(/\.txt$/, '')
