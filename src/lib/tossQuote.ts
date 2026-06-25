// 🟢 토스증권 Open API 공용 시세 클라이언트 — KR 현재가를 네이버 폴백용으로 조회(서버 전용, 시세=학생 공용 허용)
//    ⚠️ 시세·종목 조회만(개인정보 아님). 계좌·보유·주문(개인계좌)은 절대 여기서 다루지 않음(tossOwner 게이트 별도).
//    인증: OAuth2 Client Credentials(POST /oauth2/token). 시세: GET /api/v1/prices?symbols=005930 → result[].lastPrice
//    키(TOSS_API_KEY·TOSS_SECRET_KEY)는 서버 전용 시크릿. 없으면 graceful null(=네이버 기존 동작 무변경).

const BASE = 'https://openapi.tossinvest.com'

// 액세스 토큰 인메모리 캐시(만료 24h, 5분 여유 두고 갱신). 전 인스턴스 공유는 불필요(토큰은 가벼움).
let tokenCache: { token: string; exp: number } | null = null

async function getToken(): Promise<string | null> {
  const id = process.env.TOSS_API_KEY
  const secret = process.env.TOSS_SECRET_KEY
  if (!id || !secret) return null // 키 미설정 → 조용히 폴백 안 함(네이버 기존 동작 유지)

  const now = Date.now()
  if (tokenCache && tokenCache.exp > now + 5 * 60_000) return tokenCache.token

  try {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
    const res = await fetch(`${BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      next: { revalidate: 0 },
    })
    if (!res.ok) { console.warn(`[toss] 토큰 발급 실패 ${res.status}`); return null }
    const json = await res.json()
    const token: string | undefined = json?.access_token
    const expiresIn: number = typeof json?.expires_in === 'number' ? json.expires_in : 86400
    if (!token) return null
    tokenCache = { token, exp: now + expiresIn * 1000 }
    return token
  } catch (e) {
    console.warn('[toss] 토큰 발급 예외:', e)
    return null
  }
}

/** 토스 시세로 KR 현재가 조회(6자리 코드). 키 없거나 실패 시 null(=네이버 폴백 안 함). */
export async function getTossKrPrice(code6: string): Promise<number | null> {
  const code = code6.replace(/\.(KS|KQ)$/i, '').replace(/\D/g, '').slice(-6)
  if (!/^\d{6}$/.test(code)) return null
  const token = await getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BASE}/api/v1/prices?symbols=${code}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) { console.warn(`[toss] 시세 조회 실패 ${res.status} (${code})`); return null }
    const json = await res.json()
    const raw = json?.result?.[0]?.lastPrice ?? json?.result?.[0]?.price
    const px = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : Number(raw)
    return isFinite(px) && px > 0 ? px : null
  } catch (e) {
    console.warn('[toss] 시세 조회 예외:', e)
    return null
  }
}
