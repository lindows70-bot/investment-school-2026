// 🔍 잘못 기입된 거래의 실제 상태 확인 — 무엇이 오염됐고 어디까지 번졌나.
//    ⚠️ 개인 계좌 데이터다. 로컬 진단 전용이며 LLM 으로 보내지 않는다.
import { readFileSync } from 'node:fs'
const env = readFileSync('.env.local', 'utf8')
const URL_ = (env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m) || [])[1]?.trim()
const KEY = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) || [])[1]?.trim()
if (!URL_ || !KEY) { console.error('❌ env 없음'); process.exit(1) }

const q = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(25000),
  })
  if (!r.ok) { console.error('HTTP', r.status, await r.text()); return [] }
  return r.json()
}

// 사용자 식별
const profs = await q('profiles?select=id,email,full_name')
const me = profs.find(p => p.email === 'lindows70@gmail.com')
console.log(`대상: ${me?.full_name} (${me?.id?.slice(0, 8)}…)\n`)

// GOOGL 거래 전수
const tx = await q(`transactions?user_id=eq.${me.id}&ticker=ilike.GOOGL&select=*&order=transaction_date.asc,created_at.asc`)
console.log(`═══ GOOGL 거래 ${tx.length}건 ═══`)
for (const t of tx) {
  console.log(`  ${t.transaction_date} ${t.type.toUpperCase().padEnd(4)} ${String(t.quantity).padStart(8)}주 @ ${String(t.price).padStart(10)} · 총 ${String(t.total_amount ?? '—').padStart(12)}`
    + ` · 실현손익 ${t.realized_pnl != null ? String(t.realized_pnl).padStart(10) : '—'.padStart(10)}`
    + ` · 평단기준 ${t.avg_cost_basis ?? '—'} · memo ${t.memo ?? '—'} · id ${t.id}`)
}

// 현재 보유
const inv = await q(`investments?user_id=eq.${me.id}&ticker=ilike.GOOGL&select=*`)
console.log(`\n═══ 현재 보유 ═══`)
for (const i of inv) console.log(`  ${i.ticker} ${i.quantity}주 @ 평단 ${i.purchase_price} (${i.currency}) · id ${i.id}`)

// 거래 합산 vs 보유 대조(자동 복구 로직이 보는 값)
const buys = tx.filter(t => t.type === 'buy'), sells = tx.filter(t => t.type === 'sell')
const netQty = buys.reduce((s, t) => s + Number(t.quantity), 0) - sells.reduce((s, t) => s + Number(t.quantity), 0)
console.log(`\n  거래 합산 순수량 ${netQty} vs 보유 ${inv[0]?.quantity ?? 0} → ${Math.abs(netQty - (inv[0]?.quantity ?? 0)) < 0.001 ? '✅ 일치' : '⚠️ 불일치(자동 복구가 개입할 수 있음)'}`)

// 실현손익 오염 범위 — 전체 매도 건
const allSells = await q(`transactions?user_id=eq.${me.id}&type=eq.sell&select=ticker,transaction_date,quantity,price,realized_pnl,currency,memo&order=transaction_date.desc&limit=30`)
console.log(`\n═══ 전체 매도 이력(최근 30건) — 실현손익 집계에 들어가는 것들 ═══`)
let krwSum = 0, usdSum = 0
for (const s of allSells) {
  const p = Number(s.realized_pnl ?? 0)
  if (s.currency === 'KRW') krwSum += p; else usdSum += p
  console.log(`  ${s.transaction_date} ${s.ticker.padEnd(8)} ${String(s.quantity).padStart(7)}주 @ ${String(s.price).padStart(9)} · 실현 ${String(p).padStart(11)} ${s.currency}`)
}
console.log(`\n  실현손익 합계 — KRW ${krwSum.toLocaleString()} · USD ${usdSum.toFixed(2)}`)
