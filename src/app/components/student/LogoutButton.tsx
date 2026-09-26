'use client'
// 학생 셸의 로그아웃 버튼 — 세션을 끊고 로그인 화면으로 새로 연다(PC 왼쪽 메뉴·배우기 '내 계정'이 함께 쓴다)
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearViewMode } from '@/lib/viewMode'

// 세션 쿠키 이름 — @supabase/ssr 0.10 이 document.cookie 로 path=/ · samesite=lax · httpOnly 아님으로 쓴다
// (sb-<프로젝트>-auth-token, 길면 .0 .1 … 조각). code-verifier 쿠키는 일부러 안 걸린다.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

// signOut 이 실패하면 supabase 는 서버 호출에서 멈춰 이 기기 세션을 **안 지운다**(auth-js _signOut 실측)
// → 그대로 /login 에 가면 middleware 가 '이미 로그인'으로 보고 되돌려 보내 버튼이 안 먹힌 것처럼 보인다
function clearLocalSession() {
  document.cookie.split(';').forEach(part => {
    const name = part.split('=')[0].trim()
    if (AUTH_COOKIE.test(name)) document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
  })
  try {
    Object.keys(localStorage).filter(k => AUTH_COOKIE.test(k)).forEach(k => localStorage.removeItem(k))
  } catch { /* 저장소를 못 여는 브라우저 — 쿠키만으로 충분 */ }
}

export default function LogoutButton({ style }: { style: React.CSSProperties }) {
  const [busy, setBusy] = useState(false)
  const logout = async () => {
    setBusy(true)
    // 이 기기만 로그아웃 — 학교 PC 에서 나가도 폰에 설치한 앱은 로그인 그대로(선생님 화면 AppHeader·Sidebar 는 global 유지)
    // signOut 은 네트워크 오류 때 throw 하지 않고 { error } 를 돌려준다 — 그땐 이 기기 세션을 직접 지운다
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) {
        console.error('[logout] signOut 실패 — 이 기기 세션을 직접 지운다', error)
        clearLocalSession()
      }
    } catch (e) {
      console.error('[logout] signOut 예외 — 이 기기 세션을 직접 지운다', e)
      clearLocalSession()
    }
    clearViewMode() // 공용 PC 에서 내 화면 모드 선택이 다음 학생에게 남지 않게
    // 하드 이동 — 클라이언트 캐시에 남은 내 화면이 뒤로 가기로 다시 보이지 않게
    window.location.href = '/login'
  }
  return (
    <button type="button" onClick={logout} disabled={busy} style={{ ...style, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
