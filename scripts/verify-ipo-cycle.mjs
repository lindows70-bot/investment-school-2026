// 🔒 IPO 하이프 사이클 불변식 — 상장일이 야후 첫 거래일과 같은가 · 화면값이 원천 재계산과 같은가 · 가격이 최근 것인가 · 상장 대기 목록에 새 상장이 생겼는가
//
// 2026-11-14 검증에서 나온 것: 인튜이티브머신 상장일이 1년 틀려 있었고(2024-02-09 → 2023-02-14), 목록이 20종에 고정돼 2026년 대형 상장이 빠져 있었다.
// 둘 다 값이 그럴듯해 화면만 봐선 안 보인다 — 상장일은 원천과, 목록은 상장 대기 감시와 매일 대조한다.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'https://investment-school-2026.vercel.app'
const UA = { 'User-Agent': 'Mozilla/5.0' }
const lib = readFileSync(`${ROOT}/src/lib/ipoCycle.ts`, 'utf8')

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { console.log(`❌ ${label}${why ? ` — ${why}` : ''}`); fail++ } }
const day = ts => new Date(ts * 1000).toISOString().slice(0, 10)

// ── 목록·대기 목록·국면 구간을 lib 원문에서 읽는다(표를 따로 베껴 두지 않는다) ──
const UNI = Array.from(lib.matchAll(/\{ ticker: '([A-Z]+)', name: '([^']+)', ipo: '(\d{4}-\d\d-\d\d)'(, spac: true)? \}/g)).map(m => ({ ticker: m[1], name: m[2], ipo: m[3], spac: !!m[4] }))
const WATCH = Array.from(lib.matchAll(/\{ q: '([^']+)', name: '([^']+)', match: \/(.+?)\/i, since: '(\d{4}-\d\d-\d\d)' \}/g)).map(m => ({ q: m[1], name: m[2], match: new RegExp(m[3], 'i'), since: m[4] }))
const bandSrc = lib.match(/PHASE_BAND[^=]*=\s*\{([^}]+)\}/)?.[1] ?? ''
const BAND = Object.fromEntries(Array.from(bandSrc.matchAll(/(\w+): \[(\d+), (\d+)\]/g)).map(m => [m[1], [Number(m[2]), Number(m[3])]]))
check(`lib 파싱 — 목록 ${UNI.length}종 · 상장 대기 ${WATCH.length}곳 · 국면 구간 ${Object.keys(BAND).length}개`, UNI.length >= 20 && WATCH.length >= 1 && Object.keys(BAND).length === 6)
check('목록에 중복 티커 없음', new Set(UNI.map(u => u.ticker)).size === UNI.length)

const yfDaily = async (t, p1, p2) => {
  for (const h of ['query1', 'query2']) {
    try {
      const r = await fetch(`https://${h}.finance.yahoo.com/v8/finance/chart/${t}?period1=${p1}&period2=${p2}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(15000) })
      if (!r.ok) continue
      const res = (await r.json())?.chart?.result?.[0]
      const ts = res?.timestamp ?? [], cl = res?.indicators?.quote?.[0]?.close ?? []
      return { first: res?.meta?.firstTradeDate ?? null, rows: ts.map((x, i) => ({ ts: x, c: cl[i] })).filter(x => x.c > 0) }
    } catch { /* 다음 host */ }
  }
  return { first: null, rows: [] }
}

// ── ① 상장일 = 원천의 첫 거래일 · 원천 재계산 ──
const now = Math.floor(Date.now() / 1000)
const re = new Map()
for (let i = 0; i < UNI.length; i += 6) {
  await Promise.all(UNI.slice(i, i + 6).map(async u => {
    const ipoTs = Date.parse(u.ipo) / 1000
    const { first, rows } = await yfDaily(u.ticker, ipoTs - 3 * 86400, now)
    const a = rows.filter(x => x.ts >= ipoTs)
    if (!a.length) { re.set(u.ticker, null); return }
    const c = a.map(x => x.c), peak = Math.max(...c)
    re.set(u.ticker, { first, firstBar: day(a[0].ts), lastBar: day(a[a.length - 1].ts), ipoP: c[0], peak, trough: Math.min(...c.slice(c.indexOf(peak))), cur: c[c.length - 1] })
  }))
}
const noData = UNI.filter(u => !re.get(u.ticker)).map(u => u.ticker)
check('목록 전 종목의 일봉을 원천에서 받았다', noData.length === 0, `못 받음: ${noData.join(', ')}`)
const badBar = UNI.filter(u => re.get(u.ticker) && re.get(u.ticker).firstBar !== u.ipo).map(u => `${u.ticker}(목록 ${u.ipo} · 원천 첫 봉 ${re.get(u.ticker).firstBar})`)
check('상장일에 원천 봉이 있다(기준가가 정말 그날 종가다)', badBar.length === 0, badBar.join(' · '))
// 스팩이 아니면 '그 티커의 첫 거래일'이 곧 상장일이다 — 1년 틀린 상장일(LUNR)이 여기서 잡힌다
const badFirst = UNI.filter(u => !u.spac && re.get(u.ticker)?.first != null && day(re.get(u.ticker).first) !== u.ipo).map(u => `${u.ticker}(목록 ${u.ipo} · 원천 첫 거래 ${day(re.get(u.ticker).first)})`)
check('스팩이 아닌 종목은 상장일 = 원천 첫 거래일', badFirst.length === 0, badFirst.join(' · '))
const badSpac = UNI.filter(u => u.spac && re.get(u.ticker)?.first != null && re.get(u.ticker).first >= Date.parse(u.ipo) / 1000 - 86400).map(u => u.ticker)
check('spac 표시가 붙은 종목은 실제로 상장일 전 이력이 있다(표시가 낡지 않았다)', badSpac.length === 0, badSpac.join(', '))

// ── ② 프로덕션 화면값 ──
const app = await (await fetch(`${APP}/api/ipo-cycle`, { headers: UA, signal: AbortSignal.timeout(60000), cache: 'no-store' })).json()
const byT = new Map((app.stocks ?? []).map(s => [s.ticker, s]))
const missing = UNI.filter(u => !byT.has(u.ticker)).map(u => u.ticker)
check(`프로덕션에 목록 전 종목이 있다(${app.stocks?.length ?? 0}종)`, missing.length === 0, `빠짐: ${missing.join(', ')}`)
const age = app.priceDate ? (Date.now() - Date.parse(`${app.priceDate}T21:00:00Z`)) / 86_400_000 : null
check(`가격 기준일이 최근이다(${app.priceDate} · ${age == null ? '?' : age.toFixed(1)}일 전 · 허용 5일)`, age != null && age < 5)
const near = (x, y, tol) => Math.abs(x - y) <= Math.max(0.011, Math.abs(y) * tol)
const diffs = []
for (const u of UNI) {
  const s = byT.get(u.ticker), r = re.get(u.ticker)
  if (!s || !r) continue
  if (s.ipoBarDate !== u.ipo) diffs.push(`${u.ticker} 기준가 봉 ${s.ipoBarDate} ≠ 상장일 ${u.ipo}`)
  if (!near(s.ipoPrice, r.ipoP, 0)) diffs.push(`${u.ticker} 첫날 종가 앱 ${s.ipoPrice} vs 원천 ${r.ipoP.toFixed(2)}`)
  // 고점·저점·현재가는 캐시(12시간)와 지금 원천 사이에 봉이 하나 더 생기거나 장중 값이 움직일 수 있다 — 같은 마지막 봉일 때만, 3% 안에서 본다
  if (s.lastBar === r.lastBar) {
    if (!near(s.current, r.cur, 0.03)) diffs.push(`${u.ticker} 현재 앱 ${s.current} vs 원천 ${r.cur.toFixed(2)}`)
    if (!near(s.peak, r.peak, 0.03)) diffs.push(`${u.ticker} 고점 앱 ${s.peak} vs 원천 ${r.peak.toFixed(2)}`)
    if (!near(s.trough, r.trough, 0.03)) diffs.push(`${u.ticker} 저점 앱 ${s.trough} vs 원천 ${r.trough.toFixed(2)}`)
  }
}
check('화면값 = 원천 재계산(첫날 종가는 정확히 · 고점·저점·현재가는 같은 봉에서 3% 안)', diffs.length === 0, diffs.slice(0, 6).join(' · '))
const offBand = (app.stocks ?? []).filter(s => !BAND[s.phase] || s.curveX < BAND[s.phase][0] - 0.01 || s.curveX > BAND[s.phase][1] + 0.01).map(s => `${s.ticker}(${s.phase} ${s.curveX})`)
check('곡선 위치가 그 국면 구간 안에 있다', offBand.length === 0, offBand.join(' · '))
const hypeBad = (app.stocks ?? []).filter(s => s.phase === 'hype' && !(s.months <= 5 && s.ddFromPeak > -20)).map(s => s.ticker)
check('광기 국면 = 상장 5개월 안 + 고점 대비 −20% 이내(카드 숫자와 곡선 위치가 모순되지 않는다)', hypeBad.length === 0, hypeBad.join(', '))
// 🕰️ 상장 9개월 전은 매집이 아니다(사용자 결정 2026-11-14) — 임계값은 lib 에서 읽는다
const SMART_MIN = Number(lib.match(/export const SMART_MIN_MONTHS = (\d+)/)?.[1])
const smartEarly = (app.stocks ?? []).filter(s => s.phase === 'smart' && s.months < SMART_MIN).map(s => `${s.ticker}(${s.months}개월)`)
check(`매집 국면 = 상장 ${SMART_MIN}개월 이상(그 전의 반등은 자각)`, Number.isFinite(SMART_MIN) && smartEarly.length === 0, smartEarly.join(', '))

// ── ③ 상장 대기 목록 — 새 상장이 생겼으면 정식 등록하라고 알린다(자동 편입은 라우트가 이미 한다) ──
const US = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE'])
const listed = []
for (const w of WATCH) {
  try {
    const j = await (await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(w.q)}&quotesCount=8&newsCount=0`, { headers: UA, signal: AbortSignal.timeout(12000) })).json()
    const hit = (j.quotes ?? []).find(x => x.quoteType === 'EQUITY' && US.has(x.exchange) && /^[A-Z]{1,5}$/.test(x.symbol ?? '') && w.match.test(`${x.shortname ?? ''} ${x.longname ?? ''}`))
    if (hit && !UNI.some(u => u.ticker === hit.symbol)) listed.push(`${w.name} → ${hit.symbol}(${hit.exchange})`)
  } catch { /* 검색 실패는 판정하지 않는다 */ }
}
const autos = (app.stocks ?? []).filter(s => s.auto).map(s => `${s.name} ${s.ticker}(상장 ${s.ipo})`)
check(`상장 대기 ${WATCH.length}곳(${WATCH.map(w => w.name).join('·')}) 중 새로 상장한 곳 없음 — 생기면 IPO_UNIVERSE 에 정식 등록`, listed.length === 0 && autos.length === 0, [...listed, ...autos].join(' · '))

console.log('')
if (fail) { console.log(`❌ ${fail}건 실패 (IPO 하이프 사이클)`); process.exitCode = 1 }
else console.log('✅ 전부 통과 (IPO 하이프 사이클)')
