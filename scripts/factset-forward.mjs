// FactSet 선행 PER 로컬 러너 — 주간 Earnings Insight PDF에서 S&P500 선행 12개월 PER 실측 → Supabase app_cache 적재.
// ⚠️ Vercel은 FactSet CDN이 데이터센터 IP를 차단(추정)해 서버서 직접 불가 → 선생님 PC에서 주 1회 실행(KRX 러너와 동일 패턴).
// 실행: node scripts/factset-forward.mjs  (pdf-parse 필요 — 이미 설치됨)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  if (line.includes('=') && !line.startsWith('#')) { const i = line.indexOf('='); env[line.slice(0, i).trim()] = line.slice(i + 1).trim() }
}
const SUPA = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SVC = env.SUPABASE_SERVICE_ROLE_KEY

function recentFridays(n) {
  const out = []; const d = new Date()
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1)
  for (let i = 0; i < n; i++) {
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0'), dd = String(d.getUTCDate()).padStart(2, '0'), yy = String(d.getUTCFullYear()).slice(2)
    out.push({ code: `${mm}${dd}${yy}`, ymd: `${d.getUTCFullYear()}-${mm}-${dd}` })
    d.setUTCDate(d.getUTCDate() - 7)
  }
  return out
}

async function main() {
  const { PDFParse } = await import('pdf-parse')
  let result = null
  for (const f of recentFridays(6)) {
    const url = `https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_${f.code}.pdf`
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok) { console.log(f.code, 'http', r.status); continue }
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length < 100000) continue
      const t = (await new PDFParse({ data: buf }).getText()).text
      const fwd = t.match(/forward 12-month P\/E ratio for the S&P 500 is\s+([0-9]+\.[0-9]+)/i)
      if (!fwd) { console.log(f.code, '선행PER 문장 없음'); continue }
      const a5 = t.match(/5-year average(?:\s*of)?\s*\(?([0-9]+\.[0-9]+)/i)
      const a10 = t.match(/10-year average(?:\s*of)?\s*\(?([0-9]+\.[0-9]+)/i)
      const tr = t.match(/trailing 12-month P\/E ratio is\s+([0-9]+\.?[0-9]*)/i)
      result = { fwd: parseFloat(fwd[1]), avg5: a5 ? parseFloat(a5[1]) : null, avg10: a10 ? parseFloat(a10[1]) : null, trailing: tr ? parseFloat(tr[1]) : null, date: f.ymd, asOf: new Date().toISOString() }
      console.log('✅ 파싱:', f.ymd, JSON.stringify(result))
      break
    } catch (e) { console.log(f.code, 'ERR', String(e).slice(0, 60)) }
  }
  if (!result) { console.error('선행 PER 파싱 실패(모든 최근 금요일)'); process.exit(1) }

  const res = await fetch(`${SUPA}/rest/v1/app_cache?on_conflict=key`, {
    method: 'POST',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key: 'factset-forward-pe', payload: result, updated_at: new Date().toISOString() }]),
  })
  console.log(res.ok ? '✅ Supabase 적재 완료' : `적재 실패 ${res.status} ${await res.text()}`)
}
main()
