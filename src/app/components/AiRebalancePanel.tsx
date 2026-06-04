'use client'
// 🤖 AI 포트폴리오 리밸런싱 — 수익률 연동형 교체매매 플랜(익절/손절/보류 + 신규 매수후보)
import { useState, useEffect, useCallback } from 'react'
import type { RebalanceResult, HoldingDiagnosis, RebalanceAction } from '@/app/api/ai-rebalance/route'

const BG = '#0f1117', CARD = '#161b25', BORDER = '#1e293b'

const ACTION_CFG: Record<RebalanceAction, { color: string; bg: string; icon: string; label: string }> = {
  TAKE_PROFIT: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🏆', label: '분할 익절' },
  CUT_LOSS:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '⚔️', label: '손절 검토' },
  HOLD_DIP:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🛡️', label: '보류(저점매도 방지)' },
  DEFEND:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '🚀', label: '사수(저평가)' },
  KEEP:        { color: '#8599ae', bg: 'rgba(133,153,174,0.08)', icon: '·', label: '유지' },
}

function pnlColor(p: number | null) { return p == null ? '#8599ae' : p > 0 ? '#22c55e' : p < 0 ? '#ef4444' : '#8599ae' }
function pnlStr(p: number | null) { return p == null ? '—' : `${p > 0 ? '+' : ''}${p}%` }

export default function AiRebalancePanel() {
  const [data, setData] = useState<RebalanceResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/ai-rebalance', { cache: 'no-store' })
      if (r.status === 401) { setError('로그인이 필요합니다'); return }
      if (!r.ok) { setError('데이터 로드 실패'); return }
      setData(await r.json())
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
      <div style={{ color: '#7f93a8', fontSize: 14, lineHeight: 1.6 }}>
        포트폴리오 손익과 매도 신호를 분석 중입니다...<br />
        <span style={{ color: '#6b7280', fontSize: 12 }}>종목 수에 따라 20~40초 소요될 수 있습니다</span>
      </div>
    </div>
  )
  if (error) return (
    <div style={{ background: BG, borderRadius: 12, padding: 24, color: '#ef4444', textAlign: 'center' }}>
      {error}
      <button onClick={load} style={{ display: 'block', margin: '12px auto 0', padding: '6px 16px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>재시도</button>
    </div>
  )
  if (!data || data.holdings.length === 0) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#7f93a8' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      {data?.narrative ?? '분석할 보유 종목이 없습니다.'}
    </div>
  )

  const sellList = data.holdings.filter(h => h.action === 'TAKE_PROFIT' || h.action === 'CUT_LOSS')
  const holdDips = data.holdings.filter(h => h.action === 'HOLD_DIP')
  const defends = data.holdings.filter(h => h.action === 'DEFEND')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>AI 포트폴리오 리밸런싱</span>
              {data.sellBudget > 0 && (
                <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                  재배분 예산 {data.sellBudget}%
                </span>
              )}
            </div>
            <div style={{ color: '#7f93a8', fontSize: 12, marginTop: 4 }}>
              내 실제 수익률을 반영한 교체매매 — 익절/손절/보류를 구분합니다
            </div>
          </div>
          <button onClick={load} style={{ padding: '6px 14px', background: '#1e293b', color: '#94a3b8', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>🔄 새로고침</button>
        </div>
      </div>

      {/* AI 코칭 내러티브 */}
      {data.narrative && (
        <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(34,197,94,0.05))', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💬 AI 자산관리 비서</div>
          <div style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.7 }}>{data.narrative}</div>
        </div>
      )}

      {/* ① 교체매매(익절/손절) 카드 */}
      {sellList.length > 0 && (
        <div>
          <SectionTitle icon="🔄" text="1-Click 교체매매 후보" sub="회수 → 신규 편입" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sellList.map(h => <SwapCard key={h.ticker} h={h} buys={data.buyCandidates} />)}
          </div>
        </div>
      )}

      {/* ② 보류(저점매도 방지) */}
      {holdDips.length > 0 && (
        <div>
          <SectionTitle icon="🛡️" text="저점 매도 방지 — 버티세요" sub="손실 중이나 단순 고평가뿐, thesis 멀쩡" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {holdDips.map(h => (
              <div key={h.ticker} style={{ background: CARD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{h.ticker}</span>
                <span style={{ color: pnlColor(h.pnlPct), fontSize: 12, marginLeft: 8, fontWeight: 600 }}>{pnlStr(h.pnlPct)}</span>
                <span style={{ color: '#f59e0b', fontSize: 11, marginLeft: 8 }}>
                  본전까지 +{h.breakEvenRise ?? '—'}% · 저점매도 금물
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ③ 사수(저평가/호재) */}
      {defends.length > 0 && (
        <div>
          <SectionTitle icon="🚀" text="사수 — 이기는 종목은 달리게 두라" sub="저평가/호재" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {defends.map(h => (
              <div key={h.ticker} style={{ background: CARD, border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{h.ticker}</span>
                <span style={{ color: pnlColor(h.pnlPct), fontSize: 12, marginLeft: 8, fontWeight: 600 }}>{pnlStr(h.pnlPct)}</span>
                {h.peg != null && <span style={{ color: '#3b82f6', fontSize: 11, marginLeft: 8 }}>PEG {h.peg.toFixed(2)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'right', color: '#4b5563', fontSize: 11 }}>
        분석 기준: {new Date(data.generatedAt).toLocaleString('ko-KR')} · 24h 캐시 · 교육용 시뮬레이션이며 투자 추천이 아닙니다
      </div>
    </div>
  )
}

function SectionTitle({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{icon} {text}</span>
      {sub && <span style={{ color: '#6b7280', fontSize: 11 }}>{sub}</span>}
    </div>
  )
}

function SwapCard({ h, buys }: { h: HoldingDiagnosis; buys: RebalanceResult['buyCandidates'] }) {
  const cfg = ACTION_CFG[h.action]
  const topBuy = buys[0]
  return (
    <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${cfg.color}40`, padding: '14px 16px' }}>
      {/* 매도 종목 라인 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>매도</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{h.name} ({h.ticker})</span>
        <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
        <span style={{ color: pnlColor(h.pnlPct), fontSize: 13, fontWeight: 700 }}>{pnlStr(h.pnlPct)}</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>비중 {h.weight}% → 회수 {h.releaseWeight}%</span>
      </div>

      {/* 매도 사유 */}
      {h.sellReasons.length > 0 && (
        <div style={{ marginTop: 6, color: '#aab6c4', fontSize: 12, lineHeight: 1.5 }}>
          {h.sellReasons.map((r, i) => <div key={i}>· {r}</div>)}
        </div>
      )}

      {/* 손절 시 본전 상승률(기회비용) */}
      {h.action === 'CUT_LOSS' && h.breakEvenRise != null && (
        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
          ⏳ 본전까지 <b>+{h.breakEvenRise}%</b> 필요 — 회복 동력이 없는 종목에 묶여 기다리는 기회비용을 점검하세요
        </div>
      )}

      {/* 신규 편입 후보 */}
      {topBuy && h.releaseWeight > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#22c55e', fontSize: 11 }}>↳ 신규 편입 후보</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{topBuy.name} ({topBuy.ticker})</span>
          <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>AI {topBuy.aiScore}점</span>
          {topBuy.peg != null && <span style={{ color: '#3b82f6', fontSize: 11 }}>PEG {topBuy.peg.toFixed(2)}</span>}
          {topBuy.allocWeight > 0 && <span style={{ color: '#6b7280', fontSize: 11 }}>제안 {topBuy.allocWeight}%</span>}
        </div>
      )}
    </div>
  )
}
