'use client'
// 학생 셸의 로그아웃 버튼 — 세션을 끊고 로그인 화면으로 새로 연다(PC 왼쪽 메뉴·배우기 '내 계정'이 함께 쓴다)
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ style }: { style: React.CSSProperties }) {
  const [busy, setBusy] = useState(false)
  const logout = async () => {
    setBusy(true)
    // 이 기기만 로그아웃 — 학교 PC 에서 나가도 폰에 설치한 앱은 로그인 그대로(선생님 화면 AppHeader·Sidebar 는 global 유지)
    // signOut 은 네트워크 오류 때 throw 하지 않고 { error } 를 돌려준다 — 조용히 넘어가지 않게 남긴다
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' })
      if (error) console.error('[logout] signOut 실패 — 로그인 화면에서 다시 판단', error)
    } catch (e) { console.error('[logout] signOut 예외 — 로그인 화면에서 다시 판단', e) }
    // 하드 이동 — 클라이언트 캐시에 남은 내 화면이 뒤로 가기로 다시 보이지 않게
    window.location.href = '/login'
  }
  return (
    <button type="button" onClick={logout} disabled={busy} style={{ ...style, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
