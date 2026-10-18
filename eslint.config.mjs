// ESLint 9 flat config — `next lint` 폐기(Next 16 제거 예고)로 ESLint CLI 직접 호출(2026-10-18).
// eslint-config-next 15.x 는 아직 eslintrc 형식이라 FlatCompat 으로 감싼다(create-next-app 15 의 기본 산출물과 같은 모양).
// 대상은 next lint 가 기본으로 보던 src/ 와 같다(package.json scripts: `eslint src`). 빌드 산출물·캐시는 제외.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  { ignores: ['.next/**', '.next-build/**', 'node_modules/**', '.audit/**', 'docs/**', 'scripts/**', 'public/**'] },
  // ESLint 9 는 안 쓰이는 eslint-disable 주석을 기본 warn 으로 올린다(실측 23건) — next lint(ESLint 8) 와 같은 결과를 내도록 끈다
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
