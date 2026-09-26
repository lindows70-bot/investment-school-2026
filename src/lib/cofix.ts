// 🏦 COFIX(자금조달비용지수) SSOT — 변동금리 주택담보대출의 **기준금리**.
//
//   왜 필요한가 — 앱은 그동안 '주담대 신규취급 금리'(ECOS)만 봤는데, 그건 **결과**다.
//   변동금리 대출자가 매달 체감하는 건 COFIX + 가산금리이고, COFIX 가 먼저 움직인다.
//   실측(2026-08-23): 신규취급액 COFIX 가 2026-05 2.90 → 06 3.05 → **07 3.18** 로 급등 중.
//
//   ⚠️ 조달 경로 — ECOS·공공데이터포털 어디에도 없다(Phase 0 전수 확인). **은행연합회 공시 페이지가 유일**하다.
//      · 페이지 인코딩이 **EUC-KR** 이라 UTF-8 로 읽으면 통째로 깨진다
//      · 정규식으로 숫자만 긁으면 어느 열인지 모른다 → **표 구조(tr/td)로 읽는다**
//      · HTML 스크래핑이라 구조가 바뀌면 깨진다 → 헤더 문구를 확인하고, 이상하면 **null 을 반환**한다(지어내지 않음)
//   근거·판정표: docs/cofix/context-notes.md

const KFB_URL = 'https://portal.kfb.or.kr/fingoods/cofix.php'
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

/** 캐시 키 SSOT — 라우트는 임의 export 를 허용하지 않으므로 lib 에 둔다 · 🗓️ 날짜 없는 키(오늘 KST 만은 reader 의 sameKstDay 가 지킨다 — 날짜 키는 영구 누적) */
export const COFIX_KEY = 'cofix-v1'

export interface CofixMonthly {
  /** 공시일 YYYY-MM-DD */
  publishedAt: string
  /** 대상월 YYYY-MM — 화면에 쓰는 기준월 */
  targetMonth: string
  /** 신규취급액기준 — 신규 대출자에게 적용. 시장금리를 가장 빨리 반영 */
  newLoan: number | null
  /** 잔액기준 — 기존 대출 잔액 전체의 조달비용. 천천히 움직인다 */
  balance: number | null
  /** 신(新) 잔액기준 — 2019년 도입. 결제성 자금까지 포함해 가장 낮다 */
  newBalance: number | null
}

export interface CofixWeekly {
  publishedAt: string
  /** 대상기간 시작/끝 YYYY-MM-DD */
  from: string
  to: string
  value: number
}

export interface CofixResult {
  asOf: string
  monthly: CofixMonthly[]
  weekly: CofixWeekly[]
  latest: CofixMonthly | null
  /** 최근 3개월 변화(%p) — 방향을 한눈에 */
  chg3m: { newLoan: number | null; balance: number | null; newBalance: number | null }
  /** 학생용 해석 — 결정론 */
  reading: string
  notes: string[]
}

const strip = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
const num = (s: string): number | null => {
  const v = parseFloat(String(s).replace(/[^\d.-]/g, ''))
  // 상식 검산 — COFIX 는 0.3~10% 밖으로 나갈 수 없다. 벗어나면 파싱이 틀린 것이다
  return isFinite(v) && v >= 0.3 && v <= 10 ? v : null
}
/** '2026/07' · '2026/08/18' → '2026-07' · '2026-08-18' */
const dash = (s: string) => s.trim().replace(/\//g, '-')

export async function buildCofix(): Promise<CofixResult | null> {
  let html: string
  try {
    const r = await fetch(KFB_URL, { headers: UA, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    // ⚠️ EUC-KR — UTF-8 로 읽으면 한글 헤더가 깨져 표 판별이 실패한다(실측 2,039자 깨짐)
    html = new TextDecoder('euc-kr').decode(buf)
  } catch { return null }

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  const rowsOf = (tb: string) => (tb.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
    .map(tr => (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(strip).filter(Boolean))
    .filter(c => c.length > 0)

  const monthly: CofixMonthly[] = []
  const weekly: CofixWeekly[] = []

  for (const tb of tables) {
    const rows = rowsOf(tb)
    if (rows.length < 2) continue
    const head = rows[0].join(' ')

    // ── 월별 표 — 헤더에 '대상월'과 세 종류가 다 있어야 한다(구조 확인 후에만 읽는다)
    if (/대상월/.test(head) && /신규취급액/.test(head) && /잔액기준/.test(head)) {
      for (const c of rows.slice(1)) {
        if (c.length < 5) continue
        const targetMonth = dash(c[1])
        if (!/^\d{4}-\d{2}$/.test(targetMonth)) continue
        monthly.push({
          publishedAt: dash(c[0]), targetMonth,
          newLoan: num(c[2]), balance: num(c[3]), newBalance: num(c[4]),
        })
      }
    }
    // ── 주별 단기 COFIX
    else if (/대상기간/.test(head) && /단기/.test(head)) {
      for (const c of rows.slice(1)) {
        if (c.length < 3) continue
        const period = c[1].split('~').map(x => dash(x))
        const v = num(c[2])
        if (period.length !== 2 || v == null) continue
        weekly.push({ publishedAt: dash(c[0]), from: period[0], to: period[1], value: v })
      }
    }
  }

  // 파싱 실패 판정 — 월별이 3건 미만이면 페이지 구조가 바뀐 것이다. 반쪽 데이터를 내보내지 않는다.
  if (monthly.length < 3) return null

  // 최신순 정렬(공시일 기준)
  monthly.sort((a, b) => a.targetMonth < b.targetMonth ? 1 : -1)
  weekly.sort((a, b) => a.to < b.to ? 1 : -1)

  const latest = monthly[0] ?? null
  const back3 = monthly[3] ?? monthly[monthly.length - 1] ?? null
  const d = (a: number | null, b: number | null) => a != null && b != null ? Math.round((a - b) * 100) / 100 : null
  const chg3m = {
    newLoan: d(latest?.newLoan ?? null, back3?.newLoan ?? null),
    balance: d(latest?.balance ?? null, back3?.balance ?? null),
    newBalance: d(latest?.newBalance ?? null, back3?.newBalance ?? null),
  }

  // 해석 — 값에서 도출한다(리터럴 금지)
  const parts: string[] = []
  if (latest?.newLoan != null) {
    parts.push(`${latest.targetMonth} 기준 신규취급액 COFIX 는 ${latest.newLoan}% 입니다.`)
    if (chg3m.newLoan != null && Math.abs(chg3m.newLoan) >= 0.05) {
      parts.push(chg3m.newLoan > 0
        ? `3개월 전보다 ${chg3m.newLoan}%p **올랐습니다** — 변동금리로 새로 빌리는 사람의 부담이 그만큼 커졌다는 뜻입니다.`
        : `3개월 전보다 ${Math.abs(chg3m.newLoan)}%p 내렸습니다 — 변동금리 신규 대출 부담이 줄었습니다.`)
    } else parts.push('최근 3개월간 큰 변화는 없습니다.')
  }
  if (latest?.newLoan != null && latest?.balance != null) {
    const gap = Math.round((latest.newLoan - latest.balance) * 100) / 100
    parts.push(gap > 0.05
      ? `신규(${latest.newLoan}%)가 잔액(${latest.balance}%)보다 ${gap}%p 높습니다 — **지금 새로 빌리면 기존 대출자보다 비싸게** 빌리는 국면이고, 시간이 지나면 잔액 쪽도 따라 올라갑니다.`
      : gap < -0.05
        ? `신규(${latest.newLoan}%)가 잔액(${latest.balance}%)보다 ${Math.abs(gap)}%p 낮습니다 — 새로 빌리는 쪽이 유리하고, 기존 대출자는 갈아타기를 따져볼 국면입니다.`
        : `신규와 잔액이 비슷한 수준입니다.`)
  }

  return {
    asOf: new Date().toISOString(),
    monthly: monthly.slice(0, 24), weekly: weekly.slice(0, 26), latest, chg3m,
    reading: parts.join(' '),
    notes: [
      'COFIX 는 은행이 **돈을 조달한 비용**의 평균입니다. 변동금리 주담대 금리 = COFIX + 가산금리 − 우대금리로 정해지므로, COFIX 가 오르면 몇 달 안에 상환액이 따라 오릅니다.',
      '**신규취급액**은 그 달에 새로 조달한 자금만 반영해 시장금리를 가장 빨리 따라갑니다. **잔액기준**은 예전에 조달한 저금리 자금까지 섞여 천천히 움직이고, **신 잔액기준**은 결제성 자금까지 포함해 셋 중 가장 낮습니다.',
      '월별 COFIX 는 **다음 달 15일 전후**에 공시됩니다 — 여기 기준월이 한두 달 전인 것은 정상입니다.',
      '출처: 전국은행연합회 소비자포털 공시. ⛔ 대출 권유가 아니며 실제 적용 금리는 은행·신용도에 따라 다릅니다.',
    ],
  }
}
