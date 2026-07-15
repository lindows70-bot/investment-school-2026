'use client'
// 🎯 알파 헌터 — 가치 성장률 vs 1년 주가 수익률 괴리 산점도 + 알파/거품 리스트
import { useState, useEffect } from 'react'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ReferenceLine, Cell } from 'recharts'
import type { AlphaHunterResult, AlphaPoint } from '@/app/api/alpha-hunter/route'
import { TK } from '@/lib/theme'

const CARD = TK.bg6, BORDER = TK.border
const ZONE = {
  alpha:   { c: TK.green500, label: '🟢 저평가 알파', desc: '가치는 오르는데 주가가 안 따라옴' },
  knife:   { c: TK.orange400, label: '🔪 떨어지는 칼날', desc: '저평가지만 주가 급락 추세 — 시장이 아는 악재일 수 있음' },
  bubble:  { c: TK.red500, label: '🔴 거품 경계', desc: '주가가 가치보다 과도하게 펌핑' },
  caution: { c: TK.amber400, label: '⚠️ 기저효과', desc: '이익 폭증이 작년 붕괴 회복(가짜 성장)' },
  fair:    { c: TK.blue400, label: '〰️ 가치-가격 동행', desc: '괴리 작음' },
} as const
/* eslint-disable @typescript-eslint/no-explicit-any */
const dotColor = (z: string) => (ZONE as any)[z]?.c ?? TK.blue400
/* eslint-enable @typescript-eslint/no-explicit-any */
const dnm = (p: AlphaPoint) => p.market === 'KR' ? (p.name || p.ticker).slice(0, 8) : p.ticker

export default function AlphaHunter() {
  const [d, setD] = useState<AlphaHunterResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/alpha-hunter', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (alive) setD(j.error ? null : j) })
        .catch(() => { if (alive) setD(null) })
        .finally(() => { if (alive) setLoading(false) })
    }
    load()
    window.addEventListener('portfolio-updated', load)
    return () => { alive = false; window.removeEventListener('portfolio-updated', load) }
  }, [])

  if (loading) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, color: TK.sub, fontSize: 12 }}>🎯 알파 헌터 — 가치·가격 괴리를 스캔하는 중…</div>
  if (!d || d.points.length === 0) return <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 20, color: TK.sub, fontSize: 12 }}>분석할 종목이 없습니다 — 보유 종목을 추가하거나 잠시 후 새로고침해주세요.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(239,68,68,0.05))', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>알파 헌터 — 가치·가격 괴리 탐지</span>
          <span style={{ color: TK.sub, fontSize: 11.5 }}>내 보유 + 추천 유니버스 {d.points.length}종</span>
        </div>
        <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>
          시장은 늘 효율적이지 않습니다. <b style={{ color: TK.green400 }}>가치(이익)는 오르는데 주가는 안 따라가는 곳</b>이 알파(기회), <b style={{ color: TK.red400 }}>주가만 펌핑된 곳</b>이 거품입니다. &ldquo;주가가 올랐다고 좋은 주식이 아니다&rdquo; — 괴리를 보세요.
        </div>
      </div>

      {/* 산점도 */}
      <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        <div style={{ color: TK.sub2, fontSize: 11, marginBottom: 8 }}>X = 1년 주가 수익률 · Y = 이익 성장률 · <span style={{ color: TK.green400 }}>좌상(저평가)</span> ↔ <span style={{ color: TK.red400 }}>우하(거품)</span></div>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 24, left: 6 }}>
            <XAxis type="number" dataKey="priceReturn" name="주가수익률" unit="%" tick={{ fill: TK.sub3, fontSize: 10 }}
              domain={['dataMin - 10', 'dataMax + 10']} label={{ value: '1년 주가 수익률 →', position: 'insideBottom', offset: -12, fill: TK.sub3, fontSize: 10.5 }} />
            <YAxis type="number" dataKey="growthPct" name="이익성장률" unit="%" tick={{ fill: TK.sub3, fontSize: 10 }} allowDataOverflow
              domain={[(min: number) => Math.max(Math.floor(min - 10), -110), (max: number) => Math.min(Math.ceil(max + 10), 320)]}
              label={{ value: '이익 성장률 ↑', angle: -90, position: 'insideLeft', fill: TK.sub3, fontSize: 10.5 }} width={44} />
            <ZAxis range={[60, 60]} />
            <ReferenceLine x={0} stroke={TK.slate600} strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke={TK.slate600} strokeDasharray="3 3" />
            {/* 대각선(성장=수익률) 위=저평가, 아래=거품 — 시각 보조용 */}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 11.5 }}
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              content={({ payload }: any) => {
                const p: AlphaPoint | undefined = payload?.[0]?.payload
                if (!p) return null
                return (
                  <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 11px', fontSize: 11.5 }}>
                    <div style={{ color: TK.slate200, fontWeight: 800 }}>{dnm(p)} {p.held && <span style={{ color: TK.cyan400, fontSize: 10 }}>· 보유</span>}</div>
                    <div style={{ color: TK.sub5, marginTop: 3 }}>이익성장 {p.growthPct >= 0 ? '+' : ''}{p.growthPct}% · 주가 {p.priceReturn >= 0 ? '+' : ''}{p.priceReturn}%</div>
                    <div style={{ color: dotColor(p.zone), fontWeight: 700, marginTop: 2 }}>괴리 {p.divergence >= 0 ? '+' : ''}{p.divergence}%p · {ZONE[p.zone].label}</div>
                  </div>
                )
              }} />
            <Scatter data={d.points}>
              {d.points.map((p, i) => <Cell key={i} fill={dotColor(p.zone)} fillOpacity={p.held ? 1 : 0.55} stroke={p.held ? TK.slate200 : 'none'} strokeWidth={p.held ? 1.2 : 0} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 10 }}>
          {Object.entries(ZONE).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: TK.sub5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.c, display: 'inline-block' }} />{v.label.replace(/^[^ ]+ /, '')}
            </span>
          ))}
          <span style={{ color: TK.sub }}>· 테두리=내 보유</span>
        </div>
      </div>

      {/* 알파/거품 리스트 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <AlphaList title="🟢 저평가 알파 (🔪=급락 추세, thesis 먼저)" items={d.alpha} color={TK.green500} empty="현재 뚜렷한 저평가 괴리 종목 없음" />
        <AlphaList title="🔴 거품 경계 (분할 익절·추격 자제)" items={d.bubble} color={TK.red500} empty="현재 뚜렷한 거품 종목 없음 ✓" />
      </div>

      <div style={{ color: TK.sub, fontSize: 9.5, lineHeight: 1.5 }}>
        ※ 가치 축=이익 성장률(canonical SSOT) · 가격 축=Yahoo 1년 실제 수익률 · 괴리=성장률−주가수익률(±20%p↑ 신호). ⚠️ <b style={{ color: TK.amber400 }}>기저효과</b>(이익 +100%↑ 일회성)는 가짜 성장이라 제외(노란). 🔪 <b style={{ color: TK.orange400 }}>떨어지는 칼날</b>(주가 −35%↓ 급락)은 &lsquo;싸 보여도 이유가 있다&rsquo; — 저평가로 단정 말고 thesis 확인. 괴리는 평균회귀 보장 안 함 · 교육용, 투자 추천 아님.
      </div>
    </div>
  )
}

function AlphaList({ title, items, color, empty }: { title: string; items: AlphaPoint[]; color: string; empty: string }) {
  return (
    <div style={{ flex: '1 1 320px', background: CARD, borderRadius: 12, border: `1px solid ${color}33`, padding: '12px 14px' }}>
      <div style={{ color: TK.slate200, fontWeight: 800, fontSize: 12.5, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ color: TK.sub, fontSize: 11, padding: '6px 0' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.slice(0, 8).map(p => {
            const knife = p.zone === 'knife'
            const itemColor = knife ? TK.orange400 : color
            return (
            <div key={p.ticker} title={knife ? '괴리상 저평가지만 주가가 1년 -35%↓ 급락 중 — 시장이 아는 악재나 미래 둔화일 수 있으니 thesis(투자 근거)부터 확인하세요.' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: TK.bg3, border: `1px solid ${knife ? `${TK.orange400}44` : BORDER}`, borderRadius: 8, padding: '7px 11px' }}>
              <span style={{ color: TK.slate200, fontWeight: 700, fontSize: 12, minWidth: 56 }}>{dnm(p)}</span>
              {knife && <span style={{ color: TK.orange400, fontSize: 10, fontWeight: 800 }}>🔪 급락</span>}
              {p.held && <span style={{ color: TK.cyan400, fontSize: 9, fontWeight: 700 }}>보유</span>}
              <span style={{ color: TK.sub, fontSize: 10.5 }}>이익 {p.growthPct >= 0 ? '+' : ''}{p.growthPct}% · 주가 {p.priceReturn >= 0 ? '+' : ''}{p.priceReturn}%</span>
              <span style={{ marginLeft: 'auto', color: itemColor, fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>{p.divergence >= 0 ? '+' : ''}{p.divergence}%p</span>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
