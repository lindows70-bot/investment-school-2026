'use client'
// ⭐ 내 관심 단지 — 부동산 워치리스트(우리 집·이사 갈 집 모니터링). 단지 리서치에서 ⭐로 등록, 여기서 시세·국면 한눈에.
import { useState, useEffect, useCallback } from 'react'
import { TK } from '@/lib/theme'
import type { ReWatchApi } from '@/app/api/re-watchlist/route'

const CARD = TK.card, BORDER = TK.border

export default function ReWatchlist() {
  const [d, setD] = useState<ReWatchApi | null>(null)
  const [authed, setAuthed] = useState(true)

  const load = useCallback(() => {
    fetch('/api/re-watchlist').then(r => {
      if (r.status === 401) { setAuthed(false); return null }
      return r.ok ? r.json() : null
    }).then(j => { if (j) setD(j) }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  if (!authed || !d) return null
  if (d.needsSetup) return (
    <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: 12, padding: '10px 14px', fontSize: 11, color: TK.sub9 }}>
      ⭐ 관심 단지 기능을 켜려면 Supabase SQL Editor에서 <b style={{ color: TK.slate300 }}>supabase/re_watchlist.sql</b>을 1회 실행하세요(관리자).
    </div>
  )
  if (!d.items.length) return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 14px', fontSize: 11.5, color: TK.sub }}>
      ⭐ <b style={{ color: TK.slate300 }}>관심 단지</b>가 비어 있습니다 — <a href="/real-estate/apt" style={{ color: TK.orange400 }}>단지 리서치</a>에서 우리 집·이사 갈 단지를 ⭐로 등록하면 여기서 시세·국면을 모니터링합니다.
    </div>
  )

  const remove = async (id: number) => { await fetch(`/api/re-watchlist?id=${id}`, { method: 'DELETE' }); load() }

  return (
    <div style={{ background: CARD, border: `1px solid ${TK.amber400}44`, borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <b style={{ fontSize: 14, color: TK.slate100 }}>⭐ 내 관심 단지</b>
        <span style={{ fontSize: 10.5, color: TK.sub2 }}>최근 6개월 실거래 중위 · 클릭 = 단지 리서치</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        {d.items.map(it => (
          <div key={it.id} style={{ flex: '1 1 240px', maxWidth: 340, background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px', position: 'relative' }}>
            <button onClick={() => remove(it.id)} title="관심 해제" style={{ position: 'absolute', top: 6, right: 8, background: 'transparent', border: 'none', color: TK.sub, cursor: 'pointer', fontSize: 12 }}>✕</button>
            <a href={`/real-estate/apt?lawd=${it.lawd}&apt=${encodeURIComponent(it.apt)}`} style={{ textDecoration: 'none' }}>
              <div style={{ color: TK.slate100, fontWeight: 800, fontSize: 12.5 }}>
                {it.apt}{it.area ? <span style={{ color: TK.sub, fontWeight: 700 }}> {it.area}㎡</span> : null}
              </div>
              <div style={{ color: TK.sub, fontSize: 10, marginTop: 1 }}>{it.regionName} · {it.regionPhase ?? '국면 —'}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'baseline' }}>
                <span style={{ color: TK.slate100, fontSize: 16, fontWeight: 900, fontFamily: 'monospace' }}>{it.saleMed6 != null ? `${it.saleMed6}억` : '—'}</span>
                <span style={{ color: TK.green400, fontSize: 11, fontWeight: 700 }}>전세 {it.jeonseMed6 != null ? `${it.jeonseMed6}억` : '—'}{it.jeonseRatio != null ? ` (${it.jeonseRatio}%)` : ''}</span>
              </div>
              <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 3 }}>
                {it.dealsN6 > 0 ? `6개월 매매 ${it.dealsN6}건 · 최근 ${it.lastDeal ?? '—'}` : '최근 6개월 매매 실거래 없음'}
              </div>
            </a>
          </div>
        ))}
      </div>
      <div style={{ color: TK.sub, fontSize: 10, marginTop: 8 }}>⚠️ 실거래 신고(~30일) 지연 반영 · 면적대 ±2㎡ 중위 · 매수·매도 신호가 아닌 모니터링(교육용)</div>
    </div>
  )
}
