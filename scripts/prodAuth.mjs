// 불변식 스크립트가 **프로덕션의 게이트 라우트**(stock-info·financials·research-verdict… — 2026-10-18 6·7차 점검에서 로그인·내부 호출만 허용)를 부를 때 쓰는 헤더.
//   .env.local 의 CRON_SECRET(프로덕션과 같은 값 · 2026-10-18 실측 200)을 Bearer 로 — 서버의 internalHeaders 와 같은 표식. 값은 출력하지 않는다.
//   없으면 빈 객체 → 게이트 라우트는 401 이라 해당 검사가 빨강이 된다(비밀값이 사라진 것도 알아야 한다).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const secret = (() => {
  try { return readFileSync(`${ROOT}/.env.local`, 'utf8').match(/^CRON_SECRET=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, '') ?? '' } catch { return '' }
})()
export const PROD_HEADERS = secret ? { authorization: `Bearer ${secret}` } : {}
export const PROD_AUTH_OK = secret.length > 0
