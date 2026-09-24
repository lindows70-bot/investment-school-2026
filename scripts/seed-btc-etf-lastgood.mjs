// 🧊 btc-etf 마지막 성공분(btc-etf-flow-lastgood-v1) 1회 시드 — Farside 가 막힌 뒤 배포되는 코드는 스스로 시드를 못 만든다.
//    app_cache 에 남은 마지막 flow>0 일자 문서(2026-09-06 · 09-04까지)를 옮겨 적는다. 이미 더 최신 시드가 있으면 건너뛴다.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const KEY = 'btc-etf-flow-lastgood-v1'
const { data } = await db.from('app_cache').select('key, payload').like('key', 'btc-etf-v%').order('key', { ascending: false }).limit(60)
const good = (data ?? []).map(r => r.payload).filter(p => p?.flow?.length > 0).sort((a, b) => b.flow[b.flow.length - 1].date.localeCompare(a.flow[a.flow.length - 1].date))[0]
if (!good) { console.log('flow 가 있는 일자 문서가 없다'); process.exit(1) }
const flowAsOf = good.flow[good.flow.length - 1].date
const { data: cur } = await db.from('app_cache').select('payload').eq('key', KEY).maybeSingle()
if (cur?.payload?.flowAsOf >= flowAsOf) { console.log('이미 시드 있음', cur.payload.flowAsOf); process.exit(0) }
const seed = { flow: good.flow, flowCumulative: good.flowCumulative, issuers: good.issuers, issuerRecent: good.issuerRecent, issuerTotals: good.issuerTotals, flowAsOf }
const { error } = await db.from('app_cache').upsert({ key: KEY, payload: seed, updated_at: new Date().toISOString() })
console.log(error ? 'ERR ' + error.message : `시드 완료 flowAsOf=${flowAsOf} rows=${seed.flow.length} issuerRecent=${seed.issuerRecent.length}`)
