'use client'
// 💥 롱/숏 청산 + 포지션 균형 패널 (2026-08-21 사용자 요청 — 코인글래스 화면 참고)
//  색 규약: 숏청산=빨강(숏이 터짐 = 가격이 올랐다) · 롱청산=청록(롱이 터짐 = 가격이 내렸다)
//  → 코인글래스 배치와 같고, 한국식 '빨강=상승'과도 의미가 맞는다. 라벨에 뜻을 함께 적어 오독을 막는다.
import { useEffect, useState } from 'react'
import type { CryptoLiqApi } from '@/app/api/crypto-liquidation/route'
import { TK, FS, RAD, SP } from '@/lib/theme'

const CARD = '#12151f'
const fmtUsd = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${Math.round(v)}`

export default function CryptoLiquidationPanel() {
  const [d, setD] = useState<CryptoLiqApi | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')
  useEffect(() => {
    let alive = true
    fetch('/api/crypto-liquidation', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!alive) return; if (j && !j.error) { setD(j); setState('ok') } else setState('fail') })
      .catch(() => { if (alive) setState('fail') })
    return () => { alive = false }
  }, [])

  const box = { background: CARD, border: `1px solid ${TK.border}`, borderRadius: RAD.md, padding: `${SP.md}px ${SP.lg}px` } as const
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.sm, flexWrap: 'wrap', marginBottom: 6 }}>
      <b style={{ fontSize: FS.lg, color: TK.slate100 }}>💥 롱/숏 청산 — 누가 터졌나</b>
      <span style={{ fontSize: FS.micro, color: TK.sub3 }}>레버리지 포지션이 강제 정리된 금액</span>
    </div>
  )
  if (state === 'loading') return <div style={box}>{head}<div style={{ height: 90, background: '#171b26', borderRadius: RAD.sm, animation: 'pulse 1.5s infinite' }} /></div>
  if (state === 'fail' || !d) return <div style={box}>{head}<div style={{ fontSize: FS.tiny, color: TK.sub3 }}>청산 데이터를 불러오지 못했습니다 — 새로고침 해보세요.</div></div>

  const maxBar = Math.max(1, ...d.buckets.map(b => b.longUsd + b.shortUsd))
  const tot = d.totalLongUsd + d.totalShortUsd
  const longShare = tot > 0 ? (d.totalLongUsd / tot) * 100 : 0
  const ls = d.longShort ?? []
  const lsMax = ls.length ? Math.max(...ls.map(p => p.longPct)) : 0
  const lsMin = ls.length ? Math.min(...ls.map(p => p.longPct)) : 0

  return (
    <div style={box}>
      {head}
      {/* 24h 합계 — 어느 쪽이 더 크게 터졌나 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: SP.sm, marginBottom: SP.md }}>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '8px 11px', borderLeft: `3px solid ${TK.cyan400}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>롱 청산 <span style={{ color: TK.sub4 }}>· 가격이 내려 롱이 터짐</span></div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.cyan400, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(d.totalLongUsd)}</div>
        </div>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '8px 11px', borderLeft: `3px solid ${TK.red400}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>숏 청산 <span style={{ color: TK.sub4 }}>· 가격이 올라 숏이 터짐</span></div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.red400, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(d.totalShortUsd)}</div>
        </div>
        <div style={{ background: TK.bg0, borderRadius: RAD.sm, padding: '8px 11px', borderLeft: `3px solid ${TK.sub4}` }}>
          <div style={{ fontSize: FS.micro, color: TK.sub3 }}>합계 · {d.count.toLocaleString()}건</div>
          <div style={{ fontSize: FS.lg, fontWeight: 800, color: TK.slate200, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(tot)}</div>
        </div>
      </div>

      {/* 시간대별 스택 막대 — 스크린샷의 그 차트(단, 90일이 아니라 24시간) */}
      {d.buckets.length > 0 ? (
        <>
          <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 4 }}>
            시간대별 청산 <span style={{ color: TK.cyan400 }}>■ 롱</span> <span style={{ color: TK.red400 }}>■ 숏</span>
            <span style={{ color: TK.sub4 }}> · {d.rangeFrom} ~ {d.rangeTo} (KST)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, marginBottom: 4 }}>
            {d.buckets.map(b => {
              const h = ((b.longUsd + b.shortUsd) / maxBar) * 100
              const lh = b.longUsd + b.shortUsd > 0 ? (b.longUsd / (b.longUsd + b.shortUsd)) * 100 : 0
              return (
                <div key={b.t} title={`${b.hour} · 롱 ${fmtUsd(b.longUsd)} / 숏 ${fmtUsd(b.shortUsd)}`}
                  style={{ flex: 1, height: `${Math.max(h, 1)}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '2px 2px 0 0', overflow: 'hidden', minWidth: 4 }}>
                  <div style={{ height: `${100 - lh}%`, background: TK.red400 }} />
                  <div style={{ height: `${lh}%`, background: TK.cyan400 }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub4, marginBottom: SP.md }}>
            <span>{d.buckets[0]?.hour}</span><span>{d.buckets[d.buckets.length - 1]?.hour}</span>
          </div>
        </>
      ) : <div style={{ fontSize: FS.tiny, color: TK.sub3, marginBottom: SP.md }}>최근 24시간 청산 체결이 없습니다(조용한 장).</div>}

      {/* 30일 롱/숏 계정 비율 — 포지션이 어느 쪽으로 쏠려 있나 */}
      {ls.length >= 5 && (
        <>
          <div style={{ fontSize: FS.micro, color: TK.sub3, marginBottom: 4 }}>
            30일 롱/숏 계정 비율(바이낸스) — 지금 <b style={{ color: ls[ls.length - 1].longPct >= 50 ? TK.cyan400 : TK.red400 }}>롱 {ls[ls.length - 1].longPct}% · 숏 {ls[ls.length - 1].shortPct}%</b>
            <span style={{ color: TK.sub4 }}> · 한쪽 쏠림이 심하면 그쪽이 청산 연료가 됩니다</span>
          </div>
          <svg viewBox="0 0 560 70" style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 4 }}>
            <line x1="0" y1={70 - ((50 - lsMin) / Math.max(1, lsMax - lsMin)) * 60 - 5} x2="560" y2={70 - ((50 - lsMin) / Math.max(1, lsMax - lsMin)) * 60 - 5} stroke={TK.sub4} strokeWidth="0.6" strokeDasharray="3 3" />
            <path d={ls.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, ls.length - 1)) * 560},${70 - ((p.longPct - lsMin) / Math.max(1, lsMax - lsMin)) * 60 - 5}`).join(' ')}
              fill="none" stroke={TK.cyan400} strokeWidth="1.8" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.micro, color: TK.sub4, marginBottom: SP.sm }}>
            <span>{ls[0].d}</span><span>롱 비율 추이 (점선 = 50%)</span><span>{ls[ls.length - 1].d}</span>
          </div>
        </>
      )}

      <div style={{ fontSize: FS.micro, color: TK.sub4, lineHeight: 1.7 }}>
        💡 <b style={{ color: TK.sub2 }}>읽는 법</b> — 청산은 빚내서 산 포지션이 <b style={{ color: TK.sub2 }}>강제로 정리된 것</b>입니다.
        한쪽이 크게 터진 날은 그 방향으로 가격이 급하게 움직였다는 뜻이고, 연쇄 청산이 변동성을 키웁니다.
        <div style={{ marginTop: 3 }}>⚠️ 출처: {d.sourceNote} · {d.limitNote} · 매매 지시가 아니라 시장 상태 관측입니다.</div>
      </div>
    </div>
  )
}
