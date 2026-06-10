'use server'

/**
 * 🕵️ CEO의 장바구니 (Insider's Receipt) — 서버 액션 (비밀병기 5단계)
 *
 * 피터 린치: "내부자가 파는 이유는 수만 가지지만, 사는 이유는 단 하나 — 오를 것 같아서다."
 *
 * 설계 원칙 (Jarvis와 동일)
 *  ① Zero Cost   : SEC EDGAR(공시) 무료. ticker→CIK→Form 4 XML 파싱.
 *  ② Lazy Caching: insider_signals에 24h 내 캐시 있으면 즉시 반환, 없으면 1회 수집·저장.
 *  ③ Zero Input  : 종목 상세 진입 시 InsiderReceipt가 자동 호출.
 *
 * 수집 로직: ticker→CIK(전체맵 1회 캐시) → /submissions(최근 90일 form=4)
 *           → 각 Form4 raw XML 파싱 → '장내매수(code=P, 취득=A)'만 추출 → 집계
 */

import { createClient as createAdmin } from '@supabase/supabase-js'
import https from 'node:https'
import zlib from 'node:zlib'
import { dartBuf, unzipFirst, dartJson, getCorpCode, krPrice } from '@/lib/dart'

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface InsiderBuy {
  name:   string          // 내부자 이름
  role:   string          // 직책 (CEO/CFO/이사/10%주주 등)
  date:   string          // 거래일 (YYYY-MM-DD)
  shares: number          // 매수 주식수
  value:  number          // 매수 금액 (USD 또는 KRW — signal.currency 기준)
}

export interface InsiderSignal {
  ticker:     string
  hasBuys:    boolean
  cluster:    boolean      // 서로 다른 내부자 ≥2명 장내매수 → 고확신
  buyerCount: number
  totalValue: number       // 총 매수액 (currency 기준)
  currency:   'USD' | 'KRW'
  source:     'edgar' | 'dart' | null
  windowDays: number       // 90
  buys:       InsiderBuy[]
  lynchComment: string
  cached:     boolean
  status:     'ok' | 'none' | 'unsupported' | 'error'
  message?:   string
  asOf:       string
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// SEC는 연락처가 포함된 User-Agent를 요구 (봇 정책)
const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'

/**
 * SEC 전용 HTTP GET — Node https 모듈 사용 (undici fetch 금지).
 *  ⚠️ 핵심: undici fetch는 Accept-Encoding을 자동 부착 → SEC gzip 응답을
 *     제대로 풀지 못해 XML 태그가 깨짐(파싱 0건 버그). https는 Accept-Encoding을
 *     보내지 않아 SEC가 평문으로 응답 → 안정. (혹시 gzip이면 매직바이트로 직접 해제)
 */
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

/**
 * SEC GET + 재시도. SEC는 과다요청 시 200 응답에 '손상된 본문'(태그 깨짐)을 주기도 함.
 * `valid(text)`로 무결성을 검사해 실패 시 백오프 재시도(throttle 회복).
 */
async function secGet(url: string, valid?: (t: string) => boolean): Promise<{ status: number; text: string }> {
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
const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
const isForm4 = (t: string) => /<rptOwnerName>[\s\S]*?<\/rptOwnerName>/i.test(t)
const WINDOW_DAYS = 90
const CACHE_TTL = 24 * 3600_000          // 24h 신선도
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`
const krw = (n: number) =>
  n >= 1e8 ? `₩${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `₩${Math.round(n / 1e4).toLocaleString()}만` : `₩${Math.round(n).toLocaleString()}`
const money = (n: number, cur: 'USD' | 'KRW') => cur === 'KRW' ? krw(n) : usd(n)

// ══ DART (한국 내부자 매수) 유틸 — 공용 로직은 @/lib/dart 재사용 ═══════════════════
// (dartBuf·unzipFirst·dartJson·getCorpCode·krPrice 는 lib/dart에서 import — 24h corp_code 캐시 공유)
const DART_KEY = process.env.DART_API_KEY

/** 보고서 원문(document.xml ZIP) → 평문 텍스트 ('장내매수' 취득행 확정용) */
async function dartDocText(rceptNo: string): Promise<string> {
  try {
    const { status, buf } = await dartBuf(`https://opendart.fss.or.kr/api/document.xml?crtfc_key=${DART_KEY}&rcept_no=${rceptNo}`)
    return status === 200 ? unzipFirst(buf) : ''
  } catch { return '' }
}

// ── ticker → CIK 매핑 (전체 맵 모듈 캐시) ────────────────────────────────────
let CIK_MAP: Map<string, string> | null = null
let CIK_EXP = 0
async function getCik(ticker: string): Promise<string | null> {
  if (!CIK_MAP || Date.now() > CIK_EXP) {
    try {
      const res = await secGet('https://www.sec.gov/files/company_tickers.json', isJson)
      if (res.status !== 200) return CIK_MAP?.get(ticker.toUpperCase()) ?? null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = JSON.parse(res.text)
      const m = new Map<string, string>()
      for (const v of Object.values(j)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = v as any
        if (row?.ticker) m.set(String(row.ticker).toUpperCase(), String(row.cik_str).padStart(10, '0'))
      }
      CIK_MAP = m; CIK_EXP = Date.now() + CACHE_TTL
    } catch { /* 네트워크 실패 → 기존 맵 */ }
  }
  return CIK_MAP?.get(ticker.toUpperCase()) ?? null
}

// ── Form 4 raw XML 1건 파싱 → 장내매수면 InsiderBuy 반환 ─────────────────────
function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
}
function pickVal(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>[\\s\\S]*?<value>([\\s\\S]*?)</value>`, 'i'))
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
}
function roleLabel(xml: string): string {
  const title = pick(xml, 'officerTitle')
  if (title) return title
  if (/<isOfficer>\s*(1|true)\s*<\/isOfficer>/i.test(xml)) return '임원'
  if (/<isDirector>\s*(1|true)\s*<\/isDirector>/i.test(xml)) return '이사'
  if (/<isTenPercentOwner>\s*(1|true)\s*<\/isTenPercentOwner>/i.test(xml)) return '10% 주주'
  return '내부자'
}

async function parseForm4(cikInt: string, accNoDash: string, primaryDoc: string, fallbackDate: string): Promise<InsiderBuy | null> {
  // primaryDocument = 'xslF345X06/wk-form4_xxx.xml' → basename이 raw XML
  const xmlName = primaryDoc.includes('/') ? primaryDoc.split('/').pop()! : primaryDoc
  const url = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDash}/${xmlName}`
  try {
    const res = await secGet(url, isForm4)
    if (res.status !== 200) return null
    const xml = res.text
    const name = pick(xml, 'rptOwnerName')
    if (!name) return null

    let shares = 0, value = 0, date = ''
    for (const b of xml.split('<nonDerivativeTransaction>').slice(1)) {
      const code = pick(b, 'transactionCode')               // 직접 텍스트
      const ad   = pickVal(b, 'transactionAcquiredDisposedCode')
      if (code !== 'P' || ad !== 'A') continue               // ★ 장내매수(취득)만
      const sh = parseFloat(pickVal(b, 'transactionShares') || '0')
      const px = parseFloat(pickVal(b, 'transactionPricePerShare') || '0')
      if (!isFinite(sh) || sh <= 0) continue
      shares += sh; value += sh * (isFinite(px) ? px : 0)
      const td = pickVal(b, 'transactionDate')
      if (td && !date) date = td
    }
    if (shares <= 0) return null
    return { name, role: roleLabel(xml), date: date || fallbackDate, shares, value }
  } catch { return null }
}

// ── 린치 코멘트 (결정론적 — 무입력·무비용·즉시) ──────────────────────────────
function lynchComment(buys: InsiderBuy[], cluster: boolean, total: number, cur: 'USD' | 'KRW'): string {
  const amt = money(total, cur)
  if (cluster) {
    const names = Array.from(new Set(buys.map(b => b.name))).length
    return `🔥 혼자가 아니야! 최근 ${WINDOW_DAYS}일간 내부자 ${names}명이 자기 돈 ${amt}어치를 장내에서 직접 사들였어. ` +
           `"파는 이유는 수만 가지지만, 사는 이유는 단 하나 — 오를 거란 확신"이라는 린치의 말이 딱 이 상황이야. 회사를 가장 잘 아는 사람들이 베팅했다는 뜻이지.`
  }
  const top = buys[0]
  return `내부자 ${top.name}(${top.role})이(가) ${amt}어치를 장내에서 직접 매수했어. ` +
         `옵션 행사나 보너스 주식이 아니라 자기 지갑을 연 거야 — 가볍게 볼 신호는 아니지.`
}

// ── 한국 내부자 매수 (DART 임원·주요주주 소유보고 + 보고서 원문 '장내매수' 확정) ──
async function krInsider(ticker: string, asOf: string): Promise<InsiderSignal> {
  const base = { ticker, currency: 'KRW' as const, source: 'dart' as const, windowDays: WINDOW_DAYS, asOf }
  const empty = (status: InsiderSignal['status'], message?: string): InsiderSignal => ({
    ...base, hasBuys: false, cluster: false, buyerCount: 0, totalValue: 0,
    buys: [], lynchComment: '', cached: false, status, message,
  })
  if (!DART_KEY) return empty('error', 'DART_API_KEY가 설정되지 않았습니다.')

  const stock6 = ticker.replace(/\D/g, '').padStart(6, '0').slice(-6)
  const corp = await getCorpCode(stock6)
  if (!corp) return empty('none', 'DART에 등록된 상장사가 아닙니다.')

  const el = await dartJson(`elestock.json?crtfc_key=${DART_KEY}&corp_code=${corp}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = el?.list ?? []
  if (el?.status !== '000' || !list.length) return empty('none')

  const cutoff = Date.now() - WINDOW_DAYS * 86400_000
  const num = (s: unknown) => parseInt(String(s ?? '').replace(/[^0-9-]/g, ''), 10) || 0
  // 최근 90일 + 지분 증가(+) 보고만, 최신순, 상한 12 (보고서 원문 조회 비용 제한)
  const cands = list
    .filter(r => { const d = new Date(r.rcept_dt).getTime(); return isFinite(d) && d >= cutoff && num(r.sp_stock_lmp_irds_cnt) > 0 })
    .sort((a, b) => String(b.rcept_dt).localeCompare(String(a.rcept_dt)))
    .slice(0, 12)
  if (!cands.length) return empty('none')

  const price = await krPrice(stock6)   // 현재가(추정 금액용)
  const buys: InsiderBuy[] = []
  for (const r of cands) {
    const doc = await dartDocText(r.rcept_no)
    if (!doc || !/장내매수\s*\(\s*[+＋]/.test(doc)) continue   // ★ 보고서 원문에 '장내매수(+)' 취득행이 있어야 인정
    const shares = num(r.sp_stock_lmp_irds_cnt)
    buys.push({
      name: String(r.repror || '내부자'),
      role: String(r.isu_exctv_ofcps || r.isu_exctv_rgist_at || '임원'),
      date: String(r.rcept_dt),
      shares,
      value: price > 0 ? shares * price : 0,
    })
    await sleep(120)
  }
  if (!buys.length) return empty('none')

  buys.sort((a, b) => b.value - a.value || b.shares - a.shares)
  const buyers = new Set(buys.map(b => b.name))
  const cluster = buyers.size >= 2
  const totalValue = buys.reduce((s, b) => s + b.value, 0)
  return {
    ...base, hasBuys: true, cluster, buyerCount: buyers.size, totalValue,
    buys: buys.slice(0, 6),
    lynchComment: lynchComment(buys, cluster, totalValue, 'KRW'),
    cached: false, status: 'ok',
  }
}

// ── 메인 서버 액션 ───────────────────────────────────────────────────────────
export async function getInsiderSignal(input: { ticker: string; market: string; name?: string }): Promise<InsiderSignal> {
  const ticker = input.ticker.trim().toUpperCase()
  const asOfNow = new Date().toISOString()
  const base = { ticker, currency: 'USD' as const, source: 'edgar' as const, windowDays: WINDOW_DAYS, asOf: asOfNow }
  const empty = (status: InsiderSignal['status'], message?: string): InsiderSignal => ({
    ...base, hasBuys: false, cluster: false, buyerCount: 0, totalValue: 0,
    buys: [], lynchComment: '', cached: false, status, message,
  })

  // ★ 개별 주식만 — ETF·코인·원자재 차단 (백스톱)
  const { getAssetType } = await import('@/lib/assetClassifier')
  if (getAssetType(ticker, input.name ?? '', input.market) !== 'STOCK') {
    return empty('unsupported', '개별 주식만 지원합니다 (ETF·코인·원자재 제외).')
  }

  // ① 캐시 조회 (24h 신선도) — US·KR 공통
  let db: ReturnType<typeof adminClient> | null = null
  try {
    db = adminClient()
    const { data } = await db.from('insider_signals').select('payload, as_of').eq('ticker', ticker).maybeSingle()
    if (data && Date.now() - new Date(data.as_of).getTime() < CACHE_TTL) {
      return { ...(data.payload as InsiderSignal), cached: true, asOf: data.as_of }
    }
  } catch { /* 테이블 미존재 → 진행 */ }

  // ★ 한국 종목 → DART 경로 (미국과 동일 정확도: 보고서 원문 '장내매수' 확정)
  if (input.market === 'KR') {
    const kr = await krInsider(ticker, asOfNow)
    try {
      if (db && (kr.status === 'ok' || kr.status === 'none')) {
        await db.from('insider_signals').upsert({
          ticker, cluster: kr.cluster, buyer_count: kr.buyerCount, total_value: kr.totalValue, payload: kr, as_of: asOfNow,
        })
      }
    } catch { /* 캐시 실패 무시 */ }
    return kr
  }
  // 그 외(코인 등) 미지원
  if (input.market && input.market !== 'US') {
    return empty('unsupported', '내부자 매수 신호는 미국·한국 상장 종목만 지원합니다.')
  }

  // ② CIK 조회 (US/EDGAR)
  const cik = await getCik(ticker)
  if (!cik) return empty('none', 'SEC EDGAR에 등록된 미국 상장 종목이 아니거나 내부자 공시가 없습니다.')

  try {
    // ③ 최근 90일 Form 4 목록
    const subRes = await secGet(`https://data.sec.gov/submissions/CIK${cik}.json`, isJson)
    if (subRes.status !== 200) return empty('error', 'SEC 공시 목록을 불러오지 못했습니다.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = JSON.parse(subRes.text)
    const f = sub?.filings?.recent
    if (!f?.form) return empty('none')

    const cutoff = Date.now() - WINDOW_DAYS * 86400_000
    const cikInt = String(parseInt(cik, 10))
    const targets: { acc: string; doc: string; date: string }[] = []
    for (let i = 0; i < f.form.length; i++) {
      if (f.form[i] !== '4') continue
      if (new Date(f.filingDate[i]).getTime() < cutoff) break   // recent[]는 날짜 내림차순
      targets.push({ acc: f.accessionNumber[i].replace(/-/g, ''), doc: f.primaryDocument[i] || '', date: f.filingDate[i] })
      if (targets.length >= 30) break                           // 안전 상한
    }

    // ④ Form 4 파싱 (4개씩, SEC 10req/s 정책 + throttle 회피 위해 완만하게)
    const buys: InsiderBuy[] = []
    for (let i = 0; i < targets.length; i += 4) {
      const chunk = targets.slice(i, i + 4)
      const rs = await Promise.all(chunk.map(t => parseForm4(cikInt, t.acc, t.doc, t.date)))
      for (const r of rs) if (r) buys.push(r)
      if (i + 4 < targets.length) await sleep(500)
    }

    if (buys.length === 0) {
      const none = empty('none')
      try { if (db) await db.from('insider_signals').upsert({ ticker, cluster: false, buyer_count: 0, total_value: 0, payload: none, as_of: new Date().toISOString() }) } catch {}
      return none
    }

    // ⑤ 집계 (금액 내림차순, 표시 상위 6건)
    buys.sort((a, b) => b.value - a.value)
    const buyers = new Set(buys.map(b => b.name))
    const cluster = buyers.size >= 2
    const totalValue = buys.reduce((s, b) => s + b.value, 0)
    const result: InsiderSignal = {
      ...base, hasBuys: true, cluster, buyerCount: buyers.size, totalValue,
      buys: buys.slice(0, 6),
      lynchComment: lynchComment(buys, cluster, totalValue, 'USD'),
      cached: false, status: 'ok',
    }

    // ⑥ 캐시 저장 (table 없으면 skip)
    try {
      if (db) await db.from('insider_signals').upsert({
        ticker, cluster, buyer_count: buyers.size, total_value: totalValue, payload: result, as_of: new Date().toISOString(),
      })
    } catch { /* 캐시 실패는 치명적 아님 */ }

    return result
  } catch (e) {
    console.warn('[insider-signal]', (e as Error).message)
    return empty('error', '내부자 데이터 수집 중 오류가 발생했습니다.')
  }
}
