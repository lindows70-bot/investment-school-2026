'use client'
// 앱을 열 때 하루 한 번 접속 기록 API 를 부르는 보이지 않는 컴포넌트
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitBeacon() {
  const pathname = usePathname()
  useEffect(() => {
    const key = `visit-${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`
    if (pathname === '/login' || pathname === '/signup') {
      // 로그인하러 왔으면 '비로그인이라 멈춤' 표시를 지운다 — 로그인 뒤 첫 화면에서 접속이 기록되게
      try { if (sessionStorage.getItem(key) === '401') sessionStorage.removeItem(key) } catch { /* 저장소 막힘 */ }
      return
    }
    try { if (sessionStorage.getItem(key)) return } catch { /* 저장소 막힘 — 그냥 보낸다 */ }
    fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname }) })
      .then(r => {
        // 성공, 또는 401(비로그인 — 화면을 옮겨도 결과가 같다)이면 이 세션은 그만 보낸다. 5xx·네트워크 오류는 다음 화면에서 다시
        if (r.ok || r.status === 401) { try { sessionStorage.setItem(key, r.ok ? '1' : '401') } catch { /* 저장소 막힘 */ } }
      })
      .catch(() => {})
  }, [pathname])
  return null
}
