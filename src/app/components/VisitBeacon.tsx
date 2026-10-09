'use client'
// 앱을 열 때 하루 한 번 접속 기록 API 를 부르는 보이지 않는 컴포넌트
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitBeacon() {
  const pathname = usePathname()
  // 화면 열람 집계(월별) — 경로마다 세션당 1회. 비로그인(401)이면 그냥 끝(화면에 영향 없음). 전체 검토 3-1(탭·화면 가지치기)의 근거
  useEffect(() => {
    if (pathname === '/login' || pathname === '/signup') return
    const path = pathname.split('?')[0]
    const k = `usage-page:${path}`
    try { if (sessionStorage.getItem(k)) return } catch { /* 저장소 막힘 — 그냥 보낸다 */ }
    fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'page', key: path }) })
      .then(r => { if (r.ok || r.status === 401) { try { sessionStorage.setItem(k, '1') } catch { /* ignore */ } } })
      .catch(() => {})
  }, [pathname])
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
