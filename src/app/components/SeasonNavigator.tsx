'use client'
// 🧭 4계절 매크로 내비게이터 UI — 2×2 휠 + 보유 계절 정합성 게이지 + 장단기 역전 경보
import { useState, useEffect } from 'react'
import type { SeasonNavResult } from '@/app/api/season-navigator/route'

const CARD = '#161b25', BORDER = '#1e293b'

// 2×2 상세 다이어그램 (원본 책 배치 그대로: 가로=성장, 세로=물가)
//   좌상 인플레 · 우상 스태그 · 좌하 골디락스 · 우하 리세션
type QInfo = { ko: string; season: string; icon: string; axis: string; summary: string; good: string; bad: string; textbook: string }
const QUADRANT_INFO: Record<string, QInfo> = {
  inflation: {
    ko: '인플레이션', season: '☀️ 여름·호황', icon: '☀️', axis: '고성장 · 고물가',
    summary: '경기가 확장하며 물가도 함께 오르는 국면. 실물·경기민감 자산이 강세입니다.',
    good: '에너지 · 소재 · 산업재 (시클리컬)',
    bad: '고듀레이션 성장주 (금리 부담)',
    textbook: '교과서: 예금·원자재 우위 / 장기채 약세',
  },
  stagflation: {
    ko: '스태그플레이션', season: '🍁 가을·후퇴', icon: '🍁', axis: '저성장 · 고물가',
    summary: '성장은 둔화되는데 물가는 높은, 가장 까다로운 국면. 현금·실물로 방어합니다.',
    good: '에너지 · 유틸리티 · 필수소비재',
    bad: '고성장주 (최악) · 회생주',
    textbook: '교과서: 물가채 우위 / 주식 약세',
  },
  goldilocks: {
    ko: '골디락스', season: '🌸 봄·회복', icon: '🌸', axis: '고성장 · 저물가',
    summary: '유동성이 돌고 물가는 안정된 주식 최적 국면. 위험자산을 적극 가동할 시기입니다.',
    good: '기술 · 경기소비재 · 금융',
    bad: '방어주 (상대적 소외)',
    textbook: '교과서: 주식 우위 / 물가채 약세',
  },
  recession: {
    ko: '리세션', season: '❄️ 겨울·침체', icon: '❄️', axis: '저성장 · 저물가',
    summary: '디플레이션성 침체 국면. 배당·저변동 방어주와 퀄리티 대형주가 생존합니다.',
    good: '통신 · 유틸리티 · 필수소비재 · 헬스케어',
    bad: '경기민감 · 고성장주',
    textbook: '교과서: 장기채 우위 / 예금·원자재 약세',
  },
}
const WHEEL_ORDER = ['inflation', 'stagflation', 'goldilocks', 'recession']  // 다이어그램 배치순
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
  // 물가축은 'CPI 사실' 위주로 표기 — 금리 방향(rateDir) 직역은 국면 SSOT 라벨과 충돌하므로 제외
  const infTxt = `CPI ${data.inflation.cpiYoY.toFixed(1)}% · ${data.inflation.hot ? '고물가 압력' : '물가 안정'}`

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

      {/* 2×2 상세 다이어그램 (전체 폭 · 원본 책 배치) */}
      <div style={{ background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{data.icon} 현재 계절: {data.seasonKo}</span>
          <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>{data.label}</span>
          <span style={{ marginLeft: 'auto', color: '#6e7f8f', fontSize: 10.5 }}>최일 4계절 — 성장×물가 4분면</span>
        </div>

        {/* 🌏 시장별 현재 계절 — 성장축(CLI)이 갈리면 국장/미장 계절 분리 */}
        {data.marketSeasons && (() => {
          const us = data.marketSeasons.us, kr = data.marketSeasons.kr
          const diverge = us.quadrant !== kr.quadrant
          const Badge = ({ flag, m }: { flag: string; m: typeof us }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f1117', border: `1px solid ${Q_COLOR[m.quadrant]}55`, borderRadius: 8, padding: '5px 10px' }}>
              <span style={{ fontSize: 13 }}>{flag}</span>
              <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700 }}>{m.icon} {m.seasonKo.replace(/^.. /, '')}</span>
              <span style={{ color: '#7f93a8', fontSize: 10, fontFamily: 'monospace' }}>CLI {m.cli.toFixed(1)} {m.dir === 'up' ? '▲' : '▼'}</span>
            </div>
          )
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#8a9aaa', fontSize: 11, fontWeight: 700 }}>🌏 시장별 계절</span>
              <Badge flag="🇺🇸" m={us} />
              <Badge flag="🇰🇷" m={kr} />
              <span style={{ color: diverge ? '#f59e0b' : '#6e7f8f', fontSize: 10.5 }}>
                {diverge ? '⚠️ 두 시장의 경기 국면이 갈립니다 — 종목별로 해당 시장 계절로 채점' : '두 시장 경기 국면 동조 · 물가축은 글로벌 공통'}
              </span>
            </div>
          )
        })()}

        {/* 상단 축 라벨 */}
        <div style={{ textAlign: 'center', color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, marginBottom: 4 }}>▲ 고물가</div>
        {/* 좌우 축 + 그리드 */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>← 고성장</div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {WHEEL_ORDER.map(q => {
              const info = QUADRANT_INFO[q]
              const active = q === data.quadrant
              const c = Q_COLOR[q]
              return (
                <div key={q} style={{ background: active ? `${c}1f` : '#0f1117', border: `1.5px solid ${active ? c : BORDER}`, borderRadius: 10, padding: '12px 13px', opacity: active ? 1 : 0.7, boxShadow: active ? `0 0 18px ${c}55` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 17 }}>{info.icon}</span>
                    <span style={{ color: active ? c : '#cbd5e1', fontWeight: 800, fontSize: 13 }}>{info.ko}</span>
                    <span style={{ color: '#8a9aaa', fontSize: 10 }}>{info.season}</span>
                    {active && <span style={{ marginLeft: 'auto', background: c, color: '#0b0e15', fontWeight: 800, fontSize: 9, borderRadius: 5, padding: '1px 7px' }}>현재</span>}
                  </div>
                  <div style={{ color: '#7f93a8', fontSize: 10, fontFamily: 'monospace', marginBottom: 5 }}>{info.axis}</div>
                  <div style={{ color: '#aab6c4', fontSize: 11, lineHeight: 1.5, marginBottom: 7 }}>{info.summary}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 10.5, lineHeight: 1.4 }}><span style={{ color: '#86efac', fontWeight: 700 }}>🟢 유리 </span><span style={{ color: '#cbd5e1' }}>{info.good}</span></div>
                    <div style={{ fontSize: 10.5, lineHeight: 1.4 }}><span style={{ color: '#fca5a5', fontWeight: 700 }}>🔴 불리 </span><span style={{ color: '#cbd5e1' }}>{info.bad}</span></div>
                    <div style={{ fontSize: 9.5, color: '#6e7f8f', marginTop: 2 }}>📖 {info.textbook}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, writingMode: 'vertical-rl' }}>저성장 →</div>
        </div>
        {/* 하단 축 라벨 */}
        <div style={{ textAlign: 'center', color: '#8a9aaa', fontSize: 10.5, fontWeight: 700, marginTop: 4 }}>▼ 저물가</div>

        {/* 축 진단(투명성) */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ color: '#8a9aaa' }}>📈 성장축 (OECD CLI)</span>
            <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{growthTxt}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ color: '#8a9aaa' }}>🔥 물가축</span>
            <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{infTxt}</span>
          </div>
          <div style={{ color: '#6e7f8f', fontSize: 10.5, marginLeft: 'auto' }}>국면 SSOT: {data.regimeLabel}</div>
        </div>
      </div>

      {/* 정합성 점수 + 종목별 적합도 (전체 폭) */}
      <div style={{ background: CARD, borderRadius: 12, padding: 16, border: `1px solid ${BORDER}` }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>⚖️ 내 포트폴리오 계절 정합성</div>
        <Gauge score={data.alignmentScore} />
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '5px 16px' }}>
          {data.perHolding.slice(0, 8).map(h => {
            const fc = h.fit >= 0.7 ? '#22c55e' : h.fit >= 0.5 ? '#f59e0b' : '#ef4444'
            return (
              <div key={h.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ fontSize: 10 }}>{h.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
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
        ※ 계절 = 성장(OECD 경기선행지수)×물가(CPI·금리) 2×2 사분면 · 매크로 결론은 거시경제 대시보드와 동일한 macro-regime SSOT를 따릅니다. 시장별 계절은 성장축에 미국·한국 각각의 CLI를 쓰되, 물가축은 글로벌 공통(한국 CPI는 무료 신선 데이터 부재로 글로벌 기준 사용)입니다. 현금 비중은 앱이 추적하지 않으므로 권장치는 직접 확인하세요. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
