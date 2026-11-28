// 🔒 거장 13F 불변식 — 추적 목록(guruFunds)의 법인이 전부 불러와지는가 · 신고가 묵은 법인이 '알고 있는 곳'뿐인가 · 금액 단위가 맞는가 · 풋 · 콜이 보유에 섞이지 않았는가
//
// 2026-11-28 에 드러난 세 가지가 전부 '값이 그럴듯해서' 화면만 봐선 안 보였다:
//   ① 애크먼 — 신고 법인이 바뀌어(옛 법인은 통지만 제출) 앱이 두 분기 묵은 사진을 보여 주고 있었다
//   ② 드러켄밀러 — 금액을 천 달러로 적어 신고 총액이 1,000배 작게 나왔다
//   ③ 코언 — 풋 · 콜 줄이 '보유 종목'으로 섞여 있었다(금액의 30%)
// 그래서 매일 프로덕션 응답으로 대조한다. 묵은 법인이 **새로** 생기면(ended 표시가 없는데 stale) 빨강 — EDGAR 에서 통지(13F-NT)가 가리키는 새 법인을 찾아 CIK 를 바꾼다.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROD_HEADERS, PROD_AUTH_OK } from './prodAuth.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'https://investment-school-2026.vercel.app'
let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { console.log(`❌ ${label}${why ? ` — ${why}` : ''}`); fail++ } }

// 목록은 lib 원문에서 읽는다(표를 따로 베껴 두지 않는다)
const lib = readFileSync(`${ROOT}/src/lib/guruFunds.ts`, 'utf8')
const FUNDS = Array.from(lib.matchAll(/\{ cik: '(\d{10})', mgr: '([^']+)',\s*fund: '([^']+)'([^}]*)\}/g))
  .map(m => ({ cik: m[1], mgr: m[2], fund: m[3], broad: /broad: true/.test(m[4]), ended: /ended: true/.test(m[4]) }))
check(`lib 파싱 — 추적 ${FUNDS.length}명 · CIK 중복 없음`, FUNDS.length >= 14 && new Set(FUNDS.map(f => f.cik)).size === FUNDS.length)
check('프로덕션 호출 표식(CRON_SECRET)이 있다', PROD_AUTH_OK)

const getJson = async (path, tries = 2) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(APP + path, { headers: PROD_HEADERS, redirect: 'manual', signal: AbortSignal.timeout(75_000) })
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json()
    } catch { /* 한 번 더 */ }
  }
  return null
}
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null }

const got = []
for (const f of FUNDS) {
  const d = await getJson(`/api/guru-portfolio?cik=${f.cik}`)
  got.push({ f, d })
  const ok = d?.status === 'ok' && Array.isArray(d.positions)
  check(`${f.mgr}(${f.fund}) — 불러와진다`, ok, d?.message ?? '응답 없음')
  if (!ok) continue
  // 묵은 신고 — 알고 있는 곳(ended)만 묵어야 한다. 양쪽 다 본다
  check(`${f.mgr} — 신고 상태가 목록 표시와 같다(${d.reportDate} 분기말 · ${d.stale ? '묵음' : '최신'})`, d.stale === f.ended,
    d.stale ? '새로 묵었다 — EDGAR 에서 13F-NT 가 가리키는 보고 법인을 확인해 CIK 를 바꾸거나 ended 를 달 것' : '다시 신고를 냈다 — guruFunds 의 ended 표시를 지울 것')
  check(`${f.mgr} — 분산형 표시가 목록과 같다`, d.broad === f.broad)
  // 금액 단위 — 주당 금액 가운데 값이 3달러 아래면 천 달러 단위를 못 알아본 것 · 총액이 1억 달러도 안 되면 의심
  const per = d.positions.filter(p => p.shares > 0 && p.value > 0).map(p => p.value / p.shares)
  const med = median(per)
  check(`${f.mgr} — 금액이 달러 단위다(주당 가운데 값 ${med == null ? '—' : med.toFixed(0)}달러 · 주식 신고액 ${(d.total / 1e9).toFixed(2)}B)`, d.positions.length === 0 || (med != null && med >= 3 && d.total >= 5e7))
  // 비중 — 주식 신고액이 분모(옵션이 분모에 들어가면 합이 100을 크게 밑돈다) · 첫 줄 비중 = 금액 ÷ 총액
  const p0 = d.positions[0]
  if (p0) check(`${f.mgr} — 1위 비중 = 금액 ÷ 주식 신고액(${p0.pctPort}%)`, Math.abs(p0.pctPort - Math.round((p0.value / d.total) * 1000) / 10) <= 0.11)
  const sum = d.positions.reduce((s, p) => s + p.pctPort, 0)
  check(`${f.mgr} — 표에 실린 비중 합이 100%를 넘지 않는다(${sum.toFixed(1)}%)`, sum <= 100.6)
  // 옵션 — 줄 수가 있으면 목록도 있어야 하고, 방향이 적혀 있어야 한다
  check(`${f.mgr} — 옵션 ${d.optLines}줄 · 목록 ${d.options?.length ?? 0}개 · 방향 표기`, Array.isArray(d.options) && (d.optLines > 0) === (d.options.length > 0) && d.options.every(o => o.pc === 'put' || o.pc === 'call'))
  if (f.broad) check(`${f.mgr} — 수천 종목 운용사는 추정 수익을 계산하지 않는다`, d.positions.every(p => p.estReturn == null && p.estAvgPrice == null))
}

// 합의 종목 — 분산형 · 묵은 법인은 빠져 있어야 하고, 뺀 사실이 응답에 실려야 한다
const c = await getJson('/api/guru-consensus')
check('합의 종목 응답', c?.status === 'ok' && Array.isArray(c.stocks))
if (c?.status === 'ok') {
  const loaded = got.filter(g => g.d?.status === 'ok')
  const out = new Set(loaded.filter(g => g.d.stale || g.d.broad).map(g => g.f.mgr))
  const ex = new Set((c.excluded ?? []).map(e => e.mgr))
  check(`합의 종목 — 뺀 사람 = 분산형 + 묵은 법인(${[...ex].join(' · ') || '없음'})`, out.size === ex.size && [...out].every(m => ex.has(m)))
  check(`합의 종목 — 센 사람 수 ${c.trackedFunds} = 불러온 ${loaded.length} − 뺀 ${ex.size}`, c.trackedFunds === loaded.length - ex.size)
  check('합의 종목 — 뺀 사람이 겹침에 들어 있지 않다', c.stocks.every(s => s.holders.every(h => !ex.has(h.mgr))))
}

if (fail) { console.log(`\n❌ ${fail}건 실패`); process.exit(1) }
console.log('\n✅ 전부 통과 (거장 13F)')
