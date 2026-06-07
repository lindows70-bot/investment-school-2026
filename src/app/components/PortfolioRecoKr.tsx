'use client'
// 🎯 린치×수급 융합 추천(국내) — 내 포폴 상태 기반 빈집/진주/불타기 추천
import { useState, useEffect } from 'react'
import type { PortfolioRecoResult, RecoItem } from '@/app/api/portfolio-reco-kr/route'
import InvestorTimeline from '@/app/components/InvestorTimeline'

const CARD = '#161b25', BORDER = '#1e293b'
const eokStr = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString()}억`

function Item({ it, accent }: { it: RecoItem; accent: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', background: '#0f1117', borderRadius: 9, border: `1px solid ${accent}33`, padding: '10px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{it.name}</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>{it.sector}</span>
          {it.peg != null && it.peg > 0 && it.peg < 1.0 && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #3b82f655', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>💎 PEG {it.peg.toFixed(2)}</span>}
          {it.dualStreak >= 2 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>🔥 {it.dualStreak}일 쌍끌이</span>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, fontSize: 10.5, fontFamily: 'monospace' }}>
            <span style={{ color: it.foreign5 >= 0 ? '#22c55e' : '#ef4444' }}>외 {eokStr(it.foreign5)}</span>
            <span style={{ color: it.organ5 >= 0 ? '#22c55e' : '#ef4444' }}>기 {eokStr(it.organ5)}</span>
          </span>
          <span style={{ color: '#64748b', fontSize: 9, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
        </div>
        <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.55, marginTop: 6 }}>{it.reason}</div>
      </div>
      {open && <div style={{ marginTop: 4 }}><InvestorTimeline ticker={it.ticker} name={it.name} /></div>}
    </div>
  )
}

function Section({ icon, title, desc, color, items, empty }: { icon: string; title: string; desc: string; color: string; items: RecoItem[]; empty: string }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${color}2e` }}>
      <div style={{ color, fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{icon} {title}</div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 10 }}>{desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.length ? items.map(it => <Item key={it.ticker} it={it} accent={color} />)
          : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '6px 0' }}>{empty}</div>}
      </div>
    </div>
  )
}

export default function PortfolioRecoKr() {
  const [data, setData] = useState<PortfolioRecoResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/portfolio-reco-kr', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    const onUpd = () => load()
    window.addEventListener('portfolio-updated', onUpd)
    return () => { alive = false; window.removeEventListener('portfolio-updated', onUpd) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🎯 내 포폴 × 시장 수급으로 맞춤 추천을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>추천 데이터를 불러오지 못했습니다.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(59,130,246,0.06))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div>
          <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 12, marginBottom: 2 }}>린치 × 수급 융합 추천 (국내)</div>
          <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6 }}>
            내 포트폴리오 상태 + 외국인·기관 수급을 결합해 <b>지금 뭘 사거나 더 담을지</b> 콕 집어줍니다.
            {data.heldSectors.length > 0 && <> 보유 섹터: <span style={{ color: '#8a9aaa' }}>{data.heldSectors.join(' · ')}</span></>}
          </div>
        </div>
      </div>

      <Section icon="🧩" title="빈집 채우기 (섹터 보강)" color="#3b82f6"
        desc="내 포폴에 없는 섹터인데 외국인·기관이 매집 중인 종목 — 분산 + 수급 동시 충족"
        items={data.fillGap} empty="현재 보강할 빈 섹터 매집 종목이 없습니다." />

      <Section icon="💎" title="진주 발굴 (저PEG + 쌍끌이)" color="#22c55e"
        desc="미보유 + 저PEG(<1.0) + 외국인·기관 연속 쌍끌이 — 수급 붙은 저평가 신규 편입 후보"
        items={data.pearl} empty="현재 저PEG + 쌍끌이 신규 후보가 없습니다." />

      <Section icon="🔥" title="보유 불타기 (비중 확대)" color="#f59e0b"
        desc="이미 보유 중인데 최근 메이저 수급이 가속 붙은 종목 — 추가 매수 검토 타이밍"
        items={data.addMore} empty="보유 종목 중 수급 가속 신호가 없습니다." />

      <div style={{ color: '#6e7f8f', fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 주요 코스피 유니버스 + 내 보유종목 기준(매수/매도 시 자동 갱신) · 종목 클릭 시 일별 매매동향 타임라인 펼침 · 수급은 연료일 뿐 방향은 펀더멘탈이 결정합니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
