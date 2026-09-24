// 🔍 Phase 0 (3차) — 기존 etf-snap-v1 스냅샷의 IBIT totalAssets·nav 가 날마다 바뀌는지 + ΔAUM−시장등락 역산값(=현물 순유입 추정) 산출
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data } = await db.from('app_cache').select('key, payload').like('key', 'etf-snap-v1:%').order('key')
let prev = null
for (const r of data ?? []) {
  const p = r.payload; const x = p.etfs?.IBIT; const spy = p.etfs?.SPY
  if (!x) { console.log(p.day, 'IBIT -'); continue }
  let flow = ''
  if (prev) { const est = x.aum - prev.aum * (x.nav / prev.nav); flow = `→ 역산 순유입 ${(est / 1e6).toFixed(1)}M (ΔAUM ${((x.aum - prev.aum) / 1e6).toFixed(1)}M, NAV ${((x.nav / prev.nav - 1) * 100).toFixed(2)}%)` }
  console.log(p.day, 'at', p.at.slice(0, 16), 'IBIT aum', (x.aum / 1e9).toFixed(3) + 'B', 'nav', x.nav, 'px', x.price, flow, '| SPY aum', spy ? (spy.aum / 1e9).toFixed(1) + 'B' : '-')
  prev = x
}
