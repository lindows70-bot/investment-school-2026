'use client'
// ⏳ 투자 타임머신 — 내 실제 보유 종목을 5년 전부터 보유했다면? Core/Satellite/벤치마크 실데이터 백테스트
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import type { BacktestResult } from '@/app/api/portfolio-backtest/route'

const CARD = '#161b25', BORDER = '#1e293b'
const fmtMan = (won: number) => `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`

const LINES = [
  { key: 'total', name: '내 포트폴리오 (실보유)', color: '#10b981', width: 2.6 },
  { key: 'core',  name: 'Core (ETF·우량주)',     color: '#deff9a', width: 1.8 },
  { key: 'sat',   name: 'Satellite (성장·테마)', color: '#38bdf8', width: 1.8 },
  { key: 'bench', name: '시장 평균 (벤치마크)',   color: '#7f93a8', width: 1.6, dash: true },
] as const

export default function PortfolioTimeMachine() {
  const [d, setD] = useState<BacktestResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Record<string, boolean>>({ total: true, core: true, sat: true, bench: true })

  useEffect(() => {
    let alive = true
    const load = () => {
      setLoading(true)
      fetch('/api/portfolio-backtest', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (!alive) return; if (j.error) { setErr(j.error); setD(null) } else { setErr(null); setD(j) } })
        .catch(() => { if (alive) { setErr('fetch'); setD(null) } })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 14, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>⏳ 내 종목의 5개년 실데이터를 불러오는 중…(최초 1회 다소 소요)</div>
  if (err === 'no_holdings') return <div style={{ background: CARD, borderRadius: 14, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>분석할 보유 종목이 없습니다 — 자산관리에서 종목을 추가하면 5개년 타임머신이 작동합니다.</div>
  if (err === 'insufficient_history' || err) return <div style={{ background: CARD, borderRadius: 14, padding: 24, border: `1px solid ${BORDER}`, color: '#8a9aaa', fontSize: 12 }}>5개년 백테스트에 필요한 과거 가격 데이터가 부족합니다(최근 상장 종목 위주이거나 데이터 소스 일시 오류).</div>
  if (!d) return null

  const cards = [
    { k: 'total', label: '내 포트폴리오', s: d.summary.total, color: '#10b981' },
    { k: 'core',  label: 'Core',          s: d.summary.core,  color: '#a3e635' },
    { k: 'sat',   label: 'Satellite',     s: d.summary.sat,   color: '#38bdf8' },
    { k: 'bench', label: '시장 평균',      s: d.summary.bench, color: '#7f93a8' },
  ].filter(c => c.s)

  return (
    <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>투자 타임머신 — 내 종목 {Number(d.endYear) - Number(d.startYear) + 1}개년 실데이터 백테스트</span>
          </div>
          <div style={{ fontSize: 11, color: '#7f93a8' }}>{d.startYear}년 초 1,000만 원 투자 가정 · {d.benchLabel}</div>
          <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 6, padding: '3px 9px' }}>
            <span style={{ fontSize: 11 }}>📌</span>
            <span style={{ fontSize: 10.5, color: '#9fd6e3', lineHeight: 1.5 }}>
              분석 대상 = <b>&lsquo;자산관리&rsquo;에 등록된 현재 내 보유 종목 전체</b> — 직접 추가한 종목과 🛰️퀀트 빌더에서 &lsquo;복사하기&rsquo;로 담은 종목이 모두 포함됩니다.
            </span>
          </div>
        </div>
        {/* 라인 토글 */}
        <div style={{ display: 'flex', gap: 4, background: '#0f172a', padding: 4, borderRadius: 9, flexWrap: 'wrap' }}>
          {LINES.filter(l => l.key === 'total' || l.key === 'bench' || cards.some(c => c.k === l.key)).map(l => (
            <button key={l.key} type="button" onClick={() => setActive(p => ({ ...p, [l.key]: !p[l.key] }))}
              style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: active[l.key] ? '#1e293b' : 'transparent', color: active[l.key] ? l.color : '#8599ae' }}>{l.name.replace(/ \(.*/, '')}</button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length},1fr)`, gap: 10, padding: '14px 20px 0' }}>
        {cards.map(c => (
          <div key={c.k} style={{ padding: '10px 12px', borderRadius: 10, background: '#0f172a', border: `1.5px solid ${c.color}33` }}>
            <div style={{ fontSize: 10, color: '#7f93a8', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', fontFamily: 'monospace' }}>{fmtMan(c.s!.final)}원</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid #1f2937', fontSize: 10 }}>
              <span style={{ fontWeight: 700, color: c.s!.retPct >= 0 ? c.color : '#f87171' }}>{c.s!.retPct >= 0 ? '+' : ''}{c.s!.retPct}%</span>
              <span style={{ color: '#8599ae' }}>CAGR <b style={{ color: '#94a3b8' }}>{c.s!.cagrPct}%</b></span>
            </div>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ background: '#0f172a', borderRadius: 12, border: '1px solid #1f2937', padding: '14px 4px 8px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.points} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="year" tick={{ fill: '#7f93a8', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => fmtMan(v)} tick={{ fill: '#7f93a8', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} width={52} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #7a8fa3', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8', fontWeight: 700 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${fmtMan(v)}원`, String(name)]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} formatter={(val) => <span style={{ color: '#8a9aaa' }}>{val}</span>} />
              <ReferenceLine y={d.startCapital} stroke="#2d3a50" strokeDasharray="4 2" label={{ value: '원금', position: 'insideLeft', fill: '#6e7f8f', fontSize: 9 }} />
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
        <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 15px', color: '#dbe3ec', fontSize: 12, lineHeight: 1.75 }}>
          🎓 <b style={{ color: '#4ade80' }}>타임머신 인사이트</b> — {d.insight}
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ {d.coverage} · 연도별 실제 평균가(Yahoo·Naver) 기준 · {d.benchLabel} · <b>현재 보유 종목을 과거에 그대로 보유했다고 가정</b>(생존편향·후견편파 존재 — 과거 성과가 미래를 보장하지 않음) · 매매·세금·배당 재투자 미반영 · 교육용 시뮬레이션이며 투자 추천이 아닙니다.
      </div>
    </div>
  )
}
