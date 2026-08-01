// 🇰🇷 한국 실적 카드 SSOT — DART 「연결재무제표기준영업(잠정)실적(공정공시)」 원문 파싱.
//   미국(SEC 8-K)은 회사가 쓴 '서술'을 표준 공시로 받지만, 한국은 그 층위의 문서를 규제기관이 받지 않는다.
//   대신 잠정실적 공시가 발표 당일 **숫자**(매출·영업이익·순이익 × 전기/전년 증감율)를 준다 → 우리는 그 숫자를 정확히 옮긴다.
//   ⚠️ 실측으로 확인한 함정 셋(제미나이 리포트가 전부 여기서 틀렸다):
//     ① 단위가 회사마다 다르다(삼성전자 '조원' / SK하이닉스 '백만원') → 표 머리 라벨을 읽어 원 단위로 정규화
//     ② 정정공시가 따로 온다([기재정정]) → 접수번호가 가장 큰 건을 채택해야 최신값
//     ③ 회사마다 채우는 항목이 다르다(삼성전자는 순이익 칸이 비어 있음) → 빈 칸은 정직하게 null
import { dartBuf, unzipFirst, dartJson, getCorpCode } from '@/lib/dart'
import { getCache, setCache } from '@/lib/appCache'

// v2: 분기 라벨 표기를 회사별 원문('26.2Q'/'2026년2분기')에서 한 형태로 통일 — 캐시된 옛 표기 무효화
export const KR_EARN_KEY = (t: string) => `kr-earnings-v2:${t}`
export const KR_EARN_INDEX_KEY = 'kr-earnings-index-v2'

// ── 타입 ─────────────────────────────────────────────────────────────────────
export interface KrMetric {
  label: string             // 매출액 · 영업이익 · 당기순이익 등(공시 원문 표기 그대로)
  cur: number | null        // 당기실적(원 단위 정규화)
  prev: number | null       // 전기실적
  qoqPct: number | null     // 전기 대비 증감율(%)
  qoqTurn: string | null    // 흑자적자전환여부
  yoyBase: number | null    // 전년동기실적
  yoyPct: number | null     // 전년 동기 대비 증감율(%)
  yoyTurn: string | null
  ytd: number | null        // 당기 누계
  ytdBase: number | null    // 전년 동기 누계
  ytdPct: number | null
  ytdTurn: string | null
}

export interface KrEarningsDoc {
  ticker: string            // 6자리
  name: string
  corpCode: string
  rceptNo: string
  filedAt: string           // YYYY-MM-DD
  reportNm: string
  corrected: boolean        // [기재정정] 여부
  periodLabel: string       // '26.2Q'
  prevLabel: string         // '26.1Q'
  yoyLabel: string          // '25.2Q'
  unitLabel: string         // 원문 단위 표기('조원' 등) — 정직 표기용
  metrics: KrMetric[]
  irUrl: string | null      // 공시 본문에 들어있는 회사 IR 웹페이지
  notes: string[]           // 기타 투자판단과 관련한 중요사항
  dartUrl: string
  marketCap: number | null
  collectedAt: string
}

/** 목록 화면용 경량 행 */
export interface KrIndexRow {
  ticker: string
  name: string
  filedAt: string
  periodLabel: string
  corrected: boolean
  revenue: number | null
  revenueYoyPct: number | null
  opProfit: number | null
  opProfitYoyPct: number | null
  /** 증감율 대신 오는 값('흑자전환'·'적자전환'·'적자지속') — 전년이 적자면 %가 성립하지 않는다 */
  opProfitYoyTurn: string | null
  netProfit: number | null
  netProfitYoyPct: number | null
  netProfitYoyTurn: string | null
  /** 매출은 늘었는데 이익은 줄어든(또는 적자로 돌아선) 조합 — 헤드라인에 묻히기 쉬운 대비를 목록에서 바로 드러낸다 */
  divergence: boolean
  dartUrl: string
  marketCap: number | null
}

// ── 단위 정규화 ──────────────────────────────────────────────────────────────
const UNIT_MULT: Record<string, number> = {
  조원: 1e12, 억원: 1e8, 백만원: 1e6, 천원: 1e3, 원: 1,
}
function unitOf(text: string): { label: string; mult: number } {
  // "단위 : 조원, %" / "단위 : 백만원, %"
  const m = text.match(/단위\s*[:：]\s*([가-힣]+원)/)
  const label = m?.[1] ?? '원'
  return { label, mult: UNIT_MULT[label] ?? 1 }
}

// ── 표 파싱 (셀 위치 보존 — 빈 칸이 '-'로 남아야 슬롯이 안 밀린다) ──────────
const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/\s+/g, ' ').trim()

/** '26.2Q' · '2026년 2분기' → '2026년 2분기' */
function normQuarter(s: string): string {
  const a = s.replace(/\s+/g, '').match(/^(\d{2})\.(\d)Q$/)
  if (a) return `20${a[1]}년 ${a[2]}분기`
  const b = s.replace(/\s+/g, '').match(/^(\d{4})년(\d)분기$/)
  if (b) return `${b[1]}년 ${b[2]}분기`
  return s.trim()
}

function tableRows(xml: string): string[][] {
  const rows: string[][] = []
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let tr: RegExpExecArray | null
  while ((tr = trRe.exec(xml))) {
    const cells: string[] = []
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let td: RegExpExecArray | null
    while ((td = tdRe.exec(tr[1]))) cells.push(stripTags(td[1]))
    if (cells.length) rows.push(cells)
  }
  return rows
}

/** 셀 값 → 숫자(원) | 전환문구 | null */
function cellNum(s: string | undefined, mult: number): number | null {
  if (!s) return null
  const t = s.replace(/,/g, '').trim()
  if (!t || t === '-' || t === '—') return null
  const v = Number(t)
  return Number.isFinite(v) ? v * mult : null
}
function cellPct(s: string | undefined): number | null {
  if (!s) return null
  const t = s.replace(/,/g, '').replace(/%/g, '').trim()
  if (!t || t === '-' || t === '—') return null
  const v = Number(t)
  return Number.isFinite(v) ? v : null
}
function cellTurn(s: string | undefined): string | null {
  if (!s) return null
  const t = s.trim()
  return !t || t === '-' || t === '—' ? null : t
}

/** 잠정실적 공시 원문 → 지표·기간·단위·IR·주석 */
export function parseProvisional(xml: string): {
  unitLabel: string; periodLabel: string; prevLabel: string; yoyLabel: string
  metrics: KrMetric[]; irUrl: string | null; notes: string[]
} | null {
  const rows = tableRows(xml)
  if (!rows.length) return null

  const flat = stripTags(xml)
  const { label: unitLabel, mult } = unitOf(flat)

  // 기간 라벨 — 회사마다 표기가 다르다(삼성전자 '26.2Q' / SK하이닉스 '2026년 2분기') → 한 형태로 통일
  // ⚠️ 스프레드 대신 Array.from — 프로젝트 tsconfig 타깃에서 TS2802(5번째 재현)
  const qs = Array.from(flat.matchAll(/\((\d{2}\.\d ?Q|\d{4}년\s*\d분기)\)/g)).map(m => normQuarter(m[1]))
  const [periodLabel = '', prevLabel = '', yoyLabel = ''] = qs

  const KNOWN = ['매출액', '영업이익', '법인세비용차감전계속사업이익', '당기순이익', '지배기업 소유주지분 순이익', '지배기업소유주지분 순이익']
  const metrics: KrMetric[] = []
  let curLabel = ''

  for (const cells of rows) {
    const iCur = cells.findIndex(c => c === '당해실적')
    const iYtd = cells.findIndex(c => c === '누계실적')

    if (iCur >= 0) {
      // 항목명은 rowspan으로 '당해실적' 바로 앞 셀에 온다(없으면 직전 항목 유지)
      const nameCell = iCur > 0 ? cells[iCur - 1] : ''
      if (nameCell && KNOWN.some(k => nameCell.includes(k.slice(0, 4)))) curLabel = nameCell
      else if (nameCell && nameCell !== '당해실적') curLabel = nameCell
      if (!curLabel) continue
      const v = cells.slice(iCur + 1)   // [당기, 전기, 전기대비%, 전기전환, 전년동기, 전년대비%, 전년전환]
      metrics.push({
        label: curLabel,
        cur: cellNum(v[0], mult), prev: cellNum(v[1], mult),
        qoqPct: cellPct(v[2]), qoqTurn: cellTurn(v[3]),
        yoyBase: cellNum(v[4], mult), yoyPct: cellPct(v[5]), yoyTurn: cellTurn(v[6]),
        ytd: null, ytdBase: null, ytdPct: null, ytdTurn: null,
      })
    } else if (iYtd >= 0 && metrics.length) {
      // 누계 행: [당기누계, -, -, -, 전년동기누계, 증감율, 전환]
      const v = cells.slice(iYtd + 1)
      const m = metrics[metrics.length - 1]
      m.ytd = cellNum(v[0], mult)
      m.ytdBase = cellNum(v[4], mult)
      m.ytdPct = cellPct(v[5])
      m.ytdTurn = cellTurn(v[6])
    }
  }

  // IR 웹페이지(공시 본문에 회사가 직접 적어둔다 — 서술 자료 안내용)
  const ir = flat.match(/https?:\/\/[^\s<>"')|]+/)
  // 기타 투자판단 문구
  const noteIdx = flat.indexOf('기타 투자판단')
  const notes = noteIdx >= 0
    ? flat.slice(noteIdx, noteIdx + 900).split(/\s-\s/).slice(1).map(s => s.trim()).filter(s => s.length > 8).slice(0, 5)
    : []

  return {
    unitLabel, periodLabel, prevLabel, yoyLabel,
    metrics: metrics.filter(m => m.cur != null || m.ytd != null),
    irUrl: ir?.[0] ?? null,
    notes,
  }
}

// ── 최신 잠정실적 공시 찾기 (정정본 우선) ────────────────────────────────────
interface DartListRow { rcept_no: string; rcept_dt: string; report_nm: string }

async function findLatestProvisional(corpCode: string): Promise<DartListRow | null> {
  const end = new Date()
  const bgn = new Date(end.getTime() - 200 * 86_400_000)   // 최근 2분기 커버
  const f = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  // ⚠️ dartJson은 crtfc_key를 붙여주지 않는다(호출부가 넣는 규약 — 기존 4곳 동일)
  const j = await dartJson(`list.json?crtfc_key=${process.env.DART_API_KEY}&corp_code=${corpCode}&bgn_de=${f(bgn)}&end_de=${f(end)}&page_count=100`)
  const list: DartListRow[] = j?.list ?? []
  const prov = list.filter(r => /잠정.*실적|영업\(잠정\)실적/.test(r.report_nm))
  if (!prov.length) return null
  // ⚠️ 정정본은 나중에 접수되므로 접수번호가 가장 큰 건이 최신값(제미나이가 틀린 지점)
  return prov.sort((a, b) => (a.rcept_no < b.rcept_no ? 1 : -1))[0]
}

// ── 종목 1건 수집 (분기 캐시) ────────────────────────────────────────────────
export async function collectKrEarnings(
  ticker: string, name: string, marketCap: number | null
): Promise<KrEarningsDoc | null> {
  const cached = await getCache<KrEarningsDoc>(KR_EARN_KEY(ticker), 130 * 86_400_000)

  const corpCode = await getCorpCode(ticker)
  if (!corpCode) return cached ?? null

  const hit = await findLatestProvisional(corpCode)
  if (!hit) return cached ?? null
  if (cached && cached.rceptNo === hit.rcept_no && cached.metrics?.length) return cached

  const { status, buf } = await dartBuf(
    `https://opendart.fss.or.kr/api/document.xml?crtfc_key=${process.env.DART_API_KEY}&rcept_no=${hit.rcept_no}`
  )
  if (status !== 200 || buf.length < 500) return cached ?? null

  let xml = ''
  try { xml = unzipFirst(buf) } catch { return cached ?? null }
  const parsed = parseProvisional(xml)
  if (!parsed || !parsed.metrics.length) return cached ?? null

  const dt = hit.rcept_dt
  const doc: KrEarningsDoc = {
    ticker, name, corpCode,
    rceptNo: hit.rcept_no,
    filedAt: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
    reportNm: hit.report_nm.trim(),
    corrected: /정정/.test(hit.report_nm),
    periodLabel: parsed.periodLabel,
    prevLabel: parsed.prevLabel,
    yoyLabel: parsed.yoyLabel,
    unitLabel: parsed.unitLabel,
    metrics: parsed.metrics,
    irUrl: parsed.irUrl,
    notes: parsed.notes,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${hit.rcept_no}`,
    marketCap,
    collectedAt: new Date().toISOString(),
  }
  await setCache(KR_EARN_KEY(ticker), doc)
  return doc
}

// ── 목록 행 ─────────────────────────────────────────────────────────────────
const pick = (d: KrEarningsDoc, keys: string[]) =>
  d.metrics.find(m => keys.some(k => m.label.replace(/\s/g, '').includes(k))) ?? null

export function toKrIndexRow(d: KrEarningsDoc): KrIndexRow {
  const rev = pick(d, ['매출액', '영업수익'])
  const op = pick(d, ['영업이익'])
  const net = pick(d, ['당기순이익', '지배기업소유주지분순이익'])
  const revYoy = rev?.yoyPct ?? null
  const opYoy = op?.yoyPct ?? null
  const opTurn = op?.yoyTurn ?? null
  return {
    ticker: d.ticker, name: d.name, filedAt: d.filedAt,
    periodLabel: d.periodLabel, corrected: d.corrected,
    revenue: rev?.cur ?? null, revenueYoyPct: revYoy,
    opProfit: op?.cur ?? null, opProfitYoyPct: opYoy, opProfitYoyTurn: opTurn,
    netProfit: net?.cur ?? null, netProfitYoyPct: net?.yoyPct ?? null, netProfitYoyTurn: net?.yoyTurn ?? null,
    // 이익이 '줄어든' 것뿐 아니라 '적자로 돌아선' 경우도 같은 경고 대상
    divergence: revYoy != null && revYoy > 0 && ((opYoy != null && opYoy < 0) || /적자/.test(opTurn ?? '')),
    dartUrl: d.dartUrl, marketCap: d.marketCap,
  }
}

// 표시 포맷(원 → 조/억)은 화면에서 한다 — 이 파일은 서버 전용(node:https 의존)이라 클라이언트가 못 가져온다.
