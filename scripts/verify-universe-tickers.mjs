// 🔒 손으로 적은 종목 목록의 생존 — 상장폐지·티커 변경된 종목이 목록에 남아 있지 않은가
//
// 2026-11-14 전수 조사: 952개 중 9개가 죽어 있었다(EA 8/04 · AVB 8/14 · SKYT 7/30 · QRVO 10/02 · WBD 10/05 · KVUE 10/30 상장폐지 ·
//   현대홈쇼핑·더존비즈온 상장폐지 · PSTG 는 사명 변경으로 티커 P). 배열로 적힌 목록에서도 HES·CTRA·EQR·SPLG(→SPYM)·오타 GOOGY(→GOOY).
// 죽은 티커는 화면에서 조용히 빠질 뿐이라(조회 실패 → 건너뜀) 아무도 모른다. 인수합병은 매달 일어난다 — 매일 원천과 대조한다.
// ⚠️ 못 잡는 것: 티커 재사용(PARA 는 파라마운트가 떠난 뒤 다른 회사가 쓰고 있었다 — 살아 있는 티커라 생존 검사로는 안 보인다).
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' }

// ① `{ ticker: 'X', … market: 'KR', … yahoo: 'X.T' }` 꼴 — 야후 심볼은 yahoo 필드 → 6자리(.KS/.KQ) → 그대로(점은 대시)
const ENTRY_FILES = ['lib/sectorConfigs.ts', 'lib/macroPhaseScreener.ts', 'lib/satelliteScreener.ts', 'lib/dividendUniverse.ts', 'lib/ultraDividendUniverse.ts', 'lib/quantumUniverse.ts', 'lib/quantBuilder.ts', 'lib/etfFlow.ts', 'lib/etfAlternative.ts', 'lib/coveredCall.ts', 'lib/ipoCycle.ts']
// ② 문자열 배열로 적힌 목록 — 파일과 '그 줄이 티커 목록'임을 알려주는 표식을 함께 적는다(통화·코인·거래소 코드 배열을 티커로 읽지 않게)
const ARRAY_FILES = [
  { file: 'app/actions/getSectorPeers.ts', lineHas: /^\s*'[^']+':\s*\[/ },                       // 업종명: [피어 티커…]
  { file: 'lib/dividendProfile.ts', lineHas: /new Set\(/ },                                    // 리츠·파생 ETF 집합(여러 줄)
  { file: 'lib/assetRoleRules.ts', lineHas: /_TICKERS/ },
]
// 해외 거래소 종목인데 yahoo 필드가 없는 목록(양자 유니버스 등)은 접미사를 모른다 — market 이 US·KR 이 아니면 yahoo 필드가 있을 때만 본다
const targets = new Map()   // 야후 심볼 후보 배열 → { label, files }
const add = (label, syms, file) => { const k = syms.join('|'); if (!targets.has(k)) targets.set(k, { label, syms, files: new Set() }); targets.get(k).files.add(file.split('/').pop()) }
// 야후 심볼: 클래스 주식(BRK.B → BRK-B)만 점을 대시로. 거래소 접미사(8035.T · SIE.DE · 0700.HK)는 그대로 둔다
const ySym = t => /^[A-Z]+\.[AB]$/.test(t) ? t.replace('.', '-') : t
let skippedForeign = 0
for (const f of ENTRY_FILES) {
  const src = readFileSync(`${ROOT}/src/${f}`, 'utf8')
  for (const m of src.matchAll(/\{\s*(?:ticker|t):\s*'([A-Z0-9.\-]{1,10})'([^}\n]*)\}/g)) {
    const t = m[1], rest = m[2]
    const yahoo = rest.match(/yahoo:\s*'([^']+)'/)?.[1]
    const market = rest.match(/market:\s*'([A-Z]{2})'/)?.[1]
    if (yahoo) add(t, [yahoo], f)
    else if (/^\d{6}$/.test(t)) add(t, [`${t}.KS`, `${t}.KQ`], f)
    else if (market && market !== 'US' && market !== 'KR') skippedForeign++
    else if (/^\d+$/.test(t)) skippedForeign++   // 숫자 코드인데 6자리가 아님 = 해외 거래소(접미사 모름)
    else add(t, [ySym(t)], f)
  }
}
for (const { file, lineHas } of ARRAY_FILES) {
  const lines = readFileSync(`${ROOT}/src/${file}`, 'utf8').split(/\r?\n/)
  let inSet = false
  for (const line of lines) {
    if (/^\s*(\/\/|\*)/.test(line)) continue
    const starts = lineHas.test(line) && /\[/.test(line)
    if (starts) inSet = true
    if (inSet) for (const t of line.replace(/^[^[]*\[/, starts ? '' : '$&').matchAll(/'([A-Z][A-Z0-9.]{0,5})'/g)) add(t[1], [ySym(t[1])], file)
    if (inSet && /\]/.test(line)) inSet = false
  }
}

const chart = async sym => {
  for (const h of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${h}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`, { headers: UA, signal: AbortSignal.timeout(12000) })
      if (r.status === 404) return { s: 404 }
      if (!r.ok) continue
      const res = (await r.json())?.chart?.result?.[0]
      const ts = res?.timestamp ?? []
      const n = (res?.indicators?.quote?.[0]?.close ?? []).filter(x => x > 0).length
      return { s: 200, n, last: ts.length ? new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) : null }
    } catch { /* 다음 host */ }
  }
  return { s: 'ERR' }
}
const STALE_DAYS = 10
const list = Array.from(targets.values())
const dead = [], errs = []
for (let i = 0; i < list.length; i += 12) {
  await Promise.all(list.slice(i, i + 12).map(async g => {
    let verdict = null
    for (const sym of g.syms) {
      const r = await chart(sym)
      if (r.s === 'ERR') { verdict = { err: true }; continue }
      if (r.s === 200 && r.n > 0 && r.last && (Date.now() - Date.parse(r.last)) / 864e5 <= STALE_DAYS) { verdict = { ok: true }; break }
      verdict = { why: r.s === 404 ? '원천에 없음' : !r.n ? '최근 1개월 거래 없음' : `마지막 거래 ${r.last}` }
    }
    if (verdict?.err) errs.push(g.label)
    else if (!verdict?.ok) dead.push(`${g.label}(${verdict?.why ?? '?'} · ${Array.from(g.files).join(',')})`)
  }))
}

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { console.log(`❌ ${label}${why ? ` — ${why}` : ''}`); fail++ } }
check(`목록 파싱 — 종목 ${list.length}개(해외 거래소 접미사 불명 ${skippedForeign}개는 제외)`, list.length > 800)
check(`원천 조회가 대부분 됐다(오류 ${errs.length}개 · 허용 ${Math.ceil(list.length * 0.05)}개)`, errs.length <= list.length * 0.05, errs.slice(0, 12).join(', '))
check(`죽은 티커 0개(최근 ${STALE_DAYS}일 안에 거래가 있다)`, dead.length === 0, dead.join(' · '))

console.log('')
if (fail) { console.log(`❌ ${fail}건 실패 (종목 목록 생존) — 상장폐지면 목록에서 빼고, 티커가 바뀌었으면 새 티커로`); process.exitCode = 1 }   // process.exit 은 윈도우에서 닫히는 중인 소켓과 부딪혀 충돌 코드를 남긴다
else console.log('✅ 전부 통과 (종목 목록 생존)')
