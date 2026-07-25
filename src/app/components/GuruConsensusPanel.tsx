'use client'
// 🤝 거장들의 합의 종목 패널 — 9인 전설의 상위 10위권에서 2명 이상 겹치는 종목(consensus picks). 투자의 재미·교육용.
import { useEffect, useState } from 'react'
import type { GuruConsensusResult } from '@/app/api/guru-consensus/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }

// 겹친 인원수 → 색(많을수록 강조)
const countStyle = (n: number) => n >= 5 ? { c: TK.amber400, bg: `${TK.amber400}1e` }
  : n === 4 ? { c: TK.orange400, bg: `${TK.orange400}1a` }
    : n === 3 ? { c: TK.blue400, bg: `${TK.blue400}18` }
      : { c: TK.sub4, bg: `${TK.sub4}14` }

export default function GuruConsensusPanel() {
  const [data, setData] = useState<GuruConsensusResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/guru-consensus').then(r => r.ok ? r.json() : Promise.reject()).then((d: GuruConsensusResult) => {
      if (d.status === 'ok') setData(d); else setErr(true)
    }).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: TK.slate100 }}>🤝 거장들의 합의 종목</span>
        <span style={{ fontSize: 11.5, color: TK.sub4 }}>{data?.trackedFunds ?? 9}인 전설 중 <b style={{ color: TK.slate200 }}>2명 이상</b>이 상위 10위권에 담은 종목 — 서로 모르는 대가들이 같은 배를 탄 곳</span>
      </div>

      {err && <div style={{ color: TK.sub4, fontSize: 12 }}>합의 데이터를 불러오지 못했습니다.</div>}
      {!data && !err && <div style={{ color: TK.sub4, fontSize: 12 }}>🤝 9인의 상위 보유를 교차 분석 중…</div>}

      {data?.status === 'ok' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {data.stocks.map(s => {
            const cs = countStyle(s.count)
            return (
              <div key={(s.ticker ?? s.name) + s.count} style={{ background: TK.bg3, border: `1px solid ${cs.c}44`, borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: cs.c, background: cs.bg, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>{s.count}명</span>
                  <b style={{ color: TK.slate100, fontSize: 13 }}>{s.ticker ?? s.name}</b>
                  {s.ticker && <span style={{ color: TK.sub4, fontSize: 10 }}>{s.name.length > 18 ? s.name.slice(0, 18) + '…' : s.name}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.holders.map(h => (
                    <span key={h.mgr} title={`${h.mgr} — 포트폴리오 ${h.rank}위 · 비중 ${h.pctPort}%`}
                      style={{ fontSize: 10, color: TK.sub5, background: TK.bg5, borderRadius: 5, padding: '1px 6px', cursor: 'help' }}>
                      {h.mgr} <b style={{ color: TK.sub3 }}>{h.rank}위</b>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ fontSize: 10, color: TK.sub2, lineHeight: 1.6 }}>
        ⚠️ 각 거장의 <b>13F 상위 10위권</b>만 대상(핵심 확신 종목)이라, 하위 보유의 겹침은 빠집니다. 45일 지연 스냅샷이며, 겹친다고 지금 사라는 뜻이 아니라 <b>&lsquo;서로 다른 대가들이 왜 같은 곳에 확신을 걸었나&rsquo;</b>를 공부하는 재료입니다.
      </div>
    </div>
  )
}
