'use client'
// 🎛️ 일드커브 컨트롤(YCC) — 중앙은행이 장기금리를 눌러 앉히는 정책. 일본 실사례 + 미국의 '사실상 YCC' 논쟁
//   숫자는 전부 FRED 실데이터(일본 10년물). 정책 연혁만 정적 참조.
import type { YccResult } from '@/lib/yccHistory'
import { TK, FS, RAD, SP } from '@/lib/theme'

export default function YccPanel({ d }: { d: YccResult }) {
  const box = { background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const

  // 일본 10년물 스파크라인 — 억눌린 구간(2016-09~2024-03)을 음영으로
  const P = d.jgb
  const W = 900, H = 130, PT = 10, PB = 20, PL = 34
  const vals = P.map(p => p.v)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const X = (i: number) => PL + (i / Math.max(1, P.length - 1)) * (W - PL - 10)
  const Y = (v: number) => PT + (1 - (v - lo) / Math.max(0.01, hi - lo)) * (H - PT - PB)
  const iStart = P.findIndex(p => p.date >= '2016-09')
  const iEnd = P.findIndex(p => p.date >= '2024-03')
  const path = P.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 4 }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🎛️ 일드커브 컨트롤(YCC) — 중앙은행이 장기금리를 붙잡는다는 것</b>
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: SP.md, lineHeight: 1.7 }}>
        보통 중앙은행은 <b style={{ color: TK.sub2 }}>단기금리</b>만 정합니다. 장기금리는 시장이 정하죠.
        YCC는 여기서 한 걸음 더 나아가 <b style={{ color: TK.sub2 }}>&ldquo;10년물 금리가 이 선을 넘지 못하게 하겠다&rdquo;</b>고 선언하고,
        넘으면 <b style={{ color: TK.sub2 }}>돈을 찍어 무제한으로 국채를 사들여</b> 눌러 앉히는 정책입니다.
        정부가 빚을 아무리 늘려도 이자 부담이 커지지 않게 만드는 대신, <b style={{ color: TK.amber400 }}>통화 가치와 채권 시장의 가격 기능을 대가로 치릅니다.</b>
      </div>

      {/* 일본 실사례 */}
      <div style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200, marginBottom: 5 }}>🇯🇵 세계 유일의 대규모 실험 — 일본 10년물 국채금리</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {iStart >= 0 && iEnd > iStart && (
          <rect x={X(iStart)} y={PT} width={X(iEnd) - X(iStart)} height={H - PT - PB} fill={TK.violet400} opacity={0.12} />
        )}
        {[lo, (lo + hi) / 2, hi].map(v => (
          <g key={v}>
            <line x1={PL} y1={Y(v)} x2={W - 10} y2={Y(v)} stroke={TK.line1} strokeWidth="0.6" />
            <text x={PL - 4} y={Y(v) + 3} fill={TK.sub4} fontSize="8.5" textAnchor="end">{v.toFixed(2)}%</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={TK.cyan400} strokeWidth="1.8" />
        {iStart >= 0 && <text x={X(iStart) + 4} y={PT + 11} fill={TK.violet400} fontSize="9" fontWeight="700">← YCC 시행 구간 →</text>}
        <text x={PL} y={H - 6} fill={TK.sub4} fontSize="8.5">{P[0]?.date}</text>
        <text x={W - 10} y={H - 6} fill={TK.sub4} fontSize="8.5" textAnchor="end">{P[P.length - 1]?.date}</text>
      </svg>

      <div style={{ display: 'flex', gap: SP.md, flexWrap: 'wrap', margin: `${SP.sm}px 0 ${SP.md}px` }}>
        {[
          { k: 'YCC 기간 평균', v: d.duringAvg != null ? d.duringAvg.toFixed(2) + '%' : '—', s: '2016-09 ~ 2024-03', c: TK.violet400 },
          { k: '종료 후 평균', v: d.afterAvg != null ? d.afterAvg.toFixed(2) + '%' : '—', s: '통제를 놓은 뒤', c: TK.amber400 },
          { k: '현재', v: d.latest ? d.latest.v.toFixed(2) + '%' : '—', s: d.latest?.date ?? '', c: TK.cyan400 },
          { k: '미국 30년물(비교)', v: d.us30 ? d.us30.v.toFixed(2) + '%' : '—', s: d.us30?.date ?? '', c: TK.sub2 },
        ].map(m => (
          <div key={m.k} style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '8px 12px', minWidth: 120 }}>
            <div style={{ fontSize: FS.micro, color: TK.sub4 }}>{m.k}</div>
            <div style={{ fontSize: FS.xl, fontWeight: 800, color: m.c, fontFamily: 'monospace' }}>{m.v}</div>
            <div style={{ fontSize: FS.micro, color: TK.sub4 }}>{m.s}</div>
          </div>
        ))}
      </div>

      {/* 연혁 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: SP.md }}>
        {d.milestones.map(m => (
          <div key={m.date} style={{ display: 'flex', gap: SP.sm, alignItems: 'flex-start', fontSize: FS.micro, lineHeight: 1.6 }}>
            <span style={{ fontFamily: 'monospace', color: TK.violet400, minWidth: 54, fontWeight: 700 }}>{m.date}</span>
            <span style={{ minWidth: 52, fontFamily: 'monospace', color: TK.sub3 }}>{m.jgb10 != null ? m.jgb10.toFixed(2) + '%' : '—'}</span>
            <span style={{ color: TK.sub2 }}><b style={{ color: TK.slate200 }}>{m.title}</b> — {m.body}</span>
          </div>
        ))}
      </div>

      {/* 우리 시장과의 연결 */}
      <div style={{ padding: '10px 13px', borderRadius: RAD.sm, background: `${TK.amber400}0e`, border: `1px solid ${TK.amber400}33`, fontSize: FS.micro, color: TK.sub2, lineHeight: 1.75 }}>
        💡 <b style={{ color: TK.amber400 }}>왜 지금 이걸 알아야 하나</b> — 미국은 YCC를 공식 도입한 적이 없습니다.
        하지만 국가부채가 불어나 장기금리가 튀면, 재무부가 <b style={{ color: TK.slate200 }}>국채 바이백(되사기) 규모를 늘려</b> 장기물을 직접 사들이는 일이 벌어집니다.
        기술적으로는 유동성 관리지만, 시장은 이를 <b style={{ color: TK.slate200 }}>&ldquo;사실상의 금리 통제&rdquo;</b>로 읽습니다.
        {d.us30 && <> 지금 미국 30년물은 <b style={{ color: TK.slate200 }}>{d.us30.v.toFixed(2)}%</b>입니다.</>}
        {' '}일본이 보여준 결과는 분명합니다 — <b style={{ color: TK.slate200 }}>금리는 눌렸지만 통화 가치가 대가를 치렀습니다.</b>
        그래서 이런 국면에서 금·비트코인처럼 <b style={{ color: TK.sub2 }}>발행량을 늘릴 수 없는 자산</b>이 주목받는 것입니다.
        {' '}⛔ 다만 이는 국면 해석이지 매수 권유가 아니며, 코인은 학생 권장 상한 5%를 지키세요.
      </div>
    </div>
  )
}
