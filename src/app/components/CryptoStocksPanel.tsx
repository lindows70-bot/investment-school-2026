'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
// 코인 관련 주식 패널 — BTC 베타(레버리지)와 본업 가치로 코인주식을 평가하는 교육 시각화
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts'
import type { CryptoStocksResult } from '@/app/api/crypto-stocks/route'

const CARD = '#161b25', BORDER = '#1e293b'

function BetaGauge({ beta, color, label = 'BTC 베타' }: { beta: number | null; color: string; label?: string }) {
  if (beta == null) return <span style={{ color: '#8a9aaa', fontSize: 12 }}>—</span>
  const pct = Math.min(Math.max((beta / 3) * 100, 0), 100)
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: '#8a9aaa', fontSize: 10 }}>{label}</span>
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

const TREND: Record<string, { t: string; c: string }> = {
  up: { t: '🟢 상승추세', c: '#22c55e' }, side: { t: '🟡 횡보', c: '#f59e0b' },
  down: { t: '🔴 하락추세', c: '#ef4444' }, unknown: { t: '— 데이터부족', c: '#64748b' },
}

export default function CryptoStocksPanel() {
  const [d, setD] = useState<CryptoStocksResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStock, setActiveStock] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())   // 범례 클릭으로 라인 켜고 끄기
  const toggleLine = (key: string) => setHidden(prev => {
    const n = new Set(prev)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  })

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

  // 오버레이 차트: 모든 종목 + BTC·ETH 벤치마크 정규화 데이터를 날짜 기준 병합
  const dateSet = new Set<string>()
  d.btcPoints.forEach(p => dateSet.add(p.date))
  d.ethPoints.forEach(p => dateSet.add(p.date))
  d.stocks.forEach(s => s.points.forEach(p => dateSet.add(p.date)))
  const dates = Array.from(dateSet).sort()
  const btcMap = new Map(d.btcPoints.map(p => [p.date, p.norm]))
  const ethMap = new Map(d.ethPoints.map(p => [p.date, p.norm]))
  const stockMaps = d.stocks.map(s => new Map(s.points.map(p => [p.date, p.norm])))
  const chartData = dates.map(date => {
    const row: Record<string, number | string> = { date }
    row['BTC'] = btcMap.get(date) ?? NaN
    row['ETH'] = ethMap.get(date) ?? NaN
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
  const endIdx: Record<string, number> = { BTC: lastIdx('BTC'), ETH: lastIdx('ETH') }
  d.stocks.forEach(s => { endIdx[s.symbol] = lastIdx(s.symbol) })

  // 📊 로그 스케일 — BMNR(연중 30배 급등) 같은 극단 변동성이 Y축을 독점해 나머지가 바닥에 깔리는 문제 해결
  //    정규화 지수(첫주=100)는 항상 양수라 로그 적용 가능. 같은 '비율 변화'가 같은 '세로 거리'로 보여 비교가 공정해짐
  const allNorm = [...d.btcPoints.map(p => p.norm), ...d.ethPoints.map(p => p.norm), ...d.stocks.flatMap(s => s.points.map(p => p.norm))].filter(v => v > 0)
  const minN = allNorm.length ? Math.min(...allNorm) : 50
  const maxN = allNorm.length ? Math.max(...allNorm) : 200
  const logTicks = [3, 10, 30, 100, 300, 1000, 3000, 10000].filter(t => t >= minN * 0.85 && t <= maxN * 1.15)
  const yDomain: [number, number] = [Math.max(1, minN * 0.9), maxN * 1.1]

  // 끝값이 가까운 라벨끼리 세로로 겹치지 않게 dy 오프셋 — 로그축이라 '비율(로그 거리)'로 근접 판정
  const endVals = [{ key: 'BTC', v: d.btcPoints[d.btcPoints.length - 1]?.norm ?? 0 },
    { key: 'ETH', v: d.ethPoints[d.ethPoints.length - 1]?.norm ?? 0 },
    ...d.stocks.map(s => ({ key: s.symbol, v: s.points[s.points.length - 1]?.norm ?? 0 }))]
    .sort((a, b) => b.v - a.v)   // 값 큰 순(화면 위→아래)
  const labelDy: Record<string, number> = {}
  endVals.forEach((e, i) => {
    if (i > 0 && Math.abs(Math.log(e.v || 1) - Math.log(endVals[i - 1].v || 1)) < 0.07) labelDy[e.key] = (labelDy[endVals[i - 1].key] ?? 0) + 11
    else labelDy[e.key] = 0
  })

  const selected = activeStock ? d.stocks.find(s => s.symbol === activeStock) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 교육 설명 */}
      <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 14px', color: '#fde68a', fontSize: 11.5, lineHeight: 1.7 }}>
        🏢 <b>코인 관련 주식 평가 프레임</b> — 두 가지 질문으로 봅니다.
        <br />① <b>코인 베타</b>: &quot;기준 코인이 1% 오를 때 몇 % 움직이나?&quot; — 베타 2.0 = 2배 레버리지. <span style={{ color: '#fbbf24' }}>기준 코인은 사업에 맞춤 — BTC 트레저리·거래소는 <b>BTC</b>, ETH 트레저리(비트마인)는 <b>ETH</b>.</span>
        <br />② <b>본업 가치</b>: &quot;코인을 빼면 뭘로 돈 버나?&quot; — 거래소 수수료 / 채굴 스프레드 / 스테이블 이자 / 리테일 플랫폼.
        <br />③ <b>매매 타이밍</b>: 카드의 추세(🟢상승/🟡횡보/🔴하락)와 52주 위치로 추격·눌림·바닥을 가늠 — 떨어지는 칼날은 추격 금물.
        <br /><span style={{ color: '#fbbf24', fontSize: 10.5 }}>※ 1년 주봉 수익률 기준 · 차트의 점선=BTC·ETH 벤치마크. 단기 급등락 구간엔 베타가 왜곡될 수 있어 장기 추세 참고용으로만 쓰세요.</span>
      </div>

      {/* 정규화 오버레이 차트 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>📈 1년 수익률 오버레이</span>
          <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>첫 주=100 정규화 · <b style={{ color: '#a8b5c2' }}>로그 스케일</b> · 점선=BTC·ETH 벤치마크 · 오른쪽 수치=1년 누적수익률 · <b style={{ color: '#fbbf24' }}>범례 클릭으로 라인 켜고 끄기</b>(겹쳐 보일 땐 끄고 비교)</span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 4, right: 56, bottom: 0, left: -10 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={d => d.slice(5)} interval={7} />
            <YAxis scale="log" domain={yDomain} ticks={logTicks} allowDataOverflow tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}`} />
            <Tooltip
              contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, fontSize: 10.5, padding: '6px 10px' }}
              formatter={((v: number, name: string) => [`${v - 100 > 0 ? '+' : ''}${(v - 100).toFixed(1)}%`, name]) as any}
              labelFormatter={l => l as string}
            />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="3 3" />
            <Line dataKey="BTC" stroke="#f7931a" strokeWidth={2} strokeDasharray="4 2" connectNulls hide={hidden.has('BTC')}
              dot={(props: any) => {
                if (props.index !== endIdx.BTC) return <g key={props.index} />
                const r = Math.round(props.value - 100)
                return <text key={props.index} x={props.cx + 5} y={props.cy + 3 + (labelDy.BTC ?? 0)} fill="#f7931a" fontSize={9.5} fontFamily="monospace" fontWeight={700}>{r > 0 ? '+' : ''}{r}%</text>
              }} />
            <Line dataKey="ETH" stroke="#627eea" strokeWidth={2} strokeDasharray="4 2" connectNulls hide={hidden.has('ETH')}
              dot={(props: any) => {
                if (props.index !== endIdx.ETH) return <g key={props.index} />
                const r = Math.round(props.value - 100)
                return <text key={props.index} x={props.cx + 5} y={props.cy + 3 + (labelDy.ETH ?? 0)} fill="#627eea" fontSize={9.5} fontFamily="monospace" fontWeight={700}>{r > 0 ? '+' : ''}{r}%</text>
              }} />
            {d.stocks.map(s => (
              <Line key={s.symbol} dataKey={s.symbol} stroke={s.color}
                strokeWidth={activeStock === s.symbol ? 3 : 1.5}
                strokeOpacity={activeStock && activeStock !== s.symbol ? 0.3 : 1}
                connectNulls hide={hidden.has(s.symbol)}
                dot={(props: any) => {
                  if (props.index !== endIdx[s.symbol]) return <g key={props.index} />
                  const r = Math.round(props.value - 100)
                  return <text key={props.index} x={props.cx + 5} y={props.cy + 3 + (labelDy[s.symbol] ?? 0)} fill={s.color} fontSize={9.5} fontFamily="monospace" fontWeight={700}>{r > 0 ? '+' : ''}{r}%</text>
                }} />
            ))}
            <Legend wrapperStyle={{ fontSize: 10.5, cursor: 'pointer' }}
              onClick={(o: any) => toggleLine(String(o?.dataKey ?? o?.value))}
              formatter={(value: string) => <span style={{ color: hidden.has(value) ? '#475569' : '#cbd5e1', textDecoration: hidden.has(value) ? 'line-through' : 'none' }}>{value}</span>} />
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
            <BetaGauge beta={s.beta} color={s.color} label={`${s.benchmark} 베타`} />
            <div style={{ marginTop: 7, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
              <ReturnBadge val={s.return1y} label="1년 수익률" />
              <ReturnBadge val={s.benchmarkReturn1y} label={`${s.benchmark} 1년`} />
              {s.corr != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#8a9aaa', fontSize: 11 }}>{s.benchmark} 상관{Math.abs(s.corr) < 0.3 ? ' ⚠️' : ''}</span>
                  <span style={{ color: Math.abs(s.corr) < 0.3 ? '#f59e0b' : '#94a3b8', fontSize: 11, fontFamily: 'monospace' }} title={Math.abs(s.corr) < 0.3 ? '상관 낮음 — 베타 신뢰도 낮음(주가가 코인과 따로 움직임)' : ''}>{s.corr}</span>
                </div>
              )}
            </div>
            {/* 📉 매매 타이밍 — 추세 + 52주 위치 */}
            <div style={{ marginTop: 7, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: '#8a9aaa', fontSize: 10 }}>매매 타이밍</span>
                <span style={{ color: TREND[s.trend].c, fontWeight: 800, fontSize: 10.5 }}>{TREND[s.trend].t}</span>
              </div>
              {s.pct52w != null && (
                <>
                  <div style={{ position: 'relative', height: 6, background: '#0f1117', borderRadius: 4 }}>
                    <div style={{ position: 'absolute', left: `${s.pct52w}%`, top: -1, bottom: -1, width: 3, background: TREND[s.trend].c, transform: 'translateX(-50%)', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
                    <span style={{ color: '#475569', fontSize: 9 }}>52주 저점</span>
                    <span style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }}>{s.pct52w}%</span>
                    <span style={{ color: '#475569', fontSize: 9 }}>고점</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 자비스 해설 (종목 선택 시) — 베타 + 매매 타이밍 */}
      {selected && (
        <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, padding: '10px 14px', color: '#bfdbfe', fontSize: 12, lineHeight: 1.7 }}>
          🤖 <b>자비스 해설 — {selected.name}({activeStock})</b>
          <br />{selected.jarvisTip}
          <br /><span style={{ color: '#fde68a' }}>⏱️ {selected.timingTip}</span>
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
        ※ 데이터: Yahoo Finance(1년 주봉, 무료) · 베타 = Cov(종목수익률, 기준코인수익률) / Var(기준코인수익률) · 기준코인: BTC(트레저리·거래소)·ETH(이더리움 트레저리) · 6h 캐시 · 교육용이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
