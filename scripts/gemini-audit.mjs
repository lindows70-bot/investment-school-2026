#!/usr/bin/env node
// 🔍 Gemini 정합성 감사 — 이 앱이 22~52회 반복한 '여러 파일에 걸친' 버그를 전담한다.
//
// 역할 분담: 클로드(구현·설계) / Codex(코드 리뷰=로직 결함) / **Gemini(정합성=파일 간 모순)**
//   이 앱의 반복 사고는 한 파일만 보면 전부 멀쩡해 보인다 — PEG가 화면마다 달랐던 일,
//   배당이 캘린더와 대시보드에서 3배 어긋난 일, 중위값 관례가 달라 28.5 vs 28.4가 된 일,
//   rotation v9→v11 reader 잔존.
//
// ⚠️ 설계 이유(2026-07-28 실패에서 배움) — **요청 1회로 끝낸다**
//   처음엔 gemini-cli 에게 저장소를 직접 탐색시켰다. 에이전트가 '읽고→생각하고→또 읽는'
//   왕복을 하는데 **왕복 한 번이 요청 한 번**이라, 감사 한 건에 수십 회를 썼다.
//   무료 티어 한도는 **하루 20회**여서 결과 한 줄 못 받고 재시도로 한도만 태웠다.
//   → 수집(grep)은 여기서 공짜로 하고, 모델에는 **증거를 한 번에 넘겨 판단만** 시킨다.
//
// ⚠️ 무료 티어 실측 판정표(반드시 실제 호출로 확인할 것 — models.list 에 보이는 것은 가용성이 아니다)
//   gemini-2.5-pro ❌ limit 0 / gemini-2.5-flash ✅ / gemini-2.5-flash-lite ✅(앱이 쓰는 모델)
//
// 사용: node scripts/gemini-audit.mjs <ssot|cache-keys|contradiction> [대상]
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const [, , mode, ...rest] = process.argv
const target = rest.join(' ').trim()
const MODEL = process.env.GEMINI_AUDIT_MODEL || 'gemini-2.5-flash'
const MAX_EVIDENCE = 180_000   // 증거 상한(자). 넘으면 잘라내고 그 사실을 보고한다.

// ── 소스 순회 ────────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(e)) yield p
  }
}
const files = [...walk('src')]

/** 파일별로 정규식에 걸린 줄을 file:line 과 함께 모은다 */
function collect(re, perFile = 40) {
  const out = []
  for (const f of files) {
    let lines
    try { lines = readFileSync(f, 'utf8').split('\n') } catch { continue }
    let n = 0
    for (let i = 0; i < lines.length && n < perFile; i++) {
      if (re.test(lines[i])) { out.push(`${f}:${i + 1}: ${lines[i].trim().slice(0, 200)}`); n++ }
      re.lastIndex = 0
    }
  }
  return out
}

// ── 모드별 증거 수집(로컬·공짜) ───────────────────────────────────────────────
const GATHER = {
  // 캐시 키는 기계적으로 후보까지 판정된다 → 후보 없으면 API 호출 자체를 하지 않는다(한도 절약)
  'cache-keys': () => {
    const keys = new Map()   // name → Map(version → [file:line])
    for (const f of files) {
      let lines
      try { lines = readFileSync(f, 'utf8').split('\n') } catch { continue }
      lines.forEach((ln, i) => {
        for (const m of ln.matchAll(/['"`]([a-z][a-z0-9-]*?)-v(\d+)[:'"`]/g)) {
          const [, name, v] = m
          if (!keys.has(name)) keys.set(name, new Map())
          const byV = keys.get(name)
          if (!byV.has(v)) byV.set(v, [])
          byV.get(v).push(`${f}:${i + 1}`)
        }
      })
    }
    const mixed = [...keys.entries()].filter(([, byV]) => byV.size > 1)
    const lines = mixed.map(([name, byV]) => {
      const vs = [...byV.entries()].sort((a, b) => +a[0] - +b[0])
      return `● ${name} — 버전 ${vs.map(([v]) => 'v' + v).join(', ')} 공존\n` +
        vs.map(([v, locs]) => `    v${v}: ${locs.join(', ')}`).join('\n')
    })
    return {
      skip: mixed.length === 0,
      summary: `캐시 키 ${keys.size}종 중 **버전이 섞인 키 ${mixed.length}종** 발견`,
      evidence: lines.join('\n'),
      question: `아래는 한 캐시 키 이름에 **서로 다른 버전이 공존하는** 위치 목록이다.
각 항목이 진짜 결함인지 판정하라.
- 진짜 결함: writer 가 새 버전으로 쓰는데 reader 가 옛 버전을 읽는 경우(신호가 조용히 죽는다).
- 결함 아님: 애초에 서로 다른 용도의 별개 캐시이거나, 옛 버전이 주석·문서에만 남은 경우.
파일 경로와 줄 번호로 어느 쪽이 writer/reader 인지 추론하고, 확신이 없으면 "확인 필요"로 표시하라.`,
    }
  },

  ssot: () => {
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const hits = collect(re)
    return {
      skip: hits.length === 0,
      summary: `"${target}" 언급 ${hits.length}줄 수집`,
      evidence: hits.join('\n'),
      question: `아래는 지표 "${target}" 이(가) 등장하는 모든 위치다.
**여러 곳에서 다르게 계산되는지** 판정하라. 다음이 서로 다르면 제2원칙(SSOT) 위반이다 —
원천(어느 API·캐시·필드) / 공식 / 단위·스케일 / 반올림 / 결측(null) 처리 / 임계값.
특히 이미 SSOT 가 지정돼 있는데 그걸 안 쓰고 원천을 직접 호출하는 곳을 중요하게 보라.`,
    }
  },

  contradiction: () => {
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const hits = collect(re, 25)
    return {
      skip: hits.length === 0,
      summary: `"${target}" 관련 ${hits.length}줄 수집`,
      evidence: hits.join('\n'),
      question: `아래는 "${target}" 을(를) 다루는 코드 위치다.
같은 종목·같은 시점에 **학생에게 정반대 결론이 보일 수 있는 조합**을 찾아라.
축이 달라서 정당한 다층인지(가치 vs 모멘텀처럼), 진짜 모순인지 구분하라.
정당한 다층이면 **두 축을 함께 설명하는 문구가 있는지** 확인하고 없으면 그것을 보고하라.
요약(배너·헤드라인)이 상세(카드·표)와 어긋나는 것도 모순이다.`,
    }
  },
}

if (!GATHER[mode] || (mode !== 'cache-keys' && !target)) {
  console.log(`사용법:
  node scripts/gemini-audit.mjs ssot <지표명>          예) ssot PEG
  node scripts/gemini-audit.mjs cache-keys             (대상 불필요)
  node scripts/gemini-audit.mjs contradiction <기능명> 예) contradiction 매수 추천`)
  process.exit(1)
}

// ── 수집 ─────────────────────────────────────────────────────────────────────
const g = GATHER[mode]()
console.log(`\x1b[2m[gemini-audit] ${mode}${target ? ` · ${target}` : ''} · ${files.length}파일 스캔\x1b[0m`)
console.log(`\x1b[2m수집: ${g.summary}\x1b[0m\n`)

if (g.skip) {
  console.log('✅ 기계적 후보 없음 — API 호출 없이 종료(한도 절약).')
  process.exit(0)
}

let evidence = g.evidence
let truncated = false
if (evidence.length > MAX_EVIDENCE) { evidence = evidence.slice(0, MAX_EVIDENCE); truncated = true }

// ── 판단(요청 1회) ───────────────────────────────────────────────────────────
function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  try {
    const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch { /* 아래에서 안내 */ }
  return null
}
const key = apiKey()
if (!key) { console.error('GEMINI_API_KEY 를 찾지 못했습니다(.env.local 또는 환경변수).'); process.exit(1) }

const prompt = `너는 이 저장소(Next.js 투자 교육 앱)의 **정합성 감사관**이다. 코드는 고치지 말고 발견만 보고하라.

제2원칙(SSOT): 같은 지표는 어느 화면에서든 같은 출처·같은 계산·같은 관례여야 한다.
관례에는 중위값 짝수 처리, 폴백 해석, 반올림, 단위까지 포함된다.

${g.question}

보고 형식(한국어, 간결):
발견마다 — [P1/P2/P3] 한 줄 요약 / 파일:줄 / 무엇이 어떻게 다른가 / 왜 문제인가.
⛔ 아래 증거에 없는 파일·줄 번호를 지어내지 마라. 확신 없으면 "확인 필요"로 표시하라.
발견이 없으면 "발견 없음"이라고만 답하라. 억지로 만들지 마라.
${truncated ? '\n⚠️ 증거가 상한을 넘어 일부만 전달됐다. 그 사실을 보고 서두에 밝혀라.\n' : ''}
=== 증거 ===
${evidence}`

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`
const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })

// ⚠️ 재시도는 최대 2회 — 무료 티어(하루 20회)에서 재시도 폭주가 한도를 태운 전례가 있다.
let out = null
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    const j = await res.json()
    if (j.error) {
      const msg = (j.error.message || '').split('\n')[0]
      if (res.status === 503 && attempt < 3) {
        console.log(`\x1b[2m  과부하(503) — ${attempt}/2 재시도\x1b[0m`)
        await new Promise(r => setTimeout(r, 4000 * attempt)); continue
      }
      console.error(`❌ ${j.error.status || res.status}: ${msg}`)
      if (/limit: 0/.test(msg)) console.error('   → 이 모델은 무료 티어 미제공. GEMINI_AUDIT_MODEL 로 다른 모델을 지정하세요.')
      else if (res.status === 429) console.error('   → 일일 한도 소진. 내일 다시 시도하거나 감사 전용 키를 분리하세요.')
      process.exit(1)
    }
    out = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? ''
    break
  } catch (e) {
    if (attempt < 3) { await new Promise(r => setTimeout(r, 4000 * attempt)); continue }
    console.error('❌ 호출 실패:', e.message); process.exit(1)
  }
}

console.log(out?.trim() || '(빈 응답)')
console.log(`\n\x1b[2m─ ${MODEL} · 요청 1회 · 증거 ${evidence.length.toLocaleString()}자${truncated ? '(일부 잘림)' : ''}\x1b[0m`)
