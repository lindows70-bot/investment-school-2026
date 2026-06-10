'use client'
// 🔬 포트폴리오 X-Ray UI — ETF 속살 투시: 실질 종목 노출(직접+ETF경유) + 실질 섹터 + 숨은 몰빵 경고
import { useState, useEffect } from 'react'
import type { XrayResult } from '@/app/api/portfolio-xray/route'

const CARD = '#161b25', BORDER = '#1e293b'
const SEC_COLOR: Record<string, string> = {
  Technology: '#60a5fa', 'Communication Services': '#a78bfa', 'Consumer Cyclical': '#f472b6',
  'Consumer Defensive': '#34d399', 'Financial Services': '#fbbf24', Healthcare: '#4ade80',
  Industrials: '#fb923c', Energy: '#f87171', 'Basic Materials': '#c084fc', Utilities: '#22d3ee',
  'Real Estate': '#94a3b8', 기타: '#64748b',
}

export default function PortfolioXray() {
  const [data, setData] = useState<XrayResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/portfolio-xray', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setData(j.error ? null : j) })
        .catch(() => { if (alive) setData(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading || !data) return null                  // 진단 흐름을 막지 않음(조용히 로드)
  if (data.etfTotalWeight <= 0) return null          // ETF 미보유면 표시 안 함

  const cov = data.coverage
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
      {/* 헤더 + 투시 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🔬 ETF 속살 투시 (X-Ray)</span>
        <span style={{ color: '#8a9aaa', fontSize: 11 }}>ETF {data.etfTotalWeight}% 보유 — 분해하면 진짜 노출이 보입니다</span>
        <button onClick={() => setOpen(o => !o)} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', background: open ? 'rgba(34,211,238,0.18)' : 'rgba(34,211,238,0.08)', color: '#22d3ee', border: `1px solid ${open ? '#22d3ee66' : '#22d3ee33'}` }}>
          {open ? '🔬 투시 끄기' : '🔬 투시하기'}
        </button>
      </div>

      {/* 숨은 몰빵 경고 — 토글 무관 상시(가장 중요한 발견) */}
      {data.hiddenConcentration && (
        <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444444', borderRadius: 9, padding: '9px 12px', color: '#fca5a5', fontSize: 11.5, lineHeight: 1.6 }}>
          🚨 <b>숨은 몰빵 발견</b> — <b>{data.hiddenConcentration.name}</b>에 실질 <b>{data.hiddenConcentration.totalWeight}%</b> 노출
          (직접 {data.hiddenConcentration.directWeight}% + {data.hiddenConcentration.viaEtfs.join('·')} 경유 {Math.round((data.hiddenConcentration.totalWeight - data.hiddenConcentration.directWeight) * 10) / 10}%).
          ETF로 분산했다고 생각해도 같은 종목에 중복 노출될 수 있습니다.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 실질 종목 노출 Top */}
          <div>
            <div style={{ color: '#22d3ee', fontWeight: 800, fontSize: 12, marginBottom: 2 }}>📊 실질 종목 노출 — 직접 보유 + ETF 경유 합산</div>
            <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 8 }}>막대: <span style={{ color: '#60a5fa' }}>■ 직접 보유</span> + <span style={{ color: '#22d3ee' }}>■ ETF 경유</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.realStocks.slice(0, 10).map(s => {
                const max = data.realStocks[0]?.totalWeight || 1
                return (
                  <div key={s.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1.2fr) 2fr 110px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center', overflow: 'hidden' }}>
                      <span style={{ fontSize: 9.5 }}>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
                      <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.viaEtfs.length ? `경유: ${s.viaEtfs.join(', ')}` : undefined}>{s.name}</span>
                    </span>
                    <div style={{ height: 9, background: '#0f1117', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${s.directWeight / max * 100}%`, background: '#60a5fa' }} />
                      <div style={{ width: `${s.etfWeight / max * 100}%`, background: '#22d3ee' }} />
                    </div>
                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: 10.5, textAlign: 'right' }}>
                      {s.totalWeight}%{s.etfWeight > 0 && <span style={{ color: '#22d3ee' }}> (ETF {s.etfWeight}%)</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 실질 섹터 노출 */}
          <div>
            <div style={{ color: '#22d3ee', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>🏭 실질 섹터 노출 — ETF 내부 섹터까지 합산</div>
            <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              {data.realSectors.slice(0, 8).map(s => (
                <div key={s.sector} title={`${s.sector} ${s.weight}%`} style={{ width: `${s.weight}%`, background: SEC_COLOR[s.sector] ?? '#64748b' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {data.realSectors.slice(0, 6).map(s => (
                <span key={s.sector} style={{ fontSize: 10.5, color: '#aab6c4' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SEC_COLOR[s.sector] ?? '#64748b', marginRight: 4 }} />
                  {s.sector} <b style={{ color: '#e2e8f0' }}>{s.weight}%</b>
                </span>
              ))}
            </div>
          </div>

          {/* 보유 ETF 분해 명세 */}
          <div>
            <div style={{ color: '#22d3ee', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>📦 보유 ETF 분해 명세</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.etfDetails.map(e => (
                <div key={e.ticker} style={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 11px', fontSize: 11 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{e.name}</span>
                    <span style={{ color: '#8a9aaa', fontFamily: 'monospace' }}>{e.weight}%</span>
                    {!e.resolved && e.isLeveraged && <span style={{ color: '#f87171', fontSize: 10 }}>⚠️ 레버리지·인버스 — 스왑 구조라 분해 부적합(실노출 왜곡)</span>}
                    {!e.resolved && !e.isLeveraged && <span style={{ color: '#fbbf24', fontSize: 10 }}>⚠️ 비주식/분해불가 — 기타 자산 처리</span>}
                    {e.resolved && !e.holdingsHaveWeights && <span style={{ color: '#fbbf24', fontSize: 10 }}>ℹ️ 종목 비중 미제공(해외주식형) — 섹터로만 반영</span>}
                  </div>
                  {e.topNames.length > 0 && <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 3 }}>상위: {e.topNames.join(' · ')}</div>}
                  {e.topSectors.length > 0 && <div style={{ color: '#7f93a8', fontSize: 10, marginTop: 2 }}>섹터: {e.topSectors.map(s => `${s.sector} ${s.weight}%`).join(' · ')}</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ color: '#9aa7b5', fontSize: 10, lineHeight: 1.6 }}>
            ※ 커버리지: 직접 주식 {cov.directStock}% + ETF 분해(상위종목) {cov.etfDecomposed}% + ETF 기타분산·비중미제공 {cov.etfResidual}% + 기타 자산 {cov.other}%.
            종목 비중은 ETF 상위 구성종목의 <b>원시 비중</b>(재정규화 안 함 — 과장 방지), 섹터는 ETF 전체 섹터 비중. 해외주식형 한국 ETF는 비중 미제공이라 종목 합산에서 정직하게 제외. 7일 캐시 · 교육용.
          </div>
        </div>
      )}
    </div>
  )
}
