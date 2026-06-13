'use client'
// 🔥 오늘 시장의 눈 — 마켓 카탈리스트 배너(메가 뉴스 ≤3 + 수급 블랙홀 레이더 + 자비스 한줄 처방)
import { useState, useEffect } from 'react'
import type { MarketCatalystResult } from '@/app/api/market-catalyst/route'

const CARD = '#161b25', BORDER = '#1e293b'

export default function MarketCatalystBanner() {
  const [d, setD] = useState<MarketCatalystResult | null>(null)
  const [open, setOpen] = useState<number | null>(0)   // 첫 카탈리스트는 기본 펼침
  const [collapsed, setCollapsed] = useState(true)      // 평소엔 접어둠(메인 화면 차지 최소화) — 헤더 클릭 시 펼침

  useEffect(() => {
    let alive = true
    fetch('/api/market-catalyst', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
    return () => { alive = false }
  }, [])

  // 데이터 없으면 통째로 숨김(로딩 스피너로 대시보드 상단을 막지 않음)
  if (!d || (d.catalysts.length === 0 && d.movers.length === 0)) return null

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.10),rgba(239,68,68,0.05))', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 12, padding: '12px 16px' }}>
      {/* 헤더 — 클릭하면 펼침/접힘. 접힌 상태에선 1순위 카탈리스트만 살짝 미리보기 */}
      <button onClick={() => setCollapsed(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', marginBottom: collapsed ? 0 : (d.catalysts.length > 0 ? 8 : 4) }}>
        <span style={{ fontSize: 15 }}>🔥</span>
        <span style={{ color: '#fb923c', fontWeight: 800, fontSize: 13.5 }}>오늘 시장의 눈 — 마켓 카탈리스트</span>
        {collapsed
          ? <span style={{ color: '#aab6c4', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.catalysts[0]?.title ?? d.marketMood ?? ''}</span>
          : (d.marketMood && <span style={{ color: '#aab6c4', fontSize: 11 }}>{d.marketMood}</span>)}
        <span style={{ marginLeft: 'auto', color: '#fb923c', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{collapsed ? `▼ 펼치기${d.catalysts.length ? ` (${d.catalysts.length})` : ''}` : '▲ 접기'}</span>
      </button>

      {!collapsed && (<>
      {/* 메가 카탈리스트 ≤3 */}
      {d.catalysts.map((c, i) => (
        <div key={i} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
          <button onClick={() => setOpen(o => o === i ? null : i)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '7px 0', textAlign: 'left' }}>
            <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 11 }}>{['①', '②', '③'][i]}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12.5, flex: 1 }}>{c.title}</span>
            {c.tickers.slice(0, 4).map(t => (
              <span key={t} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '1px 7px', color: '#93c5fd', fontSize: 9.5, fontWeight: 700 }}>{t}</span>
            ))}
            <span style={{ color: '#6e7f8f', fontSize: 10 }}>{open === i ? '▲' : '▼'}</span>
          </button>
          {open === i && (
            <div style={{ padding: '0 0 9px 22px' }}>
              <div style={{ color: '#cbd5e1', fontSize: 11.5, lineHeight: 1.65 }}>{c.why}</div>
              <div style={{ marginTop: 5, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '7px 11px', color: '#dbe3ec', fontSize: 11, lineHeight: 1.65 }}>
                🤖 <b style={{ color: '#fbbf24' }}>자비스 한줄 처방</b> — {c.jarvisTip}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 수급 블랙홀 레이더(정량) */}
      {d.movers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          <span style={{ color: '#8a9aaa', fontSize: 10.5, fontWeight: 700 }}>📡 수급 블랙홀:</span>
          {d.movers.map(m => (
            <span key={`${m.market}:${m.ticker}`} title={m.note}
              style={{ background: CARD, border: `1px solid ${(m.volRatio ?? 0) >= 3 ? '#f8717155' : BORDER}`, borderRadius: 6, padding: '2px 9px', fontSize: 10.5, color: '#cbd5e1', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              {m.market === 'KR' ? '🇰🇷' : '🇺🇸'} <b>{m.market === 'KR' ? m.name.slice(0, 8) : m.ticker}</b>
              {m.volRatio != null && <span style={{ color: m.volRatio >= 3 ? '#f87171' : '#fb923c', fontWeight: 800 }}>거래량 {m.volRatio}배</span>}
              {m.changePct != null && <span style={{ color: m.changePct > 0 ? '#4ade80' : '#f87171' }}>{m.changePct > 0 ? '+' : ''}{m.changePct}%</span>}
              {m.market === 'KR' && <span style={{ color: '#22d3ee' }}>{m.note}</span>}
            </span>
          ))}
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 7, lineHeight: 1.5 }}>
        ※ 뉴스는 Google News 실시간 헤드라인 요약(Gemini·헤드라인에 있는 사건만), 수급은 Yahoo 트렌딩 거래량·KR 쌍끌이 실측 · 3h 캐시 · 핫하다고 사라는 뜻이 아닙니다 — 진단 탭 함정 레이더부터 확인하세요 · 교육용.
      </div>
      </>)}
    </div>
  )
}
