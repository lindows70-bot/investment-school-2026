'use client'
// 🚦 타점 신호등 배지 — 추천 카드 공용(통합추천·리밸런싱·퀀트빌더·로테이션). 점수와 무관한 WHEN 정보 레이어.
import type { EntryTiming } from '@/lib/entryTiming'
import { curSymbol } from '@/lib/globalTickers'
import { TK } from '@/lib/theme'

const COL: Record<string, { c: string; bg: string; bd: string }> = {
  green: { c: TK.green400, bg: '#14532d33', bd: `${TK.green500}55` },
  yellow: { c: TK.yellow500, bg: '#42200633', bd: `${TK.yellow500}55` },
  red: { c: TK.red400, bg: '#7f1d1d33', bd: `${TK.red500}55` },
}

export default function TimingBadge({ t, market, ticker, compact = false }: { t: EntryTiming | null | undefined; market?: string; ticker?: string; compact?: boolean }) {
  if (!t) return null
  const s = COL[t.light]
  // 통화 기호 — ticker 접미사 인식(유럽 명품주 €·CHF 등). ticker 미전달 시 기존 KR/US 동작 그대로
  const cs = curSymbol(ticker ?? '', market === 'KR' ? 'KR' : 'US')
  const fmtStop = (n: number) => market === 'KR' ? `₩${Math.round(n).toLocaleString()}` : `${cs}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (compact) {
    const lightChip = (
      <span title={`${t.guide}${t.atrStop != null ? ` · 🛡ATR손절 ${fmtStop(t.atrStop)}` : ''}`}
        style={{ fontSize: 9.5, fontWeight: 800, color: s.c, background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
        {t.label}
      </span>
    )
    // ⬛ 관망(추세 강도 약함·ADX<20) — 신호등 미확립(green 아님)일 때만. 돈 몰려도 ETF 추세 약하면 가짜 돌파 주의
    const chop = !!(t.supply?.choppy && t.light !== 'green')
    // ⚓ 최근 5봉 내 기관평단(VWAP) 회복/이탈 = 주도권 교체 후보 — 매수/매도 판단의 맥락(오래된 크로스는 노이즈라 생략)
    const vx = t.supply?.vwapCross && t.supply.vwapCross.barsAgo <= 5 ? t.supply.vwapCross : null
    if (!chop && !vx) return lightChip
    return (
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        {lightChip}
        {chop && <span title={`추세 강도 약함(ADX ${t.supply!.adx}) — 방향 확신 낮아 돌파도 가짜(휩쏘) 가능, 방향 확정 후 진입`}
          style={{ fontSize: 9.5, fontWeight: 800, color: TK.slate400, background: `${TK.slate400}18`, border: `1px solid ${TK.slate400}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>⬛관망</span>}
        {vx && <span title={vx.dir === 'up' ? '기관평단(VWAP) 위로 복귀 — 주도권 교체 후보(확인 캔들·신호등과 함께)' : 'VWAP 아래로 이탈 — 본전 매도 압력 구간(주도권 교체 후보·단독 신호 아님)'}
          style={{ fontSize: 9.5, fontWeight: 800, color: vx.dir === 'up' ? TK.green400 : TK.red400, background: `${vx.dir === 'up' ? TK.green400 : TK.red400}18`, border: `1px solid ${vx.dir === 'up' ? TK.green400 : TK.red400}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
          ⚓{vx.dir === 'up' ? '평단 회복' : '평단 이탈'}</span>}
      </span>
    )
  }
  // 🎼 라쉬케 칩 — 모든 카드에 노출(발견성). 단 문구·색은 상태별 정직하게: 첫눌림목=최적타점 / green 추세확립='추세 진행중'(muted, 중복 주장 안 함) / 미확립=연쇄 단계
  const rk = t.raschke
  let rkChip: { label: string; c: string } | null = null
  if (rk) {
    if (rk.stage === 4) rkChip = { label: rk.parabolicRun ? '🎼 첫 눌림목(급등 주의)' : '🎼 첫 눌림목(타점)', c: rk.parabolicRun ? TK.orange400 : TK.green400 }
    else if (t.light === 'green') rkChip = { label: '🎼 추세 진행중', c: TK.sub3 }   // 이미 상승 추세 — 연쇄 트리거 불필요(관망 아님)
    else {
      const m: Record<number, string> = { 0: '🎼 연쇄 대기', 1: '🎼 CCI 신호탄', 2: '🎼 RSI50 돌파', 3: '🎼 영선 돌파' }
      rkChip = { label: m[rk.stage], c: rk.stage === 3 ? TK.green400 : rk.stage === 0 ? TK.sub3 : TK.yellow500 }
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
    if (sp.choppy && t.light !== 'green') spChip = { label: '⬛ 관망(추세 약함)', c: TK.slate400, tip: `추세 강도 약함(ADX ${sp.adx}) — 방향 확신 낮아 돌파도 가짜(휩쏘) 가능, 확정 후 진입` }
    else if (sp.supportStrong && !sp.overExtended) spChip = { label: '📊 지지 탄탄', c: TK.sky400, tip: '기관평단(VWAP)·매물대(POC) 둘 다 가까운 아래 = 눌림 지지 확보' }
    else if (sp.supportStrong && sp.overExtended) spChip = { label: '📊 과대이격', c: TK.amber500, tip: '평단·매물대가 크게 아래 = 지지선 멀다, 되돌림 낙폭 큼(추격 주의)' }
    else if (sp.supportWeak) spChip = { label: '📊 지지 약함', c: TK.orange400, tip: '평단·매물 대다수가 위 = 지지 얇음, 되돌림 리스크' }
  }
  // ⚓ VWAP 주도권 교체(최근 5봉) — 매수: 평단 회복=매수자 우위 전환 / 매도: 평단 이탈=본전 매도 압력. 맥락(단독 신호 아님)
  let vwChip: { label: string; c: string; tip: string } | null = null
  if (sp?.vwapCross && sp.vwapCross.barsAgo <= 5) {
    const ago = sp.vwapCross.barsAgo === 0 ? '오늘' : `${sp.vwapCross.barsAgo}봉 전`
    vwChip = sp.vwapCross.dir === 'up'
      ? { label: `⚓ 평단 회복(${ago})`, c: TK.green400, tip: '직전 바닥 이후 매수자 평균단가(VWAP) 위로 복귀 — 주도권 교체 후보. VWAP가 있는 쪽 편에(확인 캔들과 함께)' }
      : { label: `⚓ 평단 이탈(${ago})`, c: TK.red400, tip: 'VWAP 아래로 이탈 — 본전 매도 압력 구간 진입(주도권 교체 후보·단독 신호 아님)' }
  }
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 8, padding: '6px 10px', fontSize: 10.5, lineHeight: 1.55 }}>
      <b style={{ color: s.c }}>{t.label}</b>
      {rkChip && <span title="라쉬케 모멘텀 연쇄 — 상세는 매매 플랜에서" style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: rkChip.c, background: `${rkChip.c}18`, border: `1px solid ${rkChip.c}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{rkChip.label}</span>}
      {spChip && <span title={spChip.tip} style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: spChip.c, background: `${spChip.c}18`, border: `1px solid ${spChip.c}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{spChip.label}</span>}
      {vwChip && <span title={vwChip.tip} style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: vwChip.c, background: `${vwChip.c}18`, border: `1px solid ${vwChip.c}55`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{vwChip.label}</span>}
      <span style={{ color: TK.sub5 }}> — {t.guide}</span>
      {t.atrStop != null && <span style={{ color: TK.violet300 }}> · 🛡 손절 참고 {fmtStop(t.atrStop)}</span>}
      {rkLine && <div style={{ color: TK.fuchsia300, marginTop: 3, fontSize: 10 }}>{rkLine}</div>}
    </div>
  )
}
