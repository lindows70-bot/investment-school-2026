// 미국 신용잔고(증권사에서 빌려 산 주식) — FINRA 월별 통계를 읽어 한국 빚투 레이더와 같은 잣대(lib/leverageLevel)로 판정한다(위기 신호등 '미국 빚' 등)
//   원천 = FINRA Margin Statistics 이력 파일(xlsx · 1997-01~ · 백만 달러). 2026-11-22 실측: 358개월 · 빠진 달 0 · 2026-10 = 1,448,360 ·
//   2026-06 = 1,502,072(최고) — 같은 페이지의 최근 13개월 표와 일치(docs/crisis-signal/context-notes.md §6)
//   ⚠️ 신용계좌 예탁금(D열)은 2010-02 부터 있다 — 그 전과 비율의 정의가 달라 '과거에 빨강이었던 달' 집계는 정의가 같은 구간만 센다
//   ⚠️ xlsx 는 zip 이다 — 라이브러리 없이 필요한 두 조각(sharedStrings · sheet1)만 푼다(node:zlib). 열 제목이 다르면 통째로 버린다(형식이 바뀐 것)
import { inflateRawSync } from 'node:zlib'
import { percentileOf, leverageLevel, type LeverageLevel } from '@/lib/leverageLevel'

export const FINRA_MARGIN_XLSX = 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx'
export const US_MARGIN_KEY = 'us-margin-v1'   // 날짜 없는 키 — 신선도는 TTL 로
/** 판정 창 — 한국 빚투 레이더의 800거래일과 같은 길이(약 39개월) */
export const US_MARGIN_WINDOW_M = 39

export interface MarginMonth { ym: string; debitM: number; cashM: number | null; marginM: number | null }   // 백만 달러
export interface UsMargin {
  asOf: string
  ym: string                         // 기준월 'YYYY-MM'
  debitM: number                     // 신용잔고(빌린 돈)
  freeM: number                      // 예탁금(현금계좌 + 신용계좌에 맡겨 둔 돈)
  ratioPct: number                   // 빌린 돈 ÷ 맡겨 둔 돈 × 100
  ratioPercentile: number
  marginPercentile: number
  level: LeverageLevel
  windowMonths: number
  peak: { ym: string; debitM: number }   // 이력 전체에서 가장 많았던 달
  fromPeakPct: number                // 최고 대비 %(0 이하)
  yoyPct: number | null              // 1년 전 같은 달 대비 %
  /** 같은 규칙을 과거에 대면 빨강이었던 달 — 정의가 같은 구간만 */
  baseRate: { months: number; danger: number; since: string } | null
  historyFrom: string
}

/** zip 안의 한 파일을 글자로 — 중앙 디렉터리에서 이름을 찾아 푼다(저장·deflate 만) */
export function unzipText(buf: Buffer, name: string): string | null {
  try {
    let eocd = -1
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
    if (eocd < 0) return null
    const count = buf.readUInt16LE(eocd + 10)
    let p = buf.readUInt32LE(eocd + 16)
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) return null
      const method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20)
      const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
      const local = buf.readUInt32LE(p + 42)
      if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
        const data = buf.subarray(start, start + compSize)
        return method === 0 ? data.toString('utf8') : method === 8 ? inflateRawSync(data).toString('utf8') : null
      }
      p += 46 + nameLen + extraLen + commentLen
    }
    return null
  } catch { return null }
}

/** 시트 XML → 월별 줄(오름차순). 첫 줄 열 제목이 기대와 다르면 빈 배열(다른 표를 읽어 그럴듯한 숫자를 내지 않는다) */
export function parseMarginSheet(sharedStringsXml: string, sheetXml: string): MarginMonth[] {
  const strings = Array.from(sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g), m => Array.from(m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g), t => t[1]).join(''))
  const rows = Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), rw => {
    const cells: Record<string, string> = {}
    for (const c of Array.from(rw[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
      const col = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1]
      const v = /<v>([^<]*)<\/v>/.exec(c[2] ?? '')?.[1]
      if (!col || v == null) continue
      cells[col] = /\bt="s"/.test(c[1]) ? strings[Number(v)] ?? '' : v
    }
    return cells
  })
  const head = rows[0]
  if (!head || !/debit balances/i.test(head.B ?? '') || !/free credit.*cash accounts/i.test(head.C ?? '') || !/free credit.*margin accounts/i.test(head.D ?? '')) return []
  const num = (s: string | undefined): number | null => { const n = s != null && s.trim() !== '' ? Number(s) : NaN; return Number.isFinite(n) && n > 0 ? n : null }
  return rows.slice(1)
    .flatMap(c => { const debit = num(c.B); return /^\d{4}-\d{2}$/.test(c.A ?? '') && debit != null ? [{ ym: c.A, debitM: debit, cashM: num(c.C), marginM: num(c.D) }] : [] })
    .sort((a, b) => a.ym < b.ym ? -1 : 1)
}

const prevYm = (ym: string, back: number): string => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 - back, 1)); return d.toISOString().slice(0, 7) }
const round1 = (n: number) => Math.round(n * 10) / 10

/** 순수 계산 — 마지막 달의 판정과 곁 숫자. 창을 못 채우거나 창 안에 빠진 달·빈 예탁금이 있으면 null */
export function usMarginOf(all: MarginMonth[], nowIso: string = new Date().toISOString()): UsMargin | null {
  const rows = all.slice().sort((a, b) => a.ym < b.ym ? -1 : 1)
  const W = US_MARGIN_WINDOW_M
  if (rows.length < W) return null
  const free = (r: MarginMonth) => r.cashM != null && r.marginM != null ? r.cashM + r.marginM : null
  /** i 번째 달을 끝으로 하는 창의 판정 — 창이 달마다 이어지고(빠진 달 없음) 예탁금 두 칸이 다 있을 때만 */
  const judge = (i: number) => {
    if (i < W - 1) return null
    const w = rows.slice(i - W + 1, i + 1)
    if (w[0].ym !== prevYm(w[w.length - 1].ym, W - 1)) return null
    const ratios: number[] = []
    for (const r of w) { const f = free(r); if (f == null) return null; ratios.push(r.debitM / f) }
    const ratioPercentile = percentileOf(ratios, ratios[ratios.length - 1])
    const marginPercentile = percentileOf(w.map(r => r.debitM), w[w.length - 1].debitM)
    return { ratio: ratios[ratios.length - 1], ratioPercentile, marginPercentile, level: leverageLevel(ratioPercentile, marginPercentile) }
  }
  const last = rows[rows.length - 1]
  const now = judge(rows.length - 1), f = free(last)
  if (!now || f == null) return null
  // 상식 범위 — 비율이 0.2~20배 밖이면 열이 밀렸거나 단위가 바뀐 것(실측: 2020-03 1.15배 · 2026-10 3.42배)
  if (!(now.ratio > 0.2 && now.ratio < 20)) return null

  const peak = rows.reduce((m, r) => r.debitM > m.debitM ? r : m, rows[0])
  const yearAgo = rows.find(r => r.ym === prevYm(last.ym, 12))
  const judged = rows.map((r, i) => ({ ym: r.ym, j: judge(i) })).filter(x => x.j != null)
  return {
    asOf: nowIso, ym: last.ym, debitM: last.debitM, freeM: f,
    ratioPct: Math.round(now.ratio * 100), ratioPercentile: now.ratioPercentile, marginPercentile: now.marginPercentile, level: now.level,
    windowMonths: W,
    peak: { ym: peak.ym, debitM: peak.debitM }, fromPeakPct: round1((last.debitM / peak.debitM - 1) * 100),
    yoyPct: yearAgo ? round1((last.debitM / yearAgo.debitM - 1) * 100) : null,
    baseRate: judged.length ? { months: judged.length, danger: judged.filter(x => x.j!.level === 'danger').length, since: judged[0].ym } : null,
    historyFrom: rows[0].ym,
  }
}

/** FINRA 이력 파일을 받아 계산한다(캐시는 부르는 라우트가 맡는다). 실패 = null */
export async function fetchUsMargin(): Promise<UsMargin | null> {
  try {
    const r = await fetch(FINRA_MARGIN_XLSX, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const strings = unzipText(buf, 'xl/sharedStrings.xml'), sheet = unzipText(buf, 'xl/worksheets/sheet1.xml')
    if (!strings || !sheet) return null
    return usMarginOf(parseMarginSheet(strings, sheet))
  } catch { return null }
}
