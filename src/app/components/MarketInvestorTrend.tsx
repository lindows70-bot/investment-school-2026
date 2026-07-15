'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
// 🏛️ 코스피/코스닥 투자자별 매매동향 — 개인·외국인·기관 일별 순매수 + 외국인 누적 타임라인(네이버페이 스타일)
import { useState, useEffect } from 'react'
import { ResponsiveContainer, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, Cell as RCell } from 'recharts'
import type { MarketInvestorResult, InvestorRow } from '@/app/api/market-investor-trend/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const BUY = TK.red500, SELL = TK.blue500   // 한국 관례: 매수=빨강, 매도=파랑

// 순매수 금액(억원) 포맷
const fmtEok = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : v > 0 ? '+' : ''
  if (a >= 10000) return `${s}${(a / 10000).toFixed(2)}조`
  return `${s}${Math.round(a).toLocaleString()}억`
}
const sgnColor = (v: number) => Math.abs(v) < 0.5 ? TK.slate500 : v > 0 ? BUY : SELL

// 네이버페이 화면의 투자자 구분(기관계는 세부합이라 막대에선 세부만 표시)
const BAR_KEYS: { key: keyof InvestorRow; label: string }[] = [
  { key: 'personal', label: '개인' },
  { key: 'foreign', label: '외국인' },
  { key: 'finInvest', label: '금융투자' },
  { key: 'insurance', label: '보험' },
  { key: 'trust', label: '투신' },
  { key: 'bank', label: '은행' },
  { key: 'otherFin', label: '기타금융' },
  { key: 'pension', label: '연기금등' },
  { key: 'otherCorp', label: '기타법인' },
]

// 기간별 집계 — 라벨, 누적 거래일 수(대략)
const PERIODS = [
  { key: '1d', label: '1일', days: 1 },
  { key: '1w', label: '1주', days: 5 },
  { key: '1m', label: '1개월', days: 20 },
  { key: '3m', label: '3개월', days: 60 },
] as const
type PeriodKey = typeof PERIODS[number]['key']

export default function MarketInvestorTrend() {
  const [market, setMarket] = useState<'KOSPI' | 'KOSDAQ'>('KOSPI')
  const [period, setPeriod] = useState<PeriodKey>('1d')
  const [d, setD] = useState<MarketInvestorResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/market-investor-trend?market=${market}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [market])

  const latest = d?.rows[0]
  // 선택 기간만큼 슬라이스 후 투자자별 순매수 합산(원본 네이버페이의 1일/1주/1개월/3개월과 동일)
  const pCfg = PERIODS.find(p => p.key === period)!
  const slice = d ? d.rows.slice(0, Math.min(pCfg.days, d.rows.length)) : []
  const barData = BAR_KEYS.map(b => ({ name: b.label, val: Math.round(slice.reduce((s, r) => s + (r[b.key] as number), 0) * 10) / 10 }))
  const barMaxAbs = Math.max(1, ...barData.map(b => Math.abs(b.val)))
  const axisFmt = (v: number) => barMaxAbs >= 10000 ? `${(v / 10000).toFixed(1)}조` : `${Math.round(v).toLocaleString()}억`
  const rangeLabel = slice.length >= 2 ? `${slice[slice.length - 1].date.slice(5)} ~ ${slice[0].date.slice(5)} (${slice.length}거래일)` : slice[0]?.date ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 + 시장 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🏛️</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 16 }}>투자자별 매매동향</span>
        <span style={{ color: TK.sub2, fontSize: 11 }}>일별 순매수 · 단위 억원 · 빨강=순매수/파랑=순매도</span>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, background: TK.bg3, padding: 4, borderRadius: 9, border: `1px solid ${BORDER}` }}>
          {(['KOSPI', 'KOSDAQ'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMarket(m)}
              style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: market === m ? TK.border : 'transparent', color: market === m ? TK.slate200 : TK.sub3 }}>
              {m === 'KOSPI' ? '코스피' : '코스닥'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub, fontSize: 12 }}>🏛️ {market} 투자자별 매매동향을 불러오는 중…</div>}
      {!loading && !d && <div style={{ background: CARD, borderRadius: 12, padding: 24, border: `1px solid ${BORDER}`, color: TK.sub, fontSize: 12 }}>매매동향 데이터를 불러오지 못했습니다 — 잠시 후 새로고침해주세요.</div>}

      {!loading && d && latest && (<>
        {/* ① 투자자별 순매수 막대 (1일/1주/1개월/3개월) */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>📊 투자자별 순매수</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>{pCfg.label} 합산 · {rangeLabel}</span>
            <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 3, background: TK.bg3, padding: 3, borderRadius: 8, border: `1px solid ${BORDER}` }}>
              {PERIODS.map(p => (
                <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                  style={{ padding: '4px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: period === p.key ? TK.border : 'transparent', color: period === p.key ? TK.slate200 : TK.sub3 }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 18, right: 8, bottom: 0, left: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: TK.slate400 }} interval={0} angle={-18} textAnchor="end" height={42} />
              <YAxis tick={{ fontSize: 9, fill: TK.slate500 }} tickFormatter={axisFmt} width={52} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, fontSize: 11, padding: '6px 10px' }}
                formatter={((v: number) => [fmtEok(v), '순매수']) as any} />
              <ReferenceLine y={0} stroke={TK.slate600} />
              <Bar dataKey="val" radius={[3, 3, 0, 0]} label={((props: any) => {
                const { x, y, width, height, value } = props
                if (Math.abs(value) < barMaxAbs * 0.05) return null   // 0 근처(은행 등)는 라벨 생략
                // recharts 3.8: y=값쪽 끝, height=base−value(음수면 음수). 0선 = y + height (양·음 공통).
                //  양수=막대 꼭대기(y) 위 / 음수=0선 위 → 항상 0선 위쪽이라 막대·X축 글자와 안 겹침.
                const ty = (value >= 0 ? y : y + height) - 6
                return <text x={x + width / 2} y={ty} textAnchor="middle" fontSize={9} fontWeight={700} fill={sgnColor(value)}>{fmtEok(value)}</text>
              }) as any}>
                {barData.map((e, i) => <RCell key={i} fill={sgnColor(e.val)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ②-A 🏛️ 국민연금(연기금) 누적 순매수 추세 — 코스피 큰손 수급 */}
        {d.pensionCumSeries && d.pensionCumSeries.length > 0 && (() => {
          const recent5 = d.rows.slice(0, 5).reduce((s, r) => s + r.pension, 0)
          const recent20 = d.rows.slice(0, 20).reduce((s, r) => s + r.pension, 0)
          return (
            <div style={{ background: CARD, borderRadius: 12, border: '1px solid rgba(167,139,250,0.35)', padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ color: TK.violet400, fontWeight: 800, fontSize: 13 }}>🏛️ 국민연금(연기금) 누적 순매수 추세</span>
                <span style={{ color: TK.sub, fontSize: 10.5 }}>코스피 큰손 · 우상향=매집/우하향=매도</span>
                <span style={{ marginLeft: 'auto', color: sgnColor(d.cum.pension), fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>
                  {d.rows.length}일 누적 {fmtEok(d.cum.pension)}
                </span>
              </div>
              {/* 최근 5일/20일 요약 칩 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {([['최근 5일', recent5], ['최근 20일', recent20]] as const).map(([lab, v]) => (
                  <span key={lab} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg3, border: `1px solid ${sgnColor(v)}44`, borderRadius: 8, padding: '3px 9px', fontSize: 11 }}>
                    <span style={{ color: TK.slate300, fontWeight: 700 }}>{lab}</span>
                    <span style={{ color: sgnColor(v), fontWeight: 800, fontFamily: 'monospace' }}>{fmtEok(v)}</span>
                    <span style={{ color: TK.sub2, fontSize: 10 }}>{v > 0 ? '순매수' : v < 0 ? '순매도' : '중립'}</span>
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={d.pensionCumSeries} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
                  <defs>
                    <linearGradient id="pcum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TK.violet400} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={TK.violet400} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: TK.slate500 }} tickFormatter={s => s.slice(5)} interval={Math.max(0, Math.floor(d.pensionCumSeries.length / 8))} />
                  <YAxis tick={{ fontSize: 9, fill: TK.slate500 }} tickFormatter={v => `${(v / 10000).toFixed(1)}조`} />
                  <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, fontSize: 11, padding: '6px 10px' }}
                    formatter={((v: number) => [fmtEok(v), '연기금 누적']) as any} labelFormatter={l => l as string} />
                  <ReferenceLine y={0} stroke={TK.slate600} strokeDasharray="3 3" />
                  <Area dataKey="cum" stroke={TK.violet400} strokeWidth={2} fill="url(#pcum)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 6, lineHeight: 1.6 }}>
                ※ &lsquo;연기금등&rsquo; = 국민연금(NPS) 주력 + 사학·공무원·우정사업 연기금 합산(국민연금이 압도적 비중). 종목별 국민연금 매매는 글로벌 시총 Top10 탭의 🏛️ 국민연금 대시보드(DART 5%룰) 참조.
              </div>
            </div>
          )
        })()}

        {/* ② 외국인 누적 순매수 타임라인 — 핵심 */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ color: TK.amber500, fontWeight: 800, fontSize: 13 }}>🌍 외국인 누적 순매수 추세</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>최근 {d.rows.length}거래일 · 우상향=매집/우하향=이탈</span>
            <span style={{ marginLeft: 'auto', color: sgnColor(d.cum.foreign), fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>
              누적 {fmtEok(d.cum.foreign)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={d.foreignCumSeries} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
              <defs>
                <linearGradient id="fcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TK.amber500} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={TK.amber500} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: TK.slate500 }} tickFormatter={s => s.slice(5)} interval={Math.max(0, Math.floor(d.foreignCumSeries.length / 8))} />
              <YAxis tick={{ fontSize: 9, fill: TK.slate500 }} tickFormatter={v => `${(v / 10000).toFixed(1)}조`} />
              <Tooltip contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, fontSize: 11, padding: '6px 10px' }}
                formatter={((v: number) => [fmtEok(v), '외국인 누적']) as any} labelFormatter={l => l as string} />
              <ReferenceLine y={0} stroke={TK.slate600} strokeDasharray="3 3" />
              <Area dataKey="cum" stroke={TK.amber500} strokeWidth={2} fill="url(#fcum)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ③ 일별 매매동향 표 (개인/외국인/기관) */}
        <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '13px 15px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 13 }}>📅 일별 매매동향</span>
            {([['개인', d.cum.personal], ['외국인', d.cum.foreign], ['기관', d.cum.institution]] as const).map(([lab, v]) => (
              <span key={lab} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg3, border: `1px solid ${sgnColor(v)}44`, borderRadius: 8, padding: '3px 9px', fontSize: 11 }}>
                <span style={{ color: TK.slate300, fontWeight: 700 }}>{lab}</span>
                <span style={{ color: sgnColor(v), fontWeight: 800, fontFamily: 'monospace' }}>{fmtEok(v)}</span>
              </span>
            ))}
            <span style={{ color: TK.sub2, fontSize: 10 }}>← {d.rows.length}일 누적</span>
          </div>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr 1fr', gap: 8, padding: '0 2px 6px', fontSize: 10.5, color: TK.sub2, borderBottom: `1px solid ${BORDER}` }}>
            <span>날짜</span>
            <span style={{ textAlign: 'right' }}>개인</span>
            <span style={{ textAlign: 'right', color: TK.amber500 }}>외국인</span>
            <span style={{ textAlign: 'right' }}>기관</span>
            <span style={{ textAlign: 'right', color: TK.violet400 }}>연기금</span>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {d.rows.map(r => (
              <div key={r.date} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr 1fr', gap: 8, padding: '7px 2px', alignItems: 'center', borderBottom: '1px solid #131922' }}>
                <span style={{ color: TK.sub5, fontSize: 11, fontFamily: 'monospace' }}>{r.date.slice(5)}</span>
                <TableCell v={r.personal} />
                <TableCell v={r.foreign} highlight />
                <TableCell v={r.institution} />
                <TableCell v={r.pension} />
              </div>
            ))}
          </div>
          <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 8, lineHeight: 1.6 }}>
            ※ 데이터: 네이버 금융 일별 투자자 매매동향(무료) · 단위 억원 · 개인+외국인+기관+기타법인 = 0(시장 순매수 합) · 6h 캐시 · 교육용.
          </div>
        </div>
      </>)}
    </div>
  )
}

// 표 셀 — 금액 + 비례 막대
function TableCell({ v, highlight }: { v: number; highlight?: boolean }) {
  const c = sgnColor(v)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span style={{ color: c, fontWeight: highlight ? 800 : 700, fontSize: 11.5, fontFamily: 'monospace' }}>{fmtEok(v)}</span>
    </div>
  )
}
