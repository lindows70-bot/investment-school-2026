'use client'
// 🏦 비트코인 현물 ETF — ① 순유입/유출(Farside·최근 일별) ② 누적 거래량(Yahoo 전체·TheBlock 재현)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, Line, Cell, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from 'recharts'
import type { BtcEtfResult } from '@/app/api/btc-etf/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
/** 현물 BTC ETF 티커 → 운용사(정적 참조 데이터 — 상품 목록 자체는 Farside 헤더에서 동적으로 온다) */
const ISSUER_KO: Record<string, string> = {
  IBIT: '블랙록', FBTC: '피델리티', BITB: '비트와이즈', ARKB: 'ARK·21Shares', BTCO: '인베스코',
  EZBC: '프랭클린', BRRR: '발키리', HODL: '반에크', BTCW: '위즈덤트리', MSBT: '모건스탠리',
  GBTC: '그레이스케일', BTC: '그레이스케일 미니',
}
const fmtT = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : `$${(v / 1e6).toFixed(0)}M`
const fmtM = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + 'B' : v.toFixed(0) + 'M'}`
const mmdd = (d: string) => d.slice(5)
/* eslint-disable @typescript-eslint/no-explicit-any */
const flowTip = (val: any, n: any) => n === 'BTC 가격' ? [`$${Math.round(val).toLocaleString()}`, n] : [fmtM(val), '순유입']
const cumTip = (val: any) => [fmtT(val), '누적 거래량']
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function BtcEtfFlows() {
  const [d, setD] = useState<BtcEtfResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/btc-etf', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px', color: TK.sub, fontSize: 12 }}>🏦 비트코인 현물 ETF 데이터를 불러오는 중…</div>
  if (!d || d.cumVolume.length === 0) return null

  const flowHasData = d.flow.length > 0
  const cumLatest = d.cumVolume[d.cumVolume.length - 1]?.cum ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ① 순유입/유출 — Farside 최근 일별 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13.5 }}>🏦 현물 ETF 순유입/유출</span>
          <span style={{ color: TK.sub, fontSize: 11 }}>{d.flowWindowDays > 30 ? '2024 출범~현재' : `최근 ${d.flowWindowDays}거래일`} · Farside</span>
          {d.flowCumulative != null && (
            <span style={{ marginLeft: 'auto', color: d.flowCumulative >= 0 ? TK.green400 : TK.red400, fontWeight: 800, fontSize: 12 }}>
              출범 이후 누적 순유입 {fmtM(d.flowCumulative)}
            </span>
          )}
        </div>
        <div style={{ color: TK.sub2, fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          🟢 유입(기관 자금 들어옴) / 🔴 유출 · 노란선=BTC 가격. <b style={{ color: TK.sub5 }}>가격의 방향이 아니라 &lsquo;연료&rsquo;</b>를 봅니다 — 지속 유입은 제도권 수요, 유출 전환은 수요 둔화 신호.
        </div>
        {flowHasData ? (
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={d.flow} margin={{ top: 6, right: 8, left: 4, bottom: 2 }}>
              <XAxis dataKey="date" tickFormatter={d.flowWindowDays > 30 ? (v: string) => v.slice(0, 7) : mmdd} tick={{ fill: TK.sub3, fontSize: 10 }} minTickGap={d.flowWindowDays > 30 ? 48 : 8} />
              <YAxis yAxisId="flow" tick={{ fill: TK.sub3, fontSize: 10 }} tickFormatter={(v: number) => `${v}M`} width={48} />
              <YAxis yAxisId="px" orientation="right" domain={['auto', 'auto']} tick={{ fill: TK.amber400, fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={42} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
                formatter={flowTip} labelStyle={{ color: TK.slate300 }} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              <ReferenceLine yAxisId="flow" y={0} stroke={TK.slate600} />
              <Bar yAxisId="flow" dataKey="net" name="순유입/유출" radius={[2, 2, 0, 0]}>
                {d.flow.map((f, i) => <Cell key={i} fill={f.net >= 0 ? TK.green500 : TK.red500} />)}
              </Bar>
              <Line yAxisId="px" dataKey="price" name="BTC 가격" stroke={TK.amber400} strokeWidth={1.8} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: TK.sub, fontSize: 11.5, padding: '8px 0' }}>일별 유입/유출 데이터를 일시적으로 불러오지 못했습니다(누적 순유입 {d.flowCumulative != null ? fmtM(d.flowCumulative) : '—'}만 표시).</div>
        )}
      </div>

      {/* ② 누적 거래량 — Yahoo 전체 이력 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13.5 }}>📈 현물 ETF 누적 거래량</span>
          <span style={{ color: TK.sub, fontSize: 11 }}>2024 출범~현재 · Yahoo</span>
          <span style={{ marginLeft: 'auto', color: TK.blue400, fontWeight: 800, fontSize: 13 }}>{fmtT(cumLatest)}</span>
        </div>
        <div style={{ color: TK.sub2, fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
          출범 이후 거래대금 누적 합계 — 우상향이 가팔라질수록 <b style={{ color: TK.sub5 }}>제도권 거래가 활발</b>해진다는 의미(시장 성숙도).
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={d.cumVolume} margin={{ top: 6, right: 10, left: 6, bottom: 2 }}>
            <defs>
              <linearGradient id="cumVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TK.blue500} stopOpacity={0.4} />
                <stop offset="100%" stopColor={TK.blue500} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(0, 7)} tick={{ fill: TK.sub3, fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fill: TK.sub3, fontSize: 10 }} tickFormatter={fmtT} width={48} />
            <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
              formatter={cumTip} labelStyle={{ color: TK.slate300 }} />
            <Area dataKey="cum" stroke={TK.blue400} strokeWidth={2} fill="url(#cumVol)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 🏷️ 발행사별 분해 — 어느 창구로 돈이 들어오나(코인글래스 표와 같은 구조, 2026-08-21 사용자 요청).
          합계 검산(발행사 합 = Total)을 통과한 행만 서버가 내려보낸다 — 컬럼이 밀리면 조용한 거짓말이 되므로. */}
      {d.issuers?.length > 0 && d.issuerRecent?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: TK.slate200, marginBottom: 4 }}>
            🏷️ 발행사별 순유입 <span style={{ fontSize: 9.5, fontWeight: 600, color: TK.sub3 }}>최근 {d.issuerRecent.length}영업일 · 단위 $M · 초록=유입 / 빨강=유출</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 10, fontVariantNumeric: 'tabular-nums', minWidth: 640 }}>
              <thead>
                <tr style={{ color: TK.sub3 }}>
                  <th style={{ textAlign: 'left', padding: '3px 6px', position: 'sticky', left: 0, background: CARD }}>날짜</th>
                  {/* 티커만 있으면 학생은 누구 상품인지 모른다 → 운용사명을 아래 줄에 병기(2026-08-22 화면검증).
                      ⚠️ 정적 참조 데이터(상품↔운용사)라 제1원칙 예외 — 목록 자체는 Farside 헤더에서 동적으로 온다 */}
                  {d.issuers.map(t => (
                    <th key={t} style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 700 }}>
                      {t}
                      <div style={{ fontSize: 8, fontWeight: 500, color: TK.sub4 }}>{ISSUER_KO[t] ?? ''}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 800, color: TK.slate300 }}>총</th>
                </tr>
              </thead>
              <tbody>
                {d.issuerRecent.map(r => {
                  const tot = r.v.reduce((a, b) => a + b, 0)
                  return (
                    <tr key={r.date} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '3px 6px', color: TK.sub2, position: 'sticky', left: 0, background: CARD }}>{r.date.slice(5)}</td>
                      {r.v.map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '3px 6px', color: v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.sub4 }}>
                          {v === 0 ? '·' : `${v > 0 ? '+' : ''}${v}`}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 800, color: tot > 0 ? TK.green400 : tot < 0 ? TK.red400 : TK.sub4 }}>
                        {tot > 0 ? '+' : ''}{Math.round(tot * 10) / 10}
                      </td>
                    </tr>
                  )
                })}
                {d.issuerTotals?.length === d.issuers.length && (
                  <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                    <td style={{ padding: '4px 6px', fontWeight: 800, color: TK.slate300, position: 'sticky', left: 0, background: CARD }}>출범 누적</td>
                    {d.issuerTotals.map((v, i) => (
                      <td key={i} style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 700, color: v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.sub4 }}>
                        {v >= 1000 || v <= -1000 ? `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}B` : `${v > 0 ? '+' : ''}${Math.round(v)}`}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 900, color: TK.slate200 }}>
                      {d.flowCumulative != null ? `${(d.flowCumulative / 1000).toFixed(1)}B` : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9.5, color: TK.sub4, marginTop: 3 }}>
            누적 행은 십억 달러(B) 표기 · GBTC는 기존 신탁이 ETF로 전환돼 <b style={{ color: TK.sub2 }}>대규모 유출이 정상</b>입니다(신규 창구와 성격이 다름).
          </div>
        </div>
      )}

      <div style={{ color: TK.sub, fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 순유입/유출=Farside Investors 공개 데이터(현물 BTC ETF 순창출/환매, 2024 출범~현재 전체 일별) · 누적 거래량=Yahoo Finance 현물 ETF 10종 거래대금 합산(TheBlock과 동일 출처) · 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}
