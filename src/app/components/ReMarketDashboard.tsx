'use client'
// 🏠 부동산 시장 대시보드(Phase 1) — "금리는 집값의 중력" 한 화면.
// KB 아파트 매매/전세 지수 × 기준금리 오버레이 + 실거래가격지수 + 미분양(재고 적체 프레임) + 미국(케이스실러×모기지) 비교축.
import { useState, useEffect } from 'react'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { ReMarketResult } from '@/app/api/re-market/route'

const CARD = '#141824', BORDER = '#1e293b'

const Kpi = ({ label, value, sub, color = '#e2e8f0' }: { label: string; value: string; sub?: string; color?: string }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', minWidth: 150, flex: '1 1 150px' }}>
    <div style={{ color: '#8a9aaa', fontSize: 11, fontWeight: 700 }}>{label}</div>
    <div style={{ color, fontSize: 20, fontWeight: 900, marginTop: 3, fontFamily: 'monospace' }}>{value}</div>
    {sub && <div style={{ color: '#8a9aaa', fontSize: 10.5, marginTop: 2 }}>{sub}</div>}
  </div>
)

const Panel = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
    <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>{title}</div>
    {sub && <div style={{ color: '#8a9aaa', fontSize: 11, margin: '3px 0 10px', lineHeight: 1.55 }}>{sub}</div>}
    {children}
  </div>
)

const TT = { contentStyle: { background: '#0f1117', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }, labelStyle: { color: '#cbd5e1' } }
const AXIS = { fill: '#8a9aaa', fontSize: 10 }
// 20년 월별 X축 — 연 단위 눈금만
const yearTick = (rows: { date: string }[]) => rows.filter(r => r.date.endsWith('-01')).filter((_, i) => i % 2 === 0).map(r => r.date)

export default function ReMarketDashboard() {
  const [d, setD] = useState<ReMarketResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/re-market').then(r => r.ok ? r.json() : null)
      .then(j => j && !j.error ? setD(j) : setErr(true))
      .catch(() => setErr(true))
  }, [])

  if (err) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#f87171', fontSize: 12 }}>⚠️ 부동산 시장 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>
  if (!d) return <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>🏠 부동산 시장 데이터를 모으는 중… (한국은행 ECOS·FRED)</div>

  const k = d.kpi
  const unsoldTone = k.unsoldPercentile == null ? '#e2e8f0' : k.unsoldPercentile >= 75 ? '#f87171' : k.unsoldPercentile >= 50 ? '#fbbf24' : '#4ade80'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI 바 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Kpi label="한은 기준금리" value={k.baseRate != null ? `${k.baseRate}%` : '—'} sub="집값의 중력" />
        <Kpi label="주담대 금리(신규)" value={k.mortgageRate != null ? `${k.mortgageRate}%` : '—'} sub="실제 대출 비용" />
        <Kpi label="KB 아파트 매매지수 YoY" value={k.kbAptYoY != null ? `${k.kbAptYoY > 0 ? '+' : ''}${k.kbAptYoY}%` : '—'}
          sub={`전국 · ${k.asOfKb ?? ''}`} color={k.kbAptYoY == null ? '#e2e8f0' : k.kbAptYoY > 0 ? '#f87171' : '#60a5fa'} />
        <Kpi label="미분양(전국)" value={k.unsold != null ? `${k.unsold.toLocaleString()}호` : '—'}
          sub={`역사 백분위 ${k.unsoldPercentile ?? '—'}% (2007~) · ${k.asOfUnsold ?? ''}`} color={unsoldTone} />
      </div>

      {/* ① KB 지수 × 기준금리 */}
      <Panel title="📉 KB 아파트 매매·전세 지수 × 기준금리 — 금리는 집값의 중력"
        sub="금리가 오르면(보라, 우축) 대출 비용이 늘어 집값 지수(좌축)가 눌리고, 금리가 내리면 다시 뜨는 역관계를 20년 시계열로 확인합니다. 전세(초록)는 '사용가치' — 매매와의 간격이 벌어지면 거품/저평가 신호의 단서.">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={d.kbChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={AXIS} ticks={yearTick(d.kbChart)} tickFormatter={v => String(v).slice(0, 4)} />
            <YAxis yAxisId="idx" tick={AXIS} domain={['auto', 'auto']} width={44} />
            <YAxis yAxisId="rate" orientation="right" tick={AXIS} width={36} tickFormatter={v => `${v}%`} />
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="idx" type="monotone" dataKey="sale" name="아파트 매매(전국)" stroke="#f1f5f9" strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="idx" type="monotone" dataKey="saleSeoul" name="아파트 매매(서울)" stroke="#fb923c" strokeWidth={1.4} dot={false} connectNulls />
            <Line yAxisId="idx" type="monotone" dataKey="jeonse" name="아파트 전세(전국)" stroke="#4ade80" strokeWidth={1.4} dot={false} connectNulls />
            <Line yAxisId="rate" type="stepAfter" dataKey="baseRate" name="기준금리(우)" stroke="#a78bfa" strokeWidth={1.6} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ② 실거래가격지수 */}
      <Panel title="🏷️ 아파트 매매 실거래가격지수 — 호가가 아닌 '실제 체결가'의 흐름"
        sub="위 KB 지수는 표본 조사(호가 반영)라 완만하고, 이 지수는 실제 신고된 거래가격 기반이라 시장 전환점에 더 민감합니다. 서울(주황)이 전국보다 먼저·크게 움직이는 패턴을 관찰하세요.">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={d.rtChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={AXIS} ticks={yearTick(d.rtChart)} tickFormatter={v => String(v).slice(0, 4)} />
            <YAxis tick={AXIS} domain={['auto', 'auto']} width={44} />
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="nation" name="전국" stroke="#f1f5f9" strokeWidth={1.8} dot={false} connectNulls />
            <Line type="monotone" dataKey="seoul" name="서울" stroke="#fb923c" strokeWidth={1.6} dot={false} connectNulls />
            <Line type="monotone" dataKey="capital" name="수도권" stroke="#60a5fa" strokeWidth={1.3} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ③ 미분양 — 재고 적체 프레임 */}
      <Panel title="📦 미분양 주택 — 부동산판 '재고 적체' 레이더"
        sub={`주식에서 재고가 쌓이면 사이클 고점을 경고하듯, 미분양이 쌓이면 공급 과잉·수요 위축 신호입니다. 현재 전국 ${k.unsold?.toLocaleString() ?? '—'}호 = 2007년 이후 역사 백분위 ${k.unsoldPercentile ?? '—'}% ${k.unsoldPercentile != null ? (k.unsoldPercentile >= 75 ? '(재고 많음 — 경계)' : k.unsoldPercentile >= 50 ? '(중간)' : '(재고 적음 — 공급 부족 쪽)') : ''}.`}>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={d.unsoldChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={AXIS} ticks={yearTick(d.unsoldChart)} tickFormatter={v => String(v).slice(0, 4)} />
            <YAxis tick={AXIS} width={54} tickFormatter={v => `${((v as number) / 10000).toFixed(0)}만`} />
            <Tooltip {...TT} formatter={(v) => [`${Number(v).toLocaleString()}호`, '']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="nation" name="전국" stroke="#fb923c" fill="#fb923c22" strokeWidth={1.8} connectNulls />
            <Line type="monotone" dataKey="capital" name="수도권" stroke="#60a5fa" strokeWidth={1.4} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ④ 미국 비교축 */}
      <Panel title="🇺🇸 미국 집값(케이스-실러) × 모기지 30년 금리 — 글로벌 비교축"
        sub="한국만의 현상인지, 글로벌 금리 사이클의 일부인지 구분하는 축입니다. 미국도 모기지 금리(보라, 우축)가 치솟으면 집값 상승(좌축)이 멈추는 같은 중력이 작동합니다.">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={d.usChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1c2434" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={AXIS} ticks={yearTick(d.usChart)} tickFormatter={v => String(v).slice(0, 4)} />
            <YAxis yAxisId="cs" tick={AXIS} domain={['auto', 'auto']} width={44} />
            <YAxis yAxisId="mr" orientation="right" tick={AXIS} width={36} tickFormatter={v => `${v}%`} />
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="cs" type="monotone" dataKey="caseShiller" name="케이스-실러 집값지수" stroke="#f1f5f9" strokeWidth={1.8} dot={false} connectNulls />
            <Line yAxisId="mr" type="monotone" dataKey="mortgage" name="모기지 30년(우)" stroke="#a78bfa" strokeWidth={1.4} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* 프레임 안내 + 정직 캐비엇 */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px', fontSize: 11, color: '#aab6c4', lineHeight: 1.7 }}>
        <b style={{ color: '#e2e8f0' }}>🧭 부동산 4축 프레임(주식과 같은 언어)</b> — 이 화면은 1단계(시장 전체). 다음 단계로
        🐝 <b>사이클</b>(벌집순환모형: 가격×거래량 6국면) → 🔍 <b>단지 리서치</b>(실거래 추이 + 전세가율·PIR 밸류 판정) → 💼 <b>포트폴리오 통합</b>이 이어집니다.
        <div style={{ marginTop: 6, color: '#8a9aaa', fontSize: 10.5 }}>
          ⚠️ 지수는 표본조사·실거래 신고(~30일 지연) 기반의 <b>과거 확정치</b>이며 지역·단지별 편차가 큽니다. 매수·매도 추천이 아닌 <b>시장 위치 관측</b> 도구입니다(교육용).
          출처: 한국은행 ECOS(KB국민은행·한국부동산원 재배포)·FRED. 12시간 캐시.
        </div>
      </div>
    </div>
  )
}
