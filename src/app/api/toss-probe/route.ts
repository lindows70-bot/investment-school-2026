// ⚠️ 임시 진단 프로브 — 토스 연결 실패 지점 추적용(검증 후 삭제). 토큰값·시크릿은 비노출, 상태코드/응답형태만.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const BASE = 'https://openapi.tossinvest.com'

export async function GET() {
  const id = process.env.TOSS_API_KEY ?? ''
  const secret = process.env.TOSS_SECRET_KEY ?? ''
  const out: Record<string, unknown> = { hasKey: !!id && !!secret, keyPrefix: id.slice(0, 5), keyLen: id.length, secretLen: secret.length }

  // 1) 토큰 발급
  let token = ''
  try {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
    const r = await fetch(`${BASE}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' })
    out.tokenStatus = r.status
    const t = await r.text()
    try { const j = JSON.parse(t); token = j.access_token ?? ''; out.tokenHasAccessToken = !!token; out.tokenFields = Object.keys(j) }
    catch { out.tokenBodyHead = t.slice(0, 200) }
    if (!r.ok) out.tokenErrHead = t.slice(0, 200)
  } catch (e) { out.tokenException = String(e) }

  // 2) 시세 조회 (여러 심볼 형식 시도)
  if (token) {
    for (const sym of ['005930', 'A005930', 'KRX:005930']) {
      try {
        const r = await fetch(`${BASE}/api/v1/prices?symbols=${encodeURIComponent(sym)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const t = await r.text()
        out[`price_${sym}`] = { status: r.status, bodyHead: t.slice(0, 250) }
      } catch (e) { out[`price_${sym}`] = String(e) }
    }
  }
  return NextResponse.json(out)
}
