'use client'
// 🛰️ AI 1억 백지 퀀트 빌더 — 코어(행성)·위성 궤도 시각화 + 3축 통과 처방전 + ETF 투시경 실질 섹터 도넛
import { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { QuantBuilderResult, QuantSatellite, AxisStatus } from '@/lib/quantBuilder'

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

export default function QuantBuilderLab() {
  const [d, setD] = useState<QuantBuilderResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [amountEok, setAmountEok] = useState('1')   // 억 단위 입력(기본 1억)
  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
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

  const onCopy = async () => {
    if (!d) return
    const names = [...d.core.map(c => c.ticker), ...d.satellites.map(s => s.name)].join(', ')
    if (!window.confirm(`처방전 ${d.core.length + d.satellites.length}종(${names})을 ${fmtWon(amountKrw)}원 기준으로 내 포트폴리오에 가상 편입합니다.\n현재가가 매입가로 기록되며, 이미 보유한 티커는 건너뜁니다. 진행할까요?`)) return
    setCopying(true); setCopyMsg(null)
    try {
      const r = await fetch('/api/quant-builder/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountKrw }),
      })
      const j = await r.json()
      if (j.error) setCopyMsg('❌ 복사 실패 — 잠시 후 다시 시도해주세요.')
      else {
        setCopyMsg(`✅ ${j.added.length}종 편입 완료${j.skippedHeld.length ? ` · 이미 보유 ${j.skippedHeld.length}종 건너뜀(${j.skippedHeld.slice(0, 3).join(', ')}${j.skippedHeld.length > 3 ? '…' : ''})` : ''}${j.skippedNoPrice.length ? ` · 가격 미확인 ${j.skippedNoPrice.length}종 제외` : ''}`)
        window.dispatchEvent(new Event('portfolio-updated'))
      }
    } catch { setCopyMsg('❌ 복사 실패 — 네트워크를 확인해주세요.') }
    setCopying(false)
  }

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
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{c.ticker}</span>
            <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{c.name} · {c.role}</span>
            <span style={{ marginLeft: 'auto', color: '#22d3ee', fontWeight: 800, fontFamily: 'monospace' }}>{c.weightPct}%</span>
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
              <span style={{ marginLeft: 'auto', color: '#a78bfa', fontWeight: 800, fontFamily: 'monospace' }}>{s.weightPct}%</span>
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
                {s.badges.length > 0 && <div style={{ marginTop: 3 }}>{s.badges.map(b => <span key={b} style={{ marginRight: 8, color: '#8a9aaa' }}>{b}</span>)}</div>}
              </div>
            )}
          </div>
        ))}
        {/* 복사 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={onCopy} disabled={copying}
            style={{ background: 'linear-gradient(135deg,#0e7490,#7c3aed)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 12.5, fontWeight: 800, cursor: copying ? 'wait' : 'pointer', opacity: copying ? 0.6 : 1 }}>
            {copying ? '편입 중…' : '📋 내 포트폴리오로 복사하기 (가상 트래킹)'}
          </button>
          {copyMsg && <span style={{ color: '#aab6c4', fontSize: 11.5 }}>{copyMsg}</span>}
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 실제 매매 연동은 하지 않습니다 — 복사 시 현재가가 가상 매입가로 기록될 뿐입니다 · 위성 점수는 통합추천(③)과 동일한 SSOT(계절×가치×수급 + 기저효과 가드) · Core 배분은 4계절 국면 연동 교육용 룰 · 12h 캐시 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
