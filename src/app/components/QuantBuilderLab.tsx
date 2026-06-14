'use client'
// 🛰️ AI 1억 백지 퀀트 빌더 — 코어(행성)·위성 궤도 시각화 + 3축 통과 처방전 + ETF 투시경 실질 섹터 도넛
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { QuantBuilderResult, QuantSatellite, AxisStatus, PriceContext } from '@/lib/quantBuilder'

const CARD = '#161b25', BORDER = '#1e293b'

const SECTOR_KR: Record<string, string> = {
  Technology: 'IT/기술', 'Financial Services': '금융', Healthcare: '헬스케어', 'Consumer Cyclical': '경기소비재',
  'Consumer Defensive': '필수소비재', Industrials: '산업재', Energy: '에너지', 'Basic Materials': '소재',
  'Communication Services': '커뮤니케이션', Utilities: '유틸리티', 'Real Estate': '부동산',
}
const secKr = (s: string) => SECTOR_KR[s] ?? s
const SECTOR_COLORS = ['#60a5fa', '#4ade80', '#fbbf24', '#fb923c', '#a78bfa', '#22d3ee', '#f87171', '#94a3b8', '#34d399', '#e879f9', '#facc15', '#64748b']

const AXIS_META: { key: keyof QuantSatellite['axes']; icon: string; label: string }[] = [
  { key: 'buffett', icon: '🏰', label: '버핏 퀄리티' },
  { key: 'lynch',   icon: '💎', label: '린치 밸류' },
  { key: 'supply',  icon: '📡', label: '수급 모멘텀' },
]
const axisColor = (s: AxisStatus) => s === 'pass' ? '#4ade80' : s === 'fail' ? '#f87171' : '#64748b'
const axisMark = (s: AxisStatus) => s === 'pass' ? '✓' : s === 'fail' ? '✗' : '–'

const fmtWon = (n: number) => n >= 1e8 ? `${Math.round(n / 1e7) / 10}억` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString('ko-KR')}만` : `${Math.round(n).toLocaleString('ko-KR')}`

// 52주 위치 해설 — 학생용 직관 라벨(낮을수록 바닥권 = 싸게 사는 것, 높을수록 추격 매수 주의)
const posLabel = (p: number) => p <= 25 ? { t: '바닥권', c: '#4ade80' } : p <= 50 ? { t: '중하단', c: '#a3e635' } : p <= 75 ? { t: '중상단', c: '#fbbf24' } : p <= 92 ? { t: '고점권', c: '#fb923c' } : { t: '신고가권', c: '#f87171' }

// 📈 1년 주봉 스파크라인(SVG polyline) — 라이브러리 없이 가볍게
function Spark({ ctx }: { ctx: PriceContext }) {
  const W = 110, H = 26
  const min = Math.min(...ctx.spark), max = Math.max(...ctx.spark)
  const range = max - min || 1
  const pts = ctx.spark.map((v, i) => `${(i / (ctx.spark.length - 1)) * W},${H - 2 - ((v - min) / range) * (H - 4)}`).join(' ')
  const up = ctx.spark[ctx.spark.length - 1] >= ctx.spark[0]
  const col = up ? '#4ade80' : '#f87171'
  return (
    <svg width={W} height={H} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth={1.4} />
      <circle cx={W} cy={H - 2 - ((ctx.spark[ctx.spark.length - 1] - min) / range) * (H - 4)} r={2} fill={col} />
    </svg>
  )
}

// 📍 52주 밴드 위치 게이지 — "지금 어느 위치에서 사라는 건지"
function Band52({ ctx }: { ctx: PriceContext }) {
  const lb = posLabel(ctx.posPct)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }} title={`52주 ${ctx.low52.toLocaleString()} ~ ${ctx.high52.toLocaleString()} · 현재 ${ctx.price.toLocaleString()}`}>
      <span style={{ position: 'relative', width: 72, height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#22c55e44,#fbbf2444,#ef444444)' }}>
        <span style={{ position: 'absolute', left: `calc(${ctx.posPct}% - 3px)`, top: -2, width: 6, height: 10, borderRadius: 2, background: lb.c, border: '1px solid #0f1117' }} />
      </span>
      <span style={{ color: lb.c, fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>52주 {ctx.posPct}% · {lb.t}</span>
    </span>
  )
}

export default function QuantBuilderLab() {
  const [d, setD] = useState<QuantBuilderResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [amountEok, setAmountEok] = useState('1')   // 억 단위 입력(기본 1억)
  const [openSat, setOpenSat] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/quant-builder', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const amountKrw = useMemo(() => {
    const v = parseFloat(amountEok)
    return isFinite(v) && v > 0 ? Math.round(v * 1e8) : 1e8
  }, [amountEok])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🛰️ 퀀트 빌더가 시장 국면과 3축 데이터를 수집 중…(최초 1회 최대 1분)</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>설계 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>

  const pieData = d.effectiveSectors.map(s => ({ name: secKr(s.sector), value: s.weightPct }))
  // 위성 궤도 좌표(원형 배치)
  const orbitR = 132
  const satPos = d.satellites.map((s, i) => {
    const ang = (-90 + i * (360 / Math.max(1, d.satellites.length))) * Math.PI / 180
    return { s, x: Math.cos(ang) * orbitR, y: Math.sin(ang) * orbitR }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 + 투자금 입력 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(34,211,238,0.10),rgba(167,139,250,0.07))', border: '1px solid rgba(34,211,238,0.35)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🛰️</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16 }}>AI 1억 백지 퀀트 빌더</span>
          <span style={{ color: '#8a9aaa', fontSize: 12 }}>코어-새틀라이트 — 백지에서 시작하는 국면 맞춤 설계</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#8a9aaa', fontSize: 11.5 }}>총투자금</span>
            <input value={amountEok} onChange={e => setAmountEok(e.target.value.replace(/[^0-9.]/g, ''))}
              style={{ width: 64, background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 9px', color: '#e2e8f0', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', textAlign: 'right' }} />
            <span style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: 700 }}>억원</span>
          </span>
        </div>
        <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.65, marginTop: 7 }}>
          현재 국면 <b style={{ color: '#22d3ee' }}>{d.seasonLabel}</b> → Core(시장 ETF) <b style={{ color: '#22d3ee' }}>{d.coreRatio}%</b> + Satellite(최정예 개별주) <b style={{ color: '#a78bfa' }}>{d.satelliteRatio}%</b>. {d.rationale}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* 🪐 궤도 시각화 — Core 행성 + 위성 */}
        <div style={{ flex: '1 1 380px', minWidth: 320, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🪐 코어 행성 × 위성 궤도</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>중심 = 시장 ETF(묵직한 본체) · 궤도 = 알파를 노리는 정예 개별주</div>
          <div style={{ position: 'relative', height: 340, overflow: 'hidden' }}>
            {/* 궤도 링 */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: orbitR * 2, height: orbitR * 2, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1.5px dashed #334155' }} />
            {/* Core 행성 */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(34,211,238,0.35), rgba(34,211,238,0.08) 60%, rgba(15,17,23,0.9))', border: '1.5px solid rgba(34,211,238,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <span style={{ color: '#22d3ee', fontWeight: 900, fontSize: 15 }}>CORE {d.coreRatio}%</span>
              <span style={{ color: '#cbd5e1', fontSize: 10.5, fontFamily: 'monospace' }}>₩{fmtWon(amountKrw * d.coreRatio / 100)}</span>
              {d.core.map(c => (
                <span key={c.ticker} style={{ color: '#9aa7b5', fontSize: 9.5 }}>{c.ticker} {c.weightPct}%</span>
              ))}
            </div>
            {/* 위성들 */}
            {satPos.map(({ s, x, y }) => (
              <button key={s.ticker} onClick={() => setOpenSat(o => o === s.ticker ? null : s.ticker)}
                title={`${s.name} · 통합 ${s.combined}점`}
                style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)', width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
                  background: s.passCount === 3 ? 'radial-gradient(circle at 35% 30%, rgba(74,222,128,0.4), rgba(15,17,23,0.92))' : 'radial-gradient(circle at 35% 30%, rgba(167,139,250,0.4), rgba(15,17,23,0.92))',
                  border: `1.5px solid ${openSat === s.ticker ? '#e2e8f0' : s.passCount === 3 ? '#4ade8088' : '#a78bfa88'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 9.5, lineHeight: 1.15, maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.market === 'KR' ? s.name.slice(0, 5) : s.ticker}</span>
                <span style={{ color: '#9aa7b5', fontSize: 8.5, fontFamily: 'monospace' }}>{s.weightPct}%</span>
              </button>
            ))}
            {d.satellites.length === 0 && (
              <div style={{ position: 'absolute', left: '50%', top: '88%', transform: 'translate(-50%,-50%)', color: '#8a9aaa', fontSize: 11 }}>3축을 모두 통과한 위성이 아직 없습니다(데이터 수집 중)</div>
            )}
          </div>
          <div style={{ color: '#6e7f8f', fontSize: 9.5, display: 'flex', gap: 12 }}>
            <span><span style={{ color: '#4ade80' }}>●</span> 3축 전부 통과(최정예)</span>
            <span><span style={{ color: '#a78bfa' }}>●</span> 2축 통과+무탈락(정예)</span>
            <span>위성 클릭 → 상세</span>
          </div>
        </div>

        {/* 🍩 ETF 투시경 — 실질 섹터 합성 도넛 */}
        <div style={{ flex: '1 1 320px', minWidth: 280, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>🔬 ETF 투시경 — {fmtWon(amountKrw)}원의 실질 섹터</div>
          <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 4 }}>Core ETF를 분해해 위성과 합산한 진짜 노출 — ETF 뒤에 숨은 쏠림까지 봅니다</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={1.5} strokeWidth={0}>
                  {pieData.map((p, i) => <Cell key={p.name} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} formatter={v => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginTop: 2 }}>
            {d.effectiveSectors.slice(0, 8).map((s, i) => (
              <span key={s.sector} style={{ fontSize: 10, color: '#aab6c4' }}>
                <span style={{ color: SECTOR_COLORS[i % SECTOR_COLORS.length] }}>■</span> {secKr(s.sector)} <b style={{ fontFamily: 'monospace' }}>{s.weightPct}%</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 📋 처방전 테이블 — 금액 배분 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📋 처방전 — {fmtWon(amountKrw)}원 배분</span>
          <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{d.axisRule}</span>
        </div>
        {/* Core */}
        {d.core.map(c => (
          <div key={c.ticker} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `1px solid ${BORDER}`, fontSize: 11.5, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.4)', borderRadius: 5, padding: '1px 7px', fontSize: 9.5, fontWeight: 800 }}>CORE</span>
            <span>{c.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{c.ticker}</span>
            <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{c.name} · {c.role}</span>
            {c.priceCtx && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Spark ctx={c.priceCtx} />
                <Band52 ctx={c.priceCtx} />
              </span>
            )}
            <span style={{ marginLeft: c.priceCtx ? 0 : 'auto', color: '#22d3ee', fontWeight: 800, fontFamily: 'monospace' }}>{c.weightPct}%</span>
            <span style={{ color: '#cbd5e1', fontFamily: 'monospace', minWidth: 76, textAlign: 'right' }}>₩{fmtWon(amountKrw * c.weightPct / 100)}</span>
          </div>
        ))}
        {/* Satellites */}
        {d.satellites.map(s => (
          <div key={s.ticker}>
            <div onClick={() => setOpenSat(o => o === s.ticker ? null : s.ticker)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `1px solid ${BORDER}`, fontSize: 11.5, flexWrap: 'wrap', cursor: 'pointer' }}>
              <span style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 5, padding: '1px 7px', fontSize: 9.5, fontWeight: 800 }}>SAT</span>
              <span>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{s.name}</span>
              {AXIS_META.map(a => (
                <span key={a.key} title={a.label} style={{ color: axisColor(s.axes[a.key]), fontSize: 10, fontWeight: 800 }}>{a.icon}{axisMark(s.axes[a.key])}</span>
              ))}
              <span style={{ color: '#8a9aaa', fontSize: 10 }}>통합 {s.combined}</span>
              {s.priceCtx && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <Spark ctx={s.priceCtx} />
                  <Band52 ctx={s.priceCtx} />
                </span>
              )}
              <span style={{ marginLeft: s.priceCtx ? 0 : 'auto', color: '#a78bfa', fontWeight: 800, fontFamily: 'monospace' }}>{s.weightPct}%</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace', minWidth: 76, textAlign: 'right' }}>₩{fmtWon(amountKrw * s.weightPct / 100)}</span>
            </div>
            {openSat === s.ticker && (
              <div style={{ margin: '2px 0 6px', background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 10.5, color: '#aab6c4', lineHeight: 1.7 }}>
                {AXIS_META.map(a => (
                  <span key={a.key} style={{ marginRight: 14 }}>
                    {a.icon} {a.label}: <b style={{ color: axisColor(s.axes[a.key]) }}>
                      {a.key === 'buffett' ? (s.roePct != null ? `ROE ${s.roePct}%` : 'ROE 자료없음') + (s.epsRevision === 'up' ? ' · 추정 상향' : s.epsRevision === 'down' ? ' · 추정 하향' : '')
                        : a.key === 'lynch' ? (s.peg != null ? `PEG ${s.peg}` : 'PEG 자료없음')
                        : `수급 ${s.supplyScore}점`}
                    </b>
                  </span>
                ))}
                <span style={{ marginRight: 14 }} title="주가매출비율(P/S) — 적자기업·고성장주는 PER/PEG가 무의미할 때 '매출 대비 밸류'를 본다. 동종 업종끼리 비교해야 의미가 있다(산업마다 정상치 다름).">
                  💵 매출배수: <b style={{ color: s.psr != null ? '#cbd5e1' : '#6e7f8f' }}>{s.psr != null ? `PSR ${s.psr.toFixed(1)}배` : 'PSR 자료없음'}</b>
                </span>
                {s.badges.length > 0 && <div style={{ marginTop: 3 }}>{s.badges.map(b => <span key={b} style={{ marginRight: 8, color: '#8a9aaa' }}>{b}</span>)}</div>}
              </div>
            )}
          </div>
        ))}
        {/* 위성 미달분 → Core 환류 안내 */}
        {d.unallocatedNote && (
          <div style={{ marginTop: 8, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 8, padding: '7px 11px', color: '#9fd6e3', fontSize: 10.5, lineHeight: 1.6 }}>
            ⚖️ {d.unallocatedNote}
          </div>
        )}
        {/* 백테스트 안내 */}
        <div style={{ marginTop: 12, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 9, padding: '10px 13px' }}>
          <div style={{ color: '#9fd6e3', fontSize: 11.5, lineHeight: 1.7 }}>
            📊 이 추천안의 과거 성과가 궁금하면 — <b>‘투자 타임머신’ 탭 → [🛰️ AI 퀀트 빌더 추천] 토글</b>로 확인하세요. 이 추천안은 <b>내 실제 계좌(자산관리)에 저장되지 않습니다</b>(혼재·오염 없음).
          </div>
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 실제 매매 연동은 하지 않으며, 이 추천안은 내 실제 계좌에 저장되지 않습니다(혼재 없음) — 성과는 타임머신 탭에서 별도 백테스트 · 위성 점수는 통합추천(③)과 동일한 SSOT(계절×가치×수급 + 기저효과 가드) · Core 배분은 4계절 국면 연동 교육용 룰 ·
        📈 스파크라인=최근 1년 주봉, 📍 52주 게이지=현재가가 52주 밴드의 어디인지(0%=최저, 100%=최고 — 바닥권일수록 싸게 사는 것, 신고가권은 추격 매수 주의) · 12h 캐시 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
