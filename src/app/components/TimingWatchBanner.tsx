'use client'
// 🔔 오늘의 타점 신호 배너 — 내 보유 종목의 매수/매도 타점이 어제와 달라졌을 때만 조용히 등장(변화 없으면 렌더 0).
//    신호등(EMA·구름) + 🎼라쉬케(첫눌림목·하락다이버전스) + 🔥스퀴즈(분출) + 📊매물·평단(지지 전환)을 한 배너에. ⛔ 알림만·자동주문 없음.
import { useState, useEffect } from 'react'
import type { WatchSig } from '@/app/api/cron/timing-watch/route'
import { TK } from '@/lib/theme'

export default function TimingWatchBanner() {
  const [sigs, setSigs] = useState<WatchSig[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/timing-watch').then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.sigs?.length) setSigs(j.sigs) })
      .catch(() => {})
  }, [])

  if (!sigs.length || dismissed) return null

  const sells = sigs.filter(s => s.kind === 'sell')
  const buys = sigs.filter(s => s.kind === 'buy')

  const Chip = ({ s }: { s: WatchSig }) => {
    const c = s.kind === 'sell' ? TK.red400 : TK.green400
    const bg = s.kind === 'sell' ? '#7f1d1d33' : '#14532d33'
    // ⚖️ 타점(WHEN) vs 펀더(WHAT) 충돌 융합 표기 — 매수 타점인데 Jarvis 매도검토(또는 역방향)면 한 칩에 병기(모순 방지)
    const clash = s.fund && ((s.kind === 'buy' && s.fund === 'SELL') || (s.kind === 'sell' && s.fund === 'BUY'))
    const clashTxt = s.kind === 'buy' ? '⚠️ 펀더 매도검토' : '🟢 펀더 매수기회'
    const clashTip = s.kind === 'buy'
      ? '기술 타점은 매수 신호지만 Jarvis 펀더멘탈 진단은 매도 검토 — 신규 진입·불타기 자제, 반등은 정리 기회로 참고(WHAT은 펀더멘탈 우선)'
      : 'Jarvis 펀더멘탈 진단은 매수 기회 — 이 기술 신호는 단기 경계 참고로만(펀더 멀쩡한 하락에 저점 매도 주의)'
    return (
      <span title={clash ? `${s.detail} · ${clashTip}` : s.detail} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, border: `1px solid ${c}55`, borderRadius: 7, padding: '3px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
        <b style={{ color: TK.slate200 }}>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'} {s.name}</b>
        <span style={{ color: TK.sub, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>{s.ticker}</span>
        <b style={{ color: c, fontSize: 10 }}>{s.icon} {s.label}</b>
        {clash && <b style={{ color: s.kind === 'buy' ? TK.red400 : TK.green400, fontSize: 9.5, borderLeft: `1px solid ${TK.border}`, paddingLeft: 5 }}>{clashTxt}</b>}
      </span>
    )
  }

  return (
    <div style={{ background: `linear-gradient(135deg,#151226,${TK.bg1})`, border: `1px solid ${TK.violet400}55`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.violet300 }}>🔔 오늘의 타점 신호</span>
      {sells.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: TK.red400 }}>🔴 매도·경계</span>}
      {sells.slice(0, 5).map(s => <Chip key={s.ticker + s.market + s.label} s={s} />)}
      {buys.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: TK.green400, marginLeft: sells.length ? 4 : 0 }}>🟢 매수 기회</span>}
      {buys.slice(0, 5).map(s => <Chip key={s.ticker + s.market + s.label} s={s} />)}
      {sigs.length > 10 && <span style={{ fontSize: 10, color: TK.sub2 }}>외 {sigs.length - 10}건</span>}
      <span style={{ fontSize: 10.5, color: TK.sub9 }}>어제 대비 전환 · 기술적 차트에서 확인</span>
      <button onClick={() => setDismissed(true)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TK.sub, cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}
