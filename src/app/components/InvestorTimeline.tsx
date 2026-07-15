'use client'
// 📅 종목별 투자자(외국인/기관/개인) 일별 매매동향 타임라인 — 누적 요약 + 인라인 막대
import { useState, useEffect } from 'react'
import type { TimelineResult, TimelineRow } from '@/app/api/money-flow/timeline/route'
import { TK } from '@/lib/theme'

const fmtEok = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '+'
  if (a >= 10000) return `${s}${(a / 10000).toFixed(1)}조`
  return `${s}${Math.round(a).toLocaleString()}억`
}
const SUB = { foreign: { label: '외국인', color: TK.amber500 }, organ: { label: '기관', color: TK.cyan400 }, individual: { label: '개인', color: TK.slate400 } } as const

function Cell({ amt, maxAbs }: { amt: number; maxAbs: number }) {
  const buy = amt > 0
  const col = Math.abs(amt) < 0.05 ? TK.slate500 : buy ? TK.green500 : TK.red500
  const w = Math.round((Math.abs(amt) / maxAbs) * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 0 }}>
      <span style={{ color: col, fontWeight: 700, fontSize: 11.5, fontFamily: 'monospace' }}>{fmtEok(amt)}</span>
      <div style={{ width: '100%', height: 3, background: TK.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ marginLeft: 'auto', width: `${w}%`, height: '100%', background: col, borderRadius: 2 }} />
      </div>
    </div>
  )
}

export default function InvestorTimeline({ ticker, name }: { ticker: string; name: string }) {
  const [data, setData] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/money-flow/timeline?ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name)}&days=20`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (alive) { if (j?.rows) setData(j); else setErr(true) } })
      .catch(() => { if (alive) setErr(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, name])

  if (loading) return <div style={{ padding: '10px 14px', color: TK.sub, fontSize: 12 }}>📅 일별 매매동향 불러오는 중…</div>
  if (err || !data) return <div style={{ padding: '10px 14px', color: TK.sub, fontSize: 12 }}>일별 매매동향을 불러오지 못했습니다(국내 개별주식만).</div>

  const maxAbs = Math.max(1, ...data.rows.flatMap(r => [Math.abs(r.foreign), Math.abs(r.organ), Math.abs(r.individual)]))

  return (
    <div style={{ padding: '10px 12px 4px', background: '#0b0e15', borderRadius: 8 }}>
      {/* 누적 요약 카드 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ color: TK.sub2, fontSize: 11, alignSelf: 'center' }}>최근 {data.days}일 누적</span>
        {(['foreign', 'organ', 'individual'] as const).map(k => {
          const v = data.cum[k], cfg = SUB[k], buy = v > 0
          return (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg3, border: `1px solid ${cfg.color}44`, borderRadius: 8, padding: '4px 10px', fontSize: 11.5 }}>
              <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
              <span style={{ color: buy ? TK.green500 : v < 0 ? TK.red500 : TK.sub, fontWeight: 800, fontFamily: 'monospace' }}>{fmtEok(v)}</span>
            </span>
          )
        })}
      </div>

      {/* 테이블 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 84px 84px 84px', gap: 8, padding: '0 2px 5px', fontSize: 10, color: TK.sub2, borderBottom: `1px solid ${TK.border}` }}>
        <span>날짜</span><span>종가(등락)</span>
        <span style={{ textAlign: 'right', color: SUB.foreign.color }}>외국인</span>
        <span style={{ textAlign: 'right', color: SUB.organ.color }}>기관</span>
        <span style={{ textAlign: 'right', color: SUB.individual.color }}>개인</span>
      </div>

      {/* 행 */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {data.rows.map((r: TimelineRow) => {
          const up = (r.changePct ?? 0) > 0
          return (
            <div key={r.date} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 84px 84px 84px', gap: 8, padding: '6px 2px', alignItems: 'center', borderBottom: '1px solid #131922' }}>
              <span style={{ color: TK.sub5, fontSize: 11, fontFamily: 'monospace' }}>{r.date.slice(5)}</span>
              <span style={{ fontSize: 11.5 }}>
                <span style={{ color: TK.slate300, fontFamily: 'monospace' }}>{r.close.toLocaleString()}</span>
                <span style={{ color: r.changePct == null ? TK.slate500 : up ? TK.green500 : TK.red500, marginLeft: 5, fontSize: 10.5 }}>
                  {r.changePct == null ? '' : `${up ? '▲' : '▼'}${Math.abs(r.changePct)}%`}
                </span>
              </span>
              <Cell amt={r.foreign} maxAbs={maxAbs} />
              <Cell amt={r.organ} maxAbs={maxAbs} />
              <Cell amt={r.individual} maxAbs={maxAbs} />
            </div>
          )
        })}
      </div>
      <div style={{ color: TK.sub, fontSize: 9.5, marginTop: 6 }}>※ 대금 = 일별 순매수 수량×종가 추정 · 막대 길이 = 당일 순매수 규모(초록=매수/빨강=매도). 교육용.</div>
    </div>
  )
}
