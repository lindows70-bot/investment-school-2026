'use client'
// 포트폴리오 뉴스 촉매 레이더 — 보유 종목별 뉴스 이벤트를 3단계로 분류해 표시
import { useState, useEffect, useCallback } from 'react'
import type { NewsCatalystResult, TickerCatalyst, CatalystStatus, RiskLevel, ValuationTier } from '@/app/api/news-catalyst/route'

// ── 스타일 상수 ───────────────────────────────────────────────────────────────
const BG    = '#0f1117'
const CARD  = '#161b25'
const BORDER = '#1e293b'

const STATUS_CONFIG: Record<CatalystStatus, { color: string; bg: string; icon: string; label: string; pulse?: boolean }> = {
  RE_EVALUATE: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: '🔴', label: '재검토 필요', pulse: true },
  OBSERVE:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟡', label: '관찰 중' },
  HOLD_STRONG: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: '🟢', label: '견고 보유' },
}

const RISK_CONFIG: Record<RiskLevel, { color: string; label: string }> = {
  HIGH:   { color: '#ef4444', label: '고위험' },
  MEDIUM: { color: '#f59e0b', label: '중위험' },
  LOW:    { color: '#22c55e', label: '저위험' },
}

// 가격 축(밸류에이션) 배지 — PEG에서 결정론적 산출(Jarvis 매도 기준과 일치)
const VALUATION_CONFIG: Record<ValuationTier, { color: string; bg: string; label: string } | null> = {
  EXPENSIVE: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: '밸류 부담' },
  CHEAP:     { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  label: '가격 매력' },
  FAIR:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: '적정가' },
  UNKNOWN:   null,
}

/** 사업(뉴스) 축 × 가격(밸류) 축 융합 진단 — 충돌 케이스에 상단 띠로 노출 */
function fusionVerdict(c: TickerCatalyst): { color: string; bg: string; text: string } | null {
  const exp = c.valuationTier === 'EXPENSIVE'
  const cheap = c.valuationTier === 'CHEAP'
  const pegStr = c.peg != null ? `PEG ${c.peg.toFixed(2)}` : ''
  if (c.catalystStatus === 'RE_EVALUATE' && exp)
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: `🚨 고평가(${pegStr}) + 사업 악재 — 비중 축소·매도 우선 검토` }
  if (c.catalystStatus !== 'RE_EVALUATE' && exp)
    return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: `⚖️ 좋은 사업 · 비싼 가격(${pegStr}) — 보유는 OK, 신규 추격매수 자제·분할 익절 검토` }
  if (c.catalystStatus === 'HOLD_STRONG' && cheap)
    return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', text: `🟢 견고한 사업 · 합리적 가격(${pegStr}) — 린치가 좋아할 자리` }
  return null
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function NewsCatalystRadar() {
  const [data,    setData]    = useState<NewsCatalystResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)  // 확장된 ticker
  const [filter, setFilter]   = useState<CatalystStatus | 'ALL'>('ALL')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/news-catalyst', { cache: 'no-store' })
      if (r.status === 401) { setError('로그인이 필요합니다'); return }
      if (!r.ok) { setError('데이터 로드 실패'); return }
      setData(await r.json())
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── 로딩 ──
  if (loading) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
      <div style={{ color: '#7f93a8', fontSize: 14, lineHeight: 1.6 }}>
        보유 종목 뉴스를 분석 중입니다...<br />
        <span style={{ color: '#6b7280', fontSize: 12 }}>종목 수에 따라 15~30초 소요될 수 있습니다</span>
      </div>
    </div>
  )

  // ── 에러 ──
  if (error) return (
    <div style={{ background: BG, borderRadius: 12, padding: 24, color: '#ef4444', textAlign: 'center' }}>
      {error}
      <button onClick={load} style={{ display: 'block', margin: '12px auto 0', padding: '6px 16px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
        재시도
      </button>
    </div>
  )

  if (!data || data.catalysts.length === 0) return (
    <div style={{ background: BG, borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#7f93a8' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      보유 개별주식이 없습니다. 종목을 추가하면 뉴스 분석이 시작됩니다.
    </div>
  )

  const filtered = filter === 'ALL' ? data.catalysts : data.catalysts.filter(c => c.catalystStatus === filter)
  const counts = {
    RE_EVALUATE: data.catalysts.filter(c => c.catalystStatus === 'RE_EVALUATE').length,
    OBSERVE:     data.catalysts.filter(c => c.catalystStatus === 'OBSERVE').length,
    HOLD_STRONG: data.catalysts.filter(c => c.catalystStatus === 'HOLD_STRONG').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 헤더 ── */}
      <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📰</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>포트폴리오 뉴스 촉매 레이더</span>
              {data.reEvaluateCount > 0 && (
                <span style={{
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
                  padding: '2px 10px', fontSize: 12, fontWeight: 600,
                  animation: 'pulse 2s infinite',
                }}>
                  ⚠ 재검토 {data.reEvaluateCount}종목
                </span>
              )}
            </div>
            <div style={{ color: '#7f93a8', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
              피터 린치 시각: 뉴스 소음은 걸러내고 투자 thesis에 영향 주는 신호만<br />
              <span style={{ color: '#6b7280' }}>※ <b style={{ color: '#8599ae' }}>사업 축</b>(뉴스 견고/관찰/재검토)과 <b style={{ color: '#8599ae' }}>가격 축</b>(💲PEG 밸류에이션)은 별개 — 좋은 기업도 비싸면 추격은 신중히</span>
            </div>
          </div>
          <button
            onClick={load}
            style={{ padding: '6px 14px', background: '#1e293b', color: '#94a3b8', border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            🔄 새로고침
          </button>
        </div>

        {/* 요약 카운터 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {(['ALL', 'RE_EVALUATE', 'OBSERVE', 'HOLD_STRONG'] as const).map(s => {
            const cnt = s === 'ALL' ? data.catalysts.length : counts[s]
            const cfg = s === 'ALL'
              ? { color: '#94a3b8', bg: '#1e293b', icon: '📊', label: '전체' }
              : STATUS_CONFIG[s]
            const isActive = filter === s
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  border: `1px solid ${isActive ? cfg.color : BORDER}`,
                  background: isActive ? cfg.bg : 'transparent',
                  color: isActive ? cfg.color : '#7f93a8',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {cfg.icon} {cfg.label} {cnt}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 카드 목록 ── */}
      {filtered.length === 0 ? (
        <div style={{ background: CARD, borderRadius: 12, padding: '32px 24px', textAlign: 'center', color: '#7f93a8', border: `1px solid ${BORDER}` }}>
          해당 상태의 종목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => {
            const cfg = STATUS_CONFIG[c.catalystStatus]
            const riskCfg = RISK_CONFIG[c.riskLevel]
            const valCfg = VALUATION_CONFIG[c.valuationTier]
            const fusion = fusionVerdict(c)
            const isOpen = expanded === `${c.ticker}|${c.market}`
            const toggleKey = `${c.ticker}|${c.market}`

            return (
              <div
                key={toggleKey}
                style={{
                  background: CARD, borderRadius: 10,
                  border: `1px solid ${isOpen ? cfg.color : BORDER}`,
                  overflow: 'hidden', transition: 'border-color 0.2s',
                }}
              >
                {/* 카드 헤더 (클릭으로 펼침) */}
                <div
                  onClick={() => setExpanded(isOpen ? null : toggleKey)}
                  style={{
                    padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  {/* 상태 인디케이터 */}
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: cfg.color, flexShrink: 0, marginTop: 4,
                    boxShadow: c.catalystStatus === 'RE_EVALUATE' ? `0 0 8px ${cfg.color}` : 'none',
                  }} />

                  {/* 메인 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                        {c.ticker}
                      </span>
                      {c.name && c.name !== c.ticker && (
                        <span style={{ color: '#7f93a8', fontSize: 12 }}>{c.name}</span>
                      )}
                      <span style={{
                        background: cfg.bg, color: cfg.color,
                        border: `1px solid ${cfg.color}40`, borderRadius: 6,
                        padding: '1px 8px', fontSize: 11, fontWeight: 600,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span style={{
                        color: riskCfg.color, fontSize: 11,
                        border: `1px solid ${riskCfg.color}40`, borderRadius: 4,
                        padding: '1px 6px',
                      }}>
                        {riskCfg.label}
                      </span>
                      {/* 가격(밸류에이션) 축 배지 — 사업 축과 별도 */}
                      {valCfg && (
                        <span style={{
                          background: valCfg.bg, color: valCfg.color,
                          border: `1px solid ${valCfg.color}40`, borderRadius: 4,
                          padding: '1px 6px', fontSize: 11,
                        }}>
                          💲 {valCfg.label}{c.peg != null ? ` · PEG ${c.peg.toFixed(2)}` : ''}
                        </span>
                      )}
                      {c.fromCache && (
                        <span style={{ color: '#4b6380', fontSize: 10 }}>캐시</span>
                      )}
                    </div>

                    {/* 가치×모멘텀 융합 진단 띠 (충돌 케이스) */}
                    {fusion && (
                      <div style={{
                        marginTop: 8, padding: '6px 10px', borderRadius: 6,
                        background: fusion.bg, border: `1px solid ${fusion.color}40`,
                        color: fusion.color, fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                      }}>
                        {fusion.text}
                      </div>
                    )}
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                      {c.keyFact}
                    </div>
                    {c.relevantMetric && c.relevantMetric !== '—' && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: '#f59e0b', fontSize: 11, background: 'rgba(245,158,11,0.08)', borderRadius: 4, padding: '1px 6px' }}>
                          📊 {c.relevantMetric}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 펼침 아이콘 */}
                  <span style={{ color: '#4b6380', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {/* 확장 영역 */}
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                    {/* 행동 가이드 */}
                    <div style={{
                      background: `${cfg.bg}`, border: `1px solid ${cfg.color}30`,
                      borderRadius: 8, padding: '10px 14px', marginTop: 12,
                    }}>
                      <div style={{ color: cfg.color, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                        🎯 피터 린치 행동 가이드
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
                        {c.actionGuide}
                      </div>
                    </div>

                    {/* 뉴스 헤드라인 */}
                    {c.headlines.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ color: '#7f93a8', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                          📰 분석 근거 뉴스
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {c.headlines.map((h, i) => (
                            <div key={i} style={{
                              color: '#8a9aaa', fontSize: 12, lineHeight: 1.4,
                              paddingLeft: 12, borderLeft: '2px solid #1e293b',
                            }}>
                              {h}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {c.isNoise && (
                      <div style={{ marginTop: 10, color: '#4b6380', fontSize: 11 }}>
                        🔇 주가 시황성 기사 — 투자 판단에 직접 영향 없음
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 업데이트 시각 */}
      <div style={{ textAlign: 'right', color: '#4b5563', fontSize: 11 }}>
        분석 기준: {new Date(data.generatedAt).toLocaleString('ko-KR')} · 캐시 3시간
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
