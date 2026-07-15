'use client'

/**
 * 📡 GuidanceRevisionRadar — 가이던스 수정 모멘텀 레이더
 *
 * 사후 분석(어닝콜)과 달리 미래 EPS 컨센서스 변화율(기울기)을 스캐닝.
 *  · 상향 가속(Accelerating): 30일 전 대비 +3% 이상
 *  · 가이던스 축소(Decelerating): 30일 전 대비 −3% 이하
 *  · 중립(Neutral): ±3% 이내
 *
 * 데이터: /api/guidance-radar (Supabase auth · 24h 개인 캐시 · Zero-Cost)
 */

import { useState, useEffect } from 'react'
import type { GuidanceRadarResult, GuidanceItem, MomentumSignal } from '@/app/api/guidance-radar/route'
import { TK } from '@/lib/theme'

// ── 색상 토큰 ─────────────────────────────────────────────────────────────────
const C = {
  card: TK.bg7, card2: TK.bg5, border: TK.line1,
  text: TK.slate100, textSub: '#b0bec8', textLow: '#8a9db5',
  green: TK.green400, red: TK.red400, gold: TK.amber500, cyan: TK.cyan400,
  pink: TK.pink400, orange: TK.orange400, purple: TK.violet400,
  accel: TK.green400,   // 상향 가속
  decel: TK.orange400,   // 가이던스 축소
  neutral: TK.blue400, // 중립
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// ── 시그널 메타 ───────────────────────────────────────────────────────────────
const SIGNAL_META: Record<MomentumSignal, { label: string; color: string; bg: string }> = {
  accelerating: { label: '▲ 상향 가속', color: C.accel,   bg: `${C.accel}18` },
  decelerating: { label: '▼ 가이던스 축소', color: C.decel, bg: `${C.decel}18` },
  neutral:      { label: '● 중립',      color: C.neutral, bg: `${C.neutral}14` },
  no_data:      { label: '— 데이터 없음', color: C.textLow, bg: 'transparent' },
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const fmtEps = (v: number | null, cur: string) =>
  v == null ? '—' : cur === 'KRW'
    ? '₩' + v.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    : '$' + v.toFixed(2)

const fmtRate = (r: number) => `${r > 0 ? '+' : ''}${r.toFixed(1)}%`
const rateColor = (r: number) => r >= 3 ? C.accel : r <= -3 ? C.decel : C.textSub

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────
function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ fontFamily: FONT }}>
      <style>{`@keyframes grShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      {/* 하이라이트 카드 스켈레톤 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ height: 100, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${C.border}55,transparent)`, animation: 'grShimmer 1.4s infinite' }} />
          </div>
        ))}
      </div>
      {/* 테이블 스켈레톤 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 44, borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, marginBottom: 6, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${C.border}55,transparent)`, animation: 'grShimmer 1.4s infinite', animationDelay: `${i * 0.1}s` }} />
        </div>
      ))}
    </div>
  )
}

// ── 하이라이트 카드 ────────────────────────────────────────────────────────────
function HighlightCard({ item, type }: { item: GuidanceItem | null; type: 'top' | 'warn' }) {
  const isTop = type === 'top'
  const accent = isTop ? C.accel : C.decel
  const icon = isTop ? '🚀' : '⚠️'
  const title = isTop ? 'Upgrade Top Pick' : 'Downgrade Warning'
  const subtitle = isTop ? '컨센서스 상향 모멘텀 최강' : '어닝 쇼크 리스크 경보'

  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12,
      background: `linear-gradient(135deg, ${accent}0c, ${C.card2})`,
      border: `1px solid ${accent}44`,
      display: 'flex', flexDirection: 'column', gap: 6, minHeight: 104,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: accent, letterSpacing: '0.04em' }}>{title}</span>
      </div>
      {item ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{item.name.slice(0, 13)}</span>
            <span style={{ fontSize: 10, color: C.textLow, fontFamily: 'monospace' }}>{item.ticker}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 19, fontWeight: 900, fontFamily: 'monospace', color: accent }}>
              {fmtRate(item.revisionRate)}
            </span>
            <span style={{ fontSize: 10.5, color: C.textLow }}>
              {item.fallback ? '(YoY 대리값)' : '30일 전 대비'}
              {item.analystCount ? ` · ${item.analystCount}명` : ''}
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.textLow }}>
            {subtitle}
            {item.upgradeCount > 0 && <span style={{ color: C.accel, marginLeft: 6 }}>↑{item.upgradeCount}</span>}
            {item.downgradeCount > 0 && <span style={{ color: C.decel, marginLeft: 4 }}>↓{item.downgradeCount}</span>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.textLow, marginTop: 8 }}>해당 없음</div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function GuidanceRevisionRadar() {
  const [data,    setData]    = useState<GuidanceRadarResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetch('/api/guidance-radar', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!alive) return
        if (j.error) setError(j.error)
        else setData(j)
      })
      .catch(() => { if (alive) setError('데이터를 불러오지 못했습니다.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // ── 헤더 ──
  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>📡</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>가이던스 수정 모멘텀 레이더</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}1a`, color: C.cyan, fontWeight: 700 }}>EPS 컨센서스 기울기</span>
      {data && <span style={{ fontSize: 10, color: C.textLow, marginLeft: 'auto' }}>· {data.asOf.slice(0, 10)} · 24h 캐시</span>}
    </div>
  )

  if (loading) return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
      {Header}<Skeleton rows={5} />
    </div>
  )

  if (error) return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
      {Header}
      <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: TK.red300, fontSize: 13 }}>
        ⚠️ {error}
      </div>
    </div>
  )

  if (!data || data.items.length === 0) return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
      {Header}
      <div style={{ textAlign: 'center', padding: '40px 16px', color: C.textLow, fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
        개별 주식을 자산관리에 추가하면 가이던스 모멘텀을 스캐닝합니다.
      </div>
    </div>
  )

  const { items, topPick, worstWarn } = data
  const accelItems = items.filter(i => i.signal === 'accelerating').length
  const decelItems = items.filter(i => i.signal === 'decelerating').length

  return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, fontFamily: FONT }}>
      {Header}

      {/* ── 요약 바 ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: C.textLow }}>
          총 <b style={{ color: C.text }}>{items.length}종목</b> 스캔
        </span>
        {accelItems > 0 && <span style={{ fontSize: 11, color: C.accel, fontWeight: 700 }}>▲ 상향 {accelItems}</span>}
        {decelItems > 0 && <span style={{ fontSize: 11, color: C.decel, fontWeight: 700 }}>▼ 축소 {decelItems}</span>}
        <span style={{ fontSize: 11, color: C.textLow }}>
          ※ 30일 이력 없는 종목은 YoY 성장률을 대리 지표로 사용
        </span>
      </div>

      {/* ── 하이라이트 카드 (샴쌍둥이) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }} className="gr-cards">
        <HighlightCard item={topPick} type="top" />
        <HighlightCard item={worstWarn} type="warn" />
      </div>

      {/* ── 모멘텀 종합 테이블 ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ color: C.textLow, fontSize: 10.5, fontFamily: FONT }}>
              <th style={{ textAlign: 'left',  fontWeight: 700, padding: '0 8px 8px 0' }}>종목</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 8px 8px' }}>다음분기 EPS</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 8px 8px' }}>변화율(30일)</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 8px 8px' }}>업↑/다↓</th>
              <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 8px 8px' }}>모멘텀</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const sm = SIGNAL_META[item.signal]
              return (
                <tr key={item.ticker} style={{ borderTop: `1px solid ${C.border}` }}>
                  {/* 종목명 */}
                  <td style={{ padding: '9px 8px 9px 0', fontFamily: FONT }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text }}>
                      {item.name.slice(0, 14)}
                    </div>
                    <div style={{ fontSize: 9.5, color: C.textLow, marginTop: 1 }}>
                      {item.ticker} · {item.market}
                    </div>
                  </td>
                  {/* 다음 분기 EPS */}
                  <td style={{ textAlign: 'right', padding: '9px 8px', color: C.text, fontWeight: 700 }}>
                    {fmtEps(item.nextQtrEps, item.market === 'KR' ? 'KRW' : 'USD')}
                    {item.analystCount != null && (
                      <div style={{ fontSize: 9, color: C.textLow, marginTop: 1 }}>{item.analystCount}명 컨센서스</div>
                    )}
                  </td>
                  {/* 변화율 */}
                  <td style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 800, color: rateColor(item.revisionRate) }}>
                    {fmtRate(item.revisionRate)}
                    {item.fallback && <div style={{ fontSize: 9, color: C.textLow, marginTop: 1 }}>YoY 대리</div>}
                  </td>
                  {/* 업/다운 */}
                  <td style={{ textAlign: 'right', padding: '9px 8px' }}>
                    {item.upgradeCount > 0 || item.downgradeCount > 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {item.upgradeCount   > 0 && <span style={{ color: C.accel, fontWeight: 700 }}>↑{item.upgradeCount}</span>}
                        {item.downgradeCount > 0 && <span style={{ color: C.decel, fontWeight: 700 }}>↓{item.downgradeCount}</span>}
                      </div>
                    ) : <span style={{ color: C.textLow }}>—</span>}
                  </td>
                  {/* 모멘텀 시그널 태그 */}
                  <td style={{ textAlign: 'right', padding: '9px 8px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 9px', borderRadius: 20,
                      fontSize: 10.5, fontWeight: 800, fontFamily: FONT,
                      color: sm.color, background: sm.bg,
                      border: `1px solid ${sm.color}33`,
                      whiteSpace: 'nowrap',
                    }}>
                      {sm.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 푸터 */}
      <div style={{ marginTop: 14, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        📡 변화율 = 30일 전 대비 EPS 컨센서스 변화(%) · 이력 없으면 YoY 성장률(대리) ·
        업/다운 = recommendationTrend 월간 변동 · 모멘텀 ≥+3%=상향가속, ≤−3%=가이던스축소 · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
      <style>{`@media(max-width:640px){.gr-cards{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
