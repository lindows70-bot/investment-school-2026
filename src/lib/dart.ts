/**
 * src/lib/dart.ts — DART OpenAPI 공용 유틸 (서버 전용)
 *
 * 🕵️ CEO의 장바구니(getInsiderSignal)와 🐳 슈퍼 클론(shadow-13f)이 공유.
 *  · 종목코드(6자리) → corp_code 매핑(전체맵 24h 인메모리 캐시)
 *  · DART JSON/ZIP/문서 GET, 네이버 현재가(매수금액 추정용)
 *
 * ⚠️ Node `https` 모듈 사용 (undici fetch는 DART ZIP/gzip 응답을 깨뜨림).
 */

import https from 'node:https'
import zlib from 'node:zlib'

const DART_KEY = process.env.DART_API_KEY
const CORP_TTL = 24 * 3600_000

/** node https GET → Buffer (DART 바이너리 ZIP·JSON 공용) */
export function dartBuf(url: string): Promise<{ status: number; buf: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } },
      r => {
        const chunks: Buffer[] = []
        r.on('data', d => chunks.push(d as Buffer))
        r.on('end', () => resolve({ status: r.statusCode ?? 0, buf: Buffer.concat(chunks) }))
      }
    )
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('DART timeout')))
  })
}

/** ZIP 첫 파일 inflate (DART corpCode·document) */
export function unzipFirst(zip: Buffer): string {
  if (zip.slice(0, 2).toString('hex') !== '504b') return zip.toString('utf8')
  const nameLen = zip.readUInt16LE(26), extraLen = zip.readUInt16LE(28), comp = zip.readUInt16LE(8)
  const data = zip.slice(30 + nameLen + extraLen)
  return (comp === 8 ? zlib.inflateRawSync(data) : data).toString('utf8')
}

/** DART JSON GET — path는 '/api/' 뒤부터(크레덴셜 포함). 실패 시 null */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dartJson(path: string): Promise<any | null> {
  try {
    const { status, buf } = await dartBuf(`https://opendart.fss.or.kr/api/${path}`)
    if (status !== 200) return null
    return JSON.parse(buf.toString('utf8'))
  } catch { return null }
}

// 종목코드(6자리) → DART corp_code (전체 매핑 모듈 캐시 24h)
let CORP_MAP: Map<string, string> | null = null
let CORP_EXP = 0
export async function getCorpCode(stock6: string): Promise<string | null> {
  if (!DART_KEY) return null
  if (!CORP_MAP || Date.now() > CORP_EXP) {
    try {
      const { status, buf } = await dartBuf(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_KEY}`)
      if (status === 200) {
        const xml = unzipFirst(buf)
        const m = new Map<string, string>()
        // ⚠️ <corp_name>과 <stock_code> 사이에 <corp_eng_name>이 끼어 있음 → 인접 정규식은 매칭 실패.
        //    <list> 블록 경계를 넘지 않는 lazy 매칭으로 corp_code↔stock_code(6자리)만 추출.
        const re = /<corp_code>(\d+)<\/corp_code>(?:(?!<\/list>)[\s\S])*?<stock_code>\s*(\d{6})\s*<\/stock_code>/g
        let mt: RegExpExecArray | null
        while ((mt = re.exec(xml)) !== null) m.set(mt[2], mt[1])
        if (m.size) { CORP_MAP = m; CORP_EXP = Date.now() + CORP_TTL }
      }
    } catch { /* keep old */ }
  }
  return CORP_MAP?.get(stock6) ?? null
}

/** 티커('005930' / '005930.KS' / '005930.KQ' 등) → 6자리 종목코드 */
export function toStock6(ticker: string): string {
  return ticker.replace(/\D/g, '').padStart(6, '0').slice(-6)
}

/** 네이버 현재가 (KRW) — 보유 평가액 추정용 (앱의 stock-price와 동일 소스) */
export async function krPrice(stock6: string): Promise<number> {
  try {
    const { status, buf } = await dartBuf(`https://polling.finance.naver.com/api/realtime/domestic/stock/${stock6}`)
    if (status !== 200) return 0
    const j = JSON.parse(buf.toString('utf8'))
    const cp = j?.datas?.[0]?.closePrice
    return cp ? (parseInt(String(cp).replace(/[^0-9]/g, ''), 10) || 0) : 0
  } catch { return 0 }
}
