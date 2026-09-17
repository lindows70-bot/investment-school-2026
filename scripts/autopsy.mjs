// 🔬 백테스트 해부 4단 — 신호 표본이 '가짜 엣지'인지 결정적으로 판정한다(backtest-autopsy 스킬의 계산부).
//   스킬 본문의 문장을 사람이 매번 세던 것을 코드로 내린다 — 답이 하나인 계산에 AI 비결정성을 섞을 이유가 없다(2026-09-17).
//   순수 함수 autopsy() 를 export 하고, 직접 실행하면 JSON 파일을 읽어 보고서를 찍는다.
//
//   입력 행: { ticker, market:'KR'|'US', ym:'YYYY-MM', regime?:'up'|'flat'|'down', ret:{ [h]: pct } }   (backtest-swing.mjs 의 meta+ret 과 같은 모양)
//   baseline: { KR:{ [h]: pct[] }, US:{ [h]: pct[] } } — 같은 유니버스 **전 봉**의 전방수익(없으면 ④는 절대값으로만 본다)
//   실행: node scripts/autopsy.mjs <rows.json> [--baseline base.json] [--h 10]
//
//   임계의 출처(스킬 본문과 같다 — 여기가 SSOT, 스킬은 이 파일을 가리킨다):
//   ① 종목 <10 기각(7종목 A+E 사례) ② 최다 종목 >30% 기각(006800 49%·SPGI 35%)
//   ③ 최다 분기 >50% 는 ⚠️ 경고 — 프로젝트에 기각 전례가 없어 관문이 아니라 표시. 레짐별 성적은 항상 병기(정예 타점 '상승 전용' 사례)
//   ④ 상하위 10% 절사 후 edge ≤ 0.1%p 기각(매도 후보 3종이 0.02~0.09 로 증발한 사례). baseline 이 없으면 절사 평균 ≤ 0 기각.
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const trim = a => { const s = [...a].sort((x, y) => x - y); const k = Math.floor(s.length * 0.1); return s.slice(k, s.length - k) }
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null }
const r2 = n => n == null ? null : Math.round(n * 100) / 100
const quarterOf = ym => `${ym.slice(0, 4)}Q${Math.ceil(+ym.slice(5, 7) / 3)}`

export const AUTOPSY_LIMITS = { minTickers: 10, maxTopShare: 0.30, warnTopQuarter: 0.50, minTrimEdge: 0.1 }

/** 4관문 판정. 결과는 { pass, gates:[...], regime, n } — pass 는 ①②④ 전부 통과(③은 경고). */
export function autopsy(rows, baseline = null, h = 10) {
  const n = rows.length
  if (!n) return { pass: false, n: 0, gates: [{ id: 1, ok: false, text: '신호 0건' }], regime: [] }
  const count = (arr, key) => { const m = {}; for (const r of arr) { const k = key(r); m[k] = (m[k] ?? 0) + 1 } return Object.entries(m).sort((a, b) => b[1] - a[1]) }

  const tk = count(rows, r => r.ticker)
  const g1 = tk.length >= AUTOPSY_LIMITS.minTickers
  const [topT, topN] = tk[0]
  const g2 = topN / n <= AUTOPSY_LIMITS.maxTopShare
  const qs = count(rows, r => quarterOf(r.ym))
  const [topQ, topQN] = qs[0]
  const g3warn = topQN / n > AUTOPSY_LIMITS.warnTopQuarter

  // ④ — 시장별 baseline 이 있으면 시장별로 edge 를 재고, 표본 가중 평균으로 합친다(KR·US baseline 이 다르다)
  const edgeOf = (arr, mk) => {
    const s = arr.map(r => r.ret[h]).filter(x => typeof x === 'number')
    const b = baseline?.[mk]?.[h]
    if (!s.length) return null
    return { n: s.length, raw: b ? avg(s) - avg(b) : avg(s), trimmed: b ? avg(trim(s)) - avg(trim(b)) : avg(trim(s)), median: median(s), win: s.filter(x => x > 0).length / s.length * 100 }
  }
  const byMk = ['KR', 'US'].map(mk => [mk, edgeOf(rows.filter(r => r.market === mk), mk)]).filter(([, e]) => e)
  const wsum = k => byMk.reduce((s, [, e]) => s + e[k] * e.n, 0) / byMk.reduce((s, [, e]) => s + e.n, 0)
  const trimmed = byMk.length ? wsum('trimmed') : null
  const g4 = trimmed != null && trimmed > AUTOPSY_LIMITS.minTrimEdge

  const regime = ['up', 'flat', 'down'].map(k => {
    const g = rows.filter(r => r.regime === k)
    const s = g.map(r => r.ret[h]).filter(x => typeof x === 'number')
    return { regime: k, n: g.length, avg: s.length >= 5 ? r2(avg(s)) : null, trimmed: s.length >= 5 ? r2(avg(trim(s))) : null, win: s.length >= 5 ? r2(s.filter(x => x > 0).length / s.length * 100) : null }
  })

  const gates = [
    { id: 1, ok: g1, text: `종목 분산 ${tk.length}종 (기준 ≥${AUTOPSY_LIMITS.minTickers})` },
    { id: 2, ok: g2, text: `최다 종목 ${topT} ${Math.round(topN / n * 100)}% (기준 ≤${AUTOPSY_LIMITS.maxTopShare * 100}%)` },
    { id: 3, ok: !g3warn, warn: true, text: `최다 분기 ${topQ} ${Math.round(topQN / n * 100)}% · ${qs.length}개 분기 (경고 >${AUTOPSY_LIMITS.warnTopQuarter * 100}%)` },
    { id: 4, ok: g4, text: `절사 edge ${r2(trimmed) ?? '—'}%p @${h}봉 (기준 >${AUTOPSY_LIMITS.minTrimEdge}) · ` + byMk.map(([mk, e]) => `${mk} ${e.n}건 raw ${r2(e.raw)} 절사 ${r2(e.trimmed)} 중위 ${r2(e.median)} 승률 ${r2(e.win)}%`).join(' | ') + (baseline ? '' : ' · ⚠️ baseline 없음 — 절대값') },
  ]
  return { pass: g1 && g2 && g4, n, gates, regime, h }
}

export function formatAutopsy(a) {
  const mark = g => g.ok ? '✅' : g.warn ? '⚠️' : '❌ 기각'
  const lines = a.gates.map(g => `  ${['①', '②', '③', '④'][g.id - 1]} ${mark(g)} ${g.text}`)
  if (a.regime.length) lines.push('  레짐(' + a.h + '봉): ' + a.regime.map(r => `${{ up: '상승', flat: '중립', down: '하락' }[r.regime]} ${r.n}건${r.avg == null ? '(표본 부족)' : ` 평균 ${r.avg}% 절사 ${r.trimmed}% 승률 ${r.win}%`}`).join(' · '))
  lines.push(`  → ${a.pass ? '✅ 4관문 통과 — 결론엔 표본 기간·비용 미반영·레짐 한계를 병기하라' : '❌ 기각 — 억지로 살리지 마라. 반증도 기록으로 남긴다'}`)
  return lines.join('\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
  const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--baseline', '--h'].includes(args[i - 1])))
  if (!file) { console.error('사용법: node scripts/autopsy.mjs <rows.json> [--baseline base.json] [--h 10]'); process.exit(1) }
  const rows = JSON.parse(readFileSync(file, 'utf8'))
  const base = opt('--baseline') ? JSON.parse(readFileSync(opt('--baseline'), 'utf8')) : null
  const a = autopsy(rows, base, +opt('--h', 10))
  console.log(`🔬 autopsy — 신호 ${a.n}건`)
  console.log(formatAutopsy(a))
  process.exit(a.pass ? 0 : 2)
}
