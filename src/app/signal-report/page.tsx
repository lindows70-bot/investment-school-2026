'use client'
// 📋 앱 신호 성적표 — Jarvis 처방전·타점 워처 신호를 실제 주가로 자기 채점한 대시보드(📌매일 그룹).
//    "이 앱의 신호를 얼마나 믿어야 하나"를 데이터로 — 표본수 상시 병기·가짜 승률 금지·과거 성과≠미래(정직 원칙).
import { useEffect, useState } from 'react'
import type { SignalReportResult, GroupStat, SigEvent } from '@/app/api/signal-report/route'
import { TK } from '@/lib/theme'

const CARD: React.CSSProperties = { background: TK.bg8, borderRadius: 14, padding: '16px 18px', border: `1px solid ${TK.border}` }
const pctColor = (r: number | null) => r == null ? TK.sub4 : r >= 0 ? TK.red400 : TK.blue400
const fmtPct = (r: number | null) => r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`

function EventChip({ e, tag }: { e: SigEvent; tag: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: TK.bg2, border: `1px solid ${TK.border}`, borderRadius: 7, padding: '3px 9px', fontSize: 11 }}>
      <span style={{ color: TK.sub4, fontSize: 9.5 }}>{tag}</span>
      <b style={{ color: TK.slate200 }}>{e.name}</b>
      <span style={{ color: pctColor(e.retNow), fontWeight: 800 }}>{fmtPct(e.retNow)}</span>
      <span style={{ color: TK.sub2, fontSize: 9.5 }}>{e.date.slice(5)} 신호</span>
    </span>
  )
}

function GroupCard({ g }: { g: GroupStat }) {
  const isSell = g.kind === 'sell'
  const accent = isSell ? TK.red400 : TK.green400
  const empty = g.n === 0
  const headWin = g.win30 ?? g.winNow
  const headLabel = g.win30 != null ? '30일 적중률' : '현재까지 적중률'
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: TK.slate200 }}>{g.title}</span>
        <span style={{ fontSize: 10.5, color: TK.sub4 }}>이벤트 {g.n}건 {g.n7 < g.n ? `· 채점 대상 ${g.n7}건(7일+)` : ''}</span>
      </div>
      {empty ? (
        <div style={{ fontSize: 12, color: TK.sub4, padding: '10px 0' }}>
          📥 신호 적립 중 — 전환 이벤트가 발생하면 자동으로 채점이 시작됩니다(타점 워처는 2026-07-18부터 적립).
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10.5, color: TK.sub4 }}>{headLabel}{isSell ? ' (하락 적중)' : ' (상승 적중)'}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: headWin != null && headWin >= 50 ? accent : TK.sub4 }}>
                {headWin != null ? `${headWin}%` : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: TK.sub4, paddingBottom: 4 }}>
              <span>30일 평균 <b style={{ color: pctColor(g.avg30) }}>{fmtPct(g.avg30)}</b>{g.n30 > 0 && <span style={{ color: TK.sub2 }}> (n={g.n30})</span>}</span>
              <span>현재까지 평균 <b style={{ color: pctColor(g.avgNow) }}>{fmtPct(g.avgNow)}</b></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {g.best && <EventChip e={g.best} tag={isSell ? '최대 방어' : '최고 적중'} />}
            {g.worst && g.worst !== g.best && <EventChip e={g.worst} tag={isSell ? '역주행' : '최대 빗나감'} />}
          </div>
          {g.recent.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead><tr style={{ color: TK.sub4, fontSize: 10 }}>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>신호일</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>종목</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>신호</th>
                <th style={{ textAlign: 'right', padding: '3px 6px' }}>30일 후</th>
                <th style={{ textAlign: 'right', padding: '3px 6px' }}>현재까지</th>
              </tr></thead>
              <tbody>
                {g.recent.slice(0, 8).map((e, i) => (
                  <tr key={`${e.ticker}:${e.date}:${i}`} style={{ borderTop: `1px solid ${TK.border}` }}>
                    <td style={{ padding: '5px 6px', color: TK.sub4, fontFamily: 'monospace' }}>{e.date.slice(5)}</td>
                    <td style={{ padding: '5px 6px', color: TK.slate200, fontWeight: 700 }}>{e.market === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}</td>
                    <td style={{ padding: '5px 6px', color: TK.sub4, fontSize: 10.5 }}>{e.label}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: pctColor(e.ret30), fontWeight: 700 }}>{fmtPct(e.ret30)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: pctColor(e.retNow), fontWeight: 700 }}>{e.retNow == null ? `D+${e.ageDays}` : fmtPct(e.retNow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default function SignalReportPage() {
  const [data, setData] = useState<SignalReportResult | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/signal-report').then(r => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setErr(true))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: TK.slate100 }}>📋 앱 신호 성적표</div>
        <div style={{ fontSize: 12, color: TK.sub4, marginTop: 4 }}>
          이 앱이 낸 신호(Jarvis 처방전·타점 전환)를 실제 주가로 <b style={{ color: TK.slate200 }}>스스로 채점</b>합니다 —
          어떤 신호를 얼마나 신뢰할지 데이터로 판단하는 훈련.
          {data?.jarvisSince && <span> · Jarvis 이력 {data.jarvisSince}~</span>}
          {data && <span> · 대상 {data.tickers}종목</span>}
        </div>
      </div>

      {err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>성적표를 불러오지 못했습니다 — 새로고침해 주세요.</div>}
      {!data && !err && <div style={{ ...CARD, color: TK.sub4, fontSize: 12.5 }}>📋 신호 이력을 채점하는 중… (첫 로드는 수십 초 걸릴 수 있어요)</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
          {data.groups.map(g => <GroupCard key={`${g.src}:${g.kind}`} g={g} />)}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: TK.sub2, lineHeight: 1.7 }}>
        ⚠️ <b>표본이 적으면(특히 10건 미만) 통계가 아니라 일화입니다</b> — 표본수를 항상 함께 보세요.
        SELL/매도 신호의 &lsquo;적중&rsquo;은 <b>신호 후 실제 하락 여부</b>로 채점합니다(공매도 수익이 아니라 &ldquo;피했으면 면한 손실&rdquo;의 의미).
        대상은 학생 보유 종목뿐이라 선택 편향이 있고, 진입가는 신호일 이하 최근 종가(±1일 오차)·배당 미반영.
        Jarvis 신호는 연속 반복 판정을 <b>연속 구간의 첫날 1건</b>으로 압축해 자기상관을 제거했습니다.
        과거 성과는 미래를 보장하지 않으며, 이 화면은 교육용 자기 검증 지표입니다.
      </div>
    </div>
  )
}
