// 캐시 키 날짜 검사(순수 함수) — precommit-guard 가 추가된 줄에 쓰고, verify-cache-purge 가 합성 diff 로 검증한다
//
// 💥 2026-09-26: app_cache 에는 지우는 장치가 없어 날짜가 든 키가 영구 누적됐다(tech-chart 926 MB → DB 한도 초과).
//    정리 장치(src/lib/cachePurge.ts PURGE_RULES)는 등록된 접두어만 지운다 — 새 날짜 키가 목록 밖에서 태어나면 다시 쌓인다.
//    CLAUDE.md 문장으로는 안 지켜진다(하네스 절) → 커밋에서 막는다.
//
// 판정: 추가된 줄에서 '캐시 키로 쓰이는 문자열'에 날짜 조각이 들어가고, 그 접두어가 PURGE_RULES 에 없으면 위반.
//   · 캐시 키 문자열 = `slug:…`·'slug:' 로 시작하는 리터럴 중 ① 접두어에 -vN 이 있거나 ② 같은 줄에 getCache(/setCache( 가 있거나
//     ③ *key/*Key/*KEY 변수에 대입하는 줄. URL(`https://…`)·경로(`/api/…`)·`${base}…` 는 키가 아니다.
//     JSX 속성(`key={…}`)·브라우저 저장소 줄(localStorage·sessionStorage·storageKey)은 app_cache 가 아니라 보지 않는다.
//   · 규칙에 있는 접두어라도 구분자가 '|' 면 위반 — 정리(shouldPurge)는 `${prefix}:` 로 시작하는 키만 지운다.
//   · 상수 함수로 만든 키(`FOO_KEY(kstDate())`)는 정의를 찾아 접두어를 푼다(resolve 콜백). 못 풀면 경고만(오탐 방지).
//   · 우회: 그 줄에 `캐시날짜예외: <이유>` — 침묵 우회 대신 이유를 남긴다.
//   ⚠️ 한계: `${d}` 같은 한 글자 변수에 담긴 날짜는 못 잡는다(오탐이 커서 일부러 뺐다). src/ 밖(scripts·로컬 러너)은 훅이 안 본다.

export const CACHE_DATE_EXEMPT = /캐시날짜예외:/

// 날짜를 만드는 호출 — kstDate()·todayKst()·kstToday()·toISOString().slice(0, 10)(월 키 slice(0, 7) 포함)·toISOString().split('T')[0]
const DATE_CALL = /\bkstDate\w*\s*\(|\btodayKst\w*\s*\(|\bkstToday\w*\s*\(|toISOString\(\)\s*\.slice\(\s*0\s*,\s*(?:10|7)\s*\)|toISOString\(\)\s*\.split\(\s*['"`]T['"`]\s*\)\s*\[\s*0\s*\]/
// 날짜를 담은 변수 이름 — `${today}`·`${dateKey}`·`${kst}`·`${day}`·`${hourKey}` …
const DATE_NAME = '(?:today\\w*|date\\w*|kst|kstDay\\w*|kstDate\\w*|kstToday\\w*|day|dayKey|dayKst|ymd|yyyymmdd|hourKey|cacheDate)'
const DATE_INTERP = new RegExp(`\\$\\{\\s*${DATE_NAME}\\s*\\}`)
const DATE_BARE = new RegExp(`(?:^|[^\\w.$])${DATE_NAME}(?![\\w(])`)

/** 이 텍스트에 날짜 조각이 있는가(템플릿 본문) */
export function hasDateFragment(s) {
  return DATE_CALL.test(s) || DATE_INTERP.test(s)
}

// 키 머리 — 소문자로 시작, [a-z0-9-] 와 `+${CONST}`·`${CONST}` 결합만, 그다음 ':' 또는 '|'(뒤가 '/' 면 URL)
const KEY_HEAD = /^([a-z](?:[a-z0-9-]|\+?\$\{[A-Z_][A-Z0-9_]*\})*)([:|])(?!\/)/

/** 리터럴 본문이 캐시 키 모양이면 { prefix, sep }, 아니면 null */
export function keyHeadOf(body) {
  const m = KEY_HEAD.exec(body)
  return m ? { prefix: m[1], sep: m[2] } : null
}

const isCommentLine = (l) => { const t = l.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') }
const CACHE_CALL = /\b(?:getCache|setCache)\s*[<(]/
// JS 대입만 — JSX 속성 `key={…}` 은 `=` 뒤가 `{` 라 제외된다
const KEY_ASSIGN = /\b\w*(?:key|Key|KEY)\s*(?::\s*[\w<>[\]| ]+)?=(?!=)(?!\s*\{)/
// 브라우저 저장소 — app_cache 가 아니다(날짜 키여도 서버 DB 에 쌓이지 않는다)
const STORAGE_LINE = /\b(?:localStorage|sessionStorage)\b|storage[Kk]ey/

/** cachePurge.ts 원문에서 PURGE_RULES 접두어를 글자 그대로 뽑는다(`${UNIFIED_RECO_V}` 는 풀지 않는다 — 코드 키도 같은 글자다) */
export function parseRulePrefixes(src) {
  const start = src.indexOf('export const PURGE_RULES')
  if (start < 0) return new Set()
  const end = src.indexOf('\n]', start)
  const block = src.slice(start, end < 0 ? undefined : end)
    .split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join('\n')
  const out = new Set()
  for (const m of block.matchAll(/\b[A-Z_]+\(\s*(['"`])([^'"`]+)\1/g)) out.add(m[2])
  for (const m of block.matchAll(/\bprefix:\s*(['"`])([^'"`]+)\1/g)) out.add(m[2])
  return out
}

/** 머리가 규칙으로 지워질 수 있는가 → 위반 사유(없으면 null) */
function whyViolation(head, rulePrefixes) {
  if (!rulePrefixes.has(head.prefix)) return 'PURGE_RULES 에 없음'
  if (head.sep !== ':') return "구분자 '|' — 정리는 `접두어:` 키만 지운다"
  return null
}

/**
 * 추가된 줄들 검사.
 * @param {Map<string,string[]>} addedByFile 파일 → 추가된 줄
 * @param {Set<string>} rulePrefixes PURGE_RULES 접두어(글자 그대로)
 * @param {(name: string) => {prefix:string,sep:string}|null} resolve 상수 이름 → 키 머리(정의를 못 찾으면 null)
 * @returns {{ violations: {f,l,prefix,why}[], unresolved: {f,l,name}[] }}
 */
export function findDatedCacheKeys(addedByFile, rulePrefixes, resolve = () => null) {
  const violations = [], unresolved = []
  for (const [f, lines] of addedByFile) {
    for (const l of lines) {
      if (isCommentLine(l) || CACHE_DATE_EXEMPT.test(l) || STORAGE_LINE.test(l)) continue
      const keyCtx = CACHE_CALL.test(l) || KEY_ASSIGN.test(l)
      const seen = new Set()
      const push = (head) => {
        const why = whyViolation(head, rulePrefixes)
        if (!why || seen.has(head.prefix)) return
        seen.add(head.prefix)
        violations.push({ f, l, prefix: head.prefix, why })
      }
      // ① 리터럴 키 — 템플릿은 본문에서, 따옴표 문자열('slug:' + today)은 뒤따르는 줄에서 날짜를 찾는다
      for (const m of l.matchAll(/`([^`]*)`|'([^'\n]*)'|"([^"\n]*)"/g)) {
        const isTpl = m[1] !== undefined
        const body = isTpl ? m[1] : (m[2] ?? m[3])
        const head = keyHeadOf(body)
        if (!head) continue
        if (!(/-v\d+/.test(head.prefix) || keyCtx)) continue
        if (isTpl) { if (!hasDateFragment(body)) continue }
        else {
          const rest = l.slice(m.index + m[0].length)
          const concat = /^\s*\+/.test(rest) ? rest.split(/[,;]/)[0] : ''
          if (!(hasDateFragment(rest) || DATE_BARE.test(concat))) continue
        }
        push(head)
      }
      // ② 상수 함수 키 — FOO_KEY(kstDate())·FOO_KEY(today) 는 정의에서 접두어를 푼다
      for (const m of l.matchAll(/\b([A-Z][A-Z0-9_]*)\s*\(((?:[^()]|\([^()]*\))*)\)/g)) {
        const [, name, args] = m
        if (!(name.endsWith('_KEY') || CACHE_CALL.test(l))) continue
        if (!(hasDateFragment(args) || DATE_BARE.test(args))) continue
        const head = resolve(name)
        if (!head) { unresolved.push({ f, l, name }); continue }
        push(head)
      }
    }
  }
  return { violations, unresolved }
}

/** 정의 줄 원문들에서 상수의 키 머리를 푼다 — `NAME = (…) => \`slug:…\`` 또는 `NAME = 'slug:…'` */
export function prefixFromDefinition(name, defLines) {
  const def = new RegExp(`\\b${name}\\s*(?::[^=]+)?=(?!=)`)
  for (const d of defLines) {
    if (!def.test(d)) continue
    const rest = d.slice(d.search(def))
    for (const m of rest.matchAll(/`([^`]*)`|'([^'\n]*)'|"([^"\n]*)"/g)) {
      const h = keyHeadOf(m[1] ?? m[2] ?? m[3])
      if (h) return h
    }
  }
  return null
}
