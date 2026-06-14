'use client'
// 🔷 메이저 알트코인 네트워크 분석 — 가격 vs 네트워크 펀더멘탈(TVL/거래량) 이중축 오버레이 + 자비스 처방
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import type { AltcoinsResult, AltCoin } from '@/app/api/altcoins/route'

const CARD = '#161b25', BORDER = '#1e293b'
const SYM_COLOR: Record<string, string> = { ETH: '#627eea', SOL: '#14f195', XRP: '#23a8c8' }
const DIV_META: Record<AltCoin['divergence'], { c: string; label: string }> = {
  hype:    { c: '#ef4444', label: '투기 프리미엄 의심' },
  healthy: { c: '#22c55e', label: '펀더멘탈 동반 성장' },
  value:   { c: '#fbbf24', label: '디커플링(저평가 여지)' },
  neutral: { c: '#94a3b8', label: '중립' },
}
const fmtYm = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}`
const fmtP = (n: number) => n >= 100 ? `$${Math.round(n).toLocaleString()}` : `$${n}`

function CoinChart({ c }: { c: AltCoin }) {
  const col = SYM_COLOR[c.symbol] ?? '#a78bfa'
  const dv = DIV_META[c.divergence]
  const hasNet = c.points.some(p => p.net != null)
  // 월별 첫 주 1개만 X축 라벨(주간 포인트라 같은 달 중복 방지)
  const monthTicks: string[] = []
  const seenMonth = new Set<string>()
  for (const p of c.points) { const m = p.date.slice(0, 7); if (!seenMonth.has(m)) { seenMonth.add(m); monthTicks.push(p.date) } }
  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
        <span style={{ color: col, fontWeight: 900, fontSize: 15 }}>{c.symbol}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>{c.name}</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{c.tagline}</span>
        <span style={{ marginLeft: 'auto', color: '#cbd5e1', fontFamily: 'monospace', fontSize: 13 }}>{c.price != null ? fmtP(c.price) : '—'}</span>
        <span style={{ background: `${dv.c}1a`, color: dv.c, border: `1px solid ${dv.c}55`, borderRadius: 999, padding: '1px 9px', fontSize: 10, fontWeight: 800 }}>{dv.label}</span>
      </div>
      <div style={{ color: '#8a9aaa', fontSize: 10.5, marginBottom: 6 }}>
        1년 가격 <b style={{ color: (c.priceChgPct ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>{c.priceChgPct != null ? `${c.priceChgPct >= 0 ? '+' : ''}${c.priceChgPct}%` : '—'}</b>
        {' · '}{c.netLabel} <b style={{ color: (c.netChgPct ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>{c.netChgPct != null ? `${c.netChgPct >= 0 ? '+' : ''}${c.netChgPct}%` : '—'}</b>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={c.points} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1a2035" vertical={false} />
            <XAxis dataKey="date" ticks={monthTicks} tick={{ fill: '#7f93a8', fontSize: 9 }} tickFormatter={fmtYm} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis yAxisId="p" tick={{ fill: '#7f93a8', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={44} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} />
            <YAxis yAxisId="n" orientation="right" tick={{ fill: '#7f93a8', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={40} tickFormatter={(v: number) => `${v}B`} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#8a9aaa' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => name === '가격' ? [fmtP(v), '가격'] : [`$${v}B`, c.netLabel]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {hasNet && <Area yAxisId="n" type="monotone" dataKey="net" name={c.netLabel} stroke={`${col}88`} fill={`${col}1f`} strokeWidth={1.4} connectNulls isAnimationActive={false} />}
            <Line yAxisId="p" type="monotone" dataKey="price" name="가격" stroke={col} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 8, background: `${dv.c}10`, border: `1px solid ${dv.c}33`, borderRadius: 8, padding: '8px 11px', color: '#dbe3ec', fontSize: 11, lineHeight: 1.65 }}>
        🤖 <b style={{ color: dv.c }}>자비스 한줄 처방</b> — {c.jarvisTip}
      </div>
      <div style={{ color: '#6e7f8f', fontSize: 9.5, lineHeight: 1.5, marginTop: 5 }}>{c.desc}</div>
    </div>
  )
}

export default function AltcoinNetworkChart() {
  const [d, setD] = useState<AltcoinsResult | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch('/api/altcoins', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🔷 알트코인 네트워크 데이터(가격·TVL·거래량)를 모으는 중…</div>
  if (!d || d.coins.length === 0) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>알트코인 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(98,126,234,0.12),rgba(20,241,149,0.05))', border: '1px solid rgba(98,126,234,0.35)', borderRadius: 12, padding: '12px 16px' }}>
        <span style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 14 }}>🔷 메이저 알트코인 — 가격 vs 네트워크 펀더멘탈</span>
        <div style={{ color: '#aab6c4', fontSize: 11.5, lineHeight: 1.6, marginTop: 4 }}>
          알트코인은 캔들(가격)만 보면 투기로 흐릅니다. 주가 뒤에 숨은 <b>네트워크의 실적</b>(이더리움·솔라나=예치자본 TVL, 리플=거래량)을 겹쳐 봐야 펀더멘탈이 보입니다 — 코인판 피터 린치.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {d.coins.map(c => <CoinChart key={c.id} c={c} />)}
      </div>
      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 가격·거래량 = CoinGecko · 예치자본(TVL) = DefiLlama — 전부 무료 공개 API · 12h 캐시 · 솔라나는 무료 DAU 이력이 없어 TVL로 네트워크 활성도를 대체 측정 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
