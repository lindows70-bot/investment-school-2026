'use client'
// ⭐ 관심 단지 등록/해제 버튼 — 단지 리서치 헤더용. 미로그인·테이블 미생성 시 조용히 숨김(graceful).
import { useState, useEffect, useCallback } from 'react'
import { TK } from '@/lib/theme'
import type { ReWatchApi } from '@/app/api/re-watchlist/route'

export default function StarAptButton({ lawd, apt, area }: { lawd: string; apt: string; area: number | null }) {
  const [state, setState] = useState<'hidden' | 'off' | 'on' | 'busy'>('hidden')

  const check = useCallback(() => {
    fetch('/api/re-watchlist').then(r => (r.status === 401 ? null : r.ok ? r.json() : null))
      .then((j: ReWatchApi | null) => {
        if (!j || j.needsSetup) { setState('hidden'); return }
        setState(j.items.some(it => it.lawd === lawd && it.apt === apt) ? 'on' : 'off')
      }).catch(() => setState('hidden'))
  }, [lawd, apt])
  useEffect(() => { check() }, [check])

  if (state === 'hidden') return null
  const on = state === 'on'
  const toggle = async () => {
    if (state === 'busy') return
    setState('busy')
    if (on) await fetch(`/api/re-watchlist?lawd=${lawd}&apt=${encodeURIComponent(apt)}`, { method: 'DELETE' }).catch(() => {})
    else await fetch('/api/re-watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lawd, apt, area }) }).catch(() => {})
    check()
  }
  return (
    <button onClick={toggle} title={on ? '관심 단지 해제' : '관심 단지 등록 — 부동산 대시보드에서 모니터링'} style={{
      padding: '3px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
      background: on ? `${TK.amber400}22` : TK.bg3, color: on ? TK.amber400 : TK.sub,
      border: `1px solid ${on ? TK.amber400 : TK.border}`,
    }}>{state === 'busy' ? '…' : on ? '⭐ 관심 단지' : '☆ 관심 등록'}</button>
  )
}
