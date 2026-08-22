// 🔍 Phase 0 — 우선주 판정에 쓸 수 있는 야후 필드가 실제로 오는지 실측.
//   ⚠️ 로컬 bare fetch 는 야후가 401 로 막는다 → 프로덕션과 같은 yahoo-finance2 로 호출해야 진짜 값이 나온다.
//   목표: 오탐 0인 신호를 고른다(보통주·ETF·리츠가 우선주로 잡히면 안 됨).
import YahooFinance from 'yahoo-finance2'
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const GROUPS = {
  '🎯 Strategy 우선주(대상)': ['STRC', 'STRK', 'STRF', 'STRD'],
  '🔸 타사 우선주(일반화 확인)': ['BAC-PL', 'NLY-PF', 'AGNCN'],
  '⚪ 보통주(오탐 확인)': ['MSTR', 'MO', 'O', 'T', 'VZ', 'AGNC', 'NLY', 'ARCC', 'EPD', 'SPGI'],
  '⚪ ETF(오탐 확인)': ['MSTY', 'JEPI', 'SCHD', 'QYLD'],
  '⚪ KR(오탐 확인)': ['005930.KS', '005935.KS', '051910.KS', '051915.KS'],
}

for (const [g, tickers] of Object.entries(GROUPS)) {
  console.log(`\n═══ ${g} ═══`)
  for (const t of tickers) {
    try {
      const q = await yf.quoteSummary(t, { modules: ['price', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics'] })
      const pr = q?.price ?? {}, ap = q?.assetProfile ?? {}, ks = q?.defaultKeyStatistics ?? {}
      console.log(`\n  ${t}`)
      console.log(`    quoteType   = ${JSON.stringify(pr.quoteType)}`)
      console.log(`    shortName   = ${JSON.stringify(pr.shortName)}`)
      console.log(`    longName    = ${JSON.stringify(pr.longName)}`)
      console.log(`    sector/ind  = ${JSON.stringify(ap.sector ?? null)} / ${JSON.stringify(ap.industry ?? null)}`)
      console.log(`    shares      = ${ks.sharesOutstanding ?? null} · mktCap ${pr.marketCap ?? null}`)
    } catch (e) {
      console.log(`\n  ${t}  ❌ ${String(e.message).slice(0, 90)}`)
    }
  }
}
