'use client'
// 🎯 린치×수급 융합 추천 v2 — 통합 점수 + 개인 이탈 + ₩ 매수 가이드
import { useState, useEffect } from 'react'
import type { PortfolioRecoResult, RecoItem } from '@/app/api/portfolio-reco-kr/route'
import InvestorTimeline from '@/app/components/InvestorTimeline'

const CARD = '#161b25', BORDER = '#1e293b'

const fmtW = (w: number) => w >= 1e8 ? `${(w/1e8).toFixed(0)}억원` : `${(w/1e4).toFixed(0)}만원`
const fmtEok = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString()}억`

const CATS = {
  fillGap:   { color: '#3b82f6', icon: '🧩', label: '빈집 채우기',   desc: '내 포폴에 없는 섹터 + 메이저 매집' },
  pearl:     { color: '#22c55e', icon: '💎', label: '진주 발굴',     desc: '저PEG + 쌍끌이 + 개인 이탈 = 최강 신호' },
  addMore:   { color: '#f59e0b', icon: '🔥', label: '보유 불타기',   desc: '보유 종목 수급 가속 → 비중 확대 타이밍' },
  near:      { color: '#8a9aaa', icon: '🔜', label: '우선순위 임박', desc: '쌍끌이 아직이지만 추세 감지 중' },
  riskAlert: { color: '#ef4444', icon: '⚠️', label: '수급 훼손 경보', desc: '보유 종목에서 메이저 동반 이탈 + 개미 단독 매수 포착' },
}

function ScoreBar({ score }: { score: number }) {
  const col = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#8a9aaa'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: col }} />
      </div>
      <span style={{ color: col, fontSize: 10.5, fontWeight: 800, minWidth: 28 }}>{score}점</span>
    </div>
  )
}

function Item({ it }: { it: RecoItem }) {
  const [open, setOpen] = useState(false)
  const cfg = CATS[it.category]
  const indNeg = it.individual1 < 0   // 개인 이탈 여부
  return (
    <div>
      <div style={{ background: '#0f1117', borderRadius: 9, border: `1px solid ${cfg.color}33`, padding: '11px 13px' }}>
        {/* 상단: 종목명 + 배지들 + 점수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{it.name}</span>
          <span style={{ color: '#8a9aaa', fontSize: 11 }}>{it.sector}</span>
          {it.peg != null && it.peg > 0 && it.peg < 1.0 && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #3b82f655', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>💎 PEG {it.peg.toFixed(2)}</span>}
          {it.dualStreak >= 2 && <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>🔥 {it.dualStreak}일 쌍끌이</span>}
          {indNeg && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid #ef444433', borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>👤 개인 이탈</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, fontSize: 10.5, fontFamily: 'monospace' }}>
            <span style={{ color: it.foreign5 >= 0 ? '#22c55e' : '#ef4444' }}>외 {fmtEok(it.foreign5)}</span>
            <span style={{ color: it.organ5 >= 0 ? '#22c55e' : '#ef4444' }}>기 {fmtEok(it.organ5)}</span>
            {indNeg && <span style={{ color: '#ef4444' }}>개 {fmtEok(it.individual1)}</span>}
          </span>
        </div>
        {/* 추천 점수 바 */}
        <ScoreBar score={it.recoScore} />
        {/* 이유 + ₩ 가이드 */}
        <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.55, marginTop: 6 }}>{it.reason}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {it.suggestWon > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${cfg.color}14`, border: `1px solid ${cfg.color}44`, borderRadius: 7, padding: '5px 10px' }}>
              <span style={{ color: cfg.color, fontSize: 11, fontWeight: 800 }}>💰 권장 매수</span>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{fmtW(it.suggestWon)}</span>
              <span style={{ color: '#8a9aaa', fontSize: 10 }}>({it.category === 'addMore' ? '포트폴리오 1%' : '포트폴리오 2%'})</span>
            </div>
          )}
          {/* 명시적 타임라인 버튼 — 학생들이 클릭 가능 여부를 바로 알 수 있게 */}
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: open ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)', color: open ? '#a5b4fc' : '#818cf8',
              border: `1px solid ${open ? '#818cf866' : '#818cf833'}` }}>
            <span>📅</span>
            <span>{open ? '매매동향 접기' : '최근 20일 매매동향 보기'}</span>
            <span style={{ fontSize: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
          </button>
        </div>
      </div>
      {open && <div style={{ marginTop: 4 }}><InvestorTimeline ticker={it.ticker} name={it.name} /></div>}
    </div>
  )
}

function Section({ cat, items }: { cat: keyof typeof CATS; items: RecoItem[] }) {
  const cfg = CATS[cat]
  if (!items.length) return null
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${cfg.color}2e` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ color: cfg.color, fontWeight: 800, fontSize: 14 }}>{cfg.icon} {cfg.label}</span>
      </div>
      <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 10 }}>{cfg.desc}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(it => <Item key={it.ticker} it={it} />)}
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
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>🎯 내 포폴 × 시장 수급으로 맞춤 추천을 계산 중입니다…</div>
  if (!data) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>추천 데이터를 불러오지 못했습니다.</div>

  const anyReco = data.fillGap.length + data.pearl.length + data.addMore.length + data.near.length > 0
  const rg = data.regime
  const adjusted = rg && rg.multiplier < 1.0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 배너 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg,rgba(34,197,94,0.10),rgba(59,130,246,0.06))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div>
          <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 12, marginBottom: 2 }}>린치 × 수급 융합 추천 — 맞춤 나침반</div>
          <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6 }}>
            PEG 저평가 + 외인·기관 쌍끌이 + <b>개인 이탈</b> 삼박자가 맞는 종목을 추천 점수 순으로 제시합니다.
            {data.portfolioKrw > 0 && <span style={{ color: '#8a9aaa' }}> 총 포트폴리오 {(data.portfolioKrw/1e4).toFixed(0)}만원 기준 ₩ 가이드 포함.</span>}
          </div>
          {data.heldSectors.length > 0 && <div style={{ color: '#6e7f8f', fontSize: 11, marginTop: 4 }}>보유 섹터: {data.heldSectors.join(' · ')}</div>}
        </div>
      </div>

      {/* 🌦️ 매크로 국면 배너 — 권장액 동적 조절 근거 */}
      {rg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: adjusted ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)', border: `1px solid ${adjusted ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.25)'}`, borderRadius: 10, padding: '9px 14px' }}>
          <span style={{ fontSize: 15 }}>{adjusted ? '⛈️' : '🌦️'}</span>
          <div style={{ flex: 1 }}>
            <span style={{ color: adjusted ? '#f59e0b' : '#60a5fa', fontWeight: 800, fontSize: 12 }}>현재 국면: {rg.label}</span>
            <span style={{ color: '#aab6c4', fontSize: 11.5, marginLeft: 8 }}>{rg.guide}</span>
          </div>
          {adjusted && (
            <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
              권장액 {Math.round(rg.multiplier * 100)}%로 자동 조정
            </span>
          )}
        </div>
      )}

      {/* ⚠️ 수급 훼손 경보 — 맨 위 우선 노출(보유 종목 위험 신호) */}
      {data.riskAlert.length > 0 && <Section cat="riskAlert" items={data.riskAlert} />}

      {anyReco ? (
        <>
          <Section cat="fillGap" items={data.fillGap} />
          <Section cat="pearl" items={data.pearl} />
          <Section cat="addMore" items={data.addMore} />
          <Section cat="near" items={data.near} />
        </>
      ) : (
        <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', textAlign: 'center' }}>
          현재 기준(저PEG + 쌍끌이)을 충족하는 추천 종목이 없습니다. 내일 장 마감 후 다시 확인해 주세요.
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 추천 점수(0~100) = PEG 가치(35) + 수급 강도(40) + 개인 이탈 보너스(15) + 섹터 갭 보너스(10) · ₩ 가이드 = 포트폴리오 원가의 2%(신규)/1%(추가) × 매크로 국면 배율. 수급 훼손 경보는 펀더멘탈과 무관하게 &ldquo;메이저 자금의 선행 이탈&rdquo;만 포착하는 별도 신호입니다(리밸런싱의 손익 기준 매도 진단을 보완). 수급은 연료일 뿐 방향은 펀더멘탈이 결정합니다 — 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
