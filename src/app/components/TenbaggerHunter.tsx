'use client'
// 🚀 피터 린치 10배거 검증기 — 학생이 입력한 종목을 린치 7대 기준으로 채점
import { useState, useCallback } from 'react'
import type { TenbaggerResult, CriterionStatus } from '@/app/api/tenbagger/route'

const CARD = '#161b25', BORDER = '#1e293b', BG = '#0f1117'

const STATUS_CFG: Record<CriterionStatus, { color: string; icon: string }> = {
  PASS:    { color: '#22c55e', icon: '✅' },
  PARTIAL: { color: '#f59e0b', icon: '⚠️' },
  FAIL:    { color: '#ef4444', icon: '❌' },
  UNKNOWN: { color: '#6b7280', icon: '—' },
}

function scoreColor(s: number) { return s >= 60 ? '#22c55e' : s >= 45 ? '#f59e0b' : '#ef4444' }

export default function TenbaggerHunter() {
  const [input, setInput] = useState('')
  const [data, setData] = useState<TenbaggerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (q: string) => {
    const ticker = q.trim()
    if (!ticker) return
    setLoading(true); setError(null); setData(null)
    try {
      const r = await fetch(`/api/tenbagger?ticker=${encodeURIComponent(ticker)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setError(j.error || '검증 실패'); return }
      setData(j)
    } catch { setError('네트워크 오류') }
    finally { setLoading(false) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 + 입력 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>피터 린치 10배거 검증기</span>
        </div>
        <div style={{ color: '#7f93a8', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          관심 종목을 직접 입력하면 린치의 <b style={{ color: '#8599ae' }}>10루타(10-Bagger) 7대 기준</b>으로 채점합니다.
          시총이 작아 10배 갈 공간이 있는지, 성장·저PEG·언더커버리지·내부자매수·재무생존력을 종합 진단합니다.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(input) }}
            placeholder="종목 코드 입력 (예: IONQ · TEM · 042700 · 셀트리온은 068270)"
            style={{
              flex: 1, minWidth: 220, padding: '9px 14px', borderRadius: 8,
              background: BG, border: `1px solid ${BORDER}`, color: '#e2e8f0', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={() => run(input)}
            disabled={loading}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '검증 중…' : '🔍 검증'}
          </button>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['IONQ', 'TEM', 'RGTI', 'SOFI', '042700', '443060'].map(t => (
            <button key={t} onClick={() => { setInput(t); run(t) }}
              style={{ padding: '3px 10px', borderRadius: 12, background: '#1e293b', color: '#94a3b8', border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 11 }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: CARD, borderRadius: 12, padding: 20, color: '#ef4444', textAlign: 'center', border: `1px solid ${BORDER}` }}>{error}</div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 점수 헤더 */}
          <div style={{ background: CARD, borderRadius: 12, padding: '18px 20px', border: `1px solid ${data.isCandidate ? '#22c55e' : BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 18 }}>{data.name}</span>
                  <span style={{ color: '#7f93a8', fontSize: 12 }}>{data.market === 'KR' ? data.ticker : data.ticker.toUpperCase()} · {data.market}</span>
                  {data.isCandidate && (
                    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                      🚀 10배거 후보
                    </span>
                  )}
                </div>
                {data.marketCapUsd != null && (
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                    시총 ≈ ${(data.marketCapUsd / 1e9).toFixed(1)}B
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: scoreColor(data.score), fontFamily: 'monospace', lineHeight: 1 }}>{data.score}</div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>린치 기준 충족도 / 100</div>
              </div>
            </div>
          </div>

          {/* 7대 기준 체크리스트 */}
          <div style={{ background: CARD, borderRadius: 12, padding: '14px 18px', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>📋 린치 10배거 체크리스트</div>
            {data.criteria.map(c => {
              const cfg = STATUS_CFG[c.status]
              return (
                <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 13, flexShrink: 0, width: 18 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                      {c.label} <span style={{ color: cfg.color, fontSize: 11, marginLeft: 4 }}>{c.status === 'PASS' ? '충족' : c.status === 'PARTIAL' ? '부분' : c.status === 'FAIL' ? '미충족' : '자료없음'}</span>
                    </div>
                    <div style={{ color: '#8a9aaa', fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{c.detail}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 린치 종합 평결 */}
          <div style={{ background: data.isCandidate ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.05)', border: `1px solid ${data.isCandidate ? 'rgba(34,197,94,0.3)' : BORDER}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ color: data.isCandidate ? '#22c55e' : '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🧭 피터 린치 종합 평결</div>
            <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7 }}>{data.verdict}</div>
          </div>

          <div style={{ color: '#4b5563', fontSize: 11, lineHeight: 1.6 }}>
            🚀 10배거는 희귀·고위험입니다. 이 점수는 린치 기준 &lsquo;충족도&rsquo;이지 수익 예측이 아닙니다. 위성(공격) 자산으로 소액·분산만 권장 — 교육용 시뮬레이션이며 투자 추천이 아닙니다.
          </div>
        </div>
      )}
    </div>
  )
}
