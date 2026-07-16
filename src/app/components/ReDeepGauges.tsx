'use client'
// 🫧 부동산 심화 게이지 4종 — ①적정성지수(주금공 방법론: 가격 vs 전세·금리 근본가치) ②M2 vs 서울아파트(1986~) ③매매수급지수(부동산원) ④소비심리지수(국토연구원)
import { useState, useEffect } from 'react'
import { ComposedChart, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine, Area } from 'recharts'
import type { ReGaugeResult } from '@/app/api/re-gauge/route'
import { TK } from '@/lib/theme'

const CARD = TK.card, BORDER = TK.border

const VERDICT: Record<string, { label: string; color: string; desc: string }> = {
  hot: { label: '🔥 과열권', color: TK.red400, desc: '가격이 근본가치(전세×금리) 대비 역사 상위권 프리미엄 — 추격매수 주의 구간' },
  warm: { label: '🟠 상단권', color: TK.orange400, desc: '근본가치 대비 프리미엄이 역사 평균 위 — 신중 구간' },
  neutral: { label: '⚖️ 중립권', color: TK.yellow500, desc: '가격과 근본가치의 괴리가 역사 평균 수준' },
  cool: { label: '💧 하단권', color: TK.green400, desc: '근본가치 대비 프리미엄이 역사 하위권 — 가격이 사용가치에 근접' },
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>{title}</div>
      <div style={{ color: TK.sub, fontSize: 11, margin: '3px 0 10px', lineHeight: 1.55 }}>{sub}</div>
      {children}
    </div>
  )
}

export default function ReDeepGauges() {
  const [d, setD] = useState<ReGaugeResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/re-gauge').then(r => r.json())
      .then(j => { if (alive) setD(j) })
      .catch(() => { /* graceful */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, color: TK.sub, fontSize: 12 }}>🫧 적정성·유동성·수급 게이지 계산 중…</div>
  if (!d) return null
  const v = d.bubble ? VERDICT[d.bubble.verdict] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ① 적정성지수 */}
      {d.bubble && v && (
        <Card title="🫧 주택가격 적정성 게이지 — 서울 아파트"
          sub={`주금공(HF) 거품 검증 프레임: 근본가치 = 전세(임대료) ÷ 주담대 금리(할인율). 가격이 근본가치에서 얼마나 떠 있는지를 역사 백분위로 판정(기준시점 민감성 회피). 기준 ${d.bubble.base}=100.`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: '1 1 170px', background: TK.bg3, border: `1px solid ${v.color}55`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>판정</div>
              <div style={{ color: v.color, fontSize: 17, fontWeight: 900 }}>{v.label}</div>
              <div style={{ color: TK.sub9, fontSize: 10.5, lineHeight: 1.5 }}>{v.desc}</div>
            </div>
            <div style={{ flex: '1 1 130px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>현재 괴리(가격/근본가치)</div>
              <div style={{ color: v.color, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{d.bubble.gapNow > 0 ? '+' : ''}{d.bubble.gapNow}%</div>
              <div style={{ color: TK.sub, fontSize: 10 }}>역사 백분위 {d.bubble.gapPercentile}%</div>
            </div>
            <div style={{ flex: '1 1 130px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>주담대 금리(할인율)</div>
              <div style={{ color: TK.slate200, fontSize: 19, fontWeight: 900, fontFamily: 'monospace' }}>{d.bubble.rateNow ?? '—'}%</div>
              <div style={{ color: TK.sub, fontSize: 10 }}>금리↓=근본가치↑ (중력 완화)</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={d.bubble.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.floor(d.bubble.series.length / 8)} />
              <YAxis yAxisId="idx" tick={{ fill: TK.sub, fontSize: 10 }} width={42} domain={['auto', 'auto']} />
              {/* 괴리(%)는 스케일이 달라(−70~+50 vs 100~600) 우측 별도 축 — 좌축에 겹치면 0 근처 띠로 눌림(화면검증) */}
              <YAxis yAxisId="gap" orientation="right" tick={{ fill: TK.red400, fontSize: 10 }} width={40} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="gap" type="monotone" dataKey="gap" name="괴리(%, 우축)" fill={`${TK.red400}26`} stroke={`${TK.red400}88`} strokeWidth={1} />
              <Line yAxisId="idx" type="monotone" dataKey="sale" name="매매지수(재기준)" stroke={TK.slate100} strokeWidth={2} dot={false} />
              <Line yAxisId="idx" type="monotone" dataKey="fund" name="근본가치(전세÷금리)" stroke={TK.teal400} strokeWidth={1.8} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
            ⚠️ 주금공 보고서 자체 캐비엇 반영 — 기준시점을 어디에 두느냐로 절대 괴리는 달라지므로 <b style={{ color: TK.slate300 }}>역사 백분위</b>로 읽습니다.
            근본가치는 전세(사용가치)와 금리만 반영한 단순 모형(공급·정책 미반영) · 매수/매도 신호가 아닌 위치 관측(교육용).
          </div>
        </Card>
      )}

      {/* ② M2 vs 서울아파트 */}
      {d.m2 && (
        <Card title="💧 M2(유동성) vs 서울 아파트 지수 — 1986년부터"
          sub={`"부동산은 유동성의 자산" — 40년 광의통화와 서울 아파트 가격을 1986-01=100으로 재기준(로그축·같은 비율 변화=같은 세로 거리). ${d.m2.spliceNote}.`}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 11px', fontSize: 11.5, color: TK.blue400, fontWeight: 800 }}>M2 {d.m2.m2Multiple}배</span>
            <span style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 11px', fontSize: 11.5, color: TK.orange400, fontWeight: 800 }}>서울 아파트 {d.m2.aptMultiple}배</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d.m2.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.floor(d.m2.series.length / 8)} />
              <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: TK.sub, fontSize: 10 }} width={48} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="m2" name="M2 광의통화" stroke={TK.blue400} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="apt" name="서울 아파트(KB)" stroke={TK.orange400} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
            🎓 M2가 아파트보다 가파른 것은 정상(경제 전체 통화량 vs 단일 자산 가격) — 볼 것은 <b style={{ color: TK.slate300 }}>기울기가 같이 꺾이고 같이 서는 구간</b>(유동성 팽창기=가격 상승기).
            지수는 가격 배수지 수익률이 아니며(전세 레버리지·보유비용 미반영), KB 표본조사 지수 기준.
          </div>
        </Card>
      )}

      {/* ③ 매매수급지수 */}
      {d.sentiment && (
        <Card title="🌡️ 아파트 매매수급지수 — 매수자 vs 매도자 우위 (부동산원)"
          sub={`부동산판 심리 지표: 100 초과 = 사려는 사람이 더 많음(매도자 우위) · 100 미만 = 팔려는 사람이 더 많음(매수자 우위). 기준월 ${d.sentiment.asOfMonth}.`}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {d.sentiment.latest.map(x => (
              <span key={x.name} style={{ background: TK.bg3, border: `1px solid ${x.value >= 100 ? `${TK.red400}55` : `${TK.green400}55`}`, borderRadius: 8, padding: '5px 11px', fontSize: 11.5, fontWeight: 800, color: x.value >= 100 ? TK.red400 : TK.green400 }}>
                {x.name} {x.value}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.sentiment.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.floor(d.sentiment.series.length / 8)} />
              <YAxis tick={{ fill: TK.sub, fontSize: 10 }} width={40} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={100} stroke={TK.yellow500} strokeDasharray="4 4" label={{ value: '균형 100', fill: TK.yellow500, fontSize: 10, position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="전국" stroke={TK.slate200} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="서울" stroke={TK.orange400} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="수도권" stroke={TK.blue400} strokeWidth={1.6} dot={false} connectNulls />
              <Line type="monotone" dataKey="지방권" stroke={TK.green400} strokeWidth={1.6} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
            🎓 주식의 공포탐욕 지수에 해당 — <b style={{ color: TK.slate300 }}>벌집순환(거래량)·적정성(밸류)과 교차</b>해 읽으세요:
            수급 과열(110+)에 밸류 상단권이면 상투 경계, 수급 냉각(90−)에 밸류 하단권이면 역발상 관찰 구간. 중개업소 설문 기반 심리 지표(실거래 아님).
          </div>
        </Card>
      )}

      {/* ④ 소비심리지수 */}
      {d.psyche && (
        <Card title="🧠 주택시장 소비심리지수 — 일반 가구가 보는 시장 (국토연구원)"
          sub={`③수급지수가 중개사(공급자 접점)의 현장 체감이라면, 이건 일반 가구·중개업소 설문의 심리 지수(2011-07~ 15년). 공식 3국면: 95 미만 하강 · 95~115 보합 · 115 이상 상승. 기준월 ${d.psyche.asOfMonth}(1~2개월 시차).`}>
          {/* 국면 배지 + 전국 수치 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 170px', background: TK.bg3, border: `1px solid ${d.psyche.phase === '상승국면' ? TK.red400 : d.psyche.phase === '하강국면' ? TK.blue400 : TK.yellow500}55`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ color: TK.sub, fontSize: 10.5, fontWeight: 700 }}>전국 국면(공식 기준)</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: d.psyche.phase === '상승국면' ? TK.red400 : d.psyche.phase === '하강국면' ? TK.blue400 : TK.yellow500 }}>
                {d.psyche.phase === '상승국면' ? '🔥 상승국면' : d.psyche.phase === '하강국면' ? '❄️ 하강국면' : '⚖️ 보합국면'}
              </div>
              <div style={{ color: TK.sub9, fontSize: 10.5 }}>전국 지수 <b style={{ color: TK.slate200, fontFamily: 'monospace' }}>{d.psyche.national ?? '—'}</b></div>
            </div>
            {/* 최신월 지역 스냅샷 — 높은 순 */}
            <div style={{ flex: '3 1 320px', display: 'flex', flexWrap: 'wrap', gap: 5, alignContent: 'flex-start' }}>
              {d.psyche.latest.map(x => (
                <span key={x.name} style={{
                  background: TK.bg3, borderRadius: 7, padding: '4px 8px', fontSize: 10.5, fontWeight: 700,
                  border: `1px solid ${x.value >= 115 ? `${TK.red400}66` : x.value < 95 ? `${TK.blue400}66` : BORDER}`,
                  color: x.value >= 115 ? TK.red400 : x.value < 95 ? TK.blue400 : TK.slate300,
                }}>{x.name} {x.value}</span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.psyche.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={TK.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: TK.sub, fontSize: 9.5 }} interval={Math.floor(d.psyche.series.length / 8)} />
              <YAxis tick={{ fill: TK.sub, fontSize: 10 }} width={40} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11 }} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={115} stroke={TK.red400} strokeDasharray="4 4" label={{ value: '상승 115', fill: TK.red400, fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine y={95} stroke={TK.blue400} strokeDasharray="4 4" label={{ value: '하강 95', fill: TK.blue400, fontSize: 10, position: 'insideBottomRight' }} />
              <Line type="monotone" dataKey="전국" stroke={TK.slate200} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="서울" stroke={TK.orange400} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="수도권" stroke={TK.blue400} strokeWidth={1.6} dot={false} connectNulls />
              <Line type="monotone" dataKey="지방" stroke={TK.green400} strokeWidth={1.6} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ color: TK.sub, fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
            🎓 <b style={{ color: TK.slate300 }}>수급지수(③)와의 차이</b> — 수급은 &ldquo;지금 사려는 사람 vs 팔려는 사람&rdquo;(현재 수급),
            심리지수는 &ldquo;가격이 오를 것 같은가&rdquo;(기대·전망 포함)를 묻습니다. 둘이 어긋나는 구간(수급은 식는데 심리는 낙관)이 전환점 단서.
            2011-07부터 15년 — 2013 바닥(하강)→2015·2020 과열(상승)→2022 급랭 사이클이 한 차트에. 설문 지표(실거래 아님)·발표 1~2개월 시차 · 교육용 관측.
          </div>
        </Card>
      )}
    </div>
  )
}
