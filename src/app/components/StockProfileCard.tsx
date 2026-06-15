'use client'
// 🌟 종목 투자 프로필 카드 — 해자·스타등급(공정가치)·상대 PSR 3초 요약(리서치 상단 캡스톤)
import { useState, useEffect } from 'react'
import type { StockProfile } from '@/lib/stockProfile'
import { UNCERTAINTY_KO, MOAT_KO, TREND_KO, STEWARD_KO } from '@/lib/morningstarRating'

const CARD = '#161b25', BORDER = '#1e293b'
const starColor = (n: number) => n >= 4 ? '#4ade80' : n >= 3 ? '#fbbf24' : '#f87171'
const moatColor = (w: string) => w === 'wide' ? '#fbbf24' : w === 'moderate' ? '#60a5fa' : w === 'narrow' ? '#a8b5c2' : '#6e7f8f'
const trendColor = (t: string) => t === 'positive' ? '#4ade80' : t === 'negative' ? '#f87171' : '#94a3b8'

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = n >= i ? 1 : n >= i - 0.5 ? 0.5 : 0
        return (
          <span key={i} style={{ position: 'relative', width: 18, fontSize: 18, lineHeight: 1, color: '#2c3340' }}>
            ★<span style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', width: `${fill * 100}%`, color: starColor(n) }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

const fmtPrice = (v: number | null, cur: string) => v == null ? '—' : cur === 'KRW' ? `₩${Math.round(v).toLocaleString()}` : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function StockProfileCard({ ticker, name, market }: { ticker: string; name: string; market: string }) {
  const [d, setD] = useState<StockProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setD(null)
    const mkt = market === 'KR' ? 'KR' : 'US'
    fetch(`/api/stock-profile?ticker=${encodeURIComponent(ticker)}&market=${mkt}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', color: '#8a9aaa', fontSize: 12 }}>🌟 {name}의 투자 프로필을 분석 중입니다…</div>
  if (!d) return null

  const disc = d.discountPct
  const psrRatio = (d.psr != null && d.psrMedian != null && d.psrMedian > 0) ? d.psr / d.psrMedian : null
  // 상대 PSR 막대 폭(중앙값=50% 기준, 2배=100%)
  const psrBar = (v: number | null) => v == null ? 0 : Math.min(100, (v / ((d.psrMedian ?? v) * 2)) * 100)

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.06),rgba(34,197,94,0.04))', borderRadius: 12, border: '1px solid rgba(251,191,36,0.28)', padding: '15px 17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🌟</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>투자 프로필</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>해자 × 공정가치 × 상대 밸류 — 3초 요약</span>
        {/* ① 해자 배지 — 상단 우측 */}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span title={`해자 추세: ${TREND_KO[d.moatTrend]}`} style={{ background: `${moatColor(d.moatWidth)}1f`, color: moatColor(d.moatWidth), border: `1px solid ${moatColor(d.moatWidth)}66`, borderRadius: 7, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
            🏰 해자 {MOAT_KO[d.moatWidth]}
          </span>
          {d.baseEffect && <span title="작년 이익 붕괴 후 폭증(기저효과)으로 공정가치가 부풀려질 수 있어 '저평가' 신호를 과신하면 안 됩니다." style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24', border: '1px solid #fbbf2455', borderRadius: 7, padding: '2px 9px', fontSize: 10.5, fontWeight: 700 }}>⚠️ 기저효과</span>}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* ② 스타 레이팅 게이지 — 공정가치 vs 현재가 */}
        <div style={{ flex: '1 1 230px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>스타 등급 (공정가치 대비 가격)</div>
          {d.stars != null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Stars n={d.stars} />
                <span style={{ color: starColor(d.stars), fontWeight: 900, fontSize: 16 }}>★{d.stars}</span>
              </div>
              {/* 공정가치 라인 게이지: 현재가가 공정가치 위(고평가)/아래(저평가) */}
              <div style={{ position: 'relative', height: 8, background: '#1e293b', borderRadius: 4, marginBottom: 8 }}>
                <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: '#94a3b8' }} title="공정가치" />
                {disc != null && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
                    ...(disc >= 0
                      ? { right: '50%', width: `${Math.min(48, disc / 2)}%`, background: '#22c55e' }
                      : { left: '50%', width: `${Math.min(48, Math.abs(disc) / 2)}%`, background: '#ef4444' }) }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#8a9aaa' }}>현재가 <b style={{ color: '#cbd5e1' }}>{fmtPrice(d.currentPrice, d.currency)}</b></span>
                <span style={{ color: '#8a9aaa' }}>공정가치 <b style={{ color: '#cbd5e1' }}>{fmtPrice(d.fairValue, d.currency)}</b></span>
              </div>
              {disc != null && (
                <div style={{ marginTop: 6, color: disc >= 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 12.5 }}>
                  {disc >= 0 ? `▼ ${disc.toFixed(0)}% 저평가` : `▲ ${Math.abs(disc).toFixed(0)}% 고평가`}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#8599ae', fontSize: 11.5, lineHeight: 1.6 }}>
              별점 보류 — {d.baseEffect ? '기저효과(이익 폭증)로 공정가치 과대 착시' : '적자·현금흐름 음수·데이터 부족'}으로 공정가치 신뢰 불가. 해자·매출 성장으로 보세요.
            </div>
          )}
        </div>

        {/* 보조 지표 — 불확실성 · 자본배분 */}
        <div style={{ flex: '1 1 150px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
          <Kv k="불확실성" v={UNCERTAINTY_KO[d.uncertainty]} sub="높을수록 더 큰 안전마진 요구" />
          <Kv k="해자 추세" v={TREND_KO[d.moatTrend]} c={trendColor(d.moatTrend)} />
          <Kv k="자본배분(경영진)" v={STEWARD_KO[d.stewardship]} />
        </div>
      </div>

      {/* ③ 상대 PSR 비교 — 종목 vs 동종 중앙값 */}
      {d.psr != null && (
        <div style={{ marginTop: 12, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
            <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>상대 밸류 — 매출 대비 가격(PSR){d.sectorLabel ? ` · ${d.sectorLabel}` : ''}</span>
            {psrRatio != null && (
              <span style={{ marginLeft: 'auto', color: psrRatio <= 0.85 ? '#4ade80' : psrRatio >= 1.15 ? '#f87171' : '#94a3b8', fontWeight: 800, fontSize: 11.5 }}>
                {psrRatio <= 0.85 ? `동종 대비 ${Math.round((1 - psrRatio) * 100)}% 저평가` : psrRatio >= 1.15 ? `동종 대비 ${Math.round((psrRatio - 1) * 100)}% 고평가` : '동종과 비슷'}
              </span>
            )}
          </div>
          <PsrBar label={`${name.slice(0, 10)} (이 종목)`} v={d.psr} pct={psrBar(d.psr)} color="#60a5fa" />
          {d.psrMedian != null
            ? <PsrBar label={`동종 피어 중앙값${d.peerCount ? ` (${d.peerCount}종)` : ''}`} v={d.psrMedian} pct={psrBar(d.psrMedian)} color="#8599ae" />
            : <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 4 }}>동종 피어 PSR 데이터가 부족해 절대값만 표시(상대 비교 보류).</div>}
          <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 7, lineHeight: 1.5 }}>
            PSR=시총÷매출 · 산업마다 정상치가 달라 <b style={{ color: '#8a9aaa' }}>같은 업종끼리만</b> 비교(절대 임계 아님) · 적자기업도 매출 대비 밸류를 볼 수 있는 척도.
          </div>
        </div>
      )}

      <div style={{ marginTop: 11, color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 아래 ⚔️섹터 피어 X-Ray·🏰해자 경보기에서 상세 분석을 볼 수 있습니다. 별점=공정가치(버핏식 보수적 DCF) 대비 가격이며 &lsquo;타이밍&rsquo; 보장이 아닙니다 · 모닝스타 공개 방법론을 우리 엔진으로 재현한 교육용 · 투자 추천 아님.
      </div>
    </div>
  )
}

function Kv({ k, v, c, sub }: { k: string; v: string; c?: string; sub?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
        <span style={{ color: '#8a9aaa' }}>{k}</span>
        <span style={{ color: c ?? '#cbd5e1', fontWeight: 700 }}>{v}</span>
      </div>
      {sub && <div style={{ color: '#6e7f8f', fontSize: 9 }}>{sub}</div>}
    </div>
  )
}

function PsrBar({ label, v, pct, color }: { label: string; v: number; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
      <span style={{ color: '#aab6c4', fontSize: 11, width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ color: '#cbd5e1', fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace', width: 44, textAlign: 'right' }}>{v.toFixed(1)}×</span>
    </div>
  )
}
