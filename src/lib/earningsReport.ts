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
  // ── 비교용 정량 필드 ─────────────────────────────────────────────────────
  //   서술만 나란히 놓으면 회사마다 다른 지표를 말해 '비교'가 되지 않는다(AAPL은 총마진, GOOGL은 영업이익…).
  //   같은 축으로 줄을 맞추려면 정해진 칸이 필요하다. 원문에 없으면 빈 문자열.
  period: string          // '2026년 3분기' — 회사 회계 기준 표기 그대로
  revenue: string         // '1,094억 1,700만 달러'
  revenueChange: string   // '+16%'
  opIncome: string        // '407억 7,000만 달러'(영업이익 — 본업)
  opIncomeChange: string  // '+30%'
  eps: string             // '2.02달러'(희석 주당순이익)
  epsChange: string       // '+29%'
  /** 이 요약을 만든 프롬프트 판 — 규칙을 고치면 올린다. 크론이 구버전을 스스로 다시 요약한다 */
  v?: number
}

/** 프롬프트 판. ⚠️ 요약 규칙(특히 숫자 규칙)을 고치면 반드시 올릴 것 — 안 올리면 옛 요약이 그대로 남는다.
 *  2: 정량 필드 도입 · 3: 영업이익 추가 · 4: 분기 수치·순수 매출 규칙(PG 연간 혼용·CVX 기타수익 포함 사고) */
export const PROMPT_V = 4

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
    period: { type: 'STRING' },
    revenue: { type: 'STRING' },
    revenueChange: { type: 'STRING' },
    opIncome: { type: 'STRING' },
    opIncomeChange: { type: 'STRING' },
    eps: { type: 'STRING' },
    epsChange: { type: 'STRING' },
  },
  required: ['headline', 'performance', 'guidance', 'segments', 'risks', 'tone', 'period', 'revenue', 'revenueChange', 'opIncome', 'opIncomeChange', 'eps', 'epsChange'],
}

const MAX_INPUT = 30_000   // exhibit 합산 상한(요약 품질엔 충분, 응답 지연 방지)
const FIN_WINDOW = 6_000   // 앞에서 잘린 손익계산서를 따로 실어 보낼 창

/** 손익계산서 표가 앞 상한 밖이면 그 구간을 덧붙인다.
 *  ⚠️ 실제 사고: 엑슨모빌은 매출 행이 34,347자 위치라 30,000자 상한에 **잘려 모델에 도달한 적이 없었다**.
 *     프롬프트에 예시까지 넣었는데도 매출 칸이 계속 비었던 진짜 이유가 이것이다(입력을 안 줬는데 지시만 한 셈).
 *     보도자료 본문(앞)은 서술에, 손익계산서(뒤)는 정량 칸에 필요하므로 둘 다 실어야 한다. */
function clipForPrompt(body: string): string {
  if (body.length <= MAX_INPUT) return body
  const head = body.slice(0, MAX_INPUT - FIN_WINDOW)
  for (const re of [/Sales and other operating revenue/i, /Total net sales/i, /Net sales/i, /Total revenues?/i, /Total net revenues?/i]) {
    const m = re.exec(body)
    if (m && m.index >= head.length) {
      return `${head}\n\n--- [손익계산서 발췌] ---\n${body.slice(Math.max(0, m.index - 300), m.index + FIN_WINDOW)}`
    }
  }
  return body.slice(0, MAX_INPUT)
}

export async function summarizeReport(doc: EarningsReportDoc): Promise<ErSummary | null> {
  const body = clipForPrompt(doc.exhibits
    .map(e => `[${e.type} · ${e.file}]\n${e.text}`)
    .join('\n\n---\n\n'))

  const prompt = `너는 투자 교육 앱의 애널리스트다. 아래는 ${doc.name}(${doc.ticker})가 ${doc.filedAt}에 미국 증권거래위원회(SEC)에 8-K로 제출한 실적 발표 원문이다(EX-99 첨부).
학생이 이해할 수 있는 한국어로 구조화해 요약하라.

⛔ 절대 규칙
- **모든 출력 필드는 한국어로 쓴다.** 원문이 영어여도 영문 문장을 그대로 옮기지 마라(고유명사·티커만 영문 병기 허용).
- **숫자는 반드시 아라비아 숫자로 쓴다**: "253억 달러", "85%", "2026년 2분기", "주당 2.14달러".
  ⛔ 숫자를 한글로 풀어 쓰지 마라("이십오조 삼백십억 달러"·"팔십오 퍼센트"·"이천이십육년" 전부 금지).
  단위 낱말(만·억·조·퍼센트)만 한글로 쓰고, 万·亿 같은 중국어 한자는 쓰지 마라.
- **금액은 원문 통화 그대로 쓴다(미국 기업이므로 달러).** 원·엔 등 다른 통화로 바꾸지 마라.
  달러 금액은 원문 표기를 한국식 자릿수로만 옮긴다: $25.3 Billion → 253억 달러 / $5.46 billion → 54억 6천만 달러.
  ⛔ 자릿수 실수 주의 — 1 billion = 10억이다: $13 billion → 130억 달러("13억" 금지) / $300 million → 3억 달러("300만" 금지) / $977 million → 9억 7,700만 달러.
  ⛔ 자기교정 문구 금지 — "977억 달러가 아니라 9억 7,700만 달러로"·"3억 5,100만 달러가 아닌 주당 3.51달러" 같은 문장을 쓰지 마라. 틀린 값을 언급하지 말고 **맞는 값만** 한 번 쓴다.
  ⛔ 범위(가감) 표기 — "$8.10 billion +/- $400 million" → "81억 달러에서 4억 달러를 가감한 수준"(± 뒤 숫자는 가감 폭이지 범위 하한이 아니다).
- 문장은 '~했다·~이다' 평서형으로 끝낸다('~습니다' 같은 높임 종결은 쓰지 마라).
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
- period: 이 실적이 어느 분기인지 회사 표기 그대로("2026년 3분기"·"2026 회계연도 4분기"). 원문에 없으면 빈 문자열
- revenue: 매출 금액 하나만(예 "1,094억 1,700만 달러"). 원문에 없으면 빈 문자열
  ⚠️ **반드시 이번 분기(period) 수치**를 쓴다. 회계연도 결산 발표는 연간(Fiscal Year)과 분기(Q4) 수치를 나란히 싣는데,
     period가 분기이면 값도 **분기 값**이어야 한다(예: P&G는 분기 $21,203M / 연간 $87,032M → 분기 값을 쓴다).
  ⚠️ **순수 매출만** 쓴다. 손익계산서 맨 위의 "Total revenues and other income"처럼 지분법이익·기타수익을 더한 합계를 쓰지 마라
  ⚠️ **보도자료 본문이 이익·현금흐름 중심이어도 빈칸으로 두지 마라** — 첨부된 손익계산서 표에서 매출 행을 찾아 채운다
     (엑슨모빌은 본문이 순이익 중심이지만 표에 "Sales and other operating revenue 114,529"가 있다 → 1,145억 2,900만 달러).
     표에도 매출 행이 전혀 없을 때만 빈 문자열로 둔다.
- opIncome(영업이익)은 **원문의 GAAP 'Operating income'/'Income from operations' 라인만** 쓴다.
  ⛔ 은행·증권사의 **Pre-tax income(세전이익)·Pre-tax earnings·Pre-provision profit(충당금 차감 전 이익)을 영업이익 칸에 쓰지 마라**
     — 이들은 영업이익이 아니라 다른 개념이다. 원문에 GAAP 영업이익 라인이 없으면 빈 문자열로 둔다(빈칸이 정직하다).
  ⛔ 회사 고유의 조정·비GAAP 지표(IBM의 'Operating (Non-GAAP)' 등)도 영업이익 칸에 쓰지 마라 — 조정 지표는 서술(performance)에서만 언급한다.
  ⛔ 'pre-tax'·'before income taxes'가 붙은 값은 GAAP이어도 전부 세전이익이지 영업이익이 아니다.
     실제 판정 예: 골드만삭스 "Pre-tax earnings 8,563" → 빈칸 / IBM은 GAAP·비GAAP 모두 pre-tax 지표뿐 → 빈칸 /
     JP모건 "Pre-provision profit" → 빈칸. **"Operating income" 또는 "Income from operations"라는 라벨이 문자 그대로 있는 경우에만 채운다.**
     (예: 셰브론은 매출 $67,199M이 맞고, 기타수익까지 더한 $70,055M은 틀리다).
- revenueChange: 매출의 전년 동기 대비 증감(예 "+16%"). 원문에 없으면 빈 문자열
- opIncome: **영업이익**(operating income) 금액(예 "407억 7,000만 달러"). 원문에 없으면 빈 문자열
- opIncomeChange: 영업이익의 전년 동기 대비 증감(예 "+30%"). 원문에 증감이 없으면 전년 영업이익이 함께 있을 때만 계산해 쓰고, 아니면 빈 문자열
  ⚠️ 영업이익은 **본업의 이익**이다. 투자 평가이익·일회성 이익이 순이익과 주당순이익을 크게 부풀릴 수 있어, 본업만 따로 보는 칸이 반드시 필요하다.
- eps: 희석 주당순이익(예 "2.02달러"). 일반회계기준을 우선하고 없으면 조정 기준. 원문에 없으면 빈 문자열
- epsChange: 주당순이익의 전년 동기 대비 증감(예 "+29%"). 원문에 없으면 빈 문자열
  ⚠️ 이 칸들은 여러 기업을 한 표에 줄 세우는 자리다. **금액·비율을 지어내지 말고 원문에 있는 것만** 쓴다.
  ⚠️ 금액 자릿수는 **억·만 단위로 통일**한다: "1,197억 9,600만 달러" (O) / "1,197억 9천6백만 달러" (X).
  ⚠️ **자릿수를 절대 틀리지 마라.** 원문의 백만 달러 표기를 그대로 옮긴다:
     $109,417M → "1,094억 1,700만 달러" · $90,007M → "900억 700만 달러"(900억 7만 X) · $81,615M → "816억 1,500만 달러"
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
    headline: ko(s.headline),
    performance: (s.performance ?? []).filter(Boolean).map(ko).slice(0, 6),
    guidance: ko(s.guidance) || '원문에 제시 없음',
    segments: (s.segments ?? []).filter(Boolean).map(ko).slice(0, 6),
    risks: (s.risks ?? []).filter(Boolean).map(ko).slice(0, 5),
    tone,
    period: ko(s.period), revenue: ko(s.revenue), revenueChange: ko(s.revenueChange),
    opIncome: ko(s.opIncome), opIncomeChange: ko(s.opIncomeChange),
    eps: ko(s.eps), epsChange: ko(s.epsChange),
    v: PROMPT_V,
  }
}

/** 중국어 수 단위 한자 혼입 정리 — 프롬프트로 막아도 드물게 새어(XOM에서 '11억 3100万 달러') 후처리로 확정한다.
 *  한국어 실적 문장에 이 글자가 정상적으로 올 일이 없어 안전한 치환이다.
 *  ⭐ '백·천' 자릿수 표기도 여기서 아라비아로 편다 — PG '212억 3백만'·'39억 4천9백만'은 값은 맞지만
 *     다른 카드('1,700만')와 표기가 달라 한 표에서 자릿수가 어긋나 보이고, 파서도 못 읽어 검산이 오탐한다.
 *     재요약(LLM)이 아니라 결정론 치환으로 확정한다. */
function ko(v: unknown): string {
  return String(v ?? '')
    .replace(/万/g, '만').replace(/亿/g, '억').replace(/兆/g, '조')
    .replace(/(\d+)\s*천\s*(\d+)\s*백만/g, (_, a, b) => `${(+a * 1000 + +b * 100).toLocaleString('en-US')}만`)
    .replace(/(\d+)\s*천만/g, (_, a) => `${(+a * 1000).toLocaleString('en-US')}만`)
    .replace(/(\d+)\s*백만/g, (_, a) => `${(+a * 100).toLocaleString('en-US')}만`)
    .trim()
}

/** 요약 품질 검사 — 프롬프트만으로는 새는 유형을 기계적으로 잡는다(재요약 대상 선별용).
 *  ⚠️ 실제 사고 사례: 숫자 한글 풀어쓰기가 JNJ에서 '$25.3 Billion → 이십오조 삼백십억 달러'(1,000배)로,
 *     TXN에서 '$2.14 → 2원 14센트'(통화 뒤바뀜)로 번졌다. 문체 문제가 아니라 수치 오류가 된다. */
export function summaryIssues(s: ErSummary | null): string[] {
  if (!s) return ['no_summary']
  const all = [s.headline, s.guidance, ...s.performance, ...s.segments, ...s.risks].join(' ')
  const nums = [s.revenue, s.opIncome, s.eps].join(' ')   // 표에 줄 세우는 칸만 표기 규칙을 강제한다
  const out: string[] = []
  if (/[万亿兆]/.test(all)) out.push('한자')
  if (/습니다|입니다|됩니다|합니다/.test(all)) out.push('높임체')
  if (!/[가-힣]/.test(s.headline)) out.push('영어')
  // 한글 숫자 3자 이상 + 금액·비율 단위 → 풀어쓰기(예: '이십오조 삼백십억 달러', '팔십오 퍼센트')
  if (/[일이삼사오육칠팔구십백천만억조점공]{3,}\s*(퍼센트|달러)/.test(all)) out.push('한글숫자')
  if (/\d+\s*원\b|원\s*\d+\s*센트/.test(all)) out.push('통화오류')
  // 비교 표를 줄 세우는 칸 — 없으면 '나란히 보기'로 되돌아간다. 크론이 알아서 다시 요약한다
  if (!s.revenue || !s.period) out.push('정량필드')
  // ⚠️ 영업이익 누락은 재요약 대상이 아니다 — 은행(WFC)·제약(MRK)은 **원문에 영업이익 표기가 없어**
  //    다시 요약해도 영원히 채워지지 않는다. 트리거로 두면 매일 헛되이 호출한다(정직하게 빈칸으로 둔다).
  // '9천6백만' 같은 표기 — 다른 카드는 '1,700만'이라 한 표에서 자릿수가 어긋난다(정량 칸만 검사)
  if (/\d\s*천\s*\d*\s*백만/.test(nums)) out.push('자릿수표기')
  // 프롬프트 규칙을 고쳤는데 옛 요약이 남아 있으면 다시 만든다 — 손으로 50종을 훑지 않기 위한 장치
  if ((s.v ?? 0) < PROMPT_V) out.push('구버전')
  return out
}

// ── 금액 자릿수 원문 대조 ────────────────────────────────────────────────────
//  ⚠️ 프롬프트로는 반복해서 샌다(실측): $90,007M → "900억 7만"(MSFT) · $21,203M → "212억 3만"(PG).
//     백만 달러 표기의 끝 세 자리를 만 단위로 옮길 때 앞의 0을 흘려 1,000배 작아진다.
//     예시를 아무리 넣어도 다른 종목에서 또 나므로, **원문에 그 숫자가 실재하는지** 기계로 확인한다.

/** '1,094억 1,700만 달러' → 109417000000 */
export function parseKoAmount(s: string): number | null {
  const t = String(s ?? '').replace(/,/g, '')
  const g = (re: RegExp) => { const m = t.match(re); return m ? Number(m[1]) : 0 }
  const v = g(/(\d+(?:\.\d+)?)\s*조/) * 1e12 + g(/(\d+(?:\.\d+)?)\s*억/) * 1e8 + g(/(\d+(?:\.\d+)?)\s*만/) * 1e4
  return v > 0 ? v : null
}

/** 그 금액이 원문에 백만/십억 단위 표기로 나타나는가.
 *  ⚠️ 느슨하면 검사가 무력해진다 — 처음엔 십억 소수("21.2")를 그대로 찾았더니
 *     PG의 잘못된 "212억 3만"(=21.20003십억)이 원문 어딘가의 '21.2'에 걸려 통과했다.
 *     십억 표기는 반드시 'billion'이 붙은 문맥으로만 인정한다. */
function appearsInSource(n: number, body: string): boolean {
  // ⚠️ 맨숫자 includes는 쓰지 않는다 — 부분 문자열이라 다른 긴 숫자 안에 걸려 검사가 통과해버린다(PG 사례).
  const m = Math.round(n / 1e6)
  for (const cand of [m, m - 1, m + 1]) {                                  // 반올림 오차 1 허용
    if (body.includes(cand.toLocaleString('en-US'))) return true           // "21,203"
    if (new RegExp(`(?<![\\d,.])${cand}(?![\\d,.])`).test(body)) return true // 콤마 없이 적는 표도 있다
  }
  // 십억 소수 — 표 머리에 단위(in billions)를 두고 '$9.3'처럼만 적는 회사가 있다(마스터카드·뱅크오브아메리카).
  // ⚠️ '$' 접두를 반드시 요구한다. 맨숫자 매칭은 비율·다른 수치에 걸려 검사를 무력화한다(PG '21.2' 사례).
  const b = n / 1e9
  for (const d of [1, 2]) {
    const s = b.toFixed(d).replace('.', '\\.')
    if (new RegExp(`\\$\\s?${s}(?!\\d)`).test(body)) return true          // "$9.3"
    if (new RegExp(`${s}\\s*billion`, 'i').test(body)) return true        // "9.3 billion"
  }
  // 정수 십억 — "guidance of $61 billion"(META)·"$148 billion"(MS)처럼 소수 없이 적는 표기.
  // ⚠️ billion 문맥을 반드시 요구한다 — 맨 "$61"은 주가·EPS 에 걸려 검사가 무력해진다.
  if (Number.isInteger(Math.round(b * 10) / 10) || Math.abs(b - Math.round(b)) < 0.05) {
    if (new RegExp(`\\$?\\s?${Math.round(b)}\\s*billion`, 'i').test(body)) return true
  }
  // 조 단위 — "$10 trillion"(MS 고객자산)·"$2.9 trillion"(MA 거래금액)
  const t = n / 1e12
  for (const d of [0, 1, 2]) {
    const s = t.toFixed(d).replace('.', '\\.')
    if (new RegExp(`\\$?\\s?${s}\\s*trillion`, 'i').test(body)) return true
  }
  return false
}

/** 요약 금액을 두 가지로 검산한다 — 재요약 대상 판정용.
 *  ⭐ ① 만 단위 자릿수 — 백만 달러 단위 공시를 억·만으로 옮기면 만 단위는 100의 배수(=3자리 이상)가 된다.
 *        "212억 3만"(만 단위 3) · "900억 7만"(7)처럼 1~2자리면 끝자리를 흘린 것이다.
 *        오차가 0.01%대라 값 대조로는 절대 잡히지 않는 유형이라 자릿수 자체를 본다.
 *        ⚠️ 백만 정수성으로 판정하면 천 달러 단위까지 공시하는 회사(KLA 36억 5,755만·넷플릭스 125억 5,993만)를 오탐한다.
 *  ② 원문 실재 — 연간·분기 혼용이나 다른 줄(기타수익 포함 합계)을 가져온 경우를 잡는다. */
/** 원문에 '$X billion / $X million / $X trillion' 으로 명시된 달러 금액 목록.
 *  범위 표기("$61-64 billion" · "$61 billion to $64 billion")는 양끝 값을 모두 담는다 —
 *  META 가이던스가 이 표기라 610억·640억이 둘 다 정당한 값이다. */
function statedDollarAmounts(body: string): number[] {
  const out: number[] = []
  const unit = (u: string) => /trillion/i.test(u) ? 1e12 : /billion/i.test(u) ? 1e9 : 1e6
  for (const m of Array.from(body.matchAll(/\$\s?([\d,]+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*\$?\s?([\d,]+(?:\.\d+)?))?\s*(billion|million|trillion)/gi))) {
    const u = unit(m[3])
    for (const g of [m[1], m[2]]) {
      if (!g) continue
      const v = parseFloat(g.replace(/,/g, ''))
      if (isFinite(v) && v > 0) out.push(v * u)
    }
  }
  return out
}

/** 자유 서식 문장 속 '…억/만 달러' 금액이 원문과 자릿수까지 맞는지 */
function freeTextAmountIssues(label: string, text: string | null | undefined, body: string, stated: number[]): string[] {
  if (!text || !body) return []
  const out: string[] = []
  for (const m of Array.from(text.matchAll(/((?:[\d,.]+\s*조\s*)?(?:[\d,.]+\s*억\s*)?(?:[\d,.]+\s*만\s*)?)달러/g))) {
    const phrase = m[1].trim()
    if (!phrase) continue                       // "2.14달러"(주당) 같은 단위 없는 금액은 대상 아님
    const n = parseKoAmount(phrase)
    if (n == null || n < 1e6) continue
    // ① 표·백만 단위 표기로 원문에 존재하는가 ($10M 미만은 appearsInSource 가 너무 느슨해 제외)
    if (n >= 1e7 && appearsInSource(n, body)) continue
    // ② '$X billion/million' 명시 문장과 상대오차 1% 이내인가
    if (stated.some(d => Math.abs(n - d) / d <= 0.01)) continue
    // 둘 다 아니면 자릿수가 틀렸을 가능성이 크다 — AMD "$13 billion→13억"(×1/10)·"$300 million→300만"(×1/100) 실사고
    out.push(`금액틀림:${label}`)
  }
  return out
}

export function amountIssues(s: ErSummary | null, body: string): string[] {
  if (!s) return []
  const out: string[] = []
  for (const [label, val] of [['매출', s.revenue], ['영업이익', s.opIncome]] as const) {
    if (!val) continue
    const n = parseKoAmount(val)
    if (n == null) continue
    const man = Math.round((n % 1e8) / 1e4)          // 억 단위 뒤에 붙는 '만' 부분
    if (man > 0 && man < 100) { out.push(`자릿수:${label}`); continue }
    if (body && !appearsInSource(n, body)) out.push(`금액틀림:${label}`)
  }
  // ── 자유 서식 필드(가이던스·실적·부문)의 달러 금액도 검산한다 ────────────────
  // ⚠️ 매출·영업이익 두 필드만 검사하던 시절, 가이던스의 "$13 billion → 13억 달러"(×1/10)와
  //    "$300 million → 300만 달러"(×1/100)가 걸리지 않고 화면까지 나갔다(AMD 실사고).
  const stated = statedDollarAmounts(body)
  out.push(...freeTextAmountIssues('가이던스', s.guidance, body, stated))
  for (const p of s.performance ?? []) out.push(...freeTextAmountIssues('실적', p, body, stated))
  for (const g of s.segments ?? []) out.push(...freeTextAmountIssues('부문', g, body, stated))
  return Array.from(new Set(out))
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
