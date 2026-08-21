// Phase 0: 성적표 채점용 섹터 프록시 티커 실측 — 시세가 실제로 오는가·이력 깊이·최근 종가
import { createRequire } from 'module'
const require2 = createRequire(import.meta.url)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const PROXIES = [
  ['energy', 'XLE'], ['materials', 'XLB'], ['industrials', 'XLI'], ['discretionary', 'XLY'],
  ['staples', 'XLP'], ['healthcare', 'XLV'], ['financials', 'XLF'], ['infotech', 'XLK'],
  ['communication', 'XLC'], ['utilities', 'XLU'], ['realestate', 'XLRE'],
  ['ai-semi', 'SMH'], ['defense', 'ITA'], ['quantum', 'QTUM'], ['power', 'GRID'], ['phys-ai', 'BOTZ'],
  ['ai-bio', 'TEM'],   // ETF 부재 — 대장주(앵커) 프록시 후보
]
for (const [k, sym] of PROXIES) {
  try {
    const r = await yf.chart(sym, { period1: new Date(Date.now() - 400 * 864e5), interval: '1d' })
    const q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0)
    const last = q[q.length - 1]
    console.log(`${k.padEnd(14)} ${sym.padEnd(5)} ${q.length}봉 · 최근 ${last ? (last.date instanceof Date ? last.date : new Date(last.date)).toISOString().slice(0, 10) : '—'} $${last?.close?.toFixed(2)}`)
  } catch (e) { console.log(`${k.padEnd(14)} ${sym.padEnd(5)} ❌ ${String(e).slice(0, 60)}`) }
}
