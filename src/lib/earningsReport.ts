// 📑 실적 리포트 SSOT — SEC 8-K Item 2.02(Results of Operations)의 EX-99.x 원문을 수집·정제·요약.
//   NotebookLM이 사람이 PDF를 올려야 하던 일을 자동화한 것: 회사가 직접 쓴 실적 보도자료·CFO 코멘터리가 원천.
//   ⚠️ SEC는 Node https 모듈로(undici fetch는 gzip 응답을 깨뜨림 — 내부자·13F에서 학습한 규약).
//   ⚠️ 첨부 문서는 파일명이 회사마다 제각각(q1fy27pr.htm·googexhibit991q22026.htm) → 반드시 <TYPE>으로 고른다.
import https from 'node:https'
import zlib from 'node:zlib'
import { getCache, setCache } from '@/lib/appCache'
import { callGeminiJSON } from '@/lib/gemini'

// ── 캐시 키 SSOT ──────────────────────────────────────────────────────────────
export const CIK_MAP_KEY = 'sec-ticker-cik-v1'                        // 30일(신규 상장 반영 주기)
// v2: 정제 로직 변경(16진 엔티티·<TEXT> 경계) — 캐시된 원문이 옛 정제본이라 키를 올린다
export const ER_DOC_KEY = (t: string) => `earnings-report-v2:${t}`    // 종목별 — 분기 단위라 100일
export const ER_INDEX_KEY = 'earnings-report-index-v1'                // 목록 화면용 경량 인덱스

// ── 타입 ─────────────────────────────────────────────────────────────────────
export interface EarnExhibit {
  type: string      // 'EX-99.1'(실적 보도자료) | 'EX-99.2'(CFO 코멘터리) 등
  file: string      // 원본 파일명
  text: string      // 태그·엔티티 제거한 평문
  chars: number
}

export interface ErSummary {
  headline: string        // 한 줄 요약(회사가 강조한 것)
  performance: string[]   // 핵심 실적(매출·이익·마진 — 원문 숫자 그대로)
  guidance: string        // 다음 분기·연간 가이던스(없으면 '원문에 제시 없음')
  segments: string[]      // 사업 부문별 흐름
  risks: string[]         // 원문이 언급한 위험·역풍
  tone: 'positive' | 'neutral' | 'cautious'
}

export interface EarningsReportDoc {
  ticker: string
  name: string
  cik: string
  filedAt: string       // 8-K 제출일 YYYY-MM-DD
  accession: string     // 분기 식별자(같으면 재수집·재요약 안 함)
  url: string           // SEC 원문 링크
  exhibits: EarnExhibit[]
  summary: ErSummary | null
  summarizedAt?: string
  collectedAt: string
}

/** 목록 화면용 경량 행 — 종목 상세를 열지 않아도 보이는 것만 */
export interface ErIndexRow {
  ticker: string
  name: string
  filedAt: string
  url: string
  headline: string | null
  tone: ErSummary['tone'] | null
  hasSummary: boolean
  exhibitTypes: string[]
  marketCap: number | null
}

// ── SEC 전용 HTTP (Node https·재시도·무결성 검사) ─────────────────────────────
const SEC_UA = 'Investment School Edu (contact: lindows70@gmail.com)'

function rawGet(url: string, timeoutMs = 20000): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': SEC_UA } },
      r => {
        const chunks: Buffer[] = []
        r.on('data', d => chunks.push(d as Buffer))
        r.on('end', () => {
          let b = Buffer.concat(chunks)
          if (b.slice(0, 2).toString('hex') === '1f8b') { try { b = zlib.gunzipSync(b) } catch { /* 평문 유지 */ } }
          resolve({ status: r.statusCode ?? 0, text: b.toString('utf8') })
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('SEC timeout')))
  })
}

/** SEC는 과다요청 시 200에 '잘린 본문'을 주기도 한다 → valid()로 무결성 검사 후 백오프 재시도 */
async function secGet(url: string, valid?: (t: string) => boolean, timeoutMs = 20000) {
  let last = { status: 0, text: '' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await rawGet(url, timeoutMs)
      if (last.status === 200 && (!valid || valid(last.text))) return last
    } catch { /* 재시도 */ }
    await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
  }
  return last
}
const isJson = (t: string) => { const s = t.trimStart(); return s.startsWith('{') || s.startsWith('[') }
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── 티커 → CIK 맵 ────────────────────────────────────────────────────────────
export async function getCikMap(): Promise<Record<string, string>> {
  const cached = await getCache<Record<string, string>>(CIK_MAP_KEY, 30 * 86_400_000)
  if (cached && Object.keys(cached).length > 1000) return cached

  const r = await secGet('https://www.sec.gov/files/company_tickers.json', isJson)
  if (r.status !== 200) return cached ?? {}
  const map: Record<string, string> = {}
  try {
    for (const v of Object.values(JSON.parse(r.text) as Record<string, { ticker: string; cik_str: number }>)) {
      if (v?.ticker) map[v.ticker.toUpperCase()] = String(v.cik_str).padStart(10, '0')
    }
  } catch { return cached ?? {} }
  if (Object.keys(map).length > 1000) await setCache(CIK_MAP_KEY, map)
  return map
}

// ── 최신 실적 8-K 탐색 ───────────────────────────────────────────────────────
/** items에 '2.02'(Results of Operations)가 있는 가장 최근 8-K 1건 */
async function findLatestEarnings8K(cik: string): Promise<{ date: string; accession: string } | null> {
  const r = await secGet(`https://data.sec.gov/submissions/CIK${cik}.json`, isJson)
  if (r.status !== 200) return null
  try {
    const recent = JSON.parse(r.text)?.filings?.recent
    if (!recent?.form) return null
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] !== '8-K') continue
      if (!String(recent.items?.[i] ?? '').includes('2.02')) continue
      return { date: String(recent.filingDate[i]), accession: String(recent.accessionNumber[i]) }
    }
  } catch { /* 파싱 실패 */ }
  return null
}

// ── HTML → 평문 ──────────────────────────────────────────────────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'").replace(/&apos;/gi, "'")
    // ⚠️ 10진(&#8212;)뿐 아니라 16진(&#x2014;)도 온다 — MSFT 보도자료가 16진이라 첫 실측에서 원문에 그대로 남았다
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => {
      const n = parseInt(h, 16)
      return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : ' '
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d)
      return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : ' '
    })
    .replace(/&amp;/gi, '&')   // ⚠️ 반드시 마지막(먼저 하면 이중 디코드)
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|tr|table|h[1-6]|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim()
}

// ── EX-99.x 추출 (파일명 아닌 <TYPE> 기준) ───────────────────────────────────
async function fetchExhibits(cik: string, accession: string): Promise<EarnExhibit[]> {
  const acc = accession.replace(/-/g, '')
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${accession}.txt`
  // 잘린 응답 방어: 닫는 루트 태그가 있어야 완전한 제출본
  const r = await secGet(url, t => t.includes('</SEC-DOCUMENT>') || /<TYPE>EX-99/i.test(t), 30000)
  if (r.status !== 200) return []

  const out: EarnExhibit[] = []
  const re = /<DOCUMENT>\s*<TYPE>([^\s<]+)[\s\S]*?<FILENAME>([^\s<]+)([\s\S]*?)<\/DOCUMENT>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(r.text))) {
    const type = m[1].trim()
    if (!/^EX-99/i.test(type)) continue
    // <TEXT> 이전은 SEC 래퍼(DESCRIPTION 등) — 본문만 남긴다(안 자르면 "Document"·파일명이 본문 앞에 섞인다)
    const raw = m[3]
    const bodyStart = raw.search(/<TEXT>/i)
    const text = htmlToText(bodyStart >= 0 ? raw.slice(bodyStart + 6) : raw)
    if (text.length < 800) continue   // 표지·서명만 있는 껍데기 제외
    out.push({ type, file: m[2].trim(), text, chars: text.length })
  }
  return out
}

// ── 종목 1건 수집 (분기 캐시 — accession 같으면 재수집 안 함) ────────────────
export async function collectReport(ticker: string, name: string, cikMap: Record<string, string>): Promise<EarningsReportDoc | null> {
  const cik = cikMap[ticker.toUpperCase()]
  if (!cik) return null

  const cached = await getCache<EarningsReportDoc>(ER_DOC_KEY(ticker), 100 * 86_400_000)

  const hit = await findLatestEarnings8K(cik)
  if (!hit) return cached ?? null
  // 같은 분기(accession 동일) + 본문 확보 → 재수집 불필요(요약도 보존)
  if (cached && cached.accession === hit.accession && cached.exhibits?.length) return cached

  await sleep(350)   // SEC 10 req/s 예의
  const exhibits = await fetchExhibits(cik, hit.accession)
  if (!exhibits.length) return cached ?? null

  const acc = hit.accession.replace(/-/g, '')
  const doc: EarningsReportDoc = {
    ticker, name, cik,
    filedAt: hit.date,
    accession: hit.accession,
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${hit.accession}-index.htm`,
    exhibits,
    summary: null,
    collectedAt: new Date().toISOString(),
  }
  await setCache(ER_DOC_KEY(ticker), doc)
  return doc
}

// ── Gemini 요약 (서술만 — 판정·점수는 기존 SSOT가 담당) ──────────────────────
const SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    performance: { type: 'ARRAY', items: { type: 'STRING' } },
    guidance: { type: 'STRING' },
    segments: { type: 'ARRAY', items: { type: 'STRING' } },
    risks: { type: 'ARRAY', items: { type: 'STRING' } },
    tone: { type: 'STRING' },
  },
  required: ['headline', 'performance', 'guidance', 'segments', 'risks', 'tone'],
}

const MAX_INPUT = 30_000   // exhibit 합산 상한(요약 품질엔 충분, 응답 지연 방지)

export async function summarizeReport(doc: EarningsReportDoc): Promise<ErSummary | null> {
  const body = doc.exhibits
    .map(e => `[${e.type} · ${e.file}]\n${e.text}`)
    .join('\n\n---\n\n')
    .slice(0, MAX_INPUT)

  const prompt = `너는 투자 교육 앱의 애널리스트다. 아래는 ${doc.name}(${doc.ticker})가 ${doc.filedAt}에 미국 증권거래위원회(SEC)에 8-K로 제출한 실적 발표 원문이다(EX-99 첨부).
학생이 이해할 수 있는 한국어로 구조화해 요약하라.

⛔ 절대 규칙
- **모든 출력 필드는 한국어로 쓴다.** 원문이 영어여도 영문 문장을 그대로 옮기지 마라(고유명사·티커만 영문 병기 허용).
- 원문에 없는 숫자·사실·기업명·계약을 절대 만들지 마라. 모든 수치는 원문에 있는 것만 인용한다.
- 가이던스(다음 분기·연간 전망)가 원문에 없으면 guidance는 정확히 "원문에 제시 없음"이라고 쓴다.
- 주가 예측·매수/매도 의견을 쓰지 마라. 회사가 발표한 내용의 정리까지만.
- 사업 부문(세그먼트) 수치가 원문에 없으면 segments는 빈 배열로 둔다.

출력 규칙
- headline: 이번 분기를 한 문장으로(회사가 강조한 것 중심)
- performance: 핵심 실적 3~5개. 각 항목에 원문 수치를 포함(매출·순이익·주당순이익·마진 등)
- guidance: 다음 분기·연간 전망을 2~3문장
- segments: 사업 부문별 흐름 0~5개(수치 포함)
- risks: 원문이 스스로 언급한 위험·역풍·비용 요인 0~4개
- tone: ⚠️ 실적 보도자료는 원래 대부분 낙관적으로 쓰인다. 그 점을 감안해 **같은 종류의 문서들 사이에서 상대적으로** 판정하라.
  성과를 앞세우고 전망도 자신 있으면 positive / 성과는 알리되 비용·수요·불확실성을 눈에 띄게 언급하면 neutral /
  감익·수요 둔화·구조조정·가이던스 하향처럼 경계 신호를 스스로 강조하면 cautious

[원문]
${body}`

  const r = await callGeminiJSON<ErSummary>(prompt, SUMMARY_SCHEMA, { temperature: 0.2 })
  if (!r.ok) return null
  const s = r.data
  const tone = (['positive', 'neutral', 'cautious'] as const).includes(s.tone as 'positive') ? s.tone : 'neutral'
  return {
    headline: String(s.headline ?? '').trim(),
    performance: (s.performance ?? []).filter(Boolean).slice(0, 6),
    guidance: String(s.guidance ?? '').trim() || '원문에 제시 없음',
    segments: (s.segments ?? []).filter(Boolean).slice(0, 6),
    risks: (s.risks ?? []).filter(Boolean).slice(0, 5),
    tone,
  }
}

/** 요약을 doc에 얹어 캐시에 되쓴다 */
export async function attachSummary(doc: EarningsReportDoc, summary: ErSummary): Promise<EarningsReportDoc> {
  const next: EarningsReportDoc = { ...doc, summary, summarizedAt: new Date().toISOString() }
  await setCache(ER_DOC_KEY(doc.ticker), next)
  return next
}

export function toIndexRow(doc: EarningsReportDoc, marketCap: number | null): ErIndexRow {
  return {
    ticker: doc.ticker,
    name: doc.name,
    filedAt: doc.filedAt,
    url: doc.url,
    headline: doc.summary?.headline ?? null,
    tone: doc.summary?.tone ?? null,
    hasSummary: !!doc.summary,
    exhibitTypes: doc.exhibits.map(e => e.type),
    marketCap,
  }
}
