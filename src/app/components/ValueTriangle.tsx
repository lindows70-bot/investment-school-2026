'use client'
// 🔺 밸류 삼각형 — "1분 주가 계산" 교육 카드. 시가총액·자본·당기순이익 3꼭짓점과 PBR·PER·ROE 3변의 항등식(PBR = PER × ROE)을
//    실데이터로 자동 채움(Zero-Input·제1원칙). 데이터는 buildSignalMetrics SSOT 재사용(신규 판정기 0)
import { useState, useEffect } from 'react'
import type { ValueTriangle as VT } from '@/app/api/value-triangle/route'

const BORDER = '#1e293b'

export default function ValueTriangle({ ticker, market, name, per }: { ticker: string; market: string; name?: string; per?: number | null }) {
  const [d, setD] = useState<VT | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setD(null)
    // per = 화면 상단과 동일한 stock-info PER(제2원칙 앵커) — 순이익·ROE를 여기서 도출해 항등식이 정확히 닫힘
    fetch(`/api/value-triangle?ticker=${encodeURIComponent(ticker)}&market=${market}&name=${encodeURIComponent(name ?? '')}${per != null && per > 0 ? `&per=${per}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setD(j?.pbr != null || j?.roe != null ? j : null) })
      .catch(() => { if (alive) setD(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticker, market, name, per])

  if (loading) return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 22px', marginBottom: 16, color: '#8599ae', fontSize: 12 }}>
      🔺 밸류 삼각형 계산 중…
    </div>
  )
  if (!d || d.marketCap == null || d.equity == null) return null   // 데이터 부족(자본 미확보 등)은 조용히 생략

  const krw = d.currency === 'KRW'
  const fmtBig = (v: number) => {
    if (krw) return v >= 1e12 ? `${(v / 1e12).toFixed(1)}조` : `${Math.round(v / 1e8).toLocaleString()}억`
    return v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${Math.round(v / 1e6).toLocaleString()}M`
  }
  const identity = d.per != null && d.roe != null && d.pbr != null

  // 삼각형 좌표 — 위: 시가총액 / 좌하: 자본 / 우하: 당기순이익
  const W = 460, H = 240
  const top = { x: W / 2, y: 34 }, bl = { x: 84, y: H - 36 }, br = { x: W - 84, y: H - 36 }

  return (
    <div style={{ background: '#141824', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>🔺 밸류 삼각형 — 1분 주가 계산</div>
      <div style={{ fontSize: 11, color: '#8a9aaa', marginBottom: 10, lineHeight: 1.6 }}>
        세 꼭짓점(시가총액·자본·순이익)을 알면 세 변(PBR·PER·ROE)이 자동으로 나옵니다 — <b style={{ color: '#fbbf24' }}>PBR = PER × ROE</b> 항등식.
        둘만 알아도 나머지 하나가 계산되는 구조.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ flex: '1 1 320px', maxWidth: 520 }}>
          {/* 변 3개 */}
          <line x1={top.x} y1={top.y} x2={bl.x} y2={bl.y} stroke="#3b82f6" strokeWidth={2} opacity={0.75} />
          <line x1={top.x} y1={top.y} x2={br.x} y2={br.y} stroke="#f87171" strokeWidth={2} opacity={0.75} />
          <line x1={bl.x} y1={bl.y} x2={br.x} y2={br.y} stroke="#4ade80" strokeWidth={2} opacity={0.75} />
          {/* 변 라벨 — PBR(좌)·PER(우)·ROE(하) */}
          <g fontWeight={800} fontSize={14} textAnchor="middle">
            <text x={(top.x + bl.x) / 2 - 34} y={(top.y + bl.y) / 2} fill="#60a5fa">PBR {d.pbr ?? '—'}</text>
            <text x={(top.x + br.x) / 2 + 36} y={(top.y + br.y) / 2} fill="#f87171">PER {d.per ?? '—'}</text>
            <text x={W / 2} y={bl.y + 26} fill="#4ade80">ROE {d.roe != null ? `${d.roe.toFixed(1)}%` : '—'}</text>
          </g>
          {/* 꼭짓점 3개 */}
          {[
            { p: top, t1: '시가총액', t2: fmtBig(d.marketCap), dy: -14 },
            { p: bl, t1: '자본(자산−부채)', t2: fmtBig(d.equity), dy: 0 },
            { p: br, t1: '당기순이익', t2: d.netIncome != null ? fmtBig(d.netIncome) : '—', dy: 0 },
          ].map((v, i) => (
            <g key={i} textAnchor="middle">
              <circle cx={v.p.x} cy={v.p.y} r={5} fill="#e2e8f0" />
              <text x={v.p.x} y={v.p.y + (i === 0 ? -20 : 20)} fill="#e2e8f0" fontSize={12.5} fontWeight={800}>{v.t1}</text>
              <text x={v.p.x} y={v.p.y + (i === 0 ? -6 : 34)} fill="#fbbf24" fontSize={13} fontWeight={800} fontFamily="monospace">{v.t2}</text>
            </g>
          ))}
        </svg>

        <div style={{ flex: '1 1 220px', fontSize: 11.5, lineHeight: 1.75, color: '#aab6c4' }}>
          <div style={{ marginBottom: 6 }}>
            <b style={{ color: '#60a5fa' }}>PBR</b> = 시가총액 ÷ 자본 <span style={{ color: '#8a9aaa' }}>(1 미만 = 자본보다 싸게 거래)</span><br />
            <b style={{ color: '#f87171' }}>PER</b> = 시가총액 ÷ 순이익 <span style={{ color: '#8a9aaa' }}>(이익 몇 년치 가격인가)</span><br />
            <b style={{ color: '#4ade80' }}>ROE</b> = 순이익 ÷ 자본 <span style={{ color: '#8a9aaa' }}>(자본을 굴리는 효율)</span>
          </div>
          {identity && (
            <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid #fbbf2433', borderRadius: 8, padding: '7px 11px', fontFamily: 'monospace', fontSize: 11.5, color: '#fbbf24' }}>
              검산: {d.per} × {(d.roe! / 100).toFixed(3)} = {(d.per! * d.roe! / 100).toFixed(2)} ≈ PBR {d.pbr}
            </div>
          )}
          {d.isFinancial && (
            <div style={{ marginTop: 6, color: '#fbbf24', fontSize: 11 }}>
              🏦 금융주(보험·은행) — PER 꼭짓점은 왜곡(투자손익·준비금), 이 삼각형에선 <b>PBR 변(자본 대비 가격)</b>이 진짜 평가축입니다.
            </div>
          )}
        </div>
      </div>

      <div style={{ color: '#8a9aaa', fontSize: 10, marginTop: 8, lineHeight: 1.6 }}>
        💡 PER = 화면 상단 지표와 동일(stock-info 기준) · 자본 = 최신 분기 · 순이익·ROE = 시총·PER·자본에서 도출 — 세 비율이 항등식으로 정확히 맞물리게 한 기준으로 계산(도출 ROE는 평균자본 기준 공시 ROE와 다를 수 있음). 시가총액은 Yahoo 기준(KR 일부 오차 가능). 교육용.
      </div>
    </div>
  )
}
