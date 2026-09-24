// 🔍 Phase 0 (2차) — yahoo-finance2(앱과 같은 라이브러리·크럼 자동)로 현물 BTC ETF 10종의 totalAssets·navPrice 가 오는지,
//    그리고 etf-snap-v1 스냅샷 기록으로 totalAssets 가 **매일** 바뀌는지(주간 갱신이면 일별 순유입 역산 불가)
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const SPOT = ['IBIT', 'FBTC', 'BITB', 'ARKB', 'BTCO', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC', 'BTC']
for (const t of SPOT) {
  try {
    const s = await yf.quoteSummary(t, { modules: ['summaryDetail', 'price', 'defaultKeyStatistics'] })
    console.log(t, 'totalAssets', s.summaryDetail?.totalAssets, 'nav', s.summaryDetail?.navPrice, 'price', s.price?.regularMarketPrice, 'sharesOut', s.defaultKeyStatistics?.sharesOutstanding, 'navDate?', s.price?.regularMarketTime)
  } catch (e) { console.log(t, 'ERR', e.message.slice(0, 80)) }
}
// 기존 40종 스냅샷에서 totalAssets 일별 변화 실측 — SPY·QQQ 가 매일 바뀌면 Yahoo totalAssets 는 일별 갱신
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await db.from('app_cache').select('key, payload').like('key', 'etf-snap-v1:%').order('key')
for (const r of data ?? []) {
  const p = r.payload || {}
  const pick = (t) => { const x = p.items?.[t] ?? p[t]; return x ? `${t} aum=${x.aum ?? x.totalAssets} nav=${x.nav ?? x.navPrice}` : `${t} -` }
  console.log(r.key, Object.keys(p).slice(0, 4).join(','), pick('SPY'), pick('QQQ'))
}
