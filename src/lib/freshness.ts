// 🕒 실측 카드의 '갱신 시각' 표기 SSOT — 모든 카드가 같은 포맷으로 데이터 신선도를 말한다.
//
// 왜 만들었나(2026-09-05):
//   · 'CME FedWatch' 는 시각을 보여주는데 '칵테일 파티 지수'는 없었다 — 포맷도 카드마다 제각각.
//   · 더 나쁜 건 FedWatch 의 그 시각이 **데이터 시각이 아니었다**는 것이다.
//     `MacroDashboard.tsx` 는 `useEffect` 안에서 `new Date()` 를 찍는다 = "방금 불렀다"일 뿐,
//     캐시된 데이터가 3일 전 것이어도 항상 '지금'이 나온다. 그걸 기준으로 통일하면
//     **의미 없는 시계를 전 카드에 퍼뜨리게 된다.**
//   → 기준은 각 API 응답의 `asOf`(그 값이 실제로 계산·수집된 시각)다. 이미 대부분 응답에 실려 있었다.
//
// ⚠️ `toLocaleString('ko-KR')` 을 쓰지 마라 — 런타임 타임존을 따르므로
//    서버(UTC)와 브라우저(KST)의 출력이 달라 **하이드레이션이 깨진다**(앱 반복 함정: React #425).
//    아래는 타임존에 의존하지 않고 KST 로 직접 환산하는 결정론 포맷터다.

const KST_MS = 9 * 3600_000

/**
 * ISO 시각 → `2026. 9. 5. 오후 10:34` (KST 고정).
 * 값이 없거나 파싱 불가면 null — 호출부가 '시각 없음'을 스스로 정하게 한다(가짜 시각 금지).
 */
export function fmtAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t + KST_MS)   // UTC 게터로 읽으면 KST 벽시계가 된다(앱 관례)
  const h24 = d.getUTCHours()
  const ampm = h24 < 12 ? '오전' : '오후'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${ampm} ${h12}:${mm}`
}

/** 며칠 지났는지 — 표기에 '오래됨'을 덧붙일지 판단할 때. 파싱 불가면 null. */
export function ageDays(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

/**
 * 카드 하단에 그대로 넣을 문구 — `갱신 2026. 9. 5. 오후 10:34` (3일 이상이면 경과일 병기).
 * 시각을 모르면 **null 을 돌려준다** — '지금'으로 채우지 않는다(그게 FedWatch 가 하던 거짓말이다).
 */
export function freshnessLabel(iso: string | null | undefined): string | null {
  const s = fmtAsOf(iso)
  if (!s) return null
  const d = ageDays(iso)
  return d != null && d >= 3 ? `갱신 ${s} (${d}일 전)` : `갱신 ${s}`
}
