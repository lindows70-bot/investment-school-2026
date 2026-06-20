'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
// 코인 관련 주식 패널 — BTC 베타(레버리지)와 본업 가치로 코인주식을 평가하는 교육 시각화
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts'
import type { CryptoStocksResult } from '@/app/api/crypto-stocks/route'

const CARD = '#161b25', BORDER = '#1e293b'

function BetaGauge({ beta, color }: { beta: number | null; color: string }) {
  if (beta == null) return <span style={{ color: '#8a9aaa', fontSize: 12 }}>—</span>
  const pct = Math.min(Math.max((beta / 3) * 100, 0), 100)
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: '#8a9aaa', fontSize: 10 }}>BTC 베타</span>
        <span style={{ color, fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{beta}</span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: beta >= 1.5 ? '#ef4444' : beta >= 0.7 ? color : '#64748b', borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
        <span style={{ color: '#475569', fontSize: 9 }}>0 (무관)</span>
        <span style={{ color: '#475569', fontSize: 9 }}>1 (동일)</span>
        <span style={{ color: '#475569', fontSize: 9 }}>3 (3배)</span>
      </div>
    </div>
  )
}

function ReturnBadge({ val, label }: { val: number | null; label: string }) {
  if (val == null) return null
  const c = val >= 0 ? '#22c55e' : '#ef4444'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <span style={{ color: '#8a9aaa', fontSize: 11 }}>{label}</span>
      <span style={{ color: c, fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{val > 0 ? '+' : ''}{val}%</span>
    </div>
  )
}

export default function CryptoStocksPanel() {
  const [d, setD] = useState<CryptoStocksResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStock, setActiveStock] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/crypto-stocks', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return (
    <div style={{ background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>
      🏢 코인 관련 주식 데이터를 수집하는 중…
    </div>
  )
  if (!d) return (
    <div style={{ background: CARD, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>
      코인 주식 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.
    </div>
  )

  // 오버레이 차트: 모든 종목 + BTC 정규화 데이터를 날짜 기준 병합
  const dateSet = new Set<string>()
  d.btcPoints.forEach(p => dateSet.add(p.date))
  d.stocks.forEach(s => s.points.forEach(p => dateSet.add(p.date)))
  const dates = Array.from(dateSet).sort()
  const btcMap = new Map(d.btcPoints.map(p => [p.date, p.norm]))
  const stockMaps = d.stocks.map(s => new Map(s.points.map(p => [p.date, p.norm])))
  const chartData = dates.map(date => {
    const row: Record<string, number | string> = { date }
    row['BTC'] = btcMap.get(date) ?? NaN
    d.stocks.forEach((s, i) => { row[s.symbol] = stockMaps[i].get(date) ?? NaN })
    return row
  })

  // 종목별 마지막 유효(NaN 아님) 데이터 인덱스 — 끝점 라벨을 정확한 위치에 찍기 위함
  const lastIdx = (key: string) => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      const v = chartData[i][key]
      if (typeof v === 'number' && isFinite(v)) return i
    }
    return -1
  }
  const endIdx: Record<string, number> = { BTC: lastIdx('BTC') }
  d.stocks.forEach(s => { endIdx[s.symbol] = lastIdx(s.symbol) })

  // 끝값이 가까운 라벨끼리 세로로 겹치지 않게 dy 오프셋 — 화면 y는 값이 클수록 위쪽
  const endVals = [{ key: 'BTC', v: d.btcPoints[d.btcPoints.length - 1]?.norm ?? 0 },
    ...d.stocks.map(s => ({ key: s.symbol, v: s.points[s.points.length - 1]?.norm ?? 0 }))]
    .sort((a, b) => b.v - a.v)   // 값 큰 순(화면 위→아래)
  const labelDy: Record<string, number> = {}
  endVals.forEach((e, i) => {
    if (i > 0 && Math.abs(e.v - endVals[i - 1].v) < 6) labelDy[e.key] = (labelDy[endVals[i - 1].key] ?? 0) + 11
    else labelDy[e.key] = 0
  })

  const selectedTip = activeStock
    ? d.stocks.find(s => s.symbol === activeStock)?.jarvisTip
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 교육 설명 */}
      <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 14px', color: '#fde68a', fontSize: 11.5, lineHeight: 1.7 }}>
        🏢 <b>코인 관련 주식 평가 프레임</b> — 두 가지 질문으로 봅니다.
        <br />① <b>BTC 베타</b>: &quot;이 주식이 BTC 1% 오를 때 몇 % 움직이나?&quot; — 베타 2.0 = BTC의 2배 레버리지.
        <br />② <b>본업 가치</b>: &quot;BTC를 빼면 뭘로 돈 버나?&quot; — 거래소 수수료 / 채굴 스프레드 / 스테이블 이자 / 리테일 플랫폼.
        <br /><span style={{ color: '#fbbf24', fontSize: 10.5 }}>※ 1년 주봉 수익률 기준. 단기 급등락 구간엔 베타가 왜곡될 수 있어 장기 추세 참고용으로만 쓰세요.</span>
      </div>

      {/* 정규화 오버레이 차트 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📈 1년 수익률 오버레이</span>
          <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>첫 주=100 기준 정규화(점선=원금 100) · 오른쪽 수치=1년 누적수익률 · 종목 클릭 시 자비스 해설</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 56, bottom: 0, left: -10 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={d => d.slice(5)} interval={7} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}`} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, fontSize: 10.5, padding: '6px 10px' }}
              formatter={((v: number, name: string) => [`${v - 100 > 0 ? '+' : ''}${(v - 100).toFixed(1)}%`, name]) as any}
              labelFormatter={l => l as string}
            />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 3" />
            <Line dataKey="BTC" stroke="#f7931a" strokeWidth={2} connectNulls
              dot={(props: any) => {
                if (props.index !== endIdx.BTC) return <g key={props.index} />
                const r = Math.round(props.value - 100)
                return <text key={props.index} x={props.cx + 5} y={props.cy + 3 + (labelDy.BTC ?? 0)} fill="#f7931a" fontSize={9.5} fontFamily="monospace" fontWeight={700}>{r > 0 ? '+' : ''}{r}%</text>
              }} />
            {d.stocks.map(s => (
              <Line key={s.symbol} dataKey={s.symbol} stroke={s.color}
                strokeWidth={activeStock === s.symbol ? 3 : 1.5}
                strokeOpacity={activeStock && activeStock !== s.symbol ? 0.3 : 1}
                connectNulls
                dot={(props: any) => {
                  if (props.index !== endIdx[s.symbol]) return <g key={props.index} />
                  const r = Math.round(props.value - 100)
                  return <text key={props.index} x={props.cx + 5} y={props.cy + 3 + (labelDy[s.symbol] ?? 0)} fill={s.color} fontSize={9.5} fontFamily="monospace" fontWeight={700}>{r > 0 ? '+' : ''}{r}%</text>
                }} />
            ))}
            <Legend wrapperStyle={{ fontSize: 10.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 종목 카드 그리드 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {d.stocks.map(s => (
          <div key={s.symbol} onClick={() => setActiveStock(activeStock === s.symbol ? null : s.symbol)}
            style={{ flex: '1 1 180px', minWidth: 170, background: CARD, borderRadius: 10,
              border: `1px solid ${activeStock === s.symbol ? s.color : BORDER}`,
              padding: '11px 13px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ background: s.color + '22', color: s.color, borderRadius: 5, padding: '1px 6px', fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{s.symbol}</span>
              <span style={{ color: '#94a3b8', fontSize: 10 }}>{s.tagline}</span>
            </div>
            <div style={{ color: '#cbd5e1', fontWeight: 700, fontSize: 11.5, marginBottom: 6 }}>{s.name}</div>
            <BetaGauge beta={s.btcBeta} color={s.color} />
            <div style={{ marginTop: 7, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
              <ReturnBadge val={s.return1y} label="1년 수익률" />
              <ReturnBadge val={d.btcReturn1y} label="BTC 1년" />
              {s.btcCorr != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#8a9aaa', fontSize: 11 }}>BTC 상관</span>
                  <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>{s.btcCorr}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 자비스 해설 (종목 선택 시) */}
      {selectedTip && (
        <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, padding: '10px 14px', color: '#bfdbfe', fontSize: 12, lineHeight: 1.7 }}>
          🤖 <b>자비스 해설 — {activeStock}</b>
          <br />{selectedTip}
        </div>
      )}

      {/* 비즈니스 모델 설명 */}
      <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '11px 14px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 12, marginBottom: 8 }}>🔍 비즈니스 모델 — &quot;BTC를 빼면 뭘로 돈 버나&quot;</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {d.stocks.map(s => (
            <div key={s.symbol} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: s.color, fontWeight: 800, fontFamily: 'monospace', fontSize: 11, minWidth: 38 }}>{s.symbol}</span>
              <span style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6 }}>{s.model}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 데이터: Yahoo Finance(1년 주봉, 무료) · 베타 = Cov(종목수익률, BTC수익률) / Var(BTC수익률) · 6h 캐시 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
