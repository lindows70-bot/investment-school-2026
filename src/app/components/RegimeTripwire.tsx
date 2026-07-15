'use client'
// 🔔 국면 전환 트립와이어 — 계절/금리가 뒤집힐 때 내 포트의 유↔불리 종목을 능동 경고(FOMC→계절→포트 닫힌 루프)
import { useState, useEffect } from 'react'
import type { RegimeTripwireResult, RegimeFlip } from '@/app/api/regime-tripwire/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const dnm = (f: RegimeFlip) => f.market === 'KR' ? (f.name || f.ticker).slice(0, 10) : f.ticker.toUpperCase()
const nm = (s: { ticker: string; name: string; market: 'KR' | 'US' }) => s.market === 'KR' ? (s.name || s.ticker).slice(0, 10) : s.ticker.toUpperCase()

export default function RegimeTripwire() {
  const [d, setD] = useState<RegimeTripwireResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/regime-tripwire', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}`, color: TK.sub, fontSize: 12 }}>🔔 국면 전환 감시 중…</div>
  if (!d) return null

  const hasTransition = d.transition != null && d.flips.length > 0
  const down = d.flips.filter(f => f.direction === 'down')
  const up = d.flips.filter(f => f.direction === 'up')
  const accent = hasTransition ? (down.length > 0 ? TK.red500 : TK.green500) : TK.slate600

  return (
    <div style={{ background: `${accent}10`, border: `1px solid ${accent}55`, borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: hasTransition ? 8 : 0 }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>국면 전환 트립와이어</span>
        <span style={{ display: 'inline-flex', gap: 6, marginLeft: 4 }}>
          <span style={{ background: TK.bg3, color: TK.blue300, border: `1px solid ${TK.blue400}44`, borderRadius: 7, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>🇺🇸 {d.usSeasonKo}</span>
          <span style={{ background: TK.bg3, color: TK.blue300, border: `1px solid ${TK.blue400}44`, borderRadius: 7, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>🇰🇷 {d.krSeasonKo}</span>
        </span>
        <span style={{ marginLeft: 'auto', color: TK.sub2, fontSize: 11 }}>
          {hasTransition
            ? <b style={{ color: accent }}>⚡ {d.transition!.daysSince}일 전 국면 전환</b>
            : <>✅ {d.stableDays >= 1 ? `국면 안정 · ${d.stableDays}일째 유지` : '국면 감시 시작'}{d.nextFomc ? ` · 다음 FOMC ${d.nextFomc}` : ''}</>}
        </span>
      </div>

      {hasTransition && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: TK.sub15, fontSize: 11.5, lineHeight: 1.6 }}>
            국면이 바뀌며 내 보유종목의 계절 유불리가 재편됐습니다. 비중·보유 점검이 필요합니다.
          </div>
          {down.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9, padding: '8px 12px' }}>
              <div style={{ color: TK.red400, fontWeight: 700, fontSize: 11.5, marginBottom: 5 }}>⚠️ 불리해진 {down.length}종목 — 이 계절 역풍</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {down.map(f => <span key={f.ticker} style={{ background: TK.bg3, color: TK.red300, border: `1px solid ${TK.red500}55`, borderRadius: 7, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 }}>{dnm(f)} <span style={{ color: TK.slate500, fontWeight: 400 }}>{tagKo(f.from)}→{tagKo(f.to)}</span></span>)}
              </div>
            </div>
          )}
          {up.length > 0 && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 9, padding: '8px 12px' }}>
              <div style={{ color: TK.green500, fontWeight: 700, fontSize: 11.5, marginBottom: 5 }}>🌱 유리해진 {up.length}종목 — 이 계절 순풍</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {up.map(f => <span key={f.ticker} style={{ background: TK.bg3, color: TK.green300, border: `1px solid ${TK.green500}55`, borderRadius: 7, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 }}>{dnm(f)} <span style={{ color: TK.slate500, fontWeight: 400 }}>{tagKo(f.from)}→{tagKo(f.to)}</span></span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasTransition && (
        <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: TK.green500, fontSize: 11, fontWeight: 700 }}>🌱 계절 유리 {d.favoredNow}</span>
            {d.favoredList.map(s => <span key={s.ticker} style={{ background: TK.bg3, color: TK.green300, border: `1px solid ${TK.green500}44`, borderRadius: 7, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 }}>{nm(s)}</span>)}
            {d.unfavoredNow > 0 && <>
              <span style={{ color: TK.amber500, fontSize: 11, fontWeight: 700, marginLeft: 4 }}>⚠️ 불리 {d.unfavoredNow}</span>
              {d.unfavoredList.map(s => <span key={s.ticker} style={{ background: TK.bg3, color: '#fcd34d', border: `1px solid ${TK.amber500}44`, borderRadius: 7, padding: '2px 9px', fontSize: 11.5, fontWeight: 700 }}>{nm(s)}</span>)}
            </>}
          </div>
          <div style={{ color: TK.sub13, fontSize: 10.5, lineHeight: 1.6 }}>국면이 바뀌면 어떤 종목이 유↔불리로 뒤집히는지 여기서 즉시 경고합니다.</div>
        </div>
      )}
    </div>
  )
}

function tagKo(t: 'favored' | 'neutral' | 'unfavored') {
  return t === 'favored' ? '유리' : t === 'unfavored' ? '불리' : '중립'
}
