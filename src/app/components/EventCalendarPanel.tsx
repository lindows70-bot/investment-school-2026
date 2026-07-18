'use client'
// 📅 내 종목 이벤트 캘린더 — 어닝 D-day·배당락·지급일 타임라인 + 연간/월별 예상 배당 현금흐름(자산 관리 상단·브리핑 컴팩트)
//    같은 API(/api/event-calendar)를 풀/컴팩트 두 화면이 공유(제2원칙). ⛔ 어닝일 수시 변경·배당 투영은 추정(캐비엇 명시)
import { useEffect, useState } from 'react'
import type { EventCalendarResult, CalEvent } from '@/app/api/event-calendar/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const fmtW = (n: number) => {
  const v = Math.round(n), a = Math.abs(v)
  const s = a >= 1e8 ? `${(a / 1e8).toFixed(1)}억` : a >= 1e4 ? `${Math.round(a / 1e4).toLocaleString('ko-KR')}만` : a.toLocaleString('ko-KR')
  return `${v < 0 ? '−' : ''}₩${s}`
}
const EV_META: Record<CalEvent['type'], { icon: string; label: string; color: string }> = {
  earnings: { icon: '🎯', label: '실적 발표', color: TK.amber400 },
  exDiv: { icon: '💰', label: '배당락', color: TK.sky400 },
  payDiv: { icon: '💵', label: '배당 지급', color: TK.green400 },
}
const fmtPer = (e: CalEvent) => e.perShare == null ? '' : e.market === 'KR' ? ` ₩${Math.round(e.perShare).toLocaleString()}/주·연` : ` $${e.perShare.toFixed(2)}/주·연`

export default function EventCalendarPanel({ compact }: { compact?: boolean }) {
  const [data, setData] = useState<EventCalendarResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/event-calendar').then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setErr(true))
  }, [])

  // ── 컴팩트(브리핑 ①½) — 7일 내 이벤트만·자체 헤더 포함, 없으면 렌더 0(조용) ──
  if (compact) {
    if (!data) return null
    const week = data.events.filter(e => e.dDay <= 7)
    if (!week.length) return null
    return (
      <div style={{ background: TK.bg1, border: `1px solid ${TK.border}`, borderRadius: 12, padding: '12px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.amber400 }}>📅 이번 주 내 종목 이벤트 {week.length}건</span>
          <a href="/assets" style={{ fontSize: 10.5, color: TK.sub4, textDecoration: 'none' }}>자산 관리에서 전체 캘린더 →</a>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {week.map((e, i) => {
          const m = EV_META[e.type]
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg2, border: `1px solid ${m.color}44`, borderRadius: 7, padding: '3px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>
              <b style={{ color: m.color, fontSize: 10 }}>{e.dDay === 0 ? 'TODAY' : `D-${e.dDay}`}</b>
              <span>{m.icon}</span>
              <b style={{ color: TK.slate200 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</b>
              <span style={{ color: TK.sub4, fontSize: 10 }}>{m.label}{fmtPer(e)}</span>
            </span>
          )
        })}
        </div>
      </div>
    )
  }

  if (err) return <div style={{ ...CARD, color: TK.sub4, fontSize: 12 }}>이벤트 캘린더를 불러오지 못했습니다.</div>
  if (!data) return <div style={{ ...CARD, color: TK.sub4, fontSize: 12 }}>📅 보유 종목의 실적·배당 일정을 수집하는 중…</div>

  const maxMonth = Math.max(1, ...data.monthly.map(m => m.krw))
  const hasDiv = data.divHoldings.length > 0

  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: TK.slate200 }}>📅 내 종목 이벤트 캘린더</span>
        <span style={{ fontSize: 11, color: TK.sub4 }}>향후 90일 실적·배당 일정 + 배당 현금흐름 · {data.scanned}종목</span>
      </div>

      {/* ① 타임라인 */}
      {data.events.length === 0 ? (
        <div style={{ fontSize: 12, color: TK.sub4 }}>향후 90일 내 예정된 실적·배당 이벤트가 없습니다{data.krNoEarnings ? ' (일부 한국 종목은 실적일 미제공)' : ''}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.events.slice(0, 14).map((e, i) => {
            const m = EV_META[e.type]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: TK.bg2, borderRadius: 8, borderLeft: `3px solid ${m.color}` }}>
                <b style={{ color: e.dDay <= 7 ? m.color : TK.sub4, fontSize: 12, fontFamily: 'monospace', minWidth: 52 }}>{e.dDay === 0 ? 'TODAY' : `D-${e.dDay}`}</b>
                <span style={{ fontSize: 11, color: TK.sub4, fontFamily: 'monospace', minWidth: 44 }}>{e.date.slice(5)}</span>
                <span>{m.icon}</span>
                <b style={{ color: TK.slate200, fontSize: 12.5 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</b>
                <span style={{ color: TK.sub4, fontSize: 11.5 }}>{m.label}{fmtPer(e)}</span>
                {e.type === 'earnings' && e.dDay <= 7 && <span style={{ marginLeft: 'auto', fontSize: 10, color: TK.amber400 }}>⚠️ 어닝 갭 변동성 주의</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* ② 배당 현금흐름 */}
      {hasDiv && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: TK.sub4 }}>연간 예상 배당 (보유수량 × 연배당)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: TK.green400, margin: '2px 0 8px' }}>{fmtW(data.annualDivKrw)}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <tbody>
                {data.divHoldings.slice(0, 8).map(h => (
                  <tr key={h.ticker} style={{ borderTop: `1px solid ${TK.border}` }}>
                    <td style={{ padding: '4px 6px', color: TK.slate200, fontWeight: 700 }}>{h.market === 'KR' ? '🇰🇷' : '🇺🇸'} {h.name}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: TK.sub4 }}>{h.yieldPct != null ? `${h.yieldPct}%` : '—'}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: TK.green400, fontWeight: 700 }}>{fmtW(h.annualKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 11, color: TK.sub4, marginBottom: 6 }}>월별 예상 배당 (지난 1년 지급 패턴 투영·추정)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
              {data.monthly.map(m => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  {m.krw > 0 && <span style={{ fontSize: 8.5, color: TK.sub4 }}>{Math.round(m.krw / 1e4)}만</span>}
                  <div style={{ width: '100%', height: Math.max(2, m.krw / maxMonth * 60), background: m.krw > 0 ? TK.green400 : TK.bg2, borderRadius: 3, opacity: m.krw > 0 ? 0.85 : 1 }} />
                  <span style={{ fontSize: 8.5, color: TK.sub2 }}>{Number(m.month.slice(5))}월</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: TK.sub2, lineHeight: 1.6 }}>
        ⚠️ 실적 발표일은 기업이 수시로 변경합니다(±수일){data.krNoEarnings ? ' · 일부 한국 종목은 실적일 미제공' : ''} ·
        배당락·지급일은 다음 일정이 공시된 종목만 표시(공시 전엔 안 보임) ·
        월별 배당은 지난 12개월 지급 이력의 투영(증배·감배·일정 변경 미반영)이며 환율은 현재 기준 추정 · 교육·참고용.
      </div>
    </div>
  )
}
