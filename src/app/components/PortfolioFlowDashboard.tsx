'use client'
// 📡 포트폴리오 수급 레이더 — 내 보유종목 전체의 스마트머니 유입/이탈을 한눈에(동행지수+쌍끌이/과밀 보드+4분면)
import { useState, useEffect } from 'react'
import type { PortfolioFlowResult, FlowEntry, Quadrant } from '@/app/api/portfolio-flow/route'
import { isInflowNear } from '@/lib/flowShared'
import type { FlowStatus } from '@/lib/moneyFlow'

const CARD = '#161b25', BORDER = '#1e293b'

const ST: Record<Exclude<FlowStatus, 'UNSUPPORTED'>, { label: string; color: string; emoji: string }> = {
  INFLOW:    { label: '유입',   color: '#22c55e', emoji: '🟢' },
  CROWDED:   { label: '이탈·과열', color: '#ef4444', emoji: '🔴' },
  NEGLECTED: { label: '소외',   color: '#f59e0b', emoji: '🟡' },
  NEUTRAL:   { label: '중립',   color: '#8a9aaa', emoji: '⚪' },
}
const QUAD: Record<Quadrant, { label: string; emoji: string; color: string; desc: string; empty: string }> = {
  LEADER:  { label: '메이저 주도주', emoji: '🏆', color: '#22c55e', desc: '저PEG + 수급 유입(우선순위)', empty: '해당 종목 없음' },
  PEARL:   { label: '저평가 대기',   emoji: '💎', color: '#3b82f6', desc: '저PEG인데 수급은 아직(붙으면 탄력)', empty: '해당 종목 없음' },
  CROWDED: { label: '상투·과열 위험', emoji: '⚠️', color: '#ef4444', desc: '고평가 + 수급 과열(추격) 또는 메이저 이탈', empty: '과열·상투 위험 없음 ✓' },
  REVIEW:  { label: '재검토 필요',   emoji: '🔍', color: '#8a9aaa', desc: '펀더멘탈·수급 모두 약함', empty: '재검토 종목 없음 ✓' },
}
const dnm = (e: FlowEntry) => (e.market === 'KR' ? (e.name || e.ticker).slice(0, 10) : e.ticker.toUpperCase())

// 🌦️ 계절 적합 태그 — 현재 매크로 계절에 종목이 유리한지(섹터×린치 fit)
const SEASON_TAG: Record<FlowEntry['seasonTag'], { label: string; color: string; icon: string }> = {
  favored:   { label: '계절 유리', color: '#22c55e', icon: '🌱' },
  neutral:   { label: '계절 중립', color: '#8a9aaa', icon: '➖' },
  unfavored: { label: '계절 불리', color: '#f59e0b', icon: '⚠️' },
}
function SeasonChip({ tag, mini }: { tag: FlowEntry['seasonTag']; mini?: boolean }) {
  const c = SEASON_TAG[tag]
  if (mini) return <span title={c.label} style={{ fontSize: 10 }}>{c.icon}</span>
  return <span style={{ background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}55`, borderRadius: 999, padding: '0 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.icon} {c.label}</span>
}

function StatusChip({ s }: { s: FlowStatus }) {
  if (s === 'UNSUPPORTED') return null
  const c = ST[s]
  return <span style={{ background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}55`, borderRadius: 999, padding: '0 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.emoji} {c.label}</span>
}

// 동행지수 추이 스파크라인 — 누적된 일별 rate 시계열. 2점 미만이면 '누적 중'
function Sparkline({ data }: { data: { date: string; rate: number }[] }) {
  if (data.length < 2) {
    return <span style={{ color: '#8a9aaa', fontSize: 10.5, minWidth: 88 }}>추이 누적 중…</span>
  }
  const W = 92, H = 30, P = 3
  const xs = data.map((_, i) => P + (i / (data.length - 1)) * (W - 2 * P))
  const ys = data.map(d => P + (1 - Math.min(Math.max(d.rate, 0), 100) / 100) * (H - 2 * P))
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const last = data[data.length - 1].rate, prev = data[data.length - 2].rate
  const delta = last - prev
  const col = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#8a9aaa'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 88 }} title={`최근 ${data.length}일 동행지수 추이`}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={col} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.2} fill={col} />
      </svg>
      <span style={{ color: col, fontSize: 10.5, fontWeight: 700 }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '─'}{delta !== 0 ? Math.abs(delta) : ''}</span>
    </span>
  )
}

function Row({ e, near }: { e: FlowEntry; near?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#0f1117', borderRadius: 8, fontSize: 12 }}>
      <span style={{ color: '#e2e8f0', fontWeight: 700, minWidth: 70 }}>{dnm(e)}</span>
      <span style={{ color: '#8a9aaa', fontSize: 10, fontFamily: 'monospace' }}>{e.weight}%</span>
      {near
        ? <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 999, padding: '0 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🔜 임박</span>
        : <StatusChip s={e.status} />}
      {e.peg != null && <span style={{ color: '#3b82f6', fontSize: 11 }}>PEG {e.peg.toFixed(2)}</span>}
      <SeasonChip tag={e.seasonTag} />
      <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontSize: 11, whiteSpace: 'nowrap' }}>{e.flowText}</span>
    </div>
  )
}

export default function PortfolioFlowDashboard() {
  const [data, setData] = useState<PortfolioFlowResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/portfolio-flow', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    const onUpd = () => load()
    window.addEventListener('portfolio-updated', onUpd)
    return () => { alive = false; window.removeEventListener('portfolio-updated', onUpd) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>📡 내 종목 수급을 분석 중입니다…</div>
  if (!data || data.total === 0) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa' }}>분석할 개별 주식이 없습니다. 종목을 추가하면 수급 레이더가 작동합니다.</div>

  // 보드는 4분면과 동일 기준(LEADER/CROWDED) — status만 보면 'ETN 유입(좋음) vs 과열(나쁨)' 모순 발생
  const byQuad = (q: Quadrant) => data.entries.filter(e => e.quadrant === q)
  const leaders = byQuad('LEADER')
  const crowded = byQuad('CROWDED')
  // 우선순위가 비면: 저평가 대기 중 수급이 막 살아나는(모멘텀≥40) 종목 = '곧 1순위 될 후보'
  const nearPriority = leaders.length ? [] : byQuad('PEARL').filter(e => isInflowNear(e)).sort((a, b) => b.momentum - a.momentum).slice(0, 3)
  const rate = data.smartMoneyRate

  // 🌦️ 계절 축 집계 — 내 종목이 현재 매크로 계절에 얼마나 유리한가
  const favoredList = data.entries.filter(e => e.seasonTag === 'favored').sort((a, b) => b.weight - a.weight)
  const unfavoredList = data.entries.filter(e => e.seasonTag === 'unfavored').sort((a, b) => b.weight - a.weight)
  const favoredCnt = favoredList.length
  const unfavoredCnt = unfavoredList.length
  const hasKr = data.entries.some(e => e.market === 'KR')
  const hasUs = data.entries.some(e => e.market === 'US')

  // 동행지수 카운트와 1:1 매칭되는 실제 종목 리스트(헤더에 이름 노출 — "몇 개"만으론 못 찾던 문제)
  const inflowList = data.entries.filter(isInflowNear).sort((a, b) => b.weight - a.weight)
  const crowdedList = data.entries.filter(e => e.status === 'CROWDED').sort((a, b) => b.weight - a.weight)
  const nameList = (arr: FlowEntry[]) => arr.map(dnm).join('·')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 📡 앵커 브리핑 (결정론적 한 줄 요약 — 와꾸 잡기) */}
      {data.headline && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(59,130,246,0.06))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 16px' }}>
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>📡</span>
          <div>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 11, marginBottom: 2 }}>오늘 자 포트폴리오 수급 브리핑</div>
            <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>{data.headline}</div>
          </div>
        </div>
      )}

      {/* 🚨 스마트머니 이탈 경고 — 외인+기관 순매도를 개미가 받아내는 보유 종목(고평가·저평가 4분면 무관 status 기준). SK하이닉스형 */}
      {crowdedList.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 12, padding: '12px 16px' }}>
          <span style={{ fontSize: 18, lineHeight: 1.3 }}>🚨</span>
          <div>
            <div style={{ color: '#f87171', fontWeight: 900, fontSize: 12.5, marginBottom: 3 }}>스마트머니 이탈 경고 — 내 보유 {crowdedList.length}종목</div>
            <div style={{ color: '#fecaca', fontSize: 12, lineHeight: 1.65 }}>
              <b style={{ color: '#fca5a5' }}>{crowdedList.slice(0, 6).map(e => e.name).join(' · ')}{crowdedList.length > 6 ? ` 외 ${crowdedList.length - 6}종목` : ''}</b> — 스마트머니(한국: 외국인·기관 / 미국: 기관·큰손)가 순매도·지분 축소로 빠져나가는 종목입니다(하락 압력 누적, SK하이닉스형).
              수급은 개미와 반대로 봅니다. <b style={{ color: '#fecaca' }}>종목 리서치의 📈 수급 차트</b>로 이탈 추세를 확인하고 비중·손절선을 점검하세요.
            </div>
          </div>
        </div>
      )}

      {/* 헤더 + 스마트머니 동행지수 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 19 }}>📡</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>포트폴리오 수급 레이더</span>
          <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>내 종목 {data.total}개 · 스마트머니 동행지수 <span style={{ color: '#8a9aaa' }}>(유입·임박 비율)</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: rate >= 50 ? '#22c55e' : rate >= 25 ? '#f59e0b' : '#8a9aaa', fontWeight: 900, fontSize: 28, fontFamily: 'monospace', minWidth: 64 }}>{rate}%</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Sparkline data={data.history ?? []} />
            <span style={{ color: '#8a9aaa', fontSize: 9 }}>동행지수 {(data.history?.length ?? 0) >= 2 ? '일별 추이' : '추이 누적 중'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, background: '#0f1117', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ width: `${rate}%`, height: '100%', background: `linear-gradient(90deg,#22c55e,#34d399)`, borderRadius: 7, transition: 'width .4s' }} />
            </div>
            <div style={{ color: '#aab6c4', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              내 {data.total}개 종목 중 <b style={{ color: '#22c55e' }}>{data.inflowCount}개</b> 유입·임박
              {inflowList.length > 0 && <span style={{ color: '#86efac' }}> ({nameList(inflowList)})</span>}
              {data.crowdedCount > 0 && <>
                {' · '}<b style={{ color: '#ef4444' }}>{data.crowdedCount}개</b> 이탈·과열
                {crowdedList.length > 0 && <span style={{ color: '#fca5a5' }}> ({nameList(crowdedList)})</span>}
              </>}
            </div>
          </div>
        </div>
      </div>

      {/* 🌦️ 계절 컨텍스트 — 3축(계절×펀더멘탈×수급) 중 '방향' 축 */}
      {data.season && (
        <div style={{ background: CARD, borderRadius: 12, padding: '13px 16px', border: '1px solid rgba(96,165,250,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>🌦️ 지금 계절 (매크로 방향)</span>
            {hasUs && <span style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 8, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>🇺🇸 {data.season.us.seasonKo}</span>}
            {hasKr && <span style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 8, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>🇰🇷 {data.season.kr.seasonKo}</span>}
            <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>
              내 종목 중 <b style={{ color: '#22c55e' }}>{favoredCnt}개</b> 계절 유리{favoredCnt > 0 && <span style={{ color: '#86efac' }}> ({nameList(favoredList)})</span>}{unfavoredCnt > 0 && <> · <b style={{ color: '#f59e0b' }}>{unfavoredCnt}개</b> 불리<span style={{ color: '#fcd34d' }}> ({nameList(unfavoredList)})</span></>}
            </span>
          </div>
          <div style={{ color: '#9aa7b4', fontSize: 11, lineHeight: 1.6 }}>
            이 탭은 <b style={{ color: '#cbd5e1' }}>계절(방향) × 펀더멘탈(가치) × 수급(연료)</b> 3축으로 내 종목을 봅니다. 우대 섹터({(hasUs ? data.season.us : data.season.kr).favored.slice(0, 3).join('·')} 등)에 속하면 <span style={{ color: '#22c55e' }}>🌱 계절 유리</span>입니다.
          </div>
        </div>
      )}

      {/* 쌍끌이 / 과밀 2단 보드 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', background: CARD, borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🏆 매수 우선순위 (저평가 + 유입)</div>
          <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 10 }}>저PEG인데 스마트머니까지 유입 — 가장 매력적인 자리</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leaders.length ? leaders.map(e => <Row key={e.ticker} e={e} />)
              : nearPriority.length ? (
                <>
                  <div style={{ color: '#f59e0b', fontSize: 11, marginBottom: 2 }}>🔜 곧 1순위가 될 후보 — 저평가주에 수급이 막 살아나는 중</div>
                  {nearPriority.map(e => <Row key={e.ticker} e={e} near />)}
                </>
              ) : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '6px 0' }}>현재 저평가 + 수급 유입(또는 임박) 종목이 없습니다.</div>}
          </div>
        </div>
        <div style={{ flex: '1 1 320px', background: CARD, borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>⚠️ 상투·과열 경보 (고평가)</div>
          <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 10 }}>고평가인데 수급이 몰리거나(추격 과열) 메이저가 이탈 중 — 추격 자제</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {crowded.length ? crowded.map(e => <Row key={e.ticker} e={e} />) : <div style={{ color: '#8a9aaa', fontSize: 12, padding: '6px 0' }}>현재 과밀·상투 경보 종목이 없습니다.</div>}
          </div>
        </div>
      </div>

      {/* 린치식 4분면 매트릭스 */}
      <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
        <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🧭 피터 린치 수급 매트릭스</div>
        <div style={{ color: '#7f93a8', fontSize: 11, marginBottom: 12 }}>펀더멘탈(저PEG·흑자) × 수급(유입/이탈)으로 내 종목 자동 배치 · <span style={{ color: '#22c55e' }}>🟢</span> 유입·임박({data.inflowCount}개) · <span>🔴</span> 이탈·과열({data.crowdedCount}개) · <span style={{ color: '#22c55e' }}>🌱</span>계절 유리/<span style={{ color: '#f59e0b' }}>⚠️</span>불리</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(['LEADER', 'PEARL', 'CROWDED', 'REVIEW'] as Quadrant[]).map(q => {
            const cfg = QUAD[q]
            const list = byQuad(q)
            return (
              <div key={q} style={{ background: '#0f1117', borderRadius: 10, border: `1px solid ${cfg.color}33`, padding: '11px 13px', minHeight: 92 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: cfg.color, fontWeight: 800, fontSize: 13 }}>{cfg.emoji} {cfg.label}</span>
                  <span style={{ color: '#8a9aaa', fontSize: 13 }}>{list.length}</span>
                </div>
                <div style={{ color: '#9aa7b4', fontSize: 10.5, marginBottom: 8 }}>{cfg.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  {list.length ? list.slice().sort((a, b) => b.weight - a.weight).map(e => {
                    // 비중 히트맵 — 비중 클수록 크고 굵고 진하게 + 비중% 직접 표기
                    const w = e.weight
                    const fs = 11.5 + Math.min(w * 0.28, 9)        // 11.5 ~ 20.5
                    const fw = w >= 15 ? 800 : w >= 7 ? 700 : 600
                    const alpha = w >= 20 ? '40' : w >= 10 ? '2a' : w >= 4 ? '18' : '0e'
                    // 🟢 유입·임박(동행지수 포함) / 🔴 수급 이탈·과열 — 저평가 박스에 섞여도 표식으로 식별
                    const crowdedSig = e.status === 'CROWDED'
                    const inflow = isInflowNear(e)   // CROWDED는 제외(같은 칩에 🟢🔴 동시 표시 방지)
                    return (
                      <span key={e.ticker} title={`비중 ${w}%${inflow ? ' · 🟢 스마트머니 유입·임박(동행지수 포함)' : ''}${crowdedSig ? ' · 🔴 수급 이탈·과열 경보' : ''}`} style={{ background: `${cfg.color}${alpha}`, color: '#e2e8f0', border: `1px solid ${cfg.color}${w >= 7 ? '77' : '33'}`, borderRadius: 7, padding: '3px 9px', fontSize: fs, fontWeight: fw, lineHeight: 1.4 }}>
                        {inflow && <span style={{ color: '#22c55e', marginRight: 4 }}>🟢</span>}
                        {crowdedSig && <span style={{ marginRight: 4 }}>🔴</span>}
                        {dnm(e)}<span style={{ color: cfg.color, fontWeight: 800, marginLeft: 5 }}>{w}%</span>
                        {e.peg != null ? <span style={{ color: '#9aa7b4', fontWeight: 400, fontSize: 10.5 }}> · PEG {e.peg.toFixed(2)}</span> : null}
                        {e.seasonTag !== 'neutral' && <span style={{ marginLeft: 4 }}><SeasonChip tag={e.seasonTag} mini /></span>}
                      </span>
                    )
                  }) : (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0 4px', border: `1px dashed ${cfg.color}22`, borderRadius: 8 }}>
                      <span style={{ fontSize: 22, opacity: 0.16, filter: 'grayscale(0.4)' }}>{cfg.emoji}</span>
                      <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{cfg.empty}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ color: '#8a9aaa', fontSize: 10.5, lineHeight: 1.6 }}>
        ※ 동행지수는 종목 수 기준 유입 비율입니다. 수급은 종목별 레이더(리서치)와 동일 엔진 · 매수/매도 시 자동 갱신. 수급은 연료일 뿐 방향은 펀더멘탈이 결정합니다 — 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
