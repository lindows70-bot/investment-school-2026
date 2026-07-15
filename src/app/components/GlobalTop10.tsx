'use client'
// 🌍 글로벌 시총 Top 10 터미널 — KR vs US 체급 비교 (교육적 앵커)
import { useState, useEffect } from 'react'
import type { GlobalTop10Result, TopEntry } from '@/app/api/global-top10/route'
import { TK } from '@/lib/theme'

const BORDER = TK.border
const LYNCH_COLOR: Record<string, string> = { '빠른성장주': TK.green500, '대형우량주': TK.blue500, '경기순환주': TK.amber500, '저성장주': TK.sub, '회생주': TK.red500, '자산주': TK.purple400 }
const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}`

const fmtKrw = (v: number) => {
  if (v >= 1e16) return `${(v / 1e16).toFixed(0)}경원`
  if (v >= 1e12) return `${(v / 1e12).toFixed(0)}조원`
  return `${(v / 1e8).toFixed(0)}억원`
}
const fmtUsd = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  return `$${(v / 1e9).toFixed(0)}B`
}

function Row({ e, maxMc }: { e: TopEntry; maxMc: number }) {
  const up = (e.changePct ?? 0) > 0
  const chgCol = e.changePct == null ? TK.slate500 : up ? TK.green500 : TK.red500
  const lCol = LYNCH_COLOR[e.lynchLabel] ?? TK.sub
  const barW = Math.round((e.marketCapKrw / maxMc) * 100)
  return (
    <div style={{ padding: '9px 12px', background: '#0b0e15', borderRadius: 9, border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: e.rank <= 3 ? 18 : 14, minWidth: 28, textAlign: 'center' }}>{medal(e.rank)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 14 }}>{e.name}</span>
            <span style={{ color: TK.slate500, fontSize: 10.5 }}>{e.ticker}</span>
            <span style={{ background: `${lCol}1a`, color: lCol, border: `1px solid ${lCol}44`, borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{e.lynchLabel}</span>
            <span style={{ color: TK.sub, fontSize: 10.5 }}>{e.sector}</span>
          </div>
          {/* 시총 시각화 바 */}
          <div style={{ height: 3, background: TK.border, borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
            <div style={{ width: `${barW}%`, height: '100%', background: e.market === 'US' ? TK.blue500 : TK.green500, borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 110 }}>
          {/* KRW + USD 한 줄 — US/KR 행 높이 통일 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'flex-end' }}>
            <span style={{ color: TK.slate200, fontWeight: 900, fontSize: 13, fontFamily: 'monospace' }}>{fmtKrw(e.marketCapKrw)}</span>
            {e.market === 'US' && e.marketCapUsd && (
              <span style={{ color: TK.slate500, fontSize: 10, fontFamily: 'monospace' }}>({fmtUsd(e.marketCapUsd)})</span>
            )}
          </div>
          <div style={{ color: chgCol, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
            {e.changePct == null ? '─' : `${up ? '▲' : '▼'}${Math.abs(e.changePct).toFixed(1)}%`}
          </div>
        </div>
      </div>
    </div>
  )
}

function SidePanel({ flag, title, list, maxMc }: { flag: string; title: string; list: TopEntry[]; maxMc: number }) {
  const total = list.reduce((s, e) => s + Number(e.marketCapKrw || 0), 0)   // Number 강제(문자열 시총 방어)
  return (
    <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>{flag}</span>
        <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>{title}</span>
        <span style={{ marginLeft: 'auto', color: TK.sub2, fontSize: 11 }}>합계: <b style={{ color: TK.slate200 }}>{fmtKrw(total)}</b></span>
      </div>
      {list.length ? list.map(e => <Row key={e.ticker} e={e} maxMc={maxMc} />)
        : <div style={{ color: TK.sub, fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 로딩 중…</div>}
    </div>
  )
}

export default function GlobalTop10() {
  const [data, setData] = useState<GlobalTop10Result | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/global-top10', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (alive) setData(j) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const allEntries = [...(data?.us ?? []), ...(data?.kr ?? [])]
  const maxMc = Math.max(1, ...allEntries.map(e => e.marketCapKrw))

  // 한국 1위 vs 미국 1위 체급 비교 교육 멘트
  const kr1 = data?.kr[0], us1 = data?.us[0]
  const ratio = kr1 && us1 ? Math.round(us1.marketCapKrw / kr1.marketCapKrw) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 + 교육적 앵커 */}
      <div style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.10),rgba(34,197,94,0.06))', border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>🌍</span>
          <span style={{ color: TK.slate200, fontWeight: 800, fontSize: 15 }}>글로벌 시총 거인 터미널</span>
          {data && <span style={{ marginLeft: 'auto', color: TK.slate500, fontSize: 10 }}>USD/KRW {data.usdKrw.toLocaleString()} · {new Date(data.asOf).toLocaleString('ko-KR')}</span>}
        </div>
        {ratio && (
          <div style={{ color: TK.sub5, fontSize: 12, lineHeight: 1.6 }}>
            🎓 <b style={{ color: TK.blue400 }}>미국 1위({us1?.name?.split(' ')[0]})</b> 시총 <b style={{ color: TK.blue500 }}>{fmtKrw(us1!.marketCapKrw)}</b>은
            <b style={{ color: TK.green500 }}> 한국 1위({kr1?.name})</b> 대비 <b style={{ color: TK.amber500 }}>{ratio}배</b> 규모 — 자산의 글로벌 분산 필요성을 수치로 확인하세요.
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: TK.sub, textAlign: 'center', padding: 40 }}>🌍 글로벌 시총 데이터를 수집 중입니다…</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <SidePanel flag="🇺🇸" title="미국 시총 Top 10" list={data?.us ?? []} maxMc={maxMc} />
          <SidePanel flag="🇰🇷" title="한국 시총 Top 10" list={data?.kr ?? []} maxMc={maxMc} />
        </div>
      )}

      <div style={{ color: TK.sub, fontSize: 10, lineHeight: 1.6 }}>
        ※ 시총 = 당일 종가 기준 추정치 · 바 길이 = 미국·한국 통합 상대 규모 · 린치 분류는 교육용 · 12h 캐시 · 교육 시뮬레이션이며 투자 추천 아님
      </div>
    </div>
  )
}
