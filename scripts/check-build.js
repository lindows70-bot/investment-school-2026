// 🛡️ 배포 전 strict 빌드 검증 — dev 의 .next 를 건드리지 않고 .next-build 로 분리 빌드한다.
//
// ⚠️ 2026-09-05 실사고: 예전엔 `next build` 한 줄이었는데 **거짓 green** 을 줬다.
//    JSX 파싱 에러(`{cond && ( {/* 주석 */} ...)}`)가 있는 커밋이 로컬 check:build 를 통과했고,
//    Vercel 에서야 `Parsing error: ')' expected` 로 죽었다.
//    원인은 `.next-build/cache/eslint` — Next 가 파일별 lint 결과를 캐시하는데,
//    로컬은 그 캐시를 재사용하고 Vercel 은 캐시 없이 새로 도는 차이였다.
//    → **lint 캐시만 지우고** 빌드한다. swc/webpack 캐시는 남겨 빌드 시간을 지킨다(721MB 중 lint 는 0.4MB).
//
// ⛔ 파이프로 결과를 가리지 마라 — 종료 코드가 그대로 전파돼야 커밋·배포가 멈춘다.
const { spawnSync } = require('child_process')
const { rmSync, existsSync } = require('fs')
const path = require('path')

const DIST = '.next-build'
const eslintCache = path.join(DIST, 'cache', 'eslint')
if (existsSync(eslintCache)) {
  rmSync(eslintCache, { recursive: true, force: true })
  console.log(`[check:build] lint 캐시 제거: ${eslintCache} (거짓 green 방지)`)
}

const r = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NEXT_DIST_DIR: DIST },
})
process.exit(r.status ?? 1)
