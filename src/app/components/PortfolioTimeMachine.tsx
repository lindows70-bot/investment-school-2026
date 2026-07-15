'use client'
// ⏳ 투자 타임머신 — 내 실제 보유 종목을 5년 전부터 보유했다면? Core/Satellite/벤치마크 실데이터 백테스트
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import type { BacktestResult } from '@/app/api/portfolio-backtest/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const fmtMan = (won: number) => `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`

const LINES = [
  { key: 'total', name: '내 포트폴리오 (전체)',   color: TK.emerald500, width: 2.6 },
  { key: 'core',  name: 'Core (ETF·우량주)',     color: TK.neonLime, width: 1.8 },
  { key: 'sat',   name: 'Satellite (성장·테마)', color: TK.sky400, width: 1.8 },
  { key: 'alt',   name: '대안자산 (코인·원자재)', color: TK.amber400, width: 1.6 },
  { key: 'bench', name: '시장 평균 (벤치마크)',   color: TK.sub2, width: 1.6, dash: true },
] as const

export default function PortfolioTimeMachine() {
  const [d, setD] = useState<BacktestResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'real' | 'quant'>('real')   // 내 실제 보유 ↔ AI 퀀트 빌더 추천
  const [active, setActive] = useState<Record<string, boolean>>({ total: true, core: true, sat: true, alt: true, bench: true })

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch(`/api/portfolio-backtest?source=${source}`, { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (!alive) return; if (j.error) { setErr(j.error); setD(null) } else { setErr(null); setD(j) } })
        .catch(() => { if (alive) { setErr('fetch'); setD(null) } })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [source])

  // 출처 토글 — 항상 보이도록 별도 렌더(로딩/에러 상태에서도 전환 가능)
  const SourceToggle = (
    <div style={{ display: 'inline-flex', gap: 4, background: TK.slate900, padding: 4, borderRadius: 9, border: `1px solid ${BORDER}` }}>
      {([['real', '🧑‍💼 내 실제 포트폴리오'], ['quant', '🛰️ AI 퀀트 빌더 추천']] as const).map(([k, label]) => (
        <button key={k} type="button" onClick={() => setSource(k)}
          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
            background: source === k ? TK.border : 'transparent', color: source === k ? (k === 'real' ? TK.emerald500 : TK.cyan400) : TK.sub3 }}>{label}</button>
      ))}
    </div>
  )
  const Frame = (inner: React.ReactNode) => (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: TK.slate100 }}>⏳ 투자 타임머신</span>{SourceToggle}
      </div>
      {inner}
    </div>
  )

  if (loading) return Frame(<div style={{ color: TK.sub, fontSize: 12 }}>⏳ {source === 'quant' ? '퀀트 빌더 추천안' : '내 보유 종목'}의 실데이터를 불러오는 중…(최초 1회 다소 소요)</div>)
  if (err === 'no_holdings') return Frame(<div style={{ color: TK.sub, fontSize: 12 }}>{source === 'quant' ? '퀀트 빌더 추천 데이터를 준비 중입니다 — 잠시 후 다시 시도해주세요.' : '분석할 보유 종목이 없습니다 — 자산관리에서 종목을 추가하면 타임머신이 작동합니다.'}</div>)
  if (err === 'insufficient_history' || err) return Frame(<div style={{ color: TK.sub, fontSize: 12 }}>백테스트에 필요한 과거 가격 데이터가 부족합니다(최근 상장 종목 위주이거나 데이터 소스 일시 오류).</div>)
  if (!d) return Frame(null)

  const cards = [
    { k: 'total', label: '내 포트폴리오', s: d.summary.total, color: TK.emerald500 },
    { k: 'core',  label: 'Core',          s: d.summary.core,  color: TK.lime400 },
    { k: 'sat',   label: 'Satellite',     s: d.summary.sat,   color: TK.sky400 },
    { k: 'alt',   label: '대안자산',       s: d.summary.alt,   color: TK.amber400 },
    { k: 'bench', label: '시장 평균',      s: d.summary.bench, color: TK.sub2 },
  ].filter(c => c.s)

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: TK.slate100 }}>투자 타임머신 — {d.source === 'quant' ? 'AI 퀀트 빌더 추천' : '내 실제 포트폴리오'} {Number(d.endYear) - Number(d.startYear) + 1}개년 백테스트</span>
          </div>
          <div style={{ fontSize: 11, color: TK.sub2 }}>{d.startYear}년 초 1,000만 원 투자 가정 · {d.benchLabel}</div>
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, background: d.source === 'quant' ? 'rgba(34,211,238,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${d.source === 'quant' ? 'rgba(34,211,238,0.25)' : 'rgba(16,185,129,0.25)'}`, borderRadius: 6, padding: '3px 9px' }}>
            <span style={{ fontSize: 11 }}>📌</span>
            <span style={{ fontSize: 10.5, color: d.source === 'quant' ? '#9fd6e3' : TK.green300, lineHeight: 1.5 }}>
              {d.source === 'quant'
                ? <>분석 대상 = <b>🛰️ AI 퀀트 빌더가 추천한 가상 포트폴리오</b> — 내 실제 계좌와 무관하며, DB에 저장되지 않습니다.</>
                : <>분석 대상 = <b>&lsquo;자산관리&rsquo;에 등록된 내 실제 보유 종목</b> — 퀀트 빌더 추천안을 보려면 우측 토글을 누르세요.</>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {SourceToggle}
        {/* 라인 토글 */}
        <div style={{ display: 'flex', gap: 4, background: TK.slate900, padding: 4, borderRadius: 9, flexWrap: 'wrap' }}>
          {LINES.filter(l => l.key === 'total' || l.key === 'bench' || cards.some(c => c.k === l.key)).map(l => (
            <button key={l.key} type="button" onClick={() => setActive(p => ({ ...p, [l.key]: !p[l.key] }))}
              style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: active[l.key] ? TK.border : 'transparent', color: active[l.key] ? l.color : TK.sub3 }}>{l.name.replace(/ \(.*/, '')}</button>
          ))}
        </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length},1fr)`, gap: 10, padding: '14px 20px 0' }}>
        {cards.map(c => (
          <div key={c.k} style={{ padding: '10px 12px', borderRadius: 10, background: TK.slate900, border: `1.5px solid ${c.color}33` }}>
            <div style={{ fontSize: 10, color: TK.sub2, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TK.slate100, fontFamily: 'monospace' }}>{fmtMan(c.s!.final)}원</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${TK.gray800}`, fontSize: 10 }}>
              <span style={{ fontWeight: 700, color: c.s!.retPct >= 0 ? c.color : TK.red400 }}>{c.s!.retPct >= 0 ? '+' : ''}{c.s!.retPct}%</span>
              <span style={{ color: TK.sub3 }}>CAGR <b style={{ color: TK.slate400 }}>{c.s!.cagrPct}%</b></span>
            </div>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ background: TK.slate900, borderRadius: 12, border: `1px solid ${TK.gray800}`, padding: '14px 4px 8px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.points} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={TK.gray800} />
              <XAxis dataKey="year" tick={{ fill: TK.sub2, fontSize: 10 }} axisLine={{ stroke: TK.gray800 }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => fmtMan(v)} tick={{ fill: TK.sub2, fontSize: 10 }} axisLine={{ stroke: TK.gray800 }} tickLine={false} width={52} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: TK.border, border: `1px solid ${TK.sub6}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: TK.slate400, fontWeight: 700 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${fmtMan(v)}원`, String(name)]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={(val) => <span style={{ color: TK.sub }}>{val}</span>} />
              <ReferenceLine y={d.startCapital} stroke="#2d3a50" strokeDasharray="4 2" label={{ value: '원금', position: 'insideLeft', fill: TK.sub, fontSize: 9 }} />
              {LINES.map(l => active[l.key] && (cards.some(c => c.k === l.key)) && (
                <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                  strokeWidth={l.width} strokeDasharray={'dash' in l && l.dash ? '5 3' : undefined}
                  dot={{ r: 2.5, fill: l.color }} activeDot={{ r: 5, fill: l.color }} isAnimationActive connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 인사이트 */}
      <div style={{ padding: '12px 20px 6px' }}>
        <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 15px', color: TK.sub15, fontSize: 12, lineHeight: 1.75 }}>
          🎓 <b style={{ color: TK.green400 }}>타임머신 인사이트</b> — {d.insight}
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', color: TK.sub, fontSize: 10, lineHeight: 1.6 }}>
        ※ {d.coverage} · 연도별 실제 평균가(Yahoo·Naver) 기준 · {d.benchLabel} · <b>{d.source === 'quant' ? '오늘 기준으로 선정된 추천 종목을 과거에 보유했다고 가정' : '현재 보유 종목을 과거에 그대로 보유했다고 가정'}</b>(생존편향·후견편파 존재 — 과거 성과가 미래를 보장하지 않음{d.source === 'quant' ? ', 추천은 현재 시점 선정이라 편파가 특히 큼' : ''}) · 매매·세금·배당 재투자 미반영 · 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
