// 13F 정보테이블을 읽어 주식 · 옵션(풋/콜) · 채권 줄로 가르는 순수 함수 모음 — import 없음(단위 검사·브라우저 겸용). 수집은 guru13f.ts
//   ⚠️ 2026-11-28 실측으로 생긴 규칙 넷
//   ① 풋 · 콜은 '보유 종목'이 아니다 — 시타델은 13F 금액의 80%, 튜더는 70%가 옵션 줄이다(코언도 30%). 섞으면 하락 베팅이 보유로 보인다.
//      게다가 13F 의 옵션 금액은 옵션 값이 아니라 **기초자산 주식의 시가**라 비중 계산에 넣으면 실제보다 훨씬 크게 잡힌다.
//   ② 금액 단위는 법인마다 다르다 — 2023년부터 달러 원금이 규칙인데 듀케인은 지금도 천 달러로 적는다(나테라 주당 0.41달러로 계산됨).
//      상수로 가정하지 말고 값으로 판별한다(주당 금액 가운데 값이 3달러 미만이면 천 달러 단위).
//   ③ 채권(sshPrnamtType = PRN)의 수량은 주식 수가 아니라 액면이다 — 주식 수 증감·추정 평단에 섞지 않는다(오크트리 145줄 중 87줄).
//   ④ 줄 수가 수천인 법인은 통째로 저장하지 않는다(시타델 16,527줄 · 8.3MB) — 금액 상위만 남기되, 전분기 비교가 틀어지지 않게 짝을 맞춘다.

export type PutCall = 'put' | 'call'
/** 13F 한 줄. pc 가 있으면 옵션 줄(sh = 기초자산 주식 수 · val = 기초자산 시가) */
export interface Holding { name: string; cusip: string; sh: number; val: number; pc?: PutCall }
export interface ParsedTable {
  stock: Holding[]                    // 주식 줄(옵션 · 채권 제외)
  opts: Holding[]                     // 옵션 줄(pc 있음)
  bondLines: number; bondVal: number  // 채권 등(PRN) — 목록으로는 안 쓴다(개수 · 금액만)
  lines: number                       // 정보테이블 전체 줄 수
  scaled: boolean                     // 천 달러 단위라 1,000을 곱했다
}

// 네임스페이스 허용 — 브리지워터 · 히말라야 · 오크트리는 <ns1:infoTable> 처럼 접두사를 붙인다
const pick = (b: string, t: string) => { const m = b.match(new RegExp('<(?:\\w+:)?' + t + '>([^<]*)</(?:\\w+:)?' + t + '>', 'i')); return m ? m[1].trim() : '' }
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#3?9;|&apos;/g, "'")
const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** 주당 금액 가운데 값이 이보다 작으면 천 달러 단위로 본다 — 달러 원금이면 가운데 값이 수십~수백 달러, 천 달러 단위면 1 미만이다 */
export const THOUSANDS_BELOW = 3

export function parseInfoTable(xml: string): ParsedTable {
  const rows = xml.split(/<(?:\w+:)?infoTable>/i).slice(1).map(b => {
    const pcRaw = pick(b, 'putCall').toLowerCase()
    return {
      name: decode(pick(b, 'nameOfIssuer')), cusip: pick(b, 'cusip').toUpperCase(),
      sh: num(pick(b, 'sshPrnamt')), val: num(pick(b, 'value')),
      pc: pcRaw === 'put' || pcRaw === 'call' ? pcRaw as PutCall : undefined,
      prn: pick(b, 'sshPrnamtType').toUpperCase() === 'PRN',
    }
  }).filter(r => r.name && r.sh > 0)
  // 단위 판별은 주식 줄로만(옵션 · 채권은 주당 금액이 뜻이 다르다)
  const per = rows.filter(r => !r.pc && !r.prn && r.val > 0).map(r => r.val / r.sh)
  const med = median(per)
  const scaled = med != null && med < THOUSANDS_BELOW
  const k = scaled ? 1000 : 1
  const stock: Holding[] = [], opts: Holding[] = []
  let bondLines = 0, bondVal = 0
  for (const r of rows) {
    const val = r.val * k
    if (r.pc) opts.push({ name: r.name, cusip: r.cusip, sh: r.sh, val, pc: r.pc })
    else if (r.prn) { bondLines++; bondVal += val }
    else stock.push({ name: r.name, cusip: r.cusip, sh: r.sh, val })
  }
  return { stock, opts, bondLines, bondVal, lines: rows.length, scaled }
}

const keyOf = (h: Holding) => (h.pc ? `${h.cusip}:${h.pc}` : h.cusip)
const sumVal = (a: Holding[]) => a.reduce((s, h) => s + h.val, 0)

/**
 * 금액 상위 cap 줄의 종목만 남긴다 — 이번 분기와 전분기를 **따로** 자르면 비교가 틀어진다
 *   (이번엔 상위인데 전분기엔 상위 밖 → '신규'로 오판 · 전분기 상위인데 이번엔 상위 밖 → '전량 매도'로 오판).
 *   그래서 ① 이번 분기 상위 종목을 정하고 ② 전분기에서는 그 종목의 줄 + '이번 분기 전체에 정말 없는' 전분기 상위 종목(진짜 매도)만 남긴다.
 */
export function trimPair(curAll: Holding[], prevAll: Holding[], cap: number): { cur: Holding[]; prev: Holding[]; keptVal: number } {
  if (curAll.length <= cap && prevAll.length <= cap) return { cur: curAll, prev: prevAll, keptVal: sumVal(curAll) }
  const top = (a: Holding[]) => new Set([...a].sort((x, y) => y.val - x.val).slice(0, cap).map(keyOf))
  const kept = top(curAll), everCur = new Set(curAll.map(keyOf)), prevTop = top(prevAll)
  const cur = curAll.filter(h => kept.has(keyOf(h)))
  const prev = prevAll.filter(h => { const k = keyOf(h); return kept.has(k) || (prevTop.has(k) && !everCur.has(k)) })
  return { cur, prev, keptVal: sumVal(cur) }
}

/** 지금쯤이면 신고가 끝났어야 하는 가장 최근 분기말 — 13F 기한은 분기말 + 45일, 휴일 밀림을 감안해 7일 더 본다 */
export const FILING_GRACE_DAYS = 45 + 7
export function latestDueQuarter(nowMs: number): string {
  const d = new Date(nowMs - FILING_GRACE_DAYS * 86_400_000)
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate()
  // 분기말(3/31 · 6/30 · 9/30 · 12/31) 중 d 이하인 가장 늦은 날
  const ends: [number, number][] = [[12, 31], [9, 30], [6, 30], [3, 31]]
  for (const [em, ed] of ends) if (m > em || (m === em && day >= ed)) return `${y}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`
  return `${y - 1}-12-31`
}
/** 최신 분기 13F-HR 을 내지 않았다 — 통지(13F-NT)로 바꿨거나 신고를 그만둔 법인. 이런 법인의 보유는 '지금'이 아니다 */
export const isStaleReport = (reportDate: string, nowMs: number) => !reportDate || reportDate < latestDueQuarter(nowMs)
