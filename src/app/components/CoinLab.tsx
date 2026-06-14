'use client'
// 🪙 코인 랩 — 비트코인 독립 분석(사이클·심리·온체인·유동성 + 김치프리미엄 + 국면×리스크 처방)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import type { CoinLabResult } from '@/app/api/coin-lab/route'
import AltcoinNetworkChart from '@/app/components/AltcoinNetworkChart'

const CARD = '#161b25', BORDER = '#1e293b'
const fmtUsd = (n: number | null) => n == null ? '—' : `$${Math.round(n).toLocaleString()}`
const fmtKrw = (n: number | null) => n == null ? '—' : `₩${Math.round(n).toLocaleString()}`

// 공포·탐욕 색
const fngColor = (v: number | null) => v == null ? '#94a3b8' : v <= 25 ? '#22c55e' : v <= 45 ? '#a3e635' : v <= 55 ? '#fbbf24' : v <= 75 ? '#fb923c' : '#ef4444'
const fngKo = (v: number | null) => v == null ? '—' : v <= 25 ? '극공포' : v <= 45 ? '공포' : v <= 55 ? '중립' : v <= 75 ? '탐욕' : '극탐욕'

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 360px', minWidth: 300, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>{title}</span>
        {sub && <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

export default function CoinLab({ myCryptoPct }: { myCryptoPct?: number }) {
  const [d, setD] = useState<CoinLabResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'btc' | 'alt'>('btc')   // 비트코인(디지털 금) ↔ 알트코인(네트워크 자산) 분리

  useEffect(() => {
    let alive = true
    fetch('/api/coin-lab', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🪙 코인 랩 — 사이클·심리·온체인·유동성 데이터를 모으는 중…</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>코인 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>

  const toneColor = d.prescription.tone === 'accumulate' ? '#22c55e' : d.prescription.tone === 'caution' ? '#ef4444' : '#fbbf24'
  const overWeight = myCryptoPct != null && myCryptoPct > 5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(247,147,26,0.12),rgba(168,85,247,0.06))', border: '1px solid rgba(247,147,26,0.35)', borderRadius: 12, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>🪙</span>
          <span style={{ color: '#f7931a', fontWeight: 800, fontSize: 16 }}>코인 랩</span>
          <span style={{ color: '#8a9aaa', fontSize: 12 }}>이익(EPS)이 없는 자산 — 사이클·심리·네트워크·유동성으로 본다</span>
          {view === 'btc' && (
            <span style={{ marginLeft: 'auto', color: '#cbd5e1', fontFamily: 'monospace', fontSize: 13 }}>
              BTC {fmtUsd(d.price.usd)} {d.price.krw != null && <span style={{ color: '#8a9aaa' }}>· {fmtKrw(d.price.krw)}</span>}
            </span>
          )}
        </div>
        {/* ₿ 비트코인(디지털 금) ↔ 🔷 알트코인(네트워크 자산) — 성격이 다른 자산이라 분리 */}
        <div style={{ display: 'inline-flex', gap: 4, background: '#0f1117', padding: 4, borderRadius: 9, border: `1px solid ${BORDER}`, marginTop: 10 }}>
          {([['btc', '₿ 비트코인', '#f7931a'], ['alt', '🔷 알트코인 (ETH·SOL·XRP)', '#627eea']] as const).map(([k, label, c]) => (
            <button key={k} type="button" onClick={() => setView(k)}
              style={{ padding: '5px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                background: view === k ? '#1e293b' : 'transparent', color: view === k ? c : '#8599ae' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 🛡️ 가드레일 — 항상 최상단(학생 보호) */}
      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 11.5, lineHeight: 1.7 }}>
        {d.guardrailNote}
        {myCryptoPct != null && (
          <div style={{ marginTop: 4, color: overWeight ? '#f87171' : '#86efac', fontWeight: 700 }}>
            {overWeight
              ? `🚨 현재 내 포트폴리오의 코인 비중 ${myCryptoPct}% — 권장 상한 5%를 초과했습니다. 비중 축소를 고려하세요.`
              : `✅ 현재 내 코인 비중 ${myCryptoPct}% — 권장 상한(5%) 이내입니다.`}
          </div>
        )}
      </div>

      {/* 🔷 알트코인 뷰 */}
      {view === 'alt' && <AltcoinNetworkChart />}

      {view === 'btc' && (<>
      {/* 🎓 국면×리스크 처방 */}
      <div style={{ background: `${toneColor}12`, border: `1px solid ${toneColor}44`, borderRadius: 12, padding: '12px 15px' }}>
        <div style={{ color: toneColor, fontWeight: 800, fontSize: 12.5, marginBottom: 4 }}>🤖 자비스 크립토 처방 — {d.prescription.regime}</div>
        <div style={{ color: '#dbe3ec', fontSize: 12, lineHeight: 1.75 }}>{d.prescription.text}</div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* ① 반감기 사이클 나침반 */}
        <Panel title="① 반감기 사이클 나침반" sub={`4차 반감기(${d.cycle.halving}) 이후 ${d.cycle.daysSince}일차`}>
          <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{d.cycle.phase}</div>
          <div style={{ position: 'relative', height: 9, background: '#0f1117', borderRadius: 5, overflow: 'hidden', border: `1px solid ${BORDER}`, margin: '8px 0' }}>
            <div style={{ width: `${d.cycle.cyclePct}%`, height: '100%', background: 'linear-gradient(90deg,#22c55e,#fbbf24,#ef4444)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6e7f8f' }}><span>반감기</span><span>다음 반감기(~4년)</span></div>
          <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.6, marginTop: 8 }}>{d.cycle.phaseDesc}</div>
          {d.price.mayer != null && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: '#aab6c4' }}>
              📐 <b>메이어 멀티플 {d.price.mayer}</b> (가격÷200일 이평 {fmtUsd(d.price.ma200)}) — <span style={{ color: d.price.mayer > 2.4 ? '#ef4444' : d.price.mayer < 1 ? '#22c55e' : '#fbbf24' }}>{d.price.mayer > 2.4 ? '과열(>2.4)' : d.price.mayer < 1 ? '저평가(<1.0)' : '중립'}</span>
              <div style={{ color: '#6e7f8f', fontSize: 9.5, marginTop: 2 }}>※ 유료 MVRV 대신 무료 계산 가능한 메이어 멀티플로 거품도 측정</div>
            </div>
          )}
        </Panel>

        {/* ② 공포·탐욕 + 도미넌스 */}
        <Panel title="② 공포·탐욕 + 도미넌스" sub="대중 심리 역이용">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: fngColor(d.sentiment.fng), fontWeight: 900, fontSize: 30, fontFamily: 'monospace', lineHeight: 1 }}>{d.sentiment.fng ?? '—'}</div>
              <div style={{ color: fngColor(d.sentiment.fng), fontWeight: 800, fontSize: 12 }}>{fngKo(d.sentiment.fng)}</div>
              <div style={{ color: '#6e7f8f', fontSize: 9.5 }}>어제 {d.sentiment.fngYesterday ?? '—'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#22c55e,#a3e635,#fbbf24,#fb923c,#ef4444)' }}>
                {d.sentiment.fng != null && <div style={{ position: 'absolute', left: `calc(${d.sentiment.fng}% - 2px)`, top: -3, width: 4, height: 14, background: '#fff', borderRadius: 2 }} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6e7f8f', marginTop: 3 }}><span>0 극공포</span><span>극탐욕 100</span></div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#aab6c4', lineHeight: 1.5 }}>
                BTC 도미넌스 <b style={{ color: '#f7931a' }}>{d.sentiment.btcDom ?? '—'}%</b> · ETH <b style={{ color: '#60a5fa' }}>{d.sentiment.ethDom ?? '—'}%</b>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10.5, color: '#9aa7b5', lineHeight: 1.6 }}>{d.sentiment.altHint} · &ldquo;탐욕에 팔고 공포에 사라&rdquo;</div>
        </Panel>

        {/* ③ 시장 개요 */}
        <Panel title="③ 시장 개요" sub={`전체 시총 $${d.market.totalMcapUsdT ?? '—'}T · 스테이블 ${d.market.stablecoinPct ?? '—'}%(대기자금)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.market.top.slice(0, 6).map((c, i) => (
              <div key={c.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '2px 0', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                <span style={{ color: '#6e7f8f', width: 14 }}>{i + 1}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, width: 48 }}>{c.symbol}</span>
                <span style={{ color: '#8a9aaa', fontFamily: 'monospace' }}>{c.price >= 1 ? `$${c.price.toLocaleString()}` : `$${c.price}`}</span>
                <span style={{ marginLeft: 'auto', color: (c.ch24 ?? 0) >= 0 ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>{c.ch24 != null ? `${c.ch24 >= 0 ? '+' : ''}${c.ch24.toFixed(1)}%` : '—'}</span>
                <span style={{ color: '#6e7f8f', fontSize: 9.5, width: 56, textAlign: 'right' }}>${c.mcapB}B</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ④ 네트워크 건강 */}
        <Panel title="④ 네트워크 건강(온체인)" sub="비트코인 = 기업 아닌 네트워크">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>{d.network.hashrateEH ?? '—'}</span>
            <span style={{ color: '#8a9aaa', fontSize: 11 }}>EH/s 해시레이트</span>
            <span style={{ color: d.network.trend === 'up' ? '#22c55e' : d.network.trend === 'down' ? '#ef4444' : '#94a3b8', fontSize: 12, fontWeight: 700 }}>
              {d.network.trend === 'up' ? '▲ 강화' : d.network.trend === 'down' ? '▼ 약화' : '— 유지'}
            </span>
          </div>
          {d.network.spark.length > 1 && (() => {
            const W = 300, H = 40, mn = Math.min(...d.network.spark), mx = Math.max(...d.network.spark), rg = mx - mn || 1
            const pts = d.network.spark.map((v, i) => `${(i / (d.network.spark.length - 1)) * W},${H - 2 - ((v - mn) / rg) * (H - 4)}`).join(' ')
            return <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 40, marginTop: 6 }}><polyline points={pts} fill="none" stroke="#f7931a" strokeWidth={1.6} /></svg>
          })()}
          <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.6, marginTop: 6 }}>
            난이도 {d.network.difficultyT ?? '—'}T · 해시레이트는 네트워크 보안의 척도입니다. <b>가격이 빠져도 해시레이트가 오르면 &ldquo;네트워크는 더 튼튼해지는 중&rdquo;</b> — 코인의 펀더멘탈.
          </div>
        </Panel>
      </div>

      {/* ⑤ 거시 유동성(M2) vs BTC */}
      {d.macro.points.length >= 3 && (
        <Panel title="⑤ 글로벌 유동성(M2) vs 비트코인" sub="100 기준 정규화 · 최근 약 1년">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.macro.points} margin={{ top: 6, right: 10, left: -14, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9.5 }} tickFormatter={(m: string) => m.slice(2)} axisLine={{ stroke: BORDER }} tickLine={false} />
                <YAxis tick={{ fill: '#7f93a8', fontSize: 9.5 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line name="미국 M2 통화량" dataKey="m2" stroke="#22d3ee" strokeWidth={1.8} dot={false} connectNulls />
                <Line name="비트코인" dataKey="btc" stroke="#f7931a" strokeWidth={2.2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ color: '#9aa7b5', fontSize: 10.5, lineHeight: 1.6, marginTop: 6 }}>{d.macro.note}</div>
        </Panel>
      )}

      {/* ⑥ 김치 프리미엄 */}
      {d.price.kimchiPct != null && (
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>🇰🇷</span>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>김치 프리미엄</span>
          <span style={{ color: d.price.kimchiPct >= 3 ? '#ef4444' : d.price.kimchiPct <= -1 ? '#22c55e' : '#fbbf24', fontWeight: 900, fontSize: 20, fontFamily: 'monospace' }}>
            {d.price.kimchiPct >= 0 ? '+' : ''}{d.price.kimchiPct}%
          </span>
          <span style={{ color: '#9aa7b5', fontSize: 11, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
            업비트(KRW) vs 글로벌(USD) 가격차. {d.price.kimchiPct >= 3 ? '국내 과열·투기 수요 신호(고플 때 신규 진입 주의).' : d.price.kimchiPct <= -1 ? '역프리미엄 — 국내 수요 위축.' : '정상 범위.'}
          </span>
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 데이터: CoinGecko·alternative.me(공포탐욕)·mempool.space(해시레이트)·업비트(KRW)·FRED(M2) — 전부 무료 공개 API · 1h 캐시 · 메이어 멀티플은 유료 MVRV의 무료 대체 지표 · 비트코인은 주식과 달리 EPS·PER이 없어 사이클·심리·네트워크로 분석합니다 · 교육용이며 투자 추천이 아닙니다.
      </div>
      </>)}
    </div>
  )
}
