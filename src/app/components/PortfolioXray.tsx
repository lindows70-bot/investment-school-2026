'use client'
// 🔬 포트폴리오 X-Ray UI — ETF 속살 투시: 실질 종목 노출(직접+ETF경유) + 실질 섹터 + 숨은 몰빵 경고
import { useState, useEffect } from 'react'
import type { XrayResult } from '@/app/api/portfolio-xray/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const SEC_COLOR: Record<string, string> = {
  Technology: TK.blue400, 'Communication Services': TK.violet400, 'Consumer Cyclical': TK.pink400,
  'Consumer Defensive': TK.emerald400, 'Financial Services': TK.amber400, Healthcare: TK.green400,
  Industrials: TK.orange400, Energy: TK.red400, 'Basic Materials': TK.purple400, Utilities: TK.cyan400,
  'Real Estate': TK.slate400, 기타: TK.slate500,
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
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>🔬 ETF 속살 투시 (X-Ray)</span>
        <span style={{ color: TK.sub, fontSize: 11 }}>ETF {data.etfTotalWeight}% 보유 — 분해하면 진짜 노출이 보입니다</span>
        <button onClick={() => setOpen(o => !o)} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', background: open ? 'rgba(34,211,238,0.18)' : 'rgba(34,211,238,0.08)', color: TK.cyan400, border: `1px solid ${open ? `${TK.cyan400}66` : `${TK.cyan400}33`}` }}>
          {open ? '🔬 투시 끄기' : '🔬 투시하기'}
        </button>
      </div>

      {/* 숨은 몰빵 경고 — 토글 무관 상시(가장 중요한 발견) */}
      {data.hiddenConcentration && (
        <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: `1px solid ${TK.red500}44`, borderRadius: 9, padding: '9px 12px', color: TK.red300, fontSize: 11.5, lineHeight: 1.6 }}>
          🚨 <b>숨은 몰빵 발견</b> — <b>{data.hiddenConcentration.name}</b>에 실질 <b>{data.hiddenConcentration.totalWeight}%</b> 노출
          (직접 {data.hiddenConcentration.directWeight}% + {data.hiddenConcentration.viaEtfs.join('·')} 경유 {Math.round((data.hiddenConcentration.totalWeight - data.hiddenConcentration.directWeight) * 10) / 10}%).
          ETF로 분산했다고 생각해도 같은 종목에 중복 노출될 수 있습니다.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 실질 종목 노출 Top */}
          <div>
            <div style={{ color: TK.cyan400, fontWeight: 800, fontSize: 12, marginBottom: 2 }}>📊 실질 종목 노출 — 직접 보유 + ETF 경유 합산</div>
            <div style={{ color: TK.sub, fontSize: 10.5, marginBottom: 8 }}>막대: <span style={{ color: TK.blue400 }}>■ 직접 보유</span> + <span style={{ color: TK.cyan400 }}>■ ETF 경유</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.realStocks.slice(0, 10).map(s => {
                const max = data.realStocks[0]?.totalWeight || 1
                return (
                  <div key={s.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,1.2fr) 2fr 110px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center', overflow: 'hidden' }}>
                      <span style={{ fontSize: 9.5 }}>{s.market === 'KR' ? '🇰🇷' : '🇺🇸'}</span>
                      <span style={{ color: TK.slate200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.viaEtfs.length ? `경유: ${s.viaEtfs.join(', ')}` : undefined}>{s.name}</span>
                    </span>
                    <div style={{ height: 9, background: TK.bg3, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${s.directWeight / max * 100}%`, background: TK.blue400 }} />
                      <div style={{ width: `${s.etfWeight / max * 100}%`, background: TK.cyan400 }} />
                    </div>
                    <span style={{ color: TK.slate300, fontFamily: 'monospace', fontSize: 10.5, textAlign: 'right' }}>
                      {s.totalWeight}%{s.etfWeight > 0 && <span style={{ color: TK.cyan400 }}> (ETF {s.etfWeight}%)</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 실질 섹터 노출 */}
          <div>
            <div style={{ color: TK.cyan400, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>🏭 실질 섹터 노출 — ETF 내부 섹터까지 합산</div>
            <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              {data.realSectors.slice(0, 8).map(s => (
                <div key={s.sector} title={`${s.sector} ${s.weight}%`} style={{ width: `${s.weight}%`, background: SEC_COLOR[s.sector] ?? TK.slate500 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {data.realSectors.slice(0, 6).map(s => (
                <span key={s.sector} style={{ fontSize: 10.5, color: TK.sub5 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SEC_COLOR[s.sector] ?? TK.slate500, marginRight: 4 }} />
                  {s.sector} <b style={{ color: TK.slate200 }}>{s.weight}%</b>
                </span>
              ))}
            </div>
          </div>

          {/* 보유 ETF 분해 명세 */}
          <div>
            <div style={{ color: TK.cyan400, fontWeight: 800, fontSize: 12, marginBottom: 6 }}>📦 보유 ETF 분해 명세</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.etfDetails.map(e => (
                <div key={e.ticker} style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 11px', fontSize: 11 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: TK.slate200, fontWeight: 700 }}>{e.name}</span>
                    <span style={{ color: TK.sub, fontFamily: 'monospace' }}>{e.weight}%</span>
                    {e.syntheticPeg != null && (() => {
                      // 밸류 판정 임계 = 뉴스레이더 valuationOf와 동일(제2원칙): ≤1.0 저평가 / ≤2.2 적정 / >2.2 고평가
                      const verdict = e.syntheticPeg <= 1.0 ? ['저평가', TK.green500] : e.syntheticPeg <= 2.2 ? ['적정', TK.amber400] : ['고평가', TK.red400]
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${verdict[1]}14`, border: `1px solid ${verdict[1]}44`, borderRadius: 6, padding: '1px 8px' }}>
                          <span style={{ color: verdict[1], fontWeight: 800, fontSize: 10 }}>💎 합산 PEG {e.syntheticPeg.toFixed(2)} · {verdict[0]}</span>
                          <span style={{ color: TK.sub, fontSize: 9 }}>(상위 {e.pegCoverage}% 기준)</span>
                        </span>
                      )
                    })()}
                    {!e.resolved && e.isLeveraged && <span style={{ color: TK.red400, fontSize: 10 }}>⚠️ 레버리지·인버스 — 스왑 구조라 분해 부적합(실노출 왜곡)</span>}
                    {!e.resolved && !e.isLeveraged && <span style={{ color: TK.amber400, fontSize: 10 }}>⚠️ 비주식/분해불가 — 기타 자산 처리</span>}
                    {e.resolved && e.holdingsHaveWeights && e.twinTicker && <span style={{ color: TK.cyan400, fontSize: 10 }}>📈 표준지수 추종 — {e.twinTicker} 구성비중 차용(동일 지수)</span>}
                    {e.resolved && !e.holdingsHaveWeights && <span style={{ color: TK.amber400, fontSize: 10 }}>ℹ️ 종목 비중 미제공(해외주식형) — 섹터로만 반영</span>}
                  </div>
                  {e.topNames.length > 0 && <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 3 }}>상위: {e.topNames.join(' · ')}</div>}
                  {e.topSectors.length > 0 && <div style={{ color: TK.sub2, fontSize: 10, marginTop: 2 }}>섹터: {e.topSectors.map(s => `${s.sector} ${s.weight}%`).join(' · ')}</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ color: TK.sub8, fontSize: 10, lineHeight: 1.6 }}>
            ※ 커버리지: 직접 주식 {cov.directStock}% + ETF 분해(상위종목) {cov.etfDecomposed}% + ETF 기타분산·비중미제공 {cov.etfResidual}% + 기타 자산 {cov.other}%.
            종목 비중은 ETF 상위 구성종목의 <b>원시 비중</b>(재정규화 안 함 — 과장 방지), 섹터는 ETF 전체 섹터 비중. 해외주식형 한국 ETF는 비중 미제공이라 종목 합산에서 정직하게 제외(표준지수 추종은 US 쌍둥이 차용). 💎 합산 PEG는 상위 구성종목 PEG(stock-info SSOT) 가중평균 — 경기순환주 저PEG는 이익 정점 함정일 수 있으니 단독 판단 금지. 7일 캐시 · 교육용.
          </div>
        </div>
      )}
    </div>
  )
}
