'use client'

/**
 * 📈 LynchEarningsLineTracer — 린치 이익선 트레이서
 *
 * "주가는 결국 이익의 그림자다. 이익이 오르면 주가는 따라온다." — 피터 린치
 *
 * 역사적 연간 주가 vs 린치 이익선(EPS × 15)의 괴리(Gap)를 추적.
 *  · 주가 < 이익선 → 초록 음영 (바겐세일 구간)
 *  · 주가 > 이익선 → 빨간 음영 (고평가 과열 구간)
 *  · 대각선 사선이 없는 순수 가치 vs 이익 비교
 *
 * 데이터: /api/lynch-earnings-tracer (기존 financials 재사용·48h 캐시)
 * 스타일: 기존 다크 테마 C 토큰 · WCAG AA · Recharts ComposedChart
 */

import { useState, useCallback } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { TracerResult, TracerPoint } from '@/app/api/lynch-earnings-tracer/route'
import { TK } from '@/lib/theme'

// ── 색상 토큰 ─────────────────────────────────────────────────────────────────
const C = {
  bg:      TK.bg0,
  card:    '#131929',
  card2:   '#0d1420',
  border:  '#1e3050',
  text:    TK.slate100,
  textSub: '#b0bec8',
  textLow: '#8a9db5',
  price:   '#7dd3fc',      // 슬레이트 블루 — 실제 주가
  lynch:   TK.amber500,      // 골드 — 린치 기본선 (EPS×15)
  median:  TK.violet400,      // 보라 — 중앙값 PE선
  under:   TK.emerald500,      // 에메랄드 — 저평가 음영
  over:    TK.red500,      // 빨강 — 고평가 음영
  gold:    TK.amber500,
  green:   TK.green400,
  red:     TK.red400,
}
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

// ── 포맷 유틸 ─────────────────────────────────────────────────────────────────
const fmtPrice = (n: number, cur: string) =>
  cur === 'KRW'
    ? '₩' + n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtGap = (g: number | null) =>
  g == null ? '—' : `${g > 0 ? '+' : ''}${g.toFixed(1)}%`

const gapColor = (g: number | null) =>
  g == null ? C.textLow : g > 30 ? C.red : g < -20 ? C.green : C.textSub

// ── 커스텀 툴팁 ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  const d: TracerPoint | undefined = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: FONT, fontSize: 12, minWidth: 200 }}>
      <div style={{ fontWeight: 900, color: C.text, marginBottom: 8, fontSize: 13 }}>{label}년</div>
      {d.price    != null && <div style={{ color: C.price,  marginBottom: 3 }}>📈 주가: {fmtPrice(d.price, currency)}</div>}
      {d.lynch15  != null && <div style={{ color: C.lynch,  marginBottom: 3 }}>⚡ 린치선(×15): {fmtPrice(d.lynch15, currency)}</div>}
      {d.medianLine != null && <div style={{ color: C.median, marginBottom: 3 }}>📊 중앙값 PE선: {fmtPrice(d.medianLine, currency)}</div>}
      {d.actualPer != null && <div style={{ color: C.textSub, marginBottom: 3 }}>PER: {d.actualPer.toFixed(1)}×</div>}
      {d.gap15 != null && (
        <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: d.gap15 > 0 ? `${TK.red500}22` : `${TK.emerald500}22` }}>
          <span style={{ color: d.gap15 > 0 ? C.red : C.green, fontWeight: 800 }}>
            {d.gap15 > 0 ? '▲ 고평가' : '▼ 저평가'}: {fmtGap(d.gap15)}
          </span>
        </div>
      )}
      {d.isDeficit && <div style={{ color: C.red, marginTop: 4, fontSize: 11 }}>⚠️ 적자 구간</div>}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function LynchEarningsLineTracer() {
  const [input,   setInput]   = useState('')
  const [market,  setMarket]  = useState<'US' | 'KR'>('US')
  const [data,    setData]    = useState<TracerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [showMedian, setShowMedian] = useState(true)

  const search = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const tk = input.trim().toUpperCase()
    if (!tk) return
    setLoading(true); setError(null); setData(null)
    try {
      const r = await fetch(`/api/lynch-earnings-tracer?ticker=${encodeURIComponent(tk)}&market=${market}`, { cache: 'no-store' })
      const j: TracerResult & { error?: string } = await r.json()
      if (j.error) setError(j.error)
      else if (!j.hasData) setError('데이터를 불러오지 못했습니다.')
      else setData(j)
    } catch { setError('데이터를 불러오는 중 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }, [input, market])

  // ── 차트 데이터 가공 — 기존 LynchEarningsChart 동일 패턴 (커스텀 data prop 없음)
  // underHigh/underLow/overHigh/overLow 를 메인 배열에 포함해 X축 중복 방지
  const chartPoints = (data?.points ?? []).map(p => {
    const isUnder = p.price != null && p.lynch15 != null && p.price < p.lynch15
    const isOver  = p.price != null && p.lynch15 != null && p.price >= p.lynch15
    return {
      ...p,
      underHigh: isUnder ? p.lynch15 : null,  // 저평가 음영 상단 (lynch15)
      underLow:  isUnder ? p.price   : null,  // 저평가 음영 하단 (price) — 배경색으로 덮어 사이만 보임
      overHigh:  isOver  ? p.price   : null,  // 고평가 음영 상단 (price)
      overLow:   isOver  ? p.lynch15 : null,  // 고평가 음영 하단 (lynch15) — 배경색으로 덮어 사이만 보임
    }
  })

  // Y 축 도메인 — 여백 15%
  const allVals = chartPoints.flatMap(p => [p.price, p.lynch15, showMedian ? p.medianLine : null].filter((v): v is number => v != null && v > 0))
  const yMin = allVals.length ? Math.round(Math.min(...allVals) * 0.85) : 'auto'
  const yMax = allVals.length ? Math.round(Math.max(...allVals) * 1.15) : 'auto'

  const cur = data?.currency ?? 'USD'
  const priceLabel = cur === 'KRW' ? '원(₩)' : 'USD($)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: FONT, background: C.bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}` }}>

      {/* ── 헤더 ── */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(135deg,#0d1726,#131929)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>📈</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>린치 이익선 트레이서</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#1e3050', color: C.lynch, fontWeight: 700 }}>EPS × 15 · 역사적 이격</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.textLow }}>
          &ldquo;주가는 결국 이익의 그림자다 — 이익이 오르면 주가는 따라온다.&rdquo; — 피터 린치
        </div>
      </div>

      {/* ── 검색 바 ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <form onSubmit={search} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={market} onChange={e => setMarket(e.target.value as 'US' | 'KR')}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 12.5, cursor: 'pointer' }}
          >
            <option value="US">🇺🇸 US</option>
            <option value="KR">🇰🇷 KR</option>
          </select>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            placeholder="티커 입력 (예: NVDA / 005930)"
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 12.5, outline: 'none' }}
          />
          <button
            type="submit" disabled={loading || !input.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, background: loading ? '#1e3050' : '#1e40af', color: C.text, fontSize: 12.5, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '⏳ 분석 중…' : '📈 분석'}
          </button>
          {data && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.textSub, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showMedian} onChange={e => setShowMedian(e.target.checked)} />
              중앙값 PE선 표시
            </label>
          )}
        </form>
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div style={{ padding: '20px 20px 16px' }}>

        {/* 빈 상태 */}
        {!loading && !data && !error && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: C.textLow, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div>티커를 입력하고 분석하면 역사적 주가와 이익선의<br/>괴리(밸류에이션 갭)를 추적합니다.</div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#556080' }}>개별 주식만 지원 · ETF·코인·원자재 제외</div>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: C.textSub, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            역사적 EPS·주가 데이터 수집 중…<br/>
            <span style={{ fontSize: 11, color: C.textLow }}>최초 조회는 10~20초 걸릴 수 있어요 (이후 48h 캐시)</span>
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div style={{ padding: '20px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: TK.red300, fontSize: 13, lineHeight: 1.7 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── 적자 폴백 (종목명 항상 표시) ── */}
        {data && data.deficitMode && (
          <>
            {/* 종목 식별 헤더 — 적자라도 누가 적자인지 보여줌 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{data.name}</span>
              <span style={{ fontSize: 11, color: C.textLow, fontFamily: 'monospace' }}>{data.ticker} · {data.market}</span>
              <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: TK.red400, border: '1px solid rgba(239,68,68,0.35)', fontWeight: 700 }}>적자</span>
            </div>
            <div style={{ padding: '18px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', color: TK.red300, fontSize: 13, lineHeight: 1.75 }}>
              <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 14 }}>🚫 린치 이익선 분석 불가</div>
              <b>{data.name}</b>은(는) 최근 EPS가 마이너스(적자)이므로 린치의 이익선을 그릴 수 없습니다.
              이익이 없을 때 EPS×15는 의미가 없어지기 때문입니다.<br/>
              <br/>
              대신 <b style={{ color: TK.amber400 }}>버핏의 DCF 분석기</b>나 <b style={{ color: TK.amber500 }}>Jarvis 모닝 처방전</b>을 참고하세요.
              적자 기업은 &ldquo;매출 성장률과 현금 런웨이(생존 기간)&rdquo;가 핵심 지표입니다.
            </div>
          </>
        )}

        {/* ── 정상 차트 ── */}
        {data && data.hasData && !data.deficitMode && chartPoints.length >= 2 && (
          <>
            {/* 종목 요약 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{data.name}</span>
              <span style={{ fontSize: 11, color: C.textLow, fontFamily: 'monospace' }}>{data.ticker} · {data.market}</span>
              {data.medianPer && <span style={{ fontSize: 11, color: C.median, padding: '2px 7px', borderRadius: 99, background: '#1e1040', border: '1px solid #4c2fa0' }}>중앙 PER {data.medianPer.toFixed(1)}×</span>}
              <span style={{ fontSize: 11, color: C.textLow }}>· {chartPoints.length}개년 · 48h 캐시</span>
            </div>

            {/* ComposedChart */}
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 24, left: 12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" strokeOpacity={0.6} />
                  <XAxis dataKey="year" tick={{ fill: C.textLow, fontSize: 11 }} axisLine={{ stroke: C.border }} />
                  <YAxis
                    domain={[yMin, yMax]}
                    tickFormatter={v => cur === 'KRW' ? (v >= 1000 ? Math.round(v/1000)+'K' : v.toString()) : '$' + Math.round(v)}
                    tick={{ fill: C.textLow, fontSize: 10.5 }}
                    label={{ value: priceLabel, angle: -90, position: 'insideLeft', fill: C.textLow, fontSize: 10, dx: -4 }}
                    axisLine={{ stroke: C.border }}
                    width={54}
                  />
                  <Tooltip content={<CustomTooltip currency={cur} />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 10, fontSize: 11.5, color: C.textSub }}
                    formatter={(value) => <span style={{ color: C.textSub }}>{value}</span>}
                  />

                  {/* ── 저평가 음영 (주가 < 이익선) — 초록 ──
                      기존 LynchEarningsChart 동일 패턴:
                      underHigh(lynch15)까지 초록으로 채운 뒤
                      underLow(price)까지 배경색으로 덮어 "사이 구간"만 보임 */}
                  <Area type="monotone" dataKey="underHigh"
                    stroke="none" fill={C.under} fillOpacity={0.22}
                    connectNulls isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="underLow"
                    stroke="none" fill={C.bg} fillOpacity={1}
                    connectNulls isAnimationActive={false} legendType="none" />

                  {/* ── 고평가 음영 (주가 > 이익선) — 빨간 ── */}
                  <Area type="monotone" dataKey="overHigh"
                    stroke="none" fill={C.over} fillOpacity={0.2}
                    connectNulls isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="overLow"
                    stroke="none" fill={C.bg} fillOpacity={1}
                    connectNulls isAnimationActive={false} legendType="none" />

                  {/* 중앙값 PE선 (토글) */}
                  {showMedian && (
                    <Line
                      type="monotone" dataKey="medianLine" name={`중앙값 PE선 (×${data.medianPer?.toFixed(0)})`}
                      stroke={C.median} strokeWidth={1.8} strokeDasharray="5 3" dot={false}
                      connectNulls isAnimationActive={false}
                    />
                  )}

                  {/* 린치 이익선 (EPS × 15) */}
                  <Line
                    type="monotone" dataKey="lynch15" name="린치 이익선 (EPS×15)"
                    stroke={C.lynch} strokeWidth={2.2} dot={{ r: 3.5, fill: C.lynch, strokeWidth: 0 }}
                    connectNulls isAnimationActive={false}
                  />

                  {/* 실제 주가 */}
                  <Line
                    type="monotone" dataKey="price" name="연간 평균 주가"
                    stroke={C.price} strokeWidth={2.5} dot={{ r: 4, fill: C.price, strokeWidth: 0 }}
                    connectNulls isAnimationActive={false}
                  />

                  {/* 현재가 기준선 */}
                  {data.currentPrice && (
                    <ReferenceLine
                      y={data.currentPrice} stroke={C.price} strokeDasharray="3 3"
                      strokeOpacity={0.55}
                      label={{ value: '현재', fill: C.price, fontSize: 10, position: 'right' }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── 음영 범례 설명 ── */}
            <div style={{ display: 'flex', gap: 16, marginTop: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 20, height: 10, borderRadius: 3, background: C.under, opacity: 0.55 }} />
                <span style={{ color: C.textLow }}>초록 음영 = 주가 &lt; 이익선 (바겐세일 구간)</span>
              </span>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 20, height: 10, borderRadius: 3, background: C.over, opacity: 0.5 }} />
                <span style={{ color: C.textLow }}>빨간 음영 = 주가 &gt; 이익선 (고평가 구간)</span>
              </span>
            </div>

            {/* ── 이격도 KPI ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: '현재 주가', val: data.currentPrice ? fmtPrice(data.currentPrice, cur) : '—', color: C.price },
                { label: '린치선 (EPS×15)', val: data.currentEps && data.currentEps > 0 ? fmtPrice(data.currentEps * 15, cur) : '—', color: C.lynch },
                { label: '이격도 (vs 린치선)', val: fmtGap(data.currentGap15), color: gapColor(data.currentGap15) },
                { label: '중앙값 PER', val: data.medianPer ? `${data.medianPer.toFixed(1)}×` : '—', color: C.median },
              ].map(k => (
                <div key={k.label} style={{ padding: '10px 14px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textLow, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* ── 연도별 이격도 테이블 ── */}
            <div style={{ overflowX: 'auto', marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ color: C.textLow, fontSize: 10.5 }}>
                    {['연도', '평균 주가', 'EPS', '린치선(×15)', '실제 PER', '이격도(vs린치)'].map(h => (
                      <th key={h} style={{ textAlign: 'right', fontWeight: 700, padding: '0 8px 7px', whiteSpace: 'nowrap' }}
                        >{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...chartPoints].reverse().map(p => (
                    <tr key={p.year} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ textAlign: 'right', padding: '6px 8px', color: C.textSub, fontWeight: 700 }}>{p.year}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', color: C.price }}>{p.price != null ? fmtPrice(p.price, cur) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', color: p.isDeficit ? C.red : p.eps == null ? C.textLow : C.text }}>
                        {p.eps == null
                          ? <span style={{ color: C.textLow }}>—</span>
                          : p.isDeficit
                            ? <>{cur === 'KRW' ? p.eps.toLocaleString() : p.eps.toFixed(2)}<span style={{ color: C.red, marginLeft: 4, fontSize: 9 }}>적자</span></>
                            : (cur === 'KRW' ? p.eps.toLocaleString() : p.eps.toFixed(2))
                        }
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', color: C.lynch }}>{p.lynch15 != null ? fmtPrice(p.lynch15, cur) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', color: C.textSub }}>{p.actualPer != null ? p.actualPer.toFixed(1) + '×' : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, color: gapColor(p.gap15) }}>{fmtGap(p.gap15)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── 린치 코멘트 ── */}
            {data.currentGap15 != null && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: C.card2, borderLeft: `3px solid ${data.currentGap15 < -20 ? C.green : data.currentGap15 > 30 ? C.red : TK.blue500}` }}>
                <div style={{ fontSize: 12.5, color: TK.slate300, lineHeight: 1.75, fontStyle: 'italic' }}>
                  {data.currentGap15 < -20
                    ? `🟢 ${data.name}의 주가가 린치 이익선보다 ${Math.abs(data.currentGap15).toFixed(0)}% 낮게 거래되고 있어. 이익이 뒷받침하는데 주가가 덜 반영된 상태야 — 시장이 아직 이 이익 성장을 제대로 평가하지 못한 거일 수 있어. 물론 "왜 싸지?"를 반드시 확인해야 해.`
                    : data.currentGap15 > 30
                    ? `🔴 ${data.name}의 주가가 린치 이익선보다 ${data.currentGap15.toFixed(0)}% 높게 거래되고 있어. 이익 대비 시장의 기대가 이미 많이 앞서 있는 상태야 — 이 이격이 정당화될 만한 이익 성장이 실제로 따라올지를 직접 확인해.`
                    : `📊 ${data.name}의 주가가 린치 이익선(${fmtPrice(data.currentEps! * 15, cur)}) 근처에서 거래되고 있어. 이익 대비 주가가 비교적 적정한 구간이야 — 이 상태에서의 판단 기준은 이익이 앞으로도 계속 성장할지 여부야.`
                  }
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 푸터 */}
      <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}`, fontSize: 9.5, color: C.textLow, lineHeight: 1.6 }}>
        📈 린치 이익선 = EPS × 15 (피터 린치의 &ldquo;성장 없는 적정가&rdquo; 기준) · 연간 평균 주가 = Yahoo Finance 월봉 평균 · EPS = 확정 연간 실적(US=FMP/Yahoo, KR=DART/Naver) · 48h 캐시 · 교육용 참고이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
