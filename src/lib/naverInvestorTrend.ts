// 코스피·코스닥 투자자별 일별 순매수(억원) SSOT — 네이버 신규 API(stock.naver.com) 한 곳에서만 읽는다
//
// 💥 2026-09-27: 옛 PC 페이지(finance.naver.com/sise/investorDealTrendDay.naver)가 HTTP 410 으로 폐기돼
//    수급 레이더·코스피×외인 오버레이·주간 리포트 수급이 조용히 비었다. 같은 원천을 두 곳이 각자 파싱하고 있어서
//    둘 다 따로 죽었다 — 이제 이 파일 하나가 코드표·단위를 들고 있다.
//
// 📏 실측(2026-09-27)
//   · 엔드포인트: /api/domestic/market/trend/daily?marketType=KOSPI|KOSDAQ&tradeType=KRX&startIdx=<페이지 번호>&pageSize=<≤200>
//     startIdx 는 행 오프셋이 아니라 **페이지 번호**(startIdx=1 이 201번째 행부터). pageSize 250 이상은 HTTP 400.
//     marketType 을 빼면 코스피+코스닥 합계가 온다(개인 −14,374억 = 코스피 −14,649 + 코스닥 +275).
//   · 단위: diffValue 는 **원** → ÷1e8 = 억원. 독립 원천 대조 — 다음 금융(원) 2026-07-24 개인 51,782·외국인 −32,683·
//     기관 −19,514억 = 이 API 와 정확히 일치(옛 페이지 검산값과도 같다).
//   · 코드표: 네이버 자체 프런트 번들의 표(W·Y)를 그대로 옮겼다 — 8000 개인 · 9000 외국인(+9001 기타외국인) ·
//     1000 금융투자 · 2000 보험 · 3000 투신(+3100 사모) · 4000 은행 · 5000 기타금융 · 6000 연기금등(+7000 국가·지자체) ·
//     7100 기타법인 · 기관계 = 1000~7000 합.
//   · 옛 페이지와 같은 시계열: 원 단위로 합산한 뒤 억 반올림하면 옛 캐시(2026-09-08~10) 10열이 전부 그대로 나온다.
//     그래서 캐시 키를 올리지 않았다(내용이 같다).
//   · Vercel(icn1)에서 도달 확인(프리뷰 프로브 HTTP 200 · 139ms).

export interface InvestorRow {
  date: string          // YYYY-MM-DD
  personal: number      // 개인 순매수(억원, +매수/−매도)
  foreign: number       // 외국인(기타외국인 포함)
  institution: number   // 기관계
  finInvest: number     // 금융투자
  insurance: number     // 보험
  trust: number         // 투신(사모 포함)
  bank: number          // 은행
  otherFin: number      // 기타금융
  pension: number       // 연기금등(국가·지자체 포함)
  otherCorp: number     // 기타법인
}

const CODES: Record<Exclude<keyof InvestorRow, 'date'>, string[]> = {
  personal: ['8000'],
  foreign: ['9000', '9001'],
  institution: ['1000', '2000', '3000', '3100', '4000', '5000', '6000', '7000'],
  finInvest: ['1000'],
  insurance: ['2000'],
  trust: ['3000', '3100'],
  bank: ['4000'],
  otherFin: ['5000'],
  pension: ['6000', '7000'],
  otherCorp: ['7100'],
}

const PAGE_MAX = 200
type Raw = { bizdate?: string; netAmounts?: { investorGubun?: string; diffValue?: string }[] }

function toRow(r: Raw): InvestorRow | null {
  const bd = String(r.bizdate ?? '')
  if (!/^\d{8}$/.test(bd)) return null
  const won = new Map<string, number>()
  for (const x of r.netAmounts ?? []) {
    const v = Number(x.diffValue)
    if (x.investorGubun && Number.isFinite(v)) won.set(x.investorGubun, v)
  }
  // 핵심 두 주체가 없으면 그날은 버린다(0 으로 채우면 '매매 없음'이라는 거짓이 된다)
  if (!won.has('8000') || !won.has('9000')) return null
  const eok = (codes: string[]) => Math.round(codes.reduce((s, c) => s + (won.get(c) ?? 0), 0) / 1e8)
  const row = { date: `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}` } as InvestorRow
  for (const [k, codes] of Object.entries(CODES)) row[k as keyof typeof CODES] = eok(codes)
  return row
}

/** 최근 `days` 거래일(최신 → 과거). 페이지를 차례로 넘기고 **첫 실패에서 멈춘다** —
 *  중간 페이지만 빠진 채 이어 붙이면 누적 합이 구멍을 건너뛰어 조용히 다른 기간이 된다. */
export async function fetchInvestorDaily(market: 'KOSPI' | 'KOSDAQ', days: number): Promise<InvestorRow[]> {
  const out: InvestorRow[] = []
  const seen = new Set<string>()
  const pageSize = Math.min(PAGE_MAX, days)
  for (let page = 0; out.length < days; page++) {
    let content: Raw[] = []
    try {
      const url = `https://stock.naver.com/api/domestic/market/trend/daily?marketType=${market}&tradeType=KRX&startIdx=${page}&pageSize=${pageSize}`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000), cache: 'no-store' })
      if (!r.ok) break
      content = (await r.json())?.content ?? []
    } catch { break }
    if (!content.length) break
    for (const raw of content) {
      const row = toRow(raw)
      if (row && !seen.has(row.date)) { seen.add(row.date); out.push(row) }
    }
    if (content.length < pageSize) break
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days)
}
