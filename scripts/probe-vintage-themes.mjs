// 🔬 "그 시절의 미래 섹터" 실측 — 2021~22년에 시장이 '계속 치고 올라갈 섹터'라 믿었던 테마 바스켓을
//    로테이션 시뮬과 같은 시작점(2022-06-28)부터 들고 있었으면 어땠나. 선별 편향의 실물 대조군.
//    ARKK = 2021년의 'AI격' 혁신 테마 · KODEX 2차전지 = 2022~23 한국의 대세 테마 · 메타버스 = 2021 대세
import { createRequire } from 'module'
const require2 = createRequire(import.meta.url)
const YF = require2('yahoo-finance2').default
const yf = new YF({ suppressNotices: ['yahooSurvey'] })

const START = '2022-06-28'
const ROWS = [
  ['ARKK', 'ARK 혁신 ETF — 2021년의 "미래 섹터" 대표'],
  ['QQQ', '나스닥100(시총가중) — 광역 기준선'],
  ['SPY', 'S&P500 — 시장 기준선'],
  ['305720.KS', 'KODEX 2차전지산업 — 2022~23 한국 대세 테마'],
  ['401470.KS', 'KODEX K-메타버스액티브 — 2021 대세 테마'],
  ['^KS11', 'KOSPI — KR 기준선'],
]
console.log(`시작점 ${START} (로테이션 시뮬과 동일) → 현재\n`)
for (const [sym, label] of ROWS) {
  try {
    const r = await yf.chart(sym, { period1: START, interval: '1d' })
    const q = (r?.quotes ?? []).filter(x => typeof x.close === 'number' && x.close > 0)
    if (q.length < 100) { console.log(`${sym.padEnd(11)} 데이터 부족`); continue }
    const ret = (q[q.length - 1].close / q[0].close - 1) * 100
    let peak = 0, mdd = 0
    for (const x of q) { if (x.close > peak) peak = x.close; mdd = Math.max(mdd, 1 - x.close / peak) }
    console.log(`${sym.padEnd(11)} ${(ret >= 0 ? '+' : '')}${ret.toFixed(0).padStart(4)}% · 최대낙폭 −${(mdd * 100).toFixed(0)}%  ${label}`)
  } catch { console.log(`${sym.padEnd(11)} 조회 실패`) }
}
