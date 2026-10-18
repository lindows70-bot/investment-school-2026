// 인라인 <style> 텍스트 불변식 — JSX 텍스트로 넣은 CSS(`<style>{`…`}</style>`)에 " ' & < > 가 들어 있으면 실패.
//   React 는 서버에서 텍스트를 HTML 이스케이프(" → &quot;)하는데 <style> 은 raw text 요소라 브라우저가 되돌리지 않아
//   서버·클라이언트 글자가 달라지고 하이드레이션이 깨진다(2026-10-18 실사고: CSS 주석의 따옴표 하나로 홈이 열릴 때마다 React #425·#418·#423 —
//   화면은 조용히 다시 그려져 멀쩡해 보였다). 처방은 dangerouslySetInnerHTML={{ __html }}.
//   ⚠️ 야간 감사는 exit 0 에 더해 마지막 줄 '✅ 전부 통과' 문구를 본다(다른 verify-*.mjs 와 같은 관례).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const files = []
const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (/\.(tsx|jsx)$/.test(n)) files.push(p) } }
walk(ROOT)

let fail = 0, blocks = 0
for (const f of files) {
  const t = readFileSync(f, 'utf8')
  for (const m of t.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)) {
    blocks++
    const css = m[1].replace(/\$\{[^}]*\}/g, '')   // ${TK.x} 같은 토큰 삽입은 값이 hex·숫자라 제외
    const bad = css.match(/["'&<>]/g)
    if (bad) {
      fail++
      const line = t.slice(0, m.index).split('\n').length
      console.log(`❌ ${f.replace(process.cwd(), '').replace(/\\/g, '/')}:${line} — <style> 텍스트에 ${[...new Set(bad)].join(' ')} (${bad.length}곳) → dangerouslySetInnerHTML 로`)
    }
  }
}
console.log(`검사한 <style>{\`…\`}</style> 블록 ${blocks}개 (파일 ${files.length}개)`)
if (fail) { console.log(`\n❌ ${fail}건 실패`); process.exitCode = 1 }
else console.log('\n✅ 전부 통과 (인라인 style 텍스트 이스케이프)')
