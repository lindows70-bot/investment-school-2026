// 🕒 R-ONE 테이블별 '발표 지연' 실측 — TYPICAL_LAG 을 짐작으로 채우지 않기 위한 probe(1회성)
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(l => /^\s*[A-Z_]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const KEY = env.R_ONE_API_KEY
if (!KEY) { console.error('R_ONE_API_KEY 없음'); process.exit(1) }

async function latestMonth(tbl, cls, itm) {
  const u = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${KEY}&Type=json&pIndex=1&pSize=300`
    + `&STATBL_ID=${tbl}&DTACYCLE_CD=MM&CLS_ID=${cls}&START_WRTTIME=202401&END_WRTTIME=202612`
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const j = await r.json()
  let rows = j?.SttsApiTblData?.[1]?.row ?? []
  if (itm) rows = rows.filter(x => String(x.ITM_ID) === itm)
  const times = rows.map(x => String(x.WRTTIME_IDTFR_ID)).sort()
  return { last: times[times.length - 1] ?? null, n: times.length }
}

const now = new Date()
const nowKey = now.getFullYear() * 12 + (now.getMonth() + 1)
const lag = ym => ym ? nowKey - (Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4, 6))) : null

const targets = [
  ['매매가격지수_아파트(전국)', 'A_2024_00045', 500001, null],
  ['아파트매매거래현황(전국)', 'A_2024_00554', 500001, '100001'],
  ['전월세전환율(전국)', 'A_2024_00179', 500001, null],
  ['주택시장 소비심리(전국)', 'T232543129897499', 50004, '10001'],
]

for (const [name, tbl, cls, itm] of targets) {
  try {
    const { last, n } = await latestMonth(tbl, cls, itm)
    console.log(`${name.padEnd(26)} 최신 ${last ?? '—'}  지연 ${lag(last) ?? '—'}개월  (행 ${n})`)
  } catch (e) { console.log(`${name} ERR ${e.message}`) }
}
