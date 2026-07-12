'use client'
// 🚦 타점 신호등 배지 — 추천 카드 공용(통합추천·리밸런싱·퀀트빌더·로테이션). 점수와 무관한 WHEN 정보 레이어.
import type { EntryTiming } from '@/lib/entryTiming'

const COL: Record<string, { c: string; bg: string; bd: string }> = {
  green: { c: '#4ade80', bg: '#14532d33', bd: '#22c55e55' },
  yellow: { c: '#eab308', bg: '#42200633', bd: '#eab30855' },
  red: { c: '#f87171', bg: '#7f1d1d33', bd: '#ef444455' },
}

export default function TimingBadge({ t, market, compact = false }: { t: EntryTiming | null | undefined; market?: string; compact?: boolean }) {
  if (!t) return null
  const s = COL[t.light]
  const fmtStop = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (compact) return (
    <span title={`${t.guide}${t.atrStop != null ? ` · 🛡ATR손절 ${fmtStop(t.atrStop)}` : ''}`}
      style={{ fontSize: 9.5, fontWeight: 800, color: s.c, background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  )
  // 🎼 라쉬케 칩 — 모든 카드에 노출(발견성). 단 문구·색은 상태별 정직하게: 첫눌림목=최적타점 / green 추세확립='추세 진행중'(muted, 중복 주장 안 함) / 미확립=연쇄 단계
  const rk = t.raschke
  let rkChip: { label: string; c: string } | null = null
  if (rk) {
    if (rk.stage === 4) rkChip = { label: rk.parabolicRun ? '🎼 첫 눌림목(급등 주의)' : '🎼 첫 눌림목(타점)', c: rk.parabolicRun ? '#fb923c' : '#4ade80' }
    else if (t.light === 'green') rkChip = { label: '🎼 추세 진행중', c: '#8599ae' }   // 이미 상승 추세 — 연쇄 트리거 불필요(관망 아님)
    else {
      const m: Record<number, string> = { 0: '🎼 연쇄 대기', 1: '🎼 CCI 신호탄', 2: '🎼 RSI50 돌파', 3: '🎼 영선 돌파' }
      rkChip = { label: m[rk.stage], c: rk.stage === 3 ? '#4ade80' : rk.stage === 0 ? '#8599ae' : '#eab308' }
    }
  }
  // 🎼 행동 가치 있는 라쉬케만 겉면에 1줄 설명(펼침 불필요) — 첫 눌림목·미확립 종목의 연쇄 단계. green '추세 진행중'은 칩만(줄 생략)
  let rkLine: string | null = null
  if (rk) {
    if (rk.stage === 4) rkLine = rk.parabolicRun
      ? '🎼 첫 눌림목이나 직전 급등(수직) — 첫 눌림목도 함정 가능, 반등·거래량 확인 후 소액.'
      : `🎼 첫 눌림목 = 추세 확립 후 고점 대비 ${rk.pullbackPct}% 되돌림, ${t.light === 'green' ? '추가 진입(불타기)' : '1차 진입'} 적기.`
    else if (t.light !== 'green') {
      const gm: Record<number, string> = {
        1: '🎼 CCI 신호탄(선행) — 성급한 진입보다 RSI50 돌파(에너지) 먼저 확인.',
        2: '🎼 RSI50 돌파(에너지 장악) — MACD 영선 돌파(추세 확정)까지 기다리면 확률↑.',
        3: '🎼 MACD 영선 돌파(추세 확정) — 첫 눌림목(숨 고르기) 오면 그때가 최적 진입.',
      }
      rkLine = gm[rk.stage] ?? null
    }
  }
  // 📊 매물·평단 지지 칩 — 신호등(추세)·라쉬케(모멘텀)와 다른 '매물/평단' 축. 행동 가치 있는 것만(탄탄/약함), 혼조는 생략
  const sp = t.supply
  let spChip: { label: string; c: string; tip: string } | null = null
  if (sp && (sp.vwap != null || sp.poc != null)) {
    if (sp.supportStrong && !sp.overExtended) spChip = { label: '📊 지지 탄탄', c: '#38bdf8', tip: '기관평단(VWAP)·매물대(POC) 둘 다 가까운 아래 = 눌림 지지 확보' }
    else if (sp.supportStrong && sp.overExtended) spChip = { label: '📊 과대이격', c: '#f59e0b', tip: '평단·매물대가 크게 아래 = 지지선 멀다, 되돌림 낙폭 큼(추격 주의)' }
    else if (sp.supportWeak) spChip = { label: '📊 지지 약함', c: '#fb923c', tip: '평단·매물 대다수가 위 = 지지 얇음, 되돌림 리스크' }
  }
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 8, padding: '6px 10px', fontSize: 10.5, lineHeight: 1.55 }}>
      <b style={{ color: s.c }}>{t.label}</b>
      {rkChip && <span title="라쉬케 모멘텀 연쇄 — 상세는 매매 플랜에서" style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: rkChip.c, background: `${rkChip.c}18`, border: `1px solid ${rkChip.c}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{rkChip.label}</span>}
      {spChip && <span title={spChip.tip} style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: spChip.c, background: `${spChip.c}18`, border: `1px solid ${spChip.c}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{spChip.label}</span>}
      <span style={{ color: '#aab6c4' }}> — {t.guide}</span>
      {t.atrStop != null && <span style={{ color: '#c4b5fd' }}> · 🛡 손절 참고 {fmtStop(t.atrStop)}</span>}
      {rkLine && <div style={{ color: '#f0abfc', marginTop: 3, fontSize: 10 }}>{rkLine}</div>}
    </div>
  )
}
