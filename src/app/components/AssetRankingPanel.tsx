'use client'
// 🏆 전세계 자산 시가총액 순위 — "비트코인이 어디쯤 서 있나"를 절대 크기로.
//   ⚠️ 순위표의 숫자는 전부 실시간 계산이다(제1원칙). 표에 시총을 박지 않는다.
import { useEffect, useState } from 'react'
import type { AssetRankingResult, RankedAsset } from '@/lib/assetRanking'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = '#12151f'
const KIND: Record<RankedAsset['kind'], { c: string; icon: string; label: string }> = {
  metal: { c: TK.amber400, icon: '🥇', label: '금속' },
  crypto: { c: TK.btcOrange, icon: '₿', label: '코인' },
  stock: { c: TK.cyan400, icon: '🏢', label: '주식' },
}
const fmtCap = (v: number) => v >= 1e12 ? `$${(v / 1e12).toFixed(2)}조` : `$${(v / 1e9).toFixed(0)}십억`

export default function AssetRankingPanel() {
  const [d, setD] = useState<AssetRankingResult | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/asset-ranking', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!alive) return; if (j?.assets?.length) { setD(j); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.line1}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 3 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>🏆 전세계 자산 시가총액 — 비트코인은 어디쯤인가</b>
      <span style={{ fontSize: FS.tiny, color: TK.sub3 }}>실시간 계산 · 금·은은 가격 × 지상 재고</span>
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 240, background: TK.bg5, borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>시가총액 데이터를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  const max = d.assets[0]?.cap ?? 1

  return (
    <div style={box}>
      {head}
      <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: SP.md, lineHeight: 1.65 }}>
        가격이 몇 % 올랐는지보다 <b style={{ color: TK.sub2 }}>덩치가 얼마나 되는지</b>가 더 많은 걸 말해줍니다 — 앞으로 몇 배 더 커질 수 있는 자산인지 가늠하는 출발점입니다.
      </div>

      {/* 요약 */}
      {d.btcCap != null && (
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '10px 13px', marginBottom: SP.md, borderLeft: `3px solid ${TK.btcOrange}` }}>
          <div style={{ fontSize: FS.body, fontWeight: 800, color: TK.slate100, marginBottom: 3 }}>
            ₿ 비트코인 {d.btcRank}위 · {fmtCap(d.btcCap)}
            {d.btcVsGoldPct != null && <span style={{ color: TK.amber400 }}> — 금의 {d.btcVsGoldPct}%</span>}
          </div>
          <div style={{ fontSize: FS.tiny, color: TK.sub2, lineHeight: 1.7 }}>
            &ldquo;디지털 금&rdquo;이라 불리지만 실제 크기는 금의 <b style={{ color: TK.slate200 }}>{d.btcVsGoldPct != null ? `${d.btcVsGoldPct}%` : '일부'}</b>입니다.
            {' '}금만큼 커지려면 지금의 <b style={{ color: TK.slate200 }}>{d.btcVsGoldPct != null && d.btcVsGoldPct > 0 ? (100 / d.btcVsGoldPct).toFixed(1) : '—'}배</b>가 되어야 한다는 뜻이고,
            {' '}이게 상승론자들이 드는 근거이자 <b style={{ color: TK.slate200 }}>동시에 그 격차가 왜 아직 안 좁혀졌는지</b>를 묻게 하는 숫자이기도 합니다.
          </div>
        </div>
      )}

      {/* 순위 막대 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: SP.md }}>
        {d.assets.map((a, i) => {
          const k = KIND[a.kind]
          const isBtc = a.key === 'btc'
          return (
            <div key={a.key} title={a.note} style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
              <span style={{ fontSize: FS.micro, color: TK.sub4, minWidth: 18, textAlign: 'right', fontFamily: 'monospace' }}>{i + 1}</span>
              <span style={{ fontSize: FS.tiny, color: isBtc ? TK.btcOrange : TK.slate200, minWidth: 108, fontWeight: isBtc ? 800 : 500 }}>
                {k.icon} {a.name}
              </span>
              <div style={{ flex: 1, background: TK.bg0, borderRadius: RAD.xs, height: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(1.5, (a.cap / max) * 100)}%`, height: '100%',
                  background: isBtc ? `linear-gradient(90deg,${TK.btcOrange},${TK.amber400})` : `${k.c}55`,
                  borderRadius: RAD.xs,
                }} />
                <span style={{ position: 'absolute', left: 7, top: 3, fontSize: FS.micro, color: TK.slate100, fontFamily: 'monospace', fontWeight: 700 }}>
                  {fmtCap(a.cap)}
                </span>
              </div>
              <span style={{ fontSize: FS.micro, color: TK.sub4, minWidth: 46, textAlign: 'right', fontFamily: 'monospace' }}>
                {a.vsBtc != null ? `${a.vsBtc}배` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: FS.micro, color: TK.sub4, textAlign: 'right', marginBottom: SP.sm }}>맨 오른쪽 = 비트코인 대비 배수</div>

      <div style={{ fontSize: FS.tiny, color: TK.sub4, lineHeight: 1.7 }}>
        {d.notes.map((n, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            {n.split('**').map((s, k) => k % 2 ? <b key={k} style={{ color: TK.sub2 }}>{s}</b> : s)}
          </div>
        ))}
      </div>
    </div>
  )
}
