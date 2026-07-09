'use client'
// 증권사식 PER 밴드 차트 — 역사적 PER 분위수(최저~최고) × 연간 EPS 밴드 위에 연평균 주가를 겹쳐
// "지금 주가가 역사적으로 싼 밴드인가 비싼 밴드인가"를 보여줌. 데이터는 기존 /api/lynch-earnings-tracer 재사용(제2원칙·신규 백엔드 0)
import { useState, useEffect } from 'react'
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { TracerResult } from '@/app/api/lynch-earnings-tracer/route'

const BORDER = '#1e293b'
// 밴드 5선: 최저(파랑=역사적 바닥) → 최고(빨강=역사적 천장)
const BAND_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#fb923c', '#ef4444']
const BAND_NAMES = ['최저', '25%', '중앙', '75%', '최고']

const quantile = (sorted: number[], q: number): number => {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

interface Row { year: string; price: number | null; b0?: number; b1?: number; b2?: number; b3?: number; b4?: number; est?: boolean }
type BandKey = 'b0' | 'b1' | 'b2' | 'b3' | 'b4'

export default function PerBandChart({ ticker, market }: { ticker: string; market: 'US' | 'KR' }) {
  const [data, setData] = useState<TracerResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(false); setData(null)
    fetch(`/api/lynch-earnings-tracer?ticker=${encodeURIComponent(ticker)}&market=${market}`)
      .then(r => r.json())
      .then(j => { if (alive) { setData(j.hasData ? j : null); setErr(!j.hasData) } })
      .catch(() => { if (alive) setErr(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market])

  if (loading) return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16, color: '#8599ae', fontSize: 12 }}>
      📊 PER 밴드 계산 중… (역사적 연평균 주가 × EPS 수집)
    </div>
  )
  if (err || !data) return null   // 데이터 부족(적자·신생 등)은 조용히 생략 — 아래 정직 사유는 케이스별 표시

  const cur = data.currency
  const fmtP = (v: number) => cur === 'KRW' ? `₩${Math.round(v).toLocaleString()}` : `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  // 역사적 PER 표본(흑자 연도만) → 분위수 5선
  const pers = data.points.map(p => p.actualPer).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b)
  if (pers.length < 3) return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 24px', marginBottom: 16, color: '#8599ae', fontSize: 11.5, lineHeight: 1.6 }}>
      📊 <b style={{ color: '#cbd5e1' }}>PER 밴드</b> — 역사적 흑자 연도 PER 표본이 {pers.length}개뿐이라 밴드를 그릴 수 없습니다(최소 3개년 필요). 적자·신생·데이터 부족 종목은 정직하게 생략합니다.
    </div>
  )
  const qs = [quantile(pers, 0), quantile(pers, 0.25), quantile(pers, 0.5), quantile(pers, 0.75), quantile(pers, 1)]

  // 차트 행: 연도별 밴드(EPS×분위수) + 연평균 주가. 적자 연도는 밴드 공백(주가만)
  const rows: Row[] = data.points.map(p => {
    const r: Row = { year: String(p.year), price: p.price }
    if (p.eps != null && p.eps > 0) qs.forEach((q, i) => { r[`b${i}` as BandKey] = Math.round(p.eps! * q * 100) / 100 })
    return r
  })
  // 현재 시점 확장 — 마지막 확정 연도 이후는 최신 EPS를 평행 연장(증권사 밴드와 동일 방식) + 현재가
  const lastYear = data.points.at(-1)?.year ?? 0
  const nowYear = new Date().getFullYear()
  if (data.currentPrice != null && data.currentEps != null && data.currentEps > 0 && lastYear < nowYear) {
    const r: Row = { year: `${nowYear}(현재)`, price: data.currentPrice, est: true }
    qs.forEach((q, i) => { r[`b${i}` as BandKey] = Math.round(data.currentEps! * q * 100) / 100 })
    rows.push(r)
  }

  // 현재 주가의 밴드 위치 판정(현재 PER vs 분위수)
  const curPer = data.currentPrice != null && data.currentEps != null && data.currentEps > 0
    ? data.currentPrice / data.currentEps : null
  const zone = curPer == null ? null
    : curPer <= qs[1] ? { label: '역사적 저평가권(하단 밴드)', color: '#4ade80', desc: '과거 이 종목이 가장 싸게 거래되던 배수 구간 — 단, 싼 데는 이유가 있는지(이익 정점·업황) 확인' }
    : curPer <= qs[2] ? { label: '중앙 아래(평균보다 싼 구간)', color: '#86efac', desc: '역사적 평균 배수보다 낮게 거래 중' }
    : curPer <= qs[3] ? { label: '중앙 위(평균보다 비싼 구간)', color: '#fbbf24', desc: '역사적 평균 배수보다 높게 거래 중 — 성장 가속이 뒷받침되는지 확인' }
    : { label: '역사적 고평가권(상단 밴드)', color: '#f87171', desc: '과거 가장 비싸게 거래되던 배수 구간 — 추격 매수 주의, 이익이 따라와야 정당화' }

  return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📊 PER 밴드 — 역사적 배수 구간 위의 주가</div>
      <div style={{ fontSize: 11, color: '#8599ae', marginBottom: 12, lineHeight: 1.6 }}>
        과거 {pers.length}개년 실제 PER의 분위수(최저 {qs[0].toFixed(1)}배 ~ 중앙 {qs[2].toFixed(1)}배 ~ 최고 {qs[4].toFixed(1)}배) × 각 연도 EPS = 밴드.
        흰 선(주가)이 <b style={{ color: '#93c5fd' }}>아래 밴드</b>에 있으면 역사적으로 싼 배수, <b style={{ color: '#fca5a5' }}>위 밴드</b>면 비싼 배수로 거래 중.
      </div>

      {zone && curPer != null && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${zone.color}44`, borderRadius: 9, padding: '9px 13px', marginBottom: 12, fontSize: 11.5, lineHeight: 1.55 }}>
          <b style={{ color: zone.color }}>현재 PER {curPer.toFixed(1)}배 → {zone.label}</b>
          <span style={{ color: '#aab6c4' }}> · {zone.desc}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fill: '#8599ae', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8599ae', fontSize: 10.5 }} tickFormatter={v => cur === 'KRW' ? `${Math.round((v as number) / 1000).toLocaleString()}천` : `$${v}`} width={56} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#cbd5e1' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [fmtP(v as number), name]}
          />
          <Legend wrapperStyle={{ fontSize: 10.5 }} />
          {qs.map((q, i) => (
            <Line key={i} type="monotone" dataKey={`b${i}`} name={`${BAND_NAMES[i]} ${q.toFixed(1)}x`}
              stroke={BAND_COLORS[i]} strokeWidth={1.2} strokeDasharray="5 3" dot={false} connectNulls />
          ))}
          <Line type="monotone" dataKey="price" name="연평균 주가" stroke="#f1f5f9" strokeWidth={2.4}
            dot={{ r: 3, fill: '#f1f5f9' }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ color: '#6e7f8f', fontSize: 10, marginTop: 8, lineHeight: 1.6 }}>
        💡 밴드 = 확정 연도 실제 PER {pers.length}개 표본의 분위수(표본이 적어 통계가 아닌 <b>역사적 참고 구간</b>). 주가는 연평균(일별 고저 아님)·마지막 구간은 최신 EPS 평행 연장+현재가.
        적자 연도는 밴드 공백. 경기순환주는 이익 정점에서 PER이 가장 낮아 보이는 <b>저PER 함정</b> 주의 — 밴드 하단이 곧 매수 신호는 아닙니다. 금융주·지주사는 PER 밴드 자체가 부적합(P/B·NAV로).
      </div>
    </div>
  )
}
