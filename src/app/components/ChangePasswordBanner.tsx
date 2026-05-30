'use client'

/**
 * ChangePasswordBanner — 임시 비밀번호 감지 및 변경 안내 배너
 *
 * 임시 비밀번호(투자학교XXXX 패턴)로 로그인했을 때 자동으로 표시됩니다.
 * 학생이 안전한 새 비밀번호로 변경할 수 있도록 안내합니다.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 임시 비밀번호 패턴 감지: localStorage에 플래그 저장
const TEMP_PW_FLAG = 'needs_pw_change'

export default function ChangePasswordBanner() {
  const [show,       setShow]       = useState(false)
  const [newPw,      setNewPw]      = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [status,     setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg,        setMsg]        = useState('')

  useEffect(() => {
    // localStorage에 변경 필요 플래그가 있으면 배너 표시
    if (localStorage.getItem(TEMP_PW_FLAG) === '1') {
      setShow(true)
    }
  }, [])

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 6) {
      setStatus('error'); setMsg('비밀번호는 6자 이상이어야 합니다.'); return
    }
    if (newPw !== confirm) {
      setStatus('error'); setMsg('비밀번호가 일치하지 않습니다.'); return
    }
    setStatus('loading'); setMsg('')

    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: newPw })

    if (error) {
      setStatus('error')
      setMsg('변경 실패: ' + error.message)
      return
    }

    // 성공 → 플래그 제거
    localStorage.removeItem(TEMP_PW_FLAG)
    setStatus('success')
    setMsg('비밀번호가 성공적으로 변경되었습니다! 이제 새 비밀번호로 로그인하세요.')
    setTimeout(() => setShow(false), 3000)
  }

  if (!show) return null

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(245,158,11,0.08) 100%)',
      border: '1px solid rgba(234,179,8,0.4)',
      boxShadow: '0 0 24px rgba(234,179,8,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* 아이콘 */}
        <div style={{ fontSize: 24, flexShrink: 0 }}>🔐</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginBottom: 4 }}>
            임시 비밀번호로 로그인되었습니다 — 지금 바로 새 비밀번호로 변경해주세요!
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>
            보안을 위해 임시 비밀번호를 반드시 변경해야 합니다.
            새 비밀번호는 <strong style={{ color: '#fbbf24' }}>6자 이상</strong>이면 됩니다.
          </div>

          {status === 'success' ? (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
              fontSize: 13, color: '#4ade80', fontWeight: 700,
            }}>
              ✅ {msg}
            </div>
          ) : (
            <form onSubmit={handleChange} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>새 비밀번호</div>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="새 비밀번호 (6자 이상)"
                  minLength={6}
                  required
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(234,179,8,0.35)',
                    color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>비밀번호 확인</div>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(234,179,8,0.35)',
                    color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'transparent' }}>.</div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: status === 'loading'
                      ? 'rgba(234,179,8,0.3)'
                      : 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: status === 'loading' ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {status === 'loading' ? '변경 중…' : '🔒 비밀번호 변경'}
                </button>
              </div>
            </form>
          )}

          {status === 'error' && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>⚠ {msg}</div>
          )}
        </div>

        {/* 닫기 (임시 — 나중에 변경 가능) */}
        <button
          onClick={() => setShow(false)}
          title="나중에 변경"
          style={{
            background: 'none', border: 'none', color: '#475569',
            fontSize: 18, cursor: 'pointer', flexShrink: 0, paddingTop: 2,
          }}
        >×</button>
      </div>
    </div>
  )
}

// ── 외부에서 임시 비번 플래그 설정 (로그인 성공 직후 호출)
export function markTempPasswordLogin() {
  try { localStorage.setItem(TEMP_PW_FLAG, '1') } catch { /* ignore */ }
}
