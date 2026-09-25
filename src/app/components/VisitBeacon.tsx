'use client'
// 앱을 열 때 하루 한 번 접속 기록 API 를 부르는 보이지 않는 컴포넌트
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitBeacon() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === '/login' || pathname === '/signup') return
    const key = `visit-${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch { /* 저장소 막힘 — 그냥 보낸다 */ }
    fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname }) }).catch(() => {})
  }, [pathname])
  return null
}
