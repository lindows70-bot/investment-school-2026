'use client'
// 📊 현물 vs 선물 수요 증가(30일 합) — 크립토퀀트 스타일 (2026-08-22 사용자 요청)
//  보라 막대=선물 수요(OI 30일 변화) · 회색 막대=현물 수요(ETF 순유입 30일 합, BTC 환산) · 흰 선=BTC 가격
//  ⚠️ 0선 위/아래가 핵심이다 — 아래로 내려간 구간은 그 30일 동안 **레버리지가 줄고(청산 포함) 현물이 빠져나갔다**는 뜻.
import { useEffect, useState } from 'react'
import type { CryptoDemandApi } from '@/app/api/crypto-demand/route'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = '#12151f'
const fmtK = (v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${Math.round(v)}`

export default function CryptoDemandChart() {
  const [d, setD] = useState<CryptoDemandApi | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')
  useEffect(() => {
    let alive = true
    fetch('/api/crypto-demand', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(jj => { if (!alive) return; if (jj?.points?.length) { setD(jj); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 2 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>📊 현물 vs 선물 수요 — 돈이 어느 쪽으로 들어오나</b>
      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>30일 합계 · BTC 개수 기준</span>
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 150, background: '#171b26', borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>수요 데이터를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  const P = d.points
  const W = 900, H = 190, MID = H / 2
  const vals = P.flatMap(p => [p.futures ?? 0, p.spot ?? 0])
  const amp = Math.max(1, ...vals.map(Math.abs))
  const bw = W / P.length
  const yBar = (v: number) => (v / amp) * (MID - 12)
  const prices = P.map(p => p.price).filter((v): v is number => v != null)
  const pMin = Math.min(...prices), pMax = Math.max(...prices)
  const yPx = (v: number) => H - 6 - ((v - pMin) / Math.max(1, pMax - pMin)) * (H - 16)

  const L = d.latest
  const tone = (v: number | null) => v == null ? TK.sub3 : v > 0 ? TK.green400 : TK.red400
  const yearTicks = P.map((p, i) => ({ p, i })).filter(({ p }, k) => k === 0 || p.d.slice(5, 7) !== P[k - 1]?.d.slice(5, 7))

  return (
    <div style={box}>
      {head}
      <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: SP.sm }}>
        <span style={{ color: TK.violet400 }}>■ 선물 수요</span>(빚내서 잡은 포지션 증감) ·{' '}
        <span style={{ color: TK.sub2 }}>■ 현물 수요</span>(ETF로 실제 사간 물량) · <span style={{ color: TK.slate200 }}>— BTC 가격</span>
      </div>

      {/* 최신 값 3종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '7px 10px', borderLeft: `3px solid ${TK.violet400}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>선물 수요(최근 30일)</div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: tone(L?.futures ?? null), fontVariantNumeric: 'tabular-nums' }}>
            {L?.futures != null ? `${L.futures > 0 ? '+' : ''}${L.futures.toLocaleString()} BTC` : '—'}
          </div>
        </div>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '7px 10px', borderLeft: `3px solid ${TK.sub2}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>현물 수요(최근 30일)</div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: tone(L?.spot ?? null), fontVariantNumeric: 'tabular-nums' }}>
            {L?.spot != null ? `${L.spot > 0 ? '+' : ''}${L.spot.toLocaleString()} BTC` : '—'}
          </div>
        </div>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '7px 10px', borderLeft: `3px solid ${TK.slate400}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>합계 · BTC ${L?.price ? Math.round(L.price).toLocaleString() : '—'}</div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: tone(L?.total ?? null), fontVariantNumeric: 'tabular-nums' }}>
            {L?.total != null ? `${L.total > 0 ? '+' : ''}${L.total.toLocaleString()} BTC` : '—'}
          </div>
        </div>
      </div>

      {/* 차트 — 0선 기준 위아래 막대 + 가격 라인 */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1="0" y1={MID} x2={W} y2={MID} stroke={TK.sub4} strokeWidth="0.8" />
        {P.map((p, i) => {
          const x = i * bw
          return (
            <g key={p.d}>
              {p.spot != null && <rect x={x} y={p.spot >= 0 ? MID - yBar(p.spot) : MID} width={Math.max(bw - 0.4, 0.6)} height={Math.abs(yBar(p.spot))} fill={TK.sub2} opacity={0.62} />}
              {p.futures != null && <rect x={x + bw * 0.18} y={p.futures >= 0 ? MID - yBar(p.futures) : MID} width={Math.max(bw * 0.64, 0.5)} height={Math.abs(yBar(p.futures))} fill={TK.violet400} opacity={0.85} />}
            </g>
          )
        })}
        <path d={P.map((p, i) => p.price == null ? '' : `${i === 0 ? 'M' : 'L'}${(i * bw + bw / 2).toFixed(1)},${yPx(p.price).toFixed(1)}`).join(' ').replace(/^L/, 'M')}
          fill="none" stroke={TK.slate200} strokeWidth="1.4" opacity={0.9} />
        {/* 0선 라벨 */}
        <text x="4" y={MID - 4} fill={TK.sub4} fontSize="9">0 (수요 증감 기준선)</text>
        <text x="4" y="11" fill={TK.sub4} fontSize="9">+{fmtK(amp)} BTC</text>
        <text x="4" y={H - 3} fill={TK.sub4} fontSize="9">−{fmtK(amp)} BTC</text>
        <text x={W - 4} y="11" fill={TK.sub4} fontSize="9" textAnchor="end">${Math.round(pMax / 1000)}K</text>
        <text x={W - 4} y={H - 3} fill={TK.sub4} fontSize="9" textAnchor="end">${Math.round(pMin / 1000)}K</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub4, marginTop: 2, marginBottom: SP.sm }}>
        <span>{P[0]?.d}</span>
        <span>{yearTicks.length > 2 ? `${yearTicks.length}개월 구간` : ''}</span>
        <span>{P[P.length - 1]?.d}</span>
      </div>

      <div style={{ fontSize: FS.micro, color: TK.sub4, lineHeight: 1.7 }}>
        💡 <b style={{ color: TK.sub2 }}>읽는 법</b> — 막대가 <b style={{ color: TK.sub2 }}>0선 위</b>면 그 30일 동안 돈이 들어온 것, <b style={{ color: TK.sub2 }}>아래</b>면 빠져나간 것입니다.
        보라(선물)만 크게 솟으면 <b style={{ color: TK.sub2 }}>빚으로 오른 상승</b>이라 청산에 취약하고, 회색(현물)이 함께 오르면 <b style={{ color: TK.sub2 }}>실제 매집</b>이 받쳐준 상승입니다.
        보라가 0선 아래로 깊게 파인 구간이 곧 <b style={{ color: TK.sub2 }}>대규모 청산·디레버리징</b>이 지나간 자리입니다.
        <div style={{ marginTop: 3 }}>⚠️ {d.note}{!d.spotAvailable ? ' · 현물 축은 ETF 데이터가 준비되면 표시됩니다' : ''}</div>
      </div>
    </div>
  )
}
