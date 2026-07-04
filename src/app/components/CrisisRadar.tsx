'use client'
// 🚨 글로벌 위기 감지 레이더 — 시장 버블 4대 지표 실데이터 + 종합 Alert 신호등
import { useState, useEffect } from 'react'
import type { CrisisRadarResult, Signal } from '@/app/api/crisis-radar/route'

const CARD = '#12151c', BORDER = '#252a36'
const SIG: Record<Signal, { dot: string; color: string; ko: string; bg: string }> = {
  safe: { dot: '🟢', color: '#4ade80', ko: '안전', bg: 'rgba(74,222,128,0.08)' },
  caution: { dot: '🟡', color: '#fbbf24', ko: '주의', bg: 'rgba(251,191,36,0.08)' },
  danger: { dot: '🔴', color: '#f87171', ko: '위험', bg: 'rgba(248,113,113,0.09)' },
}

export default function CrisisRadar() {
  const [d, setD] = useState<CrisisRadarResult | null>(null)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<string | null>('cape')

  useEffect(() => {
    fetch('/api/crisis-radar', { cache: 'no-store' }).then(r => r.json()).then(x => (x?.metrics ? setD(x) : setErr(true))).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 종합 Alert 배너 */}
      {d && (
        <div style={{ background: SIG[d.alertLevel].bg, border: `1px solid ${SIG[d.alertLevel].color}55`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }}>{SIG[d.alertLevel].dot}</span>
            <span style={{ color: SIG[d.alertLevel].color, fontWeight: 900, fontSize: 18 }}>글로벌 위기 감지 레이더 — {SIG[d.alertLevel].ko}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {d.metrics.map(m => <span key={m.key} title={m.label} style={{ width: 12, height: 12, borderRadius: '50%', background: SIG[m.signal].color }} />)}
            </span>
          </div>
          <div style={{ color: '#cdd6e3', fontSize: 12.5, lineHeight: 1.7, marginTop: 8 }}>{d.summary}</div>
        </div>
      )}
      {!d && !err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>버블 지표 4종을 실데이터로 계산 중입니다…</div>}
      {err && <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16, color: '#8a9aaa', fontSize: 13 }}>데이터를 불러오지 못했습니다.</div>}

      {d && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, marginBottom: 3 }}>📊 핵심 밸류에이션 지표 4종 — 한눈에 비교</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 10 }}>각 지표는 실데이터로 계산(Shiller·FRED). 클릭하면 과거 위기 대비·해석을 펼칩니다.</div>

          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '0 8px 6px', color: '#7f93a8', fontSize: 10, fontWeight: 700, borderBottom: `1px solid ${BORDER}` }}>
            <span>지표명</span><span>측정 대상</span><span style={{ textAlign: 'right' }}>역사평균</span><span style={{ textAlign: 'right' }}>현재</span><span style={{ textAlign: 'center' }}>경고</span>
          </div>
          {d.metrics.map(m => {
            const s = SIG[m.signal], isOpen = open === m.key
            return (
              <div key={m.key}>
                <div onClick={() => setOpen(isOpen ? null : m.key)} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '9px 8px', borderTop: `1px solid ${BORDER}`, cursor: 'pointer', background: isOpen ? '#0f1117' : 'transparent', alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>{m.label}</span>
                  <span style={{ color: '#9aa7b5', fontSize: 10.5 }}>{m.measure}</span>
                  <span style={{ textAlign: 'right', color: '#9aa7b5', fontSize: 11.5, fontFamily: 'monospace' }}>{m.mean}{m.unit}</span>
                  <span style={{ textAlign: 'right', color: s.color, fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace' }}>{m.value != null ? `${m.value}${m.unit}` : '—'}</span>
                  <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: s.color }}>{s.dot} {s.ko}</span>
                </div>
                {isOpen && (
                  <div style={{ background: '#0f1117', borderLeft: `3px solid ${s.color}`, padding: '9px 14px', margin: '0 8px 4px' }}>
                    <div style={{ color: '#cdd6e3', fontSize: 11.5, lineHeight: 1.6 }}>{m.note}</div>
                    <div style={{ color: '#7f93a8', fontSize: 10.5, marginTop: 4 }}>적정 기준: {m.norm}</div>
                    {m.history && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {m.history.map(h => (
                          <div key={h.label} style={{ background: '#161b25', borderRadius: 7, padding: '5px 11px', border: `1px solid ${BORDER}` }}>
                            <div style={{ color: '#7f93a8', fontSize: 9.5 }}>{h.label}</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{h.value}{m.unit}</div>
                          </div>
                        ))}
                        {m.value != null && (
                          <div style={{ background: `${s.color}18`, borderRadius: 7, padding: '5px 11px', border: `1px solid ${s.color}55` }}>
                            <div style={{ color: s.color, fontSize: 9.5, fontWeight: 700 }}>현재</div>
                            <div style={{ color: s.color, fontWeight: 900, fontSize: 13, fontFamily: 'monospace' }}>{m.value}{m.unit}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 10, lineHeight: 1.6 }}>
            ⚠️ 데이터: Shiller CAPE·S&P PER(multpl.com)·버핏지표(FRED 시총÷GDP, 과거값도 실측)·10년물(FRED). 임계 밴드는 공개 방법론의 교과서 기준(교육용). <b style={{ color: '#cdd6e3' }}>밸류에이션 지표는 &lsquo;언제&rsquo; 떨어질지는 못 맞힙니다</b> — 고평가에서 몇 년 더 오르기도 합니다. 폭락 예언이 아니라 위험 관리·기대수익 조정 신호로 쓰세요. 레이 달리오 버블 지표·매크로 날씨와 함께 보면 좋습니다.
          </div>
        </div>
      )}
    </div>
  )
}
