'use client'
// 🔗 채권 발작 시 상관관계 — 평상시 vs 발작기를 갈라서 본다.
//   ⚠️ 3년 전체 상관 하나만 보면 밋밋하다(TLT↔SPY 0.16). 사용자가 물은 건 "채권이 발작할 때"다.
//   핵심 메시지: 채권이 크게 흔들리는 날엔 **거의 모든 자산의 상관이 +쪽으로 몰린다** = 분산이 사라진다.
import type { BondCorrResult } from '@/lib/bondCorrelation'
import { TK, FS, RAD, SP } from '@/lib/theme'

const GROUP_META: Record<string, { label: string; c: string }> = {
  bond: { label: '채권', c: TK.cyan400 },
  equity: { label: '주식', c: TK.green400 },
  alt: { label: '대체', c: TK.amber400 },
  fx: { label: '통화', c: TK.violet400 },
}
/** 상관 막대 색 — 절대값이 클수록 진하게. 부호는 방향(등락 규약과 무관한 '관계' 지표라 초록/빨강을 쓰지 않는다) */
const corrColor = (v: number | null) => v == null ? TK.sub4 : v >= 0.6 ? TK.orange400 : v >= 0.3 ? TK.amber400 : v >= -0.1 ? TK.sub2 : TK.cyan400

export default function BondCorrelationPanel({ d }: { d: BondCorrResult }) {
  const box = { background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const M = d.move
  // 상관이 발작기에 +쪽으로 몰리는지 요약(핵심 메시지를 데이터에서 뽑는다 — 리터럴 금지)
  const risers = d.rows.filter(r => r.shift != null && r.shift >= 0.1)
  const eq = d.rows.filter(r => r.group === 'equity' && r.stress != null)
  const eqAvgStress = eq.length ? Math.round((eq.reduce((s, r) => s + r.stress!, 0) / eq.length) * 100) / 100 : null
  const eqAvgAll = eq.length ? Math.round((eq.reduce((s, r) => s + (r.all ?? 0), 0) / eq.length) * 100) / 100 : null

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 4 }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🔗 채권이 발작하면 다른 자산은?</b>
        <span style={{ fontSize: FS.micro, color: TK.sub3 }}>{d.from} ~ {d.to} · {d.days}거래일 중 발작 {d.stressDays}일</span>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: SP.md, lineHeight: 1.6 }}>
        미 장기국채(TLT)와 각 자산이 <b style={{ color: TK.sub2 }}>같이 움직인 정도</b>입니다. 왼쪽은 평상시, 오른쪽은 <b style={{ color: TK.orange400 }}>채권이 크게 흔들린 날만</b> 골라 다시 잰 값입니다.
      </div>

      {/* 채권 변동성 국면 */}
      {M && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap', background: TK.bg0, borderRadius: RAD.sm, padding: '8px 12px', marginBottom: SP.md }}>
          <span style={{ fontSize: FS.micro, color: TK.sub3 }}>채권 변동성(MOVE)</span>
          <b style={{ fontSize: FS.lg, color: M.regime === 'stress' ? TK.red400 : M.regime === 'calm' ? TK.green400 : TK.amber400, fontFamily: 'monospace' }}>{M.last}</b>
          <span style={{ fontSize: FS.micro, color: TK.sub4 }}>
            {M.regime === 'stress' ? '발작 국면(120 이상)' : M.regime === 'calm' ? '조용한 국면(80 이하)' : '보통'} · 최근 1년 중 {M.pct1y}% 지점 · {M.date}
          </span>
          <span style={{ fontSize: FS.micro, color: TK.sub4, marginLeft: 'auto' }}>주식의 VIX에 해당하는 채권 공포지수</span>
        </div>
      )}

      {/* 상관 표 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: FS.micro }}>
          <thead>
            <tr style={{ color: TK.sub4 }}>
              {['자산', '평상시', '채권 발작일', '변화', '발작일 평균 등락'].map(h => (
                <th key={h} style={{ textAlign: h === '자산' ? 'left' : 'right', padding: '5px 7px', borderBottom: `1px solid ${TK.line1}`, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map(r => {
              const g = GROUP_META[r.group]
              return (
                <tr key={r.sym} title={r.what}>
                  <td style={{ padding: '5px 7px', color: TK.slate200 }}>
                    <span style={{ color: g.c, fontSize: FS.micro }}>■</span> {r.label}
                    <span style={{ color: TK.sub4, marginLeft: 5, fontFamily: 'monospace', fontSize: FS.micro }}>{r.sym}</span>
                  </td>
                  <td style={{ padding: '5px 7px', textAlign: 'right', fontFamily: 'monospace', color: corrColor(r.all) }}>{r.all != null ? (r.all >= 0 ? '+' : '') + r.all.toFixed(2) : '—'}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: corrColor(r.stress) }}>{r.stress != null ? (r.stress >= 0 ? '+' : '') + r.stress.toFixed(2) : '—'}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'right', fontFamily: 'monospace', color: r.shift == null ? TK.sub4 : Math.abs(r.shift) >= 0.15 ? TK.orange400 : TK.sub3 }}>
                    {r.shift != null ? (r.shift >= 0 ? '▲' : '▼') + Math.abs(r.shift).toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '5px 7px', textAlign: 'right', fontFamily: 'monospace', color: r.stressAvgRet == null ? TK.sub4 : r.stressAvgRet >= 0 ? TK.green400 : TK.red400 }}>
                    {r.stressAvgRet != null ? (r.stressAvgRet >= 0 ? '+' : '') + r.stressAvgRet.toFixed(2) + '%' : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 데이터에서 뽑은 결론 */}
      <div style={{ marginTop: SP.md, padding: '10px 13px', borderRadius: RAD.sm, background: `${TK.orange400}0e`, border: `1px solid ${TK.orange400}33`, fontSize: FS.micro, color: TK.sub2, lineHeight: 1.75 }}>
        💡 <b style={{ color: TK.orange400 }}>읽는 법</b> — 채권 발작일에 <b>{risers.length}개 자산</b>의 상관이 평상시보다 높아졌습니다
        {eqAvgAll != null && eqAvgStress != null && <>(주식군 평균 {eqAvgAll >= 0 ? '+' : ''}{eqAvgAll.toFixed(2)} → <b style={{ color: TK.orange400 }}>{eqAvgStress >= 0 ? '+' : ''}{eqAvgStress.toFixed(2)}</b>)</>}.
        {' '}평소엔 따로 놀던 것들이 <b style={{ color: TK.slate200 }}>채권이 흔들리는 날엔 같이 움직인다</b>는 뜻입니다 —
        정작 분산이 필요한 순간에 분산 효과가 줄어듭니다. &ldquo;여러 자산에 나눠 담았으니 안전하다&rdquo;가 위기의 날엔 덜 통하는 이유입니다.
      </div>

      <div style={{ marginTop: SP.sm, fontSize: FS.micro, color: TK.sub4, lineHeight: 1.7 }}>
        {d.notes.map((n, i) => <div key={i}>{i === d.notes.length - 1 ? '' : '· '}{n}</div>)}
        <div style={{ marginTop: 3 }}>최근 큰 발작일: {d.recentStress.map(s => `${s.date} (TLT ${s.tltRet >= 0 ? '+' : ''}${s.tltRet}%)`).join(' · ')}</div>
      </div>
    </div>
  )
}
