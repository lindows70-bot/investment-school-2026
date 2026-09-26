'use client'
// 학생 화면(/s)에서만 최소 서비스 워커(public/sw.js — 캐시 없음)를 등록하고, 크롬 설치 이벤트를 미리 받아 둔다 — 폰 홈 화면 설치의 기반
import { useEffect } from 'react'
import { captureInstallPrompt } from '@/app/components/student/installPrompt'

export default function RegisterSW() {
  useEffect(() => {
    // 브라우저 API 는 마운트 뒤에만 — 지원하지 않거나 등록이 실패해도 화면에는 아무 영향이 없다
    captureInstallPrompt()
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
