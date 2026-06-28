'use client'
// 비트코인 레인보우 차트(로그 회귀 9밴드) — 코인랩 ₿ 뷰. 저평가 바닥(파랑)→과열 천장(빨강) 색대 + 현재 위치
import { useState } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip } from 'recharts'
import type { CoinLabResult } from '@/app/api/coin-lab/route'

const CARD = '#12151c', BORDER = '#252a36'

export default function BtcRainbowChart({ rainbow }: { rainbow: NonNullable<CoinLabResult['rainbow']> }) {
  const { points, bands, current } = rainbow
  const [eduOpen, setEduOpen] = useState(false)

  // 로그 Y축 도메인·눈금
  const lows  = points.map(p => Number(p.b0))
  const highs = points.map(p => Number(p.b8))
  const prices = points.map(p => Number(p.price))
  const yMin = Math.max(1, Math.min(...lows, ...prices) * 0.85)
  const yMax = Math.max(...highs, ...prices) * 1.08
  const ticks = [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000].filter(t => t >= yMin && t <= yMax)

  // X축: 연도당 첫 포인트만 눈금으로(격주 데이터의 연도 중복 표시 방지)
  const yearTicks: string[] = (() => {
    const seen = new Set<string>(); const out: string[] = []
    for (const p of points) { const y = String(p.date).slice(0, 4); if (!seen.has(y)) { seen.add(y); out.push(String(p.date)) } }
    return out
  })()

  // 현재 위치 해석
  const mult = current?.mult ?? 1
  const valuationText = mult >= 1
    ? `회귀선(공정가) 대비 약 ${mult}배 — 평균보다 비싼 영역`
    : `회귀선(공정가) 대비 약 ${mult}배 — 평균보다 싼 영역`

  return (
    <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>🌈 비트코인 레인보우 차트</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>로그 회귀 9밴드 · 파랑(저평가·축적) → 빨강(과열·버블) · 흰선 = 실제 가격</span>
      </div>

      {/* 현재 위치 배너 */}
      {current && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: `${current.color}22`, border: `1px solid ${current.color}66`, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: current.color, flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>현재 구간: {current.label}</span>
          <span style={{ color: '#aab6c4', fontSize: 11 }}>{valuationText}</span>
        </div>
      )}

      <div style={{ height: 460 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 14, left: 2, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#7f93a8', fontSize: 9.5 }} tickFormatter={(s: string) => String(s).slice(0, 4)}
              ticks={yearTicks} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis scale="log" domain={[yMin, yMax]} ticks={ticks} allowDataOverflow tick={{ fill: '#7f93a8', fontSize: 9.5 }}
              axisLine={false} tickLine={false} width={52}
              tickFormatter={(v: number) => v >= 1000000 ? `$${v / 1e6}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`} />
            {/* 밴드: 위(빨강·큰값)부터 그려 아래(파랑·작은값)가 덮어쓰며 색대 형성 */}
            {[8, 7, 6, 5, 4, 3, 2, 1, 0].map(i => (
              <Area key={i} type="monotone" dataKey={`b${i}`} baseValue={yMin}
                stroke="none" fill={bands[i].color} fillOpacity={1} isAnimationActive={false} />
            ))}
            <Line type="monotone" dataKey="price" name="BTC" stroke="#ffffff" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Tooltip contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#8a9aaa' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, n: any) => n === 'BTC' ? [`$${Number(v).toLocaleString()}`, 'BTC 가격'] : null} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 밴드 범례 (천장→바닥) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {bands.map((b, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, padding: '3px 8px', borderRadius: 6,
            background: current && current.index === i ? `${b.color}33` : 'transparent',
            border: current && current.index === i ? `1px solid ${b.color}` : '1px solid transparent',
            color: current && current.index === i ? '#e2e8f0' : '#9aa0b8', fontWeight: current && current.index === i ? 800 : 500 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: b.color }} />{b.label}
          </span>
        )).reverse()}
      </div>

      {/* 🎓 교육 + 정직성 캐비엇 */}
      <button onClick={() => setEduOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 0 2px', textAlign: 'left' }}>
        <span style={{ color: '#f7931a', fontWeight: 800, fontSize: 12 }}>🎓 레인보우 차트란?</span>
        <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>로그 회귀로 &lsquo;싸다/비싸다&rsquo;를 색으로</span>
        <span style={{ marginLeft: 'auto', color: '#8a9aaa', fontSize: 11 }}>{eduOpen ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {eduOpen && (
        <div style={{ color: '#aab6c4', fontSize: 11, lineHeight: 1.65, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>📐 <b style={{ color: '#93c5fd' }}>원리</b> — 비트코인의 장기 가격을 <b>로그 회귀선</b>(시간의 로그에 비례해 우상향하는 추세선)에 맞추고, 그 위아래로 표준편차만큼 색띠를 두른 것입니다. 가격이 <b style={{ color: '#2f7fd1' }}>아래쪽 파란 띠</b>에 있으면 역사적으로 저평가(축적 구간), <b style={{ color: '#e0382f' }}>위쪽 빨간 띠</b>면 과열(버블 경계)이었습니다.</div>
          <div>🧭 <b style={{ color: '#f7931a' }}>읽는 법</b> — 정밀한 매수·매도 신호가 아니라 &lsquo;지금 사이클에서 대략 어디쯤인가&rsquo;를 보는 <b>심리 온도계</b>입니다. 반감기 사이클(패널 ①)·메이어 멀티플과 함께 보세요.</div>
          <div style={{ color: '#8a9aaa' }}>⚠️ <b>정직한 한계</b> — 회귀선은 <b>과거 추세의 외삽</b>이라 미래를 보장하지 않습니다. 적합에 쓰인 데이터 구간(여기선 Yahoo 10년 주봉)에 따라 띠 위치가 달라지며, 시장 구조가 바뀌면(채택 성숙·변동성 감소) 기울기도 변합니다. 교육용 참고 지표일 뿐입니다.</div>
        </div>
      )}
    </div>
  )
}
