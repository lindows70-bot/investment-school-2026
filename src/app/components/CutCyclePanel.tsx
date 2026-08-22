'use client'
// 📉 금리 인하 사이클 역사 — "경기가 좋을 때 인하하면 어떻게 됐나"
//   ⚠️ 판정 축은 **인하 시점의 경기 상태**(실업률 수준·12개월 추세)다. 뒤에 침체가 왔는지는 '결과'로 따로 적는다
//      (침체 여부로 분류하면 1975·1992가 보험성으로, 2019가 위기성으로 뒤집힌다 — Phase 0 실측).
//   ⛔ 표본 5건 미만이면 평균·승률을 내지 않는다(위기성 인하는 주가 표본이 2건뿐이라 그대로 내면 정반대 결론이 나온다).
import { RECESSION_WINDOW_M, type CutCycleResult } from '@/lib/cutCycleHistory'
import { TK, FS, RAD, SP } from '@/lib/theme'

const pctCell = (v: number | null) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
const pctColor = (v: number | null) => v == null ? TK.sub4 : v >= 0 ? TK.green400 : TK.red400

export default function CutCyclePanel({ d }: { d: CutCycleResult }) {
  const box = { background: TK.bg7, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const cur = d.current
  const ins = d.summary.find(s => s.kind === 'insurance')
  // '보험성인 줄 알았는데 침체가 온' 사례 — 데이터에서 뽑는다(리터럴 금지)
  const falseAlarms = d.cycles.filter(c => c.kind === 'insurance' && c.recessionAfter != null)

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 4 }}>
        <b style={{ fontSize: FS.lg, color: TK.slate100 }}>📉 경기가 좋을 때 금리를 내리면?</b>
        <span style={{ fontSize: FS.tiny, color: TK.sub3 }}>1954년 이후 인하 사이클 {d.cycles.length}건</span>
      </div>
      <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: SP.md, lineHeight: 1.6 }}>
        같은 &lsquo;인하&rsquo;라도 <b style={{ color: TK.green400 }}>경기가 버티는데 미리 내리는 것</b>과 <b style={{ color: TK.red400 }}>이미 나빠져서 어쩔 수 없이 내리는 것</b>은 결과가 다릅니다.
        인하 <b style={{ color: TK.sub2 }}>시점의 경기 상태</b>(실업률과 그 12개월 추세)로 갈랐습니다.
      </div>

      {/* 현재 사이클 */}
      {cur && (
        <div style={{ background: cur.kind === 'insurance' ? `${TK.green400}0e` : `${TK.red400}0e`, border: `1px solid ${cur.kind === 'insurance' ? TK.green400 : TK.red400}44`, borderRadius: RAD.sm, padding: '10px 13px', marginBottom: SP.md }}>
          <div style={{ fontSize: FS.body, fontWeight: 800, color: cur.kind === 'insurance' ? TK.green400 : TK.red400, marginBottom: 3 }}>
            지금 사이클({cur.start.slice(0, 7)}) = {cur.kind === 'insurance' ? '🟢 보험성 인하' : '🔴 위기성 인하'}
          </div>
          <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.65 }}>
            시작 시 정책금리 {cur.fedRate}% · 실업률 {cur.unrate}%(12개월 {cur.unrateChg12 != null ? (cur.unrateChg12 >= 0 ? '+' : '') + cur.unrateChg12 : '—'}%p) — {cur.kindNote}
          </div>
        </div>
      )}

      {/* 유형별 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        {d.summary.map(s => (
          <div key={s.kind} style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '10px 13px', borderLeft: `3px solid ${s.kind === 'insurance' ? TK.green400 : TK.red400}` }}>
            <div style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200, marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 5 }}>사이클 {s.n}건 · 주가 표본 {s.nWithSpx}건</div>
            {s.suppressed ? (
              <div style={{ fontSize: FS.tiny, color: TK.amber400, lineHeight: 1.6 }}>⚠️ {s.suppressed}</div>
            ) : (
              <div style={{ display: 'flex', gap: SP.md, flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: FS.tiny, color: TK.sub4 }}>12개월 주가(중위)</div><b style={{ fontSize: FS.lg, color: pctColor(s.medSpx12), fontFamily: 'monospace' }}>{pctCell(s.medSpx12)}</b></div>
                <div><div style={{ fontSize: FS.tiny, color: TK.sub4 }}>상승 비율</div><b style={{ fontSize: FS.lg, color: TK.slate200, fontFamily: 'monospace' }}>{s.winRate12}%</b></div>
                {/* ⚠️ 라벨의 개월수는 판정에 쓴 창(RECESSION_WINDOW_M)에서 뽑는다 — 리터럴로 박으면 창을 바꿀 때 조용히 거짓말이 된다 */}
                <div><div style={{ fontSize: FS.tiny, color: TK.sub4 }}>{RECESSION_WINDOW_M}개월 내 침체</div><b style={{ fontSize: FS.lg, color: s.recessionRate != null && s.recessionRate >= 30 ? TK.amber400 : TK.slate200, fontFamily: 'monospace' }}>{s.recessionRate != null ? s.recessionRate + '%' : '—'}</b></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 핵심 교훈 — 데이터에서 뽑는다 */}
      {ins && ins.medSpx12 != null && (
        <div style={{ padding: '10px 13px', borderRadius: RAD.sm, background: `${TK.amber400}0e`, border: `1px solid ${TK.amber400}33`, fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.75, marginBottom: SP.md }}>
          💡 <b style={{ color: TK.amber400 }}>답</b> — 경기가 버티는 가운데 내린 인하(보험성) 뒤 12개월 주가는 중위 <b style={{ color: TK.green400 }}>{pctCell(ins.medSpx12)}</b>,
          {' '}{ins.nWithSpx}번 중 {Math.round((ins.winRate12! / 100) * ins.nWithSpx)}번 올랐습니다.
          {' '}<b style={{ color: TK.slate200 }}>다만 {ins.n}건 중 {falseAlarms.length}건({ins.recessionRate}%)은 {RECESSION_WINDOW_M}개월 안에 침체가 왔습니다</b>
          {falseAlarms.length > 0 && <> — {falseAlarms.map(f => `${f.start.slice(0, 7)}(${f.recessionAfterMonths}개월 뒤)`).join(' · ')}. 당시에도 &ldquo;경기는 괜찮다&rdquo;고 봤지만 아니었습니다.</>}
          {' '}즉 &ldquo;보험성 인하 = 안전&rdquo;이 아니라 <b style={{ color: TK.slate200 }}>대체로 좋았지만 3~4번 중 1번은 연준의 진단이 틀렸다</b>가 정확한 읽기입니다.
        </div>
      )}

      {/* 전체 표 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', fontSize: FS.tiny }}>
          <thead>
            <tr style={{ color: TK.sub4 }}>
              {['인하 시작', '정책금리', '실업률(12M변화)', '유형', `이후 침체(${RECESSION_WINDOW_M}개월 내)`, 'S&P 6M', '12M', '24M', '10년물 12M'].map(h => (
                <th key={h} style={{ textAlign: h === '인하 시작' || h === '유형' ? 'left' : 'right', padding: '5px 6px', borderBottom: `1px solid ${TK.line1}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.cycles.slice().reverse().map(c => (
              <tr key={c.start} title={c.kindNote}>
                <td style={{ padding: '5px 6px', fontFamily: 'monospace', color: TK.slate200 }}>{c.start.slice(0, 7)}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: TK.sub2 }}>{c.fedRate}%</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: TK.sub2 }}>
                  {c.unrate ?? '—'}% <span style={{ color: c.unrateChg12 != null && c.unrateChg12 >= 0.5 ? TK.red400 : TK.sub4 }}>({c.unrateChg12 != null ? (c.unrateChg12 >= 0 ? '+' : '') + c.unrateChg12 : '—'})</span>
                </td>
                <td style={{ padding: '5px 6px', color: c.kind === 'insurance' ? TK.green400 : TK.red400, whiteSpace: 'nowrap' }}>{c.kind === 'insurance' ? '🟢 보험성' : '🔴 위기성'}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', color: c.recessionAfter ? TK.amber400 : TK.sub4, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {c.recessionAfter ? `${c.recessionAfter.slice(0, 7)} (${c.recessionAfterMonths}개월)` : '—'}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: pctColor(c.spx6m) }}>{pctCell(c.spx6m)}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: pctColor(c.spx12m) }}>{pctCell(c.spx12m)}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: pctColor(c.spx24m) }}>{pctCell(c.spx24m)}</td>
                <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', color: TK.sub2 }}>{c.dgs10Chg12 != null ? (c.dgs10Chg12 >= 0 ? '+' : '') + c.dgs10Chg12 + '%p' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: FS.tiny, color: TK.sub4, marginTop: SP.sm, lineHeight: 1.7 }}>
        ⚠️ {d.note} 주가는 배당 제외 지수 기준이며 <b style={{ color: TK.sub2 }}>과거가 미래를 보장하지 않습니다.</b>
        {' '}실업률 12개월 변화 +0.5%p를 &lsquo;나빠지는 중&rsquo;의 경계로 썼습니다(삼 룰과 같은 잣대).
      </div>
    </div>
  )
}
