'use client'
// 🎯 통합 4축 추천 UI — 계절(방향)×펀더멘탈(가치)×수급(연료)×모멘텀(Fwd EPS·주가추세) 융합 + 투명 소점수
import { useState, useEffect } from 'react'
import type { UnifiedRecoResult, UnifiedRecoItem } from '@/app/api/unified-reco/route'
import InvestorTimeline from '@/app/components/InvestorTimeline'

const CARD = '#161b25', BORDER = '#1e293b'
const AX = { season: '#f59e0b', fund: '#22c55e', supply: '#60a5fa', momentum: '#a78bfa' }  // 계절/펀더멘탈/수급/모멘텀 축 색
const fmtWon = (w: number) => w >= 1e8 ? `${(w / 1e8).toFixed(1)}억원` : `${Math.round(w / 1e4)}만원`

function MiniBar({ label, score, color, unknown }: { label: string; score: number; color: string; unknown?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 78 }}>
      {/* 라벨 옆에 점수를 바로 붙여 표시 — 세 축 모두 명확히(수급 점수 낮아도 안 묻힘) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 9.5, marginBottom: 2 }}>
        <span style={{ color: '#8a9aaa' }}>{label}</span>
        <span style={{ color: unknown ? '#7f93a8' : color, fontWeight: 800, fontFamily: 'monospace', fontSize: 11 }}>{unknown ? '미집계' : score}</span>
      </div>
      <div style={{ height: 5, background: '#0f1117', borderRadius: 3, overflow: 'hidden' }}>
        {unknown
          ? <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#1e293b,#1e293b 3px,#0f1117 3px,#0f1117 6px)' }} />
          : <div style={{ width: `${score}%`, height: '100%', background: color }} />}
      </div>
    </div>
  )
}

function Item({ it }: { it: UnifiedRecoItem }) {
  const [open, setOpen] = useState(false)
  const cc = it.combined >= 80 ? '#22c55e' : it.combined >= 60 ? '#f59e0b' : '#8a9aaa'
  return (
    <div style={{ background: '#0f1117', borderRadius: 10, border: `1px solid ${cc}33`, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 11 }}>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{it.name}</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>{it.sector}</span>
        {it.peg != null && it.peg > 0 && it.peg < 1 && <span style={{ color: '#60a5fa', fontSize: 10.5, fontFamily: 'monospace' }}>PEG {it.peg.toFixed(2)}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ color: cc, fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{it.combined}</span>
          <span style={{ color: '#8a9aaa', fontSize: 10 }}>통합</span>
        </span>
      </div>
      {/* 투명 4축 — 계절·가치·수급·모멘텀(Fwd EPS·주가추세) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <MiniBar label="🌦️ 계절" score={it.seasonScore} color={AX.season} />
        <MiniBar label="💎 가치" score={it.fundScore} color={AX.fund} />
        <MiniBar label={it.supplyProxy ? '💰 수급*' : '💰 수급'} score={it.supplyScore} color={AX.supply} unknown={!it.supplyKnown} />
        <MiniBar label="📈 모멘텀" score={it.momentumScore} color={AX.momentum} />
      </div>
      {/* 💰 권장 편입 금액 + 배지 */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        {it.suggestWon > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e55', borderRadius: 7, padding: '2px 9px' }}>
            <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 10.5 }}>💰 권장 편입</span>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{fmtWon(it.suggestWon)}</span>
            <span style={{ color: '#8a9aaa', fontSize: 9.5 }}>(포트 {it.suggestWeight}%)</span>
          </span>
        )}
        {it.badges.map(b => <span key={b} style={{ background: 'rgba(148,163,184,0.1)', color: '#cbd5e1', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '1px 7px', fontSize: 10 }}>{b}</span>)}
      </div>
      {it.market === 'KR' && (
        <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: open ? '#a5b4fc' : '#818cf8', border: `1px solid ${open ? '#818cf866' : '#818cf833'}` }}>
          📅 {open ? '매매동향 접기' : '최근 20일 매매동향'}
        </button>
      )}
      {open && it.market === 'KR' && <div style={{ marginTop: 6 }}><InvestorTimeline ticker={it.ticker} name={it.name} /></div>}
    </div>
  )
}

export default function UnifiedReco() {
  const [data, setData] = useState<UnifiedRecoResult & { warming?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/unified-reco', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j.error ? null : j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🎯 계절·펀더멘탈·수급·모멘텀 4축을 융합해 통합 추천을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>통합 추천 데이터를 불러오지 못했습니다.</div>
  if (data.warming || data.items.length === 0) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🎯 추천 유니버스를 준비 중입니다. 거시경제 AI 추천 탭을 한 번 열어 데이터를 적재한 뒤 다시 시도해 주세요.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg,rgba(245,158,11,0.10),rgba(96,165,250,0.06))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 12, marginBottom: 3 }}>통합 추천 — 계절 × 펀더멘탈 × 수급 융합</div>
          <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6 }}>
            4계절(매크로 방향)·가치(저PEG·마진·FCF)·수급(스마트머니)을 <b>하나의 점수</b>로 합칩니다. 세 축이 모두 높은 종목이 최상위 — 왜 추천됐는지 소점수로 투명하게 보여줍니다.
          </div>
          <div style={{ color: '#7f93a8', fontSize: 11, marginTop: 4 }}>
            통합 = 🌦️ 계절 {Math.round(data.weights.season * 100)}% + 💎 가치 {Math.round(data.weights.fund * 100)}% + 💰 수급 {Math.round(data.weights.supply * 100)}%
            {data.usSeason && <> · 🇺🇸 {data.usSeason.label.split(' ')[0]} · 🇰🇷 {data.krSeason.label.split(' ')[0]}</>}
          </div>
          {data.selectionRule && <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 3 }}>📋 선별 기준: {data.selectionRule} → 총 <b style={{ color: '#cbd5e1' }}>{data.items.length}종</b></div>}
          {data.portfolioKrw > 0 && <div style={{ color: '#86efac', fontSize: 10.5, marginTop: 2 }}>💰 권장 편입 = 포트폴리오({fmtWon(data.portfolioKrw)}) 기준 통합점수 1.5~2.5%{data.regimeMult < 1 && <> × 국면 조정 {Math.round(data.regimeMult * 100)}%</>} · 분할 신규 편입 기준</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map(it => <Item key={`${it.market}-${it.ticker}`} it={it} />)}
      </div>

      <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 통합 점수 = 계절 적합(현재 매크로 계절의 우대 섹터/분류) + 펀더멘탈 가치(린치가중·PEG·영업이익률·FCF) + 수급(연료). 최종 선별 종목은 🏰 <b>버핏 퀄리티</b>(고ROE 자본효율)·📈 <b>Fwd EPS 모멘텀</b>(애널리스트 이익추정 상·하향)으로 심화 검증해 배지로 표시합니다. <b>수급*</b>는 미국 종목으로, 외국인/기관 실수급이 없어 MFI·내부자·13F 거인 <b>프록시</b>입니다(한국은 외인/기관/개인 실수급). PEG는 stock-info SSOT 기준. 보유 종목은 제외했습니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
