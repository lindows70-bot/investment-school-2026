'use client'

/**
 * 🤖 JarvisMorningBriefing — 모닝 포트폴리오 처방전 (2단계 · 대시보드 UI · 팝업 모달)
 *
 * 새벽 Cron이 적재한 user_daily_briefings에서 '본인 + 최신 base_date' 브리핑을 읽어
 * 아침에 한 번 자동으로 팝업(모달)으로 띄운다. 닫으면 작은 칩으로 언제든 다시 열 수 있다.
 * RLS("own briefings read")로 본인 행만 조회. 테이블 미생성/에러/빈 결과는 graceful(아무것도 안 띄움).
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'

interface Rec { ticker: string; name: string; reason: string; peg: number | null; opMargin: number | null }
interface Briefing {
  base_date: string
  signal_type: 'SELL' | 'BUY' | 'HOLD'
  ticker: string
  stock_name: string | null
  briefing_title: string | null
  briefing_content: string | null
  recommendations: Rec[] | null
}

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', purple: '#a78bfa',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const SIG: Record<'SELL' | 'BUY', { label: string; emoji: string; color: string }> = {
  SELL: { label: '매도 검토', emoji: '⚠️', color: C.red },
  BUY:  { label: '매수 기회', emoji: '📈', color: C.green },
}

export default function JarvisMorningBriefing() {
  const [items, setItems] = useState<Briefing[] | null>(null)
  const [date, setDate] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)   // 매수/매도 시 재조회 트리거

  // 보유종목 변경 이벤트 → 즉시 재조회(매도 종목 브리핑 같은 화면에서 바로 사라지게)
  useEffect(() => {
    const onUpdate = () => setReloadTick(t => t + 1)
    window.addEventListener('portfolio-updated', onUpdate)
    return () => window.removeEventListener('portfolio-updated', onUpdate)
  }, [])

  // 데이터 로드 + 하루 1회 자동 오픈(localStorage 게이트)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) { if (alive) setItems([]); return }
        const { data, error } = await sb
          .from('user_daily_briefings')
          .select('base_date,signal_type,ticker,stock_name,briefing_title,briefing_content,recommendations')
          .eq('user_id', user.id)
          .order('base_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(40)
        if (error || !data) { if (alive) setItems([]); return }
        const rows = data as Briefing[]
        const latest = rows.length ? rows[0].base_date : ''
        // 현재 보유 종목과 교차 필터 — 매도한 종목의 묵은 브리핑(스냅샷)을 즉시 숨김
        const { data: inv } = await sb.from('investments').select('ticker').eq('user_id', user.id)
        const held = new Set((inv ?? []).map(r => String(r.ticker).toUpperCase()))
        const todays = rows.filter(r => r.base_date === latest && r.signal_type !== 'HOLD' && held.has(String(r.ticker).toUpperCase()))
        todays.sort((a, b) => (a.signal_type === 'SELL' ? 0 : 1) - (b.signal_type === 'SELL' ? 0 : 1))
        if (!alive) return
        setItems(todays); setDate(latest)
        // 오늘 아직 안 본 경우에만 자동 오픈
        if (todays.length) {
          const seen = typeof window !== 'undefined' ? window.localStorage.getItem('jarvis-brief-seen') : null
          if (seen !== latest) {
            setOpen(true)
            try { window.localStorage.setItem('jarvis-brief-seen', latest) } catch { /* ignore */ }
          }
        }
      } catch { if (alive) setItems([]) }
    })()
    return () => { alive = false }
  }, [reloadTick])

  // 닫기 = 오늘 다시 자동 팝업 안 뜨도록 날짜 플래그 갱신(X·배경·ESC·버튼 공통)
  const dismiss = useCallback(() => {
    try { if (date) window.localStorage.setItem('jarvis-brief-seen', date) } catch { /* ignore */ }
    setOpen(false)
  }, [date])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (items == null || items.length === 0) return null   // 시그널 없으면 아무것도 표시 안 함

  const dateLabel = date ? `${parseInt(date.slice(5, 7), 10)}월 ${parseInt(date.slice(8, 10), 10)}일` : ''
  const sellN = items.filter(i => i.signal_type === 'SELL').length
  const buyN = items.length - sellN

  // ── 재호출 칩 (인라인, 한 줄) ──
  const Chip = (
    <button
      onClick={() => setOpen(true)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        padding: '8px 14px', borderRadius: 999, fontFamily: FONT, alignSelf: 'flex-start',
        background: `linear-gradient(135deg, ${C.purple}1f, ${C.cyan}14)`, border: `1px solid ${C.purple}55`, color: C.text,
      }}
    >
      <span style={{ fontSize: 15 }}>🤖</span>
      <span style={{ fontSize: 12.5, fontWeight: 800 }}>Jarvis 모닝 처방전</span>
      {sellN > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.red, background: `${C.red}1f`, padding: '1px 7px', borderRadius: 999 }}>매도검토 {sellN}</span>}
      {buyN > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.green, background: `${C.green}1f`, padding: '1px 7px', borderRadius: 999 }}>매수기회 {buyN}</span>}
      <span style={{ fontSize: 11, color: C.textLow }}>보기 ▸</span>
    </button>
  )

  // ── 모달 ──
  const Modal = open ? createPortal(
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 16,
        fontFamily: FONT, animation: 'jarvisFade .18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 660, maxHeight: '84vh', display: 'flex', flexDirection: 'column',
          background: C.card, border: `1px solid ${C.purple}55`, borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        {/* 헤더 (고정) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Jarvis 모닝 포트폴리오 처방전</span>
          {dateLabel && <span style={{ fontSize: 11, color: C.textLow }}>· {dateLabel} 기준</span>}
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontWeight: 700 }}>AI 비서</span>
          <button
            onClick={dismiss} aria-label="닫기"
            style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.border}`, background: C.card2, color: C.textSub, fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        {/* 본문 (스크롤) */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((b, i) => {
            const s = SIG[b.signal_type as 'SELL' | 'BUY']
            return (
              <div key={i} style={{ padding: '13px 15px', borderRadius: 12, background: C.card2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: s.color, padding: '2px 8px', borderRadius: 20, background: `${s.color}18` }}>{s.emoji} {s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{b.stock_name || b.ticker}</span>
                  <span style={{ fontSize: 10, color: C.textLow, fontFamily: 'monospace' }}>{b.ticker}</span>
                </div>
                {b.briefing_title && <div style={{ fontSize: 12.5, fontWeight: 800, color: s.color, marginBottom: 4 }}>{b.briefing_title}</div>}
                <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.7 }}>{b.briefing_content}</div>
                {b.recommendations && b.recommendations.length > 0 && (
                  <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: C.textLow }}>같은 업종 대안</span>
                    {b.recommendations.map((r, j) => (
                      <span key={j} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: `${C.cyan}14`, border: `1px solid ${C.cyan}33`, color: C.text }}>
                        {r.name}{r.peg != null ? <span style={{ color: C.cyan, fontFamily: 'monospace', fontWeight: 700, marginLeft: 4 }}>PEG {r.peg.toFixed(2)}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 푸터 (고정) — 안내 + 오늘만 닫기 */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
            🤖 매일 새벽 보유 종목을 정량 룰(PEG·영업이익률·FCF·내부자매집)로 점검해 발동된 시그널만 브리핑합니다 · 교육용 참고이며 투자 추천이 아닙니다.
          </div>
          <button
            onClick={dismiss}
            style={{ flexShrink: 0, cursor: 'pointer', padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, color: C.textSub, fontSize: 11.5, fontWeight: 700 }}
          >오늘 하루 그만 보기</button>
        </div>
      </div>
      <style>{`@keyframes jarvisFade{from{opacity:0}to{opacity:1}}`}</style>
    </div>,
    document.body
  ) : null

  return (<>{Chip}{Modal}</>)
}
