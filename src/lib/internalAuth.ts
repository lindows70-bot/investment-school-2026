// 서버 자기 호출 표식(순수 모듈) — cronAuth 는 next/server·supabase 를 import 하므로 lib(fyEps·moneyFlow·canonicalFundamentals·macroPhaseScreener·stockProfile)이
//   그걸 끌어오면 lib 단위검증(verify-regime-label 등 — tsc 로 lib 만 컴파일해 Node 에서 부른다)이 'next/server' 를 못 찾아 깨진다(2026-10-19 실측).
//   lib 는 여기서, 라우트는 cronAuth(재export)에서 가져온다 — 값은 같다.
export function internalHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET
  return secret ? { authorization: `Bearer ${secret}` } : {}
}
