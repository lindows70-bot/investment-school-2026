'use client'
// 🏛️ CME 기관 포지셔닝 — 미국 규제권 안의 기관(헤지펀드·자산운용사·딜러)이 어느 쪽에 서 있나.
//   펀딩비·OI 레이더(글로벌 개인 레버리지)와 **다른 사람들**을 보는 축이라 나란히 둔다.
//   ⚠️ 헤지펀드 대규모 숏 = 베이시스 차익거래의 한 다리. 방향성으로 읽으면 정반대 결론이 난다.
import { useEffect, useState } from 'react'
import type { CmeCotResult, CotGroup } from '@/lib/cmeCot'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = '#12151f'
const netColor = (v: number) => v > 0 ? TK.green400 : v < 0 ? TK.red400 : TK.sub3
const TREND_META = {
  more_long: { t: '▲ 롱 쪽으로', c: TK.green400 },
  more_short: { t: '▼ 숏 쪽으로', c: TK.red400 },
  flat: { t: '= 거의 변화 없음', c: TK.sub3 },
} as const

export default function CmeCotPanel() {
  const [d, setD] = useState<CmeCotResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/crypto-cot', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!alive) return; if (j?.groups?.length) { setD(j); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 3 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🏛️ CME 기관 포지셔닝 — 미국 기관은 어느 편에 서 있나</b>
      <span style={{ fontSize: FS.tiny, color: TK.sub3 }}>CFTC 주간 보고서 · 시카고상품거래소 비트코인 선물</span>
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 170, background: TK.bg5, borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>CFTC 데이터를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  // 순포지션 시계열 (0선 기준 막대)
  const P = d.series
  const W = 900, H = 150, MID = H / 2
  const amp = Math.max(1, ...P.flatMap(p => [Math.abs(p.lev), Math.abs(p.asset)]))
  const bw = W / P.length
  const y = (v: number) => (v / amp) * (MID - 14)

  return (
    <div style={box}>
      {head}
      <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: SP.md, lineHeight: 1.65 }}>
        위의 펀딩비·OI가 <b style={{ color: TK.sub2 }}>글로벌 거래소의 개인 레버리지</b>를 본다면, 여기는 <b style={{ color: TK.sub2 }}>미국 규제 거래소 안의 기관</b>을 봅니다 — 서로 다른 사람들입니다.
      </div>

      {/* 헤드라인 */}
      <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '10px 13px', marginBottom: SP.md, borderLeft: `3px solid ${TK.violet400}` }}>
        <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, marginBottom: 4 }}>{d.headline}</div>
        <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.75 }}>
          {d.reading.split('**').map((s, i) => i % 2 ? <b key={i} style={{ color: TK.amber400 }}>{s}</b> : s)}
        </div>
      </div>

      {/* 3주체 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        {d.groups.map((g: CotGroup) => {
          const tm = TREND_META[g.trend]
          return (
            <div key={g.key} style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '10px 13px', borderLeft: `3px solid ${netColor(g.net)}` }}>
              <div style={{ fontSize: FS.tiny, fontWeight: 700, color: TK.slate200, marginBottom: 2 }}>{g.label}</div>
              <div style={{ fontSize: FS.xl, fontWeight: 800, color: netColor(g.net), fontVariantNumeric: 'tabular-nums' }}>
                {g.net >= 0 ? '+' : ''}{g.net.toLocaleString()}
              </div>
              <div style={{ fontSize: FS.micro, color: TK.sub4, marginBottom: 4 }}>
                순 계약수 · 롱 {g.long.toLocaleString()} / 숏 {g.short.toLocaleString()}
              </div>
              <div style={{ fontSize: FS.tiny, color: tm.c, marginBottom: 4 }}>
                {tm.t} <span style={{ color: TK.sub4 }}>(8주 평균 {g.netPrior.toLocaleString()} → {g.netRecent.toLocaleString()})</span>
                {g.flipped && <b style={{ color: TK.amber400 }}> ★ 부호 전환</b>}
              </div>
              <div style={{ fontSize: FS.tiny, color: TK.sub3, lineHeight: 1.55 }}>{g.who}</div>
            </div>
          )
        })}
      </div>

      {/* 16주 시계열 */}
      <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: 4 }}>
        최근 {P.length}주 순포지션 — <span style={{ color: TK.red400 }}>■ 헤지펀드</span> · <span style={{ color: TK.cyan400 }}>■ 자산운용사</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1="0" y1={MID} x2={W} y2={MID} stroke={TK.sub4} strokeWidth="0.8" />
        {P.map((p, i) => {
          const x = i * bw
          return (
            <g key={p.date}>
              <rect x={x + bw * 0.10} y={p.lev >= 0 ? MID - y(p.lev) : MID} width={bw * 0.36} height={Math.abs(y(p.lev))} fill={TK.red400} opacity={0.85} />
              <rect x={x + bw * 0.52} y={p.asset >= 0 ? MID - y(p.asset) : MID} width={bw * 0.36} height={Math.abs(y(p.asset))} fill={TK.cyan400} opacity={0.85} />
            </g>
          )
        })}
        <rect x={2} y={MID - 10} width={116} height={12} fill={CARD} opacity={0.85} rx={2} />
        <text x={5} y={MID - 1} fill={TK.sub3} fontSize="9">0 = 롱·숏 균형선</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub4, marginTop: 2, marginBottom: SP.md }}>
        <span>{P[0]?.date}</span>
        <span>총 미결제약정 {d.openInterest.toLocaleString()}계약</span>
        <span>{P[P.length - 1]?.date}</span>
      </div>

      {/* 읽는 법 */}
      <div style={{ padding: '10px 13px', borderRadius: RAD.sm, background: `${TK.violet400}0e`, border: `1px solid ${TK.violet400}33`, fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.75, marginBottom: SP.sm }}>
        💡 <b style={{ color: TK.violet400 }}>읽는 법</b> — 헤지펀드가 숏이 크다고 &ldquo;기관이 하락에 건다&rdquo;로 읽으면 <b style={{ color: TK.slate200 }}>정반대로 틀립니다.</b>
        {' '}현물 ETF를 사면서 동시에 선물을 팔면 방향과 무관하게 이자를 먹을 수 있는데(베이시스 차익거래), 그 <b style={{ color: TK.slate200 }}>&lsquo;파는 다리&rsquo;가 여기 숏으로 잡힙니다.</b>
        {' '}그래서 방향을 보려면 <b style={{ color: TK.cyan400 }}>자산운용사</b>(연기금·펀드처럼 오래 들고 가는 돈)를 먼저 보고,
        {' '}헤지펀드는 <b style={{ color: TK.slate200 }}>숫자의 크기보다 방향의 변화</b>를 보세요.
      </div>

      <div style={{ fontSize: FS.tiny, color: TK.sub4, lineHeight: 1.7 }}>
        {d.caveats.map((c, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            {c.split('**').map((s, k) => k % 2 ? <b key={k} style={{ color: TK.sub2 }}>{s}</b> : s)}
          </div>
        ))}
      </div>
    </div>
  )
}
