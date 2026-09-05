#!/usr/bin/env node
// 🔒 불변식 — CPI 는 전 화면이 같은 값·같은 기준월이어야 한다(제2원칙).
//
// 왜 생겼나(2026-09-05 실사고): '현재 계절'·'킬스위치'는 3.5%, '연준 차트보드'는 3.3%(2026-07)였다.
//   원인은 소스가 아니라 **계산**이었다 — macroPhaseScreener 가 원지수 14개를 받아 `[0] 대비 [12]` 로
//   직접 YoY 를 냈는데, 결측(2025-10 · 셧다운으로 미발표)을 filter 로 걸러내며 인덱스가 밀려
//   실제로는 **13개월 차분**을 하고 있었다([11]=2025-07 이 진짜 12개월 전, [12]=2025-06).
//   빌드·타입체크는 절대 못 잡는다. 값이 그럴듯해서 화면검증도 통과했다.
//
// 이 스크립트가 지키는 명제 두 개:
//   ① FRED units=pc1(전년동월비) 값과 앱이 쓰는 값이 같은가
//   ② 두 경로(macro-regime · fed-charts)가 같은 기준월을 보는가
//
// ⛔ 인덱스 산술로 기간을 세지 마라 — 데이터에 구멍이 나는 순간 이름표가 거짓이 된다.
//
// 사용: node scripts/verify-cpi-consistency.mjs [baseUrl]
//   baseUrl 생략 시 프로덕션. 야간 감사(nightly-audit.mjs)의 INVARIANTS 에 등록돼 매일 돈다.
import fs from 'fs'

const BASE = process.argv[2] || 'https://investment-school-2026.vercel.app'
const fail = (m) => { console.error('❌ ' + m); process.exitCode = 1 }
const ok = (m) => console.log('✅ ' + m)

function fredKey() {
  try {
    for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const t = l.trim()
      if (t.startsWith('FRED_API_KEY=')) return t.slice('FRED_API_KEY='.length).replace(/^"|"$/g, '')
    }
  } catch { /* 없으면 원천 대조는 건너뛴다 */ }
  return null
}

const j = async (u) => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`${u} → ${r.status}`); return r.json() }

try {
  const [regime, fed] = await Promise.all([j(`${BASE}/api/macro-regime`), j(`${BASE}/api/fed-charts`)])

  const appCpi = regime?.cpiYoY
  const appMonth = regime?.cpiMonth
  const infl = Array.isArray(fed?.inflation) ? fed.inflation[fed.inflation.length - 1] : null
  const chartCpi = infl?.headline
  const chartMonth = infl?.date

  if (typeof appCpi !== 'number') fail(`macro-regime.cpiYoY 가 숫자가 아닙니다: ${appCpi}`)
  if (!appMonth) fail('macro-regime.cpiMonth 가 없습니다 — 기준월 없는 숫자는 대조가 불가능합니다')
  if (typeof chartCpi !== 'number') fail(`fed-charts 헤드라인 CPI 를 읽지 못했습니다: ${chartCpi}`)

  // ① 두 화면이 같은 기준월인가
  if (appMonth && chartMonth && appMonth !== chartMonth)
    fail(`기준월 불일치 — macro-regime ${appMonth} vs fed-charts ${chartMonth}`)
  else if (appMonth) ok(`기준월 일치: ${appMonth}`)

  // ② 두 화면이 같은 값인가(표시 반올림 0.1%p 허용)
  if (typeof appCpi === 'number' && typeof chartCpi === 'number') {
    const gap = Math.abs(appCpi - chartCpi)
    if (gap > 0.05) fail(`CPI 값 불일치 — macro-regime ${appCpi}% vs fed-charts ${chartCpi}% (차이 ${gap.toFixed(2)}%p)`)
    else ok(`CPI 값 일치: ${appCpi}% ≈ ${chartCpi}%`)
  }

  // ③ 원천(FRED units=pc1) 과의 독립 대조 — 키가 있을 때만
  const key = fredKey()
  if (key && typeof appCpi === 'number') {
    const u = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${key}&file_type=json&sort_order=desc&limit=3&units=pc1`
    const o = (await j(u))?.observations?.find(x => x.value !== '.')
    if (o) {
      const truth = Math.round(parseFloat(o.value) * 10) / 10
      const tMonth = o.date.slice(0, 7)
      if (Math.abs(appCpi - truth) > 0.05) fail(`원천 대조 실패 — 앱 ${appCpi}% vs FRED pc1 ${truth}% (${tMonth})`)
      else ok(`원천 대조 통과: FRED pc1 ${truth}% (${tMonth})`)
      if (appMonth && appMonth !== tMonth) fail(`기준월이 원천과 다릅니다 — 앱 ${appMonth} vs FRED ${tMonth}`)
    }
  } else if (!key) {
    console.log('ℹ️ FRED_API_KEY 없음 — 원천 대조는 건너뜁니다(화면 간 대조는 수행함)')
  }
} catch (e) {
  fail(`검증 실행 실패: ${e.message}`)
}

if (!process.exitCode) console.log('\n🔒 CPI 불변식 통과')
