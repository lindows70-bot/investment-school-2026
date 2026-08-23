'use client'
// 🏦 COFIX — 변동금리 주담대의 기준금리. "내 대출 이자가 왜 오르나"의 출발점.
//   앱은 그동안 '주담대 신규취급 금리'(결과)만 봤는데, COFIX 가 먼저 움직이고 몇 달 뒤 상환액이 따라온다.
import { useEffect, useState } from 'react'
import type { CofixResult } from '@/lib/cofix'
import DataFreshnessBadge from '@/app/components/DataFreshnessBadge'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = TK.bg7
const KIND = [
  { key: 'newLoan' as const, label: '신규취급액', c: TK.red400, who: '이번 달 새로 빌리는 사람에게 적용 — 시장금리를 가장 빨리 따라간다' },
  { key: 'balance' as const, label: '잔액기준', c: TK.amber400, who: '기존 대출 잔액 전체의 평균 조달비용 — 천천히 움직인다' },
  { key: 'newBalance' as const, label: '신(新) 잔액', c: TK.cyan400, who: '결제성 자금까지 포함해 셋 중 가장 낮다(2019년 도입)' },
]

export default function CofixPanel() {
  const [d, setD] = useState<CofixResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/re-cofix', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!alive) return; if (j?.monthly?.length) { setD(j); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 3 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🏦 COFIX — 변동금리 대출의 기준금리</b>
      {d?.latest && <DataFreshnessBadge statKey="cofix" period={d.latest.targetMonth} />}
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 200, background: TK.bg5, borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>COFIX 공시를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  const L = d.latest
  const rows = d.monthly.slice(0, 8)
  // 차트 — 3종 추이(오래된 → 최신)
  const P = rows.slice().reverse()
  const W = 900, H = 130, PT = 12, PB = 20, PL = 42
  const all = P.flatMap(p => [p.newLoan, p.balance, p.newBalance].filter((v): v is number => v != null))
  const lo = Math.min(...all), hi = Math.max(...all)
  const X = (i: number) => PL + (i / Math.max(1, P.length - 1)) * (W - PL - 12)
  const Y = (v: number) => PT + (1 - (v - lo) / Math.max(0.01, hi - lo)) * (H - PT - PB)
  const path = (k: 'newLoan' | 'balance' | 'newBalance') =>
    P.map((p, i) => p[k] == null ? '' : `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p[k]!).toFixed(1)}`).join(' ').replace(/^L/, 'M')

  return (
    <div style={box}>
      {head}
      {/* 🔠 설명 문단은 항상 body 크기 + sub2 이상 — 흐린 micro 로 쓰면 학생이 안 읽는다(상시 규칙) */}
      <div style={{ fontSize: FS.body, color: TK.sub2, marginBottom: SP.md, lineHeight: 1.75 }}>
        변동금리 주담대 금리 = <b style={{ color: TK.slate200 }}>COFIX + 가산금리 − 우대금리</b>입니다.
        {' '}COFIX 가 오르면 <b style={{ color: TK.slate200 }}>몇 달 안에 내 상환액이 따라 오릅니다</b> — 그래서 대출금리 발표보다 먼저 봐야 합니다.
      </div>

      {/* 최신 3종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        {KIND.map(k => {
          const v = L?.[k.key]
          const chg = d.chg3m[k.key]
          return (
            <div key={k.key} style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '10px 13px', borderLeft: `3px solid ${k.c}` }}>
              <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 2 }}>{k.label} COFIX</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <b style={{ fontSize: FS.xl, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{v != null ? v.toFixed(2) : '—'}%</b>
                {chg != null && Math.abs(chg) >= 0.01 && (
                  <span style={{ fontSize: FS.tiny, color: chg > 0 ? TK.red400 : TK.blue400 }}>
                    3개월 {chg > 0 ? '+' : ''}{chg.toFixed(2)}%p
                  </span>
                )}
              </div>
              <div style={{ fontSize: FS.tiny, color: TK.sub2, marginTop: 4, lineHeight: 1.6 }}>{k.who}</div>
            </div>
          )
        })}
      </div>

      {/* 해석 */}
      <div style={{ background: `${TK.amber400}0e`, border: `1px solid ${TK.amber400}33`, borderRadius: RAD.sm, padding: '10px 13px', marginBottom: SP.md, fontSize: FS.body, color: TK.sub2, lineHeight: 1.75 }}>
        💡 {d.reading.split('**').map((s, i) => i % 2 ? <b key={i} style={{ color: TK.amber400 }}>{s}</b> : s)}
      </div>

      {/* 추이 차트 */}
      <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 3 }}>
        최근 {P.length}개월 추이 — {KIND.map(k => <span key={k.key} style={{ color: k.c, marginRight: 8 }}>■ {k.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[lo, (lo + hi) / 2, hi].map(v => (
          <g key={v}>
            <line x1={PL} y1={Y(v)} x2={W - 12} y2={Y(v)} stroke={TK.line1} strokeWidth="0.6" />
            <text x={PL - 5} y={Y(v) + 3} fill={TK.sub4} fontSize="9" textAnchor="end">{v.toFixed(2)}</text>
          </g>
        ))}
        {KIND.map(k => <path key={k.key} d={path(k.key)} fill="none" stroke={k.c} strokeWidth="1.8" />)}
        {P.map((p, i) => (
          <text key={p.targetMonth} x={X(i)} y={H - 6} fill={TK.sub4} fontSize="9" textAnchor="middle">{p.targetMonth.slice(5)}월</text>
        ))}
      </svg>

      {/* 표 */}
      <div style={{ overflowX: 'auto', marginTop: SP.md }}>
        <table style={{ width: '100%', minWidth: 430, borderCollapse: 'collapse', fontSize: FS.tiny }}>
          <thead>
            <tr style={{ color: TK.sub4 }}>
              {['대상월', '공시일', '신규취급액', '잔액기준', '신 잔액'].map(h => (
                <th key={h} style={{ textAlign: h === '대상월' || h === '공시일' ? 'left' : 'right', padding: '5px 7px', borderBottom: `1px solid ${TK.line1}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.targetMonth} style={{ color: TK.sub2, background: i === 0 ? `${TK.amber400}0a` : undefined }}>
                <td style={{ padding: '5px 7px', fontFamily: 'monospace', color: i === 0 ? TK.slate100 : TK.sub2, fontWeight: i === 0 ? 700 : 400 }}>{m.targetMonth}</td>
                <td style={{ padding: '5px 7px', fontFamily: 'monospace', color: TK.sub4 }}>{m.publishedAt}</td>
                {(['newLoan', 'balance', 'newBalance'] as const).map(k => (
                  <td key={k} style={{ padding: '5px 7px', textAlign: 'right', fontFamily: 'monospace' }}>{m[k] != null ? m[k]!.toFixed(2) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 단기 COFIX */}
      {d.weekly.length > 0 && (
        <div style={{ marginTop: SP.md, fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.7 }}>
          <b style={{ color: TK.slate200 }}>단기 COFIX</b>(주 단위 공시) 최근:{' '}
          {d.weekly.slice(0, 5).map(w => (
            <span key={w.to} style={{ marginRight: 9, fontFamily: 'monospace' }}>
              {w.to.slice(5)} <b style={{ color: TK.slate200 }}>{w.value.toFixed(2)}%</b>
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: SP.sm, fontSize: FS.tiny, color: TK.sub4, lineHeight: 1.7 }}>
        {d.notes.map((n, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            {n.split('**').map((s, k) => k % 2 ? <b key={k} style={{ color: TK.sub2 }}>{s}</b> : s)}
          </div>
        ))}
      </div>
    </div>
  )
}
