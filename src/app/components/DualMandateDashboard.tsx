'use client'
// 🏛️ 연준 양대책무 대시보드 — 고용 안정(4지표+삼의 법칙) + 물가 안정(워시 의장 절사평균 PCE)
import { useState, useEffect } from 'react'
import type { DualMandateResult } from '@/app/api/fed-dual-mandate/route'

const CARD = '#161b25', BORDER = '#1e293b'
const fmtK = (n: number) => `${(n / 1000).toFixed(0)}K`
// ⚠️ 라벨 주의: '골디락스'는 4계절 투자법(성장↑·물가↓ 사분면)과 충돌 → 고용 신호등은 '균형(연착륙)'으로 통일
const LABOR = {
  hot: { c: '#f87171', icon: '🔴', label: '과열 (인플레 위험)' },
  balanced: { c: '#4ade80', icon: '🟢', label: '균형 (연착륙)' },
  cooling: { c: '#60a5fa', icon: '🔵', label: '냉각 (침체 경고)' },
}

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div style={{ flex: '1 1 120px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '9px 12px' }}>
      <div style={{ color: '#8a9aaa', fontSize: 10.5 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 17, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ color: '#9aa7b5', fontSize: 10 }}>{sub}</div>}
      {hint && <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 1 }}>{hint}</div>}
    </div>
  )
}

export default function DualMandateDashboard() {
  const [d, setD] = useState<DualMandateResult | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch('/api/fed-dual-mandate', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🏛️ 연준 양대책무(고용·물가) 지표를 불러오는 중…</div>
  if (!d) return null

  const ls = LABOR[d.laborStatus]
  // 삼의 법칙 게이지 위치(0~0.8 스케일, 0.5=침체)
  const sahmPct = Math.min(100, Math.max(0, d.sahm.value / 0.8 * 100))
  const sahmThreshold = 0.5 / 0.8 * 100
  // 워시 게이지(절사평균 vs 목표 2.0, 0~4% 스케일)
  const trimPct = Math.min(100, d.trimmedPce.latest / 4 * 100)
  const headPct = Math.min(100, d.headlinePce / 4 * 100)
  const targetPct = 2.0 / 4 * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(96,165,250,0.10),rgba(245,158,11,0.06))', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>🏛️</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>연준 양대책무 (Dual Mandate)</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>💼 고용 안정 + 🎯 물가 안정 — 두 축이 금리를 움직입니다</span>
        </div>
      </div>

      {/* 💼 고용 안정 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>💼 고용 시장 냉온 점검</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${ls.c}1a`, border: `1px solid ${ls.c}55`, borderRadius: 999, padding: '3px 11px' }}>
            <span style={{ fontSize: 11 }}>{ls.icon}</span>
            <span style={{ color: ls.c, fontWeight: 800, fontSize: 11.5 }}>{ls.label}</span>
          </span>
        </div>
        <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}>{d.laborNote}</div>
        {/* 4지표 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Stat label="비농업 고용(MoM)" value={`${d.payems.momK >= 0 ? '+' : ''}${fmtK(d.payems.momK)}`} sub={`${d.payems.date.slice(0, 7)}`} hint="고용 시장의 심장" />
          <Stat label="실업률" value={`${d.unrate.latest}%`} sub="자연실업률 4.0~4.4%" hint={d.unrate.latest <= 4.4 ? '정상 범위' : '둔화 신호'} />
          <Stat label="신규 실업수당(주간)" value={fmtK(d.icsa.latest)} sub={`4주평균 ${fmtK(d.icsa.avg4w)} ${d.icsa.rising ? '▲' : '▼'}`} hint="가장 빠른 선행 신호" />
          <Stat label="구인배율(JOLTs)" value={`${d.jobRatio.ratio}`} sub="구인÷실업자" hint={d.jobRatio.ratio >= 1.5 ? '과열' : d.jobRatio.ratio < 1.0 ? '냉각' : '균형'} />
        </div>
        {/* ⚠️ 삼의 법칙 게이지 */}
        <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12 }}>⚠️ 삼의 법칙(Sahm Rule) 침체 게이지</span>
            <span style={{ color: d.sahm.value >= 0.5 ? '#f87171' : '#4ade80', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{d.sahm.value}%p</span>
          </div>
          <div style={{ position: 'relative', height: 10, background: '#1e293b', borderRadius: 5, overflow: 'visible' }}>
            <div style={{ width: `${sahmPct}%`, height: '100%', background: d.sahm.value >= 0.5 ? '#f87171' : '#4ade80', borderRadius: 5 }} />
            <div style={{ position: 'absolute', left: `${sahmThreshold}%`, top: -3, bottom: -3, width: 2, background: '#f87171' }} />
            <span style={{ position: 'absolute', left: `${sahmThreshold}%`, top: -16, transform: 'translateX(-50%)', color: '#f87171', fontSize: 9, whiteSpace: 'nowrap' }}>침체 0.5</span>
          </div>
          <div style={{ color: '#9aa7b5', fontSize: 10.5, marginTop: 7, lineHeight: 1.5 }}>
            실업률 3개월 평균이 12개월 최저 대비 0.5%p 오르면 침체 진입(역사적 적중률 100%). 현재 임계까지 <b style={{ color: d.sahm.gap > 0.2 ? '#4ade80' : '#fbbf24' }}>{d.sahm.gap}%p</b> 여유.
          </div>
        </div>
      </div>

      {/* 🎯 물가 안정 — 워시 의장의 절사평균 나침반 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🎯 케빈 워시의 나침반 — 절사평균 PCE</span>
          <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>달라스 연준 · 노이즈 제거한 기조 물가</span>
        </div>
        <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6, marginBottom: 12 }}>{d.warshNote}</div>
        {/* 노이즈 필터 비교 게이지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[['헤드라인 PCE (노이즈 큼)', d.headlinePce, headPct, '#fb923c'], ['절사평균 PCE (워시 픽·기조)', d.trimmedPce.latest, trimPct, '#22d3ee']].map(([label, val, pct, col]) => (
            <div key={label as string}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 2 }}>
                <span style={{ color: '#8a9aaa' }}>{label as string}</span>
                <span style={{ color: col as string, fontWeight: 800, fontFamily: 'monospace' }}>{val as number}%</span>
              </div>
              <div style={{ position: 'relative', height: 8, background: '#0f1117', borderRadius: 4, overflow: 'visible' }}>
                <div style={{ width: `${pct as number}%`, height: '100%', background: col as string, borderRadius: 4 }} />
                <div style={{ position: 'absolute', left: `${targetPct}%`, top: -2, bottom: -2, width: 2, background: '#94a3b8' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ color: '#9aa7b5', fontSize: 10.5, marginTop: 8, lineHeight: 1.5 }}>
          회색선 = 연준 목표 2.0% · 두 라인의 차이 <b style={{ color: '#22d3ee' }}>{d.noiseGap}%p</b>가 클수록 헤드라인이 일시 충격으로 부풀어 있다는 뜻(유가·중고차·보험료 등). 워시 의장은 칼로 잘라낸 <b>절사평균</b>을 최우선 가이드로 봅니다.
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ FRED 실시간(PAYEMS·UNRATE·ICSA·JTSJOL·SAHMREALTIME·PCETRIM12M159SFRBDAL) · 12h 캐시 · 이 지표는 참고 맥락이며 계절/국면 판정(거시경제 대시보드 SSOT)을 바꾸지 않습니다 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
