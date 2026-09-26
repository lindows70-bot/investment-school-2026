'use client'
// 학생 셸의 로그아웃 버튼 — 세션을 끊고 로그인 화면으로 새로 연다(PC 왼쪽 메뉴·배우기 '내 계정'이 함께 쓴다)
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ style }: { style: React.CSSProperties }) {
  const [busy, setBusy] = useState(false)
  const logout = async () => {
    setBusy(true)
    // 다른 화면(AppHeader·Sidebar)과 같은 방식 — 공공장소 대비 모든 기기의 세션 제거
    try { await createClient().auth.signOut({ scope: 'global' }) } catch { /* 실패해도 로그인 화면으로 — 거기서 다시 판단한다 */ }
    // 하드 이동 — 클라이언트 캐시에 남은 내 화면이 뒤로 가기로 다시 보이지 않게
    window.location.href = '/login'
  }
  return (
    <button type="button" onClick={logout} disabled={busy} style={{ ...style, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
