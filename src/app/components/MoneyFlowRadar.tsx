'use client'
// 💰 스마트머니 수급 레이더 — 외국인/기관/개인 일별 순매수로 돈의 유입·이탈을 시각화(KR)
import { useState, useEffect } from 'react'
import type { MoneyFlowResult, FlowActor, FlowStatus, UsFlow } from '@/lib/moneyFlow'

const CARD = '#161b25', BORDER = '#1e293b'

const STATUS_CFG: Record<FlowStatus, { label: string; color: string; emoji: string }> = {
  INFLOW:      { label: '스마트머니 유입', color: '#22c55e', emoji: '🟢' },
  CROWDED:     { label: '개미 독박·이탈', color: '#ef4444', emoji: '🔴' },
  NEGLECTED:   { label: '기관 소외주',     color: '#f59e0b', emoji: '🟡' },
  NEUTRAL:     { label: '수급 중립',       color: '#8a9aaa', emoji: '⚪' },
  UNSUPPORTED: { label: '준비 중',         color: '#6b7280', emoji: '—' },
}

function won(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '−' : '+'
  if (a >= 1e12) return `${s}${(a / 1e12).toFixed(1)}조`
  if (a >= 1e8)  return `${s}${Math.round(a / 1e8)}억`
  if (a >= 1e4)  return `${s}${Math.round(a / 1e4)}만`
  return `${s}${Math.round(a)}`
}

const TREND_KR: Record<UsFlow['giantTrend'], string> = { add: '확대', cut: '축소', mixed: '혼조', none: '유지' }

function UsBody({ us }: { us: UsFlow }) {
  const zoneCol = us.mfiZone === 'oversold' ? '#22c55e' : us.mfiZone === 'overbought' ? '#ef4444' : '#3b82f6'
  const trArrow = us.mfiTrend === 'rising' ? '▲' : us.mfiTrend === 'falling' ? '▼' : '─'
  const trCol = us.mfiTrend === 'rising' ? '#34d399' : us.mfiTrend === 'falling' ? '#f87171' : '#8a9aaa'
  const w = us.mfi ?? 50
  return (
    <div style={{ marginBottom: 12 }}>
      {/* MFI 게이지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12.5 }}>
        <span style={{ color: '#aab6c4', fontWeight: 700 }}>자금흐름 MFI</span>
        <span style={{ color: zoneCol, fontWeight: 800, fontFamily: 'monospace' }}>{us.mfi ?? '—'}</span>
        <span style={{ color: trCol, fontSize: 11 }}>{trArrow} {us.mfiTrend === 'rising' ? '상승' : us.mfiTrend === 'falling' ? '하락' : '횡보'}</span>
        <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 10.5 }}>20 과매도 · 80 과매수</span>
      </div>
      <div style={{ position: 'relative', height: 12, background: '#0f1117', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: zoneCol, borderRadius: 6, transition: 'width .3s' }} />
        {[20, 80].map(m => (
          <div key={m} style={{ position: 'absolute', left: `${m}%`, top: 0, bottom: 0, width: 1, background: '#475569' }} />
        ))}
      </div>
      {/* 🏛️ 기관 보유 비중 게이지 + 분기 순증감 (전체 기관 13F 집계 — 9인 거장보다 넓은 스마트머니) */}
      {us.instPct != null && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 4px', fontSize: 12.5 }}>
            <span style={{ color: '#aab6c4', fontWeight: 700 }}>🏛️ 기관 보유</span>
            <span style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>{us.instPct}%</span>
            {us.instCount != null && <span style={{ color: '#7f93a8', fontSize: 11 }}>{us.instCount.toLocaleString()}곳</span>}
            {us.instTrend && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: us.instTrend === 'accum' ? '#34d399' : us.instTrend === 'distrib' ? '#f87171' : '#8a9aaa' }}>
                {us.instTrend === 'accum' ? `📈 분기 순매집 (${us.instAdders}곳↑)` : us.instTrend === 'distrib' ? `📉 분기 순감소 (${us.instCutters}곳↓)` : us.instTrend === 'mixed' ? '↔ 매집·감소 혼조' : '─ 지분 유지'}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', height: 12, background: '#0f1117', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(us.instPct, 100)}%`, height: '100%', background: '#3b82f6', borderRadius: 6, transition: 'width .3s' }} />
          </div>
          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 3 }}>Top 기관의 분기 지분 증감(13F·45일 지연) — 9인 거장보다 넓은 스마트머니</div>
        </>
      )}
      {/* 내부자 · 13F 칩 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <span title="EDGAR Form 4의 공개시장 매수(코드 P) — 린치가 말한 '내부자가 사는 이유는 하나'인 진짜 매수 신호" style={{ background: us.insiderBuyers > 0 ? 'rgba(34,197,94,0.12)' : '#0f1117', color: us.insiderBuyers > 0 ? '#34d399' : '#8a9aaa', border: `1px solid ${us.insiderBuyers > 0 ? '#22c55e44' : '#1e293b'}`, borderRadius: 8, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>
          {us.insiderBuyers > 0 ? `🕵️ 90일 장내매수 ${us.insiderBuyers}명${us.insiderCluster ? ' 🔥' : ''}` : '🕵️ 90일 장내매수 없음'}
        </span>
        {us.insiderNetPct != null && Math.abs(us.insiderNetPct) >= 10 && (
          <span title="Yahoo 내부자 6개월 순 지분변동 — 그랜트·옵션행사·매도까지 합산한 순증감(장내매수와 다름)" style={{ background: us.insiderNetPct > 0 ? 'rgba(96,165,250,0.12)' : 'rgba(239,68,68,0.12)', color: us.insiderNetPct > 0 ? '#60a5fa' : '#f87171', border: `1px solid ${us.insiderNetPct > 0 ? '#3b82f644' : '#ef444444'}`, borderRadius: 8, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>
            📊 내부자 지분 6개월 {us.insiderNetPct > 0 ? '순증(그랜트 포함)' : '순감'}
          </span>
        )}
        <span style={{ background: us.giantHolders > 0 ? 'rgba(59,130,246,0.12)' : '#0f1117', color: us.giantHolders > 0 ? '#60a5fa' : '#8a9aaa', border: `1px solid ${us.giantHolders > 0 ? '#3b82f644' : '#1e293b'}`, borderRadius: 8, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>
          {!us.giantKnown ? '🐳 13F 집계 중' : us.giantHolders > 0 ? `🐳 13F 거인 ${us.giantHolders}인 보유 · ${TREND_KR[us.giantTrend]}` : '🐳 추적 거인(9인) 없음'}
        </span>
      </div>
    </div>
  )
}

export default function MoneyFlowRadar({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [data, setData] = useState<MoneyFlowResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/money-flow?ticker=${encodeURIComponent(ticker)}&market=${market}&name=${encodeURIComponent(name)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive) setData(j) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name, market])

  if (loading) {
    return (
      <div style={{ background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 13 }}>
        💰 수급 흐름을 분석 중입니다…
      </div>
    )
  }
  if (!data || data.status === 'UNSUPPORTED') {
    return (
      <div style={{ background: CARD, borderRadius: 12, padding: 18, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>스마트머니 수급 레이더</span>
        </div>
        <div style={{ color: '#8a9aaa', fontSize: 12.5, lineHeight: 1.6 }}>{data?.note ?? '수급 데이터를 제공할 수 없는 종목입니다.'}</div>
      </div>
    )
  }

  const cfg = STATUS_CFG[data.status]
  const actors: { key: string; label: string; a: FlowActor | null }[] = [
    { key: 'f', label: '외국인', a: data.foreign },
    { key: 'o', label: '기관',   a: data.organ },
    { key: 'i', label: '개인',   a: data.individual },
  ]
  const maxAbs = Math.max(1, ...actors.map(x => Math.abs(x.a?.amt20 ?? 0)))

  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${data.status === 'INFLOW' ? '#22c55e55' : data.status === 'CROWDED' ? '#ef444455' : BORDER}` }}>
      {/* 헤더 + 종합 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>💰</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>스마트머니 수급 레이더</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cfg.color}1f`, color: cfg.color, border: `1px solid ${cfg.color}66`, borderRadius: 999, padding: '3px 12px', fontSize: 12.5, fontWeight: 800 }}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11.5, marginBottom: 12 }}>
        {data.us
          ? 'MFI · 내부자 매수(90일) · 기관 보유·분기 순증감 · 13F 거인 — 미국 스마트머니 프록시'
          : `최근 20일 누적 순매수(추정 대금) · 외국인 보유율 ${data.foreignHoldRatio != null ? `${data.foreignHoldRatio.toFixed(1)}%` : '—'}`}
      </div>

      {/* US: MFI 게이지 + 내부자·13F 칩 / KR: 3대 주체 에너지 바 */}
      {data.us ? (
        <UsBody us={data.us} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {actors.map(({ key, label, a }) => {
            const amt = a?.amt20 ?? 0
            const buy = (a?.net20 ?? 0) > 0
            const w = Math.round((Math.abs(amt) / maxAbs) * 100)
            const col = a?.dir === 'FLAT' ? '#64748b' : buy ? '#22c55e' : '#ef4444'
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ width: 44, color: '#aab6c4', fontWeight: 700, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 12, background: '#0f1117', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: col, borderRadius: 6, transition: 'width .3s' }} />
                </div>
                <span style={{ width: 70, textAlign: 'right', color: col, fontWeight: 700, flexShrink: 0 }}>{won(amt)}</span>
                <span style={{ width: 64, textAlign: 'right', color: a?.dir === 'FLAT' ? '#64748b' : buy ? '#34d399' : '#f87171', fontSize: 11, flexShrink: 0 }}>
                  {a?.dir === 'FLAT' ? '─ 중립' : buy ? '▲ 매수우위' : '▼ 매도'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 린치식 배지 */}
      {data.badges.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {data.badges.map((b, i) => (
            <span key={i} style={{ background: '#1e293b', color: '#cbd5e1', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{b}</span>
          ))}
        </div>
      )}

      {/* 린치 코멘트 + 행동지침 */}
      <div style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}33`, borderRadius: 10, padding: '11px 14px' }}>
        <div style={{ color: '#cbd5e1', fontSize: 12.5, lineHeight: 1.65 }}>{data.lynchComment}</div>
        <div style={{ color: cfg.color, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, marginTop: 6 }}>🧭 {data.actionGuide}</div>
      </div>

      <div style={{ color: '#4b5563', fontSize: 10.5, marginTop: 8, lineHeight: 1.5 }}>
        {data.us
          ? '※ 미국은 한국(외국인/기관/개인 일별 공시)과 달리 투자자별 일별 수급이 없습니다. MFI(거래량 가중 자금흐름)는 일별이나, 기관 보유·순증감과 13F는 분기·45일 지연 공시입니다. 수급은 연료일 뿐 방향은 펀더멘탈이 결정합니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.'
          : '※ 대금은 일별 순매수 수량×종가 추정치입니다. 외국인 순매수엔 패시브·프로그램 매매도 포함됩니다 — 수급은 연료일 뿐 방향은 펀더멘탈이 결정합니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.'}
      </div>
    </div>
  )
}
