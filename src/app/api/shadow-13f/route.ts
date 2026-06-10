/**
 * GET /api/shadow-13f?ticker=AAPL&name=Apple&market=US
 *
 * 🐳 슈퍼 클론 (13F Shadow Tracker) — 비밀병기 10단계
 *
 * 피터 린치: "아마추어가 프로를 이기는 길은, 프로가 무엇을 사는지 훔쳐보는 것이 아니라
 *            왜 사는지를 이해하는 것이다." — 그래서 우리는 '무엇'을 보여주되 '왜'를 묻게 한다.
 *
 * 미국 전설적 투자자 9인의 분기 13F-HR(SEC 의무공시)을 파싱해,
 * "내가 보유한 종목을 거인 중 누가 들고 있나 + 지난 분기 늘렸나/줄였나"를 보여준다.
 *
 * ── 설계 원칙 ──
 *  ① Zero Cost   : SEC EDGAR 13F-HR 무료. (CUSIP→티커 매핑은 유료라) 발행사명 토큰 매칭.
 *  ② Lazy Caching: 펀드 보유내역은 분기(45일 지연) 단위라 거의 불변 → 인메모리 12h 캐시 공유.
 *                  '비싼' SEC 수집은 콜드미스 1회만, 종목별 매칭은 메모리에서 즉시.
 *  ③ Zero Input  : 종목 상세 진입 시 컴포넌트가 자동 호출.
 *
 * ⚠️ 핵심 교훈
 *  · SEC는 Node https 모듈로 (undici fetch 금지 — gzip 응답 깨짐 버그).
 *  · 13F 정보테이블 XML 태그엔 네임스페이스가 없음 → 단순 <tag>…</tag> 정규식.
 *  · 13F value 필드는 '달러 원금'(2023년 이후) — /1e9 = $B.
 *  · 13F는 발행사명을 약어/법인명("BANK AMER CORP","OCCIDENTAL PETE CORP")으로 적어
 *    Yahoo 종목명과 단순 일치가 안 됨 → 토큰 정규화(불용어·하이픈 제거)+프리픽스 매칭.
 *  · 한국엔 분기별 기관보유(13F) 의무공시 제도가 없음 → US 전용(정직).
 */

import { NextResponse } from 'next/server'
import https from 'node:https'
import zlib from 'node:zlib'
import { dartJson, getCorpCode, krPrice, toStock6 } from '@/lib/dart'
import { getCache, setCache } from '@/lib/appCache'

// ── 추적 대상: 전설적 투자자 9인 (CIK 검증 완료, 모두 최신 분기 13F 제출) ──────────
const FUNDS: { cik: string; mgr: string; fund: string }[] = [
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

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface ShadowHolder {
  mgr:      string
  fund:     string                 // US: 운용사 / KR: 관계(최대주주·핵심경영진·연기금)
  shares:   number
  value:    number                 // US: USD · KR: KRW (해당 종목 보유 평가액)
  pctPort:  number                 // US: 펀드 포트폴리오 내 비중 / KR: 회사 지분율 (%)
  action:   'new' | 'add' | 'hold' | 'trim' | 'exit'
  deltaPct: number | null          // 전분기(US)·전기(KR) 대비 주식수 증감 (%)
  asOf:     string                 // 기준 제출일/공시일
  isLegend?: boolean               // KR: 국민연금 등 '거인' 강조
}
export interface ShadowResult {
  status:    'ok' | 'none' | 'unsupported' | 'error'
  ticker:    string
  name:      string
  market:    'US' | 'KR'
  currency:  'USD' | 'KRW'
  source:    '13F' | 'DART'        // 공시 출처
  holders:   ShadowHolder[]        // 보유/청산 거인 목록
  trackedFunds: number             // 추적한 전설 수(US) / 0(KR)
  asOf:      string                // 데이터 기준일(최신)
  lagNote:   string                // 공시 지연 안내
  lynchComment: string
  message?:  string
}

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

// ── 13F 정보테이블 파싱 (네임스페이스 없는 단순 태그) ─────────────────────────────
interface Holding { name: string; sh: number; val: number }
const pick = (b: string, t: string) => { const m = b.match(new RegExp('<' + t + '>([^<]*)</' + t + '>', 'i')); return m ? m[1].trim() : '' }
// ⚠️ 완전성 검증: 닫는 루트태그가 있어야 '잘리지 않은 전체 응답' — SEC throttle 시 truncated 200을
//    주면 일부 종목만 파싱돼 거짓 누락/청산이 생김. 닫는태그 없으면 secGet이 재시도.
const isInfoTable = (t: string) => /<\/informationTable>/i.test(t) || (/<\/infoTable>/i.test(t) && /<nameOfIssuer>/i.test(t))

async function fetchHoldings(cik: string, accDash: string): Promise<Holding[]> {
  const dir = 'https://www.sec.gov/Archives/edgar/data/' + parseInt(cik, 10) + '/' + accDash.replace(/-/g, '')
  const idxRes = await secGet(dir + '/index.json', isJson)
  if (idxRes.status !== 200) return []
  let xmlName = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx: any = JSON.parse(idxRes.text)
    // 정보테이블 = primary_doc가 아닌 .xml (보통 숫자.xml / form13fInfoTable.xml)
    xmlName = (idx?.directory?.item ?? [])
      .map((i: { name: string }) => i.name)
      .find((n: string) => /\.xml$/i.test(n) && !/primary_doc/i.test(n)) ?? ''
  } catch { return [] }
  if (!xmlName) return []
  const docRes = await secGet(dir + '/' + xmlName, isInfoTable)
  if (docRes.status !== 200) return []
  return docRes.text.split(/<infoTable>/i).slice(1)
    .map(b => ({
      name: pick(b, 'nameOfIssuer'),
      sh:   parseInt(pick(b, 'sshPrnamt').replace(/[^0-9]/g, ''), 10) || 0,
      val:  parseInt(pick(b, 'value').replace(/[^0-9]/g, ''), 10) || 0,
    }))
    .filter(h => h.name && h.sh > 0)
}

// ── 발행사명 토큰 정규화 + 강건 매칭 (CUSIP 없이) ───────────────────────────────
const STOP = new Set(['INC', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'PLC', 'HOLDINGS', 'HOLDING',
  'GROUP', 'THE', 'CLASS', 'CL', 'COM', 'NEW', 'ADR', 'DEL', 'LLC', 'SA', 'LP', 'NV', 'AG', 'OF', 'AND', 'PLATFORMS'])
const toks = (s: string) => String(s || '').toUpperCase().replace(/[-/.,&'()]/g, ' ')
  .split(/\s+/).filter(w => w && !STOP.has(w) && !/^[A-C]$/.test(w))
function nameMatch(targetToks: string[], holdName: string): boolean {
  const h = toks(holdName), k = targetToks
  if (!h.length || !k.length) return false
  if (h.join(' ') === k.join(' ')) return true
  if (h[0] !== k[0]) return false                          // 첫 토큰은 정확히 일치
  if (Math.abs(h.length - k.length) > 1) return false      // 토큰 수 1개 이내 차이
  const n = Math.min(h.length, k.length)
  for (let i = 1; i < n; i++) {
    const a = h[i], b = k[i]
    if (a.slice(0, 3) !== b.slice(0, 3) && !a.startsWith(b) && !b.startsWith(a)) return false
  }
  if (n >= 2) return true
  // 한쪽이 단일 토큰(예: target "Occidental")인데 상대는 "OCCIDENTAL PETE CORP"처럼
  // 식별 토큰 1개 + 약어가 붙는 경우 — 첫 토큰이 정확히 일치하고 충분히 식별력 있으면(≥5자) 매칭.
  // (양쪽 모두 단일 토큰인 경우는 위 h.join===k.join에서 이미 처리됨)
  return h[0].length >= 5
}

// ── 펀드 보유내역 인메모리 캐시 (12h · 콜드미스 1회만 SEC 수집) ───────────────────
interface FundData { mgr: string; fund: string; cur: Holding[]; prev: Holding[]; total: number; asOf: string }
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

const FUND_CACHE_KEY = 'shadow-13f-funds'
async function loadFunds(): Promise<FundData[]> {
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

// ── 린치 코멘트 (결정론적) ──────────────────────────────────────────────────────
function lynchComment(holders: ShadowHolder[], name: string): string {
  const owning = holders.filter(h => h.action !== 'exit')
  const exiters = holders.filter(h => h.action === 'exit')
  if (!owning.length && exiters.length) {
    return `⚠️ 추적 중인 전설들이 ${name}을(를) 보유하지 않아. 특히 ${exiters[0].mgr}은(는) 지난 분기 전량 매도했어. ` +
      `거인이 떠난 데는 이유가 있을 수 있지만, 13F는 45일 늦은 '과거의 결정'임을 잊지 마. 결국 네 판단이 중요해.`
  }
  if (!owning.length) {
    return `추적 중인 9명의 전설적 투자자 중 누구도 ${name}을(를) 들고 있지 않아. ` +
      `군중과 다른 길일 수도, 아직 거인들이 발견하지 못한 보석일 수도 있지. 거인을 따라가는 게 아니라, 거인이 왜 샀는지(혹은 안 샀는지)를 생각하는 게 진짜 공부야.`
  }
  const adders = owning.filter(h => h.action === 'add' || h.action === 'new')
  const top = [...owning].sort((a, b) => b.pctPort - a.pctPort)[0]
  let s = `🐳 ${owning.length}명의 전설이 ${name}을(를) 보유 중이야. `
  s += `특히 ${top.mgr}은(는) 포트폴리오의 ${top.pctPort.toFixed(1)}%를 여기에 걸었어. `
  if (adders.length) s += `지난 분기 ${adders.map(a => a.mgr).slice(0, 2).join('·')} 등 ${adders.length}명이 비중을 늘렸지. `
  s += `단, 13F는 45일 지난 '과거 스냅샷'이야. 거인을 맹목적으로 복제하지 말고, 그들이 본 가치를 네 눈으로 확인해.`
  return s
}

// ══ 한국 — DART 최대주주 현황(hyslrSttus) ═══════════════════════════════════════
// 미국엔 13F(분기 기관보유)가 있고, 한국엔 '최대주주 현황'(지배주주+특수관계인, 사업/분기보고서)이 있다.
// 국민연금이 최대주주인 회사(POSCO·KT&G 등)는 거인(NPS)이, 오너 지배 회사(삼성전자 등)는
// 설립자·핵심 경영진이 굳건히 쥐고 있음을 보여줘 '국장 변동성'에 대한 멘탈케어를 한다.
const REPRT_LABEL: Record<string, string> = { '11013': '1분기보고서', '11012': '반기보고서', '11014': '3분기보고서', '11011': '사업보고서' }
// 2026년 기준 최신 우선 → 점차 과거로 폴백(분기 공시 타이밍 편차 흡수)
const KR_PERIODS: { yr: string; rc: string }[] = [
  { yr: '2026', rc: '11013' },   // 2026 1분기
  { yr: '2025', rc: '11011' },   // 2025 사업보고서
  { yr: '2025', rc: '11014' },   // 2025 3분기
  { yr: '2025', rc: '11012' },   // 2025 반기
  { yr: '2024', rc: '11011' },   // 2024 사업보고서
]
const cleanNm = (s: string) => String(s || '').replace(/\s+/g, ' ').trim()
const krNum = (s: unknown) => parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0
const krFloat = (s: unknown) => { const n = parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0 }
const isNPS = (nm: string) => /국민연금/.test(nm)

function krComment(holders: ShadowHolder[], name: string): string {
  const nps = holders.find(h => h.isLegend)
  if (nps) {
    return `🏛️ 대한민국 자본시장의 거인, 국민연금공단(NPS)이 ${name} 지분 ${nps.pctPort.toFixed(2)}%를 쥐고 뒤를 받치고 있어. ` +
      `연기금은 분기 실적 하나에 일희일비하지 않는 초장기 투자자야 — 국장 단기 변동성에 흔들리지 말고, ` +
      `거인이 왜 이 회사를 길게 들고 가는지를 생각해. "주식이 아니라 기업을 소유하라"는 린치의 말이 딱 이거지.`
  }
  const ownerTotal = holders.reduce((s, h) => s + h.pctPort, 0)
  const top = holders[0]
  return `🏛️ ${name}은(는) 설립자·핵심 경영진이 지분 ${ownerTotal.toFixed(1)}%(최대 ${top.mgr} ${top.pctPort.toFixed(2)}%)를 굳건히 쥐고 있어. ` +
    `오너의 지분이 높다는 건 회사와 운명을 함께한다는 뜻 — 단기 주가에 흔들리기보다 기업의 장기 가치에 베팅했다는 신호야. ` +
    `"경영진이 자기 돈을 크게 건 회사를 주목하라"던 린치의 조언을 떠올려봐.`
}

async function krShareholders(ticker: string, name: string): Promise<ShadowResult> {
  const asOfNow = new Date().toISOString()
  const base: ShadowResult = {
    status: 'none', ticker, name: name || ticker, market: 'KR', currency: 'KRW', source: 'DART',
    holders: [], trackedFunds: 0, asOf: asOfNow,
    lagNote: 'DART 최대주주 현황(정기보고서 기준) — 공시 시점의 스냅샷입니다.', lynchComment: '',
  }
  const stock6 = toStock6(ticker)
  const corp = await getCorpCode(stock6)
  if (!corp) return { ...base, status: 'none', message: 'DART에 등록된 상장사가 아닙니다.' }

  // 데이터가 나올 때까지 최신→과거 폴백
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let list: any[] = []
  let period = ''
  for (const p of KR_PERIODS) {
    const j = await dartJson(`hyslrSttus.json?crtfc_key=${process.env.DART_API_KEY}&corp_code=${corp}&bsns_year=${p.yr}&reprt_code=${p.rc}`)
    if (j?.status === '000' && Array.isArray(j.list) && j.list.length) {
      list = j.list; period = `${p.yr} ${REPRT_LABEL[p.rc] || p.rc}`; break
    }
  }
  if (!list.length) return { ...base, status: 'none', message: 'DART 최대주주 현황 데이터를 찾지 못했습니다.' }

  // 이름 기준 합산 (동일인이 주식종류·계정별로 중복 행으로 나옴), '계'(합계) 제외
  interface Agg { nm: string; relate: string; sh: number; bsis: number; qota: number }
  const map = new Map<string, Agg>()
  for (const r of list) {
    const nm = cleanNm(r.nm)
    if (!nm || nm === '계' || nm === '합계' || /^합\s*계$/.test(nm)) continue
    const sh = krNum(r.trmend_posesn_stock_co)
    const bsis = krNum(r.bsis_posesn_stock_co)
    const qota = krFloat(r.trmend_posesn_stock_qota_rt)
    const prev = map.get(nm)
    if (prev) { prev.sh += sh; prev.bsis += bsis; prev.qota += qota }
    else map.set(nm, { nm, relate: cleanNm(r.relate), sh, bsis, qota })
  }
  let aggs = Array.from(map.values()).filter(a => a.sh > 0 && (a.qota >= 0.01 || isNPS(a.nm)))
  if (!aggs.length) return { ...base, status: 'none', message: 'DART 최대주주 현황 데이터를 찾지 못했습니다.' }

  const price = await krPrice(stock6)
  // 국민연금(거인) 먼저, 그 다음 지분율 큰 순, 상위 8
  aggs.sort((a, b) => (isNPS(b.nm) ? 1 : 0) - (isNPS(a.nm) ? 1 : 0) || b.qota - a.qota)
  aggs = aggs.slice(0, 8)

  const holders: ShadowHolder[] = aggs.map(a => {
    const legend = isNPS(a.nm)
    let action: ShadowHolder['action']
    let deltaPct: number | null = null
    if (a.bsis <= 0 && a.sh > 0) { action = 'new'; deltaPct = null }
    else if (a.bsis > 0) {
      deltaPct = Math.round(((a.sh - a.bsis) / a.bsis) * 1000) / 10
      action = deltaPct > 1 ? 'add' : deltaPct < -1 ? 'trim' : 'hold'
    } else action = 'hold'
    return {
      mgr: legend ? '국민연금공단 (NPS)' : a.nm,
      fund: legend ? '국가기관 · 연기금' : '설립자 및 핵심 경영진',
      shares: a.sh,
      value: price > 0 ? a.sh * price : 0,
      pctPort: Math.round(a.qota * 100) / 100,
      action, deltaPct, asOf: period,
      isLegend: legend,
    }
  })

  return {
    ...base,
    status: 'ok',
    holders,
    asOf: period,
    lagNote: `DART 최대주주 현황 (${period} 기준) — 정기보고서 공시 시점의 스냅샷입니다.`,
    lynchComment: krComment(holders, name || ticker),
  }
}

// ── 메인 핸들러 ────────────────────────────────────────────────────────────────
export const maxDuration = 45

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase()
  const name = (searchParams.get('name') || '').trim()
  const market = (searchParams.get('market') || '').trim().toUpperCase()
  const asOfNow = new Date().toISOString()
  // 국장 판별: market=KR · 6자리 숫자코드 · .KS/.KQ 접미사
  const bare = ticker.replace(/\.(KS|KQ)$/i, '')
  const isKR = market === 'KR' || /\.(KS|KQ)$/i.test(ticker) || /^\d{6}$/.test(bare)
  const base = {
    ticker, name: name || ticker,
    market: (isKR ? 'KR' : 'US') as 'US' | 'KR',
    currency: (isKR ? 'KRW' : 'USD') as 'USD' | 'KRW',
    source: (isKR ? 'DART' : '13F') as '13F' | 'DART',
    holders: [], trackedFunds: isKR ? 0 : FUNDS.length, asOf: asOfNow, lagNote: '', lynchComment: '',
  }

  if (!ticker) return NextResponse.json({ ...base, status: 'error', message: '티커가 없습니다.' } as ShadowResult)

  // 개별 주식만 — ETF·코인·원자재 차단 (백스톱)
  try {
    const { getAssetType } = await import('@/lib/assetClassifier')
    if (getAssetType(ticker, name, market) !== 'STOCK') {
      return NextResponse.json({ ...base, status: 'unsupported', message: '개별 주식만 지원합니다 (ETF·코인·원자재 제외).' } as ShadowResult)
    }
  } catch { /* 분류기 실패 시 진행 */ }

  // 🇰🇷 한국 종목 → DART 최대주주 현황 경로
  if (isKR) {
    try {
      const kr = await krShareholders(ticker, name)
      return NextResponse.json(kr, { headers: { 'Cache-Control': 'no-store' } })
    } catch (e) {
      console.warn('[shadow-13f:kr]', (e as Error).message)
      return NextResponse.json({ ...base, status: 'error', message: 'DART 주주현황 수집 중 오류가 발생했습니다.' } as ShadowResult)
    }
  }

  // 그 외 비미국(일본·유럽 등) — 13F·DART 모두 불가
  if (market && market !== 'US') {
    return NextResponse.json({
      ...base, status: 'unsupported',
      message: '🐳 슈퍼 클론은 미국(13F)·한국(DART 최대주주) 공시 기반입니다. 그 외 시장은 동일한 주주 공시 제도가 없어 지원하지 않습니다.',
    } as ShadowResult)
  }

  try {
    const funds = await loadFunds()
    if (!funds.length) {
      return NextResponse.json({ ...base, status: 'error', message: 'SEC 13F 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' } as ShadowResult)
    }

    const tT = toks(name || ticker)
    const holders: ShadowHolder[] = []
    for (const fd of funds) {
      const curHits = fd.cur.filter(h => nameMatch(tT, h.name))
      const prevHits = fd.prev.filter(h => nameMatch(tT, h.name))
      const curSh = curHits.reduce((s, h) => s + h.sh, 0)
      const curVal = curHits.reduce((s, h) => s + h.val, 0)
      const prevSh = prevHits.reduce((s, h) => s + h.sh, 0)
      if (curSh <= 0 && prevSh <= 0) continue           // 이 펀드는 관련 없음

      let action: ShadowHolder['action']
      let deltaPct: number | null = null
      if (curSh <= 0) { action = 'exit'; deltaPct = -100 }
      else if (prevSh <= 0) { action = 'new'; deltaPct = null }
      else {
        deltaPct = Math.round(((curSh - prevSh) / prevSh) * 1000) / 10
        action = deltaPct > 5 ? 'add' : deltaPct < -5 ? 'trim' : 'hold'
      }
      holders.push({
        mgr: fd.mgr, fund: fd.fund,
        shares: curSh, value: curVal,
        pctPort: fd.total > 0 ? Math.round((curVal / fd.total) * 1000) / 10 : 0,
        action, deltaPct, asOf: fd.asOf,
      })
    }

    // 정렬: 보유 거인을 비중(확신) 큰 순으로, 청산(exit)은 맨 뒤
    const rank = (a: ShadowHolder['action']) => a === 'exit' ? 1 : 0
    holders.sort((a, b) => rank(a.action) - rank(b.action) || b.pctPort - a.pctPort || b.value - a.value)

    const latestAsOf = funds.map(f => f.asOf).sort().reverse()[0] || asOfNow
    const result: ShadowResult = {
      ...base,
      status: holders.length ? 'ok' : 'none',
      holders,
      asOf: latestAsOf,
      lagNote: '13F는 분기 종료 후 최대 45일 뒤 공시됩니다 — 거인들의 현재가 아닌 과거 결정입니다.',
      lynchComment: lynchComment(holders, name || ticker),
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.warn('[shadow-13f]', (e as Error).message)
    return NextResponse.json({ ...base, status: 'error', message: '13F 데이터 수집 중 오류가 발생했습니다.' } as ShadowResult)
  }
}
