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
const N = 9   // 돈줄 3(금리차·기업 돈줄·일자리) + 거품 6(주식 값·야데니 모델·미국 빚·한국 빚·설비투자·심리)
check(`응답 — 등 ${N}개 · 개수 합 = ${N}`, Array.isArray(sig?.lights) && sig.lights.length === N && sig.total === N && Object.values(sig.counts ?? {}).reduce((s, n) => s + n, 0) === N)
if (!sig?.lights) { console.log('\n❌ 응답이 없어 나머지 검사를 못 했습니다 (위기 신호등)'); process.exitCode = 1 }
else {
  const L = k => sig.lights.find(l => l.key === k)
  const measured = sig.lights.filter(l => l.color !== 'none')
  check(`못 가져온 등 0개(지금 ${N - measured.length}개) · 마지막 성공분으로 버티는 중이 아님`, measured.length === N && !sig.stale, sig.lights.filter(l => l.color === 'none').map(l => l.name).join(' · ') + (sig.stale ? ' · stale' : ''))
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

  // ── 미국 빚: FINRA 페이지의 최근 13개월 표(앱은 이력 xlsx 를 읽는다 — 같은 원천의 다른 형식으로 대조) ──
  const us = L('usdebt')
  const page = await fetch('https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' }, signal: AbortSignal.timeout(30_000) }).then(r => r.ok ? r.text() : '').catch(() => '')
  const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Sept: '09', Oct: '10', Nov: '11', Dec: '12' }
  const fin = Array.from(page.matchAll(/<tr[^>]*>\s*<td[^>]*>\s*([A-Za-z]{3,4})-(\d{2})\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>/g))
    .map(m => ({ ym: `20${m[2]}-${MON[m[1]]}`, debit: Number(m[3].replace(/,/g, '')), free: Number(m[4].replace(/,/g, '')) + Number(m[5].replace(/,/g, '')) })).sort((a, b) => a.ym < b.ym ? -1 : 1)
  const f0 = fin[fin.length - 1]
  const jo = m => `$${(m / 1_000_000).toFixed(2)}조`
  check(`미국 빚 값 = FINRA 페이지(${f0?.ym} · ${f0?.debit?.toLocaleString('en-US')}백만 달러 · 비율 ${f0 ? Math.round(f0.debit / f0.free * 100) : '?'}%)`, /\(shown in \$ millions\)/.test(page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) && fin.length >= 12 && us.date === f0.ym && us.rows[0]?.value === jo(f0.debit) && us.rows[2]?.value === `${Math.round(f0.debit / f0.free * 100)}%`, `화면 ${us.date} · ${us.rows[0]?.value} · ${us.rows[2]?.value}`)
  const y1 = fin.find(x => x.ym === `${Number(f0?.ym.slice(0, 4)) - 1}${f0?.ym.slice(4)}`)
  const yoy = y1 ? (f0.debit / y1.debit - 1) * 100 : NaN
  check(`미국 빚 1년 전 대비 = FINRA 페이지 재계산(${yoy.toFixed(1)}%)`, Number.isFinite(yoy) && us.rows[0]?.note === `1년 전 같은 달보다 ${yoy > 0 ? '+' : yoy < 0 ? '−' : ''}${Math.abs(yoy).toFixed(1)}%`, `화면 ${us.rows[0]?.note}`)
  // 색 = 화면에 적힌 두 자리(비율·잔고 백분위)에 lib 규칙을 댄 결과 — 규칙 숫자는 lib 원문에서 읽는다
  const lvSrc = readFileSync(`${ROOT}/src/lib/leverageLevel.ts`, 'utf8')
  const LVK = name => Number(lvSrc.match(new RegExp(`export const ${name} = (\\d+)`))?.[1])
  const [rp, mp] = [/아래에서 (\d+)% 자리/.exec(us.rows[2]?.note ?? '')?.[1], /빌린 돈 자체는 (\d+)% 자리/.exec(us.rows[2]?.note ?? '')?.[1]].map(Number)
  const usWant = rp >= LVK('LEV_DANGER_PCTL') || (rp >= LVK('LEV_COMBO_RATIO_PCTL') && mp >= LVK('LEV_COMBO_MARGIN_PCTL')) ? 'red' : rp >= LVK('LEV_CAUTION_PCTL') ? 'yellow' : 'green'
  check(`미국 빚 등 = 빚 판정 규칙(비율 ${rp}% 자리 · 잔고 ${mp}% 자리 → ${usWant})`, Number.isFinite(rp) && Number.isFinite(mp) && us.color === usWant, `신호등 ${us.color}`)

  // ── 야데니 모델: 같은 화면 위기 레이더의 선행 PER · FRED DGS10 으로 다시 계산 ──
  const yd = L('yardeni')
  const peM = radar?.metrics?.find(m => m.key === 'pe' && /선행/.test(m.label ?? ''))
  if (FRED_KEY) {
    const dj = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=10`)
    const d10 = (dj?.observations ?? []).find(x => x.value !== '.')
    const ey = peM ? 100 / peM.value : NaN, y10 = Number(d10?.value)
    const shownEy = Number(String(yd.rows[0]?.value ?? '').replace('%', '')), shownY = Number(String(yd.rows[1]?.value ?? '').replace('%', ''))
    // 화면은 최대 1시간 캐시 — 그 사이 FRED 가 하루치를 더 올렸을 수 있어 금리는 0.15%p 까지 같은 값으로 본다
    check(`야데니 모델 = 위기 레이더 선행 PER ${peM?.value}배 · FRED 10년 ${y10}%(${d10?.date}) → 예상이익 수익률 ${ey.toFixed(2)}%`, Number.isFinite(ey) && Math.abs(shownEy - ey) <= 0.01 && Math.abs(shownY - y10) <= 0.15, `화면 ${shownEy}% · ${shownY}%`)
    check(`야데니 색 = 정의 그대로(예상이익 수익률 ≥ 금리 → 초록)`, yd.color === (shownEy >= shownY ? 'green' : 'red'), `화면 ${yd.color}`)
  }

  // ── VIX 차트: FRED 최신 종가와 같은가 · 자리 비율을 응답의 차트 자료로 다시 세면 같은가(1990년부터 하루 종가 전부를 다시 받아 센다) ──
  const vx = sig.vix
  check('VIX 차트 자료가 응답에 있다(1년·5년·1990년부터)', !!vx && ['1Y', '5Y', 'ALL'].every(k => Array.isArray(vx.series?.[k]) && vx.series[k].length > 50) && vx.since <= '1990-12-31')
  if (vx && FRED_KEY) {
    const vj = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${FRED_KEY}&file_type=json&observation_start=1990-01-01`)
    const obs = (vj?.observations ?? []).filter(x => x.value !== '.').map(x => ({ date: x.date, v: Number(x.value) }))
    const all = vx.last.date > (obs[obs.length - 1]?.date ?? '') ? [...obs, vx.last] : obs
    const cur = all.find(x => x.date === vx.last.date)
    const pct = cur ? Math.round(all.filter(x => x.v >= cur.v).length / all.length * 1000) / 10 : NaN
    // 화면은 최대 6시간 캐시 — 그 사이 하루치가 늘었을 수 있어 비율은 0.3%p · 개수는 3일까지 같은 값으로 본다
    check(`VIX 지금 ${vx.last.v}(${vx.last.date}) · 높았던 날 ${vx.higherPct}% = FRED 재계산 ${pct}% · 하루 종가 ${vx.days}일 = ${all.length}일`, Number.isFinite(pct) && Math.abs(vx.higherPct - pct) <= 0.3 && Math.abs(vx.days - all.length) <= 3, `FRED 마지막 ${obs[obs.length - 1]?.date} ${obs[obs.length - 1]?.v}`)
    const fredSame = obs.find(x => x.date === vx.last.date)
    check('VIX 마지막 값 = FRED 같은 날 값(FRED 가 아직 없으면 야후 이어붙임이라 건너뜀)', !fredSame || Math.abs(fredSame.v - vx.last.v) <= 0.05, `FRED ${fredSame?.v}`)
    const vixRow = L('mood').rows.find(r => r.label.startsWith('VIX'))
    check('심리 등의 VIX = 차트 마지막 값(한 화면에 두 숫자 없음)', vixRow?.value === vx.last.v.toFixed(2), `심리 줄 ${vixRow?.value}`)
  }

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

  // ── 날짜가 낡지 않았는가(조용히 멈춘 원천) — 일별 10일 · 월별 75~95일 · 분기 150일 ──
  const LIMIT = { curve: 10, credit: 10, jobs: 75, value: 3, yardeni: 10, usdebt: 95, debt: 10, capex: 150, mood: 3 }   // 미국 빚 = 월 통계(다음 달 셋째 주 발표)
  const old = measured.filter(l => daysOld(l.date) > LIMIT[l.key]).map(l => `${l.name} ${l.date}(${daysOld(l.date)}일 전)`)
  check('등마다 날짜가 최근이다', old.length === 0, old.join(' · '))
}

console.log('')
if (fail) { console.log(`❌ ${fail}건 실패 (위기 신호등)`); process.exitCode = 1 }
else console.log('✅ 전부 통과 (위기 신호등)')
