'use client'
// 🕸️ 이종 자산 상관 수렴 레이더 — 5축(주식·채권·금·달러·BTC) 일별 수익률 상관 히트맵(평시↔최근) + 수렴 경보
//    분산투자의 착시("주식+채권+금+코인=분산됐다")를 깨는 방어 레이어. 경보만·현금화 강요 없음.
import { useEffect, useState } from 'react'
import type { CorrRadarResult, CorrAxis } from '@/app/api/correlation-radar/route'
import { TK } from '@/lib/theme'

const BORDER = '#2a2f3a'

// 상관 색: 높은 양(+)=빨강(동조·위험) / 0 근처=회색 / 음(−)=초록(헤지)
function corrColor(r: number | null): string {
  if (r == null) return TK.bg3
  if (r >= 0.7) return '#b91c1c'
  if (r >= 0.5) return '#dc2626'
  if (r >= 0.3) return '#ea580c'
  if (r >= 0.1) return '#a16207'
  if (r > -0.1) return TK.slate600
  if (r > -0.3) return '#0e7490'
  if (r > -0.5) return '#0f766e'
  return '#15803d'
}
const ALERT_META: Record<CorrRadarResult['alert'], { color: string; label: string }> = {
  converging: { color: TK.red400, label: '수렴 경보' },
  watch: { color: TK.amber400, label: '상승 조짐' },
  calm: { color: TK.green500, label: '분산 정상' },
}

function Matrix({ axes, m, title }: { axes: CorrAxis[]; m: (number | null)[][]; title: string }) {
  const cell = 40
  return (
    <div style={{ flex: '1 1 300px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: TK.slate300, marginBottom: 6, textAlign: 'center' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }} />
              {axes.map(a => (
                <th key={a.key} title={a.name} style={{ fontSize: 13, padding: 2, color: TK.sub3 }}>{a.emoji}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.map((ra, i) => (
              <tr key={ra.key}>
                <th title={ra.name} style={{ fontSize: 13, padding: 2, color: TK.sub3, textAlign: 'right', paddingRight: 4 }}>{ra.emoji}</th>
                {axes.map((ca, j) => {
                  const r = m[i][j]
                  return (
                    <td key={ca.key} title={`${ra.name} × ${ca.name}: ${r == null ? '—' : r.toFixed(2)}`}
                      style={{
                        width: cell, height: cell, background: i === j ? TK.bg4 : corrColor(r),
                        border: `1px solid ${TK.bg1}`, textAlign: 'center', fontSize: 10.5, fontWeight: 700,
                        color: i === j ? TK.sub2 : (r != null && Math.abs(r) >= 0.3 ? '#fff' : TK.slate200),
                      }}>
                      {i === j ? '—' : r == null ? '·' : r.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CorrelationRadar() {
  const [data, setData] = useState<CorrRadarResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/correlation-radar').then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => j.error ? setErr(j.error) : setData(j))
      .catch(() => setErr('상관 레이더 데이터를 불러오지 못했습니다.'))
  }, [])

  if (err) return <div style={{ padding: 20, color: TK.sub3, textAlign: 'center', fontSize: 12.5 }}>⚠️ {err}</div>
  if (!data) return <div style={{ padding: 20, color: TK.sub3, textAlign: 'center', fontSize: 12.5 }}>🕸️ 자산군 상관 계산 중…</div>

  const am = ALERT_META[data.alert]
  const nameOf = (k: string) => data.axes.find(a => a.key === k)?.name ?? k
  const emojiOf = (k: string) => data.axes.find(a => a.key === k)?.emoji ?? ''
  const fmt = (x: number | null) => x == null ? '—' : x.toFixed(2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      {/* 헤더 */}
      <div style={{ background: `linear-gradient(135deg,${TK.card},${TK.bg1})`, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: TK.slate100 }}>🕸️ 이종 자산 상관 수렴 레이더</div>
        <div style={{ fontSize: 11.5, color: TK.sub3, marginTop: 4, lineHeight: 1.5 }}>
          주식·채권·금·달러·비트코인 5축의 <b style={{ color: TK.slate300 }}>일별 수익률 상관</b>. 위기엔 이 상관이 <b style={{ color: TK.red400 }}>1로 수렴</b>해
          ‘분산됐다’는 착시가 깨지고 동반 폭락한다. <b style={{ color: TK.slate300 }}>평시 대비 최근 30일 급등</b>을 감시한다.
        </div>
      </div>

      {/* 경보 배너 */}
      <div style={{ background: `${am.color}14`, border: `1px solid ${am.color}55`, borderRadius: 10, padding: '11px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: am.color, background: `${am.color}22`, border: `1px solid ${am.color}55`, borderRadius: 6, padding: '2px 8px' }}>{am.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TK.slate100 }}>{data.headline}</span>
        </div>
        <div style={{ fontSize: 11.5, color: TK.sub2, marginTop: 6, lineHeight: 1.55 }}>{data.note}</div>
      </div>

      {/* 평시↔최근 평균 상관 대비 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: '평시 평균 상관', v: data.meanBaseline, sub: `${data.baselineDays}일` },
          { label: '최근 평균 상관', v: data.meanRecent, sub: `${data.recentDays}일`, hi: true },
          { label: '변화(수렴도)', v: data.meanDelta, sub: '최근−평시', delta: true },
        ].map(k => (
          <div key={k.label} style={{ flex: '1 1 120px', background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: TK.sub3 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.delta ? (k.v != null && k.v >= 0.15 ? TK.red400 : TK.slate100) : (k.hi ? am.color : TK.slate200), marginTop: 2 }}>
              {k.delta && k.v != null && k.v > 0 ? '+' : ''}{fmt(k.v)}
            </div>
            <div style={{ fontSize: 9.5, color: TK.sub4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 상관 히트맵 2개 */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Matrix axes={data.axes} m={data.matrixBaseline} title={`평시 (${data.baselineDays}일)`} />
        <Matrix axes={data.axes} m={data.matrixRecent} title={`최근 (${data.recentDays}일)`} />
      </div>

      {/* 수렴 심한 쌍 Top */}
      <div style={{ background: TK.bg3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: TK.slate300, marginBottom: 8 }}>📊 쌍별 상관 변화 (수렴 심한 순)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.pairs.map((p, i) => {
            const conv = p.delta != null && p.delta >= 0.15
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ minWidth: 160, color: TK.slate200 }}>{emojiOf(p.a)} {nameOf(p.a).replace(/\(.*/, '')} × {emojiOf(p.b)} {nameOf(p.b).replace(/\(.*/, '')}</span>
                <span style={{ color: TK.sub3, minWidth: 46, textAlign: 'right' }}>{fmt(p.baseline)}</span>
                <span style={{ color: TK.sub4 }}>→</span>
                <span style={{ color: p.recent != null && p.recent >= 0.5 ? TK.red400 : TK.slate200, minWidth: 46, fontWeight: 700 }}>{fmt(p.recent)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: conv ? TK.red400 : TK.sub4, marginLeft: 4 }}>
                  {p.delta == null ? '' : (p.delta > 0 ? '▲' : p.delta < 0 ? '▼' : '') + (p.delta > 0 ? '+' : '') + p.delta.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 범례 + 캐비엇 */}
      <div style={{ fontSize: 10, color: TK.sub4, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <span><span style={{ color: '#dc2626' }}>■</span> 높은 양(+)=동조(위험)</span>
          <span><span style={{ color: TK.slate600 }}>■</span> 0 근처=무관</span>
          <span><span style={{ color: '#15803d' }}>■</span> 음(−)=헤지(반대로 움직임)</span>
          {data.hySpread != null && <span>· 신용 스프레드(HY) {data.hySpread.toFixed(2)}%</span>}
        </div>
        ⚠️ 상관은 후행 지표(과거 {data.recentDays}일 창)이며 위기를 예측하지 않는다 — 현재 분산 상태의 관측일 뿐이다.
        경보는 <b style={{ color: TK.sub2 }}>비중·리스크 점검 신호</b>이지 기계적 현금화·매도 지시가 아니다. 💵 달러(UUP)는 위기 때 오히려 오르는 진짜 헤지일 수 있으니 함께 보라.
      </div>
    </div>
  )
}
