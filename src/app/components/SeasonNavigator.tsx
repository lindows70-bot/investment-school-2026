'use client'
// 🧭 4계절 매크로 내비게이터 UI — 2×2 휠 + 보유 계절 정합성 게이지 + 장단기 역전 경보
import { useState, useEffect } from 'react'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'

const CARD = '#161b25', BORDER = '#1e293b'

// 2×2 휠 위치(성장 가로 · 물가 세로) — 다이어그램과 동일 배치
const WHEEL: { q: string; row: number; col: number; ko: string; icon: string }[] = [
  { q: 'inflation',   row: 0, col: 0, ko: '인플레이션', icon: '☀️' },  // 성장↑ 물가↑
  { q: 'stagflation', row: 0, col: 1, ko: '스태그플레이션', icon: '🍁' }, // 성장↓ 물가↑
  { q: 'goldilocks',  row: 1, col: 0, ko: '골디락스', icon: '🌸' },    // 성장↑ 물가↓
  { q: 'recession',   row: 1, col: 1, ko: '리세션', icon: '❄️' },      // 성장↓ 물가↓
]
const Q_COLOR: Record<string, string> = {
  goldilocks: '#22c55e', inflation: '#f59e0b', stagflation: '#ef4444', recession: '#3b82f6', shoulder: '#8a9aaa',
}

function Gauge({ score }: { score: number }) {
  const col = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? '계절에 잘 맞는 포트폴리오' : score >= 45 ? '부분적으로 맞음' : '계절과 어긋남 — 점검 권장'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ color: col, fontWeight: 900, fontSize: 30, fontFamily: 'monospace' }}>{score}</span>
        <span style={{ color: '#8a9aaa', fontSize: 12 }}>/ 100점</span>
        <span style={{ marginLeft: 'auto', color: col, fontSize: 12, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ height: 8, background: '#0f1117', borderRadius: 5, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
        <div style={{ width: `${score}%`, height: '100%', background: col, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

export default function SeasonNavigator() {
  const [data, setData] = useState<SeasonNavResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/season-navigator', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j.error ? null : j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🧭 현재 시장의 계절과 내 포트폴리오 정합성을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>4계절 데이터를 불러오지 못했습니다.</div>

  const accent = Q_COLOR[data.quadrant] ?? '#8a9aaa'
  const growthTxt = `${data.growth.cli.toFixed(1)} ${data.growth.dir === 'up' ? '▲ 상승' : '▼ 하강'}${data.growth.aboveTrend ? ' · 추세 상회' : ' · 추세 하회'}`
  const infTxt = `${data.inflation.cpiYoY.toFixed(1)}% · ${data.inflation.rateDir === 'cut' ? '금리 인하' : data.inflation.rateDir === 'hike' ? '금리 인상' : '금리 동결'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: `linear-gradient(135deg, ${accent}1a, rgba(59,130,246,0.05))`, border: `1px solid ${accent}55`, borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 18 }}>🧭</span>
        <div>
          <div style={{ color: accent, fontWeight: 800, fontSize: 12, marginBottom: 2 }}>4계절 매크로 내비게이터 — 최일 『4계절 투자법』</div>
          <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6 }}>
            성장(OECD 경기선행지수)과 물가(CPI·금리)의 2×2로 지금이 어느 계절인지 판정하고, 내 포트폴리오가 그 계절에 맞게 짜였는지 점수로 보여줍니다.
          </div>
        </div>
      </div>

      {/* ⚠️ 장단기 금리 역전 조기 경보 */}
      {data.yieldCurveInverted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444466', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>
            <b>장단기 금리 역전 감지</b> (10년−2년 {data.yieldCurve?.toFixed(2)}%p). 역사적으로 경기 침체에 선행한 신호입니다 — 위험 자산 비중 축소를 신중히 검토하세요.
          </div>
        </div>
      )}

      {/* 본문 2단: 좌 계절 휠 / 우 정합성 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* 좌 — 2×2 휠 */}
        <div style={{ flex: '1 1 300px', background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>{data.icon} 현재 계절: {data.seasonKo}</div>
          <div style={{ color: '#8a9aaa', fontSize: 11, marginBottom: 10 }}>{data.label}</div>
          {/* 휠 그리드 */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {WHEEL.map(w => {
              const active = w.q === data.quadrant
              const c = Q_COLOR[w.q]
              return (
                <div key={w.q} style={{ background: active ? `${c}22` : '#0f1117', border: `1.5px solid ${active ? c : BORDER}`, borderRadius: 9, padding: '12px 10px', textAlign: 'center', opacity: active ? 1 : 0.55, boxShadow: active ? `0 0 16px ${c}44` : 'none' }}>
                  <div style={{ fontSize: 20 }}>{w.icon}</div>
                  <div style={{ color: active ? c : '#8a9aaa', fontWeight: active ? 800 : 600, fontSize: 11.5, marginTop: 2 }}>{w.ko}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6e7f8f', fontSize: 9.5, marginTop: 6 }}>
            <span>← 성장↑</span><span>물가축 ↕</span><span>성장↓ →</span>
          </div>
          {/* 축 진단(투명성) */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#8a9aaa' }}>📈 성장축 (OECD CLI)</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{growthTxt}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#8a9aaa' }}>🔥 물가축 (CPI·금리)</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{infTxt}</span>
            </div>
            <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 2 }}>국면 SSOT: {data.regimeLabel}</div>
          </div>
        </div>

        {/* 우 — 정합성 점수 + 종목별 적합도 */}
        <div style={{ flex: '1 1 300px', background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>⚖️ 내 포트폴리오 계절 정합성</div>
          <Gauge score={data.alignmentScore} />
          {/* 종목별 적합도 */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.perHolding.slice(0, 6).map(h => {
              const fc = h.fit >= 0.7 ? '#22c55e' : h.fit >= 0.5 ? '#f59e0b' : '#ef4444'
              return (
                <div key={h.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                  <span style={{ color: '#8a9aaa', fontFamily: 'monospace', fontSize: 10.5 }}>{h.weight}%</span>
                  <div style={{ width: 56, height: 5, background: '#0f1117', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${h.fit * 100}%`, height: '100%', background: fc }} />
                  </div>
                </div>
              )
            })}
            {data.perHolding.length === 0 && <div style={{ color: '#8a9aaa', fontSize: 11 }}>보유한 개별 주식이 없습니다.</div>}
          </div>
        </div>
      </div>

      {/* 행동 가이드 + 현금 조언 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${accent}33` }}>
        <div style={{ color: accent, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>📋 {data.seasonKo} 행동 가이드</div>
        <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>{data.guide}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {data.favored.map(s => <span key={s} style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}44`, borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>우대 {s}</span>)}
        </div>
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 11px', color: '#93b4d8', fontSize: 11, lineHeight: 1.5 }}>
          💵 {data.cashHint}
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 계절 = 성장(OECD 경기선행지수 미국)×물가(CPI·금리) 2×2 사분면 · 매크로 결론은 거시경제 대시보드와 동일한 macro-regime SSOT를 따릅니다. 현금 비중은 앱이 추적하지 않으므로 권장치는 직접 확인하세요. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
