// 🔍 자산 순위표 감사 — 화면값을 원천에서 독립 재계산한다.
//   ⚠️ 의심 지점: 사우디 아람코가 $6.39조로 엔비디아(5.20조)보다 크게 나왔다.
//      아람코는 **사우디 리얄(SAR)** 로 거래된다 — Yahoo marketCap 이 현지통화로 오면 4배 부풀려진다.
//      (CLAUDE.md 반복 함정: "해외 상장은 재무가 현지통화, 주가·시총은 USD" — 실제로는 시총도 현지통화일 수 있다)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const SYMS = ['NVDA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'META', '2222.SR']
console.log('심볼        통화   주가        marketCap(원값)      → USD 환산        발행주식수')
const fx = {}
for (const s of SYMS) {
  try {
    const q = await yf.quoteSummary(s, { modules: ['price', 'defaultKeyStatistics', 'summaryDetail'] })
    const pr = q?.price ?? {}, ks = q?.defaultKeyStatistics ?? {}
    const raw = (v) => v != null && typeof v === 'object' && 'raw' in v ? v.raw : v
    const cur = String(pr.currency ?? '?')
    const cap = Number(raw(pr.marketCap))
    const px = Number(raw(pr.regularMarketPrice))
    const sh = Number(raw(ks.sharesOutstanding))
    // 환율 조회(현지통화 → USD)
    let rate = 1
    if (cur !== 'USD') {
      if (!fx[cur]) {
        const r = await yf.quoteSummary(`${cur}USD=X`, { modules: ['price'] }).catch(() => null)
        fx[cur] = Number(raw(r?.price?.regularMarketPrice)) || null
      }
      rate = fx[cur] ?? NaN
    }
    const usd = cap * rate
    console.log(`${s.padEnd(10)} ${cur.padEnd(5)} ${String(px).padStart(9)}  ${(cap / 1e12).toFixed(3).padStart(8)}조 ${cur}   ${(usd / 1e12).toFixed(3).padStart(8)}조 USD   ${sh ? (sh / 1e9).toFixed(2) + 'B' : '—'}`)
    if (cur !== 'USD') {
      console.log(`   ⚠️  ${s} 는 ${cur} 표시! 환율 ${rate} · 화면이 환산 없이 쓰면 ${(cap / usd).toFixed(2)}배 부풀려진다`)
    }
  } catch (e) { console.log(`${s.padEnd(10)} ❌ ${e.message.slice(0, 60)}`) }
}

// 금·은 교차 검증 — GC=F 가격이 실제 금값인가(다른 심볼과 대조)
console.log('\n═══ 금·은 가격 교차 검증 ═══')
for (const s of ['GC=F', 'GLD', 'IAU', 'SI=F', 'SLV']) {
  try {
    const q = await yf.quoteSummary(s, { modules: ['price'] })
    const raw = (v) => v != null && typeof v === 'object' && 'raw' in v ? v.raw : v
    console.log(`  ${s.padEnd(7)} ${String(raw(q?.price?.regularMarketPrice)).padStart(10)} ${q?.price?.currency ?? ''}  (${q?.price?.shortName ?? ''})`)
  } catch (e) { console.log(`  ${s.padEnd(7)} ❌`) }
}
console.log('  → GLD 는 금 1온스의 약 1/10 을 담는다. GLD×10 ≈ 금 현물가여야 정상')

// 프로덕션 화면값과 대조
console.log('\n═══ 프로덕션 화면값 대조 ═══')
const ar = await fetch('https://investment-school-2026.vercel.app/api/asset-ranking', { signal: AbortSignal.timeout(60000) }).then(r => r.ok ? r.json() : null)
if (ar) for (const a of ar.assets) console.log(`  ${String(ar.assets.indexOf(a) + 1).padStart(2)}. ${a.name.padEnd(14)} $${(a.cap / 1e12).toFixed(2).padStart(6)}조  · ${a.note.slice(0, 60)}`)
