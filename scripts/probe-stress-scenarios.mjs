// Phase 0 실측 — StressTest 3종을 실제 지수 월봉으로 재산출한다(Mock 배열 대체)
// core = TLT(미 장기국채 ETF) · satellite = QQQ(성장주) — 기존 주석의 자산 정의를 그대로 따른다
import { createRequire } from 'module'
const req = createRequire('C:/Users/lindo/investment-school-portfolio/package.json')
const YF = req('yahoo-finance2').default, yf = new YF({ suppressNotices:['yahooSurvey'] })
const WINDOWS = {
  '2008': ['2008-08-25','2009-10-05'],
  '2020': ['2020-01-25','2021-03-05'],
  '2022': ['2021-12-25','2023-02-05'],
}
for (const [k,[a,b]] of Object.entries(WINDOWS)) {
  const out = {}
  for (const [role,tk] of [['core','TLT'],['satellite','QQQ']]) {
    const r = await yf.chart(tk, { period1:new Date(a), period2:new Date(b), interval:'1mo' })
    const q = (r?.quotes??[]).filter(x=>typeof x.close==='number'&&x.close>0)
    const base = q[0].close
    out[role] = { ticker:tk, months:q.map(x=>x.date.toISOString().slice(2,7).replace('-','.')),
      idx:q.map(x=>Math.round(x.close/base*100)/100), raw:q.map(x=>Math.round(x.close*100)/100) }
  }
  console.log(`\n■ ${k}  (core=${out.core.ticker} · satellite=${out.satellite.ticker})`)
  console.log(`  months    ${JSON.stringify(out.core.months)}`)
  console.log(`  core      ${JSON.stringify(out.core.idx)}`)
  console.log(`  satellite ${JSON.stringify(out.satellite.idx)}`)
  const mdd = a => { let p=-Infinity,m=0; for(const v of a){ if(v>p)p=v; m=Math.min(m, v/p-1) } return Math.round(m*1000)/10 }
  console.log(`  core MDD ${mdd(out.core.idx)}% · 최종 ${Math.round((out.core.idx.at(-1)-1)*1000)/10}%`)
  console.log(`  sat  MDD ${mdd(out.satellite.idx)}% · 최종 ${Math.round((out.satellite.idx.at(-1)-1)*1000)/10}%`)
}
