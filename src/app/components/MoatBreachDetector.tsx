'use client'

/**
 * 🏰 MoatBreachDetector — 해자 붕괴 경보기 (킬러 기능 11단계, 마지막)
 *
 * 4개년 총마진(가격결정력=해자) 추세를 보고, 최신 총마진이 정점 대비 얼마나
 * 침식됐는지로 '견고 🏰 / 균열 ⚠️ / 붕괴 🚨'를 경보. 경기순환 회복은 자동 견고.
 *
 * 데이터: 서버액션 getMoatBreach (Yahoo fundamentalsTimeSeries, 6h 캐시 · US·KR 공통)
 * 스타일: 린치 가치평가 엔진과 동일 컨벤션 (플랫 카드 + C 토큰 + monospace)
 */

import { useState, useEffect } from 'react'
import { getMoatBreach, type MoatResult } from '@/app/actions/getMoatBreach'

interface Props { ticker: string; name: string; market: string }

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', purple: '#a78bfa',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

const VERDICT: Record<MoatResult['verdict'], { label: string; emoji: string; color: string }> = {
  intact:   { label: '해자 견고',      emoji: '🏰', color: C.green },
  hairline: { label: '해자 균열 조짐', emoji: '⚠️', color: C.gold },
  breach:   { label: '해자 붕괴 위험', emoji: '🚨', color: C.red },
  early:    { label: '초기 · 판단 보류', emoji: '🌱', color: C.purple },
}
const WIDTH_LABEL: Record<MoatResult['moatWidth'], string> = {
  wide: '넓은 해자', moderate: '보통 해자', narrow: '얕은 해자', none: '해자 불명확',
}

export default function MoatBreachDetector({ ticker, name, market }: Props) {
  const [data, setData] = useState<MoatResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setData(null)
    getMoatBreach({ ticker, name, market })
      .then(r => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name, market])

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>🏰</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>해자 붕괴 경보기 — 가격결정력 추세</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.purple}22`, color: C.purple, fontWeight: 700 }}>SECRET · 총마진</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>{Header}{child}</div>
  )

  if (loading) return Wrap(<div style={{ fontSize: 12.5, color: C.textLow }}>🏰 4개년 마진 추세로 해자의 견고함을 점검 중…</div>)
  if (!data) return null
  if (data.status === 'unsupported') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>🏰 {data.message}</div>)
  if (data.status === 'error') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>🏰 {data.message || '데이터를 불러오지 못했습니다.'}</div>)

  const v = VERDICT[data.verdict]
  const accent = v.color
  const gmYears = data.years.filter(y => y.grossMargin != null)
  const maxGM = gmYears.length ? Math.max(...gmYears.map(y => y.grossMargin as number)) : 1

  const insufficient = data.status === 'insufficient'

  return Wrap(
    <>
      {/* 판정 배너 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 12, background: `${accent}14`, border: `1px solid ${accent}44`, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: accent }}>{v.emoji} {v.label}</span>
        {!insufficient && data.verdict !== 'early' && (
          <span style={{ fontSize: 11, color: C.textLow }}>
            {data.isHolding
              ? `· ${WIDTH_LABEL[data.moatWidth]} · ROE 기반 평가(지주사·NAV)`
              : data.isFinancial
              ? `· ${WIDTH_LABEL[data.moatWidth]} · ROE 기반 평가(금융주)`
              : `· ${WIDTH_LABEL[data.moatWidth]} · 총마진 정점比 ${data.erosionPct != null && data.erosionPct > 0 ? `-${data.erosionPct}%` : '유지'}`}
          </span>
        )}
      </div>

      {insufficient ? (
        <div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.65, marginBottom: 14 }}>🌱 {data.message}</div>
      ) : (
        <>
          {/* 총마진 4개년 추세 바 */}
          {gmYears.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, color: C.textLow, marginBottom: 10, fontWeight: 700 }}>총마진(Gross Margin) 추세 — 해자의 높이</div>
              {/* height는 '막대(78)+상단%라벨+하단연도+간격'를 모두 담아야 라벨이 위 헤더를 침범하지 않음 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 122 }}>
                {gmYears.map((y, i) => {
                  const gm = y.grossMargin as number
                  const isLast = i === gmYears.length - 1
                  const isPeak = gm === maxGM
                  const h = Math.max(6, Math.round((gm / (maxGM || 1)) * 78))
                  const barColor = isLast ? accent : isPeak ? C.cyan : C.textLow
                  return (
                    <div key={y.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, fontFamily: 'monospace', color: barColor }}>{gm.toFixed(0)}%</span>
                      <div style={{ width: '100%', maxWidth: 46, height: h, borderRadius: 5, background: barColor, opacity: isLast ? 1 : 0.55 }} />
                      <span style={{ fontSize: 9.5, color: C.textLow, fontFamily: 'monospace' }}>{String(y.year).slice(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 핵심 지표 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { k: data.isHolding ? '총마진(지주사 N/A)' : data.isFinancial ? '총마진(금융 N/A)' : '현재 총마진', val: data.grossNow != null ? `${data.grossNow.toFixed(1)}%` : '—', c: data.grossNow != null && data.grossNow >= 40 ? C.green : data.grossNow != null && data.grossNow >= 25 ? C.blue : C.gold },
              { k: '영업이익률', val: data.opNow != null ? `${data.opNow.toFixed(1)}%` : '—', c: data.opNow != null && data.opNow >= 20 ? C.green : data.opNow != null && data.opNow >= 0 ? C.blue : C.red },
              { k: 'ROE', val: data.roe != null ? `${data.roe.toFixed(1)}%` : '—', c: data.roe != null && data.roe >= 15 ? C.green : data.roe != null && data.roe >= 0 ? C.blue : C.red },
            ].map(m => (
              <div key={m.k} style={{ padding: '9px 10px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 3 }}>{m.k}</div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: m.c }}>{m.val}</div>
              </div>
            ))}
          </div>
          {data.revGrowthYoY != null && (
            <div style={{ fontSize: 10.5, color: C.textLow, marginBottom: 12 }}>
              · 최신 매출 성장률(YoY): <span style={{ fontFamily: 'monospace', fontWeight: 700, color: data.revGrowthYoY >= 0 ? C.green : C.red }}>{data.revGrowthYoY > 0 ? '+' : ''}{data.revGrowthYoY}%</span>
            </div>
          )}
        </>
      )}

      {/* 코멘트 */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.75, fontStyle: 'italic' }}>&ldquo;{data.lynchComment}&rdquo;</div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        🏰 해자=가격결정력(총마진의 높이·지속성) · 판정=최신 총마진의 4년 정점 대비 침식률(≥20% 붕괴·≥8% 균열) · 경기순환 일시 하락은 회복 시 자동 견고 처리 · Yahoo 4개년 손익(美·韓 공통, 비율이라 환율 무관) · 교육용 참고.
      </div>
    </>,
    `${accent}55`
  )
}
