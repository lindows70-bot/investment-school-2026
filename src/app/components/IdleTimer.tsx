'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Config ───────────────────────────────────────────────────────────────────
const IDLE_MS   = 30 * 60 * 1000   // 30분 비활동 → 자동 로그아웃
const WARN_MS   =  5 * 60 * 1000   // 만료 5분 전 경고 팝업 표시

// 활동으로 인정하는 DOM 이벤트
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'scroll',    'touchstart', 'click',    'wheel',
] as const

// 인증이 필요 없는 경로 (타이머 비활성)
const PUBLIC_PATHS = ['/login', '/signup']

// ─── Component ────────────────────────────────────────────────────────────────
export default function IdleTimer() {
  const router   = useRouter()
  const pathname = usePathname()

  const [authed,      setAuthed]      = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [remaining,   setRemaining]   = useState(WARN_MS)   // ms remaining when warning shown

  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastReset    = useRef<number>(Date.now())

  // ── Auth state ──────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Logout ──────────────────────────────────────────────────
  const doLogout = useCallback(async () => {
    clearAllTimers()
    setShowWarning(false)
    await createClient().auth.signOut({ scope: 'global' })
    router.push('/login?reason=idle')
    router.refresh()
  }, [router])

  // ── Clear all timers ────────────────────────────────────────
  const clearAllTimers = () => {
    if (logoutTimer.current)  clearTimeout(logoutTimer.current)
    if (warnTimer.current)    clearTimeout(warnTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    logoutTimer.current  = null
    warnTimer.current    = null
    countdownRef.current = null
  }

  // ── Start / reset timer ─────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (!authed || PUBLIC_PATHS.some(p => pathname.startsWith(p))) return
    clearAllTimers()
    setShowWarning(false)
    lastReset.current = Date.now()

    // Warning at IDLE_MS - WARN_MS
    warnTimer.current = setTimeout(() => {
      setRemaining(WARN_MS)
      setShowWarning(true)

      // Countdown tick every second
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - lastReset.current
        const left    = Math.max(0, IDLE_MS - elapsed)
        setRemaining(left)
      }, 1000)
    }, IDLE_MS - WARN_MS)

    // Hard logout at IDLE_MS
    logoutTimer.current = setTimeout(() => {
      doLogout()
    }, IDLE_MS)
  }, [authed, pathname, doLogout])

  // ── Attach activity listeners ───────────────────────────────
  useEffect(() => {
    if (!authed || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      clearAllTimers()
      setShowWarning(false)
      return
    }

    resetTimer()

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetTimer, { passive: true })
    )
    return () => {
      clearAllTimers()
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer))
    }
  }, [authed, pathname, resetTimer])

  // ── "계속 사용" handler ─────────────────────────────────────
  const handleContinue = () => {
    resetTimer()   // resets all timers and hides warning
  }

  // ── Format mm:ss ────────────────────────────────────────────
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')

  if (!showWarning) return null

  return (
    <>
      <style>{`@keyframes idleFadeIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }`}</style>

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}>
        <div style={{
          background: '#141414', border: '1px solid #2a2a2a',
          borderRadius: 18, padding: '32px 28px',
          width: '100%', maxWidth: 380, textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          animation: 'idleFadeIn 0.2s ease-out',
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            background: 'rgba(251,146,60,0.12)',
            border: '1px solid rgba(251,146,60,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
          }}>
            ⏱
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            자동 로그아웃 예정
          </h3>
          <p style={{ fontSize: 13, color: '#7f93a8', margin: '0 0 24px', lineHeight: 1.6 }}>
            30분 동안 활동이 없어 곧 자동 로그아웃됩니다.<br/>
            계속 사용하시려면 아래 버튼을 눌러주세요.
          </p>

          {/* Countdown */}
          <div style={{
            fontSize: 40, fontWeight: 800, letterSpacing: '-1px',
            color: remaining < 60_000 ? '#ef4444' : '#fb923c',
            fontVariantNumeric: 'tabular-nums',
            margin: '0 0 28px',
            transition: 'color 0.3s',
          }}>
            {mm}:{ss}
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: '#1e1e1e', borderRadius: 99, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{
              height: '100%',
              width: `${(remaining / WARN_MS) * 100}%`,
              background: remaining < 60_000 ? '#ef4444' : '#fb923c',
              borderRadius: 99,
              transition: 'width 0.9s linear, background 0.3s',
            }}/>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={doLogout}
              style={{
                flex: 1, padding: '11px', borderRadius: 10,
                border: '1px solid #2a2a2a', background: 'transparent',
                color: '#7f93a8', fontSize: 14, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#7f93a8' }}
            >
              지금 로그아웃
            </button>
            <button
              onClick={handleContinue}
              style={{
                flex: 1, padding: '11px', borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', transition: 'opacity 0.15s',
                boxShadow: '0 0 20px rgba(37,99,235,0.3)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              계속 사용
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
