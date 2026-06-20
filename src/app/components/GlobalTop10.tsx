'use client'
// 🌍 글로벌 시총 Top 10 터미널 — KR vs US 체급 비교 (교육적 앵커)
import { useState, useEffect } from 'react'
import type { GlobalTop10Result, TopEntry } from '@/app/api/global-top10/route'

const BORDER = '#1e293b'
const LYNCH_COLOR: Record<string, string> = { '빠른성장주': '#22c55e', '대형우량주': '#3b82f6', '경기순환주': '#f59e0b', '저성장주': '#8a9aaa', '회생주': '#ef4444', '자산주': '#c084fc' }
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
  const chgCol = e.changePct == null ? '#64748b' : up ? '#22c55e' : '#ef4444'
  const lCol = LYNCH_COLOR[e.lynchLabel] ?? '#8a9aaa'
  const barW = Math.round((e.marketCapKrw / maxMc) * 100)
  return (
    <div style={{ padding: '9px 12px', background: '#0b0e15', borderRadius: 9, border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: e.rank <= 3 ? 18 : 14, minWidth: 28, textAlign: 'center' }}>{medal(e.rank)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14 }}>{e.name}</span>
            <span style={{ color: '#64748b', fontSize: 10.5 }}>{e.ticker}</span>
            <span style={{ background: `${lCol}1a`, color: lCol, border: `1px solid ${lCol}44`, borderRadius: 6, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{e.lynchLabel}</span>
            <span style={{ color: '#8a9aaa', fontSize: 10.5 }}>{e.sector}</span>
          </div>
          {/* 시총 시각화 바 */}
          <div style={{ height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
            <div style={{ width: `${barW}%`, height: '100%', background: e.market === 'US' ? '#3b82f6' : '#22c55e', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 110 }}>
          {/* KRW + USD 한 줄 — US/KR 행 높이 통일 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'flex-end' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 900, fontSize: 13, fontFamily: 'monospace' }}>{fmtKrw(e.marketCapKrw)}</span>
            {e.market === 'US' && e.marketCapUsd && (
              <span style={{ color: '#64748b', fontSize: 10, fontFamily: 'monospace' }}>({fmtUsd(e.marketCapUsd)})</span>
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
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>{title}</span>
        <span style={{ marginLeft: 'auto', color: '#7f93a8', fontSize: 11 }}>합계: <b style={{ color: '#e2e8f0' }}>{fmtKrw(total)}</b></span>
      </div>
      {list.length ? list.map(e => <Row key={e.ticker} e={e} maxMc={maxMc} />)
        : <div style={{ color: '#8a9aaa', fontSize: 12, textAlign: 'center', padding: 20 }}>데이터 로딩 중…</div>}
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
          <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15 }}>글로벌 시총 거인 터미널</span>
          {data && <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10 }}>USD/KRW {data.usdKrw.toLocaleString()} · {new Date(data.asOf).toLocaleString('ko-KR')}</span>}
        </div>
        {ratio && (
          <div style={{ color: '#aab6c4', fontSize: 12, lineHeight: 1.6 }}>
            🎓 <b style={{ color: '#60a5fa' }}>미국 1위({us1?.name?.split(' ')[0]})</b> 시총 <b style={{ color: '#3b82f6' }}>{fmtKrw(us1!.marketCapKrw)}</b>은
            <b style={{ color: '#22c55e' }}> 한국 1위({kr1?.name})</b> 대비 <b style={{ color: '#f59e0b' }}>{ratio}배</b> 규모 — 자산의 글로벌 분산 필요성을 수치로 확인하세요.
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#8a9aaa', textAlign: 'center', padding: 40 }}>🌍 글로벌 시총 데이터를 수집 중입니다…</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <SidePanel flag="🇺🇸" title="미국 시총 Top 10" list={data?.us ?? []} maxMc={maxMc} />
          <SidePanel flag="🇰🇷" title="한국 시총 Top 10" list={data?.kr ?? []} maxMc={maxMc} />
        </div>
      )}

      <div style={{ color: '#6e7f8f', fontSize: 10, lineHeight: 1.6 }}>
        ※ 시총 = 당일 종가 기준 추정치 · 바 길이 = 미국·한국 통합 상대 규모 · 린치 분류는 교육용 · 12h 캐시 · 교육 시뮬레이션이며 투자 추천 아님
      </div>
    </div>
  )
}
