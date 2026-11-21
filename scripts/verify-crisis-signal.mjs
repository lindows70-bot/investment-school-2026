// 🔒 위기 신호등 불변식 — 학생 홈의 등 색이 선생님 화면의 판정과 같은가 · 값이 원천 재계산과 같은가 · 숫자마다 출처·날짜가 있는가 · 날짜가 낡지 않았는가
//
// 신호등은 다섯 화면의 판정을 '모아 옮긴' 것이라, 한쪽 규칙만 바뀌면 두 화면이 서로 다른 색을 말한다(제2원칙).
// 값이 그럴듯해 화면만 봐선 안 보인다 — 매일 원천(각 화면 응답 · FRED · 야후)과 대조한다. 설계 docs/crisis-signal/plan.md
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = 'https://investment-school-2026.vercel.app'
const UA = { 'User-Agent': 'Mozilla/5.0' }
const env = (() => { try { return readFileSync(`${ROOT}/.env.local`, 'utf8') } catch { return '' } })()
const FRED_KEY = env.match(/^FRED_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, '') ?? ''

let fail = 0
const check = (label, cond, why = '') => { if (cond) console.log(`✅ ${label}`); else { console.log(`❌ ${label}${why ? ` — ${why}` : ''}`); fail++ } }
const get = async (url, headers = {}) => { try { const r = await fetch(url, { headers, signal: AbortSignal.timeout(90_000) }); return r.ok ? await r.json() : null } catch { return null } }
const daysOld = ymd => Math.floor((Date.now() - Date.parse(`${ymd.length === 7 ? `${ymd}-01` : ymd}T00:00:00Z`)) / 86_400_000)

const sig = await get(`${APP}/api/crisis-signal`)
check('응답 — 등 7개 · 개수 합 = 7', Array.isArray(sig?.lights) && sig.lights.length === 7 && sig.total === 7 && Object.values(sig.counts ?? {}).reduce((s, n) => s + n, 0) === 7)
if (!sig?.lights) { console.log('\n❌ 응답이 없어 나머지 검사를 못 했습니다 (위기 신호등)'); process.exitCode = 1 }
else {
  const L = k => sig.lights.find(l => l.key === k)
  const measured = sig.lights.filter(l => l.color !== 'none')
  check(`못 가져온 등 0개(지금 ${7 - measured.length}개) · 마지막 성공분으로 버티는 중이 아님`, measured.length === 7 && !sig.stale, sig.lights.filter(l => l.color === 'none').map(l => l.name).join(' · ') + (sig.stale ? ' · stale' : ''))
  check('잰 등마다 출처·날짜·근거 숫자가 있다(이름표 없는 숫자 금지)', measured.every(l => l.source && l.date && l.rows.length > 0 && l.line), measured.filter(l => !(l.source && l.date && l.rows.length)).map(l => l.name).join(' · '))
  check('문장이 쌍점으로 끝나지 않는다', [sig.overall.line, ...sig.lights.map(l => l.line)].every(t => !/:\s*$/.test(t)))

  // ── 종합 색 = 화면에 적은 규칙 그대로(lib 상수를 원문에서 읽는다) ──
  const lib = readFileSync(`${ROOT}/src/lib/crisisSignal.ts`, 'utf8')
  const K = name => Number(lib.match(new RegExp(`export const ${name} = (\\d+)`))?.[1])
  const RED_MIN = K('OVERALL_RED_MIN'), YEL_MIN = K('OVERALL_YELLOW_MIN'), MIN_MEASURED = K('OVERALL_MIN_MEASURED'), FORCED = K('FORCED_SPIKE_PCTL')
  const c = sig.counts
  const want = measured.length < MIN_MEASURED ? 'none' : c.red >= RED_MIN ? 'red' : c.red >= 1 || c.yellow >= YEL_MIN ? 'yellow' : 'green'
  check(`종합 색 = 개수 규칙(빨강 ${c.red} · 노랑 ${c.yellow} · 초록 ${c.green} → ${want})`, sig.overall.color === want && [RED_MIN, YEL_MIN, MIN_MEASURED, FORCED].every(Number.isFinite), `화면 ${sig.overall.color}`)

  // ── 등 색 = 선생님 화면의 판정(같은 시각의 응답끼리 견준다 — 캐시가 엇갈리면 하루 안에 맞는다) ──
  const [yc, liq, radar, lev, mood] = await Promise.all(['yield-curve', 'us-liquidity', 'crisis-radar', 'leverage-radar', 'cocktail-party'].map(p => get(`${APP}/api/${p}`)))
  const curveWant = { none: 'green', watch: 'yellow', brief: 'yellow', red: 'red' }[yc?.alert]
  check(`금리차 등 = 수익률곡선 경보(${yc?.alert} → ${curveWant})`, !!curveWant && L('curve').color === curveWant, `신호등 ${L('curve').color}`)
  const hy = liq?.gauges?.find(g => g.key === 'hy')
  const hyWant = { good: 'green', warn: 'yellow', bad: 'red' }[hy?.tone]
  check(`기업 돈줄 등 = 미국 유동성 하이일드 판정(${hy?.tone} → ${hyWant}) · 값 ${hy?.value}`, !!hyWant && L('credit').color === hyWant && L('credit').rows[0]?.value === hy.value, `신호등 ${L('credit').color} ${L('credit').rows[0]?.value}`)
  check(`일자리 등 = 삼의 법칙(${yc?.sahm?.v} · 켜짐 ${yc?.sahm?.triggered})`, typeof yc?.sahm?.triggered === 'boolean' && L('jobs').color === (yc.sahm.triggered ? 'red' : 'green'))
  const valWant = { danger: 'red', caution: 'yellow', safe: 'green' }[radar?.alertLevel]
  check(`주식 값 등 = 위기 레이더(${radar?.alertLevel} → ${valWant})`, !!valWant && L('value').color === valWant, `신호등 ${L('value').color}`)
  const lv = lev?.current?.level, fp = lev?.misu?.current?.forcedPctPercentile
  const debtBase = { danger: 'red', caution: 'yellow', stable: 'green' }[lv]
  const debtWant = debtBase === 'green' && typeof fp === 'number' && fp >= FORCED ? 'yellow' : debtBase
  check(`빚 등 = 빚투 레이더(${lv}) + 반대매매 백분위 ${fp}(${FORCED}↑ 이면 초록→노랑) → ${debtWant}`, !!debtWant && L('debt').color === debtWant, `신호등 ${L('debt').color}`)
  const moodWant = mood?.source === 'cnn' ? { 'extreme fear': 'red', fear: 'yellow', neutral: 'green', greed: 'yellow', 'extreme greed': 'red' }[String(mood.rating).toLowerCase()] : 'none'
  check(`심리 등 = CNN 구간(${mood?.rating} → ${moodWant})`, !!moodWant && L('mood').color === moodWant, `신호등 ${L('mood').color}`)

  // ── 원천 독립 재계산 ①: 장단기 금리차(FRED) ──
  if (FRED_KEY) {
    const fred = async id => { const j = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=10`); const o = (j?.observations ?? []).find(x => x.value !== '.'); return o ? { v: Number(o.value), date: o.date } : null }
    const [f2, f3] = await Promise.all([fred('T10Y2Y'), fred('T10Y3M')])
    const row = label => Number(String(L('curve').rows.find(r => r.label === label)?.value ?? '').replace('−', '-').replace('%p', ''))
    // 화면은 최대 6시간 캐시 — FRED 가 그 사이 하루치를 더 올렸을 수 있어 0.15%p 까지는 같은 값으로 본다
    check(`금리차 값 = FRED(10년−2년 ${f2?.v} · 10년−3개월 ${f3?.v})`, !!f2 && !!f3 && Math.abs(row('10년 − 2년') - f2.v) <= 0.15 && Math.abs(row('10년 − 3개월') - f3.v) <= 0.15, `화면 ${row('10년 − 2년')} · ${row('10년 − 3개월')}`)
  } else check('FRED 키가 .env.local 에 있다(금리차 원천 재계산용)', false)

  // ── 원천 독립 재계산 ②: 설비투자 ÷ 번 돈(야후 분기 자료를 여기서 다시 합친다) ──
  const cx = L('capex')
  const tickers = Array.from(readFileSync(`${ROOT}/src/lib/capexCash.ts`, 'utf8').matchAll(/\{ ticker: '([A-Z]+)', name: '([^']+)' \}/g)).map(m => ({ ticker: m[1], name: m[2] }))
  const now = Math.floor(Date.now() / 1000), p1 = now - 3 * 365 * 86400
  const latest = await Promise.all(tickers.map(async t => {
    const j = await get(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${t.ticker}?type=quarterlyCapitalExpenditure,quarterlyOperatingCashFlow&period1=${p1}&period2=${now}`, UA)
    const pick = type => new Map((j?.timeseries?.result?.find(x => x.meta?.type?.[0] === type)?.[type] ?? []).map(o => [o.asOfDate, o.reportedValue?.raw]))
    const cap = pick('quarterlyCapitalExpenditure'), ocf = pick('quarterlyOperatingCashFlow')
    const d = Array.from(ocf.keys()).filter(k => cap.has(k)).sort().pop()
    return d ? { ...t, date: d, ocf: ocf.get(d), capex: Math.abs(cap.get(d)) } : null
  }))
  const got = latest.filter(Boolean)
  const newest = got.map(g => g.date).sort().pop()
  const kept = got.filter(g => (Date.parse(newest) - Date.parse(g.date)) / 86_400_000 <= 125)
  const ratio = kept.length ? kept.reduce((s, g) => s + g.capex, 0) / kept.reduce((s, g) => s + g.ocf, 0) * 100 : NaN
  const shown = Number(String(cx.rows[0]?.value ?? '').replace('%', ''))
  check(`설비투자 합계 = 야후 재계산(${kept.length}곳 · ${ratio.toFixed(1)}% · 분기 끝 ${newest})`, tickers.length >= 4 && kept.length >= tickers.length - 1 && Math.abs(shown - ratio) <= 1 && cx.date === newest, `화면 ${shown}% · ${cx.date}`)
  check(`설비투자 색 = 선(100% 초과 빨강 · 50% 초과 노랑)`, cx.color === (ratio > 100 ? 'red' : ratio > 50 ? 'yellow' : 'green'), `화면 ${cx.color}`)

  // ── 날짜가 낡지 않았는가(조용히 멈춘 원천) — 일별 10일 · 월별 75일 · 분기 150일 ──
  const LIMIT = { curve: 10, credit: 10, jobs: 75, value: 3, debt: 10, capex: 150, mood: 3 }
  const old = measured.filter(l => daysOld(l.date) > LIMIT[l.key]).map(l => `${l.name} ${l.date}(${daysOld(l.date)}일 전)`)
  check('등마다 날짜가 최근이다', old.length === 0, old.join(' · '))
}

console.log('')
if (fail) { console.log(`❌ ${fail}건 실패 (위기 신호등)`); process.exitCode = 1 }
else console.log('✅ 전부 통과 (위기 신호등)')
