'use client'
// 🌟 모닝스타식 스타 등급 — 보유 종목별 공정가치(DCF)·해자·불확실성·자본배분을 별점으로(운용 본부 진단)
import { useState, useEffect } from 'react'
import type { MorningstarResult, RatingEntry } from '@/app/api/morningstar-rating/route'
import { UNCERTAINTY_KO, MOAT_KO, TREND_KO, STEWARD_KO } from '@/lib/morningstarRating'

const CARD = '#161b25', BORDER = '#1e293b'
const starColor = (n: number) => n >= 4 ? '#4ade80' : n >= 3 ? '#fbbf24' : '#f87171'
const moatColor = (w: string) => w === 'wide' ? '#4ade80' : w === 'moderate' ? '#60a5fa' : w === 'narrow' ? '#fbbf24' : '#8599ae'
const trendColor = (t: string) => t === 'positive' ? '#4ade80' : t === 'negative' ? '#f87171' : '#94a3b8'

// ★ 별점 게이지 (0.5 단위)
function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, letterSpacing: 0.5 }} title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = n >= i ? 1 : n >= i - 0.5 ? 0.5 : 0
        return (
          <span key={i} style={{ position: 'relative', width: 14, fontSize: 14, lineHeight: 1, color: '#2c3340' }}>
            ★<span style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', width: `${fill * 100}%`, color: starColor(n) }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

const fmtPrice = (v: number | null, cur: string) => v == null ? '—' : cur === 'KRW' ? `₩${Math.round(v).toLocaleString()}` : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function MorningstarRatings() {
  const [d, setD] = useState<MorningstarResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/morningstar-rating', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
        .catch(() => { if (alive) setD(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', color: '#8a9aaa', fontSize: 12 }}>🌟 모닝스타식 등급을 산정 중입니다…</div>
  if (!d || d.total === 0) return null

  const rated = d.entries.filter(e => e.stars != null)
  const unrated = d.entries.filter(e => e.stars == null)

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13.5 }}>🌟 모닝스타식 스타 등급</span>
        {d.avgStars != null && <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 12 }}>평균 ★{d.avgStars}</span>}
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>공정가치(DCF) × 해자 × 불확실성 × 자본배분</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 11, lineHeight: 1.5 }}>
        ★5=공정가치 대비 크게 저평가 · ★1=고평가. <b style={{ color: '#aab6c4' }}>불확실성이 높을수록 더 큰 안전마진(할인)을 요구</b>합니다 — 별점은 &lsquo;가치&rsquo;지 &lsquo;타이밍&rsquo;이 아닙니다.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rated.map(e => <Row key={e.ticker} e={e} open={open === e.ticker} onToggle={() => setOpen(open === e.ticker ? null : e.ticker)} />)}
      </div>

      {unrated.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>⚠️ 공정가치(DCF) 산정 보류 — 적자·현금흐름 음수·데이터 부족, 또는 <b style={{ color: '#fbbf24' }}>기저효과</b>(작년 이익 붕괴 후 폭증 → 공정가치 과대 착시)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unrated.map(e => <Row key={e.ticker} e={e} open={open === e.ticker} onToggle={() => setOpen(open === e.ticker ? null : e.ticker)} />)}
          </div>
        </div>
      )}

      <div style={{ marginTop: 11, color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 모닝스타 공개 방법론(해자·공정가치·불확실성·자본배분)을 우리 DCF·해자 엔진으로 재현한 교육용입니다 — 모닝스타 공식 등급·적정가가 아닙니다. 공정가치=버핏식 보수적 DCF(현재 FCF·성장률 상한 35%)라 메가트렌드 성장주는 비싸게 나올 수 있습니다. <b style={{ color: '#9aa7b5' }}>경기순환주(에너지·반도체 등)는 현재 이익 기준 DCF라 사이클 위치에 따라 공정가치가 크게 왜곡될 수 있어 별점을 참고로만 보세요.</b> 투자 추천 아님.
      </div>
    </div>
  )
}

function Row({ e, open, onToggle }: { e: RatingEntry; open: boolean; onToggle: () => void }) {
  const disc = e.discountPct
  return (
    <div style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 9 }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 12px', textAlign: 'left' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12.5, minWidth: 54 }}>{e.market === 'KR' ? (e.name || e.ticker).slice(0, 8) : e.ticker}</span>
        {e.stars != null ? <Stars n={e.stars} /> : <span style={{ color: '#8599ae', fontSize: 11 }}>별점 보류</span>}
        {e.baseEffect && <span title="작년 이익 붕괴 후 폭증(+100%↑)으로 DCF 성장률이 부풀려져 공정가치가 과대평가됨 → 저평가 별점은 착시일 수 있어 보류합니다." style={{ background: 'rgba(251,191,36,0.14)', color: '#fbbf24', border: '1px solid #fbbf2455', borderRadius: 5, padding: '1px 7px', fontSize: 9.5, fontWeight: 700 }}>⚠️ 기저효과</span>}
        <span style={{ background: `${moatColor(e.moatWidth)}1f`, color: moatColor(e.moatWidth), border: `1px solid ${moatColor(e.moatWidth)}55`, borderRadius: 5, padding: '1px 7px', fontSize: 9.5, fontWeight: 700 }}>🏰 {MOAT_KO[e.moatWidth]}</span>
        {disc != null && (
          <span style={{ color: disc >= 0 ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 11.5, fontFamily: 'monospace' }}>
            {disc >= 0 ? `▼ ${disc.toFixed(0)}% 저평가` : `▲ ${Math.abs(disc).toFixed(0)}% 고평가`}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontSize: 11, fontFamily: 'monospace' }}>{e.weight}%</span>
        <span style={{ color: '#7f93a8', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 11px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px 14px', fontSize: 11 }}>
          <Kv k="현재가" v={fmtPrice(e.currentPrice, e.currency)} />
          <Kv k="공정가치(DCF)" v={fmtPrice(e.fairValue, e.currency)} />
          <Kv k="불확실성" v={UNCERTAINTY_KO[e.uncertainty]} />
          <Kv k="해자 추세" v={TREND_KO[e.moatTrend]} c={trendColor(e.moatTrend)} />
          <Kv k="자본배분(경영진)" v={STEWARD_KO[e.stewardship]} />
          <Kv k="해자 폭" v={MOAT_KO[e.moatWidth]} c={moatColor(e.moatWidth)} />
        </div>
      )}
    </div>
  )
}

function Kv({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#8a9aaa' }}>{k}</span>
      <span style={{ color: c ?? '#cbd5e1', fontWeight: 700 }}>{v}</span>
    </div>
  )
}
