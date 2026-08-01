'use client'
// 📊 시장 폭(Breadth) 레이더 — 유니버스 종목 중 200일선 위 비율·신고/신저·상승비율 (막스 시계추 탭)
//    "지수만 보지 말고 속살을 보라" — 소수 대형주 장세와 진짜 강세장을 구분. ⛔ 점수·추천 미반영(관측 전용).
import { useEffect, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { TK } from '@/lib/theme'
import type { BreadthResult, BreadthMarket } from '@/lib/marketBreadth'

const BAND_META: Record<BreadthMarket['band'], { label: string; icon: string; color: string; desc: string }> = {
  hot: { label: '과열권', icon: '🔥', color: TK.red400, desc: '대부분이 추세 위 — 남은 매수 여력이 적은 구간일 수 있음' },
  healthy: { label: '건강', icon: '🟢', color: TK.green400, desc: '폭넓은 종목이 추세 위 — 지수 상승에 속살이 동행' },
  weak: { label: '약화', icon: '🟡', color: TK.amber400, desc: '절반 이상이 추세 아래 — 지수가 올라도 소수 대형주 장세일 수 있음' },
  washout: { label: '침체·관심', icon: '🧊', color: TK.sky400, desc: '대부분이 추세 아래 — 역사적으로 바닥권에서 나오던 수치(시점 보장은 없음)' },
}

function MarketCard({ d }: { d: BreadthMarket }) {
  const meta = BAND_META[d.band]
  const flag = d.market === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'
  return (
    <div style={{ flex: '1 1 380px', minWidth: 320, background: '#12151f', border: `1px solid ${TK.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 900, color: TK.slate100 }}>{flag}</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: meta.color }}>{d.pctAbove200}%</span>
        <span style={{ fontSize: 11, color: TK.sub2 }}>가 200일선 위</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, background: `${meta.color}18`, borderRadius: 6, padding: '2px 8px' }}>{meta.icon} {meta.label}</span>
        <span style={{ fontSize: 10.5, color: TK.sub3 }}>최근 1년 중 백분위 {d.pctile}%</span>
      </div>
      <div style={{ fontSize: 11, color: TK.sub2, marginTop: 4 }}>{meta.desc}</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <Chip label="50일선 위" value={`${d.pctAbove50}%`} />
        <Chip label="52주 신고가" value={`${d.newHighs}종`} color={TK.green400} />
        <Chip label="52주 신저가" value={`${d.newLows}종`} color={d.newLows > d.newHighs ? TK.red400 : undefined} />
        <Chip label="오늘 상승" value={`${d.advPct}%`} />
        <Chip label="표본" value={`${d.n}종`} />
      </div>

      {d.divergence === 'top' && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: TK.amber400, background: '#2a2213', borderRadius: 8, padding: '7px 10px' }}>
          ⚠️ 상투형 다이버전스 — 지수는 고점권인데 200일선 위 비율은 60거래일 전보다 줄었습니다. 소수 대형주가 지수를 끌고 속은 비어가는 구조(주의 신호이지 매도 지시 아님).
        </div>
      )}
      {d.divergence === 'bottom' && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: TK.green400, background: '#12251a', borderRadius: 8, padding: '7px 10px' }}>
          🌱 바닥형 다이버전스 — 지수는 저점권인데 속살(폭)은 개선 중입니다. 내부에서 먼저 도는 신호일 수 있음(매수 지시 아님).
        </div>
      )}

      <div style={{ height: 200, marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d.series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: TK.sub3 }} tickFormatter={(v: string) => v.slice(2, 7)} minTickGap={45} />
            <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 9, fill: TK.sub3 }} ticks={[0, 25, 45, 75, 100]} />
            <YAxis yAxisId="idx" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: TK.sub3 }} width={38} />
            <Tooltip
              contentStyle={{ background: TK.bg1, border: `1px solid ${TK.border}`, borderRadius: 8, fontSize: 11 }}
              formatter={(v, name) => String(name) === '200일선 위 %' ? [`${v}%`, String(name)] : [String(v), '지수(기준 100)']}
            />
            <ReferenceLine yAxisId="pct" y={75} stroke={TK.red400} strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine yAxisId="pct" y={45} stroke={TK.sub3} strokeDasharray="3 3" strokeOpacity={0.4} />
            <ReferenceLine yAxisId="pct" y={25} stroke={TK.sky400} strokeDasharray="3 3" strokeOpacity={0.5} />
            <Area yAxisId="pct" type="monotone" dataKey="pct200" name="200일선 위 %" stroke={meta.color} fill={meta.color} fillOpacity={0.16} strokeWidth={1.6} dot={false} />
            <Line yAxisId="idx" type="monotone" dataKey="idx" name="지수" stroke={TK.slate300} strokeWidth={1.1} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 9.5, color: TK.sub3, marginTop: 2 }}>실선=200일선 위 종목 비율(좌) · 점선=지수(우·기준 100) — 두 선이 갈라지면 다이버전스</div>
    </div>
  )
}

const Chip = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <span style={{ fontSize: 10.5, background: '#1b2130', borderRadius: 6, padding: '3px 8px', color: TK.sub2 }}>
    {label} <b style={{ color: color ?? TK.slate100 }}>{value}</b>
  </span>
)

export default function MarketBreadthPanel() {
  const [d, setD] = useState<BreadthResult | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    fetch('/api/market-breadth').then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setD(j?.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: '#12151f', border: `1px solid ${TK.border}`, borderRadius: 14, padding: 18, fontSize: 12, color: TK.sub3 }}>📊 시장 폭 집계 중…</div>
  if (!d || (!d.us && !d.kr)) return null

  return (
    <div style={{ background: '#12151f', border: `1px solid ${TK.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: TK.slate100 }}>📊 시장 폭(Breadth) 레이더</span>
        <span style={{ fontSize: 11, color: TK.sub2 }}>지수 말고 속살 — 몇 %의 종목이 실제로 추세 위에 있나</span>
      </div>
      <div style={{ fontSize: 11, color: TK.sub2, marginTop: 4, lineHeight: 1.55 }}>
        시계추(심리·밸류)가 &lsquo;바깥 온도&rsquo;라면 시장 폭은 &lsquo;몸속 체온&rsquo;입니다. 지수가 올라도 200일선 위 종목이 줄면 소수 대형주 장세 — 내 종목이 지수를 못 따라가는 이유가 여기서 보입니다.
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {d.us && <MarketCard d={d.us} />}
        {d.kr && <MarketCard d={d.kr} />}
      </div>
      <div style={{ fontSize: 10, color: TK.sub3, marginTop: 10, lineHeight: 1.5 }}>
        표본 = 추천 유니버스 {d.scanned}종(전 시장 전수 아님) · 신고/신저는 종가 기준 · 백분위는 자기 역사 약 250거래일 · 예측이 아닌 현재 구조 관측 — 매매 판단은 6축(WHAT)·신호등(WHEN)과 함께.
      </div>
    </div>
  )
}
