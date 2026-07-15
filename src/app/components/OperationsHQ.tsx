'use client'
// 🎛️ AI 포트폴리오 운용 본부 — 진단 헤더(4계절 정합 + 계절 미스매치 보유 종목). 매도(리밸런싱)·매수(통합추천)를 잇는 본부 상단
import { useState, useEffect } from 'react'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'
import type { HqBriefing } from '@/app/api/hq-briefing/route'
import PortfolioXray from '@/app/components/PortfolioXray'
import LynchClassificationMatrix from '@/app/components/LynchClassificationMatrix'
import MorningstarRatings from '@/app/components/MorningstarRatings'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border

export default function OperationsHQ() {
  const [data, setData] = useState<SeasonNavResult | null>(null)
  const [brief, setBrief] = useState<HqBriefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/season-navigator', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j.error ? null : j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
      // 본부장 브리핑(진단+매수 합성) — 별도 로드(느려도 화면 막지 않음)
      fetch('/api/hq-briefing', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setBrief(j.error ? null : j) })
        .catch(() => { if (alive) setBrief(null) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  const align = data?.alignmentScore ?? 0
  const col = align >= 70 ? TK.green500 : align >= 45 ? TK.amber500 : TK.red500
  // 계절 미스매치 보유 종목(적합도 0.5 미만) — 비중 점검 대상
  const mismatch = (data?.perHolding ?? []).filter(h => h.fit < 0.5).sort((a, b) => b.weight - a.weight)
  const fitWeight = (data?.perHolding ?? []).filter(h => h.fit >= 0.7).reduce((s, h) => s + h.weight, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 본부 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(34,197,94,0.06))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🎛️</span>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 16 }}>AI 포트폴리오 운용 본부</span>
          <span style={{ color: TK.sub, fontSize: 12 }}>진단 → 매도·리밸런싱 → 통합 매수 처방을 한 흐름으로</span>
        </div>
        <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
          밸류에이션·수급·거시(4계절)·피터린치·버핏을 하나로 묶어 <b>무엇을 팔고 무엇을 사야 하는지</b>를 AI가 종합 처방합니다.
          <span style={{ color: TK.amber400 }}> ※ 자동 주문 체결은 하지 않습니다 — 종목·금액 제안까지, 매매는 직접.</span>
        </div>
        {/* 🎖️ AI 본부장 종합 브리핑 — 매도↔매수 연결 처방 */}
        {brief?.briefing && (
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 10, padding: '11px 14px', marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 14 }}>🎖️</span>
              <span style={{ color: TK.indigo300, fontWeight: 800, fontSize: 12 }}>AI 본부장 종합 브리핑</span>
              {brief.model && <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 9.5 }}>Gemini</span>}
            </div>
            {/* 🧭 리스크 체크 — 상황 인지형 처방의 핵심(규제·고평가·해자·기저효과) 상단 굵게 */}
            {(brief.riskChecks?.length ?? 0) > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 11px', marginBottom: 9 }}>
                <div style={{ color: TK.red300, fontWeight: 800, fontSize: 11, marginBottom: 4 }}>🧭 리스크 체크</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {brief.riskChecks.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11.5, lineHeight: 1.55 }}>
                      <span style={{ flexShrink: 0 }}>{r.level === 'red' ? '🔴' : '🟡'}</span>
                      <span style={{ color: r.level === 'red' ? TK.red300 : '#fcd34d', fontWeight: 600 }}>{r.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ color: TK.sub15, fontSize: 12.5, lineHeight: 1.7 }}>{brief.briefing}</div>
            {((brief.sells?.length ?? 0) > 0 || (brief.trim?.length ?? 0) > 0 || brief.buys.length > 0) && (
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
                {(brief.sells?.length ?? 0) > 0 ? (
                  <span style={{ color: TK.red300 }}>▼ 매도: {brief.sells.slice(0, 3).map(s => `${s.name}(${s.action === 'CUT_LOSS' ? '손절' : '익절'} ${s.pnlPct != null ? (s.pnlPct > 0 ? '+' : '') + s.pnlPct + '%' : ''})`).join(', ')}{brief.sellBudget > 0 && <span style={{ color: TK.sub }}> · 회수 {brief.sellBudget}%</span>}</span>
                ) : brief.trim.length > 0 ? (
                  <span style={{ color: TK.amber400 }}>▼ 계절 점검: {brief.trim.slice(0, 3).map(t => t.name).join(', ')}</span>
                ) : null}
                {brief.buys.length > 0 && (
                  <span style={{ color: TK.green300 }}>▲ 1순위 매수: {brief.buys[0].name} (통합 {brief.buys[0].combined})</span>
                )}
                {brief.policyTilt && (() => {
                  const t = brief.policyTilt
                  const c = t.tilt === 'dovish' ? TK.cyan400 : t.tilt === 'hawkish' ? TK.amber400 : TK.slate400
                  const ic = t.tilt === 'dovish' ? '🕊️' : t.tilt === 'hawkish' ? '🦅' : '⚖️'
                  return (
                    <span title={t.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${c}14`, border: `1px solid ${c}44`, borderRadius: 6, padding: '1px 8px', color: c }}>
                      {ic} 연준 기조: {t.label}
                    </span>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* 3단계 흐름 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {[['①', '진단', '지금 국면 · 내 포폴 정합'], ['②', '매도·리밸런싱', '익절/손절/분산 트림'], ['③', '통합 매수', '계절×가치×수급 3축']].map(([n, t, d]) => (
            <div key={t} style={{ flex: '1 1 180px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 9, padding: '8px 12px' }}>
              <span style={{ color: TK.indigo400, fontWeight: 800, fontSize: 13 }}>{n} {t}</span>
              <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 1 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ① 진단 — 4계절 정합 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
        {loading ? (
          <div style={{ color: TK.sub, fontSize: 12 }}>🎛️ 포트폴리오를 진단 중입니다…</div>
        ) : !data ? (
          <div style={{ color: TK.sub, fontSize: 12 }}>진단 데이터를 불러오지 못했습니다.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>① 진단 — 현재 국면 적합도</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ color: TK.sub }}>🇺🇸 {data.marketSeasons?.us.seasonKo.replace(/^.. /, '')}</span>
                <span style={{ color: TK.sub }}>🇰🇷 {data.marketSeasons?.kr.seasonKo.replace(/^.. /, '')}</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ color: col, fontWeight: 900, fontSize: 26, fontFamily: 'monospace' }}>{align}</span>
              <span style={{ color: TK.sub, fontSize: 11 }}>/ 100 계절 정합도</span>
              <span style={{ marginLeft: 'auto', color: TK.sub, fontSize: 11 }}>계절 적합 비중 {Math.round(fitWeight)}%</span>
            </div>
            <div style={{ height: 7, background: TK.bg3, borderRadius: 5, overflow: 'hidden', border: `1px solid ${BORDER}`, marginBottom: 10 }}>
              <div style={{ width: `${align}%`, height: '100%', background: col }} />
            </div>
            {mismatch.length > 0 ? (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: `1px solid ${TK.red500}33`, borderRadius: 9, padding: '9px 12px' }}>
                <div style={{ color: TK.red300, fontWeight: 700, fontSize: 11.5, marginBottom: 5 }}>⚠️ 계절 미스매치 — 비중 점검 권장 (지금 국면에 불리한 보유 종목)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {mismatch.slice(0, 6).map(h => (
                    <span key={h.ticker} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '2px 8px', fontSize: 10.5, color: TK.slate300 }}>
                      {h.market === 'KR' ? '🇰🇷' : '🇺🇸'} {h.name} <span style={{ color: TK.sub }}>{h.weight}% · 적합 {Math.round(h.fit * 100)}</span>
                    </span>
                  ))}
                </div>
                <div style={{ color: TK.sub8, fontSize: 10, marginTop: 6 }}>아래 ② 리밸런싱에서 손익을 함께 보고, 펀더멘탈이 멀쩡하면 보유·과열이면 분할 점검하세요(계절만으로 매도 단정 금지).</div>
              </div>
            ) : fitWeight >= 65 ? (
              <div style={{ color: TK.green300, fontSize: 11.5 }}>✓ 보유 종목 대부분이 현재 국면에 적합합니다(적합 비중 {Math.round(fitWeight)}%).</div>
            ) : (
              <div style={{ background: 'rgba(245,158,11,0.07)', border: `1px solid ${TK.amber500}33`, borderRadius: 9, padding: '9px 12px', color: TK.amber400, fontSize: 11.5, lineHeight: 1.5 }}>
                ⚖️ 계절에 크게 어긋난 종목은 없으나 적합 비중이 {Math.round(fitWeight)}%로, 절반가량이 &lsquo;중립&rsquo;입니다 — 현재 국면 우대 섹터({(data.favored ?? []).join('·')}) 비중을 늘릴 여지가 있습니다.
              </div>
            )}
          </>
        )}
      </div>

      {/* 🧬 피터 린치 7대 분류 Matrix & 함정 레이더 — 진단 해상도 보강(주식 미보유면 자동 숨김) */}
      <LynchClassificationMatrix />

      {/* 🌟 모닝스타식 스타 등급 — 공정가치(DCF)·해자·불확실성·자본배분 종합(진단 캡스톤) */}
      <MorningstarRatings />

      {/* 🔬 ETF 속살 투시 — 보유 ETF를 분해해 실질 노출도(진단 보강). ETF 미보유면 자동 숨김 */}
      <PortfolioXray />
    </div>
  )
}
