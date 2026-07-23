'use client'
// 🎯 종목 리서치 종합 매수 판정 — 6축(가치·퀄리티·모멘텀·주도섹터·수급·계절)+리스크를 합성해 매수/신중/부적합 한눈에
import { useState, useEffect } from 'react'
import type { ResearchVerdict } from '@/app/api/research-verdict/route'
import TimingBadge from '@/app/components/TimingBadge'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
// 통합추천(UnifiedReco)과 동일한 축 색상(제2원칙 — 같은 축은 같은 색)
const AX = { season: TK.amber500, value: TK.green500, quality: '#2dd4bf', momentum: TK.violet400, rotation: '#f472b6', supply: TK.blue400 }
const V = {
  buy:     { label: '✅ 매수 적합', color: TK.green500, bg: 'rgba(34,197,94,0.10)', bd: 'rgba(34,197,94,0.4)' },
  caution: { label: '⚖️ 조건부·신중', color: TK.amber500, bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.4)' },
  avoid:   { label: '⛔ 매수 부적합', color: TK.red500, bg: 'rgba(239,68,68,0.10)', bd: 'rgba(239,68,68,0.4)' },
}

function Bar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ flex: '1 1 110px', minWidth: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: TK.sub }}>{label}</span>
        <span style={{ color, fontWeight: 800, fontFamily: 'monospace', fontSize: 11.5 }}>{score}</span>
      </div>
      <div style={{ height: 6, background: TK.bg3, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function ResearchVerdictCard({ ticker, market, name }: { ticker: string; market: string; name?: string }) {
  const [d, setD] = useState<ResearchVerdict | null>(null)
  const [loading, setLoading] = useState(true)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let alive = true
    setLoading(true); setUnsupported(false); setD(null)
    fetch(`/api/research-verdict?ticker=${encodeURIComponent(ticker)}&market=${market}&name=${encodeURIComponent(name ?? ticker)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!alive) return; if (j?.unsupported || j?.error) setUnsupported(true); else setD(j) })
      .catch(() => { if (alive) setUnsupported(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market, name])

  if (unsupported) return null
  if (loading) return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18, color: TK.sub, fontSize: 12.5 }}>
      🎯 종합 매수 판정 — 6축·리스크를 합성하는 중…
    </div>
  )
  if (!d) return null
  const v = V[d.verdict]

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${v.bd}`, overflow: 'hidden' }}>
      {/* 헤더: 판정 + 점수 */}
      <div style={{ background: v.bg, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>종합 매수 판정</span>
        <span style={{ background: v.color + '22', color: v.color, border: `1px solid ${v.bd}`, borderRadius: 999, padding: '3px 12px', fontWeight: 800, fontSize: 13 }}>{v.label}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ color: v.color, fontWeight: 900, fontSize: 26, fontFamily: 'monospace' }}>{d.score}</span>
          <span style={{ color: TK.sub, fontSize: 11 }}>매수 적합도</span>
        </span>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ color: TK.slate300, fontSize: 12.5, lineHeight: 1.6 }}>{d.oneLiner}</div>

        {/* 6축 — 통합추천과 동일 순서·색상 */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Bar label="💎 가치" score={d.axes.value} color={AX.value} />
          <Bar label="🏰 퀄리티" score={d.axes.quality} color={AX.quality} />
          <Bar label="📈 모멘텀" score={d.axes.momentum} color={AX.momentum} />
          <Bar label="🧭 주도섹터" score={d.axes.rotation} color={AX.rotation} />
          <Bar label="💰 수급" score={d.axes.supply} color={AX.supply} />
          <Bar label="🌦️ 계절" score={d.axes.season} color={AX.season} />
        </div>

        {/* 🚦 기술적 타이밍 (WHEN) — AI 리밸런싱·통합추천과 동일한 신호등+라쉬케+매물·평단(SSOT). 224봉 미만이면 자동 생략 */}
        {d.timing && (
          <div>
            <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700, marginBottom: 5 }}>🚦 기술적 타이밍 <span style={{ color: TK.slate500, fontWeight: 400 }}>— 언제 살까(WHEN). 점수엔 미반영, 진입 타점만</span></div>
            <TimingBadge t={d.timing} market={d.market} ticker={d.ticker} />
          </div>
        )}

        {/* 찬성 / 주의 2열 */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 240, background: TK.bg3, borderRadius: 10, border: '1px solid rgba(34,197,94,0.25)', padding: '10px 12px' }}>
            <div style={{ color: TK.green500, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>👍 매수 근거 {d.pros.length}</div>
            {d.pros.length === 0
              ? <div style={{ color: TK.slate500, fontSize: 11.5 }}>두드러진 매수 근거 없음</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{d.pros.map((p, i) => <div key={i} style={{ color: '#bbf7d0', fontSize: 11.5, lineHeight: 1.5 }}>{p}</div>)}</div>}
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 240, background: TK.bg3, borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', padding: '10px 12px' }}>
            <div style={{ color: TK.red400, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>⚠️ 주의·리스크 {d.cons.length}</div>
            {d.cons.length === 0
              ? <div style={{ color: TK.slate500, fontSize: 11.5 }}>두드러진 리스크 없음 ✓</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{d.cons.map((c, i) => <div key={i} style={{ color: '#fecaca', fontSize: 11.5, lineHeight: 1.5 }}>{c}</div>)}</div>}
          </div>
        </div>

        <div style={{ color: TK.sub, fontSize: 10, lineHeight: 1.6 }}>
          ※ 통합추천과 동일한 6축(가치25·퀄리티20·모멘텀20·주도섹터10·수급10·계절15)+리스크 엔진으로 합성한 교육용 판정입니다(WHAT=무엇을 살까). 🚦 기술적 타이밍은 언제 살까(WHEN)를 보는 별도 레이어로, 점수엔 반영되지 않습니다. 상세 근거는 아래 각 카드(역-DCF·수급·내부자·해자·섹터피어 등)에서 확인하세요. 투자 추천이 아닙니다.
        </div>
      </div>
    </div>
  )
}
