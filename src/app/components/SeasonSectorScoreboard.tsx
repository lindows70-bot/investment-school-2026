'use client'
// 4계절 × GICS 섹터 실제 성적표 — '유리 섹터가 실제로 오르나'를 섹터 ETF 수익률로 검증(US/KR)
import { useState, useEffect } from 'react'
import type { SeasonSectorResult } from '@/app/api/season-sector/route'

const CARD = '#12151c', BORDER = '#252a36'
const FIT_COLOR = { favored: '#34d399', neutral: '#8599ae', unfavored: '#f87171' } as const
const FIT_LABEL = { favored: '🟢 유리', neutral: '⚪ 중립', unfavored: '🔴 불리' } as const

export default function SeasonSectorScoreboard() {
  const [data, setData] = useState<SeasonSectorResult | null>(null)
  const [err, setErr] = useState(false)
  const [mkt, setMkt] = useState<'us' | 'kr'>('us')

  useEffect(() => {
    fetch('/api/season-sector', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(() => setErr(true))
  }, [])

  if (err) return null
  if (!data) return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 18, color: '#8a9aaa', fontSize: 13 }}>
      🍂 계절별 섹터 성적표를 계산 중입니다…
    </div>
  )

  const m = data[mkt]
  const v = m.validation
  const maxAbs = Math.max(5, ...m.sectors.map(s => Math.abs(s.ret3m ?? 0)))
  const verdictCfg = {
    aligned: { color: '#34d399', text: '📗 이론대로 작동 중 — 유리 섹터가 불리 섹터보다 강합니다.' },
    diverge: { color: '#f87171', text: '📕 이론과 반대 — 불리 섹터가 더 강합니다(단기 노이즈이거나 국면 전환 신호일 수).' },
    mixed: { color: '#8599ae', text: '📘 혼조 — 유·불리 차이가 뚜렷하지 않습니다(단기 노이즈).' },
  }[v.verdict]

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🍂 이번 계절 × GICS 섹터 실제 성적표</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>섹터 ETF 최근 수익률(3개월 순) · 유리=초록 / 불리=빨강 막대</span>
        {/* US/KR 토글 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['us', 'kr'] as const).map(k => (
            <button key={k} onClick={() => setMkt(k)} style={{
              padding: '3px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: mkt === k ? '#1e293b' : 'transparent', color: mkt === k ? '#e2e8f0' : '#8599ae' }}>
              {k === 'us' ? '🇺🇸 미국' : '🇰🇷 한국'}
            </button>
          ))}
        </div>
      </div>

      {/* 계절 + 검증 배너 */}
      <div style={{ background: `${verdictCfg.color}1a`, border: `1px solid ${verdictCfg.color}55`, borderRadius: 9, padding: '8px 12px', marginBottom: 12 }}>
        <div style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
          {mkt === 'us' ? '🇺🇸' : '🇰🇷'} 현재 {m.seasonKo} · {verdictCfg.text}
        </div>
        <div style={{ color: '#aab6c4', fontSize: 11 }}>
          유리 섹터 3개월 평균 <b style={{ color: '#34d399' }}>{v.favAvg3m != null ? `${v.favAvg3m > 0 ? '+' : ''}${v.favAvg3m}%` : '—'}</b>
          {' '}vs 불리 섹터 <b style={{ color: '#f87171' }}>{v.unfavAvg3m != null ? `${v.unfavAvg3m > 0 ? '+' : ''}${v.unfavAvg3m}%` : '—'}</b>
          {v.spread3m != null && <span> · 격차 <b style={{ color: verdictCfg.color }}>{v.spread3m > 0 ? '+' : ''}{v.spread3m}%p</b></span>}
        </div>
      </div>

      {/* 섹터 막대(3개월 수익률 순) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {m.sectors.map(s => {
          const r = s.ret3m ?? 0
          const w = Math.min(48, Math.abs(r) / maxAbs * 48)   // 중앙 기준 좌우 최대 48%
          const c = FIT_COLOR[s.fit]
          return (
            <div key={s.gics} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ width: 78, flexShrink: 0, color: '#cdd6e3', fontWeight: 700, textAlign: 'right' }}>{s.ko}</span>
              <span style={{ width: 40, flexShrink: 0, fontSize: 9.5 }}>{FIT_LABEL[s.fit].split(' ')[0]}</span>
              {/* 중앙 0선 막대 */}
              <div style={{ flex: 1, position: 'relative', height: 18, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#3a4152' }} />
                {s.ret3m != null && (
                  <div style={{ position: 'absolute', top: 3, bottom: 3, borderRadius: 3, background: c,
                    ...(r >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }) }} />
                )}
              </div>
              <span style={{ width: 92, flexShrink: 0, textAlign: 'right', color: '#8a9aaa', fontSize: 10 }}>
                <b style={{ color: r >= 0 ? '#34d399' : '#f87171', fontSize: 11 }}>{s.ret3m != null ? `${r > 0 ? '+' : ''}${r}%` : '—'}</b>
                <span style={{ color: '#6e7f8f' }}> 3M</span>
                {s.ret1m != null && <span style={{ marginLeft: 5, color: '#7f93a8' }}>{s.ret1m > 0 ? '+' : ''}{s.ret1m}% 1M</span>}
              </span>
            </div>
          )
        })}
      </div>

      {/* 범례 + 정직성 캐비엇 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 10, color: '#8599ae' }}>
        <span>🟢 이번 계절 <b style={{ color: '#34d399' }}>유리</b></span>
        <span>⚪ 중립</span>
        <span>🔴 이번 계절 <b style={{ color: '#f87171' }}>불리</b></span>
        <span style={{ color: '#6e7f8f' }}>· 막대 = 3개월 수익률(섹터 ETF)</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 10, lineHeight: 1.6, marginTop: 8 }}>
        ⚠️ 1~3개월은 단기라 노이즈가 큽니다 — <b>계절 이론은 &lsquo;평균적 경향&rsquo;</b>이지 매달 맞는 게 아닙니다. 유리 섹터가 빠지거나 불리 섹터가 오르면 <b>국면 전환의 힌트</b>일 수도 있습니다.
        {mkt === 'us'
          ? ' 미국은 S&P 섹터 ETF(XLE·XLK·XLF…)로 GICS 11섹터를 정확히 추종합니다.'
          : ' 한국은 깨끗한 GICS 11 ETF가 없어 대표 섹터 ETF 프록시(반도체=기술·은행=금융 등)로, ETF가 없는 유틸리티는 🏛️GICS 섹터 차트와 동일한 테마지수(한전·가스공사 동일가중)로 채웠습니다.'}
      </div>
    </div>
  )
}
