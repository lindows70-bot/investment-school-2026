// Phase 0 실측: 천문연구원 특일정보 API — 앱의 기존 data.go.kr 키로 호출 가능한가
// (키는 계정당 하나 — 활용신청이 안 돼 있으면 SERVICE_KEY_IS_NOT_REGISTERED 류 에러가 온다)
import fs from 'fs'

// .env.local 에서 키만 읽는다(값 노출 금지 — 길이만 로그)
const env = fs.readFileSync('.env.local', 'utf8')
const m = env.match(/DATA_GO_KR_SERVICE_KEY=(.+)/)
const key = m?.[1]?.trim()
console.log(`키 길이: ${key?.length ?? 0}`)
if (!key) process.exit(1)

const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
  `?serviceKey=${encodeURIComponent(key)}&solYear=2026&numOfRows=30&_type=json`
const r = await fetch(url)
const text = await r.text()
console.log(`HTTP ${r.status} · ${text.slice(0, 120).replace(/\n/g, ' ')}`)
try {
  const j = JSON.parse(text)
  const items = j?.response?.body?.items?.item ?? []
  console.log(`\n2026년 공휴일 ${items.length}건:`)
  for (const it of items) console.log(`  ${it.locdate}  ${it.dateName}${it.isHoliday === 'Y' ? '' : ' (비휴일)'}`)
} catch { /* XML 에러 응답 — 위 원문으로 판정 */ }
