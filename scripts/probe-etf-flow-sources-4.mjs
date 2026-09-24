// 🔍 Phase 0 (4차) — Yahoo quote() 에 ETF 발행주수(sharesOutstanding)가 오는가. 오면 Δ주수×NAV = 진짜 순창출/환매(AUM 동결 문제 회피)
import YahooFinance from 'yahoo-finance2'
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
for (const t of ['IBIT', 'FBTC', 'GBTC', 'SPY']) {
  try {
    const q = await yf.quote(t)
    const keys = Object.keys(q).filter(k => /share|assets|nav|Nav|volume|Time/i.test(k))
    console.log(t, JSON.stringify(Object.fromEntries(keys.map(k => [k, q[k]]))))
  } catch (e) { console.log(t, 'ERR', e.message.slice(0, 100)) }
}
