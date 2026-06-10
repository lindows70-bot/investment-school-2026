'use client'

/**
 * 🏛️ NpsPortfolio — 국민연금 자산현황 대시보드 (거인의 장바구니)
 *
 *  ① 자산배분 개요 (주식/채권/대체 비중)  ② 🇰🇷 국내주식 Top10 (DART 5%룰)
 *  ③ 🇺🇸 해외주식 Top10 (SEC 13F-HR)
 *
 * ⚠️ '공시後 주가'는 NPS 실제 수익률 아님(매입단가 미공개). 채권·대체는 개별종목 비공개라 비중만.
 * 데이터: /api/nps-portfolio (DART + SEC 13F + Naver 일봉, 24h 캐시)
 */

import { useState, useEffect } from 'react'
import type { NpsDashboardResult } from '@/app/api/nps-portfolio/route'

const C = {
  card: '#1a1d27', card2: '#141720', border: '#2a2d3a',
  gold: '#f59e0b', green: '#4ade80', red: '#f87171', blue: '#60a5fa', cyan: '#22d3ee', purple: '#a78bfa', pink: '#f472b6',
  text: '#f1f5f9', textSub: '#94a3b8', textLow: '#8599ae',
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
const ALLOC_COLORS: Record<string, string> = { '해외주식': C.cyan, '국내채권': C.blue, '대체투자': C.purple, '국내주식': C.green, '해외채권': C.gold }

const won = (n: number) => n >= 1e12 ? `₩${(n / 1e12).toFixed(2)}조` : n >= 1e8 ? `₩${Math.round(n / 1e8).toLocaleString()}억` : `₩${Math.round(n / 1e4).toLocaleString()}만`
const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n / 1e3)}K`

export default function NpsPortfolio() {
  const [data, setData] = useState<NpsDashboardResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true; setLoading(true)
    fetch('/api/nps-portfolio', { cache: 'no-store' })
      .then(r => r.json()).then((r: NpsDashboardResult) => { if (alive) setData(r) })
      .catch(() => { if (alive) setData(null) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 18 }}>🏛️</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>국민연금 자산현황 — 거인의 장바구니</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${C.cyan}22`, color: C.cyan, fontWeight: 700 }}>NPS · DART + SEC 13F</span>
    </div>
  )
  const Wrap = (child: React.ReactNode, accent = C.border) => (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: C.card, border: `1px solid ${accent}`, fontFamily: FONT }}>{Header}{child}</div>
  )

  if (loading) return Wrap(<div style={{ fontSize: 12.5, color: C.textLow, lineHeight: 1.6 }}>🏛️ 국민연금 국내·해외 보유현황을 모으는 중… (첫 조회는 십수 초 걸릴 수 있어요)</div>)
  if (!data || data.status !== 'ok') return Wrap(<div style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>🏛️ {data?.message || '국민연금 데이터를 불러오지 못했습니다.'}</div>)

  const SectionTitle = (emoji: string, title: string, sub?: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0 9px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 900, color: C.text }}>{emoji} {title}</span>
      {sub && <span style={{ fontSize: 10, color: C.textLow }}>{sub}</span>}
    </div>
  )

  return Wrap(
    <>
      {/* ① 자산배분 개요 */}
      {SectionTitle('📊', '자산배분 개요', '전체 기금 · 공시 기준 참고치')}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 7 }}>
          {data.allocation.map(a => (
            <div key={a.name} title={`${a.name} ${a.pct}%`} style={{ width: `${a.pct}%`, background: ALLOC_COLORS[a.name] || C.textLow }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {data.allocation.map(a => (
            <span key={a.name} style={{ fontSize: 10.5, color: C.textSub, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ALLOC_COLORS[a.name] || C.textLow }} />
              {a.name} <b style={{ color: C.text, fontFamily: 'monospace' }}>{a.pct}%</b>
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 9.5, color: C.textLow, marginBottom: 16, lineHeight: 1.5 }}>※ 채권·대체투자는 개별 종목이 의무공시되지 않아 비중(집계)만 표시됩니다.</div>

      {/* ② 국내주식 Top 10 */}
      {SectionTitle('🇰🇷', '국내주식 Top 10', `5%+ ${data.domCount}종목 · 추적 ${won(data.domTotalValue)} · DART`)}
      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
          <thead><tr style={{ color: C.textLow, fontSize: 10 }}>
            <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 6px', width: 20 }}>#</th>
            <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 6px' }}>종목</th>
            <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 6px' }}>지분율</th>
            <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 6px' }}>평가액</th>
            <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 6px' }}>공시後 주가</th>
          </tr></thead>
          <tbody style={{ fontFamily: 'monospace' }}>
            {data.domestic.map((h, i) => (
              <tr key={h.ticker} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ color: C.textLow, padding: '7px 4px', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ textAlign: 'left', padding: '7px 4px', fontFamily: FONT }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{h.name.length > 11 ? h.name.slice(0, 10) + '…' : h.name}</span>
                  <span style={{ fontSize: 9, color: C.textLow, marginLeft: 4 }}>{h.ticker}</span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: h.stakePct >= 8 ? C.cyan : C.textSub, padding: '7px 4px' }}>
                  {h.stakePct.toFixed(2)}%{h.stakeChg != null && h.stakeChg !== 0 && <span style={{ fontSize: 8.5, color: h.stakeChg > 0 ? C.green : C.red, marginLeft: 3 }}>{h.stakeChg > 0 ? '▲' : '▼'}</span>}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: C.text, padding: '7px 4px' }}>{h.value > 0 ? won(h.value) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '7px 4px' }}>
                  <div style={{ fontWeight: 800, color: h.sinceDisclPct == null ? C.textLow : h.sinceDisclPct >= 0 ? C.green : C.red }}>{h.sinceDisclPct == null ? '—' : `${h.sinceDisclPct > 0 ? '+' : ''}${Math.round(h.sinceDisclPct).toLocaleString()}%`}</div>
                  <div style={{ fontSize: 8.5, color: C.textLow, fontFamily: FONT }}>{h.disclDate ? `'${h.disclDate.slice(2, 7).replace('-', '.')}~` : ''}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ③ 해외주식 Top 10 */}
      {data.overseas.length > 0 && (
        <>
          {SectionTitle('🇺🇸', '해외주식 Top 10', `${data.ovsCount}종목 · 총 ${usd(data.ovsTotalValue)} · SEC 13F ${data.ovsAsOf}`)}
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 360 }}>
              <thead><tr style={{ color: C.textLow, fontSize: 10 }}>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 6px', width: 20 }}>#</th>
                <th style={{ textAlign: 'left', fontWeight: 700, padding: '0 0 6px' }}>종목</th>
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 6px' }}>평가액</th>
                <th style={{ textAlign: 'right', fontWeight: 700, padding: '0 0 6px' }}>해외포트 비중</th>
              </tr></thead>
              <tbody style={{ fontFamily: 'monospace' }}>
                {data.overseas.map((h, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ color: C.textLow, padding: '7px 4px', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ textAlign: 'left', padding: '7px 4px', fontSize: 12, fontWeight: 800, color: C.text, fontFamily: FONT }}>{h.name.length > 24 ? h.name.slice(0, 23) + '…' : h.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: C.text, padding: '7px 4px' }}>{usd(h.value)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: h.weight >= 3 ? C.cyan : C.textSub, padding: '7px 4px' }}>{h.weight.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 정직성 안내 */}
      <div style={{ padding: '10px 13px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${C.gold}`, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.7 }}>
          ⚠️ <b>&lsquo;공시後 주가&rsquo;는 국민연금의 실제 수익률이 아닙니다.</b> 국민연금은 종목별 매입단가를 공개하지 않아 정확한 수익률은 계산할 수 없어, <b>마지막 지분 신고일 이후 주가 변화</b>를 참고용으로 보여줍니다.
        </div>
      </div>
      <div style={{ fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        🏛️ 국내주식=DART 대량보유(5%룰) · 해외주식=SEC 13F-HR(미국 의무공시) · 자산배분 비중=국민연금 공시 기준 참고치 · 평가액=보유수×현재가 · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
    </>,
    `${C.cyan}55`
  )
}
