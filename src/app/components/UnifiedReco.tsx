'use client'
// 🎯 통합 4축 추천 UI — 계절(방향)×펀더멘탈(가치)×수급(연료)×모멘텀(Fwd EPS·주가추세) 융합 + 투명 소점수
import { useState, useEffect } from 'react'
import type { UnifiedRecoResult, UnifiedRecoItem } from '@/app/api/unified-reco/route'
import InvestorTimeline from '@/app/components/InvestorTimeline'
import TimingBadge from '@/app/components/TimingBadge'
import TradePlanCard from '@/app/components/TradePlanCard'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const AX = { season: TK.amber500, fund: TK.green500, supply: TK.blue400, momentum: TK.violet400 }  // 계절/펀더멘탈/수급/모멘텀 축 색
const fmtWon = (w: number) => w >= 1e8 ? `${(w / 1e8).toFixed(1)}억원` : `${Math.round(w / 1e4)}만원`

function MiniBar({ label, score, color, unknown }: { label: string; score: number; color: string; unknown?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 78 }}>
      {/* 라벨 옆에 점수를 바로 붙여 표시 — 세 축 모두 명확히(수급 점수 낮아도 안 묻힘) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 9.5, marginBottom: 2 }}>
        <span style={{ color: TK.sub }}>{label}</span>
        <span style={{ color: unknown ? TK.sub2 : color, fontWeight: 800, fontFamily: 'monospace', fontSize: 11 }}>{unknown ? '미집계' : score}</span>
      </div>
      <div style={{ height: 5, background: TK.bg3, borderRadius: 3, overflow: 'hidden' }}>
        {unknown
          ? <div style={{ width: '100%', height: '100%', background: `repeating-linear-gradient(45deg,${TK.border},${TK.border} 3px,${TK.bg3} 3px,${TK.bg3} 6px)` }} />
          : <div style={{ width: `${score}%`, height: '100%', background: color }} />}
      </div>
    </div>
  )
}

function Item({ it, portfolioKrw }: { it: UnifiedRecoItem; portfolioKrw: number }) {
  const [open, setOpen] = useState(false)
  const cc = it.combined >= 80 ? TK.green500 : it.combined >= 60 ? TK.amber500 : TK.sub
  return (
    <div style={{ background: TK.bg3, borderRadius: 10, border: `1px solid ${cc}33`, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 11 }}>{it.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>{it.name}</span>
        <span style={{ color: TK.sub, fontSize: 11 }}>{it.sector}</span>
        {it.peg != null && it.peg > 0 && it.peg < 1 && <span style={{ color: TK.blue400, fontSize: 10.5, fontFamily: 'monospace' }}>PEG {it.peg.toFixed(2)}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ color: cc, fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{it.combined}</span>
          <span style={{ color: TK.sub, fontSize: 10 }}>통합</span>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.12)', border: `1px solid ${TK.green500}55`, borderRadius: 7, padding: '2px 9px' }}>
            <span style={{ color: TK.green500, fontWeight: 800, fontSize: 10.5 }}>💰 권장 편입</span>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{fmtWon(it.suggestWon)}</span>
            <span style={{ color: TK.sub, fontSize: 9.5 }}>(포트 {it.suggestWeight}%)</span>
          </span>
        )}
        {it.badges.map(b => <span key={b} style={{ background: 'rgba(148,163,184,0.1)', color: TK.slate300, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '1px 7px', fontSize: 10 }}>{b}</span>)}
      </div>
      {/* 🚦 타점 신호등(WHEN 레이어) — 점수·순위와 무관, 진입 타이밍+ATR 손절 참고 */}
      {it.timing && <div style={{ marginBottom: 6 }}><TimingBadge t={it.timing} market={it.market} /></div>}
      {/* 📋 매매 플랜(1% 리스크 룰 포지션 사이저) — 신형 timing(price 포함)일 때만 표시 */}
      {it.timing && it.timing.price != null && portfolioKrw > 0 && (
        <TradePlanCard market={it.market} timing={it.timing} portfolioKrw={portfolioKrw} />
      )}
      {it.market === 'KR' && (
        <button onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: open ? TK.indigo300 : TK.indigo400, border: `1px solid ${open ? `${TK.indigo400}66` : `${TK.indigo400}33`}` }}>
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

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🎯 계절·펀더멘탈·수급·모멘텀 4축을 융합해 통합 추천을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>통합 추천 데이터를 불러오지 못했습니다.</div>
  if (data.warming || data.items.length === 0) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub }}>🎯 추천 유니버스를 준비 중입니다. 거시경제 AI 추천 탭을 한 번 열어 데이터를 적재한 뒤 다시 시도해 주세요.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg,rgba(245,158,11,0.10),rgba(96,165,250,0.06))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ color: TK.amber500, fontWeight: 800, fontSize: 12, marginBottom: 3 }}>통합 추천 — 계절 × 가치 × 수급 × 모멘텀 융합</div>
          <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6 }}>
            4계절(매크로 방향)·가치(저PEG·마진·FCF)·수급(스마트머니)·모멘텀(Fwd EPS·주가추세)을 <b>하나의 점수</b>로 합칩니다. 네 축이 모두 높은 종목이 최상위 — 왜 추천됐는지 소점수로 투명하게 보여줍니다.
            여기에 🧭 <b>섹터 로테이션 시계 국면</b>을 소폭 가점·감점(주도 +4 ~ 이탈 −3)으로 반영 — 돈이 도는 섹터의 종목이 동점권에서 앞섭니다.
          </div>
          <div style={{ color: TK.sub2, fontSize: 11, marginTop: 4 }}>
            통합 = 🌦️ 계절 {Math.round(data.weights.season * 100)}% + 💎 가치 {Math.round(data.weights.fund * 100)}% + 💰 수급 {Math.round(data.weights.supply * 100)}% + 📈 모멘텀 {Math.round(data.weights.momentum * 100)}%
            {data.usSeason && <> · 🇺🇸 {data.usSeason.label.split(' ')[0]} · 🇰🇷 {data.krSeason.label.split(' ')[0]}</>}
          </div>
          {data.selectionRule && <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 3 }}>📋 선별 기준: {data.selectionRule} → 총 <b style={{ color: TK.slate300 }}>{data.items.length}종</b></div>}
          {data.portfolioKrw > 0 && <div style={{ color: TK.green300, fontSize: 10.5, marginTop: 2 }}>💰 권장 편입 = 포트폴리오({fmtWon(data.portfolioKrw)}) 기준 통합점수 1.5~2.5%{data.regimeMult < 1 && <> × 국면 조정 {Math.round(data.regimeMult * 100)}%</>} · 분할 신규 편입 기준</div>}
          {data.momCrash && (
            <div style={{ marginTop: 7, background: '#2a1c0e', border: `1px solid ${TK.amber700}`, borderRadius: 8, padding: '7px 11px', fontSize: 11, color: '#fdba74', lineHeight: 1.55 }}>
              ⚠️ <b>모멘텀 크래시 주의 국면</b>(승패 해부실 실측) — 지금은 낙폭과대주(12개월 패자)가 승자보다 더 오르는 반전 장입니다.
              모멘텀 좋은 종목의 추격 매수가 가장 잘 무너지는 구간(Daniel-Moskowitz 2016) — 분할·신중 진입을 권합니다. 점수에는 미반영(정보 캐비엇).
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map(it => <Item key={`${it.market}-${it.ticker}`} it={it} portfolioKrw={data.portfolioKrw} />)}
      </div>

      <div style={{ color: TK.sub8, fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 통합 점수 = 계절 적합(현재 매크로 계절의 우대 섹터/분류) + 펀더멘탈 가치(린치가중·PEG·영업이익률·FCF) + 수급(연료). 최종 선별 종목은 🏰 <b>버핏 퀄리티</b>(고ROE 자본효율)·📈 <b>Fwd EPS 모멘텀</b>(애널리스트 이익추정 상·하향)으로 심화 검증해 배지로 표시합니다. <b>수급*</b>는 미국 종목으로, 외국인/기관 실수급이 없어 MFI·내부자·13F 거인 <b>프록시</b>입니다(한국은 외인/기관/개인 실수급). PEG는 stock-info SSOT 기준. 보유 종목은 제외했습니다. 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
